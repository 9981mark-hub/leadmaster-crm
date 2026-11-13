-- =============================================
-- Migration: 020_dnc_and_smart_rotation
-- 작성: 2026-11-03 / 보안·재실행 점검 2026-11-13 [KIRO]
-- 선행: 013, 019
-- 목적:
--   1) 수신거부 / 통화거부(DNC - Do Not Call) 블랙리스트 (org_dnc_numbers)
--   2) 대량 엑셀 업로드 시 DNC 번호 사전 차단 (find_dnc_phones)
--   3) 연속 부재 / 장기 정체 리드 타 상담원 자동 교체 (auto_rotate_missed_cases)
-- 여러 번 실행해도 된다.
-- [2026-11-13 KIRO 변경]
--   - 정책: DROP POLICY IF EXISTS 후 생성(재실행 오류 방지), TO authenticated, anon 표 권한 회수
--   - find_dnc_phones: 넘어온 번호를 숫자만 남겨 비교 (저장은 숫자만, 엑셀은 010-1234-5678 형태) → 넘어온 원래 값으로 돌려줌
--   - register_dnc_number: 사유 값 확인, 번호 비교는 숫자만
--   - auto_rotate_missed_cases: p_min_missed_count가 쓰이지 않던 문제(설명대로 "정체 N시간 또는 부재 N회") 수정,
--     배정 기록 중복(트리거 + 직접 INSERT) 제거, 받은 상담원 last_assigned_at 갱신(행이 없으면 만듦 → 같은 사람만 계속 받던 문제)
--   - 함수 EXECUTE: anon 회수, 로그인 사용자만
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

CREATE INDEX IF NOT EXISTS idx_dnc_created ON public.org_dnc_numbers (org_id, created_at DESC);
-- (uq_org_dnc_phone 고유 인덱스가 (org_id, phone_number) 조회를 이미 처리 → 별도 idx_dnc_lookup 불필요)

ALTER TABLE public.org_dnc_numbers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lm_dnc_read ON public.org_dnc_numbers;
CREATE POLICY lm_dnc_read ON public.org_dnc_numbers
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.current_org_id()));

DROP POLICY IF EXISTS lm_dnc_insert ON public.org_dnc_numbers;
CREATE POLICY lm_dnc_insert ON public.org_dnc_numbers
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.current_org_id()));

DROP POLICY IF EXISTS lm_dnc_delete ON public.org_dnc_numbers;
CREATE POLICY lm_dnc_delete ON public.org_dnc_numbers
  FOR DELETE TO authenticated
  USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));

REVOKE ALL ON public.org_dnc_numbers FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.org_dnc_numbers TO authenticated;
DO $$
DECLARE s TEXT := pg_get_serial_sequence('public.org_dnc_numbers', 'id');
BEGIN
  IF s IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon', s);
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO authenticated', s);
  END IF;
END
$$;

-- ---------------------------------------------
-- 2. DNC 번호 등록 + 같은 번호 리드 '수신정지'
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
  v_clean_phone TEXT := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  v_reason TEXT := COALESCE(NULLIF(p_reason, ''), 'refusal');
BEGIN
  IF v_org IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION '회사 정보를 확인할 수 없습니다'; END IF;
  IF length(v_clean_phone) < 8 THEN RAISE EXCEPTION '올바른 전화번호가 아닙니다'; END IF;
  IF v_reason NOT IN ('refusal', 'wrong_number', 'abuse', 'invalid') THEN RAISE EXCEPTION '잘못된 사유입니다'; END IF;
  -- 지정 리드는 내가 볼 수 있는 리드여야 한다 (상담원은 본인 담당만)
  IF p_case_id IS NOT NULL AND NOT public.can_access_case(p_case_id) THEN
    RAISE EXCEPTION '이 리드에 접근할 수 없습니다';
  END IF;

  INSERT INTO public.org_dnc_numbers (org_id, phone_number, reason, source_case_id, note, registered_by, created_at)
  VALUES (v_org, v_clean_phone, v_reason, p_case_id, p_note, auth.uid(), now())
  ON CONFLICT (org_id, phone_number)
  DO UPDATE SET reason = EXCLUDED.reason, note = COALESCE(EXCLUDED.note, org_dnc_numbers.note);

  -- 같은 회사의 같은 번호(또는 지정 리드)를 '수신정지'로
  UPDATE public.cases
  SET status = '수신정지',
      updated_at = now()
  WHERE org_id = v_org
    AND COALESCE(status, '') <> '수신정지'
    AND ((p_case_id IS NOT NULL AND case_id = p_case_id)
         OR regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone);

  RETURN true;
END;
$$;

-- ---------------------------------------------
-- 3. 대량 전화번호 DNC 대조 (업로드 전 제외용)
--    돌려주는 phone_number = 넘어온 값 그대로 (화면이 자기 형식으로 찾을 수 있게)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.find_dnc_phones(p_phones TEXT[])
RETURNS TABLE (phone_number TEXT, reason TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.v, d.reason
  FROM unnest(COALESCE(p_phones, ARRAY[]::TEXT[])) AS p(v)
  JOIN public.org_dnc_numbers d
    ON d.org_id = public.current_org_id()
   AND d.phone_number = regexp_replace(COALESCE(p.v, ''), '[^0-9]', '', 'g');
$$;

-- ---------------------------------------------
-- 4. 연속 부재 / 정체 리드 담당자 자동 교체 (관리자)
--    대상: 상태 '부재' + (배정 후 p_stagnant_hours 지남 또는 부재 횟수 p_min_missed_count 이상)
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

  PERFORM public.lm_set_assign_reason('transfer', '연속 부재 스마트 자동 로테이션');

  FOR v_case IN
    SELECT c.case_id, c.assigned_user_id
    FROM public.cases c
    WHERE c.org_id = v_org
      AND c.deleted_at IS NULL
      AND COALESCE(c.is_archived, false) = false
      AND c.assigned_user_id IS NOT NULL
      AND c.status = '부재'
      AND (
        c.assigned_at IS NULL
        OR c.assigned_at <= v_now - make_interval(hours => GREATEST(COALESCE(p_stagnant_hours, 48), 1))
        OR COALESCE(c.missed_call_count, 0) >= GREATEST(COALESCE(p_min_missed_count, 3), 1)
      )
    ORDER BY c.assigned_at ASC NULLS FIRST
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 2000)
  LOOP
    v_next_user := NULL;
    SELECT m.user_id INTO v_next_user
    FROM public.org_members m
    LEFT JOIN public.org_agent_distribution d ON d.org_id = m.org_id AND d.user_id = m.user_id
    WHERE m.org_id = v_org
      AND m.status = 'active'
      AND m.role = 'agent'
      AND m.user_id <> v_case.assigned_user_id
      AND COALESCE(d.receiving, true) = true
    ORDER BY COALESCE(d.last_assigned_at, '1970-01-01'::timestamptz) ASC, m.user_id
    LIMIT 1;

    IF v_next_user IS NOT NULL THEN
      UPDATE public.cases
      SET assigned_user_id = v_next_user,
          assigned_at = v_now,
          updated_at = v_now
      WHERE org_id = v_org AND case_id = v_case.case_id;

      INSERT INTO public.org_agent_distribution (org_id, user_id, last_assigned_at, updated_at)
      VALUES (v_org, v_next_user, clock_timestamp(), v_now)
      ON CONFLICT (org_id, user_id) DO UPDATE SET last_assigned_at = clock_timestamp(), updated_at = v_now;

      v_rotated_count := v_rotated_count + 1;
    END IF;
  END LOOP;

  PERFORM public.lm_set_assign_reason(NULL, NULL);

  RETURN jsonb_build_object('success', true, 'rotated_count', v_rotated_count);
END;
$$;

REVOKE ALL ON FUNCTION public.register_dnc_number(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_dnc_phones(TEXT[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auto_rotate_missed_cases(INT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_dnc_number(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_dnc_phones(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_rotate_missed_cases(INT, INT, INT) TO authenticated;

COMMIT;
