import React, { useEffect, useRef, useState } from 'react';
import { Phone, X, Smartphone, Monitor, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { enqueuePendingCall } from '../services/supabase';
import { useActiveCall } from '../contexts/ActiveCallContext';
import { useToast } from '../contexts/ToastContext';

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
    const { showToast } = useToast();

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
                showToast('전화 요청 전송에 실패했습니다.', 'error');
                setSending(false);
            }
        } catch (e) {
            console.error('Failed to enqueue pending call:', e);
            showToast('전화 요청 전송에 실패했습니다.', 'error');
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
                        className="fixed inset-0 bg-background/80 backdrop-blur-xs z-[9998]"
                        onClick={onCancel}
                    />
                    {/* Popup */}
                    <motion.div
                        ref={popupRef}
                        initial={{ opacity: 0, scale: 0.94, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 8 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[340px] bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-primary/10 border-b border-primary/20 px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 bg-primary/20 text-primary border border-primary/30 rounded-lg flex items-center justify-center shrink-0">
                                    <Phone size={16} />
                                </div>
                                <span className="text-foreground font-bold text-sm">전화 발신 확인</span>
                            </div>
                            <button
                                onClick={onCancel}
                                className="text-muted-foreground hover:text-foreground hover:bg-muted transition-colors p-1.5 rounded-lg cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-6 text-center space-y-1.5">
                            <p className="text-foreground font-bold text-lg">
                                {customerName}
                            </p>
                            <p className="text-primary font-mono text-2xl font-black tracking-wider tabular-nums">
                                {formatPhone(phoneNumber)}
                            </p>

                            {/* 성공 메시지 */}
                            {sent && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-4 flex items-center justify-center gap-1.5 text-primary font-semibold text-xs font-mono"
                                >
                                    <Check size={15} />
                                    <span>핸드폰 앱으로 1초 전송 완료!</span>
                                </motion.div>
                            )}

                            {!sent && isMobile && (
                                <p className="text-muted-foreground text-xs font-mono mt-3">
                                    이 고객에게 전화를 거시겠습니까?
                                </p>
                            )}
                        </div>

                        {/* Buttons */}
                        {!sent && (
                            <div className="flex border-t border-border bg-muted/30">
                                <button
                                    onClick={onCancel}
                                    className="flex-1 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                >
                                    취소
                                </button>
                                <div className="w-px bg-border" />

                                {isMobile ? (
                                    /* 모바일: 직접 tel: 링크로 전화앱 실행 */
                                    <a
                                        href={`tel:${cleanPhone}`}
                                        onClick={() => setTimeout(onConfirm, 300)}
                                        className="flex-1 py-3 text-xs font-bold text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5 no-underline cursor-pointer"
                                    >
                                        <Phone size={14} />
                                        전화 걸기
                                    </a>
                                ) : (
                                    /* PC: Supabase에 pending call 기록 → Android 앱이 감지 */
                                    <button
                                        onClick={handleSendToMobile}
                                        disabled={sending}
                                        className="flex-1 py-3 text-xs font-bold text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                    >
                                        {sending ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                                전송 중...
                                            </>
                                        ) : (
                                            <>
                                                <Smartphone size={14} />
                                                핸드폰으로 발신
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
