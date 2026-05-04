import React, { useState, useEffect, useRef } from 'react';
import { fetchTaxInvoices, createTaxInvoice, deleteTaxInvoice, getTaxInvoiceStats, bulkCreateTaxInvoices, parseHometaxExcel } from '../services/api';
import { TaxInvoice, TaxInvoiceType } from '../types';
import * as XLSX from 'xlsx';

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
    const [activeTab, setActiveTab] = useState<'all' | '매출' | '매입'>('all');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<{ added: number; skipped: number; type: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
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

    // 데이터 로드 (async)
    const loadData = async () => {
        try {
            const loaded = await fetchTaxInvoices(year);
            setInvoices(loaded);
            const s = await getTaxInvoiceStats(year);
            setStats(s);
        } catch (e) {
            console.error('Failed to load tax invoices:', e);
        }
    };

    useEffect(() => {
        loadData();
    }, [year]);

    // 세금계산서 등록
    const handleSubmit = async () => {
        if (!formData.companyName || !formData.supplyAmount) {
            alert('거래처명과 공급가액을 입력해주세요.');
            return;
        }

        await createTaxInvoice({
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
        await loadData();
        onDataChanged?.();
    };

    // 세금계산서 삭제
    const handleDelete = async (id: string, companyName: string) => {
        if (confirm(`"${companyName}" 세금계산서를 삭제하시겠습니까?`)) {
            await deleteTaxInvoice(id);
            await loadData();
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

    // 홈택스 엑셀 업로드 처리
    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadResult(null);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

            // 홈택스 포맷 파싱 (매출/매입 자동 판별)
            const result = parseHometaxExcel(data, file.name);

            if (result.invoices.length === 0) {
                alert('파싱된 세금계산서가 없습니다. 파일 형식을 확인해주세요.');
                setIsUploading(false);
                return;
            }

            // 대량 저장
            const saveResult = await bulkCreateTaxInvoices(result.invoices);
            setUploadResult({
                added: saveResult.added,
                skipped: saveResult.skipped,
                type: result.type
            });

            await loadData();
            onDataChanged?.();
        } catch (err) {
            console.error('Excel upload error:', err);
            alert('엑셀 파일 처리 중 오류가 발생했습니다.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // 필터링된 목록
    const filteredInvoices = activeTab === 'all'
        ? invoices
        : invoices.filter(inv => inv.type === activeTab);

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
                    <div className="flex gap-2">
                        {/* 홈택스 엑셀 업로드 버튼 */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleExcelUpload}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                        >
                            {isUploading ? (
                                <><span className="animate-spin">⏳</span> 처리중...</>
                            ) : (
                                <>📥 홈택스 엑셀</>
                            )}
                        </button>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="px-3 py-1.5 bg-rose-600 text-white text-sm rounded-lg hover:bg-rose-700"
                        >
                            + 수동 등록
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4">
                {/* 업로드 결과 알림 */}
                {uploadResult && (
                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">✅</span>
                            <div>
                                <p className="text-sm font-bold text-emerald-700">
                                    홈택스 {uploadResult.type} 세금계산서 업로드 완료
                                </p>
                                <p className="text-xs text-emerald-600">
                                    {uploadResult.added}건 추가 / {uploadResult.skipped}건 중복 스킵
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setUploadResult(null)}
                            className="text-emerald-400 hover:text-emerald-600"
                        >×</button>
                    </div>
                )}

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

                {/* 탭 필터 */}
                <div className="flex gap-1 mb-3">
                    {(['all', '매출', '매입'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                                activeTab === tab
                                    ? tab === '매출' ? 'bg-green-100 text-green-700 font-bold'
                                        : tab === '매입' ? 'bg-red-100 text-red-700 font-bold'
                                        : 'bg-rose-100 text-rose-700 font-bold'
                                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            {tab === 'all' ? `전체 (${invoices.length})` : `${tab} (${invoices.filter(i => i.type === tab).length})`}
                        </button>
                    ))}
                </div>

                {/* 세금계산서 목록 */}
                {filteredInvoices.length > 0 ? (
                    <div className="overflow-x-auto max-h-60 overflow-y-auto" style={{ overscrollBehavior: 'auto' }}>
                        <table className="w-full text-sm">
                            <thead className="bg-rose-50 text-rose-700 sticky top-0">
                                <tr>
                                    <th className="py-2 px-2 text-left">유형</th>
                                    <th className="py-2 px-2 text-left">발행일</th>
                                    <th className="py-2 px-2 text-left">거래처</th>
                                    <th className="py-2 px-2 text-left">품목</th>
                                    <th className="py-2 px-2 text-right">공급가액</th>
                                    <th className="py-2 px-2 text-right">세액</th>
                                    <th className="py-2 px-2 text-right">합계</th>
                                    <th className="py-2 px-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInvoices.map((inv) => (
                                    <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-2 px-2">
                                            <span className={`px-2 py-0.5 rounded text-xs ${inv.type === '매출' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {inv.type}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2 whitespace-nowrap">{inv.issueDate}</td>
                                        <td className="py-2 px-2 max-w-[120px] truncate" title={inv.companyName}>{inv.companyName}</td>
                                        <td className="py-2 px-2 max-w-[100px] truncate text-gray-500" title={inv.description}>{inv.description || '-'}</td>
                                        <td className="py-2 px-2 text-right whitespace-nowrap">{inv.supplyAmount.toLocaleString()}</td>
                                        <td className="py-2 px-2 text-right whitespace-nowrap text-gray-500">{inv.vatAmount.toLocaleString()}</td>
                                        <td className="py-2 px-2 text-right whitespace-nowrap font-medium">{inv.totalAmount.toLocaleString()}</td>
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
                        {activeTab === 'all' ? '등록된 세금계산서가 없습니다.' : `${activeTab} 세금계산서가 없습니다.`}
                        <p className="text-xs mt-2">홈택스에서 다운로드한 엑셀 파일을 업로드하거나 수동으로 등록해주세요.</p>
                    </div>
                )}
            </div>

            {/* 등록 모달 */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b bg-gradient-to-r from-rose-50 to-pink-50">
                            <h3 className="font-bold text-rose-700">📜 세금계산서 수동 등록</h3>
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
