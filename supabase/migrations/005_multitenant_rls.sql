-- =============================================
-- Migration: 005_multitenant_rls
-- 작성: 2026-11-01 (초안, 아직 운영 DB에 실행하지 않음)
-- 선행: 004_multitenant_core.sql
-- 목적: 모든 업무 테이블의 권한(RLS)을 "같은 회사 멤버만"으로 교체
--   - 기존 정책(allowedEmails 화이트리스트, USING(true), 003의 lm_*_whitelisted)은 전부 삭제
--   - anon(로그인 안 한 요청)은 어떤 행도 못 봄
--   - service_role(Edge Function)은 RLS를 우회하므로 코드에서 org_id로 직접 거른다
--
-- 역할별 권한 (Phase 1, 2026-11-01 확정: 상담원은 관리자가 배정한 본인 리드만)
--   owner/admin : 회사 데이터 전체 읽기·쓰기, 리드 배정, 설정·파트너·문자템플릿·세금계산서 변경,
--                 리드 영구 삭제, 멤버·초대 관리
--   agent       : 본인 배정 리드만 읽기·수정 (다른 사람에게 넘기기 불가), 직접 등록한 리드는 자동으로 본인 배정
--                 통화·문자 기록 = 본인 폰 기록 + 본인 배정 리드 번호의 기록
--                 전화·문자 요청 = 본인이 요청했거나 본인 폰 대상
--                 자동통화 = 본인이 만든 묶음, 텔레그램 피드백 = 본인 배정 리드에 연결된 것
--                 설정·파트너·문자템플릿은 읽기만, 영구 삭제·세금계산서 불가
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
  me       CONSTANT TEXT := '(SELECT auth.uid())';
  rule     TEXT;
BEGIN
  -- 전화·문자 요청: 관리자 또는 본인이 요청했거나 본인 폰 대상
  FOREACH t IN ARRAY ARRAY['pending_calls', 'pending_sms']
  LOOP
    rule := format('%s AND (%s OR requested_by = %s OR target_user_id = %s)', same_org, is_admin, me, me);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
                   'lm_' || t || '_own_rw', t, rule, rule);
  END LOOP;

  -- 통화·문자 기록: 읽기 = 본인 폰 기록 + 본인 배정 리드 번호 / 쓰기 = 본인 폰 기록만 / 삭제 = 관리자
  EXECUTE 'ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY';
  EXECUTE format('CREATE POLICY lm_communication_logs_read ON public.communication_logs FOR SELECT TO authenticated USING (%s AND (%s OR user_id = %s OR public.can_access_phone(phone_number)))',
                 same_org, is_admin, me);
  EXECUTE format('CREATE POLICY lm_communication_logs_insert ON public.communication_logs FOR INSERT TO authenticated WITH CHECK (%s AND (%s OR user_id = %s))',
                 same_org, is_admin, me);
  EXECUTE format('CREATE POLICY lm_communication_logs_update ON public.communication_logs FOR UPDATE TO authenticated USING (%s AND (%s OR user_id = %s)) WITH CHECK (%s AND (%s OR user_id = %s))',
                 same_org, is_admin, me, same_org, is_admin, me);
  EXECUTE format('CREATE POLICY lm_communication_logs_admin_delete ON public.communication_logs FOR DELETE TO authenticated USING (%s AND %s)',
                 same_org, is_admin);

  -- 텔레그램 피드백: 관리자 전체 / 상담원은 본인 배정 리드에 연결된 것만 보고 처리
  EXECUTE 'ALTER TABLE public.telegram_feedbacks ENABLE ROW LEVEL SECURITY';
  rule := format('%s AND (%s OR (matched_case_id IS NOT NULL AND public.can_access_case(matched_case_id)))', same_org, is_admin);
  EXECUTE format('CREATE POLICY lm_telegram_feedbacks_read ON public.telegram_feedbacks FOR SELECT TO authenticated USING (%s)', rule);
  EXECUTE format('CREATE POLICY lm_telegram_feedbacks_update ON public.telegram_feedbacks FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', rule, rule);
  EXECUTE format('CREATE POLICY lm_telegram_feedbacks_admin_insert ON public.telegram_feedbacks FOR INSERT TO authenticated WITH CHECK (%s AND %s)', same_org, is_admin);
  EXECUTE format('CREATE POLICY lm_telegram_feedbacks_admin_delete ON public.telegram_feedbacks FOR DELETE TO authenticated USING (%s AND %s)', same_org, is_admin);

  -- 자동통화: 관리자 전체 / 상담원은 본인이 만든 묶음과 그 항목
  EXECUTE 'ALTER TABLE public.auto_dial_batches ENABLE ROW LEVEL SECURITY';
  rule := format('%s AND (%s OR owner_user_id = %s)', same_org, is_admin, me);
  EXECUTE format('CREATE POLICY lm_auto_dial_batches_own_rw ON public.auto_dial_batches FOR ALL TO authenticated USING (%s) WITH CHECK (%s)', rule, rule);
  EXECUTE 'ALTER TABLE public.auto_dial_items ENABLE ROW LEVEL SECURITY';
  rule := format('%s AND public.can_access_auto_dial_batch(batch_id)', same_org);
  EXECUTE format('CREATE POLICY lm_auto_dial_items_own_rw ON public.auto_dial_items FOR ALL TO authenticated USING (%s) WITH CHECK (%s)', rule, rule);

  -- 멤버 읽기, 관리자만 쓰기
  FOREACH t IN ARRAY ARRAY['settings', 'partners', 'sms_templates']
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

  -- cases: 관리자 = 회사 전체 / 상담원 = 본인 배정분만 (다른 사람에게 넘기거나 배정 해제 불가)
  --        상담원이 등록하면 cases_default_assignee 트리거가 본인 배정으로 채운 뒤 아래 검사를 통과한다
  EXECUTE 'ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY';
  rule := format('%s AND (%s OR assigned_user_id = %s)', same_org, is_admin, me);
  EXECUTE format('CREATE POLICY lm_cases_read ON public.cases FOR SELECT TO authenticated USING (%s)', rule);
  EXECUTE format('CREATE POLICY lm_cases_insert ON public.cases FOR INSERT TO authenticated WITH CHECK (%s)', rule);
  EXECUTE format('CREATE POLICY lm_cases_update ON public.cases FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', rule, rule);
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
