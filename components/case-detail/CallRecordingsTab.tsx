import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, PhoneIncoming, PhoneOutgoing, Sparkles, Loader2, ChevronDown, ChevronUp, Copy, ClipboardCheck, FileText, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { Case, MemoItem, AssetItem, CreditLoanItem } from '../../types';
import {
  CallRecording, ExtractedInfo, fetchCaseRecordings, fetchRecording, getRecordingUrl, requestAnalyze, markRecordingApplied,
  isNotReadyError, fmtBytes, fmtDuration, fmtManwon, extractedToText,
} from '../../services/recordings';

interface Props {
  c: Case;
  /** 리드 정보 고치기 (여러 칸 한 번에) */
  onApply: (updates: Partial<Case>) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const STATUS_LABEL: Record<CallRecording['status'], { text: string; cls: string }> = {
  uploaded: { text: 'AI 정리 전', cls: 'bg-gray-100 text-gray-600' },
  queued: { text: '대기 중', cls: 'bg-amber-100 text-amber-700' },
  processing: { text: 'AI 정리 중…', cls: 'bg-blue-100 text-blue-700' },
  done: { text: 'AI 정리 완료', cls: 'bg-green-100 text-green-700' },
  failed: { text: '실패', cls: 'bg-red-100 text-red-700' },
  skipped: { text: '건너뜀', cls: 'bg-gray-100 text-gray-500' },
};

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ---------------------------------------------
// AI 결과 → 리드 칸 후보 (현재 값과 나란히 보여주고 고른 것만 반영)
// ---------------------------------------------
interface Candidate { key: string; label: string; current: string; next: string; defaultOn: boolean; apply: (u: Partial<Case>) => void; }
const SYSTEM_DEFAULTS = new Set(['', '남', '미가입', '월세', '미혼', '기타']);
const emptyNum = (v: any) => v === undefined || v === null || Number(v) === 0;

function buildCandidates(c: Case, e: ExtractedInfo, rec: CallRecording): Candidate[] {
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
  pick('birth', '출생년도', e.personal.birth_year);
  pick('gender', '성별', e.personal.gender);
  pick('region', '지역', e.personal.region);
  if (e.income.job_types?.length) {
    const cur = (c.jobTypes || []).join(', ');
    const nx = e.income.job_types.join(', ');
    if (cur !== nx) out.push({ key: 'jobTypes', label: '직업', current: cur || '-', next: nx, defaultOn: !cur, apply: u => { u.jobTypes = e.income.job_types; } });
  }
  pick('insurance4', '4대보험', e.income.insurance4);
  num('incomeNet', '월 소득(실수령)', e.income.net_monthly_manwon);
  const det = { salary: e.income.salary_manwon, business: e.income.business_manwon, freelance: e.income.freelance_manwon };
  if (det.salary !== null || det.business !== null || det.freelance !== null) {
    const cur = c.incomeDetails || {};
    const merged: any = { ...cur };
    (Object.keys(det) as (keyof typeof det)[]).forEach(k => { if (det[k] !== null) merged[k] = det[k]; });
    const label = (o: any) => [o.salary ? `직장 ${o.salary}` : '', o.business ? `사업 ${o.business}` : '', o.freelance ? `프리 ${o.freelance}` : ''].filter(Boolean).join(' / ') || '-';
    if (label(cur) !== label(merged)) out.push({ key: 'incomeDetails', label: '직업별 수입(만원)', current: label(cur), next: label(merged), defaultOn: label(cur) === '-', apply: u => { u.incomeDetails = merged; } });
  }
  num('loanMonthlyPay', '대출 월 상환액', e.debt.monthly_payment_manwon);
  pick('maritalStatus', '결혼', e.family.marital_status);
  if (e.family.children_count !== null && e.family.children_count !== c.childrenCount) {
    out.push({ key: 'childrenCount', label: '미성년 자녀', current: c.childrenCount ? `${c.childrenCount}명` : '-', next: `${e.family.children_count}명`, defaultOn: !c.childrenCount, apply: u => { u.childrenCount = e.family.children_count!; } });
  }
  pick('housingType', '주거 형태', e.housing.type);
  pick('housingDetail', '주거 종류', e.housing.detail);
  num('deposit', '보증금', e.housing.deposit_manwon);
  num('rent', '월세', e.housing.rent_manwon);
  num('depositLoanAmount', '보증금 대출', e.housing.deposit_loan_manwon);
  pick('rentContractor', '임대차 계약인', e.housing.contractor);
  num('ownHousePrice', '자가 시세', e.housing.own_house_price_manwon);
  num('ownHouseLoan', '자가 담보대출', e.housing.own_house_loan_manwon);
  pick('creditCardUse', '신용카드', e.credit_card.use);
  num('creditCardAmount', '카드 사용액', e.credit_card.amount_manwon);

  const creditors = (e.debt.creditors || []).filter(cr => cr.kind !== '담보대출');
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
  // 상담 메모: 요약 + 채무 정리 전체 (항상 후보, 기본 켬)
  out.push({
    key: 'specialMemo', label: '상담 메모 추가', current: `${(c.specialMemo || []).length}건`, next: '요약·채무 정리 1건', defaultOn: !rec.appliedAt,
    apply: u => {
      const memo: MemoItem = { id: Date.now().toString(), createdAt: new Date().toISOString(), content: `[AI 통화 정리 ${fmtWhen(rec.callStartedAt)}]\n${extractedToText(rec)}`.slice(0, 4000) };
      u.specialMemo = [memo, ...((u.specialMemo as MemoItem[]) || c.specialMemo || [])];
    },
  });
  return out;
}

function ApplyModal({ c, rec, onClose, onApply }: { c: Case; rec: CallRecording; onClose: () => void; onApply: (u: Partial<Case>) => void }) {
  const cands = useMemo(() => buildCandidates(c, rec.extracted!, rec), [c, rec]);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(cands.map(x => [x.key, x.defaultOn])));
  const count = cands.filter(x => on[x.key]).length;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b dark:border-gray-700">
          <h3 className="font-bold text-gray-800 dark:text-white">AI 정리 → 상담 정보에 반영</h3>
          <p className="text-xs text-gray-500 mt-0.5">녹음에서 들은 값입니다. 맞는 것만 체크하세요. 이미 값이 있는 칸은 기본으로 체크하지 않았습니다.</p>
          {rec.appliedAt && <p className="text-xs text-amber-700 mt-1">이 녹음은 {fmtWhen(rec.appliedAt)}에 이미 반영했습니다. 채무·재산을 다시 반영하면 같은 항목이 한 번 더 들어갑니다.</p>}
        </div>
        <div className="overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/40"><tr><th className="w-10" /><th className="text-left px-2 py-1.5">항목</th><th className="text-left px-2">지금</th><th className="text-left px-2">AI</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {cands.map(x => (
                <tr key={x.key} className={on[x.key] ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''} onClick={() => setOn({ ...on, [x.key]: !on[x.key] })}>
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
            markRecordingApplied(rec.id).catch(() => { /* 표시만 실패 */ });
            onClose();
          }} className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-bold disabled:opacity-40 flex items-center gap-1"><Check size={14} /> {count}개 반영</button>
        </div>
      </div>
    </div>
  );
}

function ExtractedView({ e }: { e: ExtractedInfo }) {
  const row = (k: string, v: React.ReactNode) => (v === null || v === undefined || v === '' || v === '-') ? null : (
    <div className="flex gap-2 text-sm"><span className="w-24 shrink-0 text-gray-500">{k}</span><span className="text-gray-800 dark:text-gray-100">{v}</span></div>
  );
  const job = [e.income.job, ...(e.income.job_types || [])].filter(Boolean).join(', ');
  const det = [e.income.salary_manwon ? `직장 ${fmtManwon(e.income.salary_manwon)}` : '', e.income.business_manwon ? `사업 ${fmtManwon(e.income.business_manwon)}` : '', e.income.freelance_manwon ? `프리 ${fmtManwon(e.income.freelance_manwon)}` : ''].filter(Boolean).join(' / ');
  const h = e.housing;
  return (
    <div className="grid md:grid-cols-2 gap-x-6 gap-y-1">
      <div className="space-y-1">
        <div className="text-xs font-bold text-red-700 mb-1">채무</div>
        {row('총 채무', <b>{fmtManwon(e.debt.total_manwon)}</b>)}
        {row('월 상환', e.debt.monthly_payment_manwon !== null ? fmtManwon(e.debt.monthly_payment_manwon) : null)}
        {row('연체', e.debt.overdue)}
        {e.debt.creditors.length > 0 && (
          <ul className="text-sm pl-1 space-y-0.5">
            {e.debt.creditors.map((cr, i) => (
              <li key={i} className="text-gray-700 dark:text-gray-200">· {cr.name || cr.kind} <span className="text-xs text-gray-400">{cr.name ? cr.kind : ''}</span> {fmtManwon(cr.amount_manwon)}{cr.note ? <span className="text-xs text-gray-500"> - {cr.note}</span> : null}</li>
            ))}
          </ul>
        )}
        {row('신용카드', e.credit_card.use ? `${e.credit_card.use}${e.credit_card.amount_manwon ? ` ${fmtManwon(e.credit_card.amount_manwon)}` : ''}` : null)}
        {row('이력', e.history)}
      </div>
      <div className="space-y-1">
        <div className="text-xs font-bold text-emerald-700 mb-1">소득·가족·주거·재산</div>
        {row('월 소득', e.income.net_monthly_manwon !== null ? fmtManwon(e.income.net_monthly_manwon) : null)}
        {row('직업', job || null)}
        {row('직업별 수입', det || null)}
        {row('4대보험', e.income.insurance4)}
        {row('가족', [e.family.marital_status, e.family.children_count ? `자녀 ${e.family.children_count}명` : '', e.family.note].filter(Boolean).join(', ') || null)}
        {row('주거', h.type ? `${h.type}${h.detail ? `(${h.detail})` : ''}${h.deposit_manwon ? ` 보증금 ${fmtManwon(h.deposit_manwon)}` : ''}${h.rent_manwon ? ` 월세 ${fmtManwon(h.rent_manwon)}` : ''}${h.deposit_loan_manwon ? ` 보증금대출 ${fmtManwon(h.deposit_loan_manwon)}` : ''}${h.own_house_price_manwon ? ` 시세 ${fmtManwon(h.own_house_price_manwon)}` : ''}${h.own_house_loan_manwon ? ` 담보 ${fmtManwon(h.own_house_loan_manwon)}` : ''}` : null)}
        {e.assets.map((a, i) => <React.Fragment key={i}>{row(i === 0 ? '재산' : '', `${a.type}${a.owner ? `(${a.owner})` : ''} ${fmtManwon(a.amount_manwon)}${a.loan_manwon ? `, 대출 ${fmtManwon(a.loan_manwon)}` : ''}${a.desc ? ` - ${a.desc}` : ''}`)}</React.Fragment>)}
        {row('인적', [e.personal.birth_year ? `${e.personal.birth_year}년생` : '', e.personal.gender, e.personal.region].filter(Boolean).join(', ') || null)}
      </div>
      <div className="md:col-span-2 space-y-1 pt-1">
        {row('특이사항', e.special_notes)}
        {row('다음 할 일', e.next_action)}
        {row('진행 의사', e.customer_intent && e.customer_intent !== '알 수 없음' ? e.customer_intent : null)}
      </div>
    </div>
  );
}

function RecordingItemView({ c, rec, open, onToggle, onChanged, onApply, showToast }: {
  c: Case; rec: CallRecording; open: boolean; onToggle: () => void; onChanged: (r: CallRecording) => void;
  onApply: (u: Partial<Case>) => void; showToast: Props['showToast'];
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const st = STATUS_LABEL[rec.status] || STATUS_LABEL.uploaded;

  const loadUrl = async () => {
    if (rec.audioDeletedAt) return;
    setLoadingUrl(true);
    try { setUrl(await getRecordingUrl(rec.storagePath)); } catch (e: any) { showToast(`녹음을 열지 못했습니다: ${e.message}`, 'error'); } finally { setLoadingUrl(false); }
  };
  useEffect(() => { if (open && !url && !rec.audioDeletedAt) loadUrl(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const analyze = async () => {
    setBusy(true);
    try {
      const r = await requestAnalyze(rec.id);
      if (!r.queued && r.reason === 'already_processing') showToast('이미 AI 정리 중입니다.');
      else showToast('AI 정리를 시작했습니다. 1~2분 뒤 결과가 나옵니다.');
      onChanged({ ...rec, status: 'processing', error: undefined });
    } catch (e: any) {
      showToast(`AI 정리 요청 실패: ${e.message}`, 'error');
    } finally { setBusy(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(extractedToText(rec)); showToast('복사했습니다.'); } catch { showToast('복사하지 못했습니다.', 'error'); }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 rounded-lg">
        {rec.direction === 'CALL_IN' ? <PhoneIncoming size={16} className="text-green-600" /> : <PhoneOutgoing size={16} className="text-blue-600" />}
        <span className="font-medium text-gray-800 dark:text-gray-100 text-sm">{fmtWhen(rec.callStartedAt)}</span>
        <span className="text-xs text-gray-500">{fmtDuration(rec.durationSec)} · {fmtBytes(rec.sizeBytes)}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${st.cls}`}>{st.text}</span>
        {rec.appliedAt && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">반영함</span>}
        {rec.audioDeletedAt && <span className="text-xs text-gray-400">파일 보관 기간 지남</span>}
        <span className="ml-auto text-gray-400">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {!rec.audioDeletedAt && (url
            ? <audio controls preload="none" src={url} className="w-full h-10" />
            : <button onClick={loadUrl} disabled={loadingUrl} className="text-sm text-blue-600 flex items-center gap-1">{loadingUrl && <Loader2 size={14} className="animate-spin" />} 녹음 듣기</button>)}

          {rec.status === 'failed' && rec.error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 flex gap-1"><AlertTriangle size={14} className="shrink-0" /> {rec.error}</div>
          )}
          {rec.status === 'queued' && rec.error && <div className="text-xs text-amber-700">{rec.error}</div>}

          {rec.status === 'done' && rec.extracted && (
            <>
              {rec.summary && <div className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-900/40 rounded p-3">{rec.summary}</div>}
              <ExtractedView e={rec.extracted} />
            </>
          )}

          <div className="flex flex-wrap gap-2">
            {rec.status === 'done' && rec.extracted && (
              <>
                <button onClick={() => setShowApply(true)} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-bold flex items-center gap-1"><ClipboardCheck size={14} /> 상담 정보에 반영</button>
                <button onClick={copy} className="px-3 py-1.5 rounded border border-gray-300 text-sm flex items-center gap-1"><Copy size={14} /> 정리 복사</button>
                {rec.transcript && rec.transcript.length > 0 && (
                  <button onClick={() => setShowTranscript(v => !v)} className="px-3 py-1.5 rounded border border-gray-300 text-sm flex items-center gap-1"><FileText size={14} /> 대화록 {showTranscript ? '닫기' : `보기 (${rec.transcript.length}줄)`}</button>
                )}
              </>
            )}
            {!rec.audioDeletedAt && rec.status !== 'processing' && (
              <button onClick={analyze} disabled={busy} className="px-3 py-1.5 rounded border border-purple-300 text-purple-700 text-sm flex items-center gap-1 disabled:opacity-40">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {rec.status === 'done' ? 'AI 다시 정리' : 'AI 정리'}
              </button>
            )}
            {rec.status === 'processing' && <span className="text-sm text-blue-600 flex items-center gap-1"><Loader2 size={14} className="animate-spin" /> AI가 녹음을 듣고 있습니다…</span>}
          </div>

          {showTranscript && rec.transcript && (
            <div className="max-h-80 overflow-y-auto text-sm space-y-1 bg-gray-50 dark:bg-gray-900/40 rounded p-3">
              {rec.transcript.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-xs text-gray-400 tabular-nums w-10 shrink-0 pt-0.5">{l.t}</span>
                  <span className={`text-xs font-bold w-12 shrink-0 pt-0.5 ${l.speaker === '고객' ? 'text-emerald-700' : 'text-blue-700'}`}>{l.speaker}</span>
                  <span className="text-gray-800 dark:text-gray-100">{l.text}</span>
                </div>
              ))}
            </div>
          )}
          {rec.model && rec.analyzedAt && <div className="text-[11px] text-gray-400">AI 정리 {fmtWhen(rec.analyzedAt)} · {rec.model} · 녹음에서 들은 내용이라 틀릴 수 있으니 확인 후 반영하세요.</div>}
        </div>
      )}
      {showApply && rec.extracted && <ApplyModal c={c} rec={rec} onClose={() => setShowApply(false)} onApply={onApply} />}
    </div>
  );
}

/** 리드 상세 → 통화 녹음 탭: 앱이 자동으로 올린 녹음 + AI 정리 */
export function CallRecordingsTab({ c, onApply, showToast }: Props) {
  const [list, setList] = useState<CallRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const pollRef = useRef(0);
  // 부모가 렌더마다 새 showToast를 넘겨도 다시 불러오지 않도록
  const toastRef = useRef(showToast);
  toastRef.current = showToast;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchCaseRecordings(c.caseId);
      setList(rows);
      setNotReady(false);
      setOpenId(prev => prev ?? rows[0]?.id ?? null);
    } catch (e: any) {
      if (isNotReadyError(e)) setNotReady(true);
      else toastRef.current(`통화 녹음을 불러오지 못했습니다: ${e.message}`, 'error');
    } finally { setLoading(false); }
  }, [c.caseId]);
  useEffect(() => { load(); }, [load]);

  // AI 정리 중인 녹음은 5초마다 확인 (최대 4분)
  const processingIds = list.filter(r => r.status === 'processing').map(r => r.id).join(',');
  useEffect(() => {
    if (!processingIds) { pollRef.current = 0; return; }
    const t = setInterval(async () => {
      pollRef.current += 1;
      if (pollRef.current > 48) { clearInterval(t); return; }
      for (const id of processingIds.split(',')) {
        const r = await fetchRecording(id).catch(() => null);
        if (r && r.status !== 'processing') setList(prev => prev.map(x => x.id === id ? r : x));
      }
    }, 5000);
    return () => clearInterval(t);
  }, [processingIds]);

  if (notReady) return <div className="text-sm text-gray-500 p-6 text-center">통화 녹음 기능은 서버 업데이트 후 사용할 수 있습니다.</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Mic size={18} className="text-purple-600" />
        <h3 className="font-bold text-gray-800 dark:text-white">통화 녹음 · AI 채무 정리</h3>
        <span className="text-xs text-gray-400">앱이 이 고객과의 통화 녹음을 자동으로 올립니다</span>
        <button onClick={load} className="ml-auto text-xs text-gray-500 flex items-center gap-1"><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 새로고침</button>
      </div>
      {list.map(r => (
        <div key={r.id}>
          <RecordingItemView c={c} rec={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)}
            onChanged={nr => setList(prev => prev.map(x => x.id === nr.id ? nr : x))} onApply={onApply} showToast={showToast} />
        </div>
      ))}
      {!loading && list.length === 0 && (
        <div className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4 space-y-1">
          <p>아직 올라온 통화 녹음이 없습니다.</p>
          <p className="text-xs">자동으로 올리려면: ① 팀 관리 → 통화 녹음에서 "자동 업로드" 켜기 ② 폰의 전화 앱(삼성 전화·T전화)에서 통화 자동 녹음 켜기 ③ 리드마스터 앱 1.5.0 이상 + "음악 및 오디오" 권한 허용. 그 뒤 이 고객과 통화하면 몇 분 안에 여기에 나옵니다.</p>
        </div>
      )}
    </div>
  );
}
