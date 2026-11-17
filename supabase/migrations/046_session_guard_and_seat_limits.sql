-- ==============================================================================
-- 046_session_guard_and_seat_limits.sql
-- 1) 1계정당 플랫폼별(PC 웹 1대 + 안드로이드 폰 1대) 단일 활성 세션 보장 및 중복 로그인 킥아웃
-- 2) 조직 라이선스 좌석 수 (maxSeats) 하드 리밋 검증 및 초과 초대/등록 차단
-- ==============================================================================

-- 1. 활성 세션 테이블 (유저당 web 1개, android 1개 세션만 보장)
CREATE TABLE IF NOT EXISTS user_active_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('web', 'android')),
    session_id VARCHAR(100) NOT NULL,
    ip_address VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_platform UNIQUE (user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_email ON user_active_sessions(email);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_platform ON user_active_sessions(user_id, platform);

-- 2. 세션 등록 및 이전 세션 갱신 RPC
-- 새 세션이 등록되면 이전 session_id를 반환하여 클라이언트에서 킥아웃 브로드캐스트 지원
CREATE OR REPLACE FUNCTION register_user_session(
    p_platform VARCHAR(20),
    p_session_id VARCHAR(100),
    p_ip_address VARCHAR(64) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_email VARCHAR(255);
    v_prev_session_id VARCHAR(100);
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', '인증되지 않은 사용자입니다.');
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

    -- 기존 등록 세션 확인
    SELECT session_id INTO v_prev_session_id
    FROM user_active_sessions
    WHERE user_id = v_user_id AND platform = p_platform;

    -- 세션 등록 또는 갱신
    INSERT INTO user_active_sessions (user_id, email, platform, session_id, ip_address, user_agent, updated_at)
    VALUES (v_user_id, COALESCE(v_email, ''), p_platform, p_session_id, p_ip_address, p_user_agent, timezone('utc'::text, now()))
    ON CONFLICT (user_id, platform)
    DO UPDATE SET
        session_id = EXCLUDED.session_id,
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent,
        updated_at = EXCLUDED.updated_at;

    RETURN jsonb_build_object(
        'ok', true,
        'user_id', v_user_id,
        'platform', p_platform,
        'session_id', p_session_id,
        'prev_session_id', v_prev_session_id,
        'is_restarted', (v_prev_session_id IS NOT NULL AND v_prev_session_id <> p_session_id)
    );
END;
$$;

-- 3. 현재 세션 유효성 검사 RPC
CREATE OR REPLACE FUNCTION check_user_session_valid(
    p_platform VARCHAR(20),
    p_session_id VARCHAR(100)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_session_id VARCHAR(100);
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    SELECT session_id INTO v_current_session_id
    FROM user_active_sessions
    WHERE user_id = v_user_id AND platform = p_platform;

    IF v_current_session_id IS NULL THEN
        -- 등록 기록이 없으면 현재 세션을 신규로 인정
        RETURN true;
    END IF;

    RETURN (v_current_session_id = p_session_id);
END;
$$;

-- 4. 조직 좌석 수 (maxSeats) 현황 조회 및 잔여 여유 검증 RPC
CREATE OR REPLACE FUNCTION check_org_seat_availability(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_max_seats INTEGER := 20;
    v_active_members INTEGER := 0;
    v_pending_invites INTEGER := 0;
    v_total_occupied INTEGER := 0;
    v_remaining_seats INTEGER := 0;
    v_permissions JSONB;
BEGIN
    -- 1. 조직의 maxSeats 확인 (기본값 20)
    SELECT permissions INTO v_permissions FROM organizations WHERE id = p_org_id;
    IF v_permissions IS NOT NULL AND (v_permissions->>'maxSeats') IS NOT NULL THEN
        v_max_seats := (v_permissions->>'maxSeats')::INTEGER;
    END IF;

    -- 0이면 무제한
    IF v_max_seats <= 0 THEN
        RETURN jsonb_build_object(
            'ok', true,
            'max_seats', 999999,
            'active_members', 0,
            'pending_invites', 0,
            'total_occupied', 0,
            'remaining_seats', 999999,
            'is_limit_reached', false
        );
    END IF;

    -- 2. 현재 활성 멤버 수 집계
    SELECT count(*) INTO v_active_members
    FROM organization_members
    WHERE org_id = p_org_id;

    -- 3. 대기 중인 초대 수 집계 (만료되지 않은 유효 초대)
    SELECT count(*) INTO v_pending_invites
    FROM org_invites
    WHERE org_id = p_org_id 
      AND accepted_at IS NULL 
      AND (expires_at IS NULL OR expires_at > timezone('utc'::text, now()));

    v_total_occupied := v_active_members + v_pending_invites;
    v_remaining_seats := GREATEST(0, v_max_seats - v_total_occupied);

    RETURN jsonb_build_object(
        'ok', true,
        'max_seats', v_max_seats,
        'active_members', v_active_members,
        'pending_invites', v_pending_invites,
        'total_occupied', v_total_occupied,
        'remaining_seats', v_remaining_seats,
        'is_limit_reached', (v_total_occupied >= v_max_seats)
    );
END;
$$;
