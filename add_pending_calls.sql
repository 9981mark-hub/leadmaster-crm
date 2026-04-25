-- pending_calls 테이블: PC에서 전화 걸기 요청 → Android 앱에서 전화 다이얼러 실행
CREATE TABLE IF NOT EXISTS pending_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  case_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'dialed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  dialed_at TIMESTAMPTZ
);

-- RLS 정책
ALTER TABLE pending_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON pending_calls
  FOR ALL USING (true) WITH CHECK (true);

-- 인덱스: pending 상태 빠른 조회
CREATE INDEX idx_pending_calls_status ON pending_calls (status) WHERE status = 'pending';
