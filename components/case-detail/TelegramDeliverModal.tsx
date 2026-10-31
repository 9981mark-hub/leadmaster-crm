import React, { useEffect, useMemo, useState } from 'react';
import { Send, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Case, CaseStatus, Partner } from '../../types';
import { generateSummary, parseAiTranscript } from '../../utils';
import { CaseDelivery, DeliveryError, deliverCaseToTelegram, fetchCaseDeliveries } from '../../services/telegramDelivery';
import { fetchLatestAnalyzedRecording } from '../../services/recordings';
import { getCheckProgress } from '../../utils/intake';

const RECEIVED_STATUS = '사무장 접수';

interface Props {
    c: Case;
    partner: Partner | undefined;
    statuses: CaseStatus[];
    onClose: () => void;
    /** 전송 성공 후. changeStatus=true면 상태를 '사무장 접수'로 바꿔 달라는 뜻 */
    onDelivered: (info: { changeStatus: boolean; chatTitle?: string }) => void;
    showToast: (msg: string, type?: 'success' | 'error') => void;
}

const fmt = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const TelegramDeliverModal: React.FC<Props> = ({ c, partner, statuses, onClose, onDelivered, showToast }) => {
    const templateText = useMemo(() => generateSummary(c, partner?.summaryTemplate), [c, partner]);
    const aiText = useMemo(() => {
        if (!c.aiSummary) return '';
        try { return (parseAiTranscript(c.aiSummary).summaryText || '').trim(); } catch { return ''; }
    }, [c.aiSummary]);
    const [source, setSource] = useState<'template' | 'ai' | 'call'>('template');
    // 통화 녹음 AI 정리의 사무실 보고서 (거래처 요약문 양식으로 작성됨)
    const [callText, setCallText] = useState('');
    useEffect(() => {
        let alive = true;
        fetchLatestAnalyzedRecording(c.caseId).then(r => { if (alive && r?.extracted?.office_summary) setCallText(r.extracted.office_summary); }).catch(() => {});
        return () => { alive = false; };
    }, [c.caseId]);
    const progress = useMemo(() => getCheckProgress(c, partner), [c, partner]);
    const initialText = source === 'ai' && aiText ? aiText : source === 'call' && callText ? callText : templateText;
    const [text, setText] = useState(templateText);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [needForce, setNeedForce] = useState(false);
    const [history, setHistory] = useState<CaseDelivery[]>([]);
    const canChangeStatus = c.status !== RECEIVED_STATUS && statuses.includes(RECEIVED_STATUS as CaseStatus);
    const [changeStatus, setChangeStatus] = useState(canChangeStatus);

    const chatId = (partner?.telegramChatId || '').trim();
    const blocker = !partner
        ? '이 리드에 거래처(변호사 사무실)가 지정되지 않았습니다. 정보 탭에서 거래처를 먼저 고르세요.'
        : !chatId
            ? `'${partner.name}' 거래처에 텔레그램 방이 설정되지 않았습니다. 관리자가 설정 → 거래처에서 방을 선택해야 합니다.`
            : null;

    useEffect(() => {
        let alive = true;
        fetchCaseDeliveries(c.caseId).then(rows => { if (alive) setHistory(rows); });
        return () => { alive = false; };
    }, [c.caseId]);

    // 기록은 조각별로 저장되므로 1번째 조각만 보여 준다
    const sends = history.filter(h => h.partNo === 1);

    const handleSend = async () => {
        if (sending || blocker) return;
        if (text.trim().length < 5) { setError('보낼 내용이 비어 있습니다'); return; }
        setSending(true);
        setError(null);
        try {
            const r = await deliverCaseToTelegram(c.caseId, text, needForce);
            showToast(`${r.chatTitle || partner?.name || '변호사 사무실'} 방으로 전달했습니다${r.parts > 1 ? ` (${r.parts}개로 나눠 보냄)` : ''}.`);
            onDelivered({ changeStatus: canChangeStatus && changeStatus, chatTitle: r.chatTitle });
            onClose();
        } catch (e) {
            const err = e as DeliveryError;
            if (err.code === 'RECENT') setNeedForce(true);
            setError(err.message || '전송에 실패했습니다');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Send size={18} className="text-sky-500" /> 텔레그램으로 전달
                    </h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="닫기"><X size={18} /></button>
                </div>

                <div className="px-5 py-3 space-y-3 overflow-y-auto">
                    <div className="text-sm text-gray-600">
                        받는 곳: <span className="font-bold text-gray-900">{partner?.name || '거래처 미정'}</span>
                        {chatId && <span className="text-xs text-gray-400 ml-2">방 ID {chatId}</span>}
                        <p className="text-xs text-gray-400 mt-1">회사 봇이 이 내용을 그 방에 올립니다. 사무실에서 이 메시지에 <b>답장</b>하면 피드백이 이 리드에 자동으로 연결됩니다.</p>
                    </div>

                    {blocker && (
                        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {blocker}
                        </div>
                    )}

                    <div>
                        <div className="flex justify-between items-end mb-1">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-gray-500">보낼 내용 (수정 가능)</label>
                                {(aiText || callText) && (
                                    <div className="flex text-xs border rounded overflow-hidden">
                                        {(['template', 'call', 'ai'] as const).filter(s => s === 'template' || (s === 'ai' ? !!aiText : !!callText)).map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => { setSource(s); setText(s === 'ai' ? aiText : s === 'call' ? callText : templateText); setNeedForce(false); }}
                                                className={`px-2 py-0.5 ${source === s ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                            >
                                                {s === 'template' ? '입력한 정보로' : s === 'call' ? '통화 녹음 AI 정리' : '예전 AI 요약'}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {text !== initialText && (
                                    <button type="button" className="text-xs text-gray-500 underline" onClick={() => setText(initialText)}>처음 요약문으로</button>
                                )}
                                <span className="text-xs text-gray-400">{text.length.toLocaleString()}자</span>
                            </div>
                        </div>
                        <textarea
                            className="w-full h-72 p-3 border border-gray-300 rounded-lg text-sm leading-relaxed outline-none focus:ring-2 focus:ring-sky-200 resize-y"
                            value={text}
                            onChange={e => { setText(e.target.value); setNeedForce(false); }}
                        />
                    </div>

                    {/* 거래처 필수 확인 항목 중 입력 안 된 것 (보내는 것은 막지 않음) */}
                    {progress.missing.length > 0 && (
                        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2.5">
                            <span className="font-semibold">{partner?.name || '사무실'} 필수 확인 항목 중 입력 안 된 것 ({progress.missing.length}/{progress.total}):</span>{' '}
                            {progress.missing.join(', ')}
                        </div>
                    )}

                    {canChangeStatus && (
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" checked={changeStatus} onChange={e => setChangeStatus(e.target.checked)} />
                            보낸 뒤 상태를 <b>{RECEIVED_STATUS}</b>(으)로 바꾸기 <span className="text-xs text-gray-400">(지금: {c.status})</span>
                        </label>
                    )}

                    {error && (
                        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
                        </div>
                    )}

                    {sends.length > 0 && (
                        <div className="text-xs text-gray-500 border-t pt-2">
                            <div className="font-medium text-gray-600 mb-1 flex items-center gap-1"><CheckCircle2 size={13} className="text-green-500" /> 이전 전달 {sends.length}회</div>
                            <ul className="space-y-0.5">
                                {sends.slice(0, 5).map(h => (
                                    <li key={h.id}>{fmt(h.sentAt)} · {h.chatTitle || h.chatId}{h.sentByEmail ? ` · ${h.sentByEmail}` : ''}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm">취소</button>
                    <button
                        onClick={handleSend}
                        disabled={sending || !!blocker}
                        className="px-4 py-2 rounded bg-sky-600 text-white font-bold text-sm hover:bg-sky-700 disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                        {needForce ? '그래도 다시 보내기' : '보내기'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TelegramDeliverModal;
