import React, { useState, useEffect } from 'react';
import { Building2, X, CheckCircle2, Phone, Mail, Users, MessageSquare, ArrowRight, AlertCircle } from 'lucide-react';
import { submitOrgApplication, OrgApplicationInput } from '../services/orgApplicationService';

interface CompanySignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  onSuccess?: () => void;
}

export default function CompanySignupModal({
  isOpen,
  onClose,
  initialEmail = '',
  onSuccess,
}: CompanySignupModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState(initialEmail);
  const [phone, setPhone] = useState('');
  const [agentCountTier, setAgentCountTier] = useState<'1-5' | '6-20' | '21+'>('1-5');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (initialEmail) setOwnerEmail(initialEmail);
  }, [initialEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!companyName.trim()) {
      setErrorMsg('회사명(또는 상호)을 입력해주세요.');
      return;
    }
    if (!ownerEmail.trim()) {
      setErrorMsg('로그인에 사용할 구글 이메일을 입력해주세요.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('연락처(휴대폰 번호)를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const input: OrgApplicationInput = {
        companyName,
        ownerEmail,
        phone,
        agentCountTier,
        memo,
      };
      await submitOrgApplication(input);
      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || '가입 신청 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setErrorMsg('');
    setSubmitted(false);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {submitted ? (
          /* 신청 완료 화면 */
          <div className="text-center py-6 space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 size={36} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">
                가입 신청이 성공적으로 접수되었습니다
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
                <span className="text-blue-400 font-semibold">{companyName}</span>의 전용 워크스페이스 개설 신청이 접수되었습니다.
              </p>
            </div>
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 text-left text-xs text-slate-400 space-y-1.5">
              <div className="flex justify-between">
                <span>로그인 예정 이메일:</span>
                <span className="text-slate-200 font-mono">{ownerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span>안내 연락처:</span>
                <span className="text-slate-200">{phone}</span>
              </div>
              <div className="flex justify-between">
                <span>상담원 규모:</span>
                <span className="text-slate-200">{agentCountTier === '1-5' ? '1~5명' : agentCountTier === '6-20' ? '6~20명' : '21명 이상'}</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              관리자 확인 후 10분 내로 승인 및 전용 워크스페이스가 개설됩니다.<br />
              승인 완료 후 구글 로그인 버튼을 누르면 즉시 대표 관리자 화면으로 시작하실 수 있습니다.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors cursor-pointer"
            >
              확인
            </button>
          </div>
        ) : (
          /* 신청서 작성 폼 */
          <>
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    리드마스터 TM 회사 가입 신청
                  </h3>
                  <p className="text-xs text-slate-400">
                    TM 대표 전용 워크스페이스 개설 및 7일 무료 체험
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
              {/* 회사명 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Building2 size={13} className="text-blue-400" />
                  <span>회사명 / 상호 (필수)</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white outline-none text-xs sm:text-sm"
                />
              </div>

              {/* 연락처 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Phone size={13} className="text-blue-400" />
                  <span>연락처 (필수)</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white outline-none text-xs sm:text-sm"
                />
              </div>

              {/* 로그인 예정 구글 이메일 (구글 계정만 가입 가능 강조) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Mail size={13} className="text-blue-400" />
                    <span>로그인에 사용할 구글 이메일 (필수)</span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                    <AlertCircle size={10} />
                    <span>구글 계정만 가입 가능</span>
                  </span>
                </div>
                <input
                  type="email"
                  required
                  value={ownerEmail}
                  onChange={e => setOwnerEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white outline-none text-xs sm:text-sm font-mono"
                />
                <div className="space-y-0.5 pt-0.5">
                  <p className="text-[11px] text-amber-400/90 font-medium">
                    * 리드마스터는 Google 간편 로그인 시스템을 사용하므로, 반드시 구글 계정(@gmail.com 또는 구글 워크스페이스)을 입력하셔야 합니다.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    승인 완료 시 이 구글 계정에 회사 대표(Owner) 권한이 자동으로 부여됩니다.
                  </p>
                </div>
              </div>

              {/* 상담원 인원 규모 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Users size={13} className="text-blue-400" />
                  <span>예상 상담원 규모</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['1-5', '6-20', '21+'] as const).map(tier => (
                    <button
                      type="button"
                      key={tier}
                      onClick={() => setAgentCountTier(tier)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        agentCountTier === tier
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {tier === '1-5' ? '1 ~ 5명' : tier === '6-20' ? '6 ~ 20명' : '21명 이상'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 메모 / 요청 사항 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-blue-400" />
                  <span>도입 문의 및 요청 사항 (선택)</span>
                </label>
                <textarea
                  rows={2}
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white outline-none text-xs resize-none"
                />
              </div>

              {/* 제출 버튼 */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <span>접수 처리 중...</span>
                  ) : (
                    <>
                      <span>가입 신청서 접수하기</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
