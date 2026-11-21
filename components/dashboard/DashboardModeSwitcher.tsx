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
    <div className="bg-card rounded-xl p-2.5 border border-border shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1.5 py-1 border-b border-border mb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold text-foreground">
            TM 대표 스마트 뷰 전환
          </span>
        </div>
        <span className="text-[11px] text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
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
                  ? 'bg-primary/10 border-primary/40 shadow-xs text-foreground ring-1 ring-primary/20'
                  : 'bg-muted/30 hover:bg-muted border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <div
                className={`p-1.5 rounded-md shrink-0 transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'bg-card text-muted-foreground border border-border'
                }`}
              >
                <Icon size={16} strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-semibold truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
                    {mode.label}
                  </span>
                  {mode.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold whitespace-nowrap ${
                        mode.id === 'hybrid'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {mode.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
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
