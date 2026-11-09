import React, { Suspense, lazy, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, PlusCircle, Calculator, Settings, User, Moon, Sun, Loader2, Smartphone, Calendar, PhoneCall, UserCog, Building2, ChevronsLeft, ChevronsRight, BarChart3, Grid3X3, X, Zap, Megaphone, GraduationCap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Lazy Load Pages (신규 배포 시 청크 404 에러 자동 복구 래퍼 적용)
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const SchedulePage = lazyWithRetry(() => import('./pages/SchedulePage'));
const CaseList = lazyWithRetry(() => import('./pages/CaseList'));
const NewCase = lazyWithRetry(() => import('./pages/NewCase'));
const QuickNewCase = lazyWithRetry(() => import('./pages/QuickNewCase'));
const CaseDetail = lazyWithRetry(() => import('./pages/CaseDetail'));
const Settlement = lazyWithRetry(() => import('./pages/Settlement'));
const SettingsPage = lazyWithRetry(() => import('./pages/Settings'));
const Statistics = lazyWithRetry(() => import('./pages/Statistics'));
const MyPage = lazyWithRetry(() => import('./pages/MyPage'));
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage'));
const TelegramSync = lazyWithRetry(() => import('./pages/TelegramSync'));
const AutoDial = lazyWithRetry(() => import('./pages/AutoDial'));
const TeamPage = lazyWithRetry(() => import('./pages/TeamPage'));
const PlatformPage = lazyWithRetry(() => import('./pages/PlatformPage'));
const LiteCallPage = lazyWithRetry(() => import('./pages/LiteCallPage'));
const NoticePage = lazyWithRetry(() => import('./pages/NoticePage'));
const TrainingCenterPage = lazyWithRetry(() => import('./pages/TrainingCenterPage'));
import { NoticeBanner } from './components/NoticeBanner';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ROLE_LABEL } from './services/org';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useToast } from './contexts/ToastContext'; // Import hook
import { ReminderProvider } from './contexts/ReminderContext';
import { ActiveCallProvider } from './contexts/ActiveCallContext';
import ReminderNotificationContainer from './components/ReminderNotificationContainer';
import ActiveCallPopup from './components/ActiveCallPopup';
import NewCasePopup from './components/NewCasePopup';
import { fetchPendingCount, subscribeTelegramFeedbacks } from './services/telegramFeedback';


// *** 중요: Google Cloud Console에서 발급받은 실제 Client ID로 교체해야 합니다 ***
// 예: "1234567890-abcdefg.apps.googleusercontent.com"
const GOOGLE_CLIENT_ID = "703402707746-b3dia8784s2k1g5nfm6dpps2r75hukms.apps.googleusercontent.com";

/* ── Sidebar NavItem (collapsed 지원 + 액티브 인디케이터) ── */
const NavItem = ({ to, icon: Icon, label, active, badge, collapsed }: any) => (
  <Link to={to} className={`relative flex items-center justify-between rounded-lg transition-all duration-200 ${collapsed ? 'p-2.5 justify-center' : 'px-3 py-2.5'} ${active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'}`} title={collapsed ? label : undefined}>
    {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-600 dark:bg-blue-400 rounded-r-full" />}
    <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
      <Icon size={20} className="shrink-0" />
      {!collapsed && <span className="text-sm">{label}</span>}
    </div>
    {badge && !collapsed && (
      <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
        {badge}
      </span>
    )}
    {badge && collapsed && (
      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
    )}
  </Link>
);

const NavGroup = ({ label, collapsed, children }: { label: string; collapsed: boolean; children: React.ReactNode }) => (
  <div className="space-y-0.5">
    {!collapsed && <p className="px-3 pt-4 pb-1 text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500">{label}</p>}
    {collapsed && <div className="my-2 mx-2 border-t border-gray-100 dark:border-gray-700" />}
    {children}
  </div>
);

/* ── Mobile Bottom Nav ── */
const MobileNavItem = ({ to, icon: Icon, label, active }: any) => {
  const isLite = to === '/lite';
  return (
    <Link
      to={to}
      className={`flex flex-col items-center justify-center py-2 min-w-[56px] transition-colors ${
        active
          ? isLite ? 'text-amber-500 font-bold' : 'text-blue-600 dark:text-blue-400 font-bold'
          : isLite ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-400 dark:text-gray-500'
      }`}
    >
      <div className={isLite ? 'relative' : ''}>
        <Icon size={21} className={isLite ? 'text-amber-500 fill-amber-500/20' : ''} />
      </div>
      <span className="text-[10px] mt-0.5 whitespace-nowrap">{label}</span>
    </Link>
  );
};

/* ── 더보기 그리드 메뉴 (모바일) ── */
const MobileMoreMenu = ({ navs, path, onClose }: { navs: any[]; path: string; onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
    className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end"
    onClick={onClose}
  >
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 400 }}
      className="w-full bg-white dark:bg-gray-800 rounded-t-2xl p-6 pb-safe shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">메뉴</h3>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
          <X size={20} className="text-gray-500" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {navs.map(n => (
          <Link
            key={n.to}
            to={n.to}
            onClick={onClose}
            className={`flex flex-col items-center gap-2 py-3 px-2 rounded-xl transition-colors ${
              path === n.to ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className={`p-2.5 rounded-xl ${path === n.to ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <n.icon size={22} />
            </div>
            <span className="text-xs font-medium">{n.label}</span>
          </Link>
        ))}
      </div>
    </motion.div>
  </motion.div>
);

// 상담원(agent)에게 숨기는 관리자 전용 화면
const ADMIN_ONLY_PATHS = ['/settlement', '/settings', '/statistics', '/team', '/platform', '/telegram', '/auto-dial'];

const PlatformAdminOnly: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { org } = useAuth();
  return org?.isPlatformAdmin ? children : <Navigate to="/" replace />;
};

const StandardRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAdmin, org } = useAuth();
  if (!isAdmin && org?.uiMode === 'lite_only') {
    return <Navigate to="/lite" replace />;
  }
  return children;
};

const OrgBadge: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { org } = useAuth();
  if (!org) return null;
  return (
    <div className={`flex items-center gap-1.5 ${compact ? '' : 'mt-2'}`} title={org.orgName}>
      <span className={`truncate font-semibold text-gray-600 dark:text-gray-300 ${compact ? 'max-w-[110px] text-[11px]' : 'max-w-[150px] text-xs'}`}>
        {org.orgName}
      </span>
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
        org.role === 'agent' 
          ? (org.uiMode === 'lite_only' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300')
          : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      }`}>
        {org.role === 'agent' && org.uiMode === 'lite_only' ? '신입 (간편콜)' : ROLE_LABEL[org.role]}
      </span>
    </div>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const path = location.pathname;
  const { theme, toggleTheme } = useTheme();
  const { isAdmin, org } = useAuth();
  const [pendingTgCount, setPendingTgCount] = React.useState(0);

  React.useEffect(() => {
    fetchPendingCount().then(res => setPendingTgCount(res.total));
    const channel = subscribeTelegramFeedbacks((fb) => {
      if (fb.applyMode === 'pending' && !fb.isConfirmed) {
         setPendingTgCount(prev => prev + 1);
      }
    });
    return () => { if(channel) channel.unsubscribe(); }
  }, []);

  React.useEffect(() => {
    const container = document.getElementById('main-scroll-container');
    if (!container) return;

    let scrollTimeout: any;
    let rafId: number;
    let lastStableScrollTop = 0;
    let isUserScrolling = false;
    let lastUserScrollTime = Date.now();

    const handleScroll = () => {
      lastStableScrollTop = container.scrollTop;
      isUserScrolling = true;
      lastUserScrollTime = Date.now();

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isUserScrolling = false;
      }, 200);
    };

    // Aggressive scroll guard using requestAnimationFrame
    const guardScroll = () => {
      const timeSinceUserScroll = Date.now() - lastUserScrollTime;

      // If scroll jumped to 0 unexpectedly and we had a scroll position
      if (
        !isUserScrolling &&
        timeSinceUserScroll > 200 &&
        container.scrollTop === 0 &&
        lastStableScrollTop > 50
      ) {
        // Immediately restore scroll position
        container.scrollTop = lastStableScrollTop;
      } else if (container.scrollTop > 0) {
        // Update stable position when user is at new position
        lastStableScrollTop = container.scrollTop;
      }

      rafId = requestAnimationFrame(guardScroll);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    rafId = requestAnimationFrame(guardScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafId);
      clearTimeout(scrollTimeout);
    };
  }, []);

  // Reset scroll on route change
  React.useEffect(() => {
    const container = document.getElementById('main-scroll-container');
    if (container) {
      container.scrollTop = 0;
    }
  }, [path]);
  /* 
    Poling Logic removed (handled in CaseList now)
  */
  // [EGRESS FIX] Window Focus 리스너 제거 - Realtime이 실시간 동기화를 담당하므로
  // 탭 전환마다 전체 DB를 재다운로드하는 것은 대역폭 낭비
  // (기존: window focus → refreshData() → 전체 cases 재조회)

  // [CRITICAL] Cache Buster / Force Version Update
  React.useEffect(() => {
    const CURRENT_VERSION = "3.61";
    const savedVersion = localStorage.getItem("app_version");
    if (savedVersion !== CURRENT_VERSION) {
      console.log(`Version mismatch! Saved: ${savedVersion}, Current: ${CURRENT_VERSION}. Forcing reload.`);
      localStorage.setItem("app_version", CURRENT_VERSION);
      // Clear potential stale keys if needed, but keeping auth
      window.location.reload();
    }
  }, []);


  // 안드로이드 앱(WebView) 안인지: 앱은 자기 상단 바가 있다
  const inAndroidApp = React.useMemo(() => {
    try { return !!window.AndroidBridge?.isAndroidApp?.(); } catch { return false; }
  }, []);

  const navs = [
    { to: '/', icon: LayoutDashboard, label: '대시보드' },
    { to: '/notices', icon: Megaphone, label: '공지사항' },
    { to: '/training', icon: GraduationCap, label: '트레이닝' },
    { to: '/schedule', icon: Calendar, label: '일정' },
    { to: '/cases', icon: Users, label: '케이스' },
    { to: '/lite', icon: Zap, label: '간편 콜 모드' },
    { to: '/new', icon: PlusCircle, label: '신규등록' },
    { to: '/telegram', icon: Smartphone, label: 'TG연동', badge: pendingTgCount > 0 ? pendingTgCount : undefined },
    { to: '/settlement', icon: Calculator, label: '정산' },
    { to: '/team', icon: UserCog, label: '팀 관리' },
    { to: '/settings', icon: Settings, label: '설정' },
    { to: '/mypage', icon: User, label: '마이' },
  ];

  // HOST(플랫폼 최고관리자/대표님)에게만 미공개 기능 "자동통화" 및 "회사 관리" 메뉴 노출
  if (org?.isPlatformAdmin) {
    navs.splice(navs.length - 3, 0, { to: '/auto-dial', icon: PhoneCall, label: '자동통화' });
    navs.splice(navs.length - 2, 0, { to: '/platform', icon: Building2, label: '회사 관리' });
  }

  const isLiteOnly = !isAdmin && org?.uiMode === 'lite_only';

  let visibleNavs: any[];
  if (isAdmin) {
    visibleNavs = navs;
  } else if (isLiteOnly) {
    // 신입 상담원 간편콜 전용 모드: 간편콜, 트레이닝, 공지사항, 일정, 마이페이지만 노출
    const LITE_ONLY_PATHS = ['/lite', '/training', '/notices', '/schedule', '/mypage'];
    visibleNavs = navs.filter(n => LITE_ONLY_PATHS.includes(n.to));
  } else {
    visibleNavs = navs.filter(n => !ADMIN_ONLY_PATHS.includes(n.to));
  }

  // 모바일 하단 바
  const MOBILE_CORE_PATHS = isLiteOnly ? ['/lite', '/training', '/notices', '/mypage'] : ['/', '/cases', '/lite', '/new'];
  const mobileCoreTabs = visibleNavs.filter(n => MOBILE_CORE_PATHS.includes(n.to));
  const mobileMoreItems = isLiteOnly ? [] : visibleNavs.filter(n => !MOBILE_CORE_PATHS.includes(n.to));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebar_collapsed', String(next)); } catch {}
      return next;
    });
  };

  return (
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-gray-900">
      {/* Sidebar (Desktop) — 축소 토글 + 메뉴 그룹핑 */}
      <aside className={`hidden md:flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${sidebarCollapsed ? 'w-[72px]' : 'w-60'}`}>
        <div className={`flex items-center border-b border-gray-100 dark:border-gray-700 ${sidebarCollapsed ? 'justify-center p-4' : 'justify-between p-5'}`}>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-800 dark:text-white tracking-tight">LeadMaster</h1>
              <OrgBadge />
            </div>
          )}
          <button onClick={toggleSidebar} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0" title={sidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기'}>
            {sidebarCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>
        <nav className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'px-2 py-3' : 'px-3 py-2'} space-y-0.5`}>
          {(() => {
            const isActive = (to: string) => path === to || (path.startsWith('/case/') && to === '/cases');
            const workNavPaths = isLiteOnly ? ['/lite', '/training', '/notices', '/schedule'] : ['/', '/notices', '/training', '/schedule', '/cases', '/lite', '/new'];
            const opsNavPaths = ['/telegram', '/auto-dial', '/settlement'];
            const adminNavPaths = isLiteOnly ? ['/mypage'] : ['/statistics', '/team', '/platform', '/settings', '/mypage'];
            const workNavs = visibleNavs.filter(n => workNavPaths.includes(n.to));
            const opsNavs = visibleNavs.filter(n => opsNavPaths.includes(n.to));
            const adminNavs = visibleNavs.filter(n => adminNavPaths.includes(n.to));
            return (
              <>
                <NavGroup label="업무" collapsed={sidebarCollapsed}>
                  {workNavs.map(n => <NavItem key={n.to} {...n} active={isActive(n.to)} collapsed={sidebarCollapsed} />)}
                </NavGroup>
                {opsNavs.length > 0 && (
                  <NavGroup label="운영" collapsed={sidebarCollapsed}>
                    {opsNavs.map(n => <NavItem key={n.to} {...n} active={isActive(n.to)} collapsed={sidebarCollapsed} />)}
                  </NavGroup>
                )}
                {adminNavs.length > 0 && (
                  <NavGroup label="관리" collapsed={sidebarCollapsed}>
                    {adminNavs.map(n => <NavItem key={n.to} {...n} active={isActive(n.to)} collapsed={sidebarCollapsed} />)}
                  </NavGroup>
                )}
              </>
            );
          })()}
        </nav>
        <div className={`border-t border-gray-100 dark:border-gray-700 ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
          <button
            onClick={toggleTheme}
            className={`flex items-center w-full rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${sidebarCollapsed ? 'p-2.5 justify-center' : 'gap-3 px-3 py-2.5'}`}
            title={sidebarCollapsed ? (theme === 'dark' ? '라이트 모드' : '다크 모드') : undefined}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            {!sidebarCollapsed && <span className="text-sm">{theme === 'dark' ? '라이트 모드' : '다크 모드'}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <NoticeBanner />
        {/* Mobile Top Bar — [2026-11-02] 앱 안에서는 앱 자체 상단 바(LeadMaster·새로고침·메뉴)와 겹쳐서 숨김.
            오른쪽 자동통화 바로가기 아이콘은 삭제 (전화는 고객 번호를 누르면 걸림) */}
        {!inAndroidApp && (
          <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">LeadMaster</h1>
              <OrgBadge compact />
            </div>
            <Link
              to="/lite"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-lg shadow-sm active:scale-95 transition-all"
            >
              <Zap size={14} className="fill-white" />
              <span>간편모드</span>
            </Link>
          </div>
        )}

        <div id="main-scroll-container" className="flex-1 overflow-y-scroll p-4 md:p-8 pb-40 md:pb-8">
          {children}
        </div>

        {/* Bottom Nav (Mobile) — 핵심 3개 + 더보기 */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 flex items-center justify-around px-2 pb-safe z-50">
          {mobileCoreTabs.map(n => <MobileNavItem key={n.to} {...n} active={path === n.to || (path.startsWith('/case/') && n.to === '/cases')} />)}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className={`flex flex-col items-center justify-center py-2 min-w-[64px] ${isMobileMenuOpen ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
          >
            <Grid3X3 size={22} />
            <span className="text-[10px] mt-1 font-medium">더보기</span>
          </button>
        </div>
        <AnimatePresence>
          {isMobileMenuOpen && <MobileMoreMenu navs={mobileMoreItems} path={path} onClose={() => setIsMobileMenuOpen(false)} />}
        </AnimatePresence>
      </main>
    </div>
  );
};

import ErrorBoundary from './components/ErrorBoundary';

import { useQueryClient } from '@tanstack/react-query';
import { subscribe } from './services/api';
import { QUERY_KEYS } from './services/queries';
import { supabase } from './services/supabase';
import { useNavigate } from 'react-router-dom';

const AdminOnly: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
};

const ProtectedRoutes = () => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  // [Realtime Sync] Invalidate Cache on Data Change
  React.useEffect(() => {
    const unsubscribe = subscribe(() => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cases });
      // [SYNC FIX] 개별 케이스 상세 쿼리도 무효화 (접두사 매칭)
      queryClient.invalidateQueries({ queryKey: ['case'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.partners });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inboundPaths });
    });
    return () => unsubscribe();
  }, [queryClient]);

  // [Auto-Dial Sync] 모바일: PC에서 배치 시작 시 자동 이동
  React.useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) 
      || !!(window as any).AndroidBridge?.makeCall;
    if (!supabase || !isMobile) return;

    const channel = supabase
      .channel('auto_dial_remote_start')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'auto_dial_batches',
        filter: 'status=eq.running',
      }, (payload: any) => {
        console.log('[AutoDial] Remote start detected:', payload.new?.name);
        // 이미 auto-dial 페이지면 AutoDialDashboard의 useEffect가 처리
        if (location.pathname !== '/auto-dial') {
          navigate('/auto-dial');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, location.pathname]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 간편 모드 세션 보호: 안드로이드 오버레이나 외부 호출에 의해 통화 종료 후 /case/:id로 튕기는 현상 방지
  if (location.pathname.startsWith('/case/')) {
    if (sessionStorage.getItem('lm_lite_mode_active') === 'true') {
      const match = location.pathname.match(/\/case\/([^/]+)/);
      const targetCaseId = match ? match[1] : '';
      return <Navigate to={`/lite?caseId=${targetCaseId}`} replace />;
    }
  }

  // 간편 모드(/lite): 모바일 엄지 영역 및 전용 전체화면 제공
  if (location.pathname === '/lite') {
    return (
      <ErrorBoundary>
        <Suspense fallback={
          <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
            <Loader2 className="animate-spin text-amber-500" size={32} />
          </div>
        }>
          <LiteCallPage />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<StandardRoute><Dashboard /></StandardRoute>} />
          <Route path="/notices" element={<NoticePage />} />
          <Route path="/training" element={<TrainingCenterPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/cases" element={<StandardRoute><CaseList /></StandardRoute>} />
          <Route path="/lite" element={<LiteCallPage />} />
          <Route path="/new" element={<StandardRoute><QuickNewCase /></StandardRoute>} />
          <Route path="/new/full" element={<StandardRoute><NewCase /></StandardRoute>} />
          <Route path="/case/:caseId" element={<StandardRoute><CaseDetail /></StandardRoute>} />
          <Route path="/telegram" element={<AdminOnly><TelegramSync /></AdminOnly>} />
          <Route path="/auto-dial" element={<PlatformAdminOnly><AutoDial /></PlatformAdminOnly>} />
          <Route path="/settlement" element={<AdminOnly><Settlement /></AdminOnly>} />
          <Route path="/statistics" element={<AdminOnly><Statistics /></AdminOnly>} />
          <Route path="/settings" element={<AdminOnly><SettingsPage /></AdminOnly>} />
          <Route path="/team" element={<AdminOnly><TeamPage /></AdminOnly>} />
          <Route path="/platform" element={<AdminOnly><PlatformPage /></AdminOnly>} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
};


import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false, // [EGRESS FIX] Realtime이 동기화 담당, Focus 재조회 비활성화
    },
  },
});

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <ToastProvider>
            <ThemeProvider>
              <AuthProvider>
                <ReminderProvider>
                  <ActiveCallProvider>
                  <Suspense fallback={
                    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
                      <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                    </div>
                  }>
                    <Routes>
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/*" element={<ProtectedRoutes />} />
                    </Routes>
                    <ReminderNotificationContainer />
                    <ActiveCallPopup />
                    <NewCasePopup />
                  </Suspense>
                  </ActiveCallProvider>
                </ReminderProvider>
              </AuthProvider>
            </ThemeProvider>
          </ToastProvider>
        </HashRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}