-- =============================================
-- Migration: 020_dnc_and_smart_rotation
-- 작성: 2026-11-03
-- 선행: 013, 019
-- 목적:
--   1) 수신거부 / 통화거부(DNC - Do Not Call) 블랙리스트 레지스트리 (org_dnc_numbers)
--   2) 대량 엑셀 업로드 시 DNC 번호 사전 일괄 차단 (find_dnc_phones)
--   3) 연속 부재 / 장기 정체 리드 타 상담원 자동 교체 (auto_rotate_missed_cases)
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. DNC 블랙리스트 테이블
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_dnc_numbers (
  id                  BIGSERIAL PRIMARY KEY,
  org_id              UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_number        TEXT NOT NULL,
  reason              TEXT NOT NULL DEFAULT 'refusal' CHECK (reason IN ('refusal', 'wrong_number', 'abuse', 'invalid')),
  registered_by       UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  source_case_id      TEXT,
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_org_dnc_phone UNIQUE (org_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_dnc_lookup ON public.org_dnc_numbers (org_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_dnc_created ON public.org_dnc_numbers (org_id, created_at DESC);

-- RLS 활성화
ALTER TABLE public.org_dnc_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY lm_dnc_read ON public.org_dnc_numbers
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

CREATE POLICY lm_dnc_insert ON public.org_dnc_numbers
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY lm_dnc_delete ON public.org_dnc_numbers
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());

-- ---------------------------------------------
-- 2. DNC 번호 등록 및 케이스 수신정지 동기화 RPC
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.register_dnc_number(
  p_phone TEXT,
  p_reason TEXT DEFAULT 'refusal',
  p_case_id TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := public.current_org_id();
  v_clean_phone TEXT;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION '회사 정보를 확인할 수 없습니다'; END IF;
  
  v_clean_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF length(v_clean_phone) < 8 THEN
    RAISE EXCEPTION '올바른 전화번호가 아닙니다';
  END IF;

  -- 1) DNC 테이블에 등록
  INSERT INTO public.org_dnc_numbers (org_id, phone_number, reason, source_case_id, note, registered_by, created_at)
  VALUES (v_org, v_clean_phone, p_reason, p_case_id, p_note, auth.uid(), now())
  ON CONFLICT (org_id, phone_number) 
  DO UPDATE SET reason = EXCLUDED.reason, note = COALESCE(EXCLUDED.note, org_dnc_numbers.note);

  -- 2) 연결된 케이스의 상태를 '수신정지'로 변경
  UPDATE public.cases
  SET status = '수신정지',
      updated_at = now()
  WHERE org_id = v_org 
    AND (case_id = p_case_id OR phone = p_phone OR regexp_replace(phone, '[^0-9]', '', 'g') = v_clean_phone);

  RETURN true;
END;
$$;

-- ---------------------------------------------
-- 3. 대량 전화번호 DNC 대조 RPC (업로드 시 사전 제외용)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.find_dnc_phones(p_phones TEXT[])
RETURNS TABLE (phone_number TEXT, reason TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.phone_number, d.reason
  FROM public.org_dnc_numbers d
  WHERE d.org_id = public.current_org_id()
    AND d.phone_number = ANY (p_phones);
$$;

-- ---------------------------------------------
-- 4. 연속 부재 / 정체 리드 스마트 로테이션(담당자 자동 교체) RPC
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_rotate_missed_cases(
  p_min_missed_count INT DEFAULT 3,
  p_stagnant_hours INT DEFAULT 48,
  p_limit INT DEFAULT 200
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := public.current_org_id();
  v_case RECORD;
  v_next_user UUID;
  v_rotated_count INT := 0;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_org IS NULL OR NOT public.is_org_admin() THEN 
    RAISE EXCEPTION '관리자만 로테이션을 실행할 수 있습니다'; 
  END IF;

  -- 대상 케이스: 상태가 '부재'이고, 배정된 지 p_stagnant_hours 경과했거나 통화 시도가 3회 이상인 건
  FOR v_case IN
    SELECT c.case_id, c.assigned_user_id
    FROM public.cases c
    WHERE c.org_id = v_org
      AND c.deleted_at IS NULL
      AND c.assigned_user_id IS NOT NULL
      AND c.status = '부재'
      AND (c.assigned_at IS NULL OR c.assigned_at <= v_now - (p_stagnant_hours || ' hours')::INTERVAL)
    ORDER BY c.assigned_at ASC NULLS FIRST
    LIMIT p_limit
  LOOP
    -- 다른 활성 상담원 중 1명 라운드로빈 선택 (현재 담당자 제외)
    SELECT m.user_id INTO v_next_user
    FROM public.org_members m
    LEFT JOIN public.org_agent_distribution d ON d.org_id = m.org_id AND d.user_id = m.user_id
    WHERE m.org_id = v_org
      AND m.status = 'active'
      AND m.role = 'agent'
      AND m.user_id <> v_case.assigned_user_id
      AND COALESCE(d.receiving, true) = true
    ORDER BY COALESCE(d.last_assigned_at, '1970-01-01'::timestamptz) ASC
    LIMIT 1;

    IF v_next_user IS NOT NULL THEN
      -- 담당자 교체
      UPDATE public.cases
      SET assigned_user_id = v_next_user,
          assigned_at = v_now,
          updated_at = v_now
      WHERE case_id = v_case.case_id;

      -- 배정 로그 기록
      INSERT INTO public.case_assignment_logs (org_id, case_id, from_user, to_user, reason, note, by_user, created_at)
      VALUES (v_org, v_case.case_id, v_case.assigned_user_id, v_next_user, 'transfer', '연속 부재 스마트 자동 로테이션', auth.uid(), v_now);

      -- 마지막 배정 시각 갱신
      UPDATE public.org_agent_distribution
      SET last_assigned_at = v_now, updated_at = v_now
      WHERE org_id = v_org AND user_id = v_next_user;

      v_rotated_count := v_rotated_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'rotated_count', v_rotated_count
  );
END;
$$;

COMMIT;
