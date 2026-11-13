-- =============================================
-- 035: 긴급 파기 함수 수정 (2026-11-13 KIRO)
-- 023 의 get_emergency_purge_summary / emergency_purge_company_data 는 실행하면 항상 실패했다.
--   - 없는 표: org_dnc_list (실제 org_dnc_numbers), telegram_deliveries (실제 case_deliveries)
--   - 없는 칸: org_members.assigned_cases
--   - 019~033 에서 생긴 리드 관련 표(오토콜 v4 큐·캠페인·배정)는 파기 대상에 없었다.
-- 바뀐 점
--   - 표 이름 수정, assigned_cases 갱신 삭제
--   - 파기 대상 = 고객(리드) 개인정보가 들어 있는 표 전부. 표가 없으면 건너뛴다(to_regclass).
--   - FK 순서: pending_calls → auto_dial_items → auto_dial_batches, 큐/배정 → 캠페인, 리드 연결 표 → cases → lead_import_batches
--   - 표별 삭제 건수를 결과(deleted)와 감사 기록(purged_detail)에 남긴다(개인정보 없음).
-- 남기는 것: 회사·멤버·초대, 거래처(partners)·settings·각종 회사 설정, 접근 기록(access_logs)·AI 사용 기록(감사·청구 근거),
--            근태·급여(직원 정보), 공지·지시(directives 의 case_id 는 FK SET NULL 로 비워짐), 파기 감사 기록.
-- 저장소(Storage)·구글 드라이브의 녹음 파일 자체는 이 함수가 지우지 않는다(DB 기록만).
-- 권한·확인 문구·본사 보호는 023 과 같다. 다시 실행해도 된다.
-- =============================================

BEGIN;

ALTER TABLE public.org_purge_audit_logs
  ADD COLUMN IF NOT EXISTS purged_detail JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 파기 대상 표 (삭제 순서)
CREATE OR REPLACE FUNCTION public.lm_purge_tables()
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'pending_calls', 'pending_sms',
    'auto_dial_queue', 'auto_dial_agent_allocations', 'auto_dial_campaigns',
    'auto_dial_items', 'auto_dial_batches',
    'call_recordings', 'case_assignment_logs', 'case_deliveries',
    'communication_logs', 'telegram_feedbacks', 'tax_invoices',
    'org_dnc_numbers',
    'cases',
    'lead_import_batches'
  ]::TEXT[];
$$;
REVOKE ALL ON FUNCTION public.lm_purge_tables() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_emergency_purge_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id   UUID := public.current_org_id();
  v_role     TEXT := public.current_org_role();
  v_org_name TEXT;
  v_n        BIGINT;
  v_detail   JSONB := '{}'::jsonb;
  t          TEXT;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION '소속 회사를 확인할 수 없습니다.';
  END IF;
  -- 건수도 회사 규모 정보이므로 대표만 본다
  IF v_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION '긴급 파기 요약은 회사 대표(Owner)만 볼 수 있습니다.';
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = v_org_id;

  FOREACH t IN ARRAY public.lm_purge_tables() LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE org_id = $1', t) INTO v_n USING v_org_id;
      v_detail := v_detail || jsonb_build_object(t, v_n);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'org_id', v_org_id,
    'org_name', COALESCE(v_org_name, '회사'),
    'role', v_role,
    'is_owner', TRUE,
    'cases_count', COALESCE((v_detail->>'cases')::INT, 0),
    'recordings_count', COALESCE((v_detail->>'call_recordings')::INT, 0),
    'dnc_count', COALESCE((v_detail->>'org_dnc_numbers')::INT, 0),
    'batches_count', COALESCE((v_detail->>'lead_import_batches')::INT, 0),
    'detail', v_detail
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.emergency_purge_company_data(
  p_confirm_text TEXT,
  p_reason       TEXT DEFAULT 'Emergency Purge Requested by Owner'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id     UUID := public.current_org_id();
  v_role       TEXT := public.current_org_role();
  v_org_name   TEXT;
  v_user_email TEXT;
  v_expected   TEXT;
  v_n          BIGINT;
  v_detail     JSONB := '{}'::jsonb;
  t            TEXT;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION '소속 회사를 확인할 수 없습니다.';
  END IF;

  IF v_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION '긴급 데이터 파기는 회사 최고 대표(Owner)만 실행할 수 있습니다.';
  END IF;

  IF v_org_id = '00000000-0000-0000-0000-000000000001'::uuid AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION '리드마스터 본사(HQ) 데이터는 플랫폼 최고 관리자만 파기할 수 있습니다.';
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = v_org_id;
  v_expected := v_org_name || ' / 모든 데이터를 영구 파기합니다';

  IF p_confirm_text IS NULL OR trim(p_confirm_text) <> v_expected THEN
    RAISE EXCEPTION '확인 문구가 일치하지 않습니다. 올바른 형식: "%"', v_expected;
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  -- 같은 회사 파기가 동시에 두 번 돌지 않게
  PERFORM pg_advisory_xact_lock(hashtext('lm_purge:' || v_org_id::text));

  FOREACH t IN ARRAY public.lm_purge_tables() LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE org_id = $1', t) USING v_org_id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_detail := v_detail || jsonb_build_object(t, v_n);
    END IF;
  END LOOP;

  INSERT INTO public.org_purge_audit_logs (
    org_id, org_name, executed_by_user_id, executed_by_email, reason,
    purged_cases_count, purged_recordings_count, purged_dnc_count, purged_detail, executed_at
  ) VALUES (
    v_org_id, v_org_name, auth.uid(), v_user_email, p_reason,
    COALESCE((v_detail->>'cases')::INT, 0),
    COALESCE((v_detail->>'call_recordings')::INT, 0),
    COALESCE((v_detail->>'org_dnc_numbers')::INT, 0),
    v_detail, now()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'org_id', v_org_id,
    'org_name', v_org_name,
    'purged_cases', COALESCE((v_detail->>'cases')::INT, 0),
    'purged_recordings', COALESCE((v_detail->>'call_recordings')::INT, 0),
    'purged_dnc', COALESCE((v_detail->>'org_dnc_numbers')::INT, 0),
    'deleted', v_detail,
    'executed_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_emergency_purge_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.emergency_purge_company_data(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_emergency_purge_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.emergency_purge_company_data(TEXT, TEXT) TO authenticated;

COMMIT;
