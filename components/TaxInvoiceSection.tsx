import React, { useState, useEffect } from 'react';
import { fetchTaxInvoices, createTaxInvoice, deleteTaxInvoice, getTaxInvoiceStats } from '../services/api';
import { TaxInvoice, TaxInvoiceType } from '../types';

interface TaxInvoiceSectionProps {
    year: number;
    onDataChanged?: () => void;
}

const TaxInvoiceSection: React.FC<TaxInvoiceSectionProps> = ({ year, onDataChanged }) => {
    const [invoices, setInvoices] = useState<TaxInvoice[]>([]);
    const [stats, setStats] = useState({
        salesCount: 0,
        salesTotal: 0,
        salesVat: 0,
        purchaseCount: 0,
        purchaseTotal: 0,
        purchaseVat: 0,
        vatPayable: 0
    });
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        type: '매출' as TaxInvoiceType,
        issueDate: new Date().toISOString().split('T')[0],
        companyName: '',
        businessNumber: '',
        supplyAmount: 0,
        vatAmount: 0,
        description: '',
        approvalNumber: '',
        isElectronic: true
    });

    // 데이터 로드
    const loadData = () => {
        const loaded = fetchTaxInvoices(year);
        setInvoices(loaded);
        setStats(getTaxInvoiceStats(year));
    };

    useEffect(() => {
        loadData();
    }, [year]);

    // 세금계산서 등록
    const handleSubmit = () => {
        if (!formData.companyName || !formData.supplyAmount) {
            alert('거래처명과 공급가액을 입력해주세요.');
            return;
        }

        createTaxInvoice({
            type: formData.type,
            issueDate: formData.issueDate,
            companyName: formData.companyName,
            businessNumber: formData.businessNumber,
            supplyAmount: formData.supplyAmount,
            vatAmount: formData.vatAmount || Math.round(formData.supplyAmount * 0.1),
            totalAmount: formData.supplyAmount + (formData.vatAmount || Math.round(formData.supplyAmount * 0.1)),
            description: formData.description,
            approvalNumber: formData.approvalNumber || undefined,
            isElectronic: formData.isElectronic
        });

        setIsAddModalOpen(false);
        setFormData({
            type: '매출',
            issueDate: new Date().toISOString().split('T')[0],
            companyName: '',
            businessNumber: '',
            supplyAmount: 0,
            vatAmount: 0,
            description: '',
            approvalNumber: '',
            isElectronic: true
        });
        loadData();
        onDataChanged?.();
    };

    // 세금계산서 삭제
    const handleDelete = (id: string, companyName: string) => {
        if (confirm(`"${companyName}" 세금계산서를 삭제하시겠습니까?`)) {
            deleteTaxInvoice(id);
            loadData();
            onDataChanged?.();
        }
    };

    // 공급가액 변경 시 세액 자동 계산
    const handleSupplyAmountChange = (value: number) => {
        setFormData(prev => ({
            ...prev,
            supplyAmount: value,
            vatAmount: Math.round(value * 0.1)
        }));
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-rose-100 overflow-hidden">
            <div className="p-4 border-b border-rose-100 bg-gradient-to-r from-rose-50 to-pink-50">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-rose-700 flex items-center gap-2">
                            📜 세금계산서 관리
                        </h3>
                        <p className="text-xs text-rose-500 mt-1">{year}년 매입/매출 세금계산서</p>
                    </div>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-3 py-1.5 bg-rose-600 text-white text-sm rounded-lg hover:bg-rose-700"
                    >
                        + 세금계산서 등록
                    </button>
                </div>
            </div>

            <div className="p-4">
                {/* 통계 요약 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                        <p className="text-xs text-green-600">매출 세금계산서</p>
                        <p className="text-lg font-bold text-green-700">{stats.salesCount}건</p>
                        <p className="text-xs text-green-500">{stats.salesTotal.toLocaleString()}원</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                        <p className="text-xs text-red-600">매입 세금계산서</p>
                        <p className="text-lg font-bold text-red-700">{stats.purchaseCount}건</p>
                        <p className="text-xs text-red-500">{stats.purchaseTotal.toLocaleString()}원</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <p className="text-xs text-blue-600">매출세액</p>
                        <p className="text-lg font-bold text-blue-700">{stats.salesVat.toLocaleString()}원</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                        <p className="text-xs text-purple-600">납부 예정 세액</p>
                        <p className={`text-lg font-bold ${stats.vatPayable >= 0 ? 'text-purple-700' : 'text-green-700'}`}>
                            {stats.vatPayable >= 0 ? '' : '-'}{Math.abs(stats.vatPayable).toLocaleString()}원
                        </p>
                    </div>
                </div>

                {/* 세금계산서 목록 */}
                {invoices.length > 0 ? (
                    <div className="overflow-x-auto max-h-60 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-rose-50 text-rose-700 sticky top-0">
                                <tr>
                                    <th className="py-2 px-2 text-left">유형</th>
                                    <th className="py-2 px-2 text-left">발행일</th>
                                    <th className="py-2 px-2 text-left">거래처</th>
                                    <th className="py-2 px-2 text-right">공급가액</th>
                                    <th className="py-2 px-2 text-right">세액</th>
                                    <th className="py-2 px-2 text-center">전자</th>
                                    <th className="py-2 px-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => (
                                    <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-2 px-2">
                                            <span className={`px-2 py-0.5 rounded text-xs ${inv.type === '매출' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {inv.type}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2">{inv.issueDate}</td>
                                        <td className="py-2 px-2">{inv.companyName}</td>
                                        <td className="py-2 px-2 text-right">{inv.supplyAmount.toLocaleString()}</td>
                                        <td className="py-2 px-2 text-right">{inv.vatAmount.toLocaleString()}</td>
                                        <td className="py-2 px-2 text-center">{inv.isElectronic ? '✓' : ''}</td>
                                        <td className="py-2 px-2">
                                            <button
                                                onClick={() => handleDelete(inv.id, inv.companyName)}
                                                className="text-gray-400 hover:text-red-500"
                                            >
                                                ×
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-400">
                        등록된 세금계산서가 없습니다.
                    </div>
                )}
            </div>

            {/* 등록 모달 */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b bg-gradient-to-r from-rose-50 to-pink-50">
                            <h3 className="font-bold text-rose-700">📜 세금계산서 등록</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* 유형 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setFormData(prev => ({ ...prev, type: '매출' }))}
                                        className={`flex-1 py-2 rounded-lg border ${formData.type === '매출'
                                                ? 'bg-green-100 border-green-500 text-green-700'
                                                : 'bg-gray-50 border-gray-200 text-gray-600'
                                            }`}
                                    >
                                        매출
                                    </button>
                                    <button
                                        onClick={() => setFormData(prev => ({ ...prev, type: '매입' }))}
                                        className={`flex-1 py-2 rounded-lg border ${formData.type === '매입'
                                                ? 'bg-red-100 border-red-500 text-red-700'
                                                : 'bg-gray-50 border-gray-200 text-gray-600'
                                            }`}
                                    >
                                        매입
                                    </button>
                                </div>
                            </div>

                            {/* 발행일 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">발행일</label>
                                <input
                                    type="date"
                                    value={formData.issueDate}
                                    onChange={e => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                />
                            </div>

                            {/* 거래처 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">거래처 상호 *</label>
                                <input
                                    type="text"
                                    value={formData.companyName}
                                    onChange={e => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="거래처명"
                                />
                            </div>

                            {/* 사업자번호 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">사업자등록번호</label>
                                <input
                                    type="text"
                                    value={formData.businessNumber}
                                    onChange={e => setFormData(prev => ({ ...prev, businessNumber: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="000-00-00000"
                                />
                            </div>

                            {/* 공급가액 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">공급가액 *</label>
                                <input
                                    type="number"
                                    value={formData.supplyAmount || ''}
                                    onChange={e => handleSupplyAmountChange(parseInt(e.target.value) || 0)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="0"
                                />
                            </div>

                            {/* 세액 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">세액 (자동계산: 10%)</label>
                                <input
                                    type="number"
                                    value={formData.vatAmount || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, vatAmount: parseInt(e.target.value) || 0 }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="0"
                                />
                            </div>

                            {/* 적요 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">적요</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="거래 내용"
                                />
                            </div>

                            {/* 승인번호 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">승인번호</label>
                                <input
                                    type="text"
                                    value={formData.approvalNumber}
                                    onChange={e => setFormData(prev => ({ ...prev, approvalNumber: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="전자세금계산서 승인번호"
                                />
                            </div>

                            {/* 전자세금계산서 여부 */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isElectronic"
                                    checked={formData.isElectronic}
                                    onChange={e => setFormData(prev => ({ ...prev, isElectronic: e.target.checked }))}
                                    className="rounded border-gray-300"
                                />
                                <label htmlFor="isElectronic" className="text-sm text-gray-700">
                                    전자세금계산서
                                </label>
                            </div>
                        </div>

                        <div className="p-4 border-t flex gap-2">
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex-1 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                            >
                                등록
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaxInvoiceSection;
