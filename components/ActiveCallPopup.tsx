import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, X, ExternalLink, Loader2 } from 'lucide-react';
import { useActiveCall } from '../contexts/ActiveCallContext';
import { useNavigate } from 'react-router-dom';

const ActiveCallPopup: React.FC = () => {
    const { callState, dismissCall } = useActiveCall();
    const [elapsed, setElapsed] = useState(0);
    const navigate = useNavigate();

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
    // 풀 팝업 (pending / calling 모드)
    // ========================================
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed bottom-20 md:bottom-6 right-4 z-[9990] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden w-[280px]"
            >
                {/* 상단 바 */}
                <div className={`px-4 py-3 flex items-center justify-between ${
                    callState.mode === 'pending'
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500'
                }`}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                            {callState.mode === 'pending' ? (
                                <Loader2 size={16} className="text-white animate-spin" />
                            ) : (
                                <Phone size={16} className="text-white" />
                            )}
                        </div>
                        <span className="text-white font-bold text-sm">
                            {callState.mode === 'pending' ? '전화 전송 중' : '통화 중'}
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
