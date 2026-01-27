import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CaseListPaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export const CaseListPagination: React.FC<CaseListPaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 0) return null;

    return (
        <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                    <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium text-gray-700">
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    onClick={() => onPageChange(currentPage + 1)}
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
                            onClick={() => onPageChange(pageNum)}
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
    );
};
