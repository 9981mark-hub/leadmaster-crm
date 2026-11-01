/**
 * Supabase Client for LeadMaster CRM
 * 
 * This module provides:
 * - Supabase client initialization
 * - Type-safe database operations
 * - Real-time subscription helpers
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Case, Partner, CommunicationLog, SmsTemplate, PendingSms } from '../types';

// Environment Variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const DATA_MODE = import.meta.env.VITE_DATA_MODE || 'sheets';

// Validate configuration
const isSupabaseConfigured = SUPABASE_URL && SUPABASE_ANON_KEY;

// Create Supabase Client
export const supabase: SupabaseClient | null = isSupabaseConfigured
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
        },
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    })
    : null;

// ============================================
// Type Definitions for Database
// ============================================

// Snake_case database columns → camelCase frontend
interface DbCase {
    id: string;
    case_id: string;
    created_at: string;
    updated_at: string;
    status: string;
    secondary_status: string | null;
    tertiary_status: string | null;
    is_viewed: boolean;
    is_starred: boolean;
    deleted_at: string | null;
    assigned_user_id?: string | null;
    customer_name: string;
    phone: string;
    birth: string | null;
    gender: string;
    region: string | null;
    manager_name: string;
    partner_id: string;
    case_type: string;
    inbound_path: string;
    pre_info: string | null;
    history_type: string;
    job_types: any[];
    income_net: number;
    income_details: any;
    insurance4: string;
    housing_type: string;
    housing_detail: string;
    rent_contractor: string | null;
    deposit: number;
    deposit_loan_amount: number;
    rent: number;
    own_house_price: number;
    own_house_loan: number;
    own_house_owner: string | null;
    credit_card_use: string | null;
    credit_card_amount: number;
    loan_monthly_pay: number;
    marital_status: string;
    children_count: number;
    contract_at: string | null;
    contract_fee: number;
    installment_months: string | null;
    use_capital: boolean;
    assets: any[];
    credit_loan: any[];
    special_memo: any[];
    reminders: any[];
    recordings: any[];
    deposit_history: any[];
    status_logs: any[];
    missed_call_count: number;
    last_missed_call_at: string | null;
    ai_summary: string | null;
    formatted_summary: string | null;
}

// ============================================
// Data Transformation Helpers
// ============================================

// Convert database row to frontend Case object
// Note: Using 'as any' for flexible type matching since DB stores strings for enum-like fields
export const dbToCase = (row: DbCase): Case => ({
    caseId: row.case_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    secondaryStatus: row.secondary_status || undefined,
    tertiaryStatus: row.tertiary_status || undefined,
    isViewed: row.is_viewed,
    isStarred: row.is_starred || false,
    deletedAt: row.deleted_at || undefined,
    customerName: row.customer_name,
    phone: row.phone,
    birth: row.birth || '',
    gender: (row.gender || '남') as any,
    region: row.region || '',
    managerName: row.manager_name,
    assignedUserId: row.assigned_user_id || undefined,
    assignedAt: (row as any).assigned_at || undefined,
    importBatchId: (row as any).import_batch_id || undefined,
    partnerId: row.partner_id,
    caseType: row.case_type,
    inboundPath: row.inbound_path,
    preInfo: row.pre_info || '',
    historyType: row.history_type,
    jobTypes: row.job_types || [],
    incomeNet: row.income_net,
    incomeDetails: row.income_details || {},
    insurance4: (row.insurance4 || '미가입') as any,
    housingType: (row.housing_type || '월세') as any,
    housingDetail: (row.housing_detail || '기타') as any,
    rentContractor: (row.rent_contractor || undefined) as any,
    deposit: row.deposit,
    depositLoanAmount: row.deposit_loan_amount,
    rent: row.rent,
    ownHousePrice: row.own_house_price,
    ownHouseLoan: row.own_house_loan,
    ownHouseOwner: (row.own_house_owner || undefined) as any,
    creditCardUse: (row.credit_card_use || undefined) as any,
    creditCardAmount: row.credit_card_amount,
    loanMonthlyPay: row.loan_monthly_pay,
    maritalStatus: (row.marital_status || '미혼') as any,
    childrenCount: row.children_count,
    contractAt: row.contract_at || undefined,
    contractFee: row.contract_fee,
    installmentMonths: row.installment_months || undefined,
    useCapital: row.use_capital,
    assets: row.assets || [],
    creditLoan: row.credit_loan || [],
    specialMemo: row.special_memo || [],
    reminders: row.reminders || [],
    recordings: row.recordings || [],
    depositHistory: row.deposit_history || [],
    statusLogs: row.status_logs || [],
    missedCallCount: row.missed_call_count,
    lastMissedCallAt: row.last_missed_call_at || undefined,
    aiSummary: row.ai_summary || '',
    isNew: row.status === '신규접수' && !row.is_viewed && !row.deleted_at,
}) as Case;

// Convert frontend Case to database format
export const caseToDb = (c: Partial<Case>): Partial<DbCase> => {
    const result: any = {};

    if (c.caseId !== undefined) result.case_id = c.caseId;
    if (c.createdAt !== undefined) result.created_at = c.createdAt;
    if (c.updatedAt !== undefined) result.updated_at = c.updatedAt;
    if (c.status !== undefined) result.status = c.status;
    if (c.secondaryStatus !== undefined) result.secondary_status = c.secondaryStatus || null;
    if (c.tertiaryStatus !== undefined) result.tertiary_status = c.tertiaryStatus || null;
    if (c.isViewed !== undefined) result.is_viewed = c.isViewed;
    if (c.isStarred !== undefined) result.is_starred = c.isStarred;
    if (c.deletedAt !== undefined) result.deleted_at = c.deletedAt || null;
    if (c.customerName !== undefined) result.customer_name = c.customerName;
    if (c.phone !== undefined) result.phone = c.phone;
    if (c.birth !== undefined) result.birth = c.birth || null;
    if (c.gender !== undefined) result.gender = c.gender;
    if (c.region !== undefined) result.region = c.region || null;
    if (c.managerName !== undefined) result.manager_name = c.managerName;
    if (c.assignedUserId !== undefined) result.assigned_user_id = c.assignedUserId || null;
    if (c.importBatchId !== undefined) result.import_batch_id = c.importBatchId || null;
    if (c.partnerId !== undefined) result.partner_id = c.partnerId;
    if (c.caseType !== undefined) result.case_type = c.caseType;
    if (c.inboundPath !== undefined) result.inbound_path = c.inboundPath;
    if (c.preInfo !== undefined) result.pre_info = c.preInfo || null;
    if (c.historyType !== undefined) result.history_type = c.historyType;
    if (c.jobTypes !== undefined) result.job_types = c.jobTypes;
    if (c.incomeNet !== undefined) result.income_net = c.incomeNet;
    if (c.incomeDetails !== undefined) result.income_details = c.incomeDetails;
    if (c.insurance4 !== undefined) result.insurance4 = c.insurance4;
    if (c.housingType !== undefined) result.housing_type = c.housingType;
    if (c.housingDetail !== undefined) result.housing_detail = c.housingDetail;
    if (c.rentContractor !== undefined) result.rent_contractor = c.rentContractor || null;
    if (c.deposit !== undefined) result.deposit = c.deposit;
    if (c.depositLoanAmount !== undefined) result.deposit_loan_amount = c.depositLoanAmount;
    if (c.rent !== undefined) result.rent = c.rent;
    if (c.ownHousePrice !== undefined) result.own_house_price = c.ownHousePrice;
    if (c.ownHouseLoan !== undefined) result.own_house_loan = c.ownHouseLoan;
    if (c.ownHouseOwner !== undefined) result.own_house_owner = c.ownHouseOwner || null;
    if (c.creditCardUse !== undefined) result.credit_card_use = c.creditCardUse || null;
    if (c.creditCardAmount !== undefined) result.credit_card_amount = c.creditCardAmount;
    if (c.loanMonthlyPay !== undefined) result.loan_monthly_pay = c.loanMonthlyPay;
    if (c.maritalStatus !== undefined) result.marital_status = c.maritalStatus;
    if (c.childrenCount !== undefined) result.children_count = c.childrenCount;
    if (c.contractAt !== undefined) result.contract_at = c.contractAt || null;
    if (c.contractFee !== undefined) result.contract_fee = c.contractFee;
    if (c.installmentMonths !== undefined) result.installment_months = c.installmentMonths || null;
    if (c.useCapital !== undefined) result.use_capital = c.useCapital;
    if (c.assets !== undefined) result.assets = c.assets;
    if (c.creditLoan !== undefined) result.credit_loan = c.creditLoan;
    if (c.specialMemo !== undefined) result.special_memo = c.specialMemo;
    if (c.reminders !== undefined) result.reminders = c.reminders;
    if (c.recordings !== undefined) result.recordings = c.recordings;
    if (c.depositHistory !== undefined) result.deposit_history = c.depositHistory;
    if (c.statusLogs !== undefined) result.status_logs = c.statusLogs;
    if (c.missedCallCount !== undefined) result.missed_call_count = c.missedCallCount;
    if (c.lastMissedCallAt !== undefined) result.last_missed_call_at = c.lastMissedCallAt || null;
    if (c.aiSummary !== undefined) result.ai_summary = c.aiSummary || null;

    return result;
};

// ============================================
// Supabase API Functions
// ============================================

/**
 * Fetch all cases from Supabase
 * [Fix] Paginate to avoid PostgREST default 1,000-row limit
 */
export const fetchCasesFromSupabase = async (): Promise<Case[]> => {
    if (!supabase) {
        console.warn('[Supabase] Client not configured, falling back to sheets');
        return [];
    }

    try {
        const PAGE_SIZE = 1000;
        let allData: any[] = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('cases')
                .select('*')
                .order('created_at', { ascending: false })
                .range(from, from + PAGE_SIZE - 1);

            if (error) {
                console.error('[Supabase] Fetch error:', error);
                throw error;
            }

            const rows = data || [];
            allData = allData.concat(rows);

            if (rows.length < PAGE_SIZE) {
                hasMore = false; // Last page
            } else {
                from += PAGE_SIZE;
            }
        }

        console.log(`[Supabase] Fetched total ${allData.length} cases (paginated)`);
        return allData.map(dbToCase);
    } catch (err) {
        console.error('[Supabase] Fetch failed:', err);
        throw err;
    }
};

/**
 * [EGRESS FIX] 지정 시각 이후 변경된 케이스만 조회 (증분 동기화)
 * cases.updated_at은 BEFORE UPDATE 트리거로 서버 시각이 기록된다.
 */
export const fetchCasesUpdatedSince = async (sinceIso: string): Promise<Case[]> => {
    if (!supabase) return [];

    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('cases')
            .select('*')
            .gte('updated_at', sinceIso)
            .order('updated_at', { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            console.error('[Supabase] Incremental fetch error:', error);
            throw error;
        }

        const rows = data || [];
        allData = allData.concat(rows);
        if (rows.length < PAGE_SIZE) hasMore = false;
        else from += PAGE_SIZE;
    }

    return allData.map(dbToCase);
};

/**
 * [EGRESS FIX] 지정 시각 이후 변경된 settings key 목록만 조회 (값은 받지 않음)
 */
export const fetchSettingKeysUpdatedSince = async (sinceIso: string): Promise<string[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('settings')
        .select('key')
        .gte('updated_at', sinceIso);
    if (error) throw error;
    return (data || []).map((row: any) => row.key);
};

/**
 * Fetch a single case from Supabase
 */
export const fetchCaseFromSupabase = async (caseId: string): Promise<Case | null> => {
    if (!supabase) return null;

    try {
        const { data, error } = await supabase
            .from('cases')
            .select('*')
            .eq('case_id', caseId)
            .single();

        if (error) {
            console.error('[Supabase] Fetch Single error:', error);
            return null;
        }

        return data ? dbToCase(data) : null;
    } catch (err) {
        console.error('[Supabase] Fetch Single failed:', err);
        return null;
    }
};

/**
 * Create a new case in Supabase
 */
export const createCaseInSupabase = async (newCase: Case): Promise<Case | null> => {
    if (!supabase) return null;

    try {
        const dbData = caseToDb(newCase);
        const { data, error } = await supabase
            .from('cases')
            .insert([dbData])
            .select()
            .single();

        if (error) {
            console.error('[Supabase] Create error:', error);
            throw error; // [Fix] Propagate error
        }

        return data ? dbToCase(data) : null;
    } catch (err) {
        console.error('[Supabase] Create failed:', err);
        throw err; // [Fix] Propagate error
    }
};

/**
 * Update a case in Supabase
 */
export const updateCaseInSupabase = async (caseId: string, updates: Partial<Case>): Promise<Case | null> => {
    if (!supabase) return null;

    try {
        const dbData = caseToDb({ ...updates, updatedAt: new Date().toISOString() });
        const { data, error } = await supabase
            .from('cases')
            .update(dbData)
            .eq('case_id', caseId)
            .select()
            .single();

        if (error) {
            console.error('[Supabase] Update error:', error);
            throw error; // [Fix] Propagate error
        }

        return data ? dbToCase(data) : null;
    } catch (err) {
        console.error('[Supabase] Update failed:', err);
        throw err; // [Fix] Propagate error
    }
};

/**
 * Delete a case from Supabase (hard delete)
 */
export const deleteCaseFromSupabase = async (caseId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
        const { error } = await supabase
            .from('cases')
            .delete()
            .eq('case_id', caseId);

        if (error) {
            console.error('[Supabase] Delete error:', error);
            throw error; // [Fix] Propagate error
        }

        return true;
    } catch (err) {
        console.error('[Supabase] Delete failed:', err);
        throw err; // [Fix] Propagate error
    }
};

/**
 * Soft delete a case (move to trash)
 */
export const softDeleteCaseInSupabase = async (caseId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
        const { error } = await supabase
            .from('cases')
            .update({
                // deleted_at: new Date().toISOString(), // [Fix] Don't set this to avoid RLS hiding the row
                status: '휴지통',
                updated_at: new Date().toISOString()
            })
            .eq('case_id', caseId);

        if (error) {
            console.error('[Supabase] Soft delete error:', error);
            throw error; // [Fix] Propagate error
        }

        return true;
    } catch (err) {
        console.error('[Supabase] Soft delete failed:', err);
        throw err; // [Fix] Propagate error
    }
};

/**
 * Restore a case from trash
 */
export const restoreCaseInSupabase = async (caseId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
        const { error } = await supabase
            .from('cases')
            .update({
                deleted_at: null,
                status: '신규접수'
            })
            .eq('case_id', caseId);

        if (error) {
            console.error('[Supabase] Restore error:', error);
            throw error; // [Fix] Propagate error
        }

        return true;
    } catch (err) {
        console.error('[Supabase] Restore failed:', err);
        throw err; // [Fix] Propagate error
    }
};

// ============================================
// Real-time Subscriptions
// ============================================

let casesChannel: RealtimeChannel | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
// 채널을 만들 때마다 증가. 이전 채널의 늦은 상태 콜백이 새 채널을 건드리지 않게 한다.
let channelGeneration = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Subscribe to real-time updates for Cases, Partners, and Settings
 * [EGRESS FIX] Cases 이벤트에서 onAnyChange 제거 (자체 핸들러로 처리 완료)
 * [EGRESS FIX] 재연결 시 지수 백오프 + 최대 재시도 횟수 적용
 */
export const subscribeToCases = (
    onInsert: (newCase: Case) => void,
    onUpdate: (updatedCase: Case) => void,
    onDelete: (caseId: string) => void,
    onAnyChange?: () => void, // Partners/Settings 변경 시에만 호출
    onReconnected?: () => void // 끊겼다가 다시 연결됐을 때 (놓친 변경분 조회용)
): (() => void) => {
    if (!supabase) {
        console.warn('[Supabase] Real-time not available - client not configured');
        return () => { };
    }

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    reconnectAttempts = 0;

    const connect = (isReconnect: boolean) => {
    if (!supabase) return;

    // Unsubscribe from previous channel if exists
    if (casesChannel) {
        supabase.removeChannel(casesChannel);
        casesChannel = null;
    }

    const generation = ++channelGeneration;

    casesChannel = supabase
        .channel('app-realtime')
        // --- Cases Listeners ---
        // [EGRESS FIX] Cases 이벤트에서 onAnyChange 제거
        // onInsert/onUpdate/onDelete가 이미 케이스 데이터를 직접 처리하므로
        // partners/settings를 불필요하게 재조회할 필요 없음
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'cases' },
            (payload) => {
                console.log('[Supabase] New case:', payload.new);
                onInsert(dbToCase(payload.new as DbCase));
            }
        )
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'cases' },
            (payload) => {
                console.log('[Supabase] Updated case:', payload.new);
                onUpdate(dbToCase(payload.new as DbCase));
            }
        )
        .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'cases' },
            (payload) => {
                console.log('[Supabase] Deleted case:', payload.old);
                onDelete((payload.old as any).case_id);
            }
        )
        // --- Partners Listeners ---
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'partners' },
            (payload) => {
                console.log('[Supabase] Partners changed:', payload.eventType);
                if (onAnyChange) onAnyChange();
            }
        )
        // --- Settings Listeners ---
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'settings' },
            (payload) => {
                console.log('[Supabase] Settings changed:', payload.eventType);
                if (onAnyChange) onAnyChange();
            }
        )
        .subscribe((status) => {
            // 이미 교체된(이전) 채널의 늦은 콜백은 무시
            if (generation !== channelGeneration) return;
            console.log('[Supabase] Realtime status:', status);

            if (status === 'SUBSCRIBED') {
                // 연결 성공 시 재시도 카운터 리셋
                reconnectAttempts = 0;
                // 재연결 성공: 끊긴 동안 놓친 변경분만 조회 (전체 재조회 아님)
                if (isReconnect && onReconnected) onReconnected();
                return;
            }

            // [EGRESS FIX] 지수 백오프 + 최대 재시도 횟수로 무한 루프 방지
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                if (reconnectTimer) return; // 이미 재연결 예약됨
                reconnectAttempts++;

                if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
                    console.error(`[Supabase] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping reconnection to prevent bandwidth waste.`);
                    console.error('[Supabase] 탭을 다시 열거나 페이지를 새로고침하면 다시 연결합니다.');
                    return;
                }

                const delay = Math.min(3000 * Math.pow(2, reconnectAttempts - 1), 60000);
                console.warn(`[Supabase] Realtime channel error/timeout - reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s...`);

                reconnectTimer = setTimeout(() => {
                    reconnectTimer = null;
                    console.log('[Supabase] Attempting to reconnect...');
                    // [FIX] 예전에는 채널만 지우고 다시 구독하지 않아 실시간 동기화가 멈춘 채로 남았다.
                    connect(true);
                }, delay);
            }
        });
    };

    connect(false);

    // Return unsubscribe function
    return () => {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        channelGeneration++; // 남아 있는 콜백 무효화
        if (casesChannel && supabase) {
            supabase.removeChannel(casesChannel);
            casesChannel = null;
        }
        reconnectAttempts = 0;
    };
};

// ============================================
// Settings & Partners
// ============================================

/**
 * Fetch settings from Supabase
 */
export const fetchSettingsFromSupabase = async (): Promise<Record<string, any>> => {
    if (!supabase) return {};

    try {
        const { data, error } = await supabase.from('settings').select('*');
        if (error) throw error;

        const settings: Record<string, any> = {};
        (data || []).forEach((row: any) => {
            settings[row.key] = row.value;
        });
        return settings;
    } catch (err) {
        console.error('[Supabase] Settings fetch failed:', err);
        return {};
    }
};

/**
 * Save a setting to Supabase
 */
export const saveSettingToSupabase = async (key: string, value: any): Promise<boolean> => {
    if (!supabase) return false;

    try {
        const { error } = await supabase
            .from('settings')
            .upsert({ key, value, updated_at: new Date().toISOString() });

        if (error) throw error;
        return true;
    } catch (err) {
        console.error('[Supabase] Setting save failed:', err);
        return false;
    }
};

/**
 * Fetch partners from Supabase
 */
export const fetchPartnersFromSupabase = async (): Promise<Partner[]> => {
    if (!supabase) return [];

    try {
        const { data, error } = await supabase.from('partners').select('*');
        if (error) throw error;

        return (data || []).map((row: any) => ({
            partnerId: row.partner_id,
            name: row.name,
            summaryTemplate: row.summary_template || '',
            active: true,
            settlementConfig: null,
            commissionRules: [],
            requiredFields: [],
        })) as Partner[];
    } catch (err) {
        console.error('[Supabase] Partners fetch failed:', err);
        return [];
    }
};

// ============================================
// Migration Helper
// ============================================

/**
 * Bulk insert cases for migration
 */
export const bulkInsertCases = async (cases: Case[]): Promise<number> => {
    if (!supabase) return 0;

    try {
        const dbCases = cases.map(c => caseToDb(c));
        const { data, error } = await supabase
            .from('cases')
            .upsert(dbCases, { onConflict: 'case_id' });

        if (error) {
            console.error('[Supabase] Bulk insert error:', error);
            return 0;
        }

        return cases.length;
    } catch (err) {
        console.error('[Supabase] Bulk insert failed:', err);
        return 0;
    }
};

// Export check function
export const isSupabaseEnabled = () => isSupabaseConfigured && DATA_MODE !== 'sheets';

// ============================================
// Communication Logs & SMS
// ============================================

export const searchCommunicationLogsPhones = async (query: string): Promise<string[]> => {
    if (!supabase || !query || query.length < 2) return [];
    try {
        const { data, error } = await supabase
            .from('communication_logs')
            .select('phone_number')
            .ilike('content', `%${query}%`);
        if (error) throw error;
        return Array.from(new Set((data || []).map(r => r.phone_number)));
    } catch (e) {
        console.error('[Supabase] searchCommunicationLogsPhones error:', e);
        return [];
    }
};

export const fetchCommunicationLogsFromSupabase = async (phone: string): Promise<CommunicationLog[]> => {
    if (!supabase || !phone) return [];
    try {
        const normalizedPhone = phone.replace(/[^0-9]/g, '');
        const { data, error } = await supabase
            .from('communication_logs')
            .select('id, phone_number, type, duration, content, timestamp, created_at, line_info') // [EGRESS FIX] select('*') → 필요 컬럼만
            .eq('phone_number', normalizedPhone)
            .order('timestamp', { ascending: false });
        if (error) throw error;
        return (data || []).map(row => ({
            id: row.id,
            phoneNumber: row.phone_number,
            type: row.type,
            duration: row.duration,
            content: row.content,
            timestamp: row.timestamp,
            createdAt: row.created_at,
            lineInfo: row.line_info || '기본'
        }));
    } catch (e) {
        console.error('[Supabase] fetchCommunicationLogs error:', e);
        return [];
    }
};

export const fetchSmsTemplatesFromSupabase = async (): Promise<SmsTemplate[]> => {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('sms_templates')
            .select('*')
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []).map(row => ({
            id: row.id,
            title: row.title,
            content: row.content,
            createdAt: row.created_at,
            updatedAt: row.updated_at || row.created_at
        }));
    } catch (e) {
        console.error('[Supabase] fetchSmsTemplates error:', e);
        return [];
    }
};

export const saveSmsTemplateToSupabase = async (template: Partial<SmsTemplate>): Promise<SmsTemplate | null> => {
    if (!supabase) {
        console.error('[DEBUG] supabase 클라이언트가 null입니다!');
        throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
    }
    
    const isUpdate = !!template.id;
    console.log(`[DEBUG v2] 저장 시작: ${isUpdate ? 'UPDATE' : 'INSERT'}, title="${template.title}", id=${template.id || 'new'}`);
    
    try {
        let data: any;
        let error: any;

        if (isUpdate) {
            const result = await supabase
                .from('sms_templates')
                .update({
                    title: template.title,
                    content: template.content,
                })
                .eq('id', template.id!)
                .select()
                .single();
            data = result.data;
            error = result.error;
        } else {
            const result = await supabase
                .from('sms_templates')
                .insert({
                    title: template.title,
                    content: template.content,
                })
                .select()
                .single();
            data = result.data;
            error = result.error;
        }

        if (error) {
            console.error(`[DEBUG] Supabase 에러: ${error.message} (code: ${error.code})`);
            throw error;
        }

        if (!data) {
            console.error('[DEBUG] Supabase 데이터 없음 (null). RLS 문제 가능성.');
            throw new Error('저장 후 데이터를 반환받지 못했습니다.');
        }

        console.log(`[DEBUG] 저장 성공! DB 반환 title="${data.title}", content="${data.content?.substring(0, 30)}..."`);
        
        return {
            id: data.id,
            title: data.title,
            content: data.content,
            createdAt: data.created_at,
            updatedAt: data.updated_at || data.created_at, 
        };
    } catch (e: any) {
        console.error(`[DEBUG] 저장 실패 예외: ${e?.message || e}`);
        throw e;
    }
};

/** 문자 요청 저장. 성공하면 요청 id, 실패하면 예외 (예전엔 false를 돌려줘 화면이 성공으로 표시했다) */
export const enqueueSmsToSupabase = async (phone: string, content: string): Promise<string> => {
    if (!supabase) throw new Error('서버 연결이 없습니다.');
    const { data, error } = await supabase
        .from('pending_sms')
        .insert([{
            phone_number: phone,
            content: content,
            status: 'pending'
        }])
        .select('id')
        .single();
    if (error) {
        console.error('[Supabase] enqueueSms error:', error);
        throw error;
    }
    return data?.id as string;
};

/** 문자 요청 상태 (폰 앱이 가져가면 'sent') */
export const fetchPendingSmsStatus = async (id: string): Promise<string | null> => {
    if (!supabase || !id) return null;
    const { data, error } = await supabase.from('pending_sms').select('status').eq('id', id).maybeSingle();
    if (error) return null;
    return (data?.status as string) ?? null;
};

// ============================================
// Batch SMS_OUT existence check (for History icon color)
// ============================================

/**
 * 주어진 전화번호 목록에 대해 SMS_OUT 기록이 있는 전화번호 Set을 반환합니다.
 * 케이스 목록에서 History 아이콘 색상을 결정하는 데 사용됩니다.
 */
export const fetchPhonesWithSmsOut = async (phones: string[]): Promise<Set<string>> => {
    if (!supabase || phones.length === 0) return new Set();
    try {
        const normalizedPhones = phones.map(p => p.replace(/[^0-9]/g, ''));
        const { data, error } = await supabase
            .from('communication_logs')
            .select('phone_number')
            .in('phone_number', normalizedPhones)
            .eq('type', 'SMS_OUT');
        if (error) throw error;
        return new Set((data || []).map(r => r.phone_number));
    } catch (e) {
        console.error('[Supabase] fetchPhonesWithSmsOut error:', e);
        return new Set();
    }
};

// ============================================
// Pending Calls (PC → Mobile 전화 걸기)
// ============================================

/**
 * PC에서 전화 걸기 요청 → Supabase에 기록 → Android 앱이 감지하여 다이얼러 실행
 */
/**
 * [멀티테넌트] 현재 로그인 사용자 id (세션 캐시에서 읽음, 네트워크 호출 없음)
 */
export const getCurrentUserId = async (): Promise<string | null> => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id || null;
};

/**
 * [멀티테넌트] 내가 요청한 전화 요청만 지우는 필터.
 * 상담원 여러 명이 같은 회사에 있을 때 다른 사람의 진행 중 요청을 지우지 않게 한다.
 * requested_by가 비어 있는 행은 멀티테넌트 이전(본사)에 만든 것.
 */
export const ownPendingCallFilter = (userId: string | null) =>
    userId ? `requested_by.eq.${userId},requested_by.is.null` : 'requested_by.is.null';

export const enqueuePendingCall = async (phoneNumber: string, customerName: string, caseId?: string): Promise<boolean> => {
    if (!supabase) return false;
    try {
        const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
        const userId = await getCurrentUserId();

        // 이전 pending_calls 잔여 row 정리 (stale row가 남아있으면 Android 앱이 잘못된 case_id를 참조)
        // [멀티테넌트] 내가 요청한 것만 정리
        try {
            await supabase
                .from('pending_calls')
                .delete()
                .in('status', ['ended', 'dialed', 'cancelled'])
                .or(ownPendingCallFilter(userId));
            // 다른 전화번호의 pending 상태도 정리 (동시에 2건 이상 pending이 있으면 안 됨)
            await supabase
                .from('pending_calls')
                .delete()
                .eq('status', 'pending')
                .neq('phone_number', cleanPhone)
                .or(ownPendingCallFilter(userId));
        } catch (cleanupErr) {
            console.warn('[PendingCall] Cleanup failed (non-critical):', cleanupErr);
        }

        const { error } = await supabase
            .from('pending_calls')
            .insert([{
                phone_number: cleanPhone,
                customer_name: customerName,
                case_id: caseId || null,
                status: 'pending'
            }]);
        if (error) throw error;
        console.log(`[PendingCall] Enqueued call to ${customerName} (${cleanPhone}), caseId: ${caseId || 'none'}`);
        return true;
    } catch (e) {
        console.error('[Supabase] enqueuePendingCall error:', e);
        return false;
    }
};

