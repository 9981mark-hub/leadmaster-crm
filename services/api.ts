
import { Case, CommissionRule, CaseStatusLog, CaseStatus, SettlementConfig, Partner, MemoItem, RecordingItem } from '../types';
import { MOCK_CASES, MOCK_LOGS, MOCK_INBOUND_PATHS, MOCK_PARTNERS } from './mockData';
import { DEFAULT_STATUS_LIST } from '../constants';
import { v4 as uuidv4 } from 'uuid';

// --- CONFIGURATION ---
// Replace this with the user's deployed Web App URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwD5zk784sBuSLnpkRa9oL3YWB66-Ypu4rDnv_f3POOlLeomNiU8rImyXf8baPHtJITPg/exec";

// --- LOCAL CACHE (Optimistic UI) ---
let localCases: Case[] = [];
let localPartners: Partner[] = [];
let localLogs: CaseStatusLog[] = [...MOCK_LOGS]; // Logs are currently local-only in this version
let localInboundPaths: string[] = [];
let localStatuses: CaseStatus[] = [];
let isInitialized = false;

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

  // Map 'target' to Apps Script 'type'
  // 'leads' -> 'leads', 'settings' -> 'configs'
  const apiType = target === 'settings' ? 'configs' : target;

  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?type=${apiType}`);
    if (!response.ok) throw new Error('Network error');
    return await response.json();
  } catch (error) {
    console.error(`Fetch ${target} failed:`, error);
    return null;
  }
};

// Initial Data Load
export const initializeData = async () => {
  if (isInitialized) return;

  // 1. Fetch Settings
  const settingsData = await fetchFromSheet('settings');
  if (settingsData) {
    if (settingsData.partners) localPartners = settingsData.partners;
    else localPartners = [...MOCK_PARTNERS];

    if (settingsData.inboundPaths) localInboundPaths = settingsData.inboundPaths;
    else localInboundPaths = [...MOCK_INBOUND_PATHS];

    if (settingsData.statuses) localStatuses = settingsData.statuses;
    else localStatuses = [...DEFAULT_STATUS_LIST];

    if (settingsData.managerName) localStorage.setItem('managerName', settingsData.managerName);
  } else {
    console.warn("Using mock settings data (Fetch failed or empty)");
    localPartners = [...MOCK_PARTNERS];
    localInboundPaths = [...MOCK_INBOUND_PATHS];
    localStatuses = [...DEFAULT_STATUS_LIST];
  }

  // 2. Fetch Cases
  const casesData = await fetchFromSheet('leads');
  if (casesData && Array.isArray(casesData)) {
    localCases = casesData.map(processIncomingCase);
  } else {
    console.warn("Using mock case data (Fetch failed or empty)");
    localCases = [...MOCK_CASES];
  }

  isInitialized = true;
};

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
  isNew: c.isNew !== undefined ? c.isNew : true,

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

  // Log locally
  const log: CaseStatusLog = {
    logId: uuidv4(),
    caseId,
    changedAt: now,
    changedBy: 'Mark',
    fromStatus: '',
    toStatus: newStatus,
    memo
  };

  // Update Case
  const c = await updateCase(caseId, { status: newStatus, statusUpdatedAt: now });
  localLogs.push(log);

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
  return localLogs.filter(l => l.caseId === caseId).sort((a, b) => b.changedAt.localeCompare(a.changedAt));
};

// Backwards compatibility / Polling disabled for now to prevent spam
export const fetchNewLeads = async (): Promise<Case[]> => {
  return [];
};

export const batchCreateCases = async (cases: Partial<Case>[]): Promise<void> => {
  for (const c of cases) {
    await createCase(c);
  }
};

