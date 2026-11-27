import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Sparkles, Check, X, Smartphone, Eye, BellRing, LogOut, Loader2 } from 'lucide-react';
import { TeamMember, MemberSecurityProfile, DEFAULT_AGENT_SECURITY_PROFILE, TRUSTED_TEAM_LEAD_SECURITY_PROFILE } from '../../services/team';
import { ROLE_LABEL } from '../../services/org';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';

interface MemberSecurityModalProps {
  member: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, profile: MemberSecurityProfile) => Promise<void>;
  onRevokeSession: (userId: string) => Promise<void>;
}

export default function MemberSecurityModal({
  member,
  isOpen,
  onClose,
  onSave,
  onRevokeSession,
}: MemberSecurityModalProps) {
  const [profile, setProfile] = useState<MemberSecurityProfile>(DEFAULT_AGENT_SECURITY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const { confirm } = useConfirmDialog();

  useEffect(() => {
    if (member) {
      setProfile(member.securityProfile || (
        member.role === 'agent' ? DEFAULT_AGENT_SECURITY_PROFILE : TRUSTED_TEAM_LEAD_SECURITY_PROFILE
      ));
    }
  }, [member]);

  if (!isOpen || !member) return null;

  const handleApplyPreset = (preset: 'trusted_lead' | 'standard_agent') => {
    if (preset === 'trusted_lead') {
      setProfile(TRUSTED_TEAM_LEAD_SECURITY_PROFILE);
    } else {
      setProfile(DEFAULT_AGENT_SECURITY_PROFILE);
    }
  };

  const handleToggle = (key: keyof MemberSecurityProfile) => {
    setProfile(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(member.userId, profile);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    const ok = await confirm({
      title: '세션 즉시 강제 종료',
      message: `${member.displayName} 상담원의 현재 로그인 세션을 즉시 강제 파기할까요?\n접속 중인 웹 CRM 브라우저와 모바일 앱이 즉시 강제 로그아웃됩니다.`,
      confirmText: '강제 로그아웃',
      cancelText: '취소',
      variant: 'destructive',
    });
    if (!ok) return;

    setRevoking(true);
    try {
      await onRevokeSession(member.userId);
    } finally {
      setRevoking(false);
    }
  };

  const isAllDisabled = !profile.watermark && !profile.appCaptureBlock && !profile.masking && !profile.anomalyAlert;
  const isAllEnabled = profile.watermark && profile.appCaptureBlock && profile.masking && profile.anomalyAlert;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-lg max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                {member.displayName} 상담원 보안 설정
              </h2>
              <p className="text-xs text-muted-foreground">
                {member.email} · {ROLE_LABEL[member.role]}
              </p>
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar text-xs">
          {/* Quick Presets */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
              원클릭 보안 프리셋
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleApplyPreset('trusted_lead')}
                className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  isAllDisabled
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-2 ring-amber-400/30'
                    : 'border-border hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-1 font-bold">
                  <Sparkles size={14} className="text-amber-500" /> 팀장급 신뢰 프리셋
                </div>
                <span className="text-xs text-muted-foreground font-normal">모든 보안 제한 해제</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('standard_agent')}
                className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  isAllEnabled
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/40'
                    : 'border-border hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-1 font-bold">
                  <ShieldAlert size={14} className="text-blue-500" /> 일반/신입 상담원
                </div>
                <span className="text-xs text-muted-foreground font-normal">보안 4종 전체 활성화</span>
              </button>
            </div>
          </div>

          {/* Individual Security Toggles */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              개별 보안 제어 항목
            </label>

            {/* 1. Watermark */}
            <div
              onClick={() => handleToggle('watermark')}
              className="p-3.5 rounded-xl border border-border hover:border-primary/50 bg-muted/20 transition-colors flex items-start justify-between cursor-pointer group"
            >
              <div className="space-y-0.5 pr-4">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <span>📷 화면 보안 워터마크</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  CRM 웹 화면 전체에 이름/이메일/접속일시를 은은하게 투영하여 모니터 스마트폰 카메라 촬영을 억제합니다.
                </p>
              </div>
              <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors flex-shrink-0 ${
                profile.watermark ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              }`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  profile.watermark ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </div>

            {/* 2. App Capture Block */}
            <div
              onClick={() => handleToggle('appCaptureBlock')}
              className="p-3.5 rounded-xl border border-border hover:border-primary/50 bg-muted/20 transition-colors flex items-start justify-between cursor-pointer group"
            >
              <div className="space-y-0.5 pr-4">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Smartphone size={15} className="text-indigo-500" />
                  <span>스마트폰 앱 화면 캡처 차단 (FLAG_SECURE)</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  안드로이드 앱에서 스크린샷 캡처 및 화면 녹화 실행 시 검은 화면으로 처리하여 물리적으로 차단합니다.
                </p>
              </div>
              <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors flex-shrink-0 ${
                profile.appCaptureBlock ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              }`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  profile.appCaptureBlock ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </div>

            {/* 3. Masking */}
            <div
              onClick={() => handleToggle('masking')}
              className="p-3.5 rounded-xl border border-border hover:border-primary/50 bg-muted/20 transition-colors flex items-start justify-between cursor-pointer group"
            >
              <div className="space-y-0.5 pr-4">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Eye size={15} className="text-cyan-500" />
                  <span>리드 목록 고객정보 기본 마스킹</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  리드 목록에서 전화번호(010-****-1234)와 고객명을 가리고, 개별 열람 클릭 시에만 풀리며 감사 로그를 남깁니다.
                </p>
              </div>
              <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors flex-shrink-0 ${
                profile.masking ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              }`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  profile.masking ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </div>

            {/* 4. Anomaly Alert */}
            <div
              onClick={() => handleToggle('anomalyAlert')}
              className="p-3.5 rounded-xl border border-border hover:border-primary/50 bg-muted/20 transition-colors flex items-start justify-between cursor-pointer group"
            >
              <div className="space-y-0.5 pr-4">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <BellRing size={15} className="text-rose-500" />
                  <span>대량 열람 이상 징후 감지 및 대표 알림</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  5분 내 25건 이상 리드를 연속 열람할 경우 이상 징후로 판단하여 회사 대표 텔레그램으로 즉시 자동 경보를 발송합니다.
                </p>
              </div>
              <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors flex-shrink-0 ${
                profile.anomalyAlert ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              }`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  profile.anomalyAlert ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </div>

            {/* 5. 리드 유입경로 열람 예외 허용 */}
            <div
              onClick={() => setProfile(prev => ({ ...prev, showInboundPath: !prev.showInboundPath }))}
              className="p-3.5 rounded-xl border border-border hover:border-primary/50 bg-muted/20 transition-colors flex items-start justify-between cursor-pointer group"
            >
              <div className="space-y-0.5 pr-4">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Eye size={15} className="text-amber-500" />
                  <span>리드 유입경로(DB 출처) 열람 허용</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  끄면 케이스 목록·상세·간편콜에서 유입정보가 완전히 숨겨집니다. (TM대표·총괄관리자는 항상 표시)
                </p>
              </div>
              <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors flex-shrink-0 ${
                profile.showInboundPath ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              }`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  profile.showInboundPath ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </div>

            {/* 6. 실제 거래처명(법률사무소명) 열람 허용 */}
            <div
              onClick={() => setProfile(prev => ({
                ...prev,
                showRealPartnerName: prev.showRealPartnerName === undefined ? false : !prev.showRealPartnerName,
              }))}
              className="p-3.5 rounded-xl border border-border hover:border-primary/50 bg-muted/20 transition-colors flex items-start justify-between cursor-pointer group"
            >
              <div className="space-y-0.5 pr-4">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Shield size={15} className="text-emerald-500" />
                  <span>실제 거래처명(법률사무소명) 열람 허용</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  끄면 실제 법인명 대신 거래처 설정에 등록된 텔레그램 방명(예: 김대표방)으로 표시됩니다.
                </p>
              </div>
              <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors flex-shrink-0 ${
                profile.showRealPartnerName !== false ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              }`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  profile.showRealPartnerName !== false ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </div>
          </div>

          {/* Danger Zone: Instant Session Revoke */}
          <div className="pt-2 border-t border-border">
            <div className="p-3.5 rounded-xl bg-red-50/70 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-red-700 dark:text-red-400 block">원클릭 세션 강제 파기</span>
                <span className="text-xs text-red-600/80 dark:text-red-400/70">
                  해당 상담원의 현재 브라우저/스마트폰 앱을 즉시 강제 로그아웃
                </span>
              </div>
              <button
                type="button"
                disabled={revoking}
                onClick={handleRevoke}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors disabled:opacity-50"
              >
                {revoking ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                <span>강제 로그아웃</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              취소 / 닫기
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              <span>보안 설정 저장</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
