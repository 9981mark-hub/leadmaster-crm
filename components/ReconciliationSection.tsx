import React, { useState, useEffect, useMemo } from 'react';
import { fetchTaxInvoices } from '../services/api';
import { TaxInvoice, SettlementBatch } from '../types';

interface ReconciliationSectionProps {
    year: number;
    batches: SettlementBatch[];
}

interface WeeklyReconciliation {
    weekLabel: string;
    startDate: string;
    endDate: string;
    // CRM 측 (정산 배치)
    crmCommission: number;        // 만원 단위
    crmInvoiceAmount: number;     // 원 단위 (배치의 invoiceInfo)
    crmDealCount: number;
    batchStatus: string;
    // 세금계산서 측 (실제)
    taxInvoices: TaxInvoice[];
    taxTotalAmount: number;       // 원 단위
    taxSupplyAmount: number;
    taxVatAmount: number;
    // 대사 결과
    matchStatus: 'matched' | 'partial' | 'crm_only' | 'invoice_only' | 'mismatch';
    difference: number;           // 원 단위 차이
}

// 주차 라벨에서 월요일 날짜 추출
const getWeekRange = (weekLabel: string, startDate: string, endDate: string) => {
    return { start: startDate, end: endDate };
};

// 날짜가 주차 범위에 포함되는지 확인 (같은 주 기준 월~일)
const isDateInWeek = (dateStr: string, weekStart: string, weekEnd: string): boolean => {
    if (!dateStr || !weekStart || !weekEnd) return false;
    return dateStr >= weekStart && dateStr <= weekEnd;
};

const ReconciliationSection: React.FC<ReconciliationSectionProps> = ({ year, batches }) => {
    const [invoices, setInvoices] = useState<TaxInvoice[]>([]);
    const [filterType, setFilterType] = useState<'all' | 'mismatch' | 'matched'>('all');
    const [showDetail, setShowDetail] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const loaded = await fetchTaxInvoices(year, '매출');
                setInvoices(loaded);
            } catch (e) {
                console.error('Failed to load invoices for reconciliation:', e);
            }
        };
        load();
    }, [year]);

    // 주차별 대사 데이터 생성
    const reconciliationData = useMemo((): WeeklyReconciliation[] => {
        const safeBatches = Array.isArray(batches) ? batches : [];
        if (safeBatches.length === 0 && invoices.length === 0) return [];

        // 배치 기반 주차 목록
        const weekMap = new Map<string, WeeklyReconciliation>();

        // 1. CRM 배치 데이터 등록
        safeBatches.forEach(batch => {
            const invoiceTotal = batch.invoiceInfo?.total || 0;
            weekMap.set(batch.weekLabel, {
                weekLabel: batch.weekLabel,
                startDate: batch.startDate,
                endDate: batch.endDate,
                crmCommission: batch.totalCommission,
                crmInvoiceAmount: invoiceTotal,
                crmDealCount: (batch.dealIds || []).length,
                batchStatus: batch.status,
                taxInvoices: [],
                taxTotalAmount: 0,
                taxSupplyAmount: 0,
                taxVatAmount: 0,
                matchStatus: 'crm_only',
                difference: 0
            });
        });

        // 2. 세금계산서를 주차에 매칭
        invoices.forEach(inv => {
            let matched = false;

            for (const [weekLabel, week] of weekMap.entries()) {
                if (isDateInWeek(inv.issueDate, week.startDate, week.endDate)) {
                    week.taxInvoices.push(inv);
                    week.taxTotalAmount += inv.totalAmount;
                    week.taxSupplyAmount += inv.supplyAmount;
                    week.taxVatAmount += inv.vatAmount;
                    matched = true;
                    break;
                }
            }

            // 매칭 안 된 세금계산서 → 별도 주차 생성
            if (!matched) {
                // 해당 날짜의 월요일 찾기
                const d = new Date(inv.issueDate);
                const dayOfWeek = d.getDay();
                const monday = new Date(d);
                monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);

                const monStr = monday.toISOString().split('T')[0];
                const sunStr = sunday.toISOString().split('T')[0];
                const weekNum = Math.ceil((monday.getTime() - new Date(monday.getFullYear(), 0, 1).getTime()) / (7 * 86400000)) + 1;
                const wLabel = `${monday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

                if (weekMap.has(wLabel)) {
                    const existing = weekMap.get(wLabel)!;
                    existing.taxInvoices.push(inv);
                    existing.taxTotalAmount += inv.totalAmount;
                    existing.taxSupplyAmount += inv.supplyAmount;
                    existing.taxVatAmount += inv.vatAmount;
                } else {
                    weekMap.set(wLabel, {
                        weekLabel: wLabel,
                        startDate: monStr,
                        endDate: sunStr,
                        crmCommission: 0,
                        crmInvoiceAmount: 0,
                        crmDealCount: 0,
                        batchStatus: '',
                        taxInvoices: [inv],
                        taxTotalAmount: inv.totalAmount,
                        taxSupplyAmount: inv.supplyAmount,
                        taxVatAmount: inv.vatAmount,
                        matchStatus: 'invoice_only',
                        difference: 0
                    });
                }
            }
        });

        // 3. 대사 상태 계산
        weekMap.forEach(week => {
            const crmAmount = week.crmInvoiceAmount || (week.crmCommission * 10000); // 만원→원 변환
            const taxAmount = week.taxTotalAmount;

            if (crmAmount === 0 && taxAmount === 0) {
                week.matchStatus = 'crm_only';
            } else if (crmAmount > 0 && taxAmount === 0) {
                week.matchStatus = 'crm_only';
                week.difference = crmAmount;
            } else if (crmAmount === 0 && taxAmount > 0) {
                week.matchStatus = 'invoice_only';
                week.difference = -taxAmount;
            } else {
                const diff = crmAmount - taxAmount;
                const tolerance = Math.max(crmAmount, taxAmount) * 0.02; // 2% 허용 오차
                if (Math.abs(diff) <= tolerance) {
                    week.matchStatus = 'matched';
                } else if (Math.abs(diff) < crmAmount * 0.5) {
                    week.matchStatus = 'partial';
                } else {
                    week.matchStatus = 'mismatch';
                }
                week.difference = diff;
            }
        });

        // 정렬 (최신 순)
        return Array.from(weekMap.values()).sort((a, b) => b.startDate.localeCompare(a.startDate));
    }, [batches, invoices]);

    // 필터링
    const filtered = useMemo(() => {
        if (filterType === 'all') return reconciliationData;
        if (filterType === 'matched') return reconciliationData.filter(r => r.matchStatus === 'matched');
        return reconciliationData.filter(r => ['mismatch', 'partial', 'crm_only', 'invoice_only'].includes(r.matchStatus));
    }, [reconciliationData, filterType]);

    // 통계
    const stats = useMemo(() => {
        const total = reconciliationData.length;
        const matched = reconciliationData.filter(r => r.matchStatus === 'matched').length;
        const mismatch = reconciliationData.filter(r => ['mismatch', 'partial'].includes(r.matchStatus)).length;
        const crmOnly = reconciliationData.filter(r => r.matchStatus === 'crm_only').length;
        const invoiceOnly = reconciliationData.filter(r => r.matchStatus === 'invoice_only').length;
        const totalDiff = reconciliationData.reduce((sum, r) => sum + Math.abs(r.difference), 0);
        return { total, matched, mismatch, crmOnly, invoiceOnly, totalDiff };
    }, [reconciliationData]);

    const getStatusBadge = (status: WeeklyReconciliation['matchStatus']) => {
        switch (status) {
            case 'matched':
                return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">✅ 일치</span>;
            case 'partial':
                return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 font-medium">⚠️ 부분일치</span>;
            case 'mismatch':
                return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">❌ 불일치</span>;
            case 'crm_only':
                return <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">📋 CRM만</span>;
            case 'invoice_only':
                return <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">📜 계산서만</span>;
        }
    };

    if (reconciliationData.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-cyan-100 overflow-hidden">
                <div className="p-4 border-b border-cyan-100 bg-gradient-to-r from-cyan-50 to-blue-50">
                    <h3 className="font-bold text-cyan-700 flex items-center gap-2">
                        🔍 정산 대사 (Reconciliation)
                    </h3>
                    <p className="text-xs text-cyan-500 mt-1">CRM 정산 배치 vs 실제 세금계산서 비교</p>
                </div>
                <div className="p-8 text-center text-gray-400">
                    <p>정산 배치 또는 세금계산서 데이터가 없습니다.</p>
                    <p className="text-xs mt-1">홈택스 엑셀을 업로드하면 자동으로 대사가 시작됩니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-cyan-100 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-cyan-100 bg-gradient-to-r from-cyan-50 to-blue-50">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-cyan-700 flex items-center gap-2">
                            🔍 정산 대사 (Reconciliation)
                        </h3>
                        <p className="text-xs text-cyan-500 mt-1">{year}년 CRM 정산 배치 vs 실제 매출 세금계산서 비교</p>
                    </div>
                </div>
            </div>

            <div className="p-4">
                {/* 통계 카드 */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-center">
                        <p className="text-xs text-gray-500">전체</p>
                        <p className="text-lg font-bold text-gray-700">{stats.total}주</p>
                    </div>
                    <div className="bg-green-50 p-2.5 rounded-lg border border-green-200 text-center cursor-pointer hover:ring-2 ring-green-300"
                        onClick={() => setFilterType(filterType === 'matched' ? 'all' : 'matched')}>
                        <p className="text-xs text-green-600">✅ 일치</p>
                        <p className="text-lg font-bold text-green-700">{stats.matched}</p>
                    </div>
                    <div className="bg-red-50 p-2.5 rounded-lg border border-red-200 text-center cursor-pointer hover:ring-2 ring-red-300"
                        onClick={() => setFilterType(filterType === 'mismatch' ? 'all' : 'mismatch')}>
                        <p className="text-xs text-red-600">❌ 불일치</p>
                        <p className="text-lg font-bold text-red-700">{stats.mismatch}</p>
                    </div>
                    <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200 text-center">
                        <p className="text-xs text-blue-600">CRM만</p>
                        <p className="text-lg font-bold text-blue-700">{stats.crmOnly}</p>
                    </div>
                    <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-200 text-center">
                        <p className="text-xs text-purple-600">총 차이</p>
                        <p className="text-lg font-bold text-purple-700">{(stats.totalDiff / 10000).toFixed(1)}만</p>
                    </div>
                </div>

                {/* 필터 탭 */}
                <div className="flex gap-1 mb-3">
                    {[
                        { key: 'all', label: '전체', count: stats.total },
                        { key: 'mismatch', label: '불일치만', count: stats.mismatch + stats.crmOnly + stats.invoiceOnly },
                        { key: 'matched', label: '일치만', count: stats.matched }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilterType(tab.key as typeof filterType)}
                            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                                filterType === tab.key
                                    ? 'bg-cyan-100 text-cyan-700 font-bold'
                                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                {/* 대사 테이블 */}
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto" style={{ overscrollBehavior: 'auto' }}>
                    <table className="w-full text-sm">
                        <thead className="bg-cyan-50 text-cyan-700 sticky top-0">
                            <tr>
                                <th className="py-2 px-2 text-left">주차</th>
                                <th className="py-2 px-2 text-left">기간</th>
                                <th className="py-2 px-2 text-right">CRM 수수료</th>
                                <th className="py-2 px-2 text-right">세금계산서</th>
                                <th className="py-2 px-2 text-right">차이</th>
                                <th className="py-2 px-2 text-center">상태</th>
                                <th className="py-2 px-2 text-center">상세</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(row => {
                                const isExpanded = showDetail === row.weekLabel;
                                return (
                                    <React.Fragment key={row.weekLabel}>
                                        <tr className={`border-b border-gray-100 hover:bg-gray-50 ${
                                            row.matchStatus === 'matched' ? '' :
                                            row.matchStatus === 'mismatch' ? 'bg-red-50/30' :
                                            row.matchStatus === 'partial' ? 'bg-yellow-50/30' : ''
                                        }`}>
                                            <td className="py-2 px-2 font-medium whitespace-nowrap">{row.weekLabel}</td>
                                            <td className="py-2 px-2 text-gray-500 text-xs whitespace-nowrap">
                                                {row.startDate.slice(5)} ~ {row.endDate.slice(5)}
                                            </td>
                                            <td className="py-2 px-2 text-right whitespace-nowrap">
                                                {row.crmCommission > 0 ? (
                                                    <span className="text-blue-600">{row.crmCommission.toLocaleString()}만</span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                                {row.crmDealCount > 0 && (
                                                    <span className="text-gray-400 text-xs ml-1">({row.crmDealCount}건)</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-2 text-right whitespace-nowrap">
                                                {row.taxTotalAmount > 0 ? (
                                                    <span className="text-green-600">{row.taxTotalAmount.toLocaleString()}원</span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                                {row.taxInvoices.length > 0 && (
                                                    <span className="text-gray-400 text-xs ml-1">({row.taxInvoices.length}건)</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-2 text-right whitespace-nowrap">
                                                {row.difference !== 0 ? (
                                                    <span className={row.difference > 0 ? 'text-red-600' : 'text-orange-600'}>
                                                        {row.difference > 0 ? '+' : ''}{row.difference.toLocaleString()}원
                                                    </span>
                                                ) : (
                                                    <span className="text-green-500">0</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                {getStatusBadge(row.matchStatus)}
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                {(row.taxInvoices.length > 0 || row.crmCommission > 0) && (
                                                    <button
                                                        onClick={() => setShowDetail(isExpanded ? null : row.weekLabel)}
                                                        className="text-cyan-500 hover:text-cyan-700 text-xs"
                                                    >
                                                        {isExpanded ? '접기' : '보기'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                        {/* 상세 확장 */}
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={7} className="bg-gray-50 p-3">
                                                    <div className="grid md:grid-cols-2 gap-3">
                                                        {/* CRM 정보 */}
                                                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                                            <p className="text-xs font-bold text-blue-700 mb-2">📋 CRM 정산 배치</p>
                                                            {row.crmCommission > 0 ? (
                                                                <div className="space-y-1 text-xs">
                                                                    <div className="flex justify-between">
                                                                        <span className="text-gray-600">수수료 합계:</span>
                                                                        <span className="font-medium">{row.crmCommission.toLocaleString()}만원</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-gray-600">딜 수:</span>
                                                                        <span className="font-medium">{row.crmDealCount}건</span>
                                                                    </div>
                                                                    {row.crmInvoiceAmount > 0 && (
                                                                        <div className="flex justify-between">
                                                                            <span className="text-gray-600">배치 세금계산서:</span>
                                                                            <span className="font-medium">{row.crmInvoiceAmount.toLocaleString()}원</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-between">
                                                                        <span className="text-gray-600">상태:</span>
                                                                        <span className="font-medium">{row.batchStatus || '-'}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-gray-400">CRM 배치 없음</p>
                                                            )}
                                                        </div>
                                                        {/* 세금계산서 정보 */}
                                                        <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                                                            <p className="text-xs font-bold text-green-700 mb-2">📜 매출 세금계산서</p>
                                                            {row.taxInvoices.length > 0 ? (
                                                                <div className="space-y-1.5">
                                                                    {row.taxInvoices.map((inv, idx) => (
                                                                        <div key={idx} className="flex justify-between text-xs bg-white rounded p-1.5">
                                                                            <div>
                                                                                <span className="text-gray-700">{inv.issueDate}</span>
                                                                                <span className="text-gray-400 ml-1">{inv.companyName}</span>
                                                                            </div>
                                                                            <span className="font-medium text-green-600">{inv.totalAmount.toLocaleString()}원</span>
                                                                        </div>
                                                                    ))}
                                                                    <div className="border-t border-green-200 pt-1 mt-1 flex justify-between text-xs font-bold">
                                                                        <span>합계</span>
                                                                        <span className="text-green-700">{row.taxTotalAmount.toLocaleString()}원</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-gray-400">매칭된 세금계산서 없음</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filtered.length === 0 && (
                    <div className="text-center py-6 text-gray-400 text-sm">
                        {filterType === 'matched' ? '일치하는 항목이 없습니다.' : '불일치 항목이 없습니다.'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReconciliationSection;
