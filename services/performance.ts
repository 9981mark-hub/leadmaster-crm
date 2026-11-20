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

/** 1. 관리자(팀장) 오버라이딩 수당 규칙 */
export interface ManagerOverridingRule {
  enabled: boolean;
  type: 'fixed_per_case' | 'percent_of_fee';
  amountPerCase: number;      // 팀원 계약 1건당 관리수당 (원, 예: 10,000)
  feeRatePercent: number;     // 팀원 수임료의 비율 (%, 예: 1.5)
  teamMilestones?: {
    minTeamCases: number;     // 팀 합산 계약 최소 건수 (예: 20)
    bonusAmountWon: number;   // 팀 목표 달성 축하금 (예: 300,000)
  }[];
}

/** 2. 고성과자 구간별 추가 인센티브 규칙 (슬라이딩 스케일) */
export interface PerformanceTierRule {
  minCases: number;
  maxCases?: number;          // undefined면 이상
  extraAmountPerCase: number; // 건당 추가 지급액 (원, 예: 20,000, 50,000)
  tierName: string;
}

/** 3. 누적 계약 건수별 마일스톤 달성 보너스 */
export interface MilestoneBonusRule {
  reachCases: number;         // 10건, 20건 등
  bonusWon: number;           // 200,000원 등
}

/** 4. 상담원 개인별 맞춤 인센티브 (유연한 개인별 변동) */
export interface AgentCustomIncentiveRule {
  userId: string;
  useCustom: boolean;         // true: 전사 무시하고 개인 규칙 사용
  managerUserId?: string;     // 오버라이딩 수당을 수령할 담당 팀장(관리자) ID
  calcType: 'fixed' | 'percent' | 'hybrid';
  contractRates: Record<string, {
    amount?: number;          // 개인별 맞춤 금액 (원)
    rate?: number;            // 개인별 맞춤 비율 (%)
  }>;
  applySlidingBonus: boolean; // 고성과 구간 추가 보너스 참여 여부
  note?: string;              // 특이사항 메모
  effectiveMonth?: string;    // 적용 시작월 (YYYY-MM)
}

export interface IncentiveSettings {
  contractTypes: IncentiveContractType[]; // 최대 10개
  payoutSchedule: PayoutSchedule;
  managerOverriding: ManagerOverridingRule;
  slidingTiers: PerformanceTierRule[];
  milestones: MilestoneBonusRule[];
  agentOverrides?: Record<string, AgentCustomIncentiveRule>;

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

export const DEFAULT_MANAGER_OVERRIDING: ManagerOverridingRule = {
  enabled: true,
  type: 'fixed_per_case',
  amountPerCase: 10000, // 소속 팀원 계약 1건당 팀장에게 10,000원 오버라이드 지급
  feeRatePercent: 1.5,
  teamMilestones: [
    { minTeamCases: 20, bonusAmountWon: 300000 },
    { minTeamCases: 30, bonusAmountWon: 500000 },
  ],
};

export const DEFAULT_SLIDING_TIERS: PerformanceTierRule[] = [
  { minCases: 1, maxCases: 5, extraAmountPerCase: 0, tierName: '일반 구간 (1~5건)' },
  { minCases: 6, maxCases: 10, extraAmountPerCase: 20000, tierName: '우수 구간 (6~10건, 건당 +2만)' },
  { minCases: 11, maxCases: 20, extraAmountPerCase: 50000, tierName: '최우수 구간 (11~20건, 건당 +5만)' },
  { minCases: 21, extraAmountPerCase: 70000, tierName: '에이스 구간 (21건+, 건당 +7만)' },
];

export const DEFAULT_MILESTONES: MilestoneBonusRule[] = [
  { reachCases: 10, bonusWon: 200000 },
  { reachCases: 20, bonusWon: 500000 },
];

export const DEFAULT_INCENTIVE_SETTINGS: IncentiveSettings = {
  contractTypes: DEFAULT_CONTRACT_TYPES,
  payoutSchedule: DEFAULT_PAYOUT_SCHEDULE,
  managerOverriding: DEFAULT_MANAGER_OVERRIDING,
  slidingTiers: DEFAULT_SLIDING_TIERS,
  milestones: DEFAULT_MILESTONES,
  agentOverrides: {},
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

  // 산출된 인센티브 상세 구성
  baseIncentive: number;            // 기본 계약별 인센티브 (원)
  slidingBonus: number;             // 고성과 구간 추가 보너스 (원)
  milestoneBonus: number;           // 마일스톤 달성 축하금 (원)
  managerOverridingBonus: number;   // 관리자 오버라이딩 수당 (소속 팀원 계약분, 원)
  overridingDetails?: string;       // 오버라이딩 세부 설명
  isCustomApplied?: boolean;        // 개인 맞춤 규칙 적용 여부
  assignedManagerName?: string;     // 매핑된 담당 팀장 이름

  // 최종 총 예상 인센티브 (base + sliding + milestone + managerOverriding)
  estimatedIncentive: number;       // 원
  contractBreakdown: ContractBreakdownItem[];
}

const need = () => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다');
  return supabase;
};

const LOCAL_INCENTIVE_SETTINGS_KEY = 'lm_org_incentive_settings_v2';
const LOCAL_CUSTOM_INCENTIVES_KEY = 'lm_agent_custom_incentives_v2';

/** 상담원 개인별 맞춤 인센티브 전체 조회 */
export const fetchAgentCustomIncentives = (): Record<string, AgentCustomIncentiveRule> => {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_INCENTIVES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/** 상담원 개인별 맞춤 인센티브 저장 */
export const saveAgentCustomIncentive = async (rule: AgentCustomIncentiveRule): Promise<void> => {
  try {
    const map = fetchAgentCustomIncentives();
    map[rule.userId] = rule;
    localStorage.setItem(LOCAL_CUSTOM_INCENTIVES_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('[Performance] 개인별 인센티브 저장 실패:', e);
  }
};

/** 인센티브 설정 조회 */
export const fetchIncentiveSettings = async (): Promise<IncentiveSettings> => {
  let cached: Partial<IncentiveSettings> = {};
  try {
    const raw = localStorage.getItem(LOCAL_INCENTIVE_SETTINGS_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch {}

  const customOverrides = fetchAgentCustomIncentives();

  try {
    const { data, error } = await need().from('org_incentive_settings').select('*').maybeSingle();
    if (error || !data) {
      return {
        ...DEFAULT_INCENTIVE_SETTINGS,
        ...cached,
        agentOverrides: customOverrides,
      };
    }

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
        : (cached.contractTypes || DEFAULT_CONTRACT_TYPES);

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
      : (cached.payoutSchedule || DEFAULT_PAYOUT_SCHEDULE);

    const merged: IncentiveSettings = {
      contractTypes: types.slice(0, 10), // 최대 10개 보장
      payoutSchedule: payout,
      managerOverriding: data.manager_overriding || cached.managerOverriding || DEFAULT_MANAGER_OVERRIDING,
      slidingTiers: data.sliding_tiers || cached.slidingTiers || DEFAULT_SLIDING_TIERS,
      milestones: data.milestones || cached.milestones || DEFAULT_MILESTONES,
      agentOverrides: customOverrides,
      calcType: data.calc_type || 'fixed',
      fixedAmount: Number(data.fixed_amount || 50000),
      percentRate: Number(data.percent_rate || 3.0),
      tieredRules: data.tiered_rules || DEFAULT_INCENTIVE_SETTINGS.tieredRules,
    };

    return merged;
  } catch {
    return {
      ...DEFAULT_INCENTIVE_SETTINGS,
      ...cached,
      agentOverrides: customOverrides,
    };
  }
};

/** 인센티브 설정 저장 */
export const saveIncentiveSettings = async (settings: IncentiveSettings): Promise<void> => {
  // 로컬 캐시 즉시 업데이트
  try {
    localStorage.setItem(LOCAL_INCENTIVE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}

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

  try {
    const { error } = await need().from('org_incentive_settings').upsert({
      contract_types: safeTypes,
      payout_schedule: settings.payoutSchedule,
      manager_overriding: settings.managerOverriding,
      sliding_tiers: settings.slidingTiers,
      milestones: settings.milestones,
      calc_type: safeTypes[0]?.calc_type || 'fixed',
      fixed_amount: safeTypes[0]?.amount || 50000,
      percent_rate: safeTypes[0]?.rate || 3.0,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.warn('[Performance] DB 저장 경고(로컬 캐시 유지됨):', error.message);
    }
  } catch (e) {
    console.warn('[Performance] DB upsert fallback 로컬 유지:', e);
  }
};
/** 단일 케이스의 인센티브 계산 (개인 맞춤 규칙 우선 적용) */
export const calculateSingleCaseIncentive = (
  c: { contractFee?: number; contractType?: string; incentiveTypeId?: string },
  contractTypes: IncentiveContractType[],
  customRule?: AgentCustomIncentiveRule
): { amount: number; matchedType: IncentiveContractType; isCustom: boolean } => {
  const defaultType = contractTypes.find(t => t.isDefault) || contractTypes[0] || DEFAULT_CONTRACT_TYPES[0];

  // 1. 매칭 계약 종류 탐색
  let matched = contractTypes.find(t => t.id === c.incentiveTypeId);
  if (!matched && c.contractType) {
    matched = contractTypes.find(
      t => t.name.toLowerCase() === c.contractType?.toLowerCase() ||
           t.name.includes(c.contractType || '') ||
           (c.contractType || '').includes(t.name)
    );
  }
  const targetType = matched || defaultType;

  // 2. 개인 맞춤 인센티브 규칙 적용 여부 확인
  if (customRule && customRule.useCustom) {
    const customRate = customRule.contractRates?.[targetType.id];
    if (customRate) {
      if (customRule.calcType === 'fixed' && typeof customRate.amount === 'number') {
        return { amount: customRate.amount, matchedType: targetType, isCustom: true };
      }
      if (customRule.calcType === 'percent' && typeof customRate.rate === 'number') {
        const feeWon = (c.contractFee || 0) * 10000;
        return { amount: Math.round(feeWon * (customRate.rate / 100)), matchedType: targetType, isCustom: true };
      }
      if (customRule.calcType === 'hybrid') {
        const feeWon = (c.contractFee || 0) * 10000;
        const fix = customRate.amount || 0;
        const pct = customRate.rate ? Math.round(feeWon * (customRate.rate / 100)) : 0;
        return { amount: fix + pct, matchedType: targetType, isCustom: true };
      }
    }
  }

  // 3. 전사 기본 계약 종류별 계산 (contractFee는 만원 단위)
  let amount = 0;
  if (targetType.calcType === 'fixed') {
    amount = targetType.amount;
  } else {
    const feeWon = (c.contractFee || 0) * 10000;
    amount = Math.round(feeWon * (targetType.rate / 100));
  }

  return { amount, matchedType: targetType, isCustom: false };
};

/** 고성과자 구간별 추가 보너스 계산 (Sliding Scale) */
export const calculateSlidingScaleBonus = (
  contractsCount: number,
  tiers: PerformanceTierRule[]
): { totalBonus: number; activeTierName: string } => {
  if (contractsCount <= 0 || !tiers || tiers.length === 0) {
    return { totalBonus: 0, activeTierName: '기본 구간' };
  }

  // 현재 달성한 최고 티어 탐색
  const sorted = [...tiers].sort((a, b) => b.minCases - a.minCases);
  const matched = sorted.find(t => contractsCount >= t.minCases) || sorted[sorted.length - 1];

  const extraPerCase = matched?.extraAmountPerCase || 0;
  const totalBonus = contractsCount * extraPerCase;

  return { totalBonus, activeTierName: matched?.tierName || '기본 구간' };
};

/** 마일스톤 달성 보너스 계산 */
export const calculateMilestonesBonus = (
  contractsCount: number,
  milestones: MilestoneBonusRule[]
): number => {
  if (contractsCount <= 0 || !milestones) return 0;
  let bonus = 0;
  milestones.forEach(m => {
    if (contractsCount >= m.reachCases) {
      bonus += m.bonusWon;
    }
  });
  return bonus;
};

/** 상담원별 실시간 성과 KPI 집계 (개인 맞춤, 관리자 오버라이드, 구간 보너스 통합) */
export const fetchAgentPerformanceKPI = async (
  startDate?: string,
  endDate?: string,
  allCases: Case[] = []
): Promise<{ kpis: AgentPerformanceKPI[]; settings: IncentiveSettings }> => {
  const settings = await fetchIncentiveSettings();
  const customOverrides = fetchAgentCustomIncentives();

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

    // 1차 집계: 상담원 본인 성과 및 기본 인센티브 산출
    const rawKpis = (data || []).map((r: any) => {
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

      // 개인 맞춤 규칙 확인
      const userCustom = customOverrides[r.user_id];
      const isCustomApplied = Boolean(userCustom?.useCustom);

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

      let calculatedBaseIncentive = 0;

      if (agentCases.length > 0) {
        agentCases.forEach(c => {
          const { amount, matchedType } = calculateSingleCaseIncentive(c, settings.contractTypes, userCustom);
          calculatedBaseIncentive += amount;

          const item = breakdownMap.get(matchedType.id);
          if (item) {
            item.count += 1;
            item.feeRevenueManwon += (c.contractFee || 0);
            item.incentiveAmount += amount;
          }
        });
      } else if (contracts > 0) {
        const defType = settings.contractTypes[0] || DEFAULT_CONTRACT_TYPES[0];
        const singleAmount = defType.calcType === 'fixed' ? defType.amount : Math.round(((feeRevenue * 10000) / contracts) * (defType.rate / 100));
        calculatedBaseIncentive = contracts * singleAmount;
      }

      // 고성과자 구간 보너스 계산 (개인 맞춤에서 슬라이딩 제외하지 않은 경우)
      let slidingBonus = 0;
      if (userCustom ? userCustom.applySlidingBonus : true) {
        const slidingRes = calculateSlidingScaleBonus(contracts, settings.slidingTiers);
        slidingBonus = slidingRes.totalBonus;
      }

      // 마일스톤 달성 보너스 계산
      const milestoneBonus = calculateMilestonesBonus(contracts, settings.milestones);

      return {
        userId: r.user_id,
        displayName: r.display_name,
        email: r.email,
        role: r.role as 'owner' | 'admin' | 'agent',
        status: r.status as 'active' | 'disabled',
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
        baseIncentive: calculatedBaseIncentive,
        slidingBonus,
        milestoneBonus,
        managerOverridingBonus: 0, // 2차 패스에서 가산
        isCustomApplied,
        contractBreakdown: Array.from(breakdownMap.values()).filter(b => b.count > 0),
        estimatedIncentive: calculatedBaseIncentive + slidingBonus + milestoneBonus,
      };
    });

    // 2차 집계: 관리자(팀장) 오버라이딩 수당 배부
    if (settings.managerOverriding?.enabled) {
      const overridingRule = settings.managerOverriding;

      // 관리자별 소속 팀원 성과 합산
      const managerStats: Record<string, { totalTeamCases: number; totalTeamFeeWon: number; teamMembersCount: number }> = {};

      rawKpis.forEach(member => {
        const custom = customOverrides[member.userId];
        const mgrId = custom?.managerUserId;
        if (mgrId) {
          if (!managerStats[mgrId]) {
            managerStats[mgrId] = { totalTeamCases: 0, totalTeamFeeWon: 0, teamMembersCount: 0 };
          }
          managerStats[mgrId].totalTeamCases += member.contractCount;
          managerStats[mgrId].totalTeamFeeWon += (member.totalFeeRevenue * 10000);
          managerStats[mgrId].teamMembersCount += 1;
        }
      });

      // 관리자 계정에 오버라이딩 수당 적립
      rawKpis.forEach(kpi => {
        const stats = managerStats[kpi.userId];
        if (stats && stats.totalTeamCases > 0) {
          let overrideAmount = 0;
          if (overridingRule.type === 'fixed_per_case') {
            overrideAmount = stats.totalTeamCases * overridingRule.amountPerCase;
          } else {
            overrideAmount = Math.round(stats.totalTeamFeeWon * (overridingRule.feeRatePercent / 100));
          }

          // 팀 마일스톤 달성 보너스 확인
          let teamMilestoneBonus = 0;
          if (overridingRule.teamMilestones) {
            overridingRule.teamMilestones.forEach(m => {
              if (stats.totalTeamCases >= m.minTeamCases) {
                teamMilestoneBonus += m.bonusAmountWon;
              }
            });
          }

          const totalMgrBonus = overrideAmount + teamMilestoneBonus;
          kpi.managerOverridingBonus = totalMgrBonus;
          kpi.estimatedIncentive += totalMgrBonus;
          kpi.overridingDetails = `소속 팀원 ${stats.teamMembersCount}명 합산 ${stats.totalTeamCases}건 계약 오버라이드 (+₩${overrideAmount.toLocaleString()})${
            teamMilestoneBonus > 0 ? ` + 팀 목표 달성 보너스 (+₩${teamMilestoneBonus.toLocaleString()})` : ''
          }`;
        }
      });
    }

    return { kpis: rawKpis, settings };
  } catch (e: any) {
    console.error('[Performance] fetchAgentPerformanceKPI exception:', e);
    return { kpis: [], settings };
  }
};
