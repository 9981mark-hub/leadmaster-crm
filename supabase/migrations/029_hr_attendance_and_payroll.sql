-- =============================================
-- Migration: 029_hr_attendance_and_payroll
-- 작성: 2026-11-10
-- 목적: flex.team 벤치마킹 기반 TM 상담원 올인원 HR (근태·출퇴근·이석·급여·인센티브) 인프라 구축
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. 상담원 출퇴근 및 실시간 근태 로그 테이블
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    clock_in_at TIMESTAMPTZ,
    clock_out_at TIMESTAMPTZ,
    current_status TEXT NOT NULL DEFAULT 'off' CHECK (current_status IN ('working', 'away', 'meal', 'off')),
    status_updated_at TIMESTAMPTZ DEFAULT NOW(),
    total_work_minutes INTEGER DEFAULT 0,
    total_away_minutes INTEGER DEFAULT 0,
    is_late BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_agent_attendance_daily UNIQUE (org_id, user_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_agent_attendance_org_date ON public.agent_attendance_logs(org_id, work_date);
CREATE INDEX IF NOT EXISTS idx_agent_attendance_user ON public.agent_attendance_logs(user_id);

-- RLS 활성화
ALTER TABLE public.agent_attendance_logs ENABLE ROW LEVEL SECURITY;

-- 테넌트 격리 RLS: 같은 회사의 구성원만 조회/수정 가능
DROP POLICY IF EXISTS attendance_select_policy ON public.agent_attendance_logs;
CREATE POLICY attendance_select_policy ON public.agent_attendance_logs
    FOR SELECT
    USING (org_id = current_org_id());

DROP POLICY IF EXISTS attendance_insert_policy ON public.agent_attendance_logs;
CREATE POLICY attendance_insert_policy ON public.agent_attendance_logs
    FOR INSERT
    WITH CHECK (org_id = current_org_id());

DROP POLICY IF EXISTS attendance_update_policy ON public.agent_attendance_logs;
CREATE POLICY attendance_update_policy ON public.agent_attendance_logs
    FOR UPDATE
    USING (org_id = current_org_id());

-- ---------------------------------------------
-- 2. 상담원별 맞춤 급여 및 인센티브 프로필 테이블
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_payroll_profiles (
    user_id UUID NOT NULL,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    salary_type TEXT NOT NULL DEFAULT 'pure_incentive' CHECK (salary_type IN ('pure_incentive', 'base_plus_incentive', 'tiered')),
    base_salary INTEGER DEFAULT 0,               -- 기본급 (원 단위)
    unit_incentive INTEGER DEFAULT 150000,       -- 건당 기본 인센티브 (원 단위)
    incentive_rate NUMERIC DEFAULT 0,            -- 수임료 비율 (%, 예: 10.0)
    tier_rules JSONB DEFAULT '[]'::jsonb,        -- 구간식 계단형 인센티브 ([{"min":1,"max":3,"fee":100000}, ...])
    daily_allowance INTEGER DEFAULT 0,           -- 출근 일비 / 식대 (원 단위, 예: 10000)
    bonus_allowance INTEGER DEFAULT 0,           -- 만근 보너스 / 특별 수당 (원 단위)
    tax_type TEXT DEFAULT 'freelancer_3_3' CHECK (tax_type IN ('freelancer_3_3', 'four_insurances', 'none')),
    bank_name TEXT,
    account_number TEXT,
    account_holder TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(org_id, user_id)
);

-- RLS 활성화
ALTER TABLE public.agent_payroll_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_profile_select_policy ON public.agent_payroll_profiles;
CREATE POLICY payroll_profile_select_policy ON public.agent_payroll_profiles
    FOR SELECT
    USING (org_id = current_org_id());

DROP POLICY IF EXISTS payroll_profile_all_admin_policy ON public.agent_payroll_profiles;
CREATE POLICY payroll_profile_all_admin_policy ON public.agent_payroll_profiles
    FOR ALL
    USING (org_id = current_org_id() AND is_org_admin());

-- ---------------------------------------------
-- 3. 출퇴근 및 상태 전환 RPC 함수
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.record_agent_attendance_status(
    p_status TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_user_id UUID;
    v_today DATE := CURRENT_DATE;
    v_now TIMESTAMPTZ := NOW();
    v_log public.agent_attendance_logs;
BEGIN
    v_org_id := current_org_id();
    v_user_id := auth.uid();

    IF v_org_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION '인증 정보 또는 테넌트 컨텍스트가 없습니다.';
    END IF;

    -- 오늘자 로그 조회
    SELECT * INTO v_log
    FROM public.agent_attendance_logs
    WHERE org_id = v_org_id AND user_id = v_user_id AND work_date = v_today;

    IF v_log.id IS NULL THEN
        -- 오늘 첫 출근 체크인
        INSERT INTO public.agent_attendance_logs (
            org_id, user_id, work_date, clock_in_at, current_status, status_updated_at, notes
        ) VALUES (
            v_org_id, v_user_id, v_today, v_now, p_status, v_now, p_notes
        )
        RETURNING * INTO v_log;
    ELSE
        -- 상태 업데이트
        IF p_status = 'off' THEN
            -- 퇴근 시 clock_out_at 기록 및 누적 분 계산
            UPDATE public.agent_attendance_logs
            SET clock_out_at = v_now,
                current_status = 'off',
                status_updated_at = v_now,
                total_work_minutes = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_now - clock_in_at)) / 60)::INTEGER),
                updated_at = v_now
            WHERE id = v_log.id
            RETURNING * INTO v_log;
        ELSE
            -- 상태 전환 (working, away, meal 등)
            UPDATE public.agent_attendance_logs
            SET current_status = p_status,
                status_updated_at = v_now,
                updated_at = v_now
            WHERE id = v_log.id
            RETURNING * INTO v_log;
        END IF;
    END IF;

    RETURN to_jsonb(v_log);
END;
$$;

-- ---------------------------------------------
-- 4. 오늘자 전 직원 근태 전광판 조회 RPC
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.get_today_attendance_board()
RETURNS TABLE (
    user_id UUID,
    display_name TEXT,
    email TEXT,
    role TEXT,
    work_date DATE,
    clock_in_at TIMESTAMPTZ,
    clock_out_at TIMESTAMPTZ,
    current_status TEXT,
    status_updated_at TIMESTAMPTZ,
    total_work_minutes INTEGER,
    is_late BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_today DATE := CURRENT_DATE;
BEGIN
    v_org_id := current_org_id();
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION '테넌트 컨텍스트가 없습니다.';
    END IF;

    RETURN QUERY
    SELECT 
        m.user_id,
        m.display_name,
        m.email,
        m.role::TEXT,
        COALESCE(a.work_date, v_today) AS work_date,
        a.clock_in_at,
        a.clock_out_at,
        COALESCE(a.current_status, 'off') AS current_status,
        a.status_updated_at,
        COALESCE(a.total_work_minutes, 0) AS total_work_minutes,
        COALESCE(a.is_late, FALSE) AS is_late
    FROM public.org_members m
    LEFT JOIN public.agent_attendance_logs a 
        ON a.org_id = m.org_id AND a.user_id = m.user_id AND a.work_date = v_today
    WHERE m.org_id = v_org_id AND m.status = 'active'
    ORDER BY 
        CASE WHEN a.current_status = 'working' THEN 1
             WHEN a.current_status = 'away' THEN 2
             WHEN a.current_status = 'meal' THEN 3
             ELSE 4 END,
        m.display_name ASC;
END;
$$;

COMMIT;
