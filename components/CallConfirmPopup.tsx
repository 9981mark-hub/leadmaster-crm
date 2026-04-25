import React, { useEffect, useRef } from 'react';
import { Phone, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CallConfirmPopupProps {
    isOpen: boolean;
    customerName: string;
    phoneNumber: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const CallConfirmPopup: React.FC<CallConfirmPopupProps> = ({
    isOpen,
    customerName,
    phoneNumber,
    onConfirm,
    onCancel
}) => {
    const popupRef = useRef<HTMLDivElement>(null);

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

    // Clean phone number for tel: URI (digits and + only)
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');

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
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[300px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
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
                            <p className="text-gray-400 dark:text-gray-500 text-xs mt-3">
                                이 고객에게 전화를 거시겠습니까?
                            </p>
                        </div>

                        {/* Buttons */}
                        <div className="flex border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={onCancel}
                                className="flex-1 py-3.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                취소
                            </button>
                            <div className="w-px bg-gray-100 dark:bg-gray-700" />
                            {/*
                              핵심: <a href="tel:..."> 태그를 직접 사용
                              사용자의 실제 탭이 tel: 링크 위에서 발생해야
                              Android Chrome이 전화앱을 직접 열어줌.
                              window.location.href나 프로그래밍적 .click()은
                              "신뢰되지 않은 제스처"로 처리되어 앱 선택 다이얼로그가 뜸.
                            */}
                            <a
                                href={`tel:${cleanPhone}`}
                                onClick={() => setTimeout(onConfirm, 300)}
                                className="flex-1 py-3.5 text-sm font-bold text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center justify-center gap-1.5 no-underline"
                            >
                                <Phone size={14} />
                                전화 걸기
                            </a>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default CallConfirmPopup;

