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
        // 지출 데이터 가져오기
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

        // 월별 수익 (정산 데이터 또는 세금계산서 매출)
        const taxInvoices = fetchTaxInvoices(year);
        const salesInvoices = taxInvoices.filter(inv => inv.type === '매출');

        const monthlyRevenue: Record<number, number> = {};
        for (let i = 1; i <= 12; i++) {
            monthlyRevenue[i] = 0;
        }

        // 정산 데이터가 있으면 사용, 없으면 세금계산서 매출 사용
        if (settlementData?.monthlyData) {
            settlementData.monthlyData.forEach(item => {
                const month = parseInt(item.month.replace('월', ''));
                monthlyRevenue[month] = item.amount;
            });
        } else {
            salesInvoices.forEach(inv => {
                const month = parseInt(inv.issueDate.split('-')[1]);
                monthlyRevenue[month] += inv.totalAmount;
            });
        }

        // 월별 손익 계산
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
            totalRevenue: settlementData?.totalRevenue || totalRev,
            totalExpenses: totalExp,
            netProfit: (settlementData?.totalRevenue || totalRev) - totalExp,
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
        <div className="bg-white rounded-xl shadow-sm border border-emerald-100 overflow-hidden">
            <div className="p-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-green-50">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-emerald-700 flex items-center gap-2">
                            📊 손익계산서 (P&L)
                        </h3>
                        <p className="text-xs text-emerald-500 mt-1">{year}년 수익/비용/순이익 현황</p>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={viewMode}
                            onChange={e => setViewMode(e.target.value as typeof viewMode)}
                            className="text-sm border border-emerald-300 rounded-lg px-2 py-1"
                        >
                            <option value="monthly">월별</option>
                            <option value="quarterly">분기별</option>
                        </select>
                        <button
                            onClick={exportToExcel}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 flex items-center gap-1"
                        >
                            📥 Excel
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4">
                {/* 요약 카드 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <p className="text-xs text-blue-600">총 수익</p>
                        <p className="text-lg font-bold text-blue-700">
                            {summary.totalRevenue.toLocaleString()}원
                        </p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                        <p className="text-xs text-red-600">총 비용</p>
                        <p className="text-lg font-bold text-red-700">
                            {summary.totalExpenses.toLocaleString()}원
                        </p>
                    </div>
                    <div className={`p-3 rounded-lg border ${summary.netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <p className={`text-xs ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>순이익</p>
                        <p className={`text-lg font-bold ${summary.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {summary.netProfit >= 0 ? '+' : ''}{summary.netProfit.toLocaleString()}원
                        </p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                        <p className="text-xs text-purple-600">이익률</p>
                        <p className="text-lg font-bold text-purple-700">
                            {summary.profitMargin.toFixed(1)}%
                        </p>
                    </div>
                </div>

                {/* 차트 */}
                <div className="h-64 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={displayData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" fontSize={12} />
                            <YAxis fontSize={10} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                            <Tooltip
                                formatter={(value: number) => `${value.toLocaleString()}원`}
                                labelFormatter={(label) => `${label}`}
                            />
                            <Legend />
                            <Bar dataKey="revenue" name="수익" fill="#3b82f6" />
                            <Bar dataKey="expenses" name="비용" fill="#ef4444" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 순이익 추이 라인 차트 */}
                <div className="h-40">
                    <p className="text-sm text-gray-600 mb-2">순이익 추이</p>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={displayData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" fontSize={12} />
                            <YAxis fontSize={10} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                            <Tooltip formatter={(value: number) => `${value.toLocaleString()}원`} />
                            <Line
                                type="monotone"
                                dataKey="profit"
                                name="순이익"
                                stroke="#10b981"
                                strokeWidth={2}
                                dot={{ fill: '#10b981' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* 상세 테이블 */}
                <details className="mt-4">
                    <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                        📋 상세 내역 보기
                    </summary>
                    <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-emerald-50 text-emerald-700">
                                <tr>
                                    <th className="py-2 px-3 text-left">기간</th>
                                    <th className="py-2 px-3 text-right">수익</th>
                                    <th className="py-2 px-3 text-right">비용</th>
                                    <th className="py-2 px-3 text-right">순이익</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayData.map((d, idx) => (
                                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-2 px-3">{d.month}</td>
                                        <td className="py-2 px-3 text-right text-blue-600">
                                            {d.revenue.toLocaleString()}
                                        </td>
                                        <td className="py-2 px-3 text-right text-red-600">
                                            {d.expenses.toLocaleString()}
                                        </td>
                                        <td className={`py-2 px-3 text-right font-medium ${d.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {d.profit >= 0 ? '+' : ''}{d.profit.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-50 font-bold">
                                    <td className="py-2 px-3">합계</td>
                                    <td className="py-2 px-3 text-right text-blue-700">
                                        {summary.totalRevenue.toLocaleString()}
                                    </td>
                                    <td className="py-2 px-3 text-right text-red-700">
                                        {summary.totalExpenses.toLocaleString()}
                                    </td>
                                    <td className={`py-2 px-3 text-right ${summary.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
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
