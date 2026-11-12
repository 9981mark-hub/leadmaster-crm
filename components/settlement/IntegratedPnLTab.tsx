import React, { useMemo } from 'react';
import { IntegratedPnLSummary, SettlementPolicy } from '../../services/settlementMasterService';
import {
  TrendingUp,
  DollarSign,
  PieChart as PieIcon,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Database,
  Users,
  Building,
  CreditCard,
  Download,
  AlertCircle
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import * as XLSX from 'xlsx';

interface IntegratedPnLTabProps {
  summary?: IntegratedPnLSummary;
  policy: SettlementPolicy;
  year: number;
  month: number | 'all';
}

export default function IntegratedPnLTab({
  summary,
  policy,
  year,
  month,
}: IntegratedPnLTabProps) {
  const s: IntegratedPnLSummary = useMemo(() => {
    return summary || {
      year,
      month,
      totalRevenueWon: 0,
      collectedRevenueWon: 0,
      outstandingRevenueWon: 0,
      totalCompanyMarginWon: 0,
      totalAgentCommissionWon: 0,
      totalDbCostWon: 0,
      totalFixedCostWon: 0,
      totalExpensesWon: 0,
      netProfitWon: 0,
      profitMarginRate: 0,
      cashInflowWon: 0,
      cashOutflowWon: 0,
      netCashFlowWon: 0,
    };
  }, [summary, year, month]);

  // 비용 구조 도넛 데이터
  const costBreakdownData = useMemo(() => {
    return [
      { name: 'DB 구매 원가', value: s.totalDbCostWon || 0, color: '#f43f5e' },
      { name: '상담원 수당', value: s.totalAgentCommissionWon || 0, color: '#10b981' },
      { name: '일반 운영/고정비', value: s.totalFixedCostWon || 0, color: '#f59e0b' },
    ].filter(d => d.value > 0);
  }, [s]);

  // 비교 차트 데이터 (매출 vs 총비용 vs 순이익)
  const comparisonData = useMemo(() => {
    return [
      {
        name: month === 'all' ? `${year}년 누적` : `${year}년 ${month}월`,
        총매출: s.totalRevenueWon || 0,
        총비용: s.totalExpensesWon || 0,
        영업순이익: s.netProfitWon || 0,
      },
    ];
  }, [s, year, month]);

  // 엑셀 내보내기
  const handleExportExcel = () => {
    const exportData = [
      { '항목': '총 수수료 매출 (청구 기준)', '금액(원)': s.totalRevenueWon },
      { '항목': '실제 통장 입금액 (수납 기준)', '금액(원)': s.collectedRevenueWon },
      { '항목': '거래처 미수금 잔액', '금액(원)': s.outstandingRevenueWon },
      { '항목': '(-) DB 구매 원가', '금액(원)': s.totalDbCostWon },
      { '항목': '(-) 상담원 수당 지출', '금액(원)': s.totalAgentCommissionWon },
      { '항목': '(-) 일반 운영비 및 고정비', '금액(원)': s.totalFixedCostWon },
      { '항목': '총 지출 합계', '금액(원)': s.totalExpensesWon },
      { '항목': '(=) 최종 영업 순이익', '금액(원)': s.netProfitWon },
      { '항목': '영업 순이익률(%)', '금액(원)': s.profitMarginRate },
      { '항목': '실제 순현금흐름 (Cash Flow)', '금액(원)': s.netCashFlowWon },
    ];

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '경영손익_PnL');
    XLSX.writeFile(wb, `종합_경영손익_PnL_${year}_${month === 'all' ? '누적' : month + '월'}.xlsx`);
  };

  const periodLabel = month === 'all' ? `${year}년 연간 전체 누적` : `${year}년 ${month}월`;

  return (
    <div className="space-y-6">
      {/* 1. 상단 경영 손익 하이라이트 전광판 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 총 매출 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-sky-400" />
              총 수수료 매출
            </span>
            <span className="text-xs bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full font-medium">
              청구액 기준
            </span>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            ₩{(s.totalRevenueWon || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>실제 입금: ₩{(s.collectedRevenueWon || 0).toLocaleString()}</span>
            <span className="text-amber-400">미수: ₩{(s.outstandingRevenueWon || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* 총 지출 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-rose-400" />
              총 비용 지출 합계
            </span>
            <span className="text-xs bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full font-medium">
              원가+수당+고정비
            </span>
          </div>
          <div className="text-2xl font-black text-rose-400 tracking-tight">
            ₩{(s.totalExpensesWon || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>DB원가: ₩{(s.totalDbCostWon || 0).toLocaleString()}</span>
            <span>상담원: ₩{(s.totalAgentCommissionWon || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* 최종 영업 순이익 */}
        <div className="bg-gradient-to-br from-emerald-950/70 to-slate-900 border border-emerald-700/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              최종 영업 순이익
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              (s.netProfitWon || 0) >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {s.profitMarginRate || 0}% 이익률
            </span>
          </div>
          <div className={`text-2xl font-black tracking-tight ${
            (s.netProfitWon || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            ₩{(s.netProfitWon || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-emerald-200/80">
            {periodLabel} 실영업 결산
          </div>
        </div>

        {/* 실제 현금 흐름 (통장 입출금) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-amber-400" />
                실현금 흐름 (Cash Flow)
              </span>
              <span className="text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full font-medium">
                통장 기준
              </span>
            </div>
            <div className={`text-2xl font-black tracking-tight ${
              (s.netCashFlowWon || 0) >= 0 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              ₩{(s.netCashFlowWon || 0).toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              실입금 ₩{(s.cashInflowWon || 0).toLocaleString()} - 실출금 ₩{(s.cashOutflowWon || 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 상세 손익 계산서 워터폴 (5단계 P&L Waterfall) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              {periodLabel} 표준 경영 손익계산서 (P&L Waterfall)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              거래처 수수료 매출에서 DB 구매 원가, 상담원 인센티브, 판매관리비를 단계별로 차감한 최종 손익 대장입니다.
            </p>
          </div>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            손익계산서 엑셀 다운로드
          </button>
        </div>

        <div className="space-y-3 font-mono text-sm">
          {/* 1단계: 총 매출 */}
          <div className="flex items-center justify-between p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs font-bold font-sans">
                1
              </span>
              <div>
                <div className="font-bold text-white font-sans">총 수수료 매출 (Gross Revenue)</div>
                <div className="text-xs text-slate-400 font-sans">거래처 계약 수수료 총액 (입금확인 ₩{(s.collectedRevenueWon || 0).toLocaleString()} + 미수금 ₩{(s.outstandingRevenueWon || 0).toLocaleString()})</div>
              </div>
            </div>
            <div className="text-base font-black text-sky-400">
              + ₩{(s.totalRevenueWon || 0).toLocaleString()}
            </div>
          </div>

          {/* 2단계: DB 구매 원가 */}
          <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-lg ml-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs font-bold font-sans">
                2
              </span>
              <div>
                <div className="font-bold text-slate-200 font-sans">(-) DB 구매 매입 원가 (COGS)</div>
                <div className="text-xs text-slate-400 font-sans">팀 관리 회차/공급사 매입액과 100% 실시간 연동</div>
              </div>
            </div>
            <div className="text-base font-bold text-rose-400">
              - ₩{(s.totalDbCostWon || 0).toLocaleString()}
            </div>
          </div>

          {/* 3단계: 상담원 수당 */}
          <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-lg ml-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold font-sans">
                3
              </span>
              <div>
                <div className="font-bold text-slate-200 font-sans">(-) 상담원 실지급 수당 (Sales Commission)</div>
                <div className="text-xs text-slate-400 font-sans">
                  회사 분배 정책({policy.splitModel === 'ratio_split' ? `비율 ${policy.companyShareRatio}:${policy.agentShareRatio}` : '공제 룰'}) 적용 후 지급액
                </div>
              </div>
            </div>
            <div className="text-base font-bold text-emerald-400">
              - ₩{(s.totalAgentCommissionWon || 0).toLocaleString()}
            </div>
          </div>

          {/* 4단계: 판매관리비 및 고정비 */}
          <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-lg ml-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold font-sans">
                4
              </span>
              <div>
                <div className="font-bold text-slate-200 font-sans">(-) 일반 판매관리비 및 운영비 (SG&A / Expenses)</div>
                <div className="text-xs text-slate-400 font-sans">임대료, 통신비, 솔루션비, 식대, 기타 지출 합계</div>
              </div>
            </div>
            <div className="text-base font-bold text-amber-400">
              - ₩{(s.totalFixedCostWon || 0).toLocaleString()}
            </div>
          </div>

          {/* 5단계: 최종 영업 순이익 */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-2 border-emerald-600/70 rounded-xl shadow-lg mt-4">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-sm font-black font-sans shadow-md">
                5
              </span>
              <div>
                <div className="text-base font-black text-white font-sans flex items-center gap-2">
                  (=) 최종 영업 순이익 (Net Operating Profit)
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold font-sans border border-emerald-500/30">
                    순이익률 {s.profitMarginRate || 0}%
                  </span>
                </div>
                <div className="text-xs text-emerald-300/80 font-sans mt-0.5">
                  총 매출 ₩{(s.totalRevenueWon || 0).toLocaleString()} - 총 지출 ₩{(s.totalExpensesWon || 0).toLocaleString()}
                </div>
              </div>
            </div>
            <div className={`text-2xl font-black ${
              (s.netProfitWon || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              ₩{(s.netProfitWon || 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 3. 시각화 섹션: 비용 구조 파이 차트 & 매출/비용/순이익 바 차트 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 비용 구성 비율 (도넛 차트) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-amber-400" />
              지출 비용 구조 분해 (원가 vs 인건비 vs 운영비)
            </h4>
            <span className="text-xs text-slate-400 font-mono">총 ₩{(s.totalExpensesWon || 0).toLocaleString()}</span>
          </div>

          {costBreakdownData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
              등록된 지출 데이터가 없습니다.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {costBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => `₩${val.toLocaleString()}원`}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 매출 대 지출 대 순이익 바 차트 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-400" />
              매출액 / 총비용 / 순이익 비교 분석
            </h4>
            <span className="text-xs text-slate-400">{periodLabel}</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis
                  stroke="#64748b"
                  tickFormatter={(val) => `₩${Math.round(val / 10000).toLocaleString()}만`}
                />
                <Tooltip
                  formatter={(val: number) => `₩${val.toLocaleString()}원`}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="총매출" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="총비용" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="영업순이익" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
