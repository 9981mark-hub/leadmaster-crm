-- ============================================
-- 중복 방지를 위한 유니크 제약 조건 추가
-- Supabase Dashboard → SQL Editor에서 실행
-- ============================================

-- 만약 이미 중복된 데이터가 있다면 모두 지우고 다시 깔끔하게 받아오도록 기존 데이터 초기화 (선택 사항)
TRUNCATE TABLE communication_logs;

ALTER TABLE communication_logs ADD CONSTRAINT unique_comm_log UNIQUE (phone_number, timestamp, type);
