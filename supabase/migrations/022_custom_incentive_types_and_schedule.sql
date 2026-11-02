-- =============================================
-- Migration: 022_custom_incentive_types_and_schedule
-- 작성: 2026-11-03
-- 선행: 021_agent_kpi_and_incentive
-- 목적:
--   1) 계약 종류별 인센티브(최대 10종류) 및 지급 주기/지급일 스케줄 설정 컬럼 추가
--   2) cases 테이블에 contract_type 및 incentive_type_id 컬럼 추가
-- =============================================

BEGIN;

-- 1. org_incentive_settings 테이블에 다원화 계약 종류 및 지급 스케줄 컬럼 추가
ALTER TABLE public.org_incentive_settings
  ADD COLUMN IF NOT EXISTS contract_types JSONB DEFAULT '[
    {"id":"type_rehab","name":"개인회생 계약","calc_type":"fixed","amount":50000,"rate":0,"is_default":true},
    {"id":"type_bankrupt","name":"개인파산 계약","calc_type":"fixed","amount":70000,"rate":0},
    {"id":"type_recovery","name":"신용회복/워크아웃","calc_type":"fixed","amount":30000,"rate":0},
    {"id":"type_lawsuit","name":"일반 민·형사 소송","calc_type":"percent","amount":0,"rate":5}
  ]'::jsonb,
  ADD COLUMN IF NOT EXISTS payout_schedule JSONB DEFAULT '{
    "cycle": "monthly",
    "monthlyStartDay": 1,
    "monthlyEndDay": 0,
    "monthlyPayoutOffset": 1,
    "monthlyPayoutDay": 10,
    "weeklyStartDay": 1,
    "weeklyEndDay": 7,
    "weeklyPayoutOffset": 1,
    "weeklyPayoutDay": 5
  }'::jsonb;

-- 2. cases 테이블에 계약 종류 및 인센티브 유형 ID 컬럼 추가
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS contract_type TEXT,
  ADD COLUMN IF NOT EXISTS incentive_type_id TEXT;

-- 인덱스 추가 (계약 종류별 빠른 집계)
CREATE INDEX IF NOT EXISTS idx_cases_contract_type ON public.cases(org_id, contract_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cases_incentive_type_id ON public.cases(org_id, incentive_type_id) WHERE deleted_at IS NULL;

COMMIT;
