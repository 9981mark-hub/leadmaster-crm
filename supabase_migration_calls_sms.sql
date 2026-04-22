-- 1. 통화 및 문자 기록 테이블 (communication_logs)
DROP TABLE IF EXISTS communication_logs CASCADE;
CREATE TABLE communication_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id TEXT REFERENCES cases(case_id) ON DELETE SET NULL, -- CRM의 cases 테이블과 연결 (선택)
    phone_number TEXT NOT NULL,
    type TEXT NOT NULL, -- 'CALL_IN', 'CALL_OUT', 'CALL_MISSED', 'SMS_IN', 'SMS_OUT'
    content TEXT, -- 문자 내용 또는 통화 메모
    duration INTEGER DEFAULT 0, -- 통화 시간 (초 단위)
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 전화번호별 인덱스 (조회 속도 향상)
CREATE INDEX idx_communication_logs_phone ON communication_logs(phone_number);
CREATE INDEX idx_communication_logs_case ON communication_logs(case_id);
CREATE INDEX idx_communication_logs_timestamp ON communication_logs(timestamp DESC);

-- 2. CRM 문자 발송 대기열 테이블 (pending_sms)
DROP TABLE IF EXISTS pending_sms CASCADE;
CREATE TABLE pending_sms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number TEXT NOT NULL,
    content TEXT NOT NULL,
    template_id UUID, -- 사용된 템플릿 ID (선택)
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_pending_sms_status ON pending_sms(status);

-- 3. 자주 쓰는 문자 템플릿 테이블 (sms_templates)
DROP TABLE IF EXISTS sms_templates CASCADE;
CREATE TABLE sms_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT, -- 선택적 이미지 (명함 등)
    order_index INTEGER DEFAULT 0, -- 정렬 순서
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 초기 템플릿 샘플 데이터 삽입
INSERT INTO sms_templates (title, content, order_index) VALUES
('명함 및 인사', '안녕하세요. 상담을 도와드릴 담당자입니다. 궁금하신 점이 있으시면 언제든 편하게 연락 주시기 바랍니다.\n[명함 첨부]', 1),
('부재중 연락 요청', '전화를 드렸으나 연결이 되지 않아 문자 남깁니다. 확인 후 연락 주시면 상담 도와드리겠습니다.', 2),
('서류 안내', '상담을 위해 필요한 서류 목록을 안내해 드립니다. 준비 후 회신 부탁드립니다.', 3);
