// ============================================
// 회사(조직)·역할 정보 (멀티테넌트, 2026-11-01)
// DB: organizations / org_members / user_profiles / org_invites
//     RPC: accept_my_invites(), current_org_id(), current_org_role()
// ============================================
import { supabase } from './supabase';

export type OrgRole = 'owner' | 'admin' | 'agent';

export type AdminTier = 1 | 2 | 3;

export interface TeamAdminPermissions {
  canInviteMembers: boolean;       // 신규 상담원 초대 권한 (Tier 2+)
  canDisableMembers: boolean;      // 상담원 계정 정지/비활성화 (Tier 3+)
  canModifySecurity: boolean;      // 상담원 보안 프로필(마스킹 등) 수정 (Tier 3+)
  canModifyRules: boolean;         // 리드 분배 룰 및 수명주기 정책 수정 (Tier 3+)
  canViewPerformance: boolean;     // 상담원 인센티브/성과 보드 열람 (Tier 2+)
}

export interface SettlementAdminPermissions {
  allowReceivables: boolean;       // 미수금 및 분납 잔금 현황 열람 (기본 true)
  allowAgentCommission: boolean;   // 소속 팀원 인센티브/수당 상세 검토 권한 (기본 false)
  allowPartnerSettlement: boolean; // 제휴 법무법인 정산 수수료율 및 청구서 복사 (기본 false)
  allowDbCost: boolean;            // DB 구입 원가 및 대행사별 지출 단가 열람 (기본 false)
  allowIntegratedPnL: boolean;     // 전사 통합 경영 손익 (순영업이익/고정비) 열람 (기본 false)
}

export interface TelegramAdminPermissions {
  allowAccess: boolean;        // 텔레그램 연동 관제 센터 접근 허용
  viewScope: 'all' | 'team';   // 'all' (전사) | 'team' (담당 팀만)
  canManageRules: boolean;     // 자동화 룰(AI 파싱 및 상태 변경) 설정 권한 위임
  canBulkApprove: boolean;     // AI 추천 대량 일괄 승인 권한 위임
  canPurgeHistory: boolean;    // 보관 주기 지난 히스토리 영구 삭제 권한 위임
}

export interface NoticeAdminPermissions {
  allowAccess: boolean;         // 공지/업무지시 페이지 접근 허용
  noticeScope: 'all' | 'team';  // 공지 작성 대상 범위: 'all'(전사) vs 'team'(소속 팀만)
  directiveScope: 'all' | 'team'; // 업무 지시 하달 범위: 'all'(전사) vs 'team'(소속 팀원만)
  canCreateNotice: boolean;     // 공지사항 작성 권한
  canIssueDirective: boolean;   // 업무 지시 하달 권한
  canDeleteNotice: boolean;     // 공지사항 삭제 권한
}

export interface TrainingAdminPermissions {
  allowAccess: boolean;        // AI 트레이닝 관리/코칭 허브 접근 허용 여부
  viewScope: 'all' | 'team';   // 'all' (전사) | 'team' (소속 팀원만)
  canManageConfig: boolean;    // 전사 훈련 정책 및 첫인사 스크립트 설정 수정 권한
  canGrade: boolean;           // 모의 훈련 평가 등급(S~F) 및 코칭 피드백 작성 권한
}

export interface AdminPermissions {
  tier: AdminTier;
  team: TeamAdminPermissions;
  settlement: SettlementAdminPermissions;
  telegram: TelegramAdminPermissions;
  notice: NoticeAdminPermissions;
  training: TrainingAdminPermissions;
}

export const DEFAULT_TIER1_PERMISSIONS: AdminPermissions = {
  tier: 1,
  team: {
    canInviteMembers: false,
    canDisableMembers: false,
    canModifySecurity: false,
    canModifyRules: false,
    canViewPerformance: false,
  },
  settlement: {
    allowReceivables: true,
    allowAgentCommission: false,
    allowPartnerSettlement: false,
    allowDbCost: false,
    allowIntegratedPnL: false,
  },
  telegram: {
    allowAccess: true,
    viewScope: 'team',
    canManageRules: false,
    canBulkApprove: false,
    canPurgeHistory: false,
  },
  notice: {
    allowAccess: true,
    noticeScope: 'team',
    directiveScope: 'team',
    canCreateNotice: true,
    canIssueDirective: true,
    canDeleteNotice: false,
  },
  training: {
    allowAccess: true,
    viewScope: 'team',
    canManageConfig: false,
    canGrade: true,
  },
};

export const DEFAULT_TIER2_PERMISSIONS: AdminPermissions = {
  tier: 2,
  team: {
    canInviteMembers: true,
    canDisableMembers: false,
    canModifySecurity: false,
    canModifyRules: false,
    canViewPerformance: true,
  },
  settlement: {
    allowReceivables: true,
    allowAgentCommission: true,
    allowPartnerSettlement: false,
    allowDbCost: false,
    allowIntegratedPnL: false,
  },
  telegram: {
    allowAccess: true,
    viewScope: 'team',
    canManageRules: false,
    canBulkApprove: true,
    canPurgeHistory: false,
  },
  notice: {
    allowAccess: true,
    noticeScope: 'team',
    directiveScope: 'team',
    canCreateNotice: true,
    canIssueDirective: true,
    canDeleteNotice: false,
  },
  training: {
    allowAccess: true,
    viewScope: 'team',
    canManageConfig: false,
    canGrade: true,
  },
};

export const DEFAULT_TIER3_PERMISSIONS: AdminPermissions = {
  tier: 3,
  team: {
    canInviteMembers: true,
    canDisableMembers: true,
    canModifySecurity: true,
    canModifyRules: true,
    canViewPerformance: true,
  },
  settlement: {
    allowReceivables: true,
    allowAgentCommission: true,
    allowPartnerSettlement: true,
    allowDbCost: true,
    allowIntegratedPnL: false,
  },
  telegram: {
    allowAccess: true,
    viewScope: 'all',
    canManageRules: true,
    canBulkApprove: true,
    canPurgeHistory: false,
  },
  notice: {
    allowAccess: true,
    noticeScope: 'all',
    directiveScope: 'all',
    canCreateNotice: true,
    canIssueDirective: true,
    canDeleteNotice: true,
  },
  training: {
    allowAccess: true,
    viewScope: 'all',
    canManageConfig: true,
    canGrade: true,
  },
};

export const OWNER_FULL_PERMISSIONS: AdminPermissions = {
  tier: 3,
  team: {
    canInviteMembers: true,
    canDisableMembers: true,
    canModifySecurity: true,
    canModifyRules: true,
    canViewPerformance: true,
  },
  settlement: {
    allowReceivables: true,
    allowAgentCommission: true,
    allowPartnerSettlement: true,
    allowDbCost: true,
    allowIntegratedPnL: true,
  },
  telegram: {
    allowAccess: true,
    viewScope: 'all',
    canManageRules: true,
    canBulkApprove: true,
    canPurgeHistory: true,
  },
  notice: {
    allowAccess: true,
    noticeScope: 'all',
    directiveScope: 'all',
    canCreateNotice: true,
    canIssueDirective: true,
    canDeleteNotice: true,
  },
  training: {
    allowAccess: true,
    viewScope: 'all',
    canManageConfig: true,
    canGrade: true,
  },
};

export interface MemberSecurityProfile {
  watermark: boolean;         // 1. 화면 보안 워터마크
  appCaptureBlock: boolean;   // 2. 안드로이드 앱 캡처 차단 (FLAG_SECURE)
  masking: boolean;           // 3. 리드 목록 개인정보 마스킹 (전화번호/이름)
  anomalyAlert: boolean;      // 4. 비정상 대량 열람 시 대표 텔레그램 알림
}

// 신입/일반 상담원 기본값: 전체 보안 제한 활성화 (ON)
export const DEFAULT_AGENT_SECURITY_PROFILE: MemberSecurityProfile = {
  watermark: true,
  appCaptureBlock: true,
  masking: true,
  anomalyAlert: true,
};

// 팀장/신뢰 상담원 (또는 관리자/대표) 기본값: 전체 보안 제한 해제 (자율 권한 OFF)
export const TRUSTED_TEAM_LEAD_SECURITY_PROFILE: MemberSecurityProfile = {
  watermark: false,
  appCaptureBlock: false,
  masking: false,
  anomalyAlert: false,
};

export interface OrgInfo {
  userId: string;
  orgId: string;
  orgName: string;
  role: OrgRole;
  displayName?: string;
  isPlatformAdmin: boolean;
  uiMode?: 'standard' | 'lite_only';
  securityProfile?: MemberSecurityProfile;
  adminPermissions?: AdminPermissions;
  sessionRevokedAt?: string;
  teamName?: string;
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
  const userEmail = sessionData.session?.user?.email;
  if (!userId) throw new Error('no supabase session');

  // 초대 수락 (없으면 0건, 실패해도 다음 단계 진행)
  const { data: acceptedCount, error: inviteError } = await supabase.rpc('accept_my_invites');
  if (inviteError) {
    console.warn('[Org] accept_my_invites failed:', inviteError.message);
  } else {
    console.log('[Org] accept_my_invites result:', { acceptedCount, userEmail });
  }

  const { data: orgId, error: orgError } = await supabase.rpc('current_org_id');
  if (orgError) throw orgError;
  if (!orgId) {
    saveCachedOrg(null);
    return null;
  }

  const [{ data: role }, { data: org }, { data: member }, { data: profile }] = await Promise.all([
    supabase.rpc('current_org_role'),
    supabase.from('organizations').select('id, name').eq('id', orgId).maybeSingle(),
    supabase.from('org_members').select('display_name, ui_mode, security_profile, session_revoked_at, admin_permissions, team_name').eq('org_id', orgId).eq('user_id', userId).maybeSingle(),
    supabase.from('user_profiles').select('is_platform_admin').eq('user_id', userId).maybeSingle(),
  ]);

  const rawSec = member?.security_profile as MemberSecurityProfile | undefined;
  const secProfile: MemberSecurityProfile = rawSec 
    ? {
        watermark: rawSec.watermark ?? true,
        appCaptureBlock: rawSec.appCaptureBlock ?? true,
        masking: rawSec.masking ?? true,
        anomalyAlert: rawSec.anomalyAlert ?? true,
      }
    : (isAdminRole(role as OrgRole) ? TRUSTED_TEAM_LEAD_SECURITY_PROFILE : DEFAULT_AGENT_SECURITY_PROFILE);

  // 대표는 무조건 전권 허용, 관리자는 저장된 권한 또는 Tier 1 기본값
  const currentRole = (role as OrgRole) || 'agent';
  let permissions: AdminPermissions | undefined = undefined;
  if (currentRole === 'owner') {
    permissions = OWNER_FULL_PERMISSIONS;
  } else if (currentRole === 'admin') {
    const raw = (member as any)?.admin_permissions || DEFAULT_TIER1_PERMISSIONS;
    permissions = {
      ...raw,
      team: { ...DEFAULT_TIER1_PERMISSIONS.team, ...(raw.team || {}) },
      settlement: { ...DEFAULT_TIER1_PERMISSIONS.settlement, ...(raw.settlement || {}) },
      telegram: { ...DEFAULT_TIER1_PERMISSIONS.telegram, ...(raw.telegram || {}) },
      notice: { ...DEFAULT_TIER1_PERMISSIONS.notice, ...(raw.notice || {}) },
      training: { ...DEFAULT_TIER1_PERMISSIONS.training, ...(raw.training || {}) },
    };
  }

  const info: OrgInfo = {
    userId,
    orgId: String(orgId),
    orgName: org?.name || '',
    role: currentRole,
    displayName: member?.display_name || undefined,
    isPlatformAdmin: !!profile?.is_platform_admin,
    uiMode: (member?.ui_mode as 'standard' | 'lite_only') || 'standard',
    securityProfile: secProfile,
    adminPermissions: permissions,
    sessionRevokedAt: member?.session_revoked_at || undefined,
    teamName: (member as any)?.team_name || '1팀',
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

  // [SECURITY FIX] 탭 세션 스토리지에 보관된 고객 케이스 민감정보 완전 소각
  try {
    sessionStorage.removeItem('lm_cases');
    sessionStorage.clear();
  } catch (e) {
    console.warn('[Org] sessionStorage clear failed:', e);
  }

  localStorage.setItem(CACHE_OWNER_KEY, owner);
  console.log(`[Org] Cache owner changed → cleared ${toRemove.length} local cache keys and purged sessionStorage`);
  return true;
};
