-- =============================================
-- Migration: 023_emergency_data_purge
-- 작성: 2026-11-03
-- 선행: 004, 005, 014, 015
-- 목적: 비상 상황 대비 회사 DB 긴급 영구 파기(Kill-Switch) 기능
--   1) 법적 증빙용 파기 감사 로그 테이블(org_purge_audit_logs) 생성
--   2) 파기 대상 요약 집계 함수 (get_emergency_purge_summary)
--   3) 회사 대표(Owner) 전용 원자적 데이터 완전 파기 함수 (emergency_purge_company_data)
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. 법적 증빙용 파기 감사 로그 테이블
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_purge_audit_logs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_name                TEXT NOT NULL,
  executed_by_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  executed_by_email       TEXT,
  reason                  TEXT,
  purged_cases_count      INT NOT NULL DEFAULT 0,
  purged_recordings_count INT NOT NULL DEFAULT 0,
  purged_dnc_count        INT NOT NULL DEFAULT 0,
  executed_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_purge_audit_org ON public.org_purge_audit_logs(org_id, executed_at DESC);

ALTER TABLE public.org_purge_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_purge_audit_logs_select ON public.org_purge_audit_logs;
CREATE POLICY org_purge_audit_logs_select ON public.org_purge_audit_logs
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.current_org_role() = 'owner');

GRANT SELECT ON public.org_purge_audit_logs TO authenticated;

-- ---------------------------------------------
-- 2. 파기 대상 사전 집계 함수 (get_emergency_purge_summary)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.get_emergency_purge_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id      UUID;
  v_org_name    TEXT;
  v_role        TEXT;
  v_cases       INT := 0;
  v_rec         INT := 0;
  v_dnc         INT := 0;
  v_batches     INT := 0;
BEGIN
  v_org_id := public.current_org_id();
  v_role   := public.current_org_role();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION '소속 회사를 확인할 수 없습니다.';
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = v_org_id;

  SELECT count(*) INTO v_cases   FROM public.cases WHERE org_id = v_org_id;
  SELECT count(*) INTO v_rec     FROM public.call_recordings WHERE org_id = v_org_id;
  SELECT count(*) INTO v_dnc     FROM public.org_dnc_list WHERE org_id = v_org_id;
  SELECT count(*) INTO v_batches FROM public.lead_import_batches WHERE org_id = v_org_id;

  RETURN jsonb_build_object(
    'org_id', v_org_id,
    'org_name', COALESCE(v_org_name, '회사'),
    'role', v_role,
    'is_owner', (v_role = 'owner'),
    'cases_count', v_cases,
    'recordings_count', v_rec,
    'dnc_count', v_dnc,
    'batches_count', v_batches
  );
END;
$$;

-- ---------------------------------------------
-- 3. 회사 데이터 긴급 영구 파기 함수 (emergency_purge_company_data)
-- ---------------------------------------------
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
  v_org_id      UUID;
  v_org_name    TEXT;
  v_role        TEXT;
  v_user_email  TEXT;
  v_cases_count INT := 0;
  v_rec_count   INT := 0;
  v_dnc_count   INT := 0;
  v_expected    TEXT;
BEGIN
  v_org_id := public.current_org_id();
  v_role   := public.current_org_role();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION '소속 회사를 확인할 수 없습니다.';
  END IF;

  -- 오직 회사 대표(Owner)만 파기 실행 가능
  IF v_role != 'owner' THEN
    RAISE EXCEPTION '긴급 데이터 파기는 회사 최고 대표(Owner)만 실행할 수 있습니다.';
  END IF;

  -- 본사(HQ) 안전 보호
  IF v_org_id = '00000000-0000-0000-0000-000000000001'::uuid AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION '리드마스터 본사(HQ) 데이터는 플랫폼 최고 관리자만 파기할 수 있습니다.';
  END IF;

  -- 회사명 확인
  SELECT name INTO v_org_name FROM public.organizations WHERE id = v_org_id;
  v_expected := v_org_name || ' / 모든 데이터를 영구 파기합니다';

  IF trim(p_confirm_text) != v_expected THEN
    RAISE EXCEPTION '확인 문구가 일치하지 않습니다. 올바른 형식: "%"', v_expected;
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  -- 파기 전 카운트 집계
  SELECT count(*) INTO v_cases_count FROM public.cases WHERE org_id = v_org_id;
  SELECT count(*) INTO v_rec_count   FROM public.call_recordings WHERE org_id = v_org_id;
  SELECT count(*) INTO v_dnc_count   FROM public.org_dnc_list WHERE org_id = v_org_id;

  -- 연관 하위 데이터 일괄 영구 삭제 (트랜잭션 내 원자적 실행)
  DELETE FROM public.call_recordings WHERE org_id = v_org_id;
  DELETE FROM public.case_assignment_logs WHERE org_id = v_org_id;
  DELETE FROM public.lead_import_batches WHERE org_id = v_org_id;
  DELETE FROM public.org_dnc_list WHERE org_id = v_org_id;

  DELETE FROM public.pending_calls WHERE org_id = v_org_id;
  DELETE FROM public.pending_sms WHERE org_id = v_org_id;
  DELETE FROM public.communication_logs WHERE org_id = v_org_id;
  DELETE FROM public.telegram_deliveries WHERE org_id = v_org_id;
  DELETE FROM public.telegram_feedbacks WHERE org_id = v_org_id;
  DELETE FROM public.auto_dial_items WHERE org_id = v_org_id;
  DELETE FROM public.auto_dial_batches WHERE org_id = v_org_id;
  DELETE FROM public.tax_invoices WHERE org_id = v_org_id;

  -- 고객 케이스 전체 삭제
  DELETE FROM public.cases WHERE org_id = v_org_id;

  -- 멤버 배정 수치 리셋
  UPDATE public.org_members
  SET assigned_cases = 0
  WHERE org_id = v_org_id;

  -- 법적 증빙용 감사 로그 기록 (개인정보는 포함하지 않음)
  INSERT INTO public.org_purge_audit_logs (
    org_id,
    org_name,
    executed_by_user_id,
    executed_by_email,
    reason,
    purged_cases_count,
    purged_recordings_count,
    purged_dnc_count,
    executed_at
  ) VALUES (
    v_org_id,
    v_org_name,
    auth.uid(),
    v_user_email,
    p_reason,
    v_cases_count,
    v_rec_count,
    v_dnc_count,
    now()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'org_id', v_org_id,
    'org_name', v_org_name,
    'purged_cases', v_cases_count,
    'purged_recordings', v_rec_count,
    'purged_dnc', v_dnc_count,
    'executed_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_emergency_purge_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.emergency_purge_company_data(TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_emergency_purge_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.emergency_purge_company_data(TEXT, TEXT) TO authenticated;

COMMIT;
