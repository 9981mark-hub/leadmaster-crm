import React, { useState } from 'react';
import { X, DollarSign, Calendar, Tag, CreditCard, FileText } from 'lucide-react';
import { ExpenseItem } from '../../types';

interface ExpenseAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expense: Partial<ExpenseItem>) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const AD_CHANNELS = [
  '네이버 파워링크/키워드',
  '메타 (인스타그램/페이스북)',
  '토스 애즈 (비바리퍼블리카)',
  '당근마켓 지역광고',
  '구글 애즈 / 유튜브',
  '기타 온라인/오프라인 광고',
];

export const ExpenseAddModal: React.FC<ExpenseAddModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  showToast,
}) => {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [channel, setChannel] = useState(AD_CHANNELS[0]);
  const [amountManwon, setAmountManwon] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'법인카드' | '계좌이체' | '현금' | '기타'>('법인카드');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const numAmount = parseFloat(amountManwon) || 0;
  const wonAmount = numAmount * 10000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      showToast('광고비 지출 금액(만원)을 입력해주세요.', 'error');
      return;
    }
    if (!description.trim()) {
      showToast('캠페인명 또는 지출 내용을 입력해주세요.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        date,
        category: '광고비',
        amount: numAmount,
        description: `[${channel.split(' ')[0]}] ${description.trim()}`,
        paymentMethod,
        memo: memo.trim() || undefined,
      });
      showToast(`광고비 ${numAmount.toLocaleString()}만원이 성공적으로 등록되었습니다.`, 'success');
      onClose();
    } catch (err: any) {
      showToast('광고비 등록 중 오류가 발생했습니다: ' + (err.message || '다시 시도해주세요.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">광고비 지출 등록</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">마케팅 채널별 집행 금액을 장부에 기록합니다.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-100 dark:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* 집행 일자 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              집행 일자
            </label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 광고 매체 (채널) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              광고 매체 (채널)
            </label>
            <select
              value={channel}
              onChange={e => setChannel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
            >
              {AD_CHANNELS.map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </div>

          {/* 지출 금액 (만원) */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                지출 금액 (만원 단위)
              </label>
              {wonAmount > 0 && (
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
                  ₩ {wonAmount.toLocaleString()}원
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0"
                value={amountManwon}
                onChange={e => setAmountManwon(e.target.value)}
                placeholder="예: 150 (150만원인 경우 150 입력)"
                required
                className="w-full px-3 py-2 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-right text-sm font-bold focus:outline-none focus:border-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                만원
              </span>
            </div>
          </div>

          {/* 캠페인명 / 내용 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              캠페인명 / 지출 상세
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="예: 네이버 키워드 11월 2주차 충전"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          {/* 결제 수단 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              결제 수단
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['법인카드', '계좌이체', '현금', '기타'] as const).map(m => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    paymentMethod === m
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* 비고 / 메모 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              추가 메모 (선택)
            </label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="예: 부가세 포함 결제 완료, 세금계산서 수령"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-100 dark:bg-slate-800 font-medium transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? '등록 중...' : '장부에 등록하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
