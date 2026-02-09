
// 2024-01-03: Changed to dynamic string type for Status Management
export type CaseStatus = string;

export interface AssetItem {
  id: string;
  owner: '본인' | '배우자' | '배우자 공동명의';
  type: string; // '자가', '자동차', '부동산', ...
  amount: number; // Manwon (Market Value)
  loanAmount: number; // Manwon (Collateral Loan)
  rentDeposit?: number; // Manwon (Jeonse/Rent Deposit for Real Estate)
  desc: string; // Detail
}

export interface CreditLoanItem {
  id: string;
  amount: number;
  desc: string;
}

export interface MemoItem {
  id: string;
  createdAt: string; // ISO
  content: string;
}

export type ReminderType = '통화' | '출장미팅' | '방문미팅' | '입금' | '기타';

export interface ReminderItem {
  id: string;
  datetime: string; // "YYYY-MM-DD HH:mm"
  type: ReminderType;
  content?: string;
  isCompleted?: boolean;
  resultStatus?: '완료' | '미연결' | '재예약' | '부재중' | '취소' | '확인'; // Added: Result Tracking + '확인' for dismiss sync
  resultNote?: string; // Added: Result Note
}

export interface RecordingItem {
  id: string;
  filename: string;
  uploadDate: string; // ISO
  url: string; // Blob URL (Session only) or Remote URL
  mimeType: string;
  duration?: number; // seconds
}

export interface Case {
  // 1. System Fields
  caseId: string;
  partnerId: string; // Linked Partner (Law Firm)
  createdAt: string; // ISO
  updatedAt: string; // ISO
  status: CaseStatus;
  statusUpdatedAt: string; // ISO
  managerName: string;
  isNew?: boolean; // Computed local flag
  isViewed?: boolean; // Added: Syncable flag for "Seen" status across devices
  deletedAt?: string; // [NEW] Soft Delete Timestamp (ISO)
  missedCallCount?: number; // [NEW] Missed Call Counter
  lastMissedCallAt?: string; // [NEW] Last time a missed call was logged (ISO)
  secondaryStatus?: string; // [NEW] 2차 상태 (사무장 접수 이후 관리용)
  _raw?: any; // DEBUG

  // New Fields (Request)
  caseType?: string; // '개인회생' | '파산' | '새출발기금' | '신용회복'
  inboundPath?: string; // Configurable via Settings
  preInfo?: string; // Added: 사전 정보 (DB 값 등)
  aiSummary?: string; // Added: AI Summary draft

  // 2. Personal
  customerName: string;
  phone: string;
  birth: string; // Stored as "YYYY" (e.g., "1977", "2000")
  gender: '남' | '여';
  region: string;

  // 3. Job/Insurance
  jobTypes: string[];
  insurance4: '가입' | '미가입';
  maritalStatus: '미혼' | '기혼' | '이혼';
  childrenCount?: number; // Added: Number of minor children

  // 4. Income
  incomeDetails: {
    salary?: number;
    business?: number;
    freelance?: number;
  };
  incomeNet: number; // Manwon
  loanMonthlyPay: number; // Manwon

  // 5. Housing
  housingType: '자가' | '전세' | '월세' | '무상거주';
  housingDetail: '아파트' | '빌라' | '단독주택' | '오피스텔' | '기타';

  // 5-1. Rent/Lease Fields
  deposit: number; // Manwon
  depositLoanAmount?: number; // Added: Deposit Loan
  rentContractor?: '본인' | '배우자'; // Added: Contractor
  rent: number; // Manwon

  // 5-2. Self-Owned Fields (New)
  ownHousePrice?: number; // 집 시세
  ownHouseLoan?: number; // 집 담보 대출
  ownHouseOwner?: '본인' | '배우자' | '배우자 공동명의'; // 집 명의

  // 5-3. Free Housing (New)
  rentFreeType?: '관사' | '본가' | '지인' | '기타';
  freeHousingOwner?: string; // 부모님, 형제, 자녀, 지인, 기타

  // 6. Collections
  assets: AssetItem[];
  creditLoan: CreditLoanItem[];
  specialMemo: MemoItem[];
  statusLogs?: CaseStatusLog[]; // [NEW] Sync Status History

  // 7. Debts & Memos (Remaining fields from original 7, 8, 9, 10)
  collateralLoanMemo?: string; // 담보 대출 (Manual Additional Memo)
  creditCardUse?: '사용' | '미사용'; // Changed from 'O' | 'X'
  creditCardAmount?: number; // Added: Credit Card Usage Amount
  historyType?: string; // Added: Selection for history
  historyMemo?: string; // 개인회생/파산/회복 이력 (Detail)
  reminders: ReminderItem[]; // Changed from nextCallAt

  // 9. Recordings (New)
  recordings: RecordingItem[];

  // 10. Settlement (Critical)
  contractAt?: string; // "YYYY-MM-DD"
  contractFee?: number; // Manwon

  // New: Installment & Dynamic Deposits
  installmentMonths?: string; // "완납", "2개월" ...
  useCapital?: boolean; // Checkbox

  // Legacy fields (kept for migration/reference, but UI will prefer depositHistory)
  deposit1Amount?: number;
  deposit1Date?: string;
  deposit2Amount?: number;
  deposit2Date?: string;

  // New: Dynamic Deposit History
  depositHistory: {
    date: string;
    amount: number;
    memo?: string;
  }[];

  // New: Expected Deposits (예상 입금)
  expectedDeposits?: {
    date: string;
    amount: number;
    memo?: string;
  }[];

  // New: Commission Payments (수수료 지급 내역)
  commissionPayments?: {
    date: string;
    amount: number;
    isExpected?: boolean;  // true면 예상 지급, false면 실제 지급
    memo?: string;
  }[];
}

export interface CaseStatusLog {
  logId: string;
  caseId: string;
  changedAt: string;
  changedBy: string; // Always "Mark"
  fromStatus: CaseStatus;
  toStatus: CaseStatus;
  memo?: string;
}

export interface CommissionRule {
  ruleId: string;
  minFee: number;
  maxFee: number; // If null/undefined/0 -> infinity
  commission: number; // Fixed amount in Manwon
  fullPayoutThreshold: number; // New: Minimum deposit amount for 100% payout (Manwon)
  priority: number;
  active: boolean;
  updatedAt: string;
}

export interface SettlementConfig {
  cutoffDay: number; // 0=Sun, 1=Mon, ..., 6=Sat
  payoutDay: number; // 0=Sun, ..., 6=Sat
  payoutWeekDelay: number; // 0=This week, 1=Next week

  // New: Split Payout Policy
  downPaymentPercentage: number; // e.g. 10 (%)
  firstPayoutPercentage: number; // e.g. 50 (%)
}

// 입금 계좌 정보
export interface BankAccountInfo {
  bankName: string;      // "카카오뱅크"
  accountNumber: string;
  accountHolder: string;
}

// 카톡 템플릿 설정
export interface KakaoTemplates {
  invoiceNotice?: string;    // 화요일 발행완료 안내
  payoutRequest?: string;    // 수요일 파트너 세금계산서 요청
}

// New: Partner (Law Firm) Configuration
export interface Partner {
  partnerId: string;
  name: string;
  active: boolean;

  // Settings per Partner
  settlementConfig: SettlementConfig;
  commissionRules: CommissionRule[];
  summaryTemplate: string; // Custom Template String
  aiPromptTemplate?: string; // Added: AI Summarization Prompt
  ocrPromptTemplate?: string; // Added: AI OCR Prompt (Gemini)

  // Form Configuration
  requiredFields: string[]; // List of field keys to show/require e.g., ['spouseAssets', 'childrenCount']

  // [NEW] 정산 관련 설정
  bankInfo?: BankAccountInfo;        // 입금 계좌 정보
  kakaoTemplates?: KakaoTemplates;   // 카톡 템플릿
  payoutPartnerPresets?: PayoutPartnerPreset[];  // 지급 파트너 프리셋 목록

  // [NEW] 은행 거래내역 자동 매칭용
  depositNames?: string[];           // 입금 시 표시되는 이름들 (예: ["안철형", "명율"])
}

// 지급 파트너 프리셋 (설정에서 미리 저장)
export interface PayoutPartnerPreset {
  id: string;
  name: string;           // "마케팅 A사"
  accountInfo: string;    // "국민 111-222-333"
  defaultAmount?: number; // 기본 금액 (만원)
}

// 개별 파트너 지급 항목
export interface PayoutItem {
  id: string;
  partnerName: string;
  partnerAccount: string;
  amount: number;
  paidAt?: string;
  memo?: string;
}

export interface SettlementSummary {
  year: number;
  month: number;
  count: number;
  totalRevenue: number;
  totalCommission: number;
  missingInfoCount: number;
}

// ============================================
// Weekly Settlement System Types (PRD v1.0)
// ============================================

// 주차 배치 상태
export type SettlementBatchStatus =
  | 'draft'       // 초안
  | 'confirmed'   // 월요일 카톡 확인 완료 (락0)
  | 'invoiced'    // 화요일 매출 발행 완료 (락1)
  | 'collected'   // 수금 완료
  | 'paid'        // 수요일 파트너 지급 완료 (락2)
  | 'completed';  // 매입증빙 수취 완료

// 주차 배치 (정산 단위)
export interface SettlementBatch {
  batchId: string;
  partnerId: string;
  weekLabel: string;           // "2026-W06"
  startDate: string;           // "2026-02-03" (월요일)
  endDate: string;             // "2026-02-09" (일요일)
  status: SettlementBatchStatus;

  // 집계
  dealIds: string[];           // 포함된 Deal(Case) IDs
  totalContractFee: number;    // 총 수임료 (만원)
  totalCommission: number;     // 총 수수료 (만원)

  // 증빙 - 월요일 카톡 확인
  confirmationEvidence?: {
    text?: string;
    imageUrl?: string;
    confirmedAt?: string;
  };

  // 세금계산서 - 화요일 발행
  invoiceInfo?: {
    issueDate?: string;
    supplyAmount?: number;     // 공급가
    vat?: number;              // 부가세
    total?: number;            // 합계
    approvalNumber?: string;   // 승인번호
  };

  // 수금 정보
  collectionInfo?: {
    collectedAt?: string;
    amount?: number;
    bankTxId?: string;
    memo?: string;
  };

  // 파트너 지급 - 수요일 (복수 지급 지원)
  payoutItems?: PayoutItem[];

  // 매입 세금계산서 (파트너로부터 수취)
  purchaseInvoice?: {
    receivedAt?: string;
    supplyAmount?: number;
    vat?: number;
    approvalNumber?: string;
  };

  createdAt: string;
  updatedAt: string;
}

// 조정 기록 (락 이후 변경 시)
export interface SettlementAdjustment {
  adjustmentId: string;
  batchId: string;
  type: 'refund' | 'correction' | 'late_add' | 'other';
  reason: string;
  amount: number;
  createdBy: string;
  createdAt: string;
  attachmentUrl?: string;
}

// ============================================
// Expense Management Types (지출 관리)
// ============================================

// 지출 카테고리
export type ExpenseCategory = '광고비' | '마케팅비' | '사무비용' | '인건비' | '교통비' | '식대' | '기타';

// 결제수단 타입
export type PaymentMethod = '현금' | '법인카드' | '개인카드' | '계좌이체' | '기타';

// 지출 항목
export interface ExpenseItem {
  id: string;
  partnerId?: string;           // 거래처 ID (선택적 필터링용)
  date: string;                 // "YYYY-MM-DD"
  category: ExpenseCategory;
  amount: number;               // 만원 단위
  description: string;          // 지출 내용
  paymentMethod?: PaymentMethod; // 결제수단
  memo?: string;                // 추가 메모
  receiptUrl?: string;          // 영수증 이미지 URL (선택)
  ocrText?: string;             // OCR 인식 원본 텍스트 (선택)
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Bank Transaction Types (은행 거래내역)
// ============================================

// 은행 종류
export type BankType = 'kakao' | 'kbank';

// 거래 카테고리
export type TransactionCategory =
  | '수수료수입'    // 거래처에서 받은 수수료
  | '이자'          // 예금 이자
  | '기타수입'      // 분류 불가 수입
  | '광고비'        // 토스, 네이버, 구글 등
  | '마케팅비'
  | '사무비용'
  | '인건비'
  | '교통비'
  | '식대'
  | '기타지출';     // 분류 불가 지출

// 은행 거래 내역
export interface BankTransaction {
  id: string;
  bank: BankType;
  date: string;              // "YYYY-MM-DD"
  datetime: string;          // "YYYY-MM-DD HH:mm:ss"
  type: 'income' | 'expense';
  amount: number;            // 양수 값 (원 단위)
  balance: number;           // 거래 후 잔액
  category: TransactionCategory;
  counterparty: string;      // 상대방 이름/회사
  description: string;       // 적요/내용
  memo?: string;

  // 매칭 정보
  matchedPartnerId?: string; // 매칭된 거래처
  isVerified: boolean;       // 수동 확인 여부

  // 메타
  uploadedAt: string;
  sourceFile: string;
}

// 거래 통계
export interface TransactionStats {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  byCategory: Record<TransactionCategory, number>;
  byMonth: { month: string; income: number; expense: number }[];
}

// 세금계산서 타입
export type TaxInvoiceType = '매출' | '매입';

export interface TaxInvoice {
  id: string;
  type: TaxInvoiceType;           // 매출/매입
  issueDate: string;              // 발행일 "YYYY-MM-DD"
  supplyAmount: number;           // 공급가액 (원)
  vatAmount: number;              // 세액 (원)
  totalAmount: number;            // 합계 (원)
  businessNumber: string;         // 사업자번호
  companyName: string;            // 상호
  description: string;            // 적요
  approvalNumber?: string;        // 승인번호
  isElectronic: boolean;          // 전자세금계산서 여부
  createdAt: string;
  updatedAt: string;
}

// 세무 알림 타입
export type TaxReminderType = '부가세' | '원천세' | '소득세' | '기타';

export interface TaxReminder {
  id: string;
  type: TaxReminderType;
  name: string;                   // 알림 이름
  dueDate: string;                // 기한일 "YYYY-MM-DD"
  description: string;            // 상세 설명
  isCompleted: boolean;           // 완료 여부
  notifyDaysBefore: number[];     // 며칠 전 알림 [7, 3, 1]
  createdAt: string;
}

// ============================================
// 통합 캘린더 Types
// ============================================

// 통합 캘린더 이벤트 타입
export type CalendarEventType =
  | 'reminder'      // 기존 리마인더 (고객 통화/미팅)
  | 'settlement'    // 정산 관련 (수금, 지급, 입금)
  | 'tax'           // 세무 일정 (부가세, 원천세 등)
  | 'memo';         // 사용자 개인 메모

// 사용자 캘린더 메모
export interface CalendarMemo {
  id: string;
  date: string;                   // "YYYY-MM-DD"
  time?: string;                  // "HH:mm" (선택)
  title: string;
  content?: string;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray';
  isAllDay?: boolean;
  hasNotification?: boolean;
  notifyMinutesBefore?: number;   // 몇 분 전 알림
  createdAt: string;
  updatedAt: string;
}

