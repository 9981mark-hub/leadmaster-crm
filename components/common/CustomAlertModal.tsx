import React from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  X, 
  ShieldAlert, 
  ArrowRight,
  Building2 
} from 'lucide-react';

export type AlertType = 'info' | 'success' | 'warning' | 'error' | 'uninvited';

interface CustomAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message?: string | React.ReactNode;
  type?: AlertType;
  email?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onApplyClick?: () => void;
}

export default function CustomAlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  email,
  confirmText = '확인',
  cancelText,
  onConfirm,
  onApplyClick,
}: CustomAlertModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  const getIcon = () => {
    switch (type) {
      case 'uninvited':
        return <ShieldAlert size={28} className="text-amber-600 dark:text-amber-400" />;
      case 'success':
        return <CheckCircle2 size={28} className="text-emerald-600 dark:text-emerald-400" />;
      case 'warning':
        return <AlertTriangle size={28} className="text-amber-600 dark:text-amber-400" />;
      case 'error':
        return <AlertTriangle size={28} className="text-rose-600 dark:text-rose-400" />;
      default:
        return <Info size={28} className="text-blue-600 dark:text-blue-400" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'uninvited':
        return 'bg-amber-500/10 border-amber-500/20';
      case 'success':
        return 'bg-emerald-500/10 border-emerald-500/20';
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/20';
      case 'error':
        return 'bg-rose-500/10 border-rose-500/20';
      default:
        return 'bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md max-h-[88vh] my-auto bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 text-foreground flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 & 아이콘 */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${getIconBg()}`}>
              {getIcon()}
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight leading-snug break-keep">
                {title}
              </h3>
              {email && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="font-mono text-muted-foreground">{email}</span>
                </div>
              )}
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 메시지 */}
        <div className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line break-keep bg-muted/30 p-4 rounded-xl border border-border">
          {message}
        </div>

        {/* 버튼 영역 */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          {type === 'uninvited' && onApplyClick && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onApplyClick();
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
            >
              <Building2 size={16} />
              <span>TM 회사 가입 신청하기</span>
              <ArrowRight size={14} />
            </button>
          )}

          {cancelText && (
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            className={`py-2.5 px-5 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer ${
              type === 'uninvited' 
                ? 'bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground flex-1 text-center shadow-2xs'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
