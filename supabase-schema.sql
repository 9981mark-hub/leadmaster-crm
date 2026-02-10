-- ============================================
-- LEADMASTER CRM - SUPABASE SCHEMA
-- ============================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ============================================
-- 1. CASES TABLE (메인 케이스 정보)
-- ============================================
CREATE TABLE IF NOT EXISTS cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 상태 정보
  status TEXT DEFAULT '신규접수',
  secondary_status TEXT,
  is_viewed BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  
  -- 고객 정보
  customer_name TEXT,
  phone TEXT,
  birth TEXT,
  gender TEXT DEFAULT '남',
  region TEXT,
  
  -- 담당자/거래처
  manager_name TEXT,
  partner_id TEXT,
  
  -- 케이스 정보
  case_type TEXT DEFAULT '개인회생',
  inbound_path TEXT,
  pre_info TEXT,
  history_type TEXT DEFAULT '없음',
  
  -- 직업/소득
  job_types JSONB DEFAULT '[]',
  income_net INTEGER DEFAULT 0,
  income_details JSONB DEFAULT '{}',
  insurance4 TEXT DEFAULT '미가입',
  
  -- 주거 정보
  housing_type TEXT DEFAULT '월세',
  housing_detail TEXT DEFAULT '기타',
  rent_contractor TEXT,
  deposit INTEGER DEFAULT 0,
  deposit_loan_amount INTEGER DEFAULT 0,
  rent INTEGER DEFAULT 0,
  
  -- 자가 주택
  own_house_price INTEGER DEFAULT 0,
  own_house_loan INTEGER DEFAULT 0,
  own_house_owner TEXT,
  
  -- 신용카드/대출
  credit_card_use TEXT,
  credit_card_amount INTEGER DEFAULT 0,
  loan_monthly_pay INTEGER DEFAULT 0,
  
  -- 결혼/가족
  marital_status TEXT DEFAULT '미혼',
  children_count INTEGER DEFAULT 0,
  
  -- 계약 정보
  contract_at TEXT,
  contract_fee INTEGER DEFAULT 0,
  installment_months TEXT,
  use_capital BOOLEAN DEFAULT FALSE,
  
  -- JSON 필드 (배열 데이터)
  assets JSONB DEFAULT '[]',
  credit_loan JSONB DEFAULT '[]',
  special_memo JSONB DEFAULT '[]',
  reminders JSONB DEFAULT '[]',
  recordings JSONB DEFAULT '[]',
  deposit_history JSONB DEFAULT '[]',
  status_logs JSONB DEFAULT '[]',
  
  -- 부재 관리
  missed_call_count INTEGER DEFAULT 0,
  last_missed_call_at TIMESTAMPTZ,
  
  -- AI/요약
  ai_summary TEXT,
  formatted_summary TEXT
);

-- 인덱스 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_cases_case_id ON cases(case_id);
CREATE INDEX IF NOT EXISTS idx_cases_phone ON cases(phone);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_customer_name ON cases(customer_name);
CREATE INDEX IF NOT EXISTS idx_cases_deleted_at ON cases(deleted_at);

-- ============================================
-- 2. SETTINGS TABLE (앱 설정)
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. PARTNERS TABLE (거래처)
-- ============================================
CREATE TABLE IF NOT EXISTS partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  summary_template TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================
-- 모든 테이블에 RLS 활성화
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자만 접근 허용 (Google OAuth 로그인 필수)
CREATE POLICY "Authenticated users can read cases" ON cases FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert cases" ON cases FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update cases" ON cases FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete cases" ON cases FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read settings" ON settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can upsert settings" ON settings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update settings" ON settings FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read partners" ON partners FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert partners" ON partners FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update partners" ON partners FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete partners" ON partners FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- 5. REALTIME 활성화
-- ============================================
-- Supabase Dashboard에서 직접 활성화 필요:
-- Database → Replication → cases 테이블 체크

-- ============================================
-- 6. UPDATED_AT 자동 갱신 트리거
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
