import React, { useMemo } from 'react';
import { 
  Sparkles, Building, ClipboardList, Users, Phone, ShieldCheck, Crown
} from 'lucide-react';
import { OrgRole, AdminTier } from '../../services/org';

export type ScheduleViewMode = 'all_in_one' | 'financial' | 'operations' | 'team' | 'personal';

interface ScheduleRoleViewSwitcherProps {
  role?: OrgRole;
  isPlatformAdmin?: boolean;
  adminTier?: AdminTier;
  activeMode: ScheduleViewMode;
  onChangeMode: (mode: ScheduleViewMode) => void;
  teamName?: string;
}

interface TabOption {
  id: ScheduleViewMode;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

export const ScheduleRoleViewSwitcher: React.FC<ScheduleRoleViewSwitcherProps> = ({
  role = 'agent',
  isPlatformAdmin = false,
  adminTier,
  activeMode,
  onChangeMode,
  teamName
}) => {
  // 사용자의 직급 및 권한에 따라 노출할 탭 옵션 결정
  const tabs = useMemo<TabOption[]>(() => {
    // 1. TM 대표 (Owner) 또는 플랫폼 총괄관리자
    if (isPlatformAdmin || role === 'owner') {
      return [
        {
          id: 'all_in_one',
          label: '⚡ 올인원 통합 관제 (자금+운영 겸직)',
          shortLabel: '⚡ 올인원 겸직',
          icon: Sparkles,
          badge: '대표 권장',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
        },
        {
          id: 'financial',
          label: '🏢 경영·자금 전용 뷰',
          shortLabel: '🏢 경영·자금',
          icon: Building,
          badge: '거시 지표',
          badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
        },
        {
          id: 'operations',
          label: '📋 센터 총괄 운영 관제',
          shortLabel: '📋 센터 운영',
          icon: ClipboardList
        },
        {
          id: 'personal',
          label: '📞 대표 직속 고객 리마인더',
          shortLabel: '📞 직속 고객',
          icon: Phone
        }
      ];
    }

    // 2. 총괄 관리자 / 센터장 (Admin, Tier 2~3)
    if (role === 'admin') {
      return [
        {
          id: 'operations',
          label: '📋 센터 총괄 운영 관제',
          shortLabel: '📋 전사 운영',
          icon: ClipboardList,
          badge: '센터장 기본',
          badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
        },
        {
          id: 'team',
          label: '👥 팀별 세부 일정 관제',
          shortLabel: '👥 팀별 관제',
          icon: Users
        },
        {
          id: 'personal',
          label: '📞 내 담당 고객 리마인더',
          shortLabel: '📞 내 담당 고객',
          icon: Phone
        }
      ];
    }

    // 3. 일반 관리자 / 팀장 (Agent 중 Tier 1 이상이거나 팀장)
    if (adminTier && adminTier >= 1) {
      return [
        {
          id: 'team',
          label: `👥 [${teamName || '팀'}] 코칭 & 서포트 캘린더`,
          shortLabel: '👥 우리 팀',
          icon: Users,
          badge: '팀장 기본',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
        },
        {
          id: 'personal',
          label: '📞 내 담당 고객 영업 리마인더',
          shortLabel: '📞 내 담당 고객',
          icon: Phone
        }
      ];
    }

    // 4. 전문 상담원 (Agent) - 단일 몰입 모드
    return [
      {
        id: 'personal',
        label: '📞 나의 고객 영업 실무 캘린더',
        shortLabel: '📞 나의 영업 일정',
        icon: Phone,
        badge: '영업 집중',
        badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
      }
    ];
  }, [role, isPlatformAdmin, adminTier, teamName]);

  // 상담원은 탭이 1개이므로 깔끔한 역할 뱃지만 렌더링
  if (tabs.length === 1) {
    return (
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 flex items-center gap-1.5">
            <Phone size={13} />
            전문 상담원 개인 영업 일정 모드
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            나에게 배정된 고객과의 1:1 상담 및 미팅에 100% 집중합니다.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 rounded-2xl bg-gray-100/80 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800/80 backdrop-blur-md">
      {/* 탭 버튼 목록 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeMode === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeMode(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all relative ${
                isActive
                  ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-md border border-gray-200 dark:border-slate-700'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-100/50 dark:bg-slate-800/50'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400'} />
              <span className="hidden md:inline">{tab.label}</span>
              <span className="md:hidden">{tab.shortLabel}</span>
              {tab.badge && (
                <span className={`text-xs px-1.5 py-0.5 rounded-md font-bold border ${tab.badgeColor || 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 우측 직급 식별 배지 */}
      <div className="hidden lg:flex items-center gap-2 px-3 py-1">
        <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">현재 접속 직급:</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
          {isPlatformAdmin ? (
            <><Crown size={12} className="text-amber-600 dark:text-amber-400" /> 플랫폼 최고관리자</>
          ) : role === 'owner' ? (
            <><Crown size={12} className="text-amber-600 dark:text-amber-400" /> TM 대표이사</>
          ) : role === 'admin' ? (
            <><ShieldCheck size={12} className="text-purple-600 dark:text-purple-400" /> 총괄 관리자 / 센터장</>
          ) : (
            <><Users size={12} className="text-emerald-600 dark:text-emerald-400" /> 일반 관리자 / 팀장</>
          )}
        </span>
      </div>
    </div>
  );
};

export default ScheduleRoleViewSwitcher;
