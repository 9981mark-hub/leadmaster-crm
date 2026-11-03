import React from 'react';
import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';
import { cn } from './cn';

/* ────────────────────────────────────────────────────────
 *  KPICard — 대시보드 / 통계 공유 KPI 카드
 *  기존 Dashboard의 인라인 KPICard를 공유 컴포넌트로 추출
 *  glass 효과 유지, 다크모드 완벽 지원
 * ──────────────────────────────────────────────────────── */

export interface KPICardProps {
  title: string;
  count: number | string;
  /** Tailwind text color class — e.g. 'text-blue-600' */
  color: string;
  icon: LucideIcon;
  subText?: string;
  onClick?: () => void;
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  count,
  color,
  icon: Icon,
  subText,
  onClick,
  className,
}) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={cn(
      'glass-panel p-4 rounded-xl flex items-center justify-between transition-all h-full',
      onClick && 'cursor-pointer',
      className,
    )}
  >
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
      <p className={cn('text-2xl font-bold', color)}>{count}</p>
      {subText && <p className="text-xs text-gray-400 mt-1">{subText}</p>}
    </div>
    <div className="p-3 rounded-full bg-gray-50 dark:bg-gray-700">
      <Icon size={24} className={color} />
    </div>
  </motion.div>
);
