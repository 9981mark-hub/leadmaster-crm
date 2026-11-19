import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CreditCard, RefreshCw, Sparkles, Building2, 
  ShieldCheck, Calculator, FileText, ChevronRight, HelpCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ExpenseItem, TossAdsRecord } from '../types';
import { fetchExpenses, createExpense, deleteExpense, fetchTossAdsRecords, syncTossAdsLive, fetchCases } from '../services/api';
import { getOrgFeaturePermissions, OrgFeaturePermissions } from '../services/platform';
import { fetchTeamMembers } from '../services/team';
import { 
  fetchOrgTaxInfo, saveOrgTaxInfo, OrgTaxInfo, 
  computeAdSpendSummary, computeMarketingRoi, 
  generateRecentInvoices, MonthlyInvoiceRecord 
} from '../services/billingService';

// Subcomponents & Modals
import { SubscriptionStatusCard } from '../components/billing/SubscriptionStatusCard';
import { AdSpendOverviewSection } from '../components/billing/AdSpendOverviewSection';
import { MarketingRoiSection } from '../components/billing/MarketingRoiSection';
import { InvoiceTaxSection } from '../components/billing/InvoiceTaxSection';
import { ExpenseAddModal } from '../components/billing/ExpenseAddModal';
import { OrgInvoiceModal } from '../components/billing/OrgInvoiceModal';
import { TaxInfoEditModal } from '../components/billing/TaxInfoEditModal';
import { SeatExpansionModal } from '../components/billing/SeatExpansionModal';
import PricingModal from '../components/pricing/PricingModal';

export const BillingPage: React.FC = () => {
  const { org, user, isAdmin, isPlatformAdmin } = useAuth();
  const { showToast } = useToast();

  const orgId = org?.orgId || '00000000-0000-0000-0000-000000000001';
  const orgName = org?.orgName || '리드마스터 CRM';
  const ownerEmail = (org as any)?.ownerEmail || user?.email;

  // Data states
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<OrgFeaturePermissions | undefined>(undefined);
  const [activeSeats, setActiveSeats] = useState<number>(1);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [tossAds, setTossAds] = useState<TossAdsRecord[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [taxInfo, setTaxInfo] = useState<OrgTaxInfo>({
    businessNumber: '',
    companyName: orgName,
    representativeName: '대표자',
    businessAddress: '',
    taxInvoiceEmail: ownerEmail || '',
  });

  // Filter & Modals
  const [selectedPeriod, setSelectedPeriod] = useState<string>('cur_month');
  const [isSyncingTossAds, setIsSyncingTossAds] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isSeatModalOpen, setIsSeatModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isTaxInfoModalOpen, setIsTaxInfoModalOpen] = useState(false);
  const [activeInvoiceForModal, setActiveInvoiceForModal] = useState<MonthlyInvoiceRecord | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();
      const currentYear = now.getFullYear();

      const [perms, members, expList, caseList, tInfo] = await Promise.all([
        getOrgFeaturePermissions(orgId),
        fetchTeamMembers(),
        fetchExpenses(undefined, currentYear),
        fetchCases(),
        fetchOrgTaxInfo(orgId, orgName, ownerEmail),
      ]);

      const tossList = fetchTossAdsRecords(currentYear);

      setPermissions(perms);
      // 활성 상담원 수 카운트 (기본 1)
      const activeCount = members && members.length > 0 ? members.length : 1;
      setActiveSeats(activeCount);
      setExpenses(expList || []);
      setTossAds(tossList || []);
      setCases(caseList || []);
      setTaxInfo(tInfo);
    } catch (err: any) {
      console.error('[BillingPage] 데이터 로드 실패:', err);
      showToast('빌링 및 광고비 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, orgName, ownerEmail, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Target Year and Month based on selectedPeriod
  const { targetYear, targetMonth } = useMemo(() => {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;

    if (selectedPeriod === 'prev_month') {
      const prevM = curM === 1 ? 12 : curM - 1;
      const prevY = curM === 1 ? curY - 1 : curY;
      return { targetYear: prevY, targetMonth: prevM };
    }
    if (selectedPeriod === 'cur_month') {
      return { targetYear: curY, targetMonth: curM };
    }
    return { targetYear: curY, targetMonth: 'all' as const };
  }, [selectedPeriod]);

  // Compute Ad Spend Summary & ROI
  const adSpendSummary = useMemo(() => {
    return computeAdSpendSummary(expenses, tossAds, targetYear, targetMonth);
  }, [expenses, tossAds, targetYear, targetMonth]);

  const marketingRoi = useMemo(() => {
    return computeMarketingRoi(cases, adSpendSummary, targetYear, targetMonth);
  }, [cases, adSpendSummary, targetYear, targetMonth]);

  // Recent 6 Invoices
  const invoices = useMemo(() => {
    return generateRecentInvoices(activeSeats, permissions, (org as any)?.createdAt);
  }, [activeSeats, permissions, org]);

  // Handlers
  const handleAddExpenseSubmit = async (newExpense: Partial<ExpenseItem>) => {
    await createExpense(newExpense);
    const updated = await fetchExpenses(undefined, new Date().getFullYear());
    setExpenses(updated);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('정말 이 광고비 지출 내역을 삭제하시겠습니까?')) return;
    try {
      await deleteExpense(id);
      showToast('광고비 지출 내역이 삭제되었습니다.', 'success');
      const updated = await fetchExpenses(undefined, new Date().getFullYear());
      setExpenses(updated);
    } catch (e: any) {
      showToast('삭제 실패: ' + (e.message || '다시 시도해주세요.'), 'error');
    }
  };

  const handleSyncTossAds = async () => {
    try {
      setIsSyncingTossAds(true);
      await syncTossAdsLive();
      const updatedToss = fetchTossAdsRecords(new Date().getFullYear());
      setTossAds(updatedToss);
      showToast('토스 애즈 실시간 광고 성과 데이터가 동기화되었습니다.', 'success');
    } catch (e: any) {
      showToast('토스 애즈 연동 실패: ' + (e.message || '시트 주소를 확인해주세요.'), 'error');
    } finally {
      setIsSyncingTossAds(false);
    }
  };

  const handleSaveTaxInfo = async (updatedInfo: OrgTaxInfo) => {
    await saveOrgTaxInfo(orgId, updatedInfo);
    setTaxInfo(updatedInfo);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          광고비 장부 및 CRM 구독 청구 데이터를 집계 중입니다...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* 1. Global Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
            <span>정산 / 경영</span>
            <ChevronRight size={12} className="text-slate-500 dark:text-slate-400" />
            <span className="text-slate-800 dark:text-slate-200">빌링 & 광고비 종합 관제</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <CreditCard size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                빌링 & 광고비 통합 관제 센터 (Billing & Ad Spend)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                언제부터 얼마의 광고비를 사용 중인지 집계하고, CRM 구독료와 결합된 통합 ROAS 및 공식 청구서를 원클릭 관제합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            onClick={() => setActiveInvoiceForModal(invoices[0])}
            className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <FileText size={14} className="text-blue-600 dark:text-blue-400" /> 당월 청구서 보기
          </button>
          <button
            onClick={() => setIsTaxInfoModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Building2 size={14} className="text-slate-600 dark:text-slate-400" /> 세금계산서 설정
          </button>
          <button
            onClick={loadData}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
            title="데이터 새로고침"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* 2. [섹션 1] CRM 솔루션 구독 & 좌석 라이선스 요약 카드 */}
      <SubscriptionStatusCard
        orgName={orgName}
        createdAt={(org as any)?.createdAt}
        activeSeats={activeSeats}
        permissions={permissions}
        onOpenPricingModal={() => setIsPricingModalOpen(true)}
        onOpenSeatModal={() => setIsSeatModalOpen(true)}
      />

      {/* 3. [섹션 2] 광고비 총괄 집계 & 타임라인 상세 장부 */}
      <AdSpendOverviewSection
        summary={adSpendSummary}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        onOpenAddExpense={() => setIsAddExpenseOpen(true)}
        onSyncTossAds={handleSyncTossAds}
        isSyncingTossAds={isSyncingTossAds}
        onDeleteExpense={handleDeleteExpense}
      />

      {/* 4. [섹션 3] 마케팅 투자 회수율 (ROAS) & 효율 분석 */}
      <MarketingRoiSection
        roi={marketingRoi}
        totalAdSpendWon={adSpendSummary.currentMonthWon}
      />

      {/* 5. [섹션 4] 월간 청구서 보관함 & 전자세금계산서 정보 */}
      <InvoiceTaxSection
        invoices={invoices}
        taxInfo={taxInfo}
        onOpenInvoiceModal={inv => setActiveInvoiceForModal(inv)}
        onOpenTaxInfoModal={() => setIsTaxInfoModalOpen(true)}
        showToast={showToast}
      />

      {/* Modals */}
      <ExpenseAddModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onSubmit={handleAddExpenseSubmit}
        showToast={showToast}
      />

      <OrgInvoiceModal
        invoice={activeInvoiceForModal}
        taxInfo={taxInfo}
        ownerEmail={ownerEmail}
        onClose={() => setActiveInvoiceForModal(null)}
        showToast={showToast}
      />

      <TaxInfoEditModal
        isOpen={isTaxInfoModalOpen}
        onClose={() => setIsTaxInfoModalOpen(false)}
        taxInfo={taxInfo}
        onSave={handleSaveTaxInfo}
        showToast={showToast}
      />

      <SeatExpansionModal
        isOpen={isSeatModalOpen}
        onClose={() => setIsSeatModalOpen(false)}
        currentSeats={activeSeats}
        maxSeats={permissions?.maxSeats || 20}
        orgName={orgName}
        showToast={showToast}
      />

      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
      />
    </div>
  );
};

export default BillingPage;
