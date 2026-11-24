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
  /** 상단 monday 스타일 컬러 포인트 라인 (예: '#0073ea', '#00c875') */
  topAccent?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = 'p-5', glass = false, topAccent, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border shadow-xs transition-shadow duration-150 relative overflow-hidden',
        glass
          ? 'glass-panel'
          : 'bg-white dark:bg-gray-800 border-[#d0d4e4] dark:border-gray-700',
        padding && padding,
        className,
      )}
      {...props}
    >
      {topAccent && (
        <div 
          className="absolute top-0 left-0 right-0 h-[3px]" 
          style={{ backgroundColor: topAccent }} 
        />
      )}
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
      'flex items-center justify-between pb-3 mb-3 border-b border-[#d0d4e4]/60 dark:border-gray-700',
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
      'text-[16px] font-semibold text-[#323338] dark:text-white',
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
