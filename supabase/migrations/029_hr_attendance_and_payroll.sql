-- =============================================
-- Migration: 029_hr_attendance_and_payroll
-- 작성: 2026-11-10 / 보안·재실행 점검 2026-11-13 [KIRO]
-- 선행: 004, 005
-- 목적: TM 상담원 근태(출퇴근·이석)·급여/인센티브 프로필
-- 여러 번 실행해도 된다.
-- [2026-11-13 KIRO 변경]
--   - "오늘" = 한국 날짜 (now() AT TIME ZONE 'Asia/Seoul')::date. CURRENT_DATE 는 DB 시간대(UTC)라 0~9시 출근이 전날로 들어갔음
--   - agent_attendance_logs: org_id 기본값 current_org_id(), user_id → auth.users
--       보기 = 관리자(회사 전체) / 상담원(본인만), 직접 쓰기 = 관리자만(정정용). 상담원 기록은 record_agent_attendance_status() 로만
--       (예전엔 같은 회사 누구나 남의 근태를 넣고 고칠 수 있었음)
--   - agent_payroll_profiles: 보기 = 관리자 / 본인만 (예전엔 상담원이 전원 급여·계좌번호를 볼 수 있었음), 쓰기 = 관리자만 + WITH CHECK
--   - record_agent_attendance_status: 상태 값 확인, 본인 기록만, 출근 전 '퇴근'은 기록 안 함, 퇴근 뒤 다시 출근하면 퇴근 시각 지움
--   - get_today_attendance_board: org_members 에 email 칸이 없어 호출할 때마다 오류 → auth.users 에서 읽음.
--       관리자 = 회사 전원, 상담원 = 본인 줄만 (웹 fetchMyTodayAttendance 는 본인 줄만 씀)
--   - 정책 TO authenticated, 표·함수 anon 권한 회수
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. 상담원 출퇴근 및 실시간 근태 로그 테이블
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Seoul')::date),
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
-- 이미 만들어진 표(예전 버전)에도 기본값 적용
ALTER TABLE public.agent_attendance_logs ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.agent_attendance_logs ALTER COLUMN work_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Seoul')::date);

CREATE INDEX IF NOT EXISTS idx_agent_attendance_org_date ON public.agent_attendance_logs(org_id, work_date);
CREATE INDEX IF NOT EXISTS idx_agent_attendance_user ON public.agent_attendance_logs(user_id);

ALTER TABLE public.agent_attendance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_select_policy ON public.agent_attendance_logs;
CREATE POLICY attendance_select_policy ON public.agent_attendance_logs
    FOR SELECT TO authenticated
    USING (
        org_id = (SELECT public.current_org_id())
        AND ((SELECT public.is_org_admin()) OR user_id = (SELECT auth.uid()))
    );

DROP POLICY IF EXISTS attendance_insert_policy ON public.agent_attendance_logs;
CREATE POLICY attendance_insert_policy ON public.agent_attendance_logs
    FOR INSERT TO authenticated
    WITH CHECK (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

DROP POLICY IF EXISTS attendance_update_policy ON public.agent_attendance_logs;
CREATE POLICY attendance_update_policy ON public.agent_attendance_logs
    FOR UPDATE TO authenticated
    USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
    WITH CHECK (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

DROP POLICY IF EXISTS attendance_delete_policy ON public.agent_attendance_logs;
CREATE POLICY attendance_delete_policy ON public.agent_attendance_logs
    FOR DELETE TO authenticated
    USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

REVOKE ALL ON public.agent_attendance_logs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_attendance_logs TO authenticated;

-- ---------------------------------------------
-- 2. 상담원별 맞춤 급여 및 인센티브 프로필 테이블
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_payroll_profiles (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
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
ALTER TABLE public.agent_payroll_profiles ALTER COLUMN org_id SET DEFAULT public.current_org_id();

ALTER TABLE public.agent_payroll_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_profile_select_policy ON public.agent_payroll_profiles;
CREATE POLICY payroll_profile_select_policy ON public.agent_payroll_profiles
    FOR SELECT TO authenticated
    USING (
        org_id = (SELECT public.current_org_id())
        AND ((SELECT public.is_org_admin()) OR user_id = (SELECT auth.uid()))
    );

DROP POLICY IF EXISTS payroll_profile_all_admin_policy ON public.agent_payroll_profiles;
CREATE POLICY payroll_profile_all_admin_policy ON public.agent_payroll_profiles
    FOR ALL TO authenticated
    USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
    WITH CHECK (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

REVOKE ALL ON public.agent_payroll_profiles FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_payroll_profiles TO authenticated;

-- ---------------------------------------------
-- 3. 출퇴근 및 상태 전환 RPC 함수 (부른 사람 본인 기록만)
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
    v_org_id UUID := public.current_org_id();
    v_user_id UUID := auth.uid();
    v_today DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
    v_now TIMESTAMPTZ := now();
    v_log public.agent_attendance_logs;
BEGIN
    IF v_org_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION '인증 정보 또는 테넌트 컨텍스트가 없습니다.';
    END IF;
    IF p_status IS NULL OR p_status NOT IN ('working', 'away', 'meal', 'off') THEN
        RAISE EXCEPTION '잘못된 근태 상태입니다';
    END IF;
    IF p_notes IS NOT NULL AND length(p_notes) > 1000 THEN
        RAISE EXCEPTION '메모가 너무 깁니다 (1000자 이하)';
    END IF;

    SELECT * INTO v_log
    FROM public.agent_attendance_logs
    WHERE org_id = v_org_id AND user_id = v_user_id AND work_date = v_today
    FOR UPDATE;

    IF v_log.id IS NULL THEN
        IF p_status = 'off' THEN
            -- 출근 기록 없이 퇴근: 남기지 않는다
            RETURN jsonb_build_object('current_status', 'off', 'work_date', v_today);
        END IF;
        INSERT INTO public.agent_attendance_logs (
            org_id, user_id, work_date, clock_in_at, current_status, status_updated_at, notes
        ) VALUES (
            v_org_id, v_user_id, v_today, v_now, p_status, v_now, p_notes
        )
        ON CONFLICT (org_id, user_id, work_date) DO UPDATE
          SET current_status = EXCLUDED.current_status,
              status_updated_at = EXCLUDED.status_updated_at,
              updated_at = v_now
        RETURNING * INTO v_log;
    ELSIF p_status = 'off' THEN
        UPDATE public.agent_attendance_logs
        SET clock_out_at = v_now,
            current_status = 'off',
            status_updated_at = v_now,
            total_work_minutes = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_now - COALESCE(clock_in_at, v_now))) / 60)::INTEGER),
            notes = COALESCE(p_notes, notes),
            updated_at = v_now
        WHERE id = v_log.id
        RETURNING * INTO v_log;
    ELSE
        UPDATE public.agent_attendance_logs
        SET current_status = p_status,
            clock_in_at = COALESCE(clock_in_at, v_now),
            clock_out_at = NULL,              -- 퇴근 뒤 다시 출근
            status_updated_at = v_now,
            notes = COALESCE(p_notes, notes),
            updated_at = v_now
        WHERE id = v_log.id
        RETURNING * INTO v_log;
    END IF;

    RETURN to_jsonb(v_log);
END;
$$;

-- ---------------------------------------------
-- 4. 오늘(한국 날짜) 근태 전광판 조회 RPC
--    관리자 = 회사 전원, 상담원 = 본인 줄만
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
#variable_conflict use_column
DECLARE
    v_org_id UUID := public.current_org_id();
    v_me UUID := auth.uid();
    v_admin BOOLEAN := public.is_org_admin();
    v_today DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
    IF v_org_id IS NULL OR v_me IS NULL THEN
        RAISE EXCEPTION '테넌트 컨텍스트가 없습니다.';
    END IF;

    RETURN QUERY
    SELECT
        m.user_id,
        COALESCE(NULLIF(m.display_name, ''), u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email::TEXT, '@', 1))::TEXT,
        u.email::TEXT,
        m.role::TEXT,
        COALESCE(a.work_date, v_today),
        a.clock_in_at,
        a.clock_out_at,
        COALESCE(a.current_status, 'off')::TEXT,
        a.status_updated_at,
        COALESCE(a.total_work_minutes, 0)::INTEGER,
        COALESCE(a.is_late, FALSE)
    FROM public.org_members m
    JOIN auth.users u ON u.id = m.user_id
    LEFT JOIN public.agent_attendance_logs a
        ON a.org_id = m.org_id AND a.user_id = m.user_id AND a.work_date = v_today
    WHERE m.org_id = v_org_id
      AND m.status = 'active'
      AND (v_admin OR m.user_id = v_me)
    ORDER BY
        CASE WHEN a.current_status = 'working' THEN 1
             WHEN a.current_status = 'away' THEN 2
             WHEN a.current_status = 'meal' THEN 3
             ELSE 4 END,
        2 ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.record_agent_attendance_status(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_agent_attendance_status(TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.get_today_attendance_board() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_today_attendance_board() TO authenticated;

COMMIT;
