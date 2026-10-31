-- =============================================
-- Migration: 012_platform_admin
-- 작성: 2026-11-01
-- 선행: 004 (organizations, org_members, org_invites, is_platform_admin, create_organization)
-- 목적: HOST(플랫폼 관리자) 전용 "회사 관리" 화면
--   - list_organizations(): 모든 회사 목록 + 멤버 수·리드 수·대표 초대 상태 (고객 개인정보는 돌려주지 않음)
--   - set_organization_status(): 회사 사용 중지/재개 (중지하면 그 회사 사람은 모든 데이터 0건)
-- 회사 생성은 기존 create_organization() 사용. 데이터를 바꾸지 않는다(함수만 추가). 되돌리기: 맨 아래
-- =============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.list_organizations()
RETURNS TABLE (
  id UUID, name TEXT, slug TEXT, status TEXT, created_at TIMESTAMPTZ,
  members BIGINT, active_members BIGINT, cases BIGINT,
  owner_invite_email TEXT, owner_invite_accepted BOOLEAN, has_telegram_bot BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION '플랫폼 관리자만 볼 수 있습니다';
  END IF;
  RETURN QUERY
  SELECT o.id, o.name, o.slug, o.status, o.created_at,
         (SELECT count(*) FROM public.org_members m WHERE m.org_id = o.id),
         (SELECT count(*) FROM public.org_members m WHERE m.org_id = o.id AND m.status = 'active'),
         (SELECT count(*) FROM public.cases c WHERE c.org_id = o.id AND c.deleted_at IS NULL),
         (SELECT i.email FROM public.org_invites i WHERE i.org_id = o.id AND i.role = 'owner' ORDER BY i.created_at LIMIT 1),
         (SELECT i.accepted_at IS NOT NULL FROM public.org_invites i WHERE i.org_id = o.id AND i.role = 'owner' ORDER BY i.created_at LIMIT 1),
         EXISTS (SELECT 1 FROM public.org_telegram_bots b WHERE b.org_id = o.id)
  FROM public.organizations o
  ORDER BY o.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_organization_status(p_org_id UUID, p_status TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION '플랫폼 관리자만 바꿀 수 있습니다'; END IF;
  IF p_status NOT IN ('active', 'suspended') THEN RAISE EXCEPTION '잘못된 상태'; END IF;
  IF p_org_id = '00000000-0000-0000-0000-000000000001'::uuid THEN RAISE EXCEPTION '본사는 중지할 수 없습니다'; END IF;
  UPDATE public.organizations SET status = p_status WHERE id = p_org_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.list_organizations() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_organization_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_organization_status(UUID, TEXT) TO authenticated;

COMMIT;

-- [ROLLBACK]
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.set_organization_status(UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.list_organizations();
-- COMMIT;
