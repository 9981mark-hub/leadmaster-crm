-- ============================================
-- LEADMASTER CRM - Supabase RLS 화이트리스트 보안 설정
-- Supabase Dashboard → SQL Editor에서 실행
-- ============================================

-- 1. 화이트리스트 이메일 검증 함수 정의 (SECURITY DEFINER로 RLS 우회하여 settings 조회)
CREATE OR REPLACE FUNCTION public.is_allowed_email()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_emails JSONB;
  user_email TEXT;
BEGIN
  -- 사용자 JWT에서 이메일 추출
  user_email := auth.jwt() ->> 'email';
  
  -- 로그인이 안 되어있으면 거부
  IF user_email IS NULL THEN
    RETURN FALSE;
  END IF;

  -- settings 테이블에서 allowedEmails 목록 조회
  SELECT value INTO allowed_emails FROM public.settings WHERE key = 'allowedEmails';
  
  -- 만약 설정 행이 없거나 비어있는 경우, 하드코딩된 기본 관리자 매칭 (Lock-out 방지)
  IF allowed_emails IS NULL THEN
    RETURN user_email IN ('9981mark@gmail.com', '2882a@naver.com');
  END IF;
  
  -- JSONB 배열 내에 이메일이 존재하는지 확인
  RETURN (allowed_emails ? user_email);
END;
$$ LANGUAGE plpgsql;

-- 2. 기존 테이블 RLS 정책 삭제 (중복 방지)
DROP POLICY IF EXISTS "Authenticated users can read cases" ON cases;
DROP POLICY IF EXISTS "Authenticated users can insert cases" ON cases;
DROP POLICY IF EXISTS "Authenticated users can update cases" ON cases;
DROP POLICY IF EXISTS "Authenticated users can delete cases" ON cases;
DROP POLICY IF EXISTS "Whitelisted users can read cases" ON cases;
DROP POLICY IF EXISTS "Whitelisted users can insert cases" ON cases;
DROP POLICY IF EXISTS "Whitelisted users can update cases" ON cases;
DROP POLICY IF EXISTS "Whitelisted users can delete cases" ON cases;

DROP POLICY IF EXISTS "Authenticated users can read settings" ON settings;
DROP POLICY IF EXISTS "Authenticated users can upsert settings" ON settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON settings;
DROP POLICY IF EXISTS "Whitelisted users can read settings" ON settings;
DROP POLICY IF EXISTS "Whitelisted users can insert settings" ON settings;
DROP POLICY IF EXISTS "Whitelisted users can update settings" ON settings;

DROP POLICY IF EXISTS "Authenticated users can read partners" ON partners;
DROP POLICY IF EXISTS "Authenticated users can insert partners" ON partners;
DROP POLICY IF EXISTS "Authenticated users can update partners" ON partners;
DROP POLICY IF EXISTS "Authenticated users can delete partners" ON partners;
DROP POLICY IF EXISTS "Whitelisted users can read partners" ON partners;
DROP POLICY IF EXISTS "Whitelisted users can insert partners" ON partners;
DROP POLICY IF EXISTS "Whitelisted users can update partners" ON partners;
DROP POLICY IF EXISTS "Whitelisted users can delete partners" ON partners;

DROP POLICY IF EXISTS "Allow all for authenticated" ON telegram_feedbacks;
DROP POLICY IF EXISTS "Whitelisted users can access telegram_feedbacks" ON telegram_feedbacks;

DROP POLICY IF EXISTS "Authenticated users can read communication_logs" ON communication_logs;
DROP POLICY IF EXISTS "Authenticated users can delete communication_logs" ON communication_logs;
DROP POLICY IF EXISTS "Whitelisted users can read communication_logs" ON communication_logs;
DROP POLICY IF EXISTS "Whitelisted users can delete communication_logs" ON communication_logs;

DROP POLICY IF EXISTS "Authenticated users can do all on pending_sms" ON pending_sms;
DROP POLICY IF EXISTS "Whitelisted users can do all on pending_sms" ON pending_sms;

DROP POLICY IF EXISTS "Authenticated users can do all on sms_templates" ON sms_templates;
DROP POLICY IF EXISTS "Whitelisted users can do all on sms_templates" ON sms_templates;


-- 3. 보안이 강화된 새 정책 생성 (인증 + 화이트리스트 이메일 체크)

-- 3-1. cases
CREATE POLICY "Whitelisted users can read cases" ON cases
  FOR SELECT USING (auth.role() = 'authenticated' AND is_allowed_email());

CREATE POLICY "Whitelisted users can insert cases" ON cases
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());

CREATE POLICY "Whitelisted users can update cases" ON cases
  FOR UPDATE USING (auth.role() = 'authenticated' AND is_allowed_email())
  WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());

CREATE POLICY "Whitelisted users can delete cases" ON cases
  FOR DELETE USING (auth.role() = 'authenticated' AND is_allowed_email());

-- 3-2. settings
CREATE POLICY "Whitelisted users can read settings" ON settings
  FOR SELECT USING (auth.role() = 'authenticated' AND is_allowed_email());

CREATE POLICY "Whitelisted users can insert settings" ON settings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());

CREATE POLICY "Whitelisted users can update settings" ON settings
  FOR UPDATE USING (auth.role() = 'authenticated' AND is_allowed_email())
  WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());

-- 3-3. partners
CREATE POLICY "Whitelisted users can read partners" ON partners
  FOR SELECT USING (auth.role() = 'authenticated' AND is_allowed_email());

CREATE POLICY "Whitelisted users can insert partners" ON partners
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());

CREATE POLICY "Whitelisted users can update partners" ON partners
  FOR UPDATE USING (auth.role() = 'authenticated' AND is_allowed_email())
  WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());

CREATE POLICY "Whitelisted users can delete partners" ON partners
  FOR DELETE USING (auth.role() = 'authenticated' AND is_allowed_email());

-- 3-4. telegram_feedbacks
CREATE POLICY "Whitelisted users can access telegram_feedbacks" ON telegram_feedbacks
  FOR ALL USING (auth.role() = 'authenticated' AND is_allowed_email())
  WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());

-- 3-5. communication_logs (PC용 읽기/삭제 권한만 화이트리스트 검증, 안드로이드 앱의 INSERT는 anon 가능)
CREATE POLICY "Whitelisted users can read communication_logs" ON communication_logs
  FOR SELECT USING (auth.role() = 'authenticated' AND is_allowed_email());

CREATE POLICY "Whitelisted users can delete communication_logs" ON communication_logs
  FOR DELETE USING (auth.role() = 'authenticated' AND is_allowed_email());

-- 3-6. pending_sms (PC용 관리 권한만 화이트리스트 검증, 안드로이드 앱의 SELECT/UPDATE는 anon 가능)
CREATE POLICY "Whitelisted users can do all on pending_sms" ON pending_sms
  FOR ALL USING (auth.role() = 'authenticated' AND is_allowed_email())
  WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());

-- 3-7. sms_templates (PC용 관리 권한만 화이트리스트 검증)
CREATE POLICY "Whitelisted users can do all on sms_templates" ON sms_templates
  FOR ALL USING (auth.role() = 'authenticated' AND is_allowed_email())
  WITH CHECK (auth.role() = 'authenticated' AND is_allowed_email());

-- 4. RLS 활성화 상태 재확인
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_sms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
