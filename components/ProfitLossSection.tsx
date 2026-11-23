import React, { useState, useEffect } from 'react';
import { fetchExpenses, getExpenseStats, fetchTaxInvoices, getTaxInvoiceStats } from '../services/api';
import { ExpenseItem, TaxInvoice } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import * as XLSX from 'xlsx';

interface ProfitLossSectionProps {
    year: number;
    settlementData?: {
        totalRevenue: number;
        commissionRevenue: number;
        monthlyData?: { month: string; amount: number }[];
    };
}

interface MonthlyPL {
    month: string;
    monthNum: number;
    revenue: number;
    expenses: number;
    profit: number;
}

const ProfitLossSection: React.FC<ProfitLossSectionProps> = ({ year, settlementData }) => {
    const [viewMode, setViewMode] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
    const [monthlyData, setMonthlyData] = useState<MonthlyPL[]>([]);
    const [dataSource, setDataSource] = useState<'invoice' | 'settlement' | 'none'>('none');
    const [summary, setSummary] = useState({
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        profitMargin: 0
    });

    // 데이터 로드 및 계산
    useEffect(() => {
        calculatePL();
    }, [year, settlementData]);

    const calculatePL = async () => {
        // 1. 지출 데이터 가져오기
        const expenses = await fetchExpenses();
        const yearExpenses = expenses.filter(e => e.date.startsWith(String(year)));

        // 월별 지출 집계
        const monthlyExpenses: Record<number, number> = {};
        for (let i = 1; i <= 12; i++) {
            monthlyExpenses[i] = 0;
        }

        yearExpenses.forEach(exp => {
            const month = parseInt(exp.date.split('-')[1]);
            monthlyExpenses[month] += exp.amount;
        });

        // 2. 세금계산서 데이터 (매출 + 매입)
        const allInvoices = await fetchTaxInvoices(year);
        const salesInvoices = allInvoices.filter(inv => inv.type === '매출');
        const purchaseInvoices = allInvoices.filter(inv => inv.type === '매입');

        // 3. 월별 수익 결정 (세금계산서 우선 → 정산 데이터 폴백)
        const monthlyRevenue: Record<number, number> = {};
        for (let i = 1; i <= 12; i++) {
            monthlyRevenue[i] = 0;
        }

        const hasInvoiceData = salesInvoices.length > 0;

        if (hasInvoiceData) {
            // ✅ 실제 세금계산서 데이터 사용 (가장 정확)
            salesInvoices.forEach(inv => {
                const month = parseInt(inv.issueDate.split('-')[1]);
                monthlyRevenue[month] += inv.totalAmount;
            });
            setDataSource('invoice');
        } else if (settlementData?.monthlyData) {
            // 폴백: CRM 정산 데이터
            settlementData.monthlyData.forEach(item => {
                const month = parseInt(item.month.replace('월', ''));
                monthlyRevenue[month] = item.amount;
            });
            setDataSource('settlement');
        } else {
            setDataSource('none');
        }

        // 4. 매입 세금계산서를 비용에 추가 (광고비 등)
        purchaseInvoices.forEach(inv => {
            const month = parseInt(inv.issueDate.split('-')[1]);
            monthlyExpenses[month] += inv.totalAmount;
        });

        // 5. 월별 손익 계산
        const monthly: MonthlyPL[] = [];
        let totalRev = 0;
        let totalExp = 0;

        for (let i = 1; i <= 12; i++) {
            const rev = monthlyRevenue[i];
            const exp = monthlyExpenses[i];
            const profit = rev - exp;

            totalRev += rev;
            totalExp += exp;

            monthly.push({
                month: `${i}월`,
                monthNum: i,
                revenue: rev,
                expenses: exp,
                profit: profit
            });
        }

        setMonthlyData(monthly);

        const netProfit = totalRev - totalExp;
        const margin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;

        setSummary({
            totalRevenue: totalRev,
            totalExpenses: totalExp,
            netProfit,
            profitMargin: margin
        });
    };

    // 분기별 데이터 변환
    const getQuarterlyData = () => {
        const quarters = [
            { label: '1분기', months: [1, 2, 3] },
            { label: '2분기', months: [4, 5, 6] },
            { label: '3분기', months: [7, 8, 9] },
            { label: '4분기', months: [10, 11, 12] }
        ];

        return quarters.map(q => {
            const data = monthlyData.filter(m => q.months.includes(m.monthNum));
            return {
                month: q.label,
                revenue: data.reduce((sum, d) => sum + d.revenue, 0),
                expenses: data.reduce((sum, d) => sum + d.expenses, 0),
                profit: data.reduce((sum, d) => sum + d.profit, 0)
            };
        });
    };

    // Excel 내보내기
    const exportToExcel = () => {
        const data = viewMode === 'quarterly' ? getQuarterlyData() : monthlyData;

        const worksheetData = [
            ['손익계산서', `${year}년`],
            [],
            ['기간', '수익', '비용', '순이익'],
            ...data.map(d => [d.month, d.revenue, d.expenses, d.profit]),
            [],
            ['합계', summary.totalRevenue, summary.totalExpenses, summary.netProfit],
            [],
            ['이익률', `${summary.profitMargin.toFixed(1)}%`]
        ];

        const ws = XLSX.utils.aoa_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '손익계산서');
        XLSX.writeFile(wb, `손익계산서_${year}년.xlsx`);
    };

    const displayData = viewMode === 'quarterly' ? getQuarterlyData() : monthlyData;

    return (
        <div className="bg-card text-card-foreground rounded-xl shadow-xs border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h3 className="font-bold text-foreground flex items-center gap-2 text-xs sm:text-sm">
                            <span>📊 손익계산서 (P&L)</span>
                            {dataSource === 'invoice' && (
                                <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 text-2xs rounded-md font-semibold">실제 세금계산서 기반</span>
                            )}
                            {dataSource === 'settlement' && (
                                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-2xs rounded-md font-semibold">CRM 추정치</span>
                            )}
                        </h3>
                        <p className="text-2xs text-muted-foreground mt-0.5">{year}년 수익/비용/순이익 현황</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={viewMode}
                            onChange={e => setViewMode(e.target.value as typeof viewMode)}
                            className="text-xs bg-muted/40 border border-border rounded-lg px-2.5 py-1.5 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                            <option value="monthly" className="bg-popover text-popover-foreground">월별</option>
                            <option value="quarterly" className="bg-popover text-popover-foreground">분기별</option>
                        </select>
                        <button
                            onClick={exportToExcel}
                            className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            📥 <span>Excel</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-5">
                {/* 요약 카드 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="bg-muted/30 p-3.5 rounded-xl border border-border/60">
                        <p className="text-2xs text-muted-foreground font-medium mb-1">총 수익</p>
                        <p className="text-lg font-bold text-foreground font-mono tabular-nums">
                            {summary.totalRevenue.toLocaleString()}원
                        </p>
                    </div>
                    <div className="bg-muted/30 p-3.5 rounded-xl border border-border/60">
                        <p className="text-2xs text-muted-foreground font-medium mb-1">총 비용</p>
                        <p className="text-lg font-bold text-foreground font-mono tabular-nums">
                            {summary.totalExpenses.toLocaleString()}원
                        </p>
                    </div>
                    <div className={`p-3.5 rounded-xl border ${summary.netProfit >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-red-500/10 border-red-500/20'}`}>
                        <p className={`text-2xs font-medium mb-1 ${summary.netProfit >= 0 ? 'text-primary' : 'text-red-500'}`}>순이익</p>
                        <p className={`text-lg font-bold font-mono tabular-nums ${summary.netProfit >= 0 ? 'text-primary' : 'text-red-500'}`}>
                            {summary.netProfit >= 0 ? '+' : ''}{summary.netProfit.toLocaleString()}원
                        </p>
                    </div>
                    <div className="bg-muted/30 p-3.5 rounded-xl border border-border/60">
                        <p className="text-2xs text-muted-foreground font-medium mb-1">이익률</p>
                        <p className="text-lg font-bold text-foreground font-mono tabular-nums">
                            {summary.profitMargin.toFixed(1)}%
                        </p>
                    </div>
                </div>

                {/* 차트 */}
                <div className="h-64 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={displayData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                            <Tooltip
                                formatter={(value: number) => `${value.toLocaleString()}원`}
                                labelFormatter={(label) => `${label}`}
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    borderColor: 'hsl(var(--border))',
                                    borderRadius: '0.75rem',
                                    color: 'hsl(var(--foreground))',
                                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                                }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                            />
                            <Legend />
                            <Bar dataKey="revenue" name="수익" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expenses" name="비용" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 순이익 추이 라인 차트 */}
                <div className="h-44">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">순이익 추이</p>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={displayData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                            <Tooltip
                                formatter={(value: number) => `${value.toLocaleString()}원`}
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    borderColor: 'hsl(var(--border))',
                                    borderRadius: '0.75rem',
                                    color: 'hsl(var(--foreground))',
                                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                                }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="profit"
                                name="순이익"
                                stroke="#10b981"
                                strokeWidth={2}
                                dot={{ fill: '#10b981', r: 3 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* 상세 테이블 */}
                <details className="mt-4 group">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground font-medium py-1">
                        📋 상세 내역 보기
                    </summary>
                    <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-mono text-xs">
                                <tr>
                                    <th className="py-2.5 px-3 text-left font-semibold">기간</th>
                                    <th className="py-2.5 px-3 text-right font-semibold">수익</th>
                                    <th className="py-2.5 px-3 text-right font-semibold">비용</th>
                                    <th className="py-2.5 px-3 text-right font-semibold">순이익</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {displayData.map((d, idx) => (
                                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                        <td className="py-2.5 px-3 text-foreground font-medium">{d.month}</td>
                                        <td className="py-2.5 px-3 text-right text-foreground font-mono tabular-nums">
                                            {d.revenue.toLocaleString()}
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-foreground font-mono tabular-nums">
                                            {d.expenses.toLocaleString()}
                                        </td>
                                        <td className={`py-2.5 px-3 text-right font-medium font-mono tabular-nums ${d.profit >= 0 ? 'text-primary' : 'text-red-500'}`}>
                                            {d.profit >= 0 ? '+' : ''}{d.profit.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-muted/60 font-bold border-t-2 border-border text-foreground">
                                    <td className="py-2.5 px-3">합계</td>
                                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                                        {summary.totalRevenue.toLocaleString()}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                                        {summary.totalExpenses.toLocaleString()}
                                    </td>
                                    <td className={`py-2.5 px-3 text-right font-mono tabular-nums ${summary.netProfit >= 0 ? 'text-primary' : 'text-red-500'}`}>
                                        {summary.netProfit >= 0 ? '+' : ''}{summary.netProfit.toLocaleString()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </details>
            </div>
        </div>
    );
};

export default ProfitLossSection;
