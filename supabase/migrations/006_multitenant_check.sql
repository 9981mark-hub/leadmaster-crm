-- =============================================
-- 006_multitenant_check  (점검용. 데이터를 바꾸지 않음)
-- 004/005 실행 전후로 Supabase SQL Editor에서 블록별로 실행해 결과를 확인한다.
-- =============================================

-- ---------------------------------------------
-- [사전 점검 1] 004가 본사 멤버로 넣을 사용자 목록 (role 확인용)
-- ---------------------------------------------
WITH allowed AS (
  SELECT lower(e) AS email
  FROM public.settings s,
       jsonb_array_elements_text(CASE WHEN jsonb_typeof(s.value) = 'array' THEN s.value ELSE '[]'::jsonb END) AS e
  WHERE s.key = 'allowedEmails'
  UNION
  SELECT unnest(ARRAY['9981mark@gmail.com', '2882a@naver.com', 'android-app@leadmaster.com'])
)
SELECT a.email, u.id AS user_id, u.last_sign_in_at,
       CASE WHEN a.email = '9981mark@gmail.com' THEN 'owner'
            WHEN a.email = 'android-app@leadmaster.com' THEN 'agent'
            ELSE 'admin' END AS role_to_assign
FROM allowed a
LEFT JOIN auth.users u ON lower(u.email) = a.email
ORDER BY 1;
-- user_id가 비어 있는 행 = 한 번도 로그인하지 않은 이메일 (멤버로 안 들어감, 나중에 초대)

-- ---------------------------------------------
-- [사전 점검 2] 실제 테이블·고유 제약 이름 (004의 DROP CONSTRAINT 이름과 맞는지)
-- ---------------------------------------------
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND contype IN ('p', 'u')
  AND conrelid::regclass::text IN ('settings', 'partners', 'telegram_feedbacks', 'communication_logs', 'cases')
ORDER BY 1, 2;

-- ---------------------------------------------
-- [사후 점검 1] org_id가 빈 행이 없어야 함 (모두 0)
-- ---------------------------------------------
SELECT 'cases' AS t, count(*) FROM public.cases WHERE org_id IS NULL
UNION ALL SELECT 'settings', count(*) FROM public.settings WHERE org_id IS NULL
UNION ALL SELECT 'communication_logs', count(*) FROM public.communication_logs WHERE org_id IS NULL
UNION ALL SELECT 'telegram_feedbacks', count(*) FROM public.telegram_feedbacks WHERE org_id IS NULL
UNION ALL SELECT 'auto_dial_items', count(*) FROM public.auto_dial_items WHERE org_id IS NULL;

-- ---------------------------------------------
-- [사후 점검 2] 정책 목록: 대상 테이블마다 lm_* 정책만 있어야 함
-- ---------------------------------------------
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ---------------------------------------------
-- [사후 점검 3] 사용자 입장에서 보이는 건수 (사용자별로 값 바꿔 실행)
--   <USER_UUID>, <EMAIL> 에 [사전 점검 1]의 값을 넣는다. ROLLBACK이라 아무것도 바뀌지 않음.
-- ---------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', '<USER_UUID>', 'email', '<EMAIL>', 'role', 'authenticated')::text,
                  true);
SELECT public.current_org_id() AS my_org,
       public.current_org_role() AS my_role,
       (SELECT count(*) FROM public.cases) AS visible_cases,
       (SELECT count(*) FROM public.settings) AS visible_settings,
       (SELECT count(*) FROM public.communication_logs) AS visible_comm_logs;
ROLLBACK;

-- ---------------------------------------------
-- [사후 점검 4] 로그인 안 한 요청(anon)은 0건이어야 함
-- ---------------------------------------------
BEGIN;
SET LOCAL ROLE anon;
SELECT (SELECT count(*) FROM public.cases) AS anon_cases,
       (SELECT count(*) FROM public.pending_sms) AS anon_pending_sms,
       (SELECT count(*) FROM public.auto_dial_items) AS anon_auto_dial_items;
ROLLBACK;

-- ---------------------------------------------
-- [스테이징 전용] 교차 회사 점검: 테스트 회사 B를 만들고 B 사용자로 본사 데이터가 0건인지
--   운영 DB에서는 실행하지 않는다.
-- ---------------------------------------------
-- INSERT INTO public.organizations (id, name, slug) VALUES ('00000000-0000-0000-0000-0000000000b2', '테스트회사B', 'test-b');
-- INSERT INTO public.org_members (org_id, user_id, role) VALUES ('00000000-0000-0000-0000-0000000000b2', '<TEST_USER_UUID>', 'agent');
-- 그 다음 [사후 점검 3]을 <TEST_USER_UUID>로 실행 → visible_cases = 0 이어야 함
