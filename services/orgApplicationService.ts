// ============================================
// 신규 TM 회사 가입 신청 서비스 (옵션 A)
// DB: public.org_applications (Migration 036)
// ============================================
import { supabase } from './supabase';
import { createOrganization } from './platform';

export interface OrgApplicationInput {
  companyName: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  agentCountTier?: '1-5' | '6-20' | '21+';
  memo?: string;
}

export interface OrgApplication {
  id: string;
  companyName: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  agentCountTier: '1-5' | '6-20' | '21+';
  memo?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  createdOrgId?: string;
}

const LOCAL_STORAGE_KEY = 'lm_org_applications_backup';

const getLocalApplications = (): OrgApplication[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalApplications = (list: OrgApplication[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('[OrgApp] local backup save failed', e);
  }
};

/** 신규 가입 신청서 제출 (비로그인 방문자 or 미초대 사용자) */
export const submitOrgApplication = async (input: OrgApplicationInput): Promise<OrgApplication> => {
  const companyName = input.companyName.trim();
  const ownerName = input.ownerName.trim();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const phone = input.phone.trim();
  const agentCountTier = input.agentCountTier || '1-5';
  const memo = input.memo?.trim() || '';

  if (!companyName) throw new Error('회사명을 입력해주세요.');
  if (!ownerName) throw new Error('대표자명을 입력해주세요.');
  if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    throw new Error('올바른 구글 이메일 형식을 입력해주세요.');
  }
  if (!phone) throw new Error('연락처(휴대폰 번호)를 입력해주세요.');

  const newApp: OrgApplication = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `app-${Date.now()}`,
    companyName,
    ownerName,
    ownerEmail,
    phone,
    agentCountTier,
    memo,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  // 1. Supabase 테이블 저장 시도
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('org_applications')
        .insert({
          company_name: companyName,
          owner_name: ownerName,
          owner_email: ownerEmail,
          phone,
          agent_count_tier: agentCountTier,
          memo,
          status: 'pending',
        })
        .select()
        .single();

      if (!error && data) {
        newApp.id = data.id;
        newApp.createdAt = data.created_at;
      } else if (error) {
        console.warn('[OrgApp] Supabase insert warning (falling back to local):', error.message);
      }
    } catch (e) {
      console.warn('[OrgApp] Supabase network error:', e);
    }
  }

  // 2. 로컬 백업 저장 (서버 마이그레이션 전이어도 유실 방지)
  const localList = getLocalApplications();
  localList.unshift(newApp);
  saveLocalApplications(localList);

  return newApp;
};

/** 플랫폼 관리자용: 가입 신청 목록 조회 */
export const fetchOrgApplications = async (): Promise<OrgApplication[]> => {
  let dbList: OrgApplication[] = [];

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('org_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        dbList = data.map((r: any) => ({
          id: r.id,
          companyName: r.company_name,
          ownerName: r.owner_name,
          ownerEmail: r.owner_email,
          phone: r.phone,
          agentCountTier: r.agent_count_tier,
          memo: r.memo || '',
          status: r.status,
          createdAt: r.created_at,
          approvedAt: r.approved_at || undefined,
          createdOrgId: r.created_org_id || undefined,
        }));
      }
    } catch (e) {
      console.warn('[OrgApp] fetchOrgApplications error:', e);
    }
  }

  // 로컬 백업과 병합 (중복 제거)
  const localList = getLocalApplications();
  const mergedMap = new Map<string, OrgApplication>();
  
  // 로컬 항목 먼저 넣고
  localList.forEach(item => mergedMap.set(item.id, item));
  // DB 항목으로 덮어씀 (DB가 최신 상태)
  dbList.forEach(item => mergedMap.set(item.id, item));

  return Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

/** 플랫폼 관리자용: 1클릭 가입 승인 (회사 생성 + 대표 초대 + 상태 업데이트) */
export const approveOrgApplication = async (application: OrgApplication): Promise<string> => {
  // 1. 실제 멀티테넌트 회사 생성 & 대표자 초대 발행
  const orgId = await createOrganization(
    application.companyName,
    application.ownerEmail,
    true // TM 표준 프리셋 적용
  );

  const now = new Date().toISOString();

  // 2. Supabase DB 상태 갱신
  if (supabase) {
    try {
      await supabase
        .from('org_applications')
        .update({
          status: 'approved',
          approved_at: now,
          created_org_id: orgId,
        })
        .eq('id', application.id);
    } catch (e) {
      console.warn('[OrgApp] approve update failed in DB:', e);
    }
  }

  // 3. 로컬 백업 상태 갱신
  const localList = getLocalApplications();
  const updated = localList.map(item => 
    item.id === application.id 
      ? { ...item, status: 'approved' as const, approvedAt: now, createdOrgId: orgId } 
      : item
  );
  saveLocalApplications(updated);

  return orgId;
};

/** 플랫폼 관리자용: 가입 신청 반려 */
export const rejectOrgApplication = async (applicationId: string): Promise<void> => {
  if (supabase) {
    try {
      await supabase
        .from('org_applications')
        .update({ status: 'rejected' })
        .eq('id', applicationId);
    } catch (e) {
      console.warn('[OrgApp] reject update failed in DB:', e);
    }
  }

  const localList = getLocalApplications();
  const updated = localList.map(item => 
    item.id === applicationId 
      ? { ...item, status: 'rejected' as const } 
      : item
  );
  saveLocalApplications(updated);
};
