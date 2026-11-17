-- =============================================
-- Migration: 044_call_recordings_supabase_and_retention
-- 작성일자: 2026-11-17
-- 선행: 014, 018, 043
-- 목적:
--   1) 018_recordings_drive_only 제한 해제 및 Supabase Storage(call-recordings 버킷) 정식 복원
--   2) 단일 파일 크기 상한 100MB로 상향 (52428800 -> 104857600)
--   3) storage.objects INSERT/SELECT RLS 정책 복원 및 public.call_recordings INSERT 권한 복원
--   4) 1년(365일) 보관 주기 확립 및 만료일(expires_at), 다운로드 추적 컬럼 추가
--   5) 신규 녹음 등록 시 1년 만료일 자동 계산 트리거 추가
--   6) D-30 만료 사전 알림 및 백업 센터 조회를 위한 RPC 함수(get_expiring_recordings) 탑재
--   7) 녹음 다운로드 이력 추적 RPC 함수(record_recording_download) 탑재
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. storage.buckets 크기 제한 해제 및 버킷 설정 복원
-- ---------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'call-recordings',
  'call-recordings',
  false,
  104857600, -- 100 MB
  ARRAY[
    'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac',
    'audio/mpeg', 'audio/amr', 'audio/3gpp', 'audio/ogg',
    'audio/opus', 'audio/wav', 'audio/x-wav', 'audio/webm'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------
-- 2. storage.objects RLS 정책 복원 (멀티테넌트 격리)
-- ---------------------------------------------
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

DROP POLICY IF EXISTS lm_call_rec_delete ON storage.objects;
CREATE POLICY lm_call_rec_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'call-recordings'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
    AND public.is_org_admin()
  );

-- ---------------------------------------------
-- 3. call_recordings 테이블 권한 및 RLS 정책 복원
-- ---------------------------------------------
GRANT INSERT, SELECT, UPDATE ON public.call_recordings TO authenticated;

DROP POLICY IF EXISTS call_recordings_insert ON public.call_recordings;
CREATE POLICY call_recordings_insert ON public.call_recordings
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND public.can_access_case(case_id)
  );

-- ---------------------------------------------
-- 4. 1년 보관 주기 및 다운로드 관리 컬럼 확장
-- ---------------------------------------------
ALTER TABLE public.call_recordings
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS download_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_downloaded_by UUID REFERENCES auth.users(id);

-- 회사 설정 테이블 기본 보관일 365일 (1년)로 조정
ALTER TABLE public.org_recording_settings
  ALTER COLUMN retention_days SET DEFAULT 365;

-- 기존 레코드 중 expires_at이 null인 경우 등록일+365일로 초기화
UPDATE public.call_recordings
SET expires_at = call_started_at + INTERVAL '365 days'
WHERE expires_at IS NULL;

-- 고속 만료 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_call_rec_expires_at
  ON public.call_recordings(org_id, expires_at)
  WHERE audio_deleted_at IS NULL;

-- ---------------------------------------------
-- 5. 신규 녹음 만료일(expires_at) 자동 설정 트리거
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.set_recording_expiration()
RETURNS TRIGGER AS $$
DECLARE
  v_retention INT;
BEGIN
  IF NEW.expires_at IS NULL THEN
    SELECT COALESCE(retention_days, 365) INTO v_retention
    FROM public.org_recording_settings
    WHERE org_id = NEW.org_id;

    IF v_retention IS NULL THEN
      v_retention := 365;
    END IF;

    NEW.expires_at := NEW.call_started_at + (v_retention || ' days')::INTERVAL;
  END IF;

  -- 기본 저장소를 supabase로 설정
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

-- ---------------------------------------------
-- 6. D-30 만료 사전 알림 및 백업 센터 조회 RPC
-- ---------------------------------------------
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

-- ---------------------------------------------
-- 7. 다운로드 이력 기록 RPC
-- ---------------------------------------------
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

-- ---------------------------------------------
-- 8. 만료 녹음 오디오 삭제 마킹 RPC
-- ---------------------------------------------
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

COMMIT;
