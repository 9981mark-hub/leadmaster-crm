import { ExamLevel, ExamRoundResult, LevelExamProgress, TrainingExamQuestion } from './exam/types';
import { BEGINNER_QUESTIONS } from './exam/beginnerQuestions';
import { INTERMEDIATE_QUESTIONS } from './exam/intermediateQuestions';
import { ADVANCED_QUESTIONS } from './exam/advancedQuestions';

export * from './exam/types';
export { BEGINNER_QUESTIONS } from './exam/beginnerQuestions';
export { INTERMEDIATE_QUESTIONS } from './exam/intermediateQuestions';
export { ADVANCED_QUESTIONS } from './exam/advancedQuestions';

const STORAGE_KEY_PREFIX = 'lm_training_exam_results_v1';

/**
 * 특정 난이도와 회차(Round 1~4)에 해당하는 25문항을 반환합니다.
 */
export function getQuestionsByLevelAndRound(
  level: ExamLevel,
  round: 1 | 2 | 3 | 4
): TrainingExamQuestion[] {
  let source: TrainingExamQuestion[] = [];
  if (level === 'beginner') {
    source = BEGINNER_QUESTIONS;
  } else if (level === 'intermediate') {
    source = INTERMEDIATE_QUESTIONS;
  } else {
    source = ADVANCED_QUESTIONS;
  }

  return source.filter((q) => q.round === round);
}

/**
 * 특정 난이도의 100문항 전체를 반환합니다.
 */
export function getAllQuestionsByLevel(level: ExamLevel): TrainingExamQuestion[] {
  if (level === 'beginner') return BEGINNER_QUESTIONS;
  if (level === 'intermediate') return INTERMEDIATE_QUESTIONS;
  return ADVANCED_QUESTIONS;
}

/**
 * 시험 응시 결과를 로컬스토리지에 저장합니다.
 */
export function saveExamRoundResult(result: ExamRoundResult): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}_${result.level}_round_${result.round}`;
    localStorage.setItem(key, JSON.stringify(result));
  } catch (e) {
    console.error('Failed to save exam round result:', e);
  }
}

/**
 * 특정 난이도 및 회차의 최근 시험 결과를 불러옵니다.
 */
export function loadExamRoundResult(
  level: ExamLevel,
  round: 1 | 2 | 3 | 4
): ExamRoundResult | null {
  try {
    const key = `${STORAGE_KEY_PREFIX}_${level}_round_${round}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as ExamRoundResult;
  } catch (e) {
    console.error('Failed to load exam round result:', e);
    return null;
  }
}

/**
 * 난이도별 4개 회차(Round 1~4)의 종합 진행도 및 마스터 여부를 계산합니다.
 */
export function loadLevelExamProgress(level: ExamLevel): LevelExamProgress {
  const roundResults: { [round: number]: ExamRoundResult | null } = {};
  let totalScore = 0;
  let takenRoundsCount = 0;
  let allPassed = true;

  for (let r = 1; r <= 4; r++) {
    const res = loadExamRoundResult(level, r as 1 | 2 | 3 | 4);
    roundResults[r] = res;
    if (res) {
      takenRoundsCount++;
      totalScore += res.score;
      if (!res.passed) {
        allPassed = false;
      }
    } else {
      allPassed = false;
    }
  }

  const averageScore = takenRoundsCount > 0 ? Math.round(totalScore / takenRoundsCount) : 0;
  const isMastered = takenRoundsCount === 4 && allPassed;

  return {
    level,
    roundResults,
    isMastered,
    averageScore,
  };
}

/**
 * 특정 난이도의 시험 기록을 초기화합니다.
 */
export function resetLevelExamProgress(level: ExamLevel): void {
  try {
    for (let r = 1; r <= 4; r++) {
      const key = `${STORAGE_KEY_PREFIX}_${level}_round_${r}`;
      localStorage.removeItem(key);
    }
  } catch (e) {
    console.error('Failed to reset level exam progress:', e);
  }
}
