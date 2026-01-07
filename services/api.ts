
import { Case, CommissionRule, CaseStatusLog, CaseStatus, SettlementConfig, Partner, MemoItem, RecordingItem } from '../types';
import { MOCK_CASES, MOCK_LOGS, MOCK_INBOUND_PATHS, MOCK_PARTNERS } from './mockData';
import { DEFAULT_STATUS_LIST } from '../constants';
import { v4 as uuidv4 } from 'uuid';

// --- CONFIGURATION ---
// Replace this with the user's deployed Web App URL
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyv68G12Kd0g8RThZGpXToV2m_PjN7IsaBXwzDkPvA1TqsgFTIjQFuuC0G0_Xitsxm8/exec";

// --- LOCAL CACHE & STATE MANAGEMENT ---
let localCases: Case[] = [];
let localPartners: Partner[] = [];
let localLogs: CaseStatusLog[] = [...MOCK_LOGS];
let localInboundPaths: string[] = [];
let localStatuses: CaseStatus[] = [];
let localAllowedEmails: string[] = ['9981mark@gmail.com', '2882a@naver.com']; // Default
let isInitialized = false;

// Event Listeners for Real-time Updates
const listeners: Set<() => void> = new Set();

export const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

const notifyListeners = () => {
  listeners.forEach(cb => cb());
};

// LocalStorage Helpers
const CACHE_KEYS = {
  PARTNERS: 'lm_partners',
  CASES: 'lm_cases',
  PATHS: 'lm_paths',
  STATUSES: 'lm_statuses',
  EMAILS: 'lm_allowed_emails',
  LOGS: 'lm_logs'
};

const loadFromStorage = () => {
  try {
    const storedPartners = localStorage.getItem(CACHE_KEYS.PARTNERS);
    const storedCases = localStorage.getItem(CACHE_KEYS.CASES);
    const storedPaths = localStorage.getItem(CACHE_KEYS.PATHS);
    const storedStatuses = localStorage.getItem(CACHE_KEYS.STATUSES);
    const storedEmails = localStorage.getItem(CACHE_KEYS.EMAILS);
    const storedLogs = localStorage.getItem(CACHE_KEYS.LOGS);

    if (storedPartners) localPartners = JSON.parse(storedPartners);
    if (storedCases) localCases = JSON.parse(storedCases);
    if (storedPaths) localInboundPaths = JSON.parse(storedPaths);
    if (storedStatuses) localStatuses = JSON.parse(storedStatuses);
    if (storedEmails) localAllowedEmails = JSON.parse(storedEmails);
  } catch (e) {
    console.error("Failed to load from cache", e);
  }
};

const saveToStorage = () => {
  try {
    localStorage.setItem(CACHE_KEYS.PARTNERS, JSON.stringify(localPartners));
    localStorage.setItem(CACHE_KEYS.CASES, JSON.stringify(localCases));
    localStorage.setItem(CACHE_KEYS.PATHS, JSON.stringify(localInboundPaths));
    localStorage.setItem(CACHE_KEYS.STATUSES, JSON.stringify(localStatuses));
    localStorage.setItem(CACHE_KEYS.EMAILS, JSON.stringify(localAllowedEmails));
    // localStorage.setItem(CACHE_KEYS.LOGS, JSON.stringify(localLogs)); // Deprecated: Logs are inside Case
  } catch (e) {
    console.error("Failed to save to cache", e);
  }
};


// --- READ/SEEN MANAGEMENT (Server Side) ---
export const markCaseAsSeen = async (caseId: string) => {
  if (!caseId) return;
  const c = localCases.find(x => x.caseId === caseId);
  if (c && !c.isViewed) {
    // Optimistic Update
    c.isViewed = true;
    c.isNew = false;

    // Sync to Server
    // We update just this field. Note: In a real DB we would patch. 
    // Here we use updateCase which sends the full object, which is fine.
    await updateCase(caseId, { isViewed: true });
    notifyListeners();
  }
};

export const isCaseSeen = (caseId: string): boolean => {
  // Deprecated usage, but kept for compatibility if needed.
  // Now we rely on case.isViewed directly.
  const c = localCases.find(x => x.caseId === caseId);
  return c ? !!c.isViewed : false;
};

// ------------------------------------------------------------------
// DATA SYNC CORE
// ------------------------------------------------------------------

// POST Helper (Fire & Forget, No-CORS)
const syncToSheet = async (payload: any) => {
  if (!GOOGLE_SCRIPT_URL) return;
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Sync Failed:", error);
  }
};

// GET Helper
const fetchFromSheet = async (target: 'leads' | 'settings') => {
  if (!GOOGLE_SCRIPT_URL) return null;
  const apiType = target;
  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?type=${apiType}&_t=${Date.now()}`);
    if (!response.ok) throw new Error('Network error');
    return await response.json();
  } catch (error) {
    console.error(`Fetch ${target} failed:`, error);
    return null;
  }
};

// [NEW] Helper to Auto-Sync Inbound Paths
const syncInboundPaths = async (cases: Case[]) => {
  if (!cases || cases.length === 0) return;
  const pathsData = new Set<string>();
  cases.forEach(c => {
    if (c.inboundPath) pathsData.add(c.inboundPath.trim());
  });
  const newPaths: string[] = [];
  pathsData.forEach(p => {
    if (p && !localInboundPaths.includes(p)) {
      newPaths.push(p);
    }
  });
  if (newPaths.length > 0) {
    console.log("Found new inbound paths, syncing...", newPaths);
    const updatedPaths = [...localInboundPaths, ...newPaths].sort();
    localInboundPaths = updatedPaths;
    localStorage.setItem(CACHE_KEYS.PATHS, JSON.stringify(localInboundPaths)); // Save immediately
    await syncToSheet({
      target: 'settings',
      key: 'inboundPaths',
      value: updatedPaths
    });
    notifyListeners();
  }
};

// Initial Data Load (SWR Pattern)
export const initializeData = async () => {
  // 1. Load from Cache FIRST (Instant)
  loadFromStorage();

  // 2. Mark initialized immediately so app can boot
  isInitialized = true;

  // 3. Trigger Background Fetch (Revalidate)
  // We don't await this, ensuring the UI renders immediately with cached data
  performBackgroundFetch();
};

export const refreshData = async () => {
  return performBackgroundFetch();
}

const performBackgroundFetch = async () => {
  try {
    // Parallel Fetch
    const [settingsData, casesData] = await Promise.all([
      fetchFromSheet('settings'),
      fetchFromSheet('leads')
    ]);

    // 1. Process Settings
    if (settingsData) {
      if (settingsData.partners) localPartners = settingsData.partners;
      else if (localPartners.length === 0) localPartners = [...MOCK_PARTNERS]; // Fallback only if empty

      if (settingsData.inboundPaths) localInboundPaths = settingsData.inboundPaths;
      else if (localInboundPaths.length === 0) localInboundPaths = [...MOCK_INBOUND_PATHS];

      if (settingsData.statuses) localStatuses = settingsData.statuses;
      else if (localStatuses.length === 0) localStatuses = [...DEFAULT_STATUS_LIST];

      if (settingsData.allowedEmails) localAllowedEmails = settingsData.allowedEmails;

      if (settingsData.managerName) localStorage.setItem('managerName', settingsData.managerName);
    }

    // 2. Process Cases
    if (casesData && Array.isArray(casesData)) {
      localCases = casesData.map(processIncomingCase);
      syncInboundPaths(localCases);
    } else if (localCases.length === 0) {
      localCases = [...MOCK_CASES];
    }

    // 3. Save to Cache & Notify UI
    saveToStorage();
    notifyListeners();
    console.log("Data revalidated and UI notified.");

  } catch (error) {
    console.error("Background fetch failed", error);
    // If cache was empty, maybe load mocks? 
    // But loadFromStorage should have handled it or left it empty.
    // We leave it as is to avoid overwriting cache with mocks on offline error.
  }
};

// Helper: Ensure imported data types are correct
export const processIncomingCase = (c: any): Case => {
  // Ensure arrays/objects are parsed if they came as strings (double safety)
  if (typeof c.jobTypes === 'string') c.jobTypes = [c.jobTypes];

  // Map Backend Keys (Sheet Headers: TitleCase) to Frontend Keys (React: camelCase)
  const mappedCase: any = {
    ...c,
    // [ID & System]
    caseId: c.caseId || c.CaseID || c.id || uuidv4(),
    updatedAt: c.updatedAt || c.UpdatedAt || c.statusUpdatedAt || new Date().toISOString(),
    createdAt: c.createdAt || c.CreatedAt || c.Timestamp || new Date().toISOString(),
    status: c.status || c.Status || '신규접수',
    managerName: c.managerName || c.ManagerName || '진성훈', // Default from screenshot context
    partnerId: c.partnerId || c.PartnerId || 'P001',       // Default from screenshot context
    // [Status Logic]
    // [Status Logic]
    // [Status Logic]
    isViewed: !!(c.isViewed || c.IsViewed || c.is_viewed), // Map from server/sheet
    // isNew now depends on status and the server-synced isViewed flag
    isNew: (c.status || c.Status || '신규접수') === '신규접수' && !(c.isViewed || c.IsViewed || c.is_viewed),

    // [Personal]
    customerName: c.customerName || c.CustomerName || c.Name || c['이름'] || 'Unknown',
    phone: c.phone || c.Phone || c['전화번호'] || '',
    birth: c.birth || c.Birth || '',
    gender: c.gender || c.Gender || '남',
    region: c.region || c.Region || '',

    // [Case Info]
    caseType: c.caseType || c.CaseType || '개인회생',
    inboundPath: c.inboundPath || c.InboundPath || c.inbound_path || c['Landing ID'] || 'Landing Page',
    historyType: c.historyType || c.HistoryType || '없음',
    preInfo: c.preInfo || c.PreInfo || '',

    // [Job & Income]
    jobTypes: typeof c.jobTypes === 'string' ? [c.jobTypes] : (c.JobTypes || c.jobTypes || []),
    incomeNet: Number(c.incomeNet || c.IncomeNet) || 0,

    // [Housing]
    housingType: c.housingType || c.HousingType || '월세',
    housingDetail: c.housingDetail || c.HousingDetail || '기타',
    deposit: Number(c.deposit || c.Deposit) || 0,
    rent: Number(c.rent || c.Rent) || 0,

    // [Assets & Loans]
    ownHousePrice: Number(c.ownHousePrice || c.OwnHousePrice) || 0,
    ownHouseLoan: Number(c.ownHouseLoan || c.OwnHouseLoan) || 0,
    childrenCount: Number(c.childrenCount || c.ChildrenCount) || 0,

    // DEBUG: Attach Raw Data
    _raw: c
  };

  return {
    ...mappedCase,
    assets: mappedCase.assets || [],
    creditLoan: mappedCase.creditLoan || [],
    specialMemo: mappedCase.specialMemo || [],
    reminders: mappedCase.reminders || [],
    recordings: mappedCase.recordings || [],
    incomeDetails: mappedCase.incomeDetails || {},
    depositHistory: mappedCase.depositHistory || [],
    statusLogs: mappedCase.statusLogs || [], // [NEW] Map Status Logs
    // Number safety for remaining fields
    loanMonthlyPay: Number(mappedCase.loanMonthlyPay || c.LoanMonthlyPay) || 0,
    contractFee: Number(mappedCase.contractFee || c.ContractFee) || 0,
  };
};


// ------------------------------------------------------------------
// API EXPORTS
// ------------------------------------------------------------------

// --- Statuses ---
export const fetchStatuses = async (): Promise<CaseStatus[]> => {
  if (!isInitialized) await initializeData();
  return [...localStatuses];
};

export const addStatus = async (status: string): Promise<CaseStatus[]> => {
  if (!localStatuses.includes(status)) {
    localStatuses.push(status);
    syncToSheet({ target: 'settings', action: 'update', key: 'statuses', value: localStatuses });
  }
  return [...localStatuses];
};

export const deleteStatus = async (status: string, migrateTo?: string): Promise<CaseStatus[]> => {
  if (migrateTo) {
    localCases = localCases.map(c => {
      if (c.status === status) {
        const updated = { ...c, status: migrateTo, updatedAt: new Date().toISOString() };
        updateCase(c.caseId, { status: migrateTo });
        return updated;
      }
      return c;
    });
  }
  localStatuses = localStatuses.filter(s => s !== status);
  syncToSheet({ target: 'settings', action: 'update', key: 'statuses', value: localStatuses });
  return [...localStatuses];
};

export const updateStatusOrder = async (newOrder: CaseStatus[]): Promise<CaseStatus[]> => {
  localStatuses = newOrder;
  syncToSheet({ target: 'settings', action: 'update', key: 'statuses', value: localStatuses });
  return [...localStatuses];
}


// --- Inbound Paths ---
export const fetchInboundPaths = async (): Promise<string[]> => {
  if (!isInitialized) await initializeData();
  return [...localInboundPaths];
};

export const addInboundPath = async (path: string): Promise<string[]> => {
  if (!localInboundPaths.includes(path)) {
    localInboundPaths.push(path);
    syncToSheet({ target: 'settings', action: 'update', key: 'inboundPaths', value: localInboundPaths });
  }
  return [...localInboundPaths];
};

export const deleteInboundPath = async (path: string, migrateTo?: string): Promise<string[]> => {
  if (migrateTo) {
    localCases = localCases.map(c => {
      if (c.inboundPath === path) {
        updateCase(c.caseId, { inboundPath: migrateTo });
        return { ...c, inboundPath: migrateTo, updatedAt: new Date().toISOString() };
      }
      return c;
    });
  }
  localInboundPaths = localInboundPaths.filter(p => p !== path);
  syncToSheet({ target: 'settings', action: 'update', key: 'inboundPaths', value: localInboundPaths });
  return [...localInboundPaths];
};


// --- Allowed Emails ---
export const fetchAllowedEmails = async (): Promise<string[]> => {
  if (!isInitialized) await initializeData();
  return [...localAllowedEmails];
};

export const addAllowedEmail = async (email: string): Promise<string[]> => {
  if (!localAllowedEmails.includes(email)) {
    localAllowedEmails.push(email);
    syncToSheet({ target: 'settings', action: 'update', key: 'allowedEmails', value: localAllowedEmails });
  }
  return [...localAllowedEmails];
};

export const removeAllowedEmail = async (email: string): Promise<string[]> => {
  localAllowedEmails = localAllowedEmails.filter(e => e !== email);
  syncToSheet({ target: 'settings', action: 'update', key: 'allowedEmails', value: localAllowedEmails });
  return [...localAllowedEmails];
};


// --- Partners ---
export const fetchPartners = async (): Promise<Partner[]> => {
  if (!isInitialized) await initializeData();
  return [...localPartners];
};

export const savePartner = async (partner: Partner): Promise<Partner[]> => {
  const idx = localPartners.findIndex(p => p.partnerId === partner.partnerId);
  if (idx > -1) localPartners[idx] = partner;
  else localPartners.push(partner);

  syncToSheet({ target: 'settings', action: 'update', key: 'partners', value: localPartners });
  return [...localPartners];
};

export const deletePartner = async (partnerId: string): Promise<Partner[]> => {
  localPartners = localPartners.filter(p => p.partnerId !== partnerId);
  syncToSheet({ target: 'settings', action: 'update', key: 'partners', value: localPartners });
  return [...localPartners];
};


// --- Cases ---
export const fetchCases = async (): Promise<Case[]> => {
  if (!isInitialized) await initializeData();
  return [...localCases];
};

// Helper to create a new case object locally
export const createCaseHelper = (newCase: Partial<Case>): Case => {
  const managerName = localStorage.getItem('managerName') || 'Mark';
  const now = new Date().toISOString();

  // Get Summary Template from Partner to generate "CopySummary"
  // Note: We can't generate the full summary here easily because we need the Full Case Object first. 
  // We will generate it just before saving.

  return {
    ...newCase,
    caseId: uuidv4().slice(0, 8),
    createdAt: now,
    updatedAt: now,
    status: '신규접수',
    statusUpdatedAt: now,
    managerName: managerName,
    partnerId: newCase.partnerId || (localPartners[0]?.partnerId || ''),
    insurance4: newCase.insurance4 || '미가입',
    maritalStatus: newCase.maritalStatus || '미혼',
    childrenCount: newCase.childrenCount || 0,
    gender: newCase.gender || '남',
    housingType: newCase.housingType || '월세',
    housingDetail: newCase.housingDetail || '기타',
    caseType: newCase.caseType || '개인회생',
    inboundPath: newCase.inboundPath || '',
    preInfo: newCase.preInfo || '',
    historyType: newCase.historyType || '없음',
    assets: newCase.assets || [],
    specialMemo: newCase.specialMemo || [],
    recordings: [],
    reminders: [],
    depositHistory: [],
    incomeDetails: newCase.incomeDetails || {},
    incomeNet: newCase.incomeNet || 0,
    loanMonthlyPay: newCase.loanMonthlyPay || 0,
    deposit: newCase.deposit || 0,
    rent: newCase.rent || 0
  } as Case;
};

export const createCase = async (newCase: Partial<Case>): Promise<Case> => {
  const c = createCaseHelper(newCase);
  localCases.unshift(c); // Optimistic UI

  // Sync to Sheet
  // Note: We rely on the Sheet Script's "parseJSON" logic, so we can send the object as is.
  // Exception: We need to generate 'formattedSummary' if we want it in column AS.
  // We'll import the generator helper.
  const { generateSummary } = await import('../utils');
  const partner = localPartners.find(p => p.partnerId === c.partnerId);
  const formattedSummary = generateSummary(c, partner?.summaryTemplate);

  const payload = {
    ...c,
    formattedSummary // Add this extra field
  };

  syncToSheet({ target: 'leads', action: 'create', data: payload });

  return c;
};

export const updateCase = async (caseId: string, updates: Partial<Case>): Promise<Case> => {
  const idx = localCases.findIndex(c => c.caseId === caseId);
  if (idx === -1) throw new Error('Case not found');

  const updated = {
    ...localCases[idx],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  localCases[idx] = updated;

  // Sync
  const { generateSummary } = await import('../utils');
  const partner = localPartners.find(p => p.partnerId === updated.partnerId);
  const formattedSummary = generateSummary(updated, partner?.summaryTemplate);

  const payload = {
    ...updated,
    formattedSummary // Add this extra field
  };

  syncToSheet({ target: 'leads', action: 'update', data: payload });

  return updated;
};

export const deleteCase = async (caseId: string): Promise<Case[]> => {
  localCases = localCases.filter(c => c.caseId !== caseId);
  syncToSheet({ target: 'leads', action: 'delete', data: { id: caseId } });
  return [...localCases];
};

// --- Sub-Item Manipulators (Memos, Status Logs, etc) ---

export const changeStatus = async (caseId: string, newStatus: CaseStatus, memo: string): Promise<Case> => {
  const now = new Date().toISOString();

  // We must fetch the latest case first to get the current status
  const currentCase = localCases.find(c => c.caseId === caseId);
  if (!currentCase) throw new Error("Case not found");

  const fromStatus = currentCase.status || '신규'; // Get current status for 'from'

  // We utilize 'specialMemo' to store status logs for robust syncing with Google Sheets
  // Format: [상태변경] From -> To | Memo
  const logContent = `[상태변경] ${fromStatus} -> ${newStatus}${memo ? ` | ${memo}` : ''}`;

  // Create new memo
  const newMemo: MemoItem = {
    id: uuidv4(),
    createdAt: now,
    content: logContent
  };

  const updatedMemos = [newMemo, ...(currentCase.specialMemo || [])];

  const c = await updateCase(caseId, {
    status: newStatus,
    statusUpdatedAt: now,
    specialMemo: updatedMemos
  });

  return c;
};

export const addMemo = async (caseId: string, content: string): Promise<Case> => {
  const c = localCases.find(x => x.caseId === caseId);
  if (!c) throw new Error('Case not found');

  const newMemo: MemoItem = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    content
  };
  const updatedMemos = [newMemo, ...(c.specialMemo || [])];
  return updateCase(caseId, { specialMemo: updatedMemos });
};

export const deleteMemo = async (caseId: string, memoId: string): Promise<Case> => {
  const c = localCases.find(x => x.caseId === caseId);
  if (!c) throw new Error('Case not found');

  const updatedMemos = (c.specialMemo || []).filter(m => m.id !== memoId);
  return updateCase(caseId, { specialMemo: updatedMemos });
};

export const fetchCaseStatusLogs = async (caseId: string): Promise<CaseStatusLog[]> => {
  const c = localCases.find(x => x.caseId === caseId);
  if (!c) return [];

  // Parse logs from specialMemo
  const memoLogs: CaseStatusLog[] = (c.specialMemo || [])
    .filter(m => m.content.startsWith('[상태변경]'))
    .map(m => {
      // Format: [상태변경] From -> To | Memo
      const content = m.content.replace('[상태변경] ', '');
      const [statusPart, memoPart] = content.split(' | ');
      const [from, to] = statusPart.split(' -> ').map(s => s.trim());

      return {
        logId: m.id,
        caseId: c.caseId,
        changedAt: m.createdAt,
        changedBy: 'Mark',
        fromStatus: from,
        toStatus: to,
        memo: memoPart || ''
      };
    });

  // Merge with legacy localLogs (if any) or statusLogs (if any) to be safe, but preference is memo
  return memoLogs.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
};

// Backwards compatibility / Polling disabled for now to prevent spam
export const fetchNewLeads = async (): Promise<Case[]> => {
  return [];
};

export const batchCreateCases = async (cases: Partial<Case>[]): Promise<void> => {
  // 1. Create all objects in memory
  // Use a temporary list to hold new cases
  const newCases: Case[] = [];
  const { generateSummary } = await import('../utils');

  for (const c of cases) {
    const caseObj = createCaseHelper(c);
    newCases.push(caseObj);
  }

  // 2. Batch Update Local State (ONE TIME)
  // Prepend all new cases to localCases
  localCases.unshift(...newCases);

  // 3. Update Sync Dependencies (e.g. Inbound Paths)
  syncInboundPaths(newCases);

  // 4. Notify UI (ONE TIME)
  saveToStorage();
  notifyListeners();

  // 5. Background Sync to Sheet (Fire & Forget / Batched)
  // We'll map them to payloads and send them one by one or in chunks
  // Since our backend might not support bulk create, we just loop calls but DON'T await them for UI unblocking
  // However, too many concurrent requests might choke browsers. We'll verify if we can send them reasonably.
  // Ideally, we'd have a batch endpoint. For now, we'll execute them with a small delay or Promise.all if count is low.
  // Let's do a simple non-blocking loop with small delays to ensure reliability without freezing UI.

  const syncAll = async () => {
    for (const c of newCases) {
      const partner = localPartners.find(p => p.partnerId === c.partnerId);
      const formattedSummary = generateSummary(c, partner?.summaryTemplate);
      const payload = { ...c, formattedSummary };
      await syncToSheet({ target: 'leads', action: 'create', data: payload });
      // Small delay to be nice to Google Script
      await new Promise(r => setTimeout(r, 100));
    }
  };

  syncAll().catch(err => console.error("Batch sync failed", err));
};


// --- File Upload ---
export const uploadRecording = async (file: File): Promise<{ url: string, id: string }> => {
  const { fileToBase64 } = await import('../utils');
  const base64Data = await fileToBase64(file);

  // Send to GAS
  // Note: We use fetch explicitly here to await the response (unlike syncToSheet which is largely fire-and-forget)
  // However, since we are likely in a no-cors scenario for pure GET/POST triggers if not configured carefully.
  // Actually, for a file upload we need the RESPONSE url. 
  // Standard GAS Web App `doPost` returns JSON. We need to handle CORS.
  // Using 'no-cors' means we CANNOT read the response. 
  // To get a response, the backend must support CORS (return appropriate headers).
  // Assuming the user's GAS script handles CORS properly (options/headers).

  if (!GOOGLE_SCRIPT_URL) throw new Error("Backend URL missing");

  const response = await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    // We try simple POST first. If 'no-cors' is forced by browser, we can't get the generated URL.
    // Ideally GAS serves CORS headers.
    headers: { 'Content-Type': 'text/plain' }, // GAS prefers text/plain to avoid preflight issues sometimes, but application/json is standard.
    body: JSON.stringify({
      target: 'upload',
      filename: file.name,
      mimeType: file.type,
      data: base64Data
    })
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status === 'error') throw new Error(result.message);

  return {
    url: result.url,
    id: result.id
  };
};
