// ============================================
// 정산: 변호사 사무실(거래처)에서 받을 수수료 계산 — 한 곳에서만 계산한다
//
// 규칙 (거래처 설정 → 수당 계산 룰 + 정산 스케줄)
// - 수수료 = 수임료가 속한 구간 규칙의 고정 금액 (utils.getMatchingRule: 가장 구체적인 구간)
// - 1단계(계약금 단계): 고객 누적 입금이 "구간 최저 수임료 × 계약금 비율(기본 10%)" 이상이 된 날
//   → 수수료 × 1차 지급 비율(기본 50%)
// - 2단계(완납 단계): 누적 입금이 "100% 지급 기준 금액" 이상이 된 날 (기준이 0이면 수임료 전액)
//   → 나머지 수수료
// - 받을 날: 지급 사유가 생긴 주의 마감 요일 다음 지급 요일 (+ 지급 주 지연). 정산 스케줄이 없으면 + paymentTermDays(기본 7일)
// - 입금일이 오늘 이후인 입금은 "예정"으로만 본다
// 금액 단위: 만원 (소수 1자리까지)
// ============================================
import { Case, Partner, CommissionRule } from '../types';
import { getMatchingRule } from '../utils';

export const CANCELLED_STATUSES = ['고객취소', '진행불가', '휴지통'];

/** 한국 날짜 YYYY-MM-DD (UTC 기준 toISOString은 오전 9시 전엔 어제가 된다) */
export const todayKST = (): string => {
  const d = new Date(Date.now() + 9 * 3600_000);
  return d.toISOString().slice(0, 10);
};

export const addDays = (ymd: string, days: number): string => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
};
const weekday = (ymd: string): number => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
export const daysBetween = (from: string, to: string): number => {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400_000);
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 지급 사유가 생긴 날 → 받기로 한 날 */
export const dueDateFor = (earnedAt: string, partner: Partner): string => {
  const cfg = partner.settlementConfig;
  if (!cfg || cfg.cutoffDay === undefined || cfg.payoutDay === undefined) {
    return addDays(earnedAt, partner.paymentTermDays ?? 7);
  }
  // 그 주 마감일 (마감 요일, 당일 포함)
  let cutoff = earnedAt;
  for (let i = 0; i < 7 && weekday(cutoff) !== cfg.cutoffDay; i++) cutoff = addDays(cutoff, 1);
  // 마감 다음 지급 요일 (마감일 다음 날부터)
  let pay = addDays(cutoff, 1);
  for (let i = 0; i < 7 && weekday(pay) !== cfg.payoutDay; i++) pay = addDays(pay, 1);
  return addDays(pay, 7 * (cfg.payoutWeekDelay || 0));
};

export type VatMode = 'separate' | 'included' | 'none';
export const vatModeOf = (p?: Partner | null): VatMode => (p?.vatMode || 'separate');
/** 청구액(사무실이 실제로 보낼 돈) = 수수료 + 부가세(별도일 때) */
export const billedOf = (amount: number, mode: VatMode) => mode === 'separate' ? round1(amount * 1.1) : round1(amount);
export const VAT_LABEL: Record<VatMode, string> = { separate: '부가세 별도 (+10%)', included: '부가세 포함', none: '부가세 없음' };

/** 만원 금액을 원 단위 정밀도(소수 4자리)로 맞춘다 — 0.5만원을 1만원으로 올리지 않는다 */
export const roundWonPrecision = (man: number): number => Math.round((Number(man) || 0) * 10000) / 10000;

/**
 * 세금계산서 기본값 (만원, 원 단위 정밀도)
 * - separate: 수수료 = 공급가, 부가세 = 10% 별도
 * - included: 수수료 안에 부가세 포함 → 공급가 = 수수료 ÷ 1.1
 * - none: 부가세 없음
 */
export const invoiceSplitOf = (commission: number, mode: VatMode): { supply: number; vat: number; total: number } => {
  const won = Math.round((Number(commission) || 0) * 10000);
  let supplyWon = won, vatWon = 0;
  if (mode === 'separate') vatWon = Math.round(won * 0.1);
  else if (mode === 'included') { supplyWon = Math.round(won / 1.1); vatWon = won - supplyWon; }
  return { supply: supplyWon / 10000, vat: vatWon / 10000, total: (supplyWon + vatWon) / 10000 };
};

export interface StageLine {
  key: string;            // `${caseId}:${stage}`
  caseId: string;
  customerName: string;
  partnerId: string;
  stage: 1 | 2;
  stageLabel: string;
  amount: number;         // 수수료 (만원, 부가세 전)
  billed: number;         // 청구액 (부가세 반영)
  earnedAt: string;       // 지급 사유 발생일 (기준 금액을 넘긴 입금일)
  dueAt: string;          // 받기로 한 날
  future: boolean;        // 입금 예정으로 계산한 미래 단계
  contractAt?: string;
  contractFee: number;
  status: string;
  cancelled: boolean;     // 고객취소·진행불가 → 환수 여부 확인 필요
}

export interface CaseCommission {
  caseId: string;
  rule?: CommissionRule;
  total: number;              // 이 리드 전체 수수료
  depositActual: number;      // 오늘까지 고객 입금 합계
  depositPlanned: number;     // 오늘 이후 입금 예정 합계
  firstThreshold: number;
  fullThreshold: number;
  stages: StageLine[];        // 발생했거나(과거) 예정(미래)인 단계
  problem?: '수임료 없음' | '수당 룰 없음' | '거래처 없음';
}

const depositsOf = (c: Case) => {
  const list = (c.depositHistory && c.depositHistory.length > 0)
    ? c.depositHistory
    : [{ date: c.deposit1Date || '', amount: c.deposit1Amount || 0 }, { date: c.deposit2Date || '', amount: c.deposit2Amount || 0 }];
  return list.filter(d => d && d.date && Number(d.amount) > 0)
    .map(d => ({ date: String(d.date).slice(0, 10), amount: Number(d.amount) }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const computeCaseCommission = (c: Case, partner: Partner | undefined, asOf: string = todayKST()): CaseCommission => {
  const base: CaseCommission = { caseId: c.caseId, total: 0, depositActual: 0, depositPlanned: 0, firstThreshold: 0, fullThreshold: 0, stages: [] };
  const deposits = depositsOf(c);
  base.depositActual = deposits.filter(d => d.date <= asOf).reduce((s, d) => s + d.amount, 0);
  base.depositPlanned = deposits.filter(d => d.date > asOf).reduce((s, d) => s + d.amount, 0);
  if (!partner) return { ...base, problem: '거래처 없음' };
  const fee = c.contractFee || 0;
  if (!fee) return { ...base, problem: '수임료 없음' };
  const rule = getMatchingRule(fee, partner.commissionRules || []);
  if (!rule || !rule.commission) return { ...base, problem: '수당 룰 없음' };

  const cfg = partner.settlementConfig;
  const downRate = (cfg?.downPaymentPercentage ?? 10) / 100;
  const firstRate = Math.min(Math.max((cfg?.firstPayoutPercentage ?? 50) / 100, 0), 1);
  const total = rule.commission;
  const firstThreshold = round1((rule.minFee || fee) * downRate);
  const fullThreshold = rule.fullPayoutThreshold && rule.fullPayoutThreshold > 0 ? rule.fullPayoutThreshold : fee;
  const single = firstRate >= 1 || firstThreshold >= fullThreshold;
  const firstAmt = single ? total : round1(total * firstRate);
  const mode = vatModeOf(partner);

  const cancelled = CANCELLED_STATUSES.includes(c.status);
  const mk = (stage: 1 | 2, amount: number, earnedAt: string): StageLine => ({
    key: `${c.caseId}:${stage}`, caseId: c.caseId, customerName: c.customerName, partnerId: partner.partnerId,
    stage, stageLabel: single ? '수수료 전액' : stage === 1 ? `계약금 단계 (${Math.round(firstRate * 100)}%)` : '완납 단계 (나머지)',
    amount, billed: billedOf(amount, mode), earnedAt, dueAt: dueDateFor(earnedAt, partner), future: earnedAt > asOf,
    contractAt: c.contractAt, contractFee: fee, status: c.status, cancelled,
  });

  let cum = 0;
  let s1: string | null = null;
  let s2: string | null = null;
  for (const d of deposits) {
    cum += d.amount;
    if (!s1 && cum >= (single ? fullThreshold : firstThreshold)) s1 = d.date;
    if (!single && !s2 && cum >= fullThreshold) s2 = d.date;
  }
  const stages: StageLine[] = [];
  if (s1) stages.push(mk(1, firstAmt, s1));
  if (s2) stages.push(mk(2, round1(total - firstAmt), s2));
  return { ...base, rule, total, firstThreshold, fullThreshold, stages };
};

// ---------------------------------------------
// 받은 돈 기록 + 미수금
// ---------------------------------------------
export interface Collection {
  id: string;
  partnerId: string;
  date: string;          // 입금일
  amount: number;        // 받은 금액 (만원, 통장에 들어온 그대로 = 부가세 포함 금액)
  memo?: string;
  bankTxId?: string;     // 통장 내역에서 가져온 경우
  createdAt: string;
}

export type LineState = '받음' | '일부 받음' | '연체' | '받을 예정' | '입금 예정';
export interface LedgerLine extends StageLine {
  received: number;      // 이 줄에 배정된 받은 돈
  outstanding: number;   // 남은 금액
  state: LineState;
  overdueDays: number;
}

export interface PartnerLedger {
  partner: Partner;
  lines: LedgerLine[];        // 발생한 단계 (과거)
  planned: StageLine[];       // 입금 예정으로 생길 단계 (미래)
  billedTotal: number;        // 지금까지 청구할 금액 합계
  receivedTotal: number;      // 받은 돈 합계
  outstanding: number;        // 미수금 (음수면 더 받음)
  overdue: number;            // 받기로 한 날이 지난 미수금
  dueSoon: number;            // 7일 안에 받을 금액
  nextDueAt?: string;
  problems: { caseId: string; customerName: string; problem: string }[];
  cancelledWithCommission: LedgerLine[];
}

/** 받은 돈을 오래된 청구부터 채운다 (FIFO) */
export const buildPartnerLedger = (partner: Partner, cases: Case[], collections: Collection[], asOf: string = todayKST()): PartnerLedger => {
  const mine = cases.filter(c => c.partnerId === partner.partnerId && c.status !== '휴지통' && (c.contractFee || c.contractAt || (c.depositHistory || []).length));
  const lines: StageLine[] = [];
  const planned: StageLine[] = [];
  const problems: PartnerLedger['problems'] = [];
  mine.forEach(c => {
    const cc = computeCaseCommission(c, partner, asOf);
    if (cc.problem && (c.contractAt || c.contractFee)) problems.push({ caseId: c.caseId, customerName: c.customerName, problem: cc.problem });
    cc.stages.forEach(s => (s.future ? planned : lines).push(s));
  });
  lines.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.earnedAt.localeCompare(b.earnedAt) || a.key.localeCompare(b.key));
  planned.sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  const receivedTotal = round1(collections.filter(x => x.partnerId === partner.partnerId).reduce((s, x) => s + (Number(x.amount) || 0), 0));
  let pool = receivedTotal;
  const ledgerLines: LedgerLine[] = lines.map(l => {
    const take = Math.max(0, Math.min(pool, l.billed));
    pool = round1(pool - take);
    const outstanding = round1(l.billed - take);
    const overdueDays = outstanding > 0 ? Math.max(0, daysBetween(l.dueAt, asOf)) : 0;
    const state: LineState = outstanding <= 0 ? '받음' : take > 0 ? '일부 받음' : l.dueAt < asOf ? '연체' : '받을 예정';
    return { ...l, received: round1(take), outstanding, state: state === '일부 받음' && l.dueAt < asOf ? '연체' : state, overdueDays };
  });
  const billedTotal = round1(lines.reduce((s, l) => s + l.billed, 0));
  const outstanding = round1(billedTotal - receivedTotal);
  const overdue = round1(ledgerLines.filter(l => l.outstanding > 0 && l.dueAt < asOf).reduce((s, l) => s + l.outstanding, 0));
  const soon = addDays(asOf, 7);
  const dueSoon = round1(ledgerLines.filter(l => l.outstanding > 0 && l.dueAt >= asOf && l.dueAt <= soon).reduce((s, l) => s + l.outstanding, 0));
  const nextDueAt = ledgerLines.find(l => l.outstanding > 0 && l.dueAt >= asOf)?.dueAt;
  return {
    partner, lines: ledgerLines, planned, billedTotal, receivedTotal, outstanding, overdue, dueSoon, nextDueAt, problems,
    cancelledWithCommission: ledgerLines.filter(l => l.cancelled),
  };
};

/**
 * [B2B] 거래처(법률사무소)별 TM사 수령 인센티브 수수료 계산 엔진
 * @param contractFee 총 수임료 (만원)
 * @param caseType 사건 종류 (예: '개인회생', '파산' 등)
 * @param partner 제휴 거래처 객체
 * @returns TM사 수령 인센티브 금액 (만원)
 */
export const calculatePartnerIncentive = (
  contractFee: number,
  caseType?: string,
  partner?: Partner | null
): { amount: number; rateLabel: string; type: 'rate' | 'fixed' | 'tiered' } => {
  if (!contractFee || contractFee <= 0) {
    return { amount: 0, rateLabel: '0%', type: 'rate' };
  }

  if (!partner) {
    // 파트너 미지정 시 기본 30% 정률
    const amt = Math.round(contractFee * 0.3 * 10) / 10;
    return { amount: amt, rateLabel: '30%', type: 'rate' };
  }

  const itype = partner.incentiveType || (partner.commissionRules && partner.commissionRules.length > 0 ? 'tiered' : 'rate');

  if (itype === 'fixed') {
    const fixedAmt = partner.incentiveFixedAmount ?? 50;
    return { amount: fixedAmt, rateLabel: `건당 ${fixedAmt}만원`, type: 'fixed' };
  }

  if (itype === 'tiered' && partner.commissionRules && partner.commissionRules.length > 0) {
    const rule = getMatchingRule(contractFee, partner.commissionRules);
    const amt = rule ? rule.commission : 0;
    return { amount: amt, rateLabel: rule ? `구간 ${amt}만원` : '미해당', type: 'tiered' };
  }

  // 기본 정률제(rate)
  let rate = partner.incentiveRate ?? 30;
  if (caseType && partner.caseTypeRates && typeof partner.caseTypeRates[caseType] === 'number') {
    rate = partner.caseTypeRates[caseType];
  }

  const amt = Math.round(contractFee * (rate / 100) * 10) / 10;
  return { amount: amt, rateLabel: `${rate}%`, type: 'rate' };
};

export const fmtMan = (v: number) => `${v.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만원`;

/** 월 정산서 글 (카톡·텔레그램에 붙여넣기) */
export const statementText = (lg: PartnerLedger, ym: string, opts: { bank?: string; sender?: string } = {}): string => {
  const [y, m] = ym.split('-');
  const rows = lg.lines.filter(l => l.earnedAt.startsWith(ym));
  const mode = vatModeOf(lg.partner);
  const supply = round1(rows.reduce((s, l) => s + l.amount, 0));
  const billed = round1(rows.reduce((s, l) => s + l.billed, 0));
  const out: string[] = [];
  out.push(`[${opts.sender || '리드마스터'}] ${lg.partner.name} ${Number(y)}년 ${Number(m)}월 수수료 정산서`);
  out.push('');
  if (rows.length === 0) out.push('- 이번 달 새로 생긴 지급 건이 없습니다.');
  rows.forEach((l, i) => {
    out.push(`${i + 1}. ${l.customerName} / 계약 ${l.contractAt || '-'} / 수임료 ${fmtMan(l.contractFee)} / ${l.stageLabel} ${fmtMan(l.amount)} (${l.earnedAt.slice(5).replace('-', '/')} 입금 기준)`);
  });
  out.push('');
  if (mode === 'separate') out.push(`합계: 공급가 ${fmtMan(supply)} + 부가세 ${fmtMan(round1(billed - supply))} = ${fmtMan(billed)}`);
  else out.push(`합계: ${fmtMan(billed)} (${VAT_LABEL[mode]})`);
  const prevOutstanding = round1(lg.lines.filter(l => l.earnedAt < `${ym}-01`).reduce((s, l) => s + l.outstanding, 0));
  if (prevOutstanding > 0) out.push(`지난달까지 미입금: ${fmtMan(prevOutstanding)}`);
  out.push(`현재 남은 금액(전체): ${fmtMan(Math.max(0, lg.outstanding))}`);
  if (opts.bank) out.push(`입금 계좌: ${opts.bank}`);
  return out.join('\n');
};
