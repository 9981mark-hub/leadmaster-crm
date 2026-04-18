import React, { useEffect, useState } from 'react';
import { Smartphone, CheckCircle, Clock, AlertTriangle, MessageSquare, ChevronRight, Check, X } from 'lucide-react';
import { TelegramFeedback } from '../types';
import { fetchPendingFeedbacks, confirmFeedback, dismissFeedback, subscribeTelegramFeedbacks } from '../services/telegramFeedback';
import { useToast } from '../contexts/ToastContext';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function TelegramSync() {
    const [feedbacks, setFeedbacks] = useState<TelegramFeedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showToast } = useToast();

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await fetchPendingFeedbacks();
            setFeedbacks(data);
        } catch (error) {
            showToast('데이터를 불러오는데 실패했습니다.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        const channel = subscribeTelegramFeedbacks((newFeedback) => {
            if (newFeedback.applyMode === 'pending' && !newFeedback.isConfirmed) {
                setFeedbacks(prev => [newFeedback, ...prev]);
                showToast(`새로운 텔레그램 피드백: ${newFeedback.senderName}`);
            }
        });

        return () => {
            if (channel) channel.unsubscribe();
        };
    }, []);

    const handleConfirm = async (id: string) => {
        const success = await confirmFeedback(id);
        if (success) {
            showToast('적용 승인되었습니다.');
            setFeedbacks(prev => prev.filter(f => f.id !== id));
        } else {
            showToast('승인에 실패했습니다.', 'error');
        }
    };

    const handleDismiss = async (id: string) => {
        const success = await dismissFeedback(id);
        if (success) {
            showToast('무시 처리되었습니다.');
            setFeedbacks(prev => prev.filter(f => f.id !== id));
        } else {
            showToast('처리 실패했습니다.', 'error');
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-gradient-to-r from-indigo-600 to-purple-600 p-8 rounded-2xl shadow-lg relative overflow-hidden">
                <div className="relative z-10 text-white">
                    <h2 className="text-3xl font-extrabold flex items-center gap-3">
                        <Smartphone size={32} />
                        텔레그램 연동 센터
                    </h2>
                    <p className="mt-2 text-indigo-100 opacity-90 text-sm">
                        현장에서 들어온 텔레그램 피드백을 확인하고 승인하세요. AI가 고객을 자동 매칭합니다.
                    </p>
                </div>
                <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-6">
                    <Smartphone size={160} />
                </div>
            </div>

            <div className="flex gap-4 mb-4">
                <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="p-4 bg-orange-50 rounded-full text-orange-500">
                        <Clock size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-500">승인 대기</p>
                        <h3 className="text-2xl font-bold text-gray-800">{feedbacks.length}건</h3>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <MessageSquare className="text-indigo-500" size={20} />대기 목록
                    </h3>
                    <button onClick={loadData} className="text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors">
                        새로고침
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                        <div className="animate-spin inline-block w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full mb-4"></div>
                        <p className="font-medium text-sm">피드백 데이터를 불러오는 중...</p>
                    </div>
                ) : feedbacks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-16 text-gray-400">
                        <CheckCircle size={48} className="text-emerald-400 mb-4 opacity-50" />
                        <p className="font-bold text-gray-600">모든 피드백이 처리되었습니다.</p>
                        <p className="text-sm mt-1">대기 중인 새로운 피드백이 없습니다.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {feedbacks.map(f => (
                            <div key={f.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                                <div className="flex justify-between gap-4">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-3">
                                            {f.urgency === 'critical' && (
                                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 animate-pulse">
                                                    <AlertTriangle size={12} /> 긴급
                                                </span>
                                            )}
                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                {f.feedbackType}
                                            </span>
                                            <span className="text-sm font-bold text-gray-900">{f.senderName}</span>
                                            {f.customerName && (
                                                <>
                                                    <ChevronRight size={14} className="text-gray-400" />
                                                    <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                        {f.customerName} 고객
                                                    </span>
                                                </>
                                            )}
                                            <span className="text-xs font-medium text-gray-400 ml-auto">
                                                {format(parseISO(f.createdAt), 'M/d HH:mm', { locale: ko })}
                                            </span>
                                        </div>
                                        
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                            <p className="text-gray-700 font-medium whitespace-pre-wrap">{f.feedbackContent}</p>
                                        </div>

                                        {f.aiClassification?.suggestedStatus && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                                                <span className="font-bold text-emerald-700">AI 추천:</span>
                                                상태를 <span className="font-bold text-gray-900">'{f.aiClassification.suggestedStatus}'</span>(으)로 변경
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2 w-32 shrink-0">
                                        <button
                                            onClick={() => handleConfirm(f.id)}
                                            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition flex items-center justify-center gap-1.5"
                                        >
                                            <Check size={16} /> 승인하기
                                        </button>
                                        <button
                                            onClick={() => handleDismiss(f.id)}
                                            className="w-full px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 transition flex items-center justify-center gap-1.5"
                                        >
                                            <X size={16} /> 무시하기
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
