-- 049: 신입 상담원 온보딩 패스트트랙 진척도 서버 동기화 테이블 (2026-11-26)
--   - 기존 브라우저 localStorage 전용 저장에서 Supabase DB 동기화로 전환하여
--     신입 상담원이 본인 PC에서 완료한 교육/시험/모의콜 진척도를 대표·관리자가 실시간 관제/승인 가능하도록 함.
--   - 멀티테넌트 격리(org_id = public.current_org_id()) 및 재실행 안전(idempotent) 보장.
BEGIN;

CREATE TABLE IF NOT EXISTS public.training_onboarding_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_key TEXT NOT NULL,
    user_name TEXT NOT NULL DEFAULT '',
    current_step_id TEXT NOT NULL DEFAULT 'step_1_videos',
    progress_percent INTEGER NOT NULL DEFAULT 0,
    completed_count INTEGER NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    is_approved_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    steps JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_training_onboarding_org_user UNIQUE (org_id, user_key)
);

CREATE INDEX IF NOT EXISTS idx_training_onboarding_org_updated
    ON public.training_onboarding_profiles (org_id, updated_at DESC);

ALTER TABLE public.training_onboarding_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "training_onboarding_select" ON public.training_onboarding_profiles;
CREATE POLICY "training_onboarding_select"
    ON public.training_onboarding_profiles
    FOR SELECT
    TO authenticated
    USING (
        org_id = public.current_org_id()
        AND (
            public.current_org_role() IN ('owner', 'admin')
            OR lower(user_key) = lower(coalesce(auth.email(), ''))
            OR user_key = auth.uid()::text
        )
    );

DROP POLICY IF EXISTS "training_onboarding_insert" ON public.training_onboarding_profiles;
CREATE POLICY "training_onboarding_insert"
    ON public.training_onboarding_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id = public.current_org_id()
        AND (
            public.current_org_role() IN ('owner', 'admin')
            OR lower(user_key) = lower(coalesce(auth.email(), ''))
            OR user_key = auth.uid()::text
        )
    );

DROP POLICY IF EXISTS "training_onboarding_update" ON public.training_onboarding_profiles;
CREATE POLICY "training_onboarding_update"
    ON public.training_onboarding_profiles
    FOR UPDATE
    TO authenticated
    USING (
        org_id = public.current_org_id()
        AND (
            public.current_org_role() IN ('owner', 'admin')
            OR lower(user_key) = lower(coalesce(auth.email(), ''))
            OR user_key = auth.uid()::text
        )
    )
    WITH CHECK (
        org_id = public.current_org_id()
        AND (
            public.current_org_role() IN ('owner', 'admin')
            OR lower(user_key) = lower(coalesce(auth.email(), ''))
            OR user_key = auth.uid()::text
        )
    );

DROP POLICY IF EXISTS "training_onboarding_delete" ON public.training_onboarding_profiles;
CREATE POLICY "training_onboarding_delete"
    ON public.training_onboarding_profiles
    FOR DELETE
    TO authenticated
    USING (
        org_id = public.current_org_id()
        AND public.current_org_role() IN ('owner', 'admin')
    );

REVOKE ALL ON TABLE public.training_onboarding_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.training_onboarding_profiles TO authenticated;

COMMIT;
