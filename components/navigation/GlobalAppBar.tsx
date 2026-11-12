import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Building2, Search, Bell, Moon, Sun, User, LogOut, 
  ChevronDown, ExternalLink, Shield, CheckCircle2, 
  Menu, Sparkles, MessageSquare, AlertCircle, ArrowRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ROLE_LABEL } from '../../services/org';
import { AttendanceHeaderWidget } from '../hr/AttendanceHeaderWidget';

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

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

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

  const roleLabel = org?.role ? ROLE_LABEL[org.role] : '상담원';
  const orgName = org?.orgName || '리드마스터 CRM';
  const userInitial = user?.name ? user.name.slice(0, 1) : (user?.email?.slice(0, 1).toUpperCase() || 'U');

  return (
    <header className="sticky top-0 z-40 w-full h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="h-full px-3 md:px-5 flex items-center justify-between gap-3">
        
        {/* Left: Workspace Brand Pill & Breadcrumb */}
        <div className="flex items-center gap-2.5 min-w-0">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 -ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors md:hidden"
              title="메뉴 열기"
            >
              <Menu size={20} />
            </button>
          )}

          {/* Workspace Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 max-w-[200px] sm:max-w-xs shrink-0 shadow-2xs">
            <div className="w-5 h-5 rounded-md bg-blue-600/10 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Building2 size={13} />
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={orgName}>
              {orgName}
            </span>
            <span className={`hidden sm:inline-block shrink-0 px-1.5 py-0.2 rounded text-[10px] font-bold ${
              org?.role === 'owner' 
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                : org?.role === 'admin'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
            }`}>
              {roleLabel}
            </span>
          </div>

          {/* Desktop Breadcrumb */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 min-w-0">
            <span>/</span>
            <span className="text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">{pageInfo.category}</span>
            <span>›</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 truncate whitespace-nowrap">{pageInfo.title}</span>
          </div>
        </div>

        {/* Center: Global Quick Search Bar */}
        <div className="flex-1 max-w-md mx-2 hidden sm:block">
          <button
            type="button"
            onClick={onOpenSearch}
            className="w-full h-9 px-3 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 text-left text-xs text-slate-400 dark:text-slate-400 flex items-center justify-between transition-all shadow-2xs group cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Search size={15} className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0 transition-colors" />
              <span className="truncate">고객명, 전화번호, 메뉴 빠른 검색...</span>
            </div>
            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-300 shrink-0 shadow-2xs">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right Actions: Search (Mobile Icon), Notification, Commute, Theme, Profile */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          
          {/* Mobile Search Icon Button */}
          <button
            onClick={onOpenSearch}
            className="sm:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="빠른 검색"
          >
            <Search size={18} />
          </button>

          {/* Real-time Notification Popover (🔔) */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotifOpen(prev => !prev)}
              className="relative p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="알림 센터"
            >
              <Bell size={18} />
              {pendingTgCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">알림 센터</span>
                    {pendingTgCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                        {pendingTgCount}건 대기
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 실시간 동기화
                  </span>
                </div>

                <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                  {/* Telegram Pending Notification */}
                  {pendingTgCount > 0 ? (
                    <div 
                      onClick={() => { setIsNotifOpen(false); navigate('/telegram'); }}
                      className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80 hover:bg-blue-100/80 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <MessageSquare size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                              텔레그램 실시간 피드백 확인 요청
                            </p>
                            <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                              {pendingTgCount}건의 피드백이 고객 매칭 대기 중입니다.
                            </p>
                          </div>
                        </div>
                        <ArrowRight size={14} className="text-blue-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center gap-2.5">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        대기 중인 텔레그램 피드백이 모두 처리되었습니다.
                      </p>
                    </div>
                  )}

                  {/* Notice Alert */}
                  <div 
                    onClick={() => { setIsNotifOpen(false); navigate('/notices'); }}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-100 dark:border-slate-700/60 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-500 shrink-0" />
                      <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">최신 사내 공지사항 확인</span>
                    </div>
                    <ArrowRight size={14} className="text-slate-400" />
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50/80 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700/60 text-center">
                  <span className="text-[11px] text-slate-400">리드마스터 CRM 멀티테넌트 실시간 관제 센터</span>
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
            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
          </button>

          {/* User Profile Dropdown Button */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(prev => !prev)}
              className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                {userInitial}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 max-w-[90px] truncate leading-tight">
                  {user?.name || user?.email?.split('@')[0] || '사용자'}
                </span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  {roleLabel}
                </span>
              </div>
              <ChevronDown size={14} className="hidden md:block text-slate-400 shrink-0" />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{user?.name || '사용자'}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{user?.email}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      {orgName}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {roleLabel}
                    </span>
                  </div>
                </div>

                <div className="p-1.5 space-y-0.5">
                  <Link
                    to="/mypage"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                  >
                    <User size={15} className="text-slate-400" />
                    <span>내 프로필 & 근태 관리</span>
                  </Link>

                  {isAdmin && (
                    <Link
                      to="/settings"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                    >
                      <Shield size={15} className="text-slate-400" />
                      <span>시스템 환경 설정</span>
                    </Link>
                  )}

                  {isPlatformAdmin && (
                    <Link
                      to="/platform"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                    >
                      <Building2 size={15} />
                      <span>플랫폼 테넌트 관리 (Host)</span>
                    </Link>
                  )}
                </div>

                <div className="p-1.5 border-t border-slate-100 dark:border-slate-700/60">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      logout();
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <LogOut size={15} />
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
