-- =============================================
-- Migration: 042_training_permissions_and_teams
-- 작성: 2026-11-16 [AGY]
-- 목적: AI 트레이닝 & 코칭 센터 직급별 권한 통제 및 팀 단위 스코프 격리
--   1) admin_permissions JSONB에 training 권한 스펙 병합 업데이트
--   2) Owner, Tier 3(실장), Tier 2/1(팀장)별 기본 권한 프리셋 적용
-- =============================================

BEGIN;

-- 1. Owner: 전사 훈련 관제 + 전사 코칭/평가 + 훈련 정책 및 첫인사 스크립트 설정 전권
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "training": {
    "allowAccess": true,
    "viewScope": "all",
    "canManageConfig": true,
    "canGrade": true
  }
}'::jsonb
WHERE role = 'owner';

-- 2. Admin Tier 3 (총괄 실장): 전사 모든 팀 모니터링 + 전사 상담원 코칭/평가 + 대표 위임 시 정책 수정 가능
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "training": {
    "allowAccess": true,
    "viewScope": "all",
    "canManageConfig": true,
    "canGrade": true
  }
}'::jsonb
WHERE role = 'admin' AND admin_tier = 3;

-- 3. Admin Tier 2 (수석 팀장): 소속 팀원 코칭 허브 열람 + 소속 팀원 평가/피드백 작성 (정책 수정은 기본 비활성화)
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "training": {
    "allowAccess": true,
    "viewScope": "team",
    "canManageConfig": false,
    "canGrade": true
  }
}'::jsonb
WHERE role = 'admin' AND admin_tier = 2;

-- 4. Admin Tier 1 (초급 팀장): 소속 팀원 코칭 허브 열람 + 소속 팀원 평가/피드백 작성 (정책 수정은 기본 비활성화)
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "training": {
    "allowAccess": true,
    "viewScope": "team",
    "canManageConfig": false,
    "canGrade": true
  }
}'::jsonb
WHERE role = 'admin' AND (admin_tier = 1 OR admin_tier IS NULL);

COMMIT;
