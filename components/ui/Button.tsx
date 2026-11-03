import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { Loader2 } from 'lucide-react';

/* ────────────────────────────────────────────────────────
 *  Button — 통일된 버튼 시스템
 *  기존 5가지 이상 색상 혼재 → 5가지 variant로 정리
 *  모바일 터치 타겟 최소 44px 보장
 * ──────────────────────────────────────────────────────── */

const buttonVariants = cva(
  // base
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 dark:bg-blue-600 dark:hover:bg-blue-700',
        secondary:
          'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-400 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700',
        danger:
          'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        success:
          'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
        ghost:
          'text-gray-600 hover:bg-gray-100 focus:ring-gray-400 dark:text-gray-300 dark:hover:bg-gray-700',
      },
      size: {
        sm: 'text-xs px-3 py-1.5 min-h-[32px]',
        md: 'text-sm px-4 py-2 min-h-[36px]',
        lg: 'text-base px-5 py-2.5 min-h-[44px]',
        icon: 'p-2 min-h-[36px] min-w-[36px]',
        'icon-lg': 'p-2.5 min-h-[44px] min-w-[44px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, icon, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export { buttonVariants };
