-- =============================================
-- Migration: 011_disable_app_service_account
-- 작성: 2026-11-01
-- 선행: 004 (전환기간 동안 android-app@leadmaster.com = 본사 admin)
-- 전제: 모든 본사 폰이 앱 1.4.0 이상(공용 계정 코드 삭제, 사용자 로그인 세션으로만 동작)으로 업데이트됨
-- 목적: 비밀번호가 옛 APK 안에 평문으로 들어 있던 공용 계정을 완전히 막는다.
--   1) 본사 멤버십 사용 중지 → current_org_id() = NULL → 모든 RLS에서 0건
--   2) 로그인 차단(banned_until) + 남은 세션·갱신 토큰 무효화
-- 고객 데이터는 바꾸지 않는다. 되돌리기: 맨 아래 [ROLLBACK]
-- =============================================

BEGIN;

DO $$
DECLARE v_uid UUID;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'android-app@leadmaster.com';
  IF v_uid IS NULL THEN
    RAISE NOTICE '공용 계정 없음 (이미 삭제됨)';
    RETURN;
  END IF;
  UPDATE public.org_members SET status = 'disabled' WHERE user_id = v_uid;
  UPDATE auth.users SET banned_until = 'infinity'::timestamptz WHERE id = v_uid;
  UPDATE auth.refresh_tokens SET revoked = true WHERE user_id = v_uid::text AND revoked IS DISTINCT FROM true;
  DELETE FROM auth.sessions WHERE user_id = v_uid;
END $$;

COMMIT;

-- [ROLLBACK]
-- BEGIN;
-- UPDATE auth.users SET banned_until = NULL WHERE email = 'android-app@leadmaster.com';
-- UPDATE public.org_members SET status = 'active' WHERE user_id = (SELECT id FROM auth.users WHERE email = 'android-app@leadmaster.com');
-- COMMIT;
