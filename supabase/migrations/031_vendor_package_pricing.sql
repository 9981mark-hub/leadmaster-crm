-- Migration: 031_vendor_package_pricing
-- 작성: 2026-11-11 [AGY] / 점검 2026-11-13 [KIRO]
-- 선행: 030
-- 목적: DB 거래처 매입단가에 CPL(건당)뿐 아니라 대량 패키지 구매(N건당 N원, e.g. 3000건에 50만원) 방식 지원
-- 여러 번 실행해도 된다.
-- [2026-11-13 KIRO] pricing_type 값 제한(웹 services/vendor.ts: 'cpl' | 'package' | 'fixed'), 금액·건수 0 이상

BEGIN;

ALTER TABLE public.lead_vendors
  ADD COLUMN IF NOT EXISTS pricing_type TEXT NOT NULL DEFAULT 'cpl',
  ADD COLUMN IF NOT EXISTS package_leads INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS package_price BIGINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.lead_vendors'::regclass AND conname = 'lead_vendors_pricing_check') THEN
    ALTER TABLE public.lead_vendors
      ADD CONSTRAINT lead_vendors_pricing_check
      CHECK (pricing_type IN ('cpl', 'package', 'fixed')
             AND package_leads >= 0 AND package_price >= 0 AND default_unit_cost >= 0);
  END IF;
END
$$;

COMMIT;
