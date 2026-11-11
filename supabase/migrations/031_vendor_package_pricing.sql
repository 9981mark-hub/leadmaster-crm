-- Migration: 031_vendor_package_pricing
-- 작성: 2026-11-11 [AGY]
-- 목적: DB 거래처 매입단가에 CPL(건당)뿐 아니라 대량 패키지 구매(N건당 N원, e.g. 3000건에 50만원) 방식 지원

BEGIN;

ALTER TABLE public.lead_vendors
  ADD COLUMN IF NOT EXISTS pricing_type TEXT NOT NULL DEFAULT 'cpl',
  ADD COLUMN IF NOT EXISTS package_leads INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS package_price BIGINT NOT NULL DEFAULT 0;

COMMIT;
