import React, { useState, useMemo } from 'react';
import { 
  Calculator, Sparkles, TrendingDown, Users, CheckCircle2, 
  ArrowRight, ShieldCheck, DollarSign
} from 'lucide-react';
import { calculateOrgMonthlyBill } from '../../services/platform';

interface SeatCostSimulatorProps {
  initialSeats?: number;
  onApplySeats?: (seatCount: number) => void;
}

export const SeatCostSimulator: React.FC<SeatCostSimulatorProps> = ({
  initialSeats = 10,
  onApplySeats,
}) => {
  const [seats, setSeats] = useState<number>(Math.max(1, initialSeats));
  const [isAnnual, setIsAnnual] = useState<boolean>(true);

  // 실시간 요금 계산
  const bill = useMemo(() => calculateOrgMonthlyBill(seats), [seats]);
  const discountMultiplier = isAnnual ? 0.83 : 1.0; // 연간 결제 17% 할인
  const effectiveUnitPrice = Math.round(bill.unitPrice * discountMultiplier);
  const effectiveMonthlySupply = Math.round(bill.totalPrice * discountMultiplier);
  const effectiveVat = Math.floor(effectiveMonthlySupply * 0.1);
  const effectiveTotal = effectiveMonthlySupply + effectiveVat;

  // 타사 분리 도입 대비 절감액 (타사 평균: 다이얼러 4만 + 녹음 3만 + AI 5만 = 인당 12만원)
  const separateCost = seats * 120000;
  const monthlySavings = Math.max(0, separateCost - effectiveMonthlySupply);
  const annualSavings = monthlySavings * 12;

  // 볼륨 할인율 계산
  const basePrice = 58000;
  const discountRate = Math.max(0, Math.round(((basePrice - bill.unitPrice) / basePrice) * 100));

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSeats(parseInt(e.target.value, 10));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      setSeats(Math.min(200, Math.max(1, val)));
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-blue-50/50 via-slate-50 to-white dark:from-slate-800/40 dark:via-slate-850 dark:to-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 flex items-center gap-1">
              <Calculator size={12} /> 인터랙티브 요금 견적기
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              상담원 인원수를 조절하여 볼륨 할인과 실시간 예상 견적을 확인하세요.
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            좌석 규모별 실시간 견적 & 타사 대비 절감액 시뮬레이터
          </h3>
        </div>

        {/* 연간/월간 미니 토글 */}
        <div className="flex items-center self-start sm:self-auto bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setIsAnnual(false)}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              !isAnnual ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            월간
          </button>
          <button
            type="button"
            onClick={() => setIsAnnual(true)}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              isAnnual ? 'bg-blue-600 text-white font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            연간 (17% OFF)
          </button>
        </div>
      </div>

      {/* Main Simulator Body */}
      <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Slider & Seat Controller (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Users size={16} className="text-blue-600 dark:text-blue-400" />
              상담원 라이선스 좌석 수 (Seats)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="200"
                value={seats}
                onChange={handleInputChange}
                className="w-20 px-3 py-1.5 text-right font-black font-mono text-base bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">명</span>
            </div>
          </div>

          {/* Range Slider */}
          <div className="space-y-2">
            <input
              type="range"
              min="1"
              max="120"
              value={seats}
              onChange={handleSliderChange}
              className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            {/* Range Labels */}
            <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1">
              <span>1인 (스타터)</span>
              <span>10인 (비즈니스)</span>
              <span>30인 (프로)</span>
              <span>60인 (엔터프라이즈)</span>
              <span>100인+ (메가)</span>
            </div>
          </div>

          {/* Volume Tier Badge & Status Info */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/60">
                  {bill.tierName}
                </span>
                {discountRate > 0 && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    기본 대비 {discountRate}% 볼륨 할인 적용
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                1인당 단가: <strong className="text-slate-900 dark:text-white font-mono text-sm">₩{effectiveUnitPrice.toLocaleString()}</strong> / 월
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {seats <= 5 && '1~5인 소규모 부티크 팀을 위한 올인원 풀패키지 기준 플랜입니다.'}
              {seats >= 6 && seats <= 20 && '6인 이상부터 10% 볼륨 우대 단가가 자동 적용되어 합리적인 확장이 가능합니다.'}
              {seats >= 21 && seats <= 50 && '21인 이상 중대형 센터용으로 20% 대량 볼륨 할인이 적용됩니다.'}
              {seats >= 51 && seats <= 100 && '51인 이상 대형 법무법인/전문 센터를 위한 28% 파격 우대 구간입니다.'}
              {seats >= 101 && '101인 이상 대형 센터는 ₩38,000 최저가 보장 혜택이 적용됩니다.'}
            </p>
          </div>
        </div>

        {/* Right: Calculated Price & Comparison Card (5 cols) */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 text-white shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-200 flex items-center gap-1">
              <Sparkles size={13} /> 예상 견적 산출 합계
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
              {isAnnual ? '연간 결제 기준' : '월간 결제 기준'}
            </span>
          </div>

          <div>
            <div className="text-xs text-blue-200">매월 공급가액 ({seats}석)</div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight mt-0.5">
              ₩{effectiveMonthlySupply.toLocaleString()}
              <span className="text-xs font-normal text-blue-200 ml-1">/ 월 (VAT 별도)</span>
            </div>
            <div className="text-xs text-blue-200/80 mt-1">
              부가세 포함 최종 청구액: ₩{effectiveTotal.toLocaleString()}
            </div>
          </div>

          {/* 타사 분리 도입 대비 절감 배너 */}
          <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 space-y-1">
            <div className="text-xs font-bold text-amber-300 flex items-center gap-1">
              <TrendingDown size={14} /> 타사 개별 분리 도입 대비
            </div>
            <div className="text-xs text-slate-200 leading-snug">
              타사 다이얼러+녹취+AI 개별 도입(인당 12만) 대비<br />
              매월 <strong className="text-white font-mono font-bold text-sm">₩{monthlySavings.toLocaleString()}원</strong> 절감!
            </div>
            {isAnnual && (
              <div className="text-[11px] text-emerald-300 font-semibold pt-1 border-t border-white/10">
                연간 환산 시 총 ₩{annualSavings.toLocaleString()}원 순수 비용 절감
              </div>
            )}
          </div>

          {onApplySeats && (
            <button
              type="button"
              onClick={() => onApplySeats(seats)}
              className="w-full py-2.5 px-4 rounded-xl bg-white text-blue-700 hover:bg-blue-50 active:bg-blue-100 font-extrabold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>이 규모({seats}석)로 좌석 변경 신청</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
