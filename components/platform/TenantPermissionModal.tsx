import React, { useState, useEffect } from 'react';
import {
  X, Shield, CheckCircle2, AlertTriangle, Calculator,
  PhoneCall, GraduationCap, Smartphone, Lock, Users,
  Calendar, Sparkles, Save, DollarSign
} from 'lucide-react';
import {
  PlatformOrg, OrgFeaturePermissions, DEFAULT_ORG_FEATURE_PERMISSIONS,
  updateOrgFeaturePermissions, calculateOrgMonthlyBill, PricingModelType
} from '../../services/platform';

interface TenantPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  org: PlatformOrg | null;
  currentPermissions?: OrgFeaturePermissions;
  onSaved: (orgId: string, updated: OrgFeaturePermissions) => void;
}

export const TenantPermissionModal: React.FC<TenantPermissionModalProps> = ({
  isOpen,
  onClose,
  org,
  currentPermissions,
  onSaved,
}) => {
  const [perms, setPerms] = useState<OrgFeaturePermissions>(
    currentPermissions || DEFAULT_ORG_FEATURE_PERMISSIONS
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (currentPermissions) {
      setPerms(currentPermissions);
    } else {
      setPerms(DEFAULT_ORG_FEATURE_PERMISSIONS);
    }
  }, [currentPermissions, org]);

  if (!isOpen || !org) return null;

  const handleToggle = (key: keyof OrgFeaturePermissions) => {
    setPerms(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSeatsChange = (seats: number) => {
    setPerms(prev => ({
      ...prev,
      maxSeats: seats,
    }));
  };

  const handleExtendTrial = (days: number) => {
    const baseDate = perms.trialExpiresAt ? new Date(perms.trialExpiresAt) : new Date();
    const target = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    setPerms(prev => ({
      ...prev,
      trialExpiresAt: target.toISOString(),
    }));
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const saved = await updateOrgFeaturePermissions(org.id, perms);
      onSaved(org.id, saved);
      onClose();
    } catch (e: any) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const trialDaysLeft = perms.trialExpiresAt
    ? Math.max(0, Math.ceil((new Date(perms.trialExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl text-foreground space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* 모달 상단 헤더 */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Shield size={16} />
              </div>
              <h3 className="font-bold text-base text-foreground">
                {org.name} • 기능 권한 및 라이선스 설정
              </h3>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              대표 계정: <span className="text-foreground font-medium">{org.ownerInviteEmail || '등록 계정'}</span> | 활성 상담원: {org.activeMembers}명
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 5대 핵심 기능 권한 스위치 리스트 */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Sparkles size={13} className="text-primary" />
            <span>회사별 핵심 기능 권한 (Feature Flags)</span>
          </h4>

          {/* 1. 광고비 & 정산 센터 권한 */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border flex items-center justify-between gap-4 hover:border-border/80 transition-colors">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${perms.settlementEnabled ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' : 'bg-muted text-muted-foreground border border-border'}`}>
                <Calculator size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground">광고비 & 정산 센터</span>
                  <span className={`text-2xs px-2 py-0.5 rounded-md font-mono font-bold ${perms.settlementEnabled ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-muted text-muted-foreground border border-border'}`}>
                    {perms.settlementEnabled ? '사용 허용' : '차단 (숨김)'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  거래처별 광고비·DB 단가 입력, 마진율 계산, 상담원 급여/수당 정산 및 청구서 1초 완성
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={perms.settlementEnabled}
                onChange={() => handleToggle('settlementEnabled')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary border border-border"></div>
            </label>
          </div>

          {/* 2. 스마트 오토콜 발신 권한 */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border flex items-center justify-between gap-4 hover:border-border/80 transition-colors">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${perms.autoDialEnabled ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-muted text-muted-foreground border border-border'}`}>
                <PhoneCall size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground">스마트 오토콜 (Auto Dial)</span>
                  <span className={`text-2xs px-2 py-0.5 rounded-md font-mono font-bold ${perms.autoDialEnabled ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-muted text-muted-foreground border border-border'}`}>
                    {perms.autoDialEnabled ? '사용 허용' : '차단 (비활성)'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  스마트폰 연동 1초 1콜 자동 순차 발신 및 무사고 HUD 화면 기능
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={perms.autoDialEnabled}
                onChange={() => handleToggle('autoDialEnabled')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary border border-border"></div>
            </label>
          </div>

          {/* 3. AI 가상 고객 훈련 권한 */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border flex items-center justify-between gap-4 hover:border-border/80 transition-colors">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${perms.aiTrainingEnabled ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' : 'bg-muted text-muted-foreground border border-border'}`}>
                <GraduationCap size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground">AI 가상 고객 트레이닝</span>
                  <span className={`text-2xs px-2 py-0.5 rounded-md font-mono font-bold ${perms.aiTrainingEnabled ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-muted text-muted-foreground border border-border'}`}>
                    {perms.aiTrainingEnabled ? '사용 허용' : '차단'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  1만 2천 명 가상 AI 고객과 실제 음성 통화 훈련 및 AI 상담 점수 실시간 채점
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={perms.aiTrainingEnabled}
                onChange={() => handleToggle('aiTrainingEnabled')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary border border-border"></div>
            </label>
          </div>

          {/* 4. 사내 텔레그램 리드 전송 허브 권한 */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border flex items-center justify-between gap-4 hover:border-border/80 transition-colors">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${perms.telegramHubEnabled ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' : 'bg-muted text-muted-foreground border border-border'}`}>
                <Smartphone size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground">텔레그램 리드 전송 봇</span>
                  <span className={`text-2xs px-2 py-0.5 rounded-md font-mono font-bold ${perms.telegramHubEnabled ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-muted text-muted-foreground border border-border'}`}>
                    {perms.telegramHubEnabled ? '사용 허용' : '차단'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  통화 완료 후 AI가 작성한 보고서를 사내 텔레그램 단톡방으로 1초 전송 연동
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={perms.telegramHubEnabled}
                onChange={() => handleToggle('telegramHubEnabled')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary border border-border"></div>
            </label>
          </div>

          {/* 5. 보안 프로필 강제 모드 */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border flex items-center justify-between gap-4 hover:border-border/80 transition-colors">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${perms.enforceSecurity ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30' : 'bg-muted text-muted-foreground border border-border'}`}>
                <Lock size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground">보안 프로필 강제 모드</span>
                  <span className={`text-2xs px-2 py-0.5 rounded-md font-mono font-bold ${perms.enforceSecurity ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-muted text-muted-foreground border border-border'}`}>
                    {perms.enforceSecurity ? '강제 적용중' : '회사 자율'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  안드로이드 앱 화면 캡처 원천 차단(FLAG_SECURE) 및 전화번호 마스킹 전 상담원 강제화
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={perms.enforceSecurity}
                onChange={() => handleToggle('enforceSecurity')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600 border border-border"></div>
            </label>
          </div>
        </div>

        {/* 라이선스 좌석 & 무료 체험 기간 조정 */}
        <div className="pt-2 border-t border-border space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Users size={13} className="text-primary" />
            <span>라이선스 좌석 및 체험 기간 설정</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 좌석 수 한도 */}
            <div className="p-3.5 bg-muted/30 rounded-xl border border-border space-y-2">
              <label className="text-xs font-semibold text-foreground">최대 상담원 좌석 수</label>
              <div className="flex gap-1.5 flex-wrap">
                {[5, 10, 20, 50, 0].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => handleSeatsChange(cnt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer font-mono ${
                      perms.maxSeats === cnt
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {cnt === 0 ? '무제한' : `${cnt}석`}
                  </button>
                ))}
              </div>
            </div>

            {/* 무료 체험 기간 (7일 기준) */}
            <div className="p-3.5 bg-muted/30 rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">무료 체험 잔여 기간 (7일 기준)</label>
                {trialDaysLeft !== null ? (
                  <span className="text-xs font-bold text-amber-500 font-mono">
                    {trialDaysLeft > 0 ? `${trialDaysLeft}일 남음` : '만료됨'}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-primary font-mono">정기 구독</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleExtendTrial(7)}
                  className="flex-1 py-1.5 rounded-lg bg-card border border-border hover:bg-muted text-foreground text-xs font-semibold cursor-pointer transition-colors"
                >
                  +7일 연장
                </button>
                <button
                  type="button"
                  onClick={() => setPerms(prev => ({ ...prev, trialExpiresAt: undefined }))}
                  className="flex-1 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-primary hover:bg-primary/20 text-xs font-semibold cursor-pointer transition-colors"
                >
                  정기 구독 전환
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 💰 3. 고객사별 요금제 모델 및 단가 조정 */}
        <div className="pt-2 border-t border-border space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-1.5">
              <DollarSign size={13} className="text-primary" />
              <span>요금제 모델 및 맞춤 단가 설정</span>
            </h4>
            <span className="text-xs font-mono text-primary font-bold">
              현재: ₩ {calculateOrgMonthlyBill(Math.max(1, org.activeMembers), perms).unitPrice.toLocaleString()}원/석 
              (월 ₩ {calculateOrgMonthlyBill(Math.max(1, org.activeMembers), perms).totalPrice.toLocaleString()}원)
            </span>
          </div>

          <div className="space-y-2.5">
            {/* 요금제 모델 라디오 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label 
                onClick={() => setPerms(prev => ({ ...prev, pricingModel: 'volume_tier' }))}
                className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col justify-between transition-all ${
                  (perms.pricingModel || 'volume_tier') === 'volume_tier'
                    ? 'bg-primary/15 border-primary text-primary font-bold shadow-2xs'
                    : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-foreground">볼륨 자동 티어</span>
                  <input
                    type="radio"
                    name="pricingModel"
                    checked={(perms.pricingModel || 'volume_tier') === 'volume_tier'}
                    onChange={() => {}}
                    className="sr-only"
                  />
                </div>
                <p className="text-xs font-normal text-muted-foreground mt-1.5 font-mono">
                  1~5인 ₩ 58,000 ~ 101인+ ₩ 38,000 자동 할인
                </p>
              </label>

              <label 
                onClick={() => setPerms(prev => ({ ...prev, pricingModel: 'custom_seat' }))}
                className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col justify-between transition-all ${
                  perms.pricingModel === 'custom_seat'
                    ? 'bg-primary/15 border-primary text-primary font-bold shadow-2xs'
                    : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-foreground">맞춤 단가 직접 입력</span>
                  <input
                    type="radio"
                    name="pricingModel"
                    checked={perms.pricingModel === 'custom_seat'}
                    onChange={() => {}}
                    className="sr-only"
                  />
                </div>
                <p className="text-xs font-normal text-muted-foreground mt-1.5">
                  좌석당 협의된 금액을 원 단위로 지정
                </p>
              </label>

              <label 
                onClick={() => setPerms(prev => ({ ...prev, pricingModel: 'flat_fee' }))}
                className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col justify-between transition-all ${
                  perms.pricingModel === 'flat_fee'
                    ? 'bg-primary/15 border-primary text-primary font-bold shadow-2xs'
                    : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-foreground">월 고정 정액제 (Flat)</span>
                  <input
                    type="radio"
                    name="pricingModel"
                    checked={perms.pricingModel === 'flat_fee'}
                    onChange={() => {}}
                    className="sr-only"
                  />
                </div>
                <p className="text-xs font-normal text-muted-foreground mt-1.5">
                  인원 무관 월 고정 금액 청구 (대형 센터)
                </p>
              </label>
            </div>

            {/* 맞춤 단가 입력란 */}
            {perms.pricingModel === 'custom_seat' && (
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border flex items-center justify-between gap-3 animate-in fade-in">
                <span className="text-xs text-foreground font-semibold">좌석당 월 단가(원):</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="1000"
                    value={perms.customUnitPrice || 45000}
                    onChange={e => setPerms(prev => ({ ...prev, customUnitPrice: Number(e.target.value) }))}
                    className="w-32 px-3 py-1.5 rounded-lg bg-background border border-input text-foreground font-mono text-xs text-right outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                  />
                  <span className="text-xs text-muted-foreground font-mono">원 / 석</span>
                </div>
              </div>
            )}

            {/* 월 정액제 입력란 */}
            {perms.pricingModel === 'flat_fee' && (
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border flex items-center justify-between gap-3 animate-in fade-in">
                <span className="text-xs text-foreground font-semibold">월 고정 청구액(원):</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="100000"
                    value={perms.flatMonthlyFee || 3000000}
                    onChange={e => setPerms(prev => ({ ...prev, flatMonthlyFee: Number(e.target.value) }))}
                    className="w-36 px-3 py-1.5 rounded-lg bg-background border border-input text-foreground font-mono text-xs text-right outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                  />
                  <span className="text-xs text-muted-foreground font-mono">원 / 월</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            <span>설정 저장하기</span>
          </button>
        </div>

      </div>
    </div>
  );
};
