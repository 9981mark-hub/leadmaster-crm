-- =============================================
-- Migration: 003b_close_any_login_access
-- 작성: 2026-11-01  (운영 DB 정책을 백업에서 직접 확인한 뒤 작성)
--
-- 발견한 문제 (D:\LeadMaster_Backup\20261101_0130_before_multitenant\policies_before.txt):
--   cases, settings, partners, pending_calls, telegram_feedbacks 에
--   "Authenticated users can do all on ..." = auth.role() = 'authenticated' 정책이 남아 있다.
--   RLS 정책은 OR로 합쳐지므로 화이트리스트 정책이 있어도 소용없고,
--   **아무 구글 계정이나 Supabase 로그인만 하면 리드 1,463건 전체를 읽고 고칠 수 있는 상태**다.
--   tax_invoices 는 "Allow all access" = true (로그인 안 해도 읽기·쓰기 가능, 현재 0건)
--   communication_logs 는 로그인 없이 INSERT 가능("Anon can insert")
--
-- 조치: 위 정책을 지우고, 화이트리스트(settings.allowedEmails) + 앱 서비스 계정만 허용
--   - 웹 사용자(화이트리스트)는 기존과 동일하게 동작
--   - 앱 서비스 계정(android-app@leadmaster.com)은 앱이 실제로 쓰는 테이블만 허용
--     (cases, pending_calls, pending_sms, telegram_feedbacks, communication_logs, auto_dial_*)
-- 멀티테넌트(004/005)를 적용하면 이 정책들은 다시 전부 교체된다. 그 전까지의 임시 잠금.
-- 되돌리기: 맨 아래 [ROLLBACK]
-- =============================================

BEGIN;

-- 1. "로그인만 하면 전부 허용" 정책 삭제
DROP POLICY IF EXISTS "Authenticated users can do all on cases"              ON public.cases;
DROP POLICY IF EXISTS "Authenticated users can do all on partners"           ON public.partners;
DROP POLICY IF EXISTS "Authenticated users can do all on pending_calls"      ON public.pending_calls;
DROP POLICY IF EXISTS "Authenticated users can do all on settings"           ON public.settings;
DROP POLICY IF EXISTS "Authenticated users can do all on telegram_feedbacks" ON public.telegram_feedbacks;
DROP POLICY IF EXISTS "Authenticated users can insert communication_logs"    ON public.communication_logs;
DROP POLICY IF EXISTS "Anon can insert communication_logs"                   ON public.communication_logs;
DROP POLICY IF EXISTS "Allow all access to tax_invoices"                     ON public.tax_invoices;

-- 2. 화이트리스트 사용자 + 앱 서비스 계정 (다시 실행해도 되도록 먼저 지운다)
DROP POLICY IF EXISTS "lm_cases_app"                   ON public.cases;
DROP POLICY IF EXISTS "lm_pending_calls_whitelisted"   ON public.pending_calls;
DROP POLICY IF EXISTS "lm_telegram_feedbacks_app_read" ON public.telegram_feedbacks;
DROP POLICY IF EXISTS "lm_communication_logs_insert"   ON public.communication_logs;
DROP POLICY IF EXISTS "lm_tax_invoices_whitelisted"    ON public.tax_invoices;

CREATE OR REPLACE FUNCTION public.lm_is_app_account()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$ SELECT COALESCE(auth.jwt() ->> 'email', '') = 'android-app@leadmaster.com' $$;

-- cases: 앱이 고객 조회·부재 기록·메모·리마인더 상태 갱신
CREATE POLICY "lm_cases_app" ON public.cases
  FOR ALL TO authenticated
  USING (public.lm_is_app_account()) WITH CHECK (public.lm_is_app_account());

-- pending_calls: 화이트리스트 정책이 원래 없었다 (로그인 전부 허용 정책만 있었음)
CREATE POLICY "lm_pending_calls_whitelisted" ON public.pending_calls
  FOR ALL TO authenticated
  USING (public.is_allowed_email() OR public.lm_is_app_account())
  WITH CHECK (public.is_allowed_email() OR public.lm_is_app_account());

-- telegram_feedbacks: 앱은 승인 대기 피드백 알림용으로 읽기만
CREATE POLICY "lm_telegram_feedbacks_app_read" ON public.telegram_feedbacks
  FOR SELECT TO authenticated
  USING (public.lm_is_app_account());

-- communication_logs: 화이트리스트 사용자·앱만 등록 (앱이 폰 통화·문자 기록 업로드)
CREATE POLICY "lm_communication_logs_insert" ON public.communication_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_allowed_email() OR public.lm_is_app_account());

-- tax_invoices: 화이트리스트 사용자만
CREATE POLICY "lm_tax_invoices_whitelisted" ON public.tax_invoices
  FOR ALL TO authenticated
  USING (public.is_allowed_email()) WITH CHECK (public.is_allowed_email());

COMMIT;

-- 실행 후 확인: 'Authenticated users can do all' / 'Allow all' / 'Anon can' 정책이 없어야 함
-- SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname='public' ORDER BY 1,2;

-- [ROLLBACK] 문제가 생기면 (예전 상태로, 보안상 임시로만)
-- BEGIN;
-- DROP POLICY IF EXISTS "lm_cases_app" ON public.cases;
-- DROP POLICY IF EXISTS "lm_pending_calls_whitelisted" ON public.pending_calls;
-- DROP POLICY IF EXISTS "lm_telegram_feedbacks_app_read" ON public.telegram_feedbacks;
-- DROP POLICY IF EXISTS "lm_communication_logs_insert" ON public.communication_logs;
-- DROP POLICY IF EXISTS "lm_tax_invoices_whitelisted" ON public.tax_invoices;
-- CREATE POLICY "Authenticated users can do all on cases" ON public.cases FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Authenticated users can do all on partners" ON public.partners FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Authenticated users can do all on pending_calls" ON public.pending_calls FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Authenticated users can do all on settings" ON public.settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Authenticated users can do all on telegram_feedbacks" ON public.telegram_feedbacks FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Authenticated users can insert communication_logs" ON public.communication_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Allow all access to tax_invoices" ON public.tax_invoices FOR ALL USING (true) WITH CHECK (true);
-- COMMIT;
