-- =============================================
-- Migration: 013_lead_distribution
-- 작성: 2026-11-01
-- 선행: 004, 005, 007
-- 목적: 리드 배분 시스템 (상담원 30명 운영)
--   1) 자동 배분: 새 리드가 들어오면 규칙대로 상담원에게 (순번 / 담당 적은 사람 먼저 / 가중치)
--      - 상담원별 받기 켜기·끄기, 가중치(1~10), 하루 상한, 1인당 진행 중 리드 상한
--   2) 수동 배분: 고른 리드를 순번·균형·수량 지정으로 나눠주기
--   3) 회수: 수동 회수, 자동 회수(배정 후 N분 동안 상태 그대로 + 통화·문자 기록 없음), 사용 중지 시 회수
--   4) 담당 변경(이관): A의 리드를 B에게
--   5) 배정 기록: 누가 언제 누구에게서 누구에게 왜(수동·자동·회수·이관·업로드)
--   6) 수신동의 DB 업로드 묶음(lead_import_batches) + 회사 전체 중복 번호 확인
-- 기본값은 모두 "꺼짐" → 적용해도 지금 동작(본사)은 바뀌지 않는다.
-- 데이터를 지우지 않는다. 되돌리기: 맨 아래 [ROLLBACK]
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. 테이블
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_distribution_settings (
  org_id                UUID PRIMARY KEY DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  auto_assign           BOOLEAN NOT NULL DEFAULT false,
  method                TEXT NOT NULL DEFAULT 'round_robin' CHECK (method IN ('round_robin', 'balanced', 'weighted')),
  default_daily_cap     INT CHECK (default_daily_cap IS NULL OR default_daily_cap > 0),
  max_open_per_agent    INT CHECK (max_open_per_agent IS NULL OR max_open_per_agent > 0),
  -- "끝난 리드" 상태: 진행 중 리드 수(균형 배분·상한)에서 뺀다
  closed_statuses       TEXT[] NOT NULL DEFAULT ARRAY['진행불가','고객취소','사무장 접수','계약 완료','1차 입금완료','2차 입금완료','수신정지','휴지통'],
  auto_reclaim          BOOLEAN NOT NULL DEFAULT false,
  reclaim_after_minutes INT NOT NULL DEFAULT 1440 CHECK (reclaim_after_minutes BETWEEN 10 AND 43200),
  reclaim_statuses      TEXT[] NOT NULL DEFAULT ARRAY['신규접수'],
  reclaim_action        TEXT NOT NULL DEFAULT 'reassign' CHECK (reclaim_action IN ('unassign', 'reassign')),
  reclaim_on_disable    BOOLEAN NOT NULL DEFAULT true,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            UUID DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.org_agent_distribution (
  org_id            UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiving         BOOLEAN NOT NULL DEFAULT true,
  weight            INT NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 10),
  daily_cap         INT CHECK (daily_cap IS NULL OR daily_cap > 0),
  last_assigned_at  TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.lead_import_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  source        TEXT,                 -- DB 업체·출처
  file_name     TEXT,
  total_rows    INT NOT NULL DEFAULT 0,
  inserted      INT NOT NULL DEFAULT 0,
  duplicates    INT NOT NULL DEFAULT 0,
  invalid       INT NOT NULL DEFAULT 0,
  distribution  JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {"mode":"none|auto|round_robin|quantity", ...}
  created_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_import_batches_org_idx ON public.lead_import_batches (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.case_assignment_logs (
  id          BIGSERIAL PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id     TEXT NOT NULL,
  from_user   UUID,
  to_user     UUID,
  reason      TEXT NOT NULL,          -- manual / auto / self / import / distribute / reclaim / auto_reclaim / transfer / disable
  note        TEXT,
  by_user     UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_assignment_logs_org_idx ON public.case_assignment_logs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS case_assignment_logs_case_idx ON public.case_assignment_logs (case_id, created_at DESC);

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.lead_import_batches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cases_org_assignee_at ON public.cases (org_id, assigned_user_id, assigned_at);

-- ---------------------------------------------
-- 2. RLS (관리자만. 상담원은 본인 관련 배정 기록만 읽기)
-- ---------------------------------------------
ALTER TABLE public.org_distribution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_agent_distribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_assignment_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lm_dist_settings_admin ON public.org_distribution_settings;
CREATE POLICY lm_dist_settings_admin ON public.org_distribution_settings FOR ALL TO authenticated
  USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
  WITH CHECK (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

DROP POLICY IF EXISTS lm_agent_dist_admin ON public.org_agent_distribution;
CREATE POLICY lm_agent_dist_admin ON public.org_agent_distribution FOR ALL TO authenticated
  USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
  WITH CHECK (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin())
              AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_agent_distribution.org_id AND m.user_id = org_agent_distribution.user_id));

DROP POLICY IF EXISTS lm_import_batches_admin ON public.lead_import_batches;
CREATE POLICY lm_import_batches_admin ON public.lead_import_batches FOR ALL TO authenticated
  USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
  WITH CHECK (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

DROP POLICY IF EXISTS lm_assign_logs_read ON public.case_assignment_logs;
CREATE POLICY lm_assign_logs_read ON public.case_assignment_logs FOR SELECT TO authenticated
  USING (org_id = (SELECT public.current_org_id())
         AND ((SELECT public.is_org_admin()) OR to_user = (SELECT auth.uid()) OR from_user = (SELECT auth.uid())));

REVOKE ALL ON public.org_distribution_settings, public.org_agent_distribution, public.lead_import_batches, public.case_assignment_logs FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.org_distribution_settings, public.org_agent_distribution, public.lead_import_batches TO authenticated;
GRANT SELECT ON public.case_assignment_logs TO authenticated;

-- ---------------------------------------------
-- 3. 상담원 고르기 (자동 배분의 핵심)
-- ---------------------------------------------
-- p_exclude: 이 사람은 빼고 (자동 회수 후 재배정 때 이전 담당자 제외)
CREATE OR REPLACE FUNCTION public.lm_pick_agent(p_org UUID, p_exclude UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.org_distribution_settings%ROWTYPE;
  v_today TIMESTAMPTZ := (date_trunc('day', now() AT TIME ZONE 'Asia/Seoul')) AT TIME ZONE 'Asia/Seoul';
  v_pick UUID;
BEGIN
  SELECT * INTO s FROM public.org_distribution_settings WHERE org_id = p_org;
  IF NOT FOUND THEN
    s.method := 'round_robin';
    s.closed_statuses := ARRAY['진행불가','고객취소','사무장 접수','계약 완료','1차 입금완료','2차 입금완료','수신정지','휴지통'];
  END IF;

  -- 같은 회사에서 동시에 여러 리드가 들어와도 순번이 꼬이지 않게 한 번에 하나씩
  PERFORM pg_advisory_xact_lock(hashtext('lm_assign_' || p_org::text));

  WITH cand AS (
    SELECT m.user_id,
           COALESCE(d.weight, 1) AS weight,
           COALESCE(d.daily_cap, s.default_daily_cap) AS cap,
           d.last_assigned_at,
           m.created_at,
           (SELECT count(*) FROM public.cases c
             WHERE c.org_id = p_org AND c.assigned_user_id = m.user_id AND c.assigned_at >= v_today) AS today_n,
           (SELECT count(*) FROM public.cases c
             WHERE c.org_id = p_org AND c.assigned_user_id = m.user_id AND c.deleted_at IS NULL
               AND NOT (COALESCE(c.status, '') = ANY (s.closed_statuses))) AS open_n
    FROM public.org_members m
    LEFT JOIN public.org_agent_distribution d ON d.org_id = m.org_id AND d.user_id = m.user_id
    WHERE m.org_id = p_org AND m.status = 'active' AND m.role = 'agent'
      AND COALESCE(d.receiving, true)
      AND (p_exclude IS NULL OR m.user_id <> p_exclude)
  )
  SELECT user_id INTO v_pick FROM cand
  WHERE (cap IS NULL OR today_n < cap)
    AND (s.max_open_per_agent IS NULL OR open_n < s.max_open_per_agent)
  ORDER BY
    CASE WHEN s.method = 'balanced' THEN open_n END ASC NULLS LAST,
    CASE WHEN s.method = 'weighted' THEN today_n::numeric / weight END ASC NULLS LAST,
    last_assigned_at ASC NULLS FIRST,
    created_at ASC
  LIMIT 1;

  IF v_pick IS NOT NULL THEN
    INSERT INTO public.org_agent_distribution AS d (org_id, user_id, last_assigned_at)
    VALUES (p_org, v_pick, clock_timestamp())
    ON CONFLICT (org_id, user_id) DO UPDATE SET last_assigned_at = clock_timestamp();
  END IF;
  RETURN v_pick;
END;
$$;
REVOKE ALL ON FUNCTION public.lm_pick_agent(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------
-- 4. 트리거: 새 리드 담당 정하기 + 배정 시각 + 기록
-- ---------------------------------------------
-- 기존 cases_default_assignee(상담원 등록분 = 본인) 대체: 상담원 등록 → 본인, 그 외 자동 배분이 켜져 있으면 규칙대로
-- 업로드 묶음(import_batch_id)이 있으면 묶음 설정이 "auto"일 때만 자동 배분 (나머지는 업로드 화면이 정함)
CREATE OR REPLACE FUNCTION public.cases_default_assignee()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auto BOOLEAN;
  v_mode TEXT;
BEGIN
  IF NEW.assigned_user_id IS NULL THEN
    IF auth.uid() IS NOT NULL AND public.current_org_role() = 'agent' THEN
      NEW.assigned_user_id := auth.uid();
    ELSIF NEW.org_id IS NOT NULL THEN
      SELECT auto_assign INTO v_auto FROM public.org_distribution_settings WHERE org_id = NEW.org_id;
      IF NEW.import_batch_id IS NOT NULL THEN
        SELECT distribution ->> 'mode' INTO v_mode FROM public.lead_import_batches WHERE id = NEW.import_batch_id;
        v_auto := (v_mode = 'auto');
      END IF;
      IF COALESCE(v_auto, false) THEN
        NEW.assigned_user_id := public.lm_pick_agent(NEW.org_id);
      END IF;
    END IF;
  END IF;
  IF NEW.assigned_user_id IS NOT NULL THEN
    NEW.assigned_at := COALESCE(NEW.assigned_at, now());
  END IF;
  RETURN NEW;
END;
$$;

-- 담당자가 바뀌면 배정 시각 갱신
CREATE OR REPLACE FUNCTION public.cases_assignee_changed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN
    NEW.assigned_at := CASE WHEN NEW.assigned_user_id IS NULL THEN NULL ELSE now() END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS cases_assignee_changed_at ON public.cases;
CREATE TRIGGER cases_assignee_changed_at
  BEFORE UPDATE OF assigned_user_id ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.cases_assignee_changed_at();

-- 배정 기록 (사유는 함수가 lm.assign_reason / lm.assign_note로 넘김, 없으면 수동)
CREATE OR REPLACE FUNCTION public.cases_log_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := NULLIF(current_setting('lm.assign_reason', true), '');
  v_note TEXT := NULLIF(current_setting('lm.assign_note', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_user_id IS NULL THEN RETURN NULL; END IF;
    v_reason := CASE
      WHEN NEW.import_batch_id IS NOT NULL THEN 'import'
      WHEN NEW.assigned_user_id = auth.uid() AND public.current_org_role() = 'agent' THEN 'self'
      WHEN v_reason IS NOT NULL THEN v_reason
      WHEN auth.uid() IS NULL OR NEW.assigned_user_id <> auth.uid() THEN 'auto'
      ELSE 'manual' END;
    INSERT INTO public.case_assignment_logs (org_id, case_id, from_user, to_user, reason, note, by_user)
    VALUES (NEW.org_id, NEW.case_id, NULL, NEW.assigned_user_id, v_reason, v_note, auth.uid());
  ELSIF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN
    INSERT INTO public.case_assignment_logs (org_id, case_id, from_user, to_user, reason, note, by_user)
    VALUES (NEW.org_id, NEW.case_id, OLD.assigned_user_id, NEW.assigned_user_id, COALESCE(v_reason, 'manual'), v_note, auth.uid());
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS cases_log_assignment_ins ON public.cases;
CREATE TRIGGER cases_log_assignment_ins
  AFTER INSERT ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.cases_log_assignment();
DROP TRIGGER IF EXISTS cases_log_assignment_upd ON public.cases;
CREATE TRIGGER cases_log_assignment_upd
  AFTER UPDATE OF assigned_user_id ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.cases_log_assignment();

-- ---------------------------------------------
-- 5. 관리자 함수
-- ---------------------------------------------
-- 내부: 사유 기록용 설정
CREATE OR REPLACE FUNCTION public.lm_set_assign_reason(p_reason TEXT, p_note TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('lm.assign_reason', COALESCE(p_reason, ''), true);
  PERFORM set_config('lm.assign_note', COALESCE(p_note, ''), true);
END;
$$;
REVOKE ALL ON FUNCTION public.lm_set_assign_reason(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- 5-1. 기존 assign_cases(수동 지정·해제)에 사유 기록 추가
CREATE OR REPLACE FUNCTION public.assign_cases(p_case_ids TEXT[], p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := public.current_org_id();
  v_count INTEGER;
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN RAISE EXCEPTION '관리자만 배정할 수 있습니다'; END IF;
  IF p_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.org_members WHERE org_id = v_org AND user_id = p_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION '같은 회사의 사용 중인 멤버에게만 배정할 수 있습니다';
  END IF;
  PERFORM public.lm_set_assign_reason(CASE WHEN p_user_id IS NULL THEN 'reclaim' ELSE 'manual' END);
  UPDATE public.cases
  SET assigned_user_id = p_user_id
  WHERE org_id = v_org
    AND case_id = ANY (p_case_ids)
    AND assigned_user_id IS DISTINCT FROM p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 5-2. 나눠주기
--   p_mode: 'round_robin' 고른 상담원에게 차례대로 / 'balanced' 진행 중 리드가 적은 사람부터 / 'quantity' p_counts만큼씩
--   리드는 오래된 것부터. quantity 합계보다 리드가 많으면 남는 리드는 그대로(미배정이면 미배정)
CREATE OR REPLACE FUNCTION public.distribute_cases(p_case_ids TEXT[], p_mode TEXT, p_user_ids UUID[], p_counts INT[] DEFAULT NULL, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := public.current_org_id();
  s public.org_distribution_settings%ROWTYPE;
  v_ids TEXT[];
  v_n INT;
  v_users UUID[];
  v_counts INT[];
  v_open INT[];
  v_result JSONB := '{}'::jsonb;
  v_target UUID;
  i INT; k INT; best INT;
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN RAISE EXCEPTION '관리자만 나눠줄 수 있습니다'; END IF;
  IF p_mode NOT IN ('round_robin', 'balanced', 'quantity') THEN RAISE EXCEPTION '잘못된 방식'; END IF;
  IF COALESCE(array_length(p_user_ids, 1), 0) = 0 THEN RAISE EXCEPTION '나눠줄 상담원을 고르세요'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_user_ids) u(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = v_org AND m.user_id = u.id AND m.status = 'active')
  ) THEN RAISE EXCEPTION '같은 회사의 사용 중인 멤버에게만 나눠줄 수 있습니다'; END IF;
  IF p_mode = 'quantity' AND COALESCE(array_length(p_counts, 1), 0) <> array_length(p_user_ids, 1) THEN
    RAISE EXCEPTION '상담원마다 건수를 입력하세요';
  END IF;

  SELECT * INTO s FROM public.org_distribution_settings WHERE org_id = v_org;
  IF NOT FOUND THEN s.closed_statuses := ARRAY['진행불가','고객취소','사무장 접수','계약 완료','1차 입금완료','2차 입금완료','수신정지','휴지통']; END IF;

  SELECT array_agg(case_id ORDER BY created_at, case_id) INTO v_ids
  FROM public.cases WHERE org_id = v_org AND case_id = ANY (p_case_ids) AND deleted_at IS NULL;
  v_n := COALESCE(array_length(v_ids, 1), 0);
  IF v_n = 0 THEN RETURN v_result; END IF;

  v_users := p_user_ids;
  v_counts := array_fill(0, ARRAY[array_length(v_users, 1)]);
  IF p_mode = 'balanced' THEN
    SELECT array_agg((SELECT count(*)::int FROM public.cases c WHERE c.org_id = v_org AND c.assigned_user_id = u.id
                        AND c.deleted_at IS NULL AND NOT (COALESCE(c.status,'') = ANY (s.closed_statuses))
                        AND NOT (c.case_id = ANY (v_ids))) ORDER BY u.ord)
    INTO v_open FROM unnest(v_users) WITH ORDINALITY u(id, ord);
  END IF;

  PERFORM public.lm_set_assign_reason('distribute', p_note);
  k := 0;
  FOR i IN 1..v_n LOOP
    IF p_mode = 'round_robin' THEN
      k := ((i - 1) % array_length(v_users, 1)) + 1;
    ELSIF p_mode = 'balanced' THEN
      best := 1;
      FOR k IN 1..array_length(v_users, 1) LOOP
        IF v_open[k] < v_open[best] THEN best := k; END IF;
      END LOOP;
      k := best;
      v_open[k] := v_open[k] + 1;
    ELSE -- quantity: 앞사람부터 정한 건수만큼
      k := NULL;
      FOR best IN 1..array_length(v_users, 1) LOOP
        IF v_counts[best] < GREATEST(COALESCE(p_counts[best], 0), 0) THEN k := best; EXIT; END IF;
      END LOOP;
      EXIT WHEN k IS NULL;
    END IF;
    v_target := v_users[k];
    UPDATE public.cases SET assigned_user_id = v_target
    WHERE org_id = v_org AND case_id = v_ids[i] AND assigned_user_id IS DISTINCT FROM v_target;
    v_counts[k] := v_counts[k] + 1;
  END LOOP;

  FOR k IN 1..array_length(v_users, 1) LOOP
    v_result := v_result || jsonb_build_object(v_users[k]::text, v_counts[k]);
    IF v_counts[k] > 0 THEN
      INSERT INTO public.org_agent_distribution AS d (org_id, user_id, last_assigned_at)
      VALUES (v_org, v_users[k], now())
      ON CONFLICT (org_id, user_id) DO UPDATE SET last_assigned_at = now();
    END IF;
  END LOOP;
  RETURN v_result;
END;
$$;

-- 5-3. 담당 변경(이관): p_from의 리드를 p_to에게 (p_to NULL = 회수)
--   p_scope 'open' 진행 중인 리드만 / 'all' 전부, p_case_ids가 있으면 그 중에서만
CREATE OR REPLACE FUNCTION public.transfer_cases(p_from UUID, p_to UUID, p_scope TEXT DEFAULT 'open', p_case_ids TEXT[] DEFAULT NULL, p_note TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := public.current_org_id();
  s public.org_distribution_settings%ROWTYPE;
  v_count INTEGER;
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN RAISE EXCEPTION '관리자만 담당을 바꿀 수 있습니다'; END IF;
  IF p_from IS NULL THEN RAISE EXCEPTION '누구의 리드를 옮길지 고르세요'; END IF;
  IF p_to IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = v_org AND user_id = p_to AND status = 'active') THEN
    RAISE EXCEPTION '같은 회사의 사용 중인 멤버에게만 옮길 수 있습니다';
  END IF;
  IF p_scope NOT IN ('open', 'all') THEN RAISE EXCEPTION '잘못된 범위'; END IF;
  SELECT * INTO s FROM public.org_distribution_settings WHERE org_id = v_org;
  IF NOT FOUND THEN s.closed_statuses := ARRAY['진행불가','고객취소','사무장 접수','계약 완료','1차 입금완료','2차 입금완료','수신정지','휴지통']; END IF;

  PERFORM public.lm_set_assign_reason(CASE WHEN p_to IS NULL THEN 'reclaim' ELSE 'transfer' END, p_note);
  UPDATE public.cases
  SET assigned_user_id = p_to
  WHERE org_id = v_org
    AND assigned_user_id = p_from
    AND deleted_at IS NULL
    AND (p_case_ids IS NULL OR case_id = ANY (p_case_ids))
    AND (p_scope = 'all' OR NOT (COALESCE(status, '') = ANY (s.closed_statuses)));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 5-4. 상담원별 현황 (오늘 배정, 진행 중, 전체, 받기 설정)
CREATE OR REPLACE FUNCTION public.get_distribution_overview()
RETURNS TABLE (
  user_id UUID, display_name TEXT, email TEXT, role TEXT, status TEXT,
  receiving BOOLEAN, weight INT, daily_cap INT, last_assigned_at TIMESTAMPTZ,
  today_assigned BIGINT, open_cases BIGINT, total_cases BIGINT, untouched_cases BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := public.current_org_id();
  s public.org_distribution_settings%ROWTYPE;
  v_today TIMESTAMPTZ := (date_trunc('day', now() AT TIME ZONE 'Asia/Seoul')) AT TIME ZONE 'Asia/Seoul';
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN RAISE EXCEPTION '관리자만 볼 수 있습니다'; END IF;
  SELECT * INTO s FROM public.org_distribution_settings WHERE org_id = v_org;
  IF NOT FOUND THEN
    s.closed_statuses := ARRAY['진행불가','고객취소','사무장 접수','계약 완료','1차 입금완료','2차 입금완료','수신정지','휴지통'];
    s.reclaim_statuses := ARRAY['신규접수'];
  END IF;
  RETURN QUERY
  SELECT m.user_id,
         COALESCE(NULLIF(m.display_name, ''), split_part(u.email::text, '@', 1)),
         u.email::text, m.role, m.status,
         COALESCE(d.receiving, true), COALESCE(d.weight, 1), d.daily_cap, d.last_assigned_at,
         (SELECT count(*) FROM public.cases c WHERE c.org_id = v_org AND c.assigned_user_id = m.user_id AND c.assigned_at >= v_today),
         (SELECT count(*) FROM public.cases c WHERE c.org_id = v_org AND c.assigned_user_id = m.user_id AND c.deleted_at IS NULL
            AND NOT (COALESCE(c.status, '') = ANY (s.closed_statuses))),
         (SELECT count(*) FROM public.cases c WHERE c.org_id = v_org AND c.assigned_user_id = m.user_id AND COALESCE(c.status, '') <> '휴지통'),
         (SELECT count(*) FROM public.cases c WHERE c.org_id = v_org AND c.assigned_user_id = m.user_id AND c.deleted_at IS NULL
            AND COALESCE(c.status, '') = ANY (s.reclaim_statuses))
  FROM public.org_members m
  JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN public.org_agent_distribution d ON d.org_id = m.org_id AND d.user_id = m.user_id
  WHERE m.org_id = v_org
  ORDER BY CASE m.role WHEN 'agent' THEN 0 ELSE 1 END, m.status, 2;
END;
$$;

-- 5-5. 업로드 전 중복 확인: 회사 전체에서 이미 있는 번호 (숫자만 비교)
CREATE OR REPLACE FUNCTION public.find_existing_phones(p_phones TEXT[])
RETURNS TABLE (phone TEXT, case_id TEXT, customer_name TEXT, status TEXT, assigned_user_id UUID, created_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_org UUID := public.current_org_id();
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN RAISE EXCEPTION '관리자만 확인할 수 있습니다'; END IF;
  RETURN QUERY
  SELECT DISTINCT ON (d.p) d.p, c.case_id, c.customer_name, c.status, c.assigned_user_id, c.created_at
  FROM (SELECT DISTINCT regexp_replace(x, '[^0-9]', '', 'g') AS p FROM unnest(p_phones) x) d
  JOIN public.cases c ON c.org_id = v_org
     AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = d.p
     AND COALESCE(c.status, '') <> '휴지통'
  WHERE length(d.p) >= 9
  ORDER BY d.p, c.created_at DESC;
END;
$$;

-- ---------------------------------------------
-- 6. 자동 회수 (pg_cron 10분마다) + 사용 중지 시 회수
-- ---------------------------------------------
-- "손대지 않은 리드" = 배정 후 N분 지났고, 상태가 회수 대상 상태(기본 신규접수) 그대로이고,
--                     배정 이후 그 번호로 통화·문자 기록이 하나도 없는 리드
CREATE OR REPLACE FUNCTION public.run_auto_reclaim(p_limit INT DEFAULT 500)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  c RECORD;
  v_to UUID;
  v_total INT := 0;
BEGIN
  FOR s IN SELECT ds.org_id, ds.reclaim_after_minutes, ds.reclaim_statuses, ds.reclaim_action
           FROM public.org_distribution_settings ds
           JOIN public.organizations o ON o.id = ds.org_id AND o.status = 'active'
           WHERE ds.auto_reclaim LOOP
    FOR c IN
      SELECT x.case_id, x.assigned_user_id
      FROM public.cases x
      WHERE x.org_id = s.org_id
        AND x.assigned_user_id IS NOT NULL
        AND x.assigned_at IS NOT NULL
        AND x.assigned_at < now() - make_interval(mins => s.reclaim_after_minutes)
        AND x.deleted_at IS NULL
        AND COALESCE(x.status, '') = ANY (s.reclaim_statuses)
        AND NOT EXISTS (
          SELECT 1 FROM public.communication_logs l
          WHERE l.org_id = x.org_id
            AND l.phone_number = regexp_replace(COALESCE(x.phone, ''), '[^0-9]', '', 'g')
            AND l.timestamp >= x.assigned_at
        )
      ORDER BY x.assigned_at
      LIMIT p_limit
    LOOP
      v_to := NULL;
      IF s.reclaim_action = 'reassign' THEN
        v_to := public.lm_pick_agent(s.org_id, c.assigned_user_id);
      END IF;
      PERFORM public.lm_set_assign_reason('auto_reclaim', format('%s분 동안 연락 기록 없음', s.reclaim_after_minutes));
      UPDATE public.cases SET assigned_user_id = v_to WHERE org_id = s.org_id AND case_id = c.case_id;
      v_total := v_total + 1;
    END LOOP;
  END LOOP;
  PERFORM public.lm_set_assign_reason(NULL, NULL);
  RETURN v_total;
END;
$$;
REVOKE ALL ON FUNCTION public.run_auto_reclaim(INT) FROM PUBLIC, anon, authenticated;

-- 사용 중지하면 그 사람의 진행 중 리드를 회수 (설정 reclaim_on_disable, 기본 켜짐)
CREATE OR REPLACE FUNCTION public.org_members_reclaim_on_disable()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s public.org_distribution_settings%ROWTYPE;
BEGIN
  IF NEW.status = 'disabled' AND OLD.status = 'active' THEN
    SELECT * INTO s FROM public.org_distribution_settings WHERE org_id = NEW.org_id;
    IF NOT FOUND THEN
      s.reclaim_on_disable := true;
      s.closed_statuses := ARRAY['진행불가','고객취소','사무장 접수','계약 완료','1차 입금완료','2차 입금완료','수신정지','휴지통'];
    END IF;
    IF s.reclaim_on_disable THEN
      PERFORM public.lm_set_assign_reason('disable', '사용 중지로 회수');
      UPDATE public.cases SET assigned_user_id = NULL
      WHERE org_id = NEW.org_id AND assigned_user_id = NEW.user_id AND deleted_at IS NULL
        AND NOT (COALESCE(status, '') = ANY (s.closed_statuses));
      PERFORM public.lm_set_assign_reason(NULL, NULL);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS org_members_reclaim_on_disable ON public.org_members;
CREATE TRIGGER org_members_reclaim_on_disable
  AFTER UPDATE OF status ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.org_members_reclaim_on_disable();

REVOKE ALL ON FUNCTION public.distribute_cases(TEXT[], TEXT, UUID[], INT[], TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_cases(UUID, UUID, TEXT, TEXT[], TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_distribution_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_existing_phones(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.distribute_cases(TEXT[], TEXT, UUID[], INT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_cases(UUID, UUID, TEXT, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distribution_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_existing_phones(TEXT[]) TO authenticated;

COMMIT;

-- 자동 회수 예약 (pg_cron). 확장이 없으면 대시보드 Database → Extensions에서 pg_cron을 켠 뒤 실행:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   SELECT cron.schedule('lm-auto-reclaim', '*/10 * * * *', 'SELECT public.run_auto_reclaim()');

-- [ROLLBACK]
-- BEGIN;
-- SELECT cron.unschedule('lm-auto-reclaim');  -- 예약했다면
-- DROP TRIGGER IF EXISTS org_members_reclaim_on_disable ON public.org_members;
-- DROP TRIGGER IF EXISTS cases_log_assignment_ins ON public.cases;
-- DROP TRIGGER IF EXISTS cases_log_assignment_upd ON public.cases;
-- DROP TRIGGER IF EXISTS cases_assignee_changed_at ON public.cases;
-- DROP FUNCTION IF EXISTS public.org_members_reclaim_on_disable();
-- DROP FUNCTION IF EXISTS public.run_auto_reclaim(INT);
-- DROP FUNCTION IF EXISTS public.find_existing_phones(TEXT[]);
-- DROP FUNCTION IF EXISTS public.get_distribution_overview();
-- DROP FUNCTION IF EXISTS public.transfer_cases(UUID, UUID, TEXT, TEXT[], TEXT);
-- DROP FUNCTION IF EXISTS public.distribute_cases(TEXT[], TEXT, UUID[], INT[], TEXT);
-- DROP FUNCTION IF EXISTS public.cases_log_assignment();
-- DROP FUNCTION IF EXISTS public.cases_assignee_changed_at();
-- -- cases_default_assignee는 004 버전으로 되돌린다 (상담원 등록분 = 본인)
-- CREATE OR REPLACE FUNCTION public.cases_default_assignee() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
-- BEGIN IF NEW.assigned_user_id IS NULL AND auth.uid() IS NOT NULL AND public.current_org_role() = 'agent' THEN NEW.assigned_user_id := auth.uid(); END IF; RETURN NEW; END; $f$;
-- (assign_cases는 007 버전 그대로 동작함, 사유 기록만 빠짐)
-- DROP FUNCTION IF EXISTS public.lm_set_assign_reason(TEXT, TEXT);
-- DROP FUNCTION IF EXISTS public.lm_pick_agent(UUID, UUID);
-- ALTER TABLE public.cases DROP COLUMN IF EXISTS import_batch_id;
-- ALTER TABLE public.cases DROP COLUMN IF EXISTS assigned_at;
-- DROP TABLE IF EXISTS public.case_assignment_logs;
-- DROP TABLE IF EXISTS public.lead_import_batches;
-- DROP TABLE IF EXISTS public.org_agent_distribution;
-- DROP TABLE IF EXISTS public.org_distribution_settings;
-- COMMIT;
