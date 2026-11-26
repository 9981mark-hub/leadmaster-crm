import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Phone, X, ArrowUpDown, AlertTriangle, Zap, Plus, MoreHorizontal, Download, Upload, Archive, Trash2, ShieldAlert, Eye, Settings, ChevronLeft } from 'lucide-react';
import { MissedCallIntervalTier } from '../../types';
import { getSyncStatus } from '../../services/api';

interface CaseListHeaderProps {
    totalItems: number;
    currentPage: number;
    totalPages: number;
    newCaseCount: number;
    showNewOnly: boolean;
    setShowNewOnly: (show: boolean) => void;
    overdueMissedCallCount: number;
    showOverdueMissedOnly: boolean;
    setShowOverdueMissedOnly: (show: boolean) => void;
    missedCallIntervalTiers: MissedCallIntervalTier[];
    updateAvailable: boolean;
    newLeadsCount: number;
    onManualRefresh: () => void;
    onResetPage: () => void;
    onExportClick: () => void;
    /** 데이터 내보내기 버튼 표시 (회사 관리자만). 기본 false */
    canExport?: boolean;
    onOpenNewCaseModal?: () => void;
    density?: 'standard' | 'compact';
    onToggleDensity?: () => void;
    /** 모바일 더보기 메뉴용 추가 액션 */
    canImport?: boolean;
    onOpenImportModal?: () => void;
    viewMode?: 'active' | 'archived' | 'trash';
    setViewMode?: (val: 'active' | 'archived' | 'trash') => void;
    canManageArchive?: boolean;
    companyMaskingPolicy?: 'masked' | 'unmasked';
    onToggleCompanyMaskingPolicy?: () => void;
    onOpenStatusVisibilityModal?: () => void;
}

export const CaseListHeader: React.FC<CaseListHeaderProps> = ({
    totalItems,
    currentPage,
    totalPages,
    newCaseCount,
    showNewOnly,
    setShowNewOnly,
    overdueMissedCallCount,
    showOverdueMissedOnly,
    setShowOverdueMissedOnly,
    missedCallIntervalTiers,
    updateAvailable,
    newLeadsCount,
    onManualRefresh,
    onResetPage,
    onExportClick,
    canExport = false,
    onOpenNewCaseModal,
    density = 'standard',
    onToggleDensity,
    canImport = false,
    onOpenImportModal,
    viewMode = 'active',
    setViewMode,
    canManageArchive = false,
    companyMaskingPolicy = 'masked',
    onToggleCompanyMaskingPolicy,
    onOpenStatusVisibilityModal
}) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const mobileMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mobileMenuOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
                setMobileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [mobileMenuOpen]);

    const hasMobileMoreItems = canExport || (canImport && !!onOpenImportModal) || (canManageArchive && !!setViewMode) || !!onToggleCompanyMaskingPolicy || !!onOpenStatusVisibilityModal;

    return (
        <div className="space-y-4">
            {newCaseCount > 0 && (
                <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-xs animate-fade-in relative">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 border border-primary/20 p-2 rounded-lg text-primary">
                            <Sparkles size={18} strokeWidth={1.75} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm text-foreground">새로운 접수 건이 {newCaseCount}건 있습니다!</h3>
                            <p className="text-xs text-muted-foreground">신규 등록된 케이스를 확인하고 상담을 진행해주세요.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setShowNewOnly(true);
                            onResetPage();
                        }}
                        className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg transition-colors shadow-xs whitespace-nowrap"
                    >
                        확인하기
                    </button>
                    {showNewOnly && (
                        <button
                            onClick={() => { setShowNewOnly(false); onResetPage(); }}
                            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                        >
                            <X size={16} strokeWidth={1.75} />
                        </button>
                    )}
                </div>
            )}

            {overdueMissedCallCount > 0 && !showOverdueMissedOnly && (
                <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-xs animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg text-amber-600 dark:text-amber-400">
                            <Phone size={18} strokeWidth={1.75} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm text-foreground">재통화 필요 {overdueMissedCallCount}건</h3>
                            <p className="text-xs text-muted-foreground">구간별 알림 주기가 경과되었습니다.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setShowOverdueMissedOnly(true);
                            setShowNewOnly(false);
                            onResetPage();
                        }}
                        className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg transition-colors shadow-xs whitespace-nowrap"
                    >
                        확인하기
                    </button>
                </div>
            )}

            {updateAvailable && (
                <div className="flex items-center justify-between bg-primary/10 border border-primary/20 p-3.5 rounded-xl animate-fade-in shadow-xs cursor-pointer hover:bg-primary/15 transition-colors" onClick={onManualRefresh}>
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/20 p-1.5 rounded-md text-primary">
                            <ArrowUpDown size={15} strokeWidth={1.75} className="animate-bounce" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">
                            {newLeadsCount > 0
                                ? `새 접수 ${newLeadsCount}건 도착 (눌러서 새로고침)`
                                : '새로운 데이터가 감지되었습니다. (눌러서 새로고침)'}
                        </span>
                    </div>
                    <button className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg shadow-xs transition-colors">
                        새로고침
                    </button>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2.5 md:gap-3">
                <div className="flex items-center justify-between gap-2 w-full md:w-auto">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex flex-wrap items-center gap-2 min-w-0">
                        <span className="whitespace-nowrap">케이스 관리</span>
                        <span className="md:hidden text-xs text-muted-foreground font-medium whitespace-nowrap tabular-nums bg-muted px-2 py-0.5 rounded-full">
                            {totalItems.toLocaleString()}건
                        </span>
                        {showNewOnly && (
                            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-md border border-destructive/20 cursor-pointer hover:bg-destructive/20 whitespace-nowrap font-medium" onClick={() => { setShowNewOnly(false); onResetPage(); }}>
                                필터링됨: 신규 접수 건 <span className="ml-1 font-bold">×</span>
                            </span>
                        )}
                        {showOverdueMissedOnly && (
                            <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20 cursor-pointer hover:bg-amber-500/20 whitespace-nowrap font-medium" onClick={() => { setShowOverdueMissedOnly(false); onResetPage(); }}>
                                필터링됨: 재통화 필요 <span className="ml-1 font-bold">×</span>
                            </span>
                        )}
                    </h2>

                    {/* 모바일 전용 컴팩트 우측 액션 (+ 신규 / 간편 / 더보기) */}
                    <div className="flex md:hidden items-center gap-1.5 shrink-0">
                        {onOpenNewCaseModal && (
                            <button
                                type="button"
                                onClick={onOpenNewCaseModal}
                                className="flex items-center gap-1 h-8 px-2.5 bg-[#0073ea] hover:bg-[#0060c0] text-white text-xs font-semibold rounded-md shadow-2xs active:scale-[0.97] transition-all whitespace-nowrap cursor-pointer"
                                title="새 고객 케이스 빠른 등록"
                            >
                                <Plus size={14} strokeWidth={2.2} />
                                <span>신규</span>
                            </button>
                        )}
                        <Link
                            to="/lite"
                            className="flex items-center gap-1 h-8 px-2.5 bg-white dark:bg-card hover:bg-[#f6f7fb] dark:hover:bg-muted border border-[#d0d4e4] dark:border-border text-[#323338] dark:text-foreground text-xs font-medium rounded-md shadow-2xs active:scale-[0.97] transition-all whitespace-nowrap"
                            title="모바일 스마트폰 간편 콜 모드"
                        >
                            <Zap size={13} strokeWidth={1.75} className="text-amber-500" />
                            <span>간편</span>
                        </Link>
                        {hasMobileMoreItems && (
                            <div className="relative" ref={mobileMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setMobileMenuOpen(prev => !prev)}
                                    className="flex items-center justify-center w-8 h-8 bg-white dark:bg-card hover:bg-[#f6f7fb] dark:hover:bg-muted border border-[#d0d4e4] dark:border-border text-[#323338] dark:text-foreground rounded-md shadow-2xs active:scale-[0.97] transition-all cursor-pointer"
                                    aria-label="케이스 관리 더보기"
                                    title="더보기 메뉴"
                                >
                                    <MoreHorizontal size={16} strokeWidth={1.75} />
                                </button>
                                {mobileMenuOpen && (
                                    <div className="absolute right-0 top-full mt-1.5 w-52 bg-card border border-border rounded-xl shadow-lg z-50 py-1.5 text-xs">
                                        {canExport && (
                                            <button
                                                type="button"
                                                onClick={() => { setMobileMenuOpen(false); onExportClick(); }}
                                                className="w-full px-3.5 py-2.5 text-left text-foreground hover:bg-muted flex items-center gap-2.5"
                                            >
                                                <Download size={14} className="text-muted-foreground" />
                                                <span>데이터 내보내기 (Excel)</span>
                                            </button>
                                        )}
                                        {canImport && onOpenImportModal && (
                                            <button
                                                type="button"
                                                onClick={() => { setMobileMenuOpen(false); onOpenImportModal(); }}
                                                className="w-full px-3.5 py-2.5 text-left text-foreground hover:bg-muted flex items-center gap-2.5"
                                            >
                                                <Upload size={14} className="text-primary" />
                                                <span>케이스 대량 등록</span>
                                            </button>
                                        )}
                                        {canManageArchive && setViewMode && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => { setMobileMenuOpen(false); setViewMode(viewMode === 'archived' ? 'active' : 'archived'); }}
                                                    className={`w-full px-3.5 py-2.5 text-left hover:bg-muted flex items-center gap-2.5 ${viewMode === 'archived' ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}
                                                >
                                                    {viewMode === 'archived' ? <ChevronLeft size={14} /> : <Archive size={14} className="text-muted-foreground" />}
                                                    <span>{viewMode === 'archived' ? '활성 리드로 돌아가기' : '보관함 보기'}</span>
                                                </button>
                                                {viewMode !== 'active' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setMobileMenuOpen(false); setViewMode(viewMode === 'trash' ? 'archived' : 'trash'); }}
                                                        className={`w-full px-3.5 py-2.5 text-left hover:bg-muted flex items-center gap-2.5 ${viewMode === 'trash' ? 'text-destructive font-semibold bg-destructive/5' : 'text-foreground'}`}
                                                    >
                                                        {viewMode === 'trash' ? <ChevronLeft size={14} /> : <Trash2 size={14} className="text-destructive" />}
                                                        <span>{viewMode === 'trash' ? '보관함으로 돌아가기' : '휴지통 보기'}</span>
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {onToggleCompanyMaskingPolicy && (
                                            <button
                                                type="button"
                                                onClick={() => { setMobileMenuOpen(false); onToggleCompanyMaskingPolicy(); }}
                                                className="w-full px-3.5 py-2.5 text-left text-foreground hover:bg-muted flex items-center justify-between"
                                            >
                                                <span className="flex items-center gap-2.5">
                                                    {companyMaskingPolicy === 'masked'
                                                        ? <ShieldAlert size={14} className="text-amber-500" />
                                                        : <Eye size={14} className="text-primary" />}
                                                    <span>{companyMaskingPolicy === 'masked' ? '마스킹: 방어' : '마스킹: 해제'}</span>
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">전환</span>
                                            </button>
                                        )}
                                        {onOpenStatusVisibilityModal && (
                                            <button
                                                type="button"
                                                onClick={() => { setMobileMenuOpen(false); onOpenStatusVisibilityModal(); }}
                                                className="w-full px-3.5 py-2.5 text-left text-foreground hover:bg-muted flex items-center gap-2.5"
                                            >
                                                <Settings size={14} className="text-muted-foreground" />
                                                <span>상태 보기 설정</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 데스크톱/태블릿 기존 액션 바 */}
                <div className="hidden md:flex flex-wrap items-center justify-end gap-2.5 w-auto">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground font-medium whitespace-nowrap tabular-nums">총 {totalItems}건</span>
                        {getSyncStatus().status !== 'ok' && (
                            <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-md border border-destructive/20 flex items-center gap-1 whitespace-nowrap font-medium" title="서버 동기화 실패 - 재로그인 필요">
                                <AlertTriangle size={12} strokeWidth={1.75} />
                                동기화 필요
                            </span>
                        )}
                        {totalPages > 1 && (
                            <span className="text-xs text-muted-foreground font-normal whitespace-nowrap tabular-nums">({currentPage}/{totalPages}p)</span>
                        )}
                    </div>
                    {onToggleDensity && (
                        <button
                            type="button"
                            onClick={onToggleDensity}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[4px] border border-[#d0d4e4] dark:border-border bg-white dark:bg-card text-[#323338] dark:text-foreground text-xs font-medium hover:bg-[#f6f7fb] dark:hover:bg-muted shadow-2xs active:scale-[0.97] transition-all whitespace-nowrap cursor-pointer"
                            title={density === 'compact' ? '표준 보기로 전환' : '컴팩트(압축) 보기로 전환'}
                        >
                            <span>{density === 'compact' ? '표준 뷰' : '압축 뷰'}</span>
                        </button>
                    )}
                    {onOpenNewCaseModal && (
                        <button
                            type="button"
                            onClick={onOpenNewCaseModal}
                            className="flex items-center gap-1.5 h-8 px-3.5 bg-[#0073ea] hover:bg-[#0060c0] text-white text-xs font-semibold rounded-[4px] shadow-2xs active:scale-[0.97] transition-all whitespace-nowrap cursor-pointer"
                            title="새 고객 케이스 빠른 등록 (Alt+N)"
                        >
                            <Plus size={14} strokeWidth={2} />
                            <span>신규 등록</span>
                        </button>
                    )}
                    <Link
                        to="/lite"
                        className="flex items-center gap-1.5 h-8 px-3 bg-white dark:bg-card hover:bg-[#f6f7fb] dark:hover:bg-muted border border-[#d0d4e4] dark:border-border text-[#323338] dark:text-foreground text-xs font-medium rounded-[4px] shadow-2xs active:scale-[0.97] transition-all whitespace-nowrap cursor-pointer"
                        title="재택/이동 중 모바일 스마트폰 간편 콜 모드"
                    >
                        <Zap size={13} strokeWidth={1.75} className="text-amber-500" />
                        <span>간편 모드</span>
                    </Link>

                    {canExport && (
                        <button
                            onClick={onExportClick}
                            className="h-8 px-3 bg-white dark:bg-card hover:bg-[#f6f7fb] dark:hover:bg-muted border border-[#d0d4e4] dark:border-border text-[#323338] dark:text-foreground text-xs font-medium rounded-[4px] shadow-2xs active:scale-[0.97] transition-all whitespace-nowrap cursor-pointer"
                        >
                            데이터 내보내기
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
