import React, { useState, useMemo } from 'react';
import { Calculator, Copy, Check, ChevronDown, ChevronUp, Sparkles, TrendingDown, DollarSign, ShieldCheck } from 'lucide-react';
import { Case } from '../../types';

// 2026년 기준 가구원 수별 법원 최저생계비 (기준 중위소득의 60%, 단위: 만 원)
const MIN_LIVING_COST_2026: Record<number, number> = {
  1: 139, // 1인 가구 1,392,000원
  2: 231, // 2인 가구 2,310,000원
  3: 295, // 3인 가구 2,950,000원
  4: 357, // 4인 가구 3,570,000원
  5: 418, // 5인 가구 4,180,000원
  6: 477, // 6인 가구 4,770,000원
};

const getLivingCost = (count: number): number => {
  if (count <= 1) return MIN_LIVING_COST_2026[1];
  if (count <= 6) return MIN_LIVING_COST_2026[count];
  return MIN_LIVING_COST_2026[6] + (count - 6) * 59;
};

interface Props {
  c: Case;
  onSaveResultToMemo?: (resultText: string) => void;
}

export const LiteDebtReliefCalculator: React.FC<Props> = ({ c, onSaveResultToMemo }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // 초기값: 케이스 데이터에서 스마트하게 추출
  const initialIncome = useMemo(() => {
    if (c.incomeNet && c.incomeNet > 0) return c.incomeNet;
    const details = c.incomeDetails || {};
    const sum = (Number(details.salary) || 0) + (Number(details.business) || 0) + (Number(details.freelance) || 0);
    return sum > 0 ? sum : 220; // 기본 220만 원
  }, [c.incomeNet, c.incomeDetails]);

  const initialHousehold = useMemo(() => {
    const kids = Number(c.childrenCount) || 0;
    const isMarried = c.maritalStatus === '기혼';
    // 미성년 자녀 + 본인 (배우자는 소득 활동 여부에 따라 0.5~1인)
    return Math.max(1, 1 + kids);
  }, [c.childrenCount, c.maritalStatus]);

  const initialDebt = useMemo(() => {
    const creditTotal = (c.creditLoan || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    return creditTotal > 0 ? creditTotal : 5000; // 기본 5,000만 원
  }, [c.creditLoan]);

  const [income, setIncome] = useState<number>(initialIncome);
  const [household, setHousehold] = useState<number>(initialHousehold);
  const [totalDebt, setTotalDebt] = useState<number>(initialDebt);
  const [months, setMonths] = useState<number>(36); // 기본 36개월 변제

  // 계산 로직
  const livingCost = useMemo(() => getLivingCost(household), [household]);
  const monthlyPay = useMemo(() => Math.max(0, income - livingCost), [income, livingCost]);
  const totalRepay = useMemo(() => monthlyPay * months, [monthlyPay, months]);
  const forgivenDebt = useMemo(() => Math.max(0, totalDebt - totalRepay), [totalDebt, totalRepay]);
  const reliefRate = useMemo(() => {
    if (totalDebt <= 0) return 0;
    return Math.min(100, Math.round((forgivenDebt / totalDebt) * 100));
  }, [totalDebt, forgivenDebt]);

  // 상담원 즉석 대본
  const scriptText = useMemo(() => {
    return `[3초 탕감 브리핑]\n총 채무 ${totalDebt.toLocaleString()}만 원 중 원금 약 ${forgivenDebt.toLocaleString()}만 원(${reliefRate}%) 탕감 예상.\n월 예상 변제금: 약 ${monthlyPay.toLocaleString()}만 원 (${months}개월 납부 후 전액 면책).`;
  }, [totalDebt, forgivenDebt, reliefRate, monthlyPay, months]);

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (onSaveResultToMemo) {
      onSaveResultToMemo(scriptText);
    }
  };

  return (
    <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-cyan-950/40 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 overflow-hidden shadow-xs transition-all">
      {/* 헤더 토글 바 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-emerald-100/40 dark:hover:bg-emerald-900/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Calculator size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-emerald-950 dark:text-emerald-100">
                3초 탕감율 & 변제금 계산기
              </span>
              <span className="text-[10px] bg-emerald-200/70 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-extrabold px-1.5 py-0.5 rounded-full">
                {reliefRate}% 탕감
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
              월 변제금: <strong className="text-emerald-900 dark:text-emerald-100">{monthlyPay.toLocaleString()}만 원</strong> (36개월)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
          <span>{isOpen ? '접기' : '계산 열기'}</span>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* 펼쳐졌을 때 계산 컨트롤 및 실시간 결과 */}
      {isOpen && (
        <div className="p-3.5 pt-1 space-y-3 border-t border-emerald-200/60 dark:border-emerald-800/40 text-xs">
          
          {/* 입력 필드 그리드 */}
          <div className="grid grid-cols-3 gap-2 bg-white/80 dark:bg-gray-800/80 p-2.5 rounded-xl border border-emerald-100 dark:border-gray-700">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                월 순소득 (만 원)
              </label>
              <input
                type="number"
                value={income || ''}
                onChange={(e) => setIncome(Number(e.target.value) || 0)}
                className="w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                step="10"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                부양가족 수 (명)
              </label>
              <select
                value={household}
                onChange={(e) => setHousehold(Number(e.target.value))}
                className="w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n}인 가구 ({MIN_LIVING_COST_2026[n]}만)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                총 채무액 (만 원)
              </label>
              <input
                type="number"
                value={totalDebt || ''}
                onChange={(e) => setTotalDebt(Number(e.target.value) || 0)}
                className="w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                step="100"
              />
            </div>
          </div>

          {/* 핵심 계산 결과 하이라이트 카드 */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl p-3 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-100 font-medium">예상 탕감 원금</span>
              <div className="text-xl font-extrabold tracking-tight">
                약 {forgivenDebt.toLocaleString()}만 원 감면
              </div>
              <p className="text-[10px] text-emerald-200 mt-0.5">
                월 변제금: 약 {monthlyPay.toLocaleString()}만 원 (최저생계비 {livingCost}만 원 공제)
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider">탕감율</span>
              <div className="text-2xl font-black text-amber-300">
                {reliefRate}%
              </div>
            </div>
          </div>

          {/* 상담원 추천 멘트 박스 */}
          <div className="bg-white/90 dark:bg-gray-800/90 rounded-xl p-2.5 border border-emerald-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                <Sparkles size={12} />
                고객 통화 안내 모범 멘트
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800"
                >
                  {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  <span>{copied ? '복사됨' : '복사'}</span>
                </button>
                {onSaveResultToMemo && (
                  <button
                    type="button"
                    onClick={handleSave}
                    className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800"
                  >
                    메모 저장
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
              "고객님, 총 채무 <strong>{totalDebt.toLocaleString()}만 원</strong> 중 법원을 통해 최대 <strong>약 {reliefRate}%({forgivenDebt.toLocaleString()}만 원)</strong> 탕감 가능하시며, 월 <strong>{monthlyPay.toLocaleString()}만 원</strong>씩 36개월 납부하시면 모든 빚이 면책됩니다. 전문 수석 사무장님께 바로 연결해 드릴 테니 잠시만 기다려 주세요."
            </p>
          </div>

        </div>
      )}
    </div>
  );
};
