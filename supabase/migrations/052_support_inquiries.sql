-- ==============================================================================
-- 052_support_inquiries.sql
-- 전 직급(TM대표·총괄관리자·팀장·상담원) 1:1 서비스 문의 & 플랫폼 총괄 관리자 실시간 답변 시스템
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.support_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    org_name TEXT NOT NULL DEFAULT '',
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    user_name TEXT DEFAULT '',
    user_role TEXT NOT NULL DEFAULT 'agent' CHECK (user_role IN ('owner', 'general_admin', 'team_admin', 'agent')),
    category TEXT NOT NULL DEFAULT 'general',
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    context_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'answered', 'closed')),
    admin_reply TEXT,
    replied_by TEXT,
    replied_at TIMESTAMPTZ,
    user_read_reply BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_support_inquiries_user_id ON public.support_inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_support_inquiries_org_id ON public.support_inquiries(org_id);
CREATE INDEX IF NOT EXISTS idx_support_inquiries_status ON public.support_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_support_inquiries_created_at ON public.support_inquiries(created_at DESC);

ALTER TABLE public.support_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_inquiries_select ON public.support_inquiries;
CREATE POLICY support_inquiries_select ON public.support_inquiries
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_platform_admin()
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS support_inquiries_insert ON public.support_inquiries;
CREATE POLICY support_inquiries_insert ON public.support_inquiries
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND user_id = auth.uid()
        AND (
            org_id IS NULL
            OR org_id = public.current_org_id()
            OR public.is_platform_admin()
        )
    );

DROP POLICY IF EXISTS support_inquiries_update ON public.support_inquiries;
CREATE POLICY support_inquiries_update ON public.support_inquiries
    FOR UPDATE TO authenticated
    USING (
        public.is_platform_admin()
        OR user_id = auth.uid()
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        public.is_platform_admin()
        OR (user_id = auth.uid() AND status IN ('open', 'answered', 'closed'))
        OR auth.role() = 'service_role'
    );

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_inquiries;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;
