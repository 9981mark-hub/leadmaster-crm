// ============================================
// 회사(조직)·역할 정보 (멀티테넌트, 2026-11-01)
// DB: organizations / org_members / user_profiles / org_invites
//     RPC: accept_my_invites(), current_org_id(), current_org_role()
// ============================================
import { supabase } from './supabase';

export type OrgRole = 'owner' | 'admin' | 'agent';

export interface OrgInfo {
  userId: string;
  orgId: string;
  orgName: string;
  role: OrgRole;
  displayName?: string;
  isPlatformAdmin: boolean;
}

export const HQ_ORG_ID = '00000000-0000-0000-0000-000000000001';

const ORG_CACHE_KEY = 'lm_org_info';
const CACHE_OWNER_KEY = 'lm_cache_owner';

export const isAdminRole = (role?: OrgRole | null): boolean => role === 'owner' || role === 'admin';

export const ROLE_LABEL: Record<OrgRole, string> = {
  owner: '대표',
  admin: '관리자',
  agent: '상담원',
};

export const loadCachedOrg = (): OrgInfo | null => {
  try {
    const raw = localStorage.getItem(ORG_CACHE_KEY);
    return raw ? (JSON.parse(raw) as OrgInfo) : null;
  } catch {
    return null;
  }
};

const saveCachedOrg = (info: OrgInfo | null) => {
  if (info) localStorage.setItem(ORG_CACHE_KEY, JSON.stringify(info));
  else localStorage.removeItem(ORG_CACHE_KEY);
};

/**
 * 로그인된 Supabase 세션 기준으로 회사·역할을 조회한다.
 * - 내 이메일로 온 초대가 있으면 먼저 수락한다.
 * - 소속 회사가 없으면 null.
 * - 네트워크 오류 등으로 확인 자체를 못 하면 예외를 던진다 (호출 쪽에서 캐시/기존 방식으로 대체).
 */
export const resolveOrg = async (): Promise<OrgInfo | null> => {
  if (!supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('no supabase session');

  // 초대 수락 (없으면 0건, 실패해도 다음 단계 진행)
  const { error: inviteError } = await supabase.rpc('accept_my_invites');
  if (inviteError) console.warn('[Org] accept_my_invites failed:', inviteError.message);

  const { data: orgId, error: orgError } = await supabase.rpc('current_org_id');
  if (orgError) throw orgError;
  if (!orgId) {
    saveCachedOrg(null);
    return null;
  }

  const [{ data: role }, { data: org }, { data: member }, { data: profile }] = await Promise.all([
    supabase.rpc('current_org_role'),
    supabase.from('organizations').select('id, name').eq('id', orgId).maybeSingle(),
    supabase.from('org_members').select('display_name').eq('org_id', orgId).eq('user_id', userId).maybeSingle(),
    supabase.from('user_profiles').select('is_platform_admin').eq('user_id', userId).maybeSingle(),
  ]);

  const info: OrgInfo = {
    userId,
    orgId: String(orgId),
    orgName: org?.name || '',
    role: (role as OrgRole) || 'agent',
    displayName: member?.display_name || undefined,
    isPlatformAdmin: !!profile?.is_platform_admin,
  };
  saveCachedOrg(info);
  return info;
};

export const clearOrgCache = () => saveCachedOrg(null);

// 회사·사용자가 바뀌면 지워야 하는 로컬 캐시 (업무 데이터)
// 인증·화면 설정(authToken, userProfile, app_version, 테마)은 남긴다.
const isDataCacheKey = (key: string) =>
  (key.startsWith('lm_') && key !== CACHE_OWNER_KEY && key !== ORG_CACHE_KEY) ||
  key.startsWith('leadmaster_') ||
  key === 'managerName';

/**
 * 이 브라우저의 로컬 캐시가 다른 사용자·회사 것이면 지운다.
 * 같은 PC에서 다른 계정으로 로그인했을 때 데이터가 섞이지 않게 한다.
 * @returns 캐시를 지웠으면 true (호출 쪽에서 데이터 재초기화 필요)
 */
export const ensureCacheOwner = (info: OrgInfo): boolean => {
  const owner = `${info.userId}:${info.orgId}`;
  const prev = localStorage.getItem(CACHE_OWNER_KEY);
  if (prev === owner) return false;

  // 멀티테넌트 이전부터 쓰던 본사 캐시는 그대로 이어서 쓴다 (불필요한 전체 재다운로드 방지)
  if (!prev && info.orgId === HQ_ORG_ID) {
    localStorage.setItem(CACHE_OWNER_KEY, owner);
    return false;
  }

  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isDataCacheKey(key)) toRemove.push(key);
  }
  toRemove.forEach(k => localStorage.removeItem(k));
  localStorage.setItem(CACHE_OWNER_KEY, owner);
  console.log(`[Org] Cache owner changed → cleared ${toRemove.length} local cache keys`);
  return true;
};
