-- =============================================
-- rollback_004_005.sql  (긴급 되돌리기 전용, 평소 실행 금지)
-- 작성: 2026-11-01
-- 목적: 004_multitenant_core + 005_multitenant_rls 적용 "전" 상태로 구조·권한을 되돌린다.
--       데이터(리드·통화기록 등)는 지우지 않는다. 회사(org) 관련 컬럼·테이블·함수만 제거.
-- 되돌린 뒤 상태 = 2026-11-01 운영 DB (003 + 003b 적용 상태)의 정책과 동일
--   (정책 원본: D:\LeadMaster_Backup\20261101_0130_before_multitenant\policies_before.txt + 003b)
--
-- 안전장치: 본사 외 다른 회사 데이터가 하나라도 있으면 실행을 멈춘다.
--   (고객사 데이터가 생긴 뒤 되돌리면 본사 데이터와 섞이므로)
-- =============================================

BEGIN;

-- 0. 안전장치
DO $$
DECLARE
  hq CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  t TEXT;
  n BIGINT;
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION '되돌릴 것이 없음: organizations 테이블이 없다 (004가 적용되지 않은 상태)';
  END IF;
  FOREACH t IN ARRAY ARRAY[
    'cases', 'settings', 'partners', 'telegram_feedbacks', 'communication_logs',
    'pending_sms', 'sms_templates', 'pending_calls', 'tax_invoices',
    'auto_dial_batches', 'auto_dial_items'
  ]
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE org_id <> %L', t, hq) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION '중단: %에 본사 외 회사 데이터 %건이 있다. 고객사 데이터를 먼저 정리해야 되돌릴 수 있다.', t, n;
    END IF;
  END LOOP;
END $$;

-- 1. 004/005가 만든 정책 전부 삭제 (업무 테이블 + 조직 테이블)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'cases', 'settings', 'partners', 'telegram_feedbacks', 'communication_logs',
        'pending_sms', 'sms_templates', 'pending_calls', 'tax_invoices',
        'auto_dial_batches', 'auto_dial_items',
        'organizations', 'org_members', 'user_profiles', 'org_invites'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 2. 트리거
DROP TRIGGER IF EXISTS cases_default_assignee ON public.cases;

-- 3. 고유 제약을 예전대로
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE public.settings ADD CONSTRAINT settings_pkey PRIMARY KEY (key);

ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_org_partner_id_key;
ALTER TABLE public.partners ADD CONSTRAINT partners_partner_id_key UNIQUE (partner_id);

ALTER TABLE public.telegram_feedbacks DROP CONSTRAINT IF EXISTS telegram_feedbacks_chat_message_key;
ALTER TABLE public.telegram_feedbacks ADD CONSTRAINT telegram_message_id_unique UNIQUE (message_id);

ALTER TABLE public.communication_logs DROP CONSTRAINT IF EXISTS unique_comm_log;
ALTER TABLE public.communication_logs ADD CONSTRAINT unique_comm_log UNIQUE (phone_number, "timestamp", type);

-- 4. 004가 추가한 컬럼 삭제 (데이터 행은 그대로)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cases', 'settings', 'partners', 'telegram_feedbacks', 'communication_logs',
    'pending_sms', 'sms_templates', 'pending_calls', 'tax_invoices',
    'auto_dial_batches', 'auto_dial_items'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS org_id', t);
  END LOOP;
END $$;
ALTER TABLE public.cases              DROP COLUMN IF EXISTS assigned_user_id;
ALTER TABLE public.pending_calls      DROP COLUMN IF EXISTS requested_by;
ALTER TABLE public.pending_calls      DROP COLUMN IF EXISTS target_user_id;
ALTER TABLE public.pending_sms        DROP COLUMN IF EXISTS requested_by;
ALTER TABLE public.pending_sms        DROP COLUMN IF EXISTS target_user_id;
ALTER TABLE public.communication_logs DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.auto_dial_batches  DROP COLUMN IF EXISTS owner_user_id;

-- 5. 조직 테이블·함수 삭제
DROP TABLE IF EXISTS public.org_invites;
DROP TABLE IF EXISTS public.user_profiles;
DROP TABLE IF EXISTS public.org_members;
DROP TABLE IF EXISTS public.organizations;

-- 007(팀 관리) 함수도 함께 제거
DROP FUNCTION IF EXISTS public.list_org_members();
DROP FUNCTION IF EXISTS public.update_org_member(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.assign_cases(TEXT[], UUID);
DROP FUNCTION IF EXISTS public.cases_default_assignee();
DROP FUNCTION IF EXISTS public.can_access_case(TEXT);
DROP FUNCTION IF EXISTS public.can_access_phone(TEXT);
DROP FUNCTION IF EXISTS public.can_access_auto_dial_batch(UUID);
DROP FUNCTION IF EXISTS public.create_organization(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.set_active_org(UUID);
DROP FUNCTION IF EXISTS public.accept_my_invites();
DROP FUNCTION IF EXISTS public.is_platform_admin();
DROP FUNCTION IF EXISTS public.is_org_admin();
DROP FUNCTION IF EXISTS public.current_org_role();
DROP FUNCTION IF EXISTS public.current_org_id();

-- 6. 정책을 004 적용 직전(운영 2026-11-01, 003+003b) 상태로 다시 만들기
CREATE OR REPLACE FUNCTION public.lm_is_app_account()
RETURNS BOOLEAN LANGUAGE sql STABLE
AS $$ SELECT COALESCE(auth.jwt() ->> 'email', '') = 'android-app@leadmaster.com' $$;

-- cases
CREATE POLICY "Whitelisted users can read cases"   ON public.cases FOR SELECT USING ((auth.role() = 'authenticated') AND is_allowed_email());
CREATE POLICY "Whitelisted users can insert cases" ON public.cases FOR INSERT WITH CHECK ((auth.role() = 'authenticated') AND is_allowed_email());
CREATE POLICY "Whitelisted users can update cases" ON public.cases FOR UPDATE USING ((auth.role() = 'authenticated') AND is_allowed_email()) WITH CHECK ((auth.role() = 'authenticated') AND is_allowed_email());
CREATE POLICY "Whitelisted users can delete cases" ON public.cases FOR DELETE USING ((auth.role() = 'authenticated') AND is_allowed_email());
CREATE POLICY "lm_cases_app" ON public.cases FOR ALL TO authenticated USING (public.lm_is_app_account()) WITH CHECK (public.lm_is_app_account());

-- settings
CREATE POLICY "Whitelisted users can read settings"   ON public.settings FOR SELECT USING ((auth.role() = 'authenticated') AND is_allowed_email());
CREATE POLICY "Whitelisted users can insert settings" ON public.settings FOR INSERT WITH CHECK ((auth.role() = 'authenticated') AND is_allowed_email());
CREATE POLICY "Whitelisted users can update settings" ON public.settings FOR UPDATE USING ((auth.role() = 'authenticated') AND is_allowed_email()) WITH CHECK ((auth.role() = 'authenticated') AND is_allowed_email());

-- partners
CREATE POLICY "Whitelisted users can read partners"   ON public.partners FOR SELECT USING ((auth.role() = 'authenticated') AND is_allowed_email());
CREATE POLICY "Whitelisted users can insert partners" ON public.partners FOR INSERT WITH CHECK ((auth.role() = 'authenticated') AND is_allowed_email());
CREATE POLICY "Whitelisted users can update partners" ON public.partners FOR UPDATE USING ((auth.role() = 'authenticated') AND is_allowed_email()) WITH CHECK ((auth.role() = 'authenticated') AND is_allowed_email());
CREATE POLICY "Whitelisted users can delete partners" ON public.partners FOR DELETE USING ((auth.role() = 'authenticated') AND is_allowed_email());

-- telegram_feedbacks
CREATE POLICY "Whitelisted users can access telegram_feedbacks" ON public.telegram_feedbacks FOR ALL USING ((auth.role() = 'authenticated') AND is_allowed_email()) WITH CHECK ((auth.role() = 'authenticated') AND is_allowed_email());
CREATE POLICY "lm_telegram_feedbacks_app_read" ON public.telegram_feedbacks FOR SELECT TO authenticated USING (public.lm_is_app_account());

-- communication_logs
CREATE POLICY "Whitelisted users can read communication_logs"   ON public.communication_logs FOR SELECT USING ((auth.role() = 'authenticated') AND is_allowed_email());
CREATE POLICY "Whitelisted users can delete communication_logs" ON public.communication_logs FOR DELETE USING ((auth.role() = 'authenticated') AND is_allowed_email());
CREATE POLICY "lm_communication_logs_insert" ON public.communication_logs FOR INSERT TO authenticated WITH CHECK (public.is_allowed_email() OR public.lm_is_app_account());

-- pending_calls / pending_sms / auto_dial / sms_templates / tax_invoices
CREATE POLICY "lm_pending_calls_whitelisted" ON public.pending_calls FOR ALL TO authenticated USING (public.is_allowed_email() OR public.lm_is_app_account()) WITH CHECK (public.is_allowed_email() OR public.lm_is_app_account());
CREATE POLICY "lm_pending_sms_whitelisted" ON public.pending_sms FOR ALL TO authenticated USING (is_allowed_email() OR ((auth.jwt() ->> 'email') = 'android-app@leadmaster.com')) WITH CHECK (is_allowed_email() OR ((auth.jwt() ->> 'email') = 'android-app@leadmaster.com'));
CREATE POLICY "lm_auto_dial_batches_whitelisted" ON public.auto_dial_batches FOR ALL TO authenticated USING (is_allowed_email() OR ((auth.jwt() ->> 'email') = 'android-app@leadmaster.com')) WITH CHECK (is_allowed_email() OR ((auth.jwt() ->> 'email') = 'android-app@leadmaster.com'));
CREATE POLICY "lm_auto_dial_items_whitelisted" ON public.auto_dial_items FOR ALL TO authenticated USING (is_allowed_email() OR ((auth.jwt() ->> 'email') = 'android-app@leadmaster.com')) WITH CHECK (is_allowed_email() OR ((auth.jwt() ->> 'email') = 'android-app@leadmaster.com'));
CREATE POLICY "Whitelisted users can do all on sms_templates" ON public.sms_templates FOR ALL USING ((auth.role() = 'authenticated') AND is_allowed_email()) WITH CHECK ((auth.role() = 'authenticated') AND is_allowed_email());
CREATE POLICY "lm_tax_invoices_whitelisted" ON public.tax_invoices FOR ALL TO authenticated USING (public.is_allowed_email()) WITH CHECK (public.is_allowed_email());

COMMIT;

-- 실행 후 확인: 정책 23개, organizations 테이블 없음, cases에 org_id 컬럼 없음
-- SELECT count(*) FROM pg_policies WHERE schemaname='public';
