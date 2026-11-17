-- ==============================================================================
-- 047_org_applications_and_agreements.sql
-- 1) org_applications 테이블에 전자계약 약관 동의, 세금계산서 정보, 입금 상태 확장
-- 2) organization_agreements 영구 감사 로그 테이블 생성 (전자문서/전자서명법 증빙)
-- ==============================================================================

-- 1. org_applications 테이블 컬럼 확장
ALTER TABLE org_applications 
ADD COLUMN IF NOT EXISTS terms_agreed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terms_agreed_ip VARCHAR(64),
ADD COLUMN IF NOT EXISTS terms_agreed_user_agent TEXT,
ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20) DEFAULT 'v1.0',
ADD COLUMN IF NOT EXISTS business_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS tax_invoice_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS business_address TEXT,
ADD COLUMN IF NOT EXISTS selected_plan VARCHAR(30) DEFAULT 'starter',
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'trial', 'exempt')),
ADD COLUMN IF NOT EXISTS paid_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_org_app_payment_status ON org_applications(payment_status);

-- 2. 전자 계약 체결 이력 영구 감사 로그 테이블 (Clickwrap Audit Log)
CREATE TABLE IF NOT EXISTS organization_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    application_id UUID REFERENCES org_applications(id) ON DELETE SET NULL,
    company_name VARCHAR(255) NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    terms_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    terms_of_service_agreed BOOLEAN NOT NULL DEFAULT true,
    privacy_dpa_agreed BOOLEAN NOT NULL DEFAULT true,
    billing_policy_agreed BOOLEAN NOT NULL DEFAULT true,
    recording_policy_agreed BOOLEAN NOT NULL DEFAULT true,
    agreed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    agreed_ip VARCHAR(64) NOT NULL,
    agreed_user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_org_agreements_org_id ON organization_agreements(org_id);
CREATE INDEX IF NOT EXISTS idx_org_agreements_email ON organization_agreements(owner_email);

-- 3. 가입 신청서 및 약관 동의 일괄 등록 RPC
CREATE OR REPLACE FUNCTION submit_org_application_with_terms(
    p_company_name VARCHAR(255),
    p_owner_name VARCHAR(255),
    p_owner_email VARCHAR(255),
    p_phone VARCHAR(64),
    p_agent_count_tier VARCHAR(20),
    p_memo TEXT,
    p_selected_plan VARCHAR(30),
    p_business_number VARCHAR(20),
    p_tax_invoice_email VARCHAR(255),
    p_terms_version VARCHAR(20),
    p_agreed_ip VARCHAR(64),
    p_user_agent TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_app_id UUID;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- 1. 신청서 등록
    INSERT INTO org_applications (
        company_name, owner_name, owner_email, phone, 
        agent_count_tier, memo, status, selected_plan,
        business_number, tax_invoice_email,
        terms_agreed_at, terms_agreed_ip, terms_agreed_user_agent, terms_version,
        payment_status, created_at
    ) VALUES (
        p_company_name, p_owner_name, lower(trim(p_owner_email)), p_phone,
        p_agent_count_tier, p_memo, 'pending', p_selected_plan,
        p_business_number, p_tax_invoice_email,
        v_now, p_agreed_ip, p_user_agent, p_terms_version,
        'pending', v_now
    ) RETURNING id INTO v_app_id;

    -- 2. 약관 동의 영구 감사 로그 기록
    INSERT INTO organization_agreements (
        application_id, company_name, owner_email, terms_version,
        terms_of_service_agreed, privacy_dpa_agreed, billing_policy_agreed, recording_policy_agreed,
        agreed_at, agreed_ip, agreed_user_agent, created_at
    ) VALUES (
        v_app_id, p_company_name, lower(trim(p_owner_email)), p_terms_version,
        true, true, true, true,
        v_now, p_agreed_ip, p_user_agent, v_now
    );

    RETURN jsonb_build_object(
        'ok', true,
        'application_id', v_app_id,
        'agreed_at', v_now
    );
END;
$$;
