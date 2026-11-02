import { supabase } from './supabase';

export interface IncentiveSettings {
  calcType: 'fixed' | 'percent' | 'tiered';
  fixedAmount: number;     // 원 (예: 50,000)
  percentRate: number;     // % (예: 3.0)
  tieredRules: Array<{ min: number; max?: number; amount?: number; rate?: number }>;
}

export const DEFAULT_INCENTIVE_SETTINGS: IncentiveSettings = {
  calcType: 'fixed',
  fixedAmount: 50000,
  percentRate: 3.0,
  tieredRules: [
    { min: 1, max: 5, amount: 50000 },
    { min: 6, max: 10, amount: 70000 },
    { min: 11, amount: 100000 },
  ],
};

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

  // 산출된 예상 인센티브
  estimatedIncentive: number;       // 원
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
    return {
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
  const { error } = await need().from('org_incentive_settings').upsert({
    calc_type: settings.calcType,
    fixed_amount: settings.fixedAmount,
    percent_rate: settings.percentRate,
    tiered_rules: settings.tieredRules,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};

/** 인센티브 계산 룰 함수 */
export const calculateIncentive = (contracts: number, revenue: number, settings: IncentiveSettings): number => {
  if (contracts <= 0) return 0;

  if (settings.calcType === 'fixed') {
    return contracts * settings.fixedAmount;
  }

  if (settings.calcType === 'percent') {
    return Math.round(revenue * (settings.percentRate / 100));
  }

  if (settings.calcType === 'tiered') {
    let total = 0;
    // 구간별 계산
    for (let i = 1; i <= contracts; i++) {
      const rule = settings.tieredRules.find(r => i >= r.min && (!r.max || i <= r.max));
      if (rule) {
        if (rule.amount) total += rule.amount;
        else if (rule.rate && contracts > 0) total += Math.round((revenue / contracts) * (rule.rate / 100));
      } else {
        total += settings.fixedAmount;
      }
    }
    return total;
  }

  return contracts * 50000;
};

/** 상담원별 실시간 성과 KPI 집계 */
export const fetchAgentPerformanceKPI = async (
  startDate?: string,
  endDate?: string
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
      const estimatedIncentive = calculateIncentive(contracts, feeRevenue, settings);

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
        estimatedIncentive,
      };
    });

    return { kpis, settings };
  } catch (e: any) {
    console.error('[Performance] fetchAgentPerformanceKPI exception:', e);
    return { kpis: [], settings };
  }
};
