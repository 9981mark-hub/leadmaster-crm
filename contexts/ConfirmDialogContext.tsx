import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import CustomAlertModal, { AlertType } from '../components/common/CustomAlertModal';

export interface ConfirmDialogOptions {
  title: string;
  message?: string | ReactNode;
  type?: AlertType;
  variant?: 'default' | 'destructive' | 'danger';
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmDialogContextType {
  confirm: (options: ConfirmDialogOptions | string) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | undefined>(undefined);

export const useConfirmDialog = () => {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error('useConfirmDialog must be used within a ConfirmDialogProvider');
  }
  return ctx;
};

export const ConfirmDialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    title: string;
    message?: string | ReactNode;
    type?: AlertType;
    confirmText?: string;
    cancelText?: string;
    resolve?: (value: boolean) => void;
  }>({
    isOpen: false,
    title: ''
  });

  const confirm = useCallback((options: ConfirmDialogOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof options === 'string') {
        setDialogState({
          isOpen: true,
          title: '확인 요청',
          message: options,
          type: 'warning',
          confirmText: '확인',
          cancelText: '취소',
          resolve
        });
      } else {
        const resolvedType: AlertType = options.type || (
          options.variant === 'destructive' || options.variant === 'danger'
            ? 'error'
            : options.variant === 'default'
            ? 'info'
            : 'warning'
        );
        setDialogState({
          isOpen: true,
          title: options.title,
          message: options.message,
          type: resolvedType,
          confirmText: options.confirmText || '확인',
          cancelText: options.cancelText !== undefined ? options.cancelText : '취소',
          resolve
        });
      }
    });
  }, []);

  const handleClose = () => {
    if (dialogState.resolve) {
      dialogState.resolve(false);
    }
    setDialogState(prev => ({ ...prev, isOpen: false }));
  };

  const handleConfirm = () => {
    if (dialogState.resolve) {
      dialogState.resolve(true);
    }
    setDialogState(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      {dialogState.isOpen && (
        <CustomAlertModal
          isOpen={dialogState.isOpen}
          onClose={handleClose}
          title={dialogState.title}
          message={dialogState.message}
          type={dialogState.type}
          confirmText={dialogState.confirmText}
          cancelText={dialogState.cancelText}
          onConfirm={handleConfirm}
        />
      )}
    </ConfirmDialogContext.Provider>
  );
};

export default ConfirmDialogProvider;
