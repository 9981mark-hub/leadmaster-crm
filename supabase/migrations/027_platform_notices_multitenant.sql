-- =============================================
-- Migration: 027_platform_notices_multitenant
-- 작성: 2026-11-11 [AGY] / 보안·재실행 점검 2026-11-13 [KIRO]
-- 선행: 004, 005, 026
-- 목적: LeadMaster SaaS 플랫폼 총괄 운영자(HOST) 전용 멀티테넌트 전역 공지 시스템
--   1) is_platform_notice: 플랫폼 전역 공지 여부 (전체 입점 고객사 대상)
--   2) platform_target_role: 'all' (전체 고객사 모든 사용자), 'admins_only' (고객사 대표/관리자만)
--   3) target_org_ids: 특정 입점 고객사(Organizations) 지정 목록 (비어있으면 전체 고객사)
--   4) require_popup_lock: 긴급 필독 팝업 잠금 (확인할 때까지 조작 일시 차단)
--   5) RLS 보안: 고객사 대표/관리자 전용 공지는 일반 상담원 쿼리 결과에서 원천 차단
-- 여러 번 실행해도 된다.
-- [2026-11-13 KIRO 변경]
--   - 없는 표 public.profiles 를 쓰던 정책 → 004의 is_platform_admin() (user_profiles.is_platform_admin)
--     (예전 그대로면 CREATE POLICY 단계에서 "relation public.profiles does not exist"로 실패)
--   - 정책 대상 TO authenticated + 회사 소속(current_org_id() 있음) 필수
--     (예전엔 TO 없음 = anon 포함 → 비로그인 사용자도 전체 대상 플랫폼 공지를 읽을 수 있었음)
--   - org_id NOT NULL 유지 (ALTER ... DROP NOT NULL 삭제). 플랫폼 공지도 쓴 사람 회사(기본값)로 저장되고,
--     보이는 범위는 is_platform_notice / target_org_ids 로 정한다. 웹은 org_id 를 보내지 않는다.
--   - INSERT: 두 경우 모두 org_id = 내 회사, UPDATE 에 WITH CHECK 명시
--   - platform_target_role 값 제한
-- =============================================

BEGIN;

-- 1. 신규 컬럼 추가
ALTER TABLE public.notices
    ADD COLUMN IF NOT EXISTS is_platform_notice BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS platform_target_role TEXT NOT NULL DEFAULT 'all', -- 'all', 'admins_only'
    ADD COLUMN IF NOT EXISTS target_org_ids UUID[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS require_popup_lock BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.notices'::regclass
                   AND conname = 'notices_platform_target_role_check') THEN
    ALTER TABLE public.notices
      ADD CONSTRAINT notices_platform_target_role_check
      CHECK (platform_target_role IN ('all', 'admins_only'));
  END IF;
END
$$;

-- 2. (삭제) org_id NULL 허용 — 회사 데이터 표는 org_id NOT NULL 원칙 유지

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_notices_platform ON public.notices(is_platform_notice, platform_target_role);

-- 4. RLS 정책 (SELECT)
DROP POLICY IF EXISTS notices_select_policy ON public.notices;
CREATE POLICY notices_select_policy ON public.notices
    FOR SELECT TO authenticated
    USING (
        (SELECT public.current_org_id()) IS NOT NULL
        AND (
            -- A. 플랫폼 전역 공지
            (
                is_platform_notice = TRUE
                AND (
                    platform_target_role = 'all'
                    OR (platform_target_role = 'admins_only' AND (SELECT public.is_org_admin()))
                    OR (SELECT public.is_platform_admin())
                )
                AND (
                    target_org_ids IS NULL
                    OR target_org_ids = '{}'::uuid[]
                    OR (SELECT public.current_org_id()) = ANY (target_org_ids)
                    OR (SELECT public.is_platform_admin())
                )
            )
            OR
            -- B. 사내 공지 (소속 회사 일치)
            (
                COALESCE(is_platform_notice, FALSE) = FALSE
                AND org_id = (SELECT public.current_org_id())
                AND (
                    (SELECT public.is_org_admin())
                    OR target_type = 'all'
                    OR (SELECT auth.uid()) = ANY (target_ids)
                )
            )
        )
    );

-- 5. RLS 정책 (INSERT)
DROP POLICY IF EXISTS notices_insert_policy ON public.notices;
CREATE POLICY notices_insert_policy ON public.notices
    FOR INSERT TO authenticated
    WITH CHECK (
        org_id = (SELECT public.current_org_id())
        AND (
            (is_platform_notice = TRUE AND (SELECT public.is_platform_admin()))
            OR
            (is_platform_notice = FALSE AND (SELECT public.is_org_admin()))
        )
    );

-- 6. RLS 정책 (UPDATE)
DROP POLICY IF EXISTS notices_update_policy ON public.notices;
CREATE POLICY notices_update_policy ON public.notices
    FOR UPDATE TO authenticated
    USING (
        (is_platform_notice = TRUE AND (SELECT public.is_platform_admin()))
        OR
        (is_platform_notice = FALSE AND org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
    )
    WITH CHECK (
        (is_platform_notice = TRUE AND (SELECT public.is_platform_admin()))
        OR
        (is_platform_notice = FALSE AND org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
    );

-- 7. RLS 정책 (DELETE)
DROP POLICY IF EXISTS notices_delete_policy ON public.notices;
CREATE POLICY notices_delete_policy ON public.notices
    FOR DELETE TO authenticated
    USING (
        (is_platform_notice = TRUE AND (SELECT public.is_platform_admin()))
        OR
        (is_platform_notice = FALSE AND org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
    );

REVOKE ALL ON public.notices FROM anon;

COMMIT;
