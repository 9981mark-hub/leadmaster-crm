import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

/* ────────────────────────────────────────────────────────
 *  Badge — 통일된 뱃지/상태 표시 컴포넌트
 *  상태 뱃지 색상을 표준화하고 다크모드 완벽 지원
 * ──────────────────────────────────────────────────────── */

const badgeVariants = cva(
  'inline-flex items-center font-semibold rounded-[4px] whitespace-nowrap transition-colors duration-100',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-[#323338] dark:bg-gray-700 dark:text-gray-300',
        done: 'bg-[#00c875] text-white hover:bg-[#0f9b63]',
        working: 'bg-[#fdab3d] text-white hover:bg-[#c0873c]',
        stuck: 'bg-[#df2f4a] text-white hover:bg-[#ad3f51]',
        pending: 'bg-[#ffcb00] text-[#323338] hover:bg-[#eaaa15]',
        qualified: 'bg-[#579bfc] text-white hover:bg-[#4c7cc1]',
        blue: 'bg-[#cce5ff] text-[#0073ea] dark:bg-blue-900/40 dark:text-blue-300',
        green: 'bg-[#e6f9f1] text-[#00854d] dark:bg-green-900/40 dark:text-green-300',
        orange: 'bg-[#fff0e6] text-[#c0873c] dark:bg-orange-900/40 dark:text-orange-300',
        red: 'bg-[#feecee] text-[#df2f4a] dark:bg-red-900/40 dark:text-red-300',
        purple: 'bg-[#f4e8fc] text-[#9d50dd] dark:bg-purple-900/40 dark:text-purple-300',
        indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
        amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      },
      size: {
        sm: 'text-xs px-2 py-0.5 min-h-[22px]',
        md: 'text-[13px] px-2.5 py-1 min-h-[26px]',
        lg: 'text-sm px-3 py-1.5 min-h-[30px]',
        block: 'text-[14px] w-full h-8 px-3 justify-center font-semibold',
      },
      pill: {
        true: 'rounded-full',
        false: 'rounded-[4px]',
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
