-- =============================================
-- Migration: 010_app_realtime_reminders
-- 작성: 2026-11-01
-- 선행: 004, 005
-- 목적: 앱(폰)의 서버 조회를 줄인다 (30대 운영 대비, 무료 플랜 대역폭 보호)
--   1) pending_sms, telegram_feedbacks를 Realtime에 추가
--      → 앱이 1~10초마다 묻는 대신, 새 행이 생기면 서버가 알려준다 (pending_calls는 이미 Realtime에 있음)
--      → 웹의 텔레그램 새 피드백 알림(INSERT 구독)도 이제 실제로 동작한다
--   2) upcoming_reminders(): 곧 다가오는(기본 15분 안) 미완료 일정만 돌려주는 함수
--      → 앱이 30초마다 일정 있는 리드 전체(약 190KB)를 받던 것을 대체
--      → SECURITY INVOKER: 호출한 사람의 RLS 그대로 (상담원은 본인 배정 리드만)
--      → 일정 시각 "YYYY-MM-DD HH:mm"은 한국 시간으로 해석
-- 데이터를 바꾸지 않는다. 되돌리기: 맨 아래 [ROLLBACK]
-- =============================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pending_sms') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_sms';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'telegram_feedbacks') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.telegram_feedbacks';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.upcoming_reminders(p_minutes INT DEFAULT 15)
RETURNS TABLE (case_id TEXT, customer_name TEXT, reminder_id TEXT, datetime TEXT, type TEXT, content TEXT)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.case_id, c.customer_name,
         r->>'id', r->>'datetime', r->>'type', r->>'content'
  FROM public.cases c
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(c.reminders) = 'array' THEN c.reminders ELSE '[]'::jsonb END
  ) AS r
  WHERE c.deleted_at IS NULL
    AND c.reminders IS NOT NULL
    AND c.reminders <> '[]'::jsonb
    AND coalesce(r->>'resultStatus', '') = ''
    -- 형식이 맞는 값만 시각으로 바꾼다 (CASE로 감싸 잘못된 값에서 형 변환 오류가 나지 않게)
    AND (CASE WHEN (r->>'datetime') ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$'
              THEN ((r->>'datetime')::timestamp AT TIME ZONE 'Asia/Seoul') END)
        BETWEEN now() - interval '1 minute' AND now() + make_interval(mins => LEAST(GREATEST(p_minutes, 1), 120))
$$;

REVOKE ALL ON FUNCTION public.upcoming_reminders(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upcoming_reminders(INT) TO authenticated;

COMMIT;

-- [ROLLBACK]
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.upcoming_reminders(INT);
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.pending_sms;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.telegram_feedbacks;
-- COMMIT;
