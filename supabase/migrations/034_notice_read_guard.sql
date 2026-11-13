-- 034: mark_notice_read 보강 (2026-11-13 KIRO, 오픈 전 점검)
--   - 026 의 함수는 anon 도 실행 가능했고, 공지 ID 만 알면 다른 회사 공지도 읽음 처리할 수 있었다.
--   - 로그인 + 회사 소속 + 내 회사가 볼 수 있는 공지(내 회사 공지 또는 대상에 포함된 플랫폼 공지)일 때만 기록한다.
--   - 다시 실행해도 된다.
BEGIN;

CREATE OR REPLACE FUNCTION public.mark_notice_read(p_notice_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org UUID := public.current_org_id();
    v_uid UUID := auth.uid();
BEGIN
    IF v_uid IS NULL OR v_org IS NULL THEN
        RETURN FALSE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.notices n
        WHERE n.id = p_notice_id
          AND (
            n.org_id = v_org
            OR (COALESCE(n.is_platform_notice, FALSE)
                AND (n.target_org_ids IS NULL OR n.target_org_ids = '{}'::uuid[] OR v_org = ANY (n.target_org_ids)))
          )
    ) THEN
        RETURN FALSE;
    END IF;
    INSERT INTO public.notice_reads (notice_id, org_id, user_id, read_at, confirmed, confirmed_at)
    VALUES (p_notice_id, v_org, v_uid, NOW(), TRUE, NOW())
    ON CONFLICT (notice_id, user_id) DO NOTHING;
    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notice_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notice_read(UUID) TO authenticated;

COMMIT;
