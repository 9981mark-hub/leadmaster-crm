-- =============================================
-- Migration: 039_admin_granular_permissions
-- 작성: 2026-11-16 [AGY]
-- 목적: 중간 관리자(admin/팀장) 신뢰도별 차등 권한 위임 체계 구축
--   1) org_members 테이블에 admin_permissions (JSONB) 컬럼 추가
--   2) list_org_members() RPC 갱신: admin_permissions 컬럼 반환
--   3) update_admin_permissions(p_user_id, p_admin_permissions) RPC 신설 (대표 owner 전용)
-- =============================================

BEGIN;

-- 1. org_members에 admin_permissions JSONB 컬럼 추가
ALTER TABLE public.org_members
ADD COLUMN IF NOT EXISTS admin_permissions JSONB NOT NULL DEFAULT '{
  "tier": 1,
  "team": {
    "canInviteMembers": false,
    "canDisableMembers": false,
    "canModifySecurity": false,
    "canModifyRules": false,
    "canViewPerformance": false
  },
  "settlement": {
    "allowReceivables": true,
    "allowAgentCommission": false,
    "allowPartnerSettlement": false,
    "allowDbCost": false,
    "allowIntegratedPnL": false
  }
}'::jsonb;

COMMENT ON COLUMN public.org_members.admin_permissions IS '중간 관리자(admin)별 차등 권한 (티어 1~3 및 정산/팀관리 세부 On/Off)';

-- 대표(owner)는 모든 권한 허용 기본값 세팅
UPDATE public.org_members
SET admin_permissions = '{
  "tier": 3,
  "team": {
    "canInviteMembers": true,
    "canDisableMembers": true,
    "canModifySecurity": true,
    "canModifyRules": true,
    "canViewPerformance": true
  },
  "settlement": {
    "allowReceivables": true,
    "allowAgentCommission": true,
    "allowPartnerSettlement": true,
    "allowDbCost": true,
    "allowIntegratedPnL": true
  }
}'::jsonb
WHERE role = 'owner';

-- 2. list_org_members() RPC 갱신 (admin_permissions 포함)
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
  session_revoked_at timestamp with time zone,
  admin_permissions jsonb
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
         m.session_revoked_at,
         COALESCE(m.admin_permissions, '{
           "tier": 1,
           "team": {
             "canInviteMembers": false,
             "canDisableMembers": false,
             "canModifySecurity": false,
             "canModifyRules": false,
             "canViewPerformance": false
           },
           "settlement": {
             "allowReceivables": true,
             "allowAgentCommission": false,
             "allowPartnerSettlement": false,
             "allowDbCost": false,
             "allowIntegratedPnL": false
           }
         }'::jsonb)
  FROM public.org_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.org_id = public.current_org_id()
    AND (public.is_org_admin() OR m.user_id = auth.uid())
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, 3;
$$;

REVOKE ALL ON FUNCTION public.list_org_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_org_members() TO authenticated;

-- 3. update_admin_permissions RPC 신설 (대표 owner 전용)
CREATE OR REPLACE FUNCTION public.update_admin_permissions(
  p_user_id uuid,
  p_admin_permissions jsonb
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

  -- 오직 대표(owner)만 관리자의 권한을 변경할 수 있다
  IF v_my_role <> 'owner' THEN
    RAISE EXCEPTION '관리자 권한 설정은 대표이사(Owner)만 변경할 수 있습니다';
  END IF;

  SELECT role INTO v_target_role FROM public.org_members WHERE org_id = v_org AND user_id = p_user_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION '같은 회사 멤버가 아닙니다'; END IF;

  -- 대표 본인의 권한은 고정 (변경 불가)
  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION '대표이사의 권한은 변경할 수 없습니다';
  END IF;

  UPDATE public.org_members
  SET admin_permissions = p_admin_permissions
  WHERE org_id = v_org AND user_id = p_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.update_admin_permissions(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_admin_permissions(uuid, jsonb) TO authenticated;

COMMIT;
