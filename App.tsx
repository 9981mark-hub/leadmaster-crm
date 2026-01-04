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
const MyPage = lazy(() => import('./pages/MyPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useToast } from './contexts/ToastContext'; // Import hook
import { fetchNewLeads } from './services/api'; // Import api

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
  /* 
    Poling Logic with imported hooks 
  */
  const { showToast } = useToast();
  const [newLeadsCount, setNewLeadsCount] = React.useState(0);

  React.useEffect(() => {
    // Polling for new leads
    const pollLeads = async () => {
      try {
        const newLeads = await fetchNewLeads();
        if (newLeads.length > 0) {
          setNewLeadsCount(prev => prev + newLeads.length);
          showToast(`새로운 리드 ${newLeads.length}건이 도착했습니다!`, 'success');
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    };

    const interval = setInterval(pollLeads, 15000); // Check every 15 sec for demo
    return () => clearInterval(interval);
  }, [showToast]);

  const navs = [
    { to: '/', icon: LayoutDashboard, label: '대시보드' },
    { to: '/cases', icon: Users, label: '케이스', badge: newLeadsCount > 0 ? newLeadsCount : undefined },
    { to: '/new', icon: PlusCircle, label: '신규등록' },
    { to: '/settlement', icon: Calculator, label: '정산' },
    { to: '/settings', icon: Settings, label: '설정' },
    { to: '/mypage', icon: User, label: '마이페이지' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
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
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-8 pb-20 md:pb-8">
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

const ProtectedRoutes = () => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cases" element={<CaseList />} />
        <Route path="/new" element={<NewCase />} />
        <Route path="/case/:caseId" element={<CaseDetail />} />
        <Route path="/settlement" element={<Settlement />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};


export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <HashRouter>
        <ToastProvider>
          <ThemeProvider>
            <AuthProvider>
              <Suspense fallback={
                <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
                  <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                </div>
              }>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/*" element={<ProtectedRoutes />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </ThemeProvider>
        </ToastProvider>
      </HashRouter>
    </GoogleOAuthProvider>
  );
}