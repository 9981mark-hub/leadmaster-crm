import React, { useState, useEffect } from 'react';
import {
  OnboardingStepId,
  OnboardingStepMeta,
  ONBOARDING_STEP_METAS,
  UserOnboardingProfile,
  getOnboardingProfile,
  completeOnboardingStep,
  resetOnboardingProfile,
} from '../../services/trainingOnboardingService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
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
  const { addToast } = useToast();

  const currentUserId = user?.email || user?.id || 'new_agent_01';
  const currentUserName = user?.name || user?.email || '신입 상담원';
  const isAdmin = user?.role === '대표' || user?.role === '총괄실장' || (user as any)?.isOwner;

  const [profile, setProfile] = useState<UserOnboardingProfile>(() =>
    getOnboardingProfile(currentUserId, currentUserName)
  );

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // 프로필 최신화
  useEffect(() => {
    setProfile(getOnboardingProfile(currentUserId, currentUserName));
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
  const handleAdminCompleteAll = () => {
    if (window.confirm('관리자 권한으로 9개 퀘스트를 모두 즉시 완료 처리하시겠습니까?')) {
      let p = profile;
      ONBOARDING_STEP_METAS.forEach((m) => {
        p = completeOnboardingStep(currentUserId, m.id, 92, '관리자 일괄 테스트 통과');
      });
      setProfile(p);
      addToast('모든 온보딩 퀘스트가 100% 완료되었습니다.', 'success');
    }
  };

  // 온보딩 리셋
  const handleReset = () => {
    if (window.confirm('온보딩 진행 내역을 처음부터 다시 시작하시겠습니까?')) {
      const resetP = resetOnboardingProfile(currentUserId);
      setProfile(resetP);
      addToast('온보딩 진행 내역이 초기화되었습니다.', 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. 상단 대형 브리핑 카드 */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white shadow-xl relative overflow-hidden border border-indigo-700/50">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-400 text-gray-950 text-xs font-black tracking-wider uppercase flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 fill-gray-950" />
                ONBOARDING FAST-TRACK
              </span>
              <span className="text-xs text-indigo-300 font-medium">
                신입 상담원 3일 완성 무인 교육 파이프라인
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <GraduationCap className="w-7 h-7 text-emerald-400" />
              <span>{profile.userName} 님의 신입 온보딩 패스</span>
            </h2>

            <p className="text-xs md:text-sm text-indigo-200/80 max-w-2xl leading-relaxed">
              사무장이나 대표님의 도움 없이도 시스템의 안내에 따라 <strong>9개 퀘스트</strong>를 완주하시면
              상담역량 평가를 거쳐 <strong>실전 인입 콜 투입 권한</strong>이 자동으로 부여됩니다.
            </p>
          </div>

          {/* 우측 진행률 & 상태 카드 */}
          <div className="flex items-center gap-4 p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shrink-0 w-full md:w-auto">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                profile.isApprovedByAdmin
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : profile.isCompleted
                  ? 'bg-amber-400 text-gray-950 shadow-lg shadow-amber-400/30'
                  : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              }`}
            >
              {profile.isApprovedByAdmin ? (
                <ShieldCheck className="w-7 h-7" />
              ) : profile.isCompleted ? (
                <Trophy className="w-7 h-7" />
              ) : (
                <Award className="w-7 h-7" />
              )}
            </div>

            <div className="space-y-1">
              <div className="text-[11px] text-indigo-200 font-medium">전체 온보딩 달성률</div>
              <div className="text-2xl font-black text-white flex items-baseline gap-1.5">
                <span>{profile.progressPercent}%</span>
                <span className="text-xs font-normal text-indigo-300">
                  ({profile.completedCount} / 9 완료)
                </span>
              </div>
              <div className="text-[11px]">
                {profile.isApprovedByAdmin ? (
                  <span className="text-emerald-300 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 실전 발신 권한 승인 완료
                  </span>
                ) : profile.isCompleted ? (
                  <span className="text-amber-300 font-bold animate-pulse">
                    ⏳ 9단계 완주 · 관리자 승인 대기 중
                  </span>
                ) : (
                  <span className="text-gray-300">
                    현재 Step {ONBOARDING_STEP_METAS.find((m) => m.id === profile.currentStepId)?.order || 1} 진행 중
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 대형 프로그레스 바 */}
        <div className="mt-6 pt-5 border-t border-indigo-800/60 space-y-2">
          <div className="flex items-center justify-between text-xs text-indigo-200">
            <span>Phase 1. 기초 이론 체화 (1~3단계)</span>
            <span>Phase 2. 지식 검증 및 시험 (4~6단계)</span>
            <span>Phase 3. AI 실전 시뮬레이션 (7~9단계)</span>
          </div>

          <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                profile.isApprovedByAdmin
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
              }`}
              style={{ width: `${Math.max(5, profile.progressPercent)}%` }}
            />
          </div>
        </div>

        {/* 관리자 툴바 (관리자일 때만 노출) */}
        {isAdmin && (
          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-400 text-gray-950 font-black text-[10px]">
                관리자 컨트롤
              </span>
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold transition-all"
              >
                <Users className="w-3.5 h-3.5" />
                <span>👥 전사 신입 온보딩 관제 보드 열기</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAdminCompleteAll}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/50 text-indigo-200 border border-indigo-400/30 font-bold transition-all"
                title="테스트용으로 9단계를 모두 즉시 완료 처리합니다"
              >
                9단계 일괄 완료 (시연/테스트)
              </button>
              <button
                onClick={handleReset}
                className="p-1.5 rounded-xl text-rose-300 hover:text-white hover:bg-rose-500/20 transition-all"
                title="온보딩 기록 초기화"
              >
                <RotateCcw className="w-3.5 h-3.5" />
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
                    className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center text-white ${
                      phaseCompleted ? 'bg-emerald-600' : 'bg-indigo-600'
                    }`}
                  >
                    P{phaseNum}
                  </span>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {phaseTitle}
                  </h3>
                </div>

                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
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
                      className={`p-5 rounded-3xl border transition-all duration-200 flex flex-col justify-between ${
                        isDone
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-700/60 shadow-sm'
                          : isInProgress
                          ? 'bg-white dark:bg-gray-800 border-indigo-500 dark:border-indigo-400 shadow-md ring-2 ring-indigo-500/20'
                          : 'bg-gray-50/90 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 shadow-xs'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* 상단 뱃지 및 상태 */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                              isDone
                                ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                                : isInProgress
                                ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 animate-pulse'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-transparent dark:border-gray-600'
                            }`}
                          >
                            Step {meta.order}
                          </span>

                          <div className="flex items-center gap-1 text-xs">
                            {isDone ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" /> 완료됨
                              </span>
                            ) : isInProgress ? (
                              <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                                <Zap className="w-3.5 h-3.5" /> 진행 중
                              </span>
                            ) : (
                              <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                                <Lock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" /> 잠김
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 제목 및 설명 */}
                        <div>
                          <h4
                            className={`text-sm font-bold leading-snug ${
                              isLocked
                                ? 'text-gray-800 dark:text-gray-100'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {meta.title}
                          </h4>
                          <p
                            className={`mt-1 text-xs leading-relaxed ${
                              isLocked
                                ? 'text-gray-600 dark:text-gray-300'
                                : 'text-gray-700 dark:text-gray-200'
                            }`}
                          >
                            {meta.desc}
                          </p>
                        </div>

                        {/* 통과 요건 및 예상 시간 박스 */}
                        <div
                          className={`p-3 rounded-2xl border text-[11px] space-y-1.5 ${
                            isDone
                              ? 'bg-emerald-100/40 dark:bg-gray-900/90 border-emerald-200/60 dark:border-emerald-900/50 text-gray-800 dark:text-gray-200'
                              : isInProgress
                              ? 'bg-indigo-50/70 dark:bg-gray-900/90 border-indigo-100 dark:border-indigo-900/60 text-gray-800 dark:text-gray-200'
                              : 'bg-gray-100/70 dark:bg-gray-900/90 border-gray-200/70 dark:border-gray-700/70 text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-800 dark:text-gray-200">요건:</span>
                            <span className="text-gray-500 dark:text-gray-400 font-medium">{meta.estimatedTime}</span>
                          </div>
                          <div className="text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold leading-relaxed">
                            {meta.requirement}
                          </div>
                          {state?.score !== undefined && (
                            <div className="text-emerald-600 dark:text-emerald-400 font-bold pt-0.5">
                              획득 점수: {state.score}점
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 하단 버튼 바 */}
                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center gap-2">
                        {isDone ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                              {state.completedAt ? state.completedAt.split('T')[0] : '완료됨'}
                            </span>
                            <button
                              onClick={() => handleActionClick(meta)}
                              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold flex items-center gap-0.5"
                            >
                              <span>다시보기</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        ) : isInProgress ? (
                          <div className="flex items-center gap-1.5 w-full">
                            <button
                              onClick={() => handleActionClick(meta)}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                            >
                              <Play className="w-3.5 h-3.5 fill-white" />
                              <span>{meta.actionLabel}</span>
                            </button>
                            <button
                              onClick={() => handleCompleteStep(meta.id)}
                              className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all border border-gray-200 dark:border-gray-600"
                              title="학습 완료 처리"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-full py-2.5 px-3 rounded-xl bg-gray-100/80 dark:bg-gray-900/70 border border-gray-200/60 dark:border-gray-700/60 text-center text-xs text-gray-600 dark:text-gray-300 font-medium flex items-center justify-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-400" />
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
                className="px-5 py-2.5 rounded-2xl bg-gray-950 text-white text-xs font-bold shadow-md hover:bg-gray-900 transition-all shrink-0"
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
