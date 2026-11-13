-- ============================================================
-- Migration: 032_auto_dial_v4.sql
-- Description: 차세대 스마트 오토콜(Auto-Dialer v4.0) 중앙 집중형 캠페인,
--              상담원별 일일 할당, 실시간 발신 큐 스키마 구축
-- 선행: 004, 005
-- 여러 번 실행해도 된다.
-- [2026-11-13 KIRO 보안·재실행 점검]
--   - 예전 정책 FOR ALL USING (true) = 로그인·비로그인 누구나 모든 회사 캠페인·고객 이름·번호를 읽고 고칠 수 있었음
--     → 회사별 분리 + 역할별 정책:
--       · 캠페인(auto_dial_campaigns): 관리자 = 회사 전체 읽기·쓰기, 상담원 = 본인 할당이 있는 캠페인만 읽기 + 진행 숫자만 고치기
--       · 할당(auto_dial_agent_allocations): 관리자 = 회사 전체, 상담원 = 본인 줄만 읽기·상태/숫자 고치기
--       · 큐(auto_dial_queue): 관리자 = 회사 전체, 상담원 = 본인 배정 줄만 읽기·결과 고치기
--       · 넣기·지우기 = 관리자만, 캠페인이 같은 회사일 때만
--     상담원 식별: 웹이 agent_id / assigned_agent_id 에 이메일을 넣는다(AutoDialCampaignModal) → 이메일(대소문자 무시) 또는 user_id 문자열
--   - org_id 기본값 current_org_id() + organizations FK
--   - case_id / current_case_id: UUID → TEXT (웹은 cases.case_id 글자값을 넣는다. UUID 칸이면 넣을 때마다 오류)
--   - 상담원이 고치면 안 되는 칸(회사·캠페인·담당자·번호 등)은 트리거로 막음
--   - anon 표 권한 회수
-- ============================================================

BEGIN;

-- 0. "이 값이 지금 로그인한 사람인가" (이메일 또는 user_id 문자열)
CREATE OR REPLACE FUNCTION public.lm_is_current_user_ref(p_ref TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT p_ref IS NOT NULL AND auth.uid() IS NOT NULL AND (
    p_ref = auth.uid()::text
    OR lower(p_ref) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  )
$$;
REVOKE ALL ON FUNCTION public.lm_is_current_user_ref(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lm_is_current_user_ref(TEXT) TO authenticated, service_role;

-- 1. 오토콜 캠페인 마스터 테이블
CREATE TABLE IF NOT EXISTS public.auto_dial_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'ready', -- ready, running, paused, completed, archived
  target_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  pacing_settings JSONB NOT NULL DEFAULT '{
    "ringTimeoutSeconds": 20,
    "gapSeconds": 4,
    "wrapUpLimitSeconds": 10,
    "maxRetry": 3,
    "retryIntervalMinutes": 120,
    "dualSimRotation": true,
    "autoSkipWrapUp": true
  }'::jsonb,
  total_leads INT DEFAULT 0,
  completed_leads INT DEFAULT 0,
  connected_leads INT DEFAULT 0,
  no_answer_leads INT DEFAULT 0,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 상담원별 일일 할당 및 실시간 세션 테이블
CREATE TABLE IF NOT EXISTS public.auto_dial_agent_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.auto_dial_campaigns(id) ON DELETE CASCADE,
  org_id UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id VARCHAR(100) NOT NULL,      -- 상담원 email (또는 user_id)
  agent_name VARCHAR(100) NOT NULL,
  target_count INT DEFAULT 150,       -- 일일 목표 콜수
  completed_count INT DEFAULT 0,
  connected_count INT DEFAULT 0,
  no_answer_count INT DEFAULT 0,
  busy_count INT DEFAULT 0,
  rejected_count INT DEFAULT 0,
  current_status VARCHAR(20) DEFAULT 'idle', -- idle, dialing, ringing, talking, wrapup, paused, offline
  current_case_id TEXT,
  current_customer_name VARCHAR(100),
  last_status_changed_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_campaign_agent UNIQUE (campaign_id, agent_id)
);

-- 3. 실시간 통합 발신 큐 테이블
CREATE TABLE IF NOT EXISTS public.auto_dial_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.auto_dial_campaigns(id) ON DELETE CASCADE,
  org_id UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL,               -- cases.case_id (글자)
  assigned_agent_id VARCHAR(100),      -- 배정된 상담원 email (또는 user_id)
  customer_name VARCHAR(100),
  phone VARCHAR(50) NOT NULL,
  sim_slot INT DEFAULT 0,             -- 0 = SIM1, 1 = SIM2 (스마트 교차 발신)
  priority_score INT DEFAULT 100,     -- 신규=100, 부재1차=80, 부재2차=60, 재통화=120
  attempt_count INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  status VARCHAR(20) DEFAULT 'pending', -- pending, locked, dialing, ringing, talking, wrapup, completed, skipped
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  result VARCHAR(50),                 -- connected, no_answer, busy, rejected, callback, invalid
  result_memo TEXT,
  call_duration_seconds INT DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3-1. 예전 버전으로 이미 만들어진 표 맞추기 (기본값·FK·칸 형식)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['auto_dial_campaigns', 'auto_dial_agent_allocations', 'auto_dial_queue'] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN org_id SET DEFAULT public.current_org_id()', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = format('public.%I', t)::regclass AND contype = 'f'
        AND confrelid = 'public.organizations'::regclass
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE',
                     t, t || '_org_id_fkey');
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'auto_dial_queue'
               AND column_name = 'case_id' AND data_type <> 'text') THEN
    ALTER TABLE public.auto_dial_queue ALTER COLUMN case_id TYPE TEXT USING case_id::text;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'auto_dial_agent_allocations'
               AND column_name = 'current_case_id' AND data_type <> 'text') THEN
    ALTER TABLE public.auto_dial_agent_allocations ALTER COLUMN current_case_id TYPE TEXT USING current_case_id::text;
  END IF;
END
$$;

-- ============================================================
-- 인덱스 설정 (고속 큐 폴링 & 실시간 필터 최적화)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_adc_org_status ON public.auto_dial_campaigns (org_id, status);
CREATE INDEX IF NOT EXISTS idx_ada_campaign ON public.auto_dial_agent_allocations (campaign_id);
CREATE INDEX IF NOT EXISTS idx_ada_agent_status ON public.auto_dial_agent_allocations (org_id, agent_id, current_status);
CREATE INDEX IF NOT EXISTS idx_adq_agent_status ON public.auto_dial_queue (campaign_id, assigned_agent_id, status, priority_score DESC, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_adq_case ON public.auto_dial_queue (case_id);

-- ============================================================
-- 상담원이 고치면 안 되는 칸 보호 (관리자·서버는 통과)
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_dial_v4_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cols TEXT[];
  c TEXT;
BEGIN
  -- 회사는 누구도 옮길 수 없다
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION '회사를 바꿀 수 없습니다';
  END IF;
  -- 서버(서비스 키)·관리자는 그대로
  IF auth.uid() IS NULL OR public.is_org_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'auto_dial_campaigns' THEN
    v_cols := ARRAY['name', 'status', 'target_filter', 'pacing_settings', 'total_leads', 'created_by', 'created_at'];
  ELSIF TG_TABLE_NAME = 'auto_dial_agent_allocations' THEN
    v_cols := ARRAY['campaign_id', 'agent_id', 'agent_name', 'target_count', 'is_active', 'created_at'];
  ELSE
    v_cols := ARRAY['campaign_id', 'case_id', 'assigned_agent_id', 'customer_name', 'phone', 'max_attempts', 'created_at'];
  END IF;

  FOREACH c IN ARRAY v_cols LOOP
    IF (to_jsonb(NEW) -> c) IS DISTINCT FROM (to_jsonb(OLD) -> c) THEN
      RAISE EXCEPTION '상담원은 % 칸을 바꿀 수 없습니다', c;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_dial_campaigns_guard ON public.auto_dial_campaigns;
CREATE TRIGGER auto_dial_campaigns_guard BEFORE UPDATE ON public.auto_dial_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.auto_dial_v4_guard();
DROP TRIGGER IF EXISTS auto_dial_allocations_guard ON public.auto_dial_agent_allocations;
CREATE TRIGGER auto_dial_allocations_guard BEFORE UPDATE ON public.auto_dial_agent_allocations
  FOR EACH ROW EXECUTE FUNCTION public.auto_dial_v4_guard();
DROP TRIGGER IF EXISTS auto_dial_queue_guard ON public.auto_dial_queue;
CREATE TRIGGER auto_dial_queue_guard BEFORE UPDATE ON public.auto_dial_queue
  FOR EACH ROW EXECUTE FUNCTION public.auto_dial_v4_guard();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.auto_dial_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_dial_agent_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_dial_queue ENABLE ROW LEVEL SECURITY;

-- 예전 열린 정책 제거
DROP POLICY IF EXISTS "adc_org_isolation" ON public.auto_dial_campaigns;
DROP POLICY IF EXISTS "ada_org_isolation" ON public.auto_dial_agent_allocations;
DROP POLICY IF EXISTS "adq_org_isolation" ON public.auto_dial_queue;

-- 캠페인
DROP POLICY IF EXISTS adc_read ON public.auto_dial_campaigns;
CREATE POLICY adc_read ON public.auto_dial_campaigns
  FOR SELECT TO authenticated
  USING (
    org_id = (SELECT public.current_org_id())
    AND (
      (SELECT public.is_org_admin())
      OR EXISTS (SELECT 1 FROM public.auto_dial_agent_allocations a
                 WHERE a.campaign_id = auto_dial_campaigns.id
                   AND public.lm_is_current_user_ref(a.agent_id))
    )
  );

DROP POLICY IF EXISTS adc_admin_insert ON public.auto_dial_campaigns;
CREATE POLICY adc_admin_insert ON public.auto_dial_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

DROP POLICY IF EXISTS adc_update ON public.auto_dial_campaigns;
CREATE POLICY adc_update ON public.auto_dial_campaigns
  FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT public.current_org_id())
    AND (
      (SELECT public.is_org_admin())
      OR EXISTS (SELECT 1 FROM public.auto_dial_agent_allocations a
                 WHERE a.campaign_id = auto_dial_campaigns.id
                   AND public.lm_is_current_user_ref(a.agent_id))
    )
  )
  WITH CHECK (org_id = (SELECT public.current_org_id()));

DROP POLICY IF EXISTS adc_admin_delete ON public.auto_dial_campaigns;
CREATE POLICY adc_admin_delete ON public.auto_dial_campaigns
  FOR DELETE TO authenticated
  USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

-- 할당
DROP POLICY IF EXISTS ada_read ON public.auto_dial_agent_allocations;
CREATE POLICY ada_read ON public.auto_dial_agent_allocations
  FOR SELECT TO authenticated
  USING (
    org_id = (SELECT public.current_org_id())
    AND ((SELECT public.is_org_admin()) OR public.lm_is_current_user_ref(agent_id))
  );

DROP POLICY IF EXISTS ada_admin_insert ON public.auto_dial_agent_allocations;
CREATE POLICY ada_admin_insert ON public.auto_dial_agent_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT public.current_org_id())
    AND (SELECT public.is_org_admin())
    AND EXISTS (SELECT 1 FROM public.auto_dial_campaigns cp
                WHERE cp.id = campaign_id AND cp.org_id = (SELECT public.current_org_id()))
  );

DROP POLICY IF EXISTS ada_update ON public.auto_dial_agent_allocations;
CREATE POLICY ada_update ON public.auto_dial_agent_allocations
  FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT public.current_org_id())
    AND ((SELECT public.is_org_admin()) OR public.lm_is_current_user_ref(agent_id))
  )
  WITH CHECK (
    org_id = (SELECT public.current_org_id())
    AND ((SELECT public.is_org_admin()) OR public.lm_is_current_user_ref(agent_id))
  );

DROP POLICY IF EXISTS ada_admin_delete ON public.auto_dial_agent_allocations;
CREATE POLICY ada_admin_delete ON public.auto_dial_agent_allocations
  FOR DELETE TO authenticated
  USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

-- 큐
DROP POLICY IF EXISTS adq_read ON public.auto_dial_queue;
CREATE POLICY adq_read ON public.auto_dial_queue
  FOR SELECT TO authenticated
  USING (
    org_id = (SELECT public.current_org_id())
    AND ((SELECT public.is_org_admin()) OR public.lm_is_current_user_ref(assigned_agent_id))
  );

DROP POLICY IF EXISTS adq_admin_insert ON public.auto_dial_queue;
CREATE POLICY adq_admin_insert ON public.auto_dial_queue
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT public.current_org_id())
    AND (SELECT public.is_org_admin())
    AND EXISTS (SELECT 1 FROM public.auto_dial_campaigns cp
                WHERE cp.id = campaign_id AND cp.org_id = (SELECT public.current_org_id()))
  );

DROP POLICY IF EXISTS adq_update ON public.auto_dial_queue;
CREATE POLICY adq_update ON public.auto_dial_queue
  FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT public.current_org_id())
    AND ((SELECT public.is_org_admin()) OR public.lm_is_current_user_ref(assigned_agent_id))
  )
  WITH CHECK (
    org_id = (SELECT public.current_org_id())
    AND ((SELECT public.is_org_admin()) OR public.lm_is_current_user_ref(assigned_agent_id))
  );

DROP POLICY IF EXISTS adq_admin_delete ON public.auto_dial_queue;
CREATE POLICY adq_admin_delete ON public.auto_dial_queue
  FOR DELETE TO authenticated
  USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

REVOKE ALL ON public.auto_dial_campaigns FROM PUBLIC, anon;
REVOKE ALL ON public.auto_dial_agent_allocations FROM PUBLIC, anon;
REVOKE ALL ON public.auto_dial_queue FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_dial_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_dial_agent_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_dial_queue TO authenticated;

-- ============================================================
-- Supabase Realtime Publication 등록 (이미 있으면 건너뜀. Realtime 은 위 RLS 를 따른다)
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['auto_dial_campaigns', 'auto_dial_agent_allocations', 'auto_dial_queue'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;
