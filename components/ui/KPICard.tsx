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
        'p-4 sm:p-5 rounded-2xl bg-white/95 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:shadow-md transition-all flex items-center justify-between h-full relative overflow-hidden group',
        onClick && 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-600',
        pulseGlow && 'animate-pulse-glow border-amber-300 dark:border-amber-500',
        className,
      )}
    >
      <div className="min-w-0 pr-3">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 truncate">{title}</p>
        <p className={cn('text-2xl sm:text-3xl font-extrabold tracking-tight font-mono tabular-nums leading-none', color)}>
          {displayValue}
        </p>
        {subText && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 truncate font-medium">{subText}</p>}
      </div>
      <div className={cn(
        'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105',
        'bg-slate-100 dark:bg-slate-700/60 shadow-2xs',
      )}>
        <Icon size={22} className={color} />
      </div>
    </motion.div>
  );
};
