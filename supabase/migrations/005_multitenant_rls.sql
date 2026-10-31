-- =============================================
-- Migration: 005_multitenant_rls
-- 작성: 2026-11-01 (초안, 아직 운영 DB에 실행하지 않음)
-- 선행: 004_multitenant_core.sql
-- 목적: 모든 업무 테이블의 권한(RLS)을 "같은 회사 멤버만"으로 교체
--   - 기존 정책(allowedEmails 화이트리스트, USING(true), 003의 lm_*_whitelisted)은 전부 삭제
--   - anon(로그인 안 한 요청)은 어떤 행도 못 봄
--   - service_role(Edge Function)은 RLS를 우회하므로 코드에서 org_id로 직접 거른다
--
-- 역할별 권한 (Phase 1)
--   owner/admin : 회사 데이터 전체 읽기·쓰기, 설정·파트너·세금계산서 변경, 리드 영구 삭제, 멤버·초대 관리
--   agent       : 회사 리드 읽기·등록·수정(휴지통 이동 포함), 통화/문자/자동통화/텔레그램 피드백 처리
--                 설정은 읽기만, 영구 삭제·세금계산서 불가
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. 대상 테이블의 기존 정책 전부 삭제
-- ---------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
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

-- ---------------------------------------------
-- 2. 정책 생성 도우미
--    member_rw : 같은 회사 멤버 전원 읽기·쓰기
--    admin_w   : 같은 회사 멤버 읽기, 관리자만 쓰기
--    admin_rw  : 관리자만 읽기·쓰기
-- ---------------------------------------------
DO $$
DECLARE
  t TEXT;
  same_org CONSTANT TEXT := 'org_id = (SELECT public.current_org_id())';
  is_admin CONSTANT TEXT := '(SELECT public.is_org_admin())';
BEGIN
  -- 같은 회사 멤버 전원 읽기·쓰기
  FOREACH t IN ARRAY ARRAY[
    'telegram_feedbacks', 'communication_logs', 'pending_sms', 'pending_calls',
    'auto_dial_batches', 'auto_dial_items', 'sms_templates'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
                   'lm_' || t || '_member_rw', t, same_org, same_org);
  END LOOP;

  -- 멤버 읽기, 관리자만 쓰기
  FOREACH t IN ARRAY ARRAY['settings', 'partners']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
                   'lm_' || t || '_member_read', t, same_org);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s AND %s)',
                   'lm_' || t || '_admin_insert', t, same_org, is_admin);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s AND %s) WITH CHECK (%s AND %s)',
                   'lm_' || t || '_admin_update', t, same_org, is_admin, same_org, is_admin);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s AND %s)',
                   'lm_' || t || '_admin_delete', t, same_org, is_admin);
  END LOOP;

  -- 관리자만 (세금계산서: 회사 내부 회계)
  EXECUTE 'ALTER TABLE public.tax_invoices ENABLE ROW LEVEL SECURITY';
  EXECUTE format('CREATE POLICY lm_tax_invoices_admin_rw ON public.tax_invoices FOR ALL TO authenticated USING (%s AND %s) WITH CHECK (%s AND %s)',
                 same_org, is_admin, same_org, is_admin);

  -- cases: 멤버 읽기·등록·수정, 영구 삭제는 관리자만
  EXECUTE 'ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY';
  EXECUTE format('CREATE POLICY lm_cases_member_read ON public.cases FOR SELECT TO authenticated USING (%s)', same_org);
  EXECUTE format('CREATE POLICY lm_cases_member_insert ON public.cases FOR INSERT TO authenticated WITH CHECK (%s)', same_org);
  EXECUTE format('CREATE POLICY lm_cases_member_update ON public.cases FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', same_org, same_org);
  EXECUTE format('CREATE POLICY lm_cases_admin_delete ON public.cases FOR DELETE TO authenticated USING (%s AND %s)', same_org, is_admin);
END $$;

-- ---------------------------------------------
-- 3. 조직·멤버 테이블
-- ---------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invites   ENABLE ROW LEVEL SECURITY;

-- 회사: 내가 속한 회사만 보임. 생성은 create_organization() 함수로만.
CREATE POLICY lm_organizations_member_read ON public.organizations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_members m
                 WHERE m.org_id = organizations.id AND m.user_id = auth.uid() AND m.status = 'active'));
CREATE POLICY lm_organizations_admin_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
  WITH CHECK (id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

-- 멤버: 같은 회사 멤버 목록 보기, 관리자가 역할·상태 변경
CREATE POLICY lm_org_members_read ON public.org_members
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.current_org_id()) OR user_id = auth.uid());
CREATE POLICY lm_org_members_admin_update ON public.org_members
  FOR UPDATE TO authenticated
  USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
  WITH CHECK (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));
CREATE POLICY lm_org_members_admin_delete ON public.org_members
  FOR DELETE TO authenticated
  USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()) AND user_id <> auth.uid());
-- 멤버 추가는 초대 수락 함수(accept_my_invites)로만

-- 내 프로필: 본인 행만 읽기 (변경은 set_active_org() 함수로만 → is_platform_admin 임의 변경 불가)
CREATE POLICY lm_user_profiles_self_read ON public.user_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 초대: 관리자가 같은 회사 초대 관리. owner 초대는 owner만.
CREATE POLICY lm_org_invites_admin_rw ON public.org_invites
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
  WITH CHECK (
    org_id = (SELECT public.current_org_id())
    AND (SELECT public.is_org_admin())
    AND (role <> 'owner' OR (SELECT public.current_org_role()) = 'owner')
  );

COMMIT;

-- =============================================
-- [005b] telegram-webhook이 org_id를 직접 넣도록 배포된 뒤 실행 (전환기간 기본값 제거)
-- ALTER TABLE public.telegram_feedbacks ALTER COLUMN org_id SET DEFAULT public.current_org_id();
-- =============================================
