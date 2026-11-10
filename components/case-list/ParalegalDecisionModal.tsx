import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Scale, CheckCircle2, RotateCcw, XCircle, X, DollarSign, 
    Calendar, AlertTriangle, ShieldCheck, User, Phone, 
    Briefcase, FileText, ArrowRight, Check, AlertCircle, PhoneMissed, Clock,
    Building2, BadgePercent
} from 'lucide-react';
import { Case, MemoItem, ReminderItem, Partner } from '../../types';
import { calculatePartnerIncentive } from '../../utils';

interface ParalegalDecisionModalProps {
    c: Case;
    isOpen: boolean;
    partners?: Partner[];
    secondaryStatuses?: string[];
    onClose: () => void;
    onDecision: (updates: Partial<Case>, successMessage: string) => Promise<void>;
}

export const ParalegalDecisionModal: React.FC<ParalegalDecisionModalProps> = ({
    c,
    isOpen,
    partners = [],
    secondaryStatuses = [],
    onClose,
    onDecision
}) => {
    // 4대 탭: contract(수임완료) | progress(사무장 직접진행) | missed(연락안받음/부재) | reject(진행불가)
    const [activeTab, setActiveTab] = useState<'contract' | 'progress' | 'missed' | 'reject'>('progress');
    const [submitting, setSubmitting] = useState(false);

    // 1. 수임 완료 필드
    const [selectedPartnerId, setSelectedPartnerId] = useState<string>(() => {
        if (c.partnerId) return c.partnerId;
        return partners.length > 0 ? partners[0].partnerId : '';
    });
    const [contractFee, setContractFee] = useState<number>(c.contractFee || 200); // 만원
    const [contractType, setContractType] = useState<string>(c.caseType || '개인회생');
    const [contractAt, setContractAt] = useState<string>(() => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    });
    const [contractMemo, setContractMemo] = useState<string>('사무장 직접 심층 상담 완료 및 사건 수임 약정 체결');

    // 현재 선택된 거래처 및 예상 인센티브 산출
    const currentPartner = partners.find(p => p.partnerId === selectedPartnerId);
    const incentiveInfo = calculatePartnerIncentive(contractFee, contractType, currentPartner);

    // 2. 사무장 직접 진행 관리 (2차 상태)
    const availableSecondary = secondaryStatuses.length > 0 
        ? secondaryStatuses 
        : ['계약서작성', '착수금입금', '방문예약', '출장예약', '고민중', '관리중'];
    const [selectedSecondary, setSelectedSecondary] = useState<string>(() => {
        if (c.secondaryStatus && availableSecondary.includes(c.secondaryStatus)) return c.secondaryStatus;
        return availableSecondary.includes('계약서작성') ? '계약서작성' : availableSecondary[0];
    });
    const [progressDetail, setProgressDetail] = useState<string>('');
    const [customTertiary, setCustomTertiary] = useState<string>(c.tertiaryStatus || '');

    // 3. 인계 후 연락 안받음 (부재/재시도)
    const getMissedReminderSlots = () => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        
        // 오늘 18:00 (퇴근 후)
        const dToday18 = new Date(now);
        dToday18.setHours(18, 0, 0, 0);
        if (dToday18 <= now) dToday18.setDate(dToday18.getDate() + 1);

        // 내일 오전 10:00
        const dTomorrow10 = new Date(now);
        dTomorrow10.setDate(dTomorrow10.getDate() + 1);
        dTomorrow10.setHours(10, 0, 0, 0);

        // 내일 오후 14:00
        const dTomorrow14 = new Date(now);
        dTomorrow14.setDate(dTomorrow14.getDate() + 1);
        dTomorrow14.setHours(14, 0, 0, 0);

        return [
            { label: '오늘 18:00 (퇴근 후)', datetime: fmt(dToday18) },
            { label: '내일 10:00 (오전)', datetime: fmt(dTomorrow10) },
            { label: '내일 14:00 (오후)', datetime: fmt(dTomorrow14) },
        ];
    };
    const [selectedReminderSlot, setSelectedReminderSlot] = useState<{ label: string; datetime: string } | null>(getMissedReminderSlots()[0]);
    const [missedNote, setMissedNote] = useState<string>('사무장 전화 시도했으나 미수신, 지정 시간 재통화 시도 예정');

    // 4. 진행 불가/기각 필드
    const REJECT_PRESETS = [
        '총 채무 1,000만원 미만 (개인회생 신청 자격 미달)',
        '재산(청산가치)이 총 채무보다 많아 회생 불가',
        '최근 대출 90% 이상 코인/도박/주식 탕진 (기각 고위험)',
        '최근 5년 이내 회생/파산 면책 이력 존재 (재신청 기간 미도래)',
        '고객 단순 변심 또는 수임 비용 부담으로 진행 포기',
        '장기 연락 두절 (3회 이상 전화 미수신으로 종결)',
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
            const actor = '사무장';

            if (activeTab === 'contract') {
                // 1. 수임 완료: 1차 상태 '계약 완료', 2차/3차 상태는 초기화 (기존 라이프사이클 정책 준수)
                const partnerName = currentPartner?.name || '미지정 사무소';
                const log = {
                    logId: Date.now().toString(),
                    fromStatus: c.status,
                    toStatus: '계약 완료',
                    changedAt: nowIso,
                    changedBy: actor,
                    memo: `[${partnerName}] 수임료 ${contractFee}만원 계약 체결 (${contractType}) / TM인센티브: ${incentiveInfo.amount}만원(${incentiveInfo.rateLabel})`
                };
                const memoContent = `[사무장 수임 확정] 거래처: ${partnerName} / 수임료: ${contractFee}만원 / 계약일: ${contractAt} / 종류: ${contractType} / 예상인센티브: ${incentiveInfo.amount}만원(${incentiveInfo.rateLabel})${contractMemo ? `\n비고: ${contractMemo}` : ''}`;
                const newMemo: MemoItem = {
                    id: Date.now().toString(),
                    createdAt: nowIso,
                    content: memoContent
                };

                await onDecision({
                    status: '계약 완료',
                    secondaryStatus: undefined,
                    tertiaryStatus: undefined,
                    contractAt,
                    contractFee,
                    contractType,
                    partnerId: selectedPartnerId || c.partnerId,
                    expectedIncentiveFee: incentiveInfo.amount,
                    incentiveStatus: 'unpaid',
                    statusLogs: [log, ...(c.statusLogs || [])],
                    specialMemo: [newMemo, ...(c.specialMemo || [])]
                }, `🎉 [${c.customerName}] 수임 확정! (${partnerName} / 수임료 ${contractFee}만 / TM인센티브 ${incentiveInfo.amount}만)`);

            } else if (activeTab === 'progress') {
                // 2. 사무장 직접 진행: 1차 상태 '사무장 접수' 유지 + 관리자 설정 2차 상태 연동
                const prevSec = c.secondaryStatus || '없음';
                const log = {
                    logId: Date.now().toString(),
                    fromStatus: `${c.status} (${prevSec})`,
                    toStatus: `${c.status} (${selectedSecondary})`,
                    changedAt: nowIso,
                    changedBy: actor,
                    memo: progressDetail || `사무장 진행 상태: ${selectedSecondary}`
                };
                // 기존 [2차 상태 변경] 정규식 포맷과 100% 일치시켜 시계 아이콘 툴팁 파싱 보장
                const memoContent = `[2차 상태 변경] ${prevSec} → ${selectedSecondary}${progressDetail ? `\n사유: ${progressDetail}` : ''}`;
                const newMemo: MemoItem = {
                    id: Date.now().toString(),
                    createdAt: nowIso,
                    content: memoContent
                };

                await onDecision({
                    status: '사무장 접수',
                    secondaryStatus: selectedSecondary,
                    tertiaryStatus: customTertiary || undefined,
                    statusLogs: [log, ...(c.statusLogs || [])],
                    specialMemo: [newMemo, ...(c.specialMemo || [])]
                }, `✓ [${c.customerName}] 건의 진행 상태가 '${selectedSecondary}'(으)로 업데이트되었습니다.`);

            } else if (activeTab === 'missed') {
                // 3. 인계 후 연락 안받음: 2차 상태 '연락안받음' + 부재 카운트 증가 + 재통화 리마인더 등록
                const prevSec = c.secondaryStatus || '없음';
                const nextMissedCount = (c.missedCallCount || 0) + 1;
                const log = {
                    logId: Date.now().toString(),
                    fromStatus: `${c.status} (${prevSec})`,
                    toStatus: `${c.status} (연락안받음)`,
                    changedAt: nowIso,
                    changedBy: actor,
                    memo: `사무장 통화 부재 (${nextMissedCount}회 시도) - ${selectedReminderSlot ? `재통화 예약: ${selectedReminderSlot.label}` : '재시도 필요'}`
                };
                const memoContent = `[2차 상태 변경] ${prevSec} → 연락안받음\n사유: 사무장 통화 시도 부재 (${nextMissedCount}회)${selectedReminderSlot ? ` [재통화 예약: ${selectedReminderSlot.label}]` : ''}${missedNote ? ` - ${missedNote}` : ''}`;
                const newMemo: MemoItem = {
                    id: Date.now().toString(),
                    createdAt: nowIso,
                    content: memoContent
                };

                // 리마인더 추가
                let newReminders = [...(c.reminders || [])];
                if (selectedReminderSlot) {
                    const r: ReminderItem = {
                        id: Date.now().toString(),
                        datetime: selectedReminderSlot.datetime,
                        type: '통화',
                        content: `[사무장 인계 부재 재시도] ${c.customerName} 고객님 통화 연결 재시도 (${nextMissedCount}회차)`,
                        isCompleted: false
                    };
                    newReminders.push(r);
                }

                await onDecision({
                    status: '사무장 접수',
                    secondaryStatus: '연락안받음',
                    tertiaryStatus: `부재${nextMissedCount}회`,
                    missedCallCount: nextMissedCount,
                    lastMissedCallAt: nowIso,
                    reminders: newReminders,
                    statusLogs: [log, ...(c.statusLogs || [])],
                    specialMemo: [newMemo, ...(c.specialMemo || [])]
                }, `📞 [${c.customerName}] 건이 '연락안받음'으로 처리되었습니다.${selectedReminderSlot ? ` (${selectedReminderSlot.label} 재통화 알람 등록)` : ''}`);

            } else if (activeTab === 'reject') {
                // 4. 진행 불가 (기각): 1차 상태 '진행불가', 2차/3차 상태는 초기화 + dropOffReason 저장
                const log = {
                    logId: Date.now().toString(),
                    fromStatus: c.status,
                    toStatus: '진행불가',
                    changedAt: nowIso,
                    changedBy: actor,
                    memo: `사무장 기각/불가 판정: ${selectedRejectReason}`
                };
                const memoContent = `[사무장 불가판정] 사유: ${selectedRejectReason}${customRejectNote ? `\n상세: ${customRejectNote}` : ''}`;
                const newMemo: MemoItem = {
                    id: Date.now().toString(),
                    createdAt: nowIso,
                    content: memoContent
                };

                await onDecision({
                    status: '진행불가',
                    secondaryStatus: undefined,
                    tertiaryStatus: undefined,
                    dropOffReason: selectedRejectReason,
                    dropOffDetail: customRejectNote || undefined,
                    statusLogs: [log, ...(c.statusLogs || [])],
                    specialMemo: [newMemo, ...(c.specialMemo || [])]
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
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
                {/* 헤더 */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                            <Scale size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-extrabold text-base tracking-tight">사무장 사건 심사 & 진행 관리</h3>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-400/20 text-indigo-300 border border-indigo-400/30">
                                    사무장 전용 관제
                                </span>
                            </div>
                            <p className="text-xs text-indigo-200/80 mt-0.5">
                                인계 사건 직접 진행 · 연락안받음 재시도 · 수임 계약 완료 및 기각 종결
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
                    {/* 1. 고객 문진 요약 카드 */}
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

                        {/* 1차 상담원 최근 상담 메모 */}
                        {c.specialMemo && c.specialMemo.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-gray-700 text-xs">
                                <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-tight block mb-1">
                                    1차 상담원 통화 요약 메모
                                </span>
                                <p className="text-slate-700 dark:text-gray-300 line-clamp-2 bg-white/70 dark:bg-gray-800/60 p-2 rounded-lg border border-slate-200/60 dark:border-gray-700/60 font-medium">
                                    {c.specialMemo[c.specialMemo.length - 1]?.content || '메모 없음'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* 2. 4대 실무 판정 탭 선택 (사무장 직접진행 / 연락안받음 / 수임완료 / 진행불가) */}
                    <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-gray-300 mb-2 block">
                            사무장 진행 단계 및 판정 선택
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => setActiveTab('progress')}
                                className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    activeTab === 'progress'
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
                                }`}
                            >
                                <Briefcase size={14} />
                                <span>사무장 직접 진행</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('missed')}
                                className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    activeTab === 'missed'
                                        ? 'bg-amber-600 text-white shadow-md'
                                        : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
                                }`}
                            >
                                <PhoneMissed size={14} />
                                <span>연락안받음/부재</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('contract')}
                                className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    activeTab === 'contract'
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
                                }`}
                            >
                                <CheckCircle2 size={14} />
                                <span>수임 계약 체결</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('reject')}
                                className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    activeTab === 'reject'
                                        ? 'bg-rose-600 text-white shadow-md'
                                        : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
                                }`}
                            >
                                <XCircle size={14} />
                                <span>진행 불가 (기각)</span>
                            </button>
                        </div>
                    </div>

                    {/* 3. 탭별 입력 폼 */}
                    {/* A. 사무장 직접 진행 관리 (기존 2차 상태 100% 연동) */}
                    {activeTab === 'progress' && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 rounded-xl p-4 space-y-3.5"
                        >
                            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300 font-bold text-xs">
                                <Briefcase size={16} />
                                <span>인계 건의 99%는 사무장이 직접 서류 수집 및 약정 단계를 진행합니다.</span>
                            </div>

                            <div>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1.5 block">
                                    사무장 진행 단계 선택 (관리자 설정 2차 상태 목록 연동)
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {availableSecondary.map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => setSelectedSecondary(status)}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-between ${
                                                selectedSecondary === status
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span>{status}</span>
                                            {selectedSecondary === status && <Check size={14} />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1 block">
                                        세부 관리 항목 / 3차 상태 (선택)
                                    </label>
                                    <input
                                        type="text"
                                        value={customTertiary}
                                        onChange={(e) => setCustomTertiary(e.target.value)}
                                        placeholder="예: 서초 주사무소, 부양가족 등본 발급"
                                        className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-100"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1 block">
                                        사무장 진행 메모 (선택)
                                    </label>
                                    <input
                                        type="text"
                                        value={progressDetail}
                                        onChange={(e) => setProgressDetail(e.target.value)}
                                        placeholder="예: 목요일 오후 3시 방문 상담 확정"
                                        className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-100"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* B. 인계 후 연락 안받음 (부재/재시도) ★대표님 지침 핵심 */}
                    {activeTab === 'missed' && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 space-y-3.5"
                        >
                            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs">
                                <PhoneMissed size={16} />
                                <span>고객이 전화를 안 받거나 연락 두절된 건입니다. 2차 상태가 '연락안받음'으로 관리됩니다.</span>
                            </div>

                            <div>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1.5 block">
                                    골든타임 재통화 약속 시간 (원클릭 등록)
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {getMissedReminderSlots().map((slot, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setSelectedReminderSlot(slot)}
                                            className={`px-3 py-2.5 rounded-lg text-xs font-bold border transition-all text-left flex items-center justify-between ${
                                                selectedReminderSlot?.label === slot.label
                                                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex flex-col">
                                                <span>{slot.label}</span>
                                                <span className={`text-[10px] font-mono ${selectedReminderSlot?.label === slot.label ? 'text-amber-100' : 'text-slate-400'}`}>
                                                    {slot.datetime.substring(11)}
                                                </span>
                                            </div>
                                            {selectedReminderSlot?.label === slot.label && <Check size={14} />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1 block">
                                    부재 특이사항 비고
                                </label>
                                <input
                                    type="text"
                                    value={missedNote}
                                    onChange={(e) => setMissedNote(e.target.value)}
                                    placeholder="예: 연결음 10회 가고 안 받음, 카톡 또는 문자 남김"
                                    className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-700 bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-100"
                                />
                            </div>
                        </motion.div>
                    )}

                    {/* C. 수임 계약 체결 (1차 상태: '계약 완료') */}
                    {activeTab === 'contract' && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4 space-y-3.5"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                                    <ShieldCheck size={16} />
                                    <span>수임 확정 시 제휴처별 B2B 인센티브 및 상담원 실적이 자동 연동됩니다.</span>
                                </div>
                            </div>

                            {/* 제휴 법률사무소 선택 & TM 인센티브 실시간 산출 */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-emerald-100 dark:border-emerald-800/60">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 dark:text-gray-300 mb-1 flex items-center">
                                        <Building2 size={13} className="mr-1 text-emerald-600" /> 수임 체결 법률사무소 / 법무법인
                                    </label>
                                    <select
                                        value={selectedPartnerId}
                                        onChange={(e) => setSelectedPartnerId(e.target.value)}
                                        className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-100 outline-none"
                                    >
                                        {partners.map(p => (
                                            <option key={p.partnerId} value={p.partnerId}>
                                                {p.name} {p.incentiveRate ? `(${p.incentiveRate}%)` : p.incentiveFixedAmount ? `(건당 ${p.incentiveFixedAmount}만)` : ''}
                                            </option>
                                        ))}
                                        {partners.length === 0 && <option value="">거래처 없음</option>}
                                    </select>
                                </div>

                                <div className="flex flex-col justify-center bg-emerald-50/80 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center mb-0.5">
                                        <BadgePercent size={12} className="mr-1" /> TM사 예상 수령 인센티브
                                    </span>
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-base font-black text-emerald-700 dark:text-emerald-300">
                                            ₩ {incentiveInfo.amount.toLocaleString()} <span className="text-xs font-semibold">만원</span>
                                        </span>
                                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                                            {incentiveInfo.rateLabel}
                                        </span>
                                    </div>
                                </div>
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
                                    />
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

                    {/* D. 진행 불가 / 기각 (1차 상태: '진행불가') */}
                    {activeTab === 'reject' && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl p-4 space-y-3.5"
                        >
                            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
                                <AlertCircle size={16} />
                                <span>사건이 '진행불가' 상태로 변경되며, 관리자 이탈 분석 통계에 자동 집계됩니다.</span>
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
                                : activeTab === 'progress'
                                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'
                                    : activeTab === 'missed'
                                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                                        : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                        }`}
                    >
                        {submitting ? (
                            <span>처리 중...</span>
                        ) : (
                            <>
                                <span>
                                    {activeTab === 'progress' && '사무장 진행 단계 저장'}
                                    {activeTab === 'missed' && '연락안받음 저장 및 재통화 알람 등록'}
                                    {activeTab === 'contract' && '수임 확정 저장 및 인센티브 반영'}
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
