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
        return <ShieldAlert size={28} className="text-amber-400" />;
      case 'success':
        return <CheckCircle2 size={28} className="text-emerald-400" />;
      case 'warning':
        return <AlertTriangle size={28} className="text-amber-400" />;
      case 'error':
        return <AlertTriangle size={28} className="text-rose-400" />;
      default:
        return <Info size={28} className="text-blue-400" />;
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
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 & 아이콘 */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${getIconBg()}`}>
              {getIcon()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight leading-snug">
                {title}
              </h3>
              {email && (
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  <span className="font-mono text-slate-300">{email}</span>
                </div>
              )}
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 메시지 */}
        <div className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
          {message}
        </div>

        {/* 버튼 영역 */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          {type === 'uninvited' && onApplyClick && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onApplyClick();
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
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
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            className={`py-2.5 px-5 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer ${
              type === 'uninvited' 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                : 'bg-blue-600 hover:bg-blue-500 text-white flex-1 text-center shadow-md'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
