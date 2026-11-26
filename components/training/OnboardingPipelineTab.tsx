import React, { useState, useEffect } from 'react';
import {
  OnboardingStepId,
  OnboardingStepMeta,
  ONBOARDING_STEP_METAS,
  UserOnboardingProfile,
  getOnboardingProfile,
  fetchOnboardingProfileFromServer,
  completeOnboardingStep,
  resetOnboardingProfile,
} from '../../services/trainingOnboardingService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
import { AdminOnboardingModal } from './AdminOnboardingModal';
import {
  GraduationCap,
  CheckCircle2,
  Lock,
  Play,
  ArrowRight,
  Sparkles,
  Trophy,
  Award,
  Clock,
  RotateCcw,
  Users,
  ShieldCheck,
  AlertCircle,
  BookOpen,
  Headphones,
  Youtube,
  HelpCircle,
  MessageSquare,
  Zap,
} from 'lucide-react';

interface Props {
  onNavigateTab: (tabKey: 'clinic' | 'random' | 'regular' | 'materials' | 'coaching', subView?: string) => void;
}

export const OnboardingPipelineTab: React.FC<Props> = ({ onNavigateTab }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const addToast = (msg: string, type?: any) => showToast(msg, type === 'info' ? 'success' : type);
  const { confirm } = useConfirmDialog();

  const currentUserId = user?.email || user?.id || 'new_agent_01';
  const currentUserName = user?.name || user?.email || '신입 상담원';
  const isAdmin = user?.role === '대표' || user?.role === '총괄실장' || (user as any)?.isOwner;

  const [profile, setProfile] = useState<UserOnboardingProfile>(() =>
    getOnboardingProfile(currentUserId, currentUserName)
  );

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // 프로필 최신화 (로컬 즉시 표시 후 서버 DB 동기화)
  useEffect(() => {
    setProfile(getOnboardingProfile(currentUserId, currentUserName));
    let active = true;
    fetchOnboardingProfileFromServer(currentUserId, currentUserName).then((serverProfile) => {
      if (active) setProfile(serverProfile);
    });
    return () => { active = false; };
  }, [currentUserId, currentUserName]);

  // 특정 단계 완료 처리
  const handleCompleteStep = (stepId: OnboardingStepId, score?: number) => {
    const updated = completeOnboardingStep(currentUserId, stepId, score);
    setProfile(updated);
    addToast('🎯 퀘스트 완료! 다음 단계 잠금이 해제되었습니다.', 'success');
  };

  // 퀘스트 바로가기 실행
  const handleActionClick = (meta: OnboardingStepMeta) => {
    if (profile.steps[meta.id]?.status === 'locked') {
      addToast('이전 단계를 먼저 완료하셔야 진행할 수 있습니다.', 'info');
      return;
    }

    // 대상 뷰로 탭 이동
    switch (meta.targetView) {
      case 'videos':
        onNavigateTab('materials', 'videos');
        break;
      case 'script':
        onNavigateTab('materials', 'script');
        break;
      case 'recordings':
        onNavigateTab('materials', 'recordings');
        break;
      case 'faq':
        onNavigateTab('materials', 'faq');
        break;
      case 'exam':
        onNavigateTab('materials', 'exam');
        break;
      case 'basic':
        onNavigateTab('regular');
        break;
      case 'clinic':
        onNavigateTab('clinic');
        break;
      case 'random':
        onNavigateTab('random');
        break;
      default:
        break;
    }
  };

  // 관리자 전용: 9단계 전체 원클릭 완료 (테스트/시연용)
  const handleAdminCompleteAll = async () => {
    const ok = await confirm({
      title: '온보딩 퀘스트 일괄 완료',
      message: '관리자 권한으로 9개 퀘스트를 모두 즉시 완료 처리하시겠습니까?',
      confirmLabel: '일괄 완료',
      cancelLabel: '취소'
    });
    if (ok) {
      let p = profile;
      ONBOARDING_STEP_METAS.forEach((m) => {
        p = completeOnboardingStep(currentUserId, m.id, 92, '관리자 일괄 테스트 통과');
      });
      setProfile(p);
      addToast('모든 온보딩 퀘스트가 100% 완료되었습니다.', 'success');
    }
  };

  // 온보딩 리셋
  const handleReset = async () => {
    const ok = await confirm({
      title: '온보딩 내역 초기화',
      message: '온보딩 진행 내역을 처음부터 다시 시작하시겠습니까?',
      confirmLabel: '초기화 실행',
      cancelLabel: '취소',
      variant: 'destructive'
    });
    if (ok) {
      const resetP = resetOnboardingProfile(currentUserId);
      setProfile(resetP);
      addToast('온보딩 진행 내역이 초기화되었습니다.', 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. 상단 대형 브리핑 카드 */}
      <div className="p-6 md:p-7 rounded-xl bg-card border border-border text-card-foreground shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
                ONBOARDING FAST-TRACK
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                신입 상담원 3일 완성 무인 교육 파이프라인
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <GraduationCap className="w-6 h-6 text-primary" strokeWidth={1.75} />
              <span>{profile.userName} 님의 신입 온보딩 패스</span>
            </h2>

            <p className="text-xs md:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              사무장이나 대표님의 도움 없이도 시스템의 안내에 따라 <strong className="text-foreground">9개 퀘스트</strong>를 완주하시면
              상담역량 평가를 거쳐 <strong className="text-foreground">실전 인입 콜 투입 권한</strong>이 자동으로 부여됩니다.
            </p>
          </div>

          {/* 우측 진행률 & 상태 카드 */}
          <div className="flex items-center gap-4 p-4 sm:p-5 rounded-xl bg-muted/30 border border-border shrink-0 w-full md:w-auto">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                profile.isApprovedByAdmin
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : profile.isCompleted
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  : 'bg-primary/10 text-primary border border-primary/20'
              }`}
            >
              {profile.isApprovedByAdmin ? (
                <ShieldCheck className="w-6 h-6" strokeWidth={1.75} />
              ) : profile.isCompleted ? (
                <Trophy className="w-6 h-6" strokeWidth={1.75} />
              ) : (
                <Award className="w-6 h-6" strokeWidth={1.75} />
              )}
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground font-medium">전체 온보딩 달성률</div>
              <div className="text-2xl font-bold text-foreground font-mono flex items-baseline gap-1.5">
                <span>{profile.progressPercent}%</span>
                <span className="text-xs font-normal text-muted-foreground">
                  ({profile.completedCount} / 9 완료)
                </span>
              </div>
              <div className="text-xs">
                {profile.isApprovedByAdmin ? (
                  <span className="text-emerald-500 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} /> 실전 발신 권한 승인 완료
                  </span>
                ) : profile.isCompleted ? (
                  <span className="text-amber-500 font-semibold animate-pulse">
                    ⏳ 9단계 완주 · 관리자 승인 대기 중
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    현재 Step {ONBOARDING_STEP_METAS.find((m) => m.id === profile.currentStepId)?.order || 1} 진행 중
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 대형 프로그레스 바 */}
        <div className="mt-6 pt-5 border-t border-border space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Phase 1. 기초 이론 체화 (1~3단계)</span>
            <span>Phase 2. 지식 검증 및 시험 (4~6단계)</span>
            <span>Phase 3. AI 실전 시뮬레이션 (7~9단계)</span>
          </div>

          <div className="h-2 w-full bg-muted rounded-full overflow-hidden p-0">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                profile.isApprovedByAdmin
                  ? 'bg-emerald-500'
                  : 'bg-primary'
              }`}
              style={{ width: `${Math.max(5, profile.progressPercent)}%` }}
            />
          </div>
        </div>

        {/* 관리자 툴바 (관리자일 때만 노출) */}
        {isAdmin && (
          <div className="mt-5 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold text-xs">
                관리자 컨트롤
              </span>
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted text-foreground font-semibold transition-all shadow-xs"
              >
                <Users className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>👥 전사 신입 온보딩 관제 보드 열기</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAdminCompleteAll}
                className="px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted text-foreground font-semibold transition-all shadow-xs"
                title="테스트용으로 9단계를 모두 즉시 완료 처리합니다"
              >
                9단계 일괄 완료 (시연/테스트)
              </button>
              <button
                onClick={handleReset}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all border border-border"
                title="온보딩 기록 초기화"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. 3개 Phase별 9개 퀘스트 카드 리스트 */}
      <div className="space-y-8">
        {[1, 2, 3].map((phaseNum) => {
          const phaseMetas = ONBOARDING_STEP_METAS.filter((m) => m.phase === phaseNum);
          const phaseTitle = phaseMetas[0]?.phaseName;
          const phaseCompleted = phaseMetas.every(
            (m) => profile.steps[m.id]?.status === 'completed'
          );

          return (
            <div key={phaseNum} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center ${
                      phaseCompleted
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    P{phaseNum}
                  </span>
                  <h3 className="text-sm font-bold text-foreground">
                    {phaseTitle}
                  </h3>
                </div>

                <span className="text-xs text-muted-foreground font-mono">
                  {phaseMetas.filter((m) => profile.steps[m.id]?.status === 'completed').length} /{' '}
                  {phaseMetas.length}개 완료
                </span>
              </div>

              {/* 3개 단계 그리드 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {phaseMetas.map((meta) => {
                  const state = profile.steps[meta.id];
                  const isDone = state?.status === 'completed';
                  const isInProgress = state?.status === 'in_progress';
                  const isLocked = state?.status === 'locked';

                  return (
                    <div
                      key={meta.id}
                      className={`p-4 sm:p-5 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                        isDone
                          ? 'bg-card border-border shadow-xs'
                          : isInProgress
                          ? 'bg-card border-primary ring-1 ring-primary/20 shadow-xs'
                          : 'bg-muted/30 border-border opacity-70'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* 상단 뱃지 및 상태 */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${
                              isDone
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : isInProgress
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'bg-muted text-muted-foreground border-border'
                            }`}
                          >
                            Step {meta.order}
                          </span>

                          <div className="flex items-center gap-1 text-xs">
                            {isDone ? (
                              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} /> 완료됨
                              </span>
                            ) : isInProgress ? (
                              <span className="text-primary font-semibold flex items-center gap-1">
                                <Zap className="w-3.5 h-3.5" strokeWidth={1.75} /> 진행 중
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-medium flex items-center gap-1">
                                <Lock className="w-3.5 h-3.5" strokeWidth={1.75} /> 잠김
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 제목 및 설명 */}
                        <div>
                          <h4 className="text-sm font-semibold text-foreground leading-snug">
                            {meta.title}
                          </h4>
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            {meta.desc}
                          </p>
                        </div>

                        {/* 통과 요건 및 예상 시간 박스 */}
                        <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">요건:</span>
                            <span className="text-muted-foreground font-mono">{meta.estimatedTime}</span>
                          </div>
                          <div className="text-xs text-foreground font-medium leading-relaxed">
                            {meta.requirement}
                          </div>
                          {state?.score !== undefined && (
                            <div className="text-primary font-semibold font-mono pt-0.5">
                              획득 점수: {state.score}점
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 하단 버튼 바 */}
                      <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
                        {isDone ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs text-muted-foreground font-mono">
                              {state.completedAt ? state.completedAt.split('T')[0] : '완료됨'}
                            </span>
                            <button
                              onClick={() => handleActionClick(meta)}
                              className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5"
                            >
                              <span>다시보기</span>
                              <ArrowRight className="w-3 h-3" strokeWidth={1.75} />
                            </button>
                          </div>
                        ) : isInProgress ? (
                          <div className="flex items-center gap-1.5 w-full">
                            <button
                              onClick={() => handleActionClick(meta)}
                              className="flex-1 py-2 px-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" strokeWidth={1.75} />
                              <span>{meta.actionLabel}</span>
                            </button>
                            <button
                              onClick={() => handleCompleteStep(meta.id)}
                              className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-all border border-border"
                              title="학습 완료 처리"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={1.75} />
                            </button>
                          </div>
                        ) : (
                          <div className="w-full py-2 px-3 rounded-lg bg-muted/30 border border-border text-center text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
                            <span>이전 단계 완료 후 오픈</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. 최종 완주 축하 및 승인 상태 배너 */}
      {profile.isCompleted && (
        <div
          className={`p-6 rounded-3xl border shadow-lg ${
            profile.isApprovedByAdmin
              ? 'bg-emerald-500 text-white border-emerald-400'
              : 'bg-amber-500 text-gray-950 border-amber-400'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                {profile.isApprovedByAdmin ? (
                  <ShieldCheck className="w-7 h-7 text-white" />
                ) : (
                  <Trophy className="w-7 h-7 text-gray-950" />
                )}
              </div>
              <div>
                <h4 className="text-base font-black">
                  {profile.isApprovedByAdmin
                    ? '🎉 실전 발신 권한 승인이 완료되었습니다!'
                    : '🎉 9개 온보딩 퀘스트를 모두 완주하셨습니다!'}
                </h4>
                <p className="text-xs opacity-90 mt-0.5">
                  {profile.isApprovedByAdmin
                    ? `승인자: ${profile.approvedBy} (${profile.approvedAt?.split('T')[0]}) · 이제 실전 인입 콜 배정 및 아웃바운드 발신이 가능합니다.`
                    : '관리자/대표님께 완주 보고가 전달되었습니다. 관리자 승인 후 실전 콜 발신 권한이 자동으로 활성화됩니다.'}
                </p>
              </div>
            </div>

            {isAdmin && !profile.isApprovedByAdmin && (
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className="px-5 py-2.5 rounded-2xl bg-gray-100 dark:bg-gray-950 text-white text-xs font-bold shadow-md hover:bg-gray-900 transition-all shrink-0"
              >
                관제 보드에서 즉시 승인하기
              </button>
            )}
          </div>
        </div>
      )}

      {/* 관리자 관제 모달 */}
      <AdminOnboardingModal
        isOpen={isAdminModalOpen}
        onClose={() => {
          setIsAdminModalOpen(false);
          setProfile(getOnboardingProfile(currentUserId, currentUserName));
        }}
      />
    </div>
  );
};
