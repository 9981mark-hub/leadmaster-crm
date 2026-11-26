import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  CreditCard, RefreshCw, Sparkles, Building2, 
  ShieldCheck, Calculator, FileText, ChevronRight, HelpCircle,
  ExternalLink, ArrowUpRight, HelpCircle as FaqIcon, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getOrgFeaturePermissions, OrgFeaturePermissions } from '../services/platform';
import { fetchTeamMembers } from '../services/team';
import { 
  fetchOrgTaxInfo, saveOrgTaxInfo, OrgTaxInfo, 
  generateRecentInvoices, MonthlyInvoiceRecord,
  generatePaymentTransactions, generateSubscriptionAuditLogs,
  PaymentTransactionRecord, SubscriptionAuditLogItem
} from '../services/billingService';

// Subcomponents & Modals
import { SubscriptionStatusCard } from '../components/billing/SubscriptionStatusCard';
import { PlanShowcaseSection } from '../components/billing/PlanShowcaseSection';
import { SeatCostSimulator } from '../components/billing/SeatCostSimulator';
import { FeatureComparisonAccordion } from '../components/billing/FeatureComparisonAccordion';
import { BillingHistorySection } from '../components/billing/BillingHistorySection';
import { OrgInvoiceModal } from '../components/billing/OrgInvoiceModal';
import { TaxInfoEditModal } from '../components/billing/TaxInfoEditModal';
import { SeatExpansionModal } from '../components/billing/SeatExpansionModal';
import PricingModal from '../components/pricing/PricingModal';

export const BillingPage: React.FC = () => {
  const navigate = useNavigate();
  const { org, user } = useAuth();
  const { showToast } = useToast();

  const orgId = org?.orgId || '00000000-0000-0000-0000-000000000001';
  const orgName = org?.orgName || '리드마스터 CRM';
  const ownerEmail = (org as any)?.ownerEmail || user?.email;

  // Data states
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<OrgFeaturePermissions | undefined>(undefined);
  const [activeSeats, setActiveSeats] = useState<number>(1);
  const [taxInfo, setTaxInfo] = useState<OrgTaxInfo>({
    businessNumber: '',
    companyName: orgName,
    representativeName: '대표자',
    businessAddress: '',
    taxInvoiceEmail: ownerEmail || '',
  });

  // Modals state
  const [isSeatModalOpen, setIsSeatModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isTaxInfoModalOpen, setIsTaxInfoModalOpen] = useState(false);
  const [activeInvoiceForModal, setActiveInvoiceForModal] = useState<MonthlyInvoiceRecord | null>(null);

  // Load essential billing data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [perms, members, tInfo] = await Promise.all([
        getOrgFeaturePermissions(orgId),
        fetchTeamMembers(),
        fetchOrgTaxInfo(orgId, orgName, ownerEmail),
      ]);

      setPermissions(perms);
      // 활성 상담원 수 카운트 (기본 최소 1)
      const activeCount = members && members.length > 0 ? members.length : 1;
      setActiveSeats(activeCount);
      setTaxInfo(tInfo || {
        businessNumber: '',
        companyName: orgName,
        representativeName: '대표자',
        businessAddress: '',
        taxInvoiceEmail: ownerEmail || '',
        businessType: '서비스업',
        businessItem: '콜영업 및 마케팅대행',
      });
    } catch (err: any) {
      console.error('[BillingPage] 데이터 로드 실패:', err);
      showToast('구독 및 라이선스 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, orgName, ownerEmail, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Recent Invoices
  const invoices = useMemo(() => {
    return generateRecentInvoices(activeSeats, permissions, (org as any)?.createdAt);
  }, [activeSeats, permissions, org]);

  // Payment Transactions
  const transactions: PaymentTransactionRecord[] = useMemo(() => {
    return generatePaymentTransactions(invoices, taxInfo);
  }, [invoices, taxInfo]);

  // Subscription Lifecycle Audit Logs
  const auditLogs: SubscriptionAuditLogItem[] = useMemo(() => {
    const tier = invoices[0]?.tierName || '비즈니스 (6 ~ 20인)';
    return generateSubscriptionAuditLogs((org as any)?.createdAt, activeSeats, tier);
  }, [org, activeSeats, invoices]);

  // Save Tax Invoice Information
  const handleSaveTaxInfo = async (updatedInfo: OrgTaxInfo) => {
    await saveOrgTaxInfo(orgId, updatedInfo);
    setTaxInfo(updatedInfo);
    showToast('전자세금계산서 발행 정보가 저장되었습니다.', 'success');
  };

  const handleSelectPlan = (planId: string) => {
    if (planId === 'mega' || planId === 'enterprise') {
      setIsPricingModalOpen(true);
    } else {
      setIsSeatModalOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          CRM 구독 플랜 및 라이선스 데이터를 집계 중입니다...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-fadeIn pb-16">
      {/* 1. Global Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1">
            <span>정산 / 경영</span>
            <ChevronRight size={12} className="text-muted-foreground" />
            <span className="text-foreground">구독 & 플랜 관제 센터</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-xs shrink-0">
              <CreditCard size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">
                구독 & 플랜 관제 센터
              </h1>
              <p className="hidden sm:block text-xs sm:text-sm text-muted-foreground mt-0.5">
                조직 규모에 최적화된 리드마스터 요금제를 선택하고, 좌석 라이선스 및 결제 영수증을 통합 관리합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveInvoiceForModal(invoices[0])}
            className="px-2.5 sm:px-3 py-2 text-xs font-semibold text-foreground bg-card border border-border hover:bg-muted rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <FileText size={14} strokeWidth={1.75} className="text-primary shrink-0" />
            <span className="sm:hidden">당월 청구서</span>
            <span className="hidden sm:inline">당월 청구서 보기</span>
          </button>
          <button
            onClick={() => setIsTaxInfoModalOpen(true)}
            className="px-2.5 sm:px-3 py-2 text-xs font-semibold text-foreground bg-card border border-border hover:bg-muted rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Building2 size={14} strokeWidth={1.75} className="text-muted-foreground shrink-0" />
            <span className="sm:hidden">세금계산서</span>
            <span className="hidden sm:inline">세금계산서 설정</span>
          </button>
          <button
            onClick={loadData}
            className="col-span-2 sm:col-span-1 p-2 text-muted-foreground hover:text-foreground bg-card border border-border hover:bg-muted rounded-xl transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 text-xs"
            title="데이터 새로고침"
          >
            <RefreshCw size={15} strokeWidth={1.75} />
            <span className="sm:hidden">새로고침</span>
          </button>
        </div>
      </div>

      {/* 2. 광고비 도메인 분리 안내 배너 (정산 손익센터 지출 목록 안내) */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="text-base shrink-0">💡</span>
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground font-semibold">광고비 · 지출 장부 안내:</strong>{' '}
            <span className="sm:hidden">외부 광고비 및 ROAS는 </span>
            <span className="hidden sm:inline">페이스북, 네이버, 토스애즈 등 외부 광고비 집행 내역과 종합 마케팅 ROAS는 회계 원칙에 따라 </span>
            <strong className="text-foreground font-semibold">[정산 손익센터 &gt; 지출 목록]</strong>에서 관리됩니다.
          </div>
        </div>

        <Link
          to="/settlement?tab=expenses"
          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors shrink-0 shadow-xs"
        >
          <span>지출 목록 바로가기</span>
          <ArrowUpRight size={13} strokeWidth={1.75} />
        </Link>
      </div>

      {/* 3. [Zone 1] 현재 CRM 솔루션 구독 & 좌석 라이선스 현황 카드 */}
      <SubscriptionStatusCard
        orgName={orgName}
        createdAt={(org as any)?.createdAt}
        activeSeats={activeSeats}
        permissions={permissions}
        onOpenPricingModal={() => setIsPricingModalOpen(true)}
        onOpenSeatModal={() => setIsSeatModalOpen(true)}
      />

      {/* 4. [Zone 2] 플랜 쇼케이스 & 업그레이드 비교 (ChatGPT / Notion 벤치마킹) */}
      <PlanShowcaseSection
        currentTierId="business"
        onSelectPlan={handleSelectPlan}
        onOpenSeatModal={() => setIsSeatModalOpen(true)}
      />

      {/* 5. [Zone 3] 인터랙티브 좌석 & 비용 시뮬레이터 (채널톡 벤치마킹) */}
      <SeatCostSimulator
        initialSeats={activeSeats}
        onApplySeats={(newSeats) => setIsSeatModalOpen(true)}
      />

      {/* 6. [Zone 4] 전체 기능 상세 비교 매트릭스 (접이식 아코디언) */}
      <FeatureComparisonAccordion />

      {/* 7. [Zone 5] 결제 수단, 결제 승인 내역 및 구독 라이프사이클 감사 히스토리 */}
      <BillingHistorySection
        invoices={invoices}
        transactions={transactions}
        auditLogs={auditLogs}
        taxInfo={taxInfo}
        onOpenInvoiceModal={(inv) => setActiveInvoiceForModal(inv)}
        onOpenTaxInfoModal={() => setIsTaxInfoModalOpen(true)}
        showToast={showToast}
      />

      {/* 8. [Zone 6] 자주 묻는 질문 (FAQ) & 신뢰 보장 */}
      <div className="bg-card text-card-foreground rounded-xl border border-border p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <HelpCircle size={18} strokeWidth={1.75} className="text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            구독 및 결제 관련 자주 묻는 질문 (FAQ)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
            <h4 className="font-semibold text-foreground">
              Q. 중도에 인원이 늘어나면 요금은 어떻게 계산되나요?
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              월 중간에 상담원을 추가하시면, 해당 월의 잔여 일수만큼만 <strong>일할 계산(Pro-rata)</strong>되어 다음 결제 시 합산되거나 즉시 결제됩니다. 미사용 일수에 대한 불합리한 과금이 발생하지 않습니다.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
            <h4 className="font-semibold text-foreground">
              Q. 별도의 종이 서면 계약서를 날인해야 하나요?
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              아닙니다. 전자서명법 제3조에 부합하는 웹 전자 이용계약(Clickwrap) 동의를 통해 서면 날인과 100% 동일한 정식 법적 효력이 발생합니다. 엔터프라이즈는 커스텀 서면 날인도 지원합니다.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
            <h4 className="font-semibold text-foreground">
              Q. 전자세금계산서는 언제 발행되나요?
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              카드 자동 결제 또는 무통장 입금 확인 즉시, 등록해주신 세금계산서 수신 이메일로 국세청 정식 전자세금계산서(영수)가 24시간 이내에 자동 발행됩니다.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
            <h4 className="font-semibold text-foreground">
              Q. 구독을 해지하면 기존 통화 녹음과 DB는 어떻게 되나요?
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              해지 후에도 30일간 <strong>D-30 백업 센터</strong>를 통해 기존 모든 통화 녹음 파일(32kbps 압축 AAC)과 고객 상담 DB를 원클릭 일괄 다운로드하실 수 있도록 안전하게 보관됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      {activeInvoiceForModal && (
        <OrgInvoiceModal
          isOpen={Boolean(activeInvoiceForModal)}
          onClose={() => setActiveInvoiceForModal(null)}
          invoice={activeInvoiceForModal}
          taxInfo={taxInfo}
          ownerEmail={ownerEmail}
        />
      )}

      {isTaxInfoModalOpen && (
        <TaxInfoEditModal
          isOpen={isTaxInfoModalOpen}
          onClose={() => setIsTaxInfoModalOpen(false)}
          currentInfo={taxInfo}
          taxInfo={taxInfo}
          onSave={handleSaveTaxInfo}
        />
      )}

      {isSeatModalOpen && (
        <SeatExpansionModal
          isOpen={isSeatModalOpen}
          onClose={() => setIsSeatModalOpen(false)}
          orgId={orgId}
          orgName={orgName}
          requesterEmail={ownerEmail}
          activeSeats={activeSeats}
          currentMaxSeats={permissions?.maxSeats || 20}
          onSuccess={loadData}
        />
      )}

      {isPricingModalOpen && (
        <PricingModal
          isOpen={isPricingModalOpen}
          onClose={() => setIsPricingModalOpen(false)}
        />
      )}
    </div>
  );
};

export default BillingPage;
