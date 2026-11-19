import React, { useState } from 'react';
import { X, Users, Sparkles, Send, CheckCircle2, Phone, Mail, ShieldAlert } from 'lucide-react';

interface SeatExpansionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSeats: number;
  maxSeats: number;
  orgName: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SeatExpansionModal: React.FC<SeatExpansionModalProps> = ({
  isOpen,
  onClose,
  currentSeats,
  maxSeats,
  orgName,
  showToast,
}) => {
  const [requestedSeats, setRequestedSeats] = useState(String(Math.max(10, maxSeats + 5)));
  const [requestMemo, setRequestMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSendRequest = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      showToast(`'${orgName}' ${requestedSeats}석 증설 신청이 플랫폼 운영팀에 접수되었습니다. (담당자 검토 후 즉시 승인됩니다)`, 'success');
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                라이선스 좌석(Seat) 증설 요청
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                상담원 증원 시 최대 허용 좌석 한도를 유연하게 확장할 수 있습니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-100 dark:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Current Status Box */}
          <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between">
            <div>
              <span className="text-xs text-blue-700 dark:text-blue-400 font-semibold">현재 라이선스 좌석 현황</span>
              <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                {currentSeats}석 사용 중 / 최대 {maxSeats}석
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 dark:text-slate-400">잔여 여유 좌석</span>
              <div className="text-base font-bold text-blue-600 dark:text-blue-400 font-mono">
                {Math.max(0, maxSeats - currentSeats)}석 남음
              </div>
            </div>
          </div>

          {/* Volume Tiering Guide */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              규모별 볼륨 자동 할인 혜택
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="font-bold text-slate-800 dark:text-slate-200">스타터 (1~5인)</div>
                <div className="text-blue-600 dark:text-blue-400 font-bold font-mono">₩58,000/석</div>
              </div>
              <div className="p-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20">
                <div className="font-bold text-slate-800 dark:text-slate-200">비즈니스 (6~20인)</div>
                <div className="text-blue-600 dark:text-blue-400 font-bold font-mono">₩52,000/석 <span className="text-xs text-emerald-600">(-10%)</span></div>
              </div>
              <div className="p-2.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-950/20">
                <div className="font-bold text-slate-800 dark:text-slate-200">프로 (21~50인)</div>
                <div className="text-purple-600 dark:text-purple-400 font-bold font-mono">₩46,000/석 <span className="text-xs text-emerald-600">(-20%)</span></div>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              * 좌석 수가 증가할수록 단가가 자동으로 인하되어 전체 상담원 비용이 절감됩니다.
            </p>
          </div>

          {/* Input: 희망 증설 좌석 수 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              희망 총 좌석 수 (한도 설정) *
            </label>
            <div className="relative">
              <input
                type="number"
                min={maxSeats + 1}
                value={requestedSeats}
                onChange={e => setRequestedSeats(e.target.value)}
                className="w-full px-3 py-2 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-sm focus:outline-none focus:border-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-semibold text-slate-500 dark:text-slate-400">
                석
              </span>
            </div>
          </div>

          {/* Input: 메모 / 증원 사유 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              증원 사유 / 요청 사항 (선택)
            </label>
            <textarea
              rows={2}
              value={requestMemo}
              onChange={e => setRequestMemo(e.target.value)}
              placeholder="예: 신규 인입 캠페인으로 상담원 5명 추가 채용 예정"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Quick Contact Info */}
          <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <span>긴급 문의: support@lmaster.xyz</span>
            <span className="text-blue-600 dark:text-blue-400 font-semibold">운영팀 24시간 실시간 승인</span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-100 dark:bg-slate-800 font-medium transition-colors cursor-pointer"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleSendRequest}
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send size={13} /> {submitting ? '접수 중...' : '증설 신청 접수'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
