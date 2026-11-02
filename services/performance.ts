import { supabase } from './supabase';
import { Case } from '../types';

/** 계약 종류별 인센티브 규칙 (최대 10개) */
export interface IncentiveContractType {
  id: string;
  name: string;
  calcType: 'fixed' | 'percent'; // 고정 금액(원) vs 수임료 비율(%)
  amount: number;                // 고정 금액 (원, 예: 50,000)
  rate: number;                  // 수임료 비율 (%, 예: 5.0)
  isDefault?: boolean;           // 기본 계약 종류
  description?: string;          // 설명/메모
}

export type PayoutCycle = 'monthly' | 'weekly' | 'instant';

/** 인센티브 정산 기간 및 지급일 스케줄 */
export interface PayoutSchedule {
  cycle: PayoutCycle;

  // 월간 정산
  monthlyStartDay: number;       // 산정 시작일 (1 ~ 31, 기본: 1)
  monthlyEndDay: number;         // 산정 종료일 (0: 말일, 1 ~ 31, 기본: 0 = 말일)
  monthlyPayoutOffset: number;   // 지급 월 (0: 당월, 1: 익월(다음달), 2: 익익월, 기본: 1)
  monthlyPayoutDay: number;      // 지급일 (0: 말일, 1 ~ 31, 기본: 10 = 10일)

  // 주간 정산
  weeklyStartDay: number;        // 산정 시작 요일 (1: 월 ~ 7: 일, 기본: 1 = 월요일)
  weeklyEndDay: number;          // 산정 종료 요일 (1 ~ 7, 기본: 7 = 일요일)
  weeklyPayoutOffset: number;    // 지급 주 (0: 당주, 1: 차주(다음주), 기본: 1)
  weeklyPayoutDay: number;       // 지급 요일 (1: 월 ~ 7: 일, 기본: 5 = 금요일)
}

export interface IncentiveSettings {
  contractTypes: IncentiveContractType[]; // 최대 10개
  payoutSchedule: PayoutSchedule;

  // 레거시 호환 필드
  calcType?: 'fixed' | 'percent' | 'tiered';
  fixedAmount?: number;
  percentRate?: number;
  tieredRules?: Array<{ min: number; max?: number; amount?: number; rate?: number }>;
}

export const DEFAULT_CONTRACT_TYPES: IncentiveContractType[] = [
  { id: 'type_rehab', name: '개인회생 계약', calcType: 'fixed', amount: 50000, rate: 0, isDefault: true, description: '개인회생 건당 성과급' },
  { id: 'type_bankrupt', name: '개인파산 계약', calcType: 'fixed', amount: 70000, rate: 0, description: '개인파산 건당 성과급' },
  { id: 'type_recovery', name: '신용회복 / 워크아웃', calcType: 'fixed', amount: 30000, rate: 0, description: '신용회복 연계 지원' },
  { id: 'type_lawsuit', name: '일반 민·형사 소송', calcType: 'percent', amount: 0, rate: 5.0, description: '수임료 매출의 5%' },
];

export const DEFAULT_PAYOUT_SCHEDULE: PayoutSchedule = {
  cycle: 'monthly',
  monthlyStartDay: 1,
  monthlyEndDay: 0, // 말일
  monthlyPayoutOffset: 1, // 익월 (다음달)
  monthlyPayoutDay: 10, // 10일
  weeklyStartDay: 1, // 월요일
  weeklyEndDay: 7, // 일요일
  weeklyPayoutOffset: 1, // 차주 (다음주)
  weeklyPayoutDay: 5, // 금요일
};

export const DEFAULT_INCENTIVE_SETTINGS: IncentiveSettings = {
  contractTypes: DEFAULT_CONTRACT_TYPES,
  payoutSchedule: DEFAULT_PAYOUT_SCHEDULE,
  calcType: 'fixed',
  fixedAmount: 50000,
  percentRate: 3.0,
  tieredRules: [
    { min: 1, max: 5, amount: 50000 },
    { min: 6, max: 10, amount: 70000 },
    { min: 11, amount: 100000 },
  ],
};

const WEEKDAY_NAMES = ['', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

/** 정산 규칙 자연어 문구 생성 */
export const formatPayoutSchedule = (schedule: PayoutSchedule): string => {
  if (schedule.cycle === 'instant') {
    return '계약 체결 시 즉시(당일) 지급';
  }

  if (schedule.cycle === 'weekly') {
    const startW = WEEKDAY_NAMES[schedule.weeklyStartDay] || '월요일';
    const endW = WEEKDAY_NAMES[schedule.weeklyEndDay] || '일요일';
    const offsetW = schedule.weeklyPayoutOffset === 0 ? '당주' : schedule.weeklyPayoutOffset === 1 ? '다음 주' : `${schedule.weeklyPayoutOffset}주 뒤`;
    const payW = WEEKDAY_NAMES[schedule.weeklyPayoutDay] || '금요일';
    return `매주 ${startW}부터 ${endW}까지 발생한 인센티브는 ${offsetW} ${payW}에 지급`;
  }

  // monthly
  const startD = `${schedule.monthlyStartDay}일`;
  const endD = schedule.monthlyEndDay === 0 ? '말일' : `${schedule.monthlyEndDay}일`;
  const offsetM = schedule.monthlyPayoutOffset === 0 ? '당월' : schedule.monthlyPayoutOffset === 1 ? '다음 달' : `${schedule.monthlyPayoutOffset}달 뒤`;
  const payD = schedule.monthlyPayoutDay === 0 ? '말일' : `${schedule.monthlyPayoutDay}일`;

  return `매월 ${startD}부터 ${endD}까지 발생한 인센티브는 ${offsetM} ${payD}에 지급`;
};

/** 현재 기준 정산 회차 시작일, 종료일, 지급 예정일, D-Day 계산 */
export const getCurrentPayoutPeriod = (
  schedule: PayoutSchedule,
  refDate: Date = new Date()
): {
  startDate: string; // ISO
  endDate: string;   // ISO
  payoutDate: string; // YYYY-MM-DD
  dDay: number;
  label: string;
} => {
  const y = refDate.getFullYear();
  const m = refDate.getMonth(); // 0-indexed
  const d = refDate.getDate();

  if (schedule.cycle === 'weekly') {
    const dayOfWeek = refDate.getDay() || 7; // 1 (Mon) ~ 7 (Sun)
    const diffToStart = dayOfWeek - schedule.weeklyStartDay;
    const startDate = new Date(y, m, d - diffToStart, 0, 0, 0);

    const lengthDays = (schedule.weeklyEndDay - schedule.weeklyStartDay + 7) % 7;
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + lengthDays, 23, 59, 59);

    const payoutDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + (schedule.weeklyPayoutOffset * 7) + (schedule.weeklyPayoutDay - schedule.weeklyStartDay));
    const dDay = Math.ceil((payoutDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));

    const fmt = (dt: Date) => `${dt.getMonth() + 1}.${dt.getDate()}`;
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      payoutDate: payoutDate.toISOString().split('T')[0],
      dDay,
      label: `${fmt(startDate)} ~ ${fmt(endDate)} 주간 정산 회차`,
    };
  }

  if (schedule.cycle === 'instant') {
    const todayStr = refDate.toISOString().split('T')[0];
    return {
      startDate: new Date(y, m, d, 0, 0, 0).toISOString(),
      endDate: new Date(y, m, d, 23, 59, 59).toISOString(),
      payoutDate: todayStr,
      dDay: 0,
      label: '당일 즉시 지급',
    };
  }

  // Monthly
  let periodStartYear = y;
  let periodStartMonth = m;

  // 시작일이 1일이 아닌 경우 (예: 매월 21일 ~ 익월 20일)
  if (schedule.monthlyStartDay > 1 && d < schedule.monthlyStartDay) {
    // 아직 이번 달 시작일 이전이면 저번 달 시작일부터 이번 달 종료일까지가 현재 회차
    periodStartMonth = m - 1;
    if (periodStartMonth < 0) {
      periodStartMonth = 11;
      periodStartYear = y - 1;
    }
  }

  const startDate = new Date(periodStartYear, periodStartMonth, schedule.monthlyStartDay, 0, 0, 0);

  let endDate: Date;
  if (schedule.monthlyEndDay === 0) {
    // 시작월의 말일
    endDate = new Date(periodStartYear, periodStartMonth + 1, 0, 23, 59, 59);
  } else if (schedule.monthlyEndDay < schedule.monthlyStartDay) {
    // 예: 21일 시작 ~ 익월 20일 종료
    endDate = new Date(periodStartYear, periodStartMonth + 1, schedule.monthlyEndDay, 23, 59, 59);
  } else {
    endDate = new Date(periodStartYear, periodStartMonth, schedule.monthlyEndDay, 23, 59, 59);
  }

  // 지급일 계산
  const payoutMonth = periodStartMonth + schedule.monthlyPayoutOffset;
  let payoutDate: Date;
  if (schedule.monthlyPayoutDay === 0) {
    payoutDate = new Date(periodStartYear, payoutMonth + 1, 0);
  } else {
    payoutDate = new Date(periodStartYear, payoutMonth, schedule.monthlyPayoutDay);
  }

  const dDay = Math.ceil((payoutDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
  const label = `${periodStartYear}년 ${periodStartMonth + 1}월 정산 회차`;

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    payoutDate: payoutDate.toISOString().split('T')[0],
    dDay,
    label,
  };
};

export interface ContractBreakdownItem {
  typeId: string;
  typeName: string;
  count: number;
  feeRevenueManwon: number;
  incentiveAmount: number;
}

export interface AgentPerformanceKPI {
  userId: string;
  displayName: string;
  email: string;
  role: 'owner' | 'admin' | 'agent';
  status: 'active' | 'disabled';
  assignedCases: number;

  // 콜 활동
  totalCalls: number;
  connectedCalls: number;
  connectRate: number;              // %
  totalDurationSeconds: number;     // 초
  avgDurationSeconds: number;       // 초

  // 영업 진척
  remindersCount: number;
  transferredCount: number;
  transferRate: number;             // %

  // 계약 성과
  contractCount: number;
  contractRate: number;             // %
  totalFeeRevenue: number;          // 원

  // 산출된 예상 인센티브 및 종류별 세부내역
  estimatedIncentive: number;       // 원
  contractBreakdown: ContractBreakdownItem[];
}

const need = () => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다');
  return supabase;
};

/** 인센티브 설정 조회 */
export const fetchIncentiveSettings = async (): Promise<IncentiveSettings> => {
  try {
    const { data, error } = await need().from('org_incentive_settings').select('*').maybeSingle();
    if (error || !data) return DEFAULT_INCENTIVE_SETTINGS;

    const types: IncentiveContractType[] =
      data.contract_types && Array.isArray(data.contract_types) && data.contract_types.length > 0
        ? data.contract_types.map((t: any, idx: number) => ({
            id: t.id || `type_${idx}`,
            name: t.name || `계약 종류 ${idx + 1}`,
            calcType: t.calc_type === 'percent' ? 'percent' : 'fixed',
            amount: Number(t.amount || 0),
            rate: Number(t.rate || 0),
            isDefault: !!t.is_default,
            description: t.description || '',
          }))
        : DEFAULT_CONTRACT_TYPES;

    const payout: PayoutSchedule = data.payout_schedule
      ? {
          cycle: data.payout_schedule.cycle || 'monthly',
          monthlyStartDay: Number(data.payout_schedule.monthlyStartDay ?? 1),
          monthlyEndDay: Number(data.payout_schedule.monthlyEndDay ?? 0),
          monthlyPayoutOffset: Number(data.payout_schedule.monthlyPayoutOffset ?? 1),
          monthlyPayoutDay: Number(data.payout_schedule.monthlyPayoutDay ?? 10),
          weeklyStartDay: Number(data.payout_schedule.weeklyStartDay ?? 1),
          weeklyEndDay: Number(data.payout_schedule.weeklyEndDay ?? 7),
          weeklyPayoutOffset: Number(data.payout_schedule.weeklyPayoutOffset ?? 1),
          weeklyPayoutDay: Number(data.payout_schedule.weeklyPayoutDay ?? 5),
        }
      : DEFAULT_PAYOUT_SCHEDULE;

    return {
      contractTypes: types.slice(0, 10), // 최대 10개 보장
      payoutSchedule: payout,
      calcType: data.calc_type || 'fixed',
      fixedAmount: Number(data.fixed_amount || 50000),
      percentRate: Number(data.percent_rate || 3.0),
      tieredRules: data.tiered_rules || DEFAULT_INCENTIVE_SETTINGS.tieredRules,
    };
  } catch {
    return DEFAULT_INCENTIVE_SETTINGS;
  }
};

/** 인센티브 설정 저장 */
export const saveIncentiveSettings = async (settings: IncentiveSettings): Promise<void> => {
  // 최대 10개 제한
  const safeTypes = (settings.contractTypes || []).slice(0, 10).map((t, idx) => ({
    id: t.id || `type_${idx + 1}`,
    name: t.name.trim(),
    calc_type: t.calcType,
    amount: Math.max(0, Math.round(t.amount || 0)),
    rate: Math.max(0, Number(t.rate || 0)),
    is_default: !!t.isDefault,
    description: t.description || '',
  }));

  // 기본값 보장 (적어도 1개는 default)
  if (safeTypes.length > 0 && !safeTypes.some(t => t.is_default)) {
    safeTypes[0].is_default = true;
  }

  const { error } = await need().from('org_incentive_settings').upsert({
    contract_types: safeTypes,
    payout_schedule: settings.payoutSchedule,
    calc_type: safeTypes[0]?.calc_type || 'fixed',
    fixed_amount: safeTypes[0]?.amount || 50000,
    percent_rate: safeTypes[0]?.rate || 3.0,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};

/** 단일 케이스의 인센티브 계산 */
export const calculateSingleCaseIncentive = (
  c: { contractFee?: number; contractType?: string; incentiveTypeId?: string },
  contractTypes: IncentiveContractType[]
): { amount: number; matchedType: IncentiveContractType } => {
  const defaultType = contractTypes.find(t => t.isDefault) || contractTypes[0] || DEFAULT_CONTRACT_TYPES[0];

  // 1. ID 일치 확인
  let matched = contractTypes.find(t => t.id === c.incentiveTypeId);

  // 2. 이름 일치 확인 (예: '개인회생 계약' 또는 '개인회생')
  if (!matched && c.contractType) {
    matched = contractTypes.find(
      t => t.name.toLowerCase() === c.contractType?.toLowerCase() ||
           t.name.includes(c.contractType || '') ||
           (c.contractType || '').includes(t.name)
    );
  }

  const targetType = matched || defaultType;

  // 계산 (contractFee는 만원 단위)
  let amount = 0;
  if (targetType.calcType === 'fixed') {
    amount = targetType.amount;
  } else {
    // 수임료의 N%
    const feeWon = (c.contractFee || 0) * 10000;
    amount = Math.round(feeWon * (targetType.rate / 100));
  }

  return { amount, matchedType: targetType };
};

/** 상담원별 실시간 성과 KPI 집계 (계약 종류별 인센티브 정밀 계산 포함) */
export const fetchAgentPerformanceKPI = async (
  startDate?: string,
  endDate?: string,
  allCases: Case[] = []
): Promise<{ kpis: AgentPerformanceKPI[]; settings: IncentiveSettings }> => {
  const settings = await fetchIncentiveSettings();
  try {
    const { data, error } = await need().rpc('get_agent_performance_kpi', {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    });

    if (error) {
      console.warn('[Performance] RPC get_agent_performance_kpi failed:', error.message);
      return { kpis: [], settings };
    }

    const startTs = startDate ? new Date(startDate).getTime() : 0;
    const endTs = endDate ? new Date(endDate).getTime() : Infinity;

    // 기간 내 계약 완료된 케이스 필터링
    const contractedCases = allCases.filter(c => {
      if (c.status !== '계약 완료') return false;
      const at = c.contractAt || c.updatedAt || c.createdAt;
      const t = at ? new Date(at).getTime() : 0;
      return t >= startTs && t <= endTs;
    });

    const kpis: AgentPerformanceKPI[] = (data || []).map((r: any) => {
      const assigned = Number(r.assigned_cases || 0);
      const totalCalls = Number(r.total_calls || 0);
      const connectedCalls = Number(r.connected_calls || 0);
      const totalDuration = Number(r.total_duration_seconds || 0);
      const reminders = Number(r.reminders_count || 0);
      const transferred = Number(r.transferred_count || 0);
      const contracts = Number(r.contract_count || 0);
      const feeRevenue = Number(r.total_fee_revenue || 0);

      const connectRate = totalCalls > 0 ? Number(((connectedCalls / totalCalls) * 100).toFixed(1)) : 0;
      const avgDuration = connectedCalls > 0 ? Math.round(totalDuration / connectedCalls) : 0;
      const transferRate = assigned > 0 ? Number(((transferred / assigned) * 100).toFixed(1)) : 0;
      const contractRate = assigned > 0 ? Number(((contracts / assigned) * 100).toFixed(2)) : 0;

      // 해당 상담원의 실제 계약 케이스들로 종류별 인센티브 집계
      const agentCases = contractedCases.filter(c => c.assignedUserId === r.user_id);

      const breakdownMap = new Map<string, ContractBreakdownItem>();
      settings.contractTypes.forEach(t => {
        breakdownMap.set(t.id, {
          typeId: t.id,
          typeName: t.name,
          count: 0,
          feeRevenueManwon: 0,
          incentiveAmount: 0,
        });
      });

      let calculatedTotalIncentive = 0;

      if (agentCases.length > 0) {
        agentCases.forEach(c => {
          const { amount, matchedType } = calculateSingleCaseIncentive(c, settings.contractTypes);
          calculatedTotalIncentive += amount;

          const item = breakdownMap.get(matchedType.id);
          if (item) {
            item.count += 1;
            item.feeRevenueManwon += (c.contractFee || 0);
            item.incentiveAmount += amount;
          }
        });
      } else if (contracts > 0) {
        // 클라이언트 케이스 목록에 아직 미반영된 경우 RPC 기본 fallback
        const defType = settings.contractTypes[0] || DEFAULT_CONTRACT_TYPES[0];
        const singleAmount = defType.calcType === 'fixed' ? defType.amount : Math.round(((feeRevenue * 10000) / contracts) * (defType.rate / 100));
        calculatedTotalIncentive = contracts * singleAmount;
      }

      return {
        userId: r.user_id,
        displayName: r.display_name,
        email: r.email,
        role: r.role,
        status: r.status,
        assignedCases: assigned,
        totalCalls,
        connectedCalls,
        connectRate,
        totalDurationSeconds: totalDuration,
        avgDurationSeconds: avgDuration,
        remindersCount: reminders,
        transferredCount: transferred,
        transferRate,
        contractCount: contracts,
        contractRate,
        totalFeeRevenue: feeRevenue,
        estimatedIncentive: calculatedTotalIncentive,
        contractBreakdown: Array.from(breakdownMap.values()).filter(b => b.count > 0),
      };
    });

    return { kpis, settings };
  } catch (e: any) {
    console.error('[Performance] fetchAgentPerformanceKPI exception:', e);
    return { kpis: [], settings };
  }
};
