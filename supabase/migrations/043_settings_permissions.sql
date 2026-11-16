-- =============================================
-- Migration: 043_settings_permissions
-- 작성: 2026-11-16 [AGY]
-- 목적: 시스템 설정(/settings) 4대 대분류 탭별 직급별 권한 통제 및 위임 스펙 추가
--   1) admin_permissions JSONB에 settings 권한 스펙 병합 업데이트
--   2) Owner, Tier 3(실장), Tier 2/1(팀장)별 기본 권한 프리셋 적용
-- =============================================

BEGIN;

-- 1. Owner: 시스템 설정 4대 탭 전체 풀 권한 보유 (수정, 삭제, 백업, 복원, 긴급 데이터 파기)
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "settings": {
    "allowAccess": true,
    "allowPartners": true,
    "allowOperations": true,
    "allowIntegrations": true,
    "allowDataSecurity": true
  }
}'::jsonb
WHERE role = 'owner';

-- 2. Admin Tier 3 (총괄 실장): 시스템 설정 4대 탭 운영 권한 (거래처, 공통업무, 연동/AI, 백업 다운로드. 파기/복원은 대표 전권)
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "settings": {
    "allowAccess": true,
    "allowPartners": true,
    "allowOperations": true,
    "allowIntegrations": true,
    "allowDataSecurity": true
  }
}'::jsonb
WHERE role = 'admin' AND admin_tier = 3;

-- 3. Admin Tier 2 (수석 팀장): 공통 업무 설정 열람 뷰어 권한 (거래처 수수료율 및 보안 백업 탭은 원천 차단)
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "settings": {
    "allowAccess": true,
    "allowPartners": false,
    "allowOperations": false,
    "allowIntegrations": false,
    "allowDataSecurity": false
  }
}'::jsonb
WHERE role = 'admin' AND admin_tier = 2;

-- 4. Admin Tier 1 (초급 팀장): 시스템 설정 메뉴 기본 비노출 (대표 위임 시 오픈)
UPDATE public.org_members
SET admin_permissions = admin_permissions || '{
  "settings": {
    "allowAccess": false,
    "allowPartners": false,
    "allowOperations": false,
    "allowIntegrations": false,
    "allowDataSecurity": false
  }
}'::jsonb
WHERE role = 'admin' AND (admin_tier = 1 OR admin_tier IS NULL);

COMMIT;
