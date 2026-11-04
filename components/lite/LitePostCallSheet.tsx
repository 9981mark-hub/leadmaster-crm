import React, { useState, useEffect, useMemo } from 'react';
import { Send, CheckCircle2, Phone, X, Sparkles, Building2, AlertTriangle, ArrowRight, Loader2, RotateCcw, Calendar, MessageSquare, Smartphone } from 'lucide-react';
import { LiteQuickSmsModal } from './LiteQuickSmsModal';
import { Case, CaseStatus, Partner, ReminderItem } from '../../types';
import { generateSummary, parseAiTranscript } from '../../utils';
import { deliverCaseToTelegram, fetchKnownTelegramChats, KnownTelegramChat, DeliveryError } from '../../services/telegramDelivery';
import { fetchLatestAnalyzedRecording } from '../../services/recordings';

interface Props {
  c: Case;
  partners: Partner[];
  onSaveCase: (updates: Partial<Case>, successMessage?: string) => Promise<void>;
  onNext: () => void;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const COMMON_STATUS_OPTIONS: { label: string; value: string; color: string; desc: string }[] = [
  { label: '사무장 접수', value: '사무장 접수', color: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200', desc: '유효 상담 완료 · 변호사 방 전달' },
  { label: '재통화 예정', value: '재통화 예정', color: 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200', desc: '추후 재연락 필요' },
  { label: '타사 진행중', value: '타사 진행중', color: 'border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200', desc: '타 법무법인 진행' },
  { label: '진행불가', value: '진행불가', color: 'border-gray-400 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300', desc: '자격 미달 (소득/채무)' },
  { label: '블랙 고객', value: '고객취소', color: 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200', desc: '악성 민원 / 장난 접수' },
];

export const LitePostCallSheet: React.FC<Props> = ({
  c,
  partners,
  onSaveCase,
  onNext,
  onClose,
  showToast,
}) => {
  // 선택된 상태
  // 스마트 일정 감지 헬퍼
  const detectScheduleFromText = (text: string): { datetime: string; note: string } | null => {
    if (!text) return null;
    const hasKeyword = /재통화|다시 연락|내일|모레|오후|오전|통화 가능|상담 예약/.test(text);
    if (!hasKeyword) return null;

    const now = new Date();
    const targetDate = new Date(now);

    if (text.includes('내일')) {
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (text.includes('모레')) {
      targetDate.setDate(targetDate.getDate() + 2);
    }

    let hour = 14;
    let minute = 0;
    const timeMatch = text.match(/(오전|오후)?\s*(\d{1,2})시\s*(\d{1,2})?분?/);
    if (timeMatch) {
      let h = parseInt(timeMatch[2], 10);
      const isPm = timeMatch[1] === '오후' || (h < 9 && !timeMatch[1]);
      if (isPm && h < 12) h += 12;
      if (timeMatch[1] === '오전' && h === 12) h = 0;
      hour = h;
      if (timeMatch[3]) minute = parseInt(timeMatch[3], 10);
    }

    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const hh = String(hour).padStart(2, '0');
    const minStr = String(minute).padStart(2, '0');

    return {
      datetime: `${yyyy}-${mm}-${dd} ${hh}:${minStr}`,
      note: 'AI 감지: 재통화 상담 예약',
    };
  };

  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [addedSchedule, setAddedSchedule] = useState(false);
  const detectedSchedule = useMemo(() => detectScheduleFromText(summaryText), [summaryText]);

  const handleAddDetectedSchedule = async () => {
    if (!detectedSchedule) return;
    const newReminder: ReminderItem = {
      id: `rem_${Date.now()}`,
      datetime: detectedSchedule.datetime,
      type: '통화',
      content: detectedSchedule.note,
      isCompleted: false,
    };
    const updated = [...(c.reminders || []), newReminder];
    await onSaveCase({ reminders: updated }, `📅 ${detectedSchedule.datetime} 캘린더 일정이 등록되었습니다.`);
    setAddedSchedule(true);
    showToast(`${detectedSchedule.datetime} 재통화 일정이 캘린더에 등록되었습니다!`, 'success');
  };

  const [selectedStatus, setSelectedStatus] = useState<string>(c.status === '신규접수' || c.status === '부재' ? '사무장 접수' : c.status);
  
  // 파트너(변호사 사무실) 선택
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(c.partnerId || (partners[0]?.partnerId || ''));
  const currentPartner = useMemo(() => partners.find(p => p.partnerId === selectedPartnerId), [partners, selectedPartnerId]);

  // 텔레그램 채팅방 목록
  const [knownChats, setKnownChats] = useState<KnownTelegramChat[]>([]);
  useEffect(() => {
    fetchKnownTelegramChats().then(setKnownChats).catch(() => {});
  }, []);

  // AI 요약문 상태
  const [summaryText, setSummaryText] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);

  // 초기 요약문 빌드 (최근 분석 녹음 or 템플릿)
  useEffect(() => {
    let alive = true;
    setLoadingAi(true);

    // 1순위: 최근 녹음 AI 정리의 office_summary 또는 summary
    fetchLatestAnalyzedRecording(c.caseId).then(rec => {
      if (!alive) return;
      if (rec?.extracted?.office_summary) {
        setSummaryText(rec.extracted.office_summary);
      } else if (rec?.summary) {
        setSummaryText(rec.summary);
      } else if (c.aiSummary) {
        try {
          const parsed = parseAiTranscript(c.aiSummary);
          if (parsed.summaryText) setSummaryText(parsed.summaryText);
          else setSummaryText(generateSummary(c, currentPartner?.summaryTemplate));
        } catch {
          setSummaryText(generateSummary(c, currentPartner?.summaryTemplate));
        }
      } else {
        setSummaryText(generateSummary(c, currentPartner?.summaryTemplate));
      }
    }).catch(() => {
      if (alive) {
        setSummaryText(generateSummary(c, currentPartner?.summaryTemplate));
      }
    }).finally(() => {
      if (alive) setLoadingAi(false);
    });

    return () => { alive = false; };
  }, [c.caseId, currentPartner]);

  // 전송 상태
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [needForce, setNeedForce] = useState(false);

  // 텔레그램 전달 핸들러
  const handleDeliverTelegram = async () => {
    if (!summaryText.trim()) {
      showToast('전달할 요약문 내용이 없습니다.', 'error');
      return;
    }

    if (!currentPartner?.telegramChatId) {
      showToast(`'${currentPartner?.name || '선택한 사무실'}'에 연동된 텔레그램 방이 없습니다. 관리자에게 문의하세요.`, 'error');
      return;
    }

    setSendingTelegram(true);
    try {
      // 1. 파트너나 상태 변경이 있으면 먼저 케이스 업데이트
      const updates: Partial<Case> = {
        partnerId: selectedPartnerId,
        status: '사무장 접수',
        statusUpdatedAt: new Date().toISOString(),
      };
      await onSaveCase(updates);

      // 2. 텔레그램 메시지 발송
      const res = await deliverCaseToTelegram(c.caseId, summaryText, needForce);
      showToast(`[${res.chatTitle || currentPartner.name}] 텔레그램 방으로 전달 완료!`);
      window.dispatchEvent(new Event('lm_lite_activity_updated'));

      // 3. 자동으로 다음 고객으로 넘어가기
      onNext();
    } catch (err: any) {
      const e = err as DeliveryError;
      if (e.code === 'RECENT') {
        setNeedForce(true);
        showToast('방금 전달된 건입니다. 다시 누르면 강제 전송됩니다.', 'error');
      } else {
        showToast(e.message || '텔레그램 전달 실패', 'error');
      }
    } finally {
      setSendingTelegram(false);
    }
  };

  // 일반 상태 저장 핸들러
  const handleSaveOnly = async () => {
    setSavingStatus(true);
    try {
      const now = new Date().toISOString();
      const who = localStorage.getItem('managerName') || '상담원';

      const updates: Partial<Case> = {
        status: selectedStatus,
        statusUpdatedAt: now,
        partnerId: selectedPartnerId,
        statusLogs: [
          {
            logId: `${Date.now()}_${c.caseId}`,
            caseId: c.caseId,
            fromStatus: c.status,
            toStatus: selectedStatus,
            changedAt: now,
            changedBy: who,
            memo: '간편 모드 상태 변경',
          },
          ...(c.statusLogs || []),
        ],
      };

      await onSaveCase(updates, `고객 상태를 "${selectedStatus}"(으)로 저장했습니다.`);
      window.dispatchEvent(new Event('lm_lite_activity_updated'));
      onNext();
    } catch (e: any) {
      showToast(e.message || '저장 실패', 'error');
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 w-full md:max-w-xl max-h-[94vh] rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 dark:border-gray-800">
        
        {/* 헤더 */}
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/60 shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
              <span>{c.customerName} 고객</span>
              <span className="text-xs font-normal text-gray-500">통화 후 결과 처리</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">{c.phone}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 바디 (스크롤) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

          {/* [NEW] AI 감지 재통화 일정 원클릭 캘린더 등록 */}
          {detectedSchedule && !addedSchedule && (
            <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-300 dark:border-amber-800 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Calendar size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-extrabold px-1.5 py-0.5 rounded">
                      AI 일정 감지
                    </span>
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                      {detectedSchedule.datetime}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                    {detectedSchedule.note}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddDetectedSchedule}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shrink-0 shadow-xs active:scale-95 transition-all"
              >
                캘린더 등록
              </button>
            </div>
          )}

          {/* [NEW] 1-Click 안내 문자 / 알림톡 발송 바 */}
          <div className="flex items-center justify-between bg-indigo-50/70 dark:bg-indigo-950/40 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <MessageSquare size={14} />
              </div>
              <div>
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">
                  1-Click 안내 문자 발송
                </span>
                <span className="text-[10px] text-gray-500">
                  부재중 1/2차 콜백 요청 · 사무장 배정 안내
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSmsModalOpen(true)}
              className="flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-xl shadow-xs active:scale-95 transition-all"
            >
              <Smartphone size={13} />
              <span>문자 발송</span>
            </button>
          </div>

          {/* 1. 상태 원터치 선택 그리드 */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
              ① 상담 결과 상태 선택 (1-Tap)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {COMMON_STATUS_OPTIONS.map(opt => {
                const isSelected = selectedStatus === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedStatus(opt.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? `${opt.color} ring-2 ring-blue-500/50 shadow-sm font-bold`
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{opt.label}</span>
                      {isSelected && <CheckCircle2 size={15} className="text-blue-600 dark:text-blue-400" />}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 변호사 사무실(텔레그램 방) 선택 */}
          <div className="bg-slate-50 dark:bg-gray-800/50 p-3.5 rounded-xl border border-slate-200/70 dark:border-gray-700">
            <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 size={14} className="text-indigo-600 dark:text-indigo-400" />
                ② 전달할 변호사 사무실 (텔레그램 방)
              </span>
              {currentPartner?.telegramChatId ? (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  ● 텔레그램 연동됨
                </span>
              ) : (
                <span className="text-[10px] text-rose-500 font-bold">
                  ⚠️ 방 미설정
                </span>
              )}
            </label>

            <select
              value={selectedPartnerId}
              onChange={e => setSelectedPartnerId(e.target.value)}
              className="w-full text-xs font-medium p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {partners.map(p => (
                <option key={p.partnerId} value={p.partnerId}>
                  {p.name} {p.telegramChatId ? `(텔레그램: ${p.telegramChatId})` : '(텔레그램 미연동)'}
                </option>
              ))}
            </select>
          </div>

          {/* 3. AI 상담 요약문 확인 및 편집 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                ③ 상담 요약문 (자동 생성 · 편집 가능)
              </label>
              {loadingAi && (
                <span className="text-[11px] text-blue-600 flex items-center gap-1 animate-pulse">
                  <Loader2 size={12} className="animate-spin" /> 녹음 AI 분석 불러오는 중...
                </span>
              )}
            </div>

            <textarea
              rows={6}
              value={summaryText}
              onChange={e => setSummaryText(e.target.value)}
              placeholder="상담 요약 내용이 여기에 표시됩니다..."
              className="w-full p-3 text-xs leading-relaxed border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-500 font-sans"
            />
          </div>

        </div>

        {/* 하단 고정 전송 액션 바 */}
        <div className="p-3.5 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shrink-0 space-y-2">
          
          {selectedStatus === '사무장 접수' ? (
            <button
              onClick={handleDeliverTelegram}
              disabled={sendingTelegram}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {sendingTelegram ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>텔레그램 전송 중...</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>🚀 [{currentPartner?.name || '변호사 사무실'}] 방으로 즉시 전달</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleSaveOnly}
              disabled={savingStatus}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              {savingStatus ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>상태 저장 중...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>상태 저장하고 다음 고객으로 ({selectedStatus})</span>
                </>
              )}
            </button>
          )}

          {/* 다음 리드로 건너뛰기 보조 버튼 */}
          <div className="flex items-center justify-between text-xs px-1 text-gray-500">
            <button
              type="button"
              onClick={onClose}
              className="hover:underline text-gray-400"
            >
              취소하고 목록으로
            </button>
            <button
              type="button"
              onClick={onNext}
              className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>이 고객 넘어가기</span>
              <ArrowRight size={13} />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
