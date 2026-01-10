import React, { useEffect, useState, useMemo } from 'react';
import { fetchCases, fetchPartners, fetchInboundPaths, deleteCase, restoreCase, fetchStatuses, GOOGLE_SCRIPT_URL, processIncomingCase, subscribe, refreshData, updateCase } from '../services/api';
import { Case, Partner, ReminderItem, CaseStatus } from '../types';
import { getCaseWarnings, parseReminder, parseGenericDate, safeFormat } from '../utils';
import { Link } from 'react-router-dom';
import { Search, Phone, AlertTriangle, ArrowUpDown, ChevronLeft, ChevronRight, Filter, Trash2, Building, Upload, Sparkles, MessageSquare, X, PhoneMissed, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../contexts/ToastContext';
import ImportModal from '../components/ImportModal';
import HoverCheckTooltip from '../components/HoverCheckTooltip';
import StatusVisibilityModal from '../components/StatusVisibilityModal';
import { fetchCaseStatusLogs } from '../services/api';
import { STATUS_COLOR_MAP } from '../constants';
import { MemoItem, CaseStatusLog } from '../types';


const getNextUpcomingReminder = (reminders?: ReminderItem[]): ReminderItem | null => {
    if (!reminders || reminders.length === 0) return null;

    const now = new Date();
    const upcoming = reminders
        .map(r => ({ ...r, dateObj: parseReminder(r.datetime) }))
        .filter(r => r.dateObj && r.dateObj >= now)
        .sort((a, b) => a.dateObj!.getTime() - b.dateObj!.getTime());

    return upcoming.length > 0 ? upcoming[0] : null;
};

// Sub-component for async fetching of status history in tooltip
const StatusHistoryTooltipContent = ({ caseId }: { caseId: string }) => {
    const [logs, setLogs] = useState<CaseStatusLog[] | null>(null);

    useEffect(() => {
        // Fetch on mount (when tooltip is shown)
        fetchCaseStatusLogs(caseId).then(setLogs);
    }, [caseId]);

    if (!logs) return <span>로딩중...</span>;
    if (logs.length === 0) return <span>이력이 없습니다.</span>;

    return (
        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
            <p className="font-bold text-gray-300 border-b border-gray-600 pb-1 sticky top-0 bg-gray-900/90">상태 변경 이력</p>
            {logs.map((log, i) => (
                <div key={i} className="text-[11px] border-b border-gray-700 last:border-0 pb-1 mb-1">
                    <div className="flex justify-between text-gray-400 mb-0.5">
                        <span>{log.fromStatus || '신규'} → <span className="text-blue-300">{log.toStatus}</span></span>
                        <span className="text-[10px]">{log.changedAt.split('T')[0]}</span>
                    </div>
                    {log.memo && <div className="text-gray-300 pl-1 border-l-2 border-gray-600">{log.memo}</div>}
                </div>
            ))}
        </div>
    );
};

export default function CaseList() {
    const { showToast } = useToast();
    const [cases, setCases] = useState<Case[]>(() => {
        try {
            const saved = localStorage.getItem('lm_cases_cache');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    // Cache cases locally to prevent blink on refresh
    useEffect(() => {
        localStorage.setItem('lm_cases_cache', JSON.stringify(cases));
    }, [cases]);

    const [partners, setPartners] = useState<Partner[]>([]);
    const [inboundPaths, setInboundPaths] = useState<string[]>([]);
    const [statuses, setStatuses] = useState<CaseStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const [viewMode, setViewMode] = useState<'active' | 'trash'>(() => (sessionStorage.getItem('lm_viewMode') as any) || 'active');

    // [New] Status Visibility Filter
    const [isVisibilityModalOpen, setIsVisibilityModalOpen] = useState(false);
    const [hiddenStatuses, setHiddenStatuses] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('lm_hiddenStatuses');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('lm_hiddenStatuses', JSON.stringify(hiddenStatuses));
    }, [hiddenStatuses]);

    const toggleHiddenStatus = (status: string) => {
        setHiddenStatuses(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    // Filters & Sort
    // [Missed Call Settings]
    const [missedCallStatus, setMissedCallStatus] = useState('부재');
    const [missedCallInterval, setMissedCallInterval] = useState(3);

    // Filters & Sort (Persisted in sessionStorage)
    const [search, setSearch] = useState(() => sessionStorage.getItem('lm_search') || '');
    const [statusFilter, setStatusFilter] = useState(() => sessionStorage.getItem('lm_statusFilter') || '');
    const [inboundPathFilter, setInboundPathFilter] = useState(() => sessionStorage.getItem('lm_inboundPathFilter') || '');
    const [partnerFilter, setPartnerFilter] = useState(() => sessionStorage.getItem('lm_partnerFilter') || '');
    const [dateFilterStart, setDateFilterStart] = useState(() => sessionStorage.getItem('lm_dateFilterStart') || '');
    const [dateFilterEnd, setDateFilterEnd] = useState(() => sessionStorage.getItem('lm_dateFilterEnd') || '');
    const [sortOrder, setSortOrder] = useState<'createdAt_desc' | 'createdAt_asc' | 'lastConsultation_desc' | 'lastConsultation_asc' | 'updatedAt_desc' | 'updatedAt_asc' | 'inboundPath_asc'>(
        () => (sessionStorage.getItem('lm_sortOrder') as any) || 'createdAt_desc'
    );

    // Quick Filter for "New" cases
    const [showNewOnly, setShowNewOnly] = useState(() => sessionStorage.getItem('lm_showNewOnly') === 'true');

    // Persistence Effect
    useEffect(() => {
        sessionStorage.setItem('lm_search', search);
        sessionStorage.setItem('lm_statusFilter', statusFilter);
        sessionStorage.setItem('lm_inboundPathFilter', inboundPathFilter);
        sessionStorage.setItem('lm_partnerFilter', partnerFilter);
        sessionStorage.setItem('lm_dateFilterStart', dateFilterStart);
        sessionStorage.setItem('lm_dateFilterEnd', dateFilterEnd);
        sessionStorage.setItem('lm_sortOrder', sortOrder);
        sessionStorage.setItem('lm_showNewOnly', String(showNewOnly));
        sessionStorage.setItem('lm_viewMode', viewMode);
    }, [search, statusFilter, inboundPathFilter, partnerFilter, dateFilterStart, dateFilterEnd, sortOrder, showNewOnly, viewMode]);

    // Pagination
    // [Fix] Persist currentPage to prevent reset on re-mount
    const [currentPage, setCurrentPage] = useState<number>(() => {
        const saved = sessionStorage.getItem('lm_caselist_page');
        return saved ? Number(saved) : 1;
    });

    // Save page to session storage whenever it changes
    useEffect(() => {
        sessionStorage.setItem('lm_caselist_page', String(currentPage));
    }, [currentPage]);
    const itemsPerPage = 10;



    // [Polling State]
    const [pendingCases, setPendingCases] = useState<Case[] | null>(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [newLeadsCount, setNewLeadsCount] = useState(0);
    // Keep track of current cases for diffing in the effect closure
    const casesRef = React.useRef(cases);

    useEffect(() => {
        casesRef.current = cases;
    }, [cases]);

    // [POLLING] Background check every 30 seconds
    // [POLLING] Background check
    // 1. Initial Load (Run once)
    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            // Load Settings
            const storedStats = localStorage.getItem('lm_missedStatus');
            if (storedStats) setMissedCallStatus(storedStats);
            const storedInterval = localStorage.getItem('lm_missedInterval');
            if (storedInterval) setMissedCallInterval(Number(storedInterval));

            try {
                setLoading(true);
                const [data, partnerData, pathData, statusData] = await Promise.all([
                    fetchCases(),
                    fetchPartners(),
                    fetchInboundPaths(),
                    fetchStatuses()
                ]);

                if (isMounted) {
                    setCases(data);
                    setPartners(partnerData);
                    setInboundPaths(pathData);
                    setStatuses(statusData);
                    setLoading(false);
                }
            } catch (err: any) {
                console.error(err);
                if (isMounted) {
                    setLoading(false);
                    showToast("데이터를 불러오는 중 오류가 발생했습니다.", 'error');
                }
            }
        };

        loadData();

        // Subscribe to real-time updates (via WebSocket/Event check)
        const unsubscribe = subscribe(async () => {
            if (isMounted) {
                // If update comes in, we can update in background or show banner.
                // Re-using the background update logic:
                const data = await fetchCases();
                const currentStr = JSON.stringify(casesRef.current);
                const newStr = JSON.stringify(data);

                if (currentStr !== newStr) {
                    setPendingCases(data);
                    setUpdateAvailable(true);
                    const diff = data.length - casesRef.current.length;
                    if (diff > 0) setNewLeadsCount(diff);
                }
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);

    // [Global Fix] Enforce auto scroll behavior on mount
    useEffect(() => {
        const container = document.getElementById('main-scroll-container');
        if (container) {
            container.style.scrollBehavior = 'auto';
        }
    }, []);

    // [Flicker-Free] Scroll Restoration
    // Initialize true if there is a saved position to restore, else false
    const [isRestoring, setIsRestoring] = useState(() => {
        return !!sessionStorage.getItem('lm_caselist_scrollTop');
    });

    // We utilize a ref to track if we've successfully restored to prevent re-running
    const restoredRef = React.useRef(!sessionStorage.getItem('lm_caselist_scrollTop'));

    useEffect(() => {
        // Robust Save Logic: Save on scroll (throttled) + beforeunload
        const handleScrollSave = () => {
            const container = document.getElementById('main-scroll-container');
            if (container) {
                sessionStorage.setItem('lm_caselist_scrollTop', container.scrollTop.toString());
            }
        };

        // Aggressive saving to catch every move
        let timeoutId: any;
        const throttledSave = () => {
            if (!timeoutId) {
                timeoutId = setTimeout(() => {
                    handleScrollSave();
                    timeoutId = null;
                }, 200);
            }
        };

        const container = document.getElementById('main-scroll-container');
        if (container) {
            container.addEventListener('scroll', throttledSave);
        }
        window.addEventListener('beforeunload', handleScrollSave);

        return () => {
            if (container) container.removeEventListener('scroll', throttledSave);
            window.removeEventListener('beforeunload', handleScrollSave);
            handleScrollSave();
        };
    }, []);

    // Restoration Logic (Retry Strategy)
    useEffect(() => {
        // Run only if we have data and haven't finished restoring
        if (!loading && cases.length > 0 && !restoredRef.current) {
            const savedScrollTop = sessionStorage.getItem('lm_caselist_scrollTop');

            if (savedScrollTop) {
                const targetY = parseInt(savedScrollTop, 10);
                const container = document.getElementById('main-scroll-container');

                if (!container) return;

                // Disable smooth scrolling globally on the container during restoration
                // const originalScrollBehavior = container.style.scrollBehavior;
                container.style.scrollBehavior = 'auto';

                // Retry loop: Attempt to restore for up to 2 seconds
                // This waits for the container height to expand enough to hold the scroll
                const startTime = Date.now();
                const attemptRestore = () => {
                    // Force scroll
                    container.scrollTop = targetY;

                    // If we are close enough (allow 1px diff) OR timed out
                    if (Math.abs(container.scrollTop - targetY) < 2 || Date.now() - startTime > 1000) {
                        // Success or Timeout
                        restoredRef.current = true;

                        // [Scroll Lock] Proactively force scroll position for 500ms to prevent glitches
                        const lockStart = Date.now();
                        const forceScrollLock = () => {
                            if (Date.now() - lockStart > 500) return; // Stop locking after 500ms

                            container.scrollTop = targetY;
                            requestAnimationFrame(forceScrollLock);
                        };
                        requestAnimationFrame(forceScrollLock);

                        // Reveal content
                        setTimeout(() => {
                            setIsRestoring(false);
                            // Do NOT restore original behavior. Keep it 'auto'.

                            // Set manual restoration for history AFTER we took control
                            if ('scrollRestoration' in window.history) {
                                window.history.scrollRestoration = 'manual';
                            }
                        }, 50);
                    } else {
                        // Retry next frame
                        requestAnimationFrame(attemptRestore);
                    }
                };

                requestAnimationFrame(attemptRestore);
            } else {
                restoredRef.current = true;
                setIsRestoring(false);
            }
        } else if (!loading && cases.length > 0 && restoredRef.current) {
            // If already restored (or new visit), ensure visible
            setIsRestoring(false);
        }
    }, [loading, cases.length]);

    // 2. Polling Interval (Skip if modal is open)
    useEffect(() => {
        if (isImportModalOpen) return; // Stop polling while modal is open

        const intervalId = setInterval(async () => {
            if (document.visibilityState === 'visible') {
                // Background Refresh
                try {
                    await refreshData();
                    // Note: refreshData updates internal cache in api.ts.
                    // We need to fetch from that cache to compare.
                    const data = await fetchCases();

                    // Check for diffs
                    const currentStr = JSON.stringify(casesRef.current);
                    const newStr = JSON.stringify(data);

                    if (currentStr !== newStr) {
                        setPendingCases(data);
                        setUpdateAvailable(true);
                        const diff = data.length - casesRef.current.length;
                        if (diff > 0) setNewLeadsCount(diff);
                    }
                } catch (e) {
                    console.error("Polling failed", e);
                }
            }
        }, 30000); // 30s

        return () => clearInterval(intervalId);
    }, [isImportModalOpen]);

    // Manual Refresh Handler
    const handleManualRefresh = () => {
        if (pendingCases) {
            setCases(pendingCases);
            setUpdateAvailable(false);
            setNewLeadsCount(0);
            setPendingCases(null);
            showToast("리스트가 최신 상태로 업데이트되었습니다.", 'success');
            // Re-fetch others to be safe? 
            // We already fetched them in loadData('update') but didn't save them.
            // For simplicity, just assuming cases are the main sync target.
            // If strict, we could store pendingPartners etc. but it's overkill.
        }
    };



    // Reset page when filters change
    // [Fix] Removed useEffect that auto-resets page to prevent jumping during background refresh.
    // Page reset is now handled explicitly in onChange handlers.

    const handleDelete = async (caseId: string, e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }

        if (viewMode === 'active') {
            // Soft Delete Warning
            if (!window.confirm('이 케이스를 휴지통으로 이동하시겠습니까? (30일 후 자동 삭제됨)')) {
                return;
            }
            try {
                await deleteCase(caseId); // Soft delete
                // Locally update to reflect change immediately (hide from active list)
                setCases(prev => prev.map(c => c.caseId === caseId ? { ...c, deletedAt: new Date().toISOString(), status: '휴지통' } : c));
                showToast('휴지통으로 이동되었습니다.');
            } catch (error) {
                console.error("Delete failed", error);
                showToast('삭제 중 오류가 발생했습니다.', 'error');
            }
        } else {
            // Hard Delete Warning (Trash Mode)
            if (!window.confirm('⚠️ [영구 삭제] 정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다!')) {
                return;
            }
            try {
                await deleteCase(caseId, true); // Hard delete
                setCases(prev => prev.filter(c => c.caseId !== caseId));
                showToast('영구적으로 삭제되었습니다.');
            } catch (error) {
                console.error("Permanent delete failed", error);
                showToast('삭제 중 오류가 발생했습니다.', 'error');
            }
        }
    };

    const handleRestore = async (caseId: string, e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        if (!window.confirm('이 케이스를 복구하시겠습니까?')) return;

        try {
            await restoreCase(caseId);
            setCases(prev => prev.map(c => c.caseId === caseId ? { ...c, deletedAt: undefined, status: '신규접수' } : c));
            showToast('케이스가 복구되었습니다.');
        } catch (error) {
            console.error("Restore failed", error);
            showToast('복구 중 오류가 발생했습니다.', 'error');
        }
    };

    // [Missed Call Action]
    const handleMissedCall = async (e: React.MouseEvent, c: Case) => {
        e.preventDefault();
        e.stopPropagation();

        const now = new Date();
        const nextCount = (c.missedCallCount || 0) + 1;

        // Optimistic UI Update
        const updatedCase = {
            ...c,
            missedCallCount: nextCount,
            lastMissedCallAt: now.toISOString()
        };

        setCases(prev => prev.map(item => item.caseId === c.caseId ? updatedCase : item));

        try {
            // Create Log
            const managerName = localStorage.getItem('managerName') || 'Unknown';
            const newLog: CaseStatusLog = {
                logId: new Date().getTime().toString(),
                caseId: c.caseId,
                changedBy: managerName,
                fromStatus: c.status,
                toStatus: c.status, // No change
                changedAt: now.toISOString(),
                memo: `부재 카운트 증가 (${nextCount}회)`
            };
            const updatedLogs = [...(c.statusLogs || []), newLog];

            // Use updateCase (exported from api.ts)
            await updateCase(c.caseId, {
                missedCallCount: nextCount,
                lastMissedCallAt: now.toISOString(),
                statusLogs: updatedLogs
            });

            showToast(`부재 횟수가 ${nextCount}회로 증가했습니다.`);
        } catch (err) {
            console.error(err);
            showToast('저장 중 오류가 발생했습니다.', 'error');
        }
    };

    const filteredCases = cases.filter(c => {
        const matchesSearch = String(c.customerName || '').includes(search) || String(c.phone || '').includes(search);

        // [Modified] Status Filter Logic (Global Hide vs Explicit Select)
        const isHiddenGlobally = hiddenStatuses.includes(c.status);
        const matchesStatus = statusFilter === ''
            ? !isHiddenGlobally // If no specific filter, hide if in hidden list
            : c.status === statusFilter; // If specific filter, SHOW even if hidden globally
        const matchesPath = inboundPathFilter === '' || c.inboundPath === inboundPathFilter;
        const matchesPartner = partnerFilter === '' || c.partnerId === partnerFilter;
        const matchesNew = showNewOnly ? c.isNew : true;

        // [NEW] Recycle Bin Filter (Refactored for Status-based Trash)
        const isDeleted = c.status === '휴지통' || !!c.deletedAt;
        if (viewMode === 'active' && isDeleted) return false;
        if (viewMode === 'trash' && !isDeleted) return false;

        // Date Filter (Common Logic)
        let matchesDate = true;
        if (dateFilterStart || dateFilterEnd) {
            const caseDate = parseGenericDate(c.createdAt);
            if (caseDate) {
                const dateStr = format(caseDate, 'yyyy-MM-dd');
                if (dateFilterStart && dateStr < dateFilterStart) matchesDate = false;
                if (dateFilterEnd && dateStr > dateFilterEnd) matchesDate = false;
            } else {
                if (dateFilterStart || dateFilterEnd) matchesDate = false;
            }
        }

        return matchesSearch && matchesStatus && matchesPath && matchesPartner && matchesDate && matchesNew;
    });

    const getLastConsultationDate = (c: Case): string => {
        if (!c.specialMemo || !Array.isArray(c.specialMemo) || c.specialMemo.length === 0) {
            return c.updatedAt;
        }
        const sortedMemos = [...c.specialMemo].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        return sortedMemos[0]?.createdAt || c.updatedAt;
    };

    const sortedCases = [...filteredCases].map((c, index) => ({ ...c, _originalIndex: index })).sort((a, b) => {
        if (sortOrder === 'inboundPath_asc') {
            return String(a.inboundPath || '').localeCompare(String(b.inboundPath || ''));
        }

        // [Fix] Force 'isNew' items to the top if sorting by newest registration
        if (sortOrder === 'createdAt_desc') {
            if (a.isNew && !b.isNew) return -1;
            if (!a.isNew && b.isNew) return 1;
            // If both are New, fallback to standard date sort below (and then index)
        }

        const [key, direction] = sortOrder.split('_');
        let dateA, dateB;

        if (key === 'lastConsultation') {
            dateA = new Date(getLastConsultationDate(a)).getTime();
            dateB = new Date(getLastConsultationDate(b)).getTime();
        } else if (key === 'updatedAt') {
            const dA = parseGenericDate(a.updatedAt);
            const dB = parseGenericDate(b.updatedAt);
            dateA = dA ? dA.getTime() : 0;
            dateB = dB ? dB.getTime() : 0;
        } else { // createdAt
            const dA = parseGenericDate(a.createdAt);
            const dB = parseGenericDate(b.createdAt);
            dateA = dA ? dA.getTime() : 0;
            dateB = dB ? dB.getTime() : 0;
        }

        // Standard Date Comparison
        if (dateA !== dateB) {
            if (direction === 'desc') {
                return dateB - dateA;
            } else {
                return dateA - dateB;
            }
        }

        // [Tie-Breaker] Use unique Case ID if dates are identical
        // [Fix] Respect sort direction for tie-breaker too
        if (direction === 'desc') {
            return String(b.caseId || '').localeCompare(String(a.caseId || ''));
        } else {
            return String(a.caseId || '').localeCompare(String(b.caseId || ''));
        }
    }).map(item => {
        const { _originalIndex, ...rest } = item;
        return rest as Case;
    });

    // Pagination Logic
    const totalItems = sortedCases.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentCases = sortedCases.slice(indexOfFirstItem, indexOfLastItem);

    const handlePageChange = (pageNumber: number) => {
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
            const container = document.getElementById('main-scroll-container');
            if (container) container.scrollTop = 0;
        }
    };

    // [Fix] Auto-clamp page if data shrinks (e.g. background update)
    useEffect(() => {
        if (totalPages > 0 && currentPage > totalPages) {
            // If we are on page 5 but now there are only 4 pages, go to page 4.
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    // [Fix] Only show loading if we have NO data (Zero Blink)
    if (loading && cases.length === 0) return <div className="p-8 text-center text-gray-500">불러오는 중...</div>;

    const newCaseCount = cases.filter(c => c.isNew).length;

    return (
        <div
            className="max-w-7xl mx-auto space-y-6"
            style={{
                opacity: isRestoring ? 0 : 1,
                transition: 'opacity 0.2s ease-in-out',
                pointerEvents: isRestoring ? 'none' : 'auto'
            }}
        >



            {newCaseCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-full">
                            <Sparkles className="text-red-600" size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-red-800">새로운 접수 건이 {newCaseCount}건 있습니다!</h3>
                            <p className="text-sm text-red-600">신규 등록된 케이스를 <br className="block md:hidden" />확인하고 상담을 진행해주세요.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setShowNewOnly(true);
                            setCurrentPage(1);
                        }}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm whitespace-nowrap md:whitespace-normal"
                    >
                        <span className="hidden md:inline">확인하기</span>
                        <span className="md:hidden flex flex-col items-center leading-tight">
                            <span>확인</span>
                            <span>하기</span>
                        </span>
                    </button>
                    {showNewOnly && (
                        <button
                            onClick={() => { setShowNewOnly(false); setCurrentPage(1); }}
                            className="absolute top-2 right-2 text-red-400 hover:text-red-600"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            )}

            {/* Manual Refresh Notification */}
            {updateAvailable && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-lg animate-fade-in shadow-sm cursor-pointer hover:bg-blue-100 transition-colors" onClick={handleManualRefresh}>
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-100 p-1.5 rounded-full">
                            <ArrowUpDown className="text-blue-600 animate-bounce" size={16} />
                        </div>
                        <span className="text-sm font-bold text-blue-800">
                            {newLeadsCount > 0
                                ? `🔄 새 접수 ${newLeadsCount}건 도착(눌러서 새로고침)`
                                : '새로운 데이터가 감지되었습니다. (눌러서 새로고침)'}
                        </span>
                    </div>
                    <button
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-sm transition-colors"
                    >
                        새로고침
                    </button>
                </div>
            )}

            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    케이스 관리
                    {showNewOnly && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200 cursor-pointer hover:bg-red-200" onClick={() => { setShowNewOnly(false); setCurrentPage(1); }}>
                            필터링됨: 신규 접수 건 <span className="ml-1 font-bold">×</span>
                        </span>
                    )}
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">총 {totalItems}건</span>
            </div>

            <div className="flex flex-col xl:flex-row justify-start items-start xl:items-center gap-2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                {/* [Row 1] Search + Mobile Upload Action */}
                <div className="flex w-full xl:w-auto gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="이름 또는 번호 검색"
                            className="pl-10 pr-4 py-2 border rounded-lg text-sm w-full xl:w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    {/* Cloud Upload Button (Mobile Only) */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            setIsImportModalOpen(true);
                        }}
                        className="xl:hidden flex items-center justify-center p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm shrink-0"
                    >
                        <Upload size={18} />
                    </button>
                </div>

                <div className="flex flex-wrap gap-1 w-full xl:w-auto items-center">
                    {/* Date Filter */}
                    <div className="flex items-center bg-gray-50 border rounded-lg p-1 dark:bg-gray-700 dark:border-gray-600">
                        <input
                            type="date"
                            className="bg-transparent text-sm p-1 outline-none text-gray-600 dark:text-white"
                            value={dateFilterStart}
                            onChange={(e) => { setDateFilterStart(e.target.value); setCurrentPage(1); }}
                        />
                        <span className="text-gray-400 mx-1">~</span>
                        <input
                            type="date"
                            className="bg-transparent text-sm p-1 outline-none text-gray-600 dark:text-white"
                            value={dateFilterEnd}
                            onChange={(e) => { setDateFilterEnd(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div className="relative flex-1 min-w-[100px]">
                        <Building className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                        <select
                            className="w-full border p-2 pl-8 rounded-lg text-sm bg-white appearance-none"
                            value={partnerFilter}
                            onChange={e => { setPartnerFilter(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="">전체 거래처</option>
                            {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                        </select>
                    </div>

                    <div className="relative flex-1 min-w-[100px]">
                        <Filter className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                        <select
                            className="w-full border p-2 pl-8 rounded-lg text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white appearance-none"
                            value={inboundPathFilter}
                            onChange={e => { setInboundPathFilter(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="">전체 유입경로</option>
                            {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    {/* [Row 4 Mobile] Status + Sort + Trash */}
                    <div className="flex w-full xl:w-auto gap-1">
                        <select
                            className="border p-2 rounded-lg text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white flex-1 min-w-[80px] text-ellipsis"
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="">전체 상태</option>
                            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>

                        <button
                            onClick={() => setIsVisibilityModalOpen(true)}
                            className="p-2 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
                            title="상태 보기 설정"
                        >
                            <Settings size={18} />
                        </button>

                        <div className="relative flex-1 min-w-[120px]">
                            <ArrowUpDown className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                            <select
                                className="w-full border p-2 pl-8 rounded-lg text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white appearance-none text-ellipsis"
                                value={sortOrder}
                                onChange={e => setSortOrder(e.target.value as any)}
                            >
                                <option value="createdAt_desc">최신 등록순</option>
                                <option value="createdAt_asc">오래된 등록순</option>
                                <option value="updatedAt_desc">최근 수정순</option>
                                <option value="updatedAt_asc">오래된 수정순</option>
                                <option value="lastConsultation_desc">최근 상담순</option>
                                <option value="lastConsultation_asc">오래된 상담순</option>
                                <option value="inboundPath_asc">유입경로별</option>
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                setIsImportModalOpen(true);
                            }}
                            className="hidden xl:flex items-center justify-center p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm shrink-0"
                        >
                            <Upload size={18} />
                        </button>

                        <button
                            onClick={() => setViewMode(prev => prev === 'active' ? 'trash' : 'active')}
                            className={`flex items-center justify-center p-2 rounded-lg transition-colors shadow-sm shrink-0 ${viewMode === 'trash'
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'bg-white border text-gray-600 hover:bg-gray-50'
                                }`}
                            title={viewMode === 'active' ? "휴지통 보기" : "목록으로 돌아가기"}
                        >
                            {viewMode === 'trash' ? <ChevronLeft size={18} /> : <Trash2 size={18} />}
                        </button>
                    </div>
                </div>

                {/* Recycle Bin Banner */}
                {viewMode === 'trash' && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-r-lg">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <Trash2 className="h-5 w-5 text-red-500" />
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700 font-bold">
                                    휴지통 모드입니다.
                                </p>
                                <p className="text-xs text-red-600 mt-1">
                                    삭제된 케이스는 30일 후 자동으로 완전히 삭제됩니다. 복구하거나 영구 삭제할 수 있습니다.
                                </p>
                            </div>
                        </div>
                    </div>
                )}


            </div>


            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => {
                    fetchCases().then(setCases); // Refresh list
                    setCurrentPage(1);
                }}
                partners={partners}
                inboundPaths={inboundPaths}
            />

            <StatusVisibilityModal
                isOpen={isVisibilityModalOpen}
                onClose={() => setIsVisibilityModalOpen(false)}
                allStatuses={statuses}
                hiddenStatuses={hiddenStatuses}
                onToggleStatus={toggleHiddenStatus}
            />


            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden min-h-[500px] flex flex-col">
                <div className="md:hidden flex-1">
                    {currentCases.map((c, index) => {
                        const partner = partners.find(p => p.partnerId === c.partnerId);
                        const warnings = getCaseWarnings(c, partner);
                        const nextReminder = getNextUpcomingReminder(c.reminders);

                        return (
                            <div key={`${c.caseId}_${index}`} className="p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 relative group">
                                <div className="absolute top-4 right-4 z-10">
                                    <button
                                        onClick={(e) => handleDelete(c.caseId, e)}
                                        className="text-gray-300 hover:text-red-500 p-2 bg-white dark:bg-gray-800 rounded-full border border-gray-100 dark:border-gray-700 shadow-sm transition-colors active:bg-gray-100 dark:active:bg-gray-700"
                                        title="삭제"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                                <div className="flex justify-between items-start pr-10">
                                    <div className="flex-1">
                                        <Link
                                            to={c.isNew ? `/new?leadId=${c.caseId}` : `/case/${c.caseId}`}
                                            className="font-bold text-gray-900 dark:text-white text-lg block flex items-center gap-2"
                                        >
                                            <span className="truncate max-w-[150px]" title={c.customerName}>
                                                {c.customerName}
                                            </span>
                                            {c.isNew && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pulse flex-shrink-0">NEW</span>}
                                        </Link >
                                        <div className="mt-1">
                                            <HoverCheckTooltip
                                                trigger={
                                                    <span className="text-xs text-blue-500 cursor-help border-b border-dashed border-blue-300">
                                                        최근 상담 내역 확인
                                                    </span>
                                                }
                                                content={
                                                    <div className="space-y-1">
                                                        <p className="font-bold text-gray-300 border-b border-gray-600 pb-1 mb-1">최근 상담 내역</p>
                                                        {c.specialMemo && Array.isArray(c.specialMemo) && c.specialMemo.filter(m => !m.content.startsWith('[상태변경]')).length > 0 ? (
                                                            c.specialMemo
                                                                .filter(m => !m.content.startsWith('[상태변경]'))
                                                                .slice(0, 2)
                                                                .map((m, i) => (
                                                                    <div key={i} className="mb-1 last:mb-0">
                                                                        <span className="text-[10px] text-gray-400 block">{m.createdAt.split('T')[0]}</span>
                                                                        <span className="block">{m.content}</span>
                                                                    </div>
                                                                ))
                                                        ) : (
                                                            <span className="text-gray-500 italic">상담 내역이 없습니다.</span>
                                                        )}
                                                    </div>
                                                }
                                            />
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{(c.jobTypes || []).join(', ')} / {c.region}</p>
                                        <div className="flex flex-wrap items-center gap-1 mt-1">
                                            <span className="text-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-1.5 py-0.5 rounded">{c.caseType || '-'}</span>
                                            <span className="text-[10px] bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded">{c.inboundPath || '-'}</span>
                                            <span className="text-[10px] bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded">{partner?.name || '-'}</span>
                                        </div>
                                    </div >
                                    <div className="flex flex-col items-end gap-1">
                                        <HoverCheckTooltip
                                            mobileAlign="right"
                                            trigger={
                                                <span className={`px-2 py-1 rounded text-xs font-semibold cursor-help ${c.status === '진행불가' || c.status === '고객취소'
                                                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                                    }`}>
                                                    {c.status}
                                                </span>
                                            }
                                            content={
                                                <StatusHistoryTooltipContent caseId={c.caseId} />
                                            }
                                        />
                                        <span className="text-[10px] text-gray-400">
                                            {safeFormat(c.createdAt, 'yy.MM.dd')}
                                        </span>
                                    </div>

                                    {/* Missed Call Button (Mobile) */}
                                    {c.status === missedCallStatus && (
                                        <div className="absolute top-16 right-4">
                                            <button
                                                onClick={(e) => handleMissedCall(e, c)}
                                                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm transition-all ${c.lastMissedCallAt && (new Date().getTime() - new Date(c.lastMissedCallAt).getTime()) > (missedCallInterval * 24 * 60 * 60 * 1000)
                                                    ? 'bg-red-100 border-red-200 text-red-600 animate-pulse ring-2 ring-red-400'
                                                    : 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50'
                                                    }`}
                                            >
                                                <PhoneMissed size={14} />
                                                <span>+{c.missedCallCount || 0}</span>
                                            </button>
                                            {c.lastMissedCallAt && <div className="text-[10px] text-gray-400 text-right mt-1">{safeFormat(c.lastMissedCallAt, 'MM.dd HH:mm')}</div>}
                                        </div>
                                    )}
                                </div >

                                <div className="mt-3 flex flex-wrap items-center justify-between gap-y-2">
                                    <a href={`tel:${c.phone}`} className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full">
                                        <Phone size={14} className="mr-1" /> {c.phone}
                                    </a>
                                    {nextReminder && <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">📞 {nextReminder.datetime.split(' ')[0]}</span>}
                                </div>

                                {
                                    warnings.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {warnings.map(w => (
                                                <span key={w} className="flex items-center text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded">
                                                    <AlertTriangle size={10} className="mr-1" /> {w}
                                                </span>
                                            ))}
                                        </div>
                                    )
                                }
                            </div >
                        );
                    })}
                </div >

                {/* Desktop View (Table) */}
                < div className="hidden md:block flex-1" >
                    <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300 table-fixed">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 uppercase font-medium text-xs">
                            <tr>
                                <th className="px-4 py-3 w-[15%]">유형/경로/거래처</th>
                                <th className="px-4 py-3 w-[12%]">고객명</th>
                                <th className="px-4 py-3 w-[13%]">연락처</th>
                                <th className="px-4 py-3 w-[10%]">상태</th>
                                <th className="px-4 py-3 w-[10%]">등록일</th>
                                <th className="px-4 py-3 w-[10%]">최종상담일</th>
                                <th className="px-4 py-3 w-[20%]">리마인더</th>
                                <th className="px-4 py-3 w-[10%] text-center">삭제</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentCases.map((c, index) => {
                                const partner = partners.find(p => p.partnerId === c.partnerId);
                                const warnings = getCaseWarnings(c, partner);
                                const lastConsultDate = getLastConsultationDate(c);
                                const nextReminder = getNextUpcomingReminder(c.reminders);

                                return (
                                    <tr key={`${c.caseId}_${index}`} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">{c.caseType}</span>
                                                <span className="text-[10px] text-gray-500 dark:text-gray-400">{c.inboundPath}</span>
                                                <span className="text-[10px] text-gray-400 dark:text-gray-500">{partner?.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link
                                                to={c.isNew ? `/new?leadId=${c.caseId}` : `/case/${c.caseId}`}
                                                className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                            >
                                                <span className="truncate max-w-[90px] inline-block align-bottom" title={c.customerName}>
                                                    {c.customerName}
                                                </span>
                                                {c.isNew && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pulse flex-shrink-0">NEW</span>}
                                            </Link>

                                            {/* Hover Tooltip for Quick Memo View */}
                                            <div className="ml-1 inline-block">
                                                <HoverCheckTooltip
                                                    trigger={
                                                        <MessageSquare size={14} className="text-gray-300 hover:text-blue-500 transition-colors" />
                                                    }
                                                    content={
                                                        <div className="space-y-2">
                                                            <p className="font-bold text-gray-300 border-b border-gray-600 pb-1">최근 상담 내역</p>
                                                            {c.specialMemo && Array.isArray(c.specialMemo) && c.specialMemo.filter(m => !m.content.startsWith('[상태변경]')).length > 0 ? (
                                                                c.specialMemo
                                                                    .filter(m => !m.content.startsWith('[상태변경]'))
                                                                    .slice(0, 3)
                                                                    .map((m, i) => (
                                                                        <div key={i} className="text-[11px] leading-relaxed">
                                                                            <span className="text-blue-300 mr-1">[{m.createdAt.split('T')[0]}]</span>
                                                                            {m.content}
                                                                        </div>
                                                                    ))
                                                            ) : (
                                                                <span className="text-gray-500 italic">내역 없음</span>
                                                            )}
                                                        </div>
                                                    }
                                                />
                                            </div>

                                            {warnings.length > 0 && <span className="ml-2 text-red-500 text-xs">⚠</span>}
                                        </td>
                                        <td className={`px-4 py-3 font-medium ${c.status === '진행불가' || c.status === '고객취소'
                                            ? 'text-red-600 dark:text-red-400'
                                            : ''
                                            }`}>{c.phone}</td>
                                        <td className="px-4 py-3">
                                            <HoverCheckTooltip
                                                trigger={
                                                    <span className={`px-2 py-1 rounded text-xs cursor-help ${STATUS_COLOR_MAP[c.status]
                                                        ? STATUS_COLOR_MAP[c.status].replace('bg-blue-50', 'bg-blue-100') // darkened for visibility 
                                                        : 'bg-gray-100 dark:bg-gray-700'
                                                        } ${c.status === '진행불가' || c.status === '고객취소' ? 'text-red-700 bg-red-100' : ''
                                                        }`}>
                                                        {c.status}
                                                    </span>
                                                }
                                                content={<StatusHistoryTooltipContent caseId={c.caseId} />}
                                            />
                                            {/* Missed Call Button (Desktop) - Appears next to status if missed */}
                                            {c.status === missedCallStatus && (
                                                <div className="mt-1 flex items-center gap-1">
                                                    <button
                                                        onClick={(e) => handleMissedCall(e, c)}
                                                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${c.lastMissedCallAt && (new Date().getTime() - new Date(c.lastMissedCallAt).getTime()) > (missedCallInterval * 24 * 60 * 60 * 1000)
                                                            ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
                                                            : 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50'
                                                            }`}
                                                        title={`마지막 부재: ${safeFormat(c.lastMissedCallAt, 'yyyy-MM-dd HH:mm', '없음')}`}
                                                    >
                                                        <PhoneMissed size={10} />
                                                        <span>+{c.missedCallCount || 0}</span>
                                                    </button>
                                                    <span className="text-[10px] text-gray-500 tracking-tight">
                                                        {safeFormat(c.lastMissedCallAt, 'MM.dd HH:mm')}
                                                    </span>
                                                </div>
                                            )}

                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {safeFormat(c.createdAt, 'yyyy-MM-dd')}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {safeFormat(lastConsultDate, 'yyyy-MM-dd')}
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {nextReminder ? (
                                                <>
                                                    <span>{nextReminder.datetime}</span>
                                                    {(c.reminders?.length || 0) > 1 && <span className="ml-1 text-gray-400">외 {(c.reminders?.length || 0) - 1}건</span>}
                                                </>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {viewMode === 'trash' ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={(e) => handleRestore(c.caseId, e)}
                                                        className="text-green-500 hover:text-green-700 p-1.5 rounded hover:bg-green-50"
                                                        title="복구"
                                                    >
                                                        <Sparkles size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDelete(c.caseId, e)}
                                                        className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50"
                                                        title="영구 삭제"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={(e) => handleDelete(c.caseId, e)}
                                                    className="text-gray-300 hover:text-red-500 p-2 rounded transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    title="삭제"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div >

                {
                    sortedCases.length === 0 && (
                        <div className="p-8 text-center text-gray-400 flex-1 flex items-center justify-center">검색 결과가 없습니다.</div>
                    )
                }

                {/* Pagination Footer */}
                {
                    totalPages > 0 && (
                        <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-sm font-medium text-gray-700">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                            <div className="hidden sm:flex gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                                    // Only show first, last, current, and surrounding pages
                                    (pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - currentPage) <= 1) ? (
                                        <button
                                            key={pageNum}
                                            onClick={() => handlePageChange(pageNum)}
                                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium border ${currentPage === pageNum ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                        >
                                            {pageNum}
                                        </button>
                                    ) : (pageNum === 2 && currentPage > 3) || (pageNum === totalPages - 1 && currentPage < totalPages - 2) ? (
                                        <span key={pageNum} className="w-8 h-8 flex items-center justify-center text-gray-400">...</span>
                                    ) : null
                                ))}
                            </div>
                        </div>
                    )
                }



            </div >
        </div >
    );
}
