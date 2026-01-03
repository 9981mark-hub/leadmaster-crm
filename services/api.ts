
import { Case, CommissionRule, CaseStatusLog, CaseStatus, SettlementConfig, Partner, MemoItem, RecordingItem } from '../types';
import { MOCK_CASES, MOCK_LOGS, MOCK_INBOUND_PATHS, MOCK_PARTNERS } from './mockData';
import { DEFAULT_STATUS_LIST } from '../constants'; // Import Default
import { v4 as uuidv4 } from 'uuid';

let localCases = [...MOCK_CASES];
let localPartners = [...MOCK_PARTNERS];
let localLogs = [...MOCK_LOGS];
let localInboundPaths = [...MOCK_INBOUND_PATHS];
let localStatuses = [...DEFAULT_STATUS_LIST]; // Initialize with default

// ------------------------------------------------------------------
// Status Management API
// ------------------------------------------------------------------

export const fetchStatuses = async (): Promise<CaseStatus[]> => {
  // Simulate API delay
  return new Promise(resolve => setTimeout(() => resolve([...localStatuses]), 200));
};

export const addStatus = async (status: string): Promise<CaseStatus[]> => {
  if (!localStatuses.includes(status)) {
    localStatuses.push(status);
  }
  return Promise.resolve([...localStatuses]);
};

export const deleteStatus = async (status: string, migrateTo?: string): Promise<CaseStatus[]> => {
  // 1. Check if status is in use
  const affectedCases = localCases.filter(c => c.status === status);

  // 2. If in use and no migration target provided, throw error (should be handled by UI)
  if (affectedCases.length > 0 && !migrateTo) {
    throw new Error(`STATUS_IN_USE:${affectedCases.length}`); // Custom error code
  }

  // 3. Migrate cases if target provided
  if (affectedCases.length > 0 && migrateTo) {
    localCases = localCases.map(c => {
      if (c.status === status) {
        return { ...c, status: migrateTo, updatedAt: new Date().toISOString() };
      }
      return c;
    });
  }

  // 4. Delete status
  localStatuses = localStatuses.filter(s => s !== status);
  return Promise.resolve([...localStatuses]);
};

export const updateStatusOrder = async (newOrder: CaseStatus[]): Promise<CaseStatus[]> => {
  localStatuses = newOrder;
  return Promise.resolve([...localStatuses]);
}

// ------------------------------------------------------------------
// Case Management API
// ------------------------------------------------------------------

export const fetchCases = async (): Promise<Case[]> => {
  return new Promise(resolve => setTimeout(() => resolve([...localCases]), 300));
};

export const fetchPartners = async (): Promise<Partner[]> => {
  return new Promise(resolve => setTimeout(() => resolve([...localPartners]), 300));
};

export const savePartner = async (partner: Partner): Promise<Partner[]> => {
  const idx = localPartners.findIndex(p => p.partnerId === partner.partnerId);
  if (idx > -1) {
    localPartners[idx] = partner;
  } else {
    localPartners.push(partner);
  }
  return Promise.resolve([...localPartners]);
};

// Added missing function deletePartner to fix error in Settings.tsx
export const deletePartner = async (partnerId: string): Promise<Partner[]> => {
  localPartners = localPartners.filter(p => p.partnerId !== partnerId);
  return Promise.resolve([...localPartners]);
};

export const createCaseHelper = (newCase: Partial<Case>): Case => {
  const managerName = localStorage.getItem('managerName') || 'Mark';
  const now = new Date().toISOString();
  // Ensure we default to 0 if not provided, avoiding NaN
  const incomeDetails = newCase.incomeDetails || {};
  const incomeNet = newCase.incomeNet || 0;
  const loanMonthlyPay = newCase.loanMonthlyPay || 0;

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
    // Ensure numeric fields are numbers
    incomeDetails,
    incomeNet,
    loanMonthlyPay
  } as Case;
};

export const createCase = async (newCase: Partial<Case>): Promise<Case> => {
  const c = createCaseHelper(newCase);
  localCases.push(c);
  return Promise.resolve(c);
};

export const batchCreateCases = async (newCases: Partial<Case>[]): Promise<Case[]> => {
  const createdCases = newCases.map(nc => createCaseHelper(nc));
  localCases.push(...createdCases);
  return Promise.resolve(createdCases);
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
  return Promise.resolve(updated);
};

export const deleteCase = async (caseId: string): Promise<Case[]> => {
  localCases = localCases.filter(c => c.caseId !== caseId);
  return Promise.resolve([...localCases]);
};

export const addMemo = async (caseId: string, content: string): Promise<Case> => {
  const idx = localCases.findIndex(c => c.caseId === caseId);
  if (idx === -1) throw new Error('Case not found');

  const newMemo: MemoItem = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    content
  };

  localCases[idx].specialMemo = [newMemo, ...(localCases[idx].specialMemo || [])];
  localCases[idx].updatedAt = new Date().toISOString();
  return Promise.resolve(localCases[idx]);
};

export const deleteMemo = async (caseId: string, memoId: string): Promise<Case> => {
  const idx = localCases.findIndex(c => c.caseId === caseId);
  if (idx === -1) throw new Error('Case not found');

  localCases[idx].specialMemo = (localCases[idx].specialMemo || []).filter(m => m.id !== memoId);
  return Promise.resolve(localCases[idx]);
};

export const addRecording = async (caseId: string, recording: RecordingItem): Promise<Case> => {
  const idx = localCases.findIndex(c => c.caseId === caseId);
  if (idx === -1) throw new Error('Case not found');

  localCases[idx].recordings = [recording, ...(localCases[idx].recordings || [])];
  return Promise.resolve(localCases[idx]);
};

export const changeStatus = async (caseId: string, newStatus: CaseStatus, memo: string): Promise<Case> => {
  const idx = localCases.findIndex(c => c.caseId === caseId);
  if (idx === -1) throw new Error('Case not found');

  const oldStatus = localCases[idx].status;
  const now = new Date().toISOString();

  localCases[idx] = {
    ...localCases[idx],
    status: newStatus,
    statusUpdatedAt: now,
    updatedAt: now
  };

  const log: CaseStatusLog = {
    logId: uuidv4(),
    caseId,
    changedAt: now,
    changedBy: 'Mark',
    fromStatus: oldStatus,
    toStatus: newStatus,
    memo
  };
  localLogs.push(log);

  return Promise.resolve(localCases[idx]);
};

export const fetchCaseStatusLogs = async (caseId: string): Promise<CaseStatusLog[]> => {
  const logs = localLogs.filter(l => l.caseId === caseId).sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  return Promise.resolve(logs);
};

export const fetchInboundPaths = async (): Promise<string[]> => {
  return Promise.resolve([...localInboundPaths]);
};

// Added missing function addInboundPath to fix error in Settings.tsx
export const addInboundPath = async (path: string): Promise<string[]> => {
  if (!localInboundPaths.includes(path)) {
    localInboundPaths.push(path);
  }
  return Promise.resolve([...localInboundPaths]);
};

// Added missing function deleteInboundPath to fix error in Settings.tsx
export const deleteInboundPath = async (path: string, migrateTo?: string): Promise<string[]> => {
  // Migrate cases if target provided
  if (migrateTo) {
    localCases = localCases.map(c => {
      if (c.inboundPath === path) {
        return { ...c, inboundPath: migrateTo, updatedAt: new Date().toISOString() };
      }
      return c;
    });
  }

  localInboundPaths = localInboundPaths.filter(p => p !== path);
  return Promise.resolve([...localInboundPaths]);
};

// --- Lead Integration (Google Sheets) ---

// Replace this with the URL provided by the user
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwD5zk784sBuSLnpkRa9oL3YWB66-Ypu4rDnv_f3POOlLeomNiU8rImyXf8baPHtJITPg/exec";

// Simulate external data source (Google Sheet Rows)
interface ExternalLeadRow {
  name: string;
  phone: string;
  pageTitle: string; // Used as Inbound Path
  extraInfo: string;
  timestamp: string;
}

const MOCK_EXTERNAL_LEADS: ExternalLeadRow[] = [
  { name: '김신규', phone: '010-9999-1111', pageTitle: '파산면책 이벤트A', extraInfo: '부채 5천만원, 직장인', timestamp: new Date().toISOString() },
  { name: '이초기', phone: '010-8888-2222', pageTitle: '개인회생 상담신청', extraInfo: '서울 거주, 자영업', timestamp: new Date().toISOString() },
  { name: '박테스트', phone: '010-7777-3333', pageTitle: '새출발기금 문의', extraInfo: '기존 대출 3건', timestamp: new Date().toISOString() }
];

export const fetchNewLeads = async (): Promise<Case[]> => {
  // If no URL configured, use mock data (Demo Mode)
  if (!GOOGLE_SCRIPT_URL) {
    return fetchMockLeads();
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    if (!response.ok) throw new Error('Network response was not ok');

    // Expected format from GAS: [{rowIndex: 2, timestamp: "...", name: "...", phone: "...", pageTitle: "...", extraInfo: "..."}]
    const data = await response.json();

    // Filter out leads that already exist locally
    const newLeads = data.filter((row: any) => !localCases.some(c => c.phone === row.phone));

    if (newLeads.length === 0) return [];

    const newCases: Case[] = [];
    const now = new Date().toISOString();

    for (const lead of newLeads) {
      // Auto-add Inbound Path
      if (!localInboundPaths.includes(lead.pageTitle)) {
        localInboundPaths.push(lead.pageTitle);
      }

      const newCase: Case = {
        caseId: uuidv4().slice(0, 8),
        customerName: lead.name,
        phone: lead.phone,
        inboundPath: lead.pageTitle,
        preInfo: lead.extraInfo,
        status: '신규접수',
        isNew: true,

        // Defaults
        partnerId: localPartners[0]?.partnerId || '',
        createdAt: now,
        updatedAt: now,
        statusUpdatedAt: now,
        managerName: 'System',
        gender: '남',
        jobTypes: [],
        incomeDetails: {},
        incomeNet: 0,
        loanMonthlyPay: 0,
        housingType: '월세',
        housingDetail: '기타',
        deposit: 0,
        rent: 0,
        assets: [],
        insurance4: '미가입',
        maritalStatus: '미혼',
      } as Case;

      newCases.push(newCase);
    }

    localCases.unshift(...newCases);
    return newCases;

  } catch (error) {
    console.warn("Failed to fetch from Google Sheet, falling back to mock data for demo", error);
    return fetchMockLeads();
  }
};

const fetchMockLeads = async (): Promise<Case[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));

  // 1. Randomly decide if there are new leads (30% chance)
  const shouldHaveNewLeads = Math.random() < 0.3;

  // For demo purposes, if total cases are small, force adding some
  if (!shouldHaveNewLeads && localCases.length > 20) return [];

  // 2. Pick a random lead from mock source
  const randomLead = MOCK_EXTERNAL_LEADS[Math.floor(Math.random() * MOCK_EXTERNAL_LEADS.length)];

  // 3. Check for duplicates (Phone number check)
  const exists = localCases.some(c => c.phone === randomLead.phone);
  if (exists) return [];

  // 4. Auto-add Inbound Path if not exists
  if (!localInboundPaths.includes(randomLead.pageTitle)) {
    localInboundPaths.push(randomLead.pageTitle);
  }

  // 5. Create new Case
  const newCaseId = uuidv4().slice(0, 8);
  const now = new Date().toISOString();

  const newCase: Case = {
    caseId: newCaseId,
    customerName: randomLead.name,
    phone: randomLead.phone,
    inboundPath: randomLead.pageTitle,
    preInfo: randomLead.extraInfo,
    status: '신규접수',
    isNew: true, // Flag as new

    // Defaults
    partnerId: localPartners[0]?.partnerId || '',
    createdAt: now,
    updatedAt: now,
    statusUpdatedAt: now,
    managerName: 'System', // Imported by System
    gender: '남',
    jobTypes: [],
    incomeDetails: {},
    incomeNet: 0,
    loanMonthlyPay: 0,
    housingType: '월세',
    housingDetail: '기타',
    deposit: 0,
    rent: 0,
    assets: [],
    insurance4: '미가입',
    maritalStatus: '미혼',

  } as Case;

  localCases.unshift(newCase); // Add to top
  return [newCase];
};
