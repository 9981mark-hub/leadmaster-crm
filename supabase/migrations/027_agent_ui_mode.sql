-- =============================================
-- Migration: 027_agent_ui_mode
-- 작성: 2026-11-09 [AGY]
-- 목적: 신입 상담원을 위한 간편 콜 전용 모드(lite_only) 지원
--   1) org_members 테이블에 ui_mode 컬럼 추가 ('standard', 'lite_only')
--   2) list_org_members() RPC에 ui_mode 반환 추가
--   3) update_org_member() RPC에 p_ui_mode 파라미터 추가
-- =============================================

-- 1. ui_mode 컬럼 추가
ALTER TABLE public.org_members
ADD COLUMN IF NOT EXISTS ui_mode TEXT NOT NULL DEFAULT 'standard' CHECK (ui_mode IN ('standard', 'lite_only'));

-- 2. list_org_members RPC 갱신
DROP FUNCTION IF EXISTS public.list_org_members();

CREATE OR REPLACE FUNCTION public.list_org_members()
RETURNS TABLE(
  user_id uuid,
  email text,
  display_name text,
  role text,
  status text,
  joined_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  assigned_cases bigint,
  ui_mode text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT m.user_id,
         u.email::TEXT,
         COALESCE(NULLIF(m.display_name, ''), u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email::TEXT, '@', 1)),
         m.role,
         m.status,
         m.created_at,
         u.last_sign_in_at,
         (SELECT count(*) FROM public.cases c
          WHERE c.org_id = m.org_id AND c.assigned_user_id = m.user_id AND COALESCE(c.status, '') <> '휴지통'),
         COALESCE(m.ui_mode, 'standard')
  FROM public.org_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.org_id = public.current_org_id()
    AND (public.is_org_admin() OR m.user_id = auth.uid())
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, 3;
$$;

-- 3. update_org_member RPC 갱신
DROP FUNCTION IF EXISTS public.update_org_member(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.update_org_member(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_org_member(
  p_user_id uuid,
  p_role text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
  p_display_name text DEFAULT NULL::text,
  p_ui_mode text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org UUID := public.current_org_id();
  v_my_role TEXT := public.current_org_role();
  v_target_role TEXT;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION '소속 회사가 없습니다'; END IF;

  SELECT role INTO v_target_role FROM public.org_members WHERE org_id = v_org AND user_id = p_user_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION '같은 회사 멤버가 아닙니다'; END IF;

  -- 본인은 표시 이름만 바꿀 수 있다
  IF p_user_id = auth.uid() THEN
    IF p_role IS NOT NULL OR p_status IS NOT NULL OR p_ui_mode IS NOT NULL THEN
      RAISE EXCEPTION '본인의 역할·상태·업무모드는 바꿀 수 없습니다';
    END IF;
  ELSE
    IF v_my_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION '관리자만 변경할 수 있습니다'; END IF;
    -- 대표(owner) 관련 변경은 대표만
    IF (v_target_role = 'owner' OR p_role = 'owner') AND v_my_role <> 'owner' THEN
      RAISE EXCEPTION '대표 권한은 대표만 바꿀 수 있습니다';
    END IF;
  END IF;

  IF p_role IS NOT NULL AND p_role NOT IN ('owner', 'admin', 'agent') THEN RAISE EXCEPTION '잘못된 역할'; END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('active', 'disabled') THEN RAISE EXCEPTION '잘못된 상태'; END IF;
  IF p_ui_mode IS NOT NULL AND p_ui_mode NOT IN ('standard', 'lite_only') THEN RAISE EXCEPTION '잘못된 업무 모드'; END IF;

  UPDATE public.org_members
  SET role = COALESCE(p_role, role),
      status = COALESCE(p_status, status),
      display_name = CASE WHEN p_display_name IS NULL THEN display_name ELSE NULLIF(trim(p_display_name), '') END,
      ui_mode = COALESCE(p_ui_mode, ui_mode)
  WHERE org_id = v_org AND user_id = p_user_id;

  -- 회사에 대표가 최소 1명은 남아야 한다
  IF NOT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = v_org AND role = 'owner' AND status = 'active') THEN
    RAISE EXCEPTION '활성 대표가 최소 1명 있어야 합니다';
  END IF;
  RETURN true;
END;
$$;
