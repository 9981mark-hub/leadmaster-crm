import React from 'react';
import { 
  Users, Sparkles, CheckCircle2, AlertTriangle, 
  ArrowUpRight, Calculator, ShieldCheck, Clock
} from 'lucide-react';
import { OrgFeaturePermissions, calculateOrgMonthlyBill } from '../../services/platform';

interface SubscriptionStatusCardProps {
  orgName: string;
  createdAt?: string;
  activeSeats: number;
  permissions?: OrgFeaturePermissions;
  onOpenPricingModal: () => void;
  onOpenSeatModal: () => void;
}

export const SubscriptionStatusCard: React.FC<SubscriptionStatusCardProps> = ({
  orgName,
  createdAt,
  activeSeats,
  permissions,
  onOpenPricingModal,
  onOpenSeatModal,
}) => {
  const seats = Math.max(1, activeSeats);
  const maxSeats = permissions?.maxSeats || 20;
  const bill = calculateOrgMonthlyBill(seats, permissions);
  const supplyPrice = bill.totalPrice;
  const vat = Math.floor(supplyPrice * 0.1);
  const totalPrice = supplyPrice + vat;

  // D+N일차 계산
  const startDate = createdAt ? new Date(createdAt) : new Date();
  const today = new Date();
  const diffDays = Math.max(1, Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  // 좌석 점유율 및 상태
  const seatUsagePercent = maxSeats > 0 ? Math.min(100, Math.round((seats / maxSeats) * 100)) : 100;
  const remainingSeats = maxSeats > 0 ? Math.max(0, maxSeats - seats) : 0;
  const isNearLimit = maxSeats > 0 && remainingSeats <= 2;
  const isAtLimit = maxSeats > 0 && remainingSeats === 0;

  // 무료체험 여부
  const trialExpiresAt = permissions?.trialExpiresAt ? new Date(permissions.trialExpiresAt) : null;
  const isTrialActive = trialExpiresAt ? trialExpiresAt.getTime() > today.getTime() : false;
  const trialDaysLeft = trialExpiresAt ? Math.max(0, Math.ceil((trialExpiresAt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
      {/* Card Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-white dark:from-slate-800/60 dark:via-slate-850 dark:to-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-700/50">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/60">
                {bill.tierName}
              </span>
              {isTrialActive && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/60 flex items-center gap-1">
                  <Clock size={12} /> 무료체험 {trialDaysLeft}일 남음
                </span>
              )}
              <span className="text-xs text-slate-500 dark:text-slate-400">
                구독 {diffDays}일차 정상 이용 중
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {orgName} 솔루션 구독 & 라이선스 현황
            </h2>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={onOpenPricingModal}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Calculator size={14} className="text-blue-600 dark:text-blue-400" /> 요금제 시뮬레이터
          </button>
          <button
            onClick={onOpenSeatModal}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Users size={14} /> + 좌석 증설 요청
          </button>
        </div>
      </div>

      {/* Card Content Grid */}
      <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. 좌석 사용 현황 및 게이지 */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                상담원 라이선스 좌석 (Seat Limit)
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                isAtLimit 
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                  : isNearLimit
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
              }`}>
                {seatUsagePercent}% 점유
              </span>
            </div>
            
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {seats}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                / {maxSeats > 0 ? `${maxSeats}석` : '무제한'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                {maxSeats > 0 ? `잔여 ${remainingSeats}석` : '자유 추가'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-3">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isAtLimit 
                    ? 'bg-rose-500' 
                    : isNearLimit 
                    ? 'bg-amber-500' 
                    : 'bg-blue-600'
                }`}
                style={{ width: `${seatUsagePercent}%` }}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-700/70 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>보안 단일세션 가드 작동 중</span>
            <span className="text-blue-600 dark:text-blue-400 font-medium">PC+휴대폰 1인 1계정</span>
          </div>
        </div>

        {/* 2. 당월 솔루션 이용료 산출 내역 */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                당월 CRM 이용료 (청구 예정액)
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                석당 ₩{bill.unitPrice.toLocaleString()}원
              </span>
            </div>

            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                  ₩{totalPrice.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">원 (VAT 포함)</span>
              </div>
            </div>

            <div className="space-y-1.5 mt-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>공급가액 ({seats}석 기준)</span>
                <span className="font-mono text-slate-900 dark:text-slate-200">₩{supplyPrice.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between">
                <span>부가가치세 (10%)</span>
                <span className="font-mono text-slate-900 dark:text-slate-200">₩{vat.toLocaleString()}원</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-700/70 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>매월 10일 정기 청구</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">세금계산서 청구/영수</span>
          </div>
        </div>

        {/* 3. 포함된 엔터프라이즈 기능 */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between md:col-span-2 lg:col-span-1">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              라이선스 기본 포함 인프라
            </span>

            <ul className="mt-3 space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>안드로이드 스마트 자동콜 무제한 연동</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>m4a 고음질 통화녹음 1년 무제한 보관</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>AI 음성 가상고객 100제 실전 트레이닝</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>사내 텔레그램 실시간 리드 배분 봇 연동</span>
              </li>
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-700/70 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>추가 인프라 비용 0원</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">ALL-IN-ONE 지원</span>
          </div>
        </div>
      </div>
    </div>
  );
};
