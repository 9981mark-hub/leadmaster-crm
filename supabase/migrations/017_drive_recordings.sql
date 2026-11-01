-- =============================================
-- Migration: 017_drive_recordings
-- 작성: 2026-11-01
-- 선행: 004 (current_org_id, is_org_admin, current_org_role, can_access_case), 014 (call_recordings)
-- 기획: docs/기획서_통화녹음_구글드라이브_장기보관_v1.md
-- 목적: 통화 녹음 원본을 회사별 구글 드라이브에 장기 보관
--   1) org_drive_connections: 회사별 구글 드라이브 연결 (갱신 토큰은 Vault에 암호화, 표에는 Vault id만)
--   2) drive_oauth_states: 연결 시작 ~ 구글 콜백 사이의 일회용 state (10분)
--   3) drive_folders: 회사별로 만든 드라이브 폴더 id 기억 (연도·리드 폴더를 다시 만들지 않게)
--   4) call_recordings: 드라이브 보관 칸 추가 (storage_kind, drive_file_id, sha256, archive_status …)
--   5) get_drive_status(): 관리자 화면용 연결 상태 (토큰은 절대 안 나감)
--   6) get_recording_config(): 앱이 어디에 올릴지(storage) 알 수 있게 칸 추가
--   7) 새 회사 녹음 보관 기본값 30일 → 3650일 (자동 삭제 사실상 없음)
-- 표 1~3과 Vault 함수는 클라이언트(anon/authenticated)가 직접 못 쓴다. Edge Function(service_role)만.
-- 데이터를 지우거나 바꾸지 않는다 (기존 녹음은 storage_kind='supabase'로 채워짐). 다시 실행해도 된다.
-- 되돌리기: 맨 아래 [ROLLBACK]
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. 회사별 드라이브 연결
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_drive_connections (
  org_id            UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  google_email      TEXT,                           -- 연결한 구글 계정 (화면 표시용)
  google_sub        TEXT,                           -- 구글 계정 고유 id
  token_secret_id   UUID,                           -- vault.secrets.id (갱신 토큰). 연결 해제하면 null
  scope             TEXT,
  root_folder_id    TEXT,                           -- 녹음을 쌓는 맨 위 폴더
  root_folder_name  TEXT,
  folder_mode       TEXT CHECK (folder_mode IN ('created', 'picked')),
  status            TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'revoked', 'error')),
  last_error        TEXT,
  last_ok_at        TIMESTAMPTZ,                    -- 마지막으로 드라이브 요청이 성공한 시각
  last_test         JSONB,                          -- 마지막 연결 시험 결과 (단계별)
  connected_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.org_drive_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_drive_connections FROM anon, authenticated;

-- ---------------------------------------------
-- 2. 연결 시작 → 구글 콜백 사이의 일회용 state
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.drive_oauth_states (
  state       TEXT PRIMARY KEY,                     -- 무작위 32바이트 (base64url)
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  return_to   TEXT NOT NULL,                        -- 끝나면 돌아갈 웹 주소 (함수가 허용 목록으로 검사)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '10 minutes'
);
ALTER TABLE public.drive_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.drive_oauth_states FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS drive_oauth_states_expires_idx ON public.drive_oauth_states (expires_at);

-- ---------------------------------------------
-- 3. 만든 폴더 기억 (key 예: 'year:2026', 'case:<case_id>')
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.drive_folders (
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  folder_key  TEXT NOT NULL,
  root_id     TEXT NOT NULL,                        -- 어느 맨 위 폴더 아래인지 (폴더를 바꾸면 새로 만든다)
  folder_id   TEXT NOT NULL,
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, root_id, folder_key)
);
ALTER TABLE public.drive_folders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.drive_folders FROM anon, authenticated;

-- ---------------------------------------------
-- 4. 녹음 기록: 드라이브 보관 칸
-- ---------------------------------------------
ALTER TABLE public.call_recordings ALTER COLUMN storage_path DROP NOT NULL;
ALTER TABLE public.call_recordings ADD COLUMN IF NOT EXISTS storage_kind TEXT NOT NULL DEFAULT 'supabase';
ALTER TABLE public.call_recordings ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
ALTER TABLE public.call_recordings ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
ALTER TABLE public.call_recordings ADD COLUMN IF NOT EXISTS sha256 TEXT;
ALTER TABLE public.call_recordings ADD COLUMN IF NOT EXISTS archive_status TEXT;
ALTER TABLE public.call_recordings ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE public.call_recordings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';
ALTER TABLE public.call_recordings ADD COLUMN IF NOT EXISTS audio_deleted_by UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_recordings_storage_kind_chk') THEN
    ALTER TABLE public.call_recordings ADD CONSTRAINT call_recordings_storage_kind_chk
      CHECK (storage_kind IN ('supabase', 'gdrive'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_recordings_archive_status_chk') THEN
    ALTER TABLE public.call_recordings ADD CONSTRAINT call_recordings_archive_status_chk
      CHECK (archive_status IS NULL OR archive_status IN ('pending', 'uploading', 'archived', 'failed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_recordings_source_chk') THEN
    ALTER TABLE public.call_recordings ADD CONSTRAINT call_recordings_source_chk
      CHECK (source IN ('app', 'web', 'import'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_recordings_sha256_chk') THEN
    ALTER TABLE public.call_recordings ADD CONSTRAINT call_recordings_sha256_chk
      CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$');
  END IF;
  -- 저장 위치가 하나는 있어야 한다: Supabase면 경로, 드라이브면 파일 id(또는 아직 올리는 중)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_recordings_location_chk') THEN
    ALTER TABLE public.call_recordings ADD CONSTRAINT call_recordings_location_chk
      CHECK (
        (storage_kind = 'supabase' AND storage_path IS NOT NULL)
        OR (storage_kind = 'gdrive' AND (drive_file_id IS NOT NULL OR archive_status IN ('pending', 'uploading', 'failed')))
      );
  END IF;
END $$;

-- 같은 원본 파일을 두 번 올리지 않게 (회사 안에서 지문이 같으면 같은 파일)
CREATE UNIQUE INDEX IF NOT EXISTS call_recordings_org_sha_uidx ON public.call_recordings (org_id, sha256) WHERE sha256 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS call_recordings_drive_file_uidx ON public.call_recordings (org_id, drive_file_id) WHERE drive_file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS call_recordings_archive_idx ON public.call_recordings (org_id, archive_status) WHERE archive_status IS NOT NULL AND archive_status <> 'archived';
-- 기존 INSERT 정책(014)은 storage_path LIKE 조건이 있어 드라이브 행(storage_path null)을 사용자가 직접 넣을 수 없다 → 서버만 넣는다.

-- ---------------------------------------------
-- 5. 새 회사 보관 기본값: 자동 삭제 사실상 없음 (기존 회사 값은 그대로)
-- ---------------------------------------------
ALTER TABLE public.org_recording_settings ALTER COLUMN retention_days SET DEFAULT 3650;

-- ---------------------------------------------
-- 6. Vault: 갱신 토큰 저장·읽기·삭제 (service_role만)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.drive_store_refresh_token(p_org UUID, p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE v_old UUID; v_id UUID; v_name TEXT := 'lm_drive_refresh_' || p_org::text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 THEN RAISE EXCEPTION 'token 형식 오류'; END IF;
  SELECT token_secret_id INTO v_old FROM public.org_drive_connections WHERE org_id = p_org;
  IF v_old IS NOT NULL AND EXISTS (SELECT 1 FROM vault.secrets WHERE id = v_old) THEN
    PERFORM vault.update_secret(v_old, p_token, v_name, 'LeadMaster Google Drive refresh token');
    RETURN v_old;
  END IF;
  -- 이름이 같은 예전 비밀값이 남아 있으면 지우고 새로 만든다
  DELETE FROM vault.secrets WHERE name = v_name;
  v_id := vault.create_secret(p_token, v_name, 'LeadMaster Google Drive refresh token');
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.drive_get_refresh_token(p_org UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT d.decrypted_secret
  FROM public.org_drive_connections c
  JOIN vault.decrypted_secrets d ON d.id = c.token_secret_id
  WHERE c.org_id = p_org AND c.status <> 'revoked'
$$;

CREATE OR REPLACE FUNCTION public.drive_forget_token(p_org UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE v_id UUID;
BEGIN
  SELECT token_secret_id INTO v_id FROM public.org_drive_connections WHERE org_id = p_org;
  IF v_id IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = v_id; END IF;
  DELETE FROM vault.secrets WHERE name = 'lm_drive_refresh_' || p_org::text;
  UPDATE public.org_drive_connections SET token_secret_id = NULL, status = 'revoked', updated_at = now() WHERE org_id = p_org;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.drive_store_refresh_token(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.drive_get_refresh_token(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.drive_forget_token(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drive_store_refresh_token(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.drive_get_refresh_token(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.drive_forget_token(UUID) TO service_role;

-- ---------------------------------------------
-- 7. 관리자 화면용 연결 상태 (토큰·Vault id는 안 나감)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.get_drive_status()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_org UUID := public.current_org_id(); r JSONB;
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN RAISE EXCEPTION '관리자만 볼 수 있습니다'; END IF;
  SELECT jsonb_build_object(
    'connected', (c.status = 'connected' AND c.token_secret_id IS NOT NULL),
    'status', c.status,
    'google_email', c.google_email,
    'root_folder_id', c.root_folder_id,
    'root_folder_name', c.root_folder_name,
    'folder_mode', c.folder_mode,
    'last_error', c.last_error,
    'last_ok_at', c.last_ok_at,
    'last_test', c.last_test,
    'connected_at', c.connected_at
  ) INTO r
  FROM public.org_drive_connections c WHERE c.org_id = v_org;
  RETURN COALESCE(r, jsonb_build_object('connected', false, 'status', null));
END;
$$;
REVOKE ALL ON FUNCTION public.get_drive_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_drive_status() TO authenticated;

-- ---------------------------------------------
-- 8. 앱용 설정에 "어디에 올릴지" 추가 (드라이브 연결 + 폴더가 있으면 gdrive)
--    1.5.x 앱은 이 칸을 모르고 지금처럼 Supabase에 올린다.
-- ---------------------------------------------
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
    'max_file_bytes', 52428800,
    'storage', CASE WHEN d.status = 'connected' AND d.token_secret_id IS NOT NULL AND d.root_folder_id IS NOT NULL
                    THEN 'gdrive' ELSE 'supabase' END
  ) END
  FROM (SELECT 1) one
  LEFT JOIN public.org_recording_settings s ON s.org_id = public.current_org_id()
  LEFT JOIN public.org_drive_connections d ON d.org_id = public.current_org_id()
$$;
REVOKE ALL ON FUNCTION public.get_recording_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recording_config() TO authenticated;

COMMIT;

-- =============================================
-- [ROLLBACK] (드라이브 녹음 행이 없을 때만. 있으면 storage_path NOT NULL 복구가 실패한다)
-- BEGIN;
-- SELECT public.drive_forget_token(org_id) FROM public.org_drive_connections;
-- DROP FUNCTION IF EXISTS public.get_drive_status();
-- DROP FUNCTION IF EXISTS public.drive_store_refresh_token(UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.drive_get_refresh_token(UUID);
-- DROP FUNCTION IF EXISTS public.drive_forget_token(UUID);
-- DROP TABLE IF EXISTS public.drive_folders;
-- DROP TABLE IF EXISTS public.drive_oauth_states;
-- DROP TABLE IF EXISTS public.org_drive_connections;
-- DROP INDEX IF EXISTS public.call_recordings_org_sha_uidx;
-- DROP INDEX IF EXISTS public.call_recordings_drive_file_uidx;
-- DROP INDEX IF EXISTS public.call_recordings_archive_idx;
-- ALTER TABLE public.call_recordings DROP CONSTRAINT IF EXISTS call_recordings_location_chk,
--   DROP CONSTRAINT IF EXISTS call_recordings_sha256_chk, DROP CONSTRAINT IF EXISTS call_recordings_source_chk,
--   DROP CONSTRAINT IF EXISTS call_recordings_archive_status_chk, DROP CONSTRAINT IF EXISTS call_recordings_storage_kind_chk;
-- ALTER TABLE public.call_recordings DROP COLUMN IF EXISTS storage_kind, DROP COLUMN IF EXISTS drive_file_id,
--   DROP COLUMN IF EXISTS drive_folder_id, DROP COLUMN IF EXISTS sha256, DROP COLUMN IF EXISTS archive_status,
--   DROP COLUMN IF EXISTS archived_at, DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS audio_deleted_by;
-- ALTER TABLE public.call_recordings ALTER COLUMN storage_path SET NOT NULL;
-- ALTER TABLE public.org_recording_settings ALTER COLUMN retention_days SET DEFAULT 30;
-- (get_recording_config는 014 정의로 다시 실행)
-- COMMIT;
-- =============================================
