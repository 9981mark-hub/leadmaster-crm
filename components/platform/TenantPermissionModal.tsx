import React, { useState, useEffect } from 'react';
import {
  X, Shield, CheckCircle2, AlertTriangle, Calculator,
  PhoneCall, GraduationCap, Smartphone, Lock, Users,
  Calendar, Sparkles, Save
} from 'lucide-react';
import {
  PlatformOrg, OrgFeaturePermissions, DEFAULT_ORG_FEATURE_PERMISSIONS,
  updateOrgFeaturePermissions
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full p-6 shadow-2xl text-white space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* 모달 상단 헤더 */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Shield size={16} />
              </div>
              <h3 className="font-bold text-base text-white">
                {org.name} • 기능 권한 및 라이선스 설정
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              대표 계정: <span className="font-mono text-slate-300">{org.ownerInviteEmail || '등록 계정'}</span> | 활성 상담원: {org.activeMembers}명
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* 5대 핵심 기능 권한 스위치 리스트 */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={13} className="text-blue-400" />
            <span>회사별 핵심 기능 권한 (Feature Flags)</span>
          </h4>

          {/* 1. 광고비 & 정산 센터 권한 */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl mt-0.5 ${perms.settlementEnabled ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-500'}`}>
                <Calculator size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-200">광고비 & 정산 센터</span>
                  <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${perms.settlementEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                    {perms.settlementEnabled ? '사용 허용' : '차단 (숨김)'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
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
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* 2. 스마트 오토콜 발신 권한 */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl mt-0.5 ${perms.autoDialEnabled ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'bg-slate-800 text-slate-500'}`}>
                <PhoneCall size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-200">스마트 오토콜 (Auto Dial)</span>
                  <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${perms.autoDialEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                    {perms.autoDialEnabled ? '사용 허용' : '차단 (비활성)'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
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
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* 3. AI 가상 고객 트레이닝 센터 권한 */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl mt-0.5 ${perms.aiTrainingEnabled ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'}`}>
                <GraduationCap size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-200">AI 가상 고객 트레이닝</span>
                  <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${perms.aiTrainingEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                    {perms.aiTrainingEnabled ? '사용 허용' : '차단 (API 보호)'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
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
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* 4. 사내 텔레그램 리드 전송 허브 권한 */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl mt-0.5 ${perms.telegramHubEnabled ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-500'}`}>
                <Smartphone size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-200">텔레그램 리드 전송 봇</span>
                  <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${perms.telegramHubEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                    {perms.telegramHubEnabled ? '사용 허용' : '차단'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
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
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* 5. 보안 프로필 강제 모드 */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl mt-0.5 ${perms.enforceSecurity ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-500'}`}>
                <Lock size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-200">보안 프로필 강제 모드</span>
                  <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${perms.enforceSecurity ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-500'}`}>
                    {perms.enforceSecurity ? '강제 적용중' : '회사 자율'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
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
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>
        </div>

        {/* 라이선스 좌석 & 무료 체험 기간 조정 */}
        <div className="pt-2 border-t border-slate-800 space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Users size={13} className="text-blue-400" />
            <span>라이선스 좌석 및 체험 기간 설정</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 좌석 수 한도 */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">최대 상담원 좌석 수</label>
              <div className="flex gap-1.5 flex-wrap">
                {[5, 10, 20, 50, 0].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => handleSeatsChange(cnt)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      perms.maxSeats === cnt
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cnt === 0 ? '무제한' : `${cnt}석`}
                  </button>
                ))}
              </div>
            </div>

            {/* 무료 체험 기간 */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">무료 체험 잔여 기간</label>
                {trialDaysLeft !== null ? (
                  <span className="text-[11px] font-bold text-amber-400">
                    {trialDaysLeft > 0 ? `${trialDaysLeft}일 남음` : '만료됨'}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-emerald-400">정기 구독</span>
                )}
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleExtendTrial(7)}
                  className="flex-1 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  +7일 연장
                </button>
                <button
                  type="button"
                  onClick={() => handleExtendTrial(14)}
                  className="flex-1 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  +14일 연장
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            <span>설정 저장하기</span>
          </button>
        </div>

      </div>
    </div>
  );
};
