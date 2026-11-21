/**
 * components/settlement/SettlementPipelineModal.tsx
 * 거래처(로펌)별 상태 기반 3단계 정산 마감 파이프라인 모달
 * - Step 1: 수임 건 대사 & 확정 (Draft -> Confirmed)
 * - Step 2: 세금계산서 역발행 청구 & 수금 확인 (Invoiced -> Collected)
 * - Step 3: 상담원 수당 분배 & 정산 최종 마감 (Payout -> Paid)
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Building, Calendar, CheckCircle2, Clock, AlertTriangle,
  FileText, DollarSign, Users, Copy, Check, RefreshCw, Plus,
  Trash2, ArrowRight, ArrowLeft, ShieldCheck, ExternalLink, ChevronRight
} from 'lucide-react';
import { Partner, Case, SettlementBatch, PayoutItem } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { roundWonPrecision, todayKST } from '../../utils/settlement';

interface SettlementPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: Partner | null;
  cases: Case[];
  batches: SettlementBatch[];
  onUpdateBatch: (batchId: string, updates: Partial<SettlementBatch>) => Promise<void>;
  onGenerateBatch?: (partnerId: string, startDate: Date) => Promise<SettlementBatch | void>;
  onRefreshBatch?: (batchId: string) => Promise<void>;
}

export const SettlementPipelineModal: React.FC<SettlementPipelineModalProps> = ({
  isOpen,
  onClose,
  partner,
  cases,
  batches,
  onUpdateBatch,
  onGenerateBatch,
  onRefreshBatch,
}) => {
  const { showToast } = useToast();

  // 현재 거래처에 해당하는 배치 목록
  const partnerBatches = useMemo(() => {
    if (!partner) return [];
    return batches
      .filter(b => b.partnerId === partner.partnerId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [batches, partner]);

  // 선택된 배치 ID
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');

  useEffect(() => {
    if (partnerBatches.length > 0 && (!selectedBatchId || !partnerBatches.some(b => b.batchId === selectedBatchId))) {
      setSelectedBatchId(partnerBatches[0].batchId);
    }
  }, [partnerBatches, selectedBatchId]);

  const currentBatch = useMemo(() => {
    return partnerBatches.find(b => b.batchId === selectedBatchId) || partnerBatches[0] || null;
  }, [partnerBatches, selectedBatchId]);

  // 활성 스텝 (1: 대사확정, 2: 청구/수금, 3: 수당지급)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // 배치의 상태에 따라 초기 스텝 자동 추천
  useEffect(() => {
    if (!currentBatch) {
      setActiveStep(1);
      return;
    }
    if (currentBatch.status === 'draft') {
      setActiveStep(1);
    } else if (currentBatch.status === 'confirmed' || currentBatch.status === 'invoiced') {
      setActiveStep(2);
    } else if (currentBatch.status === 'collected' || currentBatch.status === 'paid') {
      setActiveStep(3);
    }
  }, [currentBatch?.batchId, currentBatch?.status]);

  // 1단계: 증빙 텍스트 로컬 state
  const [evidenceText, setEvidenceText] = useState('');
  useEffect(() => {
    setEvidenceText(currentBatch?.confirmationEvidence?.text || '');
  }, [currentBatch?.confirmationEvidence?.text]);

  // 2단계: 세금계산서 폼 state
  const [invoiceForm, setInvoiceForm] = useState({
    issueDate: '',
    supplyAmount: 0,
    vat: 0,
    approvalNumber: '',
  });

  useEffect(() => {
    if (currentBatch) {
      const defaultSupply = currentBatch.totalCommission || 0;
      const defaultVat = Math.round(defaultSupply * 0.1);
      setInvoiceForm({
        issueDate: currentBatch.invoiceInfo?.issueDate || todayKST(),
        supplyAmount: currentBatch.invoiceInfo?.supplyAmount ?? defaultSupply,
        vat: currentBatch.invoiceInfo?.vat ?? defaultVat,
        approvalNumber: currentBatch.invoiceInfo?.approvalNumber || '',
      });
    }
  }, [currentBatch]);

  // 2단계: 카톡 템플릿 복사 상태
  const [isCopiedTemplate, setIsCopiedTemplate] = useState(false);

  // 3단계: 수당 분배 새 아이템 입력 상태
  const [newPayout, setNewPayout] = useState({
    partnerName: '',
    partnerAccount: '',
    amount: 0,
  });

  if (!isOpen || !partner) return null;

  // 정산 대상 딜(Case) 목록
  const currentDeals = (currentBatch?.dealIds || [])
    .map(id => cases.find(c => c.caseId === id))
    .filter(Boolean) as Case[];

  // 1단계 저장: 대사 확인 완료
  const handleConfirmReconciliation = async () => {
    if (!currentBatch) return;
    try {
      await onUpdateBatch(currentBatch.batchId, {
        confirmationEvidence: {
          text: evidenceText,
          confirmedAt: new Date().toISOString(),
        },
        status: 'confirmed',
      });
      showToast('1단계: 정산 대상 건 대사 확인이 완료되었습니다.', 'success');
      setActiveStep(2);
    } catch {
      showToast('대사 확인 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  // 2단계 저장: 세금계산서 정보 저장
  const handleSaveInvoiceInfo = async () => {
    if (!currentBatch) return;
    const total = roundWonPrecision(Number(invoiceForm.supplyAmount) + Number(invoiceForm.vat));
    try {
      await onUpdateBatch(currentBatch.batchId, {
        invoiceInfo: {
          issueDate: invoiceForm.issueDate,
          supplyAmount: Number(invoiceForm.supplyAmount),
          vat: Number(invoiceForm.vat),
          total,
          approvalNumber: invoiceForm.approvalNumber,
        },
        status: currentBatch.status === 'draft' ? 'invoiced' : currentBatch.status === 'confirmed' ? 'invoiced' : currentBatch.status,
      });
      showToast('세금계산서 청구 정보가 저장되었습니다.', 'success');
    } catch {
      showToast('세금계산서 정보 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  // 2단계: 수금 완료 처리
  const handleMarkCollected = async () => {
    if (!currentBatch) return;
    const amount = invoiceForm.supplyAmount + invoiceForm.vat;
    try {
      await onUpdateBatch(currentBatch.batchId, {
        collectionInfo: {
          collectedAt: todayKST(),
          amount,
          memo: `${partner.name} 통장 입금 확인 완료`,
        },
        status: 'collected',
      });
      showToast('2단계: 수금 확인 처리가 완료되었습니다.', 'success');
      setActiveStep(3);
    } catch {
      showToast('수금 처리 중 오류가 발생했습니다.', 'error');
    }
  };

  // 2단계: 청구 템플릿 복사
  const handleCopyInvoiceNotice = () => {
    if (!currentBatch) return;
    const supply = invoiceForm.supplyAmount;
    const vat = invoiceForm.vat;
    const total = supply + vat;
    const bankStr = partner.bankInfo
      ? `${partner.bankInfo.bankName} ${partner.bankInfo.accountNumber} (예금주: ${partner.bankInfo.accountHolder})`
      : '지정 법인 계좌';

    const text = `[리드마스터 정산 수수료 청구 안내]
■ 거래처: ${partner.name}
■ 정산 회차: ${currentBatch.weekLabel} (${currentBatch.startDate} ~ ${currentBatch.endDate})
--------------------------------------
• 정산 건수: ${currentDeals.length}건
• 공급가액: ₩${supply.toLocaleString()}만원
• 부가가치세(10%): ₩${vat.toLocaleString()}만원
★ 청구 총액: ₩${total.toLocaleString()}만원
• 입금 계좌: ${bankStr}
--------------------------------------
전자세금계산서가 발행되었으니 확인 후 입금 부탁드립니다. 감사합니다.`;

    navigator.clipboard.writeText(text);
    setIsCopiedTemplate(true);
    showToast('청구 안내문이 클립보드에 복사되었습니다.', 'success');
    setTimeout(() => setIsCopiedTemplate(false), 2000);
  };

  // 3단계: 수당 분배 아이템 추가
  const handleAddPayoutItem = async () => {
    if (!currentBatch || !newPayout.partnerName || newPayout.amount <= 0) {
      showToast('수급자명과 금액을 입력해주세요.', 'warning');
      return;
    }
    const currentItems = currentBatch.payoutItems || [];
    const newItem: PayoutItem = {
      id: `payout-${Date.now()}`,
      partnerName: newPayout.partnerName,
      partnerAccount: newPayout.partnerAccount || '-',
      amount: newPayout.amount,
      paidAt: todayKST(),
    };
    try {
      await onUpdateBatch(currentBatch.batchId, {
        payoutItems: [...currentItems, newItem],
      });
      setNewPayout({ partnerName: '', partnerAccount: '', amount: 0 });
      showToast('수당 지급 내역이 추가되었습니다.', 'success');
    } catch {
      showToast('수당 내역 추가 중 오류가 발생했습니다.', 'error');
    }
  };

  // 3단계: 수당 분배 삭제
  const handleDeletePayoutItem = async (itemId: string) => {
    if (!currentBatch) return;
    const updated = (currentBatch.payoutItems || []).filter(item => item.id !== itemId);
    try {
      await onUpdateBatch(currentBatch.batchId, { payoutItems: updated });
      showToast('지급 내역이 삭제되었습니다.', 'info');
    } catch {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  // 3단계: 최종 정산 마감 완료 처리
  const handleFinishBatch = async () => {
    if (!currentBatch) return;
    try {
      await onUpdateBatch(currentBatch.batchId, { status: 'paid' });
      showToast(`🎉 ${currentBatch.weekLabel} 정산 마감이 최종 완료되었습니다!`, 'success');
    } catch {
      showToast('마감 처리 중 오류가 발생했습니다.', 'error');
    }
  };

  // 상태 라벨 및 뱃지 컬러
  const getStatusBadge = (status: SettlementBatch['status']) => {
    switch (status) {
      case 'draft':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">1단계: 대사 작성 중</span>;
      case 'confirmed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">1단계 완료: 수임 확인됨</span>;
      case 'invoiced':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">2단계 진행: 계산서 청구완료</span>;
      case 'collected':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">2단계 완료: 수금 확인완료</span>;
      case 'paid':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">3단계 완료: 정산 마감 종결</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-4xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden my-8 flex flex-col max-h-[92vh]">
        
        {/* 1. 모달 헤더 */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-md">
              <Building size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">{partner.name}</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-800 text-indigo-300 border border-slate-700">
                  {partner.settlementCycleDisplay || '월간 마감 (익월 10일 정산)'}
                </span>
                {currentBatch && getStatusBadge(currentBatch.status)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                정산 담당자: {partner.contactPerson || '대표/총무과'} ({partner.contactPhone || '연락처 미등록'}) · 계약 수수료율: {partner.commissionRules?.[0]?.rate ? `${partner.commissionRules[0].rate}%` : '협의 수수료'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2. 회차(배치) 선택 바 */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">정산 회차:</span>
            {partnerBatches.length > 0 ? (
              <select
                value={selectedBatchId}
                onChange={e => setSelectedBatchId(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {partnerBatches.map(b => (
                  <option key={b.batchId} value={b.batchId}>
                    {b.weekLabel} ({b.startDate} ~ {b.endDate}) - {b.dealIds.length}건 / ₩ {b.totalCommission?.toLocaleString()} 만원
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-amber-600 font-bold">생성된 회차가 없습니다.</span>
            )}

            {onRefreshBatch && currentBatch && (
              <button
                type="button"
                onClick={() => onRefreshBatch(currentBatch.batchId)}
                className="p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="최신 고객 수임 데이터 동기화"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>

          {onGenerateBatch && (
            <button
              type="button"
              onClick={() => onGenerateBatch(partner.partnerId, new Date())}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus size={14} />
              새 정산 회차 생성
            </button>
          )}
        </div>

        {/* 3. 3단계 상태 파이프라인 스테퍼 */}
        <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="grid grid-cols-3 gap-2">
            {/* Step 1 버튼 */}
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              className={`p-3 rounded-2xl border text-left transition-all ${
                activeStep === 1
                  ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-1 ring-blue-500'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${activeStep === 1 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                  1단계: 수임 건 대사
                </span>
                {currentBatch && currentBatch.status !== 'draft' ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <Clock size={16} className="text-gray-400" />
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                실제 수임 딜 대조 및 금액 확정
              </p>
            </button>

            {/* Step 2 버튼 */}
            <button
              type="button"
              onClick={() => setActiveStep(2)}
              className={`p-3 rounded-2xl border text-left transition-all ${
                activeStep === 2
                  ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 ring-1 ring-amber-500'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${activeStep === 2 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500'}`}>
                  2단계: 계산서 청구 & 수금
                </span>
                {currentBatch && (currentBatch.status === 'collected' || currentBatch.status === 'paid') ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <Clock size={16} className="text-gray-400" />
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                세금계산서 발행 및 입금 확인
              </p>
            </button>

            {/* Step 3 버튼 */}
            <button
              type="button"
              onClick={() => setActiveStep(3)}
              className={`p-3 rounded-2xl border text-left transition-all ${
                activeStep === 3
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-1 ring-emerald-500'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${activeStep === 3 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`}>
                  3단계: 수당 분배 & 마감
                </span>
                {currentBatch && currentBatch.status === 'paid' ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <Clock size={16} className="text-gray-400" />
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                상담원 수당 지급 및 회차 마감
              </p>
            </button>
          </div>
        </div>

        {/* 4. 스텝별 메인 콘텐츠 본문 (스크롤 영역) */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-gray-50/50 dark:bg-gray-900/40">
          {!currentBatch ? (
            <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl text-center border border-gray-200 dark:border-gray-700">
              <Calendar size={36} className="mx-auto text-gray-400 mb-3" />
              <h3 className="text-base font-bold text-gray-800 dark:text-white mb-1">
                현재 활성화된 정산 회차가 없습니다.
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                상단의 <strong>[+ 새 정산 회차 생성]</strong> 버튼을 눌러 정산 마감 프로세스를 시작하세요.
              </p>
            </div>
          ) : activeStep === 1 ? (
            /* ================= Step 1: 수임 건 대사 & 확정 ================= */
            <div className="space-y-5 animate-fade-in">
              {/* 상단 통계 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-semibold text-gray-500">정산 대상 딜 건수</span>
                  <p className="text-2xl font-black text-gray-900 dark:text-white font-mono mt-1">
                    {currentBatch.dealIds.length}건
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-semibold text-gray-500">고객 수임료 총액</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono tabular-nums">
                      ₩ {currentBatch.totalContractFee?.toLocaleString()}
                    </span>
                    <span className="text-xs font-semibold text-gray-500">만원</span>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-semibold text-gray-500">우리 회사 정산 수수료</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                      ₩ {currentBatch.totalCommission?.toLocaleString()}
                    </span>
                    <span className="text-xs font-semibold text-gray-500">만원</span>
                  </div>
                </div>
              </div>

              {/* 딜 목록 테이블 */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xs">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-750 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                  <h4 className="font-bold text-xs text-gray-800 dark:text-white flex items-center gap-1.5">
                    <FileText size={14} className="text-blue-600" />
                    수임 건 목록 대조
                  </h4>
                  <span className="text-xs text-gray-500">
                    회차 기간: {currentBatch.startDate} ~ {currentBatch.endDate}
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto">
                  {currentDeals.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-500">
                      해당 회차에 매칭된 수임 건이 없습니다.
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 sticky top-0">
                        <tr>
                          <th className="px-4 py-2.5">고객명</th>
                          <th className="px-3 py-2.5">계약 유형</th>
                          <th className="px-3 py-2.5">분납</th>
                          <th className="px-3 py-2.5 text-right">수임료</th>
                          <th className="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-bold">정산 수수료</th>
                          <th className="px-3 py-2.5 text-center">담당 상담원</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {currentDeals.map(d => (
                          <tr key={d.caseId} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/40">
                            <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white">
                              {d.customerName}
                            </td>
                            <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
                              {d.contractType || d.caseType || '개인회생'}
                            </td>
                            <td className="px-3 py-2.5 text-gray-500">
                              {d.installmentMonths ? `${d.installmentMonths}회 분납` : '일시납'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-gray-800 dark:text-gray-200">
                              ₩ {d.contractFee?.toLocaleString()} 만원
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ₩ {Math.round((d.contractFee || 0) * 0.25).toLocaleString()} 만원
                            </td>
                            <td className="px-3 py-2.5 text-center text-gray-500">
                              {d.managerName || (d as any).assignedAgent || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* 카톡/유선 대사 증빙 메모 */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                    📝 거래처 확인 증빙 메모 (카톡/유선 대사 내역)
                  </label>
                  {currentBatch.confirmationEvidence?.confirmedAt && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <Check size={13} /> {new Date(currentBatch.confirmationEvidence.confirmedAt).toLocaleDateString('ko-KR')} 확인 완료
                    </span>
                  )}
                </div>
                <textarea
                  value={evidenceText}
                  onChange={e => setEvidenceText(e.target.value)}
                  rows={3}
                  placeholder="예: 2026-11-20 김부장님과 15건 딜 내역 카톡으로 상호 크로스체크 완료함."
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 하단 액션 버튼 */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleConfirmReconciliation}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-colors"
                >
                  <CheckCircle2 size={16} />
                  수임 건 대사 확정 및 2단계 이동 ➔
                </button>
              </div>
            </div>
          ) : activeStep === 2 ? (
            /* ================= Step 2: 세금계산서 청구 & 수금 확인 ================= */
            <div className="space-y-5 animate-fade-in">
              {/* 세금계산서 정보 입력 카드 */}
              <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
                <h4 className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                  <FileText size={15} className="text-amber-600" />
                  전자세금계산서 역발행 청구 정보
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">발행 일자</label>
                    <input
                      type="date"
                      value={invoiceForm.issueDate}
                      onChange={e => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })}
                      className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">공급가액 (만원)</label>
                    <input
                      type="number"
                      value={invoiceForm.supplyAmount}
                      onChange={e => {
                        const sup = Number(e.target.value);
                        setInvoiceForm({ ...invoiceForm, supplyAmount: sup, vat: Math.round(sup * 0.1) });
                      }}
                      className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono font-bold text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">부가가치세 10% (만원)</label>
                    <input
                      type="number"
                      value={invoiceForm.vat}
                      onChange={e => setInvoiceForm({ ...invoiceForm, vat: Number(e.target.value) })}
                      className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono font-bold text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">국세청 승인번호</label>
                    <input
                      type="text"
                      placeholder="예: 20261120-4100..."
                      value={invoiceForm.approvalNumber}
                      onChange={e => setInvoiceForm({ ...invoiceForm, approvalNumber: e.target.value })}
                      className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-xs">
                    <span className="text-gray-500">청구 합계 금액: </span>
                    <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                      ₩ {(Number(invoiceForm.supplyAmount) + Number(invoiceForm.vat)).toLocaleString()} 만원
                    </span>
                    <span className="text-xs text-gray-500 ml-1">(공급가 + VAT)</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveInvoiceInfo}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold transition-colors"
                  >
                    계산서 정보 임시저장
                  </button>
                </div>
              </div>

              {/* 텔레그램 / 카톡 청구 안내문 원클릭 복사 */}
              <div className="bg-amber-50/70 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    📱 거래처 청구 통보 메시지
                  </h5>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    로펌 실무자에게 즉시 전송할 수 있는 청구 안내 템플릿입니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyInvoiceNotice}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  {isCopiedTemplate ? <Check size={14} /> : <Copy size={14} />}
                  {isCopiedTemplate ? '복사 완료' : '청구문 복사'}
                </button>
              </div>

              {/* 수금 확인 섹션 */}
              <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
                <h4 className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                  <DollarSign size={15} className="text-emerald-600" />
                  거래처 입금(수금) 확인
                </h4>

                {currentBatch.collectionInfo?.collectedAt ? (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 size={15} />
                        수금 완료 확인됨 ({currentBatch.collectionInfo.collectedAt})
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                        입금 확인액: ₩ {currentBatch.collectionInfo.amount?.toLocaleString()} 만원 ({currentBatch.collectionInfo.memo || '정상 입금'})
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-lg">
                      수금 완료
                    </span>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      법인 계좌에 수수료 <strong>₩ {(Number(invoiceForm.supplyAmount) + Number(invoiceForm.vat)).toLocaleString()} 만원</strong>이 입금되었는지 확인 후 수금 완료 처리를 진행하세요.
                    </p>
                    <button
                      type="button"
                      onClick={handleMarkCollected}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors shrink-0"
                    >
                      <CheckCircle2 size={16} />
                      수금 완료 처리 및 3단계 이동 ➔
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================= Step 3: 상담원 수당 분배 & 정산 마감 ================= */
            <div className="space-y-5 animate-fade-in">
              <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Users size={15} className="text-indigo-600" />
                    상담원 및 팀장 수당 분배 대장
                  </h4>
                  <span className="text-xs text-gray-500 font-mono">
                    회차 수금 확정액: ₩ {currentBatch.totalCommission?.toLocaleString()} 만원
                  </span>
                </div>

                {/* 기등록된 분배 목록 */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                  {(currentBatch.payoutItems || []).length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-500">
                      등록된 수당 분배 내역이 없습니다. 아래 폼에서 상담원/팀장 수당을 등록하세요.
                    </div>
                  ) : (
                    (currentBatch.payoutItems || []).map(item => (
                      <div key={item.id} className="p-3 bg-white dark:bg-gray-800 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white">{item.partnerName}</span>
                          <span className="text-gray-400 ml-2 font-mono">{item.partnerAccount}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            ₩ {item.amount?.toLocaleString()} 만원
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeletePayoutItem(item.id)}
                            className="p-1 text-gray-400 hover:text-rose-500 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 수당 분배 추가 폼 */}
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="수급자명 (예: 김상담, 박팀장)"
                    value={newPayout.partnerName}
                    onChange={e => setNewPayout({ ...newPayout, partnerName: e.target.value })}
                    className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    placeholder="계좌번호 (예: 신한 110-...)"
                    value={newPayout.partnerAccount}
                    onChange={e => setNewPayout({ ...newPayout, partnerAccount: e.target.value })}
                    className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs"
                  />
                  <input
                    type="number"
                    placeholder="지급액 (만원)"
                    value={newPayout.amount || ''}
                    onChange={e => setNewPayout({ ...newPayout, amount: Number(e.target.value) })}
                    className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddPayoutItem}
                    className="py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <Plus size={14} /> 추가
                  </button>
                </div>
              </div>

              {/* 최종 마감 확인 카드 */}
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <ShieldCheck size={16} />
                    정산 회차 최종 마감 (Lock & Close)
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                    대사·수금·수당 분배가 모두 완료된 회차를 마감 처리하고 종합 손익 장부에 반영합니다.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleFinishBatch}
                  disabled={currentBatch.status === 'paid'}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-colors shrink-0"
                >
                  <CheckCircle2 size={16} />
                  {currentBatch.status === 'paid' ? '이미 최종 마감됨' : '정산 회차 최종 마감 완료'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 5. 모달 푸터 */}
        <div className="p-4 bg-white dark:bg-gray-850 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {activeStep > 1 && (
              <button
                type="button"
                onClick={() => setActiveStep((activeStep - 1) as 1 | 2)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-750 flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft size={14} /> 이전 단계
              </button>
            )}
            {activeStep < 3 && (
              <button
                type="button"
                onClick={() => setActiveStep((activeStep + 1) as 2 | 3)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-750 flex items-center gap-1.5 transition-colors"
              >
                다음 단계 <ArrowRight size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettlementPipelineModal;
