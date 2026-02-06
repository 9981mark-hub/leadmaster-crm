
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

  // 파트너 지급 - 수요일 (선택적, 매번 있지 않을 수 있음)
  payoutInfo?: {
    enabled?: boolean;       // 파트너 지급 여부 (없으면 false)
    paidAt?: string;
    amount?: number;         // 수동 입력 금액 (수금액과 연동 X)
    memo?: string;
    partnerName?: string;    // 지급 대상 파트너명
    partnerAccount?: string; // 지급 계좌 정보
  };

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


