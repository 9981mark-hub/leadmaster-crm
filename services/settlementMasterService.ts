/**
 * services/settlementMasterService.ts
 * 차세대 통합 정산 & 경영 손익(P&L) 마스터 서비스 (v4.5)
 * 
 * 1. 회사별 수수료 분배 정책 (회사분 마진 공제 vs 상담원 수당 배분)
 * 2. 이중 정산 주기 (거래처별 입금 주기 vs 상담원 수당 지급일)
 * 3. 거래처별 정산 관제 (건수, 금액, 시기 D-Day, 연체)
 * 4. DB 구매비용(원가) 및 상담원 인센티브(인건비) 실시간 자동 집계
 * 5. 원스톱 통합 경영 손익(P&L) 산출
 */

import { supabase } from './supabase';
import { Case, Partner, ExpenseItem } from '../types';
import { todayKST, buildPartnerLedger, daysBetween } from '../utils/settlement';
import { fetchCollections, Collection } from './settlementLedger';
import { fetchBatchQualityStats, BatchQualityMetric } from './batchQuality';
import { TeamMember } from './team';

export interface SettlementPolicy {
  id?: string;
  orgId?: string;
  splitModel: 'ratio_split' | 'margin_deduction' | 'fixed_agent_incentive';
  companyShareRatio: number;      // 회사 몫 (%) - 기본 40.0
  agentShareRatio: number;        // 상담원 몫 (%) - 기본 60.0
  companyFixedMargin: number;     // 회사 고정 마진 (원) - 기본 300,000
  agentFixedIncentive: number;    // 상담원 고정 수당 (원) - 기본 150,000
  agentPayoutCycle: 'monthly_fixed' | 'weekly_fixed' | 'after_partner_deposit';
  agentPayoutDay: number;         // 매월 10일(or 매주 금요일=5)
  payoutDelayDays: number;        // 입금 확인 후 N일 이내
}

export const DEFAULT_SETTLEMENT_POLICY: SettlementPolicy = {
  splitModel: 'ratio_split',
  companyShareRatio: 40.0,
  agentShareRatio: 60.0,
  companyFixedMargin: 300000,
  agentFixedIncentive: 150000,
  agentPayoutCycle: 'monthly_fixed',
  agentPayoutDay: 10,
  payoutDelayDays: 3,
};

// -------------------------------------------------------------
// 1. 정책 CRUD API
// -------------------------------------------------------------

export async function fetchSettlementPolicy(orgId?: string): Promise<SettlementPolicy> {
  if (!supabase) return DEFAULT_SETTLEMENT_POLICY;
  try {
    let query = supabase.from('org_settlement_policies').select('*');
    if (orgId) {
      query = query.eq('org_id', orgId);
    }
    const { data, error } = await query.maybeSingle();
    if (error || !data) {
      return DEFAULT_SETTLEMENT_POLICY;
    }

    return {
      id: data.id,
      orgId: data.org_id,
      splitModel: data.split_model || 'ratio_split',
      companyShareRatio: Number(data.company_share_ratio) || 40.0,
      agentShareRatio: Number(data.agent_share_ratio) || 60.0,
      companyFixedMargin: Number(data.company_fixed_margin) || 300000,
      agentFixedIncentive: Number(data.agent_fixed_incentive) || 150000,
      agentPayoutCycle: data.agent_payout_cycle || 'monthly_fixed',
      agentPayoutDay: Number(data.agent_payout_day) || 10,
      payoutDelayDays: Number(data.payout_delay_days) || 3,
    };
  } catch (err) {
    console.warn('[SettlementMaster] fetchSettlementPolicy fallback:', err);
    return DEFAULT_SETTLEMENT_POLICY;
  }
}

export async function saveSettlementPolicy(policy: SettlementPolicy, orgId?: string): Promise<void> {
  if (!supabase) return;
  const targetOrgId = orgId || policy.orgId;
  if (!targetOrgId) return;

  const payload = {
    org_id: targetOrgId,
    split_model: policy.splitModel,
    company_share_ratio: policy.companyShareRatio,
    agent_share_ratio: policy.agentShareRatio,
    company_fixed_margin: policy.companyFixedMargin,
    agent_fixed_incentive: policy.agentFixedIncentive,
    agent_payout_cycle: policy.agentPayoutCycle,
    agent_payout_day: policy.agentPayoutDay,
    payout_delay_days: policy.payoutDelayDays,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('org_settlement_policies')
    .upsert(payload, { onConflict: 'org_id' });

  if (error) {
    console.error('[SettlementMaster] saveSettlementPolicy error:', error);
    throw error;
  }
}

// -------------------------------------------------------------
// 2. 수수료 분배 계산 엔진 (Revenue Split Engine)
// -------------------------------------------------------------

export interface SplitResult {
  partnerFeeWon: number;
  companyShareWon: number;
  agentShareWon: number;
  modelLabel: string;
}

export function calculateCommissionSplit(partnerFeeWon: number, policy: SettlementPolicy): SplitResult {
  if (partnerFeeWon <= 0) {
    return {
      partnerFeeWon: 0,
      companyShareWon: 0,
      agentShareWon: 0,
      modelLabel: '수수료 없음',
    };
  }

  let companyShare = 0;
  let agentShare = 0;
  let modelLabel = '';

  switch (policy.splitModel) {
    case 'ratio_split': {
      // 비율 분배: 회사 N% vs 상담원 (100-N)%
      companyShare = Math.round(partnerFeeWon * (policy.companyShareRatio / 100));
      agentShare = partnerFeeWon - companyShare;
      modelLabel = `비율 분배 (회사 ${policy.companyShareRatio}% : 상담원 ${policy.agentShareRatio}%)`;
      break;
    }
    case 'margin_deduction': {
      // 회사 고정 마진 공제 후 잔액 상담원 지급
      companyShare = Math.min(partnerFeeWon, policy.companyFixedMargin);
      agentShare = Math.max(0, partnerFeeWon - companyShare);
      modelLabel = `회사 고정 마진 차감 (₩${(policy.companyFixedMargin / 10000).toLocaleString()}만 공제)`;
      break;
    }
    case 'fixed_agent_incentive': {
      // 상담원 고정 수당 지급 후 잔액 회사 귀속
      agentShare = Math.min(partnerFeeWon, policy.agentFixedIncentive);
      companyShare = Math.max(0, partnerFeeWon - agentShare);
      modelLabel = `상담원 고정 수당 (₩${(policy.agentFixedIncentive / 10000).toLocaleString()}만 지급)`;
      break;
    }
    default: {
      companyShare = Math.round(partnerFeeWon * 0.4);
      agentShare = partnerFeeWon - companyShare;
      modelLabel = '기본 비율 (40:60)';
    }
  }

  return {
    partnerFeeWon,
    companyShareWon: companyShare,
    agentShareWon: agentShare,
    modelLabel,
  };
}

// -------------------------------------------------------------
// 3. 거래처별 정산 관제 데이터 계산
// -------------------------------------------------------------

export interface PartnerSettlementCardItem {
  partnerId: string;
  partnerName: string;
  settlementCycleDisplay: string;
  nextSettlementDate: string;
  dDay: number;
  caseCount: number;
  totalContractFeeWon: number;
  billedCommissionWon: number;
  collectedCommissionWon: number;
  outstandingWon: number;
  overdueWon: number;
  dueSoonWon: number;
  isOverdue: boolean;
}

export function computePartnerSettlementCards(
  partners: Partner[],
  cases: Case[],
  collections: Collection[] = []
): PartnerSettlementCardItem[] {
  const today = todayKST();
  const activePartners = partners.filter(p => p.active !== false);

  return activePartners.map(p => {
    const ledger = buildPartnerLedger(p, cases, collections, today);
    const cfg = p.settlementConfig;

    // 요일 한글 매핑
    const daysKo = ['일', '월', '화', '수', '목', '금', '토'];
    let cycleDisplay = '매주 월요일 정산';
    if (cfg?.payoutDay !== undefined) {
      cycleDisplay = `매주 ${daysKo[cfg.payoutDay] || '월'}요일 정산`;
    }

    // 다음 정산일 D-Day 계산
    const nextDueDate = ledger.nextDueAt || today;
    const dDay = daysBetween(today, nextDueDate);

    // 대상 건수: lines + planned 중 고유 caseId 수
    const caseIds = new Set<string>();
    ledger.lines.forEach(l => caseIds.add(l.caseId));
    ledger.planned.forEach(l => caseIds.add(l.caseId));

    // 만원 ➔ 원 단위 환산
    const billedWon = Math.round(ledger.billedTotal * 10000);
    const collectedWon = Math.round(ledger.receivedTotal * 10000);
    const outstandingWon = Math.round(Math.max(0, ledger.outstanding) * 10000);
    const overdueWon = Math.round(ledger.overdue * 10000);
    const dueSoonWon = Math.round(ledger.dueSoon * 10000);

    // 총 수임료 원 단위
    const totalContractFeeWon = ledger.lines.reduce((s, l) => s + (l.contractFee * 10000), 0);

    return {
      partnerId: p.partnerId,
      partnerName: p.name,
      settlementCycleDisplay: cycleDisplay,
      nextSettlementDate: nextDueDate,
      dDay,
      caseCount: caseIds.size,
      totalContractFeeWon,
      billedCommissionWon: billedWon,
      collectedCommissionWon: collectedWon,
      outstandingWon,
      overdueWon,
      dueSoonWon,
      isOverdue: overdueWon > 0 || dDay < 0,
    };
  });
}

// -------------------------------------------------------------
// 4. 상담원 수당 정산 대장 데이터 계산
// -------------------------------------------------------------

export interface AgentSettlementRowItem {
  agentId: string;
  agentName: string;
  caseCount: number;
  totalPartnerFeeWon: number;
  companyShareWon: number;
  agentShareWon: number;
  nextPayoutDate: string;
  payoutDDay: number;
  caseList: {
    caseId: string;
    customerName: string;
    contractFeeWon: number;
    partnerFeeWon: number;
    agentShareWon: number;
    contractDate?: string;
  }[];
}

export function computeAgentSettlementRows(
  cases: Case[],
  partners: Partner[],
  policy: SettlementPolicy,
  teamMembers: TeamMember[] = []
): AgentSettlementRowItem[] {
  const today = todayKST();
  const agentMap = new Map<string, {
    agentName: string;
    cases: any[];
    totalPartnerFee: number;
  }>();

  // 팀 멤버 매핑 사전 구축
  const memberNameMap = new Map<string, string>();
  teamMembers.forEach(m => {
    memberNameMap.set(m.userId, m.displayName || m.email.split('@')[0]);
    memberNameMap.set(m.email, m.displayName || m.email.split('@')[0]);
  });

  // 수임/계약 완료 건 필터링 (취소건 제외)
  const validCases = cases.filter(c => {
    const st = c.status || '';
    if (st.includes('취소') || st.includes('진행불가') || st.includes('휴지통')) return false;
    return (c.contractFee && c.contractFee > 0) || st.includes('수임') || st.includes('계약') || st.includes('입금');
  });

  validCases.forEach(c => {
    const agentKey = c.assignedUserId || c.managerName || '미지정';
    const agentName = memberNameMap.get(agentKey) || c.managerName || agentKey.split('@')[0];

    if (!agentMap.has(agentKey)) {
      agentMap.set(agentKey, {
        agentName,
        cases: [],
        totalPartnerFee: 0,
      });
    }

    const entry = agentMap.get(agentKey)!;
    const partner = partners.find(p => p.partnerId === c.partnerId);

    // 거래처 수수료 (원 단위)
    // 수임료의 commissionRate(기본 20%) 또는 고정 수수료
    const contractFeeWon = (c.contractFee || 0) * 10000;
    const commissionRate = partner?.custom_commission_rate ?? partner?.incentiveRate ?? 20;
    const partnerFeeWon = partner?.incentiveFixedAmount
      ? partner.incentiveFixedAmount * 10000
      : Math.round(contractFeeWon * (commissionRate / 100));

    // 회사 몫 vs 상담원 몫 분배
    const split = calculateCommissionSplit(partnerFeeWon, policy);

    entry.cases.push({
      caseId: c.caseId,
      customerName: c.customerName,
      contractFeeWon,
      partnerFeeWon,
      agentShareWon: split.agentShareWon,
      contractDate: c.createdAt?.slice(0, 10),
    });
    entry.totalPartnerFee += partnerFeeWon;
  });

  // 다음 상담원 급여/수당 지급일 계산
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1~12
  let targetPayDay = policy.agentPayoutDay || 10;

  // 지급일 YYYY-MM-DD
  let payDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(targetPayDay).padStart(2, '0')}`;
  if (today > payDateStr) {
    // 이번 달 지급일이 이미 지났으면 익월 지급일
    const nextM = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
    payDateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(targetPayDay).padStart(2, '0')}`;
  }
  const payoutDDay = daysBetween(today, payDateStr);

  const results: AgentSettlementRowItem[] = [];
  agentMap.forEach((val, key) => {
    const split = calculateCommissionSplit(val.totalPartnerFee, policy);
    results.push({
      agentId: key,
      agentName: val.agentName,
      caseCount: val.cases.length,
      totalPartnerFeeWon: val.totalPartnerFee,
      companyShareWon: split.companyShareWon,
      agentShareWon: split.agentShareWon,
      nextPayoutDate: payDateStr,
      payoutDDay,
      caseList: val.cases,
    });
  });

  return results.sort((a, b) => b.agentShareWon - a.agentShareWon);
}

// -------------------------------------------------------------
// 5. 통합 경영 손익(P&L) 요약 계산
// -------------------------------------------------------------

export interface IntegratedPnLSummary {
  year: number;
  month: number | 'all';
  // 수익 (매출)
  totalRevenueWon: number;        // 거래처 총 청구 수수료 매출
  collectedRevenueWon: number;    // 실제 통장 입금 확인액
  outstandingRevenueWon: number;  // 미수금 잔액
  // 배분
  totalCompanyMarginWon: number;  // 회사 총 마진 (수수료 - 상담원수당)
  totalAgentCommissionWon: number;// 상담원 수당 지출
  // 원가 및 비용
  totalDbCostWon: number;         // DB 구매 원가 (import_batches 연동)
  totalFixedCostWon: number;      // 일반 고정비 (임대료, 통신비 등)
  totalExpensesWon: number;       // 총 지출 (DB원가 + 상담원수당 + 고정비)
  // 최종 손익
  netProfitWon: number;           // 최종 영업 순이익 (매출 - 총지출)
  profitMarginRate: number;       // 순이익률 (%)
  // 현금흐름 (Cash Flow)
  cashInflowWon: number;          // 통장 실제 유입액 (거래처 입금완료액)
  cashOutflowWon: number;         // 통장 실제 유출액 (DB비용 + 기타지출)
  netCashFlowWon: number;         // 당월 순현금 흐름
}

export function computeIntegratedPnLSummary(
  partnerCards: PartnerSettlementCardItem[],
  agentRows: AgentSettlementRowItem[],
  batchQualityList: BatchQualityMetric[] = [],
  expenseItems: ExpenseItem[] = [],
  policy: SettlementPolicy,
  year: number,
  month: number | 'all'
): IntegratedPnLSummary {
  // 1. 거래처 총 수수료 매출 (청구액 기준 & 실제 입금액 기준)
  const totalRevenueWon = partnerCards.reduce((s, c) => s + c.billedCommissionWon, 0);
  const collectedRevenueWon = partnerCards.reduce((s, c) => s + c.collectedCommissionWon, 0);
  const outstandingRevenueWon = partnerCards.reduce((s, c) => s + c.outstandingWon, 0);

  // 2. 상담원 수당 합계 & 회사 순마진
  const totalAgentCommissionWon = agentRows.reduce((s, a) => s + a.agentShareWon, 0);
  const totalCompanyMarginWon = totalRevenueWon - totalAgentCommissionWon;

  // 3. DB 구매비용 원가 (import_batches 연동 - 팀 관리와 100% 동기화)
  // 특정 월 필터링
  const filteredBatches = batchQualityList.filter(b => {
    if (!b.createdAt) return true;
    const bDate = b.createdAt.slice(0, 7); // YYYY-MM
    const bYear = parseInt(bDate.slice(0, 4), 10);
    const bMonth = parseInt(bDate.slice(5, 7), 10);
    if (bYear !== year) return false;
    if (month !== 'all' && bMonth !== month) return false;
    return true;
  });
  const totalDbCostWon = filteredBatches.reduce((s, b) => s + (b.totalCost || 0), 0);

  // 4. 일반 운영비 및 고정비 (expenses)
  const filteredExpenses = expenseItems.filter(e => {
    if (!e.date) return true;
    const eYear = parseInt(e.date.slice(0, 4), 10);
    const eMonth = parseInt(e.date.slice(5, 7), 10);
    if (eYear !== year) return false;
    if (month !== 'all' && eMonth !== month) return false;
    return true;
  });
  const totalFixedCostWon = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // 5. 총 지출 & 최종 영업 순이익
  const totalExpensesWon = totalDbCostWon + totalAgentCommissionWon + totalFixedCostWon;
  const netProfitWon = totalRevenueWon - totalExpensesWon;
  const profitMarginRate = totalRevenueWon > 0
    ? Number(((netProfitWon / totalRevenueWon) * 100).toFixed(1))
    : 0;

  // 6. 현금흐름 (실제 입금 vs 실제 출금)
  const cashInflowWon = collectedRevenueWon;
  const cashOutflowWon = totalDbCostWon + totalFixedCostWon; // 상담원은 지급 시점 연동
  const netCashFlowWon = cashInflowWon - cashOutflowWon;

  return {
    year,
    month,
    totalRevenueWon,
    collectedRevenueWon,
    outstandingRevenueWon,
    totalCompanyMarginWon,
    totalAgentCommissionWon,
    totalDbCostWon,
    totalFixedCostWon,
    totalExpensesWon,
    netProfitWon,
    profitMarginRate,
    cashInflowWon,
    cashOutflowWon,
    netCashFlowWon,
  };
}
