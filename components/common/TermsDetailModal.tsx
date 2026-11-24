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
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl max-h-[88vh] my-auto bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden text-card-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. 고정 헤더 */}
        <div className="p-4 sm:p-5 border-b border-border bg-card flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/15 text-primary">
                  {term.isRequired ? '필수 동의' : '선택 동의'}
                </span>
                <span className="text-xs text-muted-foreground font-mono">버전 {CURRENT_TERMS_VERSION}</span>
              </div>
              <h3 className="text-base font-bold text-foreground mt-0.5">
                {term.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="창 닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. 스크롤 본문 */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar text-xs">
          {/* 3줄 요약 배너 */}
          <div className="p-3.5 bg-secondary/50 border border-border rounded-xl space-y-1.5">
            <div className="text-xs font-bold text-primary flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              <span>핵심 요약 안내</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc">
              {term.summary.map((line, idx) => (
                <li key={idx} className="leading-relaxed">{line}</li>
              ))}
            </ul>
          </div>

          {/* 법률 전문 본문 */}
          <div className="text-xs text-foreground/90 leading-relaxed font-sans whitespace-pre-line border border-border p-4 rounded-xl bg-muted/20">
            {term.fullContent}
          </div>
        </div>

        {/* 3. 고정 푸터 */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-muted text-foreground text-xs font-bold transition-colors cursor-pointer shadow-2xs"
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
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              내용을 확인하고 동의합니다
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
