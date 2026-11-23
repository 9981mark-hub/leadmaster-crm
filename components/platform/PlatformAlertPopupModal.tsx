// ==============================================================================
// components/platform/PlatformAlertPopupModal.tsx
// 플랫폼 총괄 어드민(HOST) 전용: 긴급/중요 요청 실시간 팝업 알림 관제 모달
// 1) 라이선스 좌석 증설 요청 즉시 승인/반려
// 2) 신규 TM 고객사 가입 신청 승인 및 전자계약 확인
// shadcn School Dark 테마 (Zinc 950 / Zinc 900 / Emerald / Pretendard)
// ==============================================================================
import React, { useState } from 'react';
import {
  X, AlertTriangle, Users, Building2, CheckCircle2, ArrowRight,
  Sparkles, ShieldAlert, Mail, ShieldCheck, Clock, ExternalLink
} from 'lucide-react';
import { SeatExpansionRequest } from '../../services/seatExpansionService';
import { OrgApplication } from '../../services/orgApplicationService';

interface PlatformAlertPopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  seatRequests: SeatExpansionRequest[];
  orgApplications: OrgApplication[];
  onApproveSeat: (req: SeatExpansionRequest) => Promise<void>;
  onRejectSeat: (req: SeatExpansionRequest) => Promise<void>;
  onApproveApp: (app: OrgApplication) => void;
  onRejectApp: (id: string) => Promise<void>;
}

export const PlatformAlertPopupModal: React.FC<PlatformAlertPopupModalProps> = ({
  isOpen,
  onClose,
  seatRequests,
  orgApplications,
  onApproveSeat,
  onRejectSeat,
  onApproveApp,
  onRejectApp,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'seat' | 'app'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const pendingSeats = seatRequests.filter(r => r.status === 'pending');
  const pendingApps = orgApplications.filter(a => a.status === 'pending');
  const totalPending = pendingSeats.length + pendingApps.length;

  const handleApproveSeatClick = async (req: SeatExpansionRequest) => {
    setProcessingId(req.id);
    try {
      await onApproveSeat(req);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSeatClick = async (req: SeatExpansionRequest) => {
    setProcessingId(req.id);
    try {
      await onRejectSeat(req);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectAppClick = async (id: string) => {
    setProcessingId(id);
    try {
      await onRejectApp(id);
    } finally {
      setProcessingId(null);
    }
  };

  const fmtTime = (iso?: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${d.toLocaleDateString('ko-KR')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className={`w-full max-w-2xl bg-card text-card-foreground rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border ${
        totalPending > 0 ? 'border-destructive/40' : 'border-border'
      }`}>
        
        {/* Header with High-Priority Alert Styling */}
        <div className={`px-6 py-4.5 flex items-center justify-between border-b ${
          totalPending > 0 ? 'bg-destructive/10 border-destructive/20' : 'bg-muted/40 border-border'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              totalPending > 0 
                ? 'bg-destructive/20 border border-destructive/40 text-destructive animate-pulse' 
                : 'bg-primary/10 border border-primary/20 text-primary'
            }`}>
              {totalPending > 0 ? <AlertTriangle size={20} strokeWidth={2.25} /> : <CheckCircle2 size={20} strokeWidth={2.25} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  플랫폼 총괄 긴급/중요 알림 센터
                </h3>
                {totalPending > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-destructive text-white shadow-2xs animate-bounce font-mono">
                    대기 {totalPending}건
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold font-mono bg-primary/10 text-primary border border-primary/20">
                    처리 완료
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                고객사의 라이선스 좌석 증설 요청 및 신규 회사 가입 신청을 즉시 검토·승인합니다.
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

        {/* Tab Filters */}
        <div className="px-6 pt-3 pb-2 border-b border-border bg-card flex items-center gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span>전체 중요 알림</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs bg-black/20 text-inherit font-mono">
              {totalPending}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('seat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'seat'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Users size={13} />
            <span>좌석 증설 요청</span>
            {pendingSeats.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-2xs bg-amber-500 text-white font-mono font-bold">
                {pendingSeats.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('app')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'app'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Building2 size={13} />
            <span>신규 회사 가입 신청</span>
            {pendingApps.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-2xs bg-blue-500 text-white font-mono font-bold">
                {pendingApps.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {totalPending === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 text-primary mx-auto flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">대기 중인 긴급 요청이 없습니다</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  고객사의 모든 좌석 증설 요청과 가입 신청이 승인 처리되었습니다.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 1. 좌석 증설 요청 리스트 */}
              {(activeTab === 'all' || activeTab === 'seat') && pendingSeats.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Users size={14} className="text-amber-500" />
                    <span>라이선스 좌석 증설 요청 ({pendingSeats.length}건)</span>
                  </div>
                  {pendingSeats.map(req => {
                    const diff = req.requestedSeats - req.currentSeats;
                    const isBusy = processingId === req.id;
                    return (
                      <div
                        key={req.id}
                        className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3 shadow-2xs hover:border-amber-500/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-foreground">
                                {req.orgName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                신청자: <strong className="text-foreground font-medium">{req.requesterName || '대표'}</strong> ({req.requesterEmail})
                              </span>
                              <span className="text-2xs text-muted-foreground font-mono flex items-center gap-1">
                                <Clock size={11} /> {fmtTime(req.createdAt)}
                              </span>
                            </div>

                            {/* 좌석 변경 시각화 */}
                            <div className="flex items-center gap-2 pt-1 font-mono text-xs">
                              <span className="px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                                기존 {req.currentSeats}석
                              </span>
                              <ArrowRight size={13} className="text-amber-500" />
                              <span className="px-2 py-0.5 rounded bg-primary/20 border border-primary/30 text-primary font-bold">
                                희망 {req.requestedSeats}석
                              </span>
                              <span className="text-xs font-semibold text-emerald-400">
                                (+{diff}석 증설)
                              </span>
                            </div>

                            {req.memo && (
                              <div className="text-xs text-muted-foreground bg-black/20 dark:bg-muted/40 p-2.5 rounded-lg mt-2 border border-border/50">
                                <span className="font-semibold text-foreground">증원 사유: </span>
                                {req.memo}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 액션 버튼 */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-500/10">
                          <button
                            type="button"
                            onClick={() => handleRejectSeatClick(req)}
                            disabled={isBusy}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          >
                            반려
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproveSeatClick(req)}
                            disabled={isBusy}
                            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles size={13} />
                            {isBusy ? '승인 적용 중...' : `즉시 승인 (${req.requestedSeats}석 한도 적용)`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. 신규 TM 회사 가입 신청 리스트 */}
              {(activeTab === 'all' || activeTab === 'app') && pendingApps.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Building2 size={14} className="text-blue-500" />
                    <span>신규 TM 회사 가입 신청 ({pendingApps.length}건)</span>
                  </div>
                  {pendingApps.map(app => {
                    const isBusy = processingId === app.id;
                    return (
                      <div
                        key={app.id}
                        className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-3 shadow-2xs hover:border-blue-500/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-foreground">
                              {app.companyName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              대표: <strong className="text-foreground">{app.ownerName}</strong> ({app.ownerEmail})
                            </span>
                            <span className="text-xs text-muted-foreground">
                              | {app.phone}
                            </span>
                            <span className="text-2xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                              상담원 {app.agentCountTier}인 ({app.selectedPlan?.toUpperCase() || 'STARTER'})
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-1 flex-wrap text-2xs">
                            <span className={`px-2 py-0.5 rounded font-semibold ${
                              app.paymentStatus === 'paid'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {app.paymentStatus === 'paid' ? '💳 입금 확인됨' : '⏳ 입금 대기'}
                            </span>
                            {app.termsAgreedAt && (
                              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1 font-semibold">
                                <ShieldCheck size={11} /> 전자계약 동의 ({app.termsVersion || 'v1.0'})
                              </span>
                            )}
                            <span className="text-muted-foreground font-mono">
                              신청: {fmtTime(app.createdAt)}
                            </span>
                          </div>

                          {app.memo && (
                            <div className="text-xs text-muted-foreground bg-black/20 dark:bg-muted/40 p-2.5 rounded-lg mt-2 border border-border/50">
                              <span className="font-semibold text-foreground">요청 메모: </span>
                              {app.memo}
                            </div>
                          )}
                        </div>

                        {/* 액션 버튼 */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-blue-500/10">
                          <button
                            type="button"
                            onClick={() => handleRejectAppClick(app.id)}
                            disabled={isBusy}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          >
                            반려
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onApproveApp(app);
                              onClose();
                            }}
                            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Mail size={13} />
                            신청 검토 및 승인 이메일 발송
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-muted/40 border-t border-border flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            실시간 소켓/웹훅으로 새 요청 인입 시 자동으로 감지됩니다.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-card hover:bg-muted text-foreground font-semibold border border-border transition-colors cursor-pointer text-xs"
          >
            확인 닫기
          </button>
        </div>

      </div>
    </div>
  );
};
