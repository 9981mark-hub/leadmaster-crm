import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

/* ────────────────────────────────────────────────────────
 *  Badge — 통일된 뱃지/상태 표시 컴포넌트
 *  상태 뱃지 색상을 표준화하고 다크모드 완벽 지원
 * ──────────────────────────────────────────────────────── */

const badgeVariants = cva(
  'inline-flex items-center font-bold rounded-md whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
        blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
        green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
        orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
        red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
        purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
        indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
        amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      },
      size: {
        sm: 'text-[10px] px-1.5 py-0.5',
        md: 'text-xs px-2 py-0.5',
        lg: 'text-sm px-2.5 py-1',
      },
      pill: {
        true: 'rounded-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      pill: false,
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** 좌측에 색상 도트 표시 */
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, pill, dot, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size, pill }), className)}
      {...props}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 mr-1.5 shrink-0" />
      )}
      {children}
    </span>
  ),
);
Badge.displayName = 'Badge';

/* ── CRM 케이스 상태 → Badge variant 매핑 ── */
export const STATUS_BADGE_MAP: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
  '계약확정': 'green',
  '상담진행': 'blue',
  '부재': 'orange',
  '고객취소': 'red',
  '진행불가': 'red',
  '신규할당': 'indigo',
  '재상담': 'purple',
  '계약진행': 'emerald',
};

/** 상태 문자열로부터 적절한 Badge variant를 반환 */
export const getStatusVariant = (status: string): VariantProps<typeof badgeVariants>['variant'] =>
  STATUS_BADGE_MAP[status] ?? 'default';

export { badgeVariants };
