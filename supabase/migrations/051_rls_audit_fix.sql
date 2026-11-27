-- =============================================
-- Migration: 051_rls_audit_fix
-- 작성일자: 2026-11-27
-- 목적: RLS가 누락되었던 3개 테이블에 멀티테넌트/본인 전용 RLS 잠금 적용
--   1) public.platform_super_admins (037)
--   2) public.user_active_sessions (046)
--   3) public.organization_agreements (047)
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. platform_super_admins: 본인 이메일 또는 플랫폼 관리자만 SELECT 허용
-- ---------------------------------------------
ALTER TABLE public.platform_super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_super_admins_read ON public.platform_super_admins;
CREATE POLICY platform_super_admins_read ON public.platform_super_admins
  FOR SELECT TO authenticated
  USING (
    lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
    OR public.is_platform_admin()
  );

-- ---------------------------------------------
-- 2. user_active_sessions: 본인 세션 또는 자사 관리자만 SELECT 허용 (변경은 RPC 전용)
-- ---------------------------------------------
ALTER TABLE public.user_active_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_active_sessions_read ON public.user_active_sessions;
CREATE POLICY user_active_sessions_read ON public.user_active_sessions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      public.is_org_admin()
      AND EXISTS (
        SELECT 1 FROM public.org_members m
        WHERE m.user_id = user_active_sessions.user_id
          AND m.org_id = public.current_org_id()
      )
    )
    OR public.is_platform_admin()
  );

-- ---------------------------------------------
-- 3. organization_agreements: 자사 대표/관리자 또는 플랫폼 관리자만 SELECT 허용 (등록은 RPC 전용)
-- ---------------------------------------------
ALTER TABLE public.organization_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_agreements_read ON public.organization_agreements;
CREATE POLICY organization_agreements_read ON public.organization_agreements
  FOR SELECT TO authenticated
  USING (
    (org_id IS NOT NULL AND org_id = public.current_org_id() AND public.is_org_admin())
    OR lower(owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
    OR public.is_platform_admin()
  );

COMMIT;
