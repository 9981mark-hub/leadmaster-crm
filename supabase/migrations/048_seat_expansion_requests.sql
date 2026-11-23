-- ==============================================================================
-- 048_seat_expansion_requests.sql
-- 1) 라이선스 좌석(Seat) 증설 요청 관리 테이블 생성
-- 2) 플랫폼 총괄 관리자(HOST) 실시간 관제 및 승인/반려 RPC
-- ==============================================================================

CREATE TABLE IF NOT EXISTS seat_expansion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    org_name VARCHAR(255) NOT NULL,
    requester_email VARCHAR(255) NOT NULL,
    requester_name VARCHAR(255),
    current_seats INTEGER NOT NULL DEFAULT 20,
    requested_seats INTEGER NOT NULL,
    memo TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_seat_requests_org_id ON seat_expansion_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_seat_requests_status ON seat_expansion_requests(status);
CREATE INDEX IF NOT EXISTS idx_seat_requests_created_at ON seat_expansion_requests(created_at DESC);

-- RLS 활성화
ALTER TABLE seat_expansion_requests ENABLE ROW LEVEL SECURITY;

-- 조회: 조직 멤버이거나 플랫폼 관리자
CREATE POLICY "seat_requests_select" ON seat_expansion_requests
    FOR SELECT
    USING (
        org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
        OR auth.role() = 'service_role'
    );

-- 등록: 조직 멤버
CREATE POLICY "seat_requests_insert" ON seat_expansion_requests
    FOR INSERT
    WITH CHECK (
        org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
        OR auth.role() = 'service_role'
    );

-- 수정: 플랫폼 관리자 전용
CREATE POLICY "seat_requests_update" ON seat_expansion_requests
    FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
        OR auth.role() = 'service_role'
    );
