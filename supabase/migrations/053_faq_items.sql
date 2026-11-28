-- ==============================================================================
-- 053_faq_items.sql
-- 직급별 맞춤 FAQ 동적 관리 테이블 (최고 서비스 관리자 전용 등록·수정·삭제, 전 인증 사용자 열람)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.faq_items (
    id TEXT PRIMARY KEY,
    roles TEXT[] NOT NULL DEFAULT ARRAY['owner', 'general_admin', 'team_admin', 'agent']::TEXT[],
    category TEXT NOT NULL,
    question TEXT NOT NULL,
    summary TEXT NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    tip TEXT,
    warning TEXT,
    related_route_label TEXT,
    related_route_to TEXT,
    inquiry_category TEXT NOT NULL DEFAULT 'account_auth',
    tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    sort_order INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_faq_items_sort_order ON public.faq_items(sort_order ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_faq_items_is_active ON public.faq_items(is_active);

ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS faq_items_select ON public.faq_items;
CREATE POLICY faq_items_select ON public.faq_items
    FOR SELECT TO authenticated
    USING (
        is_active = true
        OR public.is_platform_admin()
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS faq_items_insert ON public.faq_items;
CREATE POLICY faq_items_insert ON public.faq_items
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_platform_admin()
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS faq_items_update ON public.faq_items;
CREATE POLICY faq_items_update ON public.faq_items
    FOR UPDATE TO authenticated
    USING (
        public.is_platform_admin()
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        public.is_platform_admin()
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS faq_items_delete ON public.faq_items;
CREATE POLICY faq_items_delete ON public.faq_items
    FOR DELETE TO authenticated
    USING (
        public.is_platform_admin()
        OR auth.role() = 'service_role'
    );

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.faq_items;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;
