-- =============================================
-- Migration: 007_team_management
-- 작성: 2026-11-01
-- 선행: 004, 005
-- 목적: 관리자용 "팀 관리" 화면 (멤버 목록·역할 변경·사용 중지, 리드 일괄 배정)
--   1) list_org_members(): 같은 회사 멤버의 이메일·이름·역할·담당 리드 수 (auth.users는 클라이언트가 직접 못 읽음)
--   2) update_org_member(): 역할·상태·표시 이름 변경 (대표 보호 규칙 포함)
--      → 관리자가 org_members를 직접 UPDATE하던 정책은 제거 (대표 강등·자기 권한 상승 방지)
--   3) assign_cases(): 리드 여러 건을 한 번에 상담원에게 배정/해제 (같은 회사·사용 중인 멤버만)
--   4) accept_my_invites(): 표시 이름이 없으면 구글 이름으로 채움
-- 데이터를 지우지 않는다. 되돌리기: 맨 아래 [ROLLBACK]
-- =============================================

BEGIN;

-- 1. 멤버 목록
CREATE OR REPLACE FUNCTION public.list_org_members()
RETURNS TABLE (
  user_id UUID, email TEXT, display_name TEXT, role TEXT, status TEXT,
  joined_at TIMESTAMPTZ, last_sign_in_at TIMESTAMPTZ, assigned_cases BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id,
         u.email::TEXT,
         COALESCE(NULLIF(m.display_name, ''), u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email::TEXT, '@', 1)),
         m.role,
         m.status,
         m.created_at,
         u.last_sign_in_at,
         (SELECT count(*) FROM public.cases c
          WHERE c.org_id = m.org_id AND c.assigned_user_id = m.user_id AND COALESCE(c.status, '') <> '휴지통')
  FROM public.org_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.org_id = public.current_org_id()
    AND (public.is_org_admin() OR m.user_id = auth.uid())   -- 상담원은 본인 정보만
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, 3
$$;

-- 2. 멤버 변경 (역할·상태·표시 이름)
CREATE OR REPLACE FUNCTION public.update_org_member(
  p_user_id UUID,
  p_role TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_display_name TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
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
    IF p_role IS NOT NULL OR p_status IS NOT NULL THEN
      RAISE EXCEPTION '본인의 역할·상태는 바꿀 수 없습니다';
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

  UPDATE public.org_members
  SET role = COALESCE(p_role, role),
      status = COALESCE(p_status, status),
      display_name = CASE WHEN p_display_name IS NULL THEN display_name ELSE NULLIF(trim(p_display_name), '') END
  WHERE org_id = v_org AND user_id = p_user_id;

  -- 회사에 대표가 최소 1명은 남아야 한다
  IF NOT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = v_org AND role = 'owner' AND status = 'active') THEN
    RAISE EXCEPTION '활성 대표가 최소 1명 있어야 합니다';
  END IF;
  RETURN true;
END;
$$;

DROP POLICY IF EXISTS lm_org_members_admin_update ON public.org_members;

-- 3. 리드 일괄 배정 (p_user_id = NULL 이면 배정 해제)
CREATE OR REPLACE FUNCTION public.assign_cases(p_case_ids TEXT[], p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := public.current_org_id();
  v_count INTEGER;
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN RAISE EXCEPTION '관리자만 배정할 수 있습니다'; END IF;
  IF p_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.org_members WHERE org_id = v_org AND user_id = p_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION '같은 회사의 사용 중인 멤버에게만 배정할 수 있습니다';
  END IF;

  UPDATE public.cases
  SET assigned_user_id = p_user_id
  WHERE org_id = v_org
    AND case_id = ANY (p_case_ids)
    AND assigned_user_id IS DISTINCT FROM p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 4. 초대 수락 시 표시 이름 = 초대에 적은 이름 → 없으면 구글 이름
CREATE OR REPLACE FUNCTION public.accept_my_invites()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_name TEXT := NULLIF(COALESCE(auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() -> 'user_metadata' ->> 'name'), '');
  v_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR v_email IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.org_members (org_id, user_id, role, display_name)
  SELECT i.org_id, auth.uid(), i.role, COALESCE(NULLIF(i.display_name, ''), v_name)
  FROM public.org_invites i
  WHERE lower(i.email) = v_email
    AND i.accepted_at IS NULL
    AND i.expires_at > now()
  ON CONFLICT (org_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.org_invites
  SET accepted_at = now()
  WHERE lower(email) = v_email
    AND accepted_at IS NULL
    AND expires_at > now();

  INSERT INTO public.user_profiles AS up (user_id, active_org_id)
  VALUES (auth.uid(), public.current_org_id())
  ON CONFLICT (user_id) DO UPDATE
    SET active_org_id = COALESCE(up.active_org_id, EXCLUDED.active_org_id),
        updated_at = now();

  RETURN v_count;
END;
$$;

-- 5. 기존 멤버 중 표시 이름이 비어 있으면 구글 이름으로 채움 (본사 3명)
UPDATE public.org_members m
SET display_name = COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')
FROM auth.users u
WHERE u.id = m.user_id
  AND (m.display_name IS NULL OR m.display_name = '')
  AND COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name') IS NOT NULL;

-- 6. 권한
REVOKE ALL ON FUNCTION public.list_org_members() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_org_member(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_cases(TEXT[], UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_my_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_org_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_org_member(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_cases(TEXT[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_my_invites() TO authenticated;

COMMIT;

-- [ROLLBACK]
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.list_org_members();
-- DROP FUNCTION IF EXISTS public.update_org_member(UUID, TEXT, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS public.assign_cases(TEXT[], UUID);
-- CREATE POLICY lm_org_members_admin_update ON public.org_members FOR UPDATE TO authenticated
--   USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
--   WITH CHECK (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));
-- COMMIT;
-- (accept_my_invites는 004 버전으로 되돌릴 필요 없음: 동작 동일 + 이름만 채움)
