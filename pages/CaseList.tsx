import React, { useEffect, useState, useMemo, useLayoutEffect, useRef, useCallback, useDeferredValue } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchTeamMembers, assignCases, TeamMember } from '../services/team';
import { distributeCases } from '../services/distribution';
import { applyLocalAssignment } from '../services/api';
import { exportToExcel } from '../utils/xlsxExport';
import { parseReminder } from '../utils';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { ListSkeleton } from '../components/Skeleton';
import { KanbanBoard } from '../components/KanbanBoard';
import StatusVisibilityModal from '../components/StatusVisibilityModal';
import ImportModal from '../components/ImportModal';
import { parseGenericDate, isOverdueMissedCall, loadMissedCallTiers } from '../utils';
import { format } from 'date-fns';
import { Case, MissedCallIntervalTier } from '../types';

// React Query Hooks
import { useCases, usePartners, useInboundPaths, useStatuses, useSecondaryStatuses, useTertiaryStatuses, useUpdateCaseMutation, useDeleteCaseMutation } from '../services/queries';
import { restoreCase, refreshData } from '../services/api';
import { archiveCases, restoreArchivedCases } from '../services/leadLifecycle';
import { searchCommunicationLogsPhones } from '../services/supabase';
import { exportSpecialCases } from '../utils/xlsxExport';
import { CaseListHeader } from '../components/case-list/CaseListHeader';
import { CaseListFilter } from '../components/case-list/CaseListFilter';
import { CaseListTable } from '../components/case-list/CaseListTable';
import { CaseListPagination } from '../components/case-list/CaseListPagination';
import { ExportCaseModal } from '../components/case-list/ExportCaseModal';
import { ParalegalDecisionModal } from '../components/case-list/ParalegalDecisionModal';
import { Scale } from 'lucide-react';
import { CaseDetailDrawer } from '../components/case-list/CaseDetailDrawer';
import { useActiveCall } from '../contexts/ActiveCallContext';
import { QuickNewCaseModal } from '../components/case-list/QuickNewCaseModal';
import { FilterChipsBar } from '../components/case-list/FilterChipsBar';

export default function CaseList() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { confirm } = useConfirmDialog();

    // Data Fetching with React Query
    const { data: cases = [], isLoading: loadingCases, refetch: refetchCases } = useCases();
    const { data: partners = [] } = usePartners();
    const { data: inboundPaths = [] } = useInboundPaths();
    const { data: statuses = [] } = useStatuses();
    const { data: secondaryStatusesList = [] } = useSecondaryStatuses();
    const { data: tertiaryStatusesMap = {} } = useTertiaryStatuses();

    const updateCaseMutation = useUpdateCaseMutation();
    const deleteCaseMutation = useDeleteCaseMutation();

    // State
    const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'active' | 'archived' | 'trash'>('active');
    const [layoutMode, setLayoutMode] = useState<'list' | 'kanban'>('list');
    const [density, setDensity] = useState<'standard' | 'compact'>(() => {
        try {
            return (localStorage.getItem('lm_case_density') as 'standard' | 'compact') || 'standard';
        } catch {
            return 'standard';
        }
    });

    const toggleDensity = () => {
        setDensity(prev => {
            const next = prev === 'standard' ? 'compact' : 'standard';
            try { localStorage.setItem('lm_case_density', next); } catch {}
            return next;
        });
    };
    // [NEW] 우측 슬라이드 퀵 인스펙터 (Peek Drawer)
    const [drawerCase, setDrawerCase] = useState<Case | null>(null);
    const [paralegalTargetCase, setParalegalTargetCase] = useState<Case | null>(null);

    const handleParalegalDecision = async (updates: Partial<Case>, successMessage: string) => {
        if (!paralegalTargetCase) return;
        await updateCaseMutation.mutateAsync({
            id: paralegalTargetCase.caseId,
            updates
        });
        showToast(successMessage, 'success');
    };

    const { startCall } = useActiveCall();

    // [NEW] 이탈 사유 모달 (CaseList 빠른 상태 변경 시)
    const DROP_OFF_STATUSES = ['고객취소', '진행불가'];
    const DROP_OFF_REASONS = ['비용 부담', '타 사무소 선택', '연락 두절', '자격 미달', '본인 의사 취소', '시기 미정', '기타'];
    const [isDropOffModalOpen, setIsDropOffModalOpen] = useState(false);
    const [dropOffCaseId, setDropOffCaseId] = useState<string>('');
    const [dropOffNewStatus, setDropOffNewStatus] = useState<string>('');
    const [dropOffOldStatus, setDropOffOldStatus] = useState<string>('');
    const [dropOffReason, setDropOffReason] = useState<string>('');
    const [dropOffDetail, setDropOffDetail] = useState<string>('');

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
        const handleKeyDown = (e: KeyboardEvent) => {
            // Alt + N or Option + N 으로 빠른 등록 모달 열기
            if (e.altKey && (e.key === 'n' || e.key === 'N' || e.key === 'ㅜ')) {
                e.preventDefault();
                setIsNewCaseModalOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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
    const [missedCallIntervalTiers, setMissedCallIntervalTiers] = useState<MissedCallIntervalTier[]>(() => loadMissedCallTiers());

    // [FIX] Re-read settings from localStorage when page gains focus (e.g. after Settings page)
    useEffect(() => {
        const handleFocus = () => {
            setMissedCallStatus(localStorage.getItem('lm_missedStatus') || '부재');
            setMissedCallIntervalTiers(loadMissedCallTiers());
        };
        window.addEventListener('focus', handleFocus);
        // Also re-read on storage event (cross-tab sync)
        window.addEventListener('storage', handleFocus);
        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('storage', handleFocus);
        };
    }, []);

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
    const [showStarredOnly, setShowStarredOnly] = useState(() => sessionStorage.getItem('lm_showStarredOnly') === 'true');

    // [2026-11-01] 빠른 보기 (오늘 할 일 · 내 담당 · 미배정) + 담당자 필터 + 쪽 크기 + 여러 건 선택
    const { org, isAdmin } = useAuth();
    type QuickView = 'all' | 'today' | 'paralegal' | 'mine' | 'unassigned';
    const [quickView, setQuickView] = useState<QuickView>(() => {
        const saved = sessionStorage.getItem('lm_quickView') as QuickView;
        if (!isAdmin && (saved === 'mine' || saved === 'unassigned')) return 'all';
        return saved || 'all';
    });
    useEffect(() => {
        if (!isAdmin && (quickView === 'mine' || quickView === 'unassigned')) {
            setQuickView('all');
        }
    }, [isAdmin, quickView]);
    const [assigneeFilter, setAssigneeFilter] = useState(() => sessionStorage.getItem('lm_assigneeFilter') || '');
    const [pageSize, setPageSize] = useState<number>(() => Number(localStorage.getItem('lm_caselist_pagesize')) || 20);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkBusy, setBulkBusy] = useState(false);

    // [대표/총괄 관리자 선택형] 회사 전체 리드 목록 마스킹 정책 ('masked' vs 'unmasked')
    const [companyMaskingPolicy, setCompanyMaskingPolicy] = useState<'masked' | 'unmasked'>(() => {
        return (localStorage.getItem('lm_company_list_masking_policy') as 'masked' | 'unmasked') || 'masked';
    });

    const handleToggleCompanyMaskingPolicy = () => {
        const next = companyMaskingPolicy === 'masked' ? 'unmasked' : 'masked';
        setCompanyMaskingPolicy(next);
        localStorage.setItem('lm_company_list_masking_policy', next);
        window.dispatchEvent(new Event('storage'));
        showToast(next === 'masked'
            ? '회사 보안 정책: [대량 유출 방어 모드] 활성화 (일반 상담원 목록 번호 마스킹)'
            : '회사 보안 정책: [속도 우선 공개 모드] 활성화 (전체 상담원 목록 번호 공개)',
            next === 'masked' ? 'info' : 'success'
        );
    };
    useEffect(() => {
        if (!isAdmin || !org?.orgId) return;
        fetchTeamMembers().then(setMembers).catch(() => setMembers([]));
    }, [isAdmin, org?.orgId]);
    const memberName = useCallback((uid?: string) => (uid ? (members.find(m => m.userId === uid)?.displayName || '') : ''), [members]);
    const showAssignee = isAdmin && members.length > 1;

    // [NEW] Secondary/Tertiary Status Filters
    const [secondaryStatusFilter, setSecondaryStatusFilter] = useState(() => sessionStorage.getItem('lm_secondaryStatusFilter') || '');
    const [tertiaryStatusFilter, setTertiaryStatusFilter] = useState(() => sessionStorage.getItem('lm_tertiaryStatusFilter') || '');

    // [NEW] SMS Content Search
    const [matchingSmsPhones, setMatchingSmsPhones] = useState<string[]>([]);

    useEffect(() => {
        if (search.trim().length >= 2) {
            const timeoutId = setTimeout(async () => {
                const phones = await searchCommunicationLogsPhones(search.trim());
                setMatchingSmsPhones(phones);
            }, 500); // 500ms debounce
            return () => clearTimeout(timeoutId);
        } else {
            setMatchingSmsPhones([]);
        }
    }, [search]);

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
        sessionStorage.setItem('lm_showStarredOnly', String(showStarredOnly));
        sessionStorage.setItem('lm_viewMode', viewMode);
        sessionStorage.setItem('lm_secondaryStatusFilter', secondaryStatusFilter);
        sessionStorage.setItem('lm_tertiaryStatusFilter', tertiaryStatusFilter);
        sessionStorage.setItem('lm_quickView', quickView);
        sessionStorage.setItem('lm_assigneeFilter', assigneeFilter);
    }, [search, statusFilters, inboundPathFilter, partnerFilter, dateFilterStart, dateFilterEnd, sortOrder, showNewOnly, showOverdueMissedOnly, showStarredOnly, viewMode, secondaryStatusFilter, tertiaryStatusFilter, quickView, assigneeFilter]);
    useEffect(() => { localStorage.setItem('lm_caselist_pagesize', String(pageSize)); }, [pageSize]);

    // 오늘 할 일 = 오늘까지 잡힌 일정 중 처리 안 한 것
    const endOfToday = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); }, []);
    const hasDueReminder = useCallback((c: Case) => (c.reminders || []).some(r => {
        if (r.resultStatus || r.isCompleted) return false;
        const t = parseReminder(r.datetime)?.getTime();
        return t !== undefined && t <= endOfToday;
    }), [endOfToday]);

    // Pagination
    const [currentPage, setCurrentPage] = useState<number>(() => {
        const saved = sessionStorage.getItem('lm_caselist_page');
        return saved ? Number(saved) : 1;
    });

    useEffect(() => {
        sessionStorage.setItem('lm_caselist_page', String(currentPage));
    }, [currentPage]);
    const itemsPerPage = pageSize;
    // 글자를 칠 때마다 1,500건 메모를 다 뒤지지 않도록 검색은 한 박자 늦게 반영
    const deferredSearch = useDeferredValue(search);

    // Derived Logic (Filtering & Sorting)
    const filteredCases = useMemo(() => {
        const q = deferredSearch.trim().toLowerCase();
        const qDigits = q.replace(/[^0-9]/g, '');
        return cases.filter(c => {
            // 검색: 이름·번호·상담 메모·일정 내용·문자 내용
            const matchesSearch = !q ||
                String(c.customerName || '').toLowerCase().includes(q) ||
                String(c.phone || '').includes(q) ||
                (qDigits.length >= 4 && String(c.phone || '').replace(/[^0-9]/g, '').includes(qDigits)) ||
                (c.specialMemo || []).some(m => String(m.content || '').toLowerCase().includes(q)) ||
                (c.reminders || []).some(r => String(r.content || '').toLowerCase().includes(q)) ||
                matchingSmsPhones.includes(String(c.phone || '').replace(/[^0-9]/g, ''));

            // 상담원(agent)은 오직 본인 배정 리드만 열람 가능 (타 상담원 리드 접근 차단)
            if (!isAdmin && org?.userId) {
                const isMine = c.assignedUserId === org.userId || (org.displayName && c.managerName === org.displayName);
                if (!isMine) return false;
            }

            if (quickView === 'today' && !(hasDueReminder(c) || c.isNew || isOverdueMissedCall(c, missedCallStatus, missedCallIntervalTiers))) return false;
            if (quickView === 'paralegal' && c.status !== '사무장 접수') return false;
            if (quickView === 'mine' && c.assignedUserId !== org?.userId) return false;
            if (quickView === 'unassigned' && c.assignedUserId) return false;
            if (assigneeFilter) {
                if (assigneeFilter === '__none__' ? !!c.assignedUserId : c.assignedUserId !== assigneeFilter) return false;
            }

            const isHiddenGlobally = hiddenStatuses.includes(c.status);
            const matchesStatus = statusFilters.length === 0
                ? !isHiddenGlobally
                : statusFilters.includes(c.status);
            const matchesPath = inboundPathFilter === '' || c.inboundPath === inboundPathFilter;
            const matchesPartner = partnerFilter === '' || c.partnerId === partnerFilter;
            const matchesNew = showNewOnly ? c.isNew : true;

            const isDeleted = c.status === '휴지통' || !!c.deletedAt;
            const isArchived = !isDeleted && !!c.isArchived;

            // 상담원(agent)은 보관함 DB를 아예 볼 수 없음 (완전 은닉)
            if (!isAdmin && isArchived) return false;

            if (viewMode === 'active') {
                if (isDeleted || isArchived) return false;
            } else if (viewMode === 'archived') {
                if (isDeleted || !isArchived) return false;
            } else if (viewMode === 'trash') {
                if (!isDeleted) return false;
            }

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
                const isOverdueMissed = isOverdueMissedCall(c, missedCallStatus, missedCallIntervalTiers);
                if (!isOverdueMissed) return false;
            }

            // [NEW] Starred filter
            if (showStarredOnly && !c.isStarred) return false;

            // [NEW] 2차/3차 상태 필터 (사무장 접수 또는 사무장 큐 탭 선택 시)
            let matchesSecondary = true;
            let matchesTertiary = true;
            if ((quickView === 'paralegal' || statusFilters.includes('사무장 접수')) && c.status === '사무장 접수') {
                if (secondaryStatusFilter === '__none__') {
                    matchesSecondary = !c.secondaryStatus;
                } else if (secondaryStatusFilter === '__in_progress__') {
                    matchesSecondary = !!c.secondaryStatus && c.secondaryStatus !== '연락안받음';
                } else if (secondaryStatusFilter) {
                    matchesSecondary = c.secondaryStatus === secondaryStatusFilter;
                }
                if (tertiaryStatusFilter && matchesSecondary) {
                    matchesTertiary = c.tertiaryStatus === tertiaryStatusFilter;
                }
            }

            return matchesSearch && matchesStatus && matchesPath && matchesPartner && matchesDate && matchesNew && matchesSecondary && matchesTertiary;
        });
    }, [cases, deferredSearch, hiddenStatuses, statusFilters, inboundPathFilter, partnerFilter, showNewOnly, viewMode, dateFilterStart, dateFilterEnd, showOverdueMissedOnly, showStarredOnly, missedCallStatus, missedCallIntervalTiers, secondaryStatusFilter, tertiaryStatusFilter, matchingSmsPhones, quickView, assigneeFilter, org?.userId, hasDueReminder]);

    // 필터가 바뀌면 선택 해제
    useEffect(() => { setSelected(new Set()); }, [deferredSearch, statusFilters, inboundPathFilter, partnerFilter, quickView, assigneeFilter, viewMode, showNewOnly, showOverdueMissedOnly, showStarredOnly]);

    // 빠른 보기 숫자 (휴지통 제외, 상담원은 본인 배정 건만 집계)
    const viewCounts = useMemo(() => {
        let live = cases.filter(c => c.status !== '휴지통' && !c.deletedAt && !c.isArchived);
        if (!isAdmin && org?.userId) {
            live = live.filter(c => c.assignedUserId === org.userId || (org.displayName && c.managerName === org.displayName));
        }
        return {
            all: live.length,
            today: live.filter(c => hasDueReminder(c) || c.isNew || isOverdueMissedCall(c, missedCallStatus, missedCallIntervalTiers)).length,
            paralegal: live.filter(c => c.status === '사무장 접수').length,
            mine: org?.userId ? live.filter(c => c.assignedUserId === org.userId).length : 0,
            unassigned: live.filter(c => !c.assignedUserId).length,
        };
    }, [cases, hasDueReminder, missedCallStatus, missedCallIntervalTiers, org?.userId, org?.displayName, isAdmin]);

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

            if (sortOrder === 'isStarred_desc') {
                if (a.isStarred && !b.isStarred) return -1;
                if (!a.isStarred && b.isStarred) return 1;
            }

            if (sortOrder === 'createdAt_desc') {
                if (a.isNew && !b.isNew) return -1;
                if (!a.isNew && b.isNew) return 1;
            }

            const [key, direction] = sortOrder.split('_');
            let dateA, dateB;

            const getLastConsultationDate = (c: Case) => {
                if (!c.specialMemo || !Array.isArray(c.specialMemo) || c.specialMemo.length === 0) return c.updatedAt;
                const sortedMemos = [...c.specialMemo].sort((m1, m2) => String(m2.createdAt || (m2 as any).datetime || '').localeCompare(String(m1.createdAt || (m1 as any).datetime || '')));
                return sortedMemos[0]?.createdAt || (sortedMemos[0] as any)?.datetime || c.updatedAt;
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

    // 퀵 인스펙터 (Peek Drawer) 내비게이션 및 빠른 액션
    const drawerIndex = drawerCase ? sortedCases.findIndex(c => c.caseId === drawerCase.caseId) : -1;
    const hasPrevDrawer = drawerIndex > 0;
    const hasNextDrawer = drawerIndex >= 0 && drawerIndex < sortedCases.length - 1;
    const handlePrevDrawer = () => {
        if (hasPrevDrawer) setDrawerCase(sortedCases[drawerIndex - 1]);
    };
    const handleNextDrawer = () => {
        if (hasNextDrawer) setDrawerCase(sortedCases[drawerIndex + 1]);
    };
    const handleDrawerDial = (target: Case) => {
        const clean = String(target.phone || '').replace(/[^0-9]/g, '');
        if (!clean) {
            showToast('전화번호가 없습니다.', 'error');
            return;
        }
        startCall(clean, target.customerName, target.caseId);
        try {
            if (typeof (window as any).AndroidBridge?.makeCall === 'function') {
                (window as any).AndroidBridge.makeCall(clean, target.caseId);
            } else if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                window.location.href = 'tel:' + clean;
            }
        } catch (e) {
            console.warn(e);
        }
    };
    const handleDrawerAddMemo = async (caseId: string, memoContent: string) => {
        const target = cases.find(c => c.caseId === caseId);
        if (!target) return;
        const newMemo = {
            id: 'memo_' + Date.now(),
            createdAt: new Date().toISOString(),
            content: memoContent,
        };
        const updatedMemos = [...(target.specialMemo || []), newMemo];
        await updateCaseMutation.mutateAsync({
            id: caseId,
            updates: { specialMemo: updatedMemos },
        });
        showToast('상담 메모가 저장되었습니다.', 'success');
        setDrawerCase(prev => prev && prev.caseId === caseId ? { ...prev, specialMemo: updatedMemos } : prev);
    };

    // Auto-clamp page
    useEffect(() => {
        if (totalPages > 0 && currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    // Swipe Gesture for Page Navigation (Mobile)
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const swipeHandled = useRef(false);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        swipeHandled.current = false;
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current || swipeHandled.current) return;
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;
        const elapsed = Date.now() - touchStartRef.current.time;

        // Minimum 50px horizontal, must be more horizontal than vertical, within 500ms
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && elapsed < 500) {
            swipeHandled.current = true;
            if (deltaX < 0 && currentPage < totalPages) {
                // Swipe left → next page
                setCurrentPage(prev => prev + 1);
                document.getElementById('main-scroll-container')?.scrollTo({ top: 0, behavior: 'instant' });
            } else if (deltaX > 0 && currentPage > 1) {
                // Swipe right → previous page
                setCurrentPage(prev => prev - 1);
                document.getElementById('main-scroll-container')?.scrollTo({ top: 0, behavior: 'instant' });
            }
        }
        touchStartRef.current = null;
    }, [currentPage, totalPages]);


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
        if (viewMode === 'active' || viewMode === 'archived') {
            const ok = await confirm({
                title: '휴지통 이동',
                message: '해당 리드를 휴지통으로 이동하시겠습니까?',
                confirmText: '이동',
                cancelText: '취소',
                variant: 'danger',
            });
            if (!ok) return;
            // Soft delete
            // [Fix] Don't set deletedAt to ensure it remains visible to RLS-restricted queries
            updateCaseMutation.mutate({ id: caseId, updates: { status: '휴지통' } });
        } else {
            const ok = await confirm({
                title: '영구 삭제 경고',
                message: '해당 리드를 영구 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.',
                confirmText: '영구 삭제',
                cancelText: '취소',
                variant: 'danger',
            });
            if (!ok) return;
            deleteCaseMutation.mutate(caseId);
        }
    };

    const handleRestore = async (caseId: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (viewMode === 'archived') {
            const ok = await confirm({
                title: '활성 리드 복원',
                message: '활성 리드로 복원하시겠습니까?\n(상담원에게 다시 공개됩니다)',
                confirmText: '복원',
                cancelText: '취소',
                variant: 'default',
            });
            if (!ok) return;
            try {
                await restoreArchivedCases([caseId]);
                refetchCases();
                showToast('활성 리드로 복원되었습니다.');
            } catch (e: any) {
                showToast(e.message || '복원 실패', 'error');
            }
        } else {
            const ok = await confirm({
                title: '리드 복구',
                message: '휴지통에서 복구하시겠습니까?',
                confirmText: '복구',
                cancelText: '취소',
                variant: 'default',
            });
            if (!ok) return;
            try {
                await restoreCase(caseId);
                refetchCases();
                showToast('복구되었습니다.');
            } catch (e) {
                showToast('복구 실패', 'error');
            }
        }
    };

    const handleArchive = async (caseId: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const ok = await confirm({
            title: '보관함 이동',
            message: '보관함으로 이동하시겠습니까?\n(상담원 화면에서 숨김 처리됩니다)',
            confirmText: '보관함 이동',
            cancelText: '취소',
            variant: 'default',
        });
        if (!ok) return;
        try {
            await archiveCases([caseId], '수동 개별 보관');
            refetchCases();
            showToast('보관함으로 이동되었습니다. (상담원 숨김)');
        } catch (e: any) {
            showToast(e.message || '보관함 이동 실패', 'error');
        }
    };

    const bulkArchive = async () => {
        const ids: string[] = Array.from(selected);
        if (ids.length === 0) return;
        const ok = await confirm({
            title: '선택 리드 일괄 보관',
            message: `${ids.length}건을 보관함으로 이동하시겠습니까?\n(상담원 화면에서 즉시 숨김 처리됩니다)`,
            confirmText: '보관함 이동',
            cancelText: '취소',
            variant: 'default',
        });
        if (!ok) return;
        setBulkBusy(true);
        try {
            const count = await archiveCases(ids, '수동 일괄 보관');
            refetchCases();
            showToast(`${count}건을 보관함으로 이동했습니다. (상담원 숨김)`);
            setSelected(new Set());
        } catch (e: any) {
            showToast(e.message || '보관함 이동 실패', 'error');
        } finally {
            setBulkBusy(false);
        }
    };

    const bulkRestoreFromArchive = async () => {
        const ids: string[] = Array.from(selected);
        if (ids.length === 0) return;
        const ok = await confirm({
            title: '선택 리드 활성 복원',
            message: `${ids.length}건을 활성 리드로 복원하시겠습니까?\n(상담원 화면에 다시 공개됩니다)`,
            confirmText: '복원',
            cancelText: '취소',
            variant: 'default',
        });
        if (!ok) return;
        setBulkBusy(true);
        try {
            const count = await restoreArchivedCases(ids);
            refetchCases();
            showToast(`${count}건을 활성 리드로 복원했습니다.`);
            setSelected(new Set());
        } catch (e: any) {
            showToast(e.message || '복원 실패', 'error');
        } finally {
            setBulkBusy(false);
        }
    };

    const handleToggleStar = async (caseId: string, currentStarred: boolean) => {
        updateCaseMutation.mutate({
            id: caseId,
            updates: {
                isStarred: !currentStarred
            }
        });
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
        // [NEW] 고객취소/진행불가 시 이탈 사유 모달 표시
        if (DROP_OFF_STATUSES.includes(newStatus)) {
            setDropOffCaseId(caseId);
            setDropOffNewStatus(newStatus);
            setDropOffOldStatus(oldStatus);
            setDropOffReason('');
            setDropOffDetail('');
            setIsDropOffModalOpen(true);
            return;
        }

        const now = new Date().toISOString();
        const updates: Partial<Case> = {
            status: newStatus,
            statusUpdatedAt: now,
        };

        if (newStatus === missedCallStatus) {
            const targetCase = cases.find(c => c.caseId === caseId);
            const existingCount = targetCase?.missedCallCount || 0;
            updates.missedCallCount = existingCount > 0 ? existingCount : 1;
            updates.lastMissedCallAt = targetCase?.lastMissedCallAt || now;
        }

        // 상태 변경 기록도 남긴다 (예전엔 목록에서 바꾸면 기록이 없었다)
        const target = cases.find(c => c.caseId === caseId);
        updates.statusLogs = [{ logId: Date.now().toString(), caseId, fromStatus: oldStatus, toStatus: newStatus, changedAt: now, changedBy: localStorage.getItem('managerName') || '상담원', memo: '목록에서 변경' }, ...(target?.statusLogs || [])];

        updateCaseMutation.mutate({ id: caseId, updates, silent: true });
        showToast(`상태가 "${newStatus}"(으)로 변경되었습니다.`);
    };

    // [NEW] 이탈 사유 모달 확인 핸들러
    const confirmDropOffStatusChange = () => {
        if (!dropOffReason) {
            showToast('이탈 사유를 선택해주세요.', 'error');
            return;
        }
        const now = new Date().toISOString();
        const log = {
            logId: Date.now().toString(),
            fromStatus: dropOffOldStatus,
            toStatus: dropOffNewStatus,
            changedAt: now,
            changedBy: localStorage.getItem('managerName') || '상담원',
            memo: `[이탈사유: ${dropOffReason}] ${dropOffDetail}`.trim()
        };
        const targetCase = cases.find(c => c.caseId === dropOffCaseId);
        updateCaseMutation.mutate({
            id: dropOffCaseId,
            updates: {
                status: dropOffNewStatus,
                statusUpdatedAt: now,
                statusLogs: [log, ...(targetCase?.statusLogs || [])],
                dropOffReason: dropOffReason,
                dropOffDetail: dropOffDetail || undefined,
            }
        });
        showToast(`상태가 "${dropOffNewStatus}"(으)로 변경되었습니다.`);
        setIsDropOffModalOpen(false);
    };

    // ---- 여러 건 선택 ----
    const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleSelectAll = (ids: string[], on: boolean) => setSelected(prev => { const n = new Set(prev); ids.forEach(id => on ? n.add(id) : n.delete(id)); return n; });
    const selectedCases = () => cases.filter(c => selected.has(c.caseId));

    const bulkStatus = async (newStatus: string) => {
        const list = selectedCases().filter(c => c.status !== newStatus);
        if (list.length === 0) return;
        const ok = await confirm({
            title: '선택 리드 일괄 상태 변경',
            message: `${list.length}건의 상태를 "${newStatus}"(으)로 바꿀까요?`,
            confirmText: '변경',
            cancelText: '취소',
            variant: 'default',
        });
        if (!ok) return;
        const now = new Date().toISOString();
        const who = localStorage.getItem('managerName') || '상담원';
        list.forEach(c => updateCaseMutation.mutate({
            id: c.caseId, silent: true,
            updates: {
                status: newStatus, statusUpdatedAt: now,
                statusLogs: [{ logId: `${Date.now()}_${c.caseId}`, caseId: c.caseId, fromStatus: c.status, toStatus: newStatus, changedAt: now, changedBy: who, memo: '목록에서 여러 건 변경' }, ...(c.statusLogs || [])],
            },
        }));
        showToast(`${list.length}건의 상태를 "${newStatus}"(으)로 바꿨습니다.`);
        setSelected(new Set());
    };

    const bulkTrash = async () => {
        const list = selectedCases();
        if (list.length === 0) return;
        const ok = await confirm({
            title: '선택 리드 휴지통 이동',
            message: `${list.length}건을 휴지통으로 옮길까요?`,
            confirmText: '휴지통 이동',
            cancelText: '취소',
            variant: 'danger',
        });
        if (!ok) return;
        list.forEach(c => updateCaseMutation.mutate({ id: c.caseId, updates: { status: '휴지통' }, silent: true }));
        showToast(`${list.length}건을 휴지통으로 옮겼습니다.`);
        setSelected(new Set());
    };

    const bulkAssign = async (uid: string) => {
        const ids: string[] = [];
        selected.forEach(v => ids.push(v));
        if (ids.length === 0) return;
        const target = uid === '__none__' ? null : uid;
        setBulkBusy(true);
        try {
            const n = await assignCases(ids, target);
            applyLocalAssignment(ids, target);
            refetchCases();
            showToast(target ? `${memberName(target)}님에게 ${n}건 배정했습니다.` : `${n}건 배정을 풀었습니다.`);
            setSelected(new Set());
        } catch (e: any) {
            showToast(`배정하지 못했습니다: ${e.message}`, 'error');
        } finally { setBulkBusy(false); }
    };

    // [다담세일즈형] 선택한 리드 활성 상담원 전원에게 균등 순번 배분
    const bulkDistributeEvenly = async () => {
        const ids: string[] = [];
        selected.forEach(v => ids.push(v));
        if (ids.length === 0) return;

        const activeAgents = members.filter(m => m.status === 'active');
        if (activeAgents.length === 0) {
            showToast('리드를 배분할 활성 상담원이 없습니다.', 'error');
            return;
        }

        const ok = await confirm({
            title: '선택 리드 균등 순번 배분',
            message: `선택한 리드 ${ids.length}건을 활성 상담원 ${activeAgents.length}명에게 균등 순번 배분하시겠습니까?`,
            confirmText: '균등 배분 실행',
            cancelText: '취소',
            variant: 'default',
        });
        if (!ok) return;

        setBulkBusy(true);
        try {
            const res = await distributeCases(ids, 'round_robin', activeAgents.map(a => a.userId), undefined, '리드 목록에서 일괄 균등 배분');
            refetchCases();
            const breakdown = Object.entries(res)
                .map(([uid, cnt]) => `${memberName(uid)}: ${cnt}건`)
                .join(', ');
            showToast(`선택 리드 ${ids.length}건이 균등 배분되었습니다. (${breakdown})`, 'success');
            setSelected(new Set());
        } catch (e: any) {
            showToast(`균등 배분 실패: ${e.message}`, 'error');
        } finally {
            setBulkBusy(false);
        }
    };

    // [015] 내보내기는 회사 관리자만 (버튼도 관리자에게만 보임). 접근 기록은 exportToExcel이 남긴다
    const bulkExport = () => {
        if (!isAdmin) { showToast('데이터 내보내기는 관리자만 가능합니다.', 'error'); return; }
        const list = selectedCases();
        if (list.length === 0) return;
        exportToExcel(`리드_${list.length}건_${format(new Date(), 'yyyyMMdd')}`, list.map(c => ({
            '이름': c.customerName, '연락처': c.phone, '상태': c.status, '2차 상태': c.secondaryStatus || '',
            '사건 유형': c.caseType || '', '유입경로': c.inboundPath || '', '거래처': partners.find(p => p.partnerId === c.partnerId)?.name || '',
            '담당': memberName(c.assignedUserId), '등록일': safeDate(c.createdAt),
        })));
    };
    const safeDate = (iso?: string) => { const d = parseGenericDate(iso); return d ? format(d, 'yyyy-MM-dd HH:mm') : ''; };

    if (loadingCases && cases.length === 0) return <ListSkeleton />;

    const newCaseCount = cases.filter(c => c.isNew).length;
    const overdueMissedCallCount = cases.filter(c => {
        return isOverdueMissedCall(c, missedCallStatus, missedCallIntervalTiers);
    }).length;

    return (
        <div className="max-w-[1600px] mx-auto space-y-3 md:space-y-6">
            <CaseListHeader
                totalItems={totalItems}
                currentPage={currentPage}
                totalPages={totalPages}
                newCaseCount={newCaseCount}
                showNewOnly={showNewOnly}
                setShowNewOnly={setShowNewOnly}
                overdueMissedCallCount={overdueMissedCallCount}
                showOverdueMissedOnly={showOverdueMissedOnly}
                setShowOverdueMissedOnly={setShowOverdueMissedOnly}
                missedCallIntervalTiers={missedCallIntervalTiers}
                updateAvailable={false}
                newLeadsCount={0}
                onManualRefresh={async () => {
                    await refreshData();
                    refetchCases();
                }}
                onResetPage={() => setCurrentPage(1)}
                onExportClick={() => { if (isAdmin) setIsExportModalOpen(true); else showToast('데이터 내보내기는 관리자만 가능합니다.', 'error'); }}
                canExport={isAdmin}
                onOpenNewCaseModal={() => setIsNewCaseModalOpen(true)}
                density={density}
                onToggleDensity={toggleDensity}
                canImport={isAdmin}
                onOpenImportModal={isAdmin ? () => setIsImportModalOpen(true) : undefined}
                viewMode={viewMode}
                setViewMode={setViewMode}
                canManageArchive={isAdmin}
                companyMaskingPolicy={companyMaskingPolicy}
                onToggleCompanyMaskingPolicy={isAdmin ? handleToggleCompanyMaskingPolicy : undefined}
                onOpenStatusVisibilityModal={() => setIsVisibilityModalOpen(true)}
            />

            <CaseListFilter
                search={search} setSearch={setSearch}
                dateFilterStart={dateFilterStart} setDateFilterStart={setDateFilterStart}
                dateFilterEnd={dateFilterEnd} setDateFilterEnd={setDateFilterEnd}
                partnerFilter={partnerFilter} setPartnerFilter={setPartnerFilter}
                inboundPathFilter={inboundPathFilter} setInboundPathFilter={setInboundPathFilter}
                statusFilters={statusFilters} setStatusFilters={setStatusFilters}
                secondaryStatusFilter={secondaryStatusFilter} setSecondaryStatusFilter={setSecondaryStatusFilter}
                tertiaryStatusFilter={tertiaryStatusFilter} setTertiaryStatusFilter={setTertiaryStatusFilter}
                sortOrder={sortOrder} setSortOrder={setSortOrder}
                layoutMode={layoutMode} setLayoutMode={setLayoutMode}
                viewMode={viewMode} setViewMode={setViewMode} canManageArchive={isAdmin}
                showStarredOnly={showStarredOnly} setShowStarredOnly={setShowStarredOnly}
                partners={partners}
                inboundPaths={inboundPaths}
                statuses={statuses}
                secondaryStatuses={secondaryStatusesList}
                tertiaryStatuses={tertiaryStatusesMap}
                canImport={isAdmin}
                onOpenImportModal={isAdmin ? () => setIsImportModalOpen(true) : undefined}
                onOpenStatusVisibilityModal={() => setIsVisibilityModalOpen(true)}
                onResetPage={() => setCurrentPage(1)}
                companyMaskingPolicy={companyMaskingPolicy}
                onToggleCompanyMaskingPolicy={isAdmin ? handleToggleCompanyMaskingPolicy : undefined}
                assigneeFilter={assigneeFilter}
                setAssigneeFilter={setAssigneeFilter}
                members={members}
                showAssignee={showAssignee}
            />

            {/* Filter Chips Bar (Active Filters Visualization) */}
            <FilterChipsBar
                search={search}
                onClearSearch={() => { setSearch(''); setCurrentPage(1); }}
                statusFilters={statusFilters}
                onRemoveStatusFilter={(s) => {
                    setStatusFilters(prev => prev.filter(x => x !== s));
                    setCurrentPage(1);
                }}
                partnerFilter={partnerFilter}
                onClearPartnerFilter={() => { setPartnerFilter(''); setCurrentPage(1); }}
                partners={partners}
                inboundPathFilter={inboundPathFilter}
                onClearInboundPathFilter={() => { setInboundPathFilter(''); setCurrentPage(1); }}
                dateFilterStart={dateFilterStart}
                dateFilterEnd={dateFilterEnd}
                onClearDateFilter={() => { setDateFilterStart(''); setDateFilterEnd(''); setCurrentPage(1); }}
                showStarredOnly={showStarredOnly}
                onToggleStarred={() => { setShowStarredOnly(false); setCurrentPage(1); }}
                showNewOnly={showNewOnly}
                onToggleNewOnly={() => { setShowNewOnly(false); setCurrentPage(1); }}
                showOverdueMissedOnly={showOverdueMissedOnly}
                onToggleOverdueMissedOnly={() => { setShowOverdueMissedOnly(false); setCurrentPage(1); }}
                assigneeFilter={assigneeFilter}
                onClearAssigneeFilter={() => { setAssigneeFilter(''); setCurrentPage(1); }}
                assigneeName={memberName(assigneeFilter)}
                onResetAllFilters={() => {
                    setSearch('');
                    setStatusFilters([]);
                    setPartnerFilter('');
                    setInboundPathFilter('');
                    setDateFilterStart('');
                    setDateFilterEnd('');
                    setShowStarredOnly(false);
                    setShowNewOnly(false);
                    setShowOverdueMissedOnly(false);
                    setAssigneeFilter('');
                    setCurrentPage(1);
                }}
            />

            {/* 빠른 보기 + 담당자 */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-nowrap md:flex-wrap gap-1 p-1 rounded-xl bg-card border border-border shadow-2xs overflow-x-auto max-w-full">
                    {([
                        { k: 'all', label: '전체', n: viewCounts.all },
                        { k: 'today', label: '오늘 할 일', n: viewCounts.today, hint: '오늘까지 잡힌 일정 · 신규 · 다시 걸 부재' },
                        { k: 'paralegal', label: '🤝 사무장 인계 큐', n: viewCounts.paralegal, hint: '1차 상담 완료 후 사무장 심사 및 수임 판정 대기 사건' },
                        ...(isAdmin && org?.userId && viewCounts.mine > 0 ? [{ k: 'mine', label: '내 담당', n: viewCounts.mine }] : []),
                        ...(isAdmin ? [{ k: 'unassigned', label: '미배정', n: viewCounts.unassigned }] : []),
                    ] as { k: QuickView; label: string; n: number; hint?: string }[]).map(v => (
                        <button key={v.k} type="button" title={v.hint}
                            onClick={() => { setQuickView(v.k); setCurrentPage(1); }}
                            className={`h-8 px-2.5 md:px-3 rounded-lg text-xs flex items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap ${quickView === v.k ? 'bg-primary/10 text-primary font-semibold border border-primary/20' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                            {v.label}
                            <span className={`text-[11px] tabular-nums ${quickView === v.k ? 'text-primary font-bold' : 'text-muted-foreground'}`}>{v.n.toLocaleString()}</span>
                        </button>
                    ))}
                </div>
                {showAssignee && (
                    <select value={assigneeFilter} onChange={e => { setAssigneeFilter(e.target.value); setCurrentPage(1); }}
                        className="hidden md:block h-10 px-3 rounded-xl border border-border bg-card text-xs text-foreground shadow-2xs" aria-label="담당자">
                        <option value="">모든 담당자</option>
                        <option value="__none__">미배정</option>
                        {members.filter(m => m.status === 'active').map(m => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}
                    </select>
                )}
            </div>

            {/* 여러 건 선택했을 때 */}
            {selected.size > 0 && (
                <div className="sticky top-2 z-30 flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border text-foreground shadow-lg">
                    <span className="text-xs font-bold tabular-nums text-foreground">{selected.size}건 선택</span>
                    <select defaultValue="" onChange={e => { const v = e.target.value; e.target.value = ''; if (v) bulkStatus(v); }}
                        className="h-8 px-2.5 rounded-lg bg-card text-xs text-foreground border border-border shadow-2xs" aria-label="상태 바꾸기">
                        <option value="" className="bg-card text-foreground">상태 바꾸기…</option>
                        {statuses.filter(s => s !== '휴지통' && !DROP_OFF_STATUSES.includes(s)).map(s => <option key={s} value={s} className="bg-card text-foreground">{s}</option>)}
                    </select>
                    {isAdmin && members.length > 0 && (
                        <>
                            <select defaultValue="" disabled={bulkBusy} onChange={e => { const v = e.target.value; e.target.value = ''; if (v) bulkAssign(v); }}
                                className="h-8 px-2.5 rounded-lg bg-card text-xs text-foreground border border-border shadow-2xs" aria-label="담당 배정">
                                <option value="" className="bg-card text-foreground">담당 배정…</option>
                                {members.filter(m => m.status === 'active').map(m => <option key={m.userId} value={m.userId} className="bg-card text-foreground">{m.displayName}</option>)}
                                <option value="__none__" className="bg-card text-foreground">배정 풀기</option>
                            </select>
                            <button
                                type="button"
                                onClick={bulkDistributeEvenly}
                                disabled={bulkBusy}
                                className="h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors"
                                title="선택한 리드를 활성 상담원들에게 균등하게 1건씩 순번 배분합니다"
                            >
                                👥 상담원 균등 나눠주기
                            </button>
                        </>
                    )}
                    {isAdmin && <button onClick={bulkExport} className="h-8 px-3 rounded-lg bg-card hover:bg-muted border border-border text-xs text-foreground font-medium shadow-2xs">엑셀로</button>}
                    {isAdmin && viewMode === 'active' && (
                        <button onClick={bulkArchive} disabled={bulkBusy} className="h-8 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-semibold shadow-2xs">
                            📦 선택 보관함 이동 (상담원 숨김)
                        </button>
                    )}
                    {isAdmin && viewMode === 'archived' && (
                        <>
                            <button onClick={bulkRestoreFromArchive} disabled={bulkBusy} className="h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold">
                                ✨ 활성 리드로 복원
                            </button>
                            <button onClick={bulkTrash} className="h-8 px-3 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold">
                                🗑 선택 휴지통으로
                            </button>
                        </>
                    )}
                    {viewMode === 'trash' && (
                        <button onClick={bulkTrash} className="h-8 px-3 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold">
                            🗑 선택 영구 삭제
                        </button>
                    )}
                    <button onClick={() => setSelected(new Set())} className="ml-auto h-8 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground">선택 해제</button>
                    <span className="w-full text-[11px] text-muted-foreground">고객취소·진행불가는 이탈 사유가 필요해 한 건씩 바꿉니다.</span>
                </div>
            )}

            <StatusVisibilityModal
                isOpen={isVisibilityModalOpen}
                onClose={() => setIsVisibilityModalOpen(false)}
                allStatuses={statuses}
                hiddenStatuses={hiddenStatuses}
                onToggleStatus={toggleHiddenStatus}
            />

            {/* 관리자 전용 대량 인입/업로드 모달 (상담원 비노출 & 렌더링 원천 차단) */}
            {isAdmin && isImportModalOpen && (
                <ImportModal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    onSuccess={() => { refetchCases(); setCurrentPage(1); }}
                    partners={partners}
                    inboundPaths={inboundPaths}
                />
            )}

            <QuickNewCaseModal
                isOpen={isNewCaseModalOpen}
                onClose={() => setIsNewCaseModalOpen(false)}
                onSuccess={() => {
                    refetchCases();
                    setCurrentPage(1);
                }}
            />

            {paralegalTargetCase && (
                <ParalegalDecisionModal
                    c={paralegalTargetCase}
                    isOpen={!!paralegalTargetCase}
                    partners={partners}
                    onClose={() => setParalegalTargetCase(null)}
                    onDecision={handleParalegalDecision}
                    secondaryStatuses={secondaryStatusesList}
                />
            )}
            <ExportCaseModal
                isOpen={isExportModalOpen && isAdmin}
                onClose={() => setIsExportModalOpen(false)}
                allCases={cases}
                currentListCases={filteredCases}
                statuses={statuses}
            />

            {/* 우측 슬라이드 퀵 인스펙터 (Peek Drawer) */}
            <CaseDetailDrawer
                c={drawerCase}
                isOpen={!!drawerCase}
                onClose={() => setDrawerCase(null)}
                onPrev={handlePrevDrawer}
                onNext={handleNextDrawer}
                hasPrev={hasPrevDrawer}
                hasNext={hasNextDrawer}
                partners={partners}
                statuses={statuses.filter(s => s !== '휴지통')}
                onStatusChange={(cid, nStatus, oStatus) => {
                    handleQuickStatusChange(cid, nStatus, oStatus);
                    setDrawerCase(prev => prev && prev.caseId === cid ? { ...prev, status: nStatus } : prev);
                }}
                onAddMemo={handleDrawerAddMemo}
                onDial={handleDrawerDial}
            />

            {layoutMode === 'kanban' ? (
                <KanbanBoard
                    // [2026-11-01] 예전엔 현재 쪽 10건만 칸반에 나왔다 → 필터 결과 전체
                    cases={sortedCases}
                    statuses={statuses.filter(s => s !== '휴지통')}
                    onUpdateStatus={(caseId, newStatus) => {
                        const old = cases.find(x => x.caseId === caseId)?.status || '';
                        handleQuickStatusChange(caseId, newStatus, old);
                    }}
                />
            ) : (
                <div
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {quickView === 'paralegal' && (
                        <div className="mb-4 bg-card rounded-xl p-4 sm:p-5 border border-border shadow-xs">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5 pb-3 border-b border-border">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                        <Scale size={16} strokeWidth={1.75} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm sm:text-base tracking-tight text-foreground flex items-center gap-2">
                                            <span>법무법인 전달 · 수임 대기 현황</span>
                                            <span className="px-2 py-0.5 rounded-full text-[11px] bg-primary/10 text-primary border border-primary/20 font-semibold">
                                                전환율 극대화
                                            </span>
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            1차 상담원이 7대 문진을 마친 사건들입니다. [사무장 심사] 버튼을 눌러 수임 계약 체결, 서류 보완 요청, 또는 기각 판정을 처리하세요.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {(() => {
                                const pCases = cases.filter(c => c.status === '사무장 접수' && !c.deletedAt && !c.isArchived);
                                const newCount = pCases.filter(c => !c.secondaryStatus).length;
                                const inProgressCount = pCases.filter(c => c.secondaryStatus && c.secondaryStatus !== '연락안받음').length;
                                const missedCount = pCases.filter(c => c.secondaryStatus === '연락안받음').length;
                                const contractedCount = cases.filter(c => c.status === '계약 완료' && !c.deletedAt && !c.isArchived).length;

                                return (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setSecondaryStatusFilter(prev => prev === '__none__' ? '' : '__none__')}
                                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                                secondaryStatusFilter === '__none__'
                                                    ? 'bg-primary/10 border-primary text-foreground shadow-xs'
                                                    : 'bg-muted/30 hover:bg-muted border-border text-foreground'
                                            } flex items-center justify-between`}
                                        >
                                            <div>
                                                <span className="text-xs text-muted-foreground font-medium block">미확인 인계</span>
                                                <span className="text-lg font-bold font-mono tabular-nums text-foreground mt-0.5 block">{newCount}건</span>
                                            </div>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">NEW</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setSecondaryStatusFilter(prev => prev === '__in_progress__' ? '' : '__in_progress__')}
                                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                                secondaryStatusFilter === '__in_progress__'
                                                    ? 'bg-primary/10 border-primary text-foreground shadow-xs'
                                                    : 'bg-muted/30 hover:bg-muted border-border text-foreground'
                                            } flex items-center justify-between`}
                                        >
                                            <div>
                                                <span className="text-xs text-muted-foreground font-medium block">사무장 직접 진행</span>
                                                <span className="text-lg font-bold font-mono tabular-nums text-foreground mt-0.5 block">{inProgressCount}건</span>
                                            </div>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-primary/15 text-primary border border-primary/30">진행중</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setSecondaryStatusFilter(prev => prev === '연락안받음' ? '' : '연락안받음')}
                                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                                secondaryStatusFilter === '연락안받음'
                                                    ? 'bg-amber-500/10 border-amber-500/40 text-foreground shadow-xs'
                                                    : 'bg-muted/30 hover:bg-muted border-border text-foreground'
                                            } flex items-center justify-between`}
                                        >
                                            <div>
                                                <span className="text-xs text-muted-foreground font-medium block">연락안받음 (재시도)</span>
                                                <span className="text-lg font-bold font-mono tabular-nums text-foreground mt-0.5 block">{missedCount}건</span>
                                            </div>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">집중관리</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setQuickView('all');
                                                setStatusFilters(['계약 완료']);
                                                setSecondaryStatusFilter('');
                                            }}
                                            className="bg-muted/30 hover:bg-muted p-3 rounded-xl border border-border flex items-center justify-between text-left transition-all cursor-pointer"
                                        >
                                            <div>
                                                <span className="text-xs text-muted-foreground font-medium block">최종 수임 체결</span>
                                                <span className="text-lg font-bold font-mono tabular-nums text-foreground mt-0.5 block">{contractedCount}건</span>
                                            </div>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">계약완료</span>
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                    <CaseListTable
                        cases={currentCases}
                        partners={partners}
                        viewMode={viewMode}
                        missedCallStatus={missedCallStatus}
                        missedCallIntervalTiers={missedCallIntervalTiers}
                        statuses={statuses.filter(s => s !== '휴지통')}
                        onDelete={handleDelete}
                        onRestore={handleRestore}
                        onArchive={isAdmin ? handleArchive : undefined}
                        onMissedCall={handleMissedCall}
                        onStatusChange={handleQuickStatusChange}
                        onToggleStar={handleToggleStar}
                        onOpenDrawer={setDrawerCase}
                        onOpenParalegalModal={setParalegalTargetCase}
                        selectedIds={selected}
                        onToggleSelect={toggleSelect}
                        onToggleSelectAll={toggleSelectAll}
                        memberName={showAssignee ? memberName : undefined}
                        density={density}
                    />

                    <CaseListPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={pageSize}
                        onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                        onPageChange={(page) => {
                            setCurrentPage(page);
                            document.getElementById('main-scroll-container')?.scrollTo({ top: 0, behavior: 'instant' });
                        }}
                    />
                </div>
            )}

            {/* [NEW] 이탈 사유 모달 (빠른 상태 변경 시) */}
            {isDropOffModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-xl p-6 w-full max-w-[440px] shadow-xl text-card-foreground">
                        <h3 className="text-base font-semibold mb-3 text-destructive flex items-center gap-2">
                            <span>⚠ 상담 중단 확인</span>
                        </h3>
                        <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
                            상태를 <span className="font-semibold text-foreground underline">{dropOffOldStatus}</span>에서{' '}
                            <span className="font-semibold text-destructive underline">{dropOffNewStatus}</span>(으)로 변경하시겠습니까?
                        </p>
                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-foreground mb-2">
                                이탈 사유 <span className="text-destructive">*필수</span>
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {DROP_OFF_REASONS.map(reason => (
                                    <button
                                        key={reason}
                                        type="button"
                                        onClick={() => setDropOffReason(reason)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${dropOffReason === reason
                                                ? 'bg-destructive text-destructive-foreground border-destructive shadow-xs'
                                                : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border'
                                            }`}
                                    >
                                        {reason}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">상세 메모 (선택)</label>
                            <textarea
                                className="w-full p-2 border border-red-200 dark:border-red-900/50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400 rounded resize-none h-20 focus:ring-2 focus:ring-red-500 outline-none"
                                placeholder="추가 메모를 입력하세요..."
                                value={dropOffDetail}
                                onChange={e => setDropOffDetail(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setIsDropOffModalOpen(false)}
                                className="px-4 py-2 bg-card border border-border text-foreground hover:bg-muted rounded-lg text-xs font-semibold transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={confirmDropOffStatusChange}
                                className="px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg text-xs font-semibold transition-colors shadow-xs"
                            >
                                변경하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
