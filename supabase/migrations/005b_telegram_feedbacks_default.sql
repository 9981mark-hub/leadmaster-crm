-- 005b: 전환기간 기본값 제거 (2026-11-01 운영 적용 완료)
-- 전제: telegram-webhook v31 이상(회사별 분리, INSERT에 org_id 직접 지정)이 배포돼 있을 것.
-- 효과: org_id 없이 저장하면 로그인 사용자의 회사로, 서버 키(service_role)로 회사 없이 저장하면 NOT NULL로 거부.
--       (예전엔 회사 없는 저장이 본사로 섞여 들어갔음)
ALTER TABLE public.telegram_feedbacks
  ALTER COLUMN org_id SET DEFAULT public.current_org_id();

-- [ROLLBACK]
-- ALTER TABLE public.telegram_feedbacks
--   ALTER COLUMN org_id SET DEFAULT COALESCE(public.current_org_id(), '00000000-0000-0000-0000-000000000001'::uuid);
