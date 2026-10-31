-- =============================================
-- Migration: 004_multitenant_core
-- 작성: 2026-11-01 (초안, 아직 운영 DB에 실행하지 않음)
-- 목적: 회사(조직) 단위 데이터 분리의 기반
--   1) organizations / org_members / user_profiles / org_invites 테이블
--   2) current_org_id() 등 권한 함수
--   3) 기존 업무 테이블에 org_id 추가 → 기존 데이터는 전부 "리드마스터 본사"로 채움
--   4) org_id 기본값 = 현재 로그인 사용자의 회사 → 웹·앱 코드가 org_id를 몰라도 자동으로 들어감
--   5) 회사별로 겹칠 수 있는 고유 제약(settings key, 텔레그램 message_id 등) 조정
--
-- 실행 순서: 004 → 005(RLS) → 006(점검). 반드시 스테이징 DB에서 먼저 실행해 본다.
-- 실행 전: 운영 DB 백업(db dump) 필수.
-- 실행 시간대: 웹·앱 사용이 없는 시간 (cases 전체에 org_id를 쓰면서 Realtime 이벤트가 한 번 발생)
-- =============================================

BEGIN;

-- 본사 조직 ID (고정값. 스크립트·코드에서 참조)
-- 00000000-0000-0000-0000-000000000001 = 리드마스터 본사

-- ---------------------------------------------
-- 1. 조직·멤버 테이블
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_members (
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('owner', 'admin', 'agent')),
  display_name  TEXT,                       -- 상담원 표시 이름 (managerName 대체)
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.org_members(user_id);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_org_id      UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  is_platform_admin  BOOLEAN NOT NULL DEFAULT false,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('owner', 'admin', 'agent')),
  display_name TEXT,
  invited_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

-- ---------------------------------------------
-- 2. 권한 함수 (SECURITY DEFINER: RLS 재귀 없이 멤버십 조회)
-- ---------------------------------------------

-- 현재 사용자의 활성 회사. 여러 회사 소속이면 user_profiles.active_org_id 우선.
-- 로그인 안 했거나 소속 없음 → NULL (→ 모든 RLS에서 0건, INSERT는 NOT NULL로 실패)
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.org_id
  FROM public.org_members m
  JOIN public.organizations o ON o.id = m.org_id AND o.status = 'active'
  LEFT JOIN public.user_profiles p ON p.user_id = m.user_id
  WHERE m.user_id = auth.uid()
    AND m.status = 'active'
  ORDER BY (m.org_id = p.active_org_id) DESC NULLS LAST, m.created_at
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_org_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role
  FROM public.org_members m
  WHERE m.user_id = auth.uid()
    AND m.org_id = public.current_org_id()
    AND m.status = 'active'
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_org_role() IN ('owner', 'admin'), false)
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.is_platform_admin FROM public.user_profiles p WHERE p.user_id = auth.uid()), false)
$$;

-- 로그인 직후 웹이 호출: 내 이메일로 온 초대를 수락하고 회사에 연결
CREATE OR REPLACE FUNCTION public.accept_my_invites()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR v_email IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.org_members (org_id, user_id, role, display_name)
  SELECT i.org_id, auth.uid(), i.role, i.display_name
  FROM public.org_invites i
  WHERE lower(i.email) = v_email
    AND i.accepted_at IS NULL
    AND i.expires_at > now()
  ON CONFLICT (org_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.org_invites
  SET accepted_at = now()
  WHERE lower(email) = v_email
    AND accepted_at IS NULL
    AND expires_at > now();

  INSERT INTO public.user_profiles AS up (user_id, active_org_id)
  VALUES (auth.uid(), public.current_org_id())
  ON CONFLICT (user_id) DO UPDATE
    SET active_org_id = COALESCE(up.active_org_id, EXCLUDED.active_org_id),
        updated_at = now();

  RETURN v_count;
END;
$$;

-- 소속 회사 전환 (여러 회사 소속일 때)
CREATE OR REPLACE FUNCTION public.set_active_org(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN false;
  END IF;
  INSERT INTO public.user_profiles (user_id, active_org_id)
  VALUES (auth.uid(), p_org_id)
  ON CONFLICT (user_id) DO UPDATE SET active_org_id = EXCLUDED.active_org_id, updated_at = now();
  RETURN true;
END;
$$;

-- 플랫폼 관리자(나)만: 새 고객 회사 생성 + 회사 대표 초대
CREATE OR REPLACE FUNCTION public.create_organization(p_name TEXT, p_owner_email TEXT, p_slug TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform admin only';
  END IF;
  INSERT INTO public.organizations (name, slug) VALUES (p_name, p_slug) RETURNING id INTO v_org;
  INSERT INTO public.org_invites (org_id, email, role, invited_by)
  VALUES (v_org, lower(p_owner_email), 'owner', auth.uid());
  RETURN v_org;
END;
$$;

-- 함수는 기본적으로 PUBLIC(=anon 포함) 실행 권한이 있으므로 회수 후 로그인 사용자에게만 부여
REVOKE ALL ON FUNCTION public.create_organization(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_my_invites() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_active_org(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_my_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_org(UUID) TO authenticated;

-- ---------------------------------------------
-- 3. 본사 조직 생성 + 기존 사용자 연결
-- ---------------------------------------------
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', '리드마스터 본사', 'hq')
ON CONFLICT (id) DO NOTHING;

-- 기존 허용 이메일(settings.allowedEmails) + 관리자 기본 이메일 → 본사 멤버
-- 9981mark@gmail.com = owner, 2882a@naver.com 등 나머지 허용 이메일 = admin (2026-11-01 확정)
-- 앱 서비스 계정 = admin (전환기간 전용: 지금 앱은 이 계정 하나로 모든 문자·전화 요청을 처리하므로
--   상담원 권한이면 대표님 요청이 안 보인다. 앱 사용자 로그인 배포 후 status='disabled'로 끈다)
-- ← 실행 전 006의 [사전 점검] 결과로 대상자 확인
WITH allowed AS (
  SELECT lower(e) AS email
  FROM public.settings s,
       jsonb_array_elements_text(
         CASE WHEN jsonb_typeof(s.value) = 'array' THEN s.value ELSE '[]'::jsonb END
       ) AS e
  WHERE s.key = 'allowedEmails'
  UNION
  SELECT unnest(ARRAY['9981mark@gmail.com', '2882a@naver.com', 'android-app@leadmaster.com'])
)
INSERT INTO public.org_members (org_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001',
       u.id,
       CASE
         WHEN lower(u.email) = '9981mark@gmail.com' THEN 'owner'
         ELSE 'admin'
       END
FROM auth.users u
JOIN allowed a ON a.email = lower(u.email)
ON CONFLICT (org_id, user_id) DO NOTHING;

-- 아직 한 번도 로그인하지 않은 허용 이메일(예: 2882a@naver.com, 2026-11-01 기준 미가입)은
-- 본사 관리자 초대로 만들어 둔다 → 처음 로그인할 때 accept_my_invites()로 자동 연결
WITH allowed AS (
  SELECT lower(e) AS email
  FROM public.settings s,
       jsonb_array_elements_text(
         CASE WHEN jsonb_typeof(s.value) = 'array' THEN s.value ELSE '[]'::jsonb END
       ) AS e
  WHERE s.key = 'allowedEmails'
  UNION
  SELECT unnest(ARRAY['9981mark@gmail.com', '2882a@naver.com'])
)
INSERT INTO public.org_invites (org_id, email, role, expires_at)
SELECT '00000000-0000-0000-0000-000000000001', a.email,
       CASE WHEN a.email = '9981mark@gmail.com' THEN 'owner' ELSE 'admin' END,
       now() + interval '365 days'
FROM allowed a
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = a.email)
ON CONFLICT (org_id, email) DO NOTHING;

INSERT INTO public.user_profiles (user_id, active_org_id, is_platform_admin)
SELECT m.user_id, m.org_id, (lower(u.email) = '9981mark@gmail.com')
FROM public.org_members m
JOIN auth.users u ON u.id = m.user_id
WHERE m.org_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------
-- 4. 업무 테이블에 org_id 추가 + 본사로 채우기 + 기본값
-- ---------------------------------------------
-- updated_at 트리거가 1,400여 건 전체의 updated_at을 지금 시각으로 바꾸지 않도록 잠시 끈다
ALTER TABLE public.cases DISABLE TRIGGER USER;
ALTER TABLE public.partners DISABLE TRIGGER USER;

DO $$
DECLARE
  t TEXT;
  hq CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cases', 'settings', 'partners', 'telegram_feedbacks', 'communication_logs',
    'pending_sms', 'sms_templates', 'pending_calls', 'tax_invoices',
    'auto_dial_batches', 'auto_dial_items'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'skip (table not found): %', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id)', t);
    EXECUTE format('UPDATE public.%I SET org_id = %L WHERE org_id IS NULL', t, hq);
    -- 기본값: INSERT하는 사용자의 회사 (웹·앱이 org_id를 보내지 않아도 됨)
    -- service_role(Edge Function)은 회사가 없어 NULL → NOT NULL 위반 → 반드시 org_id를 명시해야 함
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN org_id SET DEFAULT public.current_org_id()', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN org_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (org_id)', 'idx_' || t || '_org', t);
  END LOOP;
END $$;

ALTER TABLE public.cases ENABLE TRIGGER USER;
ALTER TABLE public.partners ENABLE TRIGGER USER;

-- [전환기간 전용] telegram-webhook(Edge Function, service_role)은 아직 org_id를 보내지 않는다.
-- 웹훅 코드가 org_id를 넣도록 바뀌기 전까지만 본사로 채운다. → 웹훅 배포 후 005b에서 제거
ALTER TABLE public.telegram_feedbacks
  ALTER COLUMN org_id SET DEFAULT COALESCE(public.current_org_id(), '00000000-0000-0000-0000-000000000001'::uuid);

-- 담당 상담원 / 전화 요청 대상 (상담원 30명 대응)
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cases_org_assigned ON public.cases (org_id, assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_cases_org_updated ON public.cases (org_id, updated_at DESC);

ALTER TABLE public.pending_calls ADD COLUMN IF NOT EXISTS requested_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;
-- 어느 상담원 폰에서 걸지. 기본값 = 요청한 본인 (PC에서 누르면 내 폰으로)
ALTER TABLE public.pending_calls ADD COLUMN IF NOT EXISTS target_user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.pending_sms   ADD COLUMN IF NOT EXISTS requested_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.pending_sms   ADD COLUMN IF NOT EXISTS target_user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.communication_logs ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.auto_dial_batches  ADD COLUMN IF NOT EXISTS owner_user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

-- ---------------------------------------------
-- 4-1. 상담원은 "관리자가 배정한 본인 리드"만 (2026-11-01 확정)
-- ---------------------------------------------
-- 상담원이 직접 등록한 리드는 본인 담당으로 자동 지정 (안 그러면 등록하자마자 본인에게 안 보임)
-- 관리자 등록·엑셀 업로드는 미배정으로 들어가고 관리자가 배정한다
CREATE OR REPLACE FUNCTION public.cases_default_assignee()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_user_id IS NULL AND auth.uid() IS NOT NULL AND public.current_org_role() = 'agent' THEN
    NEW.assigned_user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS cases_default_assignee ON public.cases;
CREATE TRIGGER cases_default_assignee
  BEFORE INSERT ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.cases_default_assignee();

-- 이 리드를 볼 수 있는가 (관리자 = 회사 전체, 상담원 = 본인 배정분)
CREATE OR REPLACE FUNCTION public.can_access_case(p_case_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.case_id = p_case_id
      AND c.org_id = public.current_org_id()
      AND (public.is_org_admin() OR c.assigned_user_id = auth.uid())
  )
$$;

-- 이 전화번호의 통화·문자 기록을 볼 수 있는가 (상담원 = 본인 배정 리드의 번호)
CREATE OR REPLACE FUNCTION public.can_access_phone(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_org_admin() OR EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.org_id = public.current_org_id()
      AND c.assigned_user_id = auth.uid()
      AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g')
  )
$$;

-- 이 자동통화 묶음을 볼 수 있는가 (상담원 = 본인이 만든 묶음)
CREATE OR REPLACE FUNCTION public.can_access_auto_dial_batch(p_batch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auto_dial_batches b
    WHERE b.id = p_batch_id
      AND b.org_id = public.current_org_id()
      AND (public.is_org_admin() OR b.owner_user_id = auth.uid())
  )
$$;

-- ---------------------------------------------
-- 5. 회사별로 겹칠 수 있는 고유 제약 조정
-- ---------------------------------------------
-- settings: key 하나가 전체 공용이던 것 → (회사, key)
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE public.settings ADD CONSTRAINT settings_pkey PRIMARY KEY (org_id, key);

-- partners: partner_id(P001 등)는 회사마다 같을 수 있음
ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_partner_id_key;
ALTER TABLE public.partners ADD CONSTRAINT partners_org_partner_id_key UNIQUE (org_id, partner_id);

-- telegram: message_id는 대화방마다 따로 매겨짐 → (방, 메시지)
ALTER TABLE public.telegram_feedbacks DROP CONSTRAINT IF EXISTS telegram_feedbacks_message_id_key;
ALTER TABLE public.telegram_feedbacks DROP CONSTRAINT IF EXISTS telegram_message_id_unique;  -- 운영 DB 실제 이름 (2026-11-01 백업에서 확인)
ALTER TABLE public.telegram_feedbacks ADD CONSTRAINT telegram_feedbacks_chat_message_key UNIQUE (chat_id, message_id);

-- 통화·문자 기록 중복 방지 키에 회사 포함
ALTER TABLE public.communication_logs DROP CONSTRAINT IF EXISTS unique_comm_log;
ALTER TABLE public.communication_logs ADD CONSTRAINT unique_comm_log UNIQUE (org_id, phone_number, timestamp, type);

-- cases.case_id는 전체 고유 그대로 둔다 (telegram_feedbacks·communication_logs 외래키가 참조)

COMMIT;
