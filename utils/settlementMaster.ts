/**
 * utils/settlementMaster.ts
 * 통합 정산(상담원 수당 분배·거래처 카드·경영 손익) 순수 계산 — 서버 호출 없음
 * (services/settlementMasterService.ts 가 다시 내보낸다. 점검: npx tsx scripts/settlement_check.ts)
 *
 * 단위 규칙
 * - 리드 수임료·거래처 수수료(utils/settlement 원장)·지출(ExpenseItem.amount)은 "만원"
 * - DB 구매비용(import_batches total_cost)·정책 고정 금액·이 파일의 결과(…Won)는 "원"
 * - 만원 → 원 변환은 manwonToWon 한 곳에서만 한다
 *
 * 수수료 기준
 * - 리드별 수수료 = utils/settlement.computeCaseCommission (거래처 수당 규칙 구간, 받을 돈 원장과 같은 계산)
 * - 매출 = 공급가(부가세 제외). 부가세는 따로 보여준다
 * - 기간(월) = 지급 사유가 생긴 날(earnedAt, 한국 날짜) 기준
 */
import type { Case, Partner, ExpenseItem } from '../types';
import type { BatchQualityMetric } from '../services/batchQuality';
import type { TeamMember } from '../services/team';
import {
  todayKST, addDays, daysBetween, buildPartnerLedger, computeCaseCommission,
  CANCELLED_STATUSES, Collection, LedgerLine,
} from './settlement';

// -------------------------------------------------------------
// 공통: 단위·날짜
// -------------------------------------------------------------

/** 만원 → 원 (반올림해서 원 단위 정수) */
export const manwonToWon = (man: number | undefined | null): number => Math.round((Number(man) || 0) * 10000);

/** ISO 시각(UTC) 또는 YYYY-MM-DD → 한국 날짜 YYYY-MM-DD */
export const kstDateOf = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined;
  return new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
};

/** 날짜(한국)가 선택한 연/월에 속하는지. 날짜가 없으면 기간에 넣지 않는다 */
export const inPeriod = (ymd: string | undefined, year: number, month: number | 'all'): boolean => {
  if (!ymd) return false;
  const prefix = month === 'all' ? `${year}-` : `${year}-${String(month).padStart(2, '0')}-`;
  return ymd.startsWith(prefix);
};

const lastDayOfMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
const weekdayOf = (ymd: string): number => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

// -------------------------------------------------------------
// 정책
// -------------------------------------------------------------

export interface SettlementPolicy {
  id?: string;
  orgId?: string;
  splitModel: 'ratio_split' | 'margin_deduction' | 'fixed_agent_incentive';
  companyShareRatio: number;      // 회사 몫 (%) - 기본 40
  agentShareRatio: number;        // 상담원 몫 (%) - 기본 60
  companyFixedMargin: number;     // 리드 1건당 회사 고정 마진 (원) - 기본 300,000
  agentFixedIncentive: number;    // 리드 1건당 상담원 고정 수당 (원) - 기본 150,000
  agentPayoutCycle: 'monthly_fixed' | 'weekly_fixed' | 'after_partner_deposit';
  agentPayoutDay: number;         // 월: 1~31(31 = 말일) / 주: 요일 0(일)~6(토)
  payoutDelayDays: number;        // 거래처 입금 확인 후 N일 이내 (after_partner_deposit)
}

export const DEFAULT_SETTLEMENT_POLICY: SettlementPolicy = {
  splitModel: 'ratio_split',
  companyShareRatio: 40,
  agentShareRatio: 60,
  companyFixedMargin: 300000,
  agentFixedIncentive: 150000,
  agentPayoutCycle: 'monthly_fixed',
  agentPayoutDay: 10,
  payoutDelayDays: 3,
};

const SPLIT_MODELS: SettlementPolicy['splitModel'][] = ['ratio_split', 'margin_deduction', 'fixed_agent_incentive'];
const PAYOUT_CYCLES: SettlementPolicy['agentPayoutCycle'][] = ['monthly_fixed', 'weekly_fixed', 'after_partner_deposit'];

/** 숫자로 읽되 0은 그대로 둔다 (null·빈 값·숫자 아님만 기본값) */
const finiteOr = (v: unknown, def: number): number => {
  if (v === null || v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** 정책 값 정리 (비율 0~100, 회사+상담원 = 100, 금액 0 이상, 주급 요일 0~6) */
export const normalizePolicy = (p: SettlementPolicy): SettlementPolicy => {
  const splitModel = SPLIT_MODELS.includes(p.splitModel) ? p.splitModel : 'ratio_split';
  const agentPayoutCycle = PAYOUT_CYCLES.includes(p.agentPayoutCycle) ? p.agentPayoutCycle : 'monthly_fixed';
  const companyShareRatio = clamp(finiteOr(p.companyShareRatio, 40), 0, 100);
  let agentPayoutDay = Math.trunc(finiteOr(p.agentPayoutDay, agentPayoutCycle === 'weekly_fixed' ? 5 : 10));
  if (agentPayoutCycle === 'weekly_fixed' && (agentPayoutDay < 0 || agentPayoutDay > 6)) agentPayoutDay = 5;
  if (agentPayoutCycle !== 'weekly_fixed') agentPayoutDay = clamp(agentPayoutDay, 1, 31);
  return {
    ...p,
    splitModel,
    companyShareRatio,
    agentShareRatio: Math.round((100 - companyShareRatio) * 100) / 100,
    companyFixedMargin: Math.max(0, Math.round(finiteOr(p.companyFixedMargin, 300000))),
    agentFixedIncentive: Math.max(0, Math.round(finiteOr(p.agentFixedIncentive, 150000))),
    agentPayoutCycle,
    agentPayoutDay,
    payoutDelayDays: Math.max(0, Math.trunc(finiteOr(p.payoutDelayDays, 3))),
  };
};

/** DB 행(org_settlement_policies) → 정책. 0%·0원도 그대로 읽는다 */
export const policyFromRow = (row: any): SettlementPolicy => {
  const d = DEFAULT_SETTLEMENT_POLICY;
  return normalizePolicy({
    id: row?.id,
    orgId: row?.org_id,
    splitModel: row?.split_model || d.splitModel,
    companyShareRatio: finiteOr(row?.company_share_ratio, d.companyShareRatio),
    agentShareRatio: finiteOr(row?.agent_share_ratio, d.agentShareRatio),
    companyFixedMargin: finiteOr(row?.company_fixed_margin, d.companyFixedMargin),
    agentFixedIncentive: finiteOr(row?.agent_fixed_incentive, d.agentFixedIncentive),
    agentPayoutCycle: row?.agent_payout_cycle || d.agentPayoutCycle,
    agentPayoutDay: finiteOr(row?.agent_payout_day, d.agentPayoutDay),
    payoutDelayDays: finiteOr(row?.payout_delay_days, d.payoutDelayDays),
  });
};

/** 정책 → DB 행 */
export const policyToRow = (policy: SettlementPolicy, orgId: string) => {
  const p = normalizePolicy(policy);
  return {
    org_id: orgId,
    split_model: p.splitModel,
    company_share_ratio: p.companyShareRatio,
    agent_share_ratio: p.agentShareRatio,
    company_fixed_margin: p.companyFixedMargin,
    agent_fixed_incentive: p.agentFixedIncentive,
    agent_payout_cycle: p.agentPayoutCycle,
    agent_payout_day: p.agentPayoutDay,
    payout_delay_days: p.payoutDelayDays,
    updated_at: new Date().toISOString(),
  };
};

export const policyLabel = (policy: SettlementPolicy): string => {
  if (policy.splitModel === 'margin_deduction') return `회사 고정 마진 차감 (건당 ${(policy.companyFixedMargin / 10000).toLocaleString()}만원 공제)`;
  if (policy.splitModel === 'fixed_agent_incentive') return `상담원 고정 수당 (건당 ${(policy.agentFixedIncentive / 10000).toLocaleString()}만원 지급)`;
  return `비율 분배 (회사 ${policy.companyShareRatio}% : 상담원 ${policy.agentShareRatio}%)`;
};

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

export const payoutScheduleLabel = (policy: SettlementPolicy): string => {
  const p = normalizePolicy(policy);
  if (p.agentPayoutCycle === 'weekly_fixed') return `매주 ${DAYS_KO[p.agentPayoutDay]}요일 지급`;
  if (p.agentPayoutCycle === 'after_partner_deposit') return `거래처 입금 확인 후 ${p.payoutDelayDays}일 이내 지급`;
  return p.agentPayoutDay >= 31 ? '매월 말일 지급' : `매월 ${p.agentPayoutDay}일 지급`;
};

/**
 * 다음 상담원 수당 지급일 (매월·매주). 입금 확인 후 지급은 상담원별로 따로 계산 → null
 * - 매월 말일(31)·없는 날짜(2월 30일 등)는 그 달 마지막 날로 맞춘다
 * - 매주: agentPayoutDay = 요일(0~6)
 */
export const nextAgentPayoutDate = (policy: SettlementPolicy, today: string = todayKST()): string | null => {
  const p = normalizePolicy(policy);
  if (p.agentPayoutCycle === 'after_partner_deposit') return null;
  if (p.agentPayoutCycle === 'weekly_fixed') {
    let d = today;
    for (let i = 0; i < 7 && weekdayOf(d) !== p.agentPayoutDay; i++) d = addDays(d, 1);
    return d;
  }
  const [y, m] = today.split('-').map(Number);
  const make = (yy: number, mm: number) =>
    `${yy}-${String(mm).padStart(2, '0')}-${String(Math.min(p.agentPayoutDay, lastDayOfMonth(yy, mm))).padStart(2, '0')}`;
  let pay = make(y, m);
  if (today > pay) pay = m === 12 ? make(y + 1, 1) : make(y, m + 1);
  return pay;
};

// -------------------------------------------------------------
// 수수료 분배 (리드 1건 단위)
// -------------------------------------------------------------

export interface SplitResult {
  partnerFeeWon: number;
  companyShareWon: number;
  agentShareWon: number;
  modelLabel: string;
}

/** 리드 1건의 수수료(원, 부가세 제외)를 회사·상담원으로 나눈다. 회사 + 상담원 = 수수료 (남는 원 없음) */
export function calculateCommissionSplit(partnerFeeWon: number, policy: SettlementPolicy): SplitResult {
  const fee = Math.round(Number(partnerFeeWon) || 0);
  const p = normalizePolicy(policy);
  if (fee <= 0) return { partnerFeeWon: 0, companyShareWon: 0, agentShareWon: 0, modelLabel: '수수료 없음' };
  let companyShare: number;
  let agentShare: number;
  switch (p.splitModel) {
    case 'margin_deduction':
      companyShare = Math.min(fee, p.companyFixedMargin);
      agentShare = fee - companyShare;
      break;
    case 'fixed_agent_incentive':
      agentShare = Math.min(fee, p.agentFixedIncentive);
      companyShare = fee - agentShare;
      break;
    case 'ratio_split':
    default:
      companyShare = Math.round(fee * (p.companyShareRatio / 100));
      agentShare = fee - companyShare;
  }
  return { partnerFeeWon: fee, companyShareWon: companyShare, agentShareWon: agentShare, modelLabel: policyLabel(p) };
}

// -------------------------------------------------------------
// 거래처별 정산 카드
// -------------------------------------------------------------

export interface PartnerSettlementCardItem {
  partnerId: string;
  partnerName: string;
  settlementCycleDisplay: string;
  nextSettlementDate: string;
  dDay: number;
  caseCount: number;
  totalContractFeeWon: number;
  supplyCommissionWon: number;     // 청구 수수료 중 공급가 (부가세 제외)
  billedCommissionWon: number;     // 청구액 (부가세 별도 거래처는 +10%)
  collectedCommissionWon: number;
  outstandingWon: number;
  overdueWon: number;
  dueSoonWon: number;
  isOverdue: boolean;
}

/** 거래처 정산 주기 설명 (정산 스케줄이 있으면 매주, 없으면 입금 후 N일) */
export const partnerCycleLabel = (p: Partner): string => {
  const cfg = p.settlementConfig;
  if (cfg && cfg.cutoffDay !== undefined && cfg.payoutDay !== undefined) {
    const delay = cfg.payoutWeekDelay ? ` (${cfg.payoutWeekDelay}주 뒤)` : '';
    return `매주 ${DAYS_KO[cfg.cutoffDay] ?? '?'}요일 마감 → ${DAYS_KO[cfg.payoutDay] ?? '?'}요일 지급${delay}`;
  }
  return `지급 사유 발생 후 ${p.paymentTermDays ?? 7}일 이내`;
};

export function computePartnerSettlementCards(
  partners: Partner[],
  cases: Case[],
  collections: Collection[] = [],
  asOf: string = todayKST(),
): PartnerSettlementCardItem[] {
  return partners.filter(p => p.active !== false).map(p => {
    const ledger = buildPartnerLedger(p, cases, collections, asOf);
    const nextDueDate = ledger.nextDueAt || asOf;
    const dDay = daysBetween(asOf, nextDueDate);

    // 리드 1건에 단계 줄이 2개(계약금·완납)일 수 있으므로 리드별로 한 번만 센다
    const feeByCase = new Map<string, number>();
    [...ledger.lines, ...ledger.planned].forEach(l => { if (!feeByCase.has(l.caseId)) feeByCase.set(l.caseId, l.contractFee); });
    const totalContractFeeWon = [...feeByCase.values()].reduce((s, f) => s + manwonToWon(f), 0);

    const overdueWon = manwonToWon(ledger.overdue);
    return {
      partnerId: p.partnerId,
      partnerName: p.name,
      settlementCycleDisplay: partnerCycleLabel(p),
      nextSettlementDate: nextDueDate,
      dDay,
      caseCount: feeByCase.size,
      totalContractFeeWon,
      supplyCommissionWon: ledger.lines.reduce((s, l) => s + manwonToWon(l.amount), 0),
      billedCommissionWon: manwonToWon(ledger.billedTotal),
      collectedCommissionWon: manwonToWon(ledger.receivedTotal),
      outstandingWon: manwonToWon(Math.max(0, ledger.outstanding)),
      overdueWon,
      dueSoonWon: manwonToWon(ledger.dueSoon),
      isOverdue: overdueWon > 0,
    };
  });
}

// -------------------------------------------------------------
// 상담원 수당 대장
// -------------------------------------------------------------

export interface AgentCaseLine {
  caseId: string;
  customerName: string;
  partnerName?: string;
  contractFeeWon: number;
  caseCommissionWon: number;  // 이 리드 전체 수수료 (부가세 제외)
  partnerFeeWon: number;      // 이번 기간에 생긴 수수료 (부가세 제외)
  companyShareWon: number;
  agentShareWon: number;
  contractDate?: string;      // 계약일 (cases.contract_at)
  earnedAt?: string;          // 이번 기간 마지막 지급 사유 발생일
}

export interface AgentProblemCase {
  caseId: string;
  customerName: string;
  agentName: string;
  problem: string;
}

export interface AgentSettlementRowItem {
  agentId: string;
  agentName: string;
  caseCount: number;
  totalPartnerFeeWon: number;
  companyShareWon: number;
  agentShareWon: number;
  nextPayoutDate: string;
  payoutDDay: number;
  payoutNote?: string;
  caseList: AgentCaseLine[];
}

export interface AgentSettlementResult {
  rows: AgentSettlementRowItem[];
  problems: AgentProblemCase[];
}

const PROBLEM_LABEL: Record<string, string> = {
  '수당 룰 없음': '수당 규칙 없음 확인 필요',
  '거래처 없음': '거래처 없음 확인 필요',
  '수임료 없음': '수임료 없음 확인 필요',
};

export interface AgentSettlementOptions {
  year?: number;
  month?: number | 'all';     // year 없으면 전체 기간
  asOf?: string;              // 오늘 (한국 날짜)
  collections?: Collection[]; // 입금 확인 후 지급일 계산용
}

/**
 * 상담원별 수당
 * - 대상: 휴지통·고객취소·진행불가가 아니고, 받을 돈 원장 기준 수수료 단계가 이미 생긴 리드
 * - 수당 규칙이 없는 리드는 넣지 않고 problems 로 돌려준다 (20% 같은 임의 기본값 없음)
 * - 분배는 리드 1건의 전체 수수료에 적용한 뒤 단계(계약금·완납) 금액 비율로 나눈다
 *   → 건당 고정 마진·고정 수당이 단계가 나뉘어도 한 번만 적용된다
 * - 기간은 단계의 지급 사유 발생일(earnedAt) 기준
 */
export function computeAgentSettlement(
  cases: Case[],
  partners: Partner[],
  policy: SettlementPolicy,
  teamMembers: TeamMember[] = [],
  opts: AgentSettlementOptions = {},
): AgentSettlementResult {
  const asOf = opts.asOf || todayKST();
  const p = normalizePolicy(policy);
  const memberNameMap = new Map<string, string>();
  teamMembers.forEach(m => {
    const name = m.displayName || (m.email || '').split('@')[0];
    if (m.userId) memberNameMap.set(m.userId, name);
    if (m.email) memberNameMap.set(m.email, name);
  });
  const periodOk = (d?: string) => opts.year === undefined ? true : inPeriod(d, opts.year, opts.month ?? 'all');

  type Acc = { agentName: string; lines: AgentCaseLine[]; stageKeys: string[] };
  const agentMap = new Map<string, Acc>();
  const problems: AgentProblemCase[] = [];

  cases.forEach(c => {
    const status = c.status || '';
    if (status === '휴지통' || CANCELLED_STATUSES.includes(status)) return;
    const hasDeposits = (c.depositHistory || []).length > 0 || !!c.deposit1Date || !!c.deposit2Date;
    if (!(c.contractFee || c.contractAt || hasDeposits)) return;

    const agentKey = c.assignedUserId || c.managerName || '미지정';
    const agentName = memberNameMap.get(agentKey) || c.managerName || (agentKey.includes('@') ? agentKey.split('@')[0] : agentKey);
    const partner = partners.find(pt => pt.partnerId === c.partnerId);
    const cc = computeCaseCommission(c, partner, asOf);
    if (cc.problem) {
      if (c.contractAt || c.contractFee) {
        problems.push({ caseId: c.caseId, customerName: c.customerName, agentName, problem: PROBLEM_LABEL[cc.problem] || cc.problem });
      }
      return;
    }

    const totalWon = manwonToWon(cc.total);
    const split = calculateCommissionSplit(totalWon, p);
    // 단계별 금액(원)과 상담원 몫: 1단계 = 비율 반올림, 2단계 = 나머지 (합계가 정확히 맞게)
    const stage1 = cc.stages.find(s => s.stage === 1);
    const stage1Won = stage1 ? Math.min(totalWon, manwonToWon(stage1.amount)) : 0;
    const stageWon = (stage: 1 | 2) => stage === 1 ? stage1Won : totalWon - stage1Won;
    const agentStage1 = totalWon > 0 ? Math.round(split.agentShareWon * stage1Won / totalWon) : 0;
    const agentOf = (stage: 1 | 2) => stage === 1 ? agentStage1 : split.agentShareWon - agentStage1;

    const periodStages = cc.stages.filter(s => !s.future && periodOk(s.earnedAt));
    if (periodStages.length === 0) return;

    let feeWon = 0, agentWon = 0, lastEarned = '';
    periodStages.forEach(s => {
      feeWon += stageWon(s.stage);
      agentWon += agentOf(s.stage);
      if (s.earnedAt > lastEarned) lastEarned = s.earnedAt;
    });

    if (!agentMap.has(agentKey)) agentMap.set(agentKey, { agentName, lines: [], stageKeys: [] });
    const acc = agentMap.get(agentKey)!;
    acc.lines.push({
      caseId: c.caseId,
      customerName: c.customerName,
      partnerName: partner?.name,
      contractFeeWon: manwonToWon(c.contractFee),
      caseCommissionWon: totalWon,
      partnerFeeWon: feeWon,
      companyShareWon: feeWon - agentWon,
      agentShareWon: agentWon,
      contractDate: kstDateOf(c.contractAt),
      earnedAt: lastEarned || undefined,
    });
    periodStages.forEach(s => acc.stageKeys.push(s.key));
  });

  // 입금 확인 후 지급: 상담원 단계 줄 중 거래처에서 아직 다 못 받은 줄의 받을 날 + N일
  let ledgerByKey: Map<string, LedgerLine> | null = null;
  if (p.agentPayoutCycle === 'after_partner_deposit') {
    ledgerByKey = new Map();
    partners.forEach(pt => buildPartnerLedger(pt, cases, opts.collections || [], asOf).lines.forEach(l => ledgerByKey!.set(l.key, l)));
  }
  const fixedPayDate = nextAgentPayoutDate(p, asOf);

  const rows: AgentSettlementRowItem[] = [];
  agentMap.forEach((acc, key) => {
    let nextPayoutDate = fixedPayDate || asOf;
    let payoutNote: string | undefined;
    if (ledgerByKey) {
      const waiting = acc.stageKeys.map(k => ledgerByKey!.get(k)).filter((l): l is LedgerLine => !!l && l.outstanding > 0);
      if (waiting.length > 0) {
        nextPayoutDate = waiting.map(l => addDays(l.dueAt > asOf ? l.dueAt : asOf, p.payoutDelayDays)).sort()[0];
        payoutNote = `거래처 입금 대기 ${waiting.length}건`;
      } else {
        payoutNote = '거래처 입금 확인됨';
      }
    }
    const totalPartnerFeeWon = acc.lines.reduce((s, l) => s + l.partnerFeeWon, 0);
    const agentShareWon = acc.lines.reduce((s, l) => s + l.agentShareWon, 0);
    rows.push({
      agentId: key,
      agentName: acc.agentName,
      caseCount: acc.lines.length,
      totalPartnerFeeWon,
      companyShareWon: totalPartnerFeeWon - agentShareWon,
      agentShareWon,
      nextPayoutDate,
      payoutDDay: daysBetween(asOf, nextPayoutDate),
      payoutNote,
      caseList: acc.lines.sort((a, b) => (b.earnedAt || '').localeCompare(a.earnedAt || '')),
    });
  });

  return { rows: rows.sort((a, b) => b.agentShareWon - a.agentShareWon), problems };
}

/** 예전 호출 호환: 상담원 행만 */
export function computeAgentSettlementRows(
  cases: Case[], partners: Partner[], policy: SettlementPolicy, teamMembers: TeamMember[] = [], opts: AgentSettlementOptions = {},
): AgentSettlementRowItem[] {
  return computeAgentSettlement(cases, partners, policy, teamMembers, opts).rows;
}

// -------------------------------------------------------------
// 통합 경영 손익(P&L)
// -------------------------------------------------------------

export interface IntegratedPnLSummary {
  year: number;
  month: number | 'all';
  // 수익
  totalRevenueWon: number;        // 수수료 매출 = 공급가 (부가세 제외)
  totalVatWon: number;            // 매출 부가세 (부가세 별도 거래처만, 매출 아님)
  totalBilledWon: number;         // 청구액 = 공급가 + 부가세
  collectedRevenueWon: number;    // 기간 안에 실제 받은 돈 (통장 기준, 부가세 포함)
  outstandingRevenueWon: number;  // 기간에 생긴 청구 중 아직 못 받은 금액 (부가세 포함)
  // 배분
  totalCompanyMarginWon: number;  // 매출 - 상담원 수당
  totalAgentCommissionWon: number;
  // 비용
  totalDbCostWon: number;         // DB 구매 원가 (원)
  totalFixedCostWon: number;      // 지출 (만원 → 원)
  totalExpensesWon: number;
  // 손익
  netProfitWon: number;
  profitMarginRate: number;
  // 현금흐름
  cashInflowWon: number;
  cashOutflowWon: number;
  netCashFlowWon: number;
}

export interface PnLInput {
  partners: Partner[];
  cases: Case[];
  collections?: Collection[];
  agentRows: AgentSettlementRowItem[];   // 같은 기간으로 계산한 상담원 행
  batchQualityList?: BatchQualityMetric[];
  expenseItems?: ExpenseItem[];
  year: number;
  month: number | 'all';
  asOf?: string;
}

export function computeIntegratedPnLSummary(input: PnLInput): IntegratedPnLSummary {
  const { partners, cases, collections = [], agentRows, batchQualityList = [], expenseItems = [], year, month } = input;
  const asOf = input.asOf || todayKST();

  // 1. 매출: 받을 돈 원장의 발생 단계 중 기간에 지급 사유가 생긴 것
  let supplyWon = 0, billedWon = 0, outstandingWon = 0;
  partners.forEach(p => {
    const ledger = buildPartnerLedger(p, cases, collections, asOf);
    ledger.lines.filter(l => inPeriod(l.earnedAt, year, month)).forEach(l => {
      supplyWon += manwonToWon(l.amount);
      billedWon += manwonToWon(l.billed);
      outstandingWon += manwonToWon(Math.max(0, l.outstanding));
    });
  });
  const collectedRevenueWon = collections
    .filter(x => inPeriod(kstDateOf(x.date), year, month))
    .reduce((s, x) => s + manwonToWon(x.amount), 0);

  // 2. 상담원 수당 (같은 기간)
  const totalAgentCommissionWon = agentRows.reduce((s, a) => s + (a.agentShareWon || 0), 0);

  // 3. DB 구매 원가 (원) — 등록 시각을 한국 날짜로
  const totalDbCostWon = batchQualityList
    .filter(b => inPeriod(kstDateOf(b.createdAt), year, month))
    .reduce((s, b) => s + Math.round(Number(b.totalCost) || 0), 0);

  // 4. 지출 (만원 → 원)
  const totalFixedCostWon = expenseItems
    .filter(e => inPeriod(kstDateOf(e.date), year, month))
    .reduce((s, e) => s + manwonToWon(e.amount), 0);

  const totalExpensesWon = totalDbCostWon + totalAgentCommissionWon + totalFixedCostWon;
  const netProfitWon = supplyWon - totalExpensesWon;
  const profitMarginRate = supplyWon > 0 ? Number(((netProfitWon / supplyWon) * 100).toFixed(1)) : 0;
  const cashOutflowWon = totalDbCostWon + totalFixedCostWon;

  return {
    year,
    month,
    totalRevenueWon: supplyWon,
    totalVatWon: billedWon - supplyWon,
    totalBilledWon: billedWon,
    collectedRevenueWon,
    outstandingRevenueWon: outstandingWon,
    totalCompanyMarginWon: supplyWon - totalAgentCommissionWon,
    totalAgentCommissionWon,
    totalDbCostWon,
    totalFixedCostWon,
    totalExpensesWon,
    netProfitWon,
    profitMarginRate,
    cashInflowWon: collectedRevenueWon,
    cashOutflowWon,
    netCashFlowWon: collectedRevenueWon - cashOutflowWon,
  };
}
