-- =============================================
-- Migration: 021_agent_kpi_and_incentive
-- 작성: 2026-11-03 / 보안·재실행 점검 2026-11-13 [KIRO]
-- 선행: 013, 019, 020
-- 목적:
--   1) 상담원별 인센티브(성과급) 설정 테이블 (org_incentive_settings)
--   2) 팀원별 실시간 콜 활동 및 계약 성과 KPI 집계 RPC (get_agent_performance_kpi)
-- 여러 번 실행해도 된다.
-- [2026-11-13 KIRO 변경]
--   - 정책: DROP POLICY IF EXISTS 후 생성(재실행 오류 방지), anon 표 권한 회수
--   - get_agent_performance_kpi:
--       · cases.contract_at 은 TEXT('yyyy-MM-dd')인데 timestamptz 와 COALESCE 해서 호출할 때마다 오류 → lm_try_kst_timestamptz()로 읽음
--       · 상담원이 부르면 본인 줄만 (예전엔 회사 전원 매출·통화 수가 보였음)
--       · 기본 기간 "이번 달" = 한국 시간 기준 (UTC 기준이면 1일 0~9시 실적이 지난달로 감)
--       · ORDER BY 를 칸 번호로 (plpgsql 출력 변수 이름과 겹침 방지)
--       · EXECUTE: anon 회수, 로그인 사용자만
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 0. 글자 날짜 → 시각 (한국 시간). 못 읽으면 NULL (오류 안 냄)
--    'yyyy-MM-dd' = 그날 한국 0시, 'yyyy-MM-dd HH:mm' (시간대 없음) = 한국 시각, 그 밖 ISO = 그대로
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.lm_try_kst_timestamptz(p TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  IF p IS NULL OR btrim(p) = '' THEN RETURN NULL; END IF;
  IF p ~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN (p::date)::timestamp AT TIME ZONE 'Asia/Seoul';
  END IF;
  IF p ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}' AND p !~ '(Z|z|[+-]\d{2}(:?\d{2})?)$' THEN
    RETURN p::timestamp AT TIME ZONE 'Asia/Seoul';
  END IF;
  RETURN p::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- ---------------------------------------------
-- 1. 인센티브(성과급) 계산 규칙 테이블 (회사당 1행)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_incentive_settings (
  org_id              UUID PRIMARY KEY DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  calc_type           TEXT NOT NULL DEFAULT 'fixed' CHECK (calc_type IN ('fixed', 'percent', 'tiered')),
  fixed_amount        INT DEFAULT 50000,          -- 건당 고정 인센티브 (기본 5만 원)
  percent_rate        NUMERIC(5,2) DEFAULT 3.00,  -- 수임료의 N% (기본 3%)
  tiered_rules        JSONB DEFAULT '[{"min":1,"max":5,"amount":50000},{"min":6,"max":10,"amount":70000},{"min":11,"amount":100000}]'::jsonb,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.org_incentive_settings ENABLE ROW LEVEL SECURITY;

-- 보기: 같은 회사 멤버 / 쓰기: 회사 관리자만
DROP POLICY IF EXISTS lm_incentive_read ON public.org_incentive_settings;
CREATE POLICY lm_incentive_read ON public.org_incentive_settings
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.current_org_id()));

DROP POLICY IF EXISTS lm_incentive_write ON public.org_incentive_settings;
CREATE POLICY lm_incentive_write ON public.org_incentive_settings
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
  WITH CHECK (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

REVOKE ALL ON public.org_incentive_settings FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_incentive_settings TO authenticated;

-- ---------------------------------------------
-- 2. 팀원별 콜 활동 및 계약 성과 KPI 집계 RPC
--    관리자 = 회사 전원, 상담원 = 본인 줄만
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agent_performance_kpi(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  email TEXT,
  role TEXT,
  status TEXT,
  assigned_cases BIGINT,
  total_calls BIGINT,
  connected_calls BIGINT,
  total_duration_seconds BIGINT,
  reminders_count BIGINT,
  transferred_count BIGINT,
  contract_count BIGINT,
  total_fee_revenue BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_org UUID := public.current_org_id();
  v_me UUID := auth.uid();
  v_admin BOOLEAN := public.is_org_admin();
  -- 기본 기간: 한국 시간 이번 달 1일 0시 ~ 지금
  v_start TIMESTAMPTZ := COALESCE(p_start_date, date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul');
  v_end TIMESTAMPTZ := COALESCE(p_end_date, now());
BEGIN
  IF v_org IS NULL OR v_me IS NULL THEN
    RAISE EXCEPTION '회사 정보를 확인할 수 없습니다';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    COALESCE(NULLIF(m.display_name, ''), u.email::TEXT, '이름 없음')::TEXT,
    COALESCE(u.email::TEXT, '')::TEXT,
    m.role::TEXT,
    m.status::TEXT,
    -- 담당 리드 수
    (SELECT COUNT(c.case_id) FROM public.cases c
     WHERE c.org_id = v_org AND c.assigned_user_id = m.user_id AND c.deleted_at IS NULL),
    -- 총 발신 콜 수
    (SELECT COUNT(l.id) FROM public.communication_logs l
     WHERE l.org_id = v_org AND l.user_id = m.user_id AND l.type = 'CALL_OUT'
       AND l.timestamp >= v_start AND l.timestamp <= v_end),
    -- 연결된 통화 수 (통화시간 > 0)
    (SELECT COUNT(l.id) FROM public.communication_logs l
     WHERE l.org_id = v_org AND l.user_id = m.user_id AND l.type = 'CALL_OUT' AND l.duration > 0
       AND l.timestamp >= v_start AND l.timestamp <= v_end),
    -- 총 통화시간 (초)
    (SELECT COALESCE(SUM(l.duration), 0)::BIGINT FROM public.communication_logs l
     WHERE l.org_id = v_org AND l.user_id = m.user_id AND l.type = 'CALL_OUT'
       AND l.timestamp >= v_start AND l.timestamp <= v_end),
    -- 재통화 예약 / 부재 건수
    (SELECT COUNT(c.case_id) FROM public.cases c
     WHERE c.org_id = v_org AND c.assigned_user_id = m.user_id AND c.deleted_at IS NULL
       AND (c.status = '재통화' OR c.status = '부재')
       AND c.updated_at >= v_start AND c.updated_at <= v_end),
    -- 사무장 전달 건수
    (SELECT COUNT(c.case_id) FROM public.cases c
     WHERE c.org_id = v_org AND c.assigned_user_id = m.user_id AND c.deleted_at IS NULL
       AND c.partner_id IS NOT NULL AND c.partner_id <> ''
       AND c.updated_at >= v_start AND c.updated_at <= v_end),
    -- 계약 체결 건수 (계약일 contract_at = 글자 → 한국 날짜로 읽음, 없으면 수정 시각)
    (SELECT COUNT(c.case_id) FROM public.cases c
     WHERE c.org_id = v_org AND c.assigned_user_id = m.user_id AND c.deleted_at IS NULL
       AND c.status = '계약 완료'
       AND COALESCE(public.lm_try_kst_timestamptz(c.contract_at), c.updated_at) >= v_start
       AND COALESCE(public.lm_try_kst_timestamptz(c.contract_at), c.updated_at) <= v_end),
    -- 총 수임료 매출 (cases.contract_fee, 만원)
    (SELECT COALESCE(SUM(c.contract_fee), 0)::BIGINT FROM public.cases c
     WHERE c.org_id = v_org AND c.assigned_user_id = m.user_id AND c.deleted_at IS NULL
       AND c.status = '계약 완료'
       AND COALESCE(public.lm_try_kst_timestamptz(c.contract_at), c.updated_at) >= v_start
       AND COALESCE(public.lm_try_kst_timestamptz(c.contract_at), c.updated_at) <= v_end)
  FROM public.org_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.org_id = v_org
    AND (v_admin OR m.user_id = v_me)
  ORDER BY 12 DESC, 13 DESC, 8 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.lm_try_kst_timestamptz(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lm_try_kst_timestamptz(TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_agent_performance_kpi(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agent_performance_kpi(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMIT;
