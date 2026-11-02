-- =============================================
-- Migration: 019_bulk_distribution_and_quality
-- 작성: 2026-11-03
-- 선행: 013, 018
-- 목적:
--   1) 50인 상담원 · 15,000건 대규모 DB 초고속 일괄 자동 배분 (distribute_unassigned_cases_bulk)
--   2) 엑셀 등록 회차(배치)별 실시간 DB 품질 및 계약 전환율 집계 (get_batch_quality_stats)
--   3) lead_import_batches 테이블 품질 분석 컬럼 확장
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
-- 2. 대용량 미배정 리드 고속 일괄 배분 RPC
--    - 브라우저로 15,000건을 전송하지 않고 DB 내부에서 직접 슬라이싱 & 배분
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
  s public.org_distribution_settings%ROWTYPE;
  v_case_ids TEXT[];
  v_n INT;
  v_users UUID[];
  v_user_count INT;
  v_open INT[];
  v_target_user UUID;
  v_final_case_ids TEXT[] := ARRAY[]::TEXT[];
  v_final_user_ids UUID[] := ARRAY[]::UUID[];
  v_summary JSONB := '{}'::jsonb;
  v_user_assigned_counts INT[];
  i INT;
  u_idx INT;
  best_idx INT;
  v_cap INT;
BEGIN
  -- 1. 권한 확인 (관리자만 가능)
  IF v_org IS NULL OR NOT public.is_org_admin() THEN
    RAISE EXCEPTION '회사 관리자만 대량 배분을 실행할 수 있습니다';
  END IF;

  IF p_mode NOT IN ('round_robin', 'quota', 'balanced') THEN
    RAISE EXCEPTION '지원하지 않는 배분 방식입니다 (round_robin, quota, balanced)';
  END IF;

  -- 2. 대상 상담원 목록 확정
  IF p_user_ids IS NOT NULL AND array_length(p_user_ids, 1) > 0 THEN
    -- 지정된 상담원 유효성 검사
    SELECT array_agg(m.user_id ORDER BY m.user_id) INTO v_users
    FROM public.org_members m
    WHERE m.org_id = v_org 
      AND m.user_id = ANY (p_user_ids) 
      AND m.status = 'active';
  ELSE
    -- 활성 상태이고 자동배분 받기 켜진 상담원(agent) 전원 자동 선택
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

  -- 3. 조건에 맞는 미배정 리드 조회 (오래된 등록일순)
  SELECT array_agg(case_id ORDER BY created_at ASC, case_id ASC)
  INTO v_case_ids
  FROM (
    SELECT case_id
    FROM public.cases
    WHERE org_id = v_org
      AND deleted_at IS NULL
      AND assigned_user_id IS NULL
      AND (p_status_filter IS NULL OR p_status_filter = '' OR status = p_status_filter)
      AND (p_inbound_path IS NULL OR p_inbound_path = '' OR inbound_path = p_inbound_path)
      AND (p_batch_id IS NULL OR import_batch_id = p_batch_id)
    ORDER BY created_at ASC, case_id ASC
    LIMIT CASE WHEN p_limit IS NOT NULL AND p_limit > 0 THEN p_limit ELSE 100000 END
  ) sub;

  v_n := COALESCE(array_length(v_case_ids, 1), 0);
  IF v_n = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'total_distributed', 0,
      'user_count', v_user_count,
      'summary', '{}'::jsonb
    );
  END IF;

  -- 4. 균형(balanced) 모드를 위한 현재 진행 중 건수 파악
  SELECT * INTO s FROM public.org_distribution_settings WHERE org_id = v_org;
  IF NOT FOUND THEN
    s.closed_statuses := ARRAY['진행불가','고객취소','사무장 접수','계약 완료','1차 입금완료','2차 입금완료','수신정지','휴지통'];
  END IF;

  v_user_assigned_counts := array_fill(0, ARRAY[v_user_count]);

  IF p_mode = 'balanced' THEN
    SELECT array_agg(
      (SELECT count(*)::int FROM public.cases c 
       WHERE c.org_id = v_org 
         AND c.assigned_user_id = u.id
         AND c.deleted_at IS NULL 
         AND NOT (COALESCE(c.status,'') = ANY (s.closed_statuses))
      ) ORDER BY u.ord
    )
    INTO v_open 
    FROM unnest(v_users) WITH ORDINALITY u(id, ord);
  END IF;

  -- 5. 인메모리 배분 매핑 계산
  v_cap := COALESCE(p_quota_per_agent, 0);

  FOR i IN 1..v_n LOOP
    IF p_mode = 'round_robin' THEN
      u_idx := ((i - 1) % v_user_count) + 1;
      v_target_user := v_users[u_idx];
      v_user_assigned_counts[u_idx] := v_user_assigned_counts[u_idx] + 1;
      v_final_case_ids := array_append(v_final_case_ids, v_case_ids[i]);
      v_final_user_ids := array_append(v_final_user_ids, v_target_user);

    ELSIF p_mode = 'quota' THEN
      -- 각 상담원별로 정해진 쿼터(v_cap)만큼 채우기
      u_idx := NULL;
      FOR best_idx IN 1..v_user_count LOOP
        IF v_cap <= 0 OR v_user_assigned_counts[best_idx] < v_cap THEN
          u_idx := best_idx;
          EXIT;
        END IF;
      END LOOP;

      -- 모든 상담원이 쿼터를 채웠으면 배분 종료
      IF u_idx IS NULL THEN
        EXIT;
      END IF;

      v_target_user := v_users[u_idx];
      v_user_assigned_counts[u_idx] := v_user_assigned_counts[u_idx] + 1;
      v_final_case_ids := array_append(v_final_case_ids, v_case_ids[i]);
      v_final_user_ids := array_append(v_final_user_ids, v_target_user);

    ELSIF p_mode = 'balanced' THEN
      -- 진행 중 건수가 가장 적은 상담원 찾기
      best_idx := 1;
      FOR best_idx IN 1..v_user_count LOOP
        IF v_open[best_idx] < v_open[best_idx] THEN 
          best_idx := best_idx; 
        END IF;
      END LOOP;
      u_idx := best_idx;
      v_open[u_idx] := v_open[u_idx] + 1;
      v_target_user := v_users[u_idx];
      v_user_assigned_counts[u_idx] := v_user_assigned_counts[u_idx] + 1;
      v_final_case_ids := array_append(v_final_case_ids, v_case_ids[i]);
      v_final_user_ids := array_append(v_final_user_ids, v_target_user);
    END IF;
  END LOOP;

  -- 6. PostgreSQL 대량 일괄 UPDATE 실행 (단일 트랜잭션 초고속 실행)
  IF array_length(v_final_case_ids, 1) > 0 THEN
    -- A) cases 테이블 일괄 배정 업데이트
    UPDATE public.cases c
    SET assigned_user_id = u.target_user,
        assigned_at = now(),
        updated_at = now()
    FROM (
      SELECT unnest(v_final_case_ids) AS case_id,
             unnest(v_final_user_ids) AS target_user
    ) u
    WHERE c.org_id = v_org AND c.case_id = u.case_id;

    -- B) 배정 이력 일괄 삽입
    INSERT INTO public.case_assignment_logs (org_id, case_id, from_user, to_user, reason, note, by_user, created_at)
    SELECT v_org, u.case_id, NULL, u.target_user, 'distribute', p_note, auth.uid(), now()
    FROM (
      SELECT unnest(v_final_case_ids) AS case_id,
             unnest(v_final_user_ids) AS target_user
    ) u;

    -- C) 상담원별 마지막 배정 시각 업데이트
    INSERT INTO public.org_agent_distribution (org_id, user_id, last_assigned_at, updated_at)
    SELECT v_org, unnest(v_users), now(), now()
    ON CONFLICT (org_id, user_id) 
    DO UPDATE SET last_assigned_at = now(), updated_at = now();
  END IF;

  -- 7. 결과 요약 통계 생성
  FOR u_idx IN 1..v_user_count LOOP
    IF v_user_assigned_counts[u_idx] > 0 THEN
      v_summary := jsonb_set(
        v_summary, 
        ARRAY[v_users[u_idx]::text], 
        to_jsonb(v_user_assigned_counts[u_idx])
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_distributed', array_length(v_final_case_ids, 1),
    'user_count', v_user_count,
    'summary', v_summary
  );
END;
$$;

-- ---------------------------------------------
-- 3. 회차(배치)별 실시간 DB 품질 및 전환율 집계 RPC
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.get_batch_quality_stats(p_limit INT DEFAULT 50)
RETURNS TABLE (
  batch_id UUID,
  batch_name TEXT,
  source TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ,
  total_rows INT,
  inserted INT,
  duplicates INT,
  invalid INT,
  dnc_filtered INT,
  open_count BIGINT,
  contact_count BIGINT,
  transferred_count BIGINT,
  contracted_count BIGINT,
  total_revenue BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := public.current_org_id();
BEGIN
  IF v_org IS NULL THEN 
    RAISE EXCEPTION '회사 정보를 확인할 수 없습니다'; 
  END IF;

  RETURN QUERY
  SELECT 
    b.id AS batch_id,
    b.name AS batch_name,
    b.source,
    b.file_name,
    b.created_at,
    b.total_rows,
    b.inserted,
    b.duplicates,
    b.invalid,
    b.dnc_filtered,
    COUNT(c.case_id) FILTER (
      WHERE c.deleted_at IS NULL 
        AND c.status NOT IN ('진행불가','고객취소','계약 완료','수신정지','휴지통')
    ) AS open_count,
    COUNT(c.case_id) FILTER (
      WHERE c.deleted_at IS NULL AND EXISTS (
        SELECT 1 FROM public.communication_logs l 
        WHERE l.org_id = v_org 
          AND (l.case_id = c.case_id OR l.phone_number = c.phone) 
          AND l.type = 'CALL_OUT' 
          AND l.duration > 0
      )
    ) AS contact_count,
    COUNT(c.case_id) FILTER (
      WHERE c.deleted_at IS NULL 
        AND c.partner_id IS NOT NULL 
        AND c.partner_id <> ''
    ) AS transferred_count,
    COUNT(c.case_id) FILTER (
      WHERE c.deleted_at IS NULL 
        AND c.status = '계약 완료'
    ) AS contracted_count,
    COALESCE(SUM(c.contract_fee) FILTER (
      WHERE c.deleted_at IS NULL 
        AND c.status = '계약 완료'
    ), 0)::BIGINT AS total_revenue
  FROM public.lead_import_batches b
  LEFT JOIN public.cases c ON c.org_id = v_org AND c.import_batch_id = b.id
  WHERE b.org_id = v_org
  GROUP BY b.id, b.name, b.source, b.file_name, b.created_at, b.total_rows, b.inserted, b.duplicates, b.invalid, b.dnc_filtered
  ORDER BY b.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMIT;
