-- =============================================
-- Migration: 019_bulk_distribution_and_quality
-- 작성: 2026-11-03 / 보안·재실행 점검 2026-11-13 [KIRO]
-- 선행: 013, 018, 024(is_archived)
-- 목적:
--   1) 50인 상담원 · 15,000건 대규모 DB 일괄 자동 배분 (distribute_unassigned_cases_bulk)
--   2) lead_import_batches 테이블 품질 분석 컬럼 확장
--   ※ 회차 품질 집계 get_batch_quality_stats 는 028_vendor_lead_quality_roi 에서 최종 정의한다.
--     (예전에는 여기서도 만들었는데, 028이 반환 칸을 바꿔서 019를 다시 실행하면
--      "cannot change return type" 오류가 나거나 예전 버전으로 덮어쓰였다)
-- 여러 번 실행해도 된다.
-- [2026-11-13 KIRO 변경]
--   - balanced 모드: 진행 중 건수 비교가 자기 자신과 비교(v_open[i] < v_open[i])라 항상 첫 상담원에게만 갔음 → 최소값 찾기로 수정
--   - 배정 기록: 013 트리거(cases_log_assignment)가 이미 남기는데 함수가 한 번 더 넣어 두 줄씩 쌓였음
--     → lm_set_assign_reason('distribute')로 사유만 넘기고 직접 INSERT 제거
--   - 휴지통·보관(is_archived) 리드 제외, 실제로 받은 상담원만 last_assigned_at 갱신
--   - EXECUTE 권한: anon 회수, 로그인 사용자만
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. lead_import_batches 테이블 컬럼 확장
-- ---------------------------------------------
ALTER TABLE public.lead_import_batches
  ADD COLUMN IF NOT EXISTS dnc_filtered INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contact_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transferred_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contracted_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_revenue BIGINT NOT NULL DEFAULT 0;

-- ---------------------------------------------
-- 2. 대용량 미배정 리드 일괄 배분 RPC
--    - 모드: 'round_robin'(순번 1건씩), 'quota'(1인당 지정 수량), 'balanced'(진행중 적은 사람 우선)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.distribute_unassigned_cases_bulk(
  p_limit INT DEFAULT NULL,
  p_mode TEXT DEFAULT 'round_robin',
  p_user_ids UUID[] DEFAULT NULL,
  p_quota_per_agent INT DEFAULT NULL,
  p_status_filter TEXT DEFAULT NULL,
  p_inbound_path TEXT DEFAULT NULL,
  p_batch_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT '대량 자동 배분'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := public.current_org_id();
  v_closed TEXT[];
  v_case_ids TEXT[];
  v_n INT;
  v_users UUID[];
  v_user_count INT;
  v_open INT[];
  v_final_case_ids TEXT[] := ARRAY[]::TEXT[];
  v_final_user_ids UUID[] := ARRAY[]::UUID[];
  v_summary JSONB := '{}'::jsonb;
  v_cnt INT[];
  v_cap INT := COALESCE(p_quota_per_agent, 0);
  i INT;
  j INT;
  u_idx INT;
  v_total INT;
BEGIN
  -- 1. 권한 확인 (회사 관리자만)
  IF v_org IS NULL OR NOT public.is_org_admin() THEN
    RAISE EXCEPTION '회사 관리자만 대량 배분을 실행할 수 있습니다';
  END IF;

  IF p_mode IS NULL OR p_mode NOT IN ('round_robin', 'quota', 'balanced') THEN
    RAISE EXCEPTION '지원하지 않는 배분 방식입니다 (round_robin, quota, balanced)';
  END IF;
  IF p_mode = 'quota' AND v_cap <= 0 THEN
    RAISE EXCEPTION '1인당 수량을 1 이상으로 정해 주세요';
  END IF;

  -- 2. 대상 상담원 (같은 회사의 사용 중인 멤버만. 다른 회사 user_id는 무시)
  IF p_user_ids IS NOT NULL AND COALESCE(array_length(p_user_ids, 1), 0) > 0 THEN
    SELECT array_agg(m.user_id ORDER BY m.user_id) INTO v_users
    FROM public.org_members m
    WHERE m.org_id = v_org
      AND m.user_id = ANY (p_user_ids)
      AND m.status = 'active';
  ELSE
    SELECT array_agg(m.user_id ORDER BY COALESCE(d.last_assigned_at, '1970-01-01'::timestamptz) ASC, m.user_id ASC)
    INTO v_users
    FROM public.org_members m
    LEFT JOIN public.org_agent_distribution d ON d.org_id = m.org_id AND d.user_id = m.user_id
    WHERE m.org_id = v_org
      AND m.status = 'active'
      AND m.role = 'agent'
      AND COALESCE(d.receiving, true) = true;
  END IF;

  v_user_count := COALESCE(array_length(v_users, 1), 0);
  IF v_user_count = 0 THEN
    RAISE EXCEPTION '리드를 배분할 활성 상담원이 없습니다';
  END IF;

  -- 3. 조건에 맞는 미배정 리드 (오래된 등록일순, 휴지통·보관 제외)
  SELECT array_agg(sub.case_id ORDER BY sub.created_at ASC NULLS FIRST, sub.case_id ASC)
  INTO v_case_ids
  FROM (
    SELECT c.case_id, c.created_at
    FROM public.cases c
    WHERE c.org_id = v_org
      AND c.deleted_at IS NULL
      AND COALESCE(c.is_archived, false) = false
      AND COALESCE(c.status, '') <> '휴지통'
      AND c.assigned_user_id IS NULL
      AND (p_status_filter IS NULL OR p_status_filter = '' OR c.status = p_status_filter)
      AND (p_inbound_path IS NULL OR p_inbound_path = '' OR c.inbound_path = p_inbound_path)
      AND (p_batch_id IS NULL OR c.import_batch_id = p_batch_id)
    ORDER BY c.created_at ASC NULLS FIRST, c.case_id ASC
    LIMIT CASE WHEN p_limit IS NOT NULL AND p_limit > 0 THEN LEAST(p_limit, 100000) ELSE 100000 END
  ) sub;

  v_n := COALESCE(array_length(v_case_ids, 1), 0);
  IF v_n = 0 THEN
    RETURN jsonb_build_object('success', true, 'total_distributed', 0, 'user_count', v_user_count, 'summary', '{}'::jsonb);
  END IF;

  v_cnt := array_fill(0, ARRAY[v_user_count]);

  -- 4. balanced: 현재 진행 중 건수
  IF p_mode = 'balanced' THEN
    SELECT s.closed_statuses INTO v_closed FROM public.org_distribution_settings s WHERE s.org_id = v_org;
    v_closed := COALESCE(v_closed, ARRAY['진행불가','고객취소','사무장 접수','계약 완료','1차 입금완료','2차 입금완료','수신정지','휴지통']);
    SELECT array_agg(
      (SELECT count(*)::int FROM public.cases c
       WHERE c.org_id = v_org
         AND c.assigned_user_id = u.id
         AND c.deleted_at IS NULL
         AND NOT (COALESCE(c.status, '') = ANY (v_closed))
      ) ORDER BY u.ord)
    INTO v_open
    FROM unnest(v_users) WITH ORDINALITY u(id, ord);
  END IF;

  -- 5. 배분 계산
  FOR i IN 1..v_n LOOP
    u_idx := NULL;
    IF p_mode = 'round_robin' THEN
      u_idx := ((i - 1) % v_user_count) + 1;
    ELSIF p_mode = 'quota' THEN
      FOR j IN 1..v_user_count LOOP
        IF v_cnt[j] < v_cap THEN
          u_idx := j;
          EXIT;
        END IF;
      END LOOP;
      EXIT WHEN u_idx IS NULL;   -- 모두 수량을 채움
    ELSE  -- balanced: 진행 중 건수가 가장 적은 사람
      u_idx := 1;
      FOR j IN 2..v_user_count LOOP
        IF v_open[j] < v_open[u_idx] THEN
          u_idx := j;
        END IF;
      END LOOP;
      v_open[u_idx] := v_open[u_idx] + 1;
    END IF;

    v_cnt[u_idx] := v_cnt[u_idx] + 1;
    v_final_case_ids := array_append(v_final_case_ids, v_case_ids[i]);
    v_final_user_ids := array_append(v_final_user_ids, v_users[u_idx]);
  END LOOP;

  v_total := COALESCE(array_length(v_final_case_ids, 1), 0);

  -- 6. 한 번에 UPDATE (배정 기록은 013 트리거가 사유 'distribute'로 남김)
  IF v_total > 0 THEN
    PERFORM public.lm_set_assign_reason('distribute', p_note);

    UPDATE public.cases c
    SET assigned_user_id = u.target_user,
        assigned_at = now(),
        updated_at = now()
    FROM (
      SELECT unnest(v_final_case_ids) AS case_id,
             unnest(v_final_user_ids) AS target_user
    ) u
    WHERE c.org_id = v_org
      AND c.case_id = u.case_id
      AND c.assigned_user_id IS NULL;

    PERFORM public.lm_set_assign_reason(NULL, NULL);

    -- 실제로 받은 상담원만 마지막 배정 시각 갱신
    INSERT INTO public.org_agent_distribution (org_id, user_id, last_assigned_at, updated_at)
    SELECT v_org, v_users[k], now(), now()
    FROM generate_subscripts(v_users, 1) k
    WHERE v_cnt[k] > 0
    ON CONFLICT (org_id, user_id)
    DO UPDATE SET last_assigned_at = now(), updated_at = now();
  END IF;

  -- 7. 결과 요약
  FOR j IN 1..v_user_count LOOP
    IF v_cnt[j] > 0 THEN
      v_summary := v_summary || jsonb_build_object(v_users[j]::text, v_cnt[j]);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_distributed', v_total,
    'user_count', v_user_count,
    'summary', v_summary
  );
END;
$$;

REVOKE ALL ON FUNCTION public.distribute_unassigned_cases_bulk(INT, TEXT, UUID[], INT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.distribute_unassigned_cases_bulk(INT, TEXT, UUID[], INT, TEXT, TEXT, UUID, TEXT) TO authenticated;

COMMIT;
