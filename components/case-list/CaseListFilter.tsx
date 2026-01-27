import React from 'react';
import { Search, Upload, Building, Filter, ChevronDown, Check, Settings, ArrowUpDown, LayoutList, LayoutGrid, ChevronLeft, Trash2 } from 'lucide-react';
import { Partner, CaseStatus } from '../../types';

interface CaseListFilterProps {
    search: string;
    setSearch: (val: string) => void;
    dateFilterStart: string;
    setDateFilterStart: (val: string) => void;
    dateFilterEnd: string;
    setDateFilterEnd: (val: string) => void;
    partnerFilter: string;
    setPartnerFilter: (val: string) => void;
    inboundPathFilter: string;
    setInboundPathFilter: (val: string) => void;
    statusFilters: string[];
    setStatusFilters: (val: string[] | ((prev: string[]) => string[])) => void; // Support function update
    sortOrder: string;
    setSortOrder: (val: any) => void;
    layoutMode: 'list' | 'kanban';
    setLayoutMode: (val: 'list' | 'kanban') => void;
    viewMode: 'active' | 'trash';
    setViewMode: (val: 'active' | 'trash') => void;
    partners: Partner[];
    inboundPaths: string[];
    statuses: CaseStatus[];
    onOpenImportModal: () => void;
    onOpenStatusVisibilityModal: () => void;
    onResetPage: () => void;
}

export const CaseListFilter: React.FC<CaseListFilterProps> = ({
    search, setSearch,
    dateFilterStart, setDateFilterStart,
    dateFilterEnd, setDateFilterEnd,
    partnerFilter, setPartnerFilter,
    inboundPathFilter, setInboundPathFilter,
    statusFilters, setStatusFilters,
    sortOrder, setSortOrder,
    layoutMode, setLayoutMode,
    viewMode, setViewMode,
    partners, inboundPaths, statuses,
    onOpenImportModal, onOpenStatusVisibilityModal, onResetPage
}) => {
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = React.useState(false);

    // Helper to wrap setters with page reset
    const withReset = (setter: (val: any) => void) => (e: any) => {
        setter(e.target.value);
        onResetPage();
    };

    return (
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
                        onChange={withReset(setSearch)}
                    />
                </div>
                {/* Cloud Upload Button (Mobile Only) */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        onOpenImportModal();
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
                        onChange={withReset(setDateFilterStart)}
                    />
                    <span className="text-gray-400 mx-1">~</span>
                    <input
                        type="date"
                        className="bg-transparent text-sm p-1 outline-none text-gray-600 dark:text-white"
                        value={dateFilterEnd}
                        onChange={withReset(setDateFilterEnd)}
                    />
                </div>
                <div className="relative flex-1 min-w-[100px]">
                    <Building className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                    <select
                        className="w-full border p-2 pl-8 rounded-lg text-sm bg-white appearance-none"
                        value={partnerFilter}
                        onChange={withReset(setPartnerFilter)}
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
                        onChange={withReset(setInboundPathFilter)}
                    >
                        <option value="">전체 유입경로</option>
                        {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>

                {/* [Row 4 Mobile] Status + Sort + Trash - Refactored for better grouping */}
                <div className="flex flex-wrap w-full xl:w-auto gap-1">

                    {/* Group 1: Status & Settings */}
                    <div className="flex flex-1 xl:contents min-w-[200px] gap-1">
                        {/* Multi-Status Filter Dropdown */}
                        <div className="relative flex-1 min-w-[100px]">
                            <button
                                type="button"
                                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                                className="w-full border p-2 rounded-lg text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white text-left flex items-center justify-between"
                            >
                                <span className="truncate">
                                    {statusFilters.length === 0
                                        ? '전체 상태'
                                        : statusFilters.length === 1
                                            ? statusFilters[0]
                                            : `${statusFilters[0]} 외 ${statusFilters.length - 1}개`}
                                </span>
                                <ChevronDown size={16} className={`ml-1 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isStatusDropdownOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsStatusDropdownOpen(false)}
                                    />
                                    <div className="absolute top-full left-0 mt-1 w-full min-w-[160px] bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                                        <button
                                            type="button"
                                            onClick={() => { setStatusFilters([]); onResetPage(); }}
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 ${statusFilters.length === 0 ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : ''}`}
                                        >
                                            {statusFilters.length === 0 && <Check size={14} />}
                                            <span className={statusFilters.length === 0 ? 'font-medium' : ''}>전체 상태</span>
                                        </button>
                                        <div className="border-t dark:border-gray-600" />
                                        {statuses.map(s => (
                                            <button
                                                type="button"
                                                key={s}
                                                onClick={() => {
                                                    setStatusFilters(prev =>
                                                        prev.includes(s)
                                                            ? prev.filter(x => x !== s)
                                                            : [...prev, s]
                                                    );
                                                    onResetPage();
                                                }}
                                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 ${statusFilters.includes(s) ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : ''}`}
                                            >
                                                <div className={`w-4 h-4 border rounded flex items-center justify-center ${statusFilters.includes(s) ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'}`}>
                                                    {statusFilters.includes(s) && <Check size={12} />}
                                                </div>
                                                <span>{s}</span>
                                            </button>
                                        ))}
                                        {statusFilters.length > 0 && (
                                            <>
                                                <div className="border-t dark:border-gray-600" />
                                                <button
                                                    type="button"
                                                    onClick={() => { setStatusFilters([]); onResetPage(); setIsStatusDropdownOpen(false); }}
                                                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900"
                                                >
                                                    ✕ 필터 초기화
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            onClick={onOpenStatusVisibilityModal}
                            className="p-2 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
                            title="상태 보기 설정"
                        >
                            <Settings size={18} />
                        </button>
                    </div>

                    {/* Group 2: Sort, Actions, Trash */}
                    <div className="flex flex-1 xl:contents min-w-[200px] gap-1 mt-1 xl:mt-0">
                        <div className="relative flex-1 min-w-[120px]">
                            <ArrowUpDown className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                            <select
                                className="w-full border p-2 pl-8 rounded-lg text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white appearance-none text-ellipsis"
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
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
                                onOpenImportModal();
                            }}
                            className="hidden xl:flex items-center justify-center p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm shrink-0"
                        >
                            <Upload size={18} />
                        </button>

                        <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex items-center gap-1">
                            <button
                                onClick={() => setLayoutMode('list')}
                                className={`p-1.5 rounded-md transition-all ${layoutMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                                title="리스트 보기"
                            >
                                <LayoutList size={16} />
                            </button>
                            <button
                                onClick={() => setLayoutMode('kanban')}
                                className={`p-1.5 rounded-md transition-all ${layoutMode === 'kanban' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                                title="칸반 보드 보기"
                            >
                                <LayoutGrid size={16} />
                            </button>
                        </div>


                        <button
                            onClick={() => setViewMode(viewMode === 'active' ? 'trash' : 'active')}
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
    );
};
