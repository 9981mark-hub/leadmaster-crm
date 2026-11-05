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
import { supabase } from '../services/supabase';

const ManualLinker = ({ onLink, prefillName }: { onLink: (caseId: string) => void; prefillName?: string }) => {
    const [searchQuery, setSearchQuery] = useState(prefillName || '');
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (term?: string) => {
        const q = (term || searchQuery).trim();
        if (!q) return;
        setIsSearching(true);
        const { data, error } = await supabase
            .from('cases')
            .select('case_id, customer_name, status, phone')
            .or(`customer_name.ilike.%${q}%,phone.ilike.%${q}%`)
            .limit(10);
            
        if (error) {
            console.error('[ManualLinker] Search error:', error);
        }
        setResults(data || []);
        setIsSearching(false);
    };

    // prefillName이 있으면 마운트 시 자동 검색 실행
    useEffect(() => {
        if (prefillName && prefillName.trim().length >= 2) {
            handleSearch(prefillName.trim());
        }
    }, []);

    return (
        <div className="mt-2 text-sm bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded p-3">
            <p className="text-gray-700 dark:text-gray-200 font-bold mb-2 flex items-center gap-1">
                <AlertTriangle size={14} className="text-yellow-600" />
                자동 연동에 실패했습니다. 수동으로 고객을 검색해 주세요.
            </p>
            <div className="flex gap-2 mb-2">
                <input 
                    type="text" 
                    placeholder="고객 이름 검색..." 
                    className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400 p-1.5 rounded grow text-xs font-medium outline-none"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <button 
                    onClick={() => handleSearch()} 
                    className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold px-3 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-xs transition"
                >
                    {isSearching ? '검색 중..' : '검색'}
                </button>
            </div>
            {results.length > 0 && (
                <div className="flex flex-col gap-1 mt-2">
                    {results.map(r => (
                        <div key={r.case_id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 border border-blue-100 dark:border-blue-900 rounded">
                            <span className="font-medium text-xs text-gray-800 dark:text-gray-200">
                                {r.customer_name} <span className="text-gray-400">({r.status})</span> - {r.phone?.slice(-4) || '번호없음'}
                            </span>
                            <button 
                                onClick={() => onLink(r.case_id)} 
                                className="text-blue-600 bg-blue-50 px-2 py-1 flex items-center gap-1 rounded text-xs font-bold hover:bg-blue-100 transition"
                            >
                                <Check size={12} /> 연동 및 승인
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

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
        <div key={f.id} className={`p-6 transition-colors ${isHistory ? 'bg-white dark:bg-gray-800 border-b border-gray-50 dark:border-gray-700' : 'hover:bg-gray-50/50'}`}>
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
                            f.isConfirmed && f.isApplied && f.matchedCaseId ? (
                                <Link 
                                    to={`/case/${f.matchedCaseId}`}
                                    title="상세페이지로 이동"
                                    className="px-2.5 py-1 rounded-full text-xs font-bold border bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 hover:shadow-sm transition cursor-pointer flex items-center gap-0.5"
                                >
                                    승인됨 <ChevronRight size={10} className="opacity-70" />
                                </Link>
                            ) : (
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${f.isConfirmed ? (f.isApplied ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-700 border-gray-200') : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                                    {f.isConfirmed ? (f.isApplied ? '승인됨' : '무시됨') : '대기중'}
                                </span>
                            )
                        )}

                        <span className="text-sm font-bold text-gray-900 dark:text-white">{f.senderName}</span>
                        {f.matchedCaseId ? (
                            <>
                                <ChevronRight size={14} className="text-gray-400" />
                                <Link to={`/case/${f.matchedCaseId}`} className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 hover:bg-blue-100 transition">
                                    {f.customerName || '연동된 고객'}
                                </Link>
                            </>
                        ) : f.customerName ? (
                            <>
                                <ChevronRight size={14} className="text-gray-400" />
                                <span className="text-sm font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                                    {f.customerName} (미연동)
                                </span>
                            </>
                        ) : null}
                        <span className="text-xs font-medium text-gray-400 ml-auto">
                            {format(parseISO(f.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                        </span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/60 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                        <p className="text-gray-700 dark:text-gray-200 font-medium whitespace-pre-wrap">{f.feedbackContent}</p>
                    </div>

                    {!isHistory && !f.matchedCaseId && (
                        <>
                            {((f.aiClassification as any)?.candidates && (f.aiClassification as any).candidates.length > 0) ? (
                                <div className="mt-2 bg-yellow-50 dark:bg-yellow-950/40 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900/50">
                                    <p className="text-xs text-yellow-800 dark:text-yellow-300 font-bold mb-2 flex items-center gap-1">
                                        <AlertTriangle size={14} /> 동명이인이 여러 명 발견되어 자동 연동되지 않았습니다. 적용할 고객을 선택해주세요.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {(f.aiClassification as any).candidates.map((c: any, idx: number) => (
                                            <button 
                                                key={idx} 
                                                onClick={() => handleConfirm(f, c.case_id)}
                                                className="text-xs bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-gray-700 shadow-sm transition font-medium flex items-center gap-1"
                                            >
                                                <Check size={12} /> {c.customer_name} ({c.status}) 님께 승인연동
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-yellow-200/50">
                                        <ManualLinker onLink={(caseId) => handleConfirm(f, caseId)} prefillName={f.customerName || undefined} />
                                    </div>
                                </div>
                            ) : (
                                <ManualLinker onLink={(caseId) => handleConfirm(f, caseId)} prefillName={f.customerName || undefined} />
                            )}
                        </>
                    )}

                    {!isHistory && f.aiClassification?.suggestedStatus && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-lg border border-emerald-100 dark:border-emerald-800/40">
                            <span className="font-bold text-emerald-700">AI 추천:</span>
                            상태를 <span className="font-bold text-gray-900 dark:text-white">'{f.aiClassification.suggestedStatus}'</span>(으)로 변경
                        </div>
                    )}
                </div>

                {!isHistory && (
                    <div className="flex flex-col gap-2 w-32 shrink-0">
                        {f.matchedCaseId ? (
                            <button
                                onClick={() => handleConfirm(f)}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-sm shadow-indigo-200 hover:bg-blue-700 transition flex items-center justify-center gap-1.5"
                            >
                                <Check size={16} /> 승인하기
                            </button>
                        ) : null}
                        <button
                            onClick={() => handleDismiss(f.id)}
                            className="w-full px-4 py-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 transition flex items-center justify-center gap-1.5"
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
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 shrink-0">
                        <Smartphone size={22} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">텔레그램 연동</h1>
                        <p className="hidden sm:block text-sm text-gray-500 dark:text-gray-400 mt-0.5">현장 피드백 확인 · 승인 · AI 자동 매칭</p>
                    </div>
                </div>
            </div>
            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 pb-px">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-6 py-3 font-bold text-sm flex items-center gap-2 rounded-t-xl transition-colors ${
                        activeTab === 'pending' 
                        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t border-x border-gray-200 dark:border-gray-600 shadow-[0_4px_0_0_white] dark:shadow-[0_4px_0_0_#1f2937]' 
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
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
                        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t border-x border-gray-200 dark:border-gray-600 shadow-[0_4px_0_0_white] dark:shadow-[0_4px_0_0_#1f2937]' 
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                >
                    <History size={18} />
                    히스토리 (전체)
                </button>
            </div>

            {/* Room Filter */}
            {uniqueChatTitles.length > 0 && (
                <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <MessageSquare size={18} className="text-gray-500" />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">채팅방 필터:</span>
                    <select
                        className="p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg text-sm font-medium outline-none"
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
                <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/80">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <MessageSquare className="text-indigo-500" size={20} />대기 목록
                            <span className="text-sm font-medium text-gray-500 ml-2">총 {filteredPendingFeedbacks.length}건</span>
                        </h3>
                        <button onClick={loadData} className="text-sm text-blue-600 font-medium hover:text-indigo-800 transition-colors">
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
                            <p className="font-bold text-gray-600 dark:text-gray-300">모든 피드백이 처리되었습니다.</p>
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
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-1">
                                <Trash2 className="text-rose-500" size={16} /> 히스토리 데이터 정리
                            </h3>
                            <p className="text-xs text-gray-500">필요 없는 과거 수집 데이터를 영구 삭제할 수 있습니다.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/60 p-2 rounded-xl border border-gray-200 dark:border-gray-600">
                                <Calendar size={14} className="text-gray-500 ml-2" />
                                <input 
                                    type="date" 
                                    className="bg-transparent border-none text-sm outline-none text-gray-700 dark:text-white font-medium focus:ring-0 mx-1"
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
                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/60 p-2 rounded-xl border border-gray-200 dark:border-gray-600">
                                <Calendar size={14} className="text-gray-500 ml-2" />
                                <input 
                                    type="month" 
                                    className="bg-transparent border-none text-sm outline-none text-gray-700 dark:text-white font-medium focus:ring-0 mx-1"
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

                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/80">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <History className="text-indigo-500" size={20} />전체 히스토리
                                <span className="text-sm font-medium text-gray-500 ml-2">총 {filteredHistoryFeedbacks.length}건</span>
                            </h3>
                            <button onClick={loadData} className="text-sm text-blue-600 font-medium hover:text-indigo-800 transition-colors">
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
                                            className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>

                                        {Array.from({ length: totalHistoryPages }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => setHistoryPage(page)}
                                                className={`w-9 h-9 rounded-lg text-sm font-bold transition ${
                                                    page === historyPage
                                                        ? 'bg-blue-600 text-white shadow-sm shadow-indigo-200'
                                                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ))}

                                        <button
                                            onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                                            disabled={historyPage === totalHistoryPages}
                                            className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
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
