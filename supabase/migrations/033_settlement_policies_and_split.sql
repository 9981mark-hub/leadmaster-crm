-- ============================================================
-- Migration: 033_settlement_policies_and_split.sql
-- Description: 차세대 통합 정산 & 경영 손익(v4.5)
--              회사별 수수료 분배 정책 및 이중 정산 주기(거래처 입금일 vs 상담원 지급일) 스키마
-- 선행: 004, 005
-- 여러 번 실행해도 된다.
-- [2026-11-13 KIRO 보안·재실행 점검]
--   - 예전 정책 FOR ALL USING (true) = 누구나(비로그인 포함) 모든 회사 정산 정책을 읽고 고칠 수 있었음
--     → 보기 = 같은 회사 멤버, 쓰기 = 회사 관리자만 (org_id = current_org_id())
--   - org_id: NOT NULL + 기본값 current_org_id() + organizations FK + UNIQUE(org_id)
--     웹(services/settlementMasterService.ts)은 org_id 를 넣고 upsert(onConflict: 'org_id') → UNIQUE(org_id) 필요
--   - 값 제한: 분배 방식·지급 주기 목록, 비율 0~100, 금액·지연일 0 이상, 지급일 0~31 (주급 = 요일 0~6, 월급 = 1~31)
--   - partners 칸 추가: information_schema 확인(스키마 구분 없음) 대신 ADD COLUMN IF NOT EXISTS
--   - anon 표 권한 회수
-- ============================================================

BEGIN;

-- 1. 회사별 정산 정책 설정 테이블 (회사당 1행)
CREATE TABLE IF NOT EXISTS public.org_settlement_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- 수수료 분배 룰
  split_model VARCHAR(30) DEFAULT 'ratio_split', -- 'ratio_split', 'margin_deduction', 'fixed_agent_incentive'
  company_share_ratio NUMERIC(5, 2) DEFAULT 40.0, -- 회사 몫 (%)
  agent_share_ratio NUMERIC(5, 2) DEFAULT 60.0,   -- 상담원 몫 (%)
  company_fixed_margin INT DEFAULT 300000,        -- 회사 고정 마진 (원)
  agent_fixed_incentive INT DEFAULT 150000,       -- 상담원 고정 수당 (원)

  -- 상담원 수당 지급 일정
  agent_payout_cycle VARCHAR(30) DEFAULT 'monthly_fixed', -- 'monthly_fixed', 'weekly_fixed', 'after_partner_deposit'
  agent_payout_day INT DEFAULT 10,                 -- 매월 10일 (or 매주 요일 0~6)
  payout_delay_days INT DEFAULT 3,                 -- 입금 확인 후 N일 이내

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT org_settlement_policies_org_id_key UNIQUE (org_id)
);

-- 예전 버전(기본값·FK·제약 없음)으로 이미 만들어진 표 맞추기
ALTER TABLE public.org_settlement_policies ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.org_settlement_policies ALTER COLUMN org_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.org_settlement_policies'::regclass AND contype = 'f'
                   AND confrelid = 'public.organizations'::regclass) THEN
    ALTER TABLE public.org_settlement_policies
      ADD CONSTRAINT org_settlement_policies_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  -- UNIQUE(org_id) (예전 버전은 칸 정의의 UNIQUE → 이름이 같음. 없을 때만 추가)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.org_settlement_policies'::regclass AND contype = 'u'
                   AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                                       WHERE attrelid = 'public.org_settlement_policies'::regclass
                                         AND attname = 'org_id')]::smallint[]) THEN
    ALTER TABLE public.org_settlement_policies
      ADD CONSTRAINT org_settlement_policies_org_id_key UNIQUE (org_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.org_settlement_policies'::regclass
                   AND conname = 'org_settlement_policies_values_check') THEN
    ALTER TABLE public.org_settlement_policies
      ADD CONSTRAINT org_settlement_policies_values_check CHECK (
        COALESCE(split_model, 'ratio_split') IN ('ratio_split', 'margin_deduction', 'fixed_agent_incentive')
        AND COALESCE(agent_payout_cycle, 'monthly_fixed') IN ('monthly_fixed', 'weekly_fixed', 'after_partner_deposit')
        AND COALESCE(company_share_ratio, 0) BETWEEN 0 AND 100
        AND COALESCE(agent_share_ratio, 0) BETWEEN 0 AND 100
        AND COALESCE(company_fixed_margin, 0) >= 0
        AND COALESCE(agent_fixed_incentive, 0) >= 0
        AND COALESCE(agent_payout_day, 1) BETWEEN 0 AND 31
        AND COALESCE(payout_delay_days, 0) BETWEEN 0 AND 365
      );
  END IF;
END
$$;

-- 2. partners 테이블 정산 주기 컬럼 확장 (개별 거래처 오버라이드 지원)
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS settlement_cycle VARCHAR(30) DEFAULT 'weekly';
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS settlement_day_of_week INT DEFAULT 1;     -- 1:월, 2:화, 3:수...
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS settlement_day_of_month INT DEFAULT 31;   -- 31:말일, 10:익월10일...
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS custom_commission_rate NUMERIC(5, 2) DEFAULT 20.0;

-- 3. Row Level Security (RLS)
ALTER TABLE public.org_settlement_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "osp_org_isolation" ON public.org_settlement_policies;

DROP POLICY IF EXISTS osp_member_read ON public.org_settlement_policies;
CREATE POLICY osp_member_read ON public.org_settlement_policies
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.current_org_id()));

DROP POLICY IF EXISTS osp_admin_insert ON public.org_settlement_policies;
CREATE POLICY osp_admin_insert ON public.org_settlement_policies
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

DROP POLICY IF EXISTS osp_admin_update ON public.org_settlement_policies;
CREATE POLICY osp_admin_update ON public.org_settlement_policies
  FOR UPDATE TO authenticated
  USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
  WITH CHECK (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

DROP POLICY IF EXISTS osp_admin_delete ON public.org_settlement_policies;
CREATE POLICY osp_admin_delete ON public.org_settlement_policies
  FOR DELETE TO authenticated
  USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

REVOKE ALL ON public.org_settlement_policies FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_settlement_policies TO authenticated;

COMMIT;
