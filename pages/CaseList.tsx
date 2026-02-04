import React, { useEffect, useState, useMemo, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { ListSkeleton } from '../components/Skeleton';
import { KanbanBoard } from '../components/KanbanBoard';
import StatusVisibilityModal from '../components/StatusVisibilityModal';
import ImportModal from '../components/ImportModal';
import { parseGenericDate } from '../utils';
import { format } from 'date-fns';
import { Case } from '../types';

// React Query Hooks
import { useCases, usePartners, useInboundPaths, useStatuses, useUpdateCaseMutation, useDeleteCaseMutation } from '../services/queries';
import { restoreCase, updateCase, refreshData } from '../services/api'; // Keep specific API calls if hooks not ready or for specific logic

// New Components
import { CaseListHeader } from '../components/case-list/CaseListHeader';
import { CaseListFilter } from '../components/case-list/CaseListFilter';
import { CaseListTable } from '../components/case-list/CaseListTable';
import { CaseListPagination } from '../components/case-list/CaseListPagination';

export default function CaseList() {
    const navigate = useNavigate();
    const { showToast } = useToast();

    // Data Fetching with React Query
    const { data: cases = [], isLoading: loadingCases, refetch: refetchCases } = useCases();
    const { data: partners = [] } = usePartners();
    const { data: inboundPaths = [] } = useInboundPaths();
    const { data: statuses = [] } = useStatuses();

    const updateCaseMutation = useUpdateCaseMutation();
    const deleteCaseMutation = useDeleteCaseMutation();

    // State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
    const [layoutMode, setLayoutMode] = useState<'list' | 'kanban'>('list');

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
    const [missedCallStatus, setMissedCallStatus] = useState(() => localStorage.getItem('lm_missedStatus') || '부재');
    const [missedCallInterval, setMissedCallInterval] = useState(() => Number(localStorage.getItem('lm_missedInterval')) || 3);

    const [search, setSearch] = useState(() => sessionStorage.getItem('lm_search') || '');
    const [statusFilters, setStatusFilters] = useState<string[]>(() => {
        const stored = sessionStorage.getItem('lm_statusFilters');
        return stored ? JSON.parse(stored) : [];
    });
    const [inboundPathFilter, setInboundPathFilter] = useState(() => sessionStorage.getItem('lm_inboundPathFilter') || '');
    const [partnerFilter, setPartnerFilter] = useState(() => sessionStorage.getItem('lm_partnerFilter') || '');
    const [dateFilterStart, setDateFilterStart] = useState(() => sessionStorage.getItem('lm_dateFilterStart') || '');
    const [dateFilterEnd, setDateFilterEnd] = useState(() => sessionStorage.getItem('lm_dateFilterEnd') || '');
    const [sortOrder, setSortOrder] = useState<string>(
        () => sessionStorage.getItem('lm_sortOrder') || 'createdAt_desc'
    );
    const [showNewOnly, setShowNewOnly] = useState(() => sessionStorage.getItem('lm_showNewOnly') === 'true');
    const [showOverdueMissedOnly, setShowOverdueMissedOnly] = useState(() => sessionStorage.getItem('lm_showOverdueMissed') === 'true');

    // Persistence Effect
    useEffect(() => {
        sessionStorage.setItem('lm_search', search);
        sessionStorage.setItem('lm_statusFilters', JSON.stringify(statusFilters));
        sessionStorage.setItem('lm_inboundPathFilter', inboundPathFilter);
        sessionStorage.setItem('lm_partnerFilter', partnerFilter);
        sessionStorage.setItem('lm_dateFilterStart', dateFilterStart);
        sessionStorage.setItem('lm_dateFilterEnd', dateFilterEnd);
        sessionStorage.setItem('lm_sortOrder', sortOrder);
        sessionStorage.setItem('lm_showNewOnly', String(showNewOnly));
        sessionStorage.setItem('lm_showOverdueMissed', String(showOverdueMissedOnly));
        sessionStorage.setItem('lm_viewMode', viewMode);
    }, [search, statusFilters, inboundPathFilter, partnerFilter, dateFilterStart, dateFilterEnd, sortOrder, showNewOnly, showOverdueMissedOnly, viewMode]);

    // Pagination
    const [currentPage, setCurrentPage] = useState<number>(() => {
        const saved = sessionStorage.getItem('lm_caselist_page');
        return saved ? Number(saved) : 1;
    });

    useEffect(() => {
        sessionStorage.setItem('lm_caselist_page', String(currentPage));
    }, [currentPage]);
    const itemsPerPage = 10;

    // Derived Logic (Filtering & Sorting)
    const filteredCases = useMemo(() => {
        return cases.filter(c => {
            // Extended search: name, phone, consultation history (specialMemo), and reminders
            const searchLower = search.toLowerCase();
            const matchesSearch =
                String(c.customerName || '').toLowerCase().includes(searchLower) ||
                String(c.phone || '').includes(search) ||
                // 상담이력(메모) 검색
                (c.specialMemo || []).some(m => String(m.content || '').toLowerCase().includes(searchLower)) ||
                // 리마인더 검색
                (c.reminders || []).some(r => String(r.content || '').toLowerCase().includes(searchLower));

            const isHiddenGlobally = hiddenStatuses.includes(c.status);
            const matchesStatus = statusFilters.length === 0
                ? !isHiddenGlobally
                : statusFilters.includes(c.status);
            const matchesPath = inboundPathFilter === '' || c.inboundPath === inboundPathFilter;
            const matchesPartner = partnerFilter === '' || c.partnerId === partnerFilter;
            const matchesNew = showNewOnly ? c.isNew : true;

            const isDeleted = c.status === '휴지통' || !!c.deletedAt;
            if (viewMode === 'active' && isDeleted) return false;
            if (viewMode === 'trash' && !isDeleted) return false;

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

            if (showOverdueMissedOnly) {
                const now = new Date().getTime();
                const isOverdueMissed = c.status === missedCallStatus &&
                    c.lastMissedCallAt &&
                    (now - new Date(c.lastMissedCallAt).getTime()) > (missedCallInterval * 24 * 60 * 60 * 1000);
                if (!isOverdueMissed) return false;
            }

            return matchesSearch && matchesStatus && matchesPath && matchesPartner && matchesDate && matchesNew;
        });
    }, [cases, search, hiddenStatuses, statusFilters, inboundPathFilter, partnerFilter, showNewOnly, viewMode, dateFilterStart, dateFilterEnd, showOverdueMissedOnly, missedCallStatus, missedCallInterval]);

    const sortedCases = useMemo(() => {
        return [...filteredCases].sort((a, b) => {
            // Special sorting for overdue missed calls: sort by lastMissedCallAt ascending (oldest first)
            // This matches the mobile widget's sorting logic for consistency
            if (showOverdueMissedOnly) {
                const dateA = a.lastMissedCallAt ? new Date(a.lastMissedCallAt).getTime() : 0;
                const dateB = b.lastMissedCallAt ? new Date(b.lastMissedCallAt).getTime() : 0;
                if (dateA !== dateB) return dateA - dateB; // Ascending (oldest first)
                return String(a.caseId || '').localeCompare(String(b.caseId || ''));
            }

            if (sortOrder === 'inboundPath_asc') {
                return String(a.inboundPath || '').localeCompare(String(b.inboundPath || ''));
            }

            if (sortOrder === 'createdAt_desc') {
                if (a.isNew && !b.isNew) return -1;
                if (!a.isNew && b.isNew) return 1;
            }

            const [key, direction] = sortOrder.split('_');
            let dateA, dateB;

            const getLastConsultationDate = (c: Case) => {
                if (!c.specialMemo || !Array.isArray(c.specialMemo) || c.specialMemo.length === 0) return c.updatedAt;
                const sortedMemos = [...c.specialMemo].sort((m1, m2) => String(m2.createdAt || '').localeCompare(String(m1.createdAt || '')));
                return sortedMemos[0]?.createdAt || c.updatedAt;
            };

            if (key === 'lastConsultation') {
                dateA = new Date(getLastConsultationDate(a)).getTime();
                dateB = new Date(getLastConsultationDate(b)).getTime();
            } else if (key === 'updatedAt') {
                dateA = parseGenericDate(a.updatedAt)?.getTime() || 0;
                dateB = parseGenericDate(b.updatedAt)?.getTime() || 0;
            } else { // createdAt
                dateA = parseGenericDate(a.createdAt)?.getTime() || 0;
                dateB = parseGenericDate(b.createdAt)?.getTime() || 0;
            }

            if (dateA !== dateB) {
                return direction === 'desc' ? dateB - dateA : dateA - dateB;
            }

            return direction === 'desc'
                ? String(b.caseId || '').localeCompare(String(a.caseId || ''))
                : String(a.caseId || '').localeCompare(String(b.caseId || ''));
        });
    }, [filteredCases, sortOrder, showOverdueMissedOnly]);


    // Pagination Logic
    const totalItems = sortedCases.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentCases = sortedCases.slice(indexOfFirstItem, indexOfLastItem);

    // Auto-clamp page
    useEffect(() => {
        if (totalPages > 0 && currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);


    // Scroll Restoration (Simplified with React Query)
    useLayoutEffect(() => {
        const savedScrollTop = sessionStorage.getItem('lm_caselist_scrollTop');
        if (savedScrollTop && !loadingCases) {
            const container = document.getElementById('main-scroll-container');
            if (container) {
                container.scrollTop = Number(savedScrollTop);
            }
        }
    }, [loadingCases]);

    useEffect(() => {
        const handleScrollSave = () => {
            const container = document.getElementById('main-scroll-container');
            if (container) {
                sessionStorage.setItem('lm_caselist_scrollTop', container.scrollTop.toString());
            }
        };
        const container = document.getElementById('main-scroll-container');
        if (container) container.addEventListener('scroll', handleScrollSave);
        return () => container?.removeEventListener('scroll', handleScrollSave);
    }, []);


    // Handlers
    const handleUpdate = async (caseId: string, updates: Partial<Case>) => {
        updateCaseMutation.mutate({ id: caseId, updates });
    };

    const handleDelete = async (caseId: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (viewMode === 'active') {
            if (!window.confirm('휴지통으로 이동하시겠습니까?')) return;
            // Soft delete
            // [Fix] Don't set deletedAt to ensure it remains visible to RLS-restricted queries
            updateCaseMutation.mutate({ id: caseId, updates: { status: '휴지통' } });
        } else {
            if (!window.confirm('⚠️ 영구 삭제하시겠습니까?')) return;
            deleteCaseMutation.mutate(caseId);
        }
    };

    const handleRestore = async (caseId: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!window.confirm('복구하시겠습니까?')) return;
        try {
            await restoreCase(caseId);
            refetchCases();
            showToast('복구되었습니다.');
        } catch (e) {
            showToast('복구 실패', 'error');
        }
    };

    const handleMissedCall = async (e: React.MouseEvent, c: Case) => {
        e.preventDefault();
        e.stopPropagation();
        const now = new Date();
        const nextCount = (c.missedCallCount || 0) + 1;

        // Optimistic update handled by React Query not strictly necessary if fast enough, 
        // but we can just mutate.
        updateCaseMutation.mutate({
            id: c.caseId,
            updates: {
                missedCallCount: nextCount,
                lastMissedCallAt: now.toISOString(),
                // Log logic should ideally be server-side or in a proper service function, 
                // keeping it simple here for now.
            }
        });
    };

    // [NEW] Quick Status Change Handler - allows changing status directly from case list
    const handleQuickStatusChange = async (caseId: string, newStatus: string, oldStatus: string) => {
        const now = new Date().toISOString();
        const updates: Partial<Case> = {
            status: newStatus,
            statusUpdatedAt: now,
        };

        // When changing to "부재" status, automatically set missedCallCount to 1
        // and lastMissedCallAt to current time (since user already made a call that wasn't answered)
        if (newStatus === missedCallStatus) {
            updates.missedCallCount = 1;
            updates.lastMissedCallAt = now;
        }

        updateCaseMutation.mutate({ id: caseId, updates });
        showToast(`상태가 "${newStatus}"(으)로 변경되었습니다.`);
    };

    if (loadingCases && cases.length === 0) return <ListSkeleton />;

    const newCaseCount = cases.filter(c => c.isNew).length;
    const overdueMissedCallCount = cases.filter(c => {
        if (c.status !== missedCallStatus) return false;
        if (!c.lastMissedCallAt) return false;
        const now = new Date().getTime();
        return (now - new Date(c.lastMissedCallAt).getTime()) > (missedCallInterval * 24 * 60 * 60 * 1000);
    }).length;

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <CaseListHeader
                totalItems={totalItems}
                newCaseCount={newCaseCount}
                showNewOnly={showNewOnly}
                setShowNewOnly={setShowNewOnly}
                overdueMissedCallCount={overdueMissedCallCount}
                showOverdueMissedOnly={showOverdueMissedOnly}
                setShowOverdueMissedOnly={setShowOverdueMissedOnly}
                missedCallInterval={missedCallInterval}
                updateAvailable={false} // React Query handles auto-refetch, so manual banner is less critical. Removed for simplicity or can be re-added if using polling.
                newLeadsCount={0}
                onManualRefresh={async () => {
                    await refreshData();
                    refetchCases();
                }}
                onResetPage={() => setCurrentPage(1)}
            />

            <CaseListFilter
                search={search} setSearch={setSearch}
                dateFilterStart={dateFilterStart} setDateFilterStart={setDateFilterStart}
                dateFilterEnd={dateFilterEnd} setDateFilterEnd={setDateFilterEnd}
                partnerFilter={partnerFilter} setPartnerFilter={setPartnerFilter}
                inboundPathFilter={inboundPathFilter} setInboundPathFilter={setInboundPathFilter}
                statusFilters={statusFilters} setStatusFilters={setStatusFilters}
                sortOrder={sortOrder} setSortOrder={setSortOrder}
                layoutMode={layoutMode} setLayoutMode={setLayoutMode}
                viewMode={viewMode} setViewMode={setViewMode}
                partners={partners}
                inboundPaths={inboundPaths}
                statuses={statuses}
                onOpenImportModal={() => setIsImportModalOpen(true)}
                onOpenStatusVisibilityModal={() => setIsVisibilityModalOpen(true)}
                onResetPage={() => setCurrentPage(1)}
            />

            <StatusVisibilityModal
                isOpen={isVisibilityModalOpen}
                onClose={() => setIsVisibilityModalOpen(false)}
                allStatuses={statuses}
                hiddenStatuses={hiddenStatuses}
                onToggleStatus={toggleHiddenStatus}
            />

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => { refetchCases(); setCurrentPage(1); }}
                partners={partners}
                inboundPaths={inboundPaths}
            />

            {layoutMode === 'kanban' ? (
                <KanbanBoard
                    cases={currentCases} // Kanban typically shows all, but following existing logic
                    statuses={statuses.filter(s => s !== '휴지통')}
                    onUpdateStatus={(caseId, newStatus) => handleUpdate(caseId, { status: newStatus })}
                />
            ) : (
                <>
                    <CaseListTable
                        cases={currentCases}
                        partners={partners}
                        viewMode={viewMode}
                        missedCallStatus={missedCallStatus}
                        missedCallInterval={missedCallInterval}
                        statuses={statuses.filter(s => s !== '휴지통')}
                        onDelete={handleDelete}
                        onRestore={handleRestore}
                        onMissedCall={handleMissedCall}
                        onStatusChange={handleQuickStatusChange}
                    />

                    <CaseListPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={(page) => {
                            setCurrentPage(page);
                            document.getElementById('main-scroll-container')?.scrollTo({ top: 0, behavior: 'instant' });
                        }}
                    />
                </>
            )}
        </div>
    );
}
