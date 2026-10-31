// ============================================
// 상담 진행(접수 → 통화 → 정보 수집) 공용 계산
// - 거래처별 "필수 확인 항목"(Partner.checkItems)이 리드에 입력됐는지
// - 채무 합계 (신용·카드·담보)
// ============================================
import { Case, Partner } from '../types';
import { CHECK_ITEMS, DEFAULT_CHECK_ITEMS } from '../constants';

export const checkItemsFor = (p?: Partner | null): string[] =>
  (p?.checkItems && p.checkItems.length > 0 ? p.checkItems : DEFAULT_CHECK_ITEMS);

const memoText = (c: Case) => (c.specialMemo || []).map(m => String(m?.content || '')).join('\n') + '\n' + String(c.preInfo || '');

/** 항목이 입력됐는지 (입력 칸이 없는 항목은 상담 메모에 적었는지로 판단) */
export const isCheckItemFilled = (c: Case, key: string): boolean => {
  const memo = memoText(c);
  switch (key) {
    case 'birth': return !!String(c.birth || '').trim();
    case 'region': return !!String(c.region || '').trim();
    case 'job': return (c.jobTypes || []).length > 0;
    case 'income': {
      const d = c.incomeDetails || {};
      return (c.incomeNet || 0) > 0 || (d.salary || 0) > 0 || (d.business || 0) > 0 || (d.freelance || 0) > 0 || (c.jobTypes || []).includes('무직');
    }
    case 'insurance4': return !!c.insurance4;
    case 'marital': return !!c.maritalStatus;
    case 'children': return c.maritalStatus === '미혼' || (c.childrenCount !== undefined && c.childrenCount !== null);
    case 'housing': return c.housingType === '무상거주' || (c.deposit || 0) > 0 || (c.rent || 0) > 0 || (c.ownHousePrice || 0) > 0;
    case 'debtTotal': return getDebtSummary(c).total > 0;
    case 'creditors': return (c.creditLoan || []).length > 0;
    case 'monthlyPay': return (c.loanMonthlyPay || 0) > 0;
    case 'overdue': return /연체|독촉|압류|추심|가압류|지급명령/.test(memo);
    case 'assets': return (c.assets || []).length > 0 || /(재산|자산)\s*(은\s*)?없/.test(memo);
    case 'spouseAssets': return c.maritalStatus === '미혼' || (c.assets || []).some(a => a.owner && a.owner !== '본인') || /배우자.{0,10}(재산|명의|소득|없)/.test(memo);
    case 'creditCard': return !!c.creditCardUse;
    case 'history': return !!c.historyType;
    case 'contactTime': return (c.reminders || []).length > 0 || /통화\s*가능|연락\s*가능/.test(memo);
    default: return true;
  }
};

export interface CheckProgress {
  items: { key: string; label: string; filled: boolean }[];
  done: number;
  total: number;
  missing: string[]; // 라벨
}

export const getCheckProgress = (c: Case, partner?: Partner | null): CheckProgress => {
  const keys = checkItemsFor(partner);
  const items = keys
    .map(k => CHECK_ITEMS.find(i => i.key === k))
    .filter((x): x is { key: string; label: string } => !!x)
    .map(i => ({ ...i, filled: isCheckItemFilled(c, i.key) }));
  const done = items.filter(i => i.filled).length;
  return { items, done, total: items.length, missing: items.filter(i => !i.filled).map(i => i.label) };
};

/** 채무 합계 (만원): 신용(대출+카드) / 담보(보증금 대출·집 담보·재산 담보) */
export const getDebtSummary = (c: Case) => {
  const credit = (c.creditLoan || []).reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const card = c.creditCardUse === '사용' ? (c.creditCardAmount || 0) : 0;
  let collateral = 0;
  if (c.housingType === '자가') collateral += c.ownHouseLoan || 0;
  else if (c.housingType !== '무상거주') collateral += c.depositLoanAmount || 0;
  (c.assets || []).forEach(a => { collateral += Number(a.loanAmount) || 0; });
  return { credit: credit + card, creditLoanOnly: credit, card, collateral, total: credit + card + collateral };
};
