import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, PhoneIncoming, PhoneOutgoing, Sparkles, Loader2, ChevronDown, ChevronUp, Copy, ClipboardCheck, FileText, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { Case, MemoItem, AssetItem, CreditLoanItem } from '../../types';
import {
  CallRecording, ExtractedInfo, fetchCaseRecordings, fetchRecording, getPlayableUrl, requestAnalyze, markRecordingApplied,
  isNotReadyError, fmtBytes, fmtDuration, fmtManwon, extractedToText,
} from '../../services/recordings';
import { logRecordingPlay } from '../../services/accessLog';
import { AiApplyModal } from './AiApplyModal';

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

function RecordingItemView({ c, rec, open, onToggle, onChanged, onApply, showToast, isLatest = false }: {
  c: Case; rec: CallRecording; open: boolean; onToggle: () => void; onChanged: (r: CallRecording) => void;
  onApply: (u: Partial<Case>) => void; showToast: Props['showToast']; isLatest?: boolean;
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
    try { setUrl(await getPlayableUrl(rec)); } catch (e: any) { showToast(`녹음을 열지 못했습니다: ${e.message}`, 'error'); } finally { setLoadingUrl(false); }
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
    // 사무실 양식 보고서가 있으면 그것을, 없으면 요약 + 채무 정리
    const text = rec.extracted?.office_summary || extractedToText(rec);
    try { await navigator.clipboard.writeText(text); showToast('복사했습니다.'); } catch { showToast('복사하지 못했습니다.', 'error'); }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 rounded-lg">
        {rec.direction === 'CALL_IN' ? <PhoneIncoming size={16} className="text-green-600" /> : <PhoneOutgoing size={16} className="text-blue-600" />}
        <span className="font-medium text-gray-800 dark:text-gray-100 text-sm">{fmtWhen(rec.callStartedAt)}</span>
        <span className="text-xs text-gray-500">{fmtDuration(rec.durationSec)} · {fmtBytes(rec.sizeBytes)}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${st.cls}`}>{st.text}</span>
        {rec.appliedAt && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">반영함</span>}
        {rec.storageKind === 'gdrive' && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700" title="회사 구글 드라이브에 원본 보관">드라이브{rec.source === 'import' ? ' · 예전 녹음' : ''}</span>}
        {rec.audioDeletedAt && <span className="text-xs text-gray-400">{rec.storageKind === 'gdrive' ? '파일 삭제됨' : '파일 보관 기간 지남'}</span>}
        <span className="ml-auto text-gray-400">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {!rec.audioDeletedAt && (url
            ? <audio controls preload="none" src={url} className="w-full h-10" onPlay={() => logRecordingPlay(rec.caseId, rec.id)} />
            : <button onClick={loadUrl} disabled={loadingUrl} className="text-sm text-blue-600 flex items-center gap-1">{loadingUrl && <Loader2 size={14} className="animate-spin" />} 녹음 듣기</button>)}

          {rec.status === 'failed' && rec.error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 flex gap-1"><AlertTriangle size={14} className="shrink-0" /> {rec.error}</div>
          )}
          {rec.status === 'queued' && rec.error && <div className="text-xs text-amber-700">{rec.error}</div>}

          {rec.status === 'done' && rec.extracted && (
            <>
              {/* 거래처 설정 연동: 분류 · 빠진 확인 항목 */}
              {(rec.extracted.classification || (rec.extracted.missing_items || []).length > 0) && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {rec.extracted.classification && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white font-bold" title={rec.extracted.classification.reason || ''}>
                      {rec.extracted.classification.label}
                    </span>
                  )}
                  {rec.extracted.case_type_suggestion && rec.extracted.case_type_suggestion !== c.caseType && (
                    <span className="px-2 py-0.5 rounded-md border border-slate-300 text-slate-700">추천 절차: {rec.extracted.case_type_suggestion}</span>
                  )}
                  {rec.extracted.classification?.reason && <span className="text-xs text-gray-500">{rec.extracted.classification.reason}</span>}
                </div>
              )}
              {(rec.extracted.missing_items || []).length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm">
                  <div className="font-semibold text-amber-900 mb-1">다음 통화에서 확인할 것</div>
                  <div className="flex flex-wrap gap-1.5">
                    {rec.extracted.missing_items!.map(m => <span key={m} className="px-2 py-0.5 rounded bg-white border border-amber-300 text-amber-900 text-xs">{m}</span>)}
                  </div>
                </div>
              )}
              {rec.summary && <div className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-900/40 rounded p-3">{rec.summary}</div>}
              <ExtractedView e={rec.extracted} />
              {rec.extracted.office_summary && (
                <details className="rounded-lg border border-gray-200 dark:border-gray-700">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200">사무실 보고서 (거래처 요약문 양식)</summary>
                  <pre className="px-3 pb-3 text-sm whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-100">{rec.extracted.office_summary}</pre>
                </details>
              )}
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
      {showApply && rec.extracted && <AiApplyModal c={c} extracted={rec.extracted} preferNew={isLatest} sourceLabel={`${fmtWhen(rec.callStartedAt)} 통화`} memo={{ title: `[AI 통화 정리 ${fmtWhen(rec.callStartedAt)}]`, text: extractedToText(rec), alreadyApplied: !!rec.appliedAt }} warning={rec.appliedAt ? `이 녹음은 ${fmtWhen(rec.appliedAt)}에 이미 반영했습니다. 채무·재산을 다시 반영하면 같은 항목이 한 번 더 들어갑니다.` : undefined} onClose={() => setShowApply(false)} onApply={onApply} onApplied={() => markRecordingApplied(rec.id).catch(() => { /* 표시만 실패 */ })} />}
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
      {list.map((r, idx) => (
        <div key={r.id}>
          <RecordingItemView c={c} rec={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)}
            onChanged={nr => setList(prev => prev.map(x => x.id === nr.id ? nr : x))} onApply={onApply} showToast={showToast} isLatest={idx === 0} />
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
