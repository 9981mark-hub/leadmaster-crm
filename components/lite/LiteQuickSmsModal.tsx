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
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col"
        >
          {/* 헤더 */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <MessageSquare size={16} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                  1-Click 안내 문자 발송
                </h3>
                <p className="text-[11px] text-gray-500 font-mono">
                  {c.customerName} ({c.phone})
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* 바디 */}
          <div className="p-4 space-y-3.5 flex-1 overflow-y-auto">
            
            {/* 템플릿 선택 버튼 목록 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400">
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
                      className={`p-2 rounded-xl text-left border transition-all text-xs font-bold flex flex-col gap-0.5 ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/30'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-[10px] text-gray-400">{tpl.badge}</span>
                      <span className="truncate">{tpl.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 문자 내용 미리보기 & 편집 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  문자 내용 미리보기 (수정 가능):
                </label>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-blue-600 transition-colors"
                >
                  {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  <span>{copied ? '복사됨' : '복사'}</span>
                </button>
              </div>
              <textarea
                rows={6}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-sans"
              />
            </div>

          </div>

          {/* 하단 액션 버튼 */}
          <div className="p-3.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 rounded-xl border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleSendSms}
              className="flex-2 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
            >
              <Smartphone size={14} />
              <span>스마트폰 문자로 즉시 발송</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
