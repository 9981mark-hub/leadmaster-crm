-- =============================================
-- Migration: 030_lead_vendors_and_retroactive_batch
-- 작성: 2026-11-11 [AGY] / 보안·재실행 점검 2026-11-13 [KIRO]
-- 선행: 013, 028_vendor_lead_quality_roi(vendor_name 칸)
-- 목적:
--   1) DB 거래처(공급사/광고대행사) 마스터 관리 테이블 (lead_vendors) 신설
--   2) 회차 등록 시 거래처별 기본 단가(CPL) 및 A/S 기준 자동 세팅 연동
--   3) 과거 미회차 DB들을 거래처/유입경로별로 자동 소급 묶음화하는 RPC (retroactive_batch_existing_leads)
-- 여러 번 실행해도 된다.
-- [2026-11-13 KIRO 변경]
--   - lead_vendors: 보기 = 같은 회사 멤버, 쓰기 = 회사 관리자만 (예전엔 상담원도 매입 단가를 고칠 수 있었음), anon 회수
--   - retroactive_batch_existing_leads:
--       · 월 묶음 = 한국 시간 기준 (UTC 기준이면 1일 0~9시 등록이 전달로 묶임)
--       · 등록일 없는 리드(created_at NULL): 예전엔 묶음은 만들고 리드는 연결 안 됨 → 같은 묶음에 연결
--       · 휴지통·보관 리드 제외
--       · 같은 회사에서 동시에 두 번 눌러도 묶음이 두 번 생기지 않게 잠금
--       · 실제로 연결된 건수로 묶음 건수를 적음
--       · EXECUTE: anon 회수
-- =============================================

BEGIN;

-- 1. lead_vendors 테이블
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
DROP POLICY IF EXISTS lm_lead_vendors_read ON public.lead_vendors;
CREATE POLICY lm_lead_vendors_read ON public.lead_vendors
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.current_org_id()));

DROP POLICY IF EXISTS lm_lead_vendors_admin_write ON public.lead_vendors;
CREATE POLICY lm_lead_vendors_admin_write ON public.lead_vendors
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
  WITH CHECK (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

REVOKE ALL ON public.lead_vendors FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_vendors TO authenticated;

-- 3. 기존 cases 유입경로(inbound_path)에서 거래처 초기 등록 (있는 이름은 건너뜀 → 재실행 안전)
INSERT INTO public.lead_vendors (org_id, name, lead_type)
SELECT DISTINCT ON (c.org_id, TRIM(c.inbound_path))
  c.org_id,
  TRIM(c.inbound_path),
  COALESCE(c.case_type, '개인회생')
FROM public.cases c
WHERE c.org_id IS NOT NULL
  AND c.inbound_path IS NOT NULL
  AND TRIM(c.inbound_path) <> ''
  AND TRIM(c.inbound_path) NOT IN ('-', '미지정', '알수없음')
ORDER BY c.org_id, TRIM(c.inbound_path), c.created_at DESC NULLS LAST
ON CONFLICT (org_id, name) DO NOTHING;

-- 4. 과거 미회차 DB 소급 묶음화 RPC (회사 관리자)
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
  v_linked INT;
  v_batch_title TEXT;
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;

  -- 같은 회사 동시 실행 방지 (트랜잭션 끝나면 풀림)
  PERFORM pg_advisory_xact_lock(hashtext('lm_retroactive_batch:' || v_org::text));

  -- import_batch_id가 없는 활성 리드를 유입경로 + 한국 시간 월 단위로 묶음
  FOR v_rec IN
    SELECT
      COALESCE(NULLIF(TRIM(c.inbound_path), ''), '직접 등록/미지정') AS vendor,
      date_trunc('month', c.created_at AT TIME ZONE 'Asia/Seoul') AS month_local,
      COALESCE(to_char(date_trunc('month', c.created_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM'), '등록일 없음') AS month_str,
      MAX(c.created_at) AS max_created
    FROM public.cases c
    WHERE c.org_id = v_org
      AND c.deleted_at IS NULL
      AND COALESCE(c.is_archived, false) = false
      AND COALESCE(c.status, '') <> '휴지통'
      AND c.import_batch_id IS NULL
    GROUP BY 1, 2, 3
    ORDER BY 2 DESC NULLS LAST
  LOOP
    INSERT INTO public.lead_import_batches (
      org_id, name, source, vendor_name, file_name, total_rows, inserted, created_at
    ) VALUES (
      v_org,
      v_rec.month_str || ' 소급 묶음 (' || v_rec.vendor || ')',
      v_rec.vendor,
      v_rec.vendor,
      '기존 데이터 소급 묶음',
      0,
      0,
      COALESCE(v_rec.max_created, now())
    ) RETURNING id INTO v_new_batch_id;

    UPDATE public.cases c
    SET import_batch_id = v_new_batch_id
    WHERE c.org_id = v_org
      AND c.deleted_at IS NULL
      AND COALESCE(c.is_archived, false) = false
      AND COALESCE(c.status, '') <> '휴지통'
      AND c.import_batch_id IS NULL
      AND COALESCE(NULLIF(TRIM(c.inbound_path), ''), '직접 등록/미지정') = v_rec.vendor
      AND date_trunc('month', c.created_at AT TIME ZONE 'Asia/Seoul') IS NOT DISTINCT FROM v_rec.month_local;
    GET DIAGNOSTICS v_linked = ROW_COUNT;

    IF v_linked = 0 THEN
      DELETE FROM public.lead_import_batches WHERE id = v_new_batch_id;
    ELSE
      UPDATE public.lead_import_batches
      SET total_rows = v_linked,
          inserted = v_linked,
          name = v_rec.month_str || ' 소급 묶음 (' || v_rec.vendor || ' ' || v_linked || '건)'
      WHERE id = v_new_batch_id;
      v_batch_count := v_batch_count + 1;
      v_case_count := v_case_count + v_linked;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'batches_created', v_batch_count,
    'cases_linked', v_case_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.retroactive_batch_existing_leads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retroactive_batch_existing_leads() TO authenticated;

COMMIT;
