import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, PlusCircle, Calculator, Settings, User, Moon, Sun, Loader2, Smartphone, Calendar, PhoneCall, UserCog, Building2 } from 'lucide-react';
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

const NavItem = ({ to, icon: Icon, label, active, badge }: any) => (
  <Link to={to} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${active ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
    <div className="flex items-center space-x-3">
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </div>
    {badge && (
      <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
        {badge}
      </span>
    )}
  </Link>
);

const MobileNavItem = ({ to, icon: Icon, label, active }: any) => (
  <Link to={to} className={`flex flex-col items-center justify-center w-full py-2 ${active ? 'text-blue-600' : 'text-gray-500'}`}>
    <Icon size={24} />
    <span className="text-xs mt-1">{label}</span>
  </Link>
);

// 상담원(agent)에게 숨기는 관리자 전용 화면
const ADMIN_ONLY_PATHS = ['/settlement', '/settings', '/statistics', '/team', '/platform'];

const OrgBadge: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { org } = useAuth();
  if (!org) return null;
  return (
    <div className={`flex items-center gap-1.5 ${compact ? '' : 'mt-2'}`} title={org.orgName}>
      <span className={`truncate font-semibold text-gray-600 dark:text-gray-300 ${compact ? 'max-w-[110px] text-[11px]' : 'max-w-[150px] text-xs'}`}>
        {org.orgName}
      </span>
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${org.role === 'agent' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
        {ROLE_LABEL[org.role]}
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
    const CURRENT_VERSION = "3.33";
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
    { to: '/schedule', icon: Calendar, label: '일정' },
    { to: '/cases', icon: Users, label: '케이스' },
    { to: '/new', icon: PlusCircle, label: '신규등록' },
    { to: '/telegram', icon: Smartphone, label: 'TG연동', badge: pendingTgCount > 0 ? pendingTgCount : undefined },
    { to: '/auto-dial', icon: PhoneCall, label: '자동통화' },
    { to: '/settlement', icon: Calculator, label: '정산' },
    { to: '/team', icon: UserCog, label: '팀 관리' },
    { to: '/settings', icon: Settings, label: '설정' },
    { to: '/mypage', icon: User, label: '마이' },
  ];

  // HOST(플랫폼 관리자)에게만 "회사 관리" 메뉴
  if (org?.isPlatformAdmin) navs.splice(navs.length - 2, 0, { to: '/platform', icon: Building2, label: '회사 관리' });

  const visibleNavs = isAdmin ? navs : navs.filter(n => !ADMIN_ONLY_PATHS.includes(n.to));
  // 모바일 하단 바는 칸이 좁아 자동통화·팀 관리는 뺀다 (팀 관리는 PC 화면용)
  const mobileNavs = visibleNavs.filter(n => n.to !== '/auto-dial' && n.to !== '/team' && n.to !== '/platform');

  return (
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-gray-900">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">LeadMaster</h1>
          <p className="text-xs text-gray-400 mt-1">개인회생 변제금 관리</p>
          <OrgBadge />
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {visibleNavs.map(n => <NavItem key={n.to} {...n} active={path === n.to || (path.startsWith('/case/') && n.to === '/cases')} />)}
        </nav>
        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={toggleTheme}
            className="flex items-center space-x-3 p-3 w-full rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            <span className="font-medium">{theme === 'dark' ? '라이트 모드' : '다크 모드'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Top Bar — [2026-11-02] 앱 안에서는 앱 자체 상단 바(LeadMaster·새로고침·메뉴)와 겹쳐서 숨김.
            오른쪽 자동통화 바로가기 아이콘은 삭제 (전화는 고객 번호를 누르면 걸림) */}
        {!inAndroidApp && (
          <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">LeadMaster</h1>
              <OrgBadge compact />
            </div>
          </div>
        )}

        <div id="main-scroll-container" className="flex-1 overflow-y-scroll p-4 md:p-8 pb-40 md:pb-8">
          {children}
        </div>

        {/* Bottom Nav (Mobile) */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-between px-2 pb-safe z-50">
          {mobileNavs.map(n => <MobileNavItem key={n.to} {...n} active={path === n.to || (path.startsWith('/case/') && n.to === '/cases')} />)}
        </div>
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

  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/cases" element={<CaseList />} />
          <Route path="/new" element={<QuickNewCase />} />
          <Route path="/new/full" element={<NewCase />} />
          <Route path="/case/:caseId" element={<CaseDetail />} />
          <Route path="/telegram" element={<TelegramSync />} />
          <Route path="/auto-dial" element={<AutoDial />} />
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