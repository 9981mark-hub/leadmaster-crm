-- =============================================
-- Migration: 003_lock_anon_tables
-- 작성: 2026-10-31
-- 목적: 로그인 없이(anon 키만으로) 읽고 쓸 수 있던 테이블 잠금
--
-- 2026-10-31 실제 DB 점검 결과 (anon 키, id 컬럼 1건만 조회):
--   pending_sms        → anon 조회 가능 (15건)  ← 전화번호·문자 내용 노출
--   auto_dial_batches  → anon 조회 가능 (1건)
--   auto_dial_items    → anon 조회 가능 (206건) ← 고객명·전화번호 노출
--   cases, settings, partners, telegram_feedbacks, communication_logs,
--   pending_calls, sms_templates, tax_invoices → anon 조회 0건 (이미 잠김 또는 비어 있음)
--
-- 이 파일은 위 3개 테이블만 바꾼다. 이미 잠긴 테이블은 건드리지 않는다.
--
-- 접근 허용 대상:
--   1) 웹 CRM 로그인 사용자 (settings.allowedEmails 화이트리스트, is_allowed_email())
--   2) 안드로이드 앱 서비스 계정 (android-app@leadmaster.com)
--      앱은 LeadMasterApi.ensureAuthenticated()로 이 계정 로그인 후 pending_sms를 읽고 갱신한다.
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 아래 [0] 확인 쿼리 먼저 실행해 현재 정책 확인 →
--            [1]~[3] 실행 → [4] 확인 쿼리로 결과 확인
-- 되돌리기: 맨 아래 [ROLLBACK] 블록 참고
-- =============================================

-- [0] 실행 전 확인: 현재 정책 목록 (결과를 캡처해 두면 되돌릴 때 참고 가능)
-- SELECT tablename, policyname, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('pending_sms', 'auto_dial_batches', 'auto_dial_items', 'communication_logs', 'pending_calls')
-- ORDER BY tablename, policyname;

BEGIN;

-- [1] cases.updated_at 자동 갱신 트리거 보장 (웹 증분 동기화가 updated_at 기준이라 필수)
--     001에 이미 있으면 같은 내용으로 다시 만들 뿐이라 영향 없음
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cases_updated_at ON cases;
CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- [2] 대상 3개 테이블의 기존 정책 모두 삭제 (USING (true) 등 anon 허용 정책 제거)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('pending_sms', 'auto_dial_batches', 'auto_dial_items')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE pending_sms ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_dial_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_dial_items ENABLE ROW LEVEL SECURITY;

-- [3] 로그인 사용자 중 화이트리스트 + 앱 서비스 계정만 허용
CREATE POLICY "lm_pending_sms_whitelisted" ON pending_sms
  FOR ALL TO authenticated
  USING (is_allowed_email() OR (auth.jwt() ->> 'email') = 'android-app@leadmaster.com')
  WITH CHECK (is_allowed_email() OR (auth.jwt() ->> 'email') = 'android-app@leadmaster.com');

CREATE POLICY "lm_auto_dial_batches_whitelisted" ON auto_dial_batches
  FOR ALL TO authenticated
  USING (is_allowed_email() OR (auth.jwt() ->> 'email') = 'android-app@leadmaster.com')
  WITH CHECK (is_allowed_email() OR (auth.jwt() ->> 'email') = 'android-app@leadmaster.com');

CREATE POLICY "lm_auto_dial_items_whitelisted" ON auto_dial_items
  FOR ALL TO authenticated
  USING (is_allowed_email() OR (auth.jwt() ->> 'email') = 'android-app@leadmaster.com')
  WITH CHECK (is_allowed_email() OR (auth.jwt() ->> 'email') = 'android-app@leadmaster.com');

COMMIT;

-- [4] 실행 후 확인
-- SELECT tablename, policyname, roles, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN ('pending_sms', 'auto_dial_batches', 'auto_dial_items');
-- 기대 결과: 테이블마다 lm_..._whitelisted 정책 1개, roles = {authenticated}

-- [ROLLBACK] 문제가 생기면 아래를 실행해 예전처럼 모두 허용으로 되돌린다 (보안상 임시로만 사용)
-- DROP POLICY IF EXISTS "lm_pending_sms_whitelisted" ON pending_sms;
-- DROP POLICY IF EXISTS "lm_auto_dial_batches_whitelisted" ON auto_dial_batches;
-- DROP POLICY IF EXISTS "lm_auto_dial_items_whitelisted" ON auto_dial_items;
-- CREATE POLICY "rollback_pending_sms_all" ON pending_sms FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "rollback_auto_dial_batches_all" ON auto_dial_batches FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "rollback_auto_dial_items_all" ON auto_dial_items FOR ALL USING (true) WITH CHECK (true);
