-- =============================================
-- Migration: 051_rls_audit_fix
-- 작성일자: 2026-11-27
-- 목적: RLS가 누락되었던 3개 테이블에 멀티테넌트/본인 전용 RLS 잠금 적용
--       (운영 DB에 테이블이 실제 존재할 때만 안전하게 적용)
-- =============================================

BEGIN;

DO $$
BEGIN
  -- 1. platform_super_admins
  IF to_regclass('public.platform_super_admins') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.platform_super_admins ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS platform_super_admins_read ON public.platform_super_admins';
    EXECUTE $p$
      CREATE POLICY platform_super_admins_read ON public.platform_super_admins
        FOR SELECT TO authenticated
        USING (
          lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
          OR public.is_platform_admin()
        )
    $p$;
  END IF;

  -- 2. user_active_sessions
  IF to_regclass('public.user_active_sessions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_active_sessions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS user_active_sessions_read ON public.user_active_sessions';
    EXECUTE $p$
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
        )
    $p$;
  END IF;

  -- 3. organization_agreements
  IF to_regclass('public.organization_agreements') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.organization_agreements ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS organization_agreements_read ON public.organization_agreements';
    EXECUTE $p$
      CREATE POLICY organization_agreements_read ON public.organization_agreements
        FOR SELECT TO authenticated
        USING (
          (org_id IS NOT NULL AND org_id = public.current_org_id() AND public.is_org_admin())
          OR lower(owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
          OR public.is_platform_admin()
        )
    $p$;
  END IF;
END $$;

COMMIT;
