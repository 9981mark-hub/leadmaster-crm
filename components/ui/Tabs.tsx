import React from 'react';
import { cn } from './cn';

/* ────────────────────────────────────────────────────────
 *  Tabs — 통일된 탭 네비게이션
 *  정산(언더라인), 팀관리(필), TG연동(브라우저탭) → 하나로 통합
 *  모바일: 가로 스크롤 + 스냅
 * ──────────────────────────────────────────────────────── */

export interface TabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
  /** 탭 바 전체 너비 사용 */
  fullWidth?: boolean;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeKey,
  onChange,
  className,
  fullWidth = false,
}) => {
  const tabRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  // 활성 탭이 보이도록 자동 스크롤
  React.useEffect(() => {
    const btn = tabRefs.current.get(activeKey);
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeKey]);

  return (
    <div
      className={cn(
        'flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar',
        className,
      )}
      role="tablist"
    >
      {items.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.key, el);
            }}
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.key)}
            className={cn(
              'relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors -mb-px border-b-2',
              'min-h-[44px] flex items-center gap-1.5',
              fullWidth && 'flex-1 justify-center',
              isActive
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200',
              tab.disabled && 'opacity-40 cursor-not-allowed',
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge != null && (
              <span
                className={cn(
                  'ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  isActive
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
