import React from 'react';
import { cn } from './cn';

/* ────────────────────────────────────────────────────────
 *  Card — 통일된 카드 컴포넌트
 *  기존 glass-panel / 기본 카드 / 단순 카드 → 하나로 통합
 * ──────────────────────────────────────────────────────── */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 카드 내부 패딩 — false면 패딩 없음 */
  padding?: string | false;
  /** glass 효과 (대시보드 KPI 등 특별한 경우만) */
  glass?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = 'p-5', glass = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border shadow-sm',
        glass
          ? 'glass-panel'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
        padding && padding,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
Card.displayName = 'Card';

/* ── Card 서브 컴포넌트 ── */

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn(
      'flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => (
  <h3
    className={cn(
      'text-base font-semibold text-gray-900 dark:text-white',
      className,
    )}
    {...props}
  >
    {children}
  </h3>
);

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn(className)} {...props}>
    {children}
  </div>
);
