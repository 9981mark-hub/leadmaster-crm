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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-md max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 font-bold">
              <DollarSign size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">광고비 지출 등록</h3>
              <p className="text-xs text-muted-foreground">마케팅 채널별 집행 금액을 장부에 기록합니다.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="창 닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
          {/* 집행 일자 */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              집행 일자
            </label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-input bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* 광고 매체 (채널) */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              광고 매체 (채널)
            </label>
            <select
              value={channel}
              onChange={e => setChannel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-medium transition-colors"
            >
              {AD_CHANNELS.map(ch => (
                <option key={ch} value={ch} className="bg-card text-foreground">{ch}</option>
              ))}
            </select>
          </div>

          {/* 지출 금액 (만원) */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-foreground">
                지출 금액 (만원 단위)
              </label>
              {wonAmount > 0 && (
                <span className="text-xs font-bold text-primary font-mono">
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
                className="w-full px-3 py-2 pr-12 rounded-xl border border-input bg-background text-foreground font-mono text-right text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                만원
              </span>
            </div>
          </div>

          {/* 캠페인명 / 내용 */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              캠페인명 / 지출 상세
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="예: 네이버 키워드 11월 2주차 충전"
              required
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-medium transition-colors"
            />
          </div>

          {/* 결제 수단 */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
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
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* 비고 / 메모 */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              추가 메모 (선택)
            </label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="예: 부가세 포함 결제 완료, 세금계산서 수령"
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
            />
          </div>

          {/* Footer Buttons (Inside Form) */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-muted text-foreground text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
            >
              {submitting ? '등록 중...' : '장부에 등록하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
