// ============================================
// TM대표 전용 [빌링 & 광고비 통합 관제 센터] 비즈니스 로직 및 집계 엔진
// ============================================
import { supabase, saveSettingToSupabase } from './supabase';
import { ExpenseItem, TossAdsRecord } from '../types';
import { fetchExpenses, fetchTossAdsRecords } from './api';
import { OrgFeaturePermissions, calculateOrgMonthlyBill } from './platform';

/** 전자세금계산서 발행 정보 인터페이스 */
export interface OrgTaxInfo {
  businessNumber: string;       // 사업자등록번호 (예: 123-45-67890)
  companyName: string;          // 상호 (법인명)
  representativeName: string;   // 대표자 성명
  businessAddress: string;      // 사업장 소재지
  taxInvoiceEmail: string;      // 계산서 수신 전용 이메일
  businessType?: string;        // 업태 (예: 서비스업, 전문·과학기술)
  businessItem?: string;        // 종목 (예: 법률 사무 보조, 마케팅)
  updatedAt?: string;
}

const TAX_INFO_SETTING_KEY = 'org_tax_invoice_info';
const TAX_INFO_LOCAL_PREFIX = 'lm_tax_invoice_info_';

/** 회사별 세금계산서 발행 정보 조회 */
export const fetchOrgTaxInfo = async (orgId: string, fallbackName?: string, fallbackEmail?: string): Promise<OrgTaxInfo> => {
  const localKey = `${TAX_INFO_LOCAL_PREFIX}${orgId}`;
  let cached: Partial<OrgTaxInfo> = {};
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) cached = JSON.parse(raw);
  } catch {}

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', TAX_INFO_SETTING_KEY)
        .maybeSingle();

      if (!error && data?.value) {
        const merged: OrgTaxInfo = {
          businessNumber: data.value.businessNumber || cached.businessNumber || '',
          companyName: data.value.companyName || cached.companyName || fallbackName || '리드마스터 파트너스',
          representativeName: data.value.representativeName || cached.representativeName || '대표자',
          businessAddress: data.value.businessAddress || cached.businessAddress || '서울특별시 강남구 테헤란로 152',
          taxInvoiceEmail: data.value.taxInvoiceEmail || cached.taxInvoiceEmail || fallbackEmail || 'tax@leadmaster.xyz',
          businessType: data.value.businessType || cached.businessType || '서비스업',
          businessItem: data.value.businessItem || cached.businessItem || '콜영업 및 마케팅대행',
          updatedAt: data.value.updatedAt || cached.updatedAt || new Date().toISOString(),
        };
        localStorage.setItem(localKey, JSON.stringify(merged));
        return merged;
      }
    } catch (e) {
      console.warn('[Billing] 세금계산서 정보 DB 조회 실패, 캐시 사용:', e);
    }
  }

  return {
    businessNumber: cached.businessNumber || '123-45-67890',
    companyName: cached.companyName || fallbackName || '리드마스터 파트너스',
    representativeName: cached.representativeName || '대표자',
    businessAddress: cached.businessAddress || '서울특별시 강남구 테헤란로 152',
    taxInvoiceEmail: cached.taxInvoiceEmail || fallbackEmail || 'tax@leadmaster.xyz',
    businessType: cached.businessType || '서비스업',
    businessItem: cached.businessItem || '콜영업 및 마케팅대행',
    updatedAt: cached.updatedAt || new Date().toISOString(),
  };
};

/** 세금계산서 발행 정보 저장 (DB + 로컬) */
export const saveOrgTaxInfo = async (orgId: string, info: OrgTaxInfo): Promise<void> => {
  const localKey = `${TAX_INFO_LOCAL_PREFIX}${orgId}`;
  const payload: OrgTaxInfo = {
    ...info,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(localKey, JSON.stringify(payload));
  } catch {}

  if (supabase) {
    const ok = await saveSettingToSupabase(TAX_INFO_SETTING_KEY, payload);
    if (!ok) {
      console.warn('[Billing] 세금계산서 정보 Supabase 저장 실패 (로컬 유지)');
    }
  }
};

/** 단일 광고비 지출 레코드 (지출 장부 및 토스 애즈 통합) */
export interface AdSpendRecord {
  id: string;
  date: string;               // YYYY-MM-DD
  channel: string;            // 네이버, 메타(인스타/FB), 토스 애즈, 당근마켓, 구글, 옥외/기타
  amountWon: number;          // 원 단위 (예: 1,500,000)
  amountManwon: number;       // 만원 단위 (예: 150)
  description: string;
  source: 'expense' | 'toss_ads';
  paymentMethod?: string;
  receiptStatus?: string;
  memo?: string;
}

/** 광고비 집행 요약 KPI 및 채널별 비중 */
export interface AdSpendSummary {
  currentMonthWon: number;
  currentMonthManwon: number;
  prevMonthWon: number;
  prevMonthManwon: number;
  monthOverMonthGrowthRate: number; // 전월비 증감률 (%)
  earliestDate: string | null;       // 최초 광고비 집행일 (예: 2026-06-01)
  daysSinceFirstSpend: number;      // 집행 경과 일수 (D+N)
  cumulativeTotalWon: number;       // 역대 누적 총 광고비 (원)
  cumulativeTotalManwon: number;    // 역대 누적 총 광고비 (만원)
  channelBreakdown: {
    channel: string;
    amountWon: number;
    amountManwon: number;
    percentage: number;
    color: string;
  }[];
  records: AdSpendRecord[];
}

/** 채널 정규화 헬퍼 */
export const normalizeAdChannel = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('네이버') || lower.includes('naver') || lower.includes('파워링크')) return '네이버';
  if (lower.includes('메타') || lower.includes('인스타') || lower.includes('페이스북') || lower.includes('meta') || lower.includes('instagram')) return '메타(SNS)';
  if (lower.includes('토스') || lower.includes('toss') || lower.includes('비바리퍼블리카')) return '토스 애즈';
  if (lower.includes('당근') || lower.includes('daangn')) return '당근마켓';
  if (lower.includes('구글') || lower.includes('google') || lower.includes('youtube') || lower.includes('유튜브')) return '구글/유튜브';
  return '기타 광고';
};

const CHANNEL_COLORS: Record<string, string> = {
  '네이버': '#03C75A',
  '메타(SNS)': '#1877F2',
  '토스 애즈': '#0064FF',
  '당근마켓': '#FF6F0F',
  '구글/유튜브': '#EA4335',
  '기타 광고': '#8B5CF6',
};

/** 지출 장부와 토스애즈를 결합하여 통합 광고비 요약 및 타임라인 생성 */
export const computeAdSpendSummary = (
  expenses: ExpenseItem[],
  tossAds: TossAdsRecord[],
  targetYear: number,
  targetMonth: number | 'all'
): AdSpendSummary => {
  const unifiedRecords: AdSpendRecord[] = [];

  // 1. ExpenseItem 중 '광고비' 및 '마케팅비' 추출
  expenses.forEach(e => {
    if (e.category === '광고비' || e.category === '마케팅비') {
      const channel = normalizeAdChannel(e.description || e.memo || '기타 광고');
      const amountWon = (e.amount || 0) * 10000;
      unifiedRecords.push({
        id: e.id,
        date: e.date || new Date().toISOString().slice(0, 10),
        channel,
        amountWon,
        amountManwon: e.amount || 0,
        description: e.description || `${channel} 광고비 집행`,
        source: 'expense',
        paymentMethod: e.paymentMethod || '법인카드',
        receiptStatus: e.receiptUrl ? '영수증 첨부' : '세금계산서 완료',
        memo: e.memo,
      });
    }
  });

  // 2. 토스 애즈 기록 결합 (중복 방지: 이미 expense에 등록된 토스 주간 건과 충돌하지 않도록)
  tossAds.forEach(t => {
    const amountWon = t.spendIncVat || t.spendExVat || 0;
    const amountManwon = Math.round(amountWon / 10000);
    unifiedRecords.push({
      id: `toss-${t.id}`,
      date: t.date,
      channel: '토스 애즈',
      amountWon,
      amountManwon,
      description: `${t.campaignName || '토스 애즈 광고'} (실시간 연동)`,
      source: 'toss_ads',
      paymentMethod: '토스 비즈니스 머니',
      receiptStatus: '시스템 자동 연동',
      memo: `노출 ${t.impressions?.toLocaleString() || 0}회 / 클릭 ${t.clicks?.toLocaleString() || 0}회`,
    });
  });

  // 일자 내림차순 정렬 (최신순)
  unifiedRecords.sort((a, b) => b.date.localeCompare(a.date));

  // 역대 누적 광고비 및 최초 집행일 계산
  let cumulativeTotalWon = 0;
  let earliestDate: string | null = null;

  unifiedRecords.forEach(r => {
    cumulativeTotalWon += r.amountWon;
    if (!earliestDate || r.date < earliestDate) {
      earliestDate = r.date;
    }
  });

  const cumulativeTotalManwon = Math.round(cumulativeTotalWon / 10000);

  // 최초 집행일로부터 경과 일수
  let daysSinceFirstSpend = 0;
  if (earliestDate) {
    const firstDateObj = new Date(earliestDate);
    const todayObj = new Date();
    const diffTime = Math.max(0, todayObj.getTime() - firstDateObj.getTime());
    daysSinceFirstSpend = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  // 당월 및 전월 광고비 집계
  const curMonthPrefix = targetMonth === 'all'
    ? `${targetYear}-`
    : `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

  let prevYear = targetYear;
  let prevMonthNum = typeof targetMonth === 'number' ? targetMonth - 1 : 0;
  if (prevMonthNum === 0) {
    prevYear = targetYear - 1;
    prevMonthNum = 12;
  }
  const prevMonthPrefix = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;

  let currentMonthWon = 0;
  let prevMonthWon = 0;

  unifiedRecords.forEach(r => {
    if (r.date.startsWith(curMonthPrefix)) {
      currentMonthWon += r.amountWon;
    }
    if (r.date.startsWith(prevMonthPrefix)) {
      prevMonthWon += r.amountWon;
    }
  });

  const currentMonthManwon = Math.round(currentMonthWon / 10000);
  const prevMonthManwon = Math.round(prevMonthWon / 10000);

  // 전월 대비 증감률 (%)
  let monthOverMonthGrowthRate = 0;
  if (prevMonthWon > 0) {
    monthOverMonthGrowthRate = Math.round(((currentMonthWon - prevMonthWon) / prevMonthWon) * 1000) / 10;
  }

  // 채널별 비중 계산 (당월 기준, 없으면 누적 기준)
  const targetScopeWon = currentMonthWon > 0 ? currentMonthWon : cumulativeTotalWon;
  const channelSums: Record<string, number> = {};

  unifiedRecords.forEach(r => {
    const isInScope = currentMonthWon > 0 ? r.date.startsWith(curMonthPrefix) : true;
    if (isInScope) {
      channelSums[r.channel] = (channelSums[r.channel] || 0) + r.amountWon;
    }
  });

  const channelBreakdown = Object.entries(channelSums)
    .map(([channel, amountWon]) => ({
      channel,
      amountWon,
      amountManwon: Math.round(amountWon / 10000),
      percentage: targetScopeWon > 0 ? Math.round((amountWon / targetScopeWon) * 1000) / 10 : 0,
      color: CHANNEL_COLORS[channel] || '#94A3B8',
    }))
    .sort((a, b) => b.amountWon - a.amountWon);

  return {
    currentMonthWon,
    currentMonthManwon,
    prevMonthWon,
    prevMonthManwon,
    monthOverMonthGrowthRate,
    earliestDate,
    daysSinceFirstSpend,
    cumulativeTotalWon,
    cumulativeTotalManwon,
    channelBreakdown,
    records: unifiedRecords,
  };
};

/** 마케팅 성과 및 ROAS 분석 요약 */
export interface MarketingRoiSummary {
  totalLeads: number;
  contractCount: number;
  contractRate: number;              // 성약률 (%)
  totalContractFeeWon: number;       // 성약 수임료 총액 (원)
  overallRoas: number;               // 종합 ROAS (%)
  cplWon: number;                    // CPL (리드당 획득비용, 원)
  cpaWon: number;                    // CPA (계약당 획득비용, 원)
  statusGrade: 'excellent' | 'good' | 'warning';
  gradeMessage: string;
  channelStats: {
    channel: string;
    spendWon: number;
    spendManwon: number;
    leads: number;
    contracts: number;
    contractFeeWon: number;
    cplWon: number;
    cpaWon: number;
    roas: number;
  }[];
}

/** ROAS & 효율 지표 계산 */
export const computeMarketingRoi = (
  cases: any[],
  adSpendSummary: AdSpendSummary,
  targetYear: number,
  targetMonth: number | 'all'
): MarketingRoiSummary => {
  const monthPrefix = targetMonth === 'all'
    ? `${targetYear}-`
    : `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

  const periodCases = cases.filter(c => {
    if (!c.createdAt) return false;
    return c.createdAt.startsWith(monthPrefix) && c.status !== '휴지통';
  });

  const totalLeads = periodCases.length;
  const contractedCases = periodCases.filter(c => !!c.contractAt);
  const contractCount = contractedCases.length;
  const contractRate = totalLeads > 0 ? Math.round((contractCount / totalLeads) * 1000) / 10 : 0;

  // 수임료 총액 (원 단위, contractFee는 만원 단위)
  const totalContractFeeManwon = contractedCases.reduce((sum, c) => sum + (c.contractFee || 0), 0);
  const totalContractFeeWon = totalContractFeeManwon * 10000;

  const totalSpendWon = adSpendSummary.currentMonthWon > 0
    ? adSpendSummary.currentMonthWon
    : (adSpendSummary.cumulativeTotalWon > 0 ? adSpendSummary.cumulativeTotalWon : 1);

  const overallRoas = totalSpendWon > 0
    ? Math.round((totalContractFeeWon / totalSpendWon) * 100)
    : 0;

  const cplWon = totalLeads > 0 ? Math.round(totalSpendWon / totalLeads) : 0;
  const cpaWon = contractCount > 0 ? Math.round(totalSpendWon / contractCount) : 0;

  // AI 마케팅 효율 신호등
  let statusGrade: 'excellent' | 'good' | 'warning' = 'good';
  let gradeMessage = '안정적인 마케팅 성과를 유지하고 있습니다. 부재콜 재접촉률을 높여 ROAS를 추가 극대화하세요.';

  if (overallRoas >= 300 || (cplWon > 0 && cplWon <= 35000)) {
    statusGrade = 'excellent';
    gradeMessage = '광고비 투입 대비 매우 우수한 수임 성과가 창출되고 있습니다. 현재 고효율 캠페인 규모 확장을 권장합니다.';
  } else if (overallRoas < 150) {
    statusGrade = 'warning';
    gradeMessage = '투입 광고비 대비 계약 전환율이 다소 낮습니다. 상담 스크립트 점검 및 비효율 광고 채널 예산 조정을 권장합니다.';
  }

  // 채널별 지표 분할
  const channelData: Record<string, { leads: number; contracts: number; feeWon: number }> = {};
  periodCases.forEach(c => {
    const rawPath = c.inboundPath || '기타';
    const ch = normalizeAdChannel(rawPath);
    if (!channelData[ch]) channelData[ch] = { leads: 0, contracts: 0, feeWon: 0 };
    channelData[ch].leads++;
    if (c.contractAt) {
      channelData[ch].contracts++;
      channelData[ch].feeWon += (c.contractFee || 0) * 10000;
    }
  });

  const channelStats = adSpendSummary.channelBreakdown.map(item => {
    const perf = channelData[item.channel] || { leads: 0, contracts: 0, feeWon: 0 };
    const leads = perf.leads;
    const contracts = perf.contracts;
    const feeWon = perf.feeWon;
    const spendWon = item.amountWon;
    const cpl = leads > 0 ? Math.round(spendWon / leads) : 0;
    const cpa = contracts > 0 ? Math.round(spendWon / contracts) : 0;
    const roas = spendWon > 0 ? Math.round((feeWon / spendWon) * 100) : 0;

    return {
      channel: item.channel,
      spendWon,
      spendManwon: item.amountManwon,
      leads,
      contracts,
      contractFeeWon: feeWon,
      cplWon: cpl,
      cpaWon: cpa,
      roas,
    };
  });

  return {
    totalLeads,
    contractCount,
    contractRate,
    totalContractFeeWon,
    overallRoas,
    cplWon,
    cpaWon,
    statusGrade,
    gradeMessage,
    channelStats,
  };
};

/** 월별 공식 청구서 인터페이스 */
export interface MonthlyInvoiceRecord {
  invoiceNumber: string;       // LM-BILL-YYYYMM-XXXX
  billingMonth: string;        // "2026년 11월"
  billingMonthKey: string;     // "2026-11"
  tierName: string;
  activeSeats: number;
  unitPrice: number;
  supplyPrice: number;
  vat: number;
  totalPrice: number;
  dueDate: string;             // "2026-12-10"
  status: 'paid' | 'pending';
  paidAt?: string;
  issueDate: string;
}

/** 최근 6개월간의 청구서 목록 생성기 */
export const generateRecentInvoices = (
  activeSeats: number,
  permissions?: OrgFeaturePermissions,
  orgCreatedAt?: string
): MonthlyInvoiceRecord[] => {
  const invoices: MonthlyInvoiceRecord[] = [];
  const now = new Date();
  const seats = Math.max(1, activeSeats);
  const bill = calculateOrgMonthlyBill(seats, permissions);

  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ymKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const ymLabel = `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월`;
    const issueDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 10);
    const dueDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-10`;

    const supplyPrice = bill.totalPrice;
    const vat = Math.floor(supplyPrice * 0.1);
    const totalPrice = supplyPrice + vat;

    // 지난 달들은 완납(paid), 당월은 납부 대기(pending) 또는 완납 처리
    const isPast = i > 0;
    const status: 'paid' | 'pending' = isPast ? 'paid' : 'pending';

    invoices.push({
      invoiceNumber: `LM-BILL-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.abs(d.getFullYear() * 100 + d.getMonth())).slice(0, 4)}`,
      billingMonth: ymLabel,
      billingMonthKey: ymKey,
      tierName: bill.tierName,
      activeSeats: seats,
      unitPrice: bill.unitPrice,
      supplyPrice,
      vat,
      totalPrice,
      dueDate,
      status,
      paidAt: isPast ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-05` : undefined,
      issueDate,
    });
  }

  return invoices;
};

/** 공식 청구서 마크다운 생성기 */
export const generateOfficialInvoiceMarkdown = (
  invoice: MonthlyInvoiceRecord,
  taxInfo: OrgTaxInfo,
  ownerEmail?: string
): string => {
  return `# 리드마스터 CRM 월간 서비스 이용료 청구서

문서 번호: ${invoice.invoiceNumber}
발행 일자: ${invoice.issueDate}
청구 기간: ${invoice.billingMonth}분 (1개월)
납부 기한: ${invoice.dueDate} 까지

============================================================
1. 공급자 및 공급받는 자
============================================================
[공급자 (서비스 제공사)]
- 상호/회사명: 리드마스터 (LeadMaster CRM)
- 대표자: 진성호
- 사업자번호: 214-12-89201
- 대표 이메일: support@lmaster.xyz
- 고객센터: 1544-7890

[공급받는 자 (고객사)]
- 상호/회사명: ${taxInfo.companyName}
- 대표자: ${taxInfo.representativeName}
- 사업자번호: ${taxInfo.businessNumber || '미등록'}
- 사업장소재지: ${taxInfo.businessAddress || '미등록'}
- 수신 이메일: ${taxInfo.taxInvoiceEmail || ownerEmail || '등록 계정'}

============================================================
2. 당월 이용 내역 및 청구 금액 산출
============================================================
- 적용 요금제: ${invoice.tierName}
- 과금 기준: 활성 상담원 계정 수
- 청구 수량: ${invoice.activeSeats} 석
- 좌석당 단가: ₩${invoice.unitPrice.toLocaleString()} 원/석 (월)

------------------------------------------------------------
- 공급가액: ₩${invoice.supplyPrice.toLocaleString()} 원
- 부가가치세 (VAT 10%): ₩${invoice.vat.toLocaleString()} 원
------------------------------------------------------------
★ 최종 청구 합계 금액: ₩${invoice.totalPrice.toLocaleString()} 원 (VAT 포함)
★ 납부 상태: ${invoice.status === 'paid' ? '완납 (결제 완료)' : '납부 대기 (입금 기한: ' + invoice.dueDate + ')'}

============================================================
3. 입금 계좌 및 결제 안내
============================================================
- 입금 은행: 카카오뱅크
- 계좌 번호: 3333-21-490199
- 예금주: 진성훈 (리드마스터)
- 입금자명 표기: [${taxInfo.companyName}_${taxInfo.representativeName}]
- 안내 사항: 입금 확인 후 기재하신 이메일(${taxInfo.taxInvoiceEmail || '등록 메일'})로 전자세금계산서(영수)가 24시간 이내에 자동 발행됩니다.
`;
};
