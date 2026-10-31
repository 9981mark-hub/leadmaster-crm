-- =============================================
-- Migration: 016_ai_usage
-- 작성: 2026-11-01
-- 선행: 004 (organizations, current_org_id, is_org_admin, is_platform_admin)
-- 목적: 브라우저가 직접 부르던 Gemini·Cloud Vision을 서버(Edge Function ai-proxy)로 옮기면서
--   1) 회사별 AI 호출 기록 ai_usage_logs — 함수가 service_role로만 쓴다 (화면에서 쓰기 불가)
--   2) 회사별 하루 상한 org_ai_settings.daily_cap — 행이 없으면 300 (비용 보호)
--   3) 관리자 화면용 사용량 get_ai_usage()
--   4) 함수 전용 ai_usage_begin(): 하루 상한 확인 + 기록을 한 번에 (회사별 잠금 → 동시에 눌러도 상한을 넘지 않음)
-- "하루" = 한국 시간(Asia/Seoul) 0시 기준.
-- AI 비용은 플랫폼(본사) 키로 나가므로 상한은 고객사 관리자가 바꿀 수 없다 (SQL/service_role로만 변경).
-- 기존 데이터를 바꾸거나 지우지 않는다. 여러 번 실행해도 결과가 같다. 되돌리기: 맨 아래 [ROLLBACK]
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. 회사별 AI 설정 (하루 상한)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_ai_settings (
  org_id      UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  daily_cap   INT NOT NULL DEFAULT 300 CHECK (daily_cap BETWEEN 0 AND 100000),  -- 0 = 이 회사는 AI 사용 안 함
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.org_ai_settings ENABLE ROW LEVEL SECURITY;
-- 보기: 그 회사 관리자 + 플랫폼 관리자. 바꾸기: 정책 없음 → 화면(anon/authenticated)에서는 불가
DROP POLICY IF EXISTS org_ai_settings_select ON public.org_ai_settings;
CREATE POLICY org_ai_settings_select ON public.org_ai_settings
  FOR SELECT TO authenticated
  USING (
    (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
    OR (SELECT public.is_platform_admin())
  );
REVOKE ALL ON public.org_ai_settings FROM anon, authenticated;
GRANT SELECT ON public.org_ai_settings TO authenticated;
GRANT ALL ON public.org_ai_settings TO service_role;

-- ---------------------------------------------
-- 2. AI 호출 기록 (함수가 호출마다 1줄: 모델 부르기 전에 넣고, 끝나면 결과를 고친다)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  task           TEXT NOT NULL,                 -- case_summary / image_extract / import_ocr / receipt_text
  model          TEXT,                          -- 실제로 답한(또는 마지막으로 시도한) 모델
  input_tokens   INT,
  output_tokens  INT,                           -- 생각(thinking) 토큰 포함
  bytes_in       BIGINT NOT NULL DEFAULT 0,     -- 보낸 파일 크기 합 (바이트)
  ok             BOOLEAN,                       -- NULL = 처리 중 (또는 응답 전에 끊김)
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_logs_org_created_idx ON public.ai_usage_logs (org_id, created_at DESC);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
-- 보기: 그 회사 관리자(자기 회사 것만) + 플랫폼 관리자. 상담원·모르는 계정은 0건
DROP POLICY IF EXISTS ai_usage_logs_select ON public.ai_usage_logs;
CREATE POLICY ai_usage_logs_select ON public.ai_usage_logs
  FOR SELECT TO authenticated
  USING (
    (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
    OR (SELECT public.is_platform_admin())
  );
-- 쓰기(INSERT/UPDATE/DELETE)는 함수(service_role)만
REVOKE ALL ON public.ai_usage_logs FROM anon, authenticated;
GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;

-- ---------------------------------------------
-- 3. 관리자용 사용량 (오늘 건수·상한, 이번 달 건수·토큰) — 한국 시간 기준
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ai_usage()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org   UUID := public.current_org_id();
  v_day   TIMESTAMPTZ := date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul';
  v_month TIMESTAMPTZ := date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul';
  v_cap   INT;
  r       JSONB;
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN
    RAISE EXCEPTION '관리자만 볼 수 있습니다' USING ERRCODE = '42501';
  END IF;
  SELECT s.daily_cap INTO v_cap FROM public.org_ai_settings s WHERE s.org_id = v_org;
  SELECT jsonb_build_object(
    'today', count(*) FILTER (WHERE l.created_at >= v_day),
    'cap', COALESCE(v_cap, 300),
    'month', count(*),
    'input_tokens_month', COALESCE(sum(l.input_tokens), 0),
    'output_tokens_month', COALESCE(sum(l.output_tokens), 0)
  ) INTO r
  FROM public.ai_usage_logs l
  WHERE l.org_id = v_org AND l.created_at >= v_month;   -- 이번 달 시작 <= 오늘 시작
  RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION public.get_ai_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_usage() TO authenticated;

-- ---------------------------------------------
-- 4. 함수 전용: 하루 상한 확인 + 기록 1줄 (service_role만 실행)
--    반환 { allowed, cap, used, id? } — allowed=false면 기록하지 않는다
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_usage_begin(p_org_id UUID, p_user_id UUID, p_task TEXT, p_bytes_in BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_day  TIMESTAMPTZ := date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul';
  v_cap  INT;
  v_used INT;
  v_id   UUID;
BEGIN
  IF p_org_id IS NULL OR COALESCE(btrim(p_task), '') = '' THEN
    RAISE EXCEPTION '회사와 작업이 필요합니다' USING ERRCODE = '22023';
  END IF;
  -- 같은 회사 요청끼리 줄 세우기 (트랜잭션이 끝나면 풀림)
  PERFORM pg_advisory_xact_lock(hashtextextended('lm_ai_usage:' || p_org_id::text, 0));
  SELECT s.daily_cap INTO v_cap FROM public.org_ai_settings s WHERE s.org_id = p_org_id;
  v_cap := COALESCE(v_cap, 300);
  SELECT count(*)::int INTO v_used FROM public.ai_usage_logs l
  WHERE l.org_id = p_org_id AND l.created_at >= v_day;
  IF v_used >= v_cap THEN
    RETURN jsonb_build_object('allowed', false, 'cap', v_cap, 'used', v_used);
  END IF;
  INSERT INTO public.ai_usage_logs (org_id, user_id, task, bytes_in)
  VALUES (p_org_id, p_user_id, left(btrim(p_task), 40), GREATEST(COALESCE(p_bytes_in, 0), 0))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('allowed', true, 'cap', v_cap, 'used', v_used + 1, 'id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.ai_usage_begin(UUID, UUID, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_usage_begin(UUID, UUID, TEXT, BIGINT) TO service_role;

COMMIT;

-- =============================================
-- [상한 바꾸기] (SQL 편집기, 플랫폼 관리자)
--   INSERT INTO public.org_ai_settings (org_id, daily_cap) VALUES ('<회사 id>', 500)
--   ON CONFLICT (org_id) DO UPDATE SET daily_cap = EXCLUDED.daily_cap, updated_at = now();
-- =============================================
-- [ROLLBACK] (필요할 때만)
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.ai_usage_begin(UUID, UUID, TEXT, BIGINT);
-- DROP FUNCTION IF EXISTS public.get_ai_usage();
-- DROP TABLE IF EXISTS public.ai_usage_logs;
-- DROP TABLE IF EXISTS public.org_ai_settings;
-- COMMIT;
-- =============================================
