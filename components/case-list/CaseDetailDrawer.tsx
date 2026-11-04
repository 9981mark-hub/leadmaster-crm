import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Phone, ExternalLink, ChevronUp, ChevronDown, User, Calendar, 
  MapPin, Briefcase, Home, ShieldAlert, Sparkles, Send, Clock, 
  FileText, ArrowRight, CheckCircle2, AlertCircle, Zap
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Case, Partner } from '../../types';
import { STATUS_COLOR_MAP } from '../../constants';
import { safeFormat } from '../../utils';

interface CaseDetailDrawerProps {
  c: Case | null;
  isOpen: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  partners: Partner[];
  statuses: string[];
  onStatusChange: (caseId: string, newStatus: string, oldStatus: string) => void;
  onAddMemo?: (caseId: string, memo: string) => Promise<void>;
  onDial: (c: Case) => void;
}

export const CaseDetailDrawer: React.FC<CaseDetailDrawerProps> = ({
  c,
  isOpen,
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  partners,
  statuses,
  onStatusChange,
  onAddMemo,
  onDial,
}) => {
  const navigate = useNavigate();
  const [newMemo, setNewMemo] = useState('');
  const [submittingMemo, setSubmittingMemo] = useState(false);

  if (!c || !isOpen) return null;

  const partner = partners.find(p => p.partnerId === c.partnerId);

  // 총 채무 계산 (신용대출 합산)
  const totalCreditDebt = (c.creditLoan || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // 빠른 한 줄 메모 등록
  const handleSaveMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemo.trim() || !onAddMemo) return;
    try {
      setSubmittingMemo(true);
      await onAddMemo(c.caseId, newMemo.trim());
      setNewMemo('');
    } finally {
      setSubmittingMemo(false);
    }
  };

  const cleanPhone = String(c.phone || '').replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.length === 11
    ? `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 7)}-${cleanPhone.slice(7)}`
    : cleanPhone.length === 10
      ? `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`
      : c.phone;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* 뒷배경 딤(Dim) 레이어 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        {/* 슬라이드 아웃 패널 */}
        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="w-screen max-w-lg bg-white dark:bg-gray-900 shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800"
          >
            {/* 1. 상단 내비게이션 바 */}
            <div className="px-5 py-3.5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/80 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">퀵 인스펙터</span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                {/* 이전/다음 고객 이동 버튼 */}
                <div className="flex items-center gap-0.5 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 p-0.5 shadow-sm">
                  <button
                    onClick={onPrev}
                    disabled={!hasPrev}
                    className="p-1 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="이전 고객 (위쪽)"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    onClick={onNext}
                    disabled={!hasNext}
                    className="p-1 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="다음 고객 (아래쪽)"
                  >
                    <ChevronDown size={15} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/case/${c.caseId}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors"
                >
                  <span>전체 상세</span>
                  <ExternalLink size={13} />
                </Link>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="닫기 (ESC)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 2. 고객 핵심 요약 헤더 */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                      {c.customerName}
                    </h2>
                    <span className="text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                      {c.caseType || '개인회생'}
                    </span>
                    {c.isNew && (
                      <span className="text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-mono text-gray-600 dark:text-gray-300 mt-1">
                    {formattedPhone}
                  </p>
                </div>

                {/* 상태 변경 셀렉터 */}
                <div className="shrink-0">
                  <select
                    value={c.status}
                    onChange={(e) => onStatusChange(c.caseId, e.target.value, c.status)}
                    className="text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 py-1.5 px-2.5 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                  >
                    {statuses.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 통화 발신 & 간편 콜 버튼 */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={() => onDial(c)}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.98]"
                >
                  <Phone size={16} />
                  <span>스마트폰 전화 걸기</span>
                </button>
                <button
                  onClick={() => navigate(`/lite?caseId=${c.caseId}`)}
                  className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-3 rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.98]"
                >
                  <Zap size={16} />
                  <span>간편 콜 모드</span>
                </button>
              </div>
            </div>

            {/* 3. 본문 세부 정보 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              
              {/* 기본 프로필 그리드 */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3.5 border border-gray-100 dark:border-gray-800 space-y-2.5">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  기본 인적사항
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <span className="text-gray-400 dark:text-gray-500">출생 / 성별:</span>{' '}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{c.birth || '-'}년 / {c.gender || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 dark:text-gray-500">거주지역:</span>{' '}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{c.region || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 dark:text-gray-500">결혼 / 자녀:</span>{' '}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{c.maritalStatus || '-'} / {c.childrenCount !== undefined ? `${c.childrenCount}명` : '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 dark:text-gray-500">유입경로:</span>{' '}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{c.inboundPath || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 dark:text-gray-500">제휴 법무법인:</span>{' '}
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{partner?.name || '미지정'}</span>
                  </div>
                </div>
              </div>

              {/* 소득 및 직업 */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3.5 border border-gray-100 dark:border-gray-800 space-y-2.5">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  직업 및 소득
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <span className="text-gray-400 dark:text-gray-500">직업군:</span>{' '}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{c.jobTypes?.join(', ') || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 dark:text-gray-500">4대보험:</span>{' '}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{c.insurance4 || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 dark:text-gray-500">월 순소득:</span>{' '}
                    <span className="font-bold text-blue-600 dark:text-blue-400">{c.incomeNet ? `${c.incomeNet.toLocaleString()}만 원` : '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 dark:text-gray-500">월 대출상환액:</span>{' '}
                    <span className="font-semibold text-rose-600 dark:text-rose-400">{c.loanMonthlyPay ? `${c.loanMonthlyPay.toLocaleString()}만 원` : '-'}</span>
                  </div>
                </div>
              </div>

              {/* 채무 및 주거 */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3.5 border border-gray-100 dark:border-gray-800 space-y-2.5">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  채무 및 주거 형태
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <span className="text-gray-400 dark:text-gray-500">주거:</span>{' '}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{c.housingType || '-'} ({c.housingDetail || '-'})</span>
                  </div>
                  <div>
                    <span className="text-gray-400 dark:text-gray-500">보증금/월세:</span>{' '}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{c.deposit || 0} / {c.rent || 0}만 원</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 dark:text-gray-500">신용대출 추정 총액:</span>{' '}
                    <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                      {totalCreditDebt > 0 ? `${totalCreditDebt.toLocaleString()}만 원` : '기록 없음'}
                    </span>
                    {c.creditLoan && c.creditLoan.length > 0 && (
                      <span className="text-[11px] text-gray-500 ml-1.5">({c.creditLoan.length}건)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* AI 요약본 (있는 경우) */}
              {c.aiSummary && (
                <div className="bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl p-3.5 border border-indigo-100 dark:border-indigo-900/60 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <Sparkles size={14} />
                    <span>AI 상담 분석 요약</span>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                    {c.aiSummary}
                  </p>
                </div>
              )}

              {/* 최근 상담 메모 & 빠른 메모 작성 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <FileText size={14} className="text-gray-500" />
                    <span>상담 특이사항 메모 ({c.specialMemo?.length || 0})</span>
                  </h4>
                </div>

                {/* 최근 메모 3건 */}
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {c.specialMemo && c.specialMemo.length > 0 ? (
                    [...c.specialMemo].reverse().slice(0, 5).map((m, idx) => (
                      <div key={m.id || idx} className="text-xs p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                          <span>{safeFormat(m.createdAt, 'yyyy-MM-dd HH:mm')}</span>
                        </div>
                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{m.content}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 py-2 text-center">등록된 메모가 없습니다.</p>
                  )}
                </div>

                {/* 빠른 1줄 메모 입력 폼 */}
                {onAddMemo && (
                  <form onSubmit={handleSaveMemo} className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newMemo}
                      onChange={(e) => setNewMemo(e.target.value)}
                      placeholder="빠른 상담 메모 입력 후 Enter..."
                      disabled={submittingMemo}
                      className="flex-1 text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!newMemo.trim() || submittingMemo}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
                    >
                      <Send size={12} />
                      <span>저장</span>
                    </button>
                  </form>
                )}
              </div>

            </div>

            {/* 4. 하단 닫기 바 */}
            <div className="p-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/80 shrink-0 flex items-center justify-between text-xs text-gray-500">
              <span>케이스 ID: {c.caseId.slice(0, 8)}...</span>
              <button
                onClick={onClose}
                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
