import React from 'react';
import { X, FileText, CheckCircle2 } from 'lucide-react';
import { TermItem, CURRENT_TERMS_VERSION } from '../../services/termsContent';

interface TermsDetailModalProps {
  isOpen: boolean;
  term: TermItem | null;
  onClose: () => void;
  onAgree?: () => void;
}

export default function TermsDetailModal({
  isOpen,
  term,
  onClose,
  onAgree,
}: TermsDetailModalProps) {
  if (!isOpen || !term) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col max-h-[85vh] text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  {term.isRequired ? '필수 동의' : '선택 동의'}
                </span>
                <span className="text-xs text-slate-400 font-mono">버전 {CURRENT_TERMS_VERSION}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {term.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 3줄 요약 배너 */}
        <div className="p-3.5 bg-blue-50/60 dark:bg-slate-950/60 border border-blue-100 dark:border-slate-800 rounded-2xl mb-4 shrink-0 space-y-1.5">
          <div className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
            <CheckCircle2 size={13} />
            <span>핵심 요약 안내</span>
          </div>
          <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pl-4 list-disc">
            {term.summary.map((line, idx) => (
              <li key={idx} className="leading-relaxed">{line}</li>
            ))}
          </ul>
        </div>

        {/* 법률 전문 본문 (스크롤) */}
        <div className="flex-1 overflow-y-auto pr-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-line border border-slate-100 dark:border-slate-800/80 p-4 rounded-2xl bg-slate-50/40 dark:bg-slate-950/40">
          {term.fullContent}
        </div>

        {/* 푸터 버튼 */}
        <div className="pt-4 mt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            닫기
          </button>
          {onAgree && (
            <button
              type="button"
              onClick={() => {
                onAgree();
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20"
            >
              내용을 확인하고 동의합니다
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
