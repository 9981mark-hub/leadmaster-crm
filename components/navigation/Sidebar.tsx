import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Zap, Calendar, PhoneCall, 
  Calculator, UserCog, Smartphone, Megaphone, GraduationCap, 
  Building2, Settings, User, ChevronsLeft, ChevronsRight, Shield, Crown, CreditCard
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { ROLE_LABEL } from '../../services/org';
import { CompanyProfileModal } from './CompanyProfileModal';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  pendingTgCount?: number;
}

interface NavItemDef {
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  badge?: number | string;
  adminOnly?: boolean;
  platformAdminOnly?: boolean;
}

interface NavGroupDef {
  id: string;
  label: string;
  items: NavItemDef[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  pendingTgCount = 0,
}) => {
  const location = useLocation();
  const path = location.pathname;
  const { theme } = useTheme();
  const { org, isAdmin, isPlatformAdmin, user, updateOrgProfile } = useAuth();
  const { showToast } = useToast();

  const isOwner = org?.role === 'owner' || isPlatformAdmin || user?.email === (org as any)?.ownerEmail;
  const isLiteOnly = !isAdmin && org?.uiMode === 'lite_only';
  const roleLabel = org?.role ? ROLE_LABEL[org.role] : '상담원';
  const orgName = org?.orgName || '리드마스터 CRM';

  // TM대표 전용 회사 프로필/로고 설정 모달 상태
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);

  const handleSaveCompanyProfile = async (updates: { orgName: string; orgLogo: string | null }) => {
    try {
      await updateOrgProfile(updates);
      showToast('🏢 회사명과 대표 사진이 성공적으로 저장되었습니다.', 'success');
    } catch (err: any) {
      showToast('회사 정보 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  // 4대 기능별 그룹 메뉴 정의
  const navGroups: NavGroupDef[] = [
    {
      id: 'sales',
      label: '콜 영업 / 상담',
      items: [
        { to: '/', icon: LayoutDashboard, label: '통합 대시보드' },
        { to: '/cases', icon: Users, label: '케이스 관리' },
        { to: '/lite', icon: Zap, label: '간편 콜 모드' },
        { to: '/auto-dial', icon: PhoneCall, label: '스마트 오토콜', platformAdminOnly: true },
        { to: '/schedule', icon: Calendar, label: '일정 캘린더' },
      ],
    },
    {
      id: 'finance',
      label: '정산 / 경영',
      items: [
        { to: '/billing', icon: CreditCard, label: '빌링 & 광고비', adminOnly: true },
        { to: '/settlement', icon: Calculator, label: '정산·손익 센터', adminOnly: true },
        { to: '/team', icon: UserCog, label: '팀 관리', adminOnly: true },
      ],
    },
    {
      id: 'comms',
      label: '연동 / 소통',
      items: [
        { 
          to: '/telegram', 
          icon: Smartphone, 
          label: 'TG 연동 센터', 
          badge: pendingTgCount > 0 ? pendingTgCount : undefined 
        },
        { to: '/notices', icon: Megaphone, label: '사내 공지사항' },
        { to: '/training', icon: GraduationCap, label: 'AI 트레이닝' },
      ],
    },
    {
      id: 'admin',
      label: '시스템 관리',
      items: [
        { to: '/platform', icon: Crown, label: '👑 플랫폼 총괄 어드민', platformAdminOnly: true },
        { to: '/settings', icon: Settings, label: '시스템 설정', adminOnly: true },
        { to: '/mypage', icon: User, label: '마이페이지' },
      ],
    },
  ];

  // Helper to check if link is active
  const isActive = (to: string) => path === to || (to === '/cases' && path.startsWith('/case/'));

  return (
    <aside 
      className={`hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 z-30 select-none ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* 1. Header: Workspace Brand Card & Logo */}
      <div className={`border-b border-slate-200/80 dark:border-slate-800/80 ${collapsed ? 'p-3 flex flex-col items-center gap-2' : 'p-4'}`}>
        {collapsed ? (
          <>
            <img 
              src={`${import.meta.env.BASE_URL}leadmaster_logo_120.png`} 
              alt="LeadMaster Logo" 
              className="w-8 h-8 rounded-xl shadow-xs cursor-pointer hover:opacity-85 transition-opacity" 
              onClick={onToggleCollapse} 
              title="클릭하여 사이드바 펼치기" 
            />
            {org?.orgLogo ? (
              <img
                src={org.orgLogo}
                alt={orgName}
                className="w-7 h-7 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer hover:scale-105 transition-transform"
                onClick={() => {
                  if (isOwner) setIsCompanyModalOpen(true);
                  else onToggleCollapse();
                }}
                title={`${orgName} (${roleLabel})${isOwner ? ' - 클릭하여 설정' : ''}`}
              />
            ) : (
              <div 
                onClick={() => {
                  if (isOwner) setIsCompanyModalOpen(true);
                  else onToggleCollapse();
                }}
                className={`w-7 h-7 rounded-lg bg-blue-600/10 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/50 dark:border-blue-800/50 transition-transform ${isOwner ? 'cursor-pointer hover:scale-105' : ''}`}
                title={`${orgName} (${roleLabel})${isOwner ? ' - 클릭하여 설정' : ''}`}
              >
                <Building2 size={13} />
              </div>
            )}
            <button 
              onClick={onToggleCollapse}
              className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-100 dark:bg-slate-800 transition-colors"
              title="사이드바 펼치기"
            >
              <ChevronsRight size={16} />
            </button>
          </>
        ) : (
          <div className="space-y-3">
            {/* Logo row + Collapse Button */}
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2 group">
                <img 
                  src={theme === 'dark' ? `${import.meta.env.BASE_URL}leadmaster_logo_horizontal_dark.png` : `${import.meta.env.BASE_URL}leadmaster_logo_horizontal.png`} 
                  alt="LeadMaster CRM" 
                  className="h-6 w-auto object-contain shrink-0 group-hover:opacity-90 transition-opacity" 
                />
              </Link>
              <button 
                onClick={onToggleCollapse} 
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-100 dark:bg-slate-800 transition-colors shrink-0" 
                title="사이드바 접기"
              >
                <ChevronsLeft size={17} />
              </button>
            </div>

            {/* Tenant Workspace Card (회사명 & 대표 사진/로고 설정) */}
            <div 
              onClick={() => {
                if (isOwner) setIsCompanyModalOpen(true);
              }}
              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 shadow-2xs transition-all ${
                isOwner 
                  ? 'cursor-pointer group bg-slate-50 hover:bg-indigo-50/70 border-slate-200/80 hover:border-indigo-300 dark:bg-slate-800/60 dark:hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700/60 dark:hover:border-indigo-700/80' 
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60'
              }`}
              title={isOwner ? '클릭하여 회사명 및 대표 사진/로고 설정 (대표 전용)' : orgName}
            >
              <div className="flex items-center gap-2 min-w-0">
                {org?.orgLogo ? (
                  <img
                    src={org.orgLogo}
                    alt={orgName}
                    className="w-6 h-6 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-blue-600/10 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-600/20 transition-colors">
                    <Building2 size={13} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-600 dark:text-indigo-400 transition-colors" title={orgName}>
                    {orgName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isOwner && (
                  <Settings size={12} className="text-slate-500 dark:text-slate-400 opacity-60 group-hover:opacity-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-600 dark:text-indigo-400 transition-all" />
                )}
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                  org?.role === 'owner' 
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : org?.role === 'admin'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                  {roleLabel}
                </span>
              </div>
            </div>

            {/* 👑 플랫폼 호스트 전용 총괄 배너 */}
            {isPlatformAdmin && (
              <Link
                to="/platform"
                className={`p-2.5 rounded-xl flex items-center justify-between transition-all text-xs font-semibold ${
                  path === '/platform'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs border border-purple-500 font-bold'
                    : 'bg-gradient-to-r from-purple-50 to-indigo-50/80 hover:from-purple-100/90 hover:to-indigo-100/90 border border-purple-200/90 text-purple-900 shadow-2xs dark:from-purple-950/40 dark:to-indigo-950/40 dark:border-purple-500/30 dark:text-purple-200 dark:hover:text-white dark:hover:border-purple-400/60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Crown 
                    size={14} 
                    className={`shrink-0 ${
                      path === '/platform' 
                        ? 'text-amber-300' 
                        : 'text-amber-500 dark:text-amber-400'
                    }`} 
                  />
                  <span className="truncate">플랫폼 총괄 어드민</span>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0 transition-colors ${
                  path === '/platform'
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-purple-100 text-purple-700 border border-purple-300/80 dark:bg-purple-500/25 dark:text-purple-200 dark:border-purple-500/40'
                }`}>
                  HOST
                </span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* 2. Navigation: 4 Grouped Sections */}
      <nav className={`flex-1 overflow-y-auto no-scrollbar ${collapsed ? 'px-2 py-3 space-y-4' : 'px-3 py-3 space-y-4'}`}>
        {navGroups.map(group => {
          // Filter items based on user permissions
          const visibleItems = group.items.filter(item => {
            if (item.platformAdminOnly && !isPlatformAdmin) return false;
            if (item.adminOnly && !isAdmin) return false;
            // 시스템 설정(/settings): 대표/플랫폼관리자 또는 권한 위임 관리자만 노출
            if (item.to === '/settings') {
              const isOwner = org?.role === 'owner' || user?.email === (org as any)?.ownerEmail;
              if (!isOwner && !isPlatformAdmin && !org?.adminPermissions?.settings?.allowAccess) {
                return false;
              }
            }
            if (isLiteOnly) {
              const allowedInLite = ['/lite', '/training', '/notices', '/schedule', '/mypage'];
              return allowedInLite.includes(item.to);
            }
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.id} className="space-y-1">
              {!collapsed ? (
                <div className="px-2 pt-1 pb-1">
                  <p className="text-xs font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    {group.label}
                  </p>
                </div>
              ) : (
                <div className="my-1.5 mx-2 border-t border-slate-200 dark:border-slate-800" />
              )}

              {visibleItems.map(item => {
                const active = isActive(item.to);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={`relative flex items-center transition-all duration-150 group ${
                      collapsed 
                        ? 'p-2.5 justify-center rounded-xl' 
                        : 'px-3 py-2 rounded-xl justify-between'
                    } ${
                      active
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-100/60 dark:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 font-medium'
                    }`}
                  >
                    {/* Active accent bar */}
                    {active && !collapsed && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 dark:bg-blue-400 rounded-r-full" />
                    )}

                    <div className={`flex items-center ${collapsed ? '' : 'gap-2.5 min-w-0'}`}>
                      <Icon 
                        size={18} 
                        className={`shrink-0 transition-colors ${
                          active 
                            ? 'text-blue-600 dark:text-blue-400' 
                            : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-600 dark:text-slate-300'
                        }`} 
                      />
                      {!collapsed && (
                        <span className="text-xs truncate tracking-tight">{item.label}</span>
                      )}
                    </div>

                    {/* Badge */}
                    {item.badge && !collapsed && (
                      <span className="bg-rose-500 text-white text-xs font-bold px-1.5 py-0.2 rounded-full animate-pulse shadow-2xs">
                        {item.badge}
                      </span>
                    )}
                    {item.badge && collapsed && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* 3. Footer: Version & Status */}
      <div className={`border-t border-slate-200/80 dark:border-slate-800/80 ${collapsed ? 'p-2 flex justify-center' : 'p-3 flex items-center justify-between'}`}>
        {!collapsed ? (
          <div className="flex items-center justify-between w-full text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">
            <span>LeadMaster SaaS</span>
            <span className="font-mono">v3.80</span>
          </div>
        ) : (
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">v3.8</span>
        )}
      </div>

      {/* TM 대표 전용 회사 프로필/로고 설정 모달 */}
      {isOwner && (
        <CompanyProfileModal
          isOpen={isCompanyModalOpen}
          onClose={() => setIsCompanyModalOpen(false)}
          currentOrgName={orgName}
          currentOrgLogo={org?.orgLogo}
          onSave={handleSaveCompanyProfile}
        />
      )}
    </aside>
  );
};
