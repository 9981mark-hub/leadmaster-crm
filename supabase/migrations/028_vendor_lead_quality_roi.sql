-- =============================================
-- Migration: 028_vendor_lead_quality_roi
-- 작성: 2026-11-11 [AGY] / 보안·재실행 점검 2026-11-13 [KIRO]
-- 선행: 013, 019(dnc_filtered 칸)
-- 목적: DB 거래처(공급사)별 매입비용·손익(ROI/ROAS) & 회차 품질 고도화 관제 시스템
--   1) lead_import_batches 매입 단가/총액, 거래처명, 불량 A/S 청구 필드 추가
--   2) get_batch_quality_stats() RPC (비용, 거래처, A/S 반환) — 이 파일이 최종 정의 (019에는 없음)
--   3) update_batch_cost() RPC 신설 (단가/총비용/거래처 인라인 저장)
-- 여러 번 실행해도 된다.
-- [2026-11-13 KIRO 변경]
--   - get_batch_quality_stats: 회사 관리자만 (lead_import_batches 자체가 관리자 전용 표, 매입 비용·매출 노출 방지)
--   - 연결 여부: communication_logs.phone_number(숫자만) 와 cases.phone(010-1234-5678)을 그대로 비교해 항상 불일치 → 숫자만 남겨 비교
--   - p_limit 범위 1~1000
--   - update_batch_cost: 없는 회차면 오류, 음수 금액 거부
--   - EXECUTE: anon 회수, 로그인 사용자만
-- =============================================

BEGIN;

-- 1. lead_import_batches 테이블 컬럼 추가
ALTER TABLE public.lead_import_batches
  ADD COLUMN IF NOT EXISTS unit_cost INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor_name TEXT,
  ADD COLUMN IF NOT EXISTS as_claimed_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS as_refund_amount BIGINT NOT NULL DEFAULT 0;

-- 기존 레코드의 vendor_name을 source로 초기화 (비어 있는 것만 → 재실행 안전)
UPDATE public.lead_import_batches
SET vendor_name = COALESCE(NULLIF(TRIM(source), ''), '직접 등록/미지정')
WHERE vendor_name IS NULL;

-- 2. get_batch_quality_stats RPC (반환 칸이 바뀔 수 있으므로 지우고 다시 만든다)
DROP FUNCTION IF EXISTS public.get_batch_quality_stats(INT);

CREATE OR REPLACE FUNCTION public.get_batch_quality_stats(p_limit INT DEFAULT 100)
RETURNS TABLE (
  batch_id UUID,
  batch_name TEXT,
  source TEXT,
  vendor_name TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ,
  total_rows INT,
  inserted INT,
  duplicates INT,
  invalid INT,
  dnc_filtered INT,
  unit_cost INT,
  total_cost BIGINT,
  as_claimed_count INT,
  as_refund_amount BIGINT,
  open_count BIGINT,
  contact_count BIGINT,
  transferred_count BIGINT,
  contracted_count BIGINT,
  total_revenue BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_org UUID := public.current_org_id();
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.source,
    COALESCE(b.vendor_name, b.source, '직접 등록/미지정'),
    b.file_name,
    b.created_at,
    b.total_rows,
    b.inserted,
    b.duplicates,
    b.invalid,
    b.dnc_filtered,
    b.unit_cost,
    CASE
      WHEN b.total_cost > 0 THEN b.total_cost
      WHEN b.unit_cost > 0 THEN (b.inserted::BIGINT * b.unit_cost)
      ELSE 0::BIGINT
    END,
    b.as_claimed_count,
    b.as_refund_amount,
    COUNT(c.case_id) FILTER (
      WHERE c.deleted_at IS NULL
        AND COALESCE(c.status, '') NOT IN ('진행불가','고객취소','계약 완료','수신정지','휴지통')
    ),
    COUNT(c.case_id) FILTER (
      WHERE c.deleted_at IS NULL AND EXISTS (
        SELECT 1 FROM public.communication_logs l
        WHERE l.org_id = v_org
          AND (l.case_id = c.case_id
               OR l.phone_number = regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g'))
          AND l.type = 'CALL_OUT'
          AND l.duration > 0
      )
    ),
    COUNT(c.case_id) FILTER (
      WHERE c.deleted_at IS NULL
        AND c.partner_id IS NOT NULL
        AND c.partner_id <> ''
    ),
    COUNT(c.case_id) FILTER (
      WHERE c.deleted_at IS NULL
        AND c.status = '계약 완료'
    ),
    COALESCE(SUM(c.contract_fee) FILTER (
      WHERE c.deleted_at IS NULL
        AND c.status = '계약 완료'
    ), 0)::BIGINT
  FROM public.lead_import_batches b
  LEFT JOIN public.cases c ON c.org_id = v_org AND c.import_batch_id = b.id
  WHERE b.org_id = v_org
  GROUP BY
    b.id, b.name, b.source, b.vendor_name, b.file_name, b.created_at,
    b.total_rows, b.inserted, b.duplicates, b.invalid, b.dnc_filtered,
    b.unit_cost, b.total_cost, b.as_claimed_count, b.as_refund_amount
  ORDER BY b.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 1000);
END;
$$;

-- 3. update_batch_cost RPC
CREATE OR REPLACE FUNCTION public.update_batch_cost(
  p_batch_id UUID,
  p_unit_cost INT,
  p_total_cost BIGINT,
  p_vendor_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := public.current_org_id();
  v_inserted INT;
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;
  IF COALESCE(p_unit_cost, 0) < 0 OR COALESCE(p_total_cost, 0) < 0 THEN
    RAISE EXCEPTION '금액은 0 이상이어야 합니다';
  END IF;

  SELECT inserted INTO v_inserted
  FROM public.lead_import_batches
  WHERE id = p_batch_id AND org_id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION '회차를 찾을 수 없습니다';
  END IF;

  UPDATE public.lead_import_batches
  SET
    unit_cost = COALESCE(p_unit_cost, 0),
    total_cost = CASE
      WHEN COALESCE(p_total_cost, 0) > 0 THEN p_total_cost
      WHEN COALESCE(p_unit_cost, 0) > 0 THEN (COALESCE(v_inserted, 0)::BIGINT * p_unit_cost)
      ELSE 0::BIGINT
    END,
    vendor_name = COALESCE(NULLIF(TRIM(p_vendor_name), ''), vendor_name, source)
  WHERE id = p_batch_id AND org_id = v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.get_batch_quality_stats(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_batch_quality_stats(INT) TO authenticated;
REVOKE ALL ON FUNCTION public.update_batch_cost(UUID, INT, BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_batch_cost(UUID, INT, BIGINT, TEXT) TO authenticated;

COMMIT;
