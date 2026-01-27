/**
 * Supabase Client for LeadMaster CRM
 * 
 * This module provides:
 * - Supabase client initialization
 * - Type-safe database operations
 * - Real-time subscription helpers
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Case, Partner } from '../types';

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
            persistSession: true, // Enable session persistence for consistent auth state
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
    is_viewed: boolean;
    deleted_at: string | null;
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
    isViewed: row.is_viewed,
    deletedAt: row.deleted_at || undefined,
    customerName: row.customer_name,
    phone: row.phone,
    birth: row.birth || '',
    gender: (row.gender || '남') as any,
    region: row.region || '',
    managerName: row.manager_name,
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
    if (c.isViewed !== undefined) result.is_viewed = c.isViewed;
    if (c.deletedAt !== undefined) result.deleted_at = c.deletedAt || null;
    if (c.customerName !== undefined) result.customer_name = c.customerName;
    if (c.phone !== undefined) result.phone = c.phone;
    if (c.birth !== undefined) result.birth = c.birth || null;
    if (c.gender !== undefined) result.gender = c.gender;
    if (c.region !== undefined) result.region = c.region || null;
    if (c.managerName !== undefined) result.manager_name = c.managerName;
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
 */
export const fetchCasesFromSupabase = async (): Promise<Case[]> => {
    if (!supabase) {
        console.warn('[Supabase] Client not configured, falling back to sheets');
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('cases')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Supabase] Fetch error:', error);
            return [];
        }

        return (data || []).map(dbToCase);
    } catch (err) {
        console.error('[Supabase] Fetch failed:', err);
        return [];
    }
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
            return null;
        }

        return data ? dbToCase(data) : null;
    } catch (err) {
        console.error('[Supabase] Create failed:', err);
        return null;
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
            return null;
        }

        return data ? dbToCase(data) : null;
    } catch (err) {
        console.error('[Supabase] Update failed:', err);
        return null;
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
            return false;
        }

        return true;
    } catch (err) {
        console.error('[Supabase] Delete failed:', err);
        return false;
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
                deleted_at: new Date().toISOString(),
                status: '휴지통'
            })
            .eq('case_id', caseId);

        if (error) {
            console.error('[Supabase] Soft delete error:', error);
            return false;
        }

        return true;
    } catch (err) {
        console.error('[Supabase] Soft delete failed:', err);
        return false;
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
            return false;
        }

        return true;
    } catch (err) {
        console.error('[Supabase] Restore failed:', err);
        return false;
    }
};

// ============================================
// Real-time Subscriptions
// ============================================

let casesChannel: RealtimeChannel | null = null;

/**
 * Subscribe to real-time case updates
 */
export const subscribeToCases = (
    onInsert: (newCase: Case) => void,
    onUpdate: (updatedCase: Case) => void,
    onDelete: (caseId: string) => void
): (() => void) => {
    if (!supabase) {
        console.warn('[Supabase] Real-time not available - client not configured');
        return () => { };
    }

    // Unsubscribe from previous channel if exists
    if (casesChannel) {
        supabase.removeChannel(casesChannel);
    }

    casesChannel = supabase
        .channel('cases-realtime')
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
        .subscribe((status) => {
            console.log('[Supabase] Realtime status:', status);
        });

    // Return unsubscribe function
    return () => {
        if (casesChannel && supabase) {
            supabase.removeChannel(casesChannel);
            casesChannel = null;
        }
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
