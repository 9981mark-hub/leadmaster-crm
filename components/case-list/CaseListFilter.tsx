import React from 'react';
import { Search, Upload, Building, Filter, ChevronDown, Check, Settings, ArrowUpDown, LayoutList, LayoutGrid, ChevronLeft, Trash2, XCircle, Star, Archive, ShieldAlert, Eye } from 'lucide-react';
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
    setStatusFilters: (val: string[] | ((prev: string[]) => string[])) => void;
    secondaryStatusFilter: string;
    setSecondaryStatusFilter: (val: string) => void;
    tertiaryStatusFilter: string;
    setTertiaryStatusFilter: (val: string) => void;
    sortOrder: string;
    setSortOrder: (val: any) => void;
    layoutMode: 'list' | 'kanban';
    setLayoutMode: (val: 'list' | 'kanban') => void;
    viewMode: 'active' | 'archived' | 'trash';
    setViewMode: (val: 'active' | 'archived' | 'trash') => void;
    canManageArchive?: boolean;
    showStarredOnly: boolean;
    setShowStarredOnly: (val: boolean) => void;
    partners: Partner[];
    inboundPaths: string[];
    statuses: CaseStatus[];
    secondaryStatuses: string[];
    tertiaryStatuses: Record<string, string[]>;
    onOpenImportModal?: () => void; // 관리자 전용 대량 등록 모달 열기
    /** 대량 업로드 권한 여부 (관리자만 true). false이면 업로드 버튼 자체를 완전히 은닉 */
    canImport?: boolean;
    onOpenStatusVisibilityModal: () => void;
    onResetPage: () => void;
    /** 회사 전체 리드 목록 마스킹 정책 ('masked': 방어모드 / 'unmasked': 전체공개) */
    companyMaskingPolicy?: 'masked' | 'unmasked';
    onToggleCompanyMaskingPolicy?: () => void;
}

export const CaseListFilter: React.FC<CaseListFilterProps> = ({
    search, setSearch,
    dateFilterStart, setDateFilterStart,
    dateFilterEnd, setDateFilterEnd,
    partnerFilter, setPartnerFilter,
    inboundPathFilter, setInboundPathFilter,
    statusFilters, setStatusFilters,
    secondaryStatusFilter, setSecondaryStatusFilter,
    tertiaryStatusFilter, setTertiaryStatusFilter,
    sortOrder, setSortOrder,
    layoutMode, setLayoutMode,
    viewMode, setViewMode, canManageArchive = false,
    showStarredOnly, setShowStarredOnly,
    partners, inboundPaths, statuses,
    secondaryStatuses, tertiaryStatuses,
    onOpenImportModal, canImport = false, onOpenStatusVisibilityModal, onResetPage,
    companyMaskingPolicy = 'masked', onToggleCompanyMaskingPolicy
}) => {
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = React.useState(false);

    // Helper to wrap setters with page reset
    const withReset = (setter: (val: any) => void) => (e: any) => {
        setter(e.target.value);
        onResetPage();
    };

    return (
        <div className="flex flex-col xl:flex-row justify-start items-start xl:items-center gap-2 bg-white dark:bg-card p-2.5 rounded-[8px] shadow-2xs border border-[#d0d4e4] dark:border-border">
            {/* [Row 1] Search + Mobile Upload Action */}
            <div className="flex w-full xl:w-auto gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-[#676879] dark:text-muted-foreground" size={15} strokeWidth={1.75} />
                    <input
                        type="text"
                        placeholder="이름·번호·메모·문자 검색"
                        aria-label="검색"
                        className="pl-8 pr-8 py-1.5 border border-[#d0d4e4] dark:border-border rounded-[4px] text-xs w-full xl:w-60 focus:outline-none focus:ring-1 focus:ring-[#0073ea] bg-[#f6f7fb] dark:bg-card text-[#323338] dark:text-foreground placeholder:text-[#676879] dark:placeholder:text-muted-foreground"
                        value={search}
                        onChange={withReset(setSearch)}
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => { setSearch(''); onResetPage(); }}
                            className="absolute right-2.5 top-2 text-[#676879] hover:text-[#323338] dark:hover:text-foreground"
                        >
                            <XCircle size={15} strokeWidth={1.75} />
                        </button>
                    )}
                </div>
                {/* Star Filter Toggle */}
                <button
                    type="button"
                    onClick={() => { setShowStarredOnly(!showStarredOnly); onResetPage(); }}
                    className={`flex items-center justify-center p-1.5 border rounded-[4px] transition-all shadow-2xs shrink-0 ${showStarredOnly ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-white dark:bg-card border-[#d0d4e4] dark:border-border text-[#676879] dark:text-muted-foreground hover:bg-[#f6f7fb] dark:hover:bg-muted hover:text-[#323338] dark:hover:text-foreground'}`}
                    title="중요 표시된 항목만 보기"
                >
                    <Star size={16} strokeWidth={1.75} fill={showStarredOnly ? 'currentColor' : 'none'} />
                </button>
                {/* Cloud Upload Button (Mobile Only) */}
                {canImport && onOpenImportModal && <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        onOpenImportModal?.();
                    }}
                    className="xl:hidden flex items-center justify-center p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-2xs shrink-0"
                    title="케이스 대량/일괄 등록 (관리자 전용)"
                >
                    <Upload size={16} strokeWidth={1.75} />
                </button>}
            </div>

            <div className="flex flex-wrap gap-1.5 w-full xl:w-auto items-center">
                {/* Date Filter */}
                <div className="flex items-center bg-muted/40 border border-border rounded-lg p-1 text-xs">
                    <input
                        type="date"
                        className="bg-transparent text-xs p-1 outline-none text-foreground"
                        value={dateFilterStart}
                        onChange={withReset(setDateFilterStart)}
                    />
                    <span className="text-muted-foreground mx-1">~</span>
                    <input
                        type="date"
                        className="bg-transparent text-xs p-1 outline-none text-foreground"
                        value={dateFilterEnd}
                        onChange={withReset(setDateFilterEnd)}
                    />
                </div>
                <div className="relative flex-1 min-w-[100px]">
                    <Building className="absolute left-2.5 top-2.5 text-muted-foreground" size={14} strokeWidth={1.75} />
                    <select
                        className="w-full border border-border p-2 pl-7 rounded-lg text-xs bg-card text-foreground appearance-none shadow-2xs"
                        value={partnerFilter}
                        onChange={withReset(setPartnerFilter)}
                    >
                        <option value="">전체 거래처</option>
                        {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                    </select>
                </div>

                <div className="relative flex-1 min-w-[100px]">
                    <Filter className="absolute left-2.5 top-2.5 text-muted-foreground" size={14} strokeWidth={1.75} />
                    <select
                        className="w-full border border-border p-2 pl-7 rounded-lg text-xs bg-card text-foreground appearance-none shadow-2xs"
                        value={inboundPathFilter}
                        onChange={withReset(setInboundPathFilter)}
                    >
                        <option value="">전체 유입경로</option>
                        {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>

                {/* Status + Sort + Actions */}
                <div className="flex flex-wrap w-full xl:w-auto gap-1.5">

                    {/* Group 1: Status & Settings */}
                    <div className="flex flex-1 xl:contents min-w-[200px] gap-1.5">
                        {/* Multi-Status Filter Dropdown */}
                        <div className="relative flex-1 min-w-[100px]">
                            <button
                                type="button"
                                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                                className="w-full border border-border p-2 rounded-lg text-xs bg-card text-foreground text-left flex items-center justify-between shadow-2xs"
                            >
                                <span className="truncate">
                                    {statusFilters.length === 0
                                        ? '전체 상태'
                                        : statusFilters.length === 1
                                            ? statusFilters[0]
                                            : `${statusFilters[0]} 외 ${statusFilters.length - 1}개`}
                                </span>
                                <ChevronDown size={14} strokeWidth={1.75} className={`ml-1 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isStatusDropdownOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsStatusDropdownOpen(false)}
                                    />
                                    <div className="absolute top-full left-0 mt-1 w-full min-w-[160px] bg-card border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                                        <button
                                            type="button"
                                            onClick={() => { setStatusFilters([]); onResetPage(); }}
                                            className={`w-full px-3 py-2 text-left text-xs hover:bg-muted flex items-center gap-2 ${statusFilters.length === 0 ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                                        >
                                            {statusFilters.length === 0 && <Check size={12} strokeWidth={1.75} />}
                                            <span>전체 상태</span>
                                        </button>
                                        <div className="border-t border-border" />
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
                                                className={`w-full px-3 py-2 text-left text-xs hover:bg-muted flex items-center gap-2 ${statusFilters.includes(s) ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                                            >
                                                <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${statusFilters.includes(s) ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                                                    {statusFilters.includes(s) && <Check size={10} strokeWidth={2} />}
                                                </div>
                                                <span>{s}</span>
                                            </button>
                                        ))}
                                        {statusFilters.length > 0 && (
                                            <>
                                                <div className="border-t border-border" />
                                                <button
                                                    type="button"
                                                    onClick={() => { setStatusFilters([]); onResetPage(); setIsStatusDropdownOpen(false); }}
                                                    className="w-full px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
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
                            className="p-2 bg-card text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors shadow-2xs"
                            title="상태 보기 설정"
                        >
                            <Settings size={16} strokeWidth={1.75} />
                        </button>

                        {/* 2차/3차 상태 필터 */}
                        {statusFilters.includes('사무장 접수') && (
                            <>
                                <select
                                    className="border border-border p-2 rounded-lg text-xs bg-card text-foreground min-w-[100px] shadow-2xs"
                                    value={secondaryStatusFilter}
                                    onChange={(e) => { setSecondaryStatusFilter(e.target.value); setTertiaryStatusFilter(''); onResetPage(); }}
                                >
                                    <option value="">전체 2차</option>
                                    {secondaryStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                {secondaryStatusFilter && (tertiaryStatuses[secondaryStatusFilter] || []).length > 0 && (
                                    <select
                                        className="border border-border p-2 rounded-lg text-xs bg-card text-foreground min-w-[100px] shadow-2xs"
                                        value={tertiaryStatusFilter}
                                        onChange={(e) => { setTertiaryStatusFilter(e.target.value); onResetPage(); }}
                                    >
                                        <option value="">전체 3차</option>
                                        {(tertiaryStatuses[secondaryStatusFilter] || []).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                )}
                            </>
                        )}
                    </div>

                    {/* Group 2: Sort, Actions, Trash */}
                    <div className="flex flex-1 xl:contents min-w-[200px] gap-1.5 mt-1 xl:mt-0">
                        <div className="relative flex-1 min-w-[120px]">
                            <ArrowUpDown className="absolute left-2.5 top-2.5 text-muted-foreground" size={14} strokeWidth={1.75} />
                            <select
                                className="w-full border border-border p-2 pl-7 rounded-lg text-xs bg-card text-foreground appearance-none text-ellipsis shadow-2xs"
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                            >
                                <option value="createdAt_desc">최신 등록순</option>
                                <option value="createdAt_asc">오래된 등록순</option>
                                <option value="isStarred_desc">중요 표시순</option>
                                <option value="updatedAt_desc">최근 수정순</option>
                                <option value="updatedAt_asc">오래된 수정순</option>
                                <option value="lastConsultation_desc">최근 상담순</option>
                                <option value="lastConsultation_asc">오래된 상담순</option>
                                <option value="inboundPath_asc">유입경로별</option>
                            </select>
                        </div>

                        {/* 대량 업로드 버튼 */}
                        {canImport && onOpenImportModal && <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                onOpenImportModal();
                            }}
                            className="hidden xl:flex items-center justify-center p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-2xs shrink-0"
                            title="케이스 대량/일괄 등록 (관리자 전용)"
                        >
                            <Upload size={16} strokeWidth={1.75} />
                        </button>}

                        {/* Layout Toggle (List / Kanban) - monday.com 표준 4px 뷰 스위처 */}
                        <div className="bg-[#f6f7fb] dark:bg-muted p-0.5 rounded-[4px] border border-[#d0d4e4] dark:border-border flex items-center gap-0.5 shadow-2xs">
                            <button
                                onClick={() => setLayoutMode('list')}
                                className={`p-1.5 rounded-[3px] transition-all ${layoutMode === 'list' ? 'bg-white dark:bg-card shadow-2xs text-[#0073ea] font-semibold' : 'text-[#676879] dark:text-muted-foreground hover:text-[#323338] dark:hover:text-foreground'}`}
                                title="테이블(목록) 보기"
                            >
                                <LayoutList size={15} strokeWidth={1.75} />
                            </button>
                            <button
                                onClick={() => setLayoutMode('kanban')}
                                className={`p-1.5 rounded-[3px] transition-all ${layoutMode === 'kanban' ? 'bg-white dark:bg-card shadow-2xs text-[#0073ea] font-semibold' : 'text-[#676879] dark:text-muted-foreground hover:text-[#323338] dark:hover:text-foreground'}`}
                                title="칸반 보드 보기"
                            >
                                <LayoutGrid size={15} strokeWidth={1.75} />
                            </button>
                        </div>

                        {/* 리드 목록 대량 유출 방어(마스킹) 정책 선택 토글 */}
                        {onToggleCompanyMaskingPolicy && (
                            <button
                                type="button"
                                onClick={onToggleCompanyMaskingPolicy}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shadow-2xs shrink-0 font-medium text-xs border ${
                                    companyMaskingPolicy === 'masked'
                                        ? 'bg-card border-border text-foreground hover:bg-muted'
                                        : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/15'
                                }`}
                                title={companyMaskingPolicy === 'masked'
                                    ? "현재 [대량 유출 방어 모드] 활성 (일반 상담원 번호 마스킹). 클릭 시 회사 전체 공개(속도 우선 모드)로 전환합니다."
                                    : "현재 [속도 우선 공개 모드] 활성 (일반 상담원 번호 전체 노출). 클릭 시 대량 유출 방어 모드로 전환합니다."}
                            >
                                {companyMaskingPolicy === 'masked' ? <ShieldAlert size={14} strokeWidth={1.75} className="text-amber-500" /> : <Eye size={14} strokeWidth={1.75} className="text-primary" />}
                                <span>{companyMaskingPolicy === 'masked' ? '마스킹: 방어' : '마스킹: 해제'}</span>
                            </button>
                        )}

                        {/* 보관함 버튼 */}
                        {canManageArchive && (
                            <button
                                onClick={() => setViewMode(viewMode === 'archived' ? 'active' : 'archived')}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shadow-2xs shrink-0 font-medium text-xs border ${
                                    viewMode === 'archived'
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-card border-border text-foreground hover:bg-muted'
                                }`}
                                title={viewMode === 'archived' ? '활성 리드로 돌아가기' : '보관함 (상담원 숨김 DB 및 삭제 관리) 보기'}
                            >
                                {viewMode === 'archived' ? <ChevronLeft size={14} strokeWidth={1.75} /> : <Archive size={14} strokeWidth={1.75} />}
                                <span>{viewMode === 'archived' ? '활성 리드로' : '보관함'}</span>
                            </button>
                        )}

                        {/* 휴지통 버튼 */}
                        {viewMode !== 'active' && (
                            <button
                                onClick={() => setViewMode(viewMode === 'trash' ? 'archived' : 'trash')}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors shadow-2xs shrink-0 text-xs font-medium border ${
                                    viewMode === 'trash'
                                        ? 'bg-destructive text-destructive-foreground border-destructive'
                                        : 'bg-card border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                                }`}
                                title={viewMode === 'trash' ? "보관함으로 돌아가기" : "휴지통 보기"}
                            >
                                {viewMode === 'trash' ? <ChevronLeft size={14} strokeWidth={1.75} /> : <Trash2 size={14} strokeWidth={1.75} />}
                                <span>{viewMode === 'trash' ? '보관함으로' : '휴지통'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Archive Banner */}
            {viewMode === 'archived' && (
                <div className="bg-primary/10 border border-primary/20 p-4 mb-3 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 text-primary">
                            <Archive size={20} strokeWidth={1.75} />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-foreground font-semibold">
                                📦 보관함 모드 (상담원 시야에서 숨김 처리된 DB & 삭제 관리)
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                상담원에게는 노출되지 않는 데이터입니다. 목록 우측의 액션 버튼을 통해 안전하게 활성 리드로 복원하거나 휴지통으로 삭제할 수 있습니다.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode('trash')}
                            className="px-3 py-1.5 text-xs font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted flex items-center gap-1.5 shadow-2xs"
                        >
                            <Trash2 size={13} strokeWidth={1.75} className="text-destructive" />
                            <span>휴지통 보기</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Recycle Bin Banner */}
            {viewMode === 'trash' && (
                <div className="bg-destructive/10 border border-destructive/20 p-4 mb-3 rounded-xl flex items-center">
                    <div className="flex-shrink-0 text-destructive">
                        <Trash2 size={20} strokeWidth={1.75} />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-destructive font-semibold">
                            휴지통 모드입니다.
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            삭제된 케이스는 30일 후 자동으로 완전히 삭제됩니다. 복구하거나 영구 삭제할 수 있습니다.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
