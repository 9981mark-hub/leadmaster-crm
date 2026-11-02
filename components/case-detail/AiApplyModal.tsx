import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Case, MemoItem, AssetItem, CreditLoanItem } from '../../types';
import { ExtractedInfo, fmtManwon } from '../../services/recordings';

/**
 * AI가 뽑은 고객 정보(ExtractedInfo) → 리드 칸 반영 (2026-11-02 공용)
 * - 통화 녹음 탭(앱 자동 업로드 녹음)과 AI 요약 칸(직접 올린 녹음의 요약문)이 같이 쓴다.
 * - 같은 고객과 여러 번 통화해도 중복되지 않게 "추가 · 변경 · 없어짐?"으로 나눈다.
 *   · 하나짜리 칸: 값이 다르면 "변경". 빈 칸이거나 이번이 최근 통화면(preferNew) 기본 체크
 *   · 채무·재산: 기존 항목과 채권자 이름·종류(재산은 종류·명의)로 짝을 맞춰 금액만 바꾸거나 새로 추가
 *     이번에 안 나온 기존 항목은 "없어짐?"으로만 보여주고 기본으로 지우지 않는다
 * - 반영하면 바뀐 내용만 상담 메모 1건으로 남긴다 ("[11/16 통화 기준 정보 변경]")
 */

type Kind = 'add' | 'change' | 'remove' | 'memo';
interface Candidate {
  key: string; label: string; current: string; next: string; kind: Kind; defaultOn: boolean;
  /** 변경 기록 메모에 들어갈 한 줄 (memo 후보는 없음) */
  log?: string;
  apply: (u: Partial<Case>) => void;
}
const SYSTEM_DEFAULTS = new Set(['', '남', '미가입', '월세', '미혼', '기타']);
const emptyNum = (v: any) => v === undefined || v === null || Number(v) === 0;
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
/** 이름 비교용: 공백·괄호·"(주)"·"주식회사" 등 빼고 소문자 */
const norm = (s: string) => String(s || '').toLowerCase().replace(/\(주\)|주식회사|㈜|\s|[()\[\]·.,-]/g, '');

export interface ApplyMemo {
  /** 메모 첫 줄 (예: "[AI 통화 정리 11/2 10:36]") */
  title: string;
  text: string;
  /** 이미 반영한 적 있으면 메모는 기본으로 체크하지 않음 */
  alreadyApplied?: boolean;
}

export interface ApplyOptions {
  memo?: ApplyMemo;
  /** 이 정보가 이 고객의 가장 최근 통화에서 나온 것 → 바뀐 값도 기본 체크 */
  preferNew?: boolean;
  /** 변경 기록 메모 제목에 쓸 기준 (예: "11/16 통화", "AI 요약") */
  sourceLabel?: string;
}

export function buildCandidates(c: Case, e: ExtractedInfo, opts: ApplyOptions = {}): Candidate[] {
  const { memo, preferNew = false } = opts;
  const out: Candidate[] = [];
  const changedOn = (curEmpty: boolean) => curEmpty || preferNew;

  const num = (key: keyof Case, label: string, v: number | null) => {
    if (v === null || v === undefined) return;
    const cur = (c as any)[key];
    if (Number(cur) === v) return;
    const curEmpty = emptyNum(cur);
    const curTxt = curEmpty ? '-' : fmtManwon(Number(cur));
    out.push({
      key: String(key), label, current: curTxt, next: fmtManwon(v), kind: curEmpty ? 'add' : 'change', defaultOn: changedOn(curEmpty),
      log: curEmpty ? `${label}: ${fmtManwon(v)}` : `${label}: ${curTxt} → ${fmtManwon(v)}`,
      apply: u => { (u as any)[key] = v; },
    });
  };
  const pick = (key: keyof Case, label: string, v: string | null) => {
    if (!v) return;
    const cur = String((c as any)[key] ?? '');
    if (cur === v) return;
    const curEmpty = SYSTEM_DEFAULTS.has(cur);
    out.push({
      key: String(key), label, current: cur || '-', next: v, kind: cur ? 'change' : 'add', defaultOn: changedOn(curEmpty),
      log: cur ? `${label}: ${cur} → ${v}` : `${label}: ${v}`,
      apply: u => { (u as any)[key] = v; },
    });
  };

  pick('caseType', '사건 유형', e.case_type_suggestion || null);
  pick('birth', '출생년도', e.personal?.birth_year || null);
  pick('gender', '성별', e.personal?.gender || null);
  pick('region', '지역', e.personal?.region || null);
  if (e.income?.job_types?.length) {
    const cur = (c.jobTypes || []).join(', ');
    const nx = e.income.job_types.join(', ');
    if (cur !== nx) out.push({
      key: 'jobTypes', label: '직업', current: cur || '-', next: nx, kind: cur ? 'change' : 'add', defaultOn: changedOn(!cur),
      log: cur ? `직업: ${cur} → ${nx}` : `직업: ${nx}`, apply: u => { u.jobTypes = e.income.job_types; },
    });
  }
  pick('insurance4', '4대보험', e.income?.insurance4 || null);
  num('incomeNet', '월 소득(실수령)', e.income?.net_monthly_manwon ?? null);

  // 직업별 수입·소재지는 incomeDetails 한 칸 → 하나씩 후보로 만들고 반영할 때 합친다
  const curDet: any = c.incomeDetails || {};
  const detPatch = (u: Partial<Case>, patch: Record<string, any>) => {
    u.incomeDetails = { ...curDet, ...(u.incomeDetails || {}), ...patch } as Case['incomeDetails'];
  };
  const detNum = (k: 'salary' | 'business' | 'freelance', label: string, v: number | null | undefined) => {
    if (v === null || v === undefined) return;
    const cur = curDet[k];
    if (Number(cur) === v) return;
    const curEmpty = emptyNum(cur);
    out.push({
      key: `incomeDetails.${k}`, label, current: curEmpty ? '-' : fmtManwon(Number(cur)), next: fmtManwon(v), kind: curEmpty ? 'add' : 'change', defaultOn: changedOn(curEmpty),
      log: curEmpty ? `${label}: ${fmtManwon(v)}` : `${label}: ${fmtManwon(Number(cur))} → ${fmtManwon(v)}`,
      apply: u => detPatch(u, { [k]: v }),
    });
  };
  detNum('salary', '직장 월수입', e.income?.salary_manwon);
  detNum('business', '사업 월수입', e.income?.business_manwon);
  detNum('freelance', '프리랜서 월수입', e.income?.freelance_manwon);
  const place = (k: 'workplace' | 'businessPlace', label: string, v?: string | null) => {
    const nx = String(v || '').trim();
    if (!nx) return;
    const cur = String(curDet[k] || '').trim();
    if (cur === nx) return;
    out.push({
      key: `incomeDetails.${k}`, label, current: cur || '-', next: nx, kind: cur ? 'change' : 'add', defaultOn: changedOn(!cur),
      log: cur ? `${label}: ${cur} → ${nx}` : `${label}: ${nx}`, apply: u => detPatch(u, { [k]: nx }),
    });
  };
  place('workplace', '직장 소재지', e.income?.workplace);
  place('businessPlace', '사업장 소재지', e.income?.business_place);

  num('loanMonthlyPay', '대출 월 상환액', e.debt?.monthly_payment_manwon ?? null);
  pick('maritalStatus', '결혼', e.family?.marital_status || null);
  if (e.family && e.family.children_count !== null && e.family.children_count !== undefined && e.family.children_count !== c.childrenCount) {
    const curEmpty = !c.childrenCount;
    out.push({
      key: 'childrenCount', label: '미성년 자녀', current: curEmpty ? '-' : `${c.childrenCount}명`, next: `${e.family.children_count}명`, kind: curEmpty ? 'add' : 'change', defaultOn: changedOn(curEmpty),
      log: curEmpty ? `미성년 자녀: ${e.family.children_count}명` : `미성년 자녀: ${c.childrenCount}명 → ${e.family.children_count}명`,
      apply: u => { u.childrenCount = e.family.children_count!; },
    });
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

  // ---------- 신용 채무: 기존 항목과 짝 맞추기 ----------
  const curLoans = c.creditLoan || [];
  const loanBase = (u: Partial<Case>) => (u.creditLoan ? [...u.creditLoan] : [...curLoans]);
  const usedLoan = new Set<string>();
  const creditors = (e.debt?.creditors || []).filter(cr => cr.kind !== '담보대출');
  creditors.forEach((cr, i) => {
    const desc = [cr.name, cr.name ? `(${cr.kind})` : cr.kind, cr.note].filter(Boolean).join(' ');
    const amt = cr.amount_manwon || 0;
    // 1) 이름이 같은 기존 항목 2) 이름이 없으면 종류가 같고 하나뿐인 기존 항목
    let match: CreditLoanItem | undefined;
    if (cr.name && norm(cr.name).length >= 2) match = curLoans.find(x => !usedLoan.has(x.id) && norm(x.desc).includes(norm(cr.name!)));
    if (!match && !cr.name) {
      const same = curLoans.filter(x => !usedLoan.has(x.id) && norm(x.desc).includes(norm(cr.kind)));
      if (same.length === 1) match = same[0];
    }
    const name = cr.name || cr.kind;
    if (match) {
      usedLoan.add(match.id);
      if ((match.amount || 0) === amt || !amt) return; // 같음 (또는 금액을 말하지 않음)
      const id = match.id;
      out.push({
        key: `creditLoan:${id}`, label: `채무 · ${name}`, current: fmtManwon(match.amount || 0), next: fmtManwon(amt), kind: 'change', defaultOn: preferNew,
        log: `채무 ${name}: ${fmtManwon(match.amount || 0)} → ${fmtManwon(amt)}`,
        apply: u => { u.creditLoan = loanBase(u).map(x => x.id === id ? { ...x, amount: amt } : x); },
      });
    } else {
      const item: CreditLoanItem = { id: uid(), amount: amt, desc };
      out.push({
        key: `creditLoan:new:${i}`, label: `채무 · ${name}`, current: '-', next: `추가 ${fmtManwon(amt)}`, kind: 'add', defaultOn: true,
        log: `채무 추가: ${desc} ${fmtManwon(amt)}`,
        apply: u => { u.creditLoan = [...loanBase(u), item]; },
      });
    }
  });
  // 이번 통화에 안 나온 기존 채무 (AI가 채무 목록을 하나라도 말했을 때만 보여줌)
  if (creditors.length) {
    curLoans.filter(x => !usedLoan.has(x.id)).forEach(x => {
      out.push({
        key: `creditLoan:del:${x.id}`, label: `채무 · ${x.desc || '이름 없음'}`, current: fmtManwon(x.amount || 0), next: '이번 통화에 안 나옴 (체크하면 삭제)', kind: 'remove', defaultOn: false,
        log: `채무 삭제: ${x.desc || '이름 없음'} ${fmtManwon(x.amount || 0)}`,
        apply: u => { u.creditLoan = loanBase(u).filter(y => y.id !== x.id); },
      });
    });
  }

  // ---------- 재산: 종류·명의로 짝 맞추기 ----------
  const curAssets = c.assets || [];
  const assetBase = (u: Partial<Case>) => (u.assets ? [...u.assets] : [...curAssets]);
  const usedAsset = new Set<string>();
  const assets = e.assets || [];
  assets.forEach((a, i) => {
    const type = a.type || '기타';
    const owner = (a.owner || '본인') as AssetItem['owner'];
    const amt = a.amount_manwon || 0;
    const loan = a.loan_manwon || 0;
    const sameType = curAssets.filter(x => !usedAsset.has(x.id) && norm(x.type) === norm(type));
    const match = sameType.find(x => x.owner === owner) || (sameType.length === 1 ? sameType[0] : undefined);
    if (match) {
      usedAsset.add(match.id);
      const amtChanged = !!amt && amt !== (match.amount || 0);
      const loanChanged = a.loan_manwon !== null && a.loan_manwon !== undefined && loan !== (match.loanAmount || 0);
      if (!amtChanged && !loanChanged) return;
      const id = match.id;
      const fmt = (v: number, l: number) => `${fmtManwon(v)}${l ? ` (대출 ${fmtManwon(l)})` : ''}`;
      const nAmt = amtChanged ? amt : (match.amount || 0);
      const nLoan = loanChanged ? loan : (match.loanAmount || 0);
      out.push({
        key: `assets:${id}`, label: `재산 · ${type}(${match.owner})`, current: fmt(match.amount || 0, match.loanAmount || 0), next: fmt(nAmt, nLoan), kind: 'change', defaultOn: preferNew,
        log: `재산 ${type}(${match.owner}): ${fmt(match.amount || 0, match.loanAmount || 0)} → ${fmt(nAmt, nLoan)}`,
        apply: u => { u.assets = assetBase(u).map(x => x.id === id ? { ...x, amount: nAmt, loanAmount: nLoan } : x); },
      });
    } else {
      const item: AssetItem = { id: uid(), owner, type, amount: amt, loanAmount: loan, desc: a.desc || '' };
      out.push({
        key: `assets:new:${i}`, label: `재산 · ${type}(${owner})`, current: '-', next: `추가 ${fmtManwon(amt)}${loan ? ` (대출 ${fmtManwon(loan)})` : ''}`, kind: 'add', defaultOn: true,
        log: `재산 추가: ${type}(${owner}) ${fmtManwon(amt)}${loan ? `, 대출 ${fmtManwon(loan)}` : ''}${a.desc ? ` - ${a.desc}` : ''}`,
        apply: u => { u.assets = [...assetBase(u), item]; },
      });
    }
  });
  if (assets.length) {
    curAssets.filter(x => !usedAsset.has(x.id)).forEach(x => {
      out.push({
        key: `assets:del:${x.id}`, label: `재산 · ${x.type}(${x.owner})`, current: fmtManwon(x.amount || 0), next: '이번 통화에 안 나옴 (체크하면 삭제)', kind: 'remove', defaultOn: false,
        log: `재산 삭제: ${x.type}(${x.owner}) ${fmtManwon(x.amount || 0)}`,
        apply: u => { u.assets = assetBase(u).filter(y => y.id !== x.id); },
      });
    });
  }

  if (memo && memo.text.trim()) {
    out.push({
      key: 'specialMemo', label: '상담 메모 추가', current: `${(c.specialMemo || []).length}건`, next: '정리 내용 1건', kind: 'memo', defaultOn: !memo.alreadyApplied,
      apply: u => {
        const m: MemoItem = { id: `${Date.now()}`, createdAt: new Date().toISOString(), content: `${memo.title}\n${memo.text}`.slice(0, 4000) };
        u.specialMemo = [m, ...((u.specialMemo as MemoItem[]) || c.specialMemo || [])];
      },
    });
  }
  return out;
}

const KIND_BADGE: Record<Kind, { text: string; cls: string }> = {
  add: { text: '추가', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  change: { text: '변경', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  remove: { text: '없어짐?', cls: 'bg-red-50 text-red-700 border-red-200' },
  memo: { text: '메모', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export function AiApplyModal({ c, extracted, memo, preferNew, sourceLabel = 'AI 정리', title = 'AI 정리 → 상담 정보에 반영', subtitle, warning, onClose, onApply, onApplied }: {
  c: Case;
  extracted: ExtractedInfo;
  memo?: ApplyMemo;
  preferNew?: boolean;
  sourceLabel?: string;
  title?: string;
  subtitle?: string;
  warning?: React.ReactNode;
  onClose: () => void;
  onApply: (u: Partial<Case>) => void;
  /** 반영한 뒤 (예: 녹음에 "반영함" 표시) */
  onApplied?: () => void;
}) {
  const cands = useMemo(() => buildCandidates(c, extracted, { memo, preferNew, sourceLabel }), [c, extracted, memo, preferNew, sourceLabel]);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(cands.map(x => [x.key, x.defaultOn])));
  const count = cands.filter(x => on[x.key]).length;
  const counts = cands.reduce((m, x) => { m[x.kind] = (m[x.kind] || 0) + 1; return m; }, {} as Record<Kind, number>);
  const toggle = (k: string) => setOn(prev => ({ ...prev, [k]: !prev[k] }));
  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b dark:border-gray-700">
          <h3 className="font-bold text-gray-800 dark:text-white">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle || 'AI가 뽑은 값입니다. 맞는 것만 체크하세요.'}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {preferNew ? '가장 최근 통화라 바뀐 값도 기본으로 체크했습니다.' : '이미 값이 있는 칸은 기본으로 체크하지 않았습니다.'}
            {' '}채무·재산은 기존 항목과 이름·종류로 맞춰 금액만 바꾸고, 이번에 안 나온 항목은 지우지 않습니다.
          </p>
          <div className="flex gap-1.5 mt-1.5 text-[11px]">
            {(['add', 'change', 'remove'] as Kind[]).filter(k => counts[k]).map(k => (
              <span key={k} className={`px-1.5 py-0.5 rounded border ${KIND_BADGE[k].cls}`}>{KIND_BADGE[k].text} {counts[k]}</span>
            ))}
          </div>
          {warning && <p className="text-xs text-amber-700 mt-1">{warning}</p>}
        </div>
        <div className="overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/40"><tr><th className="w-10" /><th className="text-left px-2 py-1.5">항목</th><th className="text-left px-2">지금</th><th className="text-left px-2">AI</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {cands.map(x => (
                <tr key={x.key} className={`cursor-pointer ${on[x.key] ? (x.kind === 'remove' ? 'bg-red-50/60 dark:bg-red-900/10' : 'bg-blue-50/50 dark:bg-blue-900/10') : ''}`} onClick={() => toggle(x.key)}>
                  <td className="text-center"><input type="checkbox" checked={!!on[x.key]} onChange={() => toggle(x.key)} onClick={e => e.stopPropagation()} /></td>
                  <td className="px-2 py-1.5 font-medium text-gray-700 dark:text-gray-200">
                    <span className={`mr-1.5 text-[10px] px-1 py-0.5 rounded border ${KIND_BADGE[x.kind].cls}`}>{KIND_BADGE[x.kind].text}</span>{x.label}
                  </td>
                  <td className="px-2 text-gray-400">{x.current}</td>
                  <td className={`px-2 ${x.kind === 'remove' ? 'text-red-600 text-xs' : 'text-gray-800 dark:text-gray-100'}`}>{x.next}</td>
                </tr>
              ))}
              {cands.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center text-gray-400">바뀐 값이 없습니다. 지금 상담 정보와 같습니다.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t dark:border-gray-700 flex items-center justify-end gap-2">
          <span className="mr-auto text-[11px] text-gray-400">반영하면 바뀐 내용이 상담 메모에 기록됩니다.</span>
          <button onClick={onClose} className="px-4 py-2 rounded border border-gray-300 text-sm">취소</button>
          <button disabled={count === 0} onClick={() => {
            const chosen = cands.filter(x => on[x.key]);
            const u: Partial<Case> = {};
            chosen.forEach(x => x.apply(u));
            // 변경 기록 메모 (바뀐 칸만)
            const lines = chosen.map(x => x.log).filter(Boolean) as string[];
            if (lines.length) {
              const d = new Date();
              const when = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              const m: MemoItem = { id: `${Date.now()}c`, createdAt: d.toISOString(), content: `[${sourceLabel} 기준 정보 변경 · ${when} 반영]\n${lines.map(l => `- ${l}`).join('\n')}`.slice(0, 4000) };
              u.specialMemo = [m, ...((u.specialMemo as MemoItem[]) || c.specialMemo || [])];
            }
            onApply(u);
            onApplied?.();
            onClose();
          }} className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-bold disabled:opacity-40 flex items-center gap-1"><Check size={14} /> {count}개 반영</button>
        </div>
      </div>
    </div>
  );
}
