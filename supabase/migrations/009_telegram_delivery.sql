-- =============================================
-- Migration: 009_telegram_delivery
-- 작성: 2026-11-01
-- 선행: 004, 005, 008
-- 목적: 리드 상세의 [텔레그램 전달] 버튼
--   - case_deliveries: 회사 봇이 변호사 사무실 방에 보낸 메시지 기록 (어느 리드를, 어느 방에, 메시지 번호, 누가)
--     → 사무실이 그 메시지에 "답장"하면 웹훅이 이름 검색 없이 바로 그 리드에 연결한다.
--     쓰기는 Edge Function(telegram-deliver, service_role)만. 사용자는 읽기만 (관리자 전체 / 상담원은 본인 배정 리드).
--   - org_telegram_chats: 회사 봇이 들어가 있는 텔레그램 방 목록 (웹훅이 자동 기록)
--     → 설정 화면에서 거래처에 방을 고를 수 있게 한다 (채팅방 ID 직접 찾기 불필요). 관리자만 읽기.
--   - 기존 피드백에 나온 방은 미리 채워 둔다.
-- 데이터를 지우거나 바꾸지 않는다(새 테이블 2개 + 방 목록 채우기). 되돌리기: 맨 아래 [ROLLBACK]
-- =============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.case_deliveries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id        TEXT NOT NULL REFERENCES public.cases(case_id) ON DELETE CASCADE,
  partner_id     TEXT,
  chat_id        TEXT NOT NULL,
  chat_title     TEXT,
  message_id     BIGINT NOT NULL,
  part_no        INT NOT NULL DEFAULT 1,      -- 긴 글을 나눠 보냈을 때 몇 번째 조각인지
  part_count     INT NOT NULL DEFAULT 1,
  sent_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_by_email  TEXT,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT case_deliveries_chat_message_key UNIQUE (org_id, chat_id, message_id)
);
CREATE INDEX IF NOT EXISTS case_deliveries_case_idx ON public.case_deliveries (case_id, sent_at DESC);

ALTER TABLE public.case_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lm_case_deliveries_read ON public.case_deliveries;
CREATE POLICY lm_case_deliveries_read ON public.case_deliveries FOR SELECT TO authenticated
  USING (org_id = (SELECT public.current_org_id())
         AND ((SELECT public.is_org_admin()) OR public.can_access_case(case_id)));
REVOKE ALL ON public.case_deliveries FROM anon, authenticated;
GRANT SELECT ON public.case_deliveries TO authenticated;

CREATE TABLE IF NOT EXISTS public.org_telegram_chats (
  org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  chat_id          TEXT NOT NULL,
  title            TEXT,
  chat_type        TEXT,            -- group / supergroup / private / channel
  bot_status       TEXT,            -- member / administrator / left / kicked (봇 초대·추방 시 갱신)
  migrated_to      TEXT,            -- 일반 그룹이 슈퍼그룹으로 바뀌면 새 방 ID
  last_message_at  TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, chat_id)
);
ALTER TABLE public.org_telegram_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lm_org_telegram_chats_admin_read ON public.org_telegram_chats;
CREATE POLICY lm_org_telegram_chats_admin_read ON public.org_telegram_chats FOR SELECT TO authenticated
  USING (org_id = (SELECT public.current_org_id()) AND (SELECT public.is_org_admin()));
REVOKE ALL ON public.org_telegram_chats FROM anon, authenticated;
GRANT SELECT ON public.org_telegram_chats TO authenticated;

-- 기존 피드백에 나온 방 미리 채우기
INSERT INTO public.org_telegram_chats (org_id, chat_id, title, last_message_at)
SELECT f.org_id, f.chat_id, (array_agg(f.chat_title ORDER BY f.created_at DESC))[1], max(f.created_at)
FROM public.telegram_feedbacks f
WHERE f.chat_id IS NOT NULL AND f.chat_id <> ''
GROUP BY f.org_id, f.chat_id
ON CONFLICT (org_id, chat_id) DO NOTHING;

COMMIT;

-- [ROLLBACK]
-- BEGIN;
-- DROP TABLE IF EXISTS public.org_telegram_chats;
-- DROP TABLE IF EXISTS public.case_deliveries;
-- COMMIT;
