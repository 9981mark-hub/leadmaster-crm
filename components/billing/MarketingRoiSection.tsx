import React from 'react';
import { 
  Percent, Target, Award, CheckCircle2, AlertCircle, 
  HelpCircle, ArrowUpRight, BarChart3, Sparkles 
} from 'lucide-react';
import { MarketingRoiSummary } from '../../services/billingService';

interface MarketingRoiSectionProps {
  roi: MarketingRoiSummary;
  totalAdSpendWon: number;
}

export const MarketingRoiSection: React.FC<MarketingRoiSectionProps> = ({
  roi,
  totalAdSpendWon,
}) => {
  const isExcellent = roi.statusGrade === 'excellent';
  const isWarning = roi.statusGrade === 'warning';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300">
              투자 회수율 분석
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              당월 투입 광고비 대비 성약 매출 성과
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            마케팅 투자 회수율 (ROAS) & 획득 단가 (CPL / CPA)
          </h2>
        </div>

        {/* AI 신호등 배지 */}
        <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold ${
          isExcellent
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
            : isWarning
            ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
            : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
        }`}>
          <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
            isExcellent ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500'
          }`} />
          <span>
            {isExcellent ? 'AI 마케팅 진단: 우수 (HIGH ROI)' : isWarning ? 'AI 마케팅 진단: 예산 점검 권고' : 'AI 마케팅 진단: 양호 (STABLE)'}
          </span>
        </div>
      </div>

      {/* AI 진단 코멘트 배너 */}
      <div className="px-5 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-850/60 border-b border-slate-100 dark:border-slate-800/80 flex items-start gap-3">
        <Sparkles size={16} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {roi.gradeMessage}
        </p>
      </div>

      {/* 4대 핵심 마케팅 지표 카드 */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. 종합 ROAS */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50/70 to-white dark:from-purple-950/30 dark:to-slate-800 border border-purple-200/80 dark:border-purple-800/60 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-900 dark:text-purple-300">
              종합 ROAS (수익률)
            </span>
            <span className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center">
              <Percent size={13} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={`text-2xl sm:text-3xl font-black tabular-nums ${
              roi.overallRoas >= 300 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : roi.overallRoas >= 150 
                ? 'text-purple-600 dark:text-purple-400' 
                : 'text-amber-600 dark:text-amber-400'
            }`}>
              {roi.overallRoas > 0 ? `${roi.overallRoas}%` : '-'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            광고비 1원 투입당 {roi.overallRoas > 0 ? (roi.overallRoas / 100).toFixed(1) : 0}원 회수
          </div>
        </div>

        {/* 2. CPL (리드당 획득 비용) */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              리드당 비용 (CPL)
            </span>
            <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Target size={13} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {roi.cplWon > 0 ? `₩${roi.cplWon.toLocaleString()}` : '-'}
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">원 / 건</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            총 {roi.totalLeads}개 인입 리드
          </div>
        </div>

        {/* 3. CPA (계약당 획득 비용) */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              성약당 비용 (CPA)
            </span>
            <span className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Award size={13} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {roi.cpaWon > 0 ? `₩${roi.cpaWon.toLocaleString()}` : '-'}
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">원 / 건</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            최종 {roi.contractCount}건 계약 완료 (성약률 {roi.contractRate}%)
          </div>
        </div>

        {/* 4. 총 성약 수임료 매출 */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              성약 수임료 총액
            </span>
            <span className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <BarChart3 size={13} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              ₩{roi.totalContractFeeWon.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">원</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            총 {(roi.totalContractFeeWon / 10000).toLocaleString()}만원 매출 창출
          </div>
        </div>
      </div>

      {/* 채널별 성과 분석 비교표 */}
      <div className="p-5 sm:p-6">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <span>매체별 마케팅 효율 성과표 (Channel Performance)</span>
        </h3>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/80 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                <th className="py-2.5 px-3">매체 (채널)</th>
                <th className="py-2.5 px-3 text-right">광고비 (소진)</th>
                <th className="py-2.5 px-3 text-right">리드 인입</th>
                <th className="py-2.5 px-3 text-right">계약 성약</th>
                <th className="py-2.5 px-3 text-right">성약 수임료</th>
                <th className="py-2.5 px-3 text-right">CPL (리드단가)</th>
                <th className="py-2.5 px-3 text-right">CPA (계약단가)</th>
                <th className="py-2.5 px-3 text-right font-bold text-purple-700 dark:text-purple-300">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {roi.channelStats.length > 0 ? (
                roi.channelStats.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-slate-100">
                      {item.channel}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {item.spendWon > 0 ? `₩${item.spendWon.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans text-slate-800 dark:text-slate-200">
                      {item.leads}건
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans font-bold text-emerald-600 dark:text-emerald-400">
                      {item.contracts}건
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-900 dark:text-slate-100 font-semibold">
                      {item.contractFeeWon > 0 ? `₩${item.contractFeeWon.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {item.cplWon > 0 ? `₩${item.cplWon.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {item.cpaWon > 0 ? `₩${item.cpaWon.toLocaleString()}` : '-'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-black ${
                      item.roas >= 300 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : item.roas >= 150 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {item.roas > 0 ? `${item.roas}%` : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-sans text-xs">
                    비교할 마케팅 채널 데이터가 충분하지 않습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
