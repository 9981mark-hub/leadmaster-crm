import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
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

// 기본 관리자 이메일
const DEFAULT_ALLOWED_EMAILS = ['9981mark@gmail.com', '2882a@naver.com'];

export const AuthProvider = ({ children }: { children?: ReactNode }) => {
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
  const [org, setOrg] = useState<OrgInfo | null>(() => loadCachedOrg());

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
  const addAllowedEmail = async (email: string) => {
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
  };

  const removeAllowedEmail = async (email: string) => {
    const newList = await removeAllowedEmailApi(email);
    setAllowedEmails(newList);
    const currentOrg = loadCachedOrg();
    if (supabase && currentOrg) {
      // 아직 수락 전인 초대만 취소 (이미 멤버가 된 계정은 멤버 관리에서 해제)
      await supabase.from('org_invites').delete()
        .eq('org_id', currentOrg.orgId).eq('email', email.trim().toLowerCase()).is('accepted_at', null);
    }
  };

  const AuthProviderInternal = ({ children }: { children?: ReactNode }) => {
    const navigate = useNavigate();

    const loginWithGoogle = async (credential: string) => {
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
          const allowedByList = !orgChecked && allowedEmails.includes(email);
          if (!allowedByList) {
            if (supabase) await supabase.auth.signOut();
            alert(orgChecked
              ? '초대받지 않은 계정입니다.\n회사 관리자에게 이 구글 계정으로 초대를 요청하세요.'
              : '접근 권한을 확인하지 못했습니다.\n잠시 후 다시 시도해주세요.');
            return;
          }
        } else {
          // 같은 PC에서 다른 회사·계정으로 로그인한 경우 이전 캐시 삭제
          if (ensureCacheOwner(orgInfo)) resetInitState();
          setOrg(orgInfo);
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
    };

    // [Session Recovery] - Non-destructive with Supabase refreshSession
    useEffect(() => {
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
        // 이미 로그인된 상태로 앱을 열었을 때 회사·역할을 다시 확인 (역할 변경·회사 정지 반영)
        if (!isAuthenticated) return;
        try {
          const info = await resolveOrg();
          if (info) {
            if (ensureCacheOwner(info)) {
              // 다른 회사·계정의 캐시였음 → 깨끗한 상태로 다시 로드
              window.location.reload();
              return;
            }
            setOrg(info);
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
        window.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', restoreSupabaseSession);
      };
    }, [isAuthenticated]);



    const logout = async () => {
      if (supabase) await supabase.auth.signOut();
      resetInitState(); // [SYNC FIX] 재로그인 시 데이터 재초기화를 위해 모듈 상태 리셋
      localStorage.removeItem('authToken');
      localStorage.removeItem('userProfile');
      localStorage.removeItem('isAuthenticated');
      clearOrgCache();
      setOrg(null);
      setIsAuthenticated(false);
      setUser(null);
      navigate('/login');
    };

    const isAdmin = org ? isAdminRole(org.role) : true;

    return (
      <AuthContext.Provider value={{ isAuthenticated, user, org, isAdmin, allowedEmails, loginWithGoogle, logout, addAllowedEmail, removeAllowedEmail }}>
        {children}
      </AuthContext.Provider>
    );
  };

  return <AuthProviderInternal>{children}</AuthProviderInternal>;
};