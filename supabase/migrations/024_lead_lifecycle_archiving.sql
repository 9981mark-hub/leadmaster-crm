-- =============================================
-- Migration: 024_lead_lifecycle_archiving
-- 작성: 2026-11-04
-- 선행: 004, 005, 013, 023
-- 목적: 스마트 리드 수명주기(Lifecycle) 및 데이터 아카이브·보안 숨김 거버넌스
--   1) cases 테이블에 is_archived, archived_at, archived_reason, archived_by 컬럼 추가
--   2) 복합 인덱스 idx_cases_org_lifecycle 추가
--   3) 회사별 자동 수명주기 정책 테이블 (org_lifecycle_policies) 신설
--   4) 일괄 보관(archive_cases) 및 복원(restore_archived_cases) RPC 함수
--   5) 수명주기 통계 조회 (get_lifecycle_stats) 및 자동 정리(run_auto_lifecycle_cleanup) RPC 함수
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. cases 테이블에 보관/숨김 컬럼 및 인덱스 추가
-- ---------------------------------------------
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_reason TEXT,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cases_org_lifecycle
  ON public.cases (org_id, is_archived, deleted_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cases_org_archived
  ON public.cases (org_id, is_archived) WHERE is_archived = true;

-- ---------------------------------------------
-- 2. 회사별 자동 수명주기 정책 테이블
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_lifecycle_policies (
  org_id                UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  auto_archive_contract BOOLEAN NOT NULL DEFAULT true,
  contract_grace_days   INT NOT NULL DEFAULT 7,
  auto_archive_stale    BOOLEAN NOT NULL DEFAULT true,
  stale_days            INT NOT NULL DEFAULT 45,
  auto_trash_invalid    BOOLEAN NOT NULL DEFAULT true,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.org_lifecycle_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_lifecycle_policies_all ON public.org_lifecycle_policies;
CREATE POLICY org_lifecycle_policies_all ON public.org_lifecycle_policies
  FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());

GRANT SELECT, INSERT, UPDATE ON public.org_lifecycle_policies TO authenticated;

-- ---------------------------------------------
-- 3. 수명주기 통계 조회 함수 (get_lifecycle_stats)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.get_lifecycle_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id       UUID;
  v_role         TEXT;
  v_active_count INT := 0;
  v_archived_count INT := 0;
  v_trash_count  INT := 0;
BEGIN
  v_org_id := public.current_org_id();
  v_role   := public.current_org_role();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION '소속 회사를 찾을 수 없습니다.';
  END IF;

  -- 활성 리드 (삭제 안 됨 + 보관 안 됨)
  SELECT count(*) INTO v_active_count
  FROM public.cases
  WHERE org_id = v_org_id
    AND is_archived = false
    AND deleted_at IS NULL;

  -- 보관함 리드 (삭제 안 됨 + 보관됨)
  SELECT count(*) INTO v_archived_count
  FROM public.cases
  WHERE org_id = v_org_id
    AND is_archived = true
    AND deleted_at IS NULL;

  -- 휴지통 리드 (삭제됨)
  SELECT count(*) INTO v_trash_count
  FROM public.cases
  WHERE org_id = v_org_id
    AND deleted_at IS NOT NULL;

  RETURN jsonb_build_object(
    'org_id', v_org_id,
    'role', v_role,
    'active_count', v_active_count,
    'archived_count', v_archived_count,
    'trash_count', v_trash_count
  );
END;
$$;

-- ---------------------------------------------
-- 4. 리드 일괄 보관(숨김) 함수 (archive_cases)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_cases(
  p_case_ids TEXT[],
  p_reason   TEXT DEFAULT 'manual'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_count  INT := 0;
BEGIN
  v_org_id := public.current_org_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION '소속 회사를 찾을 수 없습니다.';
  END IF;

  IF NOT public.is_org_admin() THEN
    RAISE EXCEPTION '리드 보관(숨김)은 관리자만 수행할 수 있습니다.';
  END IF;

  IF p_case_ids IS NULL OR array_length(p_case_ids, 1) = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.cases
  SET is_archived = true,
      archived_at = now(),
      archived_reason = COALESCE(p_reason, 'manual'),
      archived_by = auth.uid(),
      updated_at = now()
  WHERE org_id = v_org_id
    AND case_id = ANY(p_case_ids)
    AND is_archived = false
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------
-- 5. 리드 보관 해제 (활성 복원) 함수 (restore_archived_cases)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_archived_cases(
  p_case_ids TEXT[]
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_count  INT := 0;
BEGIN
  v_org_id := public.current_org_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION '소속 회사를 찾을 수 없습니다.';
  END IF;

  IF NOT public.is_org_admin() THEN
    RAISE EXCEPTION '리드 복원은 관리자만 수행할 수 있습니다.';
  END IF;

  IF p_case_ids IS NULL OR array_length(p_case_ids, 1) = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.cases
  SET is_archived = false,
      archived_at = NULL,
      archived_reason = NULL,
      archived_by = NULL,
      updated_at = now()
  WHERE org_id = v_org_id
    AND case_id = ANY(p_case_ids)
    AND is_archived = true
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------
-- 6. 자동 수명주기 정리 실행 함수 (run_auto_lifecycle_cleanup)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.run_auto_lifecycle_cleanup()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id         UUID;
  v_policy         RECORD;
  v_archived_contracts INT := 0;
  v_archived_stale     INT := 0;
  v_trashed_invalid    INT := 0;
BEGIN
  v_org_id := public.current_org_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION '소속 회사를 찾을 수 없습니다.';
  END IF;

  IF NOT public.is_org_admin() THEN
    RAISE EXCEPTION '관리자만 실행할 수 있습니다.';
  END IF;

  -- 회사별 정책 조회 (없으면 기본값 적용)
  SELECT * INTO v_policy
  FROM public.org_lifecycle_policies
  WHERE org_id = v_org_id;

  -- 1) 계약 완료 건 자동 보관 (기본 7일 경과)
  IF COALESCE(v_policy.auto_archive_contract, true) THEN
    UPDATE public.cases
    SET is_archived = true,
        archived_at = now(),
        archived_reason = 'auto_contract',
        archived_by = auth.uid(),
        updated_at = now()
    WHERE org_id = v_org_id
      AND is_archived = false
      AND deleted_at IS NULL
      AND status = '계약 완료'
      AND updated_at < (now() - (COALESCE(v_policy.contract_grace_days, 7) || ' days')::interval);

    GET DIAGNOSTICS v_archived_contracts = ROW_COUNT;
  END IF;

  -- 2) 장기 미활동 건 자동 보관 (기본 45일 동안 수정/통화 없음)
  IF COALESCE(v_policy.auto_archive_stale, true) THEN
    UPDATE public.cases
    SET is_archived = true,
        archived_at = now(),
        archived_reason = 'auto_stale',
        archived_by = auth.uid(),
        updated_at = now()
    WHERE org_id = v_org_id
      AND is_archived = false
      AND deleted_at IS NULL
      AND status NOT IN ('계약 완료')
      AND updated_at < (now() - (COALESCE(v_policy.stale_days, 45) || ' days')::interval);

    GET DIAGNOSTICS v_archived_stale = ROW_COUNT;
  END IF;

  -- 3) 결번 / 수신거부 건 자동 휴지통 이동
  IF COALESCE(v_policy.auto_trash_invalid, true) THEN
    UPDATE public.cases
    SET deleted_at = now(),
        updated_at = now()
    WHERE org_id = v_org_id
      AND deleted_at IS NULL
      AND status IN ('결번', '수신거부', '잘못걸린전화');

    GET DIAGNOSTICS v_trashed_invalid = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'org_id', v_org_id,
    'archived_contracts', v_archived_contracts,
    'archived_stale', v_archived_stale,
    'trashed_invalid', v_trashed_invalid,
    'executed_at', now()
  );
END;
$$;

-- 함수 권한 부여
REVOKE ALL ON FUNCTION public.get_lifecycle_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_cases(TEXT[], TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_archived_cases(TEXT[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.run_auto_lifecycle_cleanup() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_lifecycle_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_cases(TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_archived_cases(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_auto_lifecycle_cleanup() TO authenticated;

COMMIT;
