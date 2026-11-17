import React, { useState, useEffect } from 'react';
import { 
  Building2, X, CheckCircle2, Phone, Mail, Users, MessageSquare, 
  ArrowRight, AlertCircle, ShieldCheck, FileText, Copy, Check, 
  CreditCard, Sparkles, Download, ExternalLink, ChevronRight
} from 'lucide-react';
import { submitOrgApplication, OrgApplicationInput } from '../services/orgApplicationService';
import { B2B_TERMS, TermItem, CURRENT_TERMS_VERSION } from '../services/termsContent';
import TermsDetailModal from './common/TermsDetailModal';

interface CompanySignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  initialPlan?: string;
  onSuccess?: () => void;
}

export default function CompanySignupModal({
  isOpen,
  onClose,
  initialEmail = '',
  initialPlan = 'starter',
  onSuccess,
}: CompanySignupModalProps) {
  // 1단계 입력 상태
  const [step, setStep] = useState<1 | 2>(1); // 1: 신청 및 약관 동의, 2: 접수 완료 및 입금 안내
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState(initialEmail);
  const [phone, setPhone] = useState('');
  const [agentCountTier, setAgentCountTier] = useState<'1-5' | '6-20' | '21+'>('1-5');
  const [selectedPlan, setSelectedPlan] = useState<string>(initialPlan);
  const [memo, setMemo] = useState('');

  // 약관 동의 상태 (4대 필수 약관)
  const [agreedTerms, setAgreedTerms] = useState<Record<string, boolean>>({
    termsOfService: false,
    privacyDpa: false,
    billingRefundPolicy: false,
    recordingRetentionPolicy: false,
  });
  const [viewingTerm, setViewingTerm] = useState<TermItem | null>(null);

  // 2단계 세금계산서 입력 상태
  const [businessNumber, setBusinessNumber] = useState('');
  const [taxInvoiceEmail, setTaxInvoiceEmail] = useState('');
  const [taxSaved, setTaxSaved] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  // 제출 상태
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [clientIp, setClientIp] = useState('127.0.0.1');

  useEffect(() => {
    if (initialEmail) setOwnerEmail(initialEmail);
    if (initialPlan) setSelectedPlan(initialPlan);
  }, [initialEmail, initialPlan]);

  // IP 주소 획득 (전자계약 감사 로그용)
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setClientIp(data.ip))
      .catch(() => setClientIp('127.0.0.1'));
  }, []);

  if (!isOpen) return null;

  // 전체 동의 여부
  const isAllAgreed = B2B_TERMS.every(t => agreedTerms[t.id]);

  const handleToggleAll = () => {
    const next = !isAllAgreed;
    const updated: Record<string, boolean> = {};
    B2B_TERMS.forEach(t => { updated[t.id] = next; });
    setAgreedTerms(updated);
  };

  const handleToggleOne = (id: string) => {
    setAgreedTerms(prev => ({ ...prev, [id]: !prev[id] }));
  };

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
    if (!isAllAgreed) {
      setErrorMsg('서비스 이용을 위해 4대 필수 약관에 모두 동의하셔야 합니다.');
      return;
    }

    setSubmitting(true);
    try {
      const input: OrgApplicationInput = {
        companyName,
        ownerName: ownerName.trim() || `${companyName} 대표`,
        ownerEmail,
        phone,
        agentCountTier,
        selectedPlan,
        memo,
        businessNumber,
        taxInvoiceEmail: taxInvoiceEmail.trim() || ownerEmail,
        agreedIp: clientIp,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      };

      await submitOrgApplication(input);
      setStep(2);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || '가입 신청 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyAccount = () => {
    navigator.clipboard.writeText('3333-21-490199');
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleDownloadInvoiceEstimate = () => {
    const text = `# [리드마스터 CRM] 서비스 이용 견적서 및 입금 안내서
--------------------------------------------------
발행 일시: ${new Date().toLocaleString('ko-KR')}
신청 회사: ${companyName}
대표자/신청자: ${ownerName || companyName + ' 대표'} (${ownerEmail})
연락처: ${phone}
선택 요금제: ${selectedPlan.toUpperCase()} (상담원 규모: ${agentCountTier === '1-5' ? '1~5인' : agentCountTier === '6-20' ? '6~20인' : '21인 이상'})
--------------------------------------------------
■ 공식 수납 계좌 안내:
- 은행: 카카오뱅크
- 계좌번호: 3333-21-490199
- 예금주: 진성훈 (리드마스터)
- 입금자명: ${companyName}_${ownerName || '대표'}

■ 4대 전자 이용계약 체결 내역 (전자서명법 제3조 준수):
- 동의 일시: ${new Date().toISOString()}
- 접속 IP: ${clientIp}
- 약관 버전: ${CURRENT_TERMS_VERSION}
- 동의 항목: 서비스 이용약관, 개인정보 처리위탁(DPA), 요금 청구/환불 규정, 통화녹음 1년 보관 정책 (전체 동의)

※ 입금 확인 후 10분 내로 전용 워크스페이스가 활성화됩니다.
문의: support@lmaster.xyz / 010-4683-4901
`;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `리드마스터_이용견적_입금안내_${companyName.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setErrorMsg('');
    setStep(1);
    onClose();
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={handleClose}
      >
        <div 
          className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-100 max-h-[92vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {step === 2 ? (
            /* ═══════════════════════════════════════════════════════════ */
            /* 2단계: 신청 완료, 공식 입금 계좌 안내 및 세금계산서 입력 */
            /* ═══════════════════════════════════════════════════════════ */
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 mb-3 shadow-inner">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  이용 신청 및 전자계약 동의가 완료되었습니다
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  <span className="text-blue-400 font-semibold">{companyName}</span>의 전용 워크스페이스 개설 신청이 접수되었습니다.
                </p>
              </div>

              {/* 공식 입금 계좌 카드 */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-950/70 via-slate-950 to-slate-950 border border-blue-500/30 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                    <CreditCard size={15} />
                    <span>공식 프로그램 사용료 수납 계좌</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    무통장 / 계좌이체
                  </span>
                </div>

                <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">카카오뱅크</div>
                    <div className="text-base sm:text-lg font-mono font-black text-white tracking-wider">
                      3333-21-490199
                    </div>
                    <div className="text-xs text-slate-300">
                      예금주: <strong className="text-white">진성훈 (리드마스터)</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAccount}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-600/30 active:scale-95 shrink-0"
                  >
                    {copiedAccount ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedAccount ? '복사됨!' : '계좌 복사'}</span>
                  </button>
                </div>

                <div className="text-[11px] text-amber-300/90 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 leading-relaxed">
                  ⚠️ <b>입금자명 안내:</b> 입금 시 통장 표기명을 <b>[{companyName}_{ownerName || '대표'}]</b>로 입력해 주시면 확인이 신속히 진행됩니다.
                </div>
              </div>

              {/* 세금계산서 발행 정보 입력 폼 */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <FileText size={14} className="text-blue-400" />
                    <span>전자세금계산서 발행 정보 (선택 입력)</span>
                  </span>
                  {taxSaved && (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <Check size={11} /> 저장 완료
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    value={businessNumber}
                    onChange={e => { setBusinessNumber(e.target.value); setTaxSaved(false); }}
                    placeholder="사업자등록번호 (예: 123-45-67890)"
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-blue-500 text-white outline-none font-mono"
                  />
                  <input
                    type="email"
                    value={taxInvoiceEmail}
                    onChange={e => { setTaxInvoiceEmail(e.target.value); setTaxSaved(false); }}
                    placeholder="계산서 수신 이메일 (미입력 시 구글 메일)"
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-blue-500 text-white outline-none font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  입력해 주신 사업자 정보로 입금 확인 즉시 국세청 전자세금계산서가 발행됩니다.
                </p>
              </div>

              {/* 하단 안내 및 다운로드 액션 */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadInvoiceEstimate}
                  className="w-full sm:w-1/2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                >
                  <Download size={14} />
                  <span>견적서·안내서 다운로드</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full sm:w-1/2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-blue-500/25"
                >
                  <span>확인 (신청 완료)</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════ */
            /* 1단계: 회사 정보 입력 + 4대 전자 이용계약 약관 동의 */
            /* ═══════════════════════════════════════════════════════════ */
            <>
              {/* 모달 상단 헤더 */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white tracking-tight">
                        리드마스터 TM 회사 가입 및 이용 계약
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20">
                        {selectedPlan === 'starter' ? '스타터 플랜' : selectedPlan === 'business' ? '비즈니스 플랜' : selectedPlan === 'pro' ? '프로 플랜' : '엔터프라이즈'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      TM 대표 전용 워크스페이스 개설 및 7일 무료 체험 (Clickwrap 전자 계약)
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
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
                {/* 1. 회사명 & 대표자명 (2-Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      placeholder="예: 리드마스터 법률센터"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 text-white outline-none text-xs sm:text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Users size={13} className="text-blue-400" />
                      <span>대표자 성명 (선택)</span>
                    </label>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={e => setOwnerName(e.target.value)}
                      placeholder="예: 홍길동 대표"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 text-white outline-none text-xs sm:text-sm"
                    />
                  </div>
                </div>

                {/* 2. 연락처 & 구글 로그인 이메일 (2-Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      placeholder="010-0000-0000"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 text-white outline-none text-xs sm:text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Mail size={13} className="text-blue-400" />
                        <span>구글 로그인 이메일 (필수)</span>
                      </label>
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        Google 전용
                      </span>
                    </div>
                    <input
                      type="email"
                      required
                      value={ownerEmail}
                      onChange={e => setOwnerEmail(e.target.value)}
                      placeholder="example@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 text-white outline-none text-xs sm:text-sm font-mono"
                    />
                  </div>
                </div>

                {/* 3. 상담원 인원 규모 선택 */}
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
                        onClick={() => {
                          setAgentCountTier(tier);
                          if (tier === '1-5') setSelectedPlan('starter');
                          else if (tier === '6-20') setSelectedPlan('business');
                          else setSelectedPlan('pro');
                        }}
                        className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          agentCountTier === tier
                            ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {tier === '1-5' ? '1 ~ 5명 (스타터)' : tier === '6-20' ? '6 ~ 20명 (비즈니스)' : '21명 이상 (프로)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* 4. B2B 전자 이용계약 4대 약관 동의 (Clickwrap Agreement) */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 pt-3">
                  {/* 전체 동의 마스터 체크박스 */}
                  <label className="flex items-center justify-between pb-3 border-b border-slate-800/80 cursor-pointer group">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isAllAgreed}
                        onChange={handleToggleAll}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      <span className="font-bold text-xs sm:text-sm text-white group-hover:text-blue-300 transition-colors">
                        전자 이용계약 및 4대 필수 약관에 전체 동의합니다
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">전자서명법 제3조 준수</span>
                  </label>

                  {/* 4대 개별 필수 약관 리스트 */}
                  <div className="space-y-2 pt-0.5">
                    {B2B_TERMS.map(term => {
                      const checked = !!agreedTerms[term.id];
                      return (
                        <div key={term.id} className="flex items-center justify-between text-xs py-1">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleOne(term.id)}
                              className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700 cursor-pointer"
                            />
                            <span className="text-slate-300 flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">
                                [필수]
                              </span>
                              <span>{term.title}</span>
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setViewingTerm(term)}
                            className="text-[11px] text-slate-400 hover:text-blue-300 flex items-center gap-0.5 hover:underline transition-colors shrink-0 pl-2"
                          >
                            <span>전문보기</span>
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 leading-normal flex items-center justify-between">
                    <span>* 체크 시 동의 일시 및 IP({clientIp})가 감사 로그에 영구 저장됩니다.</span>
                    <span className="font-mono text-slate-400">버전 {CURRENT_TERMS_VERSION}</span>
                  </div>
                </div>

                {/* 제출 버튼 */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting || !isAllAgreed}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <span>전자계약 체결 및 접수 처리 중...</span>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        <span>약관 동의하고 이용 신청서 접수하기</span>
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

      {/* 약관 전문 보기 팝업 모달 */}
      <TermsDetailModal
        isOpen={!!viewingTerm}
        term={viewingTerm}
        onClose={() => setViewingTerm(null)}
        onAgree={() => {
          if (viewingTerm) {
            setAgreedTerms(prev => ({ ...prev, [viewingTerm.id]: true }));
          }
        }}
      />
    </>
  );
}
