import React from 'react';
import { cn } from '../ui/cn';
import { MONDAY_STATUS_MAP } from '../case-list/StatusCell';

export interface BatteryItem {
  status: string;
  count: number;
  color?: string;
  label?: string;
}

export interface BatteryProgressProps {
  items: BatteryItem[];
  total?: number;
  height?: number;
  className?: string;
  showTooltip?: boolean;
}

export const BatteryProgress: React.FC<BatteryProgressProps> = ({
  items,
  total: providedTotal,
  height = 14,
  className,
  showTooltip = true,
}) => {
  const calculatedTotal = items.reduce((acc, item) => acc + item.count, 0);
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
    <div
      style={{ height }}
      className={cn(
        'w-full flex rounded-[4px] overflow-hidden bg-[#ecedf5] dark:bg-zinc-800 gap-[1px]',
        className,
      )}
    >
      {items.map((item, idx) => {
        if (item.count <= 0) return null;
        const percentage = Math.round((item.count / total) * 100);
        const config = MONDAY_STATUS_MAP[item.status];
        const bgColor = item.color || config?.bg || '#c4c4c4';
        const label = item.label || config?.label || item.status;

        return (
          <div
            key={`${item.status}-${idx}`}
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
  );
};
