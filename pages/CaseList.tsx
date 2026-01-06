
import React, { useEffect, useState } from 'react';
import { fetchCases, fetchPartners, fetchInboundPaths, deleteCase, fetchStatuses, GOOGLE_SCRIPT_URL, processIncomingCase, subscribe, refreshData } from '../services/api';
import { Case, Partner, ReminderItem, CaseStatus } from '../types';
import { getCaseWarnings, parseReminder, parseGenericDate } from '../utils';
import { Link } from 'react-router-dom';
import { Search, Phone, AlertTriangle, ArrowUpDown, ChevronLeft, ChevronRight, Filter, Trash2, Building, Upload, Sparkles, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../contexts/ToastContext';
import ImportModal from '../components/ImportModal';
import HoverCheckTooltip from '../components/HoverCheckTooltip';
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
    const [cases, setCases] = useState<Case[]>([]);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [inboundPaths, setInboundPaths] = useState<string[]>([]);
    const [statuses, setStatuses] = useState<CaseStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Filters & Sort
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [inboundPathFilter, setInboundPathFilter] = useState('');
    const [partnerFilter, setPartnerFilter] = useState('');
    const [dateFilterStart, setDateFilterStart] = useState('');
    const [dateFilterEnd, setDateFilterEnd] = useState('');
    const [sortOrder, setSortOrder] = useState<'createdAt_desc' | 'createdAt_asc' | 'lastConsultation_desc' | 'lastConsultation_asc' | 'inboundPath_asc'>('createdAt_desc');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;



    // [POLLING] Auto-refresh every 30 seconds
    useEffect(() => {
        let isMounted = true;
        const intervalId = setInterval(() => {
            if (document.visibilityState === 'visible') {
                refreshData(); // Trigger actual background fetch
            }
        }, 30000); // 30s

        const loadData = async (silent = false) => {
            try {
                if (!silent) setLoading(true);

                // Use Promise.all for parallel fetching
                const [data, partnerData, pathData, statusData] = await Promise.all([
                    fetchCases(),
                    fetchPartners(),
                    fetchInboundPaths(),
                    fetchStatuses()
                ]);

                if (isMounted) {
                    setCases(prev => {
                        // Toast for new arrivals
                        if (prev.length > 0 && data.length > prev.length) {
                            const diff = data.length - prev.length;
                            showToast(`${diff}건의 새로운 접수가 도착했습니다!`, 'success');
                        }
                        return data;
                    });

                    setPartners(partnerData);
                    setInboundPaths(pathData);
                    setStatuses(statusData);
                    if (!silent) setLoading(false);
                }
            } catch (err: any) {
                console.error(err);
                if (isMounted && !silent) {
                    setLoading(false);
                    showToast("데이터를 불러오는 중 오류가 발생했습니다.", 'error');
                }
            }
        };

        loadData(); // Initial load

        // Subscribe to API updates (SWR)
        const unsubscribe = subscribe(() => {
            if (isMounted) loadData(true);
        });

        return () => {
            isMounted = false;
            clearInterval(intervalId);
            unsubscribe();
        };
    }, [showToast]);



    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, statusFilter, inboundPathFilter, partnerFilter]);

    const handleDelete = async (caseId: string, e?: React.MouseEvent) => {
        // 이벤트 전파 방지 (카드 클릭 등으로 인한 페이지 이동 방지)
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }

        // 1차 경고
        if (!window.confirm('정말 이 케이스를 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.')) {
            return;
        }

        // 2차 경고
        if (!window.confirm('⚠️ [최종 경고] 정말로 삭제하시겠습니까? 이 작업은 절대 되돌릴 수 없습니다!')) {
            return;
        }

        try {
            // 삭제 실행
            await deleteCase(caseId);
            setCases(prev => prev.filter(c => c.caseId !== caseId));
            showToast('케이스가 영구적으로 삭제되었습니다.');
        } catch (error) {
            console.error("Delete failed", error);
            showToast('삭제 중 오류가 발생했습니다.', 'error');
        }
    };

    const filteredCases = cases.filter(c => {
        const matchesSearch = c.customerName.includes(search) || c.phone.includes(search);
        const matchesStatus = statusFilter === '' || c.status === statusFilter;
        const matchesPath = inboundPathFilter === '' || c.inboundPath === inboundPathFilter;
        const matchesPartner = partnerFilter === '' || c.partnerId === partnerFilter;

        // Date Filter
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

        return matchesSearch && matchesStatus && matchesPath && matchesPartner && matchesDate;
    });

    const getLastConsultationDate = (c: Case): string => {
        if (!c.specialMemo || c.specialMemo.length === 0) {
            return c.updatedAt;
        }
        const sortedMemos = [...c.specialMemo].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return sortedMemos[0].createdAt;
    };

    const sortedCases = [...filteredCases].map((c, index) => ({ ...c, _originalIndex: index })).sort((a, b) => {
        if (sortOrder === 'inboundPath_asc') {
            return (a.inboundPath || '').localeCompare(b.inboundPath || '');
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

        // [Tie-Breaker] Use original index if dates are identical
        // For 'desc' (Newest first), we want HIGHER index (later in list) to come FIRST.
        if (direction === 'desc') {
            return b._originalIndex - a._originalIndex;
        } else {
            return a._originalIndex - b._originalIndex;
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
            window.scrollTo(0, 0);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">불러오는 중...</div>;

    const newCaseCount = cases.filter(c => c.isNew).length;

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {newCaseCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-full">
                            <Sparkles className="text-red-600" size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-red-800">새로운 접수 건이 {newCaseCount}건 있습니다!</h3>
                            <p className="text-sm text-red-600">신규 등록된 케이스를 확인하고 상담을 진행해주세요.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            // Filter specifically for "new" cases (requires adding logic or just scrolling)
                            // For now, simpler: Scroll to top where "NEW" badges are visible
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                    >
                        확인하기
                    </button>
                </div>
            )}

            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">케이스 관리</h2>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">총 {totalItems}건</span>
            </div>

            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="relative w-full xl:w-auto">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="이름 또는 번호 검색"
                        className="pl-10 pr-4 py-2 border rounded-lg text-sm w-full xl:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
                    {/* Date Filter */}
                    <div className="flex items-center bg-gray-50 border rounded-lg p-1 dark:bg-gray-700 dark:border-gray-600">
                        <input
                            type="date"
                            className="bg-transparent text-sm p-1 outline-none text-gray-600 dark:text-white"
                            value={dateFilterStart}
                            onChange={(e) => setDateFilterStart(e.target.value)}
                        />
                        <span className="text-gray-400 mx-1">~</span>
                        <input
                            type="date"
                            className="bg-transparent text-sm p-1 outline-none text-gray-600 dark:text-white"
                            value={dateFilterEnd}
                            onChange={(e) => setDateFilterEnd(e.target.value)}
                        />
                    </div>
                    <div className="relative flex-1 min-w-[140px]">
                        <Building className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                        <select
                            className="w-full border p-2 pl-8 rounded-lg text-sm bg-white appearance-none"
                            value={partnerFilter}
                            onChange={e => setPartnerFilter(e.target.value)}
                        >
                            <option value="">전체 거래처</option>
                            {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                        </select>
                    </div>

                    <div className="relative flex-1 min-w-[140px]">
                        <Filter className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                        <select
                            className="w-full border p-2 pl-8 rounded-lg text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white appearance-none"
                            value={inboundPathFilter}
                            onChange={e => setInboundPathFilter(e.target.value)}
                        >
                            <option value="">전체 유입경로</option>
                            {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    <select
                        className="border p-2 rounded-lg text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white flex-1 min-w-[120px]"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="">전체 상태</option>
                        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <div className="relative flex-1 min-w-[180px]">
                        <select
                            className="w-full border p-2 rounded-lg text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white pl-8 appearance-none"
                            value={sortOrder}
                            onChange={e => setSortOrder(e.target.value as any)}
                        >
                            <option value="createdAt_desc">최신 등록순</option>
                            <option value="createdAt_asc">과거 등록순</option>
                            <option value="lastConsultation_desc">최종 상담일순 (최신)</option>
                            <option value="lastConsultation_asc">최종 상담일순 (과거)</option>
                            <option value="inboundPath_asc">유입경로순 (가나다)</option>
                        </select>
                        <ArrowUpDown className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                    </div>
                </div>

                <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                >
                    <Upload size={18} />
                    <span className="hidden sm:block text-xs leading-tight text-center">업로드<br />등록</span>
                </button>
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

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden min-h-[500px] flex flex-col">
                {/* Mobile View (Cards) */}
                <div className="md:hidden flex-1">
                    {currentCases.map(c => {
                        const partner = partners.find(p => p.partnerId === c.partnerId);
                        const warnings = getCaseWarnings(c, partner);
                        const nextReminder = getNextUpcomingReminder(c.reminders);

                        return (
                            <div key={c.caseId} className="p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 relative group">
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
                                            {c.customerName}
                                            {c.isNew && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">NEW</span>}
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
                                                        {c.specialMemo && c.specialMemo.filter(m => !m.content.startsWith('[상태변경]')).length > 0 ? (
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
                                            {c.createdAt ? format(new Date(c.createdAt), 'yy.MM.dd') : ''}
                                        </span>
                                    </div>
                                </div >

                                <div className="mt-3 flex items-center justify-between">
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
                    <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 uppercase font-medium text-xs">
                            <tr>
                                <th className="px-4 py-3">유형/경로/거래처</th>
                                <th className="px-4 py-3">고객명</th>
                                <th className="px-4 py-3">연락처</th>
                                <th className="px-4 py-3">상태</th>
                                <th className="px-4 py-3">등록일</th>
                                <th className="px-4 py-3">최종상담일</th>
                                <th className="px-4 py-3">리마인더</th>
                                <th className="px-4 py-3 text-center">삭제</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentCases.map(c => {
                                const partner = partners.find(p => p.partnerId === c.partnerId);
                                const warnings = getCaseWarnings(c, partner);
                                const lastConsultDate = getLastConsultationDate(c);
                                const nextReminder = getNextUpcomingReminder(c.reminders);

                                return (
                                    <tr key={c.caseId} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
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
                                                {c.customerName}
                                                {c.isNew && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">NEW</span>}
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
                                                            {c.specialMemo && c.specialMemo.filter(m => !m.content.startsWith('[상태변경]')).length > 0 ? (
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
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {c.createdAt ? format(new Date(c.createdAt), 'yyyy-MM-dd') : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {lastConsultDate ? format(new Date(lastConsultDate), 'yyyy-MM-dd') : '-'}
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
                                            <button
                                                onClick={(e) => handleDelete(c.caseId, e)}
                                                className="text-gray-300 hover:text-red-500 p-2 rounded transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                                                title="삭제"
                                            >
                                                <Trash2 size={16} />
                                            </button>
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



            </div>
        </div>
    );
}
