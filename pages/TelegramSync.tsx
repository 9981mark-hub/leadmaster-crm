import React, { useEffect, useState } from 'react';
import { Smartphone, CheckCircle, Clock, AlertTriangle, MessageSquare, ChevronRight, ChevronLeft, Check, X, History, Trash2, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TelegramFeedback } from '../types';
import { 
    fetchPendingFeedbacks, 
    fetchAllFeedbacks,
    confirmFeedback, 
    dismissFeedback, 
    subscribeTelegramFeedbacks,
    deleteFeedbacksByDateRange
} from '../services/telegramFeedback';
import { useToast } from '../contexts/ToastContext';
import { format, parseISO, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';

type TabType = 'pending' | 'history';

export default function TelegramSync() {
    const [activeTab, setActiveTab] = useState<TabType>('pending');
    const [pendingFeedbacks, setPendingFeedbacks] = useState<TelegramFeedback[]>([]);
    const [historyFeedbacks, setHistoryFeedbacks] = useState<TelegramFeedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showToast } = useToast();

    const [selectedChatTitle, setSelectedChatTitle] = useState<string>('all');

    // Deletion states
    const [deleteDate, setDeleteDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [deleteMonth, setDeleteMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
    const [isDeleting, setIsDeleting] = useState(false);

    // Pagination for history tab
    const ITEMS_PER_PAGE = 10;
    const [historyPage, setHistoryPage] = useState(1);

    const loadData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'pending') {
                const data = await fetchPendingFeedbacks();
                setPendingFeedbacks(data);
            } else {
                const data = await fetchAllFeedbacks();
                setHistoryFeedbacks(data);
            }
        } catch (error) {
            showToast('데이터를 불러오는데 실패했습니다.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [activeTab]);

    useEffect(() => {
        const channel = subscribeTelegramFeedbacks((newFeedback) => {
            if (newFeedback.applyMode === 'pending' && !newFeedback.isConfirmed) {
                if (activeTab === 'pending') {
                    setPendingFeedbacks(prev => [newFeedback, ...prev]);
                }
                showToast(`새로운 텔레그램 피드백: ${newFeedback.senderName}`);
            }
        });

        return () => {
            if (channel) channel.unsubscribe();
        };
    }, [activeTab]);

    const handleConfirm = async (feedback: TelegramFeedback, caseId?: string) => {
        const targetCaseId = caseId || feedback.matchedCaseId;
        if (!targetCaseId) {
            showToast('연동할 고객(Case)을 선택해 주세요.', 'error');
            return;
        }

        const success = await confirmFeedback(feedback, 'User', targetCaseId);
        if (success) {
            showToast('고객 상세페이지에 성공적으로 반영되었습니다.');
            setPendingFeedbacks(prev => prev.filter(f => f.id !== feedback.id));
        } else {
            showToast('승인 처리에 실패했습니다.', 'error');
        }
    };

    const handleDismiss = async (id: string) => {
        const success = await dismissFeedback(id);
        if (success) {
            showToast('무시 처리되었습니다.');
            setPendingFeedbacks(prev => prev.filter(f => f.id !== id));
        } else {
            showToast('처리 실패했습니다.', 'error');
        }
    };

    const handleDelete = async (type: 'date' | 'month') => {
        let startStr = '';
        let endStr = '';

        if (type === 'date') {
            if (!deleteDate) return;
            const dateObj = new Date(deleteDate);
            startStr = startOfDay(dateObj).toISOString();
            endStr = endOfDay(dateObj).toISOString();
        } else {
            if (!deleteMonth) return;
            const dateObj = new Date(deleteMonth + '-01'); // yyyy-MM-01
            startStr = startOfMonth(dateObj).toISOString();
            endStr = endOfMonth(dateObj).toISOString();
        }

        const confirmMsg = type === 'date' 
            ? `${deleteDate} 일자의 모든 텔레그램 히스토리를 영구 삭제하시겠습니까?`
            : `${deleteMonth} 월의 모든 텔레그램 히스토리를 영구 삭제하시겠습니까?`;

        if (!window.confirm(confirmMsg)) return;

        setIsDeleting(true);
        const success = await deleteFeedbacksByDateRange(startStr, endStr);
        setIsDeleting(false);

        if (success) {
            showToast('데이터가 성공적으로 삭제되었습니다.');
            loadData(); // reload
        } else {
            showToast('데이터 삭제 처리에 실패했습니다.', 'error');
        }
    };

    const renderFeedbackCard = (f: TelegramFeedback, isHistory: boolean) => (
        <div key={f.id} className={`p-6 transition-colors ${isHistory ? 'bg-white border-b border-gray-50' : 'hover:bg-gray-50/50'}`}>
            <div className={`flex justify-between gap-4 ${isHistory ? 'flex-col sm:flex-row' : ''}`}>
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                        {f.urgency === 'critical' && !isHistory && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 animate-pulse">
                                <AlertTriangle size={12} /> 긴급
                            </span>
                        )}
                        {f.chatTitle && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                💬 {f.chatTitle}
                            </span>
                        )}
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                            {f.feedbackType}
                        </span>
                        
                        {isHistory && (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${f.isConfirmed ? (f.isApplied ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-700 border-gray-200') : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                                {f.isConfirmed ? (f.isApplied ? '승인됨' : '무시됨') : '대기중'}
                            </span>
                        )}

                        <span className="text-sm font-bold text-gray-900">{f.senderName}</span>
                        {f.customerName && (
                            <>
                                <ChevronRight size={14} className="text-gray-400" />
                                {f.matchedCaseId ? (
                                    <Link to={`/case/${f.matchedCaseId}`} className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 hover:bg-blue-100 transition">
                                        {f.customerName} 고객
                                    </Link>
                                ) : (
                                    <span className="text-sm font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                                        {f.customerName} (미연동)
                                    </span>
                                )}
                            </>
                        )}
                        <span className="text-xs font-medium text-gray-400 ml-auto">
                            {format(parseISO(f.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                        </span>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-gray-700 font-medium whitespace-pre-wrap">{f.feedbackContent}</p>
                    </div>

                    {!isHistory && !f.matchedCaseId && (f.aiClassification as any)?.candidates && (f.aiClassification as any).candidates.length > 1 && (
                        <div className="mt-2 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                            <p className="text-xs text-yellow-800 font-bold mb-2 flex items-center gap-1">
                                <AlertTriangle size={14} /> 동명이인이 여러 명 발견되어 자동 연동되지 않았습니다.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {(f.aiClassification as any).candidates.map((c: any, idx: number) => (
                                    <button 
                                        key={idx} 
                                        onClick={() => handleConfirm(f, c.case_id)}
                                        className="text-xs bg-white text-blue-600 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-50 shadow-sm transition font-medium flex items-center gap-1"
                                    >
                                        <Check size={12} /> {c.customer_name} ({c.status}) 님께 승인연동
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {!isHistory && f.aiClassification?.suggestedStatus && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                            <span className="font-bold text-emerald-700">AI 추천:</span>
                            상태를 <span className="font-bold text-gray-900">'{f.aiClassification.suggestedStatus}'</span>(으)로 변경
                        </div>
                    )}
                </div>

                {!isHistory && (
                    <div className="flex flex-col gap-2 w-32 shrink-0">
                        {f.matchedCaseId ? (
                            <button
                                onClick={() => handleConfirm(f)}
                                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition flex items-center justify-center gap-1.5"
                            >
                                <Check size={16} /> 승인하기
                            </button>
                        ) : null}
                        <button
                            onClick={() => handleDismiss(f.id)}
                            className="w-full px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 transition flex items-center justify-center gap-1.5"
                        >
                            <X size={16} /> 무시하기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const uniqueChatTitles = Array.from(new Set([...pendingFeedbacks, ...historyFeedbacks].map(f => f.chatTitle).filter(Boolean))) as string[];

    const getFilteredFeedbacks = (feedbacks: TelegramFeedback[]) => {
        if (selectedChatTitle === 'all') return feedbacks;
        return feedbacks.filter(f => f.chatTitle === selectedChatTitle);
    };

    const filteredPendingFeedbacks = getFilteredFeedbacks(pendingFeedbacks);
    const filteredHistoryFeedbacks = getFilteredFeedbacks(historyFeedbacks);

    // Pagination calculations
    const totalHistoryPages = Math.max(1, Math.ceil(filteredHistoryFeedbacks.length / ITEMS_PER_PAGE));
    const paginatedHistoryFeedbacks = filteredHistoryFeedbacks.slice(
        (historyPage - 1) * ITEMS_PER_PAGE,
        historyPage * ITEMS_PER_PAGE
    );

    // Reset page when filter changes
    useEffect(() => {
        setHistoryPage(1);
    }, [selectedChatTitle]);

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

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 pb-px">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-6 py-3 font-bold text-sm flex items-center gap-2 rounded-t-xl transition-colors ${
                        activeTab === 'pending' 
                        ? 'bg-white text-indigo-600 border-t border-x border-gray-200 shadow-[0_4px_0_0_white]' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <Clock size={18} />
                    승인 대기
                    {pendingFeedbacks.length > 0 && activeTab !== 'pending' && (
                        <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs">{pendingFeedbacks.length}</span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-3 font-bold text-sm flex items-center gap-2 rounded-t-xl transition-colors ${
                        activeTab === 'history' 
                        ? 'bg-white text-indigo-600 border-t border-x border-gray-200 shadow-[0_4px_0_0_white]' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <History size={18} />
                    히스토리 (전체)
                </button>
            </div>

            {/* Room Filter */}
            {uniqueChatTitles.length > 0 && (
                <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <MessageSquare size={18} className="text-gray-500" />
                    <span className="text-sm font-bold text-gray-700">채팅방 필터:</span>
                    <select
                        className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100"
                        value={selectedChatTitle}
                        onChange={(e) => setSelectedChatTitle(e.target.value)}
                    >
                        <option value="all">모든 채팅방 보기</option>
                        {uniqueChatTitles.map(title => (
                            <option key={title} value={title}>{title}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Tab Contents */}
            {activeTab === 'pending' && (
                <div className="bg-white rounded-2xl rounded-tl-none shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <MessageSquare className="text-indigo-500" size={20} />대기 목록
                            <span className="text-sm font-medium text-gray-500 ml-2">총 {filteredPendingFeedbacks.length}건</span>
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
                    ) : filteredPendingFeedbacks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 text-gray-400">
                            <CheckCircle size={48} className="text-emerald-400 mb-4 opacity-50" />
                            <p className="font-bold text-gray-600">모든 피드백이 처리되었습니다.</p>
                            <p className="text-sm mt-1">대기 중인 새로운 피드백이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredPendingFeedbacks.map(f => renderFeedbackCard(f, false))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-4">
                    {/* Delete Actions Panel */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
                                <Trash2 className="text-rose-500" size={16} /> 히스토리 데이터 정리
                            </h3>
                            <p className="text-xs text-gray-500">필요 없는 과거 수집 데이터를 영구 삭제할 수 있습니다.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
                                <Calendar size={14} className="text-gray-500 ml-2" />
                                <input 
                                    type="date" 
                                    className="bg-transparent border-none text-sm outline-none text-gray-700 font-medium focus:ring-0 mx-1"
                                    value={deleteDate}
                                    onChange={(e) => setDeleteDate(e.target.value)}
                                />
                                <button 
                                    onClick={() => handleDelete('date')}
                                    disabled={!deleteDate || isDeleting}
                                    className="px-3 py-1.5 bg-rose-100 text-rose-700 hover:bg-rose-200 font-bold text-xs rounded-lg transition disabled:opacity-50"
                                >
                                    일자 삭제
                                </button>
                            </div>
                            <span className="text-gray-300 font-medium text-sm hidden sm:block">또는</span>
                            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
                                <Calendar size={14} className="text-gray-500 ml-2" />
                                <input 
                                    type="month" 
                                    className="bg-transparent border-none text-sm outline-none text-gray-700 font-medium focus:ring-0 mx-1"
                                    value={deleteMonth}
                                    onChange={(e) => setDeleteMonth(e.target.value)}
                                />
                                <button 
                                    onClick={() => handleDelete('month')}
                                    disabled={!deleteMonth || isDeleting}
                                    className="px-3 py-1.5 bg-rose-600 text-white hover:bg-rose-700 font-bold text-xs rounded-lg shadow-sm transition disabled:opacity-50"
                                >
                                    월 전체 삭제
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <History className="text-indigo-500" size={20} />전체 히스토리
                                <span className="text-sm font-medium text-gray-500 ml-2">총 {filteredHistoryFeedbacks.length}건</span>
                            </h3>
                            <button onClick={loadData} className="text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors">
                                새로고침
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                                <div className="animate-spin inline-block w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full mb-4"></div>
                                <p className="font-medium text-sm">데이터를 불러오는 중...</p>
                            </div>
                        ) : filteredHistoryFeedbacks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-16 text-gray-400">
                                <History size={48} className="text-gray-300 mb-4" />
                                <p className="font-bold text-gray-600">히스토리가 없습니다.</p>
                            </div>
                        ) : (
                            <>
                                <div className="divide-y divide-gray-100">
                                    {paginatedHistoryFeedbacks.map(f => renderFeedbackCard(f, true))}
                                </div>

                                {/* Pagination Controls */}
                                {totalHistoryPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100 bg-gray-50/50">
                                        <button
                                            onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                            disabled={historyPage === 1}
                                            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>

                                        {Array.from({ length: totalHistoryPages }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => setHistoryPage(page)}
                                                className={`w-9 h-9 rounded-lg text-sm font-bold transition ${
                                                    page === historyPage
                                                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                                                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ))}

                                        <button
                                            onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                                            disabled={historyPage === totalHistoryPages}
                                            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <ChevronRight size={16} />
                                        </button>

                                        <span className="text-xs text-gray-400 font-medium ml-3">
                                            {(historyPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(historyPage * ITEMS_PER_PAGE, filteredHistoryFeedbacks.length)} / {filteredHistoryFeedbacks.length}건
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
