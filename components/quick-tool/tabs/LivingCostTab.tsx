import React, { useState, useMemo } from 'react';
import { Calculator, DollarSign, TrendingDown, Copy, Check, AlertCircle } from 'lucide-react';
import { LIVING_COST_TABLE_2026, calculatePaymentEstimate } from '../data/livingCostTable2026';

interface LivingCostTabProps {
  onInsertToMemo?: (text: string) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const LivingCostTab: React.FC<LivingCostTabProps> = ({ onInsertToMemo, showToast }) => {
  const [householdSize, setHouseholdSize] = useState(1);
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState('250'); // 만원 단위
  const [additionalCostInput, setAdditionalCostInput] = useState('0'); // 만원 단위
  const [totalDebtInput, setTotalDebtInput] = useState('8000'); // 만원 단위
  const [repaymentMonths, setRepaymentMonths] = useState<number>(36); // 36개월 or 24개월
  const [copied, setCopied] = useState(false);

  // 연산 수행
  const calculation = useMemo(() => {
    const monthlyIncome = (parseFloat(monthlyIncomeInput) || 0) * 10000;
    const additionalCost = (parseFloat(additionalCostInput) || 0) * 10000;
    const totalDebt = (parseFloat(totalDebtInput) || 0) * 10000;

    return calculatePaymentEstimate({
      householdSize,
      monthlyIncome,
      additionalCost,
      totalDebt,
      repaymentPeriodMonths: repaymentMonths,
    });
  }, [householdSize, monthlyIncomeInput, additionalCostInput, totalDebtInput, repaymentMonths]);

  // 포맷팅 헬퍼
  const formatMoney = (val: number) => {
    if (val <= 0) return '0원';
    const manwon = Math.floor(val / 10000);
    if (manwon >= 10000) {
      const eok = Math.floor(manwon / 10000);
      const rem = manwon % 10000;
      return rem > 0 ? `${eok}억 ${rem.toLocaleString()}만원` : `${eok}억원`;
    }
    return `${manwon.toLocaleString()}만원`;
  };

  // 상담 스크립트
  const summaryScript = useMemo(() => {
    return `[2026 최저생계비 및 예상 변제금]
• ${calculation.householdSize}인 가구 인정 생계비: ${formatMoney(calculation.totalLivingCost)} (기준 60%: ${formatMoney(calculation.standardLivingCost)})
• 고객 월 실수령액: ${monthlyIncomeInput}만원
• 예상 월 변제금(가용소득): ${formatMoney(calculation.estimatedMonthlyPayment)} (${repaymentMonths}개월 납부)
• ${repaymentMonths}개월 총 변제액: ${formatMoney(calculation.totalRepayment)}
• 총 채무 ${totalDebtInput}만원 중 예상 탕감액: ${formatMoney(calculation.forgivenAmount)} (탕감률 약 ${calculation.forgivenRate}%)`;
  }, [calculation, monthlyIncomeInput, repaymentMonths, totalDebtInput]);

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryScript);
    setCopied(true);
    if (showToast) showToast('생계비 및 변제금 산출 결과가 복사되었습니다.', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (onInsertToMemo) {
      onInsertToMemo(summaryScript);
      if (showToast) showToast('상담 메모에 계산 결과가 반영되었습니다.', 'success');
    } else {
      handleCopy();
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* 1. 가구원 수 선택 */}
      <div className="bg-card p-4 rounded-xl border border-border space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-2xs font-semibold text-muted-foreground">
            👨‍👩‍👧‍👦 가구원 수 선택 (부양가족 포함)
          </label>
          <span className="text-2xs font-mono text-primary font-bold">
            2026년 기준 60%: {calculation.standardLivingCost.toLocaleString()}원
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((num) => {
            const isSelected = householdSize === num;
            return (
              <button
                key={num}
                onClick={() => setHouseholdSize(num)}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'bg-background hover:bg-muted text-foreground border border-border'
                }`}
              >
                {num}인 가구
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. 소득 및 채무 금액 입력 */}
      <div className="bg-card p-4 rounded-xl border border-border space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-2xs font-semibold text-muted-foreground mb-1">
              💵 월평균 실수령액
            </label>
            <div className="relative">
              <input
                type="number"
                value={monthlyIncomeInput}
                onChange={(e) => setMonthlyIncomeInput(e.target.value)}
                placeholder="250"
                className="w-full pl-3 pr-8 py-2 text-sm font-mono font-bold bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="absolute right-2.5 top-2.5 text-2xs text-muted-foreground">만원</span>
            </div>
          </div>

          <div>
            <label className="block text-2xs font-semibold text-muted-foreground mb-1">
              💳 총 채무액 (원금)
            </label>
            <div className="relative">
              <input
                type="number"
                value={totalDebtInput}
                onChange={(e) => setTotalDebtInput(e.target.value)}
                placeholder="8000"
                className="w-full pl-3 pr-8 py-2 text-sm font-mono font-bold bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="absolute right-2.5 top-2.5 text-2xs text-muted-foreground">만원</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-2xs font-semibold text-muted-foreground mb-1">
              ➕ 추가 인정 생계비 (주거/의료/양육)
            </label>
            <div className="relative">
              <input
                type="number"
                value={additionalCostInput}
                onChange={(e) => setAdditionalCostInput(e.target.value)}
                placeholder="0"
                className="w-full pl-3 pr-8 py-1.5 text-xs font-mono bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="absolute right-2.5 top-2 text-2xs text-muted-foreground">만원</span>
            </div>
          </div>

          <div>
            <label className="block text-2xs font-semibold text-muted-foreground mb-1">
              ⏳ 변제 기간 선택
            </label>
            <div className="flex gap-1.5">
              <button
                onClick={() => setRepaymentMonths(36)}
                className={`flex-1 py-1.5 rounded-lg text-2xs font-semibold border ${
                  repaymentMonths === 36
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border'
                }`}
              >
                36개월 (일반)
              </button>
              <button
                onClick={() => setRepaymentMonths(24)}
                className={`flex-1 py-1.5 rounded-lg text-2xs font-semibold border ${
                  repaymentMonths === 24
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-background text-foreground border-border'
                }`}
              >
                24개월 (청년특례)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 계산 결과 대시보드 */}
      <div className="bg-card p-4 rounded-xl border border-border space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <span className="block text-2xs text-primary font-medium">예상 월 변제금 (가용소득)</span>
            <span className="text-xl font-bold font-mono text-primary">
              {formatMoney(calculation.estimatedMonthlyPayment)}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="block text-2xs text-emerald-400 font-medium">예상 원금 탕감률</span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              약 {calculation.forgivenRate}%
            </span>
          </div>
        </div>

        {/* 탕감률 프로그레스 바 */}
        <div className="space-y-1">
          <div className="flex justify-between text-2xs font-mono text-muted-foreground">
            <span>총 납부: {formatMoney(calculation.totalRepayment)}</span>
            <span>탕감액: {formatMoney(calculation.forgivenAmount)}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden flex">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${Math.max(5, 100 - calculation.forgivenRate)}%` }}
              title="변제액 비율"
            />
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${calculation.forgivenRate}%` }}
              title="탕감 비율"
            />
          </div>
        </div>

        {/* 안내 알림 */}
        {!calculation.isEligible ? (
          <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-2xs flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>월 소득이 법정 최저생계비보다 적어 개인회생 진행이 어렵습니다. (개인파산 검토 권장)</span>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border text-2xs text-muted-foreground">
            💡 월 소득에서 총 인정 생계비({formatMoney(calculation.totalLivingCost)})를 제외한 차액이 월 변제금으로 산정됩니다.
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '복사 완료' : '결과 복사'}
          </button>
          <button
            onClick={handleInsert}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            상담 메모에 반영
          </button>
        </div>
      </div>
    </div>
  );
};
