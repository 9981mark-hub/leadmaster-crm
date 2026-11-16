import React from 'react';
import { Crown, ShieldCheck, Zap, Headphones } from 'lucide-react';

export type OwnerDashboardMode = 'hybrid' | 'owner' | 'manager' | 'agent';

interface DashboardModeSwitcherProps {
  currentMode: OwnerDashboardMode;
  onChange: (mode: OwnerDashboardMode) => void;
  unassignedCount?: number;
}

export const DashboardModeSwitcher: React.FC<DashboardModeSwitcherProps> = ({
  currentMode,
  onChange,
  unassignedCount = 0,
}) => {
  const modes: {
    id: OwnerDashboardMode;
    label: string;
    subLabel: string;
    icon: React.FC<{ size?: number; className?: string }>;
    badge?: string;
  }[] = [
    {
      id: 'hybrid',
      label: '올인원 통합 뷰',
      subLabel: '경영 + 현장배정 겸직',
      icon: Zap,
      badge: '추천 (1~10인)',
    },
    {
      id: 'owner',
      label: '경영 총괄 뷰',
      subLabel: '손익 · DB ROI · 보안',
      icon: Crown,
    },
    {
      id: 'manager',
      label: '현장 플로어(팀장) 뷰',
      subLabel: '플로어 · 리드배분 · 인계',
      icon: ShieldCheck,
      badge: unassignedCount > 0 ? `미배정 ${unassignedCount}건` : undefined,
    },
    {
      id: 'agent',
      label: '내 상담 뷰',
      subLabel: '대표 직접 통화/일정',
      icon: Headphones,
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-2 border border-slate-200 dark:border-gray-700 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-2 py-1.5 border-b border-slate-100 dark:border-gray-700/60 mb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            TM 대표 스마트 뷰 전환
          </span>
          <span className="text-[11px] text-slate-500 dark:text-gray-400 hidden sm:inline">
            (업무 스타일에 맞춰 경영 지표와 현장 팀장 모드를 자유롭게 전환합니다)
          </span>
        </div>
        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
          선택한 모드가 자동 기억됩니다
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = currentMode === mode.id;

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              className={`relative flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all border ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-300 dark:border-blue-600 shadow-sm text-blue-900 dark:text-blue-100 ring-1 ring-blue-500/20'
                  : 'bg-slate-50/70 dark:bg-gray-800/60 hover:bg-slate-100 dark:hover:bg-gray-700/50 border-slate-200/80 dark:border-gray-700 text-slate-700 dark:text-gray-300'
              }`}
            >
              <div
                className={`p-1.5 rounded-md shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-slate-600 dark:text-gray-400 shadow-xs'
                }`}
              >
                <Icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold truncate ${isActive ? 'text-blue-700 dark:text-blue-300' : ''}`}>
                    {mode.label}
                  </span>
                  {mode.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-semibold whitespace-nowrap ${
                        mode.id === 'hybrid'
                          ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
                          : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {mode.badge}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate mt-0.5">
                  {mode.subLabel}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardModeSwitcher;
