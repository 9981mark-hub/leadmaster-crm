
import React, { useEffect, useState } from 'react';
import { fetchCases, fetchPartners, fetchSettlementBatches, generateWeeklyBatch, updateSettlementBatch, refreshWeeklyBatch, getSettlementStatusLabel, getWeekLabel, getWeekMonday, getWeekSunday } from '../services/api';
import { Case, Partner, SettlementBatch } from '../types';
import { calculateCommission, calculateNextSettlement } from '../utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CheckCircle, Building, Wallet, Search, Calendar, FileText, CreditCard, AlertTriangle, ChevronLeft, ChevronRight, Copy, Check, Clock, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';
import { useToast } from '../contexts/ToastContext';

type TabType = 'monday' | 'tuesday' | 'wednesday' | 'report';

export default function Settlement() {
    const { showToast } = useToast();
    const [cases, setCases] = useState<Case[]>([]);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState<number | 'all'>('all');
    const [loading, setLoading] = useState(true);

    // Weekly Settlement Center State
    const [activeTab, setActiveTab] = useState<TabType>('monday');
    const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => getWeekMonday(new Date()));
    const [batches, setBatches] = useState<SettlementBatch[]>([]);
    const [loadingBatches, setLoadingBatches] = useState(false);

    // Modal State
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [copiedTemplate, setCopiedTemplate] = useState(false);

    useEffect(() => {
        Promise.all([fetchCases(), fetchPartners()]).then(([c, p]) => {
            setCases(c);
            setPartners(p);
            if (p.length > 0) setSelectedPartnerId(p[0].partnerId);
            setLoading(false);
        });
    }, []);

    // Load batches when partner or week changes
    useEffect(() => {
        const loadBatches = async () => {
            if (!selectedPartnerId || selectedPartnerId === 'all') return;
            setLoadingBatches(true);
            const weekBatches = await fetchSettlementBatches(selectedPartnerId, selectedWeekStart.getFullYear());
            setBatches(weekBatches);
            setLoadingBatches(false);
        };
        loadBatches();
    }, [selectedPartnerId, selectedWeekStart]);

    if (loading) return <div>로딩중...</div>;

    const isAll = selectedPartnerId === 'all';
    const currentPartner = !isAll ? partners.find(p => p.partnerId === selectedPartnerId) : null;
    const weekLabel = getWeekLabel(selectedWeekStart);
    const currentBatch = batches.find(b => b.weekLabel === weekLabel && b.partnerId === selectedPartnerId);

    // Navigate weeks
    const goToPrevWeek = () => {
        const prev = new Date(selectedWeekStart);
        prev.setDate(prev.getDate() - 7);
        setSelectedWeekStart(getWeekMonday(prev));
    };
    const goToNextWeek = () => {
        const next = new Date(selectedWeekStart);
        next.setDate(next.getDate() + 7);
        setSelectedWeekStart(getWeekMonday(next));
    };
    const goToThisWeek = () => setSelectedWeekStart(getWeekMonday(new Date()));

    // Generate or get batch for current week
    const handleGenerateBatch = async () => {
        if (!selectedPartnerId || selectedPartnerId === 'all') return;
        setLoadingBatches(true);
        const batch = await generateWeeklyBatch(selectedPartnerId, selectedWeekStart);
        setBatches(prev => {
            const exists = prev.find(b => b.batchId === batch.batchId);
            return exists ? prev : [batch, ...prev];
        });
        setLoadingBatches(false);
        showToast(`${weekLabel} 배치가 생성되었습니다.`, 'success');
    };

    // [NEW] Refresh batch with latest case data
    const handleRefreshBatch = async () => {
        if (!currentBatch) return;
        setLoadingBatches(true);
        const refreshed = await refreshWeeklyBatch(currentBatch.batchId);
        if (refreshed) {
            setBatches(prev => prev.map(b => b.batchId === refreshed.batchId ? refreshed : b));
            showToast('배치 데이터가 최신 고객 정보로 업데이트되었습니다.', 'success');
        }
        setLoadingBatches(false);
    };

    // Update batch status
    const handleUpdateBatchStatus = async (newStatus: SettlementBatch['status']) => {
        if (!currentBatch) return;
        await updateSettlementBatch(currentBatch.batchId, { status: newStatus });
        setBatches(prev => prev.map(b =>
            b.batchId === currentBatch.batchId ? { ...b, status: newStatus, updatedAt: new Date().toISOString() } : b
        ));
        showToast(`상태가 '${getSettlementStatusLabel(newStatus)}'(으)로 변경되었습니다.`, 'success');
    };

    // Update confirmation evidence
    const handleSaveConfirmation = async (text: string) => {
        if (!currentBatch) return;
        await updateSettlementBatch(currentBatch.batchId, {
            confirmationEvidence: { text, confirmedAt: new Date().toISOString() },
            status: 'confirmed'
        });
        setBatches(prev => prev.map(b =>
            b.batchId === currentBatch.batchId ? {
                ...b,
                status: 'confirmed',
                confirmationEvidence: { text, confirmedAt: new Date().toISOString() },
                updatedAt: new Date().toISOString()
            } : b
        ));
        showToast('확인 증빙이 저장되었습니다.', 'success');
    };

    // Update invoice info
    const handleSaveInvoice = async (invoiceData: { issueDate: string; supplyAmount: number; vat: number; approvalNumber: string }) => {
        if (!currentBatch) return;
        const total = invoiceData.supplyAmount + invoiceData.vat;
        await updateSettlementBatch(currentBatch.batchId, {
            invoiceInfo: { ...invoiceData, total },
            status: 'invoiced'
        });
        setBatches(prev => prev.map(b =>
            b.batchId === currentBatch.batchId ? {
                ...b,
                status: 'invoiced',
                invoiceInfo: { ...invoiceData, total },
                updatedAt: new Date().toISOString()
            } : b
        ));
        showToast('세금계산서 정보가 저장되었습니다.', 'success');
    };

    // Copy kakao template
    const handleCopyTemplate = () => {
        if (!currentPartner || !currentBatch) return;
        const template = currentPartner.kakaoTemplates?.invoiceNotice || '';
        const filled = template
            .replace(/\{\{거래처명\}\}/g, currentPartner.name)
            .replace(/\{\{주차라벨\}\}/g, currentBatch.weekLabel)
            .replace(/\{\{공급가\}\}/g, (currentBatch.invoiceInfo?.supplyAmount || 0).toLocaleString())
            .replace(/\{\{VAT\}\}/g, (currentBatch.invoiceInfo?.vat || 0).toLocaleString())
            .replace(/\{\{합계\}\}/g, (currentBatch.invoiceInfo?.total || 0).toLocaleString())
            .replace(/\{\{계좌정보\}\}/g, currentPartner.bankInfo
                ? `${currentPartner.bankInfo.bankName} ${currentPartner.bankInfo.accountNumber} (${currentPartner.bankInfo.accountHolder})`
                : '');
        navigator.clipboard.writeText(filled);
        setCopiedTemplate(true);
        setTimeout(() => setCopiedTemplate(false), 2000);
        showToast('템플릿이 클립보드에 복사되었습니다.', 'success');
    };

    // Filter by Partner (for report tab)
    const partnerCases = isAll ? cases : cases.filter(c => c.partnerId === selectedPartnerId);

    // Helper to calculate commission for a specific case
    const getCommissionForCase = (c: Case) => {
        const p = partners.find(partner => partner.partnerId === c.partnerId);
        if (!p) return 0;
        return calculateCommission(c.contractFee || 0, p.commissionRules);
    };

    // Helper to calculate payable commission (deposit-based) for a specific case
    const getPayableInfoForCase = (c: Case) => {
        const p = partners.find(partner => partner.partnerId === c.partnerId);
        if (!p) return { payable: 0, total: 0, isPartial: false, totalDeposit: 0 };

        const { calculatePayableCommission } = require('../utils');
        const result = calculatePayableCommission(c, p.commissionRules, p.settlementConfig);

        // Calculate total deposit
        const totalDeposit = (c.depositHistory && c.depositHistory.length > 0)
            ? c.depositHistory.reduce((sum: number, d: any) => sum + (d.amount || 0), 0)
            : (c.deposit1Amount || 0) + (c.deposit2Amount || 0);

        return { ...result, totalDeposit };
    };

    // Filter by Year & Month for Statistics
    const statsCases = partnerCases.filter(c => {
        if (!c.contractAt) return false;
        const cDate = new Date(c.contractAt);
        const cYear = cDate.getFullYear();
        const cMonth = cDate.getMonth() + 1;
        const yearMatch = cYear === year;
        const monthMatch = month === 'all' || cMonth === month;
        return yearMatch && monthMatch;
    });

    // Calculate KPIs
    const totalCount = statsCases.length;
    const totalRevenue = statsCases.reduce((sum, c) => sum + (c.contractFee || 0), 0);
    const totalCommission = statsCases.reduce((sum, c) => sum + getCommissionForCase(c), 0);
    const missingDateCount = partnerCases.filter(c => ['계약 완료', '1차 입금완료', '2차 입금완료'].includes(c.status) && !c.contractAt).length;

    // Monthly Stats for Chart
    const monthlyStats = Array.from({ length: 12 }, (_, i) => {
        const monthStr = `${year}-${String(i + 1).padStart(2, '0')}`;
        const monthCases = partnerCases.filter(c => c.contractAt && c.contractAt.startsWith(monthStr));
        const revenue = monthCases.reduce((sum, c) => sum + (c.contractFee || 0), 0);
        const commission = monthCases.reduce((sum, c) => sum + getCommissionForCase(c), 0);
        return { name: `${i + 1}월`, count: monthCases.length, revenue, commission };
    });

    const getPartnerName = (pid: string) => partners.find(p => p.partnerId === pid)?.name || '-';

    // Get deals for current week batch
    const weekDeals = currentBatch?.dealIds.map(id => cases.find(c => c.caseId === id)).filter(Boolean) as Case[] || [];

    // Tab content render functions
    const renderMondayTab = () => (
        <div className="space-y-6">
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                <h3 className="font-bold text-blue-800 mb-4 text-lg flex items-center">
                    <Calendar className="mr-2" size={20} /> 월요일: 정산 확인
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    해당 주차에 정산 대상 딜을 확인하고, 거래처 카톡 확인 증빙을 기록합니다.
                </p>

                {!currentBatch ? (
                    <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                        <p className="text-gray-500 mb-4">이 주차에 대한 배치가 없습니다.</p>
                        <button
                            onClick={handleGenerateBatch}
                            disabled={loadingBatches || selectedPartnerId === 'all'}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loadingBatches ? '생성 중...' : '배치 생성하기'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Batch Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-500">딜 수</p>
                                <p className="text-2xl font-bold text-gray-800">{currentBatch.dealIds.length}건</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-500">총 수임료</p>
                                <p className="text-2xl font-bold text-blue-600">{currentBatch.totalContractFee.toLocaleString()}만원</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-500">총 수수료</p>
                                <p className="text-2xl font-bold text-green-600">{currentBatch.totalCommission.toLocaleString()}만원</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-500">상태</p>
                                <p className={`text-xl font-bold ${currentBatch.status === 'draft' ? 'text-gray-600' : 'text-green-600'}`}>
                                    {getSettlementStatusLabel(currentBatch.status)}
                                </p>
                            </div>
                        </div>

                        {/* Deal List */}
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h4 className="font-bold text-gray-700 text-sm">정산 대상 딜 목록</h4>
                                <button
                                    onClick={handleRefreshBatch}
                                    disabled={loadingBatches}
                                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                                    title="고객 상세페이지 변경사항을 반영합니다"
                                >
                                    <RefreshCw size={14} className={loadingBatches ? 'animate-spin' : ''} />
                                    새로고침
                                </button>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                                {weekDeals.length === 0 ? (
                                    <p className="text-center text-gray-500 py-6">정산 대상 딜이 없습니다.</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-600 sticky top-0">
                                            <tr>
                                                <th className="text-left px-3 py-2">고객명</th>
                                                <th className="text-center px-2 py-2 text-xs">분납</th>
                                                <th className="text-right px-2 py-2">수임료</th>
                                                <th className="text-right px-2 py-2">입금액</th>
                                                <th className="text-right px-2 py-2 text-orange-600">총수수료</th>
                                                <th className="text-right px-2 py-2 text-green-600 font-bold">금주지급</th>
                                                <th className="text-center px-2 py-2">상태</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {weekDeals.map(deal => {
                                                const info = getPayableInfoForCase(deal);
                                                return (
                                                    <tr key={deal.caseId} className="hover:bg-gray-50">
                                                        <td className="px-3 py-2 font-medium">{deal.customerName}</td>
                                                        <td className="px-2 py-2 text-center text-xs text-gray-500">{deal.installmentMonths || '-'}</td>
                                                        <td className="px-2 py-2 text-right text-gray-700">{deal.contractFee?.toLocaleString()}</td>
                                                        <td className="px-2 py-2 text-right text-blue-600 font-medium">{info.totalDeposit.toLocaleString()}</td>
                                                        <td className="px-2 py-2 text-right text-orange-500">{info.total.toLocaleString()}</td>
                                                        <td className="px-2 py-2 text-right text-green-600 font-bold">{info.payable.toLocaleString()}</td>
                                                        <td className="px-2 py-2 text-center">
                                                            {info.isPartial ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">
                                                                    50%
                                                                </span>
                                                            ) : info.payable > 0 ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                                                                    100%
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">
                                                                    대기
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* Confirmation Evidence */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <h4 className="font-bold text-gray-700 mb-2 text-sm">📝 카톡 확인 증빙</h4>
                            <textarea
                                className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                                rows={3}
                                placeholder="거래처와의 카톡 확인 내용을 기록하세요..."
                                defaultValue={currentBatch.confirmationEvidence?.text || ''}
                                onBlur={(e) => {
                                    if (e.target.value !== currentBatch.confirmationEvidence?.text) {
                                        handleSaveConfirmation(e.target.value);
                                    }
                                }}
                            />
                            {currentBatch.confirmationEvidence?.confirmedAt && (
                                <p className="text-xs text-green-600 mt-2">
                                    ✓ {new Date(currentBatch.confirmationEvidence.confirmedAt).toLocaleString()} 확인됨
                                </p>
                            )}
                        </div>

                        {/* Action Buttons */}
                        {currentBatch.status === 'draft' && (
                            <button
                                onClick={() => handleUpdateBatchStatus('confirmed')}
                                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700"
                            >
                                ✓ 정산 확인 완료 (락0)
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    const renderTuesdayTab = () => (
        <div className="space-y-6">
            <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-100">
                <h3 className="font-bold text-yellow-800 mb-4 text-lg flex items-center">
                    <FileText className="mr-2" size={20} /> 화요일: 발행 / 수금
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    세금계산서를 발행하고, 수금 상태를 관리합니다.
                </p>

                {!currentBatch ? (
                    <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                        <p className="text-gray-500">먼저 월요일 탭에서 배치를 생성해주세요.</p>
                    </div>
                ) : currentBatch.status === 'draft' ? (
                    <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                        <AlertTriangle className="mx-auto text-yellow-500 mb-2" size={32} />
                        <p className="text-gray-600">먼저 월요일 탭에서 정산 확인을 완료해주세요.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Invoice Info Form */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <h4 className="font-bold text-gray-700 mb-3 text-sm">📄 세금계산서 정보</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">발행일</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        defaultValue={currentBatch.invoiceInfo?.issueDate || ''}
                                        id="issueDate"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">공급가 (만원)</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        defaultValue={currentBatch.invoiceInfo?.supplyAmount || currentBatch.totalCommission}
                                        id="supplyAmount"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">VAT (만원)</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        defaultValue={currentBatch.invoiceInfo?.vat || Math.round(currentBatch.totalCommission * 0.1)}
                                        id="vat"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">승인번호</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        placeholder="발행 후 입력"
                                        defaultValue={currentBatch.invoiceInfo?.approvalNumber || ''}
                                        id="approvalNumber"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    const issueDate = (document.getElementById('issueDate') as HTMLInputElement).value;
                                    const supplyAmount = Number((document.getElementById('supplyAmount') as HTMLInputElement).value);
                                    const vat = Number((document.getElementById('vat') as HTMLInputElement).value);
                                    const approvalNumber = (document.getElementById('approvalNumber') as HTMLInputElement).value;
                                    handleSaveInvoice({ issueDate, supplyAmount, vat, approvalNumber });
                                }}
                                className="mt-4 bg-yellow-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-yellow-700"
                            >
                                💾 저장
                            </button>
                        </div>

                        {/* Kakao Template */}
                        {currentPartner?.kakaoTemplates?.invoiceNotice && (
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-bold text-gray-700 text-sm">📱 카톡 템플릿</h4>
                                    <button
                                        onClick={handleCopyTemplate}
                                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                                    >
                                        {copiedTemplate ? <Check size={14} /> : <Copy size={14} />}
                                        {copiedTemplate ? '복사됨!' : '복사'}
                                    </button>
                                </div>
                                <div className="bg-gray-50 p-3 rounded text-sm text-gray-600 whitespace-pre-line">
                                    {currentPartner.kakaoTemplates.invoiceNotice
                                        .replace(/\{\{거래처명\}\}/g, currentPartner.name)
                                        .replace(/\{\{주차라벨\}\}/g, currentBatch.weekLabel)
                                        .replace(/\{\{공급가\}\}/g, (currentBatch.invoiceInfo?.supplyAmount || currentBatch.totalCommission).toLocaleString())
                                        .replace(/\{\{VAT\}\}/g, (currentBatch.invoiceInfo?.vat || Math.round(currentBatch.totalCommission * 0.1)).toLocaleString())
                                        .replace(/\{\{합계\}\}/g, (currentBatch.invoiceInfo?.total || Math.round(currentBatch.totalCommission * 1.1)).toLocaleString())
                                        .replace(/\{\{계좌정보\}\}/g, currentPartner.bankInfo
                                            ? `${currentPartner.bankInfo.bankName} ${currentPartner.bankInfo.accountNumber} (${currentPartner.bankInfo.accountHolder})`
                                            : '(계좌정보 미설정)')}
                                </div>
                            </div>
                        )}

                        {/* Collection Status */}
                        {currentBatch.status !== 'draft' && (
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <h4 className="font-bold text-gray-700 mb-2 text-sm">💰 수금 상태</h4>
                                {currentBatch.collectionInfo?.collectedAt ? (
                                    <p className="text-green-600 font-bold">
                                        ✓ 수금완료 ({currentBatch.collectionInfo.collectedAt}) - {currentBatch.collectionInfo.amount?.toLocaleString()}만원
                                    </p>
                                ) : (
                                    <button
                                        onClick={() => handleUpdateBatchStatus('collected')}
                                        className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700"
                                    >
                                        수금 완료 처리
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    const renderWednesdayTab = () => (
        <div className="space-y-6">
            <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                <h3 className="font-bold text-green-800 mb-4 text-lg flex items-center">
                    <CreditCard className="mr-2" size={20} /> 수요일: 파트너 지급
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    파트너에게 수수료를 지급하고, 매입 세금계산서 수취를 기록합니다.
                </p>

                {!currentBatch || !['collected', 'invoiced', 'confirmed'].includes(currentBatch.status) ? (
                    <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                        <AlertTriangle className="mx-auto text-yellow-500 mb-2" size={32} />
                        <p className="text-gray-600">화요일 탭에서 발행/수금을 먼저 완료해주세요.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Payout Summary */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <h4 className="font-bold text-gray-700 mb-3 text-sm">💳 지급 정보</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-green-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500">지급 대상 수수료</p>
                                    <p className="text-2xl font-bold text-green-700">{currentBatch.totalCommission.toLocaleString()}만원</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500">거래처</p>
                                    <p className="text-lg font-bold text-gray-700">{currentPartner?.name}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500">계좌정보</p>
                                    <p className="text-sm font-medium text-gray-600">
                                        {currentPartner?.bankInfo
                                            ? `${currentPartner.bankInfo.bankName} ${currentPartner.bankInfo.accountNumber}`
                                            : '(미설정)'}
                                    </p>
                                </div>
                            </div>

                            {currentBatch.payoutInfo?.paidAt ? (
                                <p className="text-green-600 font-bold mt-4">
                                    ✓ 지급완료 ({currentBatch.payoutInfo.paidAt}) - {currentBatch.payoutInfo.amount?.toLocaleString()}만원
                                </p>
                            ) : (
                                <button
                                    onClick={() => handleUpdateBatchStatus('paid')}
                                    className="mt-4 w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700"
                                >
                                    ✓ 지급 완료 처리 (락2)
                                </button>
                            )}
                        </div>

                        {/* Purchase Invoice */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <h4 className="font-bold text-gray-700 mb-2 text-sm">📥 매입 세금계산서 수취</h4>
                            {currentBatch.purchaseInvoice?.receivedAt ? (
                                <p className="text-green-600 font-bold">
                                    ✓ 수취완료 ({currentBatch.purchaseInvoice.receivedAt})
                                </p>
                            ) : (
                                <button
                                    onClick={() => handleUpdateBatchStatus('completed')}
                                    className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-700"
                                >
                                    매입 세금계산서 수취 완료
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderReportTab = () => (
        <div className="space-y-6">
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
                    <p className="text-xs text-blue-500 mt-2 font-medium">클릭하여 상세 내역 보기 →</p>
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
                            <Tooltip formatter={(value: number) => [`${value.toLocaleString()}만원`, '']} />
                            <Bar dataKey="revenue" fill="#3b82f6" name="매출" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="commission" fill="#10b981" name="예상 수당(Full)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Monthly Summary Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
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
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800">주간정산센터</h2>

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
                </div>
            </div>

            {/* Week Navigator (for settlement tabs) */}
            {activeTab !== 'report' && !isAll && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={goToPrevWeek} className="p-2 hover:bg-gray-100 rounded">
                            <ChevronLeft size={20} />
                        </button>
                        <div className="text-center min-w-[200px]">
                            <p className="font-bold text-lg text-gray-800">{weekLabel}</p>
                            <p className="text-sm text-gray-500">
                                {selectedWeekStart.toLocaleDateString('ko-KR')} ~ {getWeekSunday(selectedWeekStart).toLocaleDateString('ko-KR')}
                            </p>
                        </div>
                        <button onClick={goToNextWeek} className="p-2 hover:bg-gray-100 rounded">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                    <button
                        onClick={goToThisWeek}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        이번 주로 이동
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto">
                {!isAll && (
                    <>
                        <button
                            onClick={() => setActiveTab('monday')}
                            className={`px-6 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === 'monday'
                                ? 'border-blue-600 text-blue-600 bg-blue-50'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            📅 월요일 (확인)
                        </button>
                        <button
                            onClick={() => setActiveTab('tuesday')}
                            className={`px-6 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === 'tuesday'
                                ? 'border-yellow-600 text-yellow-600 bg-yellow-50'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            📄 화요일 (발행/수금)
                        </button>
                        <button
                            onClick={() => setActiveTab('wednesday')}
                            className={`px-6 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === 'wednesday'
                                ? 'border-green-600 text-green-600 bg-green-50'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            💰 수요일 (지급)
                        </button>
                    </>
                )}
                <button
                    onClick={() => setActiveTab('report')}
                    className={`px-6 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === 'report'
                        ? 'border-purple-600 text-purple-600 bg-purple-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    📊 리포트
                </button>
            </div>

            {/* Year/Month Filter (only for report tab) */}
            {activeTab === 'report' && (
                <div className="flex gap-2 items-center">
                    <select
                        className="bg-white border p-2 rounded text-lg font-bold cursor-pointer min-w-[100px]"
                        value={year}
                        onChange={e => setYear(Number(e.target.value))}
                    >
                        {Array.from({ length: 13 }, (_, i) => 2024 + i).map(y => (
                            <option key={y} value={y}>{y}년</option>
                        ))}
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
            )}

            {/* Tab Content */}
            {activeTab === 'monday' && !isAll && renderMondayTab()}
            {activeTab === 'tuesday' && !isAll && renderTuesdayTab()}
            {activeTab === 'wednesday' && !isAll && renderWednesdayTab()}
            {activeTab === 'report' && renderReportTab()}
            {isAll && activeTab !== 'report' && (
                <div className="bg-gray-50 p-8 rounded-xl text-center">
                    <p className="text-gray-500">주간 정산 기능은 특정 거래처를 선택해야 사용할 수 있습니다.</p>
                    <p className="text-sm text-gray-400 mt-2">통계를 보시려면 "리포트" 탭을 선택하세요.</p>
                </div>
            )}

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
