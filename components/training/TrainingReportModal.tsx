import React, { useState } from 'react';
import { TrainingReport, TrainingPersona, TrainingSessionRecord, updateAdminFeedback, AdminFeedback } from '../../services/trainingService';
import { useToast } from '../../contexts/ToastContext';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  X,
  RotateCcw,
  ArrowRight,
  Quote,
  Copy,
  Check,
  FileText,
  UserCheck,
  CheckCircle,
  XCircle,
  Briefcase,
  DollarSign,
  Users,
  Home,
  CreditCard,
  Clock,
  History,
  ShieldCheck,
} from 'lucide-react';

interface Props {
  report: TrainingReport;
  persona: TrainingPersona;
  sessionRecord: TrainingSessionRecord;
  onClose: () => void;
  onRetry: () => void;
  onNextLevel?: () => void;
  hasNextLevel: boolean;
  canGrade?: boolean;
}

export const TrainingReportModal: React.FC<Props> = ({
  report,
  persona,
  sessionRecord,
  onClose,
  onRetry,
  onNextLevel,
  hasNextLevel,
  canGrade = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [briefingCopied, setBriefingCopied] = useState(false);

  // 관리자 평가 상태
  const existingFeedback = sessionRecord.adminFeedback;
  const { showToast } = useToast();
  const [adminGrade, setAdminGrade] = useState<'S' | 'A' | 'B' | 'C' | 'F'>(existingFeedback?.grade || 'A');
  const [adminComment, setAdminComment] = useState(existingFeedback?.comment || '');
  const [adminEvaluator, setAdminEvaluator] = useState(existingFeedback?.evaluatorName || '총괄팀장');
  const [isSavedFeedback, setIsSavedFeedback] = useState(!!existingFeedback);

  const copyScript = () => {
    if (report.suggestedScript) {
      navigator.clipboard.writeText(report.suggestedScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyBriefing = () => {
    if (report.paralegalCard?.paralegalBriefing) {
      navigator.clipboard.writeText(report.paralegalCard.paralegalBriefing);
      setBriefingCopied(true);
      setTimeout(() => setBriefingCopied(false), 2000);
    }
  };

  const handleSaveAdminFeedback = async () => {
    const feedback: AdminFeedback = {
      grade: adminGrade,
      comment: adminComment.trim(),
      evaluatedAt: new Date().toISOString(),
      evaluatorName: adminEvaluator,
    };
    const result = await updateAdminFeedback(sessionRecord.sessionId, feedback);
    if (result.ok) {
      setIsSavedFeedback(true);
      sessionRecord.adminFeedback = feedback;
      showToast('팀장 코칭 피드백이 저장되었습니다.', 'success');
    } else {
      showToast(`피드백을 저장하지 못했습니다: ${result.error || ''}`, 'error');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 border-emerald-500';
    if (score >= 70) return 'text-blue-500 border-blue-500';
    if (score >= 40) return 'text-amber-500 border-amber-500';
    return 'text-rose-500 border-rose-500';
  };

  const getGradeInfo = (grade?: 'S' | 'A' | 'B' | 'C' | 'D' | 'F', score: number = 0) => {
    const finalGrade = grade || (score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 16 ? 'D' : 'F');
    switch (finalGrade) {
      case 'S':
        return { label: '🏆 [S등급] 최우수 모범 상담', bg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300' };
      case 'A':
        return { label: '✅ [A등급] 실전 인계 성공', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300' };
      case 'B':
        return { label: '⚡ [B등급] 부분 인계 가능', bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300' };
      case 'C':
        return { label: '⚠️ [C등급] 주도권 상실 (문진 부족)', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300' };
      case 'D':
        return { label: '🚫 [D등급] 거절 장벽 탈락', bg: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300' };
      case 'F':
      default:
        return { label: '❌ [F등급] 상담 미진행 (조기 종료)', bg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-300' };
    }
  };

  const paralegalCard = report.paralegalCard;

  const CHECKLIST_ITEMS = [
    { key: 'jobAndEmployment', label: '1. 직업/재직형태', icon: Briefcase, ok: paralegalCard?.jobAndEmployment },
    { key: 'monthlyRealIncome', label: '2. 월 실수령액', icon: DollarSign, ok: paralegalCard?.monthlyRealIncome },
    { key: 'dependentsCount', label: '3. 부양가족 수', icon: Users, ok: paralegalCard?.dependentsCount },
    { key: 'housingAndDeposit', label: '4. 주거/보증금', icon: Home, ok: paralegalCard?.housingAndDeposit },
    { key: 'debtAmountAndReason', label: '5. 총 채무/원인', icon: CreditCard, ok: paralegalCard?.debtAmountAndReason },
    { key: 'overdueStatusAndPeriod', label: '6. 연체여부/기간', icon: Clock, ok: paralegalCard?.overdueStatusAndPeriod },
    { key: 'pastRehabHistory', label: '7. 과거 회생이력', icon: History, ok: paralegalCard?.pastRehabHistory },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-3xl max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-card flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                AI 모의 통화 진단 & 사무장 인계 리포트
                <span className="text-2xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-normal border border-border">
                  {persona.badge}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                고객: {persona.customerName} ({persona.age}세) · 통화 시간: {Math.floor(sessionRecord.durationSeconds / 60)}분 {sessionRecord.durationSeconds % 60}초
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="창 닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar text-xs">
          {/* Score Header Card */}
          <div className="p-5 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className={`relative flex items-center justify-center w-20 h-20 rounded-full border-4 ${getScoreColor(report.totalScore)} bg-card shadow-inner`}>
                <div className="text-center">
                  <span className="text-2xl font-black font-mono tabular-nums text-foreground">{report.totalScore}</span>
                  <span className="text-2xs block text-muted-foreground font-medium">/ 100점</span>
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${getGradeInfo(report.grade, report.totalScore).bg}`}>
                    {getGradeInfo(report.grade, report.totalScore).label}
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    report.passed
                      ? 'bg-primary/15 text-primary border border-primary/25'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}>
                    {report.passed ? '🎉 실무 통과' : '통과 기준: 75점'}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {report.summary}
                </p>
              </div>
            </div>
            {paralegalCard && (
              <div className="flex flex-col items-center sm:items-end border-t sm:border-t-0 sm:border-l border-indigo-200 dark:border-indigo-900/60 pt-3 sm:pt-0 sm:pl-5">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">사무장 인계 완성도</span>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {paralegalCard.handoffScore}점
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">7대 문진 항목 기반</span>
              </div>
            )}
          </div>

          {/* 🌟 7대 사무장 인계 필수 문진 결과 섹션 */}
          {paralegalCard && (
            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    사무장 인계 7대 문진 체크리스트 판정
                  </h4>
                </div>
                <span className="text-xs text-blue-600 dark:text-blue-300 font-semibold">
                  달성: {CHECKLIST_ITEMS.filter(c => c.ok).length} / 7항목
                </span>
              </div>

              {/* 7대 항목 뱃지 그리드 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {CHECKLIST_ITEMS.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 p-2 rounded-lg text-xs font-medium border ${
                        item.ok
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                      }`}
                    >
                      {item.ok ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                      <span className="truncate">{item.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* 사무장 브리핑 요약문 카드 */}
              {paralegalCard.paralegalBriefing && (
                <div className="mt-3 p-3 rounded-xl bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-900 relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      사무장 전달용 브리핑 요약문
                    </span>
                    <button
                      onClick={copyBriefing}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-blue-600"
                    >
                      {briefingCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {briefingCopied ? '복사됨' : '복사'}
                    </button>
                  </div>
                  <pre className="text-xs font-sans text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {paralegalCard.paralegalBriefing}
                  </pre>
                  {paralegalCard.coachingAdvice && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200/60">
                      💡 <strong>인계 코칭:</strong> {paralegalCard.coachingAdvice}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Score Breakdown (3개 영역) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-gray-600 dark:text-gray-400 font-medium">🛡️ 법정 고지 준수</span>
                <span className="font-bold text-gray-900 dark:text-white">{report.complianceScore} / 30</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(report.complianceScore / 30) * 100}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">소속 법인명 및 수수료 0원 고지</p>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-gray-600 dark:text-gray-400 font-medium">👂 경청 및 니즈 파악</span>
                <span className="font-bold text-gray-900 dark:text-white">{report.listeningScore} / 30</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${(report.listeningScore / 30) * 100}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">자금 필요 시기 및 부채 질문</p>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-gray-600 dark:text-gray-400 font-medium">🎯 반론 극복 & 약속</span>
                <span className="font-bold text-gray-900 dark:text-white">{report.objectionScore} / 40</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${(report.objectionScore / 40) * 100}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">의심/거절 극복 및 콜백 성사</p>
            </div>
          </div>

          {/* 🎧 실전 통화 녹취 분석 기반 3대 특화 역량 평가 */}
          {(report.coldDbOpeningScore !== undefined || report.objectionDefenseScore !== undefined || report.pacingControlScore !== undefined) && (
            <div className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  실전 콜(Cold DB) 3대 핵심 역량 진단
                </span>
                <span className="text-xs text-indigo-500 font-medium">녹취 274건 비교 분석</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-2.5 rounded-xl bg-white/80 dark:bg-gray-900/60 border border-indigo-100 dark:border-indigo-900 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">🧊 Cold DB 출처 돌파</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{report.coldDbOpeningScore || 70}점</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${report.coldDbOpeningScore || 70}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">15초 내 의심·적대감 불식 및 안심</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/80 dark:bg-gray-900/60 border border-indigo-100 dark:border-indigo-900 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">❓ 질문/반론 방어력</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">{report.objectionDefenseScore || 70}점</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${report.objectionDefenseScore || 70}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">신용도/수임료/가족비밀 안심 방어</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/80 dark:bg-gray-900/60 border border-indigo-100 dark:border-indigo-900 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">⏱️ 신세한탄 완급 조절</span>
                    <span className="font-bold text-teal-600 dark:text-teal-400">{report.pacingControlScore || 70}점</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${report.pacingControlScore || 70}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">경청 공감 후 30초 내 주도권 전환</p>
                </div>
              </div>
            </div>
          )}

          {/* Strengths & Weaknesses */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
              <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 mb-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                특별히 잘한 점 (Strengths)
              </h4>
              <ul className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                {report.strengths.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold shrink-0">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
              <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                보완이 필요한 점 (Focus Areas)
              </h4>
              <ul className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                {report.weaknesses.map((w, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-500 font-bold shrink-0">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* AI One-Point Coaching Tips */}
          {report.coachingTips.length > 0 && (
            <div className="p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
              <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5 mb-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                AI 원포인트 코칭 팁
              </h4>
              <ul className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                {report.coachingTips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Best Practice Script Recommendation */}
          {report.suggestedScript && (
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Quote className="w-3.5 h-3.5 text-blue-500" />
                  우수 상담원의 추천 모범 스크립트
                </span>
                <button
                  onClick={copyScript}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-blue-600 border border-gray-200 dark:border-gray-700 shadow-xs"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  {copied ? '복사됨' : '복사'}
                </button>
              </div>
              <p className="text-xs leading-relaxed text-gray-800 dark:text-gray-200 italic bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                "{report.suggestedScript}"
              </p>
            </div>
          )}

          {/* 👔 관리자(팀장) 직접 평가 및 코칭 피드백 섹션 */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/60 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200 dark:border-amber-900/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  관리자(팀장) 직접 평가 및 코칭 피드백
                </h4>
              </div>
              {isSavedFeedback && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> 평가 저장됨
                </span>
              )}
            </div>

            {canGrade ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">평가 등급:</span>
                    {(['S', 'A', 'B', 'C', 'F'] as const).map(grade => (
                      <button
                        key={grade}
                        onClick={() => { setAdminGrade(grade); setIsSavedFeedback(false); }}
                        className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                          adminGrade === grade
                            ? 'bg-amber-500 text-white shadow-sm scale-105'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-amber-50'
                        }`}
                      >
                        {grade}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs text-gray-500 dark:text-gray-400">평가자:</span>
                    <input
                      type="text"
                      value={adminEvaluator}
                      onChange={e => { setAdminEvaluator(e.target.value); setIsSavedFeedback(false); }}
                      className="w-24 text-xs px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                    />
                  </div>
                </div>

                <textarea
                  value={adminComment}
                  onChange={e => { setAdminComment(e.target.value); setIsSavedFeedback(false); }}
                  placeholder="신입 상담원에게 전달할 팀장의 직접 코칭 조언을 입력하세요. (예: 보이스피싱 의심 시 당황하지 말고 3대 무과금 원칙을 먼저 단호히 짚어줄 것)"
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-900/80 focus:ring-1 focus:ring-amber-500 focus:outline-none placeholder-gray-400"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveAdminFeedback}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-all"
                  >
                    팀장 평가 & 피드백 저장
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {existingFeedback ? (
                  <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">평가 등급:</span>
                        <span className={`px-2 py-0.5 rounded font-black text-xs ${
                          existingFeedback.grade === 'S' ? 'bg-amber-100 text-amber-800' :
                          existingFeedback.grade === 'A' ? 'bg-emerald-100 text-emerald-800' :
                          existingFeedback.grade === 'B' ? 'bg-blue-100 text-blue-800' :
                          existingFeedback.grade === 'C' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {existingFeedback.grade}등급
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        평가자: {existingFeedback.evaluatorName || '관리자'} ({new Date(existingFeedback.evaluatedAt).toLocaleDateString()})
                      </span>
                    </div>
                    <div className="text-gray-800 dark:text-gray-200 font-medium whitespace-pre-wrap leading-relaxed">
                      {existingFeedback.comment || '등록된 코칭 코멘트가 없습니다.'}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-center text-gray-500">
                    아직 관리자(팀장)의 모의 훈련 평가 등급 및 코칭 피드백이 등록되지 않았습니다.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-card border-t border-border flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border transition-colors shadow-2xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            이 시나리오 다시 연습
          </button>

          <div className="flex items-center gap-2">
            {hasNextLevel && onNextLevel && (
              <button
                onClick={onNextLevel}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 shadow-2xs transition-colors cursor-pointer"
              >
                다음 난이도 도전
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border transition-colors cursor-pointer shadow-2xs"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
