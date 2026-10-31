// ============================================
// 리드 배분 (자동 배분·나눠주기·회수·담당 변경·배정 기록·DB 업로드 묶음)
// DB: 013_lead_distribution.sql
// ============================================
import { supabase } from './supabase';

export type DistributionMethod = 'round_robin' | 'balanced' | 'weighted';
export type DistributeMode = 'round_robin' | 'balanced' | 'quantity';

export const METHOD_LABEL: Record<DistributionMethod, string> = {
  round_robin: '순번 (돌아가며 1건씩)',
  balanced: '균형 (진행 중 리드가 적은 사람 먼저)',
  weighted: '가중치 (가중치 비율대로)',
};

export const DEFAULT_CLOSED_STATUSES = ['진행불가', '고객취소', '사무장 접수', '계약 완료', '1차 입금완료', '2차 입금완료', '수신정지', '휴지통'];

export interface DistributionSettings {
  autoAssign: boolean;
  method: DistributionMethod;
  defaultDailyCap: number | null;
  maxOpenPerAgent: number | null;
  closedStatuses: string[];
  autoReclaim: boolean;
  reclaimAfterMinutes: number;
  reclaimStatuses: string[];
  reclaimAction: 'unassign' | 'reassign';
  reclaimOnDisable: boolean;
  exists: boolean;
}

export const DEFAULT_SETTINGS: DistributionSettings = {
  autoAssign: false,
  method: 'round_robin',
  defaultDailyCap: null,
  maxOpenPerAgent: null,
  closedStatuses: DEFAULT_CLOSED_STATUSES,
  autoReclaim: false,
  reclaimAfterMinutes: 1440,
  reclaimStatuses: ['신규접수'],
  reclaimAction: 'reassign',
  reclaimOnDisable: true,
  exists: false,
};

export interface AgentOverview {
  userId: string;
  displayName: string;
  email: string;
  role: 'owner' | 'admin' | 'agent';
  status: 'active' | 'disabled';
  receiving: boolean;
  weight: number;
  dailyCap: number | null;
  lastAssignedAt?: string;
  todayAssigned: number;
  openCases: number;
  totalCases: number;
  untouchedCases: number;
}

export interface AssignmentLog {
  id: number;
  caseId: string;
  fromUser?: string;
  toUser?: string;
  reason: string;
  note?: string;
  byUser?: string;
  createdAt: string;
}

export const REASON_LABEL: Record<string, string> = {
  manual: '직접 배정',
  auto: '자동 배분',
  self: '본인 등록',
  import: 'DB 업로드',
  distribute: '나눠주기',
  reclaim: '회수',
  auto_reclaim: '자동 회수',
  transfer: '담당 변경',
  disable: '사용 중지로 회수',
};

export interface ImportBatch {
  id: string;
  name: string;
  source?: string;
  fileName?: string;
  totalRows: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  distribution: any;
  createdAt: string;
}

const need = () => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다');
  return supabase;
};
const fail = (error: any): never => {
  const msg = String(error?.message || error || '알 수 없는 오류');
  throw new Error(msg.replace(/^.*?ERROR:\s*/, ''));
};

export const fetchDistributionSettings = async (): Promise<DistributionSettings> => {
  const { data, error } = await need().from('org_distribution_settings').select('*').maybeSingle();
  if (error) fail(error);
  if (!data) return { ...DEFAULT_SETTINGS };
  return {
    autoAssign: !!data.auto_assign,
    method: data.method,
    defaultDailyCap: data.default_daily_cap ?? null,
    maxOpenPerAgent: data.max_open_per_agent ?? null,
    closedStatuses: data.closed_statuses || DEFAULT_CLOSED_STATUSES,
    autoReclaim: !!data.auto_reclaim,
    reclaimAfterMinutes: data.reclaim_after_minutes ?? 1440,
    reclaimStatuses: data.reclaim_statuses || ['신규접수'],
    reclaimAction: data.reclaim_action || 'reassign',
    reclaimOnDisable: data.reclaim_on_disable ?? true,
    exists: true,
  };
};

export const saveDistributionSettings = async (orgId: string, s: DistributionSettings): Promise<void> => {
  const row = {
    org_id: orgId,
    auto_assign: s.autoAssign,
    method: s.method,
    default_daily_cap: s.defaultDailyCap || null,
    max_open_per_agent: s.maxOpenPerAgent || null,
    closed_statuses: s.closedStatuses,
    auto_reclaim: s.autoReclaim,
    reclaim_after_minutes: Math.min(Math.max(Math.round(s.reclaimAfterMinutes), 10), 43200),
    reclaim_statuses: s.reclaimStatuses,
    reclaim_action: s.reclaimAction,
    reclaim_on_disable: s.reclaimOnDisable,
    updated_at: new Date().toISOString(),
  };
  const { error } = await need().from('org_distribution_settings').upsert(row, { onConflict: 'org_id' });
  if (error) fail(error);
};

export const fetchDistributionOverview = async (): Promise<AgentOverview[]> => {
  const { data, error } = await need().rpc('get_distribution_overview');
  if (error) fail(error);
  return (data || []).map((r: any) => ({
    userId: r.user_id,
    displayName: r.display_name,
    email: r.email,
    role: r.role,
    status: r.status,
    receiving: !!r.receiving,
    weight: Number(r.weight || 1),
    dailyCap: r.daily_cap ?? null,
    lastAssignedAt: r.last_assigned_at || undefined,
    todayAssigned: Number(r.today_assigned || 0),
    openCases: Number(r.open_cases || 0),
    totalCases: Number(r.total_cases || 0),
    untouchedCases: Number(r.untouched_cases || 0),
  }));
};

export const saveAgentDistribution = async (orgId: string, userId: string, v: { receiving: boolean; weight: number; dailyCap: number | null }): Promise<void> => {
  const { error } = await need().from('org_agent_distribution').upsert({
    org_id: orgId,
    user_id: userId,
    receiving: v.receiving,
    weight: Math.min(Math.max(Math.round(v.weight || 1), 1), 10),
    daily_cap: v.dailyCap && v.dailyCap > 0 ? Math.round(v.dailyCap) : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'org_id,user_id' });
  if (error) fail(error);
};

/** 나눠주기. 결과 = 상담원별 배정 건수 */
export const distributeCases = async (caseIds: string[], mode: DistributeMode, userIds: string[], counts?: number[], note?: string): Promise<Record<string, number>> => {
  const total: Record<string, number> = {};
  // 수량 지정은 한 번에 (앞사람부터 채우므로 나누면 안 됨). 나머지는 1000건씩
  const chunks = mode === 'quantity' ? [caseIds] : Array.from({ length: Math.ceil(caseIds.length / 1000) }, (_, i) => caseIds.slice(i * 1000, i * 1000 + 1000));
  for (const ids of chunks) {
    const { data, error } = await need().rpc('distribute_cases', {
      p_case_ids: ids, p_mode: mode, p_user_ids: userIds, p_counts: counts ?? null, p_note: note ?? null,
    });
    if (error) fail(error);
    Object.entries(data || {}).forEach(([k, v]) => { total[k] = (total[k] || 0) + Number(v); });
  }
  return total;
};

/** 담당 변경(이관). toUser = null 이면 회수(미배정). scope 'open' = 진행 중만 */
export const transferCases = async (fromUser: string, toUser: string | null, scope: 'open' | 'all' = 'open', caseIds?: string[], note?: string): Promise<number> => {
  const { data, error } = await need().rpc('transfer_cases', {
    p_from: fromUser, p_to: toUser, p_scope: scope, p_case_ids: caseIds ?? null, p_note: note ?? null,
  });
  if (error) fail(error);
  return Number(data || 0);
};

export const fetchAssignmentLogs = async (opts: { caseId?: string; limit?: number } = {}): Promise<AssignmentLog[]> => {
  let q = need().from('case_assignment_logs')
    .select('id, case_id, from_user, to_user, reason, note, by_user, created_at')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.caseId) q = q.eq('case_id', opts.caseId);
  const { data, error } = await q;
  if (error) fail(error);
  return (data || []).map((r: any) => ({
    id: r.id, caseId: r.case_id, fromUser: r.from_user || undefined, toUser: r.to_user || undefined,
    reason: r.reason, note: r.note || undefined, byUser: r.by_user || undefined, createdAt: r.created_at,
  }));
};

/** 회사 전체에서 이미 있는 번호 (숫자만 비교). 키 = 숫자만 남긴 번호 */
export const findExistingPhones = async (phones: string[]): Promise<Map<string, { caseId: string; customerName: string; status: string; assignedUserId?: string }>> => {
  const out = new Map<string, { caseId: string; customerName: string; status: string; assignedUserId?: string }>();
  for (let i = 0; i < phones.length; i += 1000) {
    const { data, error } = await need().rpc('find_existing_phones', { p_phones: phones.slice(i, i + 1000) });
    if (error) fail(error);
    (data || []).forEach((r: any) => out.set(r.phone, { caseId: r.case_id, customerName: r.customer_name, status: r.status, assignedUserId: r.assigned_user_id || undefined }));
  }
  return out;
};

export const createImportBatch = async (b: { name: string; source?: string; fileName?: string; totalRows: number; distribution: any }): Promise<string> => {
  const { data, error } = await need().from('lead_import_batches').insert({
    name: b.name, source: b.source || null, file_name: b.fileName || null, total_rows: b.totalRows, distribution: b.distribution,
  }).select('id').single();
  if (error) fail(error);
  return data!.id;
};

export const updateImportBatch = async (id: string, v: { inserted: number; duplicates: number; invalid: number; distribution?: any }): Promise<void> => {
  const patch: any = { inserted: v.inserted, duplicates: v.duplicates, invalid: v.invalid };
  if (v.distribution) patch.distribution = v.distribution;
  const { error } = await need().from('lead_import_batches').update(patch).eq('id', id);
  if (error) fail(error);
};

export const fetchImportBatches = async (limit = 20): Promise<ImportBatch[]> => {
  const { data, error } = await need().from('lead_import_batches')
    .select('id, name, source, file_name, total_rows, inserted, duplicates, invalid, distribution, created_at')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) fail(error);
  return (data || []).map((r: any) => ({
    id: r.id, name: r.name, source: r.source || undefined, fileName: r.file_name || undefined,
    totalRows: r.total_rows, inserted: r.inserted, duplicates: r.duplicates, invalid: r.invalid,
    distribution: r.distribution, createdAt: r.created_at,
  }));
};
