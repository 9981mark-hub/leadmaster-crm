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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto" onClick={onClose}>
            <div className="relative w-full max-w-2xl max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground" onClick={e => e.stopPropagation()}>
                {/* 헤더 */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-card shrink-0">
                    <h3 className="font-bold text-foreground flex items-center gap-2 text-base">
                        <Send size={18} className="text-primary" strokeWidth={2} />
                        <span>텔레그램으로 전달</span>
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        aria-label="닫기"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar text-xs">
                    {/* 수신처 정보 */}
                    <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-1">
                        <div className="text-xs text-muted-foreground">
                            받는 곳: <span className="font-bold text-foreground text-sm">{partner?.name || '거래처 미정'}</span>
                            {chatId && <span className="text-2xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 ml-2">방 ID {chatId}</span>}
                        </div>
                        <p className="text-2xs text-muted-foreground leading-relaxed">
                            회사 봇이 이 내용을 지정된 텔레그램 방에 올립니다. 사무실에서 이 메시지에 <strong>답장</strong>하면 피드백이 이 리드에 자동으로 연결됩니다.
                        </p>
                    </div>

                    {blocker && (
                        <div className="flex items-start gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 leading-relaxed">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                            <span>{blocker}</span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-semibold text-foreground">보낼 내용 (수정 가능)</label>
                                {(aiText || callText) && (
                                    <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/60 text-xs">
                                        {(['template', 'call', 'ai'] as const).filter(s => s === 'template' || (s === 'ai' ? !!aiText : !!callText)).map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => { setSource(s); setText(s === 'ai' ? aiText : s === 'call' ? callText : templateText); setNeedForce(false); }}
                                                className={`px-2.5 py-1 text-2xs font-medium rounded-md transition-colors cursor-pointer ${
                                                    source === s 
                                                        ? 'bg-primary text-primary-foreground shadow-2xs' 
                                                        : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                            >
                                                {s === 'template' ? '입력한 정보로' : s === 'call' ? '통화 녹음 AI 정리' : '예전 AI 요약'}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {text !== initialText && (
                                    <button
                                        type="button"
                                        className="text-2xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                                        onClick={() => setText(initialText)}
                                    >
                                        처음 요약문으로
                                    </button>
                                )}
                                <span className="text-2xs font-mono text-muted-foreground tabular-nums">{text.length.toLocaleString()}자</span>
                            </div>
                        </div>
                        <textarea
                            className="w-full h-72 p-3.5 border border-input rounded-xl text-xs font-mono leading-relaxed bg-background text-foreground outline-none focus:ring-1 focus:ring-primary resize-y shadow-2xs"
                            value={text}
                            onChange={e => { setText(e.target.value); setNeedForce(false); }}
                        />
                    </div>

                    {/* 거래처 필수 확인 항목 중 입력 안 된 것 */}
                    {progress.missing.length > 0 && (
                        <div className="text-2xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 leading-relaxed">
                            <span className="font-bold">{partner?.name || '사무실'} 필수 확인 항목 중 입력 안 된 것 ({progress.missing.length}/{progress.total}):</span>{' '}
                            {progress.missing.join(', ')}
                        </div>
                    )}

                    {canChangeStatus && (
                        <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer pt-1">
                            <input
                                type="checkbox"
                                checked={changeStatus}
                                onChange={e => setChangeStatus(e.target.checked)}
                                className="accent-primary rounded"
                            />
                            <span>보낸 뒤 상태를 <strong className="text-primary">{RECEIVED_STATUS}</strong>(으)로 바꾸기</span>
                            <span className="text-2xs text-muted-foreground font-mono">(현재: {c.status})</span>
                        </label>
                    )}

                    {error && (
                        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3.5">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-destructive" />
                            <span>{error}</span>
                        </div>
                    )}

                    {sends.length > 0 && (
                        <div className="text-2xs text-muted-foreground border-t border-border pt-3 space-y-1.5">
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                                <CheckCircle2 size={13} className="text-primary" />
                                <span>이전 전달 이력 ({sends.length}회)</span>
                            </div>
                            <ul className="space-y-1 font-mono">
                                {sends.slice(0, 5).map(h => (
                                    <li key={h.id} className="flex items-center gap-2 text-muted-foreground">
                                        <span>• {fmt(h.sentAt)}</span>
                                        <span>{h.chatTitle || h.chatId}</span>
                                        {h.sentByEmail && <span className="text-primary/70">({h.sentByEmail})</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                <div className="flex justify-end gap-2 p-4 border-t border-border bg-card shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-border bg-secondary text-foreground hover:bg-muted text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={sending || !!blocker}
                        className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 disabled:opacity-40 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    >
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        <span>{needForce ? '그래도 다시 보내기' : '보내기'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TelegramDeliverModal;
