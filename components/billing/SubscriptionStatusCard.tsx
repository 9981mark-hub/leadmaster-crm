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
    <div className="bg-card text-card-foreground rounded-xl border border-border shadow-xs overflow-hidden transition-colors">
      {/* Card Header */}
      <div className="p-5 sm:p-6 border-b border-border bg-muted/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <ShieldCheck size={22} strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {bill.tierName}
              </span>
              {isTrialActive && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                  <Clock size={12} strokeWidth={1.75} /> 무료체험 {trialDaysLeft}일 남음
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                구독 {diffDays}일차 정상 이용 중
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground mt-1">
              {orgName} 솔루션 구독 & 라이선스 현황
            </h2>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={onOpenPricingModal}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-foreground bg-card border border-border hover:bg-muted rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Calculator size={14} strokeWidth={1.75} className="text-primary" /> 요금제 시뮬레이터
          </button>
          <button
            onClick={onOpenSeatModal}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 active:bg-primary/95 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Users size={14} strokeWidth={1.75} /> + 좌석 증설 요청
          </button>
        </div>
      </div>

      {/* Card Content Grid */}
      <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. 좌석 사용 현황 및 게이지 */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                상담원 라이선스 좌석 (Seat Limit)
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isAtLimit 
                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                  : isNearLimit
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  : 'bg-primary/10 text-primary border border-primary/20'
              }`}>
                {seatUsagePercent}% 점유
              </span>
            </div>
            
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-bold text-foreground tabular-nums font-mono">
                {seats}
              </span>
              <span className="text-xs text-muted-foreground">
                / {maxSeats > 0 ? `${maxSeats}석` : '무제한'}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {maxSeats > 0 ? `잔여 ${remainingSeats}석` : '자유 추가'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-3">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isAtLimit 
                    ? 'bg-rose-500' 
                    : isNearLimit 
                    ? 'bg-amber-500' 
                    : 'bg-primary'
                }`}
                style={{ width: `${seatUsagePercent}%` }}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
            <span>보안 단일세션 가드 작동 중</span>
            <span className="text-primary font-medium">PC+휴대폰 1인 1계정</span>
          </div>
        </div>

        {/* 2. 당월 솔루션 이용료 산출 내역 */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                당월 CRM 이용료 (청구 예정액)
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                석당 ₩ {bill.unitPrice.toLocaleString()}원
              </span>
            </div>

            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-foreground tabular-nums font-mono">
                  ₩ {totalPrice.toLocaleString()}
                </span>
                <span className="text-xs font-medium text-muted-foreground">원 (VAT 포함)</span>
              </div>
            </div>

            <div className="space-y-1.5 mt-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>공급가액 ({seats}석 기준)</span>
                <span className="font-mono text-foreground font-medium">₩ {supplyPrice.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between">
                <span>부가가치세 (10%)</span>
                <span className="font-mono text-foreground font-medium">₩ {vat.toLocaleString()}원</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
            <span>매월 10일 정기 청구</span>
            <span className="text-foreground font-medium">세금계산서 청구/영수</span>
          </div>
        </div>

        {/* 3. 포함된 엔터프라이즈 기능 */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border flex flex-col justify-between md:col-span-2 lg:col-span-1">
          <div>
            <span className="text-xs font-medium text-muted-foreground">
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
