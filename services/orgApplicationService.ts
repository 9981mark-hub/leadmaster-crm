// ============================================
// 신규 TM 회사 가입 신청 서비스 (옵션 A)
// DB: public.org_applications (Migration 036, 047)
// ============================================
import { supabase } from './supabase';
import { createOrganization } from './platform';
import { CURRENT_TERMS_VERSION } from './termsContent';

export interface OrgApplicationInput {
  companyName: string;
  ownerName?: string;
  ownerEmail: string;
  phone: string;
  agentCountTier?: '1-5' | '6-20' | '21+';
  memo?: string;
  selectedPlan?: string;
  businessNumber?: string;
  taxInvoiceEmail?: string;
  businessAddress?: string;
  agreedIp?: string;
  userAgent?: string;
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
  selectedPlan?: string;
  businessNumber?: string;
  taxInvoiceEmail?: string;
  paymentStatus?: 'pending' | 'paid' | 'trial' | 'exempt';
  paidAmount?: number;
  paidAt?: string;
  termsAgreedAt?: string;
  termsAgreedIp?: string;
  termsVersion?: string;
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

/** 신규 가입 신청서 및 약관 동의 제출 (전자계약 체결) */
export const submitOrgApplication = async (input: OrgApplicationInput): Promise<OrgApplication> => {
  const companyName = input.companyName.trim();
  const ownerName = (input.ownerName || '').trim() || `${companyName} 대표`;
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const phone = input.phone.trim();
  const agentCountTier = input.agentCountTier || '1-5';
  const memo = input.memo?.trim() || '';
  const selectedPlan = input.selectedPlan || 'starter';
  const businessNumber = input.businessNumber?.trim() || '';
  const taxInvoiceEmail = input.taxInvoiceEmail?.trim().toLowerCase() || ownerEmail;
  const termsVersion = CURRENT_TERMS_VERSION;
  const agreedIp = input.agreedIp || '127.0.0.1';
  const userAgent = input.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown');
  const now = new Date().toISOString();

  if (!companyName) throw new Error('회사명(또는 상호)을 입력해주세요.');
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
    selectedPlan,
    businessNumber,
    taxInvoiceEmail,
    status: 'pending',
    paymentStatus: 'pending',
    termsAgreedAt: now,
    termsAgreedIp: agreedIp,
    termsVersion,
    createdAt: now,
  };

  // 1. Supabase RPC submit_org_application_with_terms 호출 (약관 감사 로그와 함께 트랜잭션 저장)
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('submit_org_application_with_terms', {
        p_company_name: companyName,
        p_owner_name: ownerName,
        p_owner_email: ownerEmail,
        p_phone: phone,
        p_agent_count_tier: agentCountTier,
        p_memo: memo,
        p_selected_plan: selectedPlan,
        p_business_number: businessNumber,
        p_tax_invoice_email: taxInvoiceEmail,
        p_terms_version: termsVersion,
        p_agreed_ip: agreedIp,
        p_user_agent: userAgent,
      });

      if (!error && data?.ok) {
        newApp.id = data.application_id || newApp.id;
        newApp.createdAt = data.agreed_at || newApp.createdAt;
      } else if (error) {
        console.warn('[OrgApp] RPC submit failed, trying fallback insert:', error.message);
        // Fallback: 일반 insert
        const { data: fallbackData } = await supabase
          .from('org_applications')
          .insert({
            company_name: companyName,
            owner_name: ownerName,
            owner_email: ownerEmail,
            phone,
            agent_count_tier: agentCountTier,
            memo,
            status: 'pending',
            selected_plan: selectedPlan,
            business_number: businessNumber,
            tax_invoice_email: taxInvoiceEmail,
          })
          .select()
          .single();
        if (fallbackData) newApp.id = fallbackData.id;
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
          selectedPlan: r.selected_plan || 'starter',
          businessNumber: r.business_number || undefined,
          taxInvoiceEmail: r.tax_invoice_email || undefined,
          paymentStatus: r.payment_status || 'pending',
          paidAmount: r.paid_amount || 0,
          paidAt: r.paid_at || undefined,
          termsAgreedAt: r.terms_agreed_at || undefined,
          termsAgreedIp: r.terms_agreed_ip || undefined,
          termsVersion: r.terms_version || 'v1.0',
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

/** 플랫폼 관리자용: 입금 확인 처리 */
export const markApplicationPaid = async (applicationId: string, paidAmount: number): Promise<void> => {
  const now = new Date().toISOString();
  if (supabase) {
    try {
      await supabase
        .from('org_applications')
        .update({
          payment_status: 'paid',
          paid_amount: paidAmount,
          paid_at: now,
        })
        .eq('id', applicationId);
    } catch (e) {
      console.warn('[OrgApp] markApplicationPaid DB error:', e);
    }
  }

  const localList = getLocalApplications();
  const updated = localList.map(item => 
    item.id === applicationId 
      ? { ...item, paymentStatus: 'paid' as const, paidAmount, paidAt: now } 
      : item
  );
  saveLocalApplications(updated);
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
