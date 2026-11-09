import React from 'react';
import { TrainingReport, TrainingPersona, TrainingSessionRecord } from '../../services/trainingService';
import { Award, CheckCircle2, AlertTriangle, Lightbulb, Sparkles, X, RotateCcw, ArrowRight, Quote, Copy, Check } from 'lucide-react';

interface Props {
  report: TrainingReport;
  persona: TrainingPersona;
  sessionRecord: TrainingSessionRecord;
  onClose: () => void;
  onRetry: () => void;
  onNextLevel?: () => void;
  hasNextLevel: boolean;
}

export const TrainingReportModal: React.FC<Props> = ({
  report,
  persona,
  sessionRecord,
  onClose,
  onRetry,
  onNextLevel,
  hasNextLevel,
}) => {
  const [copied, setCopied] = React.useState(false);

  const copyScript = () => {
    if (report.suggestedScript) {
      navigator.clipboard.writeText(report.suggestedScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 border-emerald-500';
    if (score >= 70) return 'text-blue-500 border-blue-500';
    return 'text-amber-500 border-amber-500';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                AI 모의 통화 진단 & 코칭 리포트
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-normal">
                  {persona.badge}
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                고객: {persona.customerName} ({persona.age}세) · 통화 시간: {Math.floor(sessionRecord.durationSeconds / 60)}분 {sessionRecord.durationSeconds % 60}초
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6">
          {/* Score Header Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-blue-50/60 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-blue-950/30 border border-indigo-100/80 dark:border-indigo-900/50 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className={`relative flex items-center justify-center w-20 h-20 rounded-full border-4 ${getScoreColor(report.totalScore)} bg-white dark:bg-gray-900 shadow-inner`}>
                <div className="text-center">
                  <span className="text-2xl font-black">{report.totalScore}</span>
                  <span className="text-[10px] block text-gray-400 font-medium">/ 100점</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    report.passed
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}>
                    {report.passed ? '🎉 실무 기준 통과' : '💡 추가 보완 권장'}
                  </span>
                  <span className="text-xs text-gray-400">통과 기준: 75점</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {report.summary}
                </p>
              </div>
            </div>
          </div>

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
              <p className="mt-1.5 text-[10px] text-gray-400">소속 법인명 및 수수료 0원 고지</p>
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
              <p className="mt-1.5 text-[10px] text-gray-400">자금 필요 시기 및 부채 질문</p>
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
              <p className="mt-1.5 text-[10px] text-gray-400">의심/거절 극복 및 콜백 성사</p>
            </div>
          </div>

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
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-blue-600 border border-gray-200 dark:border-gray-700 shadow-xs"
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

          {/* Sandbox Memo Result Summary */}
          <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400 flex flex-col sm:flex-row justify-between gap-2">
            <div>
              <span className="font-semibold text-gray-800 dark:text-gray-200">상담원이 기록한 결과:</span>{' '}
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
                {sessionRecord.consultationResult || '미기록'}
              </span>
            </div>
            {sessionRecord.agentMemo && (
              <div className="truncate max-w-sm">
                <span className="font-semibold text-gray-800 dark:text-gray-200">메모:</span> {sessionRecord.agentMemo}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 px-6 py-4 bg-gray-50 dark:bg-gray-900/90 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            이 시나리오 다시 연습
          </button>

          <div className="flex items-center gap-2">
            {hasNextLevel && onNextLevel && (
              <button
                onClick={onNextLevel}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
              >
                다음 난이도 도전
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
