
import React, { useEffect, useState } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { fetchCases, fetchPartners, fetchSettlementBatches, generateWeeklyBatch, updateSettlementBatch, refreshWeeklyBatch, getSettlementStatusLabel, getWeekLabel, getWeekMonday, getWeekSunday } from '../services/api';
import { Case, Partner, SettlementBatch } from '../types';
import { calculateCommission, calculateNextSettlement, calculatePayableCommission } from '../utils';
import { BarChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { CheckCircle, Building, Wallet, Search, Calendar, FileText, CreditCard, AlertTriangle, ChevronLeft, ChevronRight, Copy, Check, Clock, RefreshCw, Plus, Trash2, Download } from 'lucide-react';
import Modal from '../components/Modal';
import SettlementCalendar from '../components/SettlementCalendar';
import { exportToExcel, formatDateForExcel, formatCurrencyForExcel } from '../utils/xlsxExport';
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
        const loadData = async () => {
            // Initial load (may get cached/empty data)
            const [c, p] = await Promise.all([fetchCases(), fetchPartners()]);
            setCases(c);
            setPartners(p);
            if (p.length > 0) setSelectedPartnerId(p[0].partnerId);
            setLoading(false);

            // Re-fetch after delay to get Supabase data (background sync)
            setTimeout(async () => {
                const freshCases = await fetchCases();
                // [SAFETY FIX] Ensure freshCases is always an array
                const safeFreshCases = Array.isArray(freshCases) ? freshCases : [];
                const safeC = Array.isArray(c) ? c : [];
                if (safeFreshCases.length > safeC.length) {
                    console.log('[Settlement] Re-fetched cases:', safeFreshCases.length);
                    setCases(safeFreshCases);
                }
            }, 1500);
        };
        loadData();
    }, []);

    // Load batches when partner or week changes
    useEffect(() => {
        const loadBatches = async () => {
            if (!selectedPartnerId || selectedPartnerId === 'all') return;
            setLoadingBatches(true);
            const weekBatches = await fetchSettlementBatches(selectedPartnerId, selectedWeekStart.getFullYear());
            // [SAFETY FIX] Ensure weekBatches is always an array
            setBatches(Array.isArray(weekBatches) ? weekBatches : []);
            setLoadingBatches(false);
        };
        loadBatches();
    }, [selectedPartnerId, selectedWeekStart]);

    if (loading) return <div>로딩중...</div>;

    // [CRITICAL FIX] Ensure cases is always an array for all operations
    const safeCases = Array.isArray(cases) ? cases : [];

    const isAll = selectedPartnerId === 'all';
    const currentPartner = !isAll ? partners.find(p => p.partnerId === selectedPartnerId) : null;
    const weekLabel = getWeekLabel(selectedWeekStart);
    const currentBatch = (Array.isArray(batches) ? batches : []).find(b => b.weekLabel === weekLabel && b.partnerId === selectedPartnerId);

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

    // Filter by Partner (for report tab) - Flexible matching for legacy data
    const selectedPartner = partners.find(p => p.partnerId === selectedPartnerId);
    // Using safeCases from top-level (line 71)
    const _partnerCases = isAll ? safeCases : safeCases.filter(c => {
        if (!c || !c.partnerId) return false;
        // Method 1: Exact ID match
        if (c.partnerId === selectedPartnerId) return true;
        // Method 2: Partner name match (legacy)
        if (selectedPartner && c.partnerId === selectedPartner.name) return true;
        // Method 3: Loose match (only if both are valid strings)
        if (selectedPartner && selectedPartnerId && c.partnerId) {
            if (String(c.partnerId).includes(String(selectedPartnerId)) || String(selectedPartnerId).includes(String(c.partnerId))) return true;
        }
        return false;
    });
    // [SAFETY FIX] Ensure partnerCases is always an array for all downstream operations
    const partnerCases = Array.isArray(_partnerCases) ? _partnerCases : [];

    // DEBUG: Log for troubleshooting (will be visible in console)
    console.log('[Settlement Debug]', {
        selectedPartnerId,
        selectedPartnerName: selectedPartner?.name,
        totalCases: safeCases.length,
        partnerCasesCount: partnerCases.length,
        sampleCasePartnerIds: safeCases.slice(0, 5).map(c => ({ name: c.customerName, partnerId: c.partnerId, contractAt: c.contractAt }))
    });

    // Helper to calculate commission for a specific case
    const getCommissionForCase = (c: Case) => {
        const p = partners.find(partner => partner.partnerId === c.partnerId);
        if (!p) return 0;
        return calculateCommission(c.contractFee || 0, p.commissionRules);
    };

    // Helper to calculate payable commission for a specific week
    // Calculates: thisWeekPayable = currentPayable - previouslyPaid
    const getPayableInfoForCase = (c: Case, weekStartDate: string, weekEndDate: string) => {
        const p = partners.find(partner => partner.partnerId === c.partnerId);
        if (!p) return { payable: 0, thisWeekPayable: 0, total: 0, isPartial: false, thisWeekDeposit: 0, cumulativeDeposit: 0, isThisWeekDeposit: false, isFutureDeposit: false, previouslyPaid: 0 };

        const rule = p.commissionRules.find(r =>
            r.active && (c.contractFee || 0) >= r.minFee && ((c.contractFee || 0) <= r.maxFee || r.maxFee === 0)
        );
        const totalCommission = rule?.commission || 0;
        const threshold = rule?.fullPayoutThreshold || 0;

        // Get deposits array
        const deposits = (c.depositHistory && c.depositHistory.length > 0)
            ? c.depositHistory
            : [
                { date: c.deposit1Date || '', amount: c.deposit1Amount || 0 },
                { date: c.deposit2Date || '', amount: c.deposit2Amount || 0 }
            ];

        // Today's date for comparison
        const today = new Date().toISOString().split('T')[0];

        // Get deposits for THIS WEEK
        const thisWeekDeposits = deposits.filter((d: any) => d.date && d.date >= weekStartDate && d.date <= weekEndDate);
        const thisWeekDeposit = thisWeekDeposits.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

        // Check if ALL this week's deposits are in the FUTURE (not yet occurred)
        const isFutureDeposit = thisWeekDeposits.length > 0 && thisWeekDeposits.every((d: any) => d.date > today);

        // Calculate CUMULATIVE deposits up to week end date
        const cumulativeDeposit = deposits
            .filter((d: any) => d.date && d.date <= weekEndDate)
            .reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

        // Calculate PREVIOUS deposits (before this week)
        const previousDeposit = deposits
            .filter((d: any) => d.date && d.date < weekStartDate)
            .reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

        // Payout rules
        const downPaymentRate = p.settlementConfig?.downPaymentPercentage ? p.settlementConfig.downPaymentPercentage / 100 : 0.1;
        const firstPayoutRate = p.settlementConfig?.firstPayoutPercentage ? p.settlementConfig.firstPayoutPercentage / 100 : 0.5;
        const contractFee = c.contractFee || 0;

        // Calculate what was PREVIOUSLY PAID (based on deposits before this week)
        let previouslyPaid = 0;
        if (threshold > 0 && previousDeposit >= threshold) {
            previouslyPaid = totalCommission; // 100% already paid
        } else if (previousDeposit >= (contractFee * downPaymentRate)) {
            previouslyPaid = totalCommission * firstPayoutRate; // 50% already paid
        }

        // Calculate CURRENT total payable (based on cumulative deposit including this week)
        let currentPayable = 0;
        let isPartial = false;
        if (threshold > 0 && cumulativeDeposit >= threshold) {
            currentPayable = totalCommission;
            isPartial = false;
        } else if (cumulativeDeposit >= (contractFee * downPaymentRate)) {
            currentPayable = totalCommission * firstPayoutRate;
            isPartial = true;
        }

        // THIS WEEK's payable = current - previous
        const thisWeekPayable = Math.max(0, currentPayable - previouslyPaid);

        return {
            payable: currentPayable,
            thisWeekPayable,
            previouslyPaid,
            total: totalCommission,
            isPartial,
            thisWeekDeposit,
            cumulativeDeposit,
            isThisWeekDeposit: thisWeekDeposit > 0,
            isFutureDeposit
        };
    };

    // Filter by Year & Month for Statistics
    // [FIX] 계약 건수 조건: contractAt(계약완료일) AND contractFee(수임료) 모두 필요
    const statsCases = partnerCases.filter(c => {
        // 계약완료일과 수임료가 모두 있어야 계약건으로 인정
        if (!c.contractAt || !c.contractFee) return false;

        const dateStr = c.contractAt;

        // Handle potentially various date formats
        let cDate: Date;
        try {
            cDate = parseISO(dateStr);
            if (isNaN(cDate.getTime())) {
                cDate = new Date(dateStr); // Fallback to native
            }
        } catch (e) {
            return false;
        }

        if (isNaN(cDate.getTime())) return false;

        const cYear = cDate.getFullYear();
        const cMonth = cDate.getMonth() + 1;
        const yearMatch = cYear === year;
        const monthMatch = month === 'all' || cMonth === month;
        return yearMatch && monthMatch;
    });

    // Today for deposit date comparison
    const today = new Date().toISOString().split('T')[0];

    // Helper to get deposit info for a case
    const getDepositInfo = (c: Case) => {
        const deposits = (c.depositHistory && c.depositHistory.length > 0)
            ? c.depositHistory
            : [
                { date: c.deposit1Date || '', amount: c.deposit1Amount || 0 },
                { date: c.deposit2Date || '', amount: c.deposit2Amount || 0 }
            ];

        // Actual deposits (date <= today)
        const actualDeposit = deposits
            .filter((d: any) => d.date && d.date <= today)
            .reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

        // Expected future deposits (date > today)
        const expectedDeposit = deposits
            .filter((d: any) => d.date && d.date > today)
            .reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

        // Total deposits (all)
        const totalDeposit = deposits
            .reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

        return { actualDeposit, expectedDeposit, totalDeposit };
    };

    // Helper to get monthly expected deposits (입금일 기준으로 해당 월에 예정된 입금 계산)
    const getMonthlyExpectedDeposits = () => {
        const monthPrefix = month === 'all'
            ? `${year}-`
            : `${year}-${String(month).padStart(2, '0')}`;

        let expectedCount = 0;
        let expectedAmount = 0;

        partnerCases.forEach(c => {
            const deposits = (c.depositHistory && c.depositHistory.length > 0)
                ? c.depositHistory
                : [
                    { date: c.deposit1Date || '', amount: c.deposit1Amount || 0 },
                    { date: c.deposit2Date || '', amount: c.deposit2Amount || 0 }
                ];

            deposits.forEach((d: any) => {
                // 해당 월에 속하고, 아직 입금되지 않은 건 (today 이후)
                if (d.date && d.date.startsWith(monthPrefix) && d.date > today && d.amount > 0) {
                    expectedCount++;
                    expectedAmount += d.amount;
                }
            });
        });

        return { expectedCount, expectedAmount };
    };
    // Helper to calculate paid commission for a case
    const getPaidCommissionInfo = (c: Case) => {
        const p = partners.find(partner => partner.partnerId === c.partnerId);
        if (!p) return { paidCommission: 0, unpaidCommission: 0, totalCommission: 0 };

        const rule = p.commissionRules.find(r =>
            r.active && (c.contractFee || 0) >= r.minFee && ((c.contractFee || 0) <= r.maxFee || r.maxFee === 0)
        );
        const totalCommission = rule?.commission || 0;
        const threshold = rule?.fullPayoutThreshold || 0;

        const { actualDeposit } = getDepositInfo(c);
        const downPaymentRate = p.settlementConfig?.downPaymentPercentage ? p.settlementConfig.downPaymentPercentage / 100 : 0.1;
        const firstPayoutRate = p.settlementConfig?.firstPayoutPercentage ? p.settlementConfig.firstPayoutPercentage / 100 : 0.5;
        const contractFee = c.contractFee || 0;

        let paidCommission = 0;
        if (threshold > 0 && actualDeposit >= threshold) {
            paidCommission = totalCommission;
        } else if (actualDeposit >= (contractFee * downPaymentRate)) {
            paidCommission = totalCommission * firstPayoutRate;
        }

        return { paidCommission, unpaidCommission: totalCommission - paidCommission, totalCommission };
    };

    // Calculate Enhanced KPIs
    const totalCount = statsCases.length;
    const totalRevenue = statsCases.reduce((sum, c) => sum + (c.contractFee || 0), 0);
    const totalCommission = statsCases.reduce((sum, c) => sum + getCommissionForCase(c), 0);
    const missingDateCount = partnerCases.filter(c => ['계약 완료', '1차 입금완료', '2차 입금완료'].includes(c.status) && !c.contractAt).length;

    // NEW KPIs
    const totalActualDeposit = statsCases.reduce((sum, c) => sum + getDepositInfo(c).actualDeposit, 0);
    // 월별 입금 예정 (입금일 기준)
    const { expectedCount: monthlyExpectedCount, expectedAmount: monthlyExpectedAmount } = getMonthlyExpectedDeposits();
    const totalPaidCommission = statsCases.reduce((sum, c) => sum + getPaidCommissionInfo(c).paidCommission, 0);
    const totalUnpaidCommission = totalCommission - totalPaidCommission;
    const installmentInProgress = statsCases.filter(c => (c.installmentMonths || 1) > 1 && getPaidCommissionInfo(c).paidCommission < getPaidCommissionInfo(c).totalCommission).length;
    const depositCompleteCount = statsCases.filter(c => {
        const { actualDeposit, totalDeposit } = getDepositInfo(c);
        return totalDeposit > 0 && actualDeposit >= totalDeposit;
    }).length;
    const depositRate = totalCount > 0 ? Math.round((depositCompleteCount / totalCount) * 100) : 0;

    // Monthly Stats for Chart (Enhanced)
    const monthlyStats = Array.from({ length: 12 }, (_, i) => {
        const monthStr = `${year}-${String(i + 1).padStart(2, '0')}`;
        const monthCases = partnerCases.filter(c => c.contractAt && c.contractAt.startsWith(monthStr));
        const revenue = monthCases.reduce((sum, c) => sum + (c.contractFee || 0), 0);
        const commission = monthCases.reduce((sum, c) => sum + getCommissionForCase(c), 0);
        const actualDeposit = monthCases.reduce((sum, c) => sum + getDepositInfo(c).actualDeposit, 0);
        const paidCommission = monthCases.reduce((sum, c) => sum + getPaidCommissionInfo(c).paidCommission, 0);
        const unpaidCommission = commission - paidCommission;
        return {
            name: `${i + 1}월`,
            count: monthCases.length,
            revenue,
            commission,
            actualDeposit,
            paidCommission,
            unpaidCommission,
            netProfit: actualDeposit - paidCommission
        };
    });

    const getPartnerName = (pid: string) => partners.find(p => p.partnerId === pid)?.name || '-';

    // Get deals for current week batch
    const weekDeals = currentBatch?.dealIds.map(id => safeCases.find(c => c.caseId === id)).filter(Boolean) as Case[] || [];

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
                                                const info = getPayableInfoForCase(deal, currentBatch!.startDate, currentBatch!.endDate);
                                                return (
                                                    <tr key={deal.caseId} className={`hover:bg-gray-50 ${info.isFutureDeposit ? 'bg-purple-50/50' : ''}`}>
                                                        <td className="px-3 py-2 font-medium">
                                                            {deal.customerName}
                                                            {info.isFutureDeposit && (
                                                                <span className="ml-1 text-xs text-purple-500">(예상)</span>
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-2 text-center text-xs text-gray-500">{deal.installmentMonths || '-'}</td>
                                                        <td className="px-2 py-2 text-right text-gray-700">{deal.contractFee?.toLocaleString()}만원</td>
                                                        <td className={`px-2 py-2 text-right font-medium ${info.isFutureDeposit ? 'text-purple-500' : 'text-blue-600'}`}>
                                                            {info.isFutureDeposit && <span className="text-xs mr-0.5">예상</span>}
                                                            {info.thisWeekDeposit.toLocaleString()}만원
                                                        </td>
                                                        <td className="px-2 py-2 text-right text-orange-500">{info.total.toLocaleString()}만원</td>
                                                        <td className={`px-2 py-2 text-right font-bold ${info.isFutureDeposit ? 'text-purple-600' : 'text-green-600'}`}>
                                                            {info.isFutureDeposit && <span className="text-xs mr-0.5">예상</span>}
                                                            {info.thisWeekPayable.toLocaleString()}만원
                                                        </td>
                                                        <td className="px-2 py-2 text-center">
                                                            {info.isFutureDeposit ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">
                                                                    예상
                                                                </span>
                                                            ) : info.isPartial ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">
                                                                    50%
                                                                </span>
                                                            ) : info.thisWeekPayable > 0 ? (
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

    const renderWednesdayTab = () => {
        const payoutItems = currentBatch?.payoutItems || [];

        const addPayoutItem = async () => {
            if (!currentBatch) return;
            const newItem = {
                id: `payout-${Date.now()}`,
                partnerName: '',
                partnerAccount: '',
                amount: 0
            };
            const updatedItems = [...payoutItems, newItem];
            await updateSettlementBatch(currentBatch.batchId, { payoutItems: updatedItems });
            setBatches(prev => prev.map(b => b.batchId === currentBatch.batchId ? { ...b, payoutItems: updatedItems } : b));
        };

        const updatePayoutItem = async (itemId: string, updates: Partial<typeof payoutItems[0]>) => {
            if (!currentBatch) return;
            const updatedItems = payoutItems.map(item => item.id === itemId ? { ...item, ...updates } : item);
            await updateSettlementBatch(currentBatch.batchId, { payoutItems: updatedItems });
            setBatches(prev => prev.map(b => b.batchId === currentBatch.batchId ? { ...b, payoutItems: updatedItems } : b));
        };

        const deletePayoutItem = async (itemId: string) => {
            if (!currentBatch) return;
            const updatedItems = payoutItems.filter(item => item.id !== itemId);
            await updateSettlementBatch(currentBatch.batchId, { payoutItems: updatedItems });
            setBatches(prev => prev.map(b => b.batchId === currentBatch.batchId ? { ...b, payoutItems: updatedItems } : b));
        };

        const markPayoutPaid = async (itemId: string) => {
            const today = new Date().toISOString().split('T')[0];
            await updatePayoutItem(itemId, { paidAt: today });
        };

        const handleCollectionComplete = async () => {
            if (!currentBatch) return;
            const today = new Date().toISOString().split('T')[0];
            const collectionInfo = { collectedAt: today, amount: currentBatch.totalCommission };
            await updateSettlementBatch(currentBatch.batchId, { collectionInfo, status: 'collected' as any });
            setBatches(prev => prev.map(b => b.batchId === currentBatch.batchId ? { ...b, collectionInfo, status: 'collected' as any } : b));
            showToast('수금 완료 처리되었습니다.', 'success');
        };

        const handleInvoiceReceived = async () => {
            if (!currentBatch) return;
            const today = new Date().toISOString().split('T')[0];
            const purchaseInvoice = { receivedAt: today };
            await updateSettlementBatch(currentBatch.batchId, { purchaseInvoice, status: 'completed' as any });
            setBatches(prev => prev.map(b => b.batchId === currentBatch.batchId ? { ...b, purchaseInvoice, status: 'completed' as any } : b));
            showToast('매입 세금계산서 수취 완료 처리되었습니다.', 'success');
        };

        const presets = currentPartner?.payoutPartnerPresets || [];

        return (
            <div className="space-y-6">
                {/* Section 1: 수금 정보 */}
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                    <h3 className="font-bold text-blue-800 mb-4 text-lg flex items-center">
                        💰 수금 정보 (거래처에서 받을 금액)
                    </h3>

                    {!currentBatch || !['collected', 'invoiced', 'confirmed', 'paid', 'completed'].includes(currentBatch.status) ? (
                        <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                            <AlertTriangle className="mx-auto text-yellow-500 mb-2" size={32} />
                            <p className="text-gray-600">화요일 탭에서 발행을 먼저 완료해주세요.</p>
                        </div>
                    ) : (
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div className="bg-blue-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500">수금 대상 금액</p>
                                    <p className="text-2xl font-bold text-blue-700">{currentBatch.totalCommission.toLocaleString()}만원</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500">거래처</p>
                                    <p className="text-lg font-bold text-gray-700">{currentPartner?.name}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500">내 입금 계좌</p>
                                    <p className="text-sm font-medium text-gray-600">
                                        {currentPartner?.bankInfo
                                            ? `${currentPartner.bankInfo.bankName} ${currentPartner.bankInfo.accountNumber}`
                                            : '(설정에서 입력)'}
                                    </p>
                                </div>
                            </div>
                            {currentBatch.collectionInfo?.collectedAt ? (
                                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                    <p className="text-green-700 font-bold text-lg">
                                        ✓ 수금완료 ({currentBatch.collectionInfo.collectedAt})
                                    </p>
                                    <p className="text-green-600">{currentBatch.collectionInfo.amount?.toLocaleString()}만원 입금 확인</p>
                                </div>
                            ) : (
                                <button
                                    onClick={handleCollectionComplete}
                                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700"
                                >
                                    💰 수금 완료 처리
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Section 2: 파트너 지급 (복수 지원) */}
                <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-green-800 text-lg flex items-center">
                            <CreditCard className="mr-2" size={20} /> 파트너 지급 ({payoutItems.length}건)
                        </h3>
                        {currentBatch && ['collected', 'invoiced', 'confirmed', 'paid', 'completed'].includes(currentBatch.status) && (
                            <button
                                onClick={addPayoutItem}
                                className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-1"
                            >
                                <Plus size={16} /> 지급 추가
                            </button>
                        )}
                    </div>

                    {payoutItems.length === 0 ? (
                        <p className="text-sm text-gray-500 bg-white p-4 rounded-lg">파트너 지급이 없으면 "지급 추가" 없이 두세요.</p>
                    ) : (
                        <div className="space-y-3">
                            {payoutItems.map((item, idx) => (
                                <div key={item.id} className="bg-white p-4 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-sm font-medium text-gray-500">지급 #{idx + 1}</span>
                                        {!item.paidAt && (
                                            <button onClick={() => deletePayoutItem(item.id)} className="text-red-500 hover:text-red-700">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Preset Dropdown */}
                                    {presets.length > 0 && !item.partnerName && (
                                        <div className="mb-3">
                                            <label className="block text-xs text-gray-500 mb-1">프리셋 선택</label>
                                            <select
                                                onChange={(e) => {
                                                    const preset = presets.find(p => p.id === e.target.value);
                                                    if (preset) {
                                                        updatePayoutItem(item.id, {
                                                            partnerName: preset.name,
                                                            partnerAccount: preset.accountInfo,
                                                            amount: preset.defaultAmount || 0
                                                        });
                                                    }
                                                }}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                            >
                                                <option value="">직접 입력</option>
                                                {presets.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name} - {p.accountInfo}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">파트너명</label>
                                            <input
                                                type="text"
                                                defaultValue={item.partnerName}
                                                onBlur={(e) => updatePayoutItem(item.id, { partnerName: e.target.value })}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                                placeholder="파트너명"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">계좌정보</label>
                                            <input
                                                type="text"
                                                defaultValue={item.partnerAccount}
                                                onBlur={(e) => updatePayoutItem(item.id, { partnerAccount: e.target.value })}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                                placeholder="은행 계좌번호"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">금액 (만원)</label>
                                            <input
                                                type="number"
                                                defaultValue={item.amount}
                                                onBlur={(e) => updatePayoutItem(item.id, { amount: parseInt(e.target.value) || 0 })}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        {item.paidAt ? (
                                            <div className="bg-green-50 p-2 rounded border border-green-200">
                                                <p className="text-green-700 font-bold">✓ 지급완료 ({item.paidAt}) - {item.amount?.toLocaleString()}만원</p>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => markPayoutPaid(item.id)}
                                                className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700"
                                            >
                                                ✓ 지급 완료 처리
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Section 3: 매입 세금계산서 수취 */}
                <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
                    <h3 className="font-bold text-purple-800 mb-4 text-lg flex items-center">
                        📥 매입 세금계산서 수취
                    </h3>
                    {currentBatch && ['collected', 'invoiced', 'confirmed', 'paid', 'completed'].includes(currentBatch.status) && (
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            {currentBatch.purchaseInvoice?.receivedAt ? (
                                <div className="bg-purple-50 p-3 rounded border border-purple-200">
                                    <p className="text-purple-700 font-bold text-lg">✓ 수취완료 ({currentBatch.purchaseInvoice.receivedAt})</p>
                                </div>
                            ) : (
                                <button
                                    onClick={handleInvoiceReceived}
                                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700"
                                >
                                    📥 매입 세금계산서 수취 완료
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderReportTab = () => (
        <div className="space-y-6">
            {/* Row 1: Main KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div
                    onClick={() => setIsDetailModalOpen(true)}
                    className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-all group"
                >
                    <div className="flex justify-between items-start">
                        <p className="text-sm text-gray-500">📋 계약 건수</p>
                        <Search size={14} className="text-gray-300 group-hover:text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{totalCount}건</p>
                    <p className="text-xs text-blue-500 mt-1">상세 보기 →</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">💰 총 매출</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{totalRevenue.toLocaleString()}만원</p>
                    <p className="text-xs text-gray-400 mt-1">수임료 합계</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">✅ 실제 입금액</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{totalActualDeposit.toLocaleString()}만원</p>
                    <p className="text-xs text-gray-400 mt-1">오늘까지 확정</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">📅 예상 입금액</p>
                    <p className="text-2xl font-bold text-orange-500 mt-1">{monthlyExpectedAmount.toLocaleString()}만원</p>
                    <p className="text-xs text-gray-400 mt-1">{monthlyExpectedCount}건 입금 예정</p>
                </div>
            </div>

            {/* Row 2: Commission KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-white p-5 rounded-xl shadow-sm border border-green-200">
                    <p className="text-sm text-green-700">💵 지급된 수수료</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{totalPaidCommission.toLocaleString()}만원</p>
                    <p className="text-xs text-green-500 mt-1">입금 확정 기준</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-white p-5 rounded-xl shadow-sm border border-orange-200">
                    <p className="text-sm text-orange-700">🔜 미지급 수수료</p>
                    <p className="text-2xl font-bold text-orange-600 mt-1">{totalUnpaidCommission.toLocaleString()}만원</p>
                    <p className="text-xs text-orange-500 mt-1">추가 입금 필요</p>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-xl shadow-sm border border-indigo-200">
                    <p className="text-sm text-indigo-700">📊 분납 진행중</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">{installmentInProgress}건</p>
                    <p className="text-xs text-indigo-500 mt-1">추가 입금 대기</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-white p-5 rounded-xl shadow-sm border border-blue-200">
                    <p className="text-sm text-blue-700">📈 입금 완료율</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{depositRate}%</p>
                    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${depositRate}%` }} />
                    </div>
                </div>
            </div>

            {/* Overdue Management Section */}
            {(() => {
                // Use partnerCases from parent scope (already filtered with flexible matching)
                // [SAFETY FIX] Ensure partnerCases is always an array
                const safePartnerCases = Array.isArray(partnerCases) ? partnerCases : [];
                const today = new Date();

                // Filter overdue cases
                // 1. Unpaid amount > 0
                // 2. Last deposit (or contract date) was > 30 days ago
                const overdueCases = safePartnerCases.filter(c => {
                    if (c.status === '종결' || c.status === '취소') return false;

                    const contractFee = c.contractFee || 0;
                    const totalDeposited = (c.depositHistory || []).reduce((sum, d) => sum + (d.amount || 0), 0);
                    const unpaidAmount = contractFee - totalDeposited;

                    if (unpaidAmount <= 0) return false;

                    // Check date
                    let lastActivityDateStr = c.contractAt || c.createdAt;
                    if (c.depositHistory && c.depositHistory.length > 0) {
                        // Find latest deposit
                        const dates = c.depositHistory.map(d => d.date).sort();
                        lastActivityDateStr = dates[dates.length - 1];
                    }

                    if (!lastActivityDateStr) return false;

                    const lastDate = parseISO(lastActivityDateStr);
                    const diffDays = differenceInDays(today, lastDate);

                    return diffDays >= 30;
                }).map(c => {
                    const contractFee = c.contractFee || 0;
                    const totalDeposited = (c.depositHistory || []).reduce((sum, d) => sum + (d.amount || 0), 0);
                    const unpaidAmount = contractFee - totalDeposited;
                    let lastActivityDateStr = c.contractAt || c.createdAt;
                    if (c.depositHistory && c.depositHistory.length > 0) {
                        const dates = c.depositHistory.map(d => d.date).sort();
                        lastActivityDateStr = dates[dates.length - 1];
                    }
                    return {
                        ...c,
                        unpaidAmount,
                        overdueDays: differenceInDays(today, parseISO(lastActivityDateStr!))
                    };
                }).sort((a, b) => b.unpaidAmount - a.unpaidAmount); // Sort by highest unpaid amount

                if (overdueCases.length === 0) return null;

                return (
                    <div className="bg-red-50 rounded-xl shadow-sm border border-red-100 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 bg-red-100 text-red-600 rounded-lg">🚨</span>
                                <div>
                                    <h3 className="font-bold text-red-800">장기 미수금 현황</h3>
                                    <p className="text-xs text-red-600">최근 30일 이상 미입금 고객 ({overdueCases.length}명)</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-red-500">총 미수금</p>
                                <p className="font-bold text-red-700 text-lg">
                                    {overdueCases.reduce((sum, c) => sum + c.unpaidAmount, 0).toLocaleString()}만원
                                </p>
                            </div>
                        </div>

                        {/* Horizontal Scroll for Overdue Cards */}
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                            {overdueCases.map(c => (
                                <div key={c.caseId} className="min-w-[240px] bg-white p-4 rounded-lg border border-red-200 shadow-sm flex-shrink-0">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-gray-800">{c.customerName}</span>
                                        <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-bold">
                                            +{c.overdueDays}일째
                                        </span>
                                    </div>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">미납액</span>
                                            <span className="font-bold text-red-600">{c.unpaidAmount.toLocaleString()}만원</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">진행상태</span>
                                            <span className="text-gray-700">{c.status}</span>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                                        <p className="text-xs text-gray-400">마지막: {c.depositHistory?.length ? '입금' : '계약'}일 기준</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80 flex flex-col">
                <h3 className="text-lg font-bold text-gray-700 mb-4 flex-shrink-0">📊 월별 수익 현황</h3>
                <div className="flex-1 min-h-0 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyStats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip formatter={(value: number) => [`${value.toLocaleString()}만원`, '']} />
                            <Legend />
                            <Bar dataKey="actualDeposit" fill="#10b981" name="실제입금" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="paidCommission" fill="#ef4444" name="지급수수료" radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="netProfit" stroke="#3b82f6" strokeWidth={2} name="순수익 (입금-지급)" dot={{ r: 4 }} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Monthly Summary Table (Enhanced) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold text-gray-700">📅 월별 상세 요약</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600 font-medium">
                            <tr>
                                <th className="py-3 px-3 text-center">월</th>
                                <th className="py-3 px-3 text-center">건수</th>
                                <th className="py-3 px-3 text-right">매출</th>
                                <th className="py-3 px-3 text-right text-green-600">입금액</th>
                                <th className="py-3 px-3 text-right text-blue-600">총수수료</th>
                                <th className="py-3 px-3 text-right text-green-600">지급완료</th>
                                <th className="py-3 px-3 text-right text-orange-600">미지급</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlyStats.map((m, i) => (
                                <tr key={i} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 ${month === (i + 1) ? 'bg-blue-50' : ''}`}>
                                    <td className="py-3 px-3 font-medium text-center">{m.name}</td>
                                    <td className="py-3 px-3 text-center text-gray-500">{m.count}</td>
                                    <td className="py-3 px-3 text-right text-gray-700">{m.revenue.toLocaleString()}만원</td>
                                    <td className="py-3 px-3 text-right text-green-600 font-medium">{m.actualDeposit.toLocaleString()}만원</td>
                                    <td className="py-3 px-3 text-right text-blue-600">{m.commission.toLocaleString()}만원</td>
                                    <td className="py-3 px-3 text-right text-green-600 font-bold">{m.paidCommission.toLocaleString()}만원</td>
                                    <td className="py-3 px-3 text-right text-orange-600">{m.unpaidCommission.toLocaleString()}만원</td>
                                </tr>
                            ))}
                            {/* Total Row */}
                            <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                <td className="py-3 px-3 text-center">합계</td>
                                <td className="py-3 px-3 text-center">{totalCount}</td>
                                <td className="py-3 px-3 text-right text-gray-700">{totalRevenue.toLocaleString()}만원</td>
                                <td className="py-3 px-3 text-right text-green-600">{totalActualDeposit.toLocaleString()}만원</td>
                                <td className="py-3 px-3 text-right text-blue-600">{totalCommission.toLocaleString()}만원</td>
                                <td className="py-3 px-3 text-right text-green-600">{totalPaidCommission.toLocaleString()}만원</td>
                                <td className="py-3 px-3 text-right text-orange-600">{totalUnpaidCommission.toLocaleString()}만원</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Partner Stats Section (Only visible when viewing all) */}
            {isAll && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                    <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                        <h3 className="font-bold text-gray-700">🤝 파트너별 성과 분석</h3>
                        <p className="text-xs text-gray-500 mt-1">파트너별 수임 건수 및 수수료 지급 현황</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600 font-medium">
                                <tr>
                                    <th className="py-3 px-3 text-left">파트너명</th>
                                    <th className="py-3 px-3 text-center">건수</th>
                                    <th className="py-3 px-3 text-right">총 수임료</th>
                                    <th className="py-3 px-3 text-right text-blue-600">지급 완료</th>
                                    <th className="py-3 px-3 text-right text-orange-600">미지급</th>
                                    <th className="py-3 px-3 text-right">지급률</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {partners.map(p => {
                                    const pCases = safeCases.filter(c => c.partnerId === p.partnerId);
                                    if (pCases.length === 0) return null;

                                    const count = pCases.length;
                                    const revenue = pCases.reduce((sum, c) => sum + (c.contractFee || 0), 0);
                                    const paid = pCases.reduce((sum, c) => sum + getPaidCommissionInfo(c).paidCommission, 0);
                                    const totalComm = pCases.reduce((sum, c) => sum + getCommissionForCase(c), 0);
                                    const unpaid = totalComm - paid;
                                    const rate = totalComm > 0 ? Math.round((paid / totalComm) * 100) : 0;

                                    return { p, count, revenue, paid, unpaid, rate };
                                })
                                    .filter(item => item !== null)
                                    .sort((a, b) => (b?.revenue || 0) - (a?.revenue || 0))
                                    .map((item, idx) => (
                                        <tr key={item!.p.partnerId} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-3 px-3 font-medium text-gray-800">
                                                {idx + 1}. {item!.p.name}
                                            </td>
                                            <td className="py-3 px-3 text-center">{item!.count}건</td>
                                            <td className="py-3 px-3 text-right font-bold">{item!.revenue.toLocaleString()}만원</td>
                                            <td className="py-3 px-3 text-right text-blue-600">{item!.paid.toLocaleString()}만원</td>
                                            <td className="py-3 px-3 text-right text-orange-600">{item!.unpaid.toLocaleString()}만원</td>
                                            <td className="py-3 px-3 text-right text-gray-500">{item!.rate}%</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Future Cashflow Prediction */}
            {(() => {
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0];

                // Collect future deposits from all cases
                interface FutureDeposit {
                    caseId: string;
                    customerName: string;
                    depositDate: string;
                    amount: number;
                    depositNumber: number;
                    contractFee: number;
                    totalDeposited: number; // up to this deposit
                    expectedPayout: number;
                    payoutDate: string;
                }

                const futureDeposits: FutureDeposit[] = [];

                const partnerCasesForFuture = safeCases.filter(c => c.partnerId === selectedPartnerId);

                partnerCasesForFuture.forEach(c => {
                    if (!c.depositHistory || c.depositHistory.length === 0) return;
                    if (!currentPartner) return; // Skip if no partner selected
                    const commission = calculateCommission(currentPartner, c.contractFee || 0);

                    let cumulativeDeposit = 0;
                    c.depositHistory.forEach((dep, idx) => {
                        if (!dep.date || dep.date <= todayStr) {
                            // Past deposit - just accumulate
                            cumulativeDeposit += dep.amount || 0;
                            return;
                        }

                        // Future deposit - calculate incremental payout
                        const rules = currentPartner?.commissionRules || [];
                        const config = currentPartner?.settlementConfig;

                        // 1. 오늘까지의 입금으로 이미 지급된 수수료 계산
                        const pastDeposits = c.depositHistory!.filter((d, i) => d.date && d.date <= todayStr);
                        const mockCasePast = { ...c, depositHistory: pastDeposits } as Case;
                        const alreadyPaidInfo = calculatePayableCommission(mockCasePast, rules, config);
                        const alreadyPaid = alreadyPaidInfo.payable;

                        // 2. 이 미래 입금 포함한 누적 입금으로 지급 가능한 총 수수료 계산
                        cumulativeDeposit += dep.amount || 0;
                        const mockCase = {
                            ...c,
                            depositHistory: c.depositHistory!.slice(0, idx + 1)
                        } as Case;
                        const payableInfo = calculatePayableCommission(mockCase, rules, config);

                        // 3. 추가 지급액 = 총 지급 가능액 - 이미 지급된 금액
                        const incrementalPayout = Math.max(0, payableInfo.payable - alreadyPaid);

                        // Calculate payout date: next Tuesday after the week containing this deposit
                        const depositDate = new Date(dep.date);
                        const dayOfWeek = depositDate.getDay();
                        // Find next Tuesday (day 2)
                        let daysUntilTuesday = (2 - dayOfWeek + 7) % 7;
                        if (daysUntilTuesday === 0) daysUntilTuesday = 7; // If it's Tuesday, next Tuesday
                        // If deposit is Mon-Sun, payout is next week's Tuesday (2 days after week end)
                        const weekEnd = new Date(depositDate);
                        weekEnd.setDate(weekEnd.getDate() + (7 - dayOfWeek)); // Go to next Sunday
                        weekEnd.setDate(weekEnd.getDate() + 2); // Add 2 days = Tuesday

                        futureDeposits.push({
                            caseId: c.caseId,
                            customerName: c.customerName,
                            depositDate: dep.date,
                            amount: dep.amount || 0,
                            depositNumber: idx + 1,
                            contractFee: c.contractFee || 0,
                            totalDeposited: cumulativeDeposit,
                            expectedPayout: incrementalPayout, // 이제 추가 지급액만 표시
                            payoutDate: weekEnd.toISOString().split('T')[0]
                        });
                    });
                });

                // Sort by deposit date
                futureDeposits.sort((a, b) => a.depositDate.localeCompare(b.depositDate));

                // Take only next 60 days
                const sixtyDaysLater = new Date(today);
                sixtyDaysLater.setDate(sixtyDaysLater.getDate() + 60);
                const sixtyDaysStr = sixtyDaysLater.toISOString().split('T')[0];
                const nearFutureDeposits = futureDeposits.filter(d => d.depositDate <= sixtyDaysStr);

                // Calculate totals
                const totalFutureDeposit = nearFutureDeposits.reduce((sum, d) => sum + d.amount, 0);
                const totalFuturePayout = nearFutureDeposits.reduce((sum, d) => sum + d.expectedPayout, 0);

                if (nearFutureDeposits.length === 0) {
                    return (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">🔮</span>
                                <h3 className="font-bold text-gray-700">미래 입금/지급 예측</h3>
                            </div>
                            <p className="text-gray-400 text-sm">향후 60일 내 예정된 입금이 없습니다.</p>
                        </div>
                    );
                }

                return (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">🔮</span>
                                    <div>
                                        <h3 className="font-bold text-gray-700">미래 입금/지급 예측</h3>
                                        <p className="text-xs text-gray-500">향후 60일 내 예정된 입금과 수수료 지급 일정</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 text-sm">
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500">예상 입금</p>
                                        <p className="font-bold text-green-600">{totalFutureDeposit.toLocaleString()}만원</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500">예상 지급</p>
                                        <p className="font-bold text-orange-600">{totalFuturePayout.toLocaleString()}만원</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Timeline + Table View */}
                        <div className="p-4">
                            <div className="space-y-3">
                                {nearFutureDeposits.map((dep, idx) => (
                                    <div key={`${dep.caseId}-${dep.depositNumber}`} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                        {/* Date Badge */}
                                        <div className="flex-shrink-0 text-center">
                                            <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-bold text-sm">
                                                {new Date(dep.depositDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1">입금예정</p>
                                        </div>

                                        {/* Customer Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-800">{dep.customerName}</span>
                                                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                                                    {dep.depositNumber}차 입금
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1">
                                                수임료 {dep.contractFee}만원 중 누적 {dep.totalDeposited}만원 입금
                                            </p>
                                        </div>

                                        {/* Amount */}
                                        <div className="text-right flex-shrink-0">
                                            <p className="font-bold text-green-600 text-lg">+{dep.amount.toLocaleString()}만원</p>
                                            {dep.expectedPayout > 0 && (
                                                <div className="mt-1 text-xs">
                                                    <span className="text-orange-600">→ {dep.payoutDate.slice(5).replace('-', '/')} 수수료 {dep.expectedPayout}만원</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Weekly Batch Status Overview */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-gray-700">📋 주간 정산 배치 현황</h3>
                        <p className="text-xs text-gray-500 mt-1">최근 정산 배치별 수금/지급/세금계산서 상태</p>
                    </div>
                    <button
                        onClick={() => {
                            const safeBatches = Array.isArray(batches) ? batches : [];
                            if (safeBatches.length === 0) {
                                showToast('내보낼 데이터가 없습니다.', 'error');
                                return;
                            }
                            const excelData = safeBatches.map(b => ({
                                '주차': b.weekLabel,
                                '기간': `${b.startDate} ~ ${b.endDate}`,
                                '수수료(만원)': b.totalCommission,
                                '수금상태': b.collectionInfo?.collectedAt ? `완료 (${b.collectionInfo.collectedAt})` : '대기',
                                '파트너 지급': (b.payoutItems || []).length > 0
                                    ? (b.payoutItems || []).map(p => `${p.partnerName}(${p.amount}만원)`).join(', ')
                                    : '없음',
                                '세금계산서': b.purchaseInvoice?.receivedAt ? `수취 (${b.purchaseInvoice.receivedAt})` : '미수취',
                                '상태': getSettlementStatusLabel(b.status)
                            }));
                            exportToExcel(`정산내역_${new Date().toISOString().split('T')[0]}`, excelData);
                            showToast('엑셀 파일이 다운로드되었습니다.', 'success');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                        <Download size={16} />
                        엑셀 다운로드
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600 font-medium">
                            <tr>
                                <th className="py-3 px-3 text-left">주차</th>
                                <th className="py-3 px-3 text-right">수수료</th>
                                <th className="py-3 px-3 text-center">수금</th>
                                <th className="py-3 px-3 text-center">파트너 지급</th>
                                <th className="py-3 px-3 text-center">매입세금계산서</th>
                                <th className="py-3 px-3 text-center">상태</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(Array.isArray(batches) ? batches : []).slice(0, 8).map((b) => {
                                const payoutCount = (b.payoutItems || []).length;
                                const paidPayoutCount = (b.payoutItems || []).filter(p => p.paidAt).length;
                                const totalPayoutAmount = (b.payoutItems || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                                return (
                                    <tr key={b.batchId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                        <td className="py-3 px-3 font-medium">{b.weekLabel}</td>
                                        <td className="py-3 px-3 text-right font-bold text-blue-600">{b.totalCommission.toLocaleString()}만원</td>
                                        <td className="py-3 px-3 text-center">
                                            {b.collectionInfo?.collectedAt ? (
                                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">✓ {b.collectionInfo.amount?.toLocaleString()}만원</span>
                                            ) : (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">대기</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            {payoutCount > 0 ? (
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${paidPayoutCount === payoutCount ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {paidPayoutCount}/{payoutCount}건 ({totalPayoutAmount}만원)
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-400 rounded-full text-xs">없음</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            {b.purchaseInvoice?.receivedAt ? (
                                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">✓ 수취완료</span>
                                            ) : (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">미수취</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium
                                                ${b.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    b.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                                                        b.status === 'collected' ? 'bg-teal-100 text-teal-700' :
                                                            'bg-gray-100 text-gray-600'}`}>
                                                {getSettlementStatusLabel(b.status)}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Partner Payout Breakdown */}
            {(() => {
                // Aggregate payouts by partner name across all batches
                // [SAFETY FIX] Ensure batches is always an array
                const safeBatches = Array.isArray(batches) ? batches : [];
                const payoutByPartner: Record<string, { total: number; paid: number; count: number }> = {};
                safeBatches.forEach(b => {
                    (b.payoutItems || []).forEach(item => {
                        const name = item.partnerName || '미지정';
                        if (!payoutByPartner[name]) payoutByPartner[name] = { total: 0, paid: 0, count: 0 };
                        payoutByPartner[name].total += item.amount || 0;
                        payoutByPartner[name].count += 1;
                        if (item.paidAt) payoutByPartner[name].paid += item.amount || 0;
                    });
                });
                const partnerList = Object.entries(payoutByPartner).sort((a, b) => b[1].total - a[1].total);

                if (partnerList.length === 0) return null;

                return (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
                            <h3 className="font-bold text-gray-700">💳 파트너별 지급 현황</h3>
                            <p className="text-xs text-gray-500 mt-1">전체 정산 기간 파트너 지급 누계</p>
                        </div>
                        <div className="p-4 grid gap-3">
                            {partnerList.map(([name, data]) => (
                                <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">🏢</span>
                                        <div>
                                            <p className="font-medium text-gray-800">{name}</p>
                                            <p className="text-xs text-gray-500">{data.count}건</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-green-600">{data.paid.toLocaleString()}만원 <span className="text-gray-400 font-normal">지급</span></p>
                                        {data.total > data.paid && (
                                            <p className="text-xs text-orange-600">{(data.total - data.paid).toLocaleString()}만원 미지급</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Warning for missing dates */}
            {missingDateCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                        <p className="font-bold text-red-700">계약일 누락: {missingDateCount}건</p>
                        <p className="text-sm text-red-600">계약일이 없는 건은 정산 집계에서 제외됩니다.</p>
                    </div>
                </div>
            )}

            {/* Settlement History Calendar */}
            <SettlementCalendar batches={batches} />
        </div>
    );

    // Notification Logic
    const notificationToday = new Date();
    const notificationDayOfWeek = notificationToday.getDay(); // 0:Sun, 1:Mon, ...

    // 1. Overdue Count
    const totalOverdueCount = safeCases.filter(c => {
        if (c.status === '종결' || c.status === '취소') return false;
        const totalDeposited = (c.depositHistory || []).reduce((sum, d) => sum + (d.amount || 0), 0);
        const unpaid = (c.contractFee || 0) - totalDeposited;
        if (unpaid <= 0) return false;

        // Simple 30 days check
        const lastDateStr = c.depositHistory?.length
            ? c.depositHistory.map(d => d.date).sort().pop()
            : (c.contractAt || c.createdAt);
        if (!lastDateStr) return false;
        return differenceInDays(notificationToday, parseISO(lastDateStr)) >= 30;
    }).length;

    // 2. Weekly Task Check
    let weeklyTaskAlert: { type: 'warning' | 'info', msg: string } | null = null;
    if (notificationDayOfWeek === 1) { // Monday
        if (!currentBatch) weeklyTaskAlert = { type: 'warning', msg: '월요일입니다. 금주 정산 배치를 생성하고 확인해주세요.' };
        else if (currentBatch.status === 'draft') weeklyTaskAlert = { type: 'info', msg: '정산 내역을 확인하고 확정(Confirmed)해주세요.' };
    } else if (notificationDayOfWeek === 2) { // Tuesday
        if (currentBatch && !currentBatch.invoiceInfo) weeklyTaskAlert = { type: 'warning', msg: '화요일입니다. 세금계산서 발행 및 수금 확인이 필요합니다.' };
    } else if (notificationDayOfWeek === 3) { // Wednesday
        if (currentBatch && currentBatch.status !== 'completed' && currentBatch.status !== 'paid')
            weeklyTaskAlert = { type: 'warning', msg: '수요일입니다. 파트너 수수료 지급을 진행해주세요.' };
    }

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

            {/* Notification Center */}
            <div className="space-y-2 mb-4">
                {totalOverdueCount > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between animate-pulse">
                        <div className="flex items-center gap-2 text-red-700">
                            <span className="font-bold">🚨 긴급</span>
                            <span className="text-sm">현재 30일 이상 장기 미수금 건이 <span className="font-bold underline">{totalOverdueCount}건</span> 있습니다.</span>
                        </div>
                        <button
                            onClick={() => { setActiveTab('report'); }}
                            className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold hover:bg-red-200"
                        >
                            확인하기
                        </button>
                    </div>
                )}
                {weeklyTaskAlert && (
                    <div className={`border rounded-lg p-3 flex items-center gap-2 ${weeklyTaskAlert.type === 'warning' ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-blue-50 border-blue-200 text-blue-800'
                        }`}>
                        <span>{weeklyTaskAlert.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                        <span className="text-sm font-medium">{weeklyTaskAlert.msg}</span>
                    </div>
                )}
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
