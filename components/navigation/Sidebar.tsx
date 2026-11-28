import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Zap, Calendar, PhoneCall, 
  Calculator, UserCog, Smartphone, Megaphone, GraduationCap, 
  Building2, Settings, User, ChevronsLeft, ChevronsRight, Shield, Crown, CreditCard,
  HelpCircle, MessageSquareHeart
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { ROLE_LABEL, getStandardRoleInfo } from '../../services/org';
import { CompanyProfileModal } from './CompanyProfileModal';
import { fetchMyInquiries, subscribeToSupportAlerts } from '../../services/supportInquiryService';

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
  const roleInfo = getStandardRoleInfo(org?.role, org?.adminPermissions?.tier);
  const roleLabel = roleInfo.label;
  const orgName = org?.orgName || '리드마스터 CRM';

  // TM대표 전용 회사 프로필/로고 설정 모달 상태
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [unreadReplyCount, setUnreadReplyCount] = useState(0);

  useEffect(() => {
    if (!org?.userId) return;
    let alive = true;
    const loadUnread = async () => {
      try {
        const list = await fetchMyInquiries(org.userId);
        if (!alive) return;
        setUnreadReplyCount(
          list.filter(i => i.status === 'answered' && !i.userReadReply).length
        );
      } catch { /* ignore */ }
    };
    loadUnread();
    const unsub = subscribeToSupportAlerts(payload => {
      if (!payload?.userId || payload.userId === org.userId) loadUnread();
    });
    const onRead = () => loadUnread();
    window.addEventListener('lm-support-reply-read', onRead);
    return () => {
      alive = false;
      unsub();
      window.removeEventListener('lm-support-reply-read', onRead);
    };
  }, [org?.userId]);

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
        { to: '/auto-dial', icon: PhoneCall, label: '오토콜 관제 센터', adminOnly: true },
        { to: '/schedule', icon: Calendar, label: '일정 캘린더' },
      ],
    },
    {
      id: 'finance',
      label: '정산 / 경영',
      items: [
        { to: '/billing', icon: CreditCard, label: '요금제·결제 & 광고비', adminOnly: true },
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
          label: '텔레그램 연동', 
          badge: pendingTgCount > 0 ? pendingTgCount : undefined 
        },
        { to: '/notices', icon: Megaphone, label: '사내 공지사항' },
        { to: '/training', icon: GraduationCap, label: '신입 교육·모의콜' },
      ],
    },
    {
      id: 'admin',
      label: '시스템 관리',
      items: [
        { to: '/platform', icon: Crown, label: '👑 플랫폼 운영자 관리', platformAdminOnly: true },
        { to: '/settings', icon: Settings, label: '시스템 설정', adminOnly: true },
        { to: '/mypage', icon: User, label: '마이페이지' },
      ],
    },
    {
      id: 'support',
      label: '지원 / 안내',
      items: [
        { to: '/faq', icon: HelpCircle, label: 'FAQ (사용 가이드)' },
        {
          to: '/inquiry',
          icon: MessageSquareHeart,
          label: '1:1 문의하기',
          badge: unreadReplyCount > 0 ? unreadReplyCount : undefined,
        },
      ],
    },
  ];

  // Helper to check if link is active
  const isActive = (to: string) => path === to || (to === '/cases' && path.startsWith('/case/'));

  return (
    <aside 
      className={`hidden md:flex flex-col bg-[#f6f7fb] dark:bg-card text-foreground border-r border-[#d0d4e4] dark:border-border transition-all duration-200 z-30 select-none ${
        collapsed ? 'w-[56px]' : 'w-60'
      }`}
    >
      {/* 1. Header: Workspace Brand Card & Logo */}
      <div className={`border-b border-[#d0d4e4] dark:border-border ${collapsed ? 'p-2.5 flex flex-col items-center gap-2' : 'p-3.5'}`}>
        {collapsed ? (
          <>
            <img 
              src={`${import.meta.env.BASE_URL}leadmaster_logo_120.png`} 
              alt="LeadMaster Logo" 
              className="w-8 h-8 rounded-lg shadow-2xs cursor-pointer hover:opacity-85 transition-opacity" 
              onClick={onToggleCollapse} 
              title="클릭하여 사이드바 펼치기" 
            />
            {org?.orgLogo ? (
              <img
                src={org.orgLogo}
                alt={orgName}
                className="w-7 h-7 rounded-[4px] object-cover border border-[#d0d4e4] dark:border-border shadow-2xs cursor-pointer hover:scale-105 transition-transform"
                onClick={() => {
                  if (isOwner) setIsCompanyModalOpen(true);
                  else onToggleCollapse();
                }}
                title={`${orgName} (${roleInfo.badgeText})${isOwner ? ' - 클릭하여 설정' : ''}`}
              />
            ) : (
              <div 
                onClick={() => {
                  if (isOwner) setIsCompanyModalOpen(true);
                  else onToggleCollapse();
                }}
                className={`w-7 h-7 rounded-[4px] bg-[#0073ea]/10 text-[#0073ea] dark:bg-primary/10 dark:text-primary flex items-center justify-center shrink-0 border border-[#0073ea]/20 dark:border-primary/20 transition-transform ${isOwner ? 'cursor-pointer hover:scale-105' : ''}`}
                title={`${orgName} (${roleInfo.badgeText})${isOwner ? ' - 클릭하여 설정' : ''}`}
              >
                <Building2 size={13} strokeWidth={1.75} />
              </div>
            )}
            <button 
              onClick={onToggleCollapse}
              className="p-1 rounded-[4px] text-[#676879] dark:text-muted-foreground hover:text-[#323338] dark:hover:text-foreground hover:bg-[#dcdfec]/40 dark:hover:bg-muted transition-colors"
              title="사이드바 펼치기"
            >
              <ChevronsRight size={16} strokeWidth={1.75} />
            </button>
          </>
        ) : (
          <div className="space-y-2.5">
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
                className="p-1.5 rounded-[4px] text-[#676879] dark:text-muted-foreground hover:text-[#323338] dark:hover:text-foreground hover:bg-[#dcdfec]/40 dark:hover:bg-muted transition-colors shrink-0" 
                title="사이드바 접기"
              >
                <ChevronsLeft size={16} strokeWidth={1.75} />
              </button>
            </div>

            {/* Tenant Workspace Card (monday White Box Style) */}
            <div 
              onClick={() => {
                if (isOwner) setIsCompanyModalOpen(true);
              }}
              className={`p-2 rounded-lg border flex items-center justify-between gap-2 transition-colors ${
                isOwner 
                  ? 'cursor-pointer group bg-white dark:bg-muted/40 hover:border-[#0073ea]/50 border-[#d0d4e4] dark:border-border shadow-2xs' 
                  : 'bg-white/80 dark:bg-muted/20 border-[#d0d4e4] dark:border-border shadow-2xs'
              }`}
              title={isOwner ? '클릭하여 회사명 및 대표 사진/로고 설정 (대표 전용)' : orgName}
            >
              <div className="flex items-center gap-2 min-w-0">
                {org?.orgLogo ? (
                  <img
                    src={org.orgLogo}
                    alt={orgName}
                    className="w-6 h-6 rounded-[4px] object-cover border border-[#d0d4e4] dark:border-border shrink-0 shadow-2xs group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-[4px] bg-[#0073ea]/10 text-[#0073ea] dark:bg-primary/10 dark:text-primary flex items-center justify-center shrink-0">
                    <Building2 size={12} strokeWidth={1.75} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-[#323338] dark:text-foreground truncate leading-tight group-hover:text-[#0073ea] dark:group-hover:text-primary transition-colors" title={orgName}>
                    {orgName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isOwner && (
                  <Settings size={11} strokeWidth={1.75} className="text-[#676879] opacity-60 group-hover:opacity-100 group-hover:text-[#0073ea] transition-all" />
                )}
                <span className={`shrink-0 rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold shadow-2xs ${roleInfo.colorClass}`}>
                  {roleInfo.badgeText}
                </span>
              </div>
            </div>

            {/* 👑 플랫폼 호스트 전용 총괄 배너 */}
            {isPlatformAdmin && (
              <Link
                to="/platform"
                className={`p-2 rounded-lg flex items-center justify-between transition-all text-xs font-semibold ${
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
                <span className={`text-[10px] px-1.5 py-0.5 rounded-[4px] font-bold shrink-0 transition-colors ${
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
      <nav className={`flex-1 overflow-y-auto no-scrollbar ${collapsed ? 'px-1.5 py-2.5 space-y-3' : 'px-2 py-2.5 space-y-3'}`}>
        {navGroups.map(group => {
          // Filter items based on user permissions
          const visibleItems = group.items.filter(item => {
            if (item.platformAdminOnly && !isPlatformAdmin) return false;
            if (item.adminOnly && !isAdmin) return false;
            if (item.to === '/settings') {
              const isOwner = org?.role === 'owner' || user?.email === (org as any)?.ownerEmail;
              if (!isOwner && !isPlatformAdmin && !org?.adminPermissions?.settings?.allowAccess) {
                return false;
              }
            }
            if (isLiteOnly) {
              const allowedInLite = ['/lite', '/training', '/notices', '/schedule', '/mypage', '/faq', '/inquiry'];
              return allowedInLite.includes(item.to);
            }
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.id} className="space-y-0.5">
              {!collapsed ? (
                <div className="px-2 pt-2 pb-1">
                  <p className="text-[11px] font-semibold tracking-wider uppercase text-[#676879] dark:text-muted-foreground">
                    {group.label}
                  </p>
                </div>
              ) : (
                <div className="my-1.5 mx-1.5 border-t border-[#d0d4e4] dark:border-border" />
              )}

              {visibleItems.map(item => {
                const active = isActive(item.to);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={`relative flex items-center transition-all duration-70 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.98] group ${
                      collapsed 
                        ? 'p-2 justify-center rounded-[4px]' 
                        : 'px-2.5 py-1.5 rounded-[4px] justify-between h-[34px]'
                    } ${
                      active
                        ? 'bg-[#cce5ff]/60 text-[#0073ea] font-semibold dark:bg-primary/10 dark:text-primary shadow-2xs'
                        : 'text-[#323338] dark:text-muted-foreground hover:bg-[#dcdfec]/40 dark:hover:bg-muted hover:text-[#0073ea] dark:hover:text-foreground font-medium'
                    }`}
                  >
                    {/* Active accent bar (3px vertical line) */}
                    {active && !collapsed && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-[#0073ea] dark:bg-primary rounded-r-full" />
                    )}

                    <div className={`flex items-center ${collapsed ? '' : 'gap-2 min-w-0'}`}>
                      <Icon 
                        size={17} 
                        strokeWidth={1.75}
                        className={`shrink-0 transition-colors ${
                          active 
                            ? 'text-[#0073ea] dark:text-primary' 
                            : 'text-[#676879] dark:text-muted-foreground group-hover:text-[#0073ea] dark:group-hover:text-foreground'
                        }`} 
                      />
                      {!collapsed && (
                        <span className="text-[13px] truncate tracking-tight">{item.label}</span>
                      )}
                    </div>

                    {/* Badge */}
                    {item.badge && !collapsed && (
                      <span className="bg-[#df2f4a] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse shadow-2xs">
                        {item.badge}
                      </span>
                    )}
                    {item.badge && collapsed && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-[#df2f4a] rounded-full animate-ping" />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* 3. Footer: Version & Status */}
      <div className={`border-t border-[#d0d4e4] dark:border-border ${collapsed ? 'p-2 flex justify-center' : 'p-2.5 flex items-center justify-between'}`}>
        {!collapsed ? (
          <div className="flex items-center justify-between w-full text-[11px] text-[#676879] dark:text-muted-foreground font-medium">
            <span>LeadMaster SaaS</span>
            <span className="font-mono">v3.80</span>
          </div>
        ) : (
          <span className="text-[10px] font-mono text-[#676879] dark:text-muted-foreground">v3.8</span>
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
