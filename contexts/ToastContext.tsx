import React, { createContext, useState, useContext, useCallback, useMemo, ReactNode } from 'react';
import Toast from '../components/Toast';

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastState {
  message: string;
  type: 'success' | 'error';
  visible: boolean;
  id: number;
}

// FIX: Made children prop optional to resolve typing error in App.tsx
export const ToastProvider = ({ children }: { children?: ReactNode }) => {
  const [toast, setToast] = useState<ToastState | null>(null);

  // [2026-11-01] 함수·값을 고정: 예전엔 토스트가 뜰 때마다 새 함수가 되어
  // showToast를 의존성으로 둔 화면(팀 관리 등)이 토스트마다 서버를 다시 불렀다
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToast({ message, type, visible: true, id });
    setTimeout(() => {
      // Only clear if it's the same toast to prevent race conditions
      setToast(current => (current?.id === id ? null : current));
    }, 3000);
  }, []);

  const closeToast = () => {
      setToast(null);
  }

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && toast.visible && (
        <Toast 
          // FIX: Removed 'key' prop. It's not needed for a single element and caused a type error.
          // The 'id' in the state is still used to prevent setTimeout race conditions.
          message={toast.message} 
          type={toast.type} 
          onClose={closeToast} 
        />
      )}
    </ToastContext.Provider>
  );
};
