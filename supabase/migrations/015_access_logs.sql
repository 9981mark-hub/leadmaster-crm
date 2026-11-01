-- =============================================
-- Migration: 015_access_logs
-- 작성: 2026-11-01
-- 선행: 004 (current_org_id, current_org_role, is_org_admin, is_platform_admin)
-- 목적: 개인정보 접근 기록 — 누가 언제 어떤 리드를 열람·내보내기·휴지통·영구 삭제·녹음 재생했는지
--   1) 웹이 작은 INSERT만 한다 (결과를 돌려받지 않음 → 대역폭 거의 없음)
--   2) 보기: 회사 관리자 = 자기 회사, 플랫폼 관리자 = 전체. 상담원은 못 봄
--   3) 고치기·지우기 정책 없음 → 한 번 쌓인 기록은 웹·앱에서 바꿀 수 없다
--   4) 365일 지난 기록은 pg_cron이 매일 지운다 (cron 확장이 있을 때만 예약, 없으면 조용히 건너뜀)
-- 적용해도 기존 데이터·동작은 바뀌지 않는다. 여러 번 실행해도 된다. 되돌리기: 맨 아래 [ROLLBACK]
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. 기록 테이블
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_logs (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id       UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL DEFAULT auth.uid(),          -- 한 사람 (계정이 지워져도 기록은 남김: FK 없음)
  actor_email  TEXT DEFAULT (auth.jwt() ->> 'email'),     -- 계정이 지워져도 누군지 알 수 있게
  action       TEXT NOT NULL CHECK (action IN (
                 'case_view', 'export', 'case_trash', 'case_restore', 'case_purge',
                 'recording_play', 'recording_download')),
  case_id      TEXT CHECK (case_id IS NULL OR length(case_id) <= 200),
  item_count   INT CHECK (item_count IS NULL OR item_count >= 0),   -- 내보낸 행 수, 여러 건 한꺼번에 처리한 건수
  detail       JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(detail) <= 16384),  -- 파일 이름 등 (너무 큰 값으로 DB를 채우지 못하게)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.access_logs IS '개인정보 접근 기록 (015). 웹은 INSERT만, 보기는 회사 관리자·플랫폼 관리자. 365일 보관';
CREATE INDEX IF NOT EXISTS access_logs_org_created_idx ON public.access_logs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS access_logs_org_case_idx ON public.access_logs (org_id, case_id);

-- 로그인 사용자가 넣는 기록은 시각·이메일을 서버 값으로 고정 (기록 날짜·사람을 꾸미지 못하게)
-- 서버(서비스 키·DB 직접)에서 넣는 경우는 넣은 값 그대로
CREATE OR REPLACE FUNCTION public.access_logs_stamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_at := now();
    NEW.actor_email := auth.jwt() ->> 'email';
  END IF;
  IF NEW.detail IS NULL THEN NEW.detail := '{}'::jsonb; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS access_logs_stamp ON public.access_logs;
CREATE TRIGGER access_logs_stamp BEFORE INSERT ON public.access_logs
  FOR EACH ROW EXECUTE FUNCTION public.access_logs_stamp();

-- ---------------------------------------------
-- 2. 접근 규칙
-- ---------------------------------------------
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- 넣기: 본인 이름으로, 지금 회사로만. 사용 중인 멤버만
-- (current_org_id()는 사용 중(active) 멤버십만 돌려주고, current_org_role()도 사용 중일 때만 값이 있다)
DROP POLICY IF EXISTS access_logs_insert ON public.access_logs;
CREATE POLICY access_logs_insert ON public.access_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT public.current_org_id())
    AND user_id = (SELECT auth.uid())
    AND (SELECT public.current_org_role()) IS NOT NULL
  );

-- 보기: 회사 관리자(대표·관리자)는 자기 회사 기록, 플랫폼 관리자는 전체
DROP POLICY IF EXISTS access_logs_select ON public.access_logs;
CREATE POLICY access_logs_select ON public.access_logs
  FOR SELECT TO authenticated
  USING (
    (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()))
    OR (SELECT public.is_platform_admin())
  );
-- UPDATE·DELETE 정책 없음 = 아무도 못 고치고 못 지움 (보관 기간 정리는 아래 예약 작업이 DB 소유자 권한으로)

-- Supabase 기본 권한(새 표에 ALL)을 걷어내고 필요한 것만
REVOKE ALL ON public.access_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.access_logs TO authenticated;
-- 번호표(identity)는 INSERT 때 권한 없이도 쓰인다 → 직접 쓸 권한은 모두 회수
DO $$
DECLARE s TEXT := pg_get_serial_sequence('public.access_logs', 'id');
BEGIN
  IF s IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', s);
  END IF;
END
$$;

-- ---------------------------------------------
-- 3. 보관 기간: 365일 지난 기록을 매일 03:20(한국 시간 = UTC 18:20) 삭제
--    pg_cron이 없으면 건너뛴다. 이미 예약돼 있으면 새로 만들지 않는다.
-- ---------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lm-access-log-retention') THEN
        PERFORM cron.schedule(
          'lm-access-log-retention',
          '20 18 * * *',
          $cmd$DELETE FROM public.access_logs WHERE created_at < now() - interval '365 days'$cmd$
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '접근 기록 보관 기간 예약을 건너뜀: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron 없음: 접근 기록 보관 기간 예약을 건너뜀 (확장을 켠 뒤 015를 다시 실행하면 예약됨)';
  END IF;
END
$$;

COMMIT;

-- =============================================
-- [ROLLBACK] (필요할 때만. 기록이 모두 사라진다)
-- BEGIN;
-- SELECT cron.unschedule('lm-access-log-retention') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lm-access-log-retention');  -- pg_cron이 있을 때
-- DROP TABLE IF EXISTS public.access_logs;
-- DROP FUNCTION IF EXISTS public.access_logs_stamp();
-- COMMIT;
-- =============================================
