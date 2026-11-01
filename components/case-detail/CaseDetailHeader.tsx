import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Plus, Phone, MessageSquare, Send, ArrowLeft, Clock, Check, Loader2, CloudOff, PhoneMissed, Command, X } from 'lucide-react';
import { Case, CaseStatus, Partner } from '../../types';
import { getCaseWarnings } from '../../utils';
import { STATUS_COLOR_MAP } from '../../constants';
import CallConfirmPopup from '../CallConfirmPopup';
import { useEnqueueSmsMutation, useSmsTemplates } from '../../services/queries';
import { CheckProgress } from '../../utils/intake';

export type SaveState = { state: 'idle' | 'saving' | 'saved' | 'error'; at?: number };

interface CaseDetailHeaderProps {
    c: Case;
    partner: Partner | undefined;
    statuses: CaseStatus[];
    secondaryStatuses: string[];
    tertiaryStatuses: Record<string, string[]>;
    onStatusChangeStart: (status: CaseStatus) => void;
    onSecondaryStatusChangeStart: (status: string | null) => void;
    onTertiaryStatusChangeStart: (status: string | null) => void;
    onMissedCallIncrement?: () => void;
    onDeliverClick?: () => void;
    /** 다음 통화 예약 ("YYYY-MM-DD HH:mm") */
    onAddCallReminder?: (datetime: string, label: string) => void;
    /** 전화·문자를 시작할 때 (신규 리드면 상담 시작으로 처리) */
    onEngage?: () => void;
    onBack?: () => void;
    onOpenPalette?: () => void;
    saveState?: SaveState;
    progress?: CheckProgress;
}

const isMobileUA = () => {
    // PC 브라우저는 항상 false (문자 발송 메뉴를 보여주기 위해)
    const ua = navigator.userAgent;
    console.log('[isMobileUA] User-Agent:', ua);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) && !/Windows NT|Macintosh/i.test(ua);
    console.log('[isMobileUA] 판정:', isMobile);
    return isMobile;
};
const pad = (n: number) => String(n).padStart(2, '0');
const fmtLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** 다음 통화 예약 빠른 선택 */
const quickSlots = (): { label: string; at: string }[] => {
    const now = new Date();
    const inHour = new Date(now.getTime() + 60 * 60_000);
    inHour.setMinutes(Math.ceil(inHour.getMinutes() / 10) * 10, 0, 0);
    const today18 = new Date(now); today18.setHours(18, 0, 0, 0);
    const tomorrow10 = new Date(now); tomorrow10.setDate(now.getDate() + 1); tomorrow10.setHours(10, 0, 0, 0);
    const day2 = new Date(now); day2.setDate(now.getDate() + 2); day2.setHours(10, 0, 0, 0);
    const out = [{ label: '1시간 뒤', at: fmtLocal(inHour) }];
    if (today18.getTime() > now.getTime() + 30 * 60_000) out.push({ label: '오늘 저녁 6시', at: fmtLocal(today18) });
    out.push({ label: '내일 오전 10시', at: fmtLocal(tomorrow10) }, { label: '모레 오전 10시', at: fmtLocal(day2) });
    return out;
};

/** 상태 색 (목록·상세 공통 색에서 진한 색만 뽑아 왼쪽 띠로) */
const statusBar = (status: string) => {
    const cls = STATUS_COLOR_MAP[status] || 'bg-blue-100';
    const m = cls.match(/bg-([a-z]+)-\d+/);
    const color = m ? m[1] : 'blue';
    const MAP: Record<string, string> = { blue: 'bg-blue-500', orange: 'bg-orange-500', yellow: 'bg-yellow-500', gray: 'bg-gray-400', purple: 'bg-purple-500', indigo: 'bg-indigo-500', teal: 'bg-teal-500', green: 'bg-green-600' };
    return MAP[color] || 'bg-blue-500';
};

const SaveBadge: React.FC<{ s?: SaveState }> = ({ s }) => {
    if (!s || s.state === 'idle') return null;
    if (s.state === 'saving') return <span className="text-xs text-slate-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> 저장 중</span>;
    if (s.state === 'error') return <span className="text-xs text-red-600 font-semibold flex items-center gap-1"><CloudOff size={12} /> 저장 안 됨 — 다시 입력하세요</span>;
    const t = s.at ? new Date(s.at) : null;
    return <span className="text-xs text-emerald-700 flex items-center gap-1"><Check size={12} /> 저장됨{t ? ` ${pad(t.getHours())}:${pad(t.getMinutes())}` : ''}</span>;
};

/**
 * 리드 상세 맨 위 "통화 작업대" (스크롤해도 위에 붙어 있음)
 * 누구인지 · 전화 · 문자 · 부재 · 다음 통화 예약 · 텔레그램 전달 · 상태 · 저장 상태 · 필수 확인 진행률
 */
export const CaseDetailHeader: React.FC<CaseDetailHeaderProps> = ({
    c, partner, statuses, secondaryStatuses, tertiaryStatuses,
    onStatusChangeStart, onSecondaryStatusChangeStart, onTertiaryStatusChangeStart,
    onMissedCallIncrement, onDeliverClick, onAddCallReminder, onEngage, onBack, onOpenPalette, saveState, progress,
}) => {
    const warnings = getCaseWarnings(c, partner);
    const [showCallPopup, setShowCallPopup] = useState(false);
    const [menu, setMenu] = useState<'sms' | 'reminder' | null>(null);
    const [smsText, setSmsText] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const sms = useEnqueueSmsMutation();
    const { data: smsTemplates = [] } = useSmsTemplates();

    const missedCallStatus = localStorage.getItem('lm_missedStatus') || '부재';
    const isMissedStatus = c.status === missedCallStatus;
    const availableTertiary = c.secondaryStatus ? (tertiaryStatuses[c.secondaryStatus] || []) : [];
    const phoneDigits = (c.phone || '').replace(/[^0-9+]/g, '');

    console.log('[CaseDetailHeader] Props:', { 
        hasOnAddCallReminder: !!onAddCallReminder,
        hasOnEngage: !!onEngage,
        hasOnDeliverClick: !!onDeliverClick,
        isMobile: isMobileUA()
    });

    useEffect(() => {
        if (!menu) return;
        const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [menu]);

    const call = () => {
        onEngage?.();
        if (isMobileUA()) { window.location.href = `tel:${phoneDigits}`; return; }
        setShowCallPopup(true);
    };

    const sendSms = () => {
        const text = smsText.trim();
        if (!text) return;
        onEngage?.();
        console.log('[SMS] 발송 시작:', { phone: c.phone, contentLength: text.length, content: text.slice(0, 50) });
        sms.mutate({ phone: c.phone, content: text }, { 
            onSuccess: () => { 
                console.log('[SMS] mutate 성공 - pending_sms INSERT 완료');
                setSmsText(''); 
                setMenu(null); 
            },
            onError: (err) => {
                console.error('[SMS] mutate 실패:', err);
            }
        });
    };

    const btn = 'h-9 px-3 rounded-lg text-sm font-semibold flex items-center gap-1.5 border transition-colors whitespace-nowrap';
    const sel = 'h-9 px-2 border rounded-lg text-sm font-semibold outline-none min-w-[120px] bg-white dark:bg-gray-800 dark:text-gray-100';

    return (
        <div className="sticky top-0 z-20 -mx-1 px-1 pt-1 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur">
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusBar(c.status)}`} aria-hidden />
                <div className="pl-4 pr-3 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
                    {/* 누구인지 */}
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                        {onBack && (
                            <button onClick={onBack} className="mt-0.5 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700" aria-label="뒤로"><ArrowLeft size={18} /></button>
                        )}
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white truncate">{c.customerName || '이름 없음'}</h1>
                                <button onClick={call} className="text-base font-semibold tabular-nums text-blue-700 dark:text-blue-300 hover:underline">{c.phone}</button>
                                {c.isNew && <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-600 text-white font-bold">신규</span>}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-200 font-medium">{c.caseType || '유형 미정'}</span>
                                <span className={`px-1.5 py-0.5 rounded font-medium ${partner ? 'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-200' : 'bg-red-50 text-red-700'}`}>{partner?.name || '거래처 미정'}</span>
                                {c.inboundPath && <span className="text-slate-400">{c.inboundPath}</span>}
                                {progress && progress.total > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded font-medium ${progress.done === progress.total ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}
                                        title={progress.missing.length ? `확인 안 한 항목: ${progress.missing.join(', ')}` : '필수 확인 항목을 모두 입력했습니다'}>
                                        필수 확인 {progress.done}/{progress.total}
                                    </span>
                                )}
                                {warnings.map(w => (
                                    <span key={w} className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-medium flex items-center gap-0.5"><AlertTriangle size={11} /> {w}</span>
                                ))}
                                <SaveBadge s={saveState} />
                            </div>
                        </div>
                    </div>

                    {/* 할 일 */}
                    <div ref={menuRef} className="flex flex-wrap items-center gap-1.5 relative">
                        <button onClick={call} className={`${btn} bg-slate-900 text-white border-slate-900 hover:bg-slate-800`}><Phone size={15} /> 전화</button>
                        {isMobileUA() ? (
                            <a href={`sms:${phoneDigits}`} onClick={() => onEngage?.()} className={`${btn} border-slate-300 text-slate-700 dark:text-gray-200 hover:bg-slate-50`}><MessageSquare size={15} /> 문자</a>
                        ) : (
                            <button 
                                onClick={() => {
                                    console.log('[Button] 문자 클릭, 현재 menu:', menu);
                                    setMenu(menu === 'sms' ? null : 'sms');
                                }} 
                                className={`${btn} border-slate-300 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700`}>
                                <MessageSquare size={15} /> 문자
                            </button>
                        )}
                        <button
                            onClick={() => isMissedStatus ? onMissedCallIncrement?.() : onStatusChangeStart(missedCallStatus as CaseStatus)}
                            className={`${btn} border-orange-200 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20`}
                            title={isMissedStatus ? `부재 1회 더 기록 (지금 ${c.missedCallCount || 0}회)` : `상태를 '${missedCallStatus}'(으)로`}
                        >
                            <PhoneMissed size={15} /> 부재{isMissedStatus ? ` ${c.missedCallCount || 0}` : ''}{isMissedStatus && <Plus size={13} />}
                        </button>
                        {onAddCallReminder && (
                            <button 
                                onClick={() => {
                                    console.log('[Button] 다음 통화 클릭, 현재 menu:', menu);
                                    setMenu(menu === 'reminder' ? null : 'reminder');
                                }} 
                                className={`${btn} border-slate-300 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700`}>
                                <Clock size={15} /> 다음 통화
                            </button>
                        )}
                        {onDeliverClick && (
                            <button onClick={onDeliverClick} className={`${btn} border-sky-200 text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-900/20`} title="회사 텔레그램 봇으로 변호사 사무실 방에 상담 내용을 보냅니다"><Send size={15} /> 사무실 전달</button>
                        )}
                        {onOpenPalette && (
                            <button onClick={onOpenPalette} className="h-9 w-9 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 hidden md:flex items-center justify-center" title="빠른 이동 (Ctrl+K)"><Command size={16} /></button>
                        )}

                        {menu === 'sms' && (
                            <>
                                <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40" onClick={() => setMenu(null)} />
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setMenu(null)}>
                                    <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                                        <div className="p-4 space-y-3">
                                            <div className="flex items-center justify-between text-base font-semibold text-slate-800 dark:text-gray-100">
                                                <span>{c.customerName}님께 문자 보내기</span>
                                                <button onClick={() => setMenu(null)} className="text-slate-400 hover:text-slate-600 p-1" aria-label="닫기"><X size={18} /></button>
                                            </div>
                                            {smsTemplates.length > 0 && (
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600 dark:text-gray-400">템플릿 선택</label>
                                                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                                                        {smsTemplates.map(tmpl => (
                                                            <button
                                                                key={tmpl.id}
                                                                onClick={() => setSmsText(tmpl.content)}
                                                                className="text-left px-3 py-2 text-xs border border-slate-200 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 hover:border-blue-400 transition-colors"
                                                                title={tmpl.content}
                                                            >
                                                                <div className="font-medium text-slate-800 dark:text-gray-100 truncate">{tmpl.title}</div>
                                                                <div className="text-slate-400 truncate">{tmpl.content.slice(0, 20)}...</div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <textarea autoFocus value={smsText} onChange={e => setSmsText(e.target.value)} rows={6}
                                                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendSms(); }}
                                                className="w-full border border-slate-300 dark:border-gray-600 rounded-lg p-3 text-sm dark:bg-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" 
                                                placeholder="내용을 쓰면 상담원 폰(리드마스터 앱)이 보냅니다" />
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-400">{smsText.length}자 · Ctrl+Enter 보내기</span>
                                                <button disabled={!smsText.trim() || sms.isPending} onClick={sendSms} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-40 hover:bg-slate-800 flex items-center gap-1.5">
                                                    {sms.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} 보내기
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        {menu === 'reminder' && onAddCallReminder && (
                            <>
                                <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40" onClick={() => setMenu(null)} />
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setMenu(null)}>
                                    <div className="w-full max-w-sm bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-xl shadow-2xl py-2 overflow-hidden" onClick={e => e.stopPropagation()}>
                                        <div className="px-4 py-2 text-base font-semibold text-slate-800 dark:text-gray-100 border-b border-slate-100 dark:border-gray-700">다음 통화 예약</div>
                                        {quickSlots().map(s => (
                                            <button key={s.label} onClick={() => { onAddCallReminder(s.at, s.label); setMenu(null); }}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-gray-700 flex justify-between items-center group">
                                                <span className="text-sm font-medium text-slate-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">{s.label}</span>
                                                <span className="text-xs text-slate-400 tabular-nums">{s.at.slice(5)}</span>
                                            </button>
                                        ))}
                                        <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/50">다른 시각은 오른쪽 "상담 메모 · 일정" 탭에서 추가하세요</div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* 상태 */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <select
                            aria-label="1차 상태"
                            className={`${sel} border-slate-300 ${STATUS_COLOR_MAP[c.status] || ''}`}
                            value={c.status}
                            onChange={(e) => onStatusChangeStart(e.target.value as CaseStatus)}
                        >
                            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {c.status === '사무장 접수' && (
                            <select aria-label="2차 상태" className={`${sel} border-purple-300 text-purple-800`} value={c.secondaryStatus || ''} onChange={(e) => onSecondaryStatusChangeStart(e.target.value || null)}>
                                <option value="">2차 상태</option>
                                {secondaryStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        )}
                        {c.status === '사무장 접수' && c.secondaryStatus && availableTertiary.length > 0 && (
                            <select aria-label="3차 상태" className={`${sel} border-amber-300 text-amber-800`} value={c.tertiaryStatus || ''} onChange={(e) => onTertiaryStatusChangeStart(e.target.value || null)}>
                                <option value="">3차 상태</option>
                                {availableTertiary.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        )}
                        {isMissedStatus && c.lastMissedCallAt && (
                            <span className="text-[11px] text-orange-600 tabular-nums">마지막 부재 {(() => { const d = new Date(c.lastMissedCallAt!); return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; })()}</span>
                        )}
                    </div>
                </div>
            </div>

            <CallConfirmPopup
                isOpen={showCallPopup}
                customerName={c.customerName}
                phoneNumber={c.phone}
                caseId={c.caseId}
                onConfirm={() => setShowCallPopup(false)}
                onCancel={() => setShowCallPopup(false)}
            />
        </div>
    );
};
