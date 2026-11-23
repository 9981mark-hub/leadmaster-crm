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

  // 🤝 급여 및 성과급 인센티브 연동 체계
  salaryType?: 'pure_incentive' | 'base_plus_incentive' | 'tiered'; // 성과급 유형
  baseSalary?: number;                // 기본급 (원)
  unitIncentive?: number;             // 건당 고정 인센티브 (원)
  incentiveRate?: number;             // 수임료 비율 (%)
  dailyAllowance?: number;            // 일비/식대 (원/일)
  bonusAllowance?: number;            // 만근 보너스 (원/월)
  taxType?: 'freelancer_3_3' | 'four_insurances' | 'none'; // 세금 공제 방식
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

  // Supabase agent_payroll_profiles 에서 계좌 및 인센티브 정보 조회
  let dbBankName = '';
  let dbAccountNumber = '';
  let dbAccountHolder = '';
  let dbSalaryType: MemberHrProfile['salaryType'] = undefined;
  let dbBaseSalary: number | undefined = undefined;
  let dbUnitIncentive: number | undefined = undefined;
  let dbIncentiveRate: number | undefined = undefined;
  let dbDailyAllowance: number | undefined = undefined;
  let dbBonusAllowance: number | undefined = undefined;
  let dbTaxType: MemberHrProfile['taxType'] = undefined;

  // 로컬 payroll 캐시도 확인
  try {
    const rawPayroll = localStorage.getItem(`leadmaster_payroll_${userId}`);
    if (rawPayroll) {
      const p = JSON.parse(rawPayroll);
      dbBankName = p.bankName || '';
      dbAccountNumber = p.accountNumber || '';
      dbAccountHolder = p.accountHolder || '';
      dbSalaryType = p.salaryType;
      dbBaseSalary = p.baseSalary;
      dbUnitIncentive = p.unitIncentive;
      dbIncentiveRate = p.incentiveRate;
      dbDailyAllowance = p.dailyAllowance;
      dbBonusAllowance = p.bonusAllowance;
      dbTaxType = p.taxType;
    }
  } catch {}

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('agent_payroll_profiles')
        .select('*')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        if (data.bank_name) dbBankName = data.bank_name;
        if (data.account_number) dbAccountNumber = data.account_number;
        if (data.account_holder) dbAccountHolder = data.account_holder;
        if (data.salary_type) dbSalaryType = data.salary_type;
        if (data.base_salary !== undefined) dbBaseSalary = Number(data.base_salary);
        if (data.unit_incentive !== undefined) dbUnitIncentive = Number(data.unit_incentive);
        if (data.incentive_rate !== undefined) dbIncentiveRate = Number(data.incentive_rate);
        if (data.daily_allowance !== undefined) dbDailyAllowance = Number(data.daily_allowance);
        if (data.bonus_allowance !== undefined) dbBonusAllowance = Number(data.bonus_allowance);
        if (data.tax_type) dbTaxType = data.tax_type;
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
    employmentType: localData.employmentType || (dbTaxType === 'freelancer_3_3' ? 'freelancer' : 'regular'),
    hireDate: localData.hireDate || '',
    bankName: dbBankName || localData.bankName || '',
    accountNumber: dbAccountNumber || localData.accountNumber || '',
    accountHolder: dbAccountHolder || localData.accountHolder || (localData.displayName || fallbackInfo?.displayName || ''),
    emergencyContactName: localData.emergencyContactName || '',
    emergencyContactRelation: localData.emergencyContactRelation || '',
    emergencyContactPhone: localData.emergencyContactPhone || '',
    notes: localData.notes || '',
    updatedAt: localData.updatedAt || new Date().toISOString(),

    // 인센티브 및 급여 체계 연동 값
    salaryType: dbSalaryType || localData.salaryType || 'pure_incentive',
    baseSalary: dbBaseSalary !== undefined ? dbBaseSalary : (localData.baseSalary || 0),
    unitIncentive: dbUnitIncentive !== undefined ? dbUnitIncentive : (localData.unitIncentive ?? 150000),
    incentiveRate: dbIncentiveRate !== undefined ? dbIncentiveRate : (localData.incentiveRate || 0),
    dailyAllowance: dbDailyAllowance !== undefined ? dbDailyAllowance : (localData.dailyAllowance || 0),
    bonusAllowance: dbBonusAllowance !== undefined ? dbBonusAllowance : (localData.bonusAllowance || 0),
    taxType: dbTaxType || localData.taxType || (localData.employmentType === 'freelancer' ? 'freelancer_3_3' : 'four_insurances')
  };
};

/**
 * 멤버 인사(HR) 프로필 저장 (인센티브 프로필과 양방향 연동)
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

  // 2. 인센티브/급여 체계(agent_payroll_profiles) 로컬 및 DB 상호 동기화
  const payrollCacheKey = `leadmaster_payroll_${profile.userId}`;
  try {
    const existingRaw = localStorage.getItem(payrollCacheKey);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const updatedPayroll = {
      ...existing,
      userId: profile.userId,
      bankName: profile.bankName || existing.bankName || '',
      accountNumber: profile.accountNumber || existing.accountNumber || '',
      accountHolder: profile.accountHolder || existing.accountHolder || profile.displayName || '',
      salaryType: profile.salaryType || existing.salaryType || 'pure_incentive',
      baseSalary: profile.baseSalary !== undefined ? profile.baseSalary : (existing.baseSalary || 0),
      unitIncentive: profile.unitIncentive !== undefined ? profile.unitIncentive : (existing.unitIncentive ?? 150000),
      incentiveRate: profile.incentiveRate !== undefined ? profile.incentiveRate : (existing.incentiveRate || 0),
      dailyAllowance: profile.dailyAllowance !== undefined ? profile.dailyAllowance : (existing.dailyAllowance || 0),
      bonusAllowance: profile.bonusAllowance !== undefined ? profile.bonusAllowance : (existing.bonusAllowance || 0),
      taxType: profile.taxType || (profile.employmentType === 'freelancer' ? 'freelancer_3_3' : existing.taxType || 'four_insurances'),
      updated_at: now
    };
    localStorage.setItem(payrollCacheKey, JSON.stringify(updatedPayroll));
  } catch {}

  // 3. Supabase agent_payroll_profiles에 급여 계좌 및 인센티브 연동 정보 일괄 upsert
  if (supabase) {
    try {
      const payrollPayload: any = {
        org_id: orgId,
        user_id: profile.userId,
        updated_at: now
      };
      if (profile.bankName !== undefined) payrollPayload.bank_name = profile.bankName || null;
      if (profile.accountNumber !== undefined) payrollPayload.account_number = profile.accountNumber || null;
      if (profile.accountHolder !== undefined) payrollPayload.account_holder = profile.accountHolder || null;
      if (profile.salaryType) payrollPayload.salary_type = profile.salaryType;
      if (profile.baseSalary !== undefined) payrollPayload.base_salary = profile.baseSalary;
      if (profile.unitIncentive !== undefined) payrollPayload.unit_incentive = profile.unitIncentive;
      if (profile.incentiveRate !== undefined) payrollPayload.incentive_rate = profile.incentiveRate;
      if (profile.dailyAllowance !== undefined) payrollPayload.daily_allowance = profile.dailyAllowance;
      if (profile.bonusAllowance !== undefined) payrollPayload.bonus_allowance = profile.bonusAllowance;
      if (profile.taxType) payrollPayload.tax_type = profile.taxType;

      const { error } = await supabase
        .from('agent_payroll_profiles')
        .upsert(payrollPayload, { onConflict: 'org_id, user_id' });

      if (error) {
        console.warn('[MemberHR] Payroll account & incentive sync warning:', error);
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
