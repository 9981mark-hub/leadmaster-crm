import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Unified empty-state placeholder.
 * Use when a list/table/section has zero items.
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = '데이터가 없습니다',
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
        <Icon size={32} className="text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
