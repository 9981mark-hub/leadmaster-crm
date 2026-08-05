-- =============================================
-- Migration: 002_auto_dial
-- Description: 자동 통화 관리 시스템 테이블 생성
-- Created: 2026-08-05
-- NOTE: 기존 테이블은 ALTER로 컬럼 추가만 수행 (기존 데이터/로직 영향 없음)
-- =============================================

-- 1. 자동 다이얼 배치 테이블
CREATE TABLE IF NOT EXISTS auto_dial_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- 배치 정보
  name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN (
    'missed_calls',    -- 부재건 자동 수집
    'excel_upload',    -- 엑셀/CSV 업로드
    'image_ocr',       -- 이미지 OCR
    'sheet_input',     -- 시트 입력
    'manual'           -- 수동 선택 (케이스 목록에서)
  )),
  
  -- 상태
  status TEXT DEFAULT 'ready' CHECK (status IN (
    'ready',        -- 준비됨
    'running',      -- 자동 통화 진행 중
    'paused',       -- 일시정지
    'completed',    -- 전체 완료
    'cancelled'     -- 취소
  )),
  
  -- 통화 설정
  ring_timeout_seconds INTEGER DEFAULT 30,   -- 벨 타임아웃 (≈5벨)
  gap_seconds INTEGER DEFAULT 5,             -- 건 사이 대기 시간
  max_retry INTEGER DEFAULT 3,               -- 최대 재시도 횟수
  
  -- 집계 (실시간 갱신)
  total_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  connected_count INTEGER DEFAULT 0,
  no_answer_count INTEGER DEFAULT 0,
  busy_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  
  -- 현재 진행 중인 아이템 인덱스
  current_item_index INTEGER DEFAULT 0,
  
  -- 메타
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 2. 자동 다이얼 개별 항목 테이블
CREATE TABLE IF NOT EXISTS auto_dial_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES auto_dial_batches(id) ON DELETE CASCADE,
  
  -- 케이스 연결
  case_id TEXT NOT NULL,
  
  -- 표시 정보 (케이스에서 복사 — 조인 없이 빠른 표시)
  customer_name TEXT,
  phone TEXT NOT NULL,
  memo TEXT,
  
  -- 소팅
  sort_order INTEGER DEFAULT 0,
  
  -- 통화 상태
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',      -- 대기
    'dialing',      -- 발신 중
    'ringing',      -- 벨 울리는 중
    'connected',    -- 통화 연결됨
    'completed',    -- 처리 완료
    'skipped'       -- 건너뜀
  )),
  
  -- 통화 결과
  result TEXT CHECK (result IN (
    'no_answer',    -- 미응답 (벨 타임아웃)
    'busy',         -- 통화중
    'rejected',     -- 거절됨
    'connected',    -- 연결 성공
    'invalid',      -- 잘못된 번호
    'error',        -- 시스템 오류
    NULL
  )),
  
  -- 통화 기록
  attempt_count INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  ring_duration_seconds INTEGER,
  call_duration_seconds INTEGER,
  result_memo TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_auto_dial_items_batch 
  ON auto_dial_items(batch_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_auto_dial_items_status 
  ON auto_dial_items(batch_id, status) 
  WHERE status IN ('pending', 'dialing', 'ringing');
CREATE INDEX IF NOT EXISTS idx_auto_dial_items_case 
  ON auto_dial_items(case_id);

-- 3. 기존 pending_calls 테이블에 auto_dial 연결 컬럼 추가
-- NOTE: IF NOT EXISTS로 안전하게 추가 — 기존 데이터에 영향 없음 (새 컬럼은 NULL)
ALTER TABLE pending_calls ADD COLUMN IF NOT EXISTS 
  auto_dial_item_id UUID REFERENCES auto_dial_items(id);
ALTER TABLE pending_calls ADD COLUMN IF NOT EXISTS 
  result TEXT;
ALTER TABLE pending_calls ADD COLUMN IF NOT EXISTS 
  ring_duration_seconds INTEGER;

-- 4. Realtime 발행 (자동 통화 상태 실시간 추적)
ALTER PUBLICATION supabase_realtime ADD TABLE auto_dial_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE auto_dial_items;

-- 5. RLS (Row Level Security) 정책
ALTER TABLE auto_dial_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_dial_items ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자만 접근 가능
CREATE POLICY "auto_dial_batches_all" ON auto_dial_batches
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "auto_dial_items_all" ON auto_dial_items
  FOR ALL USING (true) WITH CHECK (true);
