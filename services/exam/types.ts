/**
 * services/exam/types.ts
 * 상담역량 평가시험 (초·중·고급 300제) 공통 타입 정의
 */

export type ExamLevel = 'beginner' | 'intermediate' | 'advanced';

export interface TrainingExamQuestion {
  id: string; // e.g. 'beginner_1', 'intermediate_1'
  level: ExamLevel;
  round: 1 | 2 | 3 | 4;
  questionNumber: number; // 1 ~ 100
  title?: string; // 문제 소제목
  question: string;
  scenario?: string; // 상담 실제 상황 지문
  options: string[] | [string, string, string, string]; // 4지선다 보기
  correctIndex: number; // 정답 번호 (0~3)
  explanation: string; // 정답 해설
  practicalTip?: string; // 실무 통화 팁 / 추천 멘트
}

export interface ExamRoundResult {
  level: ExamLevel;
  round: 1 | 2 | 3 | 4;
  score: number; // 0 ~ 100
  correctCount: number; // 0 ~ 25
  totalCount?: number; // 25
  totalQuestions?: number; // 25
  passed: boolean; // 80점 이상
  completedAt: string; // ISO
  durationSeconds?: number;
  timeSpentSeconds: number;
  answers: Record<number, number>; // index (0~24) -> selected option (0~3)
  userAnswers?: Record<number, number>;
}

export interface LevelExamProgress {
  level: ExamLevel;
  completedRounds?: number; // 0 ~ 4
  roundResults: { [round: number]: ExamRoundResult | null | undefined };
  isMastered: boolean; // 4개 회차 모두 80점 이상 합격
  averageScore?: number;
}
