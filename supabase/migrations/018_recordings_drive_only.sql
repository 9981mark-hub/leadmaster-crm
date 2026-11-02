-- =============================================
-- Migration: 018_recordings_drive_only
-- 작성: 2026-11-02 (대표님 결정: 녹음 파일은 리드마스터 서버에 올리지 않는다. 구글 드라이브에만)
-- 선행: 014, 017
-- 목적
--   1) 앱·웹이 리드마스터 저장소(call-recordings 버킷)에 녹음 파일을 올리는 길을 막는다 (앱 1.5.x 포함)
--   2) 로그인 사용자가 call_recordings 행을 직접 만들지 못하게 한다 → 서버 함수(recording-upload)만 만든다
--      (드라이브 업로드 주소 발급·완료 확인을 거친 녹음만 기록된다)
-- 읽기 정책·기존 행·버킷 자체는 그대로 둔다 (지금 버킷은 비어 있음). 다시 실행해도 된다.
-- 되돌리기: 맨 아래 [ROLLBACK] (014의 정책 두 개를 다시 만든다)
-- =============================================
BEGIN;

DROP POLICY IF EXISTS lm_call_rec_insert ON storage.objects;
DROP POLICY IF EXISTS call_recordings_insert ON public.call_recordings;
REVOKE INSERT ON public.call_recordings FROM authenticated;

-- 버킷이 비어 있으면 더 받지 않도록 작은 상한 (정책이 막지만 이중으로)
UPDATE storage.buckets SET file_size_limit = 1 WHERE id = 'call-recordings'
  AND NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'call-recordings');

COMMIT;

-- =============================================
-- [ROLLBACK]
-- BEGIN;
-- UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id = 'call-recordings';
-- GRANT INSERT ON public.call_recordings TO authenticated;
-- (014_call_recordings.sql의 lm_call_rec_insert, call_recordings_insert 정책 CREATE 문을 다시 실행)
-- COMMIT;
-- =============================================
