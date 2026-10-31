-- =============================================
-- Migration: 014_call_recordings
-- 작성: 2026-11-01
-- 선행: 004 (current_org_id, is_org_admin, can_access_case)
-- 목적: 통화 녹음 자동 업로드 + AI 채무 정리
--   1) 앱이 통화가 끝나면 폰의 통화 녹음 파일(삼성 전화 Recordings/Call, T전화 Recordings/TPhoneCallRecords 등)을 찾아
--      리드 번호와 맞는 통화만 비공개 저장소(call-recordings)에 올리고 call_recordings에 기록
--   2) Edge Function recording-analyze가 Gemini로 요약·대화록·채무 정보(JSON)를 만들어 저장
--   3) 웹 리드 상세에서 듣기·AI 정리 보기·상담 정보에 반영
-- 회사별 설정(org_recording_settings) 기본값은 모두 "꺼짐" → 적용해도 지금 동작은 바뀌지 않는다.
-- 저장 경로: call-recordings/{org_id}/{case_id}/{파일 이름}
-- 데이터를 지우지 않는다. 되돌리기: 맨 아래 [ROLLBACK]
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. 회사별 설정
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_recording_settings (
  org_id              UUID PRIMARY KEY DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  auto_upload         BOOLEAN NOT NULL DEFAULT false,   -- 앱이 리드 통화 녹음을 자동으로 올림
  auto_analyze        BOOLEAN NOT NULL DEFAULT false,   -- 올리면 바로 AI 정리
  min_duration_sec    INT NOT NULL DEFAULT 40 CHECK (min_duration_sec BETWEEN 0 AND 3600),  -- 이보다 짧은 통화는 안 올림
  retention_days      INT NOT NULL DEFAULT 30 CHECK (retention_days BETWEEN 1 AND 3650),    -- 녹음 파일 보관 기간 (AI 정리 결과는 남김)
  daily_analyze_cap   INT NOT NULL DEFAULT 300 CHECK (daily_analyze_cap BETWEEN 0 AND 100000), -- 하루 AI 정리 상한 (비용 보호)
  wifi_only           BOOLEAN NOT NULL DEFAULT false,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID DEFAULT auth.uid()
);
ALTER TABLE public.org_recording_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_recording_settings_admin ON public.org_recording_settings;
CREATE POLICY org_recording_settings_admin ON public.org_recording_settings
  FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());
GRANT SELECT, INSERT, UPDATE ON public.org_recording_settings TO authenticated;

-- ---------------------------------------------
-- 2. 녹음 기록
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.call_recordings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id           TEXT NOT NULL,
  phone             TEXT NOT NULL,                  -- 숫자만
  user_id           UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,  -- 올린 사람(통화한 상담원)
  direction         TEXT CHECK (direction IN ('CALL_IN', 'CALL_OUT')),
  call_started_at   TIMESTAMPTZ NOT NULL,
  duration_sec      INT NOT NULL DEFAULT 0,
  storage_path      TEXT NOT NULL,                  -- {org_id}/{case_id}/{파일}
  file_name         TEXT,                           -- 폰에 있던 파일 이름 (번호 포함될 수 있음, 화면에는 안 보임)
  size_bytes        BIGINT NOT NULL DEFAULT 0,
  mime_type         TEXT NOT NULL DEFAULT 'audio/mp4',
  source_app        TEXT,                           -- com.skt.prod.dialer / com.samsung.android.dialer …
  status            TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'queued', 'processing', 'done', 'failed', 'skipped')),
  error             TEXT,
  summary           TEXT,                           -- AI 상담 요약 (하이픈 목록)
  transcript        JSONB,                          -- [{t:"MM:SS", speaker:"상담원|고객", text}]
  extracted         JSONB,                          -- 채무·소득·주거·재산·가족 (만원 단위)
  model             TEXT,
  tokens_in         INT,
  tokens_out        INT,
  analyzed_at       TIMESTAMPTZ,
  applied_at        TIMESTAMPTZ,                    -- 상담 정보에 반영한 시각
  applied_by        UUID,
  audio_deleted_at  TIMESTAMPTZ,                    -- 보관 기간이 지나 파일만 지운 시각
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, storage_path)
);
CREATE INDEX IF NOT EXISTS call_recordings_case_idx ON public.call_recordings (org_id, case_id, call_started_at DESC);
CREATE INDEX IF NOT EXISTS call_recordings_org_created_idx ON public.call_recordings (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS call_recordings_analyzed_idx ON public.call_recordings (org_id, analyzed_at) WHERE analyzed_at IS NOT NULL;

ALTER TABLE public.call_recordings ENABLE ROW LEVEL SECURITY;
-- 보기: 관리자 = 회사 전체, 상담원 = 본인이 올린 것 + 본인 배정 리드
DROP POLICY IF EXISTS call_recordings_select ON public.call_recordings;
CREATE POLICY call_recordings_select ON public.call_recordings
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND (user_id = auth.uid() OR public.can_access_case(case_id)));
-- 올리기: 본인 이름으로, 볼 수 있는 리드에만, 경로는 자기 회사/그 리드 아래
DROP POLICY IF EXISTS call_recordings_insert ON public.call_recordings;
CREATE POLICY call_recordings_insert ON public.call_recordings
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND user_id = auth.uid()
    AND public.can_access_case(case_id)
    AND storage_path LIKE (org_id::text || '/' || case_id || '/%')
    AND status IN ('uploaded', 'queued')
    AND summary IS NULL AND transcript IS NULL AND extracted IS NULL
  );
-- 고치기·지우기는 함수(서버)만. 반영 표시는 mark_recording_applied()
GRANT SELECT, INSERT ON public.call_recordings TO authenticated;

CREATE OR REPLACE FUNCTION public.call_recordings_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS call_recordings_touch ON public.call_recordings;
CREATE TRIGGER call_recordings_touch BEFORE UPDATE ON public.call_recordings
  FOR EACH ROW EXECUTE FUNCTION public.call_recordings_touch();

-- ---------------------------------------------
-- 3. 비공개 저장소 + 접근 규칙
-- ---------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('call-recordings', 'call-recordings', false, 52428800,
        ARRAY['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/amr', 'audio/3gpp', 'audio/ogg', 'audio/opus', 'audio/wav', 'audio/x-wav', 'audio/webm'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 경로 첫 칸 = 내 회사, 둘째 칸 = 내가 볼 수 있는 리드
DROP POLICY IF EXISTS lm_call_rec_insert ON storage.objects;
CREATE POLICY lm_call_rec_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'call-recordings'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
    AND public.can_access_case((storage.foldername(name))[2])
  );
DROP POLICY IF EXISTS lm_call_rec_select ON storage.objects;
CREATE POLICY lm_call_rec_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'call-recordings'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
    AND (public.can_access_case((storage.foldername(name))[2]) OR owner = auth.uid())
  );

-- ---------------------------------------------
-- 4. 함수
-- ---------------------------------------------
-- 앱용: 내 회사 녹음 설정 (상담원도 읽을 수 있게 필요한 값만)
CREATE OR REPLACE FUNCTION public.get_recording_config()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN public.current_org_id() IS NULL THEN NULL ELSE jsonb_build_object(
    'org_id', public.current_org_id(),
    'user_id', auth.uid(),
    'role', public.current_org_role(),
    'auto_upload', COALESCE(s.auto_upload, false),
    'auto_analyze', COALESCE(s.auto_analyze, false),
    'min_duration_sec', COALESCE(s.min_duration_sec, 40),
    'wifi_only', COALESCE(s.wifi_only, false),
    'max_file_bytes', 52428800
  ) END
  FROM (SELECT 1) one
  LEFT JOIN public.org_recording_settings s ON s.org_id = public.current_org_id()
$$;
REVOKE ALL ON FUNCTION public.get_recording_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recording_config() TO authenticated;

-- 관리자용: 사용량 (보관 중 파일 수·용량, 오늘·이번 달 AI 정리 건수, 토큰)
CREATE OR REPLACE FUNCTION public.get_recording_usage()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_org UUID := public.current_org_id(); r JSONB;
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN RAISE EXCEPTION '관리자만 볼 수 있습니다'; END IF;
  SELECT jsonb_build_object(
    'files', count(*) FILTER (WHERE audio_deleted_at IS NULL),
    'bytes', COALESCE(sum(size_bytes) FILTER (WHERE audio_deleted_at IS NULL), 0),
    'total', count(*),
    'analyzed_today', count(*) FILTER (WHERE analyzed_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'),
    'analyzed_month', count(*) FILTER (WHERE analyzed_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'),
    'tokens_in_month', COALESCE(sum(tokens_in) FILTER (WHERE analyzed_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'), 0),
    'tokens_out_month', COALESCE(sum(tokens_out) FILTER (WHERE analyzed_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'), 0),
    'failed_7d', count(*) FILTER (WHERE status = 'failed' AND created_at > now() - interval '7 days'),
    'uploaded_today', count(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')
  ) INTO r
  FROM public.call_recordings WHERE org_id = v_org;
  RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION public.get_recording_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recording_usage() TO authenticated;

-- 상담 정보에 반영했다고 표시 (볼 수 있는 녹음만)
CREATE OR REPLACE FUNCTION public.mark_recording_applied(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.call_recordings r SET applied_at = now(), applied_by = auth.uid()
  WHERE r.id = p_id AND r.org_id = public.current_org_id()
    AND (r.user_id = auth.uid() OR public.can_access_case(r.case_id));
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_recording_applied(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_recording_applied(UUID) TO authenticated;

COMMIT;

-- =============================================
-- [ROLLBACK] (필요할 때만, 저장소 파일은 먼저 Storage API로 지울 것)
-- BEGIN;
-- DROP POLICY IF EXISTS lm_call_rec_insert ON storage.objects;
-- DROP POLICY IF EXISTS lm_call_rec_select ON storage.objects;
-- DROP FUNCTION IF EXISTS public.mark_recording_applied(UUID);
-- DROP FUNCTION IF EXISTS public.get_recording_usage();
-- DROP FUNCTION IF EXISTS public.get_recording_config();
-- DROP TABLE IF EXISTS public.call_recordings;
-- DROP TABLE IF EXISTS public.org_recording_settings;
-- DROP FUNCTION IF EXISTS public.call_recordings_touch();
-- (버킷은 비어 있을 때만) DELETE FROM storage.buckets WHERE id = 'call-recordings';
-- COMMIT;
-- =============================================
