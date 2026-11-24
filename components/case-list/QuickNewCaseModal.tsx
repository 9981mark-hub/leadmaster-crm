import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { PhoneCall, Plus, AlertTriangle, Loader2, X, ArrowRight } from 'lucide-react';
import { useCases, usePartners, useInboundPaths, QUERY_KEYS } from '../../services/queries';
import { createCase } from '../../services/api';
import { CASE_TYPES, formatPhone } from '../../constants';
import { checkIsDuplicate } from '../../utils';
import { useToast } from '../../contexts/ToastContext';
import { Case, MemoItem } from '../../types';

const LAST_KEY = 'lm_quicknew_last';

interface QuickNewCaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (created: Case) => void;
}

export const QuickNewCaseModal: React.FC<QuickNewCaseModalProps> = ({
    isOpen,
    onClose,
    onSuccess
}) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { data: cases = [] } = useCases();
    const { data: partners = [] } = usePartners();
    const { data: inboundPaths = [] } = useInboundPaths();

    const last = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem(LAST_KEY) || '{}');
        } catch {
            return {};
        }
    }, []);

    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [partnerId, setPartnerId] = useState<string>(last.partnerId || '');
    const [caseType, setCaseType] = useState<string>(last.caseType || '개인회생');
    const [inboundPath, setInboundPath] = useState<string>(last.inboundPath || '');
    const [preInfo, setPreInfo] = useState('');
    const [memo, setMemo] = useState('');
    const [allowDup, setAllowDup] = useState(false);
    const [saving, setSaving] = useState(false);
    const [tried, setTried] = useState(false);
    const phoneRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPhone('');
            setName('');
            setPreInfo('');
            setMemo('');
            setAllowDup(false);
            setTried(false);
            setTimeout(() => phoneRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!partnerId && partners.length > 0) {
            setPartnerId(partners[0].partnerId);
        }
    }, [partners, partnerId]);

    const digits = phone.replace(/[^0-9]/g, '');
    const phoneOk = /^0\d{8,10}$/.test(digits);
    const dup = useMemo(
        () => (digits.length >= 9 ? checkIsDuplicate(phone, cases as Case[]) : undefined),
        [digits, phone, cases]
    );
    const nameOk = name.trim().length > 0;
    const canSave = phoneOk && nameOk && (!dup || allowDup) && !saving;

    if (!isOpen) return null;

    const submit = async (next: 'open' | 'another') => {
        setTried(true);
        if (!canSave) return;
        setSaving(true);
        try {
            const memoItems: MemoItem[] = memo.trim()
                ? [{ id: Date.now().toString(), createdAt: new Date().toISOString(), content: memo.trim() }]
                : [];

            const created = await createCase({
                customerName: name.trim(),
                phone: formatPhone(digits),
                partnerId,
                caseType,
                inboundPath,
                preInfo: preInfo.trim(),
                specialMemo: memoItems,
                managerName: localStorage.getItem('managerName') || '',
                isNew: false,
                isViewed: true,
            } as Partial<Case>);

            localStorage.setItem(LAST_KEY, JSON.stringify({ partnerId, caseType, inboundPath }));
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cases });

            if (onSuccess) onSuccess(created as Case);

            if (next === 'open') {
                onClose();
                navigate(`/case/${created.caseId}`);
            } else {
                showToast(`${created.customerName}님을 등록했습니다. 다음 건을 입력하세요.`);
                setPhone('');
                setName('');
                setPreInfo('');
                setMemo('');
                setAllowDup(false);
                setTried(false);
                phoneRef.current?.focus();
            }
        } catch (e: any) {
            showToast(`등록 실패: ${e?.message || '알 수 없는 오류'}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit('open');
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const fieldClass = 'w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-gray-100 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15';
    const labelClass = 'block text-xs font-bold text-slate-700 dark:text-gray-200 mb-1';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
            onKeyDown={onKeyDown}
        >
            <div className="relative w-full max-w-lg max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
                {/* Modal Header */}
                <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-card shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold shrink-0">
                            <Plus size={18} strokeWidth={1.75} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-foreground">
                                신규 케이스 빠른 등록
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                번호와 이름만 입력하고 즉시 상담을 시작할 수 있습니다.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title="창 닫기"
                    >
                        <X size={18} strokeWidth={1.75} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar text-xs">
                    {/* Phone & Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass} htmlFor="modal-phone">
                                연락처 <span className="text-rose-500">*</span>
                            </label>
                            <input
                                id="modal-phone"
                                ref={phoneRef}
                                inputMode="tel"
                                autoComplete="off"
                                value={phone}
                                onChange={e => {
                                    setPhone(formatPhone(e.target.value));
                                    setAllowDup(false);
                                }}
                                placeholder="010-0000-0000"
                                className={`${fieldClass} text-base tabular-nums ${tried && !phoneOk ? 'border-rose-400' : ''}`}
                            />
                            {tried && !phoneOk && (
                                <p className="text-xs text-rose-500 mt-1">유효한 전화번호를 입력하세요.</p>
                            )}
                        </div>

                        <div>
                            <label className={labelClass} htmlFor="modal-name">
                                고객 이름 <span className="text-rose-500">*</span>
                            </label>
                            <input
                                id="modal-name"
                                autoComplete="off"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="모르면 '미상'"
                                className={`${fieldClass} text-base ${tried && !nameOk ? 'border-rose-400' : ''}`}
                            />
                            {tried && !nameOk && (
                                <p className="text-xs text-rose-500 mt-1">이름을 입력해주세요.</p>
                            )}
                        </div>
                    </div>

                    {/* Duplicate Warning */}
                    {dup && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 p-3 text-xs">
                            <div className="flex items-start gap-2 text-rose-800 dark:text-rose-200">
                                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                                <div className="flex-1">
                                    <b>이미 존재하는 고객 번호입니다:</b> {dup.customerName} ({dup.status})
                                    {dup.managerName ? ` · 담당 ${dup.managerName}` : ''}
                                    <div className="mt-2 flex items-center gap-3">
                                        <Link
                                            to={`/case/${dup.caseId}`}
                                            onClick={onClose}
                                            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold inline-flex items-center gap-1 text-xs"
                                        >
                                            해당 고객 열기 <ArrowRight size={12} />
                                        </Link>
                                        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                                            <input
                                                type="checkbox"
                                                checked={allowDup}
                                                onChange={e => setAllowDup(e.target.checked)}
                                            />
                                            그래도 새로 등록
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Partner & Inbound Path */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass} htmlFor="modal-partner">배정 거래처</label>
                            <select
                                id="modal-partner"
                                value={partnerId}
                                onChange={e => setPartnerId(e.target.value)}
                                className={fieldClass}
                            >
                                <option value="">미정 (사무실 선택)</option>
                                {partners.map(p => (
                                    <option key={p.partnerId} value={p.partnerId}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="modal-inbound">유입 경로</label>
                            <select
                                id="modal-inbound"
                                value={inboundPath}
                                onChange={e => setInboundPath(e.target.value)}
                                className={fieldClass}
                            >
                                <option value="">선택</option>
                                {inboundPaths.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Case Type */}
                    <div>
                        <span className={labelClass}>사건 유형</span>
                        <div className="grid grid-cols-4 gap-1.5">
                            {CASE_TYPES.map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setCaseType(t)}
                                    className={`h-9 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                                        caseType === t
                                            ? 'bg-primary text-primary-foreground border-primary shadow-2xs font-bold'
                                            : 'bg-secondary text-foreground border-border hover:bg-muted'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Additional Notes (Collapsible) */}
                    <details className="group pt-1">
                        <summary className="cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground select-none">
                            + 사전 정보 / 첫 통화 메모 (선택사항)
                        </summary>
                        <div className="mt-2.5 space-y-2">
                            <textarea
                                rows={2}
                                value={preInfo}
                                onChange={e => setPreInfo(e.target.value)}
                                placeholder="광고 신청서 내용 또는 인입 경로 특이사항"
                                className="w-full p-2.5 text-xs bg-background border border-input rounded-xl outline-none text-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-colors resize-none"
                            />
                            <textarea
                                rows={2}
                                value={memo}
                                onChange={e => setMemo(e.target.value)}
                                placeholder="첫 통화 메모"
                                className="w-full p-2.5 text-xs bg-background border border-input rounded-xl outline-none text-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-colors resize-none"
                            />
                        </div>
                    </details>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between p-4 bg-card border-t border-border shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-muted text-foreground font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                    >
                        닫기
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => submit('another')}
                            disabled={saving}
                            className="px-3.5 py-2.5 rounded-xl border border-border bg-secondary text-foreground font-bold text-xs hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                        >
                            + 등록 후 계속 입력
                        </button>
                        <button
                            type="button"
                            onClick={() => submit('open')}
                            disabled={saving}
                            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <PhoneCall size={14} strokeWidth={1.75} />}
                            등록하고 상담 시작
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
