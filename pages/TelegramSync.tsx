import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
    Smartphone, CheckCircle, Clock, AlertTriangle, MessageSquare, ChevronRight, ChevronLeft, 
    Check, X, History, Trash2, Calendar, Sparkles, Zap, Shield, Settings2, Building2, User, 
    Search, CheckSquare, Square, RefreshCw, PhoneCall, DollarSign, MapPin, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { TelegramFeedback, Case, Partner, CaseStatus } from '../types';
import { 
    fetchPendingFeedbacks, 
    fetchAllFeedbacks,
    confirmFeedback, 
    dismissFeedback, 
    confirmBatchFeedbacks,
    dismissBatchFeedbacks,
    subscribeTelegramFeedbacks,
    deleteFeedbacksByDateRange,
    ConfirmFeedbackOptions
} from '../services/telegramFeedback';
import { fetchCases, fetchPartners } from '../services/api';
import { fetchTeamMembers, TeamMember } from '../services/team';
import { 
    fetchTelegramCompanyRules, 
    TelegramCompanyRules, 
    PRESET_SMART_DEFAULT 
} from '../services/telegramRules';
import { TelegramRuleModal } from '../components/telegram/TelegramRuleModal';
import { fetchTelegramBotLiveStatus, TelegramBotLiveStatus } from '../services/telegramBot';
import { analyzeTelegramFeedbackText, ParsedFeedbackInsights } from '../utils/koreanDateParser';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO, startOfDay, endOfDay, startOfMonth, endOfMonth, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '../services/supabase';
import { DEFAULT_STATUS_LIST } from '../constants';

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

    useEffect(() => {
        if (prefillName && prefillName.trim().length >= 2) {
            handleSearch(prefillName.trim());
        }
    }, [prefillName]);

    return (
        <div className="mt-2 text-sm bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <p className="text-gray-700 dark:text-gray-200 font-bold mb-2 flex items-center gap-1 text-xs">
                <AlertTriangle size={13} className="text-yellow-600" />
                자동 연동에 실패했습니다. 수동으로 고객을 검색하여 연결해 주세요:
            </p>
            <div className="flex gap-2 mb-2">
                <input 
                    type="text" 
                    placeholder="고객 이름 또는 전화번호 검색..." 
                    className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400 p-2 rounded-lg grow text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <button 
                    onClick={() => handleSearch()} 
                    className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold px-3 py-1.5 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-xs transition shrink-0"
                >
                    {isSearching ? '검색 중...' : '검색'}
                </button>
            </div>
            {results.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-2">
                    {results.map(r => (
                        <div key={r.case_id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-lg border border-blue-100 dark:border-blue-900">
                            <span className="font-medium text-xs text-gray-800 dark:text-gray-200">
                                {r.customer_name} <span className="text-gray-400">({r.status})</span> - {r.phone?.slice(-4) || '번호없음'}
                            </span>
                            <button 
                                onClick={() => onLink(r.case_id)} 
                                className="text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 px-2.5 py-1 flex items-center gap-1 rounded-md text-xs font-bold hover:bg-blue-100 transition"
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
type FeedbackTypeFilter = 'all' | 'schedule' | 'care' | 'missed' | 'contract' | 'unlinked' | 'rejected';

export default function TelegramSync() {
    const { user, isAdmin, org } = useAuth();
    const { showToast } = useToast();

    const [activeTab, setActiveTab] = useState<TabType>('pending');
    const [pendingFeedbacks, setPendingFeedbacks] = useState<TelegramFeedback[]>([]);
    const [historyFeedbacks, setHistoryFeedbacks] = useState<TelegramFeedback[]>([]);
    const [cases, setCases] = useState<Case[]>([]);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [botStatus, setBotStatus] = useState<TelegramBotLiveStatus | null>(null);
    const [rules, setRules] = useState<TelegramCompanyRules>(PRESET_SMART_DEFAULT);
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionBusy, setIsActionBusy] = useState(false);

    // Multi-tenant & Role Filters
    const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all');
    const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<FeedbackTypeFilter>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Multi-selection for bulk action
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Schedule calendar toggle state per feedback id
    const [calendarChecks, setCalendarChecks] = useState<Record<string, boolean>>({});

    // Deletion states
    const [deleteDate, setDeleteDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [deleteMonth, setDeleteMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
    const [isDeleting, setIsDeleting] = useState(false);

    // Pagination for history tab
    const ITEMS_PER_PAGE = 15;
    const [historyPage, setHistoryPage] = useState(1);

    // Fast O(1) Maps
    const caseMap = useMemo(() => {
        const m = new Map<string, Case>();
        cases.forEach(c => m.set(c.caseId, c));
        return m;
    }, [cases]);

    const partnerMap = useMemo(() => {
        const m = new Map<string, Partner>();
        partners.forEach(p => m.set(p.partnerId, p));
        return m;
    }, [partners]);

    const teamMap = useMemo(() => {
        const m = new Map<string, TeamMember>();
        teamMembers.forEach(t => m.set(t.userId, t));
        return m;
    }, [teamMembers]);

    // Pre-parse insights for each feedback for instant rendering
    const feedbackInsightsMap = useMemo(() => {
        const m = new Map<string, ParsedFeedbackInsights>();
        [...pendingFeedbacks, ...historyFeedbacks].forEach(f => {
            const ins = analyzeTelegramFeedbackText(f.feedbackContent, parseISO(f.createdAt));
            m.set(f.id, ins);
        });
        return m;
    }, [pendingFeedbacks, historyFeedbacks]);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [pFeedbacks, hFeedbacks, caseList, partnerList, memberList, cRules, bLive] = await Promise.all([
                fetchPendingFeedbacks().catch(() => []),
                fetchAllFeedbacks().catch(() => []),
                fetchCases().catch(() => []),
                fetchPartners().catch(() => []),
                fetchTeamMembers().catch(() => []),
                fetchTelegramCompanyRules(org?.orgId).catch(() => PRESET_SMART_DEFAULT),
                fetchTelegramBotLiveStatus().catch(() => null),
            ]);

            setPendingFeedbacks(pFeedbacks);
            setHistoryFeedbacks(hFeedbacks);
            setCases(caseList);
            setPartners(partnerList);
            setTeamMembers(memberList);
            setRules(cRules);
            setBotStatus(bLive);

            // Init calendar checks for schedules
            const initCal: Record<string, boolean> = {};
            pFeedbacks.forEach(f => {
                const ins = analyzeTelegramFeedbackText(f.feedbackContent, parseISO(f.createdAt));
                if (ins.schedule?.isSchedule) {
                    initCal[f.id] = true; // default checked
                }
            });
            setCalendarChecks(initCal);
        } catch (error) {
            console.error('[TelegramSync] Load error:', error);
            showToast('데이터를 불러오는데 실패했습니다.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [org?.orgId, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData, activeTab]);

    // Realtime subscription
    useEffect(() => {
        const channel = subscribeTelegramFeedbacks((newFeedback) => {
            if (newFeedback.applyMode === 'pending' && !newFeedback.isConfirmed) {
                setPendingFeedbacks(prev => [newFeedback, ...prev]);
                showToast(`새로운 텔레그램 피드백: ${newFeedback.senderName} (${newFeedback.customerName || '고객'})`);
            }
        });

        return () => {
            if (channel) channel.unsubscribe();
        };
    }, [showToast]);

    // Helper: Find case for feedback
    const getCaseForFeedback = useCallback((f: TelegramFeedback): Case | undefined => {
        if (f.matchedCaseId && caseMap.has(f.matchedCaseId)) {
            return caseMap.get(f.matchedCaseId);
        }
        if (f.customerName) {
            return cases.find(c => c.customerName === f.customerName);
        }
        return undefined;
    }, [caseMap, cases]);

    // 1. Role-based filtering:
    // If not admin, only show feedbacks belonging to agent's assigned/created cases!
    const roleFilteredPending = useMemo(() => {
        if (isAdmin) return pendingFeedbacks;
        const currentUserId = user?.email || '';
        return pendingFeedbacks.filter(f => {
            const c = getCaseForFeedback(f);
            if (!c) return false;
            return c.assignedTo === currentUserId || c.assignedTo === user?.name || (c as any).created_by === currentUserId;
        });
    }, [isAdmin, pendingFeedbacks, user, getCaseForFeedback]);

    const roleFilteredHistory = useMemo(() => {
        if (isAdmin) return historyFeedbacks;
        const currentUserId = user?.email || '';
        return historyFeedbacks.filter(f => {
            const c = getCaseForFeedback(f);
            if (!c) return false;
            return c.assignedTo === currentUserId || c.assignedTo === user?.name || (c as any).created_by === currentUserId;
        });
    }, [isAdmin, historyFeedbacks, user, getCaseForFeedback]);

    // 2. Multi-Filter & Search processing
    const filterFeedbackList = useCallback((list: TelegramFeedback[]) => {
        return list.filter(f => {
            const c = getCaseForFeedback(f);
            const ins = feedbackInsightsMap.get(f.id);

            // Partner Filter
            if (selectedPartnerId !== 'all') {
                if (c?.partnerId !== selectedPartnerId) {
                    // Check if chatTitle matches partner telegramChat
                    const pt = partnerMap.get(selectedPartnerId);
                    if (!pt || (pt.telegramChatId && f.chatId !== pt.telegramChatId)) {
                        return false;
                    }
                }
            }

            // Agent Filter (Admin only)
            if (isAdmin && selectedAgentId !== 'all') {
                if (!c || c.assignedTo !== selectedAgentId) {
                    return false;
                }
            }

            // Quick Type Filter
            if (selectedTypeFilter === 'schedule') {
                if (!ins?.schedule?.isSchedule && !f.feedbackType.includes('예약')) return false;
            } else if (selectedTypeFilter === 'care') {
                if (!ins?.isCareNeeded && !f.feedbackType.includes('비용')) return false;
            } else if (selectedTypeFilter === 'missed') {
                if (!f.feedbackType.includes('부재') && !(ins?.missedCallCount)) return false;
            } else if (selectedTypeFilter === 'contract') {
                if (!f.feedbackType.includes('계약') && !f.feedbackType.includes('수임') && !ins?.amounts?.hasAmount) return false;
            } else if (selectedTypeFilter === 'rejected') {
                if (!f.feedbackType.includes('진행불가') && !f.feedbackType.includes('거부') && !f.feedbackType.includes('취소')) return false;
            } else if (selectedTypeFilter === 'unlinked') {
                if (f.matchedCaseId) return false;
            }

            // Search Query Filter
            if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                const name = (f.customerName || c?.customerName || '').toLowerCase();
                const phone = (c?.phone || '').toLowerCase();
                const content = f.feedbackContent.toLowerCase();
                const sender = f.senderName.toLowerCase();
                if (!name.includes(q) && !phone.includes(q) && !content.includes(q) && !sender.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    }, [getCaseForFeedback, feedbackInsightsMap, selectedPartnerId, partnerMap, isAdmin, selectedAgentId, selectedTypeFilter, searchQuery]);

    const filteredPending = useMemo(() => filterFeedbackList(roleFilteredPending), [filterFeedbackList, roleFilteredPending]);
    const filteredHistory = useMemo(() => filterFeedbackList(roleFilteredHistory), [filterFeedbackList, roleFilteredHistory]);

    // KPI Metrics
    const todayFeedbacksCount = useMemo(() => {
        return [...pendingFeedbacks, ...historyFeedbacks].filter(f => isToday(parseISO(f.createdAt))).length;
    }, [pendingFeedbacks, historyFeedbacks]);

    const autoAppliedCount = useMemo(() => {
        return historyFeedbacks.filter(f => f.isApplied && f.isConfirmed && (f.appliedBy === 'auto' || f.applyMode === 'auto')).length;
    }, [historyFeedbacks]);

    const autoAppliedRate = useMemo(() => {
        const total = historyFeedbacks.length;
        if (total === 0) return 0;
        return Math.round((autoAppliedCount / total) * 100);
    }, [autoAppliedCount, historyFeedbacks]);

    const careNeededCount = useMemo(() => {
        return roleFilteredPending.filter(f => {
            const ins = feedbackInsightsMap.get(f.id);
            return ins?.isCareNeeded;
        }).length;
    }, [roleFilteredPending, feedbackInsightsMap]);

    // Single Confirm Handler with Company Rules
    const handleConfirm = async (feedback: TelegramFeedback, overrideCaseId?: string) => {
        const targetCaseId = overrideCaseId || feedback.matchedCaseId;
        if (!targetCaseId) {
            showToast('연동할 고객(Case)을 먼저 선택해 주세요.', 'error');
            return;
        }

        const ins = feedbackInsightsMap.get(feedback.id);
        const rule = rules[feedback.feedbackType] || rules['부재'] || PRESET_SMART_DEFAULT['부재'];
        const isCalChecked = calendarChecks[feedback.id] ?? false;

        const options: ConfirmFeedbackOptions = {
            selectedCaseId: targetCaseId,
            customStatus: rule?.targetStatus || (feedback.aiClassification as any)?.suggestedStatus,
            customSecondaryStatus: rule?.targetSecondaryStatus,
            incrementMissedCall: rule?.incrementMissedCall ?? (ins?.missedCallCount ? true : false),
            missedCallCount: ins?.missedCallCount,
            addCalendar: isCalChecked && !!ins?.schedule?.datetimeStr,
            scheduleDateTime: ins?.schedule?.datetimeStr,
            scheduleType: ins?.schedule?.type,
            scheduleLocation: ins?.schedule?.location,
            amounts: ins?.amounts?.hasAmount ? { totalFee: ins.amounts.totalFee, deposit: ins.amounts.deposit } : undefined,
            appliedBy: user?.name || user?.email || 'User',
            careNeeded: ins?.isCareNeeded,
        };

        setIsActionBusy(true);
        const success = await confirmFeedback(feedback, options);
        setIsActionBusy(false);

        if (success) {
            showToast(`'${feedback.customerName || '고객'}' 피드백이 CRM에 성공적으로 반영되었습니다.`, 'success');
            setPendingFeedbacks(prev => prev.filter(f => f.id !== feedback.id));
            setSelectedIds(prev => {
                const n = new Set(prev);
                n.delete(feedback.id);
                return n;
            });
        } else {
            showToast('승인 처리에 실패했습니다.', 'error');
        }
    };

    // Single Dismiss
    const handleDismiss = async (id: string) => {
        setIsActionBusy(true);
        const success = await dismissFeedback(id);
        setIsActionBusy(false);

        if (success) {
            showToast('무시(확인 완료) 처리되었습니다.');
            setPendingFeedbacks(prev => prev.filter(f => f.id !== id));
            setSelectedIds(prev => {
                const n = new Set(prev);
                n.delete(id);
                return n;
            });
        } else {
            showToast('처리 실패했습니다.', 'error');
        }
    };

    // Bulk Confirm (Selected)
    const handleBulkConfirmSelected = async () => {
        const toConfirm = filteredPending.filter(f => selectedIds.has(f.id) && f.matchedCaseId);
        if (toConfirm.length === 0) {
            showToast('연동 완료된 선택 항목이 없습니다. (미연동 건은 먼저 고객을 연결해주세요)', 'error');
            return;
        }

        if (!window.confirm(`선택한 ${toConfirm.length}건의 피드백을 한 번에 승인하시겠습니까?`)) return;

        setIsActionBusy(true);
        const batchItems = toConfirm.map(f => {
            const ins = feedbackInsightsMap.get(f.id);
            const rule = rules[f.feedbackType] || PRESET_SMART_DEFAULT['부재'];
            const isCal = calendarChecks[f.id] ?? false;
            return {
                feedback: f,
                options: {
                    selectedCaseId: f.matchedCaseId,
                    customStatus: rule?.targetStatus || (f.aiClassification as any)?.suggestedStatus,
                    customSecondaryStatus: rule?.targetSecondaryStatus,
                    incrementMissedCall: rule?.incrementMissedCall,
                    missedCallCount: ins?.missedCallCount,
                    addCalendar: isCal && !!ins?.schedule?.datetimeStr,
                    scheduleDateTime: ins?.schedule?.datetimeStr,
                    scheduleType: ins?.schedule?.type,
                    scheduleLocation: ins?.schedule?.location,
                    amounts: ins?.amounts?.hasAmount ? { totalFee: ins.amounts.totalFee, deposit: ins.amounts.deposit } : undefined,
                    careNeeded: ins?.isCareNeeded,
                }
            };
        });

        const res = await confirmBatchFeedbacks(batchItems, user?.name || user?.email || 'User');
        setIsActionBusy(false);

        showToast(`${res.success}건 승인 완료${res.failed > 0 ? ` (${res.failed}건 실패)` : ''}`, 'success');
        setPendingFeedbacks(prev => prev.filter(f => !selectedIds.has(f.id) || !f.matchedCaseId));
        setSelectedIds(new Set());
    };

    // Bulk Confirm All Matched (One-Click Auto Approval)
    const handleConfirmAllMatched = async () => {
        const matchedItems = filteredPending.filter(f => f.matchedCaseId);
        if (matchedItems.length === 0) {
            showToast('자동 승인 가능한 매칭 완료 피드백이 없습니다.', 'error');
            return;
        }

        if (!window.confirm(`매칭이 확인된 ${matchedItems.length}건의 피드백을 추천 설정대로 일괄 승인하시겠습니까?`)) return;

        setIsActionBusy(true);
        const batchItems = matchedItems.map(f => {
            const ins = feedbackInsightsMap.get(f.id);
            const rule = rules[f.feedbackType] || PRESET_SMART_DEFAULT['부재'];
            const isCal = calendarChecks[f.id] ?? false;
            return {
                feedback: f,
                options: {
                    selectedCaseId: f.matchedCaseId,
                    customStatus: rule?.targetStatus || (f.aiClassification as any)?.suggestedStatus,
                    customSecondaryStatus: rule?.targetSecondaryStatus,
                    incrementMissedCall: rule?.incrementMissedCall,
                    missedCallCount: ins?.missedCallCount,
                    addCalendar: isCal && !!ins?.schedule?.datetimeStr,
                    scheduleDateTime: ins?.schedule?.datetimeStr,
                    scheduleType: ins?.schedule?.type,
                    scheduleLocation: ins?.schedule?.location,
                    amounts: ins?.amounts?.hasAmount ? { totalFee: ins.amounts.totalFee, deposit: ins.amounts.deposit } : undefined,
                    careNeeded: ins?.isCareNeeded,
                }
            };
        });

        const res = await confirmBatchFeedbacks(batchItems, user?.name || user?.email || 'User');
        setIsActionBusy(false);

        showToast(`총 ${res.success}건 일괄 승인 완료`, 'success');
        setPendingFeedbacks(prev => prev.filter(f => !f.matchedCaseId));
        setSelectedIds(new Set());
    };

    // Bulk Dismiss (Selected)
    const handleBulkDismissSelected = async () => {
        const ids: string[] = Array.from(selectedIds);
        if (ids.length === 0) return;

        if (!window.confirm(`선택한 ${ids.length}건의 피드백을 일괄 무시(확인 완료) 처리하시겠습니까?`)) return;

        setIsActionBusy(true);
        const success = await dismissBatchFeedbacks(ids);
        setIsActionBusy(false);

        if (success) {
            showToast(`${ids.length}건 무시 처리 완료`);
            setPendingFeedbacks(prev => prev.filter(f => !selectedIds.has(f.id)));
            setSelectedIds(new Set());
        } else {
            showToast('일괄 무시 처리에 실패했습니다.', 'error');
        }
    };

    // Selection Toggles
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredPending.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredPending.map(f => f.id)));
        }
    };

    // Delete History by Date Range
    const handleDeleteHistory = async (type: 'date' | 'month') => {
        let startStr = '';
        let endStr = '';

        if (type === 'date') {
            if (!deleteDate) return;
            const dateObj = new Date(deleteDate);
            startStr = startOfDay(dateObj).toISOString();
            endStr = endOfDay(dateObj).toISOString();
        } else {
            if (!deleteMonth) return;
            const dateObj = new Date(deleteMonth + '-01');
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
            showToast('히스토리 데이터가 성공적으로 삭제되었습니다.');
            loadData();
        } else {
            showToast('데이터 삭제 처리에 실패했습니다.', 'error');
        }
    };

    // History Pagination
    const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));
    const paginatedHistory = filteredHistory.slice(
        (historyPage - 1) * ITEMS_PER_PAGE,
        historyPage * ITEMS_PER_PAGE
    );

    // Render single feedback card
    const renderFeedbackCard = (f: TelegramFeedback, isHistory: boolean) => {
        const c = getCaseForFeedback(f);
        const ins = feedbackInsightsMap.get(f.id);
        const rule = rules[f.feedbackType] || PRESET_SMART_DEFAULT['부재'];
        const isSelected = selectedIds.has(f.id);
        const isCalChecked = calendarChecks[f.id] ?? false;

        // Partner name from case or chat
        const partnerObj = c?.partnerId ? partnerMap.get(c.partnerId) : undefined;
        const partnerName = partnerObj?.name || f.chatTitle || '법률사무소';

        // Agent name
        const agentObj = c?.assignedTo ? teamMap.get(c.assignedTo) : undefined;
        const agentName = agentObj?.displayName || agentObj?.name || c?.assignedTo || '미배정';

        return (
            <div 
                key={f.id} 
                className={`p-5 transition-colors border-b border-gray-100 dark:border-gray-700/60 ${
                    isSelected ? 'bg-purple-50/50 dark:bg-purple-950/20' : isHistory ? 'bg-white dark:bg-gray-800' : 'hover:bg-gray-50/60 dark:hover:bg-gray-750'
                }`}
            >
                <div className="flex items-start gap-3.5">
                    {/* Checkbox for bulk action */}
                    {!isHistory && (
                        <button
                            type="button"
                            onClick={() => toggleSelect(f.id)}
                            className="mt-1 text-gray-400 hover:text-purple-600 transition shrink-0"
                        >
                            {isSelected ? (
                                <CheckSquare size={19} className="text-purple-600" />
                            ) : (
                                <Square size={19} />
                            )}
                        </button>
                    )}

                    <div className="flex-1 space-y-2.5">
                        {/* 1. Header Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Partner Badge */}
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                                <Building2 size={12} /> {partnerName}
                            </span>

                            {/* Agent Badge */}
                            {c && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 flex items-center gap-1">
                                    <User size={12} /> {agentName}
                                </span>
                            )}

                            {/* Feedback Type Badge */}
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                {f.feedbackType}
                            </span>

                            {/* Care Needed Alert Badge */}
                            {ins?.isCareNeeded && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1 animate-pulse">
                                    <AlertTriangle size={12} /> 1차 TM 재관리 요망
                                </span>
                            )}

                            {/* Status in History */}
                            {isHistory && (
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                    f.isConfirmed && f.isApplied 
                                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                                        : f.isConfirmed 
                                            ? 'bg-gray-100 text-gray-700 border-gray-200' 
                                            : 'bg-amber-100 text-amber-700 border-amber-200'
                                }`}>
                                    {f.isConfirmed ? (f.isApplied ? '승인완료' : '무시됨') : '대기중'}
                                </span>
                            )}

                            {/* Customer Link */}
                            {c ? (
                                <Link 
                                    to={`/case/${c.caseId}`}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5"
                                >
                                    🎯 {c.customerName} <span className="text-gray-400 font-normal">({c.status})</span>
                                    <ChevronRight size={12} />
                                </Link>
                            ) : f.customerName ? (
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                    🔍 {f.customerName} (미연동)
                                </span>
                            ) : null}

                            {/* Timestamp */}
                            <span className="text-xs text-gray-400 ml-auto shrink-0">
                                {format(parseISO(f.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                            </span>
                        </div>

                        {/* 2. Message Body */}
                        <div className="bg-gray-50/80 dark:bg-gray-900/50 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700 text-sm">
                            <p className="text-gray-800 dark:text-gray-200 font-medium whitespace-pre-wrap leading-relaxed">
                                {f.feedbackContent}
                            </p>
                        </div>

                        {/* 3. Extracted Smart Insights & Automation Options */}
                        {!isHistory && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                {/* Schedule Detected */}
                                {ins?.schedule?.isSchedule && (
                                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs">
                                        <Calendar size={14} className="text-emerald-600" />
                                        <span className="font-bold text-emerald-800 dark:text-emerald-300">
                                            {ins.schedule.dateDisplay}
                                        </span>
                                        <label className="flex items-center gap-1 ml-2 text-emerald-700 dark:text-emerald-400 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={isCalChecked}
                                                onChange={(e) => setCalendarChecks(prev => ({ ...prev, [f.id]: e.target.checked }))}
                                                className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className="font-semibold">캘린더 자동 등록</span>
                                        </label>
                                    </div>
                                )}

                                {/* Amounts Detected */}
                                {ins?.amounts?.hasAmount && (
                                    <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-700 dark:text-blue-300">
                                        <DollarSign size={14} className="text-blue-600" />
                                        <span>{ins.amounts.displayStr}</span>
                                    </div>
                                )}

                                {/* Missed Call Count */}
                                {ins?.missedCallCount && ins.missedCallCount > 1 && (
                                    <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-300">
                                        <PhoneCall size={13} className="text-amber-600" />
                                        <span>부재 {ins.missedCallCount}차 감지</span>
                                    </div>
                                )}

                                {/* Target Status Preview based on Company Rules */}
                                {rule?.targetStatus && (
                                    <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/30 px-2.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 text-xs text-purple-700 dark:text-purple-300">
                                        <Sparkles size={13} className="text-purple-600" />
                                        <span>규칙 상태: <b>'{rule.targetStatus}'</b></span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 4. Unmatched Linker */}
                        {!isHistory && !f.matchedCaseId && (
                            <div className="pt-1">
                                <ManualLinker 
                                    onLink={(caseId) => handleConfirm(f, caseId)} 
                                    prefillName={f.customerName || ins?.customerName} 
                                />
                            </div>
                        )}
                    </div>

                    {/* 5. Right Action Buttons */}
                    {!isHistory && (
                        <div className="flex flex-col gap-2 shrink-0 w-28">
                            {f.matchedCaseId && (
                                <button
                                    onClick={() => handleConfirm(f)}
                                    disabled={isActionBusy}
                                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                    <Check size={14} /> {ins?.schedule?.isSchedule ? '일정 즉시 저장' : '승인'}
                                </button>
                            )}
                            <button
                                onClick={() => handleDismiss(f.id)}
                                disabled={isActionBusy}
                                className="w-full px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                                <X size={14} /> 무시
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 dark:shadow-none shrink-0">
                        <Smartphone size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                            텔레그램 연동 관제 센터
                            {!isAdmin && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                    상담원 모드
                                </span>
                            )}
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            법률사무소 현장 피드백 실시간 파싱 · 1:N 채널 라우팅 · 캘린더/정산 자동 연동
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {/* Bot Live Indicator */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs">
                        <span className={`w-2 h-2 rounded-full ${botStatus?.webhookConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                            {botStatus?.webhookConnected ? (botStatus.botUsername ? `@${botStatus.botUsername}` : '봇 정상 수신') : '웹훅 미연결'}
                        </span>
                    </div>

                    {/* Rule Modal Trigger (Admin Only) */}
                    {isAdmin && (
                        <button
                            onClick={() => setIsRuleModalOpen(true)}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition flex items-center gap-1.5 shadow-2xs"
                        >
                            <Settings2 size={15} className="text-purple-600" />
                            <span>자동화 룰 설정</span>
                        </button>
                    )}

                    <button
                        onClick={loadData}
                        disabled={isLoading}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        title="새로고침"
                    >
                        <RefreshCw size={17} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Top 4 KPI Metrics Header */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">오늘 수신 피드백</span>
                        <MessageSquare size={17} className="text-blue-500" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-gray-900 dark:text-white">{todayFeedbacksCount}</span>
                        <span className="text-xs text-gray-400 font-medium">건</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">오토파일럿 자동 반영</span>
                        <Zap size={17} className="text-purple-500" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{autoAppliedRate}%</span>
                        <span className="text-xs text-gray-400 font-medium">{autoAppliedCount}건 처리</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">승인 대기</span>
                        <Clock size={17} className="text-amber-500" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{roleFilteredPending.length}</span>
                        <span className="text-xs text-gray-400 font-medium">건</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">1차 TM 재케어 요망</span>
                        <AlertTriangle size={17} className={careNeededCount > 0 ? "text-rose-500 animate-pulse" : "text-gray-300"} />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className={`text-2xl font-black ${careNeededCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
                            {careNeededCount}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">건 긴급</span>
                    </div>
                </div>
            </div>

            {/* Agent Role Mode Notice Banner */}
            {!isAdmin && (
                <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-3 rounded-xl flex items-center justify-between text-xs text-blue-800 dark:text-blue-300">
                    <div className="flex items-center gap-2">
                        <User size={15} className="text-blue-600" />
                        <span><b>상담원 전용 모드:</b> 본인이 접수하거나 배정받은 고객 리드의 피드백만 표시됩니다.</span>
                    </div>
                    {careNeededCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                            재케어 요청 {careNeededCount}건
                        </span>
                    )}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-px">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-6 py-3 font-bold text-sm flex items-center gap-2 rounded-t-xl transition ${
                        activeTab === 'pending' 
                        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t border-x border-gray-200 dark:border-gray-700 shadow-[0_4px_0_0_white] dark:shadow-[0_4px_0_0_#1f2937]' 
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                    }`}
                >
                    <Clock size={17} />
                    <span>승인 대기</span>
                    {roleFilteredPending.length > 0 && (
                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">
                            {roleFilteredPending.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-3 font-bold text-sm flex items-center gap-2 rounded-t-xl transition ${
                        activeTab === 'history' 
                        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t border-x border-gray-200 dark:border-gray-700 shadow-[0_4px_0_0_white] dark:shadow-[0_4px_0_0_#1f2937]' 
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                    }`}
                >
                    <History size={17} />
                    <span>히스토리 (전체)</span>
                    <span className="text-xs text-gray-400">({roleFilteredHistory.length})</span>
                </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-2xs border border-gray-100 dark:border-gray-700 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* 1. Partner Filter (Admin only) */}
                        {isAdmin && (
                            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/60 p-1 rounded-xl border border-gray-200 dark:border-gray-600 text-xs">
                                <Building2 size={14} className="text-gray-500 ml-1.5" />
                                <select
                                    value={selectedPartnerId}
                                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                                    className="bg-transparent border-none text-xs font-bold text-gray-800 dark:text-gray-200 outline-none pr-3"
                                >
                                    <option value="all">전체 법률사무소 ({partners.length}개소)</option>
                                    {partners.map(p => (
                                        <option key={p.partnerId} value={p.partnerId}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* 2. Agent Filter (Admin only) */}
                        {isAdmin && teamMembers.length > 0 && (
                            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/60 p-1 rounded-xl border border-gray-200 dark:border-gray-600 text-xs">
                                <User size={14} className="text-gray-500 ml-1.5" />
                                <select
                                    value={selectedAgentId}
                                    onChange={(e) => setSelectedAgentId(e.target.value)}
                                    className="bg-transparent border-none text-xs font-bold text-gray-800 dark:text-gray-200 outline-none pr-3"
                                >
                                    <option value="all">전체 담당 상담원</option>
                                    {teamMembers.map(t => (
                                        <option key={t.userId} value={t.userId}>{t.displayName || t.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* 3. Search Query Input */}
                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/60 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 text-xs min-w-[200px]">
                            <Search size={14} className="text-gray-400" />
                            <input
                                type="text"
                                placeholder="고객명, 번호, 본문 검색..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-transparent border-none outline-none text-xs text-gray-800 dark:text-white placeholder-gray-400 w-full"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filter result count */}
                    <span className="text-xs text-gray-400 font-medium shrink-0">
                        필터 검색: <b>{activeTab === 'pending' ? filteredPending.length : filteredHistory.length}</b>건
                    </span>
                </div>

                {/* Quick Type Filter Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                    {[
                        { id: 'all', label: '전체 보기' },
                        { id: 'schedule', label: '📅 출장·내방 예약' },
                        { id: 'care', label: '⚠️ 재케어 요망' },
                        { id: 'missed', label: '📞 부재' },
                        { id: 'contract', label: '💰 수임·입금' },
                        { id: 'rejected', label: '🚫 진행불가' },
                        { id: 'unlinked', label: '🔍 미연동 건만' },
                    ].map(chip => (
                        <button
                            key={chip.id}
                            onClick={() => setSelectedTypeFilter(chip.id as FeedbackTypeFilter)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                selectedTypeFilter === chip.id
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab 1: Pending Feedbacks with Bulk Toolbar */}
            {activeTab === 'pending' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xs border border-gray-100 dark:border-gray-700 overflow-hidden">
                    
                    {/* Bulk Action Toolbar */}
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700/80 bg-gray-50/70 dark:bg-gray-800/80 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={toggleSelectAll}
                                className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-purple-600 transition"
                            >
                                {selectedIds.size > 0 && selectedIds.size === filteredPending.length ? (
                                    <CheckSquare size={17} className="text-purple-600" />
                                ) : (
                                    <Square size={17} />
                                )}
                                <span>전체 선택 ({selectedIds.size}/{filteredPending.length})</span>
                            </button>

                            {selectedIds.size > 0 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleBulkConfirmSelected}
                                        disabled={isActionBusy}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs disabled:opacity-50"
                                    >
                                        <Check size={13} /> 선택 승인 ({selectedIds.size}건)
                                    </button>
                                    <button
                                        onClick={handleBulkDismissSelected}
                                        disabled={isActionBusy}
                                        className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 rounded-lg text-xs font-medium transition flex items-center gap-1 disabled:opacity-50"
                                    >
                                        <X size={13} /> 선택 무시
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* One-click Confirm All Matched (Auto-Pilot) */}
                        <button
                            onClick={handleConfirmAllMatched}
                            disabled={isActionBusy || filteredPending.filter(f => f.matchedCaseId).length === 0}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-40"
                        >
                            <Zap size={14} className="text-amber-300" />
                            <span>AI 추천대로 전체 일괄 저장·승인</span>
                        </button>
                    </div>

                    {/* Pending List Contents */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-16 text-gray-400">
                            <div className="animate-spin inline-block w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full mb-3" />
                            <p className="font-medium text-xs">피드백 데이터를 동기화하는 중...</p>
                        </div>
                    ) : filteredPending.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 text-gray-400">
                            <CheckCircle size={44} className="text-emerald-500 mb-3 opacity-60" />
                            <p className="font-bold text-gray-700 dark:text-gray-300 text-sm">대기 중인 피드백이 없습니다.</p>
                            <p className="text-xs text-gray-400 mt-1">모든 현장 피드백이 처리되었거나 자동 반영되었습니다.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                            {filteredPending.map(f => renderFeedbackCard(f, false))}
                        </div>
                    )}
                </div>
            )}

            {/* Tab 2: History Tab */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    {/* Delete Actions Panel (Admin only) */}
                    {isAdmin && (
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-2xs border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                                    <Trash2 className="text-rose-500" size={14} /> 과거 히스토리 데이터 정리
                                </h3>
                                <p className="text-[11px] text-gray-400">보관 주기가 지난 텔레그램 수집 데이터를 영구 삭제합니다.</p>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                                <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/60 p-1.5 rounded-xl border border-gray-200 dark:border-gray-600">
                                    <Calendar size={13} className="text-gray-500 ml-1" />
                                    <input 
                                        type="date" 
                                        className="bg-transparent border-none text-xs outline-none text-gray-700 dark:text-white font-medium"
                                        value={deleteDate}
                                        onChange={(e) => setDeleteDate(e.target.value)}
                                    />
                                    <button 
                                        onClick={() => handleDeleteHistory('date')}
                                        disabled={!deleteDate || isDeleting}
                                        className="px-2.5 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200 font-bold text-[11px] rounded-lg transition disabled:opacity-50"
                                    >
                                        일자 삭제
                                    </button>
                                </div>
                                <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/60 p-1.5 rounded-xl border border-gray-200 dark:border-gray-600">
                                    <input 
                                        type="month" 
                                        className="bg-transparent border-none text-xs outline-none text-gray-700 dark:text-white font-medium ml-1"
                                        value={deleteMonth}
                                        onChange={(e) => setDeleteMonth(e.target.value)}
                                    />
                                    <button 
                                        onClick={() => handleDeleteHistory('month')}
                                        disabled={!deleteMonth || isDeleting}
                                        className="px-2.5 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200 font-bold text-[11px] rounded-lg transition disabled:opacity-50"
                                    >
                                        월간 삭제
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* History List */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xs border border-gray-100 dark:border-gray-700 overflow-hidden">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center p-16 text-gray-400">
                                <div className="animate-spin inline-block w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full mb-3" />
                                <p className="font-medium text-xs">히스토리를 불러오는 중...</p>
                            </div>
                        ) : filteredHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-16 text-gray-400">
                                <History size={44} className="text-gray-300 mb-3" />
                                <p className="font-bold text-gray-600 dark:text-gray-300 text-sm">히스토리가 없습니다.</p>
                            </div>
                        ) : (
                            <>
                                <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                                    {paginatedHistory.map(f => renderFeedbackCard(f, true))}
                                </div>

                                {/* Pagination */}
                                {totalHistoryPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                                        <button
                                            onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                            disabled={historyPage === 1}
                                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 disabled:opacity-30"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                            {historyPage} / {totalHistoryPages}
                                        </span>
                                        <button
                                            onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                                            disabled={historyPage === totalHistoryPages}
                                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 disabled:opacity-30"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Rule Builder Modal */}
            <TelegramRuleModal
                isOpen={isRuleModalOpen}
                onClose={() => setIsRuleModalOpen(false)}
                currentRules={rules}
                onSaved={(newRules) => {
                    setRules(newRules);
                    showToast('자동화 룰이 성공적으로 저장 및 적용되었습니다.', 'success');
                }}
                availableStatuses={DEFAULT_STATUS_LIST}
                orgId={org?.orgId}
            />

        </div>
    );
}
