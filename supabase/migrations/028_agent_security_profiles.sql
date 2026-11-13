-- =============================================
-- Migration: 028_agent_security_profiles
-- 작성: 2026-11-10 [AGY]
-- 선행: 004, 005, 007, 015, 027
-- 목적: 개인 채무 정보 보호를 위한 상담원별 차등 보안 프로필 및 세션 관리
--   1) org_members 테이블에 security_profile (JSONB) 및 session_revoked_at 컬럼 추가
--   2) list_org_members() RPC 갱신: security_profile, session_revoked_at 반환
--   3) update_org_member() RPC 갱신: p_security_profile 파라미터 지원
--   4) revoke_member_session() RPC 신설: 관리자에 의한 원클릭 세션 강제 파기
-- 여러 번 실행해도 된다.
-- [2026-11-13 KIRO 변경]
--   - 027_agent_ui_mode 의 list_org_members / update_org_member 를 이 파일이 최종 정의 (027 다음에 실행)
--   - update_org_member: 007(4칸)·027(5칸) 옛 함수까지 DROP → 6칸 하나만 남김 (웹 이름과 같음)
--   - list_org_members / update_org_member: EXECUTE anon 회수
--   - revoke_member_session: 같은 회사 멤버인지 확인
--   - 주의: 접근 기록 action 은 015 CHECK 목록에 맞춰 'export' + detail.event='session_revoked' 로 남긴다
-- =============================================

BEGIN;

-- 1. org_members에 보안 프로필 및 세션 파기 시각 컬럼 추가
ALTER TABLE public.org_members
ADD COLUMN IF NOT EXISTS security_profile JSONB NOT NULL DEFAULT '{"watermark":true,"appCaptureBlock":true,"masking":true,"anomalyAlert":true}'::jsonb;

ALTER TABLE public.org_members
ADD COLUMN IF NOT EXISTS session_revoked_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.org_members.security_profile IS '상담원별 차등 보안 설정 (화면 워터마크, 앱 캡처 차단, 목록 마스킹, 이상 열람 알림)';
COMMENT ON COLUMN public.org_members.session_revoked_at IS '세션 강제 파기 시각. 이 시각 이전 세션은 즉시 무효화';

-- 대표(owner)와 관리자(admin)는 기본적으로 모든 제한 해제 프로필 적용
UPDATE public.org_members
SET security_profile = '{"watermark":false,"appCaptureBlock":false,"masking":false,"anomalyAlert":false}'::jsonb
WHERE role IN ('owner', 'admin')
  AND (security_profile = '{"watermark":true,"appCaptureBlock":true,"masking":true,"anomalyAlert":true}'::jsonb OR security_profile IS NULL);

-- 2. list_org_members() RPC 갱신
DROP FUNCTION IF EXISTS public.list_org_members();

CREATE OR REPLACE FUNCTION public.list_org_members()
RETURNS TABLE(
  user_id uuid,
  email text,
  display_name text,
  role text,
  status text,
  joined_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  assigned_cases bigint,
  ui_mode text,
  security_profile jsonb,
  session_revoked_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT m.user_id,
         u.email::TEXT,
         COALESCE(NULLIF(m.display_name, ''), u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email::TEXT, '@', 1)),
         m.role,
         m.status,
         m.created_at,
         u.last_sign_in_at,
         (SELECT count(*) FROM public.cases c
          WHERE c.org_id = m.org_id AND c.assigned_user_id = m.user_id AND COALESCE(c.status, '') <> '휴지통'),
         COALESCE(m.ui_mode, 'standard'),
         COALESCE(m.security_profile, '{"watermark":true,"appCaptureBlock":true,"masking":true,"anomalyAlert":true}'::jsonb),
         m.session_revoked_at
  FROM public.org_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.org_id = public.current_org_id()
    AND (public.is_org_admin() OR m.user_id = auth.uid())
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, 3;
$$;

REVOKE ALL ON FUNCTION public.list_org_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_org_members() TO authenticated;

-- 3. update_org_member() RPC 갱신
--    웹(services/team.ts updateTeamMember)이 보내는 이름: p_user_id, p_role, p_status, p_display_name, p_ui_mode, p_security_profile
--    예전 겹치는 함수(007의 4칸, 027의 5칸)를 모두 지워 PostgREST가 헷갈리지 않게 한다
DROP FUNCTION IF EXISTS public.update_org_member(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.update_org_member(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.update_org_member(uuid, text, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.update_org_member(
  p_user_id uuid,
  p_role text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
  p_display_name text DEFAULT NULL::text,
  p_ui_mode text DEFAULT NULL::text,
  p_security_profile jsonb DEFAULT NULL::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org UUID := public.current_org_id();
  v_my_role TEXT := public.current_org_role();
  v_target_role TEXT;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION '소속 회사가 없습니다'; END IF;

  SELECT role INTO v_target_role FROM public.org_members WHERE org_id = v_org AND user_id = p_user_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION '같은 회사 멤버가 아닙니다'; END IF;

  -- 본인은 표시 이름만 바꿀 수 있다
  IF p_user_id = auth.uid() THEN
    IF p_role IS NOT NULL OR p_status IS NOT NULL OR p_ui_mode IS NOT NULL OR p_security_profile IS NOT NULL THEN
      RAISE EXCEPTION '본인의 역할·상태·보안설정은 바꿀 수 없습니다';
    END IF;
  ELSE
    IF v_my_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION '관리자만 변경할 수 있습니다'; END IF;
    -- 대표(owner) 관련 변경은 대표만
    IF (v_target_role = 'owner' OR p_role = 'owner') AND v_my_role <> 'owner' THEN
      RAISE EXCEPTION '대표 권한은 대표만 바꿀 수 있습니다';
    END IF;
  END IF;

  IF p_role IS NOT NULL AND p_role NOT IN ('owner', 'admin', 'agent') THEN RAISE EXCEPTION '잘못된 역할'; END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('active', 'disabled') THEN RAISE EXCEPTION '잘못된 상태'; END IF;
  IF p_ui_mode IS NOT NULL AND p_ui_mode NOT IN ('standard', 'lite_only') THEN RAISE EXCEPTION '잘못된 업무 모드'; END IF;

  UPDATE public.org_members
  SET role = COALESCE(p_role, role),
      status = COALESCE(p_status, status),
      display_name = CASE WHEN p_display_name IS NULL THEN display_name ELSE NULLIF(trim(p_display_name), '') END,
      ui_mode = COALESCE(p_ui_mode, ui_mode),
      security_profile = COALESCE(p_security_profile, security_profile)
  WHERE org_id = v_org AND user_id = p_user_id;

  -- 회사에 대표가 최소 1명은 남아야 한다
  IF NOT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = v_org AND role = 'owner' AND status = 'active') THEN
    RAISE EXCEPTION '활성 대표가 최소 1명 있어야 합니다';
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.update_org_member(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_org_member(uuid, text, text, text, text, jsonb) TO authenticated;

-- 4. 원클릭 세션 즉시 강제 파기 RPC
CREATE OR REPLACE FUNCTION public.revoke_member_session(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org UUID := public.current_org_id();
  v_my_role TEXT := public.current_org_role();
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION '소속 회사가 없습니다'; END IF;
  IF v_my_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION '관리자만 세션을 종료할 수 있습니다'; END IF;
  -- 같은 회사 멤버만 (다른 회사 사용자 ID를 넣으면 기록만 남고 성공처럼 보이던 문제)
  IF NOT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = v_org AND user_id = p_user_id) THEN
    RAISE EXCEPTION '같은 회사 멤버가 아닙니다';
  END IF;

  UPDATE public.org_members
  SET session_revoked_at = now()
  WHERE org_id = v_org AND user_id = p_user_id;

  -- 감사 로그 기록
  INSERT INTO public.access_logs (org_id, user_id, action, detail)
  VALUES (
    v_org,
    auth.uid(),
    'export', -- export/admin action
    jsonb_build_object('event', 'session_revoked', 'target_user_id', p_user_id)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_member_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_member_session(uuid) TO authenticated;

COMMIT;
