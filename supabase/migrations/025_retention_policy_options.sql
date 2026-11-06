-- =============================================
-- Migration: 025_retention_policy_options
-- 작성: 2026-11-06
-- 선행: 004, 014, 015
-- 목적: 데이터 보존 기간(6개월 / 1년 / 2년) 다원화 및 자동 정리 거버넌스
--   1) org_recording_settings.retention_days (180, 365, 730일) 연동
--   2) organizations 테이블에 access_log_retention_days 컬럼 추가 (기본 365일, 180~730일)
--   3) pg_cron 매일 실행 작업: 회사별 설정 보존 기간에 따른 access_logs 자동 정리
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. 회사 테이블에 감사 로그 보관 주기 컬럼 추가
-- ---------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS access_log_retention_days INT NOT NULL DEFAULT 365;

COMMENT ON COLUMN public.organizations.access_log_retention_days IS '개인정보 접근 기록 보관 기간(일): 180(6개월), 365(1년), 730(2년)';

-- ---------------------------------------------
-- 2. 회사별 설정에 맞춘 접근 감사 로그 자동 정리 함수
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_access_logs_by_policy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 회사별 access_log_retention_days(기본 365일)가 지난 기록 삭제
  DELETE FROM public.access_logs l
  USING public.organizations o
  WHERE l.org_id = o.id
    AND l.created_at < now() - (COALESCE(o.access_log_retention_days, 365) || ' days')::interval;

  -- 소속 회사가 삭제되었거나 없는 고아 로그는 365일 기준으로 정리
  DELETE FROM public.access_logs
  WHERE org_id NOT IN (SELECT id FROM public.organizations)
    AND created_at < now() - interval '365 days';
END;
$$;

-- ---------------------------------------------
-- 3. pg_cron 예약 작업 갱신
-- ---------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    BEGIN
      -- 기존 단순 365일 삭제 작업 해제 후 동적 함수로 재예약
      PERFORM cron.unschedule('lm-access-log-retention')
        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lm-access-log-retention');
      
      PERFORM cron.schedule(
        'lm-access-log-retention',
        '20 18 * * *',  -- 매일 03:20 KST (18:20 UTC)
        'SELECT public.cleanup_access_logs_by_policy();'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron 작업 재예약 건너뜀: %', SQLERRM;
    END;
  END IF;
END;
$$;

COMMIT;
