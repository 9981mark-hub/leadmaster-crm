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

export interface MyAttendanceRecord {
  currentStatus: AttendanceStatus;
  clockInAt?: string;
  clockOutAt?: string;
  workDate?: string;
}

const attendanceErrorMessage = (err: any): string => {
  const msg = String(err?.message || err || '');
  if (/Could not find the function|function .* does not exist|PGRST202/i.test(msg) || err?.code === 'PGRST202') {
    return '근태 기능이 아직 서버에 준비되지 않았습니다. 관리자에게 문의해 주세요.';
  }
  if (/인증 정보|테넌트|JWT|not authenticated/i.test(msg)) {
    return '로그인 정보가 확인되지 않았습니다. 다시 로그인해 주세요.';
  }
  if (/Failed to fetch|NetworkError|network/i.test(msg)) {
    return '서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.';
  }
  return `근태 기록에 실패했습니다: ${msg || '알 수 없는 오류'}`;
};

/**
 * 내 오늘 근태 상태 전환 (출근, 이석, 식사, 퇴근)
 * [2026-11-13 KIRO] 서버 기록이 실패하면 예외(한국어 문구)를 던진다.
 * 예전에는 실패해도 브라우저에만 저장하고 성공처럼 돌려줘서 "출근 처리되었습니다"가 떴다.
 */
export const recordMyAttendanceStatus = async (
  status: AttendanceStatus,
  notes?: string
): Promise<MyAttendanceRecord> => {
  let data: any;
  try {
    const res = await need().rpc('record_agent_attendance_status', {
      p_status: status,
      p_notes: notes || null
    });
    if (res.error) throw res.error;
    data = res.data;
  } catch (err) {
    console.warn('[HR] record_agent_attendance_status failed:', err);
    throw new Error(attendanceErrorMessage(err));
  }
  return {
    currentStatus: ((data?.current_status as AttendanceStatus) || status),
    clockInAt: data?.clock_in_at || undefined,
    clockOutAt: data?.clock_out_at || undefined,
    workDate: data?.work_date || undefined,
  };
};

/** 내 오늘 근태 (서버 전광판에서 내 줄). 확인 못 하면 null */
export const fetchMyTodayAttendance = async (): Promise<MyAttendanceRecord | null> => {
  const me = loadCachedOrg()?.userId;
  if (!me || !supabase) return null;
  try {
    const { data, error } = await supabase.rpc('get_today_attendance_board');
    if (error) throw error;
    const row = (data || []).find((r: any) => r.user_id === me);
    if (!row) return { currentStatus: 'off' };
    return {
      currentStatus: (row.current_status || 'off') as AttendanceStatus,
      clockInAt: row.clock_in_at || undefined,
      clockOutAt: row.clock_out_at || undefined,
      workDate: row.work_date || undefined,
    };
  } catch (err) {
    console.warn('[HR] fetchMyTodayAttendance failed:', err);
    return null;
  }
};

/**
 * 월별 출근 일수 (agent_attendance_logs에서 clock_in_at이 있는 날 수). 'YYYY-MM'
 * 확인 못 하면 null (화면에서는 "-")
 */
export const fetchMonthlyAttendanceDays = async (month: string): Promise<Record<string, number> | null> => {
  const org = loadCachedOrg();
  if (!org?.orgId || !supabase || !/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  try {
    const { data, error } = await supabase
      .from('agent_attendance_logs')
      .select('user_id, work_date, clock_in_at')
      .eq('org_id', org.orgId)
      .gte('work_date', start)
      .lt('work_date', next)
      .not('clock_in_at', 'is', null);
    if (error) throw error;
    const days: Record<string, Set<string>> = {};
    (data || []).forEach((r: any) => {
      if (!days[r.user_id]) days[r.user_id] = new Set();
      days[r.user_id].add(String(r.work_date));
    });
    const out: Record<string, number> = {};
    Object.entries(days).forEach(([uid, set]) => { out[uid] = set.size; });
    return out;
  } catch (err) {
    console.warn('[HR] fetchMonthlyAttendanceDays failed:', err);
    return null;
  }
};

export interface MonthlyCallStats {
  totalCalls: number;
  totalDurationSeconds: number;
}

/**
 * 월별 상담원 발신 통화 수·통화 시간 (기존 RPC get_agent_performance_kpi = communication_logs CALL_OUT 집계).
 * 확인 못 하면 null (화면에서는 "-")
 */
export const fetchMonthlyCallStats = async (month: string): Promise<Record<string, MonthlyCallStats> | null> => {
  if (!supabase || !/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0);
  const endOfMonth = new Date(y, m, 1, 0, 0, 0);
  const end = endOfMonth.getTime() > Date.now() ? new Date() : new Date(endOfMonth.getTime() - 1);
  try {
    const { data, error } = await supabase.rpc('get_agent_performance_kpi', {
      p_start_date: start.toISOString(),
      p_end_date: end.toISOString(),
    });
    if (error) throw error;
    const out: Record<string, MonthlyCallStats> = {};
    (data || []).forEach((r: any) => {
      out[r.user_id] = {
        totalCalls: Number(r.total_calls || 0),
        totalDurationSeconds: Number(r.total_duration_seconds || 0),
      };
    });
    return out;
  } catch (err) {
    console.warn('[HR] fetchMonthlyCallStats failed:', err);
    return null;
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
    // [2026-11-13 KIRO] 실패를 빈 목록(= 전원 퇴근)으로 보이지 않게 예외로 올린다
    console.warn('[HR] get_today_attendance_board failed:', err);
    throw new Error(attendanceErrorMessage(err));
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
