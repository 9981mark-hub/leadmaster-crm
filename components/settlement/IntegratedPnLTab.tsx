import React, { useMemo } from 'react';
import { IntegratedPnLSummary, SettlementPolicy, policyLabel } from '../../services/settlementMasterService';
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
  policyIsDefault?: boolean;
}

export default function IntegratedPnLTab({
  summary,
  policy,
  year,
  month,
  policyIsDefault = false,
}: IntegratedPnLTabProps) {
  const s: IntegratedPnLSummary = useMemo(() => {
    return summary || {
      year,
      month,
      totalRevenueWon: 0,
      totalVatWon: 0,
      totalBilledWon: 0,
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
      { '항목': '총 수수료 매출 (공급가, 부가세 제외)', '금액(원)': s.totalRevenueWon },
      { '항목': '매출 부가세 (별도, 매출 아님)', '금액(원)': s.totalVatWon },
      { '항목': '청구액 합계 (공급가 + 부가세)', '금액(원)': s.totalBilledWon },
      { '항목': '기간 내 실제 입금액 (통장, 부가세 포함)', '금액(원)': s.collectedRevenueWon },
      { '항목': '기간 발생분 미수금 (부가세 포함)', '금액(원)': s.outstandingRevenueWon },
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 총 매출 */}
        <div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-2xs flex flex-col justify-between hover:border-primary/40 transition-all card-interactive">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                총 수수료 매출
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20 font-mono">
                공급가 기준
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-foreground tracking-tight font-mono tabular-nums">
                ₩ {(s.totalRevenueWon || 0).toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">원</span>
            </div>
          </div>
          <div className="mt-2.5 text-2xs text-muted-foreground flex flex-col gap-0.5 font-mono">
            <span>입금: ₩ {(s.collectedRevenueWon || 0).toLocaleString()}원{(s.totalVatWon || 0) > 0 ? ` · 부가세 ₩ ${(s.totalVatWon || 0).toLocaleString()}원 별도` : ''}</span>
            <span>미수: ₩ {(s.outstandingRevenueWon || 0).toLocaleString()}원</span>
          </div>
        </div>

        {/* 총 지출 */}
        <div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-2xs flex flex-col justify-between hover:border-primary/40 transition-all card-interactive">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                총 비용 지출 합계
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground border border-border font-mono">
                원가+수당+고정비
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-foreground tracking-tight font-mono tabular-nums">
                ₩ {(s.totalExpensesWon || 0).toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">원</span>
            </div>
          </div>
          <div className="mt-2.5 text-2xs text-muted-foreground flex flex-col gap-0.5 font-mono">
            <span>DB원가: ₩ {(s.totalDbCostWon || 0).toLocaleString()}원</span>
            <span>상담원: ₩ {(s.totalAgentCommissionWon || 0).toLocaleString()}원</span>
          </div>
        </div>

        {/* 최종 영업 순이익 */}
        <div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-2xs flex flex-col justify-between hover:border-primary/40 transition-all card-interactive">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                최종 영업 순이익
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold font-mono border ${
                (s.netProfitWon || 0) >= 0 ? 'bg-primary/10 text-primary border-primary/20' : 'bg-destructive/10 text-destructive border-destructive/20'
              }`}>
                {s.profitMarginRate || 0}% 이익률
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-bold tracking-tight font-mono tabular-nums ${
                (s.netProfitWon || 0) >= 0 ? 'text-primary' : 'text-destructive'
              }`}>
                {(s.netProfitWon || 0) < 0 ? '-' : ''}₩ {Math.abs(s.netProfitWon || 0).toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">원</span>
            </div>
          </div>
          <div className="mt-2.5 text-xs text-muted-foreground font-mono">
            {periodLabel} 실영업 결산
          </div>
        </div>

        {/* 실제 현금 흐름 (통장 입출금) */}
        <div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-2xs flex flex-col justify-between hover:border-primary/40 transition-all card-interactive">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                실현금 흐름 (Cash Flow)
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground border border-border font-mono">
                통장 기준
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight font-mono tabular-nums text-foreground">
                {(s.netCashFlowWon || 0) < 0 ? '-' : ''}₩ {Math.abs(s.netCashFlowWon || 0).toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">원</span>
            </div>
          </div>
          <div className="mt-2.5 text-2xs text-muted-foreground font-mono">
            실입금 ₩ {(s.cashInflowWon || 0).toLocaleString()}원 - 실출금 ₩ {(s.cashOutflowWon || 0).toLocaleString()}원
          </div>
        </div>
      </div>

      {/* 2. 상세 손익 계산서 워터폴 (5단계 P&L Waterfall) */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-2xs text-card-foreground">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-border pb-4">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" strokeWidth={1.75} />
              {periodLabel} 표준 경영 손익계산서 (P&L Waterfall)
            </h3>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              거래처 수수료 매출에서 DB 구매 원가, 상담원 인센티브, 판매관리비를 단계별로 차감한 최종 손익 대장입니다.
            </p>
          </div>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
            손익계산서 엑셀 다운로드
          </button>
        </div>

        <div className="space-y-2.5 font-mono text-xs">
          {/* 1단계: 총 매출 */}
          <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border rounded-lg">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold font-sans">
                1
              </span>
              <div>
                <div className="font-semibold text-foreground font-sans text-xs">총 수수료 매출 (Gross Revenue)</div>
                <div className="text-2xs text-muted-foreground font-sans mt-0.5">이 기간에 지급 사유가 생긴 거래처 수수료 공급가 (부가세 ₩ {(s.totalVatWon || 0).toLocaleString()}원 별도 · 청구액 ₩ {(s.totalBilledWon || 0).toLocaleString()}원 · 이 기간 입금 ₩ {(s.collectedRevenueWon || 0).toLocaleString()}원 · 미수 ₩ {(s.outstandingRevenueWon || 0).toLocaleString()}원)</div>
              </div>
            </div>
            <div className="text-sm font-bold text-foreground font-mono tabular-nums shrink-0 ml-2">
              + ₩ {(s.totalRevenueWon || 0).toLocaleString()} 원
            </div>
          </div>

          {/* 2단계: DB 구매 원가 */}
          <div className="flex items-center justify-between p-3.5 bg-muted/20 border border-border/80 rounded-lg ml-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground border border-border flex items-center justify-center text-xs font-bold font-sans">
                2
              </span>
              <div>
                <div className="font-medium text-foreground font-sans text-xs">(-) DB 구매 매입 원가 (COGS)</div>
                <div className="text-2xs text-muted-foreground font-sans mt-0.5">팀 관리 회차/공급사 매입액과 100% 실시간 연동</div>
              </div>
            </div>
            <div className="text-sm font-medium text-muted-foreground font-mono tabular-nums shrink-0 ml-2">
              - ₩ {(s.totalDbCostWon || 0).toLocaleString()} 원
            </div>
          </div>

          {/* 3단계: 상담원 수당 */}
          <div className="flex items-center justify-between p-3.5 bg-muted/20 border border-border/80 rounded-lg ml-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground border border-border flex items-center justify-center text-xs font-bold font-sans">
                3
              </span>
              <div>
                <div className="font-medium text-foreground font-sans text-xs">(-) 상담원 실지급 수당 (Sales Commission)</div>
                <div className="text-2xs text-muted-foreground font-sans mt-0.5">
                  {policyLabel(policy)} 적용 후 지급액{policyIsDefault ? ' · 기본값(저장 안 됨)' : ''}
                </div>
              </div>
            </div>
            <div className="text-sm font-medium text-muted-foreground font-mono tabular-nums shrink-0 ml-2">
              - ₩ {(s.totalAgentCommissionWon || 0).toLocaleString()} 원
            </div>
          </div>

          {/* 4단계: 판매관리비 및 고정비 */}
          <div className="flex items-center justify-between p-3.5 bg-muted/20 border border-border/80 rounded-lg ml-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground border border-border flex items-center justify-center text-xs font-bold font-sans">
                4
              </span>
              <div>
                <div className="font-medium text-foreground font-sans text-xs">(-) 일반 판매관리비 및 운영비 (SG&A / Expenses)</div>
                <div className="text-2xs text-muted-foreground font-sans mt-0.5">임대료, 통신비, 솔루션비, 식대, 기타 지출 합계</div>
              </div>
            </div>
            <div className="text-sm font-medium text-muted-foreground font-mono tabular-nums shrink-0 ml-2">
              - ₩ {(s.totalFixedCostWon || 0).toLocaleString()} 원
            </div>
          </div>

          {/* 5단계: 최종 영업 순이익 */}
          <div className="flex items-center justify-between p-4 bg-primary/10 border border-primary/30 rounded-xl shadow-2xs mt-3">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold font-sans shadow-2xs">
                5
              </span>
              <div>
                <div className="text-sm font-bold text-foreground font-sans flex items-center gap-2">
                  (=) 최종 영업 순이익 (Net Operating Profit)
                  <span className="text-2xs px-2 py-0.5 rounded font-mono font-medium bg-primary/15 text-primary border border-primary/30">
                    순이익률 {s.profitMarginRate || 0}%
                  </span>
                </div>
                <div className="text-2xs text-muted-foreground font-sans mt-0.5">
                  총 매출 ₩ {(s.totalRevenueWon || 0).toLocaleString()} 원 - 총 지출 ₩ {(s.totalExpensesWon || 0).toLocaleString()} 원
                </div>
              </div>
            </div>
            <div className={`text-xl font-bold font-mono tabular-nums shrink-0 ml-2 ${
              (s.netProfitWon || 0) >= 0 ? 'text-primary' : 'text-destructive'
            }`}>
              {(s.netProfitWon || 0) < 0 ? '-' : ''}₩ {Math.abs(s.netProfitWon || 0).toLocaleString()} 원
            </div>
          </div>
        </div>
      </div>

      {/* 3. 시각화 섹션: 비용 구조 파이 차트 & 매출/비용/순이익 바 차트 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 비용 구성 비율 (도넛 차트) */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-2xs flex flex-col text-card-foreground">
          <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <PieIcon className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
              지출 비용 구조 분해 (원가 vs 인건비 vs 운영비)
            </h4>
            <span className="text-2xs text-muted-foreground font-mono">총 ₩ {(s.totalExpensesWon || 0).toLocaleString()} 원</span>
          </div>

          {costBreakdownData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-muted-foreground text-xs font-mono">
              등록된 지출 데이터가 없습니다.
            </div>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {costBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => `₩ ${val.toLocaleString()} 원`}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--foreground))' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 매출 대 지출 대 순이익 바 차트 */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-2xs flex flex-col card-interactive text-card-foreground">
          <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
              매출액 / 총비용 / 순이익 비교 분석
            </h4>
            <span className="text-2xs text-muted-foreground font-mono">{periodLabel}</span>
          </div>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(val) => `₩ ${Math.round(val / 10000).toLocaleString()} 만`}
                />
                <Tooltip
                  formatter={(val: number) => `₩ ${val.toLocaleString()} 원`}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--foreground))' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="총매출" fill="hsl(var(--foreground))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="총비용" fill="#64748b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="영업순이익" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
