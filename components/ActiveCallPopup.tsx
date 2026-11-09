import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, X, ExternalLink, Loader2, PhoneCall, Clock, CheckCircle2 } from 'lucide-react';
import { useActiveCall } from '../contexts/ActiveCallContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Case, MemoItem } from '../types';

const ActiveCallPopup: React.FC = () => {
    const { callState, dismissCall } = useActiveCall();
    const [elapsed, setElapsed] = useState(0);
    const [matchedCase, setMatchedCase] = useState<Case | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAddingReminder, setIsAddingReminder] = useState(false);
    const [quickReminderFeedback, setQuickReminderFeedback] = useState<string | null>(null);

    const getQuickReminderSlots = () => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        
        const d30 = new Date(now.getTime() + 30 * 60 * 1000);
        const d60 = new Date(now.getTime() + 60 * 60 * 1000);
        
        const d18 = new Date(now);
        d18.setHours(18, 0, 0, 0);
        if (d18 <= now) {
            d18.setDate(d18.getDate() + 1);
        }
        
        const dTomorrow10 = new Date(now);
        dTomorrow10.setDate(dTomorrow10.getDate() + 1);
        dTomorrow10.setHours(10, 0, 0, 0);
        
        return [
            { label: '+30분', datetime: fmt(d30), desc: `${pad(d30.getHours())}:${pad(d30.getMinutes())}` },
            { label: '+1시간', datetime: fmt(d60), desc: `${pad(d60.getHours())}:${pad(d60.getMinutes())}` },
            { label: '오늘 18시', datetime: fmt(d18), desc: '퇴근 후' },
            { label: '내일 10시', datetime: fmt(dTomorrow10), desc: '오전 10:00' },
        ];
    };

    const handleAddQuickReminder = async (datetime: string, label: string) => {
        if (!matchedCase || isAddingReminder) return;
        setIsAddingReminder(true);
        try {
            const { updateCase } = await import('../services/api');
            const newReminder = {
                id: Date.now().toString(),
                datetime,
                type: '전화' as const,
                content: `[통화중 빠른예약] ${label} 재통화 약속`,
                isCompleted: false
            };
            const updatedReminders = [...(matchedCase.reminders || []), newReminder];
            await updateCase(matchedCase.caseId, { reminders: updatedReminders });
            setMatchedCase(prev => prev ? { ...prev, reminders: updatedReminders } : prev);
            setQuickReminderFeedback(`✓ ${label} 등록 완료!`);
            setTimeout(() => setQuickReminderFeedback(null), 3000);
        } catch (err) {
            console.error('재통화 빠른 예약 실패:', err);
        } finally {
            setIsAddingReminder(false);
        }
    };
    const navigate = useNavigate();
    const location = useLocation();

    // 만원 단위 포맷팅
    const formatManwon = (val: number) => {
        if (!val || val <= 0) return '0원';
        if (val >= 10000) {
            const uk = Math.floor(val / 10000);
            const rem = val % 10000;
            return rem > 0 ? `${uk}억 ${rem.toLocaleString()}만` : `${uk}억원`;
        }
        return `${val.toLocaleString()}만원`;
    };

    // 사전 접수 텍스트 정규식 폴백 추출
    const extractDebtFromPreInfo = (text?: string): number => {
        if (!text) return 0;
        const match = text.match(/(?:채무|빚|대출|부채)\s*[:=\s]*([0-9,]+(?:\s*[천억만]|만\s*원|원)?)/);
        if (!match) return 0;
        const str = match[1].replace(/,/g, '').trim();
        if (str.includes('억')) {
            const parts = str.split('억');
            const uk = parseFloat(parts[0]) || 0;
            const rest = parts[1] ? parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0 : 0;
            return uk * 10000 + rest;
        }
        if (str.includes('천')) {
            const val = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
            return val * 1000;
        }
        if (str.includes('만')) {
            return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
        }
        const rawVal = parseFloat(str) || 0;
        return rawVal > 100000 ? Math.floor(rawVal / 10000) : rawVal;
    };

    const extractIncomeFromPreInfo = (text?: string): number => {
        if (!text) return 0;
        const match = text.match(/(?:소득|급여|월급|수입|실수령)\s*[:=\s]*([0-9,]+(?:\s*[천억만]|만\s*원|원)?)/);
        if (!match) return 0;
        const str = match[1].replace(/,/g, '').trim();
        if (str.includes('만')) return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
        const rawVal = parseFloat(str) || 0;
        return rawVal > 10000 ? Math.floor(rawVal / 10000) : rawVal;
    };

    const extractJobFromPreInfo = (text?: string): string => {
        if (!text) return '';
        const match = text.match(/(?:직업|직종|직무)\s*[:=\s]*([^\n,]+)/);
        if (match && match[1]?.trim()) return match[1].trim();
        if (text.includes('직장인')) return '직장인';
        if (text.includes('사업자') || text.includes('자영업')) return '사업자';
        if (text.includes('프리랜서')) return '프리랜서';
        if (text.includes('주부')) return '주부';
        if (text.includes('무직')) return '무직';
        return '';
    };

    // 사전 고객 정보 파싱 유틸
    const parsePreInfo = (preInfo?: string) => {
        if (!preInfo) return [];
        const lines = preInfo.split('\n');
        const filtered: string[] = [];
        const excludeKeywords = ['referrer', 'marketing_consent', 'third_party_consent', 'user_agent', 'policy_consent'];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const hasExcludeKeyword = excludeKeywords.some(keyword => 
                trimmed.toLowerCase().includes(`[${keyword}]`)
            );
            if (hasExcludeKeyword) continue;

            const colonIndex = trimmed.indexOf(':');
            if (colonIndex !== -1) {
                const value = trimmed.slice(colonIndex + 1).trim();
                if (value) filtered.push(value);
            } else {
                filtered.push(trimmed);
            }
        }
        return filtered;
    };

    // 최근 수동 상담 메모 추출 유틸 (상태 변경 제외)
    const getLatestMemo = (memos?: MemoItem[]) => {
        if (!memos || memos.length === 0) return null;
        const manualMemos = memos.filter(m => !m.content.trim().startsWith('[상태변경]'));
        if (manualMemos.length === 0) return null;
        return [...manualMemos].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
    };

    // 메모 작성일 포맷팅
    const formatMemoDate = (isoString: string) => {
        try {
            const date = new Date(isoString);
            const y = date.getFullYear();
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const d = date.getDate().toString().padStart(2, '0');
            const hh = date.getHours().toString().padStart(2, '0');
            const mm = date.getMinutes().toString().padStart(2, '0');
            return `${y}-${m}-${d} ${hh}:${mm}`;
        } catch (e) {
            return '';
        }
    };

    // 비동기로 고객 정보 조회
    useEffect(() => {
        if (!callState.isActive) {
            setMatchedCase(null);
            setIsLoading(false);
            return;
        }

        const loadCase = async () => {
            setIsLoading(true);
            try {
                const { fetchCase, fetchCases } = await import('../services/api');
                let targetId = callState.caseId;

                if (!targetId && callState.phoneNumber) {
                    const cases = await fetchCases();
                    const normalizedPhone = callState.phoneNumber.replace(/[^0-9]/g, '');
                    const found = cases.find(c => c.phone.replace(/[^0-9]/g, '') === normalizedPhone);
                    if (found) {
                        targetId = found.caseId;
                    }
                }

                if (targetId) {
                    const caseData = await fetchCase(targetId);
                    setMatchedCase(caseData);
                } else {
                    setMatchedCase(null);
                }
            } catch (e) {
                console.error('Failed to load case detail in ActiveCallPopup:', e);
            } finally {
                setIsLoading(false);
            }
        };

        loadCase();
    }, [callState.isActive, callState.caseId, callState.phoneNumber]);

    // 통화 경과 시간 타이머
    useEffect(() => {
        if (callState.mode !== 'calling' || !callState.startedAt) {
            setElapsed(0);
            return;
        }

        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - callState.startedAt!.getTime()) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [callState.mode, callState.startedAt]);

    const formatElapsed = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const formatPhone = (phone: string) => {
        const cleaned = phone.replace(/[^0-9]/g, '');
        if (cleaned.length === 11) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
        if (cleaned.length === 10) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        return phone;
    };

    const handleNavigateToCase = () => {
        if (callState.caseId) {
            navigate(`/case/${callState.caseId}`);
        }
    };

    if (!callState.isActive) return null;
    // 간편 모드(/lite)에서는 전역 미니 팝업 완전 비활성화 (간편 모드 전용 HUD/시트 독립 작동)
    if (location.pathname === '/lite') return null;

    // ========================================
    // 미니 팝업 (ended 모드)
    // ========================================
    if (callState.mode === 'ended') {
        return (
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed bottom-20 md:bottom-6 right-4 z-[9990] bg-gray-800 text-white rounded-xl shadow-2xl border border-gray-700 overflow-hidden min-w-[220px]"
                >
                    <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <PhoneOff size={14} className="text-gray-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{callState.customerName}</p>
                            <p className="text-[11px] text-gray-400">통화 종료</p>
                        </div>
                        <div className="flex items-center gap-1">
                            {callState.caseId && (
                                <button
                                    onClick={handleNavigateToCase}
                                    className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
                                    title="고객 상세"
                                >
                                    <ExternalLink size={14} className="text-blue-400" />
                                </button>
                            )}
                            <button
                                onClick={dismissCall}
                                className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
                                title="닫기"
                            >
                                <X size={14} className="text-gray-400" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        );
    }

    // ========================================
    // 풀 팝업 (pending / dialing / calling 모드)
    // ========================================

    const getHeaderGradient = () => {
        switch (callState.mode) {
            case 'pending': return 'bg-gradient-to-r from-blue-500 to-indigo-500';
            case 'dialing': return 'bg-gradient-to-r from-amber-500 to-orange-500';
            case 'calling': return 'bg-gradient-to-r from-green-500 to-emerald-500';
            default: return 'bg-gradient-to-r from-gray-500 to-gray-600';
        }
    };

    const getHeaderIcon = () => {
        switch (callState.mode) {
            case 'pending': return <Loader2 size={16} className="text-white animate-spin" />;
            case 'dialing': return <PhoneCall size={16} className="text-white" />;
            case 'calling': return <Phone size={16} className="text-white" />;
            default: return <Phone size={16} className="text-white" />;
        }
    };

    const getHeaderLabel = () => {
        switch (callState.mode) {
            case 'pending': return '전화 전송 중';
            case 'dialing': return '전화 연결 대기';
            case 'calling': return '통화 중';
            default: return '';
        }
    };
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed bottom-20 md:bottom-6 right-4 z-[9990] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden w-[380px]"
            >
                {/* 상단 바 */}
                <div className={`px-4 py-3 flex items-center justify-between ${getHeaderGradient()}`}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                            {getHeaderIcon()}
                        </div>
                        <span className="text-white font-bold text-sm">
                            {getHeaderLabel()}
                        </span>
                    </div>
                    <button
                        onClick={dismissCall}
                        className="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* 부재 / 콜백 알림 배너 */}
                {!isLoading && matchedCase && ((matchedCase.missedCallCount && matchedCase.missedCallCount > 0) || matchedCase.lastMissedCallAt) && (
                    <div className="bg-amber-500/10 border-b border-amber-500/20 px-3.5 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs font-bold">
                            <span className="text-sm animate-pulse">🔄</span>
                            <span>콜백 인입 {matchedCase.missedCallCount ? `(부재중 ${matchedCase.missedCallCount}회)` : ''}</span>
                        </div>
                        {matchedCase.lastMissedCallAt && (
                            <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-mono">
                                {formatMemoDate(matchedCase.lastMissedCallAt)}
                            </span>
                        )}
                    </div>
                )}

                {/* 본문 */}
                <div className="px-4 py-4 text-center">
                    <p className="text-gray-800 dark:text-gray-200 font-bold text-lg">
                        {callState.customerName ? callState.customerName.replace('::calling', '') : ''}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 font-mono text-sm mt-0.5">
                        {formatPhone(callState.phoneNumber)}
                    </p>

                    {callState.mode === 'pending' && (
                        <div className="mt-3 flex items-center justify-center gap-2 text-blue-500">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-xs font-medium">핸드폰 대기 중</span>
                        </div>
                    )}

                    {callState.mode === 'dialing' && (
                        <div className="mt-3 flex items-center justify-center gap-2 text-amber-500">
                            <PhoneCall size={14} className="animate-pulse" />
                            <span className="text-xs font-medium">통화 버튼을 눌러주세요</span>
                        </div>
                    )}

                    {callState.mode === 'calling' && (
                        <div className="mt-3">
                            <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-full">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-green-700 dark:text-green-300 font-mono text-sm font-bold">
                                    {formatElapsed(elapsed)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* 사전 정보 & 최근 상담 이력 로딩 상태 */}
                {isLoading && (
                    <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-6 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500">
                        <Loader2 size={18} className="animate-spin text-blue-500" />
                        <span className="text-xs font-medium">고객 정보를 불러오는 중...</span>
                    </div>
                )}

                {/* 사전 고객 정보 섹션 */}
                {!isLoading && matchedCase && (
                    <>
                        {(() => {
                            const debtTotal = (matchedCase.creditLoan?.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0) || 0) || extractDebtFromPreInfo(matchedCase.preInfo);
                            const incomeNet = (matchedCase.incomeNet || 0) || extractIncomeFromPreInfo(matchedCase.preInfo);
                            const jobType = (matchedCase.jobTypes && matchedCase.jobTypes.length > 0 ? matchedCase.jobTypes.join(', ') : '') || extractJobFromPreInfo(matchedCase.preInfo);
                            const insurance = matchedCase.insurance4 || '';
                            const housingStr = [matchedCase.housingType, matchedCase.rent ? `월${matchedCase.rent}만` : ''].filter(Boolean).join(' · ');
                            const historyStr = matchedCase.historyType || (matchedCase.preInfo?.includes('기각') ? '기각 이력' : '이력 없음');
                            const isEligible = debtTotal >= 1000;
                            const hasFinancialInfo = debtTotal > 0 || incomeNet > 0 || Boolean(jobType);

                            if (!hasFinancialInfo) return null;

                            return (
                                <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40 p-3">
                                    <div className="grid grid-cols-3 gap-2 text-left">
                                        {/* 1열: 총 채무액 */}
                                        <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                                            <div>
                                                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-tight block">
                                                    총 채무액
                                                </span>
                                                <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 block mt-0.5 truncate">
                                                    {debtTotal > 0 ? formatManwon(debtTotal) : '미입력'}
                                                </span>
                                            </div>
                                            {debtTotal > 0 && (
                                                <div className="mt-1">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                        isEligible 
                                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                                    }`}>
                                                        {isEligible ? '채무 1천만↑' : '상담 필요'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* 2열: 월 순소득 */}
                                        <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                                            <div>
                                                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-tight block">
                                                    월 순소득
                                                </span>
                                                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 block mt-0.5 truncate">
                                                    {incomeNet > 0 ? formatManwon(incomeNet) : '미입력'}
                                                </span>
                                            </div>
                                            <div className="mt-1 truncate">
                                                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                                    {[jobType, insurance === '가입' ? '4대' : insurance === '미가입' ? '미가입' : ''].filter(Boolean).join(' · ') || '직업 미입력'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* 3열: 주거 / 이력 */}
                                        <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                                            <div>
                                                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-tight block">
                                                    주거 / 이력
                                                </span>
                                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block mt-0.5 truncate">
                                                    {housingStr || '주거 미입력'}
                                                </span>
                                            </div>
                                            <div className="mt-1 truncate">
                                                <span className={`text-[10px] font-medium ${historyStr.includes('기각') ? 'text-rose-500 dark:text-rose-400 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                                                    {historyStr}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* 유입 경로 · 최초 등록일시 */}
                        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3">
                            <div className="flex gap-3">
                                {/* 유입 경로 */}
                                <div className="flex-1 bg-purple-50 dark:bg-purple-900/20 p-2.5 rounded-xl border border-purple-100 dark:border-purple-800/30 text-center">
                                    <div className="text-[10px] font-semibold text-purple-400 dark:text-purple-500 mb-0.5 uppercase tracking-wider">
                                        유입 경로
                                    </div>
                                    <p className="text-xs font-bold text-purple-700 dark:text-purple-300 truncate">
                                        {matchedCase.inboundPath || '미지정'}
                                    </p>
                                </div>
                                {/* 최초 등록일시 */}
                                <div className="flex-1 bg-teal-50 dark:bg-teal-900/20 p-2.5 rounded-xl border border-teal-100 dark:border-teal-800/30 text-center">
                                    <div className="text-[10px] font-semibold text-teal-400 dark:text-teal-500 mb-0.5 uppercase tracking-wider">
                                        최초 등록
                                    </div>
                                    <p className="text-xs font-bold text-teal-700 dark:text-teal-300">
                                        {formatMemoDate(matchedCase.createdAt)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {parsePreInfo(matchedCase.preInfo).length > 0 && (
                            <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 text-left">
                                <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-wider">
                                    사전 고객 정보
                                </div>
                                <div className="space-y-1 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800/80">
                                    {parsePreInfo(matchedCase.preInfo).map((item, idx) => (
                                        <p key={idx} className="text-xs text-gray-700 dark:text-gray-300 break-words leading-relaxed font-medium">
                                            {item}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 최근 상담 이력 섹션 */}
                        {getLatestMemo(matchedCase.specialMemo) && (() => {
                            const latestMemo = getLatestMemo(matchedCase.specialMemo)!;
                            return (
                                <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 text-left">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                            최근 상담 이력
                                        </span>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                            {formatMemoDate(latestMemo.createdAt)}
                                        </span>
                                    </div>
                                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-2.5 rounded-xl border border-blue-100/50 dark:border-blue-900/20 text-xs text-gray-700 dark:text-gray-300">
                                        <p className="line-clamp-5 leading-relaxed whitespace-pre-wrap">
                                            {latestMemo.content}
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}
                    </>
                )}

                {/* [NEW] 골든타임 재통화 빠른 예약 (Close CRM / Cal.com 벤치마킹) */}
                {matchedCase && (
                    <div className="border-t border-gray-100 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-950/20 px-3.5 py-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                <Clock size={12} className="text-amber-600 dark:text-amber-400" />
                                <span>골든타임 재통화 빠른 예약</span>
                            </span>
                            {quickReminderFeedback && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                                    {quickReminderFeedback}
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                            {getQuickReminderSlots().map((slot, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    disabled={isAddingReminder}
                                    onClick={() => handleAddQuickReminder(slot.datetime, slot.label)}
                                    className="py-1.5 px-1 rounded-lg text-[10px] font-bold bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 shadow-xs transition-all active:scale-95 text-center flex flex-col items-center justify-center"
                                >
                                    <span>{slot.label}</span>
                                    <span className="text-[8px] text-amber-600/70 dark:text-amber-400/70 font-mono">{slot.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 하단 액션 */}
                {callState.caseId && (
                    <div className="border-t border-gray-100 dark:border-gray-700">
                        <button
                            onClick={handleNavigateToCase}
                            className="w-full py-2.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-1"
                        >
                            <ExternalLink size={12} />
                            고객 상세 보기
                        </button>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default ActiveCallPopup;
