import React from 'react';
import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { useCountUp } from '../../utils/useCountUp';

export interface KPICardProps {
  title: string;
  count: number | string;
  /** Tailwind text color class e.g. 'text-blue-600' */
  color: string;
  icon: LucideIcon;
  subText?: string;
  onClick?: () => void;
  className?: string;
  pulseGlow?: boolean;
  accentColor?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  count,
  color,
  icon: Icon,
  subText,
  onClick,
  className,
  pulseGlow = false,
  accentColor,
}) => {
  const isNumeric = typeof count === 'number';
  const animatedNumber = useCountUp(isNumeric ? (count as number) : 0, 750);
  const displayValue = isNumeric ? animatedNumber.toLocaleString() : count;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className={cn(
        'p-4 sm:p-5 rounded-[8px] bg-card text-card-foreground border border-[#d0d4e4] dark:border-border shadow-xs hover:border-primary/50 hover:shadow-md transition-all duration-200 flex items-center justify-between h-full relative overflow-hidden group',
        onClick && 'cursor-pointer',
        pulseGlow && 'border-amber-500/40 ring-1 ring-amber-500/20',
        className,
      )}
    >
      {/* monday.com 시그니처 상단 3px 컬러 액센트 바 */}
      {accentColor && (
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ backgroundColor: accentColor }}
        />
      )}
      <div className="min-w-0 pr-3">
        <p className="text-xs font-semibold text-[#676879] dark:text-muted-foreground mb-1.5 truncate">{title}</p>
        <p className="text-2xl sm:text-3xl font-bold tracking-tight font-mono tabular-nums leading-none text-[#323338] dark:text-foreground">
          {displayValue}
        </p>
        {subText && <p className="text-xs text-[#676879] dark:text-muted-foreground mt-1.5 truncate font-normal">{subText}</p>}
      </div>
      <div className={cn(
        'w-11 h-11 rounded-[6px] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105',
        'bg-muted/50 border border-border/80 shadow-2xs',
      )}>
        <Icon size={20} strokeWidth={1.75} className={color || 'text-muted-foreground'} />
      </div>
    </motion.div>
  );
};
