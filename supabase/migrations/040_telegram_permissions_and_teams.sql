-- =============================================
-- Migration: 040_telegram_permissions_and_teams
-- 작성: 2026-11-16 [AGY]
-- 목적: 텔레그램 연동 관제 센터 권한 위임 및 팀별 성과 격리 체계 구축
--   1) org_members 테이블에 team_name (TEXT DEFAULT '1팀') 컬럼 추가
--   2) admin_permissions JSONB에 telegram 권한 스코프 추가
--   3) list_org_members() RPC 갱신: team_name 반환
--   4) update_member_team(p_user_id, p_team_name) RPC 신설
-- =============================================

BEGIN;

-- 1. org_members에 team_name 컬럼 추가
ALTER TABLE public.org_members
ADD COLUMN IF NOT EXISTS team_name TEXT NOT NULL DEFAULT '1팀';

COMMENT ON COLUMN public.org_members.team_name IS '조직원의 소속 팀명 (예: 1팀, 2팀, 3팀 등)';

-- 2. 기존 admin_permissions에 telegram 스코프 병합 업데이트
-- Owner: 전체 권한
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "telegram": {
    "allowAccess": true,
    "viewScope": "all",
    "canManageRules": true,
    "canBulkApprove": true,
    "canPurgeHistory": true
  }
}'::jsonb
WHERE role = 'owner';

-- Admin Tier 3: 전사 열람, 룰 설정, 일괄 승인
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "telegram": {
    "allowAccess": true,
    "viewScope": "all",
    "canManageRules": true,
    "canBulkApprove": true,
    "canPurgeHistory": false
  }
}'::jsonb
WHERE role = 'admin' AND (admin_permissions->>'tier')::int = 3;

-- Admin Tier 2: 팀 열람, 일괄 승인
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "telegram": {
    "allowAccess": true,
    "viewScope": "team",
    "canManageRules": false,
    "canBulkApprove": true,
    "canPurgeHistory": false
  }
}'::jsonb
WHERE role = 'admin' AND (admin_permissions->>'tier')::int = 2;

-- Admin Tier 1 (또는 기타): 팀 열람 기본
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "telegram": {
    "allowAccess": true,
    "viewScope": "team",
    "canManageRules": false,
    "canBulkApprove": false,
    "canPurgeHistory": false
  }
}'::jsonb
WHERE role = 'admin' AND (COALESCE(admin_permissions->>'tier', '1'))::int = 1;

-- 3. list_org_members() RPC 갱신 (team_name 컬럼 포함)
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
  admin_permissions jsonb,
  team_name text
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
           },
           "telegram": {
             "allowAccess": true,
             "viewScope": "team",
             "canManageRules": false,
             "canBulkApprove": false,
             "canPurgeHistory": false
           }
         }'::jsonb),
         COALESCE(m.team_name, '1팀')
  FROM public.org_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.org_id = public.current_org_id()
    AND (public.is_org_admin() OR m.user_id = auth.uid())
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, 3;
$$;

REVOKE ALL ON FUNCTION public.list_org_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_org_members() TO authenticated;

-- 4. update_member_team RPC 신설 (대표 owner 또는 관리자)
CREATE OR REPLACE FUNCTION public.update_member_team(
  p_user_id uuid,
  p_team_name text
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

  -- 관리자 또는 대표만 팀 변경 가능
  IF v_my_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION '팀 변경 권한이 없습니다';
  END IF;

  SELECT role INTO v_target_role FROM public.org_members WHERE org_id = v_org AND user_id = p_user_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION '같은 회사 멤버가 아닙니다'; END IF;

  UPDATE public.org_members
  SET team_name = TRIM(p_team_name)
  WHERE org_id = v_org AND user_id = p_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.update_member_team(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_member_team(uuid, text) TO authenticated;

COMMIT;
