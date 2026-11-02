-- =============================================
-- Migration: 021_agent_kpi_and_incentive
-- 작성: 2026-11-03
-- 선행: 013, 019, 020
-- 목적:
--   1) 상담원별 인센티브(성과급) 설정 테이블 (org_incentive_settings)
--   2) 팀원별 실시간 콜 활동 및 계약 성과 KPI 집계 RPC (get_agent_performance_kpi)
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. 인센티브(성과급) 계산 규칙 테이블
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

CREATE POLICY lm_incentive_read ON public.org_incentive_settings
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

CREATE POLICY lm_incentive_write ON public.org_incentive_settings
  FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());

-- ---------------------------------------------
-- 2. 팀원별 실시간 콜 활동 및 계약 성과 KPI 집계 RPC
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
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := public.current_org_id();
  v_start TIMESTAMPTZ := COALESCE(p_start_date, date_trunc('month', now()));
  v_end TIMESTAMPTZ := COALESCE(p_end_date, now());
BEGIN
  IF v_org IS NULL THEN 
    RAISE EXCEPTION '회사 정보를 확인할 수 없습니다'; 
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    COALESCE(m.display_name, u.email, '이름 없음')::TEXT AS display_name,
    COALESCE(u.email, '')::TEXT AS email,
    m.role::TEXT,
    m.status::TEXT,
    -- 담당 리드 수
    (SELECT COUNT(c.case_id) FROM public.cases c 
     WHERE c.org_id = v_org AND c.assigned_user_id = m.user_id AND c.deleted_at IS NULL) AS assigned_cases,
    -- 총 발신 콜 수
    (SELECT COUNT(l.id) FROM public.communication_logs l 
     WHERE l.org_id = v_org AND l.user_id = m.user_id AND l.type = 'CALL_OUT' 
       AND l.timestamp >= v_start AND l.timestamp <= v_end) AS total_calls,
    -- 연결된 통화 수 (통화시간 > 0)
    (SELECT COUNT(l.id) FROM public.communication_logs l 
     WHERE l.org_id = v_org AND l.user_id = m.user_id AND l.type = 'CALL_OUT' AND l.duration > 0
       AND l.timestamp >= v_start AND l.timestamp <= v_end) AS connected_calls,
    -- 총 통화시간 (초)
    (SELECT COALESCE(SUM(l.duration), 0)::BIGINT FROM public.communication_logs l 
     WHERE l.org_id = v_org AND l.user_id = m.user_id AND l.type = 'CALL_OUT'
       AND l.timestamp >= v_start AND l.timestamp <= v_end) AS total_duration_seconds,
    -- 재통화 예약 / 약속 건수
    (SELECT COUNT(c.case_id) FROM public.cases c 
     WHERE c.org_id = v_org AND c.assigned_user_id = m.user_id AND c.deleted_at IS NULL
       AND (c.status = '재통화' OR c.status = '부재')
       AND c.updated_at >= v_start AND c.updated_at <= v_end) AS reminders_count,
    -- 사무장 전달 건수
    (SELECT COUNT(c.case_id) FROM public.cases c 
     WHERE c.org_id = v_org AND c.assigned_user_id = m.user_id AND c.deleted_at IS NULL
       AND c.partner_id IS NOT NULL AND c.partner_id <> ''
       AND c.updated_at >= v_start AND c.updated_at <= v_end) AS transferred_count,
    -- 계약 체결 건수
    (SELECT COUNT(c.case_id) FROM public.cases c 
     WHERE c.org_id = v_org AND c.assigned_user_id = m.user_id AND c.deleted_at IS NULL
       AND c.status = '계약 완료'
       AND COALESCE(c.contract_at, c.updated_at) >= v_start AND COALESCE(c.contract_at, c.updated_at) <= v_end) AS contract_count,
    -- 총 수임료 매출
    (SELECT COALESCE(SUM(c.contract_fee), 0)::BIGINT FROM public.cases c 
     WHERE c.org_id = v_org AND c.assigned_user_id = m.user_id AND c.deleted_at IS NULL
       AND c.status = '계약 완료'
       AND COALESCE(c.contract_at, c.updated_at) >= v_start AND COALESCE(c.contract_at, c.updated_at) <= v_end) AS total_fee_revenue
  FROM public.org_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.org_id = v_org
  ORDER BY contract_count DESC, total_fee_revenue DESC, connected_calls DESC;
END;
$$;

COMMIT;
