import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CaseListPaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    pageSize?: number;
    onPageSizeChange?: (size: number) => void;
    totalItems?: number;
}

export const PAGE_SIZES = [20, 50, 100];

export const CaseListPagination: React.FC<CaseListPaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    pageSize,
    onPageSizeChange,
    totalItems,
}) => {
    if (totalPages <= 1 && !onPageSizeChange) return null;

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2));

    const btn = 'min-w-[32px] h-8 px-2 rounded-lg text-xs tabular-nums transition-colors flex items-center justify-center font-medium';

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-4">
            <div className="text-xs text-muted-foreground tabular-nums">
                {totalItems !== undefined && pageSize ? (
                    <>전체 {totalItems.toLocaleString()}건 중 {Math.min((currentPage - 1) * pageSize + 1, totalItems).toLocaleString()}–{Math.min(currentPage * pageSize, totalItems).toLocaleString()}</>
                ) : <>{currentPage} / {totalPages}쪽</>}
            </div>
            <div className="flex items-center gap-1">
                <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}
                    className={`${btn} text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 border border-border bg-card`} aria-label="이전 쪽">
                    <ChevronLeft size={14} strokeWidth={1.75} />
                </button>
                {pages.map((p, i) => (
                    <React.Fragment key={p}>
                        {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
                        <button onClick={() => onPageChange(p)}
                            className={`${btn} ${p === currentPage ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-border bg-card'}`}>
                            {p}
                        </button>
                    </React.Fragment>
                ))}
                <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}
                    className={`${btn} text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 border border-border bg-card`} aria-label="다음 쪽">
                    <ChevronRight size={14} strokeWidth={1.75} />
                </button>
            </div>
            {onPageSizeChange && pageSize && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    한 쪽에
                    <select value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))}
                        className="h-8 px-2 rounded-lg border border-border bg-card text-foreground">
                        {PAGE_SIZES.map(s => <option key={s} value={s}>{s}건</option>)}
                    </select>
                </label>
            )}
        </div>
    );
};
