-- =============================================
-- Migration: 008_telegram_per_org
-- 작성: 2026-11-01
-- 선행: 004, 005, 007
-- 목적: 회사마다 자기 텔레그램 봇으로 변호사 사무실 방의 피드백을 받는다.
--   - org_telegram_bots: 회사별 봇 토큰·웹훅 비밀값·"우리 쪽 발신자 이름" 목록
--     (토큰은 클라이언트가 절대 읽을 수 없다: RLS 정책 없음, Edge Function(service_role)만 읽음)
--   - set_org_telegram_bot(): 관리자가 토큰 등록/교체 (쓰기 전용)
--   - get_org_telegram_status(): 연결 상태만 조회 (토큰 미노출)
--   - 본사(HQ)는 기존 환경변수(TELEGRAM_BOT_TOKEN/TELEGRAM_WEBHOOK_SECRET) 봇을 그대로 쓴다. 행이 없어도 됨.
-- 데이터를 지우지 않는다. 되돌리기: 맨 아래 [ROLLBACK]
-- =============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_telegram_bots (
  org_id            UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  bot_token         TEXT NOT NULL,
  bot_username      TEXT,
  webhook_secret    TEXT NOT NULL DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  own_sender_names  TEXT[] NOT NULL DEFAULT '{}',   -- 이 이름으로 보낸 메시지는 피드백으로 수집하지 않음 (우리 직원)
  webhook_set_at    TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.org_telegram_bots ENABLE ROW LEVEL SECURITY;
-- 정책을 만들지 않는다 → anon/authenticated는 읽기·쓰기 모두 불가. 아래 함수와 service_role만 접근.
REVOKE ALL ON public.org_telegram_bots FROM anon, authenticated;

-- 토큰 등록/교체 (관리자). 토큰이 바뀌면 웹훅 비밀값도 새로 만든다.
CREATE OR REPLACE FUNCTION public.set_org_telegram_bot(p_bot_token TEXT, p_own_sender_names TEXT[] DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := public.current_org_id();
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN RAISE EXCEPTION '관리자만 등록할 수 있습니다'; END IF;
  IF p_bot_token IS NOT NULL AND p_bot_token !~ '^[0-9]{5,}:[A-Za-z0-9_-]{20,}$' THEN
    RAISE EXCEPTION '봇 토큰 형식이 올바르지 않습니다 (BotFather가 준 123456:ABC... 형태)';
  END IF;

  INSERT INTO public.org_telegram_bots AS b (org_id, bot_token, own_sender_names)
  VALUES (v_org, p_bot_token, COALESCE(p_own_sender_names, '{}'))
  ON CONFLICT (org_id) DO UPDATE SET
    bot_token        = COALESCE(EXCLUDED.bot_token, b.bot_token),
    webhook_secret   = CASE WHEN EXCLUDED.bot_token IS DISTINCT FROM b.bot_token
                            THEN replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
                            ELSE b.webhook_secret END,
    webhook_set_at   = CASE WHEN EXCLUDED.bot_token IS DISTINCT FROM b.bot_token THEN NULL ELSE b.webhook_set_at END,
    bot_username     = CASE WHEN EXCLUDED.bot_token IS DISTINCT FROM b.bot_token THEN NULL ELSE b.bot_username END,
    own_sender_names = COALESCE(p_own_sender_names, b.own_sender_names),
    updated_at       = now();
  RETURN true;
END;
$$;

-- "우리 쪽 발신자 이름"만 바꾸기 (토큰 그대로)
CREATE OR REPLACE FUNCTION public.set_org_telegram_senders(p_own_sender_names TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := public.current_org_id();
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN RAISE EXCEPTION '관리자만 변경할 수 있습니다'; END IF;
  UPDATE public.org_telegram_bots SET own_sender_names = COALESCE(p_own_sender_names, '{}'), updated_at = now()
  WHERE org_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION '먼저 봇 토큰을 등록하세요'; END IF;
  RETURN true;
END;
$$;

-- 연결 상태 (토큰은 끝 4자리만)
CREATE OR REPLACE FUNCTION public.get_org_telegram_status()
RETURNS TABLE (has_bot BOOLEAN, bot_username TEXT, token_tail TEXT, own_sender_names TEXT[], webhook_set_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT true, b.bot_username, right(b.bot_token, 4), b.own_sender_names, b.webhook_set_at, b.updated_at
  FROM public.org_telegram_bots b
  WHERE b.org_id = public.current_org_id() AND public.is_org_admin()
  UNION ALL
  SELECT false, NULL, NULL, '{}'::text[], NULL, NULL
  WHERE public.is_org_admin()
    AND NOT EXISTS (SELECT 1 FROM public.org_telegram_bots b WHERE b.org_id = public.current_org_id())
$$;

REVOKE ALL ON FUNCTION public.set_org_telegram_bot(TEXT, TEXT[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_org_telegram_senders(TEXT[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_org_telegram_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_org_telegram_bot(TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_org_telegram_senders(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_telegram_status() TO authenticated;

COMMIT;

-- [ROLLBACK]
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.get_org_telegram_status();
-- DROP FUNCTION IF EXISTS public.set_org_telegram_senders(TEXT[]);
-- DROP FUNCTION IF EXISTS public.set_org_telegram_bot(TEXT, TEXT[]);
-- DROP TABLE IF EXISTS public.org_telegram_bots;
-- COMMIT;
