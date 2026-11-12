-- ============================================================
-- Migration: 032_auto_dial_v4.sql
-- Description: 차세대 스마트 오토콜(Auto-Dialer v4.0) 중앙 집중형 캠페인,
--              상담원별 일일 할당, 실시간 발신 큐 스키마 구축
-- ============================================================

-- 1. 오토콜 캠페인 마스터 테이블
CREATE TABLE IF NOT EXISTS auto_dial_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'ready', -- ready, running, paused, completed, archived
  target_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  pacing_settings JSONB NOT NULL DEFAULT '{
    "ringTimeoutSeconds": 20,
    "gapSeconds": 4,
    "wrapUpLimitSeconds": 10,
    "maxRetry": 3,
    "retryIntervalMinutes": 120,
    "dualSimRotation": true,
    "autoSkipWrapUp": true
  }'::jsonb,
  total_leads INT DEFAULT 0,
  completed_leads INT DEFAULT 0,
  connected_leads INT DEFAULT 0,
  no_answer_leads INT DEFAULT 0,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 상담원별 일일 할당 및 실시간 세션 테이블
CREATE TABLE IF NOT EXISTS auto_dial_agent_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES auto_dial_campaigns(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  agent_id VARCHAR(100) NOT NULL,      -- 상담원 email or user_id
  agent_name VARCHAR(100) NOT NULL,
  target_count INT DEFAULT 150,       -- 일일 목표 콜수
  completed_count INT DEFAULT 0,
  connected_count INT DEFAULT 0,
  no_answer_count INT DEFAULT 0,
  busy_count INT DEFAULT 0,
  rejected_count INT DEFAULT 0,
  current_status VARCHAR(20) DEFAULT 'idle', -- idle, dialing, ringing, talking, wrapup, paused, offline
  current_case_id UUID,
  current_customer_name VARCHAR(100),
  last_status_changed_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_campaign_agent UNIQUE (campaign_id, agent_id)
);

-- 3. 실시간 통합 발신 큐 테이블
CREATE TABLE IF NOT EXISTS auto_dial_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES auto_dial_campaigns(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  case_id UUID NOT NULL,
  assigned_agent_id VARCHAR(100),      -- 배정된 상담원 email / user_id
  customer_name VARCHAR(100),
  phone VARCHAR(50) NOT NULL,
  sim_slot INT DEFAULT 0,             -- 0 = SIM1, 1 = SIM2 (스마트 교차 발신)
  priority_score INT DEFAULT 100,     -- 신규=100, 부재1차=80, 부재2차=60, 재통화=120
  attempt_count INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  status VARCHAR(20) DEFAULT 'pending', -- pending, locked, dialing, ringing, talking, wrapup, completed, skipped
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  result VARCHAR(50),                 -- connected, no_answer, busy, rejected, callback, invalid
  result_memo TEXT,
  call_duration_seconds INT DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 인덱스 설정 (고속 큐 폴링 & 실시간 필터 최적화)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_adc_org_status ON auto_dial_campaigns (org_id, status);
CREATE INDEX IF NOT EXISTS idx_ada_campaign ON auto_dial_agent_allocations (campaign_id);
CREATE INDEX IF NOT EXISTS idx_ada_agent_status ON auto_dial_agent_allocations (org_id, agent_id, current_status);
CREATE INDEX IF NOT EXISTS idx_adq_agent_status ON auto_dial_queue (campaign_id, assigned_agent_id, status, priority_score DESC, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_adq_case ON auto_dial_queue (case_id);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE auto_dial_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_dial_agent_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_dial_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adc_org_isolation" ON auto_dial_campaigns;
CREATE POLICY "adc_org_isolation" ON auto_dial_campaigns
  FOR ALL USING (true);

DROP POLICY IF EXISTS "ada_org_isolation" ON auto_dial_agent_allocations;
CREATE POLICY "ada_org_isolation" ON auto_dial_agent_allocations
  FOR ALL USING (true);

DROP POLICY IF EXISTS "adq_org_isolation" ON auto_dial_queue;
CREATE POLICY "adq_org_isolation" ON auto_dial_queue
  FOR ALL USING (true);

-- ============================================================
-- Supabase Realtime Publication 등록
-- ============================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE auto_dial_campaigns;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE auto_dial_agent_allocations;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE auto_dial_queue;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
