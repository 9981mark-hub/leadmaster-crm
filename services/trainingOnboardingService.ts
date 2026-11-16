/**
 * services/trainingOnboardingService.ts
 * 신입 상담원 온보딩 패스트트랙 (Onboarding Fast-Track) 자동화 패키지 서비스
 */

import { loadLevelExamProgress } from './trainingExamBank';

export type OnboardingStepId =
  | 'step_1_videos'
  | 'step_2_script'
  | 'step_3_recordings'
  | 'step_4_faq'
  | 'step_5_exam'
  | 'step_6_review'
  | 'step_7_basic_courses'
  | 'step_8_vulnerable_targets'
  | 'step_9_random_simulation';

export type StepStatus = 'locked' | 'in_progress' | 'completed';

export interface OnboardingStepMeta {
  id: OnboardingStepId;
  order: number;
  phase: 1 | 2 | 3;
  phaseName: string;
  title: string;
  desc: string;
  actionLabel: string;
  targetView: 'videos' | 'script' | 'recordings' | 'faq' | 'exam' | 'basic' | 'clinic' | 'random';
  estimatedTime: string;
  requirement: string;
}

export const ONBOARDING_STEP_METAS: OnboardingStepMeta[] = [
  // Phase 1: 기초 이론 및 스크립트 숙지
  {
    id: 'step_1_videos',
    order: 1,
    phase: 1,
    phaseName: 'Phase 1: 기초 이론 & 스크립트 체화',
    title: '필수 기초 교육영상 3편 시청',
    desc: '개인회생 기초 개념, 자가진단 인입 채널의 고객 심리, TM 첫인사 요령을 영상으로 학습합니다.',
    actionLabel: '교육영상 시청관 이동',
    targetView: 'videos',
    estimatedTime: '약 40분',
    requirement: '기초 추천 영상 3편 시청 완료',
  },
  {
    id: 'step_2_script',
    order: 2,
    phase: 1,
    phaseName: 'Phase 1: 기초 이론 & 스크립트 체화',
    title: '표준 TM 스크립트 & 7대 문진 정독',
    desc: '1차 인입 콜 표준 스크립트와 사무장 인계를 위한 7대 문진 필수 항목을 숙지합니다.',
    actionLabel: '스크립트 교재 열람',
    targetView: 'script',
    estimatedTime: '약 30분',
    requirement: '표준 스크립트 및 7대 문진 정독 완료',
  },
  {
    id: 'step_3_recordings',
    order: 3,
    phase: 1,
    phaseName: 'Phase 1: 기초 이론 & 스크립트 체화',
    title: '실전 모범 녹취 3선 필수 청취',
    desc: '선배 상담원들의 실제 합격 통화 녹취(라포 형성, 번호추궁 방어, 킬러 클로징)를 듣고 톤을 체화합니다.',
    actionLabel: '모범 녹취 청취관 이동',
    targetView: 'recordings',
    estimatedTime: '약 25분',
    requirement: '모범 녹취 3선 청취 완료',
  },

  // Phase 2: 지식 검증 및 평가시험
  {
    id: 'step_4_faq',
    order: 4,
    phase: 2,
    phaseName: 'Phase 2: 지식 검증 & 상담역량 평가',
    title: '다빈도 FAQ 10선 확인 & AI 사수 질의',
    desc: '수임료, 직장 통보, 기각 사유 등 고객이 가장 많이 묻는 필수 FAQ 10선을 확인합니다.',
    actionLabel: 'FAQ 검색 센터 이동',
    targetView: 'faq',
    estimatedTime: '약 30분',
    requirement: '필수 FAQ 10선 자가 확인',
  },
  {
    id: 'step_5_exam',
    order: 5,
    phase: 2,
    phaseName: 'Phase 2: 지식 검증 & 상담역량 평가',
    title: '상담역량 평가시험 초급 4회차 (100제) 80점 합격',
    desc: '초급 1~4회차(총 100문항)에 응시하여 각 회차별 80점 이상 획득 시 마스터 배지를 부여받습니다.',
    actionLabel: '평가시험 센터 이동',
    targetView: 'exam',
    estimatedTime: '약 80분',
    requirement: '초급 Round 1~4 전 회차 80점 이상 합격',
  },
  {
    id: 'step_6_review',
    order: 6,
    phase: 2,
    phaseName: 'Phase 2: 지식 검증 & 상담역량 평가',
    title: '시험 오답노트 복습 & 실전 멘트 암기',
    desc: '틀린 문제의 [💡 실무 해설]과 [🎯 실전 멘트]를 복습하고 실전 화법을 체화합니다.',
    actionLabel: '오답노트 복습하기',
    targetView: 'exam',
    estimatedTime: '약 20분',
    requirement: '오답노트 전수 확인 및 복습 완료',
  },

  // Phase 3: AI 가상고객 실전 시뮬레이션
  {
    id: 'step_7_basic_courses',
    order: 7,
    phase: 3,
    phaseName: 'Phase 3: AI 가상고객 실전 시뮬레이션',
    title: '기본 4단계 정규 코스 완주',
    desc: 'AI 고객과 함께 첫인사 -> 7대 문진 -> 거절 돌파 -> 클로징 4단계를 단계별로 마스터합니다.',
    actionLabel: '4단계 정규 코스 이동',
    targetView: 'basic',
    estimatedTime: '약 40분',
    requirement: '4단계 정규 코스 전 단계 통화 완주',
  },
  {
    id: 'step_8_vulnerable_targets',
    order: 8,
    phase: 3,
    phaseName: 'Phase 3: AI 가상고객 실전 시뮬레이션',
    title: '취약 유형 타깃 클리닉 필수 3종 클리어',
    desc: '신입이 가장 당황하는 3대 유형(번호추궁, 보이스피싱 의심, 분노/폭언)과 모의 통화를 완수합니다.',
    actionLabel: '취약 유형 클리닉 이동',
    targetView: 'clinic',
    estimatedTime: '약 35분',
    requirement: '번호추궁, 피싱의심, 분노고객 AI 통화 완료',
  },
  {
    id: 'step_9_random_simulation',
    order: 9,
    phase: 3,
    phaseName: 'Phase 3: AI 가상고객 실전 시뮬레이션',
    title: '무규칙 실전 고객 최종 모의 테스트 (3회)',
    desc: '실전과 똑같이 무작위로 생성된 AI 고객과 3회 연속 통화하여 문진 5개 이상을 달성합니다.',
    actionLabel: '무규칙 실전 고객 이동',
    targetView: 'random',
    estimatedTime: '약 45분',
    requirement: '무규칙 실전 고객 3회 통화 완료 (문진 5개 이상 달성)',
  },
];

export interface OnboardingStepState {
  status: StepStatus;
  completedAt?: string;
  score?: number;
  note?: string;
}

export interface UserOnboardingProfile {
  userId: string;
  userName: string;
  startedAt: string;
  updatedAt: string;
  currentStepId: OnboardingStepId;
  progressPercent: number; // 0 ~ 100
  completedCount: number; // 0 ~ 9
  isCompleted: boolean; // 9개 모두 완료
  isApprovedByAdmin: boolean; // 대표/관리자 최종 발신 권한 승인
  approvedAt?: string;
  approvedBy?: string;
  steps: Record<OnboardingStepId, OnboardingStepState>;
}

const STORAGE_PREFIX = 'lm_training_onboarding_profile_v1';
const ALL_USERS_KEY = 'lm_training_onboarding_users_v1';

/**
 * 초기 온보딩 프로필 생성 (1단계 in_progress, 2~9단계 locked)
 */
function createInitialProfile(userId: string, userName?: string): UserOnboardingProfile {
  const now = new Date().toISOString();
  const steps: Record<OnboardingStepId, OnboardingStepState> = {
    step_1_videos: { status: 'in_progress' },
    step_2_script: { status: 'locked' },
    step_3_recordings: { status: 'locked' },
    step_4_faq: { status: 'locked' },
    step_5_exam: { status: 'locked' },
    step_6_review: { status: 'locked' },
    step_7_basic_courses: { status: 'locked' },
    step_8_vulnerable_targets: { status: 'locked' },
    step_9_random_simulation: { status: 'locked' },
  };

  return {
    userId,
    userName: userName || userId,
    startedAt: now,
    updatedAt: now,
    currentStepId: 'step_1_videos',
    progressPercent: 0,
    completedCount: 0,
    isCompleted: false,
    isApprovedByAdmin: false,
    steps,
  };
}

/**
 * 사용자 온보딩 프로필 로드 (없으면 자동 생성)
 */
export function getOnboardingProfile(userId: string, userName?: string): UserOnboardingProfile {
  try {
    const key = `${STORAGE_PREFIX}_${userId}`;
    const raw = localStorage.getItem(key);
    let profile: UserOnboardingProfile;

    if (raw) {
      profile = JSON.parse(raw);
    } else {
      profile = createInitialProfile(userId, userName);
      saveOnboardingProfile(profile);
    }

    // 초급 시험 결과와 자동 동기화 확인
    profile = syncExamResultsWithProfile(profile);
    return profile;
  } catch (e) {
    console.error('Failed to get onboarding profile:', e);
    return createInitialProfile(userId, userName);
  }
}

/**
 * 온보딩 프로필 저장
 */
export function saveOnboardingProfile(profile: UserOnboardingProfile): void {
  try {
    profile.updatedAt = new Date().toISOString();

    // 진척도 재계산
    let completed = 0;
    ONBOARDING_STEP_METAS.forEach((m) => {
      if (profile.steps[m.id]?.status === 'completed') {
        completed++;
      }
    });

    profile.completedCount = completed;
    profile.progressPercent = Math.round((completed / ONBOARDING_STEP_METAS.length) * 100);
    profile.isCompleted = completed === ONBOARDING_STEP_METAS.length;

    // 현재 진행 중인 stepId 산정
    const firstUnfinished = ONBOARDING_STEP_METAS.find(
      (m) => profile.steps[m.id]?.status !== 'completed'
    );
    if (firstUnfinished) {
      profile.currentStepId = firstUnfinished.id;
      if (profile.steps[firstUnfinished.id].status === 'locked') {
        profile.steps[firstUnfinished.id].status = 'in_progress';
      }
    }

    const key = `${STORAGE_PREFIX}_${profile.userId}`;
    localStorage.setItem(key, JSON.stringify(profile));

    // 전체 유저 목록 인덱스 갱신
    registerUserIndex(profile.userId);
  } catch (e) {
    console.error('Failed to save onboarding profile:', e);
  }
}

/**
 * 특정 단계 완료 처리 및 다음 단계 잠금 해제(Unlock)
 */
export function completeOnboardingStep(
  userId: string,
  stepId: OnboardingStepId,
  score?: number,
  note?: string
): UserOnboardingProfile {
  const profile = getOnboardingProfile(userId);
  const now = new Date().toISOString();

  // 해당 단계 완료
  profile.steps[stepId] = {
    status: 'completed',
    completedAt: now,
    score: score !== undefined ? score : profile.steps[stepId]?.score,
    note: note || profile.steps[stepId]?.note,
  };

  // 다음 단계 잠금 해제
  const currentIndex = ONBOARDING_STEP_METAS.findIndex((m) => m.id === stepId);
  if (currentIndex >= 0 && currentIndex < ONBOARDING_STEP_METAS.length - 1) {
    const nextMeta = ONBOARDING_STEP_METAS[currentIndex + 1];
    if (profile.steps[nextMeta.id]?.status === 'locked') {
      profile.steps[nextMeta.id].status = 'in_progress';
    }
  }

  saveOnboardingProfile(profile);
  return profile;
}

/**
 * 관리자/대표 실전 발신 권한 최종 승인
 */
export function approveOnboarding(
  userId: string,
  adminName: string
): UserOnboardingProfile {
  const profile = getOnboardingProfile(userId);
  profile.isApprovedByAdmin = true;
  profile.approvedAt = new Date().toISOString();
  profile.approvedBy = adminName;
  saveOnboardingProfile(profile);
  return profile;
}

/**
 * 온보딩 프로필 초기화 (재교육)
 */
export function resetOnboardingProfile(userId: string): UserOnboardingProfile {
  const current = getOnboardingProfile(userId);
  const fresh = createInitialProfile(userId, current.userName);
  saveOnboardingProfile(fresh);
  return fresh;
}

/**
 * 시험 모듈의 초급 시험 통과 결과와 동기화
 */
function syncExamResultsWithProfile(profile: UserOnboardingProfile): UserOnboardingProfile {
  try {
    const examProgress = loadLevelExamProgress('beginner');
    // 초급 4회차가 모두 통과되었고 step_5_exam이 완료되지 않았다면 자동 완료
    if (examProgress.isMastered && profile.steps.step_5_exam?.status !== 'completed') {
      profile.steps.step_5_exam = {
        status: 'completed',
        completedAt: new Date().toISOString(),
        score: examProgress.averageScore,
        note: `초급 4회차 전원 마스터 달성 (평균 ${examProgress.averageScore}점)`,
      };

      // 다음 6단계 잠금 해제
      if (profile.steps.step_6_review?.status === 'locked') {
        profile.steps.step_6_review.status = 'in_progress';
      }
      saveOnboardingProfile(profile);
    }
  } catch (e) {
    // 무시
  }
  return profile;
}

/**
 * 관리자용: 전사 온보딩 유저 목록 조회
 */
export function getAllOnboardingProfiles(): UserOnboardingProfile[] {
  try {
    const rawIndex = localStorage.getItem(ALL_USERS_KEY);
    const userIds: string[] = rawIndex ? JSON.parse(rawIndex) : [];
    const profiles: UserOnboardingProfile[] = [];

    userIds.forEach((uId) => {
      const p = getOnboardingProfile(uId);
      if (p) profiles.push(p);
    });

    return profiles;
  } catch (e) {
    console.error('Failed to get all onboarding profiles:', e);
    return [];
  }
}

/**
 * 유저 인덱스 등록
 */
function registerUserIndex(userId: string): void {
  try {
    const rawIndex = localStorage.getItem(ALL_USERS_KEY);
    const userIds: string[] = rawIndex ? JSON.parse(rawIndex) : [];
    if (!userIds.includes(userId)) {
      userIds.push(userId);
      localStorage.setItem(ALL_USERS_KEY, JSON.stringify(userIds));
    }
  } catch (e) {
    // 무시
  }
}
