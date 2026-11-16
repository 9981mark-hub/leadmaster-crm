-- =============================================
-- Migration: 041_notice_and_directive_scopes
-- 작성: 2026-11-16 [AGY]
-- 목적: 사내 공지사항 및 업무 지시사항 직급별 권한 통제 및 팀 단위 스코프 격리
--   1) notices 테이블에 target_team_name (TEXT DEFAULT NULL) 컬럼 추가
--   2) directives 테이블에 assigned_team_name (TEXT DEFAULT NULL) 컬럼 추가
--   3) admin_permissions JSONB에 notice 권한 스코프 병합 업데이트
-- =============================================

BEGIN;

-- 1. notices 테이블에 target_team_name 컬럼 추가 (null이면 전사 대상, '1팀', '2팀' 등)
ALTER TABLE public.notices
ADD COLUMN IF NOT EXISTS target_team_name TEXT DEFAULT NULL;

COMMENT ON COLUMN public.notices.target_team_name IS '공지 수신 대상 팀명 (NULL이면 전사 대상)';

-- 2. directives 테이블에 assigned_team_name 컬럼 추가
ALTER TABLE public.directives
ADD COLUMN IF NOT EXISTS assigned_team_name TEXT DEFAULT NULL;

COMMENT ON COLUMN public.directives.assigned_team_name IS '업무 지시 수신 상담원의 소속 팀명';

-- 3. 기존 admin_permissions에 notice 스코프 병합 업데이트
-- Owner: 전사 공지/지시 풀 권한
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "notice": {
    "allowAccess": true,
    "noticeScope": "all",
    "directiveScope": "all",
    "canCreateNotice": true,
    "canIssueDirective": true,
    "canDeleteNotice": true
  }
}'::jsonb
WHERE role = 'owner';

-- Admin Tier 3 (총괄 실장): 전사 공지/지시 작성 및 모니터링
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "notice": {
    "allowAccess": true,
    "noticeScope": "all",
    "directiveScope": "all",
    "canCreateNotice": true,
    "canIssueDirective": true,
    "canDeleteNotice": true
  }
}'::jsonb
WHERE role = 'admin' AND (admin_permissions->>'tier')::int = 3;

-- Admin Tier 2 (수석 팀장): 소속 팀 공지/지시 작성
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "notice": {
    "allowAccess": true,
    "noticeScope": "team",
    "directiveScope": "team",
    "canCreateNotice": true,
    "canIssueDirective": true,
    "canDeleteNotice": false
  }
}'::jsonb
WHERE role = 'admin' AND (admin_permissions->>'tier')::int = 2;

-- Admin Tier 1 (플로어 팀장 또는 기타): 소속 팀 공지/지시 기본
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "notice": {
    "allowAccess": true,
    "noticeScope": "team",
    "directiveScope": "team",
    "canCreateNotice": true,
    "canIssueDirective": true,
    "canDeleteNotice": false
  }
}'::jsonb
WHERE role = 'admin' AND (admin_permissions IS NULL OR (admin_permissions->>'tier')::int = 1 OR admin_permissions->'notice' IS NULL);

COMMIT;
