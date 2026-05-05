import React, { useState, useEffect } from 'react';
import { fetchTaxInvoices } from '../services/api';
import { TaxInvoice } from '../types';
import * as XLSX from 'xlsx';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface VatHelperSectionProps {
    year: number;
}

// 개인 일반과세자: 1기(1~6월), 2기(7~12월) 반기 구조
// 예정고지(4월, 10월)는 신고가 아닌 고지 납부
interface SemiAnnualVat {
    period: '1기' | '2기';
    months: number[];
    label: string;               // "1~6월"
    filingDeadline: string;      // 확정신고 마감
    preNoticeDate: string;       // 예정고지 납부일 (4월/10월)
    preNoticePeriod: string;     // 예정고지 대상 기간 라벨
    salesAmount: number;
    salesVat: number;
    purchaseAmount: number;
    purchaseVat: number;
    vatPayable: number;
    invoiceCount: number;
    firstHalfSalesVat?: number;  // 예정고지 계산용 (1~3월 or 7~9월 세액)
}

// 업종별 월별 체크리스트
const INDUSTRY_CHECKLIST = [
    { icon: '📢', industry: '광고대행업', tasks: ['매출 인식 기준 확인 (대행 vs 직접)', '클라이언트 세금계산서 발행', '외주 디자이너/마케터 원천세 신고', '매체비 영수증·카드전표 수집'] },
    { icon: '🛒', industry: '전자상거래', tasks: ['스마트스토어/쿠팡/자사몰 정산 다운로드', '카드매출·현금영수증·계좌입금 대조', '반품·취소·수수료 확인', '플랫폼 매출 ≠ 입금액 대사'] },
    { icon: '💻', industry: '소프트웨어 개발', tasks: ['계약서 보관 및 공급시기 확인', '검수 완료 후 세금계산서 발행', 'SaaS/구독 매출 월별 정산', '해외 고객 영세율 증빙 관리'] },
];

const VatHelperSection: React.FC<VatHelperSectionProps> = ({ year }) => {
    const [semiAnnualData, setSemiAnnualData] = useState<SemiAnnualVat[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<'1기' | '2기'>(() => {
        const m = new Date().getMonth() + 1;
        return m <= 6 ? '1기' : '2기';
    });
    const [invoices, setInvoices] = useState<TaxInvoice[]>([]);
    const [activeTab, setActiveTab] = useState<'calculator' | 'checklist'>('calculator');

    // 2026 실제 마감일 (공휴일 반영)
    const PERIOD_INFO: SemiAnnualVat[] = [
        {
            period: '1기', months: [1,2,3,4,5,6], label: '1~6월',
            filingDeadline: year === 2026 ? '2026-07-27' : `${year}-07-25`,
            preNoticeDate: year === 2026 ? '2026-04-27' : `${year}-04-25`,
            preNoticePeriod: '1~3월',
            salesAmount: 0, salesVat: 0, purchaseAmount: 0, purchaseVat: 0, vatPayable: 0, invoiceCount: 0,
        },
        {
            period: '2기', months: [7,8,9,10,11,12], label: '7~12월',
            filingDeadline: year === 2026 ? `${year+1}-01-25` : `${year+1}-01-25`,
            preNoticeDate: year === 2026 ? '2026-10-26' : `${year}-10-25`,
            preNoticePeriod: '7~9월',
            salesAmount: 0, salesVat: 0, purchaseAmount: 0, purchaseVat: 0, vatPayable: 0, invoiceCount: 0,
        }
    ];

    useEffect(() => {
        calculateSemiAnnualVat();
    }, [year]);

    const calculateSemiAnnualVat = async () => {
        const allInvoices = await fetchTaxInvoices(year);
        setInvoices(allInvoices);

        const data: SemiAnnualVat[] = PERIOD_INFO.map(info => {
            const pInvoices = allInvoices.filter(inv => {
                const m = parseInt(inv.issueDate.split('-')[1]);
                return info.months.includes(m);
            });

            const firstHalfMonths = info.period === '1기' ? [1,2,3] : [7,8,9];
            const firstHalfSales = allInvoices.filter(inv => {
                const m = parseInt(inv.issueDate.split('-')[1]);
                return firstHalfMonths.includes(m) && inv.type === '매출';
            });
            const firstHalfSalesVat = firstHalfSales.reduce((s, i) => s + i.vatAmount, 0);

            const sales = pInvoices.filter(i => i.type === '매출');
            const purchases = pInvoices.filter(i => i.type === '매입');
            const salesAmount = sales.reduce((s, i) => s + i.supplyAmount, 0);
            const salesVat = sales.reduce((s, i) => s + i.vatAmount, 0);
            const purchaseAmount = purchases.reduce((s, i) => s + i.supplyAmount, 0);
            const purchaseVat = purchases.reduce((s, i) => s + i.vatAmount, 0);

            return {
                ...info,
                salesAmount, salesVat, purchaseAmount, purchaseVat,
                vatPayable: salesVat - purchaseVat,
                invoiceCount: pInvoices.length,
                firstHalfSalesVat,
            };
        });

        setSemiAnnualData(data);
    };

    const getDaysLeft = (deadline: string) => {
        const today = new Date(); today.setHours(0,0,0,0);
        const due = new Date(deadline);
        return Math.ceil((due.getTime() - today.getTime()) / 86400000);
    };

    const exportToExcel = () => {
        const d = semiAnnualData.find(d => d.period === selectedPeriod);
        if (!d) return;

        const pInvoices = invoices.filter(inv => {
            const m = parseInt(inv.issueDate.split('-')[1]);
            return d.months.includes(m);
        });

        const summaryData = [
            ['부가세 신고 도우미', `${year}년 ${d.period} (${d.label})`],
            [],
            ['신고 기간', d.label],
            ['확정신고 마감일', d.filingDeadline],
            ['예정고지 납부일', d.preNoticeDate],
            [],
            ['구분', '공급가액', '세액'],
            ['매출', d.salesAmount, d.salesVat],
            ['매입(-)', d.purchaseAmount, d.purchaseVat],
            [],
            [d.vatPayable >= 0 ? '납부할 세액' : '환급받을 세액', '', Math.abs(d.vatPayable)],
        ];

        const invoiceData = [
            ['세금계산서 목록'],
            [],
            ['유형','발행일','거래처','사업자번호','공급가액','세액','합계','전자여부'],
            ...pInvoices.map(i => [i.type, i.issueDate, i.companyName, i.businessNumber, i.supplyAmount, i.vatAmount, i.totalAmount, i.isElectronic ? 'Y' : 'N'])
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), '부가세요약');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(invoiceData), '세금계산서목록');
        XLSX.writeFile(wb, `부가세신고_${year}년_${d.period}.xlsx`);
    };

    const current = semiAnnualData.find(d => d.period === selectedPeriod);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden">
            {/* Header */}
            <div className="p-3 md:p-4 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-yellow-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                        <h3 className="font-bold text-amber-700 flex items-center gap-2 text-sm md:text-base">
                            🧾 부가세 신고 도우미
                        </h3>
                        <p className="text-xs text-amber-500 mt-0.5">{year}년 · 개인 일반과세자 반기 신고 기준</p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <div className="flex bg-amber-100 rounded-lg p-0.5">
                            {(['1기','2기'] as const).map(p => (
                                <button key={p}
                                    onClick={() => setSelectedPeriod(p)}
                                    className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${selectedPeriod === p ? 'bg-amber-600 text-white shadow-sm' : 'text-amber-700 hover:bg-amber-200'}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                        <button onClick={exportToExcel}
                            className="px-2 md:px-3 py-1 md:py-1.5 bg-amber-600 text-white text-xs md:text-sm rounded-lg hover:bg-amber-700 flex items-center gap-1">
                            📥 <span className="hidden md:inline">Excel</span>
                        </button>
                    </div>
                </div>

                {/* Tab */}
                <div className="flex gap-2 mt-3">
                    <button onClick={() => setActiveTab('calculator')}
                        className={`px-3 py-1 text-xs rounded-full border transition-all ${activeTab === 'calculator' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-700 border-amber-300'}`}>
                        세액 계산기
                    </button>
                    <button onClick={() => setActiveTab('checklist')}
                        className={`px-3 py-1 text-xs rounded-full border transition-all ${activeTab === 'checklist' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-700 border-amber-300'}`}>
                        업종별 체크리스트
                    </button>
                </div>
            </div>

            <div className="p-4">
                {activeTab === 'calculator' && (
                    <>
                        {/* 기간 카드 2개 */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {semiAnnualData.map(d => {
                                const daysLeft = getDaysLeft(d.filingDeadline);
                                const isSelected = d.period === selectedPeriod;
                                const isPast = daysLeft < 0;
                                const isUrgent = daysLeft >= 0 && daysLeft <= 14;

                                return (
                                    <button key={d.period} onClick={() => setSelectedPeriod(d.period)}
                                        className={`p-3 rounded-xl border text-left transition-all ${isSelected ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-sm font-bold text-gray-800">{d.period} <span className="text-gray-500 font-normal text-xs">({d.label})</span></p>
                                                <p className={`text-xl font-bold mt-1 ${d.vatPayable >= 0 ? 'text-amber-700' : 'text-green-700'}`}>
                                                    {d.vatPayable >= 0 ? '' : '-'}{Math.abs(d.vatPayable).toLocaleString()}원
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">확정신고 {d.filingDeadline}</p>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isPast ? 'bg-gray-100 text-gray-400' : isUrgent ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-amber-100 text-amber-700'}`}>
                                                {isPast ? '완료' : `D-${daysLeft}`}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* 선택된 기 상세 */}
                        {current && (
                            <div className="space-y-4">
                                {/* 예정고지 안내 */}
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                                    <Info size={15} className="text-blue-500 mt-0.5 shrink-0" />
                                    <div className="text-xs text-blue-700">
                                        <strong>예정고지 납부</strong> ({current.preNoticePeriod}): <strong>{current.preNoticeDate}</strong>까지<br />
                                        직전 기 납부세액의 50% 고지. 실제 납부 후 확정신고 시 차감됩니다.
                                        {current.firstHalfSalesVat && current.firstHalfSalesVat > 0 && (
                                            <span> 예상 예정고지액: <strong>{Math.floor(current.firstHalfSalesVat / 2).toLocaleString()}원</strong> (1~3월 매출세액 50%)</span>
                                        )}
                                    </div>
                                </div>

                                {/* 신고 마감일 */}
                                <div className="flex items-center justify-between bg-amber-50 p-3 rounded-lg">
                                    <div>
                                        <p className="text-sm text-amber-700"><strong>{current.period} 확정신고</strong> 대상: {current.label}</p>
                                        <p className="text-xs text-amber-600">마감일: {current.filingDeadline}</p>
                                    </div>
                                    {(() => {
                                        const d = getDaysLeft(current.filingDeadline);
                                        if (d < 0) return <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">신고 완료</span>;
                                        if (d <= 14) return <span className="text-sm text-red-600 bg-red-100 px-2 py-1 rounded animate-pulse">D-{d} ⚠️</span>;
                                        return <span className="text-sm text-amber-600 bg-amber-100 px-2 py-1 rounded">D-{d}</span>;
                                    })()}
                                </div>

                                {/* 세액 테이블 */}
                                <div className="overflow-x-auto" style={{ overscrollBehavior: 'auto' }}>
                                    <table className="w-full text-sm">
                                        <thead className="bg-amber-50 text-amber-700">
                                            <tr>
                                                <th className="py-2 px-3 text-left">구분</th>
                                                <th className="py-2 px-3 text-right">공급가액</th>
                                                <th className="py-2 px-3 text-right">세액 (10%)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b">
                                                <td className="py-3 px-3 font-medium text-green-600">매출 세금계산서</td>
                                                <td className="py-3 px-3 text-right">{current.salesAmount.toLocaleString()}원</td>
                                                <td className="py-3 px-3 text-right text-green-700">{current.salesVat.toLocaleString()}원</td>
                                            </tr>
                                            <tr className="border-b">
                                                <td className="py-3 px-3 font-medium text-red-600">매입 세금계산서 (-)</td>
                                                <td className="py-3 px-3 text-right">{current.purchaseAmount.toLocaleString()}원</td>
                                                <td className="py-3 px-3 text-right text-red-600">{current.purchaseVat.toLocaleString()}원</td>
                                            </tr>
                                            <tr className="bg-amber-100 font-bold">
                                                <td className="py-3 px-3" colSpan={2}>
                                                    {current.vatPayable >= 0 ? '납부할 세액' : '환급받을 세액'}
                                                </td>
                                                <td className={`py-3 px-3 text-right text-lg ${current.vatPayable >= 0 ? 'text-amber-700' : 'text-green-700'}`}>
                                                    {current.vatPayable >= 0 ? '' : '-'}{Math.abs(current.vatPayable).toLocaleString()}원
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* 세금계산서 수 */}
                                <div className="text-center text-sm text-gray-500">
                                    이 기간 등록된 세금계산서: <strong>{current.invoiceCount}건</strong>
                                </div>

                                {current.invoiceCount === 0 && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                                        <p className="text-yellow-700 text-sm">⚠️ 이 기간에 등록된 세금계산서가 없습니다.</p>
                                        <p className="text-yellow-600 text-xs mt-1">세금계산서 관리에서 매입/매출 세금계산서를 등록해주세요.</p>
                                    </div>
                                )}

                                {/* 신고 준비 D-day 체크리스트 */}
                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs font-bold text-gray-700 mb-2">📋 신고 준비 단계별 일정</p>
                                    <div className="space-y-1.5">
                                        {[
                                            { label: 'D-30: 매출자료 다운로드 (플랫폼 정산, 광고비)', done: false },
                                            { label: 'D-14: 매입자료 누락 확인 (세금계산서, 카드전표)', done: false },
                                            { label: 'D-7: 세무대리인 자료 전달', done: false },
                                            { label: 'D-1: 납부 계좌·한도 확인', done: false },
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                                                <div className="w-3 h-3 rounded-full border border-gray-300 shrink-0" />
                                                {item.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'checklist' && (
                    <div className="space-y-4">
                        <p className="text-xs text-gray-500">마크님 업종별 부가세 신고 시 주요 체크 항목입니다.</p>
                        {INDUSTRY_CHECKLIST.map((ind, i) => (
                            <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="p-3 bg-gray-50 border-b border-gray-200">
                                    <h4 className="text-sm font-bold text-gray-700">{ind.icon} {ind.industry}</h4>
                                </div>
                                <div className="p-3 space-y-2">
                                    {ind.tasks.map((task, j) => (
                                        <label key={j} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                            <input type="checkbox" className="rounded text-amber-500" />
                                            {task}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-xs font-bold text-amber-700">⚠️ 특히 주의할 포인트</p>
                            <ul className="text-xs text-amber-700 mt-1 space-y-1 list-disc list-inside">
                                <li>광고비 대납 구조: 클라이언트 받은 금액 전부 vs 순수 대행료 구분</li>
                                <li>플랫폼 정산액 ≠ 과세매출 (수수료·반품·쿠폰 차감)</li>
                                <li>프리랜서 외주비: 원천세 누락 시 가산세 발생</li>
                                <li>2025년 11월 29일 개업 → 2025년 2기 과세기간이 짧음</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VatHelperSection;
