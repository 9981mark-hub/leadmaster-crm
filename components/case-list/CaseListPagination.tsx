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

    const btn = 'min-w-[32px] h-8 px-2 rounded-lg text-sm tabular-nums transition-colors';

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-4">
            <div className="text-sm text-slate-500 dark:text-gray-400 tabular-nums">
                {totalItems !== undefined && pageSize ? (
                    <>전체 {totalItems.toLocaleString()}건 중 {Math.min((currentPage - 1) * pageSize + 1, totalItems).toLocaleString()}–{Math.min(currentPage * pageSize, totalItems).toLocaleString()}</>
                ) : <>{currentPage} / {totalPages}쪽</>}
            </div>
            <div className="flex items-center gap-1">
                <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}
                    className={`${btn} text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-30`} aria-label="이전 쪽">
                    <ChevronLeft size={16} />
                </button>
                {pages.map((p, i) => (
                    <React.Fragment key={p}>
                        {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
                        <button onClick={() => onPageChange(p)}
                            className={`${btn} ${p === currentPage ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold' : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700'}`}>
                            {p}
                        </button>
                    </React.Fragment>
                ))}
                <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}
                    className={`${btn} text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-30`} aria-label="다음 쪽">
                    <ChevronRight size={16} />
                </button>
            </div>
            {onPageSizeChange && pageSize && (
                <label className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400">
                    한 쪽에
                    <select value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))}
                        className="h-8 px-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-200">
                        {PAGE_SIZES.map(s => <option key={s} value={s}>{s}건</option>)}
                    </select>
                </label>
            )}
        </div>
    );
};
