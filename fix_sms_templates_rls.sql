-- ============================================
-- SMS 템플릿 테이블 RLS 정책 수정
-- Supabase Dashboard → SQL Editor에서 실행
-- ============================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Authenticated users can do all on sms_templates" ON sms_templates;

-- 모든 사용자(anon 포함) 허용 정책 추가
CREATE POLICY "Allow all access to sms_templates"
  ON sms_templates FOR ALL
  USING (true)
  WITH CHECK (true);

-- 확인용 쿼리
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'sms_templates';
