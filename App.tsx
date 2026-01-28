import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, PlusCircle, Calculator, Settings, User, Moon, Sun, Loader2 } from 'lucide-react';
// Lazy Load Pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CaseList = lazy(() => import('./pages/CaseList'));
const NewCase = lazy(() => import('./pages/NewCase'));
const CaseDetail = lazy(() => import('./pages/CaseDetail'));
const Settlement = lazy(() => import('./pages/Settlement'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const Statistics = lazy(() => import('./pages/Statistics'));
const MyPage = lazy(() => import('./pages/MyPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useToast } from './contexts/ToastContext'; // Import hook
import { ReminderProvider } from './contexts/ReminderContext';
import ReminderNotificationContainer from './components/ReminderNotificationContainer';
import NewCasePopup from './components/NewCasePopup';


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

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const path = location.pathname;
  const { theme, toggleTheme } = useTheme();

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
  // [NEW] Global Focus / Visibility Listener for Immediate Sync
  React.useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        import('./services/api').then(({ refreshData }) => {
          console.log("[App] Window focused, refreshing data...");
          refreshData();
        });
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    // [CRITICAL] Cache Buster / Force Version Update
    const CURRENT_VERSION = "3.11";
    const savedVersion = localStorage.getItem("app_version");
    if (savedVersion !== CURRENT_VERSION) {
      console.log(`Version mismatch! Saved: ${savedVersion}, Current: ${CURRENT_VERSION}. Forcing reload.`);
      localStorage.setItem("app_version", CURRENT_VERSION);
      // Clear potential stale keys if needed, but keeping auth
      window.location.reload();
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);


  const navs = [
    { to: '/', icon: LayoutDashboard, label: '대시보드' },
    { to: '/cases', icon: Users, label: '케이스' },
    { to: '/new', icon: PlusCircle, label: '신규등록' },
    { to: '/settlement', icon: Calculator, label: '정산' },
    { to: '/settings', icon: Settings, label: '설정' },
    { to: '/mypage', icon: User, label: '마이페이지' },
  ];

  return (
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-gray-900">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">LeadMaster</h1>
          <p className="text-xs text-gray-400 mt-1">개인회생 변제금 관리</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navs.map(n => <NavItem key={n.to} {...n} active={path === n.to || (path.startsWith('/case/') && n.to === '/cases')} />)}
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
        <div id="main-scroll-container" className="flex-1 overflow-y-scroll p-4 md:p-8 pb-40 md:pb-8">
          {children}
        </div>

        {/* Bottom Nav (Mobile) */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-between px-2 pb-safe z-50">
          {navs.map(n => <MobileNavItem key={n.to} {...n} active={path === n.to || (path.startsWith('/case/') && n.to === '/cases')} />)}
        </div>
      </main>
    </div>
  );
};

import ErrorBoundary from './components/ErrorBoundary';

import { useQueryClient } from '@tanstack/react-query';
import { subscribe } from './services/api';
import { QUERY_KEYS } from './services/queries';

const ProtectedRoutes = () => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // [Realtime Sync] Invalidate Cache on Data Change
  React.useEffect(() => {
    const unsubscribe = subscribe(() => {
      // console.log("[App] Data updated via Realtime/Sync, refreshing UI...");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cases });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.partners });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inboundPaths });
    });
    return () => unsubscribe();
  }, [queryClient]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cases" element={<CaseList />} />
          <Route path="/new" element={<NewCase />} />
          <Route path="/case/:caseId" element={<CaseDetail />} />
          <Route path="/settlement" element={<Settlement />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/settings" element={<SettingsPage />} />
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
      refetchOnWindowFocus: true,
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
                    <NewCasePopup />
                  </Suspense>
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