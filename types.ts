
// 2024-01-03: Changed to dynamic string type for Status Management
export type CaseStatus = string;

export interface AssetItem {
  id: string;
  owner: '본인' | '배우자';
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

export type ReminderType = '통화' | '출장미팅' | '방문미팅' | '기타';

export interface ReminderItem {
  id: string;
  datetime: string; // "YYYY-MM-DD HH:mm"
  type: ReminderType;
  content?: string;
  isCompleted?: boolean;
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
  ownHouseOwner?: '본인' | '배우자'; // 집 명의

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
}

export interface SettlementSummary {
  year: number;
  month: number;
  count: number;
  totalRevenue: number;
  totalCommission: number;
  missingInfoCount: number;
}
