import React, { useState, useEffect } from 'react';
import { X, Send, Mail, CheckCircle2, AlertCircle, Key, ExternalLink, RefreshCw } from 'lucide-react';
import { generateApprovalEmailContent } from '../../services/platform';
import {
  getBrevoApiKey,
  saveBrevoApiKey,
  sendBrevoEmail,
  generateApprovalHtmlEmail,
} from '../../services/mailService';
import { useToast } from '../../contexts/ToastContext';
import { approveOrgApplication, markApplicationPaid, OrgApplication } from '../../services/orgApplicationService';

interface ApprovalEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  application?: OrgApplication | null;
  /** 기존 승인된 회사에 재발송할 때 사용 */
  directCompany?: { name: string; ownerEmail: string } | null;
  onSuccess: () => void;
}

export const ApprovalEmailModal: React.FC<ApprovalEmailModalProps> = ({
  isOpen,
  onClose,
  application,
  directCompany,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const companyName = application?.companyName || directCompany?.name || '';
  const ownerEmail = application?.ownerEmail || directCompany?.ownerEmail || '';

  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<'html' | 'text' | 'edit'>('html');

  useEffect(() => {
    if (!isOpen || !companyName || !ownerEmail) return;

    // 메일 기본 제목/본문 생성
    const initial = generateApprovalEmailContent(companyName, ownerEmail);
    setSubject(initial.subject);
    setBodyText(initial.body);

    // API 키 확인
    getBrevoApiKey().then((k) => {
      setApiKey(k);
      setInputKey(k);
      setShowKeyInput(!k);
    });
  }, [isOpen, companyName, ownerEmail]);

  if (!isOpen || !companyName || !ownerEmail) return null;

  const handleSaveKey = async () => {
    if (!inputKey.trim()) {
      showToast('API 키를 입력해주세요.', 'warning');
      return;
    }
    await saveBrevoApiKey(inputKey.trim());
    setApiKey(inputKey.trim());
    setShowKeyInput(false);
    showToast('Brevo API 키가 안전하게 저장되었습니다.', 'success');
  };

  /** Gmail 웹 작성창으로 열기 (보조 수단) */
  const handleOpenGmail = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      ownerEmail
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    window.open(gmailUrl, '_blank');
    navigator.clipboard.writeText(`[제목] ${subject}\n\n${bodyText}`);
    showToast('Gmail 작성창을 열었습니다. 클립보드에도 복사되었습니다.', 'info');
  };

  /** 어드민 내부에서 1클릭 승인 & Brevo 자동 발송 */
  const handleApproveAndSend = async () => {
    if (busy) return;

    if (!apiKey.trim()) {
      setShowKeyInput(true);
      showToast('자동 발송을 위해 먼저 Brevo API 키를 입력해주세요.', 'warning');
      return;
    }

    setBusy(true);
    try {
      // 1. 대기열에 있는 신청건인 경우 테넌트 생성 & 승인 처리
      if (application && application.status === 'pending') {
        await approveOrgApplication(application);
        await markApplicationPaid(application.id, 0);
      }

      // 2. Brevo API를 통한 HTML 전문 이메일 자동 발송
      const htmlContent = generateApprovalHtmlEmail({
        companyName,
        ownerEmail,
        loginUrl: 'https://lmaster.xyz/login',
      });

      const sendResult = await sendBrevoEmail({
        toEmail: ownerEmail,
        toName: `${companyName} 대표`,
        subject: subject,
        textContent: bodyText,
        htmlContent: htmlContent,
      });

      showToast(
        `'${companyName}' 승인 및 ${ownerEmail}로 안내 메일이 자동 발송되었습니다!`,
        'success'
      );

      onSuccess();
      onClose();
    } catch (e: any) {
      console.error('[ApprovalEmailModal] Error:', e);
      showToast(`처리 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 border border-slate-750 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
              <Mail size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                신규 가입 승인 및 안내 메일 발송
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  7일 무료 체험
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                승인 정보를 확인하고 support@lmaster.xyz 발신자로 안내 메일을 자동 발송합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-white hover:bg-slate-100 dark:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          
          {/* 신청 정보 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">회사 / 상호</span>
              <span className="text-sm font-bold text-white truncate block">{companyName}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">수신 대표 구글 계정</span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400 truncate block">{ownerEmail}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">부여 권한</span>
              <span className="text-sm font-bold text-slate-200 block">대표 (Owner)</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">체험 기간</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 block">7일 무제한 이용</span>
            </div>
          </div>

          {/* Brevo API Key 설정 배너 */}
          <div className="p-3.5 rounded-xl bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key size={15} className={apiKey ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} />
                <span className="text-xs font-semibold text-slate-200">
                  발신 서버 (Brevo API)
                </span>
                {apiKey ? (
                  <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    자동 발송 연동됨 (support@lmaster.xyz)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    API 키 등록 필요
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
              >
                {showKeyInput ? '접기' : apiKey ? '키 변경' : '키 입력하기'}
              </button>
            </div>

            {showKeyInput && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Brevo 대시보드(Settings → API Keys)에서 생성한 키(xkeysib-...)를 입력하시면 어드민에서 [승인] 클릭 시 100% 자동 발송됩니다.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="xkeysib-..."
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-gray-900 border border-slate-650 text-white focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    키 저장
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 메일 내용 탭 (디자인 HTML vs 텍스트 vs 내용 편집) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                발송 이메일 검토
              </span>
              <div className="flex rounded-lg bg-slate-50 dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('html')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeTab === 'html'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-white'
                  }`}
                >
                  디자인 미리보기
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('text')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeTab === 'text'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-white'
                  }`}
                >
                  텍스트 본문
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeTab === 'edit'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-white'
                  }`}
                >
                  내용 수정
                </button>
              </div>
            </div>

            {activeTab === 'html' && (
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <div className="flex gap-2 text-slate-500 dark:text-slate-400">
                    <span className="w-14 shrink-0 font-medium">보낸사람:</span>
                    <span className="text-slate-200 font-semibold">리드마스터 CRM &lt;support@lmaster.xyz&gt;</span>
                  </div>
                  <div className="flex gap-2 text-slate-500 dark:text-slate-400">
                    <span className="w-14 shrink-0 font-medium">받는사람:</span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">{ownerEmail}</span>
                  </div>
                  <div className="flex gap-2 text-slate-500 dark:text-slate-400">
                    <span className="w-14 shrink-0 font-medium">제목:</span>
                    <span className="text-white font-bold">{subject}</span>
                  </div>
                </div>

                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner bg-[#f1f5f9]">
                  <iframe
                    title="Email HTML Preview"
                    srcDoc={generateApprovalHtmlEmail({
                      companyName,
                      ownerEmail,
                      loginUrl: 'https://www.lmaster.xyz/login',
                    })}
                    className="w-full h-96 border-0 bg-[#f1f5f9]"
                  />
                </div>
              </div>
            )}

            {activeTab === 'text' && (
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <div className="flex gap-2 text-slate-500 dark:text-slate-400">
                    <span className="w-14 shrink-0 font-medium">보낸사람:</span>
                    <span className="text-slate-200 font-semibold">리드마스터 CRM &lt;support@lmaster.xyz&gt;</span>
                  </div>
                  <div className="flex gap-2 text-slate-500 dark:text-slate-400">
                    <span className="w-14 shrink-0 font-medium">받는사람:</span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">{ownerEmail}</span>
                  </div>
                  <div className="flex gap-2 text-slate-500 dark:text-slate-400">
                    <span className="w-14 shrink-0 font-medium">제목:</span>
                    <span className="text-white font-bold">{subject}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed font-sans max-h-64 overflow-y-auto">
                  {bodyText}
                </div>
              </div>
            )}

            {activeTab === 'edit' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    메일 제목
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-750 text-white focus:outline-hidden focus:border-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    메일 본문 (텍스트 대체용)
                  </label>
                  <textarea
                    rows={7}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-750 text-slate-200 focus:outline-hidden focus:border-blue-500 font-sans leading-relaxed resize-none"
                  />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
          <button
            type="button"
            onClick={handleOpenGmail}
            disabled={busy}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Gmail 웹 작성창으로 직접 열어서 전송"
          >
            <ExternalLink size={14} />
            <span>Gmail 웹으로 열기</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs transition-colors cursor-pointer"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleApproveAndSend}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {busy ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>승인 및 메일 발송 중...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>승인 및 이메일 자동 발송</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
