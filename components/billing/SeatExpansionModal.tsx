import React, { useState } from 'react';
import { X, Users, Send, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { submitSeatExpansionRequest } from '../../services/seatExpansionService';

interface SeatExpansionModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId?: string;
  orgName?: string;
  requesterEmail?: string;
  requesterName?: string;
  currentSeats?: number;
  maxSeats?: number;
  activeSeats?: number;
  currentMaxSeats?: number;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onSuccess?: () => void;
}

export const SeatExpansionModal: React.FC<SeatExpansionModalProps> = ({
  isOpen,
  onClose,
  orgId: propOrgId,
  orgName: propOrgName,
  requesterEmail: propRequesterEmail,
  requesterName: propRequesterName,
  currentSeats,
  maxSeats,
  activeSeats,
  currentMaxSeats,
  showToast: propShowToast,
  onSuccess,
}) => {
  const { org, user } = useAuth();
  const { showToast: ctxShowToast } = useToast();
  const triggerToast = propShowToast || ctxShowToast;

  const resolvedOrgId = propOrgId || org?.orgId || '00000000-0000-0000-0000-000000000001';
  const resolvedOrgName = propOrgName || org?.orgName || '우리 조직';
  const resolvedEmail = propRequesterEmail || user?.email || (org as any)?.ownerEmail || '';
  const resolvedName = propRequesterName || user?.name || '';

  const safeCurrent = Number(currentSeats ?? activeSeats ?? 0) || 0;
  const safeMax = Number(maxSeats ?? currentMaxSeats ?? 20) || 20;
  const remaining = Math.max(0, safeMax - safeCurrent);

  const [requestedSeats, setRequestedSeats] = useState(String(Math.max(10, safeMax + 5)));
  const [requestMemo, setRequestMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSendRequest = async () => {
    const seatsNum = Number(requestedSeats);
    if (!seatsNum || seatsNum <= safeMax) {
      triggerToast(`현재 최대 좌석(${safeMax}석)보다 큰 좌석 수를 입력해주세요.`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      await submitSeatExpansionRequest({
        orgId: resolvedOrgId,
        orgName: resolvedOrgName,
        requesterEmail: resolvedEmail,
        requesterName: resolvedName,
        currentSeats: safeCurrent,
        requestedSeats: seatsNum,
        memo: requestMemo,
      });

      triggerToast(`'${resolvedOrgName}' ${seatsNum}석 증설 신청이 플랫폼 총괄 운영팀에 접수되었습니다. (실시간 알림 발송됨)`, 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      triggerToast(`증설 신청 실패: ${err.message || err}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Users size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>라이선스 좌석(Seat) 증설 요청</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                상담원 증원 시 최대 허용 좌석 한도를 유연하게 확장할 수 있습니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Current Status Box */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-medium">현재 라이선스 좌석 현황</span>
              <div className="text-lg font-bold text-foreground mt-0.5">
                <span className="text-primary tabular-nums">{safeCurrent}석</span> 사용 중 / 최대 <span className="tabular-nums">{safeMax}석</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground">잔여 여유 좌석</span>
              <div className="text-base font-bold text-primary tabular-nums">
                {remaining}석 남음
              </div>
            </div>
          </div>

          {/* Volume Tiering Guide */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground">
              규모별 볼륨 자동 할인 혜택
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="p-3 rounded-xl border border-border bg-card">
                <div className="font-semibold text-muted-foreground">스타터 (1~5인)</div>
                <div className="text-primary font-bold tabular-nums mt-0.5 text-xs">₩ 58,000 / 석</div>
              </div>
              <div className="p-3 rounded-xl border border-border bg-card">
                <div className="font-semibold text-muted-foreground">비즈니스 (6~20인)</div>
                <div className="text-primary font-bold tabular-nums mt-0.5 text-xs">
                  ₩ 52,000 / 석 <span className="text-2xs font-semibold text-emerald-400">(-10%)</span>
                </div>
              </div>
              <div className="p-3 rounded-xl border border-border bg-card">
                <div className="font-semibold text-muted-foreground">프로 (21~50인)</div>
                <div className="text-primary font-bold tabular-nums mt-0.5 text-xs">
                  ₩ 46,000 / 석 <span className="text-2xs font-semibold text-emerald-400">(-20%)</span>
                </div>
              </div>
            </div>
            <p className="text-2xs text-muted-foreground">
              * 좌석 수가 증가할수록 단가가 자동으로 인하되어 전체 상담원 비용이 절감됩니다.
            </p>
          </div>

          {/* Input: 희망 증설 좌석 수 */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              희망 총 좌석 수 (한도 설정) <span className="text-primary">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min={safeMax + 1}
                value={requestedSeats}
                onChange={e => setRequestedSeats(e.target.value)}
                className="w-full px-3 py-2 pr-12 rounded-lg border border-input bg-background text-foreground font-semibold text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground text-xs">
                석
              </span>
            </div>
          </div>

          {/* Input: 메모 / 증원 사유 */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              증원 사유 / 요청 사항 (선택)
            </label>
            <textarea
              rows={2}
              value={requestMemo}
              onChange={e => setRequestMemo(e.target.value)}
              placeholder="예: 신규 인입 캠페인으로 상담원 5명 추가 채용 예정"
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors resize-none"
            />
          </div>

          {/* Quick Contact Info */}
          <div className="pt-2 text-xs text-muted-foreground flex items-center justify-between border-t border-border">
            <span>긴급 문의: support@lmaster.xyz</span>
            <span className="text-primary font-semibold">운영팀 24시간 실시간 승인</span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted font-medium transition-colors cursor-pointer text-xs"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleSendRequest}
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
            >
              <Send size={13} /> {submitting ? '접수 중...' : '증설 신청 접수'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
