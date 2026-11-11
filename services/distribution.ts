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

export interface BulkDistributeOptions {
  limit?: number;
  mode: 'round_robin' | 'quota' | 'balanced';
  userIds?: string[];
  quotaPerAgent?: number;
  statusFilter?: string;
  inboundPath?: string;
  batchId?: string;
  note?: string;
}

export interface BulkDistributeResult {
  success: boolean;
  totalDistributed: number;
  userCount: number;
  summary: Record<string, number>;
}

/** 대용량(15,000건+) 미배정 리드 고속 일괄 배분 */
export const distributeUnassignedBulk = async (opts: BulkDistributeOptions): Promise<BulkDistributeResult> => {
  const { data, error } = await need().rpc('distribute_unassigned_cases_bulk', {
    p_limit: opts.limit ?? null,
    p_mode: opts.mode,
    p_user_ids: opts.userIds && opts.userIds.length > 0 ? opts.userIds : null,
    p_quota_per_agent: opts.quotaPerAgent ?? null,
    p_status_filter: opts.statusFilter || null,
    p_inbound_path: opts.inboundPath || null,
    p_batch_id: opts.batchId || null,
    p_note: opts.note || '대량 자동 배분',
  });
  if (error) fail(error);
  return {
    success: !!data?.success,
    totalDistributed: Number(data?.total_distributed || 0),
    userCount: Number(data?.user_count || 0),
    summary: data?.summary || {},
  };
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

export const createImportBatch = async (b: {
  name: string;
  source?: string;
  vendorName?: string;
  unitCost?: number;
  totalCost?: number;
  fileName?: string;
  totalRows: number;
  distribution?: any;
}): Promise<string> => {
  const payload: any = {
    name: b.name,
    source: b.vendorName || b.source || null,
    vendor_name: b.vendorName || b.source || null,
    file_name: b.fileName || null,
    total_rows: b.totalRows,
    unit_cost: b.unitCost ? Math.max(0, b.unitCost) : 0,
    total_cost: b.totalCost ? Math.max(0, b.totalCost) : (b.unitCost && b.totalRows ? b.unitCost * b.totalRows : 0),
    distribution: b.distribution || {},
  };
  const { data, error } = await need().from('lead_import_batches').insert(payload).select('id').single();
  if (error) fail(error);
  return data!.id;
};

export const updateImportBatch = async (
  id: string,
  v: { inserted: number; duplicates: number; invalid: number; distribution?: any; totalCost?: number; unitCost?: number }
): Promise<void> => {
  const patch: any = { inserted: v.inserted, duplicates: v.duplicates, invalid: v.invalid };
  if (v.distribution) patch.distribution = v.distribution;
  if (v.totalCost !== undefined) patch.total_cost = v.totalCost;
  if (v.unitCost !== undefined) patch.unit_cost = v.unitCost;
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

// ============================================
// [지능형 DB 순환 & 미컨택 회수 엔진] 고도화 기능 (다담세일즈 벤치마킹)
// ============================================

export interface ReclaimSummary {
  reclaimedCount: number;
  unassignedCount: number;
  reassignedCount: number;
  agentBreakdown: Record<string, number>;
}

export interface ShuffleSummary {
  totalShuffled: number;
  fromCount: number;
  toCount: number;
  agentBreakdown: Record<string, number>;
}

/** 미처리(장기 미컨택) 리드 목록 조회 */
export const fetchReclaimableCases = async (): Promise<Array<{ caseId: string; customerName: string; assignedUserId: string; status: string; assignedAt: string }>> => {
  const settings = await fetchDistributionSettings();
  const cutoffMinutes = settings.reclaimAfterMinutes || 1440;
  const cutoffDate = new Date(Date.now() - cutoffMinutes * 60 * 1000).toISOString();
  const statuses = settings.reclaimStatuses && settings.reclaimStatuses.length > 0 ? settings.reclaimStatuses : ['신규접수'];

  const { data, error } = await need().from('cases')
    .select('case_id, customer_name, assigned_user_id, status, assigned_at')
    .not('assigned_user_id', 'is', null)
    .is('deleted_at', null)
    .in('status', statuses)
    .lt('assigned_at', cutoffDate)
    .limit(1000);

  if (error) fail(error);
  return (data || []).map((r: any) => ({
    caseId: r.case_id,
    customerName: r.customer_name,
    assignedUserId: r.assigned_user_id,
    status: r.status,
    assignedAt: r.assigned_at,
  }));
};

/** 특정 상담원의 미처리(untouched) 리드 목록 조회 */
export const fetchAgentUntouchedCases = async (userId: string): Promise<Array<{ caseId: string; customerName: string; status: string; assignedAt: string }>> => {
  const settings = await fetchDistributionSettings();
  const statuses = settings.reclaimStatuses && settings.reclaimStatuses.length > 0 ? settings.reclaimStatuses : ['신규접수'];

  const { data, error } = await need().from('cases')
    .select('case_id, customer_name, status, assigned_at')
    .eq('assigned_user_id', userId)
    .is('deleted_at', null)
    .in('status', statuses)
    .limit(500);

  if (error) fail(error);
  return (data || []).map((r: any) => ({
    caseId: r.case_id,
    customerName: r.customer_name,
    status: r.status,
    assignedAt: r.assigned_at,
  }));
};

/** 특정 상담원의 미처리 DB만 쏙 빼서 회수 (미배정 또는 타 상담원 배분) */
export const reclaimAgentUntouchedOnly = async (
  fromUserId: string,
  action: 'unassign' | 'reassign',
  targetUserId?: string
): Promise<number> => {
  const cases = await fetchAgentUntouchedCases(fromUserId);
  if (cases.length === 0) return 0;
  const ids = cases.map(c => c.caseId);

  if (action === 'unassign') {
    return await transferCases(fromUserId, null, 'open', ids, '미처리 DB 즉시 회수');
  } else if (targetUserId) {
    return await transferCases(fromUserId, targetUserId, 'open', ids, '미처리 DB 이관');
  } else {
    // 활성 상담원들에게 순환 배분
    const agents = await fetchDistributionOverview();
    const receivers = agents.filter(a => a.status === 'active' && a.receiving && a.userId !== fromUserId);
    if (receivers.length === 0) {
      // 받을 사람이 없으면 미배정으로 회수
      return await transferCases(fromUserId, null, 'open', ids, '미처리 DB 회수 (대체 상담원 없음)');
    }
    const distResult = await distributeCases(ids, 'balanced', receivers.map(r => r.userId), undefined, '미처리 DB 타 상담원 균등 재배분');
    return Object.values(distResult).reduce((a, b) => a + b, 0);
  }
};

/** 관리자 수동 즉시 미처리 DB 일괄 회수 & 재배분 실행 */
export const executeInstantAutoReclaim = async (): Promise<ReclaimSummary> => {
  const settings = await fetchDistributionSettings();
  const cases = await fetchReclaimableCases();
  if (cases.length === 0) {
    return { reclaimedCount: 0, unassignedCount: 0, reassignedCount: 0, agentBreakdown: {} };
  }

  const ids = cases.map(c => c.caseId);
  const byUser = new Map<string, string[]>();
  cases.forEach(c => {
    const list = byUser.get(c.assignedUserId) || [];
    list.push(c.caseId);
    byUser.set(c.assignedUserId, list);
  });

  if (settings.reclaimAction === 'unassign') {
    let unassignedTotal = 0;
    for (const [uid, userCaseIds] of byUser.entries()) {
      const n = await transferCases(uid, null, 'open', userCaseIds, '관리자 수동 미처리 일괄 회수');
      unassignedTotal += n;
    }
    return {
      reclaimedCount: cases.length,
      unassignedCount: unassignedTotal,
      reassignedCount: 0,
      agentBreakdown: {},
    };
  } else {
    // reassign
    const agents = await fetchDistributionOverview();
    const receivers = agents.filter(a => a.status === 'active' && a.receiving);
    if (receivers.length === 0) {
      // 대체 상담원이 없으면 미배정으로 전환
      let unassignedTotal = 0;
      for (const [uid, userCaseIds] of byUser.entries()) {
        const n = await transferCases(uid, null, 'open', userCaseIds, '관리자 미처리 회수 (수신 상담원 없음)');
        unassignedTotal += n;
      }
      return {
        reclaimedCount: cases.length,
        unassignedCount: unassignedTotal,
        reassignedCount: 0,
        agentBreakdown: {},
      };
    }

    const distMode: DistributeMode = settings.method === 'weighted' ? 'round_robin' : settings.method;
    const distResult = await distributeCases(ids, distMode, receivers.map(r => r.userId), undefined, '장기 미처리 DB 순환 자동 재배분');
    const reassignedCount = Object.values(distResult).reduce((a, b) => a + b, 0);

    return {
      reclaimedCount: cases.length,
      unassignedCount: 0,
      reassignedCount,
      agentBreakdown: distResult,
    };
  }
};

/** 부재중 N회 이상 DB 현황 조회 */
export const fetchMissedCasesCount = async (minMissedCount = 3): Promise<{ total: number; byAgent: Record<string, number> }> => {
  const settings = await fetchDistributionSettings();
  const closed = settings.closedStatuses || DEFAULT_CLOSED_STATUSES;

  const { data, error } = await need().from('cases')
    .select('case_id, assigned_user_id, missed_call_count, status')
    .not('assigned_user_id', 'is', null)
    .is('deleted_at', null)
    .gte('missed_call_count', minMissedCount)
    .limit(2000);

  if (error) fail(error);
  const valid = (data || []).filter((r: any) => !closed.includes(r.status));
  const byAgent: Record<string, number> = {};
  valid.forEach((r: any) => {
    byAgent[r.assigned_user_id] = (byAgent[r.assigned_user_id] || 0) + 1;
  });

  return { total: valid.length, byAgent };
};

/** 부재중 DB 상담원 교차 셔플 실행 (다담세일즈 스타일) */
export const executeCrossAgentShuffle = async (minMissedCount = 3): Promise<ShuffleSummary> => {
  const settings = await fetchDistributionSettings();
  const closed = settings.closedStatuses || DEFAULT_CLOSED_STATUSES;
  const agents = await fetchDistributionOverview();
  const activeReceivers = agents.filter(a => a.status === 'active' && a.receiving);

  if (activeReceivers.length < 2) {
    throw new Error('교차 셔플을 진행하려면 리드를 수신할 활성 상담원이 최소 2명 이상이어야 합니다.');
  }

  // 부재중 리드 조회
  const { data, error } = await need().from('cases')
    .select('case_id, assigned_user_id, missed_call_count, status')
    .not('assigned_user_id', 'is', null)
    .is('deleted_at', null)
    .gte('missed_call_count', minMissedCount)
    .limit(2000);

  if (error) fail(error);
  const eligible = (data || []).filter((r: any) => !closed.includes(r.status));
  if (eligible.length === 0) {
    return { totalShuffled: 0, fromCount: 0, toCount: 0, agentBreakdown: {} };
  }

  // 담당자별 그룹화
  const byAgent = new Map<string, string[]>();
  eligible.forEach((r: any) => {
    const list = byAgent.get(r.assigned_user_id) || [];
    list.push(r.case_id);
    byAgent.set(r.assigned_user_id, list);
  });

  let totalShuffled = 0;
  const breakdown: Record<string, number> = {};

  // 각 상담원의 부재중 DB를 본인이 아닌 다른 상담원들에게 균등 교차 배분
  for (const [fromUid, caseIds] of byAgent.entries()) {
    const otherReceivers = activeReceivers.filter(a => a.userId !== fromUid);
    if (otherReceivers.length === 0) continue;

    const res = await distributeCases(
      caseIds,
      'balanced',
      otherReceivers.map(r => r.userId),
      undefined,
      `부재중(${minMissedCount}회+) DB 교차 셔플 배분`
    );

    Object.entries(res).forEach(([uid, cnt]) => {
      breakdown[uid] = (breakdown[uid] || 0) + cnt;
      totalShuffled += cnt;
    });
  }

  return {
    totalShuffled,
    fromCount: byAgent.size,
    toCount: Object.keys(breakdown).length,
    agentBreakdown: breakdown,
  };
};
