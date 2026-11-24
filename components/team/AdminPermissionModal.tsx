import React, { useState } from 'react';
import {
  ShieldCheck,
  X,
  Check,
  AlertCircle,
  Crown,
  Users,
  Calculator,
  Lock,
  Layers,
  Sparkles,
  Smartphone,
  Eye,
  SlidersHorizontal,
  Trash2,
  Bell,
  Send,
  GraduationCap,
  Settings,
} from 'lucide-react';
import {
  TeamMember,
  AdminPermissions,
  AdminTier,
  TelegramAdminPermissions,
  NoticeAdminPermissions,
  TrainingAdminPermissions,
  SettingsAdminPermissions,
  DEFAULT_TIER1_PERMISSIONS,
  DEFAULT_TIER2_PERMISSIONS,
  DEFAULT_TIER3_PERMISSIONS,
  updateAdminPermissions,
  updateMemberTeam,
} from '../../services/team';
import { useToast } from '../../contexts/ToastContext';

interface AdminPermissionModalProps {
  member: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminPermissionModal: React.FC<AdminPermissionModalProps> = ({
  member,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  // 초기 권한 상태 설정 (회원 정보에 저장된 권한 또는 Tier 1 기본값)
  const initialPerms: AdminPermissions = member?.adminPermissions || DEFAULT_TIER1_PERMISSIONS;

  const [tier, setTier] = useState<AdminTier>(initialPerms.tier || 1);
  const [teamPerms, setTeamPerms] = useState(initialPerms.team);
  const [settlementPerms, setSettlementPerms] = useState(initialPerms.settlement);
  const [telegramPerms, setTelegramPerms] = useState<TelegramAdminPermissions>(
    initialPerms.telegram || DEFAULT_TIER1_PERMISSIONS.telegram
  );
  const [noticePerms, setNoticePerms] = useState<NoticeAdminPermissions>(
    initialPerms.notice || DEFAULT_TIER1_PERMISSIONS.notice
  );
  const [trainingPerms, setTrainingPerms] = useState<TrainingAdminPermissions>(
    initialPerms.training || DEFAULT_TIER1_PERMISSIONS.training
  );
  const [settingsPerms, setSettingsPerms] = useState<SettingsAdminPermissions>(
    initialPerms.settings || DEFAULT_TIER1_PERMISSIONS.settings
  );
  const [teamName, setTeamName] = useState<string>(member?.teamName || '1팀');

  // member 변경 시 폼 상태 동기화
  React.useEffect(() => {
    if (member) {
      const p = member.adminPermissions || DEFAULT_TIER1_PERMISSIONS;
      setTier(p.tier || 1);
      setTeamPerms({ ...p.team });
      setSettlementPerms({ ...p.settlement });
      setTelegramPerms({ ...(p.telegram || DEFAULT_TIER1_PERMISSIONS.telegram) });
      setNoticePerms({ ...(p.notice || DEFAULT_TIER1_PERMISSIONS.notice) });
      setTrainingPerms({ ...(p.training || DEFAULT_TIER1_PERMISSIONS.training) });
      setSettingsPerms({ ...(p.settings || DEFAULT_TIER1_PERMISSIONS.settings) });
      setTeamName(member.teamName || '1팀');
    }
  }, [member]);

  if (!isOpen || !member) return null;

  // 티어 프리셋 적용 핸들러
  const handleApplyTierPreset = (newTier: AdminTier) => {
    setTier(newTier);
    if (newTier === 1) {
      setTeamPerms({ ...DEFAULT_TIER1_PERMISSIONS.team });
      setSettlementPerms({ ...DEFAULT_TIER1_PERMISSIONS.settlement });
      setTelegramPerms({ ...DEFAULT_TIER1_PERMISSIONS.telegram });
      setNoticePerms({ ...DEFAULT_TIER1_PERMISSIONS.notice });
      setTrainingPerms({ ...DEFAULT_TIER1_PERMISSIONS.training });
      setSettingsPerms({ ...DEFAULT_TIER1_PERMISSIONS.settings });
    } else if (newTier === 2) {
      setTeamPerms({ ...DEFAULT_TIER2_PERMISSIONS.team });
      setSettlementPerms({ ...DEFAULT_TIER2_PERMISSIONS.settlement });
      setTelegramPerms({ ...DEFAULT_TIER2_PERMISSIONS.telegram });
      setNoticePerms({ ...DEFAULT_TIER2_PERMISSIONS.notice });
      setTrainingPerms({ ...DEFAULT_TIER2_PERMISSIONS.training });
      setSettingsPerms({ ...DEFAULT_TIER2_PERMISSIONS.settings });
    } else if (newTier === 3) {
      setTeamPerms({ ...DEFAULT_TIER3_PERMISSIONS.team });
      setSettlementPerms({ ...DEFAULT_TIER3_PERMISSIONS.settlement });
      setTelegramPerms({ ...DEFAULT_TIER3_PERMISSIONS.telegram });
      setNoticePerms({ ...DEFAULT_TIER3_PERMISSIONS.notice });
      setTrainingPerms({ ...DEFAULT_TIER3_PERMISSIONS.training });
      setSettingsPerms({ ...DEFAULT_TIER3_PERMISSIONS.settings });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const newPermissions: AdminPermissions = {
        tier,
        team: teamPerms,
        settlement: settlementPerms,
        telegram: telegramPerms,
        notice: noticePerms,
        training: trainingPerms,
        settings: settingsPerms,
      };

      await Promise.all([
        updateAdminPermissions(member.userId, newPermissions),
        updateMemberTeam(member.userId, teamName),
      ]);

      showToast('중간 관리자 권한 및 팀 설정이 성공적으로 저장되었습니다.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || '권한 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="p-4 sm:p-5 border-b border-border bg-card flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground">
                  중간 관리자 권한 설정
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-primary/15 text-primary border border-primary/20">
                  {member.displayName} ({member.email})
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                신뢰도와 역량에 맞게 팀 관리 기능과 정산·손익 지표를 단계별로 안전하게 위임합니다.
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

        {/* 모달 본문 (스크롤) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar text-xs">
          {/* 1. 3단계 티어 프리셋 선택 바 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                1. 기본 권한 등급 (Tier Preset) 선택
              </label>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                프리셋 선택 후 아래 세부 스위치를 개별 조정할 수 있습니다
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Tier 1 */}
              <button
                type="button"
                onClick={() => handleApplyTierPreset(1)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  tier === 1
                    ? 'bg-blue-50/80 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/20'
                    : 'bg-slate-50 dark:bg-gray-700/50 border-slate-200 dark:border-gray-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-blue-700 dark:text-blue-300">
                    Tier 1: 플로어 팀장
                  </span>
                  {tier === 1 && <Check size={14} className="text-blue-600" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400 leading-tight">
                  배정 · 모니터링 · 녹음감사 중심 (신임/현장형)
                </p>
              </button>

              {/* Tier 2 */}
              <button
                type="button"
                onClick={() => handleApplyTierPreset(2)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  tier === 2
                    ? 'bg-indigo-50/80 dark:bg-indigo-900/40 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20'
                    : 'bg-slate-50 dark:bg-gray-700/50 border-slate-200 dark:border-gray-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-indigo-700 dark:text-indigo-300">
                    Tier 2: 수석 팀장
                  </span>
                  {tier === 2 && <Check size={14} className="text-indigo-600" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400 leading-tight">
                  Tier 1 + 실적검토 · 상담원초대 · 대량배분
                </p>
              </button>

              {/* Tier 3 */}
              <button
                type="button"
                onClick={() => handleApplyTierPreset(3)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  tier === 3
                    ? 'bg-purple-50/80 dark:bg-purple-900/40 border-purple-400 dark:border-purple-600 ring-2 ring-purple-500/20'
                    : 'bg-slate-50 dark:bg-gray-700/50 border-slate-200 dark:border-gray-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-purple-700 dark:text-purple-300">
                    Tier 3: 총괄 실장
                  </span>
                  {tier === 3 && <Check size={14} className="text-purple-600" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400 leading-tight">
                  Tier 2 + 보안프로필 · 분배규칙 · 계정정지
                </p>
              </button>
            </div>
          </div>

          {/* 2. 팀 관리 세부 On/Off 스위치 */}
          <div className="bg-slate-50 dark:bg-gray-700/40 p-4 rounded-xl border border-slate-200/80 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-blue-600" />
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                2. 팀 관리 세부 권한 스위치
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-blue-400">
                <input
                  type="checkbox"
                  checked={teamPerms.canInviteMembers}
                  onChange={(e) =>
                    setTeamPerms({ ...teamPerms, canInviteMembers: e.target.checked })
                  }
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    신규 상담원 초대 권한
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    새로운 상담원 가입 초대장 발송 가능
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-blue-400">
                <input
                  type="checkbox"
                  checked={teamPerms.canViewPerformance}
                  onChange={(e) =>
                    setTeamPerms({ ...teamPerms, canViewPerformance: e.target.checked })
                  }
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    상담원 인센티브/실적 보드 검토
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    팀원별 콜·인계 실적 및 수당 산출 확인
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-blue-400">
                <input
                  type="checkbox"
                  checked={teamPerms.canModifySecurity}
                  onChange={(e) =>
                    setTeamPerms({ ...teamPerms, canModifySecurity: e.target.checked })
                  }
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    상담원 보안 프로필 수정 권한
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    워터마크, 번호 마스킹, 캡처 차단 변경
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-blue-400">
                <input
                  type="checkbox"
                  checked={teamPerms.canModifyRules}
                  onChange={(e) =>
                    setTeamPerms({ ...teamPerms, canModifyRules: e.target.checked })
                  }
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    분배 규칙 및 수명주기 정책 수정
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    라운드로빈 쿼터 및 자동 회수 룰 설정
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-blue-400 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={teamPerms.canDisableMembers}
                  onChange={(e) =>
                    setTeamPerms({ ...teamPerms, canDisableMembers: e.target.checked })
                  }
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    상담원 계정 정지 / 비활성화 권한 (고위험)
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    문제 상담원 계정 사용 중지 및 즉시 세션 파기
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* 3. 정산·손익 센터 대표 오픈 권한 스위치 */}
          <div className="bg-slate-50 dark:bg-gray-700/40 p-4 rounded-xl border border-slate-200/80 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Calculator size={16} className="text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                3. 정산·손익 센터 선택형 오픈 스위치 (경영 기밀 통제)
              </h4>
            </div>

            <div className="space-y-2.5 text-xs">
              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-emerald-400">
                <input
                  type="checkbox"
                  checked={settlementPerms.allowReceivables}
                  onChange={(e) =>
                    setSettlementPerms({ ...settlementPerms, allowReceivables: e.target.checked })
                  }
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span>미수금 및 분납 잔금 현황 열람</span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                      기본 권장
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    고객 분납금 미납 건을 확인하여 상담원에게 잔금 회수 통화를 독려할 수 있습니다.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-emerald-400">
                <input
                  type="checkbox"
                  checked={settlementPerms.allowAgentCommission}
                  onChange={(e) =>
                    setSettlementPerms({ ...settlementPerms, allowAgentCommission: e.target.checked })
                  }
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    상담원 인센티브/수당 상세 대장 열람
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    팀원들의 건당 인센티브 산출 내역을 검토하고 수당 문의를 조율할 수 있습니다.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-emerald-400">
                <input
                  type="checkbox"
                  checked={settlementPerms.allowPartnerSettlement}
                  onChange={(e) =>
                    setSettlementPerms({ ...settlementPerms, allowPartnerSettlement: e.target.checked })
                  }
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    제휴 거래처(법무법인) 정산 수수료율 및 청구서 복사
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    법무법인과의 건당 수임 수수료율(%) 및 공식 청구서 추출 기능을 허용합니다.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-rose-400">
                <input
                  type="checkbox"
                  checked={settlementPerms.allowDbCost}
                  onChange={(e) =>
                    setSettlementPerms({ ...settlementPerms, allowDbCost: e.target.checked })
                  }
                  className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                />
                <div className="flex-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span>DB 구입 원가 및 대행사별 지출 단가 열람</span>
                    <span className="text-xs bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-bold">
                      보안 주의
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    외부 광고 대행사에 지불하는 건당 DB 구매 단가 및 품질 원가를 확인합니다.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-purple-400">
                <input
                  type="checkbox"
                  checked={settlementPerms.allowIntegratedPnL}
                  onChange={(e) =>
                    setSettlementPerms({ ...settlementPerms, allowIntegratedPnL: e.target.checked })
                  }
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div className="flex-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span>전사 통합 경영 손익 (순영업이익/고정비) 열람</span>
                    <span className="text-xs bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold">
                      최고 기밀
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    회사의 최종 순마진율, 임대료, 서버비 등 손익 종합 지표를 열람합니다.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* 4. 텔레그램 연동 관제 센터 위임 스위치 */}
          <div className="bg-slate-50 dark:bg-gray-700/40 p-4 rounded-xl border border-slate-200/80 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Smartphone size={16} className="text-blue-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  4. 텔레그램 연동 관제 센터 위임 스위치 (실시간 현장 피드백)
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-gray-400">소속 관리 팀:</span>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="예: 1팀, 2팀"
                  className="w-24 px-2 py-0.5 text-xs font-bold border border-slate-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-blue-400">
                <input
                  type="checkbox"
                  checked={telegramPerms.allowAccess}
                  onChange={(e) =>
                    setTelegramPerms({ ...telegramPerms, allowAccess: e.target.checked })
                  }
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span>텔레그램 연동 관제 센터 접근 권한</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">
                      {telegramPerms.allowAccess ? '허용' : '차단'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    좌측 메뉴의 'TG 연동 센터' 진입 및 실시간 현장 피드백 관제를 허용합니다.
                  </div>
                </div>
              </label>

              {telegramPerms.allowAccess && (
                <>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 space-y-2">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Eye size={14} className="text-indigo-600" />
                      <span>피드백 및 성과 조회 범위 (Scope)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTelegramPerms({ ...telegramPerms, viewScope: 'team' })}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          telegramPerms.viewScope === 'team'
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 font-bold'
                            : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'
                        }`}
                      >
                        <div className="text-xs">👥 담당 팀만 조회 (추천)</div>
                        <div className="text-xs opacity-80 mt-0.5">{teamName} 소속 팀원 리드의 피드백만 열람</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTelegramPerms({ ...telegramPerms, viewScope: 'all' })}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          telegramPerms.viewScope === 'all'
                            ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300 font-bold'
                            : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'
                        }`}
                      >
                        <div className="text-xs">🌐 전사 전체 조회 (총괄)</div>
                        <div className="text-xs opacity-80 mt-0.5">모든 팀과 법률사무소의 피드백 전면 열람</div>
                      </button>
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-blue-400">
                    <input
                      type="checkbox"
                      checked={telegramPerms.canBulkApprove}
                      onChange={(e) =>
                        setTelegramPerms({ ...telegramPerms, canBulkApprove: e.target.checked })
                      }
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        AI 추천 대량 일괄 승인 권한 위임
                      </div>
                      <div className="text-xs text-slate-500 dark:text-gray-400">
                        선택 승인 및 'AI 추천대로 전체 일괄 저장·승인' 일괄 처리 허용
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-blue-400">
                    <input
                      type="checkbox"
                      checked={telegramPerms.canManageRules}
                      onChange={(e) =>
                        setTelegramPerms({ ...telegramPerms, canManageRules: e.target.checked })
                      }
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        자동화 룰 (AI 상태 변경 및 부재 카운트) 설정 권한 위임
                      </div>
                      <div className="text-xs text-slate-500 dark:text-gray-400">
                        법률사무소 키워드 파싱 규칙 및 오토파일럿 상태 변경 규칙 수정 허용
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-rose-400">
                    <input
                      type="checkbox"
                      checked={telegramPerms.canPurgeHistory}
                      onChange={(e) =>
                        setTelegramPerms({ ...telegramPerms, canPurgeHistory: e.target.checked })
                      }
                      className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span>과거 히스토리 데이터 영구 삭제 권한 위임</span>
                        <span className="text-xs bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-bold">
                          고위험
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-gray-400">
                        보관 주기가 지난 텔레그램 수집 원본 로그를 영구 삭제할 수 있습니다.
                      </div>
                    </div>
                  </label>
                </>
              )}
            </div>
          </div>

          {/* 5. 사내 공지 및 업무 지시 위임 스위치 */}
          <div className="bg-slate-50 dark:bg-gray-700/40 p-4 rounded-xl border border-slate-200/80 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-amber-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  5. 사내 공지사항 & 업무 지시 권한 위임
                </h4>
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-gray-400">
                대상: {teamName}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-amber-400">
                <input
                  type="checkbox"
                  checked={noticePerms.allowAccess}
                  onChange={(e) =>
                    setNoticePerms({ ...noticePerms, allowAccess: e.target.checked })
                  }
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                />
                <div className="flex-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span>공지사항 & 업무 지시 관리 권한</span>
                    <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                      {noticePerms.allowAccess ? '허용' : '차단'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    좌측 메뉴의 '사내 공지사항' 관리 기능(공지 작성, 업무 지시 하달, 수신 통계 열람)을 허용합니다.
                  </div>
                </div>
              </label>

              {noticePerms.allowAccess && (
                <>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 space-y-2">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <SlidersHorizontal size={14} className="text-amber-600" />
                      <span>공지 작성 및 업무 지시 대상 범위 (Scope)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNoticePerms({ ...noticePerms, noticeScope: 'team', directiveScope: 'team' })}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          noticePerms.noticeScope === 'team' && noticePerms.directiveScope === 'team'
                            ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-500 text-amber-700 dark:text-amber-300 font-bold'
                            : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'
                        }`}
                      >
                        <div className="text-xs">👥 담당 팀 한정 (추천)</div>
                        <div className="text-xs opacity-80 mt-0.5">{teamName} 팀 공지 작성 및 소속 팀원에게만 업무 지시 하달</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoticePerms({ ...noticePerms, noticeScope: 'all', directiveScope: 'all' })}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          noticePerms.noticeScope === 'all' && noticePerms.directiveScope === 'all'
                            ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300 font-bold'
                            : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'
                        }`}
                      >
                        <div className="text-xs">🌐 전사 전체 허용 (총괄)</div>
                        <div className="text-xs opacity-80 mt-0.5">전사 공지사항 작성 및 모든 팀 상담원에게 지시 하달</div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-amber-400">
                      <input
                        type="checkbox"
                        checked={noticePerms.canCreateNotice}
                        onChange={(e) =>
                          setNoticePerms({ ...noticePerms, canCreateNotice: e.target.checked })
                        }
                        className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          새 공지사항 등록 권한
                        </div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">
                          새로운 공지 글을 게시할 수 있습니다.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-amber-400">
                      <input
                        type="checkbox"
                        checked={noticePerms.canIssueDirective}
                        onChange={(e) =>
                          setNoticePerms({ ...noticePerms, canIssueDirective: e.target.checked })
                        }
                        className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          업무 지시 하달 권한
                        </div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">
                          상담원에게 조치 요구 업무 지시를 내릴 수 있습니다.
                        </div>
                      </div>
                    </label>
                  </div>

                  <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-amber-400">
                    <input
                      type="checkbox"
                      checked={noticePerms.canDeleteNotice}
                      onChange={(e) =>
                        setNoticePerms({ ...noticePerms, canDeleteNotice: e.target.checked })
                      }
                      className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                        <span>공지사항 삭제 권한</span>
                        <span className="text-xs bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 px-1.5 py-0.2 rounded font-bold">
                          {noticePerms.canDeleteNotice ? '삭제 가능' : '삭제 차단'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-gray-400">
                        게시된 공지사항을 삭제할 수 있습니다 (대표/총괄 권장).
                      </div>
                    </div>
                  </label>
                </>
              )}
            </div>
          </div>

          {/* 6. AI 트레이닝 & 코칭 센터 위임 스위치 */}
          <div className="bg-slate-50 dark:bg-gray-700/40 p-4 rounded-xl border border-slate-200/80 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GraduationCap size={16} className="text-purple-600" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  6. AI 트레이닝 & 코칭 센터 위임 스위치 (실전 훈련 및 역량 지도)
                </h4>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300">
                AI 모의실습 & 피드백
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-purple-400">
                <input
                  type="checkbox"
                  checked={trainingPerms.allowAccess}
                  onChange={(e) =>
                    setTrainingPerms({ ...trainingPerms, allowAccess: e.target.checked })
                  }
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div className="flex-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span>AI 트레이닝 관리 & 코칭 허브 접근 권한</span>
                    <span className="text-xs bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold">
                      {trainingPerms.allowAccess ? '허용' : '차단'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    좌측 메뉴의 'AI 트레이닝' 센터 내 관리자 코칭 허브 및 평가 기능을 허용합니다.
                  </div>
                </div>
              </label>

              {trainingPerms.allowAccess && (
                <>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 space-y-2">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <SlidersHorizontal size={14} className="text-purple-600" />
                      <span>훈련 세션 열람 및 코칭 대상 범위 (Scope)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTrainingPerms({ ...trainingPerms, viewScope: 'team' })}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          trainingPerms.viewScope === 'team'
                            ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300 font-bold'
                            : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'
                        }`}
                      >
                        <div className="text-xs">👥 담당 팀 한정 (추천)</div>
                        <div className="text-xs opacity-80 mt-0.5">{teamName} 소속 팀원의 모의 훈련 세션만 열람 및 밀착 지도</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrainingPerms({ ...trainingPerms, viewScope: 'all' })}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          trainingPerms.viewScope === 'all'
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold'
                            : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'
                        }`}
                      >
                        <div className="text-xs">🌐 전사 전체 허용 (총괄)</div>
                        <div className="text-xs opacity-80 mt-0.5">전사 모든 팀 상담원의 모의 통화 이력 및 녹취 열람</div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-purple-400">
                      <input
                        type="checkbox"
                        checked={trainingPerms.canGrade}
                        onChange={(e) =>
                          setTrainingPerms({ ...trainingPerms, canGrade: e.target.checked })
                        }
                        className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          평가 등급(S~F) 및 코칭 작성
                        </div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">
                          팀원 모의 훈련에 등급을 매기고 피드백을 등록합니다.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-purple-400">
                      <input
                        type="checkbox"
                        checked={trainingPerms.canManageConfig}
                        onChange={(e) =>
                          setTrainingPerms({ ...trainingPerms, canManageConfig: e.target.checked })
                        }
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          전사 훈련 정책 설정 권한
                        </div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">
                          회사 표준 첫인사 및 키워드 설정을 수정합니다 (대표/총괄 권장).
                        </div>
                      </div>
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 7. 시스템 설정(Settings) 권한 위임 스위치 */}
          <div className="bg-slate-50 dark:bg-gray-700/40 p-4 rounded-xl border border-slate-200/80 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-slate-600 dark:text-slate-300" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  7. 시스템 설정(Settings) 권한 위임 스위치 (전사 표준 및 인프라)
                </h4>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-800 dark:bg-gray-600 dark:text-slate-200">
                표준체계 & 인프라
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 cursor-pointer hover:border-blue-400">
                <input
                  type="checkbox"
                  checked={settingsPerms.allowAccess}
                  onChange={(e) =>
                    setSettingsPerms({ ...settingsPerms, allowAccess: e.target.checked })
                  }
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span>시스템 설정 페이지 접근 권한</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">
                      {settingsPerms.allowAccess ? '허용' : '차단'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    좌측 메뉴의 '시스템 설정' 페이지 접근을 허용합니다 (체크 해제 시 메뉴 비노출).
                  </div>
                </div>
              </label>

              {settingsPerms.allowAccess && (
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 space-y-2">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <SlidersHorizontal size={14} className="text-blue-600" />
                      <span>대분류 탭별 접근 및 편집 권한</span>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-start gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-gray-700 cursor-pointer hover:border-blue-400">
                        <input
                          type="checkbox"
                          checked={settingsPerms.allowPartners}
                          onChange={(e) =>
                            setSettingsPerms({ ...settingsPerms, allowPartners: e.target.checked })
                          }
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                            <span>1. 거래처 맞춤 관리 탭 오픈 (수임 수수료율 기밀)</span>
                            <span className="text-xs bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 px-1.5 py-0.2 rounded font-bold">
                              {settingsPerms.allowPartners ? '오픈' : '숨김(차단)'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-gray-400">
                            제휴 법무법인의 건당 수임 수수료율 규칙 및 서식 설정 탭을 오픈합니다 (대표/총괄 권장).
                          </div>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-gray-700 cursor-pointer hover:border-blue-400">
                        <input
                          type="checkbox"
                          checked={settingsPerms.allowOperations}
                          onChange={(e) =>
                            setSettingsPerms({ ...settingsPerms, allowOperations: e.target.checked })
                          }
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                            <span>2. 공통 업무 설정 편집 권한 (상담상태/유입경로/콜간격)</span>
                            <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">
                              {settingsPerms.allowOperations ? '수정/삭제 허용' : '읽기 전용 뷰어'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-gray-400">
                            체크 시 상담 상태 체계 및 콜 리마인더 간격을 수정할 수 있습니다. (미체크 시 열람만 가능한 안전 뷰어 모드로 동작)
                          </div>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-gray-700 cursor-pointer hover:border-blue-400">
                        <input
                          type="checkbox"
                          checked={settingsPerms.allowIntegrations}
                          onChange={(e) =>
                            setSettingsPerms({ ...settingsPerms, allowIntegrations: e.target.checked })
                          }
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                            <span>3. 외부 연동 & AI 탭 관리 권한</span>
                            <span className="text-xs bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 px-1.5 py-0.2 rounded font-bold">
                              {settingsPerms.allowIntegrations ? '오픈' : '숨김(차단)'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-gray-400">
                            텔레그램 알림방 타깃 설정 및 AI 회생/파산 도메인 감지 키워드 관리를 허용합니다.
                          </div>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-gray-700 cursor-pointer hover:border-blue-400">
                        <input
                          type="checkbox"
                          checked={settingsPerms.allowDataSecurity}
                          onChange={(e) =>
                            setSettingsPerms({ ...settingsPerms, allowDataSecurity: e.target.checked })
                          }
                          className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                        />
                        <div className="flex-1">
                          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                            <span>4. 데이터 백업 다운로드 권한</span>
                            <span className="text-xs bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 px-1.5 py-0.2 rounded font-bold">
                              {settingsPerms.allowDataSecurity ? '다운로드 허용' : '숨김(차단)'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-gray-400">
                            전사 수동 DB 백업 다운로드 및 캐시 재동기화를 허용합니다. (긴급 데이터 파기 및 백업 복원은 대표 전권 고정)
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 모달 푸터 버튼 */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border transition-colors cursor-pointer shadow-2xs"
          >
            취소 / 닫기
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Check size={14} />
            {saving ? '권한 저장 중...' : '권한 저장 및 즉시 적용'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPermissionModal;
