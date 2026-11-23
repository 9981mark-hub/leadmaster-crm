import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Building2, Search, Bell, Moon, Sun, User, LogOut, 
  ChevronDown, ExternalLink, Shield, CheckCircle2, 
  Menu, Sparkles, MessageSquare, AlertCircle, ArrowRight, Crown, LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ROLE_LABEL, getStandardRoleInfo } from '../../services/org';
import { AttendanceHeaderWidget } from '../hr/AttendanceHeaderWidget';
import { fetchOrgApplications } from '../../services/orgApplicationService';
import { fetchSeatExpansionRequests, subscribeToPlatformAlerts } from '../../services/seatExpansionService';

interface GlobalAppBarProps {
  onOpenSearch: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  pendingTgCount?: number;
}

const PAGE_TITLES: Record<string, { title: string; category: string }> = {
  '/': { title: '통합 대시보드', category: '콜 영업 / 상담' },
  '/cases': { title: '케이스 관리', category: '콜 영업 / 상담' },
  '/lite': { title: '간편 콜 모드', category: '콜 영업 / 상담' },
  '/auto-dial': { title: '스마트 오토콜 관제', category: '콜 영업 / 상담' },
  '/schedule': { title: '일정 캘린더', category: '콜 영업 / 상담' },
  '/billing': { title: '빌링 & 광고비 종합 관제', category: '정산 / 경영' },
  '/settlement': { title: '정산·손익 센터', category: '정산 / 경영' },
  '/team': { title: '팀 관리 & DB 원가', category: '정산 / 경영' },
  '/telegram': { title: 'TG 연동 센터', category: '연동 / 소통' },
  '/notices': { title: '사내 공지사항', category: '연동 / 소통' },
  '/training': { title: 'AI 트레이닝 센터', category: '연동 / 소통' },
  '/platform': { title: '회사 관리 (Host)', category: '시스템 관리' },
  '/settings': { title: '시스템 설정', category: '시스템 관리' },
  '/mypage': { title: '마이페이지 & 근태', category: '시스템 관리' },
};

export const GlobalAppBar: React.FC<GlobalAppBarProps> = ({
  onOpenSearch,
  onToggleSidebar,
  isSidebarCollapsed,
  pendingTgCount = 0,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, org, isAdmin, isPlatformAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [platformPendingCount, setPlatformPendingCount] = useState(0);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // 플랫폼 관리자용 미처리 중요 요청(좌석 증설/가입 신청) 실시간 카운트
  useEffect(() => {
    if (!isPlatformAdmin) return;
    const checkPending = async () => {
      try {
        const [apps, seats] = await Promise.all([
          fetchOrgApplications(),
          fetchSeatExpansionRequests(),
        ]);
        const pCount = (apps || []).filter(a => a.status === 'pending').length +
                       (seats || []).filter(s => s.status === 'pending').length;
        setPlatformPendingCount(pCount);
      } catch {}
    };
    checkPending();

    const unsubscribe = subscribeToPlatformAlerts(() => {
      checkPending();
    });
    return unsubscribe;
  }, [isPlatformAdmin]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine current page info
  const currentPath = location.pathname;
  let pageInfo = PAGE_TITLES[currentPath];
  if (!pageInfo && currentPath.startsWith('/case/')) {
    pageInfo = { title: '상담 상세 & 타임라인', category: '콜 영업 / 상담' };
  }
  if (!pageInfo) {
    pageInfo = { title: '리드마스터 CRM', category: '업무 공간' };
  }

  const roleInfo = getStandardRoleInfo(org?.role, org?.adminPermissions?.tier);
  const roleLabel = roleInfo.label;
  const orgName = org?.orgName || '리드마스터 CRM';
  const userInitial = user?.name ? user.name.slice(0, 1) : (user?.email?.slice(0, 1).toUpperCase() || 'U');

  return (
    <header className="sticky top-0 z-40 w-full h-14 bg-background/95 backdrop-blur-md border-b border-border transition-colors">
      <div className="h-full px-3 md:px-5 flex items-center justify-between gap-3">
        
        {/* Left: Workspace Brand Pill & Breadcrumb */}
        <div className="flex items-center gap-2.5 min-w-0">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 -ml-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors md:hidden"
              title="메뉴 열기"
            >
              <Menu size={20} strokeWidth={1.75} />
            </button>
          )}

          {/* Workspace Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-muted/60 border border-border max-w-[220px] sm:max-w-xs shrink-0 shadow-2xs">
            {org?.orgLogo ? (
              <img
                src={org.orgLogo}
                alt="Logo"
                className="w-5 h-5 rounded-md object-cover border border-border shrink-0"
              />
            ) : (
              <div className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Building2 size={13} strokeWidth={1.75} />
              </div>
            )}
            <span className="text-xs font-semibold text-foreground truncate" title={orgName}>
              {orgName}
            </span>
            <span className={`hidden sm:inline-block shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold shadow-2xs ${roleInfo.colorClass}`}>
              {roleInfo.badgeText}
            </span>
          </div>

          {/* Desktop Breadcrumb */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground min-w-0">
            <span>/</span>
            <span className="font-normal whitespace-nowrap">{pageInfo.category}</span>
            <span>›</span>
            <span className="font-semibold text-foreground truncate whitespace-nowrap">{pageInfo.title}</span>
          </div>
        </div>

        {/* Center: Global Quick Search Bar */}
        <div className="flex-1 max-w-md mx-2 hidden sm:block">
          <button
            type="button"
            onClick={onOpenSearch}
            className="w-full h-9 px-3 rounded-lg bg-muted/50 hover:bg-muted border border-input hover:border-primary/50 text-left text-xs text-muted-foreground flex items-center justify-between transition-colors shadow-2xs group cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Search size={15} strokeWidth={1.75} className="text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
              <span className="truncate">고객명, 전화번호, 메뉴 빠른 검색...</span>
            </div>
            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-card border border-border text-[11px] font-mono font-semibold text-muted-foreground shrink-0 shadow-2xs">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right Actions: Search (Mobile Icon), Notification, Commute, Theme, Profile */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          
          {/* Mobile Search Icon Button */}
          <button
            onClick={onOpenSearch}
            className="sm:hidden p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors"
            title="빠른 검색"
          >
            <Search size={18} strokeWidth={1.75} />
          </button>

          {/* Real-time Notification Popover (🔔) */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotifOpen(prev => !prev)}
              className="relative p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors"
              title="알림 센터"
            >
              <Bell size={18} strokeWidth={1.75} />
              {pendingTgCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-popover text-popover-foreground border border-border shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-3.5 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">알림 센터</span>
                    {pendingTgCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                        {pendingTgCount}건 대기
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-primary font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> 실시간 동기화
                  </span>
                </div>

                <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                  {/* Telegram Pending Notification */}
                  {pendingTgCount > 0 ? (
                    <div 
                      onClick={() => { setIsNotifOpen(false); navigate('/telegram'); }}
                      className="p-3 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <MessageSquare size={16} strokeWidth={1.75} className="text-primary shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-foreground">
                              텔레그램 실시간 피드백 확인 요청
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {pendingTgCount}건의 피드백이 고객 매칭 대기 중입니다.
                            </p>
                          </div>
                        </div>
                        <ArrowRight size={14} strokeWidth={1.75} className="text-primary group-hover:translate-x-0.5 transition-transform shrink-0" />
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center gap-2.5">
                      <CheckCircle2 size={16} strokeWidth={1.75} className="text-primary shrink-0" />
                      <p className="text-xs text-muted-foreground font-medium">
                        대기 중인 텔레그램 피드백이 모두 처리되었습니다.
                      </p>
                    </div>
                  )}

                  {/* Notice Alert */}
                  <div 
                    onClick={() => { setIsNotifOpen(false); navigate('/notices'); }}
                    className="p-3 rounded-lg bg-muted/30 hover:bg-muted border border-border transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} strokeWidth={1.75} className="text-amber-500 shrink-0" />
                      <span className="text-xs text-foreground font-medium">최신 사내 공지사항 확인</span>
                    </div>
                    <ArrowRight size={14} strokeWidth={1.75} className="text-muted-foreground" />
                  </div>
                </div>

                <div className="p-2.5 bg-muted/30 border-t border-border text-center">
                  <span className="text-[11px] text-muted-foreground">리드마스터 CRM 멀티테넌트 실시간 관제 센터</span>
                </div>
              </div>
            )}
          </div>

          {/* Commute / Attendance Widget */}
          <div className="hidden sm:block">
            <AttendanceHeaderWidget isDark={theme === 'dark'} />
          </div>

          {/* Theme Toggle (☀️ / 🌙) */}
          <button
            onClick={toggleTheme}
            className="p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors"
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} className="text-amber-400" /> : <Moon size={18} strokeWidth={1.75} className="text-muted-foreground" />}
          </button>

          {/* 👑 플랫폼 호스트 전용 슈퍼 어드민 원클릭 토글 버튼 */}
          {isPlatformAdmin && (
            <button
              onClick={() => navigate(currentPath === '/platform' ? '/' : '/platform')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                currentPath === '/platform'
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/25'
              }`}
              title={currentPath === '/platform' ? '상담 업무 대시보드로 복귀' : '플랫폼 호스트 총괄 어드민으로 이동'}
            >
              {currentPath === '/platform' ? (
                <>
                  <LayoutDashboard size={14} strokeWidth={1.75} />
                  <span className="hidden sm:inline">상담 업무 화면</span>
                </>
              ) : (
                <>
                  <Crown size={14} strokeWidth={1.75} className="text-amber-300" />
                  <span>HOST 관리국</span>
                  {platformPendingCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-2xs font-extrabold bg-destructive text-white shadow-xs animate-pulse">
                      {platformPendingCount}
                    </span>
                  )}
                </>
              )}
            </button>
          )}

          {/* User Profile Dropdown Button */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(prev => !prev)}
              className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
            >
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user?.name || '사용자'}
                  className="w-7 h-7 rounded-lg border border-border object-cover shadow-2xs shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center shadow-2xs shrink-0">
                  {userInitial}
                </div>
              )}
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-foreground max-w-[90px] truncate leading-tight">
                  {user?.name || user?.email?.split('@')[0] || '사용자'}
                </span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  {roleInfo.badgeText}
                </span>
              </div>
              <ChevronDown size={14} strokeWidth={1.75} className="hidden md:block text-muted-foreground shrink-0" />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-popover text-popover-foreground border border-border shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-3.5 border-b border-border bg-muted/30 flex items-center gap-3">
                  {user?.picture ? (
                    <img
                      src={user.picture}
                      alt={user?.name || '사용자'}
                      className="w-10 h-10 rounded-lg border border-border object-cover shadow-2xs shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center shadow-2xs shrink-0">
                      {userInitial}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{user?.name || '사용자'}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{user?.email}</p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-muted text-foreground">
                        {org?.orgLogo && (
                          <img src={org.orgLogo} alt="Logo" className="w-3 h-3 rounded-xs object-cover" />
                        )}
                        <span className="truncate max-w-[120px]">{orgName}</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shadow-2xs ${roleInfo.colorClass}`}>
                        {roleInfo.badgeText}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-1 space-y-0.5">
                  <Link
                    to="/mypage"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <User size={15} strokeWidth={1.75} className="text-muted-foreground" />
                    <span>내 프로필 & 근태 관리</span>
                  </Link>

                  {isAdmin && (
                    <Link
                      to="/settings"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      <Shield size={15} strokeWidth={1.75} className="text-muted-foreground" />
                      <span>시스템 환경 설정</span>
                    </Link>
                  )}

                  {isPlatformAdmin && (
                    <Link
                      to="/platform"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition-colors"
                    >
                      <Building2 size={15} strokeWidth={1.75} />
                      <span>플랫폼 테넌트 관리 (Host)</span>
                    </Link>
                  )}
                </div>

                <div className="p-1 border-t border-border">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      logout();
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut size={15} strokeWidth={1.75} />
                    <span>로그아웃</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
