import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ExamLevel,
  TrainingExamQuestion,
  ExamRoundResult,
  LevelExamProgress,
  getQuestionsByLevelAndRound,
  loadLevelExamProgress,
  saveExamRoundResult,
  resetLevelExamProgress,
} from '../../services/trainingExamBank';
import { useToast } from '../../contexts/ToastContext';
import {
  GraduationCap,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Award,
  Trophy,
  Copy,
  Check,
  Play,
  FileText,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Sparkles,
  Zap,
} from 'lucide-react';

const ROUND_DESCRIPTIONS: {
  [level in ExamLevel]: { [round: number]: { title: string; desc: string; tag: string } };
} = {
  beginner: {
    1: {
      title: '인입 채널 & 비밀보장 & 초기 라포 형성',
      desc: '자가진단 인입 고객의 첫인사, 가족/직장 100% 비밀보장 확약 및 기초 신뢰 형성',
      tag: '기초 라포',
    },
    2: {
      title: '사무장 인계를 위한 3대 기초 문진',
      desc: '월 실소득, 총 채무액(원금/이자), 최근 부양가족 수 핵심 3대 항목 정밀 파악',
      tag: '핵심 문진',
    },
    3: {
      title: '개인회생 vs 파산 vs 신복위 기본 제도 구분',
      desc: '소득 유무, 채무 종류, 최소 부채 기준에 따른 최적 제도 안내 및 오해 불식',
      tag: '제도 구분',
    },
    4: {
      title: '불안/망설임 돌파 & 초기 통화 클로징',
      desc: '"가족에게 들킬까봐", "신용불량자 될까봐" 등 초기 고객 저항을 허무는 화법',
      tag: '초기 클로징',
    },
  },
  intermediate: {
    1: {
      title: '법원 관할지 결정 기준 및 서울 특례 전략',
      desc: '실거주지 vs 직장 관할 선택, 서울회생법원 준칙 및 수원/부산 전문 법원 실무',
      tag: '법원 관할',
    },
    2: {
      title: '최근 채무 소명 및 대환/카드 돌려막기 대처',
      desc: '최근 1년 이내 대출금 사용처 소명, 편파변제 방어, 단기 연체 진입 건 대응법',
      tag: '최근 채무',
    },
    3: {
      title: '주식·코인·도박 채무와 청산가치/변제율',
      desc: '서울 준칙 408호(손실금 미반영), 도박 채무 반성문 및 현실적 변제율 산정',
      tag: '사행성 채무',
    },
    4: {
      title: '급여/통장 압류 방어, 중지명령 및 보증인 대책',
      desc: '금지/중지명령 차이, 급여 압류 적립금 처리, 불법 추심 차단 및 보증인 보호',
      tag: '강제집행 방어',
    },
  },
  advanced: {
    1: {
      title: '자영업자/프리랜서 부가세·종소세 소득 정밀 산정',
      desc: '단순/기준경비율, 신규 개업자 추정, 미신고 인건비 및 임차료 필요경비 공제',
      tag: '사업 소득',
    },
    2: {
      title: '중위소득 60% 생계비 및 부양가족 정밀 인정',
      desc: '미성년/고령 부모 부양 요건, 맞벌이 안분, 추가 생계비(주거비/의료비) 확보',
      tag: '생계비 최적화',
    },
    3: {
      title: '청산가치 보장의 원칙 (부동산·보증금·보험·퇴직금)',
      desc: '소액임차보증금 공제, 배우자 재산 준칙 406호, DC형 퇴직연금 0원 반영 전략',
      tag: '청산가치 방어',
    },
    4: {
      title: '불법 사채 강력 방어 및 사무장 즉시 이관 킬러 클로징',
      desc: '30-50 사채 차단, 대리인 선임 통지, 고액/긴급 경매 건 사무장 토스 및 당일 계약',
      tag: '마스터 클로징',
    },
  },
};

export const ExamSection: React.FC = () => {
  const { addToast } = useToast();

  // 화면 모드 및 선택 상태
  const [selectedLevel, setSelectedLevel] = useState<ExamLevel>('beginner');
  const [activeRound, setActiveRound] = useState<1 | 2 | 3 | 4>(1);
  const [viewMode, setViewMode] = useState<'lobby' | 'exam' | 'result'>('lobby');

  // 진행도 데이터
  const [progress, setProgress] = useState<LevelExamProgress>(() =>
    loadLevelExamProgress('beginner')
  );

  // 시험 진행 중 상태
  const [questions, setQuestions] = useState<TrainingExamQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<{ [qIndex: number]: number }>({});
  const [timeLeft, setTimeLeft] = useState<number>(1200); // 20분 (1200초)
  const [startTime, setStartTime] = useState<number>(0);

  // 결과 화면 상태
  const [lastResult, setLastResult] = useState<ExamRoundResult | null>(null);
  const [resultFilter, setResultFilter] = useState<'all' | 'wrong' | 'correct'>('all');
  const [copiedTipId, setCopiedTipId] = useState<string | null>(null);

  // 레벨 변경 시 진행도 갱신
  useEffect(() => {
    setProgress(loadLevelExamProgress(selectedLevel));
  }, [selectedLevel]);

  // 타이머 효과
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (viewMode === 'exam' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer!);
            // 시간 초과 자동 제출
            handleSubmitExam(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [viewMode, timeLeft]);

  // 시험 시작 핸들러
  const handleStartExam = (round: 1 | 2 | 3 | 4) => {
    const roundQs = getQuestionsByLevelAndRound(selectedLevel, round);
    if (!roundQs || roundQs.length === 0) {
      addToast('해당 회차의 문항을 불러올 수 없습니다.', 'error');
      return;
    }

    setActiveRound(round);
    setQuestions(roundQs);
    setCurrentQIndex(0);
    setUserAnswers({});
    setTimeLeft(1200); // 20분 리셋
    setStartTime(Date.now());
    setViewMode('exam');
  };

  // 기존 시험 결과 확인 핸들러
  const handleViewExistingResult = (round: 1 | 2 | 3 | 4) => {
    const existing = progress.roundResults[round];
    if (!existing) {
      addToast('응시 이력이 없습니다. 시험을 먼저 진행해 주세요.', 'info');
      return;
    }
    const roundQs = getQuestionsByLevelAndRound(selectedLevel, round);
    setActiveRound(round);
    setQuestions(roundQs);
    setLastResult(existing);
    setResultFilter('all');
    setViewMode('result');
  };

  // 답안 선택 핸들러
  const handleSelectOption = (optIndex: number) => {
    setUserAnswers((prev) => ({
      ...prev,
      [currentQIndex]: optIndex,
    }));
  };

  // 시험 답안 제출 핸들러
  const handleSubmitExam = (isTimeOut = false) => {
    const totalCount = questions.length;
    const answeredCount = Object.keys(userAnswers).length;

    if (!isTimeOut && answeredCount < totalCount) {
      const remaining = totalCount - answeredCount;
      const confirmSubmit = window.confirm(
        `아직 풀지 않은 문제가 ${remaining}문항 남아있습니다.\n정말 이대로 답안을 제출하시겠습니까?`
      );
      if (!confirmSubmit) return;
    }

    // 채점 진행
    let correctCount = 0;
    const checkedAnswers: { [qIndex: number]: number } = {};

    questions.forEach((q, idx) => {
      const selected = userAnswers[idx];
      if (selected !== undefined) {
        checkedAnswers[idx] = selected;
        if (selected === q.correctIndex) {
          correctCount++;
        }
      } else {
        checkedAnswers[idx] = -1; // 미응시
      }
    });

    const score = Math.round((correctCount / totalCount) * 100);
    const passed = score >= 80;
    const timeSpentSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));

    const resultData: ExamRoundResult = {
      level: selectedLevel,
      round: activeRound,
      score,
      passed,
      totalQuestions: totalCount,
      correctCount,
      answers: checkedAnswers,
      completedAt: new Date().toISOString(),
      timeSpentSeconds,
    };

    saveExamRoundResult(resultData);
    setProgress(loadLevelExamProgress(selectedLevel));
    setLastResult(resultData);
    setResultFilter('all');
    setViewMode('result');

    if (passed) {
      addToast(`🎉 축하합니다! ${score}점으로 합격하셨습니다!`, 'success');
    } else {
      addToast(`⚠️ ${score}점입니다. 80점 이상이어야 합격입니다. 오답 노트를 복습하세요.`, 'info');
    }
  };

  // 팁 복사 핸들러
  const handleCopyTip = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTipId(id);
    addToast('🎯 실전 상담 추천 멘트가 복사되었습니다.', 'success');
    setTimeout(() => setCopiedTipId(null), 2500);
  };

  // 등급 초기화 핸들러
  const handleResetProgress = () => {
    const levelName =
      selectedLevel === 'beginner' ? '초급' : selectedLevel === 'intermediate' ? '중급' : '고급';
    if (
      window.confirm(
        `정말로 ${levelName} 난이도의 모든 회차 시험 기록을 초기화하시겠습니까?\n마스터 인증 상태가 해제됩니다.`
      )
    ) {
      resetLevelExamProgress(selectedLevel);
      setProgress(loadLevelExamProgress(selectedLevel));
      addToast(`${levelName} 난이도 시험 기록이 초기화되었습니다.`, 'info');
    }
  };

  // 시간 포맷 (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 필터링된 결과 문항 리스트
  const filteredResultQuestions = useMemo(() => {
    if (!lastResult || questions.length === 0) return [];
    return questions.filter((q, idx) => {
      const myAns = lastResult.answers[idx];
      const isCorrect = myAns === q.correctIndex;
      if (resultFilter === 'wrong') return !isCorrect;
      if (resultFilter === 'correct') return isCorrect;
      return true;
    });
  }, [lastResult, questions, resultFilter]);

  // ==========================================
  // VIEW 1: LOBBY (시험 대기실 / 회차 선택)
  // ==========================================
  if (viewMode === 'lobby') {
    return (
      <div className="space-y-6">
        {/* 상단 네비게이션 및 안내 헤더 */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden border border-indigo-700/50">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-amber-400 text-gray-950 text-xs font-black tracking-wider uppercase flex items-center gap-1 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 fill-gray-950" />
                  EVALUATION TEST
                </span>
                <span className="text-xs text-indigo-300 font-medium">
                  총 300문항 · 회차당 25제 · 4지선다형 객관식
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                <GraduationCap className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                <span>개인회생·파산 실전 상담역량 평가시험 센터</span>
              </h2>
              <p className="text-xs md:text-sm text-indigo-200/80 max-w-2xl leading-relaxed">
                실제 고객 통화에서 마주치는 생생한 상황을 4지선다형으로 검증합니다.
                회차당 25문항 중 <strong>80점(20문제) 이상</strong> 맞히셔야 합격 처리되며, 4개 회차를 모두 통과하면 <strong>최종 마스터 인증</strong>을 획득합니다.
              </p>
            </div>

            {/* 마스터 인증 뱃지 상태 카드 */}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shrink-0">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  progress.isMastered
                    ? 'bg-amber-400 text-gray-950 shadow-lg shadow-amber-400/30'
                    : 'bg-white/10 text-white/50'
                }`}
              >
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-indigo-300 font-medium">
                  {selectedLevel === 'beginner'
                    ? '초급 레벨'
                    : selectedLevel === 'intermediate'
                    ? '중급 레벨'
                    : '고급 레벨'}{' '}
                  종합 상태
                </div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  {progress.isMastered ? (
                    <span className="text-amber-300 flex items-center gap-1">
                      <Award className="w-4 h-4" /> 최종 마스터 달성
                    </span>
                  ) : (
                    <span className="text-gray-300">
                      진행 중 ({Object.values(progress.roundResults).filter((r: ExamRoundResult | null | undefined) => !!r?.passed).length}/4 합격)
                    </span>
                  )}
                </div>
                {(progress.averageScore ?? 0) > 0 && (
                  <div className="text-xs text-indigo-200">
                    평균 점수: <span className="font-bold text-white">{progress.averageScore}점</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 난이도 선택 탭 (초급 / 중급 / 고급) */}
          <div className="mt-6 pt-5 border-t border-indigo-800/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10">
              <button
                onClick={() => setSelectedLevel('beginner')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
                  selectedLevel === 'beginner'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>🌱 초급 (기초 상담 가능 · 100제)</span>
              </button>

              <button
                onClick={() => setSelectedLevel('intermediate')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
                  selectedLevel === 'intermediate'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>⚡ 중급 (막힘없는 상담 · 100제)</span>
              </button>

              <button
                onClick={() => setSelectedLevel('advanced')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
                  selectedLevel === 'advanced'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>👑 고급 (숙달된 전문가 · 100제)</span>
              </button>
            </div>

            <button
              onClick={handleResetProgress}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 transition-all border border-rose-500/30"
              title="이 난이도의 모든 응시 기록 초기화"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>기록 초기화</span>
            </button>
          </div>
        </div>

        {/* 4개 회차(Round 1~4) 선택 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {([1, 2, 3, 4] as const).map((rNum) => {
            const rInfo = ROUND_DESCRIPTIONS[selectedLevel][rNum];
            const rResult = progress.roundResults[rNum];
            const isPassed = rResult?.passed;
            const hasTaken = !!rResult;

            return (
              <div
                key={rNum}
                className={`p-6 rounded-3xl border transition-all duration-200 flex flex-col justify-between ${
                  isPassed
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 shadow-sm'
                    : hasTaken
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 shadow-sm'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md'
                }`}
              >
                <div className="space-y-4">
                  {/* 회차 상단 뱃지 및 점수 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                        ROUND 0{rNum}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {rInfo.tag}
                      </span>
                    </div>

                    {/* 응시 결과 뱃지 */}
                    {hasTaken ? (
                      isPassed ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-black shadow-sm">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{rResult.score}점 합격</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-black shadow-sm">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{rResult.score}점 (재도전)</span>
                        </div>
                      )
                    ) : (
                      <span className="text-xs text-gray-400 font-medium">미응시 (25제)</span>
                    )}
                  </div>

                  {/* 회차 제목 및 설명 */}
                  <div>
                    <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white leading-snug">
                      제 {rNum}회차: {rInfo.title}
                    </h3>
                    <p className="mt-1.5 text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                      {rInfo.desc}
                    </p>
                  </div>

                  {/* 문항 범위 및 시험 안내 */}
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/80 border border-gray-100 dark:border-gray-700/60 text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between font-medium">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>제한시간 20분 · 25문항</span>
                    </div>
                    <span>문항 번호: {(rNum - 1) * 25 + 1}번 ~ {rNum * 25}번</span>
                  </div>
                </div>

                {/* 하단 액션 버튼 */}
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/60 flex items-center gap-2.5">
                  <button
                    onClick={() => handleStartExam(rNum)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs md:text-sm font-bold text-white shadow-md active:scale-95 transition-all ${
                      isPassed
                        ? 'bg-gray-700 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600'
                        : hasTaken
                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                    }`}
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>{hasTaken ? (isPassed ? '다시 시험보기' : '재도전하기') : '시험 시작하기'}</span>
                  </button>

                  {hasTaken && (
                    <button
                      onClick={() => handleViewExistingResult(rNum)}
                      className="px-4 py-3 rounded-2xl text-xs md:text-sm font-bold bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all flex items-center gap-1.5"
                    >
                      <FileText className="w-4 h-4" />
                      <span>오답노트</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: EXAM (시험 응시 중 화면)
  // ==========================================
  if (viewMode === 'exam') {
    const currentQ = questions[currentQIndex];
    const totalQ = questions.length;
    const answeredCount = Object.keys(userAnswers).length;
    const isUrgent = timeLeft < 180; // 3분 미만

    return (
      <div className="space-y-6">
        {/* 상단 컨트롤 바 (타이머, 진척도, 제출 버튼) */}
        <div className="p-4 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 sticky top-4 z-20 backdrop-blur-md bg-white/95 dark:bg-gray-800/95">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => {
                if (window.confirm('시험을 중단하고 대기실로 돌아가시겠습니까? 작성 중인 답안은 저장되지 않습니다.')) {
                  setViewMode('lobby');
                }
              }}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
              title="시험 나가기"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  {selectedLevel === 'beginner'
                    ? '초급'
                    : selectedLevel === 'intermediate'
                    ? '중급'
                    : '고급'}{' '}
                  제 {activeRound}회차
                </span>
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  진행 문항: {currentQIndex + 1} / {totalQ}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                마킹 완료: <span className="font-bold text-indigo-600 dark:text-indigo-400">{answeredCount}</span> / {totalQ}
              </div>
            </div>
          </div>

          {/* 중앙 잔여 시간 카운트다운 */}
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl border font-mono text-base font-black transition-all ${
              isUrgent
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400 animate-pulse'
                : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
            }`}
          >
            <Clock className={`w-4 h-4 ${isUrgent ? 'text-rose-500' : 'text-gray-500'}`} />
            <span>남은 시간 {formatTime(timeLeft)}</span>
          </div>

          {/* 답안 제출 버튼 */}
          <button
            onClick={() => handleSubmitExam(false)}
            className="w-full md:w-auto px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs md:text-sm font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>답안 제출 및 채점</span>
          </button>
        </div>

        {/* 2-Column 본문: 좌측(문제 풀이창) + 우측(OMR 마킹판) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* 좌측 3칸: 문제 카드 */}
          <div className="lg:col-span-3 space-y-6">
            <div className="p-6 md:p-8 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
              {/* 문제 헤더 */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white text-sm font-black flex items-center justify-center shadow-sm">
                    Q{currentQIndex + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {currentQ.title}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      전체 {selectedLevel} 평가 중 제 {currentQ.questionNumber}번 문항
                    </span>
                  </div>
                </div>

                <div className="text-xs text-gray-400">
                  배점: <span className="font-bold text-gray-700 dark:text-gray-300">4점</span>
                </div>
              </div>

              {/* [실전 인입 상황 / 고객 통화 시나리오] */}
              <div className="p-4 md:p-5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                  <MessageSquare className="w-4 h-4" />
                  <span>실전 고객 상황 및 인입 문의</span>
                </div>
                <p className="text-sm md:text-base text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                  "{currentQ.scenario}"
                </p>
              </div>

              {/* 핵심 질문 문장 */}
              <div className="text-base md:text-lg font-extrabold text-gray-900 dark:text-white leading-snug">
                {currentQ.question}
              </div>

              {/* 4지선다형 보기 4개 */}
              <div className="space-y-3 pt-2">
                {currentQ.options.map((optionText, optIdx) => {
                  const isSelected = userAnswers[currentQIndex] === optIdx;
                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleSelectOption(optIdx)}
                      className={`w-full text-left p-4 md:p-5 rounded-2xl border transition-all flex items-start gap-3.5 group ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-600 dark:border-indigo-500 shadow-sm ring-2 ring-indigo-600/20'
                          : 'bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-gray-50/80 dark:hover:bg-gray-750'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 group-hover:text-indigo-600'
                        }`}
                      >
                        {optIdx + 1}
                      </div>
                      <div
                        className={`text-xs md:text-sm leading-relaxed ${
                          isSelected
                            ? 'text-indigo-950 dark:text-indigo-200 font-bold'
                            : 'text-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {optionText}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 하단 네비게이션 버튼 (이전 / 다음) */}
              <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
                <button
                  onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQIndex === 0}
                  className="px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>이전 문항</span>
                </button>

                {currentQIndex < totalQ - 1 ? (
                  <button
                    onClick={() => setCurrentQIndex((prev) => Math.min(totalQ - 1, prev + 1))}
                    className="px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <span>다음 문항</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubmitExam(false)}
                    className="px-6 py-2.5 rounded-xl text-xs md:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>최종 답안 제출하기</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 우측 1칸: 25문항 OMR 마킹판 */}
          <div className="lg:col-span-1 space-y-4 sticky top-28">
            <div className="p-5 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>OMR 마킹 현황</span>
                </h4>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {answeredCount} / {totalQ} 완료
                </span>
              </div>

              {/* 5x5 그리드 번호판 */}
              <div className="grid grid-cols-5 gap-2">
                {questions.map((_, idx) => {
                  const isMarked = userAnswers[idx] !== undefined;
                  const isCurrent = currentQIndex === idx;

                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentQIndex(idx)}
                      className={`h-9 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center relative ${
                        isCurrent
                          ? 'ring-2 ring-indigo-600 ring-offset-2 dark:ring-offset-gray-800 font-black'
                          : ''
                      } ${
                        isMarked
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <span>{idx + 1}</span>
                      {isMarked && (
                        <span className="text-xs opacity-80 leading-none">
                          {userAnswers[idx] + 1}번
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 범례 */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-around text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-md bg-indigo-600" />
                  <span>마킹완료</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-md bg-gray-200 dark:bg-gray-700" />
                  <span>미마킹</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-md border-2 border-indigo-600" />
                  <span>현재</span>
                </div>
              </div>

              {/* 최종 제출 바로가기 */}
              <button
                onClick={() => handleSubmitExam(false)}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>답안 최종 제출</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: RESULT (채점 결과 및 오답노트 리포트)
  // ==========================================
  if (viewMode === 'result' && lastResult) {
    const isPassed = lastResult.passed;
    const minutes = Math.floor(lastResult.timeSpentSeconds / 60);
    const seconds = lastResult.timeSpentSeconds % 60;

    return (
      <div className="space-y-6">
        {/* 상단 성적표 배너 */}
        <div
          className={`p-6 md:p-8 rounded-3xl border shadow-xl relative overflow-hidden ${
            isPassed
              ? 'bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 text-white border-emerald-600/50'
              : 'bg-gradient-to-br from-amber-950 via-slate-900 to-gray-900 text-white border-amber-600/50'
          }`}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-1 ${
                    isPassed ? 'bg-emerald-400 text-gray-950' : 'bg-amber-400 text-gray-950'
                  }`}
                >
                  {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {isPassed ? 'TEST PASSED' : 'TEST FAILED'}
                </span>
                <span className="text-xs text-gray-300">
                  {selectedLevel.toUpperCase()} ROUND 0{activeRound} 채점 완료
                </span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                {isPassed ? '🎉 합격을 축하합니다!' : '⚠️ 조금 더 보완이 필요합니다!'}
              </h2>
              <p className="text-xs md:text-sm text-gray-300 max-w-xl leading-relaxed">
                {isPassed
                  ? '기준 점수(80점)를 달성하여 해당 회차를 정식 마스터하셨습니다. 실전 고객 상담에 바로 적용 가능한 실무 지식을 갖추셨습니다.'
                  : '합격 기준은 80점(20문제 이상 정답)입니다. 아래 오답 노트의 [실무 해설]과 [실전 멘트]를 복습하신 후 재도전해 주세요.'}
              </p>
            </div>

            {/* 대형 점수 카드 */}
            <div className="flex items-center gap-5 p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shrink-0">
              <div className="text-center">
                <div className="text-xs text-gray-300 font-medium">최종 획득 점수</div>
                <div className="text-4xl md:text-5xl font-black text-white mt-1">
                  {lastResult.score}
                  <span className="text-lg font-normal text-gray-300"> / 100</span>
                </div>
              </div>

              <div className="h-12 w-px bg-white/20" />

              <div className="text-xs space-y-1 text-gray-300">
                <div>
                  정답 문항: <span className="font-bold text-white">{lastResult.correctCount} / 25개</span>
                </div>
                <div>
                  소요 시간:{' '}
                  <span className="font-bold text-white">
                    {minutes > 0 ? `${minutes}분 ` : ''}
                    {seconds}초
                  </span>
                </div>
                <div>
                  기준 합격선: <span className="font-bold text-amber-300">80점 이상</span>
                </div>
              </div>
            </div>
          </div>

          {/* 하단 액션 버튼 바 */}
          <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setViewMode('lobby')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs md:text-sm font-bold transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>시험 로비로 돌아가기</span>
            </button>

            <button
              onClick={() => handleStartExam(activeRound)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-gray-950 text-xs md:text-sm font-bold shadow-md transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>이 회차 다시 시험보기</span>
            </button>
          </div>
        </div>

        {/* 오답노트 필터 탭 */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setResultFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                resultFilter === 'all'
                  ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              전체 25문항 보기
            </button>
            <button
              onClick={() => setResultFilter('wrong')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                resultFilter === 'wrong'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-rose-500'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>틀린 문제만 보기 ({25 - lastResult.correctCount}개)</span>
            </button>
            <button
              onClick={() => setResultFilter('correct')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                resultFilter === 'correct'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-emerald-500'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>맞은 문제만 보기 ({lastResult.correctCount}개)</span>
            </button>
          </div>

          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
            총 {filteredResultQuestions.length}개 문항 표시 중
          </span>
        </div>

        {/* 25문항 오답노트 카드 리스트 */}
        <div className="space-y-5">
          {filteredResultQuestions.map((q) => {
            const originalIndex = questions.findIndex((item) => item.id === q.id);
            const myAns = lastResult.answers[originalIndex];
            const isCorrect = myAns === q.correctIndex;

            return (
              <div
                key={q.id}
                className={`p-6 rounded-3xl border transition-all ${
                  isCorrect
                    ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    : 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 shadow-sm'
                }`}
              >
                {/* 문항 헤더 */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700/60">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-7 h-7 rounded-xl text-xs font-black flex items-center justify-center text-white ${
                        isCorrect ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    >
                      Q{originalIndex + 1}
                    </span>
                    <h4 className="text-base font-bold text-gray-900 dark:text-white">
                      {q.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCorrect ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" /> 정답 (+4점)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                        <XCircle className="w-4 h-4" /> 오답 (0점)
                      </span>
                    )}
                  </div>
                </div>

                {/* 고객 상황 시나리오 */}
                <div className="mt-4 p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 text-xs text-gray-700 dark:text-gray-300 font-medium">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 mr-1.5">[상황]</span>
                  "{q.scenario}"
                </div>

                {/* 질문 */}
                <div className="mt-3 text-sm md:text-base font-bold text-gray-900 dark:text-white">
                  {q.question}
                </div>

                {/* 4개 보기 및 채점 결과 */}
                <div className="mt-4 space-y-2">
                  {q.options.map((opt, optIdx) => {
                    const isMyPick = myAns === optIdx;
                    const isTheAnswer = q.correctIndex === optIdx;

                    let optStyle =
                      'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300';
                    let badge = null;

                    if (isTheAnswer) {
                      optStyle =
                        'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold';
                      badge = (
                        <span className="px-2 py-0.5 rounded-md text-xs bg-emerald-600 text-white font-black shrink-0">
                          정답
                        </span>
                      );
                    } else if (isMyPick && !isCorrect) {
                      optStyle =
                        'bg-rose-50 dark:bg-rose-950/40 border-rose-500 dark:border-rose-500 text-rose-900 dark:text-rose-200 line-through';
                      badge = (
                        <span className="px-2 py-0.5 rounded-md text-xs bg-rose-600 text-white font-black shrink-0">
                          내 선택 (오답)
                        </span>
                      );
                    }

                    return (
                      <div
                        key={optIdx}
                        className={`p-3 rounded-2xl border text-xs md:text-sm flex items-center justify-between gap-3 ${optStyle}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold opacity-70">{optIdx + 1}.</span>
                          <span>{opt}</span>
                        </div>
                        {badge}
                      </div>
                    );
                  })}
                </div>

                {/* [💡 실무 해설] 카드 */}
                <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-xs md:text-sm text-gray-800 dark:text-gray-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                    <Lightbulb className="w-4 h-4" />
                    <span>💡 실무 핵심 해설</span>
                  </div>
                  <p className="leading-relaxed text-gray-700 dark:text-gray-300">
                    {q.explanation}
                  </p>
                </div>

                {/* [🎯 실전 상담 추천 멘트] 카드 */}
                <div className="mt-3 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>🎯 실전 통화 추천 멘트</span>
                    </div>
                    <p className="text-xs md:text-sm text-indigo-950 dark:text-indigo-200 font-semibold leading-relaxed">
                      "{q.practicalTip}"
                    </p>
                  </div>

                  <button
                    onClick={() => handleCopyTip(q.practicalTip, q.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-gray-700 transition-all shadow-sm shrink-0"
                  >
                    {copiedTipId === q.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500">복사 완료</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>멘트 복사</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};
