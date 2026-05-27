import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, X, ExternalLink, Loader2, PhoneCall } from 'lucide-react';
import { useActiveCall } from '../contexts/ActiveCallContext';
import { useNavigate } from 'react-router-dom';
import { Case, MemoItem } from '../types';

const ActiveCallPopup: React.FC = () => {
    const { callState, dismissCall } = useActiveCall();
    const [elapsed, setElapsed] = useState(0);
    const [matchedCase, setMatchedCase] = useState<Case | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

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

                {/* 본문 */}
                <div className="px-4 py-4 text-center">
                    <p className="text-gray-800 dark:text-gray-200 font-bold text-lg">
                        {callState.customerName}
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
