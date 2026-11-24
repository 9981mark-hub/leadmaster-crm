import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, Copy, Check, Smartphone, CheckCircle2 } from 'lucide-react';
import { Case, Partner } from '../../types';

export interface SmsTemplate {
  id: string;
  title: string;
  badge: string;
  badgeColor: string;
  text: string;
}

interface Props {
  c: Case;
  partner?: Partner;
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onLoggedSms?: (memoText: string) => void;
}

export const LiteQuickSmsModal: React.FC<Props> = ({
  c,
  partner,
  isOpen,
  onClose,
  showToast,
  onLoggedSms,
}) => {
  const cleanPhone = String(c.phone || '').replace(/[^0-9]/g, '');
  const partnerName = partner?.name || '법무법인 채무조정팀';
  const myNumber = localStorage.getItem('agent_phone') || '010-0000-0000';

  const TEMPLATES: SmsTemplate[] = [
    {
      id: 'missed_1',
      title: '부재중 1차 콜백 요청',
      badge: '부재중 1차',
      badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
      text: `[${partnerName} 무료상담팀]\n${c.customerName} 고객님, 신청해주신 채무조정(개인회생·파산) 무료자격 진단 차 연락드렸으나 부재중이셔서 문자 남겨드립니다.\n\n편하신 시간에 '상담 희망'이라고 문자 남겨주시거나 전화 주시면 3분 내로 안내해 드리겠습니다.`,
    },
    {
      id: 'missed_2',
      title: '부재중 2/3차 독촉방어 안내',
      badge: '부재중 재안내',
      badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
      text: `[${partnerName} 긴급안내]\n${c.customerName} 고객님, 빚 독촉 중단 및 원금 최대 90% 탕감 자격 검토 건으로 재연락드렸습니다.\n\n이번 주 법원 접수 일정 마감 전 자격 확인이 필요하오니 편하신 시간에 회신 부탁드립니다.`,
    },
    {
      id: 'office_assigned',
      title: '사무장 배정 완료 안내',
      badge: '사무장 배정',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
      text: `[${partnerName} 배정 안내]\n${c.customerName} 고객님, 1차 자격 검토가 완료되어 법무법인 전담 수석 사무장님이 배정되었습니다.\n\n곧 사무장님이 유선으로 정밀 인가 절차를 안내드릴 예정이오니 전화를 꼭 받아주시기 바랍니다.`,
    },
  ];

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(TEMPLATES[0].id);
  const [customText, setCustomText] = useState<string>(TEMPLATES[0].text);
  const [copied, setCopied] = useState(false);

  const handleSelectTemplate = (tpl: SmsTemplate) => {
    setSelectedTemplateId(tpl.id);
    setCustomText(tpl.text);
  };

  const handleSendSms = () => {
    if (!cleanPhone) {
      showToast('고객 전화번호가 올바르지 않습니다.', 'error');
      return;
    }

    // 1. Android Bridge 네이티브 발송 시도
    let sent = false;
    try {
      if (typeof (window as any).AndroidBridge?.sendSms === 'function') {
        (window as any).AndroidBridge.sendSms(cleanPhone, customText);
        sent = true;
      }
    } catch (e) {
      console.warn('AndroidBridge.sendSms error:', e);
    }

    // 2. 모바일 브라우저/기본 SMS 앱 URI 폴백
    if (!sent) {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(customText)}`;
      } else {
        // PC 브라우저인 경우 클립보드 복사 후 안내
        navigator.clipboard.writeText(customText);
        showToast('문자 내용이 복사되었습니다! (스마트폰 앱에서 발송 가능)', 'success');
      }
    } else {
      showToast('스마트폰으로 문자를 발송했습니다.', 'success');
    }

    // 발송 이력 메모 로깅 콜백
    if (onLoggedSms) {
      onLoggedSms(`[문자 발송] ${TEMPLATES.find(t => t.id === selectedTemplateId)?.title || '안내 문자'}\n${customText}`);
    }

    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(customText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('문자 내용이 복사되었습니다.', 'success');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto" onClick={onClose}>
      <div
        className="relative w-full max-w-md max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <MessageSquare size={16} />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">
                1-Click 안내 문자 발송
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                {c.customerName} ({c.phone})
              </p>
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

        {/* 바디 */}
        <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar text-xs">
          
          {/* 템플릿 선택 버튼 목록 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-foreground">
              발송할 템플릿 선택:
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {TEMPLATES.map(tpl => {
                const isSelected = selectedTemplateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`p-2.5 rounded-xl text-left border transition-all text-xs font-bold flex flex-col gap-0.5 cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary ring-1 ring-primary/30 shadow-2xs'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <span className="text-2xs text-muted-foreground">{tpl.badge}</span>
                    <span className="truncate">{tpl.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 문자 내용 미리보기 & 편집 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">
                문자 내용 미리보기 (수정 가능):
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {copied ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
                <span>{copied ? '복사됨' : '복사'}</span>
              </button>
            </div>
            <textarea
              rows={6}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed font-sans resize-none"
            />
          </div>

        </div>

        {/* 하단 액션 버튼 */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-muted text-foreground text-xs font-bold transition-colors cursor-pointer shadow-2xs"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSendSms}
            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Smartphone size={14} />
            <span>스마트폰 문자로 즉시 발송</span>
          </button>
        </div>
      </div>
    </div>
  );
};
