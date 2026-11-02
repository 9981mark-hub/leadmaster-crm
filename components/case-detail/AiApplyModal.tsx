import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Case, MemoItem, AssetItem, CreditLoanItem } from '../../types';
import { ExtractedInfo, fmtManwon } from '../../services/recordings';

/**
 * AI가 뽑은 고객 정보(ExtractedInfo) → 리드 칸 반영 (2026-11-02 공용으로 분리)
 * - 통화 녹음 탭(앱 자동 업로드 녹음)과 AI 요약 칸(직접 올린 녹음의 요약문)이 같이 쓴다.
 * - 지금 값과 AI 값을 나란히 보여주고, 체크한 것만 반영한다. 빈 칸만 기본 체크.
 */

interface Candidate { key: string; label: string; current: string; next: string; defaultOn: boolean; apply: (u: Partial<Case>) => void; }
const SYSTEM_DEFAULTS = new Set(['', '남', '미가입', '월세', '미혼', '기타']);
const emptyNum = (v: any) => v === undefined || v === null || Number(v) === 0;
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export interface ApplyMemo {
  /** 메모 첫 줄 (예: "[AI 통화 정리 11/2 10:36]") */
  title: string;
  text: string;
  /** 이미 반영한 적 있으면 메모는 기본으로 체크하지 않음 */
  alreadyApplied?: boolean;
}

export function buildCandidates(c: Case, e: ExtractedInfo, memo?: ApplyMemo): Candidate[] {
  const out: Candidate[] = [];
  const num = (key: keyof Case, label: string, v: number | null) => {
    if (v === null || v === undefined) return;
    const cur = (c as any)[key];
    if (Number(cur) === v) return;
    out.push({ key: String(key), label, current: emptyNum(cur) ? '-' : fmtManwon(Number(cur)), next: fmtManwon(v), defaultOn: emptyNum(cur), apply: u => { (u as any)[key] = v; } });
  };
  const pick = (key: keyof Case, label: string, v: string | null) => {
    if (!v) return;
    const cur = String((c as any)[key] ?? '');
    if (cur === v) return;
    out.push({ key: String(key), label, current: cur || '-', next: v, defaultOn: SYSTEM_DEFAULTS.has(cur), apply: u => { (u as any)[key] = v; } });
  };
  pick('caseType', '사건 유형', e.case_type_suggestion || null);
  pick('birth', '출생년도', e.personal?.birth_year || null);
  pick('gender', '성별', e.personal?.gender || null);
  pick('region', '지역', e.personal?.region || null);
  if (e.income?.job_types?.length) {
    const cur = (c.jobTypes || []).join(', ');
    const nx = e.income.job_types.join(', ');
    if (cur !== nx) out.push({ key: 'jobTypes', label: '직업', current: cur || '-', next: nx, defaultOn: !cur, apply: u => { u.jobTypes = e.income.job_types; } });
  }
  pick('insurance4', '4대보험', e.income?.insurance4 || null);
  num('incomeNet', '월 소득(실수령)', e.income?.net_monthly_manwon ?? null);

  // 직업별 수입 + 직장·사업장 소재지는 incomeDetails 한 칸에 들어 있으므로 하나씩 후보로 만들고 반영할 때 합친다
  const curDet: any = c.incomeDetails || {};
  const detPatch = (u: Partial<Case>, patch: Record<string, any>) => {
    u.incomeDetails = { ...curDet, ...(u.incomeDetails || {}), ...patch } as Case['incomeDetails'];
  };
  const det = { salary: e.income?.salary_manwon ?? null, business: e.income?.business_manwon ?? null, freelance: e.income?.freelance_manwon ?? null };
  if (det.salary !== null || det.business !== null || det.freelance !== null) {
    const merged: any = { ...curDet };
    (Object.keys(det) as (keyof typeof det)[]).forEach(k => { if (det[k] !== null) merged[k] = det[k]; });
    const label = (o: any) => [o.salary ? `직장 ${o.salary}` : '', o.business ? `사업 ${o.business}` : '', o.freelance ? `프리 ${o.freelance}` : ''].filter(Boolean).join(' / ') || '-';
    if (label(curDet) !== label(merged)) {
      const patch: any = {};
      (Object.keys(det) as (keyof typeof det)[]).forEach(k => { if (det[k] !== null) patch[k] = det[k]; });
      out.push({ key: 'incomeDetails', label: '직업별 수입(만원)', current: label(curDet), next: label(merged), defaultOn: label(curDet) === '-', apply: u => detPatch(u, patch) });
    }
  }
  const place = (key: 'workplace' | 'businessPlace', label: string, v?: string | null) => {
    const nx = String(v || '').trim();
    if (!nx) return;
    const cur = String(curDet[key] || '').trim();
    if (cur === nx) return;
    out.push({ key: `incomeDetails.${key}`, label, current: cur || '-', next: nx, defaultOn: !cur, apply: u => detPatch(u, { [key]: nx }) });
  };
  place('workplace', '직장 소재지', e.income?.workplace);
  place('businessPlace', '사업장 소재지', e.income?.business_place);

  num('loanMonthlyPay', '대출 월 상환액', e.debt?.monthly_payment_manwon ?? null);
  pick('maritalStatus', '결혼', e.family?.marital_status || null);
  if (e.family && e.family.children_count !== null && e.family.children_count !== undefined && e.family.children_count !== c.childrenCount) {
    out.push({ key: 'childrenCount', label: '미성년 자녀', current: c.childrenCount ? `${c.childrenCount}명` : '-', next: `${e.family.children_count}명`, defaultOn: !c.childrenCount, apply: u => { u.childrenCount = e.family.children_count!; } });
  }
  const h = e.housing || ({} as ExtractedInfo['housing']);
  pick('housingType', '주거 형태', h.type || null);
  pick('housingDetail', '주거 종류', h.detail || null);
  num('deposit', '보증금', h.deposit_manwon ?? null);
  num('rent', '월세', h.rent_manwon ?? null);
  num('depositLoanAmount', '보증금 대출', h.deposit_loan_manwon ?? null);
  pick('rentContractor', '임대차 계약인', h.contractor || null);
  num('ownHousePrice', '자가 시세', h.own_house_price_manwon ?? null);
  num('ownHouseLoan', '자가 담보대출', h.own_house_loan_manwon ?? null);
  pick('creditCardUse', '신용카드', e.credit_card?.use || null);
  num('creditCardAmount', '카드 사용액', e.credit_card?.amount_manwon ?? null);

  const creditors = (e.debt?.creditors || []).filter(cr => cr.kind !== '담보대출');
  if (creditors.length) {
    const items: CreditLoanItem[] = creditors.map(cr => ({
      id: uid(), amount: cr.amount_manwon || 0,
      desc: [cr.name, cr.name ? `(${cr.kind})` : cr.kind, cr.note].filter(Boolean).join(' '),
    }));
    const cur = c.creditLoan || [];
    const sum = items.reduce((s, x) => s + x.amount, 0);
    out.push({
      key: 'creditLoan', label: `신용 채무 ${items.length}건`, current: cur.length ? `${cur.length}건 (${fmtManwon(cur.reduce((s, x) => s + (x.amount || 0), 0))})` : '-',
      next: `${cur.length ? '추가 ' : ''}${items.length}건 (${fmtManwon(sum)})`, defaultOn: cur.length === 0,
      apply: u => { u.creditLoan = [...cur, ...items]; },
    });
  }
  const assets = e.assets || [];
  if (assets.length) {
    const items: AssetItem[] = assets.map(a => ({
      id: uid(), owner: a.owner || '본인', type: a.type || '기타', amount: a.amount_manwon || 0, loanAmount: a.loan_manwon || 0, desc: a.desc || '',
    }));
    const cur = c.assets || [];
    out.push({
      key: 'assets', label: `재산 ${items.length}건`, current: cur.length ? `${cur.length}건` : '-',
      next: `${cur.length ? '추가 ' : ''}${items.map(a => `${a.type} ${fmtManwon(a.amount)}`).join(', ')}`, defaultOn: cur.length === 0,
      apply: u => { u.assets = [...cur, ...items]; },
    });
  }
  if (memo && memo.text.trim()) {
    out.push({
      key: 'specialMemo', label: '상담 메모 추가', current: `${(c.specialMemo || []).length}건`, next: '정리 내용 1건', defaultOn: !memo.alreadyApplied,
      apply: u => {
        const m: MemoItem = { id: Date.now().toString(), createdAt: new Date().toISOString(), content: `${memo.title}\n${memo.text}`.slice(0, 4000) };
        u.specialMemo = [m, ...((u.specialMemo as MemoItem[]) || c.specialMemo || [])];
      },
    });
  }
  return out;
}

export function AiApplyModal({ c, extracted, memo, title = 'AI 정리 → 상담 정보에 반영', subtitle, warning, onClose, onApply, onApplied }: {
  c: Case;
  extracted: ExtractedInfo;
  memo?: ApplyMemo;
  title?: string;
  subtitle?: string;
  warning?: React.ReactNode;
  onClose: () => void;
  onApply: (u: Partial<Case>) => void;
  /** 반영한 뒤 (예: 녹음에 "반영함" 표시) */
  onApplied?: () => void;
}) {
  const cands = useMemo(() => buildCandidates(c, extracted, memo), [c, extracted, memo]);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(cands.map(x => [x.key, x.defaultOn])));
  const count = cands.filter(x => on[x.key]).length;
  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b dark:border-gray-700">
          <h3 className="font-bold text-gray-800 dark:text-white">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle || 'AI가 뽑은 값입니다. 맞는 것만 체크하세요. 이미 값이 있는 칸은 기본으로 체크하지 않았습니다.'}</p>
          {warning && <p className="text-xs text-amber-700 mt-1">{warning}</p>}
        </div>
        <div className="overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/40"><tr><th className="w-10" /><th className="text-left px-2 py-1.5">항목</th><th className="text-left px-2">지금</th><th className="text-left px-2">AI</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {cands.map(x => (
                <tr key={x.key} className={`cursor-pointer ${on[x.key] ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`} onClick={() => setOn({ ...on, [x.key]: !on[x.key] })}>
                  <td className="text-center"><input type="checkbox" checked={!!on[x.key]} onChange={() => setOn({ ...on, [x.key]: !on[x.key] })} onClick={e => e.stopPropagation()} /></td>
                  <td className="px-2 py-1.5 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{x.label}</td>
                  <td className="px-2 text-gray-400">{x.current}</td>
                  <td className="px-2 text-gray-800 dark:text-gray-100">{x.next}</td>
                </tr>
              ))}
              {cands.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center text-gray-400">새로 반영할 값이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t dark:border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border border-gray-300 text-sm">취소</button>
          <button disabled={count === 0} onClick={() => {
            const u: Partial<Case> = {};
            cands.filter(x => on[x.key]).forEach(x => x.apply(u));
            onApply(u);
            onApplied?.();
            onClose();
          }} className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-bold disabled:opacity-40 flex items-center gap-1"><Check size={14} /> {count}개 반영</button>
        </div>
      </div>
    </div>
  );
}
