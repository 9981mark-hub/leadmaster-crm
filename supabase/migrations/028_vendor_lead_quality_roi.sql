-- =============================================
-- Migration: 028_vendor_lead_quality_roi
-- 작성: 2026-11-11 [AGY]
-- 목적: DB 거래처(공급사)별 매입비용·손익(ROI/ROAS) & 회차 품질 고도화 관제 시스템
--   1) lead_import_batches 매입 단가/총액, 거래처명, 불량 A/S 청구 필드 추가
--   2) get_batch_quality_stats() RPC 확장 (비용, 거래처, A/S 반환)
--   3) update_batch_cost() RPC 신설 (단가/총비용/거래처 인라인 저장)
-- =============================================

BEGIN;

-- 1. lead_import_batches 테이블 컬럼 추가
ALTER TABLE public.lead_import_batches
  ADD COLUMN IF NOT EXISTS unit_cost INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor_name TEXT,
  ADD COLUMN IF NOT EXISTS as_claimed_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS as_refund_amount BIGINT NOT NULL DEFAULT 0;

-- 기존 레코드의 vendor_name을 source로 초기화
UPDATE public.lead_import_batches
SET vendor_name = COALESCE(NULLIF(TRIM(source), ''), '직접 등록/미지정')
WHERE vendor_name IS NULL;

-- 2. get_batch_quality_stats RPC 고도화
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
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := public.current_org_id();
BEGIN
  IF v_org IS NULL THEN 
    RAISE EXCEPTION '회사 정보를 확인할 수 없습니다'; 
  END IF;

  RETURN QUERY
  SELECT 
    b.id AS batch_id,
    b.name AS batch_name,
    b.source,
    COALESCE(b.vendor_name, b.source, '직접 등록/미지정') AS vendor_name,
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
      WHEN b.unit_cost > 0 THEN (b.inserted * b.unit_cost)::BIGINT
      ELSE 0::BIGINT
    END AS total_cost,
    b.as_claimed_count,
    b.as_refund_amount,
    COUNT(c.case_id) FILTER (
      WHERE c.deleted_at IS NULL 
        AND c.status NOT IN ('진행불가','고객취소','계약 완료','수신정지','휴지통')
    ) AS open_count,
    COUNT(c.case_id) FILTER (
      WHERE c.deleted_at IS NULL AND EXISTS (
        SELECT 1 FROM public.communication_logs l 
        WHERE l.org_id = v_org 
          AND (l.case_id = c.case_id OR l.phone_number = c.phone) 
          AND l.type = 'CALL_OUT' 
          AND l.duration > 0
      )
    ) AS contact_count,
    COUNT(c.case_id) FILTER (
      WHERE c.deleted_at IS NULL 
        AND c.partner_id IS NOT NULL 
        AND c.partner_id <> ''
    ) AS transferred_count,
    COUNT(c.case_id) FILTER (
      WHERE c.deleted_at IS NULL 
        AND c.status = '계약 완료'
    ) AS contracted_count,
    COALESCE(SUM(c.contract_fee) FILTER (
      WHERE c.deleted_at IS NULL 
        AND c.status = '계약 완료'
    ), 0)::BIGINT AS total_revenue
  FROM public.lead_import_batches b
  LEFT JOIN public.cases c ON c.org_id = v_org AND c.import_batch_id = b.id
  WHERE b.org_id = v_org
  GROUP BY 
    b.id, b.name, b.source, b.vendor_name, b.file_name, b.created_at, 
    b.total_rows, b.inserted, b.duplicates, b.invalid, b.dnc_filtered, 
    b.unit_cost, b.total_cost, b.as_claimed_count, b.as_refund_amount
  ORDER BY b.created_at DESC
  LIMIT p_limit;
END;
$$;

-- 3. update_batch_cost RPC 신설
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

  SELECT inserted INTO v_inserted
  FROM public.lead_import_batches
  WHERE id = p_batch_id AND org_id = v_org;

  UPDATE public.lead_import_batches
  SET
    unit_cost = GREATEST(0, p_unit_cost),
    total_cost = CASE 
      WHEN p_total_cost > 0 THEN p_total_cost
      WHEN p_unit_cost > 0 THEN (COALESCE(v_inserted, 0) * p_unit_cost)::BIGINT
      ELSE 0::BIGINT
    END,
    vendor_name = COALESCE(NULLIF(TRIM(p_vendor_name), ''), vendor_name, source)
  WHERE id = p_batch_id AND org_id = v_org;
END;
$$;

COMMIT;
