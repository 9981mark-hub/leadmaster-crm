-- ============================================================
-- Migration: 033_settlement_policies_and_split.sql
-- Description: 차세대 통합 정산 & 경영 손익(v4.5)
--              회사별 수수료 분배 정책 및 이중 정산 주기(거래처 입금일 vs 상담원 지급일) 스키마
-- ============================================================

-- 1. 회사별 정산 정책 설정 테이블
CREATE TABLE IF NOT EXISTS org_settlement_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE,
  
  -- 수수료 분배 룰
  split_model VARCHAR(30) DEFAULT 'ratio_split', -- 'ratio_split', 'margin_deduction', 'fixed_agent_incentive'
  company_share_ratio NUMERIC(5, 2) DEFAULT 40.0, -- 회사 몫 (%)
  agent_share_ratio NUMERIC(5, 2) DEFAULT 60.0,   -- 상담원 몫 (%)
  company_fixed_margin INT DEFAULT 300000,        -- 회사 고정 마진 (원)
  agent_fixed_incentive INT DEFAULT 150000,       -- 상담원 고정 수당 (원)
  
  -- 상담원 수당 지급 일정
  agent_payout_cycle VARCHAR(30) DEFAULT 'monthly_fixed', -- 'monthly_fixed', 'weekly_fixed', 'after_partner_deposit'
  agent_payout_day INT DEFAULT 10,                 -- 매월 10일 (or 매주 금요일=5)
  payout_delay_days INT DEFAULT 3,                 -- 입금 확인 후 N일 이내
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. partners 테이블 정산 주기 컬럼 확장 (개별 거래처 오버라이드 지원)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'settlement_cycle') THEN
    ALTER TABLE partners ADD COLUMN settlement_cycle VARCHAR(30) DEFAULT 'weekly';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'settlement_day_of_week') THEN
    ALTER TABLE partners ADD COLUMN settlement_day_of_week INT DEFAULT 1; -- 1:월, 2:화, 3:수...
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'settlement_day_of_month') THEN
    ALTER TABLE partners ADD COLUMN settlement_day_of_month INT DEFAULT 31; -- 31:말일, 10:익월10일...
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'custom_commission_rate') THEN
    ALTER TABLE partners ADD COLUMN custom_commission_rate NUMERIC(5, 2) DEFAULT 20.0;
  END IF;
END $$;

-- 3. Row Level Security (RLS)
ALTER TABLE org_settlement_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "osp_org_isolation" ON org_settlement_policies;
CREATE POLICY "osp_org_isolation" ON org_settlement_policies
  FOR ALL USING (true);
