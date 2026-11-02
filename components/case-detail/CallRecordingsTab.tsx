import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic, PhoneIncoming, PhoneOutgoing, Sparkles, Loader2, Copy, ClipboardCheck,
  FileText, RefreshCw, AlertTriangle, Check, ExternalLink, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { Case } from '../../types';
import {
  CallRecording, ExtractedInfo, fetchCaseRecordings, fetchRecording, getPlayableUrl,
  requestAnalyze, markRecordingApplied, isNotReadyError, fmtBytes, fmtDuration,
  fmtManwon, extractedToText,
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
  uploaded: { text: 'AI 정리 전', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  queued: { text: '대기 중', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
  processing: { text: 'AI 정리 중…', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
  done: { text: 'AI 정리 완료', cls: 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300' },
  failed: { text: '실패', cls: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' },
  skipped: { text: '건너뜀', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const day = dayNames[d.getDay()];
  return `${month}/${date}(${day}) ${hours}:${minutes}`;
};

/**
 * 컴팩트 오디오 플레이어 (배속 지원 및 안정적인 재생바)
 */
function CompactAudioPlayer({
  rec,
  showToast
}: {
  rec: CallRecording;
  showToast: Props['showToast'];
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [speed, setSpeed] = useState<number>(1.0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadUrl = useCallback(async () => {
    if (rec.audioDeletedAt) return;
    setLoadingUrl(true);
    try {
      const u = await getPlayableUrl(rec);
      setUrl(u);
    } catch (e: any) {
      showToast(`녹음을 열지 못했습니다: ${e.message}`, 'error');
    } finally {
      setLoadingUrl(false);
    }
  }, [rec, showToast]);

  useEffect(() => {
    setUrl(null);
    if (!rec.audioDeletedAt) {
      loadUrl();
    }
  }, [rec.id, rec.audioDeletedAt, loadUrl]);

  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (audioRef.current) {
      audioRef.current.playbackRate = s;
    }
  };

  if (rec.audioDeletedAt) {
    return (
      <div className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <Clock size={14} className="shrink-0" />
        <span>{rec.storageKind === 'gdrive' ? '원본 오디오 파일이 삭제되었습니다.' : '오디오 보관 기간이 만료되어 파일이 삭제되었습니다.'}</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-gray-900/50 p-2.5 rounded-xl border border-slate-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center gap-2">
      {url ? (
        <>
          <audio
            ref={audioRef}
            controls
            preload="none"
            src={url}
            className="w-full sm:flex-1 h-9"
            onPlay={() => logRecordingPlay(rec.caseId, rec.id)}
          />
          <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
            {[1.0, 1.25, 1.5, 2.0].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => changeSpeed(s)}
                className={`px-2 py-1 text-xs rounded-md font-medium transition-all ${
                  speed === s
                    ? 'bg-purple-600 text-white font-bold shadow-xs'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={`재생 속도 ${s}배`}
              >
                {s}x
              </button>
            ))}
          </div>
        </>
      ) : (
        <button
          onClick={loadUrl}
          disabled={loadingUrl}
          className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 w-full hover:bg-purple-100 transition-colors"
        >
          {loadingUrl ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
          <span>{loadingUrl ? '녹음 파일 불러오는 중…' : '녹음 듣기'}</span>
        </button>
      )}
    </div>
  );
}

/**
 * 구조화된 금융/인적 데이터 카드 뷰
 */
function StructuredDataCards({ e }: { e: ExtractedInfo }) {
  const job = [e.income.job, ...(e.income.job_types || [])].filter(Boolean).join(', ');
  const det = [
    e.income.salary_manwon ? `직장 ${fmtManwon(e.income.salary_manwon)}` : '',
    e.income.business_manwon ? `사업 ${fmtManwon(e.income.business_manwon)}` : '',
    e.income.freelance_manwon ? `프리 ${fmtManwon(e.income.freelance_manwon)}` : ''
  ].filter(Boolean).join(' / ');
  const h = e.housing;

  const housingParts = [
    h.type ? `${h.type}${h.detail ? ` (${h.detail})` : ''}` : '',
    h.deposit_manwon ? `보증금 ${fmtManwon(h.deposit_manwon)}` : '',
    h.rent_manwon ? `월세 ${fmtManwon(h.rent_manwon)}` : '',
    h.deposit_loan_manwon ? `대출 ${fmtManwon(h.deposit_loan_manwon)}` : '',
    h.own_house_price_manwon ? `시세 ${fmtManwon(h.own_house_price_manwon)}` : '',
    h.own_house_loan_manwon ? `담보 ${fmtManwon(h.own_house_loan_manwon)}` : '',
    h.contractor ? `계약인: ${h.contractor}` : ''
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-3">
      {/* 2-Column Grid for Debt & Income/Assets */}
      <div className="grid md:grid-cols-2 gap-3">
        {/* CARD 1: 채무 정보 */}
        <div className="bg-red-50/40 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-red-100 dark:border-red-900/40 pb-2">
            <span className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> 채무 정보
            </span>
            {e.debt.total_manwon !== null && (
              <span className="text-sm font-extrabold text-red-600 dark:text-red-400">
                총 {fmtManwon(e.debt.total_manwon)}
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
            {e.debt.monthly_payment_manwon !== null && (
              <div className="flex justify-between">
                <span className="text-gray-500">월 상환액</span>
                <span className="font-semibold">{fmtManwon(e.debt.monthly_payment_manwon)}</span>
              </div>
            )}
            {e.debt.overdue && (
              <div className="flex justify-between">
                <span className="text-gray-500">연체 여부</span>
                <span className="font-semibold text-red-600 dark:text-red-400">{e.debt.overdue}</span>
              </div>
            )}
            {e.credit_card.use && (
              <div className="flex justify-between">
                <span className="text-gray-500">신용카드</span>
                <span>{e.credit_card.use}{e.credit_card.amount_manwon ? ` (${fmtManwon(e.credit_card.amount_manwon)})` : ''}</span>
              </div>
            )}
            {e.history && (
              <div className="flex justify-between">
                <span className="text-gray-500">회생·파산 이력</span>
                <span className="font-medium">{e.history}</span>
              </div>
            )}

            {e.debt.creditors.length > 0 && (
              <div className="mt-2 pt-2 border-t border-red-100/60 dark:border-red-900/30">
                <div className="text-[11px] font-semibold text-gray-500 mb-1">채권사별 내역 ({e.debt.creditors.length}곳)</div>
                <div className="space-y-1">
                  {e.debt.creditors.map((cr, i) => (
                    <div key={i} className="flex justify-between items-center text-[11px] bg-white/70 dark:bg-gray-800/60 px-2 py-1 rounded">
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {cr.name || cr.kind} <span className="text-gray-400 font-normal">({cr.kind})</span>
                      </span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {fmtManwon(cr.amount_manwon)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CARD 2: 소득 · 주거 · 재산 */}
        <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/40 pb-2">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 소득 · 재산 · 주거
            </span>
            {e.income.net_monthly_manwon !== null && (
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                월 {fmtManwon(e.income.net_monthly_manwon)}
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
            {job && (
              <div className="flex justify-between">
                <span className="text-gray-500">직업</span>
                <span className="font-medium">{job} {e.income.insurance4 ? `(4대보험: ${e.income.insurance4})` : ''}</span>
              </div>
            )}
            {det && (
              <div className="flex justify-between">
                <span className="text-gray-500">소득 세부</span>
                <span>{det}</span>
              </div>
            )}
            {housingParts && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-500 shrink-0">주거 형태</span>
                <span className="text-right font-medium">{housingParts}</span>
              </div>
            )}
            {(e.family.marital_status || e.family.children_count) && (
              <div className="flex justify-between">
                <span className="text-gray-500">부양가족</span>
                <span>{[e.family.marital_status, e.family.children_count ? `자녀 ${e.family.children_count}명` : ''].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {e.personal && (e.personal.birth_year || e.personal.region) && (
              <div className="flex justify-between">
                <span className="text-gray-500">인적사항</span>
                <span>{[e.personal.birth_year ? `${e.personal.birth_year}년생` : '', e.personal.gender, e.personal.region].filter(Boolean).join(' · ')}</span>
              </div>
            )}

            {e.assets.length > 0 && (
              <div className="mt-2 pt-2 border-t border-emerald-100/60 dark:border-emerald-900/30">
                <div className="text-[11px] font-semibold text-gray-500 mb-1">보유 재산 ({e.assets.length}건)</div>
                <div className="space-y-1">
                  {e.assets.map((a, i) => (
                    <div key={i} className="flex justify-between items-center text-[11px] bg-white/70 dark:bg-gray-800/60 px-2 py-1 rounded">
                      <span>{a.type}{a.owner ? ` (${a.owner})` : ''}</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {fmtManwon(a.amount_manwon)}{a.loan_manwon ? ` (대출 ${fmtManwon(a.loan_manwon)})` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CARD 3: 특이사항, 다음 할 일, 진행 의사 */}
      {(e.special_notes || e.next_action || (e.customer_intent && e.customer_intent !== '알 수 없음')) && (
        <div className="bg-slate-50 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700 rounded-xl p-3 text-xs space-y-1.5">
          {e.special_notes && (
            <div className="flex gap-2">
              <span className="font-bold text-purple-700 dark:text-purple-400 shrink-0 w-16">특이사항</span>
              <span className="text-gray-800 dark:text-gray-200 leading-relaxed">{e.special_notes}</span>
            </div>
          )}
          {e.next_action && (
            <div className="flex gap-2">
              <span className="font-bold text-indigo-700 dark:text-indigo-400 shrink-0 w-16">다음 할 일</span>
              <span className="text-gray-800 dark:text-gray-200 leading-relaxed">{e.next_action}</span>
            </div>
          )}
          {e.customer_intent && e.customer_intent !== '알 수 없음' && (
            <div className="flex gap-2">
              <span className="font-bold text-gray-600 dark:text-gray-400 shrink-0 w-16">진행 의사</span>
              <span className="font-semibold text-gray-900 dark:text-white">{e.customer_intent}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 선택된 통화 상세 대시보드 뷰
 */
function RecordingDetailDashboard({
  c,
  rec,
  onApply,
  showToast,
  onChanged,
  isLatest,
  callNumber
}: {
  c: Case;
  rec: CallRecording;
  onApply: Props['onApply'];
  showToast: Props['showToast'];
  onChanged: (r: CallRecording) => void;
  isLatest: boolean;
  callNumber: number;
}) {
  const [busy, setBusy] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const st = STATUS_LABEL[rec.status] || STATUS_LABEL.uploaded;

  const analyze = async () => {
    setBusy(true);
    try {
      const r = await requestAnalyze(rec.id);
      if (!r.queued && r.reason === 'already_processing') {
        showToast('이미 AI 정리 중입니다.');
      } else {
        showToast('AI 정리를 시작했습니다. 1~2분 뒤 결과가 나옵니다.');
      }
      onChanged({ ...rec, status: 'processing', error: undefined });
    } catch (e: any) {
      showToast(`AI 정리 요청 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    const text = rec.extracted?.office_summary || extractedToText(rec);
    try {
      await navigator.clipboard.writeText(text);
      showToast('요약 내용을 복사했습니다.');
    } catch {
      showToast('복사하지 못했습니다.', 'error');
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* 1. 상단 통화 메타 & 오디오 플레이어 카드 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700/60 pb-3">
          <div className="flex items-center gap-2">
            <span className={`p-1.5 rounded-lg ${rec.direction === 'CALL_IN' ? 'bg-green-100 text-green-700 dark:bg-green-950/50' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/50'}`}>
              {rec.direction === 'CALL_IN' ? <PhoneIncoming size={16} /> : <PhoneOutgoing size={16} />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-gray-900 dark:text-white text-sm sm:text-base">
                  {callNumber}차 통화 {isLatest && <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold">(최신)</span>}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>
                  {st.text}
                </span>
                {rec.appliedAt && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                    반영완료
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                <span>{fmtWhen(rec.callStartedAt)}</span>
                <span>·</span>
                <span>{fmtDuration(rec.durationSec)}</span>
                <span>·</span>
                <span>{fmtBytes(rec.sizeBytes)}</span>
                {rec.storageKind === 'gdrive' && (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 ml-1">
                    [구글드라이브]
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {rec.status === 'done' && (
              <button
                type="button"
                onClick={analyze}
                disabled={busy}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 flex items-center gap-1 transition-colors"
                title="AI 분석 재실행"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                <span>AI 재정리</span>
              </button>
            )}
          </div>
        </div>

        {/* 오디오 플레이어 */}
        <CompactAudioPlayer rec={rec} showToast={showToast} />
      </div>

      {/* 오류 상태 메시지 */}
      {rec.status === 'failed' && rec.error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
          <AlertTriangle size={16} className="shrink-0 text-red-500" />
          <div>
            <div className="font-bold">AI 정리 실패</div>
            <div>{rec.error}</div>
          </div>
        </div>
      )}

      {/* 대기 상태 메시지 */}
      {rec.status === 'queued' && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin shrink-0 text-amber-600" />
          <span>분석 대기 중입니다. 잠시 후 자동으로 정리가 시작됩니다.</span>
        </div>
      )}

      {/* 진행 중 상태 메시지 */}
      {rec.status === 'processing' && (
        <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin shrink-0 text-blue-600" />
          <span className="font-semibold">AI가 통화 녹음을 듣고 분석 중입니다… (약 1~2분 소요)</span>
        </div>
      )}

      {/* 2. AI 분석 완료 시 노출되는 메인 콘텐츠 */}
      {rec.status === 'done' && rec.extracted && (
        <>
          {/* AI 분류 및 진단 배너 */}
          {(rec.extracted.classification || rec.extracted.case_type_suggestion) && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800/60 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                {rec.extracted.classification?.label && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white dark:bg-purple-600 font-bold text-xs shadow-xs">
                    {rec.extracted.classification.label}
                  </span>
                )}
                {rec.extracted.case_type_suggestion && (
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-300 font-semibold text-xs">
                    추천 절차: {rec.extracted.case_type_suggestion}
                  </span>
                )}
                {rec.extracted.classification?.reason && (
                  <span className="text-xs text-gray-700 dark:text-gray-300 leading-snug">
                    {rec.extracted.classification.reason}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 다음 통화 확인 필요 항목 체크리스트 (결손 항목) */}
          {(rec.extracted.missing_items || []).length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> 다음 통화에서 확인해야 할 사항 ({rec.extracted.missing_items!.length}건)
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400">질문 체크리스트</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {rec.extracted.missing_items!.map(m => (
                  <span
                    key={m}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-medium shadow-2xs"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 이번 통화 핵심 요약문 */}
          {rec.summary && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-xs space-y-1.5">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <FileText size={14} className="text-purple-600" /> 통화 상담 요약
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                {rec.summary}
              </p>
            </div>
          )}

          {/* 구조화된 금융/인적 데이터 카드 (채무, 소득, 재산 등) */}
          <StructuredDataCards e={rec.extracted} />

          {/* 사무실 보고서 양식 (거래처 전달용 접이식) */}
          {rec.extracted.office_summary && (
            <details className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between transition-colors">
                <span>사무실 보고서 (거래처 요약문 양식)</span>
                <span className="text-xs text-purple-600 font-normal">펼치기/접기</span>
              </summary>
              <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700">
                <pre className="text-xs whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg leading-relaxed">
                  {rec.extracted.office_summary}
                </pre>
              </div>
            </details>
          )}

          {/* 원클릭 주요 액션 바 (데스크톱 및 기본 영역) */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowApply(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <ClipboardCheck size={16} />
                <span>상담 정보에 반영</span>
              </button>

              <button
                type="button"
                onClick={copy}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Copy size={15} />
                <span>요약 복사</span>
              </button>

              {rec.transcript && rec.transcript.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowTranscript(v => !v)}
                  className={`px-3 py-2 rounded-lg border text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors ${
                    showTranscript
                      ? 'bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-950 dark:border-purple-700 dark:text-purple-300'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <FileText size={15} />
                  <span>대화록 {showTranscript ? '닫기' : `보기 (${rec.transcript.length}줄)`}</span>
                </button>
              )}
            </div>

            {rec.model && rec.analyzedAt && (
              <span className="text-[11px] text-gray-400">
                {fmtWhen(rec.analyzedAt)} AI 정리됨 ({rec.model})
              </span>
            )}
          </div>

          {/* 대화록 보기 (메신저 스타일 말풍선 뷰어) */}
          {showTranscript && rec.transcript && (
            <div className="bg-slate-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2.5 max-h-96 overflow-y-auto">
              <div className="text-xs font-bold text-gray-500 mb-2">전체 대화록 전사본 ({rec.transcript.length}줄)</div>
              {rec.transcript.map((l, i) => {
                const isCustomer = l.speaker === '고객';
                return (
                  <div
                    key={i}
                    className={`flex flex-col gap-1 max-w-[85%] ${
                      isCustomer ? 'mr-auto items-start' : 'ml-auto items-end'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                      <span className="font-bold text-gray-600 dark:text-gray-300">{l.speaker}</span>
                      <span className="tabular-nums">{l.t}</span>
                    </div>
                    <div
                      className={`p-2.5 rounded-2xl text-xs leading-relaxed ${
                        isCustomer
                          ? 'bg-purple-50/90 border border-purple-100 dark:bg-purple-950/40 dark:border-purple-900/50 text-gray-900 dark:text-gray-100 rounded-tl-xs'
                          : 'bg-blue-600 text-white rounded-tr-xs shadow-xs'
                      }`}
                    >
                      {l.text}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 모바일 화면 전용: 화면 하단 플로팅 고정 액션 바 (스크롤 중에도 엄지손가락으로 즉시 반영) */}
          <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md dark:bg-gray-900/95 border-t border-gray-200 dark:border-gray-800 shadow-xl z-40 flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setShowApply(true)}
              className="flex-1 py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-sm font-bold flex items-center justify-center gap-1.5 shadow-md transition-all"
            >
              <ClipboardCheck size={18} />
              <span>상담 정보에 반영</span>
            </button>
            <button
              type="button"
              onClick={copy}
              className="py-3 px-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 active:scale-98 text-gray-700 dark:text-gray-200 text-sm font-semibold flex items-center justify-center gap-1 transition-all"
              title="요약 복사"
            >
              <Copy size={16} />
              <span>복사</span>
            </button>
          </div>
        </>
      )}

      {/* 상담 정보 반영 모달 */}
      {showApply && rec.extracted && (
        <AiApplyModal
          c={c}
          extracted={rec.extracted}
          preferNew={isLatest}
          sourceLabel={`${fmtWhen(rec.callStartedAt)} 통화`}
          memo={{
            title: `[AI 통화 정리 ${fmtWhen(rec.callStartedAt)}]`,
            text: extractedToText(rec),
            alreadyApplied: true,
          }}
          warning={
            rec.appliedAt
              ? `이 녹음은 ${fmtWhen(rec.appliedAt)}에 이미 반영했습니다. 채무·재산을 다시 반영하면 같은 항목이 한 번 더 들어갑니다.`
              : undefined
          }
          onClose={() => setShowApply(false)}
          onApply={onApply}
          onApplied={() => markRecordingApplied(rec.id).catch(() => {})}
        />
      )}
    </div>
  );
}

/**
 * 리드 상세 → 통화 녹음 탭 (PC 2단 Master-Detail & 모바일 적응형 탭 레이아웃)
 */
export function CallRecordingsTab({ c, onApply, showToast }: Props) {
  const [list, setList] = useState<CallRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pollRef = useRef(0);
  const toastRef = useRef(showToast);
  toastRef.current = showToast;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchCaseRecordings(c.caseId);
      setList(rows);
      setNotReady(false);
      setSelectedId(prev => (prev && rows.some(r => r.id === prev) ? prev : rows[0]?.id ?? null));
    } catch (e: any) {
      if (isNotReadyError(e)) {
        setNotReady(true);
      } else {
        toastRef.current(`통화 녹음을 불러오지 못했습니다: ${e.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [c.caseId]);

  useEffect(() => {
    load();
  }, [load]);

  // AI 정리 중인 녹음은 5초마다 확인 (최대 4분)
  const processingIds = list.filter(r => r.status === 'processing').map(r => r.id).join(',');
  useEffect(() => {
    if (!processingIds) {
      pollRef.current = 0;
      return;
    }
    const t = setInterval(async () => {
      pollRef.current += 1;
      if (pollRef.current > 48) {
        clearInterval(t);
        return;
      }
      for (const id of processingIds.split(',')) {
        const r = await fetchRecording(id).catch(() => null);
        if (r && r.status !== 'processing') {
          setList(prev => prev.map(x => (x.id === id ? r : x)));
        }
      }
    }, 5000);
    return () => clearInterval(t);
  }, [processingIds]);

  if (notReady) {
    return (
      <div className="text-sm text-gray-500 p-8 text-center bg-gray-50 dark:bg-gray-800/40 rounded-xl">
        통화 녹음 기능은 서버 업데이트 후 사용할 수 있습니다.
      </div>
    );
  }

  const selectedRecording = list.find(r => r.id === selectedId) || list[0] || null;
  const selectedIndex = list.findIndex(r => r.id === selectedId);
  const callNumber = selectedIndex >= 0 ? list.length - selectedIndex : list.length;
  const isLatest = selectedIndex === 0;

  return (
    <div className="space-y-4 pb-12 md:pb-0">
      {/* 1. 탭 상단 헤더 영역 */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
            <Mic size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                통화 녹음 · AI 채무 정리
              </h3>
              {list.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                  총 {list.length}건
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              앱이 이 고객과의 통화 녹음을 자동으로 올리고 AI로 정리합니다
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">새로고침</span>
        </button>
      </div>

      {/* 2. 다중 통화 시 모바일/태블릿용 수평 탭 셀렉터 바 (2~5건일 때 노출) */}
      {list.length > 1 && (
        <div className="xl:hidden">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {list.map((r, idx) => {
              const isSelected = r.id === (selectedId || list[0]?.id);
              const num = list.length - idx;
              const isFirst = idx === 0;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs whitespace-nowrap shrink-0 transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white font-bold shadow-sm shadow-purple-500/20'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {r.direction === 'CALL_IN' ? (
                    <PhoneIncoming size={13} className={isSelected ? 'text-purple-200' : 'text-green-600'} />
                  ) : (
                    <PhoneOutgoing size={13} className={isSelected ? 'text-purple-200' : 'text-blue-600'} />
                  )}
                  <span>{isFirst ? `⭐ ${num}차(최신)` : `${num}차`}</span>
                  <span className={isSelected ? 'text-purple-200 font-normal' : 'text-gray-400'}>
                    {fmtWhen(r.callStartedAt)}
                  </span>
                  <span className={isSelected ? 'text-purple-100 font-medium' : 'text-gray-500'}>
                    ({fmtDuration(r.durationSec)})
                  </span>
                  {r.appliedAt && (
                    <span className={`text-[10px] px-1 py-0.5 rounded font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                    }`}>
                      반영됨
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. 메인 콘텐츠: PC Master-Detail (2단) or 단일 통화 레이아웃 */}
      {list.length > 0 && selectedRecording ? (
        <div className={`flex flex-col ${list.length > 1 ? 'xl:flex-row' : ''} gap-5 items-start`}>
          {/* PC용 좌측 타임라인 목록 (통화 2건 이상일 때만 표시) */}
          {list.length > 1 && (
            <div className="hidden xl:flex flex-col w-72 shrink-0 border-r border-gray-200 dark:border-gray-700 pr-4 space-y-2 max-h-[750px] overflow-y-auto no-scrollbar">
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1 mb-1">
                통화 이력 ({list.length}건)
              </div>
              {list.map((r, idx) => {
                const isSelected = r.id === (selectedId || list[0]?.id);
                const num = list.length - idx;
                const isFirst = idx === 0;
                const st = STATUS_LABEL[r.status] || STATUS_LABEL.uploaded;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all text-xs flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-300 dark:border-purple-600 ring-2 ring-purple-400/80 shadow-xs'
                        : 'bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold">
                        {r.direction === 'CALL_IN' ? (
                          <PhoneIncoming size={14} className="text-green-600 shrink-0" />
                        ) : (
                          <PhoneOutgoing size={14} className="text-blue-600 shrink-0" />
                        )}
                        <span className={isSelected ? 'text-purple-950 dark:text-purple-200 font-extrabold' : 'text-gray-800 dark:text-gray-200'}>
                          {isFirst ? `${num}차 통화 (최신)` : `${num}차 통화`}
                        </span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${st.cls}`}>
                        {st.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[11px]">
                      <span>{fmtWhen(r.callStartedAt)}</span>
                      <span>·</span>
                      <span>{fmtDuration(r.durationSec)}</span>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      {r.appliedAt && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-medium">
                          반영완료
                        </span>
                      )}
                      {r.storageKind === 'gdrive' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          드라이브
                        </span>
                      )}
                    </div>

                    {(r.summary || r.extracted?.special_notes) && (
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed bg-gray-50 dark:bg-gray-900/40 p-1.5 rounded-lg border border-gray-100 dark:border-gray-800">
                        {r.summary || r.extracted?.special_notes}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 우측 / 메인 분석 대시보드 */}
          <div className="flex-1 w-full">
            <RecordingDetailDashboard
              c={c}
              rec={selectedRecording}
              onApply={onApply}
              showToast={showToast}
              onChanged={nr => setList(prev => prev.map(x => (x.id === nr.id ? nr : x)))}
              isLatest={isLatest}
              callNumber={callNumber}
            />
          </div>
        </div>
      ) : (
        !loading && list.length === 0 && (
          <div className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-8 text-center space-y-2 border border-gray-100 dark:border-gray-700">
            <Mic size={36} className="mx-auto text-gray-300 dark:text-gray-600" />
            <p className="font-bold text-gray-700 dark:text-gray-300 text-base">아직 등록된 통화 녹음이 없습니다.</p>
            <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
              스마트폰 전화 앱에서 통화 자동 녹음을 켜두시면, 리드마스터 앱이 이 고객과의 통화 녹음을 자동으로 올려 AI로 정리합니다.
            </p>
          </div>
        )
      )}
    </div>
  );
}
