-- =============================================
-- Migration: 050_recording_6m_grace_purge
-- 작성일자: 2026-11-27
-- 선행: 044_call_recordings_supabase_and_retention
-- 목적:
--   1) 통화 녹음 데이터 보존 기간을 6개월(180일)로 고정
--   2) 만료 30일 전(5개월차)부터 TM대표/총괄관리자에게 백업 알림 대상 조회 지원
--   3) 6개월 만료 후 3주(21일) 유예 기간 경과 시 자동 삭제 대상 조회 RPC 추가
-- =============================================

BEGIN;

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

-- 3. 6개월 만료 + 3주(21일) 유예 기간 경과 후 영구 삭제 대상 조회 RPC (Edge Function / Cron 전용)
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
