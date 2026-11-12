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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
            onKeyDown={onKeyDown}
        >
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700/80 bg-gray-50/50 dark:bg-gray-750/50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center font-bold">
                            <Plus size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                신규 케이스 빠른 등록
                            </h3>
                            <p className="text-[11px] text-gray-400">
                                번호와 이름만 입력하고 즉시 상담을 시작할 수 있습니다.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-4 text-xs">
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
                                <p className="text-[11px] text-rose-500 mt-1">유효한 전화번호를 입력하세요.</p>
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
                                <p className="text-[11px] text-rose-500 mt-1">이름을 입력해주세요.</p>
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
                                            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold inline-flex items-center gap-1 text-[11px]"
                                        >
                                            해당 고객 열기 <ArrowRight size={12} />
                                        </Link>
                                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
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
                                    className={`h-9 rounded-xl text-xs font-semibold border transition-colors ${
                                        caseType === t
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Additional Notes (Collapsible) */}
                    <details className="group pt-1">
                        <summary className="cursor-pointer text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 select-none">
                            + 사전 정보 / 첫 통화 메모 (선택사항)
                        </summary>
                        <div className="mt-2.5 space-y-2">
                            <textarea
                                rows={2}
                                value={preInfo}
                                onChange={e => setPreInfo(e.target.value)}
                                placeholder="광고 신청서 내용 또는 인입 경로 특이사항"
                                className="w-full p-2.5 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none"
                            />
                            <textarea
                                rows={2}
                                value={memo}
                                onChange={e => setMemo(e.target.value)}
                                placeholder="첫 통화 메모"
                                className="w-full p-2.5 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none"
                            />
                        </div>
                    </details>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-750/70 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-[11px] text-gray-400 hidden sm:inline">
                        단축키: Ctrl + Enter = 등록 후 즉시 열기
                    </span>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={() => submit('another')}
                            disabled={saving}
                            className="px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                            + 등록 후 계속 입력
                        </button>
                        <button
                            type="button"
                            onClick={() => submit('open')}
                            disabled={saving}
                            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <PhoneCall size={14} />}
                            등록하고 상담 시작
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
