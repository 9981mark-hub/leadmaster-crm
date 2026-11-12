import React from 'react';
import { X, RotateCcw, Filter } from 'lucide-react';
import { Partner } from '../../types';

interface FilterChipsBarProps {
  search?: string;
  onClearSearch?: () => void;
  statusFilters?: string[];
  onRemoveStatusFilter?: (status: string) => void;
  partnerFilter?: string;
  onClearPartnerFilter?: () => void;
  partners?: Partner[];
  inboundPathFilter?: string;
  onClearInboundPathFilter?: () => void;
  dateFilterStart?: string;
  dateFilterEnd?: string;
  onClearDateFilter?: () => void;
  showStarredOnly?: boolean;
  onToggleStarred?: () => void;
  showNewOnly?: boolean;
  onToggleNewOnly?: () => void;
  showOverdueMissedOnly?: boolean;
  onToggleOverdueMissedOnly?: () => void;
  assigneeFilter?: string;
  onClearAssigneeFilter?: () => void;
  assigneeName?: string;
  onResetAllFilters: () => void;
}

export const FilterChipsBar: React.FC<FilterChipsBarProps> = ({
  search,
  onClearSearch,
  statusFilters = [],
  onRemoveStatusFilter,
  partnerFilter,
  onClearPartnerFilter,
  partners = [],
  inboundPathFilter,
  onClearInboundPathFilter,
  dateFilterStart,
  dateFilterEnd,
  onClearDateFilter,
  showStarredOnly,
  onToggleStarred,
  showNewOnly,
  onToggleNewOnly,
  showOverdueMissedOnly,
  onToggleOverdueMissedOnly,
  assigneeFilter,
  onClearAssigneeFilter,
  assigneeName,
  onResetAllFilters,
}) => {
  const partnerName = partners.find(p => p.partnerId === partnerFilter)?.name || partnerFilter;

  // Check if any filter is active
  const hasActiveFilters = Boolean(
    (search && search.trim()) ||
    statusFilters.length > 0 ||
    partnerFilter ||
    inboundPathFilter ||
    dateFilterStart ||
    dateFilterEnd ||
    showStarredOnly ||
    showNewOnly ||
    showOverdueMissedOnly ||
    assigneeFilter
  );

  if (!hasActiveFilters) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1 px-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs animate-in fade-in duration-150">
      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 mr-1 shrink-0">
        <Filter size={12} />
        <span>적용된 필터:</span>
      </div>

      {/* Search */}
      {search && search.trim() && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 font-medium">
          검색: "{search}"
          {onClearSearch && (
            <button onClick={onClearSearch} className="hover:text-blue-900 transition-colors">
              <X size={12} />
            </button>
          )}
        </span>
      )}

      {/* Status Filters */}
      {statusFilters.map(status => (
        <span key={status} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 font-medium">
          상태: {status}
          {onRemoveStatusFilter && (
            <button onClick={() => onRemoveStatusFilter(status)} className="hover:text-indigo-900 transition-colors">
              <X size={12} />
            </button>
          )}
        </span>
      ))}

      {/* Partner */}
      {partnerFilter && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80 font-medium">
          거래처: {partnerName}
          {onClearPartnerFilter && (
            <button onClick={onClearPartnerFilter} className="hover:text-purple-900 transition-colors">
              <X size={12} />
            </button>
          )}
        </span>
      )}

      {/* Inbound Path */}
      {inboundPathFilter && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/80 font-medium">
          유입: {inboundPathFilter}
          {onClearInboundPathFilter && (
            <button onClick={onClearInboundPathFilter} className="hover:text-cyan-900 transition-colors">
              <X size={12} />
            </button>
          )}
        </span>
      )}

      {/* Date Range */}
      {(dateFilterStart || dateFilterEnd) && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 font-medium font-mono text-[11px]">
          기간: {dateFilterStart || '~'} ~ {dateFilterEnd || ''}
          {onClearDateFilter && (
            <button onClick={onClearDateFilter} className="hover:text-slate-900 transition-colors">
              <X size={12} />
            </button>
          )}
        </span>
      )}

      {/* Starred */}
      {showStarredOnly && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 font-medium">
          ★ 중요 건만
          {onToggleStarred && (
            <button onClick={onToggleStarred} className="hover:text-amber-900 transition-colors">
              <X size={12} />
            </button>
          )}
        </span>
      )}

      {/* New Leads Only */}
      {showNewOnly && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 font-medium">
          신규 접수 건만
          {onToggleNewOnly && (
            <button onClick={onToggleNewOnly} className="hover:text-rose-900 transition-colors">
              <X size={12} />
            </button>
          )}
        </span>
      )}

      {/* Overdue Missed Calls Only */}
      {showOverdueMissedOnly && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/80 font-medium">
          재통화 필요 건만
          {onToggleOverdueMissedOnly && (
            <button onClick={onToggleOverdueMissedOnly} className="hover:text-orange-900 transition-colors">
              <X size={12} />
            </button>
          )}
        </span>
      )}

      {/* Assignee */}
      {assigneeFilter && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 font-medium">
          담당: {assigneeName || assigneeFilter}
          {onClearAssigneeFilter && (
            <button onClick={onClearAssigneeFilter} className="hover:text-emerald-900 transition-colors">
              <X size={12} />
            </button>
          )}
        </span>
      )}

      {/* Reset All */}
      <button
        onClick={onResetAllFilters}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 font-semibold transition-colors ml-auto shrink-0 cursor-pointer"
        title="모든 필터 초기화"
      >
        <RotateCcw size={11} />
        <span>초기화</span>
      </button>
    </div>
  );
};
