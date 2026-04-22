-- ============================================
-- 통화 및 문자 연동 테이블 RLS 보안 설정
-- Supabase Dashboard → SQL Editor에서 실행
-- ============================================

-- 1. communication_logs 테이블 보안 설정
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;

-- PC(인증된 사용자)는 조회 및 삭제 가능
CREATE POLICY "Authenticated users can read communication_logs"
  ON communication_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete communication_logs"
  ON communication_logs FOR DELETE
  USING (auth.role() = 'authenticated');

-- 안드로이드 앱(익명)은 데이터 추가만 가능 (조회/수정/삭제 불가)
CREATE POLICY "Anon can insert communication_logs"
  ON communication_logs FOR INSERT
  WITH CHECK (true);


-- 2. pending_sms 테이블 보안 설정
ALTER TABLE pending_sms ENABLE ROW LEVEL SECURITY;

-- PC(인증된 사용자)는 발송 예약, 조회, 수정, 삭제 가능
CREATE POLICY "Authenticated users can do all on pending_sms"
  ON pending_sms FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 안드로이드 앱(익명)은 발송할 문자 조회 및 전송 상태 업데이트만 가능
CREATE POLICY "Anon can read pending_sms"
  ON pending_sms FOR SELECT
  USING (true);

CREATE POLICY "Anon can update pending_sms"
  ON pending_sms FOR UPDATE
  USING (true)
  WITH CHECK (true);


-- 3. sms_templates 테이블 보안 설정
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;

-- 템플릿 관리는 PC(인증된 사용자)만 가능 (안드로이드 앱은 접근 불가)
CREATE POLICY "Authenticated users can do all on sms_templates"
  ON sms_templates FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
