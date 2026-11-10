// ============================================
// HR 근태 및 급여/인센티브 서비스 (flex.team 벤치마킹)
// ============================================
import { supabase } from './supabase';
import { loadCachedOrg } from './org';
import { Case } from '../types';

export type AttendanceStatus = 'working' | 'away' | 'meal' | 'off';

export interface AttendanceItem {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  workDate: string;
  clockInAt?: string;
  clockOutAt?: string;
  currentStatus: AttendanceStatus;
  statusUpdatedAt?: string;
  totalWorkMinutes: number;
  isLate: boolean;
}

export interface PayrollTierRule {
  min: number;
  max: number;
  fee: number; // 원 단위 (예: 100,000)
}

export interface AgentPayrollProfile {
  userId: string;
  salaryType: 'pure_incentive' | 'base_plus_incentive' | 'tiered';
  baseSalary: number;            // 기본급 (원)
  unitIncentive: number;         // 건당 기본 인센티브 (원, 기본 150,000)
  incentiveRate: number;         // 수임료 비율 (%, 예: 10.0)
  tierRules: PayrollTierRule[];  // 구간식 요율
  dailyAllowance: number;        // 출근 일비 (원, 예: 10,000)
  bonusAllowance: number;        // 만근 보너스 / 특별 수당 (원)
  taxType: 'freelancer_3_3' | 'four_insurances' | 'none';
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
}

export const DEFAULT_PAYROLL_PROFILE: Omit<AgentPayrollProfile, 'userId'> = {
  salaryType: 'pure_incentive',
  baseSalary: 0,
  unitIncentive: 150000,
  incentiveRate: 0,
  tierRules: [
    { min: 1, max: 3, fee: 100000 },
    { min: 4, max: 6, fee: 150000 },
    { min: 7, max: 999, fee: 250000 }
  ],
  dailyAllowance: 0,
  bonusAllowance: 0,
  taxType: 'freelancer_3_3'
};

export interface AgentPayrollCalculation {
  userId: string;
  displayName: string;
  attendanceDays: number;
  totalCallDurationSeconds: number;
  totalCalls: number;
  contractCount: number;
  totalFeeRevenue: number;
  basePay: number;
  incentivePay: number;
  allowancePay: number;
  grossPay: number; // 세전 총 지급액
  taxDeduction: number; // 3.3% 등 세금 공제액
  netPay: number; // 세후 실지급액
  profile: AgentPayrollProfile;
  contractItems: {
    caseId: string;
    customerName: string;
    caseType: string;
    contractAt: string;
    contractFee: number;
    incentiveFee: number;
  }[];
}

const need = () => {
  if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
  return supabase;
};

// ============================================
// 근태 RPC & API
// ============================================

/** 내 오늘 근태 상태 전환 (출근, 이석, 식사, 퇴근) */
export const recordMyAttendanceStatus = async (
  status: AttendanceStatus,
  notes?: string
): Promise<any> => {
  try {
    const { data, error } = await need().rpc('record_agent_attendance_status', {
      p_status: status,
      p_notes: notes || null
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('[HR] record_agent_attendance_status fallback:', err);
    // 로컬 스토리지에 임시 저장 (오프라인 지원)
    localStorage.setItem('lm_my_attendance_status', status);
    return { current_status: status };
  }
};

/** 오늘자 전 직원 근태 전광판 조회 */
export const fetchTodayAttendanceBoard = async (): Promise<AttendanceItem[]> => {
  try {
    const { data, error } = await need().rpc('get_today_attendance_board');
    if (error) throw error;
    return (data || []).map((row: any) => ({
      userId: row.user_id,
      displayName: row.display_name,
      email: row.email,
      role: row.role,
      workDate: row.work_date,
      clockInAt: row.clock_in_at,
      clockOutAt: row.clock_out_at,
      currentStatus: (row.current_status || 'off') as AttendanceStatus,
      statusUpdatedAt: row.status_updated_at,
      totalWorkMinutes: Number(row.total_work_minutes) || 0,
      isLate: Boolean(row.is_late)
    }));
  } catch (err) {
    console.warn('[HR] get_today_attendance_board fallback:', err);
    return [];
  }
};

// ============================================
// 급여 프로필 설정 API
// ============================================

/** 전 직원 급여 프로필 목록 조회 */
export const fetchAllPayrollProfiles = async (): Promise<Record<string, AgentPayrollProfile>> => {
  try {
    const org = loadCachedOrg();
    if (!org?.orgId) return {};

    const { data, error } = await need()
      .from('agent_payroll_profiles')
      .select('*')
      .eq('org_id', org.orgId);

    if (error) throw error;

    const map: Record<string, AgentPayrollProfile> = {};
    (data || []).forEach((row: any) => {
      map[row.user_id] = {
        userId: row.user_id,
        salaryType: row.salary_type || 'pure_incentive',
        baseSalary: Number(row.base_salary) || 0,
        unitIncentive: Number(row.unit_incentive) || 150000,
        incentiveRate: Number(row.incentive_rate) || 0,
        tierRules: Array.isArray(row.tier_rules) ? row.tier_rules : DEFAULT_PAYROLL_PROFILE.tierRules,
        dailyAllowance: Number(row.daily_allowance) || 0,
        bonusAllowance: Number(row.bonus_allowance) || 0,
        taxType: row.tax_type || 'freelancer_3_3',
        bankName: row.bank_name,
        accountNumber: row.account_number,
        accountHolder: row.account_holder
      };
    });
    return map;
  } catch (err) {
    console.warn('[HR] fetchAllPayrollProfiles fallback:', err);
    return {};
  }
};

/** 상담원별 급여 프로필 저장 */
export const saveAgentPayrollProfile = async (
  profile: AgentPayrollProfile
): Promise<void> => {
  const org = loadCachedOrg();
  if (!org?.orgId) throw new Error('조직 정보가 없습니다.');

  const payload = {
    org_id: org.orgId,
    user_id: profile.userId,
    salary_type: profile.salaryType,
    base_salary: profile.baseSalary,
    unit_incentive: profile.unitIncentive,
    incentive_rate: profile.incentiveRate,
    tier_rules: profile.tierRules,
    daily_allowance: profile.dailyAllowance,
    bonus_allowance: profile.bonusAllowance,
    tax_type: profile.taxType,
    bank_name: profile.bankName,
    account_number: profile.accountNumber,
    account_holder: profile.accountHolder,
    updated_at: new Date().toISOString()
  };

  const { error } = await need()
    .from('agent_payroll_profiles')
    .upsert(payload, { onConflict: 'org_id, user_id' });

  if (error) throw error;
};

// ============================================
// 정밀 급여 연산 엔진
// ============================================

/**
 * 특정 상담원의 근태, 활동, 실적, 급여 프로필을 조합하여 최종 급여 및 세금 산출
 */
export const computeAgentPayroll = (
  userId: string,
  displayName: string,
  profile: AgentPayrollProfile | undefined,
  agentCases: Case[],
  attendanceDays: number = 0,
  callDurationSeconds: number = 0,
  totalCalls: number = 0
): AgentPayrollCalculation => {
  const prof: AgentPayrollProfile = profile || {
    ...DEFAULT_PAYROLL_PROFILE,
    userId
  };

  // 1. 해당 상담원의 수임 완료(계약 체결) 사건 추출
  const contractedCases = agentCases.filter(c => c.contractAt && (c.contractFee || 0) > 0);
  const contractCount = contractedCases.length;
  const totalFeeRevenue = contractedCases.reduce((s, c) => s + (c.contractFee || 0) * 10000, 0);

  // 2. 인센티브 산출
  let incentivePay = 0;
  const contractItems: AgentPayrollCalculation['contractItems'] = [];

  if (prof.salaryType === 'pure_incentive' || prof.salaryType === 'base_plus_incentive') {
    // 건당 정액 또는 수임료 비율
    contractedCases.forEach(c => {
      let fee = prof.unitIncentive;
      if (prof.incentiveRate > 0 && c.contractFee) {
        fee = Math.round((c.contractFee * 10000) * (prof.incentiveRate / 100));
      }
      incentivePay += fee;
      contractItems.push({
        caseId: c.caseId,
        customerName: c.customerName,
        caseType: c.contractType || c.caseType || '개인회생',
        contractAt: c.contractAt || '-',
        contractFee: c.contractFee || 0,
        incentiveFee: fee
      });
    });
  } else if (prof.salaryType === 'tiered') {
    // 구간별 계단식 인센티브 (예: 1~3건 10만, 4~6건 15만, 7건+ 25만)
    contractedCases.forEach((c, idx) => {
      const order = idx + 1; // 1번째 계약, 2번째 계약...
      const matchedTier = prof.tierRules.find(t => order >= t.min && order <= t.max);
      const fee = matchedTier ? matchedTier.fee : prof.unitIncentive;
      incentivePay += fee;
      contractItems.push({
        caseId: c.caseId,
        customerName: c.customerName,
        caseType: c.contractType || c.caseType || '개인회생',
        contractAt: c.contractAt || '-',
        contractFee: c.contractFee || 0,
        incentiveFee: fee
      });
    });
  }

  // 3. 기본급 및 수당 산출
  const basePay = prof.salaryType === 'base_plus_incentive' ? prof.baseSalary : 0;
  const allowancePay = (attendanceDays * prof.dailyAllowance) + (prof.bonusAllowance || 0);

  // 4. 총 지급액 (세전)
  const grossPay = basePay + incentivePay + allowancePay;

  // 5. 공제액 산출 (프리랜서 3.3% 원천징수 등)
  let taxDeduction = 0;
  if (prof.taxType === 'freelancer_3_3') {
    // 사업소득세 3% + 지방소득세 0.3% = 3.3% (원 단위 절사)
    taxDeduction = Math.floor(grossPay * 0.033);
  } else if (prof.taxType === 'four_insurances') {
    // 4대보험 간이 추정 (약 9.3%)
    taxDeduction = Math.floor(grossPay * 0.0932);
  }

  // 6. 실지급액 (세후)
  const netPay = Math.max(0, grossPay - taxDeduction);

  return {
    userId,
    displayName,
    attendanceDays,
    totalCallDurationSeconds: callDurationSeconds,
    totalCalls,
    contractCount,
    totalFeeRevenue,
    basePay,
    incentivePay,
    allowancePay,
    grossPay,
    taxDeduction,
    netPay,
    profile: prof,
    contractItems
  };
};
