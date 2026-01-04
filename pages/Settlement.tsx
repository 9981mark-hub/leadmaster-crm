
import React, { useEffect, useState } from 'react';
import { fetchCases, fetchPartners } from '../services/api';
import { Case, Partner } from '../types';
import { calculateCommission, calculateNextSettlement } from '../utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CheckCircle, Building, Wallet, Search } from 'lucide-react';
import Modal from '../components/Modal';

export default function Settlement() {
    const [cases, setCases] = useState<Case[]>([]);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState<number | 'all'>('all'); // Month Filter State
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    useEffect(() => {
        Promise.all([fetchCases(), fetchPartners()]).then(([c, p]) => {
            setCases(c);
            setPartners(p);
            if (p.length > 0) setSelectedPartnerId(p[0].partnerId);
            setLoading(false);
        });
    }, []);

    if (loading) return <div>로딩중...</div>;

    const isAll = selectedPartnerId === 'all';
    const currentPartner = !isAll ? partners.find(p => p.partnerId === selectedPartnerId) : null;

    // 1. Filter by Partner
    const partnerCases = isAll
        ? cases
        : cases.filter(c => c.partnerId === selectedPartnerId);

    // Helper to calculate commission for a specific case (dynamically finding rule)
    const getCommissionForCase = (c: Case) => {
        const p = partners.find(partner => partner.partnerId === c.partnerId);
        if (!p) return 0;
        return calculateCommission(c.contractFee || 0, p.commissionRules);
    };

    // 2. Filter by Year & Month for Statistics (KPIs)
    const statsCases = partnerCases.filter(c => {
        if (!c.contractAt) return false;
        const cDate = new Date(c.contractAt);
        const cYear = cDate.getFullYear();
        const cMonth = cDate.getMonth() + 1; // 0-based to 1-based

        const yearMatch = cYear === year;
        const monthMatch = month === 'all' || cMonth === month;

        return yearMatch && monthMatch;
    });

    // Calculate KPIs based on statsCases (Selected Period)
    const totalCount = statsCases.length;
    const totalRevenue = statsCases.reduce((sum, c) => sum + (c.contractFee || 0), 0);
    const totalCommission = statsCases.reduce((sum, c) => sum + getCommissionForCase(c), 0);

    // Missing date count is global/partner specific but not time-bound (warnings)
    const missingDateCount = partnerCases.filter(c => ['계약 완료', '1차 입금완료', '2차 입금완료'].includes(c.status) && !c.contractAt).length;


    // 3. Monthly Aggregate Data for Chart (Always Annual Context)
    const monthlyStats = Array.from({ length: 12 }, (_, i) => {
        const monthStr = `${year}-${String(i + 1).padStart(2, '0')}`;
        const monthCases = partnerCases.filter(c => c.contractAt && c.contractAt.startsWith(monthStr));

        const revenue = monthCases.reduce((sum, c) => sum + (c.contractFee || 0), 0);
        const commission = monthCases.reduce((sum, c) => sum + getCommissionForCase(c), 0);

        return {
            name: `${i + 1}월`,
            count: monthCases.length,
            revenue,
            commission
        };
    });

    // Next Settlement Info Calculation
    let nextInfo = null;
    if (isAll) {
        // Aggregate all partners
        let totalDeposit = 0;
        let totalExpected = 0;
        partners.forEach(p => {
            const info = calculateNextSettlement(cases, p);
            totalDeposit += info.currentTotalDeposit;
            totalExpected += info.expectedCommission;
        });
        nextInfo = {
            currentTotalDeposit: totalDeposit,
            expectedCommission: totalExpected,
            isEligible: totalExpected > 0,
            // Generic Text for All
            title: "전체 거래처 합산",
            desc: "모든 거래처의 다음 정산 예정 금액 합계입니다."
        };
    } else if (currentPartner) {
        const info = calculateNextSettlement(cases, currentPartner);
        nextInfo = {
            ...info,
            title: `다음 정산 요약 (${currentPartner.name})`,
            desc: `매주 ${info.cutoffDayName}요일 마감, ${currentPartner.settlementConfig.payoutWeekDelay === 0 ? '금주' : '차주'} ${info.payoutDayName}요일(${info.payoutDate}) 지급`
        };
    }

    // Helper to get partner name safely
    const getPartnerName = (pid: string) => partners.find(p => p.partnerId === pid)?.name || '-';

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800">정산 리포트</h2>

                <div className="flex gap-2 items-center flex-wrap">
                    <div className="relative">
                        <select
                            className="bg-white border p-2 pl-9 rounded text-lg font-bold text-indigo-700 min-w-[200px] outline-none cursor-pointer"
                            value={selectedPartnerId}
                            onChange={e => setSelectedPartnerId(e.target.value)}
                        >
                            <option value="all">전체 통계 (Total)</option>
                            {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                        </select>
                        <Building className="absolute left-3 top-3 text-indigo-500" size={18} />
                    </div>

                    <select
                        className="bg-white border p-2 rounded text-lg font-bold cursor-pointer min-w-[100px]"
                        value={year}
                        onChange={e => setYear(Number(e.target.value))}
                    >
                        <option value={2024}>2024년</option>
                        <option value={2025}>2025년</option>
                    </select>

                    <select
                        className="bg-white border p-2 rounded text-lg font-bold cursor-pointer min-w-[100px]"
                        value={month}
                        onChange={e => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    >
                        <option value="all">전체 월</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>{m}월</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Next Settlement Banner */}
            {nextInfo && (
                <div className={`rounded-xl shadow-sm border p-6 bg-green-50 border-green-200`}>
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                            <h3 className="text-lg font-bold flex items-center text-green-800">
                                {isAll ? <Wallet className="mr-2" /> : <CheckCircle className="mr-2" />}
                                {nextInfo.title}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                                {nextInfo.desc}
                            </p>
                        </div>
                        <div className="min-w-[200px] text-right">
                            <p className="text-sm text-gray-500 mb-1">정산 대상 누적 입금액</p>
                            <p className="text-2xl font-bold text-gray-900">{nextInfo.currentTotalDeposit.toLocaleString()}만원</p>
                            <p className="text-lg text-green-700 font-bold mt-1">지급 예정 수당: {nextInfo.expectedCommission.toLocaleString()}만원</p>
                        </div>
                    </div>

                    {!isAll && currentPartner && (
                        <div className="mt-4 bg-white/50 p-3 rounded-lg text-xs text-gray-600">
                            <p>💡 지급 기준 안내:</p>
                            <ul className="list-disc pl-4 mt-1 space-y-1">
                                <li>완납 기준액 이상 입금: 수당 100% 지급</li>
                                <li>계약금({currentPartner.settlementConfig.downPaymentPercentage}%) 이상 입금: 수당 {currentPartner.settlementConfig.firstPayoutPercentage}% 선지급</li>
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div
                    onClick={() => setIsDetailModalOpen(true)}
                    className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-all group"
                >
                    <div className="flex justify-between items-start">
                        <p className="text-sm text-gray-500">총 계약 건수 ({month === 'all' ? '연간' : `${month}월`})</p>
                        <Search size={16} className="text-gray-300 group-hover:text-blue-500" />
                    </div>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{totalCount}건</p>
                    <p className="text-xs text-blue-500 mt-2 font-medium">클릭하여 상세 내역 보기 &rarr;</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">총 매출 (수임료)</p>
                    <p className="text-3xl font-bold text-blue-600 mt-1">{totalRevenue.toLocaleString()}만원</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">총 기대 수익 (전액)</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">{totalCommission.toLocaleString()}만원</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">계약일 누락</p>
                    <p className="text-3xl font-bold text-red-500 mt-1">{missingDateCount}건</p>
                    <p className="text-xs text-red-400 mt-2">정산 집계 제외됨</p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80 flex flex-col">
                <h3 className="text-lg font-bold text-gray-700 mb-4 flex-shrink-0">월별 매출 추이 ({isAll ? '전체' : currentPartner?.name})</h3>
                <div className="flex-1 min-h-0 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyStats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip
                                formatter={(value: number) => [`${value.toLocaleString()}만원`, '']}
                            />
                            <Bar dataKey="revenue" fill="#3b82f6" name="매출" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="commission" fill="#10b981" name="예상 수당(Full)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Monthly Summary Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-700">월별 요약</h3>
                </div>
                <table className="w-full text-sm text-center">
                    <thead className="bg-gray-50 text-gray-600 font-medium">
                        <tr>
                            <th className="py-3">월</th>
                            <th className="py-3">계약 건수</th>
                            <th className="py-3">매출</th>
                            <th className="py-3">수당 (예상 Full)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {monthlyStats.map((m, i) => (
                            <tr key={i} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 ${month === (i + 1) ? 'bg-blue-50' : ''}`}>
                                <td className="py-3 font-medium">{m.name}</td>
                                <td className="py-3 text-gray-500">{m.count}</td>
                                <td className="py-3 text-blue-600">{m.revenue.toLocaleString()}</td>
                                <td className="py-3 text-green-600 font-bold">{m.commission.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Detail Breakdown Modal */}
            <Modal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                title={`${year}년 ${month === 'all' ? '전체' : month + '월'} 계약 및 정산 상세 내역`}
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-gray-100 text-gray-700 font-bold">
                            <tr>
                                <th className="px-4 py-2">계약일</th>
                                <th className="px-4 py-2">고객명</th>
                                <th className="px-4 py-2">거래처</th>
                                <th className="px-4 py-2">상태</th>
                                <th className="px-4 py-2 text-right">수임료</th>
                                <th className="px-4 py-2 text-right">수당(Rule)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {statsCases.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                        해당 기간에 완료된 계약 건이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                statsCases
                                    .sort((a, b) => (b.contractAt || '').localeCompare(a.contractAt || ''))
                                    .map(c => {
                                        const commission = getCommissionForCase(c);
                                        return (
                                            <tr key={c.caseId} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-gray-600">{c.contractAt}</td>
                                                <td className="px-4 py-2 font-medium text-gray-900">{c.customerName}</td>
                                                <td className="px-4 py-2 text-gray-500">{getPartnerName(c.partnerId)}</td>
                                                <td className="px-4 py-2">
                                                    <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 border border-gray-200">
                                                        {c.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-right text-blue-600 font-medium">
                                                    {c.contractFee?.toLocaleString()}만원
                                                </td>
                                                <td className="px-4 py-2 text-right text-green-600 font-bold">
                                                    {commission.toLocaleString()}만원
                                                </td>
                                            </tr>
                                        );
                                    })
                            )}
                        </tbody>
                        {statsCases.length > 0 && (
                            <tfoot className="bg-gray-50 font-bold">
                                <tr>
                                    <td colSpan={4} className="px-4 py-2 text-center text-gray-700">합계</td>
                                    <td className="px-4 py-2 text-right text-blue-700">{totalRevenue.toLocaleString()}만원</td>
                                    <td className="px-4 py-2 text-right text-green-700">{totalCommission.toLocaleString()}만원</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={() => setIsDetailModalOpen(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
                    >
                        닫기
                    </button>
                </div>
            </Modal>
        </div>
    );
}
