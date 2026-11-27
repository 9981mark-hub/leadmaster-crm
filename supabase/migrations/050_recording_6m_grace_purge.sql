-- =============================================
-- Migration: 050_recording_6m_grace_purge
-- 작성일자: 2026-11-27
-- 목적:
--   1) 044 선행 컬럼(expires_at 등) 및 RPC 함수가 미적용된 환경에서도 1회 실행으로 안전하게 보장
--   2) 통화 녹음 데이터 보존 기간을 6개월(180일)로 고정
--   3) 만료 30일 전(5개월차)부터 TM대표/총괄관리자에게 백업 알림 대상 조회 지원
--   4) 6개월 만료 후 3주(21일) 유예 기간 경과 시 자동 삭제 대상 조회 RPC 추가
-- =============================================

BEGIN;

-- 0. call_recordings 만료/다운로드 추적 컬럼 보장 (044 미적용 환경 대비)
ALTER TABLE public.call_recordings
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS download_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_downloaded_by UUID REFERENCES auth.users(id);

-- 1. 회사별 기본 보존 기간을 180일(6개월)로 고정
ALTER TABLE public.org_recording_settings
  ALTER COLUMN retention_days SET DEFAULT 180;

UPDATE public.org_recording_settings
SET retention_days = 180,
    updated_at = now()
WHERE retention_days IS DISTINCT FROM 180;

-- 기존 미삭제 녹음의 만료일을 6개월(180일) 기준으로 정렬
UPDATE public.call_recordings
SET expires_at = call_started_at + INTERVAL '180 days'
WHERE audio_deleted_at IS NULL
  AND (expires_at IS NULL OR expires_at > call_started_at + INTERVAL '180 days');

CREATE INDEX IF NOT EXISTS idx_call_rec_expires_at
  ON public.call_recordings(org_id, expires_at)
  WHERE audio_deleted_at IS NULL;

-- 2. 신규 녹음 만료일(expires_at) 자동 설정 트리거: 6개월(180일) 고정
CREATE OR REPLACE FUNCTION public.set_recording_expiration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NEW.call_started_at + INTERVAL '180 days';
  END IF;

  IF NEW.storage_kind IS NULL THEN
    NEW.storage_kind := 'supabase';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_recording_expiration ON public.call_recordings;
CREATE TRIGGER trg_set_recording_expiration
  BEFORE INSERT ON public.call_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_recording_expiration();

-- 3. D-30 만료 사전 알림 및 백업 센터 조회 RPC 보장
CREATE OR REPLACE FUNCTION public.get_expiring_recordings(
  p_org_id UUID,
  p_days_threshold INT DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  case_id TEXT,
  phone TEXT,
  call_started_at TIMESTAMPTZ,
  duration_sec INT,
  size_bytes BIGINT,
  storage_path TEXT,
  file_name TEXT,
  expires_at TIMESTAMPTZ,
  days_left INT,
  summary TEXT,
  download_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.case_id,
    r.phone,
    r.call_started_at,
    r.duration_sec,
    r.size_bytes,
    r.storage_path,
    r.file_name,
    r.expires_at,
    EXTRACT(DAY FROM (r.expires_at - now()))::INT AS days_left,
    r.summary,
    COALESCE(r.download_count, 0)
  FROM public.call_recordings r
  WHERE r.org_id = p_org_id
    AND r.audio_deleted_at IS NULL
    AND r.expires_at IS NOT NULL
    AND r.expires_at <= (now() + (p_days_threshold || ' days')::INTERVAL)
  ORDER BY r.expires_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.get_expiring_recordings(UUID, INT) TO authenticated;

-- 4. 다운로드 이력 기록 및 만료 삭제 마킹 RPC 보장
CREATE OR REPLACE FUNCTION public.record_recording_download(
  p_recording_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.call_recordings
  SET
    download_count = COALESCE(download_count, 0) + 1,
    last_downloaded_at = now(),
    last_downloaded_by = auth.uid()
  WHERE id = p_recording_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.record_recording_download(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_expired_recordings_purged(
  p_recording_ids UUID[]
)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.call_recordings
  SET audio_deleted_at = now()
  WHERE id = ANY(p_recording_ids)
    AND audio_deleted_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.mark_expired_recordings_purged(UUID[]) TO authenticated;

-- 5. 6개월 만료 + 3주(21일) 유예 기간 경과 후 영구 삭제 대상 조회 RPC (Edge Function / Cron 전용)
CREATE OR REPLACE FUNCTION public.get_recordings_to_purge(
  p_limit INT DEFAULT 200
)
RETURNS TABLE (
  id UUID,
  org_id UUID,
  storage_path TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.org_id,
    r.storage_path
  FROM public.call_recordings r
  WHERE r.audio_deleted_at IS NULL
    AND r.storage_kind = 'supabase'
    AND r.storage_path IS NOT NULL
    AND r.expires_at IS NOT NULL
    AND r.expires_at + INTERVAL '21 days' <= now()
  ORDER BY r.expires_at ASC
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.get_recordings_to_purge(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recordings_to_purge(INT) TO service_role;

COMMIT;
