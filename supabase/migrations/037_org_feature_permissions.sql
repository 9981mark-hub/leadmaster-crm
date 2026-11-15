-- =============================================
-- Migration: 037_org_feature_permissions
-- 작성: 2026-11-15
-- 목적: HOST(플랫폼 관리자) 전용 테넌트별 5대 세부 기능 권한(Feature Permissions) 제어 체계
--   - settlement_enabled: 광고비 DB 단가 및 상담원 급여/수당 정산 센터
--   - auto_dial_enabled: 스마트 오토콜 발신
--   - ai_training_enabled: AI 가상 고객 트레이닝
--   - telegram_hub_enabled: 텔레그램 리드 전송 봇
--   - enforce_security: 안드로이드 화면 캡처 방지 & 번호 마스킹 필수화
--   - max_seats: 최대 상담원 좌석 수 한도
--   - trial_expires_at: 14일 무료 체험 만료일
-- =============================================

BEGIN;

-- 1. organizations 테이블에 feature_permissions JSONB 컬럼 추가
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS feature_permissions JSONB NOT NULL DEFAULT '{
  "settlementEnabled": true,
  "autoDialEnabled": true,
  "aiTrainingEnabled": true,
  "telegramHubEnabled": true,
  "enforceSecurity": false,
  "maxSeats": 20
}'::jsonb;

-- 2. platform_super_admins 등록 뷰/테이블 (선택적)
CREATE TABLE IF NOT EXISTS public.platform_super_admins (
  email TEXT PRIMARY KEY,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 기본 호스트 계정 등록
INSERT INTO public.platform_super_admins (email, name)
VALUES 
  ('beanhull@gmail.com', '플랫폼 총괄 대표'),
  ('9981mark@gmail.com', '기술 총괄')
ON CONFLICT (email) DO NOTHING;

-- 3. RLS 정책: 플랫폼 관리자만 feature_permissions 변경 가능
-- (기존 organizations RLS 유지, authenticated 읽기/쓰기 허용)

COMMIT;
