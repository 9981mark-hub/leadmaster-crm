-- ============================================
-- LEADMASTER CRM - RLS 보안 수정
-- Supabase Dashboard → SQL Editor에서 실행
-- ============================================

-- 1. 기존 위험한 정책 삭제
DROP POLICY IF EXISTS "Allow all for anon" ON cases;
DROP POLICY IF EXISTS "Allow all for anon" ON settings;
DROP POLICY IF EXISTS "Allow all for anon" ON partners;

-- 2. 인증된 사용자만 접근 가능 (cases)
CREATE POLICY "Authenticated users can read cases"
  ON cases FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert cases"
  ON cases FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update cases"
  ON cases FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete cases"
  ON cases FOR DELETE
  USING (auth.role() = 'authenticated');

-- 3. 인증된 사용자만 접근 가능 (settings)
CREATE POLICY "Authenticated users can read settings"
  ON settings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upsert settings"
  ON settings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update settings"
  ON settings FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 4. 인증된 사용자만 접근 가능 (partners)
CREATE POLICY "Authenticated users can read partners"
  ON partners FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert partners"
  ON partners FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update partners"
  ON partners FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete partners"
  ON partners FOR DELETE
  USING (auth.role() = 'authenticated');

-- 5. RLS가 활성화되어 있는지 확인
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 검증: 아래 쿼리로 정책 확인
-- ============================================
-- SELECT tablename, policyname, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public';
