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
    <div className="flex flex-wrap items-center gap-1.5 py-1.5 px-3 rounded-xl bg-muted/40 border border-border text-xs animate-in fade-in duration-150">
      <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mr-1 shrink-0">
        <Filter size={12} strokeWidth={1.75} />
        <span>적용된 필터:</span>
      </div>

      {/* Search */}
      {search && search.trim() && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-card text-foreground border border-border font-medium shadow-2xs">
          검색: "{search}"
          {onClearSearch && (
            <button onClick={onClearSearch} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={12} strokeWidth={1.75} />
            </button>
          )}
        </span>
      )}

      {/* Status Filters */}
      {statusFilters.map(status => (
        <span key={status} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-card text-foreground border border-border font-medium shadow-2xs">
          상태: {status}
          {onRemoveStatusFilter && (
            <button onClick={() => onRemoveStatusFilter(status)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={12} strokeWidth={1.75} />
            </button>
          )}
        </span>
      ))}

      {/* Partner */}
      {partnerFilter && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-card text-foreground border border-border font-medium shadow-2xs">
          거래처: {partnerName}
          {onClearPartnerFilter && (
            <button onClick={onClearPartnerFilter} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={12} strokeWidth={1.75} />
            </button>
          )}
        </span>
      )}

      {/* Inbound Path */}
      {inboundPathFilter && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-card text-foreground border border-border font-medium shadow-2xs">
          유입: {inboundPathFilter}
          {onClearInboundPathFilter && (
            <button onClick={onClearInboundPathFilter} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={12} strokeWidth={1.75} />
            </button>
          )}
        </span>
      )}

      {/* Date Range */}
      {(dateFilterStart || dateFilterEnd) && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-card text-foreground border border-border font-medium font-mono text-xs shadow-2xs tabular-nums">
          기간: {dateFilterStart || '~'} ~ {dateFilterEnd || ''}
          {onClearDateFilter && (
            <button onClick={onClearDateFilter} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={12} strokeWidth={1.75} />
            </button>
          )}
        </span>
      )}

      {/* Starred */}
      {showStarredOnly && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
          ★ 중요 건만
          {onToggleStarred && (
            <button onClick={onToggleStarred} className="hover:opacity-75 transition-opacity">
              <X size={12} strokeWidth={1.75} />
            </button>
          )}
        </span>
      )}

      {/* New Leads Only */}
      {showNewOnly && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20 font-medium">
          신규 접수 건만
          {onToggleNewOnly && (
            <button onClick={onToggleNewOnly} className="hover:opacity-75 transition-opacity">
              <X size={12} strokeWidth={1.75} />
            </button>
          )}
        </span>
      )}

      {/* Overdue Missed Calls Only */}
      {showOverdueMissedOnly && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
          재통화 필요 건만
          {onToggleOverdueMissedOnly && (
            <button onClick={onToggleOverdueMissedOnly} className="hover:opacity-75 transition-opacity">
              <X size={12} strokeWidth={1.75} />
            </button>
          )}
        </span>
      )}

      {/* Assignee */}
      {assigneeFilter && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-card text-foreground border border-border font-medium shadow-2xs">
          담당: {assigneeName || assigneeFilter}
          {onClearAssigneeFilter && (
            <button onClick={onClearAssigneeFilter} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={12} strokeWidth={1.75} />
            </button>
          )}
        </span>
      )}

      {/* Reset All */}
      <button
        onClick={onResetAllFilters}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border font-medium transition-colors ml-auto shrink-0 cursor-pointer shadow-2xs"
        title="모든 필터 초기화"
      >
        <RotateCcw size={11} strokeWidth={1.75} />
        <span>초기화</span>
      </button>
    </div>
  );
};
