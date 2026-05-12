import React, { useEffect, useRef, useState } from 'react';
import { Phone, X, Smartphone, Monitor, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { enqueuePendingCall } from '../services/supabase';
import { useActiveCall } from '../contexts/ActiveCallContext';

interface CallConfirmPopupProps {
    isOpen: boolean;
    customerName: string;
    phoneNumber: string;
    caseId?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const CallConfirmPopup: React.FC<CallConfirmPopupProps> = ({
    isOpen,
    customerName,
    phoneNumber,
    caseId,
    onConfirm,
    onCancel
}) => {
    const popupRef = useRef<HTMLDivElement>(null);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const { startCall } = useActiveCall();

    // Reset state when popup opens
    useEffect(() => {
        if (isOpen) {
            setSending(false);
            setSent(false);
        }
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onCancel]);

    // Format phone number for display (010-1234-5678)
    const formatPhone = (phone: string) => {
        const cleaned = phone.replace(/[^0-9]/g, '');
        if (cleaned.length === 11) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
        }
        if (cleaned.length === 10) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        return phone;
    };

    // Clean phone number for tel: URI
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');

    // Detect if on mobile device
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Handle "전화 걸기 (모바일로 전송)" for PC users
    const handleSendToMobile = async () => {
        setSending(true);
        try {
            const success = await enqueuePendingCall(phoneNumber, customerName, caseId);
            if (success) {
                setSent(true);
                // ActiveCallPopup으로 이어받기
                startCall(customerName, phoneNumber, caseId);
                setTimeout(() => {
                    onConfirm();
                }, 1000);
            } else {
                alert('전화 요청 전송에 실패했습니다.');
                setSending(false);
            }
        } catch (e) {
            console.error('Failed to enqueue pending call:', e);
            alert('전화 요청 전송에 실패했습니다.');
            setSending(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 bg-black/40 z-[9998]"
                        onClick={onCancel}
                    />
                    {/* Popup */}
                    <motion.div
                        ref={popupRef}
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[320px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                                    <Phone size={18} className="text-white" />
                                </div>
                                <span className="text-white font-bold text-sm">전화 걸기</span>
                            </div>
                            <button
                                onClick={onCancel}
                                className="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-5 py-5 text-center">
                            <p className="text-gray-800 dark:text-gray-200 font-bold text-lg mb-1">
                                {customerName}
                            </p>
                            <p className="text-green-600 dark:text-green-400 font-mono text-xl font-bold tracking-wide">
                                {formatPhone(phoneNumber)}
                            </p>

                            {/* 성공 메시지 */}
                            {sent && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-3 flex items-center justify-center gap-1.5 text-green-600"
                                >
                                    <Check size={16} />
                                    <span className="text-sm font-medium">핸드폰으로 전송 완료!</span>
                                </motion.div>
                            )}

                            {!sent && (
                                <p className="text-gray-400 dark:text-gray-500 text-xs mt-3">
                                    {isMobile
                                        ? '이 고객에게 전화를 거시겠습니까?'
                                        : '핸드폰으로 전화 요청을 보냅니다'}
                                </p>
                            )}
                        </div>

                        {/* Buttons */}
                        {!sent && (
                            <div className="flex border-t border-gray-100 dark:border-gray-700">
                                <button
                                    onClick={onCancel}
                                    className="flex-1 py-3.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                >
                                    취소
                                </button>
                                <div className="w-px bg-gray-100 dark:bg-gray-700" />

                                {isMobile ? (
                                    /* 모바일: 직접 tel: 링크로 전화앱 실행 */
                                    <a
                                        href={`tel:${cleanPhone}`}
                                        onClick={() => setTimeout(onConfirm, 300)}
                                        className="flex-1 py-3.5 text-sm font-bold text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center justify-center gap-1.5 no-underline"
                                    >
                                        <Phone size={14} />
                                        전화 걸기
                                    </a>
                                ) : (
                                    /* PC: Supabase에 pending call 기록 → Android 앱이 감지 */
                                    <button
                                        onClick={handleSendToMobile}
                                        disabled={sending}
                                        className="flex-1 py-3.5 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        {sending ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                                전송 중...
                                            </>
                                        ) : (
                                            <>
                                                <Smartphone size={14} />
                                                핸드폰으로 전화
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default CallConfirmPopup;
