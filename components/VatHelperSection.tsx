import React, { useState, useEffect } from 'react';
import { fetchTaxInvoices, getTaxInvoiceStats } from '../services/api';
import { TaxInvoice } from '../types';
import * as XLSX from 'xlsx';

interface VatHelperSectionProps {
    year: number;
}

interface QuarterlyVat {
    quarter: string;
    period: string;
    deadline: string;
    salesAmount: number;
    salesVat: number;
    purchaseAmount: number;
    purchaseVat: number;
    vatPayable: number;
    invoiceCount: number;
}

const VatHelperSection: React.FC<VatHelperSectionProps> = ({ year }) => {
    const [quarterlyData, setQuarterlyData] = useState<QuarterlyVat[]>([]);
    const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.ceil((new Date().getMonth() + 1) / 3));
    const [invoices, setInvoices] = useState<TaxInvoice[]>([]);

    // 분기별 기간 및 신고 마감일 정의
    const quarterInfo = [
        { quarter: 1, period: '1~3월', deadline: `${year}-04-25`, months: [1, 2, 3] },
        { quarter: 2, period: '4~6월', deadline: `${year}-07-25`, months: [4, 5, 6] },
        { quarter: 3, period: '7~9월', deadline: `${year}-10-25`, months: [7, 8, 9] },
        { quarter: 4, period: '10~12월', deadline: `${year + 1}-01-25`, months: [10, 11, 12] }
    ];

    useEffect(() => {
        calculateQuarterlyVat();
    }, [year]);

    const calculateQuarterlyVat = async () => {
        const allInvoices = await fetchTaxInvoices(year);
        setInvoices(allInvoices);

        const quarterly: QuarterlyVat[] = quarterInfo.map(q => {
            const qInvoices = allInvoices.filter(inv => {
                const month = parseInt(inv.issueDate.split('-')[1]);
                return q.months.includes(month);
            });

            const sales = qInvoices.filter(inv => inv.type === '매출');
            const purchases = qInvoices.filter(inv => inv.type === '매입');

            const salesAmount = sales.reduce((sum, inv) => sum + inv.supplyAmount, 0);
            const salesVat = sales.reduce((sum, inv) => sum + inv.vatAmount, 0);
            const purchaseAmount = purchases.reduce((sum, inv) => sum + inv.supplyAmount, 0);
            const purchaseVat = purchases.reduce((sum, inv) => sum + inv.vatAmount, 0);

            return {
                quarter: `${q.quarter}분기`,
                period: q.period,
                deadline: q.deadline,
                salesAmount,
                salesVat,
                purchaseAmount,
                purchaseVat,
                vatPayable: salesVat - purchaseVat,
                invoiceCount: qInvoices.length
            };
        });

        setQuarterlyData(quarterly);
    };

    // 선택된 분기의 세금계산서 필터링
    const getQuarterInvoices = () => {
        const q = quarterInfo[selectedQuarter - 1];
        return invoices.filter(inv => {
            const month = parseInt(inv.issueDate.split('-')[1]);
            return q.months.includes(month);
        });
    };

    // Excel 내보내기
    const exportToExcel = () => {
        const q = quarterInfo[selectedQuarter - 1];
        const qInvoices = getQuarterInvoices();

        // 요약 시트
        const summaryData = [
            ['부가세 신고 도우미', `${year}년 ${selectedQuarter}분기`],
            [],
            ['신고 기간', q.period],
            ['신고 마감일', q.deadline],
            [],
            ['구분', '공급가액', '세액'],
            ['매출', quarterlyData[selectedQuarter - 1]?.salesAmount || 0, quarterlyData[selectedQuarter - 1]?.salesVat || 0],
            ['매입', quarterlyData[selectedQuarter - 1]?.purchaseAmount || 0, quarterlyData[selectedQuarter - 1]?.purchaseVat || 0],
            [],
            ['납부세액', '', quarterlyData[selectedQuarter - 1]?.vatPayable || 0]
        ];

        // 세금계산서 목록 시트
        const invoiceData = [
            ['세금계산서 목록'],
            [],
            ['유형', '발행일', '거래처', '사업자번호', '공급가액', '세액', '합계', '전자여부'],
            ...qInvoices.map(inv => [
                inv.type,
                inv.issueDate,
                inv.companyName,
                inv.businessNumber,
                inv.supplyAmount,
                inv.vatAmount,
                inv.totalAmount,
                inv.isElectronic ? 'Y' : 'N'
            ])
        ];

        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
        const ws2 = XLSX.utils.aoa_to_sheet(invoiceData);
        XLSX.utils.book_append_sheet(wb, ws1, '부가세요약');
        XLSX.utils.book_append_sheet(wb, ws2, '세금계산서목록');
        XLSX.writeFile(wb, `부가세신고_${year}년_${selectedQuarter}분기.xlsx`);
    };

    // D-day 계산
    const getDaysLeft = (deadline: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(deadline);
        const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const currentQuarterData = quarterlyData[selectedQuarter - 1];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden">
            <div className="p-3 md:p-4 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-yellow-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                        <h3 className="font-bold text-amber-700 flex items-center gap-2 text-sm md:text-base">
                            🧾 부가세 신고 도우미
                        </h3>
                        <p className="text-xs text-amber-500 mt-0.5">{year}년 분기별 부가세 계산</p>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={selectedQuarter}
                            onChange={e => setSelectedQuarter(parseInt(e.target.value))}
                            className="text-xs md:text-sm border border-amber-300 rounded-lg px-2 py-1"
                        >
                            <option value={1}>1분기</option>
                            <option value={2}>2분기</option>
                            <option value={3}>3분기</option>
                            <option value={4}>4분기</option>
                        </select>
                        <button
                            onClick={exportToExcel}
                            className="px-2 md:px-3 py-1 md:py-1.5 bg-amber-600 text-white text-xs md:text-sm rounded-lg hover:bg-amber-700 flex items-center gap-1"
                        >
                            📥 <span className="hidden md:inline">Excel</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4">
                {/* 분기별 요약 카드 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                    {quarterlyData.map((q, idx) => {
                        const daysLeft = getDaysLeft(q.deadline);
                        const isSelected = idx + 1 === selectedQuarter;
                        const isPast = daysLeft < 0;
                        const isUrgent = daysLeft >= 0 && daysLeft <= 7;

                        return (
                            <button
                                key={idx}
                                onClick={() => setSelectedQuarter(idx + 1)}
                                className={`p-2 md:p-3 rounded-lg border text-left transition-all ${isSelected
                                    ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300'
                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                    }`}
                            >
                                <p className="text-xs md:text-sm font-medium">{q.quarter}</p>
                                <p className={`text-base md:text-lg font-bold ${q.vatPayable >= 0 ? 'text-amber-700' : 'text-green-700'}`}>
                                    {q.vatPayable >= 0 ? '' : '-'}{Math.abs(q.vatPayable).toLocaleString()}
                                </p>
                                <p className={`text-xs ${isPast ? 'text-gray-400' : isUrgent ? 'text-red-500' : 'text-gray-500'}`}>
                                    {isPast ? '신고완료' : `D-${daysLeft}`}
                                </p>
                            </button>
                        );
                    })}
                </div>

                {/* 선택된 분기 상세 */}
                {currentQuarterData && (
                    <div className="space-y-4">
                        {/* 신고 정보 */}
                        <div className="flex items-center justify-between bg-amber-50 p-3 rounded-lg">
                            <div>
                                <p className="text-sm text-amber-700">
                                    <strong>{selectedQuarter}분기</strong> 신고 기간: {quarterInfo[selectedQuarter - 1].period}
                                </p>
                                <p className="text-xs text-amber-600">
                                    마감일: {quarterInfo[selectedQuarter - 1].deadline}
                                </p>
                            </div>
                            {(() => {
                                const daysLeft = getDaysLeft(quarterInfo[selectedQuarter - 1].deadline);
                                if (daysLeft < 0) {
                                    return <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">신고 완료</span>;
                                } else if (daysLeft <= 7) {
                                    return <span className="text-sm text-red-600 bg-red-100 px-2 py-1 rounded animate-pulse">D-{daysLeft} ⚠️</span>;
                                } else {
                                    return <span className="text-sm text-amber-600 bg-amber-100 px-2 py-1 rounded">D-{daysLeft}</span>;
                                }
                            })()}
                        </div>

                        {/* 부가세 계산 테이블 */}
                        <div className="overflow-x-auto" style={{ overscrollBehavior: 'auto' }}>
                            <table className="w-full text-sm">
                                <thead className="bg-amber-50 text-amber-700">
                                    <tr>
                                        <th className="py-2 px-3 text-left">구분</th>
                                        <th className="py-2 px-3 text-right">공급가액</th>
                                        <th className="py-2 px-3 text-right">세액</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b">
                                        <td className="py-3 px-3 font-medium text-green-600">매출</td>
                                        <td className="py-3 px-3 text-right">{currentQuarterData.salesAmount.toLocaleString()}원</td>
                                        <td className="py-3 px-3 text-right">{currentQuarterData.salesVat.toLocaleString()}원</td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-3 px-3 font-medium text-red-600">매입 (-)</td>
                                        <td className="py-3 px-3 text-right">{currentQuarterData.purchaseAmount.toLocaleString()}원</td>
                                        <td className="py-3 px-3 text-right">{currentQuarterData.purchaseVat.toLocaleString()}원</td>
                                    </tr>
                                    <tr className="bg-amber-100 font-bold">
                                        <td className="py-3 px-3" colSpan={2}>
                                            {currentQuarterData.vatPayable >= 0 ? '납부할 세액' : '환급받을 세액'}
                                        </td>
                                        <td className={`py-3 px-3 text-right text-lg ${currentQuarterData.vatPayable >= 0 ? 'text-amber-700' : 'text-green-700'}`}>
                                            {currentQuarterData.vatPayable >= 0 ? '' : '-'}
                                            {Math.abs(currentQuarterData.vatPayable).toLocaleString()}원
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* 세금계산서 수 */}
                        <div className="text-center text-sm text-gray-500">
                            이 분기 등록된 세금계산서: <strong>{currentQuarterData.invoiceCount}건</strong>
                        </div>

                        {/* 안내 메시지 */}
                        {currentQuarterData.invoiceCount === 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                                <p className="text-yellow-700 text-sm">
                                    ⚠️ 이 분기에 등록된 세금계산서가 없습니다.
                                </p>
                                <p className="text-yellow-600 text-xs mt-1">
                                    세금계산서 관리에서 매입/매출 세금계산서를 등록해주세요.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VatHelperSection;
