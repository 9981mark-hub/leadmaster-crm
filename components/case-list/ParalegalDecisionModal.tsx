import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Scale, CheckCircle2, RotateCcw, XCircle, X, DollarSign, 
    Calendar, AlertTriangle, ShieldCheck, User, Phone, 
    Briefcase, FileText, ArrowRight, Check, AlertCircle 
} from 'lucide-react';
import { Case } from '../../types';

interface ParalegalDecisionModalProps {
    c: Case;
    isOpen: boolean;
    onClose: () => void;
    onDecision: (updates: Partial<Case>, successMessage: string) => Promise<void>;
}

export const ParalegalDecisionModal: React.FC<ParalegalDecisionModalProps> = ({
    c,
    isOpen,
    onClose,
    onDecision
}) => {
    const [activeTab, setActiveTab] = useState<'contract' | 'rework' | 'reject'>('contract');
    const [submitting, setSubmitting] = useState(false);

    // 1. 수임 완료 필드
    const [contractFee, setContractFee] = useState<number>(c.contractFee || 200); // 만원
    const [contractType, setContractType] = useState<string>(c.caseType || '개인회생');
    const [contractAt, setContractAt] = useState<string>(() => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    });
    const [contractMemo, setContractMemo] = useState<string>('서류 완비 및 사무장 심층 상담 완료, 사건 수임 체결');

    // 2. 보완 요청 필드
    const REWORK_PRESETS = [
        '소득 증빙 서류(급여명세서/원천징수) 추가 확인 필요',
        '부양가족 주민등록등본 및 가족관계증명서 발급 요청',
        '최근 1년 대출금 사용처(계좌거래내역) 소명 필요',
        '임대차계약서 확정일자 및 보증금 잔액 확인 필요',
        '차량 또는 부동산 시세/담보대출 잔액 재확인',
    ];
    const [selectedReworkReason, setSelectedReworkReason] = useState<string>(REWORK_PRESETS[0]);
    const [customReworkNote, setCustomReworkNote] = useState<string>('');

    // 3. 진행 불가/기각 필드
    const REJECT_PRESETS = [
        '총 채무 1,000만원 미만 (개인회생 신청 자격 미달)',
        '재산(청산가치)이 총 채무보다 많아 회생 불가',
        '최근 대출 90% 이상 코인/도박/주식 탕진 (기각 위험 고위험)',
        '최근 5년 이내 회생/파산 면책 이력 존재 (재신청 기간 미도래)',
        '고객 단순 변심 또는 수임 비용 부담으로 진행 포기',
        '연락 두절 (사무장 심층 전화 3회 이상 미수신)',
    ];
    const [selectedRejectReason, setSelectedRejectReason] = useState<string>(REJECT_PRESETS[0]);
    const [customRejectNote, setCustomRejectNote] = useState<string>('');

    if (!isOpen) return null;

    // 핵심 문진 데이터 추출
    const totalDebt = (c.creditLoan?.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0) || 0);
    const incomeNet = c.incomeNet || 0;
    const isEligibleDebt = totalDebt >= 1000;
    const formatManwon = (val: number) => {
        if (!val || val <= 0) return '0원';
        if (val >= 10000) {
            const uk = Math.floor(val / 10000);
            const rem = val % 10000;
            return rem > 0 ? `${uk}억 ${rem.toLocaleString()}만` : `${uk}억원`;
        }
        return `${val.toLocaleString()}만원`;
    };

    // 제출 핸들러
    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const nowIso = new Date().toISOString();
            const pad = (n: number) => String(n).padStart(2, '0');
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

            if (activeTab === 'contract') {
                // 수임 완료 처리
                const memoContent = `[사무장 수임 확정] 수임료 ${contractFee}만원 / 계약일: ${contractAt} / 종류: ${contractType}${contractMemo ? `\n비고: ${contractMemo}` : ''}`;
                const newMemo = {
                    id: Date.now().toString(),
                    createdAt: nowIso,
                    content: memoContent
                };
                await onDecision({
                    status: '계약 완료',
                    secondaryStatus: '수임계약체결',
                    tertiaryStatus: '수임완료',
                    contractAt,
                    contractFee,
                    contractType,
                    specialMemo: [...(c.specialMemo || []), newMemo]
                }, `🎉 [${c.customerName}] 고객님의 사건이 수임 확정되었습니다! (수임료: ${contractFee}만원)`);
            } else if (activeTab === 'rework') {
                // 보완 요청 처리 (상태는 '사무장 접수' 유지하되 2차 상태를 '서류보완요청'으로 지정)
                const fullReason = customReworkNote ? `${selectedReworkReason} (${customReworkNote})` : selectedReworkReason;
                const memoContent = `[사무장 보완요청] 담당 상담원 재확인 요청: ${fullReason}`;
                const newMemo = {
                    id: Date.now().toString(),
                    createdAt: nowIso,
                    content: memoContent
                };
                await onDecision({
                    status: '사무장 접수',
                    secondaryStatus: '서류보완요청',
                    tertiaryStatus: selectedReworkReason.substring(0, 20),
                    specialMemo: [...(c.specialMemo || []), newMemo]
                }, `⚠️ [${c.customerName}] 건이 1차 상담원에게 보완 요청되었습니다.`);
            } else if (activeTab === 'reject') {
                // 진행 불가(기각) 처리
                const fullReason = customRejectNote ? `${selectedRejectReason} (${customRejectNote})` : selectedRejectReason;
                const memoContent = `[사무장 불가판정] 진행 불가 사유: ${fullReason}`;
                const newMemo = {
                    id: Date.now().toString(),
                    createdAt: nowIso,
                    content: memoContent
                };
                await onDecision({
                    status: '진행불가',
                    secondaryStatus: '기각위험',
                    tertiaryStatus: selectedRejectReason.substring(0, 20),
                    dropOffReason: selectedRejectReason,
                    dropOffDetail: customRejectNote || undefined,
                    specialMemo: [...(c.specialMemo || []), newMemo]
                }, `🛑 [${c.customerName}] 건이 '진행불가'로 처리되었습니다.`);
            }
            onClose();
        } catch (err) {
            console.error('사무장 판정 실패:', err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* 헤더 */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                            <Scale size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-extrabold text-base tracking-tight">사무장 사건 심사 & 수임 판정</h3>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                    사무장 전용
                                </span>
                            </div>
                            <p className="text-xs text-indigo-200/80 mt-0.5">
                                1차 문진 데이터 기반 심층 검토 및 수임 계약 / 보완 요청 / 불가 판정
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 본문 스크롤 영역 */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                    {/* 1. 고객 문진 요약 카드 (Twenty CRM / LawWare 벤치마킹) */}
                    <div className="bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-slate-200 dark:border-gray-700/80 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-gray-700 text-xs">
                            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-gray-100 text-sm">
                                <User size={15} className="text-indigo-500" />
                                <span>{c.customerName}</span>
                                <span className="text-slate-400 font-normal">({c.phone})</span>
                                {c.region && <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300 text-[11px]">{c.region}</span>}
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400">
                                <span className="font-medium">1차 인계자: <b className="text-slate-700 dark:text-gray-200">{c.managerName || '상담원'}</b></span>
                                <span>•</span>
                                <span>인계일: {c.statusUpdatedAt?.substring(0, 10) || c.updatedAt?.substring(0, 10)}</span>
                            </div>
                        </div>

                        {/* 4분면 핵심 지표 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
                            <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-slate-200/80 dark:border-gray-700">
                                <span className="text-[10px] text-slate-400 dark:text-gray-500 font-semibold uppercase block">총 채무액</span>
                                <span className={`text-sm font-extrabold mt-0.5 block ${isEligibleDebt ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-500'}`}>
                                    {totalDebt > 0 ? formatManwon(totalDebt) : '미확인'}
                                </span>
                                <span className={`text-[9px] font-bold ${isEligibleDebt ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    {isEligibleDebt ? '✓ 1천만 이상 적격' : '⚠️ 채무 미달 위험'}
                                </span>
                            </div>

                            <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-slate-200/80 dark:border-gray-700">
                                <span className="text-[10px] text-slate-400 dark:text-gray-500 font-semibold uppercase block">월 순소득</span>
                                <span className="text-sm font-extrabold text-slate-800 dark:text-gray-100 mt-0.5 block">
                                    {incomeNet > 0 ? formatManwon(incomeNet) : '미입력'}
                                </span>
                                <span className="text-[9px] text-slate-500 dark:text-gray-400 truncate block">
                                    {c.jobTypes?.join(', ') || '직업 미지정'} {c.insurance4 ? `(${c.insurance4})` : ''}
                                </span>
                            </div>

                            <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-slate-200/80 dark:border-gray-700">
                                <span className="text-[10px] text-slate-400 dark:text-gray-500 font-semibold uppercase block">주거 / 재산</span>
                                <span className="text-xs font-bold text-slate-800 dark:text-gray-200 mt-0.5 block truncate">
                                    {c.housingType || '미입력'} {c.deposit ? `(보${c.deposit}만)` : ''}
                                </span>
                                <span className="text-[9px] text-slate-500 dark:text-gray-400 truncate block">
                                    {c.housingDetail || '상세 미입력'}
                                </span>
                            </div>

                            <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-slate-200/80 dark:border-gray-700">
                                <span className="text-[10px] text-slate-400 dark:text-gray-500 font-semibold uppercase block">이전 이력</span>
                                <span className={`text-xs font-bold mt-0.5 block truncate ${c.historyType && c.historyType !== '없음' ? 'text-rose-500' : 'text-emerald-600'}`}>
                                    {c.historyType || '이력 없음'}
                                </span>
                                <span className="text-[9px] text-slate-500 dark:text-gray-400 block">
                                    부양가족: {c.childrenCount ? `${c.childrenCount}명` : '0명'}
                                </span>
                            </div>
                        </div>

                        {/* 1차 상담원 메모 요약 */}
                        {c.specialMemo && c.specialMemo.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-gray-700 text-xs">
                                <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-tight block mb-1">
                                    1차 상담원 통화 요약 메모
                                </span>
                                <p className="text-slate-700 dark:text-gray-300 line-clamp-2 bg-white/70 dark:bg-gray-800/60 p-2 rounded-lg border border-slate-200/60 dark:border-gray-700/60">
                                    {c.specialMemo[c.specialMemo.length - 1]?.content || '메모 없음'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* 2. 판정 액션 탭 선택 (수임 완료 / 보완 요청 / 진행 불가) */}
                    <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-gray-300 mb-2 block">
                            사무장 심사 판정 선택
                        </label>
                        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => setActiveTab('contract')}
                                className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    activeTab === 'contract'
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
                                }`}
                            >
                                <CheckCircle2 size={15} />
                                <span>수임 계약 체결</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('rework')}
                                className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    activeTab === 'rework'
                                        ? 'bg-amber-600 text-white shadow-md'
                                        : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
                                }`}
                            >
                                <RotateCcw size={15} />
                                <span>상담원 보완 요청</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('reject')}
                                className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    activeTab === 'reject'
                                        ? 'bg-rose-600 text-white shadow-md'
                                        : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
                                }`}
                            >
                                <XCircle size={15} />
                                <span>진행 불가 (기각)</span>
                            </button>
                        </div>
                    </div>

                    {/* 3. 탭별 세부 입력 폼 */}
                    {activeTab === 'contract' && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4 space-y-3.5"
                        >
                            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                                <ShieldCheck size={16} />
                                <span>계약 완료 시 1차 상담원에게 수임 인센티브가 자동 반영됩니다.</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1 block">
                                        사건 종류
                                    </label>
                                    <select
                                        value={contractType}
                                        onChange={(e) => setContractType(e.target.value)}
                                        className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-100"
                                    >
                                        <option value="개인회생">개인회생</option>
                                        <option value="파산">개인파산</option>
                                        <option value="신용회복">신용회복</option>
                                        <option value="새출발기금">새출발기금</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1 block">
                                        수임료 (만원)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={contractFee}
                                            onChange={(e) => setContractFee(Number(e.target.value))}
                                            step={10}
                                            className="w-full text-xs font-extrabold px-3 py-2 pl-7 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400"
                                        />
                                        <span className="absolute left-2.5 top-2.5 text-xs text-emerald-500 font-bold">₩</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1 block">
                                        계약 체결일
                                    </label>
                                    <input
                                        type="date"
                                        value={contractAt}
                                        onChange={(e) => setContractAt(e.target.value)}
                                        className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-100"
                                    >
                                    </input>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1 block">
                                    사무장 특이사항 / 계약 비고
                                </label>
                                <textarea
                                    value={contractMemo}
                                    onChange={(e) => setContractMemo(e.target.value)}
                                    rows={2}
                                    placeholder="예: 분납 3회 약정, 착수금 50만 입금 확인 완료"
                                    className="w-full text-xs p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'rework' && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 space-y-3.5"
                        >
                            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                                <AlertTriangle size={16} />
                                <span>1차 상담원에게 재통화 및 서류 보완 미션이 전달됩니다.</span>
                            </div>

                            <div>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1.5 block">
                                    보완 필요 사유 (프리셋 선택)
                                </label>
                                <div className="space-y-1.5">
                                    {REWORK_PRESETS.map((reason, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setSelectedReworkReason(reason)}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center justify-between ${
                                                selectedReworkReason === reason
                                                    ? 'bg-amber-100 dark:bg-amber-900/50 border-amber-400 text-amber-900 dark:text-amber-200 font-bold'
                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span>{reason}</span>
                                            {selectedReworkReason === reason && <Check size={14} className="text-amber-600" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1 block">
                                    상담원 전달 상세 지시 사항 (선택)
                                </label>
                                <textarea
                                    value={customReworkNote}
                                    onChange={(e) => setCustomReworkNote(e.target.value)}
                                    rows={2}
                                    placeholder="예: 고객님께 급여통장 최근 3개월 입금내역 사진 찍어서 카톡 전송 요청해주세요."
                                    className="w-full text-xs p-2.5 rounded-lg border border-amber-200 dark:border-amber-700 bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'reject' && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl p-4 space-y-3.5"
                        >
                            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
                                <AlertCircle size={16} />
                                <span>사건이 '진행불가' 상태로 변경되며, 상담원 오문진 방지 통계에 반영됩니다.</span>
                            </div>

                            <div>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1.5 block">
                                    기각 / 진행 불가 사유 (프리셋 선택)
                                </label>
                                <div className="space-y-1.5">
                                    {REJECT_PRESETS.map((reason, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setSelectedRejectReason(reason)}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center justify-between ${
                                                selectedRejectReason === reason
                                                    ? 'bg-rose-100 dark:bg-rose-900/50 border-rose-400 text-rose-900 dark:text-rose-200 font-bold'
                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span>{reason}</span>
                                            {selectedRejectReason === reason && <Check size={14} className="text-rose-600" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1 block">
                                    사무장 불수임 판정 상세 비고 (선택)
                                </label>
                                <textarea
                                    value={customRejectNote}
                                    onChange={(e) => setCustomRejectNote(e.target.value)}
                                    rows={2}
                                    placeholder="예: 배우자 명의 아파트 순자산이 3억이라 청산가치 보장의 원칙상 기각 확실시됨."
                                    className="w-full text-xs p-2.5 rounded-lg border border-rose-200 dark:border-rose-700 bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
                                />
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* 하단 버튼 바 */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        취소
                    </button>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg flex items-center gap-1.5 transition-all active:scale-95 ${
                            activeTab === 'contract'
                                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                                : activeTab === 'rework'
                                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                        }`}
                    >
                        {submitting ? (
                            <span>처리 중...</span>
                        ) : (
                            <>
                                <span>
                                    {activeTab === 'contract' && '수임 확정 저장 및 인센티브 반영'}
                                    {activeTab === 'rework' && '상담원 보완 요청 전송'}
                                    {activeTab === 'reject' && '진행 불가 판정 처리'}
                                </span>
                                <ArrowRight size={14} />
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
