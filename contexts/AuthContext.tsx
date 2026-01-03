import React, { createContext, useState, useContext, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

interface UserProfile {
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  allowedEmails: string[];
  loginWithGoogle: (credential: string) => void;
  loginAsDev: () => void;
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

  // 동적 이메일 리스트 관리
  const [allowedEmails, setAllowedEmails] = useState<string[]>(() => {
    const stored = localStorage.getItem('allowedEmails');
    return stored ? JSON.parse(stored) : DEFAULT_ALLOWED_EMAILS;
  });

  const updateAllowedEmails = (newList: string[]) => {
    setAllowedEmails(newList);
    localStorage.setItem('allowedEmails', JSON.stringify(newList));
  };

  const addAllowedEmail = (email: string) => {
    if (!allowedEmails.includes(email)) {
      updateAllowedEmails([...allowedEmails, email]);
    }
  };

  const removeAllowedEmail = (email: string) => {
    const newList = allowedEmails.filter(e => e !== email);
    updateAllowedEmails(newList);
  };

  const AuthProviderInternal = ({ children }: { children?: ReactNode }) => {
    const navigate = useNavigate();

    const loginWithGoogle = (credential: string) => {
      try {
        // 1. Google ID Token 디코딩
        const decoded: any = jwtDecode(credential);
        const { email, name, picture } = decoded;

        // 2. 이메일 권한 확인 (동적 리스트 사용)
        if (!allowedEmails.includes(email)) {
          alert('접근 권한이 없는 계정입니다.\n관리자에게 문의하세요.');
          return;
        }

        // 3. 로그인 성공 처리
        const userProfile = { email, name, picture };

        localStorage.setItem('authToken', credential);
        localStorage.setItem('userProfile', JSON.stringify(userProfile));
        localStorage.setItem('managerName', name);

        setIsAuthenticated(true);
        setUser(userProfile);
        navigate('/');

      } catch (error) {
        console.error('Login Failed', error);
        alert('로그인 처리 중 오류가 발생했습니다.');
      }
    };

    // 개발자용 임시 로그인 함수
    const loginAsDev = () => {
      const devUser = {
        email: 'dev@test.com',
        name: '개발자(Test)',
        picture: ''
      };
      localStorage.setItem('authToken', 'dev-token-bypass');
      localStorage.setItem('userProfile', JSON.stringify(devUser));
      localStorage.setItem('managerName', devUser.name);

      setIsAuthenticated(true);
      setUser(devUser);
      navigate('/');
    };

    const logout = () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userProfile');
      localStorage.removeItem('isAuthenticated');
      setIsAuthenticated(false);
      setUser(null);
      navigate('/login');
    };

    return (
      <AuthContext.Provider value={{ isAuthenticated, user, allowedEmails, loginWithGoogle, loginAsDev, logout, addAllowedEmail, removeAllowedEmail }}>
        {children}
      </AuthContext.Provider>
    );
  };

  return <AuthProviderInternal>{children}</AuthProviderInternal>;
};