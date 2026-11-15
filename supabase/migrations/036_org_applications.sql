-- =============================================
-- Migration: 036_org_applications
-- 작성: 2026-11-15 (AGY)
-- 목적: 신규 TM 회사 대표 가입 신청 접수 및 관리자 1클릭 승인 체계
-- =============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name      TEXT NOT NULL,
  owner_name        TEXT NOT NULL,
  owner_email       TEXT NOT NULL,
  phone             TEXT NOT NULL,
  agent_count_tier  TEXT NOT NULL DEFAULT '1-5',
  memo              TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at       TIMESTAMPTZ,
  approved_by       UUID REFERENCES auth.users(id),
  created_org_id    UUID REFERENCES public.organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_org_applications_status ON public.org_applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_applications_email ON public.org_applications(owner_email);

-- Row Level Security
ALTER TABLE public.org_applications ENABLE ROW LEVEL SECURITY;

-- 1. 신규 방문자/신청자는 누구나 가입 신청서 등록(INSERT) 가능 (비로그인 anon 및 로그인 authenticated 모두 허용)
DROP POLICY IF EXISTS "Anyone can submit org applications" ON public.org_applications;
CREATE POLICY "Anyone can submit org applications"
  ON public.org_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 2. 플랫폼 총괄 관리자(HOST)는 모든 신청 내역 조회 및 업데이트(승인/반려) 가능
DROP POLICY IF EXISTS "Platform admins manage org applications" ON public.org_applications;
CREATE POLICY "Platform admins manage org applications"
  ON public.org_applications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND is_platform_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND is_platform_admin = true
    )
  );

COMMIT;
