import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Calendar, DollarSign, 
  Plus, RefreshCw, Download, Search, Filter, Trash2, 
  ExternalLink, Layers, PieChart, Sparkles, AlertCircle
} from 'lucide-react';
import { AdSpendSummary, AdSpendRecord } from '../../services/billingService';

interface AdSpendOverviewSectionProps {
  summary: AdSpendSummary;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  onOpenAddExpense: () => void;
  onSyncTossAds: () => void;
  isSyncingTossAds: boolean;
  onDeleteExpense?: (id: string) => void;
}

export const AdSpendOverviewSection: React.FC<AdSpendOverviewSectionProps> = ({
  summary,
  selectedPeriod,
  onPeriodChange,
  onOpenAddExpense,
  onSyncTossAds,
  isSyncingTossAds,
  onDeleteExpense,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');

  // 필터링된 광고비 장부 레코드
  const filteredRecords = useMemo(() => {
    return summary.records.filter(r => {
      if (channelFilter !== 'all' && r.channel !== channelFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = (r.description || '').toLowerCase().includes(q);
        const matchChannel = (r.channel || '').toLowerCase().includes(q);
        const matchMemo = (r.memo || '').toLowerCase().includes(q);
        if (!matchDesc && !matchChannel && !matchMemo) return false;
      }
      return true;
    });
  }, [summary.records, channelFilter, searchQuery]);

  // CSV 다운로드
  const handleExportCsv = () => {
    if (filteredRecords.length === 0) return;
    let csv = '\uFEFF집행일자,광고매체(채널),지출금액(원),지출금액(만원),출처,결제수단/증빙,내용/캠페인,메모\n';
    filteredRecords.forEach(r => {
      csv += `"${r.date}","${r.channel}","${r.amountWon}","${r.amountManwon}","${r.source === 'toss_ads' ? '토스애즈연동' : '지출장부'}","${r.paymentMethod || ''}","${(r.description || '').replace(/"/g, '""')}","${(r.memo || '').replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `광고비_지출장부_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const isGrowthPositive = summary.monthOverMonthGrowthRate > 0;
  const isGrowthZero = summary.monthOverMonthGrowthRate === 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
              광고비 종합 관제
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {summary.earliestDate ? `${summary.earliestDate} 최초 개시 (D+${summary.daysSinceFirstSpend}일)` : '광고비 내역 집계 중'}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            광고비 집행 타임라인 & 상세 지출 장부 (Ad Spend Tracker)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            대표님이 언제부터 얼마의 광고비를 지출했는지 시간순으로 완벽히 집계하고 채널별 비중을 분석합니다.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            {[
              { id: 'cur_month', label: '당월' },
              { id: 'prev_month', label: '전월' },
              { id: '3_months', label: '최근3개월' },
              { id: 'year', label: '올해' },
              { id: 'all', label: '전체' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => onPeriodChange(p.id)}
                className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  selectedPeriod === p.id
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={onSyncTossAds}
            disabled={isSyncingTossAds}
            className="px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="토스 애즈 실시간 시트 동기화"
          >
            <RefreshCw size={13} className={isSyncingTossAds ? 'animate-spin' : ''} />
            {isSyncingTossAds ? '동기화 중...' : '토스애즈 연동'}
          </button>

          <button
            onClick={onOpenAddExpense}
            className="px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} /> + 광고비 등록
          </button>
        </div>
      </div>

      {/* 4대 핵심 광고비 KPI 그리드 */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 grid grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50 dark:bg-slate-850/40">
        {/* KPI 1: 당월 광고비 지출 */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              당월 광고비 소진액
            </span>
            <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <DollarSign size={13} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums font-mono">
              ₩ {summary.currentMonthWon.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">원</span>
          </div>
          <div className="mt-1 text-xs text-blue-600 dark:text-blue-400 font-semibold">
            {summary.currentMonthManwon.toLocaleString()}만원 집행
          </div>
        </div>

        {/* KPI 2: 전월 대비 증감 */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              전월 동기 대비 증감
            </span>
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${
              isGrowthZero
                ? 'bg-slate-100 text-slate-500 dark:bg-slate-700'
                : isGrowthPositive
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400'
                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
            }`}>
              {isGrowthPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={`text-xl sm:text-2xl font-black tabular-nums ${
              isGrowthZero
                ? 'text-slate-700 dark:text-slate-300'
                : isGrowthPositive
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {isGrowthPositive ? `+${summary.monthOverMonthGrowthRate}%` : `${summary.monthOverMonthGrowthRate}%`}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
            전월: {summary.prevMonthManwon.toLocaleString()}만원 (₩ {summary.prevMonthWon.toLocaleString()}원)
          </div>
        </div>

        {/* KPI 3: 최초 광고 집행 개시일 */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              최초 광고 개시일
            </span>
            <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Calendar size={13} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">
              {summary.earliestDate || '-'}
            </span>
          </div>
          <div className="mt-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
            {summary.daysSinceFirstSpend > 0 ? `집행 D+${summary.daysSinceFirstSpend}일차 진행 중` : '집행 데이터 없음'}
          </div>
        </div>

        {/* KPI 4: 역대 누적 총 광고비 */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              역대 누적 총 광고비
            </span>
            <span className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles size={13} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">
              ₩ {summary.cumulativeTotalWon.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">원</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            총 {summary.cumulativeTotalManwon.toLocaleString()}만원 누적 투입
          </div>
        </div>
      </div>

      {/* 채널별 광고비 비중 시각화 바 & 칩 */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PieChart size={16} className="text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              유입 매체별 광고비 지출 비중
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            당월 기준 (총 ₩ {summary.currentMonthWon.toLocaleString()}원)
          </span>
        </div>

        {summary.channelBreakdown.length > 0 ? (
          <>
            {/* Visual Progress Bar */}
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 shadow-inner">
              {summary.channelBreakdown.map((item, idx) => (
                <div
                  key={idx}
                  className="h-full transition-all duration-500 hover:opacity-85"
                  style={{
                    width: `${Math.max(2, item.percentage)}%`,
                    backgroundColor: item.color,
                  }}
                  title={`${item.channel}: ${item.percentage}% (₩${item.amountWon.toLocaleString()}원)`}
                />
              ))}
            </div>

            {/* Channel Chips Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
              {summary.channelBreakdown.map((item, idx) => (
                <div 
                  key={idx}
                  onClick={() => setChannelFilter(channelFilter === item.channel ? 'all' : item.channel)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    channelFilter === item.channel
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 shadow-xs'
                      : 'border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: item.color }} 
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {item.channel}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-auto">
                      {item.percentage}%
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-extrabold text-slate-900 dark:text-slate-100 tabular-nums font-mono">
                    ₩ {item.amountWon.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {item.amountManwon.toLocaleString()}만원
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
            등록된 광고비 지출 데이터가 없습니다. 상단의 [+ 광고비 등록] 버튼을 눌러 첫 광고비를 입력하세요.
          </div>
        )}
      </div>

      {/* 상세 광고비 지출 장부 (테이블) */}
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-slate-600 dark:text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              일자별 광고비 상세 장부 ({filteredRecords.length}건)
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="내용, 채널, 메모 검색..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 w-44 sm:w-56"
              />
            </div>

            {/* CSV Export */}
            <button
              onClick={handleExportCsv}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              title="엑셀(CSV) 다운로드"
            >
              <Download size={13} /> 엑셀 다운
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/80 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                <th className="py-2.5 px-3 whitespace-nowrap">집행 일자</th>
                <th className="py-2.5 px-3 whitespace-nowrap">광고 매체 (채널)</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-right">집행 금액 (원)</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-right">만원 환산</th>
                <th className="py-2.5 px-3 whitespace-nowrap">결제수단 / 증빙</th>
                <th className="py-2.5 px-3">캠페인명 / 내용</th>
                <th className="py-2.5 px-3">메모 / 성과</th>
                {onDeleteExpense && <th className="py-2.5 px-2 text-center">관리</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {filteredRecords.length > 0 ? (
                filteredRecords.map(r => (
                  <tr 
                    key={r.id} 
                    className="hover:bg-slate-50 dark:hover:bg-slate-100/50 dark:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {r.date}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded font-sans font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        {r.channel}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
                      ₩ {r.amountWon.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-right text-blue-600 dark:text-blue-400 font-semibold">
                      {r.amountManwon.toLocaleString()}만원
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-sans text-slate-600 dark:text-slate-400">
                      <span className="text-xs">
                        {r.paymentMethod || '-'}
                      </span>
                      {r.receiptStatus && (
                        <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                          ({r.receiptStatus})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-800 dark:text-slate-200 max-w-xs truncate" title={r.description}>
                      {r.description}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-500 dark:text-slate-400 max-w-xs truncate" title={r.memo || ''}>
                      {r.memo || '-'}
                    </td>
                    {onDeleteExpense && (
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        {r.source === 'expense' ? (
                          <button
                            onClick={() => onDeleteExpense(r.id)}
                            className="p-1 text-slate-500 dark:text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 dark:hover:bg-rose-100/40 dark:bg-rose-950/40 transition-colors cursor-pointer"
                            title="지출 삭제"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">연동</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td 
                    colSpan={onDeleteExpense ? 8 : 7} 
                    className="py-8 text-center text-slate-500 dark:text-slate-400 font-sans text-xs"
                  >
                    해당 조건의 광고비 지출 내역이 없습니다.
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
