-- =============================================
-- Migration: 045_enforce_recording_bitrate
-- 작성일자: 2026-11-17
-- 선행: 044_call_recordings_supabase_and_retention
-- 목적:
--   1) call-recordings 버킷 허용 MIME을 고효율 AAC/M4A 포맷으로 한정 (WAV 등 비압축 유입 원천 차단)
--   2) call_recordings 테이블에 실시간 비트레이트(bitrate_kbps) 컬럼 추가
--   3) 32kbps 표준 압축 인코딩 검증 및 48kbps 초과 감지 트리거 탑재
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. storage.buckets 허용 MIME을 m4a/aac 전용으로 최적화
-- ---------------------------------------------
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac'
]
WHERE id = 'call-recordings';

-- ---------------------------------------------
-- 2. call_recordings 테이블 비트레이트 모니터링 컬럼 추가
-- ---------------------------------------------
ALTER TABLE public.call_recordings
  ADD COLUMN IF NOT EXISTS bitrate_kbps NUMERIC(6, 1);

-- 기존 데이터 비트레이트 백필 계산
UPDATE public.call_recordings
SET bitrate_kbps = ROUND((size_bytes * 8.0) / (duration_sec * 1000.0), 1)
WHERE duration_sec > 0 AND size_bytes > 0 AND bitrate_kbps IS NULL;

-- ---------------------------------------------
-- 3. 32kbps 표준 압축 검증 및 비트레이트 자동 기록 트리거
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.check_recording_bitrate()
RETURNS TRIGGER AS $$
DECLARE
  v_kbps NUMERIC(6, 1);
BEGIN
  IF NEW.duration_sec > 0 AND NEW.size_bytes > 0 THEN
    v_kbps := ROUND((NEW.size_bytes * 8.0) / (NEW.duration_sec * 1000.0), 1);
    NEW.bitrate_kbps := v_kbps;

    -- 48 kbps를 초과하는 비압축 또는 고용량 파일 감지 시 경고 기록
    IF v_kbps > 48.0 AND NEW.error IS NULL THEN
      NEW.error := '비압축 녹음 감지 (' || v_kbps || ' kbps) - 32kbps AAC 모노 권장';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_recording_bitrate ON public.call_recordings;
CREATE TRIGGER trg_check_recording_bitrate
  BEFORE INSERT OR UPDATE OF size_bytes, duration_sec ON public.call_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_recording_bitrate();

COMMIT;
