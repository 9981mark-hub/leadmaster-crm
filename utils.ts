
import { Case, CommissionRule, CaseStatus, SettlementConfig, Partner, MemoItem, MissedCallIntervalTier, DEFAULT_INTERVAL_TIERS, TelegramRoomTarget } from './types';
import { differenceInDays, parse, format, isValid, isToday, isPast, nextDay, addWeeks, setDay, startOfWeek, endOfWeek, isAfter, isBefore } from 'date-fns';
import { REMINDER_REQUIRED_STATUSES, CONTRACT_COMPLETED_STATUSES, DEFAULT_SUMMARY_TEMPLATE } from './constants';
import { ko } from 'date-fns/locale';

// ============================================
// 재통화 알림 구간별 유틸리티
// ============================================

/**
 * 케이스의 등록일(createdAt) 기준으로 적절한 알림 주기를 반환
 */
export const getMissedCallInterval = (createdAt: string, tiers: MissedCallIntervalTier[]): number => {
  const safeTiers = Array.isArray(tiers) && tiers.length > 0 ? tiers : DEFAULT_INTERVAL_TIERS;
  const ageDays = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const tier = safeTiers.find(t =>
    ageDays >= t.minDays && (t.maxDays === 0 || ageDays < t.maxDays)
  );

  return tier?.interval ?? safeTiers[0]?.interval ?? 3;
};

/**
 * 특정 케이스가 재통화 필요 상태인지 판단
 */
export const isOverdueMissedCall = (
  c: Case,
  missedCallStatus: string,
  tiers: MissedCallIntervalTier[]
): boolean => {
  if (c.status !== missedCallStatus) return false;

  const interval = getMissedCallInterval(c.createdAt, tiers);
  // Use lastMissedCallAt if available, otherwise use createdAt as baseline
  const baseDate = c.lastMissedCallAt || c.createdAt;
  if (!baseDate) return false;

  const elapsed = Date.now() - new Date(baseDate).getTime();
  return elapsed > interval * 24 * 60 * 60 * 1000;
};

/**
 * localStorage에서 tiers를 로드하는 헬퍼
 */
export const loadMissedCallTiers = (): MissedCallIntervalTier[] => {
  try {
    const stored = localStorage.getItem('lm_missedIntervalTiers');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse missedCallIntervalTiers:', e);
  }
  return [...DEFAULT_INTERVAL_TIERS];
};

export const loadTelegramRooms = (): TelegramRoomTarget[] => {
  try {
    const stored = localStorage.getItem('lm_telegramRooms');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse telegramRooms:', e);
  }
  return [];
};

export const saveTelegramRooms = (rooms: TelegramRoomTarget[]) => {
  localStorage.setItem('lm_telegramRooms', JSON.stringify(rooms));
};

export const getMatchingRule = (fee: number, rules: CommissionRule[]): CommissionRule | undefined => {
  // [SAFETY FIX] Ensure rules is always an array
  const safeRules = Array.isArray(rules) ? rules : [];
  const activeRules = safeRules.filter(r => r.active);
  const matchedRules = activeRules.filter(r => {
    const minOk = fee >= r.minFee;
    const maxOk = !r.maxFee || fee <= r.maxFee;
    return minOk && maxOk;
  });

  if (matchedRules.length === 0) return undefined;

  matchedRules.sort((a, b) => {
    if (b.minFee !== a.minFee) return b.minFee - a.minFee; // Larger minFee first (Specific)
    if (b.priority !== a.priority) return b.priority - a.priority; // Higher priority
    // Date string comparison (ISO)
    if (b.updatedAt !== a.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
    return b.ruleId.localeCompare(a.ruleId);
  });

  return matchedRules[0];
};

// Calculate Max Potential Commission
export const calculateCommission = (fee: number, rules: CommissionRule[]): number => {
  if (!fee) return 0;
  // [SAFETY FIX] getMatchingRule already handles array safety, but ensure rules exists
  const safeRules = Array.isArray(rules) ? rules : [];
  const rule = getMatchingRule(fee, safeRules);
  return rule ? rule.commission : 0;
};

// Calculate Payable Commission based on Deposit Amount
export const calculatePayableCommission = (c: Case, rules: CommissionRule[], config?: SettlementConfig): { payable: number, total: number, isPartial: boolean, rule?: CommissionRule } => {
  if (!c.contractFee) return { payable: 0, total: 0, isPartial: false };

  // [SAFETY FIX] Ensure rules is always an array
  const safeRules = Array.isArray(rules) ? rules : [];
  const rule = getMatchingRule(c.contractFee, safeRules);
  if (!rule) return { payable: 0, total: 0, isPartial: false };

  // Use depositHistory if available, else fallback to legacy fields
  const totalDeposit = (c.depositHistory && c.depositHistory.length > 0)
    ? c.depositHistory.reduce((sum, d) => sum + (d.amount || 0), 0)
    : (c.deposit1Amount || 0) + (c.deposit2Amount || 0);

  const threshold = rule.fullPayoutThreshold || 0;

  const downPaymentRate = config ? config.downPaymentPercentage / 100 : 0.1; // Default 10%
  const firstPayoutRate = config ? config.firstPayoutPercentage / 100 : 0.5; // Default 50%

  // 1. Full Payout Condition (Deposit >= Threshold)
  if (threshold > 0 && totalDeposit >= threshold) {
    return { payable: rule.commission, total: rule.commission, isPartial: false, rule };
  }

  // 2. Partial Payout Condition (Deposit >= Down Payment % of Fee)
  // [FIX] 구간 최저값(rule.minFee)을 기준으로 계약금 비율 적용 (e.g. 400~499 구간 → 400 × 10% = 40만원)
  if (totalDeposit >= (rule.minFee * downPaymentRate)) {
    return { payable: rule.commission * firstPayoutRate, total: rule.commission, isPartial: true, rule };
  }

  return { payable: 0, total: rule.commission, isPartial: false, rule };
};

export const getCaseWarnings = (c: Case, partner?: Partner) => {
  const warnings: string[] = [];

  // 1. Reminder Missing
  if (REMINDER_REQUIRED_STATUSES.includes(c.status) && (!c.reminders || c.reminders.length === 0)) {
    warnings.push('리마인더 없음');
  }

  // 2. Contract Date Missing
  if (CONTRACT_COMPLETED_STATUSES.includes(c.status) && !c.contractAt) {
    warnings.push('계약일 미입력');
  }

  // 3. Fee Missing
  if (CONTRACT_COMPLETED_STATUSES.includes(c.status) && !c.contractFee) {
    warnings.push('수임료 미입력');
  }

  // 4. Rule Missing
  if (c.contractFee && CONTRACT_COMPLETED_STATUSES.includes(c.status) && partner) {
    const commission = calculateCommission(c.contractFee, partner.commissionRules);
    if (commission === 0) {
      warnings.push('수당 룰 없음');
    }
  }

  return warnings;
};

// --- Birth Year Normalizer: "77" -> "1977", "00" -> "2000" ---
export const normalizeBirthYear = (input: string): string => {
  const clean = input.replace(/[^\d]/g, '');

  // If user enters 2 digits, convert to 4 digits
  if (clean.length === 2) {
    const val = parseInt(clean, 10);
    // Pivot at 30: 00-30 -> 2000s, 31-99 -> 1900s
    // e.g. 25 -> 2025 (likely not target for debt relief but consistent), 99 -> 1999
    return val <= 30 ? `20${clean}` : `19${clean}`;
  }

  return clean;
};

// --- Phone Number Formatter: 01012345678 -> 010-1234-5678 ---
export const normalizePhone = (phone: any) => {
  if (!phone) return '';
  return String(phone).replace(/[^0-9]/g, '');
};

export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  const clean = normalizePhone(phone);
  // ... rest of format logic
  if (clean.length === 11) {
    // 010-1234-5678
    return clean.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  if (clean.length === 10) {
    // 02-1234-5678 or 011-123-4567
    if (clean.startsWith('02')) {
      return clean.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
    }
    return clean.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  if (clean.length === 9) {
    // 02-123-4567
    if (clean.startsWith('02')) {
      return clean.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
    }
  }
  // Fallback: Just return original if it doesn't match standard patterns
  return phone;
};

// --- Duplicate Checker ---
export const checkIsDuplicate = (phone: string, cases: Case[]): Case | undefined => {
  if (!phone) return undefined;
  const target = normalizePhone(phone);
  if (target.length < 9) return undefined; // Too short to be valid
  return cases.find(c => c.phone && normalizePhone(c.phone) === target);
};

// --- Money Formatter: 25000 -> 2억 5,000만원 ---
export const formatKoreanMoney = (value: number | undefined): string => {
  if (value === undefined || value === null || isNaN(value)) return '';
  if (value === 0) return '0원';

  const eok = Math.floor(value / 10000);
  const man = value % 10000;

  if (eok > 0 && man > 0) {
    return `${eok.toLocaleString()}억 ${man.toLocaleString()}만원`;
  }
  if (eok > 0 && man === 0) {
    return `${eok.toLocaleString()}억원`;
  }
  if (eok === 0 && man > 0) {
    return `${man.toLocaleString()}만원`;
  }

  return '0원'; // Should not be reached if value > 0
};

export const generateSummary = (c: Case, template: string = DEFAULT_SUMMARY_TEMPLATE) => {
  let processedTemplate = template;

  if (c.maritalStatus === '미혼') {
    processedTemplate = processedTemplate.replace(/^\* 미성년 자녀 수 : .*\r?\n?/gm, '');
  }

  // [NEW] Remove Credit Card Amount if Unused
  if (c.creditCardUse === '미사용') {
    processedTemplate = processedTemplate.replace(/^\* 신용카드 사용금액 : .*\r?\n?/gm, '');
  }

  // [NEW] Remove 4 Major Insurance if '무직' is the ONLY job type
  // Note: jobTypes is an array. We check if it has length 1 and that one item is '무직'.
  if (c.jobTypes && c.jobTypes.length === 1 && c.jobTypes[0] === '무직') {
    processedTemplate = processedTemplate.replace(/^\* 4대보험 가입유무 : .*\r?\n?/gm, '');
  }

  // 1. Prepare Data map
  const depositRentStrParts = [];
  if (c.housingType === '자가') {
    if (c.ownHousePrice) depositRentStrParts.push(`집 시세 ${formatKoreanMoney(c.ownHousePrice)}`);
    if (c.ownHouseLoan) depositRentStrParts.push(`(집 담보대출 ${formatKoreanMoney(c.ownHouseLoan)})`);
    if (c.ownHouseOwner) depositRentStrParts.push(`[명의: ${c.ownHouseOwner}]`);
  } else if (c.housingType === '무상거주') {
    depositRentStrParts.push(`무상거주`);
    if (c.freeHousingOwner) depositRentStrParts.push(`[명의: ${c.freeHousingOwner}]`);
  } else {
    if (c.deposit) depositRentStrParts.push(`보증금 ${formatKoreanMoney(c.deposit)}`);
    if (c.rent) depositRentStrParts.push(`월세 ${formatKoreanMoney(c.rent)}`);
    if (c.depositLoanAmount) depositRentStrParts.push(`(보증금 대출: ${formatKoreanMoney(c.depositLoanAmount)})`);
    if (c.rentContractor) depositRentStrParts.push(`[계약자: ${c.rentContractor}]`);
  }
  const depositRentStr = depositRentStrParts.length > 0 ? depositRentStrParts.join(' ') : '정보 없음';

  // Assets with Details (No Total Sum)
  const assetsList = c.assets && c.assets.length > 0
    ? c.assets.map(a => {
      const descInfo = a.desc ? `(${a.desc})` : '';
      const depositInfo = a.rentDeposit ? `/전세${formatKoreanMoney(a.rentDeposit)}` : '';
      return `(${a.owner}/${a.type}${descInfo} 시세 ${formatKoreanMoney(a.amount)}${a.loanAmount ? `/담보${formatKoreanMoney(a.loanAmount)}` : ''}${depositInfo})`;
    })
    : [];
  let assetsStr = assetsList.length > 0 ? assetsList.join(' ') : '없음';

  // Collateral Loans with Total
  const collateralParts = [];
  let totalCollateralAmount = 0;

  // 1. 보증금 대출 (자가/무상거주 아닐 때)
  if (c.housingType !== '자가' && c.housingType !== '무상거주' && c.depositLoanAmount) {
    collateralParts.push(`보증금 대출(${formatKoreanMoney(c.depositLoanAmount)})`);
    totalCollateralAmount += c.depositLoanAmount;
  }
  // 2. 집 담보 대출 (자가일 때만)
  if (c.housingType === '자가' && c.ownHouseLoan) {
    collateralParts.push(`집 담보 대출(${formatKoreanMoney(c.ownHouseLoan)})`);
    totalCollateralAmount += c.ownHouseLoan;
  }
  // 3. 자산 내 담보
  if (c.assets) {
    c.assets.filter(a => a.loanAmount > 0).forEach(a => {
      collateralParts.push(`${a.type} 담보(${formatKoreanMoney(a.loanAmount)})`);
      totalCollateralAmount += a.loanAmount;
    });
  }
  if (c.collateralLoanMemo) collateralParts.push(c.collateralLoanMemo);

  let collateralStr = collateralParts.length > 0 ? collateralParts.join(', ') : '없음';
  if (totalCollateralAmount > 0) {
    collateralStr += ` [총 합계: ${formatKoreanMoney(totalCollateralAmount)}]`;
  }

  // Credit Loans with Total
  let totalCreditLoanAmount = 0;
  const creditLoanList = c.creditLoan && c.creditLoan.length > 0
    ? c.creditLoan.map(l => {
      totalCreditLoanAmount += (l.amount || 0);
      return `${l.desc} ${formatKoreanMoney(l.amount)}`;
    })
    : [];

  // ADDED: Include Credit Card Amount in Credit Loans
  if (c.creditCardUse === '사용' && c.creditCardAmount) {
    totalCreditLoanAmount += c.creditCardAmount;
    creditLoanList.push(`신용카드 ${formatKoreanMoney(c.creditCardAmount)}`);
  }

  let creditLoanStr = creditLoanList.length > 0 ? creditLoanList.join(', ') : '없음';
  if (totalCreditLoanAmount > 0) {
    creditLoanStr += ` [총 합계: ${formatKoreanMoney(totalCreditLoanAmount)}]`;
  }

  let historyStr = c.historyType || '없음';
  if (c.historyType && c.historyType !== '없음' && c.historyMemo) {
    historyStr += ` (${c.historyMemo})`;
  }

  const sortedMemos = c.specialMemo
    ? [...c.specialMemo]
      .filter(m => !m.content.startsWith('[상태변경]')) // Filter out status changes
      .sort((a, b) => String(b.createdAt || (b as any).datetime || '').localeCompare(String(a.createdAt || (a as any).datetime || '')))
    : [];
  const allMemosContent = sortedMemos.length > 0
    ? sortedMemos.map(memo => `[${safeFormat(memo.createdAt || (memo as any).datetime, 'yyyy-MM-dd HH:mm', '-')}]\n${memo.content}`).join('\n\n')
    : '없음';

  const jobTypesStr = c.jobTypes && c.jobTypes.length > 0 ? c.jobTypes.join(', ') : '정보 없음';

  const incomeParts = [];
  if (c.incomeDetails?.salary) incomeParts.push(`직장인 ${formatKoreanMoney(c.incomeDetails.salary)}`);
  if (c.incomeDetails?.business) incomeParts.push(`사업자 ${formatKoreanMoney(c.incomeDetails.business)}`);
  if (c.incomeDetails?.freelance) incomeParts.push(`프리랜서 ${formatKoreanMoney(c.incomeDetails.freelance)}`);
  let incomeDetailsStr = incomeParts.join(' + ');
  if (incomeParts.length > 1) {
    incomeDetailsStr += ` (총 ${formatKoreanMoney(c.incomeNet)})`;
  } else if (incomeParts.length === 0) {
    incomeDetailsStr = formatKoreanMoney(c.incomeNet); // Fallback for old data
  }

  const dataMap: any = {
    managerName: c.managerName,
    customerName: c.customerName,
    phone: c.phone,
    birth: c.birth ? c.birth + '년생' : '-',
    gender: c.gender,
    region: c.region,
    jobTypes: jobTypesStr,
    insurance4: c.insurance4,
    maritalStatus: c.maritalStatus,
    childrenCount: c.childrenCount !== undefined ? c.childrenCount + '명' : '-',
    incomeDetails: incomeDetailsStr,
    loanMonthlyPay: formatKoreanMoney(c.loanMonthlyPay),
    housingType: c.housingType,
    housingDetail: c.housingDetail,
    depositRentStr: depositRentStr,
    assetsStr: assetsStr,
    creditLoanStr: creditLoanStr,
    collateralStr: collateralStr,
    creditCardUse: c.creditCardUse || '미사용',
    creditCardAmountStr: c.creditCardUse === '사용' && c.creditCardAmount ? formatKoreanMoney(c.creditCardAmount) : '없음',
    historyStr: historyStr,
    specialMemo: allMemosContent
  };

  // 2. Replace placeholders in template
  let result = processedTemplate;
  for (const key in dataMap) {
    // replace all occurrences of {{key}}
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, dataMap[key] || '');
  }

  return result.trim();
};

// Date Helpers
export const parseReminder = (dateStr?: string) => {
  if (!dateStr) return null;
  const d = parse(dateStr, 'yyyy-MM-dd HH:mm', new Date());
  return isValid(d) ? d : null;
};

export const getReminderStatus = (dateStr?: string) => {
  if (!dateStr) return 'none';
  const d = parseReminder(dateStr);
  if (!d) return 'none';
  if (isToday(d)) return 'today';
  if (isPast(d)) return 'overdue';
  return 'future';
};

// [NEW] Robust Date Parser for Korean/Unknown formats
export const parseGenericDate = (input: Date | string | number | undefined | null): Date | null => {
  if (input === undefined || input === null) return null;

  // Handle Date Object directly
  if (input instanceof Date) {
    return isValid(input) ? input : null;
  }

  // Handle Number (Excel Serial or Timestamp) -> Convert to String for trying ISO, but usually specific logic needed?
  // For now, just stringify it to prevent crash.
  const dateStr = String(input);
  if (!dateStr) return null;

  // 1. Try ISO (Standard)
  const d1 = new Date(dateStr);
  if (isValid(d1) && dateStr.includes('-') && !isNaN(d1.getTime())) return d1;

  // 2. Try Korean Format "2024. 1. 4. 오후 6:30:00" or similar
  // Normalize: remove dots, spaces, handle AM/PM
  const cleanStr = dateStr.trim();

  // Regex for full DateTime
  const koFullRegex = /(\d{4})[\.\-]\s*(\d{1,2})[\.\-]\s*(\d{1,2})[\.]?\s*(오전|오후)?\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/;
  const matchFull = cleanStr.match(koFullRegex);

  if (matchFull) {
    const year = parseInt(matchFull[1]);
    const month = parseInt(matchFull[2]) - 1;
    const day = parseInt(matchFull[3]);
    const ampm = matchFull[4];
    let hour = parseInt(matchFull[5]);
    const minute = parseInt(matchFull[6]);
    const second = matchFull[7] ? parseInt(matchFull[7]) : 0;

    if (ampm === '오후' && hour < 12) hour += 12;
    if (ampm === '오전' && hour === 12) hour = 0;

    const d2 = new Date(year, month, day, hour, minute, second);
    if (isValid(d2)) return d2;
  }

  // 3. Try Date Only: "2024. 1. 4"
  const koDateRegex = /(\d{4})[\.\-]\s*(\d{1,2})[\.\-]\s*(\d{1,2})/;
  const matchDate = cleanStr.match(koDateRegex);

  if (matchDate) {
    const year = parseInt(matchDate[1]);
    const month = parseInt(matchDate[2]) - 1;
    const day = parseInt(matchDate[3]);
    const d3 = new Date(year, month, day);
    if (isValid(d3)) return d3;
  }

  // 4. Fallback: naive replacement of dots to hyphens
  const d4 = new Date(dateStr.replace(/\./g, '-'));
  if (isValid(d4) && !isNaN(d4.getTime())) return d4;

  return null;
};

// Settlement Helpers
export const getDayName = (dayIdx: number) => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[dayIdx] || '';
};

// Now calculate for a specific Partner's context
export const calculateNextSettlement = (cases: Case[], partner: Partner) => {
  const rules = partner.commissionRules;
  const config = partner.settlementConfig;

  // 1. Calculate Eligible Pending Amount based on Rules
  // [SAFETY FIX] Ensure cases is always an array
  const safeCases = Array.isArray(cases) ? cases : [];
  // Filter cases for this partner
  const eligibleCases = safeCases.filter(c =>
    c.partnerId === partner.partnerId &&
    ['1차 입금완료', '2차 입금완료', '계약 완료'].includes(c.status) && c.contractFee
  );

  let currentTotalDeposit = 0; // Total Deposit from customers (Informational)
  let expectedCommission = 0; // Payable commission to manager

  eligibleCases.forEach(c => {
    const deposit = (c.deposit1Amount || 0) + (c.deposit2Amount || 0);
    currentTotalDeposit += deposit;
    const { payable } = calculatePayableCommission(c, rules, config);
    expectedCommission += payable;
  });

  // 2. Determine Dates
  const today = new Date();
  // Logic: Find the next occurrence of cutoffDay (e.g., Sunday)
  // If today IS the cutoff day, we consider today as the cutoff.
  let cutoffDate = setDay(today, config.cutoffDay, { weekStartsOn: 0 }); // 0 is Sunday
  if (isBefore(cutoffDate, today) && !isToday(cutoffDate)) {
    cutoffDate = nextDay(today, config.cutoffDay as any);
  }

  // Payout Date: cutoffDate + delay
  let payoutDate = setDay(cutoffDate, config.payoutDay, { weekStartsOn: 0 });
  // If payout day is <= cutoff day (e.g. cutoff Sun, payout Tue), it must be next week
  if (config.payoutDay <= config.cutoffDay) {
    payoutDate = addWeeks(payoutDate, 1);
  }
  if (config.payoutWeekDelay > 0) {
    payoutDate = addWeeks(payoutDate, config.payoutWeekDelay);
  }

  return {
    cutoffDate: format(cutoffDate, 'yyyy-MM-dd'),
    payoutDate: format(payoutDate, 'yyyy-MM-dd'),
    currentTotalDeposit,
    expectedCommission,
    threshold: 0,
    isEligible: expectedCommission > 0,
    cutoffDayName: getDayName(config.cutoffDay),
    payoutDayName: getDayName(config.payoutDay)
  };
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64Content = reader.result.split(',')[1];
        resolve(base64Content);
      }
    };
    reader.onerror = error => reject(error);
  });
};

export const convertToPlayableUrl = (url: string): string => {
  if (!url) return '';
  // Check if it's a Google Drive URL
  if (!url.includes('drive.google.com')) return url;

  let id = '';
  // Patterns: 
  // 1. /file/d/ID/view
  // 2. id=ID
  const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) {
    id = match1[1];
  } else {
    const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match2) id = match2[1];
  }

  if (id) {
    return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  return url;
};

export const convertToPreviewUrl = (url: string): string => {
  if (!url) return '';
  if (!url.includes('drive.google.com')) return url;

  let id = '';
  // Patterns: 
  // 1. /file/d/ID/view
  // 2. id=ID
  const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) {
    id = match1[1];
  } else {
    const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match2) id = match2[1];
  }

  if (id) {
    return `https://drive.google.com/file/d/${id}/preview`;
  }
  return url;
};
// --- AI Summary Helpers ---
export const injectSummaryMetadata = (text: string, c: Case): string => {
  if (!text) return '';
  let newText = text;
  const manager = c.managerName || localStorage.getItem('managerName') || '담당자 미정';

  // [Refined Logic] 
  // 1. Find existing '* 담당자 :' (with various spacing/asterisk) and fill it.
  const managerRegex = /^[*]?\s*담당자\s*:.*/m;

  if (managerRegex.test(newText)) {
    // Replace the line with filled data
    newText = newText.replace(managerRegex, `* 담당자 : ${manager}`);
  } else {
    // If missing, Prepend it (Safety fallback)
    newText = `* 담당자 : ${manager}\n` + newText;
  }

  // Name and Phone are assumed to be generated by AI as per user request.
  // We do NOT inject them if missing, to avoid duplication.

  return newText;
};

export const extractSummarySpecifics = (text: string): string => {
  if (!text) return '';

  // Patterns to look for "Special Notes" or "Specifics"
  // Common AI output formats: "4. 특이사항", "[특이사항]", "## 특이사항"
  const patterns = [
    /(?:4\.|\[|#+)\s*특이사항[:\s]*([\s\S]*)/i,
    /(?:5\.|\[|#+)\s*향후\s*계획[:\s]*([\s\S]*)/i, // Fallback to Future Plan if Special Notes missing? No, user specifically asked for "Specifics".
    /특이사항[:\s]*([\s\S]*)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return text;
};

// Helper for Safe Date Formatting (Prevents Crash on Invalid Date)
export const safeFormat = (date: Date | string | number | undefined | null, fmt: string, fallback: string = '-'): string => {
  if (!date) return fallback;
  try {
    const d = new Date(date);
    if (!isValid(d)) return fallback;
    return format(d, fmt);
  } catch (e) {
    console.warn("Date formatting error:", e);
    return fallback;
  }
};

// [NEW] Added for CaseDetailAssets.tsx
export const getAutoCollateralString = (c: Case): string => {
  const parts: string[] = [];
  let total = 0;

  if (c.housingType !== '자가' && c.housingType !== '무상거주' && c.depositLoanAmount) {
    parts.push(`보증금 대출(${formatKoreanMoney(c.depositLoanAmount)})`);
    total += c.depositLoanAmount;
  }
  if (c.housingType === '자가' && c.ownHouseLoan) {
    parts.push(`집 담보 대출(${formatKoreanMoney(c.ownHouseLoan)})`);
    total += c.ownHouseLoan;
  }
  if (c.assets) {
    c.assets.filter(a => a.loanAmount > 0).forEach(a => {
      parts.push(`${a.type} 담보(${formatKoreanMoney(a.loanAmount)})`);
      total += a.loanAmount;
    });
  }

  if (parts.length === 0) return '없음';
  return `${parts.join(', ')} (총 ${formatKoreanMoney(total)})`;
};

// [NEW] Added for CaseDetailAiSummary.tsx
// [Restored] Gemini AI Integration
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DEFAULT_AI_PROMPT, REHABILITATION_DOMAIN_KEYWORDS } from "./constants";

// [Improved] AI Context Interface
interface AIContext {
  customerName?: string;
  phone?: string;
  managerName?: string;
}

export interface TranscriptLine {
  id: string;
  time: string; // "01:23"
  seconds: number; // 83
  speaker: string; // "상담원" | "고객" | string
  text: string;
}

/**
 * AI 요약 결과 문자열에서 요약문과 화자별 타임스탬프 대화록을 분리 파싱
 */
export const parseAiTranscript = (rawText: string | null | undefined): {
  summaryText: string;
  transcriptLines: TranscriptLine[];
  rawTranscript: string;
} => {
  if (!rawText || typeof rawText !== 'string') {
    return { summaryText: '', transcriptLines: [], rawTranscript: '' };
  }

  // Look for separator like "[전체 대화록]" or "[녹취록]" or "[대화록]"
  const splitMatch = rawText.match(/(?:^|\n)(?:\[(?:전체\s*)?(?:대화록|녹취록|전사본)\]|={3,}\s*(?:전체\s*)?(?:대화록|녹취록)\s*={3,})([\s\S]*)$/i);

  let summaryText = rawText;
  let rawTranscript = '';

  if (splitMatch && splitMatch.index !== undefined) {
    summaryText = rawText.slice(0, splitMatch.index).trim();
    rawTranscript = splitMatch[1].trim();
  } else if (rawText.includes('[00:') || rawText.includes('[01:')) {
    // If no explicit header but contains timestamp lines
    const firstTimestampIdx = rawText.search(/(?:^|\n)\[\d{1,2}:\d{2}\]/);
    if (firstTimestampIdx > -1) {
      summaryText = rawText.slice(0, firstTimestampIdx).trim();
      rawTranscript = rawText.slice(firstTimestampIdx).trim();
    }
  }

  const lines = rawTranscript.split('\n');
  const transcriptLines: TranscriptLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Pattern: [01:23] 상담원: 내용 or [01:23] [상담원] 내용 or [01:23] 상담원 - 내용
    const match = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(?:\[?([^:\]\-]+)\]?[:\-])?\s*(.*)$/);
    if (match && match[1]) {
      const timeStr = match[1];
      const speakerStr = (match[2] || '화자').trim();
      const content = (match[3] || '').trim();

      // calculate seconds
      const parts = timeStr.split(':').map(Number);
      let sec = 0;
      if (parts.length === 2) {
        sec = (parts[0] || 0) * 60 + (parts[1] || 0);
      } else if (parts.length === 3) {
        sec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
      }

      transcriptLines.push({
        id: `t-${i}-${sec}`,
        time: timeStr,
        seconds: sec,
        speaker: speakerStr,
        text: content || line
      });
    } else if (transcriptLines.length > 0) {
      // Continuation of previous line
      transcriptLines[transcriptLines.length - 1].text += ' ' + line;
    }
  }

  return {
    summaryText: summaryText || rawText,
    transcriptLines,
    rawTranscript
  };
};

/**
 * 도메인 전문 용어 사전 로드 (사용자 설정값 우선, 없으면 기본값)
 */
export const getDomainKeywords = (): string[] => {
  try {
    const custom = localStorage.getItem('lm_aiKeywords');
    if (custom && custom.trim().length > 0) {
      const parsed = custom.split(',').map(s => s.trim()).filter(Boolean);
      if (parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Failed to load custom AI keywords", e);
  }
  return REHABILITATION_DOMAIN_KEYWORDS;
};

export const generateAiSummary = async (file: File, customPrompt?: string, context?: AIContext): Promise<string> => {
  const lsKey = localStorage.getItem('lm_geminiApiKey');
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  const apiKey = lsKey || envKey || "";

  if (!apiKey || apiKey.trim() === '') {
    console.warn("Gemini API Key missing! Fallback to Mock.");
    const debugInfo = `오류 진단 정보:\n- 저장된 키(User): ${lsKey === null ? '없음(Null)' : (lsKey === '' ? '빈값' : `있음(${lsKey.length}자)`)}\n- 기본 키(Env): ${!envKey ? '없음' : `있음(${envKey.length}자)`}`;

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`[데모 모드] API 키가 확인되지 않습니다.\n\n${debugInfo}\n\n설정 페이지의 [AI 설정]에서 '등록된 키가 없습니다' 문구가 뜨는지 확인해주세요.\n[자동 생성 예시] 내용 없음`);
      }, 1000);
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // [Modern Model List - 3.5 Generation]
    const VALID_MODELS = ['gemini-3.5-transcribe', 'gemini-3.5-flash', 'gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview', 'gemini-2.5-flash'];
    const FALLBACK_MODEL = 'gemini-3.5-flash';
    let selectedModel = localStorage.getItem('lm_geminiModel') || FALLBACK_MODEL;
    
    if (!VALID_MODELS.includes(selectedModel)) {
      console.warn(`[AI] Invalid or retired model "${selectedModel}" found, migrating to "${FALLBACK_MODEL}"`);
      selectedModel = FALLBACK_MODEL;
      localStorage.setItem('lm_geminiModel', FALLBACK_MODEL);
    }

    // Convert file to compatible format (Base64)
    const base64Data = await fileToBase64(file);

    const userSummaryPrompt = customPrompt && customPrompt.trim().length > 0 ? customPrompt : DEFAULT_AI_PROMPT;

    // [Domain Vocabulary Biasing & Instruction Injection]
    const domainKeywordsList = getDomainKeywords();
    const domainKeywordsStr = domainKeywordsList.join(', ');

    let fullPrompt = `당신은 법률 사무소(개인회생/파산/신용회복) 전문 상담 보조 AI입니다.
업로드된 음성 파일을 분석하여 [1. 상담 요약]과 [2. 전체 대화록]을 순서대로 작성하세요.

[도메인 전문 용어 사전 (인식 정확도 보정)]
${domainKeywordsStr}

${context ? `[고객 및 담당자 기본 정보]
- 고객이름: ${context.customerName || '알 수 없음'}
- 연락처: ${context.phone || '알 수 없음'}
- 담당자: ${context.managerName || '알 수 없음'}
` : ''}

[1. 상담 요약 작성 규칙 - 사용자 지정 지침]
${userSummaryPrompt}

[2. 전체 대화록(녹취록) 작성 규칙]
상담 요약 작성이 끝나면, 반드시 구분선 뒤에 화자(상담원, 고객)를 분리하고 대략적인 타임스탬프([MM:SS])를 붙여 전체 대화를 전사하세요.
형식 예시:
[전체 대화록]
[00:02] 상담원: 안녕하세요 OOO 법률사무소입니다.
[00:06] 고객: 네 개인회생 비용 문의 좀 드리려고 하는데요.
[00:15] 상담원: 네 고객님 현재 총 채무 금액과 소득이 어떻게 되시나요?
...`;

    const contentPayload = [
      fullPrompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type || "audio/mp3",
        },
      },
    ];

    // Try with selected model
    try {
      const model = genAI.getGenerativeModel({ model: selectedModel });
      const result = await model.generateContent(contentPayload);
      const response = await result.response;
      return response.text();
    } catch (firstError: any) {
      const firstMsg = firstError?.message || '';
      
      // [Auto-Fallback] If 404/not found or 503, retry with fallback model
      if ((firstMsg.includes('404') || firstMsg.includes('not found') || firstMsg.includes('503')) && selectedModel !== FALLBACK_MODEL) {
        console.warn(`[AI] Model "${selectedModel}" failed (${firstMsg}), retrying with fallback "${FALLBACK_MODEL}"...`);
        localStorage.setItem('lm_geminiModel', FALLBACK_MODEL);
        
        const fallbackModel = genAI.getGenerativeModel({ model: FALLBACK_MODEL });
        const result = await fallbackModel.generateContent(contentPayload);
        const response = await result.response;
        return `[모델 자동 전환: ${selectedModel} → ${FALLBACK_MODEL}]\n\n` + response.text();
      }
      throw firstError;
    }
  } catch (error) {
    console.error("Gemini AI Error:", error);
    let errorMsg = error instanceof Error ? error.message : "알 수 없는 오류";

    // [Smart Diagnostics] If 404/Not Found, try to fetch available models
    if (errorMsg.includes("404") || errorMsg.includes("not found")) {
      try {
        const listReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const listData = await listReq.json();
        if (listData.models) {
          const modelNames = listData.models.map((m: any) => m.name.replace('models/', '')).join(', ');
          errorMsg += `\n\n[진단 - 사용 가능한 모델 목록]\n${modelNames}`;
        }
      } catch (e) {
        errorMsg += `\n\n[진단] 모델 목록 조회 실패: ${e}`;
      }
    }

    return `[오류 발생] AI 분석 중 문제가 발생했습니다.\n사유: ${errorMsg}`;
  }
};

// ============================================
// [NEW] 고객 상황 및 채무 종합 브리핑 파서
// ============================================

export interface CustomerBriefingData {
  customerName: string;
  phone: string;
  birthYear: string;
  gender: string;
  region: string;
  job: string;
  insurance4: string;
  maritalStatus: string;
  childrenCount: string;
  income: string;
  loanMonthlyPay: string;
  housingType: string;
  depositRent: string;
  assets: string;
  creditLoan: string;
  collateralLoan: string;
  creditCardUse: string;
  history: string;
  specialMemo: string;
  isAiSource: boolean;
}

/**
 * AI 요약문 텍스트(우선) 또는 Case 객체(폴백)에서 18개 종합 브리핑 항목 추출
 */
export const extractBriefingFromSummary = (aiText: string | null | undefined, c: Case): CustomerBriefingData => {
  const text = (aiText || c.aiSummary || '').trim();

  // Helper: Extract field from text by regex patterns
  const extractField = (patterns: RegExp[]): string | null => {
    if (!text) return null;
    for (const p of patterns) {
      const match = text.match(p);
      if (match && match[1] && match[1].trim() !== '') {
        return match[1].trim();
      }
    }
    return null;
  };

  const aiName = extractField([/(?:^|\n)[*•\-]?\s*(?:고객이름|고객명|이름)\s*[:：]\s*([^\n\r]+)/i]);
  const aiPhone = extractField([/(?:^|\n)[*•\-]?\s*(?:연락처|전화번호|휴대폰)\s*[:：]\s*([^\n\r]+)/i]);
  const aiBirth = extractField([/(?:^|\n)[*•\-]?\s*(?:출생년도|생년월일|출생|나이)\s*[:：]\s*([^\n\r]+)/i]);
  const aiGender = extractField([/(?:^|\n)[*•\-]?\s*(?:성별)\s*[:：]\s*([^\n\r]+)/i]);
  const aiRegion = extractField([/(?:^|\n)[*•\-]?\s*(?:거주지역|지역)\s*[:：]\s*([^\n\r]+)/i]);
  const aiJob = extractField([/(?:^|\n)[*•\-]?\s*(?:직업|직업\s*형태)\s*[:：]\s*([^\n\r]+)/i]);
  const aiInsurance = extractField([/(?:^|\n)[*•\-]?\s*(?:4대보험\s*가입유무|4대보험|사대보험)\s*[:：]\s*([^\n\r]+)/i]);
  const aiMarital = extractField([/(?:^|\n)[*•\-]?\s*(?:결혼유무|혼인여부|결혼)\s*[:：]\s*([^\n\r]+)/i]);
  const aiChildren = extractField([/(?:^|\n)[*•\-]?\s*(?:미성년\s*자녀\s*수|미성년\s*자녀|자녀\s*수|자녀)\s*[:：]\s*([^\n\r]+)/i]);
  const aiIncome = extractField([/(?:^|\n)[*•\-]?\s*(?:월\s*세후소득\s*\(실급여\)|월\s*세후소득|실급여|월소득|소득)\s*[:：]\s*([^\n\r]+)/i]);
  const aiLoanPay = extractField([/(?:^|\n)[*•\-]?\s*(?:월\s*대출납입금|월\s*납입금|대출납입금)\s*[:：]\s*([^\n\r]+)/i]);
  const aiHousing = extractField([/(?:^|\n)[*•\-]?\s*(?:거주\s*형태|거주형태)\s*[:：]\s*([^\n\r]+)/i]);
  const aiDepositRent = extractField([/(?:^|\n)[*•\-]?\s*(?:보증금[,\s/]*월세|보증금\s*및\s*월세|보증금)\s*[:：]\s*([^\n\r]+)/i]);
  const aiAssets = extractField([/(?:^|\n)[*•\-]?\s*(?:자산|보유자산)\s*[:：]\s*([^\n\r]+)/i]);
  const aiCreditLoan = extractField([/(?:^|\n)[*•\-]?\s*(?:신용\s*대출|신용대출)\s*[:：]\s*([^\n\r]+)/i]);
  const aiCollateral = extractField([/(?:^|\n)[*•\-]?\s*(?:담보\s*대출(?:\s*\(.*?\))?|담보대출)\s*[:：]\s*([^\n\r]+)/i]);
  const aiCard = extractField([/(?:^|\n)[*•\-]?\s*(?:신용카드\s*사용유무|신용카드|카드사용)\s*[:：]\s*([^\n\r]+)/i]);
  const aiHistory = extractField([/(?:^|\n)[*•\-]?\s*(?:개인회생\s*[/／]\s*파산\s*[/／]\s*회복\s*이력|회생\s*[/／]\s*파산\s*이력|과거\s*이력|회생이력)\s*[:：]\s*([^\n\r]+)/i]);
  
  // Special memo pattern: multiline until next asterisk bullet or end
  let aiMemo: string | null = null;
  const memoMatch = text.match(/(?:^|\n)[*•\-]?\s*특이사항\s*[:：]\s*([\s\S]*?)(?=(?:\n[*•\-]\s*[^:\n]+[:：])|$)/i);
  if (memoMatch && memoMatch[1] && memoMatch[1].trim() !== '') {
    aiMemo = memoMatch[1].trim();
  }

  // Determine if source is primarily AI summary
  const matchedCount = [
    aiName, aiPhone, aiBirth, aiGender, aiRegion, aiJob, aiInsurance,
    aiMarital, aiIncome, aiLoanPay, aiHousing, aiDepositRent, aiAssets, aiCreditLoan
  ].filter(Boolean).length;

  const isAiSource = matchedCount >= 3;

  // Fallback generation from Case object
  const crmBirth = c.birth ? `${normalizeBirthYear(c.birth)}년생` : '정보 없음';
  const crmJob = c.jobTypes && c.jobTypes.length > 0 ? c.jobTypes.join(', ') : '정보 없음';
  const crmChildren = c.childrenCount !== undefined && c.childrenCount !== null ? `${c.childrenCount}명` : '없음';
  const crmIncome = c.incomeNet ? formatKoreanMoney(c.incomeNet) : '정보 없음';
  const crmLoanPay = c.loanMonthlyPay ? formatKoreanMoney(c.loanMonthlyPay) : '정보 없음';
  
  let crmDepositRent = '정보 없음';
  if (c.housingType === '월세') {
    crmDepositRent = `보증금 ${formatKoreanMoney(c.deposit)}, 월세 ${formatKoreanMoney(c.rent)}`;
  } else if (c.housingType === '전세') {
    crmDepositRent = `전세 보증금 ${formatKoreanMoney(c.deposit)}`;
  } else if (c.housingType === '자가') {
    crmDepositRent = `집 시세 ${formatKoreanMoney(c.ownHousePrice || 0)}`;
  } else if (c.housingType === '무상거주') {
    crmDepositRent = `무상거주`;
  }

  const crmAssets = c.assets && c.assets.length > 0
    ? c.assets.map(a => `${a.owner ? `[${a.owner}] ` : ''}${a.type}(시세 ${formatKoreanMoney(a.amount)})`).join(', ')
    : '없음';

  const crmCreditLoan = c.creditLoan && c.creditLoan.length > 0
    ? c.creditLoan.map(l => `${l.desc || '대출'}(${formatKoreanMoney(l.amount)})`).join(', ')
    : '없음';

  const crmCollateral = getAutoCollateralString(c) || '없음';
  const crmHistory = [c.historyType, c.historyMemo].filter(Boolean).join(' ') || '없음';

  const crmMemo = c.specialMemo && c.specialMemo.length > 0
    ? c.specialMemo.map(m => m.content).join('\n')
    : '';

  return {
    customerName: aiName || c.customerName || '미등록',
    phone: aiPhone || c.phone || '미등록',
    birthYear: aiBirth || crmBirth,
    gender: aiGender || c.gender || '정보 없음',
    region: aiRegion || c.region || '정보 없음',
    job: aiJob || crmJob,
    insurance4: aiInsurance || c.insurance4 || '정보 없음',
    maritalStatus: aiMarital || c.maritalStatus || '정보 없음',
    childrenCount: aiChildren || crmChildren,
    income: aiIncome || crmIncome,
    loanMonthlyPay: aiLoanPay || crmLoanPay,
    housingType: aiHousing || c.housingType || '정보 없음',
    depositRent: aiDepositRent || crmDepositRent,
    assets: aiAssets || crmAssets,
    creditLoan: aiCreditLoan || crmCreditLoan,
    collateralLoan: aiCollateral || crmCollateral,
    creditCardUse: aiCard || c.creditCardUse || '정보 없음',
    history: aiHistory || crmHistory,
    specialMemo: aiMemo || crmMemo || '',
    isAiSource
  };
};


