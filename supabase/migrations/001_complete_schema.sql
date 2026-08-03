-- ============================================
-- LEADMASTER CRM - COMPLETE SUPABASE DDL SCHEMA
-- 새 프로젝트 복제용 전체 스키마
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. WHITELIST EMAIL CHECK FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.is_allowed_email()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_emails JSONB;
  user_email TEXT;
BEGIN
  user_email := auth.jwt() ->> 'email';
  IF user_email IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT value INTO allowed_emails FROM public.settings WHERE key = 'allowedEmails';
  
  IF allowed_emails IS NULL THEN
    RETURN user_email IN ('9981mark@gmail.com', '2882a@naver.com');
  END IF;

  RETURN (allowed_emails ? user_email);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. CASES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  status TEXT DEFAULT '신규접수',
  secondary_status TEXT,
  tertiary_status TEXT,
  is_viewed BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  
  customer_name TEXT,
  phone TEXT,
  birth TEXT,
  gender TEXT DEFAULT '남',
  region TEXT,
  
  manager_name TEXT,
  partner_id TEXT,
  
  case_type TEXT DEFAULT '개인회생',
  inbound_path TEXT,
  pre_info TEXT,
  history_type TEXT DEFAULT '없음',
  
  job_types JSONB DEFAULT '[]',
  income_net INTEGER DEFAULT 0,
  income_details JSONB DEFAULT '{}',
  insurance4 TEXT DEFAULT '미가입',
  
  housing_type TEXT DEFAULT '월세',
  housing_detail TEXT DEFAULT '기타',
  rent_contractor TEXT,
  deposit INTEGER DEFAULT 0,
  deposit_loan_amount INTEGER DEFAULT 0,
  rent INTEGER DEFAULT 0,
  
  own_house_price INTEGER DEFAULT 0,
  own_house_loan INTEGER DEFAULT 0,
  own_house_owner TEXT,
  
  credit_card_use TEXT,
  credit_card_amount INTEGER DEFAULT 0,
  loan_monthly_pay INTEGER DEFAULT 0,
  
  marital_status TEXT DEFAULT '미혼',
  children_count INTEGER DEFAULT 0,
  
  contract_at TEXT,
  contract_fee INTEGER DEFAULT 0,
  installment_months TEXT,
  use_capital BOOLEAN DEFAULT FALSE,
  
  assets JSONB DEFAULT '[]',
  credit_loan JSONB DEFAULT '[]',
  special_memo JSONB DEFAULT '[]',
  reminders JSONB DEFAULT '[]',
  recordings JSONB DEFAULT '[]',
  deposit_history JSONB DEFAULT '[]',
  status_logs JSONB DEFAULT '[]',
  
  missed_call_count INTEGER DEFAULT 0,
  last_missed_call_at TIMESTAMPTZ,
  
  ai_summary TEXT,
  formatted_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_cases_case_id ON cases(case_id);
CREATE INDEX IF NOT EXISTS idx_cases_phone ON cases(phone);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_customer_name ON cases(customer_name);
CREATE INDEX IF NOT EXISTS idx_cases_deleted_at ON cases(deleted_at);

DROP TRIGGER IF EXISTS cases_updated_at ON cases;
CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. PARTNERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  summary_template TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS partners_updated_at ON partners;
CREATE TRIGGER partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 6. TELEGRAM FEEDBACKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS telegram_feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id BIGINT UNIQUE NOT NULL,
  reply_to_message_id BIGINT,
  sender_name TEXT NOT NULL,
  customer_name TEXT,
  feedback_type TEXT NOT NULL,
  feedback_content TEXT NOT NULL,
  chat_id TEXT,
  chat_title TEXT,
  matched_case_id TEXT REFERENCES cases(case_id),
  is_applied BOOLEAN DEFAULT FALSE,
  is_confirmed BOOLEAN DEFAULT FALSE,
  apply_mode TEXT DEFAULT 'pending' CHECK (apply_mode IN ('auto', 'pending')),
  urgency TEXT DEFAULT 'info' CHECK (urgency IN ('critical', 'high', 'normal', 'info')),
  ai_classification JSONB,
  applied_at TIMESTAMPTZ,
  applied_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tg_feedback_case ON telegram_feedbacks(matched_case_id);
CREATE INDEX IF NOT EXISTS idx_tg_feedback_pending ON telegram_feedbacks(is_confirmed) WHERE is_confirmed = FALSE;
CREATE INDEX IF NOT EXISTS idx_tg_feedback_urgency ON telegram_feedbacks(urgency) WHERE is_confirmed = FALSE;

-- ============================================
-- 7. COMMUNICATION LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS communication_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id TEXT REFERENCES cases(case_id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT,
  duration INTEGER DEFAULT 0,
  line_info TEXT DEFAULT '기본',
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_comm_log UNIQUE (phone_number, timestamp, type)
);

CREATE INDEX IF NOT EXISTS idx_communication_logs_phone ON communication_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_communication_logs_case ON communication_logs(case_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_timestamp ON communication_logs(timestamp DESC);

-- ============================================
-- 8. PENDING SMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pending_sms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  content TEXT NOT NULL,
  template_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_sms_status ON pending_sms(status);

-- ============================================
-- 9. SMS TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sms_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO sms_templates (title, content, order_index) VALUES
('명함 및 인사', '안녕하세요. 상담을 도와드릴 담당자입니다. 궁금하신 점이 있으시면 언제든 편하게 연락 주시기 바랍니다.', 1),
('부재중 연락 요청', '전화를 드렸으나 연결이 되지 않아 문자 남깁니다. 확인 후 연락 주시면 상담 도와드리겠습니다.', 2),
('서류 안내', '상담을 위해 필요한 서류 목록을 안내해 드립니다. 준비 후 회신 부탁드립니다.', 3)
ON CONFLICT DO NOTHING;

-- ============================================
-- 10. PENDING CALLS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pending_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  case_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'dialed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  dialed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_calls_status ON pending_calls(status) WHERE status = 'pending';

-- ============================================
-- 11. TAX INVOICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tax_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  supply_amount INTEGER DEFAULT 0,
  vat_amount INTEGER DEFAULT 0,
  total_amount INTEGER DEFAULT 0,
  business_number TEXT,
  company_name TEXT,
  description TEXT,
  approval_number TEXT,
  is_electronic BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_sms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_invoices ENABLE ROW LEVEL SECURITY;

-- Cases policies
CREATE POLICY "Whitelisted users can read cases" ON cases FOR SELECT USING (auth.role() = 'authenticated' AND is_allowed_email());
CREATE POLICY "Whitelisted users can insert cases" ON cases FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());
CREATE POLICY "Whitelisted users can update cases" ON cases FOR UPDATE USING (auth.role() = 'authenticated' AND is_allowed_email()) WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());
CREATE POLICY "Whitelisted users can delete cases" ON cases FOR DELETE USING (auth.role() = 'authenticated' AND is_allowed_email());

-- Settings policies
CREATE POLICY "Whitelisted users can read settings" ON settings FOR SELECT USING (auth.role() = 'authenticated' AND is_allowed_email());
CREATE POLICY "Whitelisted users can insert settings" ON settings FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());
CREATE POLICY "Whitelisted users can update settings" ON settings FOR UPDATE USING (auth.role() = 'authenticated' AND is_allowed_email()) WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());

-- Partners policies
CREATE POLICY "Whitelisted users can read partners" ON partners FOR SELECT USING (auth.role() = 'authenticated' AND is_allowed_email());
CREATE POLICY "Whitelisted users can insert partners" ON partners FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());
CREATE POLICY "Whitelisted users can update partners" ON partners FOR UPDATE USING (auth.role() = 'authenticated' AND is_allowed_email()) WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());
CREATE POLICY "Whitelisted users can delete partners" ON partners FOR DELETE USING (auth.role() = 'authenticated' AND is_allowed_email());

-- Telegram feedbacks policies
CREATE POLICY "Whitelisted users can access telegram_feedbacks" ON telegram_feedbacks FOR ALL USING (auth.role() = 'authenticated' AND is_allowed_email()) WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());

-- Communication logs policies
CREATE POLICY "Whitelisted users can read communication_logs" ON communication_logs FOR SELECT USING (auth.role() = 'authenticated' AND is_allowed_email());
CREATE POLICY "Whitelisted users can delete communication_logs" ON communication_logs FOR DELETE USING (auth.role() = 'authenticated' AND is_allowed_email());
CREATE POLICY "Anon can insert communication_logs" ON communication_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can read communication_logs" ON communication_logs FOR SELECT USING (true);
CREATE POLICY "Anon can update communication_logs" ON communication_logs FOR UPDATE USING (true) WITH CHECK (true);

-- Pending SMS policies
CREATE POLICY "Whitelisted users can do all on pending_sms" ON pending_sms FOR ALL USING (auth.role() = 'authenticated' AND is_allowed_email()) WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());
CREATE POLICY "Anon can read pending_sms" ON pending_sms FOR SELECT USING (true);
CREATE POLICY "Anon can update pending_sms" ON pending_sms FOR UPDATE USING (true) WITH CHECK (true);

-- SMS Templates policies
CREATE POLICY "Allow all access to sms_templates" ON sms_templates FOR ALL USING (true) WITH CHECK (true);

-- Pending Calls policies
CREATE POLICY "Allow all for authenticated users" ON pending_calls FOR ALL USING (true) WITH CHECK (true);

-- Tax Invoices policies
CREATE POLICY "Whitelisted users can access tax_invoices" ON tax_invoices FOR ALL USING (auth.role() = 'authenticated' AND is_allowed_email()) WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());

-- ============================================
-- 13. REALTIME PUBLICATION
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE cases;
ALTER PUBLICATION supabase_realtime ADD TABLE partners;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
ALTER PUBLICATION supabase_realtime ADD TABLE communication_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE telegram_feedbacks;
ALTER PUBLICATION supabase_realtime ADD TABLE pending_calls;
