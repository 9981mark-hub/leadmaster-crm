import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
    const popRef = useRef<HTMLDivElement>(null);
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
        // 버튼 줄과 팝업(body에 띄움) 밖을 누르면 닫는다
        const h = (e: MouseEvent) => {
            const t = e.target as Node;
            if (menuRef.current?.contains(t) || popRef.current?.contains(t)) return;
            setMenu(null);
        };
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

    const btnBase = 'h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors whitespace-nowrap shadow-2xs';
    const btn = `${btnBase} border-border bg-card text-foreground hover:bg-muted`;
    const sel = 'h-9 px-2.5 border border-border rounded-lg text-xs font-medium outline-none min-w-[120px] bg-card text-foreground shadow-2xs';

    return (
        <div className="sticky top-0 z-20 -mx-1 px-1 pt-1 bg-background/95 backdrop-blur-md">
            <div className="relative bg-card rounded-xl border border-border shadow-xs overflow-hidden">
                <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusBar(c.status)}`} aria-hidden />
                <div className="pl-4 pr-3 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
                    {/* 누구인지 */}
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                        {onBack && (
                            <button onClick={onBack} className="mt-0.5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="뒤로"><ArrowLeft size={16} strokeWidth={1.75} /></button>
                        )}
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <h1 className="text-xl font-bold tracking-tight text-foreground truncate">{c.customerName || '이름 없음'}</h1>
                                <button onClick={call} className="text-sm font-semibold tabular-nums text-primary hover:underline">{c.phone}</button>
                                {/* [2026-11-02] 모바일만: 문자 아이콘 → 폰 문자 앱의 이 고객 대화창 (앱은 sms: 주소를 문자 앱으로 넘김) */}
                                {phoneDigits && (
                                    <a href={`sms:${phoneDigits}`} onClick={() => onEngage?.()} aria-label="문자 보내기" title="문자 보내기"
                                        className="md:hidden h-8 w-8 -ml-0.5 rounded-full flex items-center justify-center text-primary bg-primary/10">
                                        <MessageSquare size={15} strokeWidth={1.75} />
                                    </a>
                                )}
                                {c.isNew && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-destructive text-destructive-foreground font-semibold">신규</span>}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="px-1.5 py-0.5 rounded-md bg-muted text-foreground font-medium border border-border text-[11px]">{c.caseType || '유형 미정'}</span>
                                <span className={`px-1.5 py-0.5 rounded-md font-medium text-[11px] border ${partner ? 'bg-muted text-foreground border-border' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>{partner?.name || '거래처 미정'}</span>
                                {c.inboundPath && <span className="text-muted-foreground text-[11px]">{c.inboundPath}</span>}
                                {progress && progress.total > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-md font-medium text-[11px] border ${progress.done === progress.total ? 'bg-primary/10 text-primary border-primary/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}
                                        title={progress.missing.length ? `확인 안 한 항목: ${progress.missing.join(', ')}` : '필수 확인 항목을 모두 입력했습니다'}>
                                        필수 확인 {progress.done}/{progress.total}
                                    </span>
                                )}
                                {warnings.map(w => (
                                    <span key={w} className="px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive font-medium border border-destructive/20 text-[11px] flex items-center gap-0.5"><AlertTriangle size={11} strokeWidth={1.75} /> {w}</span>
                                ))}
                                <SaveBadge s={saveState} />
                            </div>
                        </div>
                    </div>

                    {/* 할 일 */}
                    <div ref={menuRef} className="hidden md:flex flex-wrap items-center gap-1.5 relative">
                        <button onClick={call} className={`${btnBase} bg-primary text-primary-foreground border-primary hover:bg-primary/90 font-semibold`}><Phone size={14} strokeWidth={1.75} /> 전화</button>
                        {isMobileUA() ? (
                            <a href={`sms:${phoneDigits}`} onClick={() => onEngage?.()} className={btn}><MessageSquare size={14} strokeWidth={1.75} /> 문자</a>
                        ) : (
                            <button 
                                onClick={() => {
                                    setMenu(menu === 'sms' ? null : 'sms');
                                }} 
                                className={btn}>
                                <MessageSquare size={14} strokeWidth={1.75} /> 문자
                            </button>
                        )}
                        <button
                            onClick={() => isMissedStatus ? onMissedCallIncrement?.() : onStatusChangeStart(missedCallStatus as CaseStatus)}
                            className={`${btnBase} bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20`}
                            title={isMissedStatus ? `부재 1회 더 기록 (지금 ${c.missedCallCount || 0}회)` : `상태를 '${missedCallStatus}'(으)로`}
                        >
                            <PhoneMissed size={14} strokeWidth={1.75} /> 부재{isMissedStatus ? ` ${c.missedCallCount || 0}` : ''}{isMissedStatus && <Plus size={12} strokeWidth={1.75} />}
                        </button>
                        {onAddCallReminder && (
                            <button 
                                onClick={() => {
                                    setMenu(menu === 'reminder' ? null : 'reminder');
                                }} 
                                className={btn}>
                                <Clock size={14} strokeWidth={1.75} /> 다음 통화
                            </button>
                        )}
                        {onDeliverClick && (
                            <button onClick={onDeliverClick} className={`${btn} bg-card text-foreground hover:bg-muted border border-border`} title="회사 텔레그램 봇으로 변호사 사무실 방에 상담 내용을 보냅니다"><Send size={14} strokeWidth={1.75} /> 사무실 전달</button>
                        )}
                        {onOpenPalette && (
                            <button onClick={onOpenPalette} className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted hidden md:flex items-center justify-center border border-border transition-colors" title="빠른 이동 (Ctrl+K)"><Command size={15} strokeWidth={1.75} /></button>
                        )}

                        {/* 문자 전송 팝업 */}
                        {menu === 'sms' && createPortal(
                            <div ref={popRef}>
                                <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-xs" onClick={() => setMenu(null)} />
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setMenu(null)}>
                                    <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                                        <div className="p-4 space-y-3">
                                            <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                                                <span>{c.customerName}님께 문자 보내기</span>
                                                <button onClick={() => setMenu(null)} className="text-muted-foreground hover:text-foreground p-1" aria-label="닫기"><X size={16} strokeWidth={1.75} /></button>
                                            </div>
                                            {smsTemplates.length > 0 && (
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-muted-foreground">템플릿 선택</label>
                                                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                                        {smsTemplates.map(tmpl => (
                                                            <button
                                                                key={tmpl.id}
                                                                onClick={() => setSmsText(tmpl.content)}
                                                                className="text-left px-3 py-2 text-xs border border-border rounded-lg bg-card hover:bg-muted transition-colors shadow-2xs"
                                                                title={tmpl.content}
                                                            >
                                                                <div className="font-medium text-foreground truncate">{tmpl.title}</div>
                                                                <div className="text-muted-foreground truncate">{tmpl.content.slice(0, 20)}...</div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <textarea autoFocus value={smsText} onChange={e => setSmsText(e.target.value)} rows={6}
                                                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendSms(); }}
                                                className="w-full border border-border rounded-lg p-3 text-xs bg-card text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring placeholder:text-muted-foreground" 
                                                placeholder="내용을 쓰면 상담원 폰(리드마스터 앱)이 보냅니다" />
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground tabular-nums">{smsText.length}자 · Ctrl+Enter 보내기</span>
                                                <button disabled={!smsText.trim() || sms.isPending} onClick={sendSms} className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5 shadow-2xs">
                                                    {sms.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} strokeWidth={1.75} />} 보내기
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>,
                            document.body
                        )}
                        {menu === 'reminder' && onAddCallReminder && createPortal(
                            <div ref={popRef}>
                                <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-xs" onClick={() => setMenu(null)} />
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setMenu(null)}>
                                    <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl py-2 overflow-hidden" onClick={e => e.stopPropagation()}>
                                        <div className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border">다음 통화 예약</div>
                                        {quickSlots().map(s => (
                                            <button key={s.label} onClick={() => { onAddCallReminder(s.at, s.label); setMenu(null); }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-muted flex justify-between items-center group transition-colors">
                                                <span className="text-xs font-medium text-foreground group-hover:text-primary">{s.label}</span>
                                                <span className="text-xs text-muted-foreground tabular-nums">{s.at.slice(5)}</span>
                                            </button>
                                        ))}
                                        <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border bg-muted/40">다른 시각은 오른쪽 "상담 메모 · 일정" 탭에서 추가하세요</div>
                                    </div>
                                </div>
                            </div>,
                            document.body
                        )}
                    </div>

                    {/* 상태 */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <select
                            aria-label="1차 상태"
                            className={`${sel} border-border bg-card text-foreground`}
                            value={c.status}
                            onChange={(e) => onStatusChangeStart(e.target.value as CaseStatus)}
                        >
                            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {c.status === '사무장 접수' && (
                            <select aria-label="2차 상태" className={`${sel} border-primary/40 text-primary`} value={c.secondaryStatus || ''} onChange={(e) => onSecondaryStatusChangeStart(e.target.value || null)}>
                                <option value="">2차 상태</option>
                                {c.secondaryStatus && !secondaryStatuses.includes(c.secondaryStatus) && (
                                    <option value={c.secondaryStatus}>{c.secondaryStatus}</option>
                                )}
                                {secondaryStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        )}
                        {c.status === '사무장 접수' && c.secondaryStatus && availableTertiary.length > 0 && (
                            <select aria-label="3차 상태" className={`${sel} border-amber-500/40 text-amber-600 dark:text-amber-400`} value={c.tertiaryStatus || ''} onChange={(e) => onTertiaryStatusChangeStart(e.target.value || null)}>
                                <option value="">3차 상태</option>
                                {availableTertiary.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        )}
                        {/* 모바일만: 부재일 때 + */}
                        {isMissedStatus && onMissedCallIncrement && (
                            <button type="button" onClick={onMissedCallIncrement}
                                className="md:hidden h-9 px-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-1 tabular-nums"
                                aria-label={`부재 1회 더 기록 (지금 ${c.missedCallCount || 0}회)`}>
                                <Plus size={13} strokeWidth={1.75} /> {c.missedCallCount || 0}회
                            </button>
                        )}
                        {isMissedStatus && c.lastMissedCallAt && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 tabular-nums">마지막 부재 {(() => { const d = new Date(c.lastMissedCallAt!); return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; })()}</span>
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
