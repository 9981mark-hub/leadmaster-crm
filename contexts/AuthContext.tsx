import React, { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import {
  fetchAllowedEmails,
  addAllowedEmail as addAllowedEmailApi,
  removeAllowedEmail as removeAllowedEmailApi,
  subscribe,
  resetInitState
} from '../services/api';
import { supabase } from '../services/supabase';
import { OrgInfo, resolveOrg, loadCachedOrg, clearOrgCache, ensureCacheOwner, isAdminRole } from '../services/org';
import { syncAppSession, clearAppSession } from '../services/appBridge';

interface UserProfile {
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  /** 소속 회사·역할. 확인 전이거나 확인 실패 시 null (기존 화이트리스트 방식으로 동작) */
  org: OrgInfo | null;
  /** 관리자 메뉴 표시 여부. 회사 정보를 아직 모르면 true (본사 사용자 화면이 갑자기 줄지 않게) */
  isAdmin: boolean;
  allowedEmails: string[];
  loginWithGoogle: (credential: string) => void;

  logout: () => void;
  addAllowedEmail: (email: string) => void;
  removeAllowedEmail: (email: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// [FIX 2026-11-01] 예전에는 이 컴포넌트 안에 AuthProviderInternal 컴포넌트를 "정의"해서 썼다.
// 그러면 상태가 바뀔 때마다 컴포넌트 종류 자체가 새로 만들어져 화면 전체가 언마운트·재마운트된다.
// 회사 정보(org) 저장이 추가되면서 "저장 → 전체 재마운트 → 다시 조회 → 다시 저장"이 무한 반복됐다
// (TG연동 배지가 계속 새로고침되고 버튼이 안 먹던 문제). AuthProvider는 HashRouter 안에 있으므로
// useNavigate를 여기서 바로 쓰고, 내부 컴포넌트를 없앴다.
export const AuthProvider = ({ children }: { children?: ReactNode }) => {
  const navigate = useNavigate();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('authToken');
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    const storedUser = localStorage.getItem('userProfile');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  // 동적 이메일 리스트 관리 (API 연동)
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);

  // 소속 회사·역할 (멀티테넌트)
  const [org, setOrgState] = useState<OrgInfo | null>(() => loadCachedOrg());
  // 내용이 같으면 상태를 바꾸지 않는다 (불필요한 전체 재렌더링 방지)
  const setOrg = useCallback((next: OrgInfo | null) => {
    setOrgState(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);

  // allowedEmails는 콜백 안에서 최신값을 읽기 위해 ref로도 보관
  const allowedEmailsRef = useRef<string[]>([]);
  allowedEmailsRef.current = allowedEmails;

  useEffect(() => {
    // 초기 로드: 로컬 캐시 또는 API에서 가져오기
    fetchAllowedEmails().then(setAllowedEmails);

    // 실시간 업데이트 구독 (다른 탭/기기 동기화)
    // [Fix] Only update state if value actually changed to prevent unnecessary re-renders
    const unsubscribe = subscribe(async () => {
      const newEmails = await fetchAllowedEmails();
      setAllowedEmails(prev => {
        // Compare arrays - only update if different
        const prevStr = JSON.stringify([...prev].sort());
        const newStr = JSON.stringify([...newEmails].sort());
        if (prevStr !== newStr) {
          return newEmails;
        }
        return prev; // Return same reference to prevent re-render
      });
    });
    return () => unsubscribe();
  }, []);

  // [멀티테넌트] 로그인 권한은 이제 "회사 멤버" 기준이다.
  // 마이페이지에서 이메일을 추가하면 기존 목록에 더해 같은 회사 관리자 초대도 만든다 (정식 멤버 관리 화면 전까지 임시).
  const addAllowedEmail = useCallback(async (email: string) => {
    const newList = await addAllowedEmailApi(email);
    setAllowedEmails(newList);
    const currentOrg = loadCachedOrg();
    if (supabase && currentOrg) {
      const { error } = await supabase
        .from('org_invites')
        .upsert({ org_id: currentOrg.orgId, email: email.trim().toLowerCase(), role: 'admin' },
                { onConflict: 'org_id,email', ignoreDuplicates: true });
      if (error) console.warn('[Auth] org invite create failed:', error.message);
    }
  }, []);

  const removeAllowedEmail = useCallback(async (email: string) => {
    const newList = await removeAllowedEmailApi(email);
    setAllowedEmails(newList);
    const currentOrg = loadCachedOrg();
    if (supabase && currentOrg) {
      // 아직 수락 전인 초대만 취소 (이미 멤버가 된 계정은 멤버 관리에서 해제)
      await supabase.from('org_invites').delete()
        .eq('org_id', currentOrg.orgId).eq('email', email.trim().toLowerCase()).is('accepted_at', null);
    }
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    try {
      // 1. Google ID Token 디코딩
      const decoded: any = jwtDecode(credential);
      const { email, name, picture } = decoded;
      const userProfile = { email, name, picture };

      // 2. Supabase 로그인 (회사 소속 확인을 위해 먼저 로그인한다. 데이터 권한은 DB(RLS)가 막는다)
      if (supabase) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: credential,
        });

        if (error) {
          console.error("Supabase Auth Failed:", error);
          alert(`로그인에 실패했습니다.\n사유: ${error.message}\n(서버 설정 문제일 수 있습니다)`);
          return;
        }
      }

      // 3. 소속 회사 확인 (초대가 있으면 자동 수락)
      let orgInfo: OrgInfo | null = null;
      let orgChecked = false;
      try {
        orgInfo = await resolveOrg();
        orgChecked = true;
      } catch (e) {
        console.warn('[Auth] Org check failed, falling back to allowed email list:', e);
      }

      if (!orgInfo) {
        // 회사 확인이 안 되면(네트워크 오류 등) 기존 허용 이메일 목록으로 판단 (본사 사용자 잠김 방지)
        const allowedByList = !orgChecked && allowedEmailsRef.current.includes(email);
        if (!allowedByList) {
          // scope local: 이 브라우저만 로그아웃 (기본값 global은 폰 앱 세션까지 끊는다)
          if (supabase) await supabase.auth.signOut({ scope: 'local' });
          alert(orgChecked
            ? '초대받지 않은 계정입니다.\n회사 관리자에게 이 구글 계정으로 초대를 요청하세요.'
            : '접근 권한을 확인하지 못했습니다.\n잠시 후 다시 시도해주세요.');
          return;
        }
      } else {
        // 같은 PC에서 다른 회사·계정으로 로그인한 경우 이전 캐시 삭제
        if (ensureCacheOwner(orgInfo)) resetInitState();
        setOrg(orgInfo);
        // 안드로이드 앱 안이면 앱 전용 세션 전달 (앱 밖이면 아무것도 안 함)
        syncAppSession(orgInfo.userId);
      }

      localStorage.setItem('authToken', credential);
      localStorage.setItem('userProfile', JSON.stringify(userProfile));
      localStorage.setItem('managerName', orgInfo?.displayName || name);

      setIsAuthenticated(true);
      setUser(userProfile);
      navigate('/');

    } catch (error) {
      console.error('Login Failed', error);
      alert('로그인 처리 중 오류가 발생했습니다.');
    }
  }, [navigate, setOrg]);

  // [Session Recovery] - Non-destructive with Supabase refreshSession
  useEffect(() => {
    let cancelled = false;

    const restoreSupabaseSession = async () => {
      if (!isAuthenticated || !supabase) return;

      try {
        // 1. 현재 세션 확인
        const { data: { session } } = await supabase.auth.getSession();
        if (session) return;

        // 2. Supabase 자체 refresh token으로 세션 복구 시도 (장기 지속)
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (refreshData?.session) {
          console.log('[Auth] Supabase session restored via refresh token');
          return;
        }

        // 3. 저장된 Google 토큰이 있으면 시도
        const token = localStorage.getItem('authToken');
        if (token) {
          const { data: signInData, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: token,
          });
          if (signInData?.session && !error) {
            console.log('[Auth] Supabase session restored via Google token');
            return;
          }
        }

        // 세션 복구 실패 시에도 alert()나 강제 logout()을 호출하지 않음
        // 로컬 캐시로 계속 정상 사용 가능하며, 사용자를 강제로 튕겨내지 않음
        console.warn('[Auth] Background session restore unready; continuing with local state.');
      } catch (e) {
        console.warn('[Auth] Supabase session check error:', e);
      }
    };

    restoreSupabaseSession().then(async () => {
      // 로그인된 상태로 앱을 열었을 때 회사·역할을 한 번 다시 확인 (역할 변경·회사 정지 반영)
      if (!isAuthenticated || cancelled) return;
      try {
        const info = await resolveOrg();
        if (cancelled) return;
        if (info) {
          if (ensureCacheOwner(info)) {
            // 다른 회사·계정의 캐시였음 → 깨끗한 상태로 다시 로드 (한 번만 일어남)
            window.location.reload();
            return;
          }
          setOrg(info);
          syncAppSession(info.userId);
        } else {
          setOrg(null);
        }
      } catch (e) {
        console.warn('[Auth] Background org check failed (using cached org):', e);
      }
    });

    // [Mobile WebView / PC Tab Fix] 탭 복귀 시 조용히 세션 복구
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        restoreSupabaseSession();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', restoreSupabaseSession);

    return () => {
      cancelled = true;
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', restoreSupabaseSession);
    };
  }, [isAuthenticated, setOrg]);

  const logout = useCallback(async () => {
    clearAppSession();
    // scope local: 이 기기만 로그아웃. 기본값(global)은 같은 계정의 폰 앱 세션까지 폐기해서
    // 앱이 전화·문자 요청을 조용히 못 받게 된다 (2026-11-01 문자 미발송 원인)
    if (supabase) await supabase.auth.signOut({ scope: 'local' });
    resetInitState(); // [SYNC FIX] 재로그인 시 데이터 재초기화를 위해 모듈 상태 리셋
    localStorage.removeItem('authToken');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('isAuthenticated');
    clearOrgCache();
    setOrg(null);
    setIsAuthenticated(false);
    setUser(null);
    navigate('/login');
  }, [navigate, setOrg]);

  const isAdmin = org ? isAdminRole(org.role) : true;

  const value = useMemo(() => ({
    isAuthenticated, user, org, isAdmin, allowedEmails,
    loginWithGoogle, logout, addAllowedEmail, removeAllowedEmail,
  }), [isAuthenticated, user, org, isAdmin, allowedEmails, loginWithGoogle, logout, addAllowedEmail, removeAllowedEmail]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
