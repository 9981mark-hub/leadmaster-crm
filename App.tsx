import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Lazy Load Pages
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

// Navigation & Layout Components
import { GlobalAppBar } from './components/navigation/GlobalAppBar';
import { Sidebar } from './components/navigation/Sidebar';
import { MobileBottomBar } from './components/navigation/MobileBottomBar';
import { CommandPalette } from './components/CommandPalette';
import { NoticeBanner } from './components/NoticeBanner';
import ErrorBoundary from './components/ErrorBoundary';

// Contexts & Providers
import { ToastProvider, useToast } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ReminderProvider } from './contexts/ReminderContext';
import { ActiveCallProvider } from './contexts/ActiveCallContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Popups & Security
import ReminderNotificationContainer from './components/ReminderNotificationContainer';
import ActiveCallPopup from './components/ActiveCallPopup';
import NewCasePopup from './components/NewCasePopup';
import SecurityWatermark from './components/SecurityWatermark';

// Services
import { fetchPendingCount, subscribeTelegramFeedbacks } from './services/telegramFeedback';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { subscribe } from './services/api';
import { QUERY_KEYS } from './services/queries';
import { supabase } from './services/supabase';

// Google OAuth Client ID
const GOOGLE_CLIENT_ID = "703402707746-b3dia8784s2k1g5nfm6dpps2r75hukms.apps.googleusercontent.com";

// Route Guards
const PlatformAdminOnly: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isPlatformAdmin } = useAuth();
  return isPlatformAdmin ? children : <Navigate to="/" replace />;
};

const AdminOnly: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
};

const StandardRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAdmin, org } = useAuth();
  if (!isAdmin && org?.uiMode === 'lite_only') {
    return <Navigate to="/lite" replace />;
  }
  return children;
};

/* ========================================================
   Global Enterprise Shell Layout
   ======================================================== */
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const path = location.pathname;
  const { org } = useAuth();
  const [pendingTgCount, setPendingTgCount] = React.useState(0);
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
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

  // Real-time Telegram feedback listener
  useEffect(() => {
    fetchPendingCount().then(res => setPendingTgCount(res.total));
    const channel = subscribeTelegramFeedbacks((fb) => {
      if (fb.applyMode === 'pending' && !fb.isConfirmed) {
        setPendingTgCount(prev => prev + 1);
      }
    });
    return () => { if (channel) channel.unsubscribe(); };
  }, []);

  // Aggressive scroll guard using requestAnimationFrame
  useEffect(() => {
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

    const guardScroll = () => {
      const timeSinceUserScroll = Date.now() - lastUserScrollTime;
      if (
        !isUserScrolling &&
        timeSinceUserScroll > 200 &&
        container.scrollTop === 0 &&
        lastStableScrollTop > 50
      ) {
        container.scrollTop = lastStableScrollTop;
      } else if (container.scrollTop > 0) {
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
  useEffect(() => {
    const container = document.getElementById('main-scroll-container');
    if (container) {
      container.scrollTop = 0;
    }
  }, [path]);

  // Version Cache Buster
  useEffect(() => {
    const CURRENT_VERSION = "3.80";
    const savedVersion = localStorage.getItem("app_version");
    if (savedVersion !== CURRENT_VERSION) {
      console.log(`Version mismatch! Saved: ${savedVersion}, Current: ${CURRENT_VERSION}. Forcing reload.`);
      localStorage.setItem("app_version", CURRENT_VERSION);
      window.location.reload();
    }
  }, []);

  return (
    <div className="flex h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* 1. Desktop Grouped Sidebar */}
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggleCollapse={toggleSidebar} 
        pendingTgCount={pendingTgCount} 
      />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Global App Bar (Workspace Switcher, Search, Notifications, Commute, Profile) */}
        <GlobalAppBar 
          onOpenSearch={() => setIsCmdPaletteOpen(true)}
          isSidebarCollapsed={sidebarCollapsed}
          pendingTgCount={pendingTgCount}
        />

        <NoticeBanner />

        {/* Scrollable Work Area with 150ms Micro Page Transition */}
        <div 
          id="main-scroll-container" 
          key={path}
          className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-32 md:pb-8 animate-page-in focus:outline-none"
        >
          {children}
        </div>

        {/* 3. Mobile Bottom Navigation Bar (Thumb Zone) */}
        <MobileBottomBar pendingTgCount={pendingTgCount} />

        {/* 4. Global Command Palette (Ctrl+K) */}
        <CommandPalette 
          isOpen={isCmdPaletteOpen} 
          onClose={() => setIsCmdPaletteOpen(false)} 
        />
      </div>
    </div>
  );
};

/* ========================================================
   Protected Application Routes
   ======================================================== */
const ProtectedRoutes = () => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  // Realtime Cache Invalidation
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cases });
      queryClient.invalidateQueries({ queryKey: ['case'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.partners });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inboundPaths });
    });
    return () => unsubscribe();
  }, [queryClient]);

  // Auto-Dial Mobile-to-PC Remote Sync
  useEffect(() => {
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

  // Session guard for Lite Mode
  if (location.pathname.startsWith('/case/')) {
    if (sessionStorage.getItem('lm_lite_mode_active') === 'true') {
      const match = location.pathname.match(/\/case\/([^/]+)/);
      const targetCaseId = match ? match[1] : '';
      return <Navigate to={`/lite?caseId=${targetCaseId}`} replace />;
    }
  }

  // Lite Call Page dedicated fullscreen
  if (location.pathname === '/lite') {
    return (
      <ErrorBoundary>
        <Suspense fallback={
          <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
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
          <Route path="/platform" element={<PlatformAdminOnly><PlatformPage /></PlatformAdminOnly>} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
};

/* ========================================================
   Root Application & Providers
   ======================================================== */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const isGitHubPages = typeof window !== 'undefined' && (
  window.location.hostname.includes('github.io') ||
  window.location.pathname.startsWith('/leadmaster-crm')
);

function HashRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      const cleanPath = window.location.hash.replace(/^#/, '');
      navigate(cleanPath, { replace: true });
    }
  }, [navigate]);
  return null;
}

export default function App() {
  const RouterComponent = isGitHubPages ? HashRouter : BrowserRouter;

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <RouterComponent>
          {!isGitHubPages && <HashRedirect />}
          <ToastProvider>
            <ThemeProvider>
              <AuthProvider>
                <ReminderProvider>
                  <ActiveCallProvider>
                    <Suspense fallback={
                      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
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
                      <SecurityWatermark />
                    </Suspense>
                  </ActiveCallProvider>
                </ReminderProvider>
              </AuthProvider>
            </ThemeProvider>
          </ToastProvider>
        </RouterComponent>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}
