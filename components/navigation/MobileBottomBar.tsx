import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Zap, Calculator, Grid3X3, 
  X, PhoneCall, Calendar, UserCog, Smartphone, Megaphone, 
  GraduationCap, Building2, Settings, User, LogOut, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_LABEL } from '../../services/org';

interface MobileBottomBarProps {
  pendingTgCount?: number;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  pendingTgCount = 0,
}) => {
  const location = useLocation();
  const path = location.pathname;
  const { org, isAdmin, isPlatformAdmin, logout } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const isLiteOnly = !isAdmin && org?.uiMode === 'lite_only';
  const roleLabel = org?.role ? ROLE_LABEL[org.role] : '상담원';

  // 5대 핵심 엄지존 탭
  const primaryTabs = [
    { to: '/', icon: LayoutDashboard, label: '대시보드' },
    { to: '/cases', icon: Users, label: '케이스' },
    { to: '/lite', icon: Zap, label: '간편콜' },
    { 
      to: isAdmin ? '/settlement' : '/training', 
      icon: isAdmin ? Calculator : GraduationCap, 
      label: isAdmin ? '정산' : '트레이닝' 
    },
  ];

  // 4대 그룹 전체 메뉴 리스트 (더보기 바텀시트용)
  const fullGroups = [
    {
      label: '콜 영업 & 상담',
      items: [
        { to: '/', icon: LayoutDashboard, label: '대시보드' },
        { to: '/cases', icon: Users, label: '케이스 관리' },
        { to: '/lite', icon: Zap, label: '간편 콜 모드' },
        { to: '/schedule', icon: Calendar, label: '일정 캘린더' },
        ...(isPlatformAdmin ? [{ to: '/auto-dial', icon: PhoneCall, label: '스마트 오토콜' }] : []),
      ],
    },
    ...(isAdmin ? [{
      label: '정산 & 경영',
      items: [
        { to: '/settlement', icon: Calculator, label: '정산·손익 센터' },
        { to: '/team', icon: UserCog, label: '팀 관리 (DB원가)' },
      ],
    }] : []),
    {
      label: '연동 & 소통',
      items: [
        ...(isAdmin ? [{ to: '/telegram', icon: Smartphone, label: 'TG 연동 센터', badge: pendingTgCount }] : []),
        { to: '/notices', icon: Megaphone, label: '사내 공지사항' },
        { to: '/training', icon: GraduationCap, label: 'AI 트레이닝' },
      ],
    },
    {
      label: '시스템 & 마이',
      items: [
        ...(isPlatformAdmin ? [{ to: '/platform', icon: Building2, label: '회사 관리 (Host)' }] : []),
        ...(isAdmin ? [{ to: '/settings', icon: Settings, label: '시스템 설정' }] : []),
        { to: '/mypage', icon: User, label: '마이페이지' },
      ],
    },
  ];

  const isActive = (to: string) => path === to || (to === '/cases' && path.startsWith('/case/'));

  return (
    <>
      {/* 1. Mobile Bottom Bar: Fixed 5 Tabs */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe shadow-lg">
        <div className="flex items-center justify-around h-14 px-1">
          {primaryTabs.map(tab => {
            const active = isActive(tab.to);
            const Icon = tab.icon;
            const isLite = tab.to === '/lite';

            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`flex-1 flex flex-col items-center justify-center py-1 min-w-[54px] transition-all ${
                  active
                    ? isLite
                      ? 'text-amber-500 font-bold'
                      : 'text-blue-600 dark:text-blue-400 font-bold'
                    : isLite
                    ? 'text-amber-600/80 dark:text-amber-400/80'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <div className="relative">
                  <Icon size={20} className={isLite && active ? 'fill-amber-500/20' : ''} />
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-current rounded-full" />
                  )}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
              </Link>
            );
          })}

          {/* More Menu Trigger Button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center py-1 min-w-[54px] transition-colors ${
              isDrawerOpen 
                ? 'text-blue-600 dark:text-blue-400 font-bold' 
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <div className="relative">
              <Grid3X3 size={20} />
              {pendingTgCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500" />
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">전체 메뉴</span>
          </button>
        </div>
      </div>

      {/* 2. Full Menu Bottom Sheet Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div 
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-end md:hidden"
            onClick={() => setIsDrawerOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="w-full max-h-[85vh] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden pb-safe"
              onClick={e => e.stopPropagation()}
            >
              {/* Drag Handle Bar & Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    전체 메뉴
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {org?.orgName} ({roleLabel})
                  </p>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Menu Categories Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {fullGroups.map(group => (
                  <div key={group.label} className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {group.items.map(item => {
                        const active = isActive(item.to);
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setIsDrawerOpen(false)}
                            className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                              active
                                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 font-medium'
                            }`}
                          >
                            <div className={`p-2 rounded-xl ${
                              active 
                                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400' 
                                : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 shadow-2xs'
                            }`}>
                              <Icon size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs truncate block">{item.label}</span>
                            </div>
                            {'badge' in item && typeof item.badge === 'number' && item.badge > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Logout Button in Sheet */}
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      logout();
                    }}
                    className="w-full p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <LogOut size={16} />
                    <span>로그아웃</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
