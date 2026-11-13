// ============================================
// 회사별 서버 저장소(orgStore)에 두는 경영·정산 보조 데이터 정의 — 2026-11-13
// 예전 localStorage 키 → settings key
//   lm_fixed_costs                                           → fixedCosts
//   lm_budgets                                               → budgets
//   leadmaster_withholding_records + _semi_annual            → withholdingRecords { records, semiAnnual }
//   lm_ad_spend + lm_target_contracts                        → adMetrics { adSpend, targetContracts }
// (지출 expenses·은행 거래내역 bankTransactions·세무 알림 taxReminders는 services/api.ts,
//  교육 설정·기록 trainingConfig·trainingSessions는 services/trainingService.ts)
// ============================================
import { ExpenseCategory } from '../types';
import { StoreKeySpec, readLegacyJson } from './orgStore';

// ─── 고정비 ───
export interface FixedCost {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  dueDay: number; // 매월 결제일 (1-31)
  description: string;
  isActive: boolean;
  createdAt: string;
}

export const FIXED_COSTS_SPEC: StoreKeySpec<FixedCost[]> = {
  key: 'fixedCosts',
  empty: () => [],
  legacy: () => readLegacyJson<FixedCost[]>('lm_fixed_costs'),
  legacyKeys: ['lm_fixed_costs'],
};

// ─── 예산 ───
export interface Budget {
  id: string;
  category: ExpenseCategory;
  monthlyLimit: number;
  year: number;
  month: number;
}

export const BUDGETS_SPEC: StoreKeySpec<Budget[]> = {
  key: 'budgets',
  empty: () => [],
  legacy: () => readLegacyJson<Budget[]>('lm_budgets'),
  legacyKeys: ['lm_budgets'],
};

// ─── 원천세·외주비 ───
export type IncomeType = '사업소득(3.3%)' | '기타소득(8.8%)' | '근로소득(간이세액)' | '일용근로(2.7%)';

export interface WithholdingRecord {
  id: string;
  payDate: string;           // 지급일
  name: string;              // 이름/상호
  payAmount: number;         // 지급액 (원)
  incomeType: IncomeType;    // 소득구분
  withholdingTax: number;    // 원천징수액
  localIncomeTax: number;    // 지방소득세 (원천세의 10%)
  netAmount: number;         // 실지급액
  filingMonth: string;       // 원천세 신고월 (지급월+1)
  isFilingDone: boolean;     // 신고 완료 여부
  memo: string;
}

export interface WithholdingData {
  records: WithholdingRecord[];
  semiAnnual: boolean;
}

export const WITHHOLDING_SPEC: StoreKeySpec<WithholdingData> = {
  key: 'withholdingRecords',
  empty: () => ({ records: [], semiAnnual: false }),
  legacy: () => {
    const records = readLegacyJson<WithholdingRecord[]>('leadmaster_withholding_records');
    const semi = localStorage.getItem('leadmaster_withholding_semi_annual');
    if (!Array.isArray(records) && semi === null) return undefined;
    return { records: Array.isArray(records) ? records : [], semiAnnual: semi === 'true' };
  },
  legacyKeys: ['leadmaster_withholding_records', 'leadmaster_withholding_semi_annual'],
  isEmpty: v => !v || ((!Array.isArray(v.records) || v.records.length === 0) && !v.semiAnnual),
};

// ─── 통계 화면 광고비·목표 계약 ───
export interface AdMetrics {
  /** 'YYYY-MM' 또는 기간 키 → 광고비(원) — Statistics 화면 형식 그대로 */
  adSpend: Record<string, any>;
  targetContracts: number | null;
}

export const AD_METRICS_SPEC: StoreKeySpec<AdMetrics> = {
  key: 'adMetrics',
  empty: () => ({ adSpend: {}, targetContracts: null }),
  legacy: () => {
    const adSpend = readLegacyJson<Record<string, any>>('lm_ad_spend');
    const targetRaw = localStorage.getItem('lm_target_contracts');
    const target = targetRaw !== null && targetRaw !== '' && !isNaN(Number(targetRaw)) ? Number(targetRaw) : null;
    if (!adSpend && target === null) return undefined;
    return { adSpend: adSpend && typeof adSpend === 'object' ? adSpend : {}, targetContracts: target };
  },
  legacyKeys: ['lm_ad_spend', 'lm_target_contracts'],
  isEmpty: v => !v || (Object.keys(v.adSpend || {}).length === 0 && (v.targetContracts === null || v.targetContracts === undefined)),
};
