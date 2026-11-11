-- =============================================
-- Migration: 027_platform_notices_multitenant
-- 작성: 2026-11-11 [AGY]
-- 목적: LeadMaster SaaS 플랫폼 총괄 운영자(HOST) 전용 멀티테넌트 전역 공지 시스템
--   1) is_platform_notice: 플랫폼 전역 공지 여부 (전체 입점 고객사 대상)
--   2) platform_target_role: 'all' (전체 고객사 모든 사용자), 'admins_only' (고객사 대표/관리자만)
--   3) target_org_ids: 특정 입점 고객사(Organizations) 지정 목록 (비어있으면 전체 고객사)
--   4) require_popup_lock: 긴급 필독 팝업 잠금 (확인할 때까지 조작 일시 차단)
--   5) RLS 보안: 고객사 대표/관리자 전용 공지는 일반 상담원 쿼리 결과에서 100% 원천 차단
-- =============================================

BEGIN;

-- 1. 신규 컬럼 추가
ALTER TABLE public.notices
    ADD COLUMN IF NOT EXISTS is_platform_notice BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS platform_target_role TEXT NOT NULL DEFAULT 'all', -- 'all', 'admins_only'
    ADD COLUMN IF NOT EXISTS target_org_ids UUID[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS require_popup_lock BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. org_id NULL 허용 (플랫폼 전역 공지는 특정 단일 org_id에 귀속되지 않거나 HQ_ORG_ID일 수 있음)
ALTER TABLE public.notices ALTER COLUMN org_id DROP NOT NULL;

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_notices_platform ON public.notices(is_platform_notice, platform_target_role);

-- 4. RLS 정책 업데이트 (SELECT)
DROP POLICY IF EXISTS notices_select_policy ON public.notices;
CREATE POLICY notices_select_policy ON public.notices
    FOR SELECT USING (
        -- A. 플랫폼 전역 공지인 경우
        (
            is_platform_notice = TRUE AND (
                -- 수신 대상이 전체이거나, 관리자 전용인 경우 현재 사용자가 해당 org의 admin/owner인 경우
                platform_target_role = 'all' OR
                (platform_target_role = 'admins_only' AND public.is_org_admin())
            ) AND (
                -- 특정 대상 고객사 지정이 없거나, 현재 사용자의 org_id가 포함되어 있는 경우
                target_org_ids = '{}'::uuid[] OR
                target_org_ids IS NULL OR
                public.current_org_id() = ANY(target_org_ids)
            )
        )
        OR
        -- B. 기존 사내 공지인 경우 (소속 회사 일치 필요)
        (
            (is_platform_notice = FALSE OR is_platform_notice IS NULL) AND
            org_id = public.current_org_id() AND (
                public.is_org_admin() OR
                target_type = 'all' OR
                auth.uid() = ANY(target_ids)
            )
        )
    );

-- 5. RLS 정책 업데이트 (INSERT)
DROP POLICY IF EXISTS notices_insert_policy ON public.notices;
CREATE POLICY notices_insert_policy ON public.notices
    FOR INSERT WITH CHECK (
        (is_platform_notice = TRUE AND EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_platform_admin = TRUE
        ))
        OR
        (is_platform_notice = FALSE AND org_id = public.current_org_id() AND public.is_org_admin())
    );

-- 6. RLS 정책 업데이트 (UPDATE)
DROP POLICY IF EXISTS notices_update_policy ON public.notices;
CREATE POLICY notices_update_policy ON public.notices
    FOR UPDATE USING (
        (is_platform_notice = TRUE AND EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_platform_admin = TRUE
        ))
        OR
        (is_platform_notice = FALSE AND org_id = public.current_org_id() AND public.is_org_admin())
    );

-- 7. RLS 정책 업데이트 (DELETE)
DROP POLICY IF EXISTS notices_delete_policy ON public.notices;
CREATE POLICY notices_delete_policy ON public.notices
    FOR DELETE USING (
        (is_platform_notice = TRUE AND EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_platform_admin = TRUE
        ))
        OR
        (is_platform_notice = FALSE AND org_id = public.current_org_id() AND public.is_org_admin())
    );

COMMIT;
