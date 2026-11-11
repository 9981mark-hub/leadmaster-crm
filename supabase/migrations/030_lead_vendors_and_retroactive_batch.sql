-- =============================================
-- Migration: 030_lead_vendors_and_retroactive_batch
-- 작성: 2026-11-11 [AGY]
-- 목적: 
--   1) DB 거래처(공급사/광고대행사) 마스터 관리 테이블 (lead_vendors) 신설
--   2) 회차 등록 시 거래처별 기본 단가(CPL) 및 A/S 기준 자동 세팅 연동
--   3) 과거 미회차 DB들을 거래처/유입경로별로 자동 소급 묶음화하는 RPC (retroactive_batch_existing_leads)
-- =============================================

BEGIN;

-- 1. lead_vendors 테이블 신설
CREATE TABLE IF NOT EXISTS public.lead_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_unit_cost INT NOT NULL DEFAULT 0,
  lead_type TEXT DEFAULT '개인회생',
  as_policy TEXT,
  contact_person TEXT,
  memo TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_lead_vendors_org_name UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS lead_vendors_org_idx ON public.lead_vendors (org_id, is_active, created_at DESC);

-- 2. RLS 보안 정책
ALTER TABLE public.lead_vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lm_lead_vendors_all ON public.lead_vendors;
CREATE POLICY lm_lead_vendors_all ON public.lead_vendors
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.current_org_id()))
  WITH CHECK (org_id = (SELECT public.current_org_id()));

REVOKE ALL ON public.lead_vendors FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_vendors TO authenticated;

-- 3. 기존 cases에 등록되어 있는 유입경로(inbound_path)에서 거래처 자동 초기 시딩
INSERT INTO public.lead_vendors (org_id, name, lead_type)
SELECT DISTINCT 
  c.org_id, 
  TRIM(c.inbound_path),
  COALESCE(c.case_type, '개인회생')
FROM public.cases c
WHERE c.org_id IS NOT NULL 
  AND c.inbound_path IS NOT NULL 
  AND TRIM(c.inbound_path) <> ''
  AND TRIM(c.inbound_path) NOT IN ('-', '미지정', '알수없음')
ON CONFLICT (org_id, name) DO NOTHING;

-- 4. 과거 미회차 DB 소급 묶음화 RPC (retroactive_batch_existing_leads)
CREATE OR REPLACE FUNCTION public.retroactive_batch_existing_leads()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := public.current_org_id();
  v_rec RECORD;
  v_new_batch_id UUID;
  v_batch_count INT := 0;
  v_case_count INT := 0;
  v_group_name TEXT;
  v_batch_title TEXT;
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;

  -- import_batch_id가 없는 활성 케이스들을 inbound_path와 월 단위로 그룹핑
  FOR v_rec IN 
    SELECT 
      COALESCE(NULLIF(TRIM(c.inbound_path), ''), '직접 등록/미지정') AS vendor,
      DATE_TRUNC('month', c.created_at) AS month_date,
      TO_CHAR(DATE_TRUNC('month', c.created_at), 'YYYY-MM') AS month_str,
      COUNT(c.case_id) AS cnt,
      MIN(c.created_at) AS min_created,
      MAX(c.created_at) AS max_created
    FROM public.cases c
    WHERE c.org_id = v_org 
      AND c.deleted_at IS NULL 
      AND c.import_batch_id IS NULL
    GROUP BY 
      COALESCE(NULLIF(TRIM(c.inbound_path), ''), '직접 등록/미지정'),
      DATE_TRUNC('month', c.created_at)
    ORDER BY month_date DESC
  LOOP
    v_batch_title := v_rec.month_str || ' 소급 묶음 (' || v_rec.vendor || ' ' || v_rec.cnt || '건)';

    -- 묶음(lead_import_batches) 생성
    INSERT INTO public.lead_import_batches (
      org_id,
      name,
      source,
      vendor_name,
      file_name,
      total_rows,
      inserted,
      created_at
    ) VALUES (
      v_org,
      v_batch_title,
      v_rec.vendor,
      v_rec.vendor,
      '기존 데이터 소급 묶음',
      v_rec.cnt,
      v_rec.cnt,
      v_rec.max_created
    ) RETURNING id INTO v_new_batch_id;

    -- 해당 케이스들에 import_batch_id 업데이트
    UPDATE public.cases
    SET import_batch_id = v_new_batch_id
    WHERE org_id = v_org
      AND deleted_at IS NULL
      AND import_batch_id IS NULL
      AND COALESCE(NULLIF(TRIM(inbound_path), ''), '직접 등록/미지정') = v_rec.vendor
      AND DATE_TRUNC('month', created_at) = v_rec.month_date;

    v_batch_count := v_batch_count + 1;
    v_case_count := v_case_count + v_rec.cnt;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'batches_created', v_batch_count,
    'cases_linked', v_case_count
  );
END;
$$;

COMMIT;
