-- =============================================
-- Migration: 026_notices_and_directives
-- 작성: 2026-11-09 [AGY]
-- 목적: 관리자 공지사항(상단 배너/피드) 및 상담원 업무 지시사항 하달·수신확인 시스템
--   1) notices: 공지사항 마스터 테이블 (상단 띠배너, 일반 피드, 타겟팅, 유효기간)
--   2) notice_reads: 상담원별 수신/읽음 확인 이력 (읽음률 추적, 미확인자 리스트)
--   3) directives: 업무 지시사항 테이블 (상담원 지정, 고객 케이스 연계, 마감일, 완료보고)
--   4) get_notice_read_stats(): 공지별 수신자/미수신자 통계 RPC
-- =============================================

BEGIN;

-- 1. 공지사항 마스터 테이블
CREATE TABLE IF NOT EXISTS public.notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL DEFAULT COALESCE(public.current_org_id(), '00000000-0000-0000-0000-000000000001'::uuid) REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    notice_type TEXT NOT NULL DEFAULT 'general', -- 'general', 'urgent', 'policy', 'promotion'
    display_mode TEXT NOT NULL DEFAULT 'banner',  -- 'banner'(상단 띠배너), 'feed'(게시판 피드), 'modal'(필독 팝업)
    target_type TEXT NOT NULL DEFAULT 'all',      -- 'all', 'team', 'user'
    target_ids UUID[] DEFAULT '{}',               -- 대상 팀 ID 또는 상담원 user_id
    is_pinned BOOLEAN DEFAULT FALSE,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notices_org ON public.notices(org_id);
CREATE INDEX IF NOT EXISTS idx_notices_created_at ON public.notices(created_at DESC);

-- 2. 공지 읽음/확인 이력
CREATE TABLE IF NOT EXISTS public.notice_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notice_id UUID NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
    org_id UUID NOT NULL DEFAULT COALESCE(public.current_org_id(), '00000000-0000-0000-0000-000000000001'::uuid) REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed BOOLEAN DEFAULT TRUE,
    confirmed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (notice_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notice_reads_user ON public.notice_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_notice_reads_notice ON public.notice_reads(notice_id);

-- 3. 업무 지시사항
CREATE TABLE IF NOT EXISTS public.directives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL DEFAULT COALESCE(public.current_org_id(), '00000000-0000-0000-0000-000000000001'::uuid) REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
    assigned_to UUID NOT NULL REFERENCES auth.users(id),
    case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'normal',      -- 'low', 'normal', 'high', 'urgent'
    status TEXT NOT NULL DEFAULT 'pending',       -- 'pending', 'in_progress', 'completed', 'closed'
    due_date TIMESTAMPTZ,
    result_memo TEXT,
    completed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_directives_assigned_to ON public.directives(assigned_to);
CREATE INDEX IF NOT EXISTS idx_directives_org ON public.directives(org_id);

-- 4. RLS 보안 활성화
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directives ENABLE ROW LEVEL SECURITY;

-- notices RLS
DROP POLICY IF EXISTS notices_select_policy ON public.notices;
CREATE POLICY notices_select_policy ON public.notices
    FOR SELECT USING (
        org_id = public.current_org_id() AND (
            public.is_org_admin() OR
            target_type = 'all' OR
            auth.uid() = ANY(target_ids)
        )
    );

DROP POLICY IF EXISTS notices_insert_policy ON public.notices;
CREATE POLICY notices_insert_policy ON public.notices
    FOR INSERT WITH CHECK (
        org_id = public.current_org_id() AND public.is_org_admin()
    );

DROP POLICY IF EXISTS notices_update_policy ON public.notices;
CREATE POLICY notices_update_policy ON public.notices
    FOR UPDATE USING (
        org_id = public.current_org_id() AND public.is_org_admin()
    );

DROP POLICY IF EXISTS notices_delete_policy ON public.notices;
CREATE POLICY notices_delete_policy ON public.notices
    FOR DELETE USING (
        org_id = public.current_org_id() AND public.is_org_admin()
    );

-- notice_reads RLS
DROP POLICY IF EXISTS notice_reads_select_policy ON public.notice_reads;
CREATE POLICY notice_reads_select_policy ON public.notice_reads
    FOR SELECT USING (
        org_id = public.current_org_id() AND (
            public.is_org_admin() OR user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS notice_reads_insert_policy ON public.notice_reads;
CREATE POLICY notice_reads_insert_policy ON public.notice_reads
    FOR INSERT WITH CHECK (
        org_id = public.current_org_id() AND user_id = auth.uid()
    );

DROP POLICY IF EXISTS notice_reads_update_policy ON public.notice_reads;
CREATE POLICY notice_reads_update_policy ON public.notice_reads
    FOR UPDATE USING (
        org_id = public.current_org_id() AND user_id = auth.uid()
    );

-- directives RLS
DROP POLICY IF EXISTS directives_select_policy ON public.directives;
CREATE POLICY directives_select_policy ON public.directives
    FOR SELECT USING (
        org_id = public.current_org_id() AND (
            public.is_org_admin() OR assigned_to = auth.uid() OR created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS directives_insert_policy ON public.directives;
CREATE POLICY directives_insert_policy ON public.directives
    FOR INSERT WITH CHECK (
        org_id = public.current_org_id() AND public.is_org_admin()
    );

DROP POLICY IF EXISTS directives_update_policy ON public.directives;
CREATE POLICY directives_update_policy ON public.directives
    FOR UPDATE USING (
        org_id = public.current_org_id() AND (
            public.is_org_admin() OR assigned_to = auth.uid()
        )
    );

DROP POLICY IF EXISTS directives_delete_policy ON public.directives;
CREATE POLICY directives_delete_policy ON public.directives
    FOR DELETE USING (
        org_id = public.current_org_id() AND public.is_org_admin()
    );

-- 5. 통계 및 수신확인 RPC
CREATE OR REPLACE FUNCTION public.mark_notice_read(p_notice_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.notice_reads (notice_id, org_id, user_id, read_at, confirmed, confirmed_at)
    VALUES (p_notice_id, public.current_org_id(), auth.uid(), NOW(), TRUE, NOW())
    ON CONFLICT (notice_id, user_id) DO NOTHING;
    RETURN TRUE;
END;
$$;

-- 6. Realtime 연동 활성화 (새 공지 실시간 알림)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notices'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notices;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'directives'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.directives;
    END IF;
END $$;

COMMIT;