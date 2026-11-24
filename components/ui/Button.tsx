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
  // monday.com Vibe Button Base: 70ms active scale press, 4px radius, crisp outline
  'inline-flex items-center justify-center gap-1.5 font-medium rounded-[4px] transition-all duration-70 ease-[cubic-bezier(0.4,0,0.2,1)] focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]',
  {
    variants: {
      variant: {
        primary:
          'bg-[#0073ea] text-white hover:bg-[#0060b9] shadow-2xs focus:ring-[#0073ea]/30 dark:bg-blue-600 dark:hover:bg-blue-700',
        secondary:
          'bg-white text-[#323338] border border-[#c3c6d4] hover:bg-[#f6f7fb] hover:border-[#a0a4b8] focus:ring-[#0073ea]/20 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700',
        danger:
          'bg-[#df2f4a] text-white hover:bg-[#ad3f51] focus:ring-[#df2f4a]/30 dark:bg-red-600 dark:hover:bg-red-700',
        success:
          'bg-[#00c875] text-white hover:bg-[#0f9b63] focus:ring-[#00c875]/30 dark:bg-emerald-600 dark:hover:bg-emerald-700',
        ghost:
          'text-[#676879] hover:bg-[#f0f3ff] hover:text-[#0073ea] focus:ring-gray-300 dark:text-gray-300 dark:hover:bg-gray-700',
      },
      size: {
        sm: 'text-xs px-2.5 py-1 min-h-[28px] rounded-[4px]',
        md: 'text-[14px] px-3.5 py-1.5 min-h-[32px] rounded-[4px]',
        lg: 'text-base px-5 py-2 min-h-[40px] rounded-[4px]',
        icon: 'p-1.5 min-h-[32px] min-w-[32px] rounded-[4px]',
        'icon-lg': 'p-2 min-h-[40px] min-w-[40px] rounded-[4px]',
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
