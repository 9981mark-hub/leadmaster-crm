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

  // 상태 라벨 및 뱃지 컬러 (School Dark 표준)
  const getStatusBadge = (status: SettlementBatch['status']) => {
    switch (status) {
      case 'draft':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border">1단계: 대사 작성 중</span>;
      case 'confirmed':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">1단계 완료: 수임 확인됨</span>;
      case 'invoiced':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">2단계 진행: 계산서 청구완료</span>;
      case 'collected':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">2단계 완료: 수금 확인완료</span>;
      case 'paid':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">3단계 완료: 정산 마감 종결</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        
        {/* 1. 모달 헤더 (고정) */}
        <div className="p-5 sm:p-6 bg-card border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <Building size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-foreground">{partner.name}</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-muted text-muted-foreground border border-border">
                  {partner.settlementCycleDisplay || '월간 마감 (익월 10일 정산)'}
                </span>
                {currentBatch && getStatusBadge(currentBatch.status)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                정산 담당자: {partner.contactPerson || '대표/총무과'} ({partner.contactPhone || '연락처 미등록'}) · 계약 수수료율: {partner.commissionRules?.[0]?.rate ? `${partner.commissionRules[0].rate}%` : '협의 수수료'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2. 회차(배치) 선택 바 (고정) */}
        <div className="px-5 sm:px-6 py-3 bg-muted/30 border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">정산 회차:</span>
            {partnerBatches.length > 0 ? (
              <select
                value={selectedBatchId}
                onChange={e => setSelectedBatchId(e.target.value)}
                className="px-3 py-1.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {partnerBatches.map(b => (
                  <option key={b.batchId} value={b.batchId}>
                    {b.weekLabel} ({b.startDate} ~ {b.endDate}) - {b.dealIds.length}건 / ₩ {b.totalCommission?.toLocaleString()} 만원
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-amber-500 font-bold">생성된 회차가 없습니다.</span>
            )}

            {onRefreshBatch && currentBatch && (
              <button
                type="button"
                onClick={() => onRefreshBatch(currentBatch.batchId)}
                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors cursor-pointer"
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
              className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Plus size={14} />
              새 정산 회차 생성
            </button>
          )}
        </div>

        {/* 3. 3단계 상태 파이프라인 스테퍼 (고정) */}
        <div className="px-5 sm:px-6 py-3 bg-card border-b border-border shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Step 1 버튼 */}
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                activeStep === 1
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                  : 'border-border/60 bg-muted/20 hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${activeStep === 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                  1단계: 수임 건 대사
                </span>
                {currentBatch && currentBatch.status !== 'draft' ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <Clock size={16} className="text-muted-foreground/60" />
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">
                실제 수임 딜 대조 및 금액 확정
              </p>
            </button>

            {/* Step 2 버튼 */}
            <button
              type="button"
              onClick={() => setActiveStep(2)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                activeStep === 2
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                  : 'border-border/60 bg-muted/20 hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${activeStep === 2 ? 'text-primary' : 'text-muted-foreground'}`}>
                  2단계: 계산서 청구 & 수금
                </span>
                {currentBatch && (currentBatch.status === 'collected' || currentBatch.status === 'paid') ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <Clock size={16} className="text-muted-foreground/60" />
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">
                세금계산서 발행 및 입금 확인
              </p>
            </button>

            {/* Step 3 버튼 */}
            <button
              type="button"
              onClick={() => setActiveStep(3)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                activeStep === 3
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                  : 'border-border/60 bg-muted/20 hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${activeStep === 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                  3단계: 수당 분배 & 마감
                </span>
                {currentBatch && currentBatch.status === 'paid' ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <Clock size={16} className="text-muted-foreground/60" />
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">
                상담원 수당 지급 및 회차 마감
              </p>
            </button>
          </div>
        </div>

        {/* 4. 스텝별 메인 콘텐츠 본문 (스크롤 영역) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-background/50">
          {!currentBatch ? (
            <div className="bg-card p-12 rounded-xl text-center border border-border">
              <Calendar size={36} className="mx-auto text-muted-foreground mb-3" />
              <h3 className="text-base font-bold text-foreground mb-1">
                현재 활성화된 정산 회차가 없습니다.
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                상단의 <strong>[+ 새 정산 회차 생성]</strong> 버튼을 눌러 정산 마감 프로세스를 시작하세요.
              </p>
            </div>
          ) : activeStep === 1 ? (
            /* ================= Step 1: 수임 건 대사 & 확정 ================= */
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* 상단 통계 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-card p-4 rounded-xl border border-border shadow-2xs">
                  <span className="text-xs font-semibold text-muted-foreground">정산 대상 딜 건수</span>
                  <p className="text-2xl font-black text-foreground font-mono mt-1">
                    {currentBatch.dealIds.length}건
                  </p>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border shadow-2xs">
                  <span className="text-xs font-semibold text-muted-foreground">고객 수임료 총액</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black text-blue-500 font-mono tabular-nums">
                      ₩ {currentBatch.totalContractFee?.toLocaleString()}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">만원</span>
                  </div>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border shadow-2xs">
                  <span className="text-xs font-semibold text-muted-foreground">우리 회사 정산 수수료</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black text-primary font-mono tabular-nums">
                      ₩ {currentBatch.totalCommission?.toLocaleString()}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">만원</span>
                  </div>
                </div>
              </div>

              {/* 딜 목록 테이블 */}
              <div className="bg-card rounded-xl border border-border overflow-hidden shadow-2xs">
                <div className="px-4 py-3 bg-muted/30 border-b border-border flex justify-between items-center">
                  <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <FileText size={14} className="text-primary" />
                    수임 건 목록 대조
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    회차 기간: {currentBatch.startDate} ~ {currentBatch.endDate}
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto">
                  {currentDeals.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      해당 회차에 매칭된 수임 건이 없습니다.
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted text-muted-foreground sticky top-0 z-10 border-b border-border">
                        <tr>
                          <th className="px-4 py-2.5">고객명</th>
                          <th className="px-3 py-2.5">계약 유형</th>
                          <th className="px-3 py-2.5">분납</th>
                          <th className="px-3 py-2.5 text-right">수임료</th>
                          <th className="px-3 py-2.5 text-right text-primary font-bold">정산 수수료</th>
                          <th className="px-3 py-2.5 text-center">담당 상담원</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {currentDeals.map(d => (
                          <tr key={d.caseId} className="hover:bg-muted/30">
                            <td className="px-4 py-2.5 font-bold text-foreground">
                              {d.customerName}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {d.contractType || d.caseType || '개인회생'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {d.installmentMonths ? `${d.installmentMonths}회 분납` : '일시납'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-foreground">
                              ₩ {d.contractFee?.toLocaleString()} 만원
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-primary">
                              ₩ {Math.round((d.contractFee || 0) * 0.25).toLocaleString()} 만원
                            </td>
                            <td className="px-3 py-2.5 text-center text-muted-foreground">
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
              <div className="bg-card p-4 rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    📝 거래처 확인 증빙 메모 (카톡/유선 대사 내역)
                  </label>
                  {currentBatch.confirmationEvidence?.confirmedAt && (
                    <span className="text-xs text-primary font-bold flex items-center gap-1">
                      <Check size={13} /> {new Date(currentBatch.confirmationEvidence.confirmedAt).toLocaleDateString('ko-KR')} 확인 완료
                    </span>
                  )}
                </div>
                <textarea
                  value={evidenceText}
                  onChange={e => setEvidenceText(e.target.value)}
                  rows={3}
                  placeholder="예: 2026-11-20 김부장님과 15건 딜 내역 카톡으로 상호 크로스체크 완료함."
                  className="w-full p-3 bg-muted/30 border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* 하단 액션 버튼 */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleConfirmReconciliation}
                  className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  수임 건 대사 확정 및 2단계 이동 ➔
                </button>
              </div>
            </div>
          ) : activeStep === 2 ? (
            /* ================= Step 2: 세금계산서 청구 & 수금 확인 ================= */
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* 세금계산서 정보 입력 카드 */}
              <div className="bg-card p-5 rounded-xl border border-border space-y-4">
                <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <FileText size={15} className="text-amber-500" />
                  전자세금계산서 역발행 청구 정보
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">발행 일자</label>
                    <input
                      type="date"
                      value={invoiceForm.issueDate}
                      onChange={e => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })}
                      className="w-full p-2 bg-muted/30 border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">공급가액 (만원)</label>
                    <input
                      type="number"
                      value={invoiceForm.supplyAmount}
                      onChange={e => {
                        const sup = Number(e.target.value);
                        setInvoiceForm({ ...invoiceForm, supplyAmount: sup, vat: Math.round(sup * 0.1) });
                      }}
                      className="w-full p-2 bg-muted/30 border border-border rounded-xl text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">부가가치세 10% (만원)</label>
                    <input
                      type="number"
                      value={invoiceForm.vat}
                      onChange={e => setInvoiceForm({ ...invoiceForm, vat: Number(e.target.value) })}
                      className="w-full p-2 bg-muted/30 border border-border rounded-xl text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">국세청 승인번호</label>
                    <input
                      type="text"
                      placeholder="예: 20261120-4100..."
                      value={invoiceForm.approvalNumber}
                      onChange={e => setInvoiceForm({ ...invoiceForm, approvalNumber: e.target.value })}
                      className="w-full p-2 bg-muted/30 border border-border rounded-xl text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="text-xs">
                    <span className="text-muted-foreground">청구 합계 금액: </span>
                    <span className="font-mono font-black text-amber-500 dark:text-amber-400 text-sm">
                      ₩ {(Number(invoiceForm.supplyAmount) + Number(invoiceForm.vat)).toLocaleString()} 만원
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">(공급가 + VAT)</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveInvoiceInfo}
                    className="px-4 py-2 bg-secondary hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    계산서 정보 임시저장
                  </button>
                </div>
              </div>

              {/* 텔레그램 / 카톡 청구 안내문 원클릭 복사 */}
              <div className="bg-muted/30 p-4 rounded-xl border border-border flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-foreground">
                    📱 거래처 청구 통보 메시지
                  </h5>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    로펌 실무자에게 즉시 전송할 수 있는 청구 안내 템플릿입니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyInvoiceNotice}
                  className="px-4 py-2 bg-card hover:bg-muted border border-border rounded-xl text-xs font-bold text-foreground flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  {isCopiedTemplate ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                  {isCopiedTemplate ? '복사 완료' : '청구문 복사'}
                </button>
              </div>

              {/* 수금 확인 섹션 */}
              <div className="bg-card p-5 rounded-xl border border-border space-y-3">
                <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <DollarSign size={15} className="text-primary" />
                  거래처 입금(수금) 확인
                </h4>

                {currentBatch.collectionInfo?.collectedAt ? (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 size={15} />
                        수금 완료 확인됨 ({currentBatch.collectionInfo.collectedAt})
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        입금 확인액: ₩ {currentBatch.collectionInfo.amount?.toLocaleString()} 만원 ({currentBatch.collectionInfo.memo || '정상 입금'})
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg">
                      수금 완료
                    </span>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-muted/30 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      법인 계좌에 수수료 <strong className="text-foreground">₩ {(Number(invoiceForm.supplyAmount) + Number(invoiceForm.vat)).toLocaleString()} 만원</strong>이 입금되었는지 확인 후 수금 완료 처리를 진행하세요.
                    </p>
                    <button
                      type="button"
                      onClick={handleMarkCollected}
                      className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
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
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-card p-5 rounded-xl border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Users size={15} className="text-primary" />
                    상담원 및 팀장 수당 분배 대장
                  </h4>
                  <span className="text-xs text-muted-foreground font-mono">
                    회차 수금 확정액: ₩ {currentBatch.totalCommission?.toLocaleString()} 만원
                  </span>
                </div>

                {/* 기등록된 분배 목록 */}
                <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                  {(currentBatch.payoutItems || []).length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      등록된 수당 분배 내역이 없습니다. 아래 폼에서 상담원/팀장 수당을 등록하세요.
                    </div>
                  ) : (
                    (currentBatch.payoutItems || []).map(item => (
                      <div key={item.id} className="p-3 bg-card flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-foreground">{item.partnerName}</span>
                          <span className="text-muted-foreground ml-2 font-mono">{item.partnerAccount}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-primary">
                            ₩ {item.amount?.toLocaleString()} 만원
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeletePayoutItem(item.id)}
                            className="p-1 text-muted-foreground hover:text-rose-500 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 수당 분배 추가 폼 */}
                <div className="p-3 bg-muted/30 rounded-xl border border-border grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="수급자명 (예: 김상담, 박팀장)"
                    value={newPayout.partnerName}
                    onChange={e => setNewPayout({ ...newPayout, partnerName: e.target.value })}
                    className="p-2 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="text"
                    placeholder="계좌번호 (예: 신한 110-...)"
                    value={newPayout.partnerAccount}
                    onChange={e => setNewPayout({ ...newPayout, partnerAccount: e.target.value })}
                    className="p-2 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="number"
                    placeholder="지급액 (만원)"
                    value={newPayout.amount || ''}
                    onChange={e => setNewPayout({ ...newPayout, amount: Number(e.target.value) })}
                    className="p-2 bg-card border border-border rounded-lg text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={handleAddPayoutItem}
                    className="py-2 bg-secondary hover:bg-muted border border-border text-foreground rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus size={14} /> 추가
                  </button>
                </div>
              </div>

              {/* 최종 마감 확인 카드 */}
              <div className="bg-card p-5 rounded-xl border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-primary" />
                    정산 회차 최종 마감 (Lock & Close)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    대사·수금·수당 분배가 모두 완료된 회차를 마감 처리하고 종합 손익 장부에 반영합니다.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleFinishBatch}
                  disabled={currentBatch.status === 'paid'}
                  className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs transition-colors shrink-0 cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  {currentBatch.status === 'paid' ? '이미 최종 마감됨' : '정산 회차 최종 마감 완료'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 5. 모달 푸터 (고정) */}
        <div className="p-4 bg-card border-t border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {activeStep > 1 && (
              <button
                type="button"
                onClick={() => setActiveStep((activeStep - 1) as 1 | 2)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-foreground bg-card hover:bg-muted flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} /> 이전 단계
              </button>
            )}
            {activeStep < 3 && (
              <button
                type="button"
                onClick={() => setActiveStep((activeStep + 1) as 2 | 3)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-foreground bg-card hover:bg-muted flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                다음 단계 <ArrowRight size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-secondary hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettlementPipelineModal;
