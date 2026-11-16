-- =============================================
-- 마이그레이션: 038_fix_accept_my_invites_auth_users_email.sql
-- 작성: 2026-11-16
-- 선행: 004, 007
-- 목적: 
--   1) accept_my_invites() 호출 시 auth.jwt() ->> 'email' 누락 환경 대비
--      auth.users 테이블에서 직접 email을 fallback 조회하여 매칭 보장
--   2) 이메일 비교 시 trim() 적용으로 공백 오차 원천 차단
--   3) 이미 org_members에 존재하는 경우라도 org_invites.accepted_at 누락 시 즉시 동기화 완료 처리
-- =============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.accept_my_invites()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_name TEXT;
  v_count INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  -- 1. JWT 클레임 또는 auth.users 테이블에서 사용자 이메일 및 이름 안전 추출
  v_email := lower(trim(COALESCE(
    auth.jwt() ->> 'email',
    (SELECT email FROM auth.users WHERE id = v_uid)
  )));

  v_name := NULLIF(COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    (SELECT COALESCE(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name') FROM auth.users WHERE id = v_uid)
  ), '');

  IF v_email IS NULL OR v_email = '' THEN
    RETURN 0;
  END IF;

  -- 2. 초대받은 회사 멤버십 등록 (중복 방지)
  INSERT INTO public.org_members (org_id, user_id, role, display_name)
  SELECT i.org_id, v_uid, i.role, COALESCE(NULLIF(trim(i.display_name), ''), v_name)
  FROM public.org_invites i
  WHERE lower(trim(i.email)) = v_email
    AND i.accepted_at IS NULL
    AND i.expires_at > now()
  ON CONFLICT (org_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- 3. 초대 수락 일시 기록
  UPDATE public.org_invites
  SET accepted_at = now()
  WHERE lower(trim(email)) = v_email
    AND accepted_at IS NULL
    AND expires_at > now();

  -- 4. 이미 org_members에 소속되어 있으나 초대의 accepted_at만 NULL인 경우도 정리
  UPDATE public.org_invites i
  SET accepted_at = now()
  WHERE lower(trim(i.email)) = v_email
    AND i.accepted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = i.org_id AND m.user_id = v_uid
    );

  -- 5. 활성 회사 프로필 갱신
  INSERT INTO public.user_profiles AS up (user_id, active_org_id)
  VALUES (v_uid, public.current_org_id())
  ON CONFLICT (user_id) DO UPDATE
    SET active_org_id = COALESCE(up.active_org_id, EXCLUDED.active_org_id),
        updated_at = now();

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_my_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_my_invites() TO authenticated;

COMMIT;
