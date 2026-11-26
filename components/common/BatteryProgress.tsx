import React from 'react';
import { cn } from '../ui/cn';
import { MONDAY_STATUS_MAP } from '../case-list/StatusCell';

export interface BatteryItem {
  status?: string;
  count: number;
  color?: string;
  label?: string;
}

export interface BatteryProgressProps {
  items?: BatteryItem[];
  segments?: BatteryItem[];
  total?: number;
  height?: number;
  className?: string;
  showTooltip?: boolean;
  showLegend?: boolean;
}

export const BatteryProgress: React.FC<BatteryProgressProps> = ({
  items,
  segments,
  total: providedTotal,
  height = 14,
  className,
  showTooltip = true,
  showLegend = false,
}) => {
  const safeItems = items || segments || [];
  const calculatedTotal = safeItems.reduce((acc, item) => acc + (item?.count || 0), 0);
  const total = providedTotal ?? calculatedTotal;

  if (total === 0) {
    return (
      <div
        style={{ height }}
        className={cn('w-full bg-[#ecedf5] dark:bg-zinc-800 rounded-[4px] overflow-hidden', className)}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div
        style={{ height }}
        className={cn(
          'w-full flex rounded-[4px] overflow-hidden bg-[#ecedf5] dark:bg-zinc-800 gap-[1px]',
          className,
        )}
      >
        {safeItems.map((item, idx) => {
          if (!item || item.count <= 0) return null;
          const percentage = Math.round((item.count / total) * 100);
          const config = item.status ? MONDAY_STATUS_MAP[item.status] : undefined;
          const bgColor = item.color || config?.bg || '#c4c4c4';
          const label = item.label || config?.label || item.status || '기타';

          return (
            <div
              key={`${item.status || item.label || 'seg'}-${idx}`}
              title={showTooltip ? `${label}: ${item.count}건 (${percentage}%)` : undefined}
              style={{
                width: `${(item.count / total) * 100}%`,
                backgroundColor: bgColor,
              }}
              className={cn(
                'h-full transition-all duration-150 hover:brightness-110 cursor-pointer relative group',
              )}
            />
          );
        })}
      </div>
      {showLegend && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {safeItems.map((item, idx) => {
            if (!item || item.count <= 0) return null;
            const config = item.status ? MONDAY_STATUS_MAP[item.status] : undefined;
            const bgColor = item.color || config?.bg || '#c4c4c4';
            const label = item.label || config?.label || item.status || '기타';
            return (
              <div key={`leg-${idx}`} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: bgColor }} />
                <span>{label}</span>
                <span className="font-semibold text-foreground font-mono">{item.count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
