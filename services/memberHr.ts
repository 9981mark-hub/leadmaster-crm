// ============================================
// 멤버 인사(HR) 정보 및 직원 관리 서비스
// ============================================
import { supabase } from './supabase';
import { loadCachedOrg } from './org';

export interface MemberHrProfile {
  userId: string;
  orgId: string;
  displayName: string;
  email: string;
  phone: string;                      // 전화번호 (휴대폰)
  birthDate?: string;                 // 생년월일 (YYYY-MM-DD)
  gender?: 'M' | 'F' | 'other' | '';  // 성별
  address?: string;                   // 자택 주소
  addressDetail?: string;             // 상세 주소
  jobTitle?: string;                  // 직위/직책 (예: 팀장, 수석, 대리, 주임)
  employmentType?: 'regular' | 'freelancer' | 'contract' | 'intern' | ''; // 고용 형태
  hireDate?: string;                  // 입사일 (YYYY-MM-DD)
  bankName?: string;                  // 급여 은행명
  accountNumber?: string;             // 급여 계좌번호
  accountHolder?: string;             // 예금주
  emergencyContactName?: string;      // 비상연락망 성명
  emergencyContactRelation?: string;  // 비상연락망 관계 (예: 부모, 배우자, 형제)
  emergencyContactPhone?: string;     // 비상연락처
  notes?: string;                     // 인사 특이사항 및 관리자 메모
  updatedAt?: string;
}

const STORAGE_PREFIX = 'leadmaster_member_hr_';

export const MAJOR_BANKS = [
  'KB국민은행',
  '신한은행',
  '하나은행',
  '우리은행',
  'NH농협은행',
  'IBK기업은행',
  '카카오뱅크',
  '토스뱅크',
  '케이뱅크',
  'SC제일은행',
  '씨티은행',
  '우체국',
  '새마을금고',
  '신협',
  '수협은행',
  '부산은행',
  '대구은행',
  '광주은행',
  '경남은행',
  '전북은행',
  '제주은행',
  '증권사(CMA/종금)',
  '기타'
];

/**
 * 입사일 기준 근속 기간 산출 유틸리티
 */
export const calculateTenure = (hireDate?: string): { days: number; text: string } => {
  if (!hireDate) return { days: 0, text: '입사일 미등록' };
  
  const start = new Date(hireDate);
  if (isNaN(start.getTime())) return { days: 0, text: '입사일 형식 오류' };
  
  const now = new Date();
  const diffTime = now.getTime() - start.getTime();
  const days = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  
  if (days === 0) return { days: 0, text: '오늘 입사 (1일차)' };
  
  const years = Math.floor(days / 365);
  const remainingDays = days % 365;
  const months = Math.floor(remainingDays / 30);
  
  let text = '';
  if (years > 0) {
    text = months > 0 ? `근속 ${years}년 ${months}개월 (${days}일차)` : `근속 ${years}년 (${days}일차)`;
  } else if (months > 0) {
    text = `근속 ${months}개월 (${days}일차)`;
  } else {
    text = `근속 ${days}일차`;
  }
  
  return { days, text };
};

/**
 * 특정 멤버의 인사(HR) 프로필 로드
 */
export const fetchMemberHrProfile = async (
  orgId: string,
  userId: string,
  fallbackInfo?: { displayName?: string; email?: string }
): Promise<MemberHrProfile> => {
  const profileKey = `${STORAGE_PREFIX}${orgId}_${userId}`;
  let localData: Partial<MemberHrProfile> = {};
  
  try {
    const raw = localStorage.getItem(profileKey);
    if (raw) {
      localData = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[MemberHR] Failed to read from localStorage:', err);
  }

  // Supabase agent_payroll_profiles 에서 계좌정보 조회
  let dbBankName = '';
  let dbAccountNumber = '';
  let dbAccountHolder = '';

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('agent_payroll_profiles')
        .select('bank_name, account_number, account_holder')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        dbBankName = data.bank_name || '';
        dbAccountNumber = data.account_number || '';
        dbAccountHolder = data.account_holder || '';
      }
    } catch (err) {
      console.warn('[MemberHR] Failed to load payroll profile from DB:', err);
    }
  }

  return {
    userId,
    orgId,
    displayName: localData.displayName || fallbackInfo?.displayName || '',
    email: localData.email || fallbackInfo?.email || '',
    phone: localData.phone || '',
    birthDate: localData.birthDate || '',
    gender: localData.gender || '',
    address: localData.address || '',
    addressDetail: localData.addressDetail || '',
    jobTitle: localData.jobTitle || '',
    employmentType: localData.employmentType || 'regular',
    hireDate: localData.hireDate || '',
    bankName: dbBankName || localData.bankName || '',
    accountNumber: dbAccountNumber || localData.accountNumber || '',
    accountHolder: dbAccountHolder || localData.accountHolder || (localData.displayName || fallbackInfo?.displayName || ''),
    emergencyContactName: localData.emergencyContactName || '',
    emergencyContactRelation: localData.emergencyContactRelation || '',
    emergencyContactPhone: localData.emergencyContactPhone || '',
    notes: localData.notes || '',
    updatedAt: localData.updatedAt || new Date().toISOString()
  };
};

/**
 * 멤버 인사(HR) 프로필 저장
 */
export const saveMemberHrProfile = async (
  orgId: string,
  profile: MemberHrProfile
): Promise<void> => {
  const profileKey = `${STORAGE_PREFIX}${orgId}_${profile.userId}`;
  const now = new Date().toISOString();
  const toSave: MemberHrProfile = {
    ...profile,
    updatedAt: now
  };

  // 1. 로컬 저장소 즉시 영속화
  try {
    localStorage.setItem(profileKey, JSON.stringify(toSave));
  } catch (err) {
    console.warn('[MemberHR] Failed to save to localStorage:', err);
  }

  // 2. Supabase agent_payroll_profiles에 급여 계좌 정보 동기화
  if (supabase && (profile.bankName || profile.accountNumber || profile.accountHolder)) {
    try {
      const { error } = await supabase
        .from('agent_payroll_profiles')
        .upsert({
          org_id: orgId,
          user_id: profile.userId,
          bank_name: profile.bankName || null,
          account_number: profile.accountNumber || null,
          account_holder: profile.accountHolder || null,
          updated_at: now
        }, { onConflict: 'org_id, user_id' });

      if (error) {
        console.warn('[MemberHR] Payroll account sync warning:', error);
      }
    } catch (err) {
      console.warn('[MemberHR] Failed to sync account to Supabase:', err);
    }
  }

  // 3. 실시간 UI 반영을 위한 브로드캐스트 이벤트
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('member_hr_updated', {
      detail: { orgId, userId: profile.userId, profile: toSave }
    }));
  }
};
