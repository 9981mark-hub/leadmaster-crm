/**
 * services/autoDialV4Service.ts
 * 차세대 스마트 오토콜(Auto-Dialer v4.0) 중앙 집중형 캠페인 & 상담원 배정 서비스
 */

import { supabase } from './supabase';
import { Case } from '../types';

export interface AutoDialCampaignPacing {
  ringTimeoutSeconds: number;       // 기본 20초
  gapSeconds: number;               // 기본 4초
  wrapUpLimitSeconds: number;       // 기본 10초 (후처리 타이머)
  maxRetry: number;                 // 부재 최대 재시도 횟수 (기본 3회)
  retryIntervalMinutes: number;     // 재시도 간격 (기본 120분)
  dualSimRotation: boolean;         // 듀얼SIM 교차 발신 활성화 (SIM1 ↔ SIM2)
  autoSkipWrapUp: boolean;          // 후처리 제한시간 초과 시 자동 강제 다음 콜
}

export interface AutoDialCampaignFilter {
  batchIds?: string[];              // 특정 회차 DB만 선택
  statuses?: string[];              // '신규 접수', '부재1차', '부재2차' 등
  excludeRecentHours?: number;      // 최근 N시간 내 통화 건 제외 (기본 2시간)
  excludeDnc?: boolean;             // 수신거부 제외 (기본 true)
}

export interface AutoDialCampaign {
  id: string;
  orgId: string;
  name: string;
  status: 'ready' | 'running' | 'paused' | 'completed' | 'archived';
  targetFilter: AutoDialCampaignFilter;
  pacingSettings: AutoDialCampaignPacing;
  totalLeads: number;
  completedLeads: number;
  connectedLeads: number;
  noAnswerLeads: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutoDialAgentAllocation {
  id: string;
  campaignId: string;
  orgId: string;
  agentId: string;
  agentName: string;
  targetCount: number;
  completedCount: number;
  connectedCount: number;
  noAnswerCount: number;
  busyCount: number;
  rejectedCount: number;
  currentStatus: 'idle' | 'dialing' | 'ringing' | 'talking' | 'wrapup' | 'paused' | 'offline';
  currentCaseId?: string;
  currentCustomerName?: string;
  lastStatusChangedAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AutoDialQueueItem {
  id: string;
  campaignId: string;
  orgId: string;
  caseId: string;
  assignedAgentId: string;
  customerName: string;
  phone: string;
  simSlot: number;                 // 0 = SIM1, 1 = SIM2
  priorityScore: number;
  attemptCount: number;
  maxAttempts: number;
  status: 'pending' | 'locked' | 'dialing' | 'ringing' | 'talking' | 'wrapup' | 'completed' | 'skipped';
  lastAttemptAt?: string;
  nextRetryAt?: string;
  result?: 'connected' | 'no_answer' | 'busy' | 'rejected' | 'callback' | 'invalid';
  resultMemo?: string;
  callDurationSeconds: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// DTO 매핑 헬퍼
// -------------------------------------------------------------
function rowToCampaign(row: any): AutoDialCampaign {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    status: row.status,
    targetFilter: row.target_filter || {},
    pacingSettings: row.pacing_settings || {
      ringTimeoutSeconds: 20,
      gapSeconds: 4,
      wrapUpLimitSeconds: 10,
      maxRetry: 3,
      retryIntervalMinutes: 120,
      dualSimRotation: true,
      autoSkipWrapUp: true,
    },
    totalLeads: row.total_leads || 0,
    completedLeads: row.completed_leads || 0,
    connectedLeads: row.connected_leads || 0,
    noAnswerLeads: row.no_answer_leads || 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAllocation(row: any): AutoDialAgentAllocation {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    orgId: row.org_id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    targetCount: row.target_count || 0,
    completedCount: row.completed_count || 0,
    connectedCount: row.connected_count || 0,
    noAnswerCount: row.no_answer_count || 0,
    busyCount: row.busy_count || 0,
    rejectedCount: row.rejected_count || 0,
    currentStatus: row.current_status || 'idle',
    currentCaseId: row.current_case_id,
    currentCustomerName: row.current_customer_name,
    lastStatusChangedAt: row.last_status_changed_at || row.created_at,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToQueueItem(row: any): AutoDialQueueItem {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    orgId: row.org_id,
    caseId: row.case_id,
    assignedAgentId: row.assigned_agent_id,
    customerName: row.customer_name,
    phone: row.phone,
    simSlot: row.sim_slot ?? 0,
    priorityScore: row.priority_score || 100,
    attemptCount: row.attempt_count || 0,
    maxAttempts: row.max_attempts || 3,
    status: row.status,
    lastAttemptAt: row.last_attempt_at,
    nextRetryAt: row.next_retry_at,
    result: row.result,
    resultMemo: row.result_memo,
    callDurationSeconds: row.call_duration_seconds || 0,
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// -------------------------------------------------------------
// 캠페인 관리 API
// -------------------------------------------------------------

/** 캠페인 목록 조회 */
export async function fetchAutoDialCampaigns(orgId?: string): Promise<AutoDialCampaign[]> {
  if (!supabase) return [];
  try {
    let query = supabase.from('auto_dial_campaigns').select('*').order('created_at', { ascending: false });
    if (orgId) {
      query = query.eq('org_id', orgId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(rowToCampaign);
  } catch (err) {
    console.warn('[AutoDialV4] fetchAutoDialCampaigns fallback or error:', err);
    return [];
  }
}

/** 단일 캠페인 상세 조회 */
export async function fetchAutoDialCampaign(campaignId: string): Promise<AutoDialCampaign | null> {
  if (!supabase || !campaignId) return null;
  try {
    const { data, error } = await supabase
      .from('auto_dial_campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToCampaign(data) : null;
  } catch (err) {
    console.error('[AutoDialV4] fetchAutoDialCampaign error:', err);
    return null;
  }
}

/** 캠페인에 속한 상담원 할당 목록 조회 (실시간 플로어 전광판용) */
export async function fetchCampaignAllocations(campaignId: string): Promise<AutoDialAgentAllocation[]> {
  if (!supabase || !campaignId) return [];
  try {
    const { data, error } = await supabase
      .from('auto_dial_agent_allocations')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('completed_count', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToAllocation);
  } catch (err) {
    console.error('[AutoDialV4] fetchCampaignAllocations error:', err);
    return [];
  }
}

export interface CreateCampaignParams {
  orgId: string;
  name: string;
  createdBy?: string;
  filter: AutoDialCampaignFilter;
  pacing: AutoDialCampaignPacing;
  allocations: {
    agentId: string;
    agentName: string;
    targetCount: number;
  }[];
  candidateCases: Case[]; // 필터링 완료된 후보 리드들
}

/**
 * 차세대 오토콜 캠페인 및 상담원별 큐 분배 생성
 */
export async function createAutoDialCampaign(params: CreateCampaignParams): Promise<{ campaignId: string; totalAssigned: number }> {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { orgId, name, createdBy, filter, pacing, allocations, candidateCases } = params;

  if (allocations.length === 0) {
    throw new Error('배정할 상담원을 1명 이상 선택해야 합니다.');
  }
  if (candidateCases.length === 0) {
    throw new Error('오토콜을 진행할 대상 리드가 없습니다.');
  }

  // 1. 캠페인 레코드 생성
  const { data: campaignData, error: campError } = await supabase
    .from('auto_dial_campaigns')
    .insert({
      org_id: orgId,
      name,
      status: 'ready',
      target_filter: filter,
      pacing_settings: pacing,
      total_leads: 0, // 큐 분배 후 업데이트
      created_by: createdBy || 'admin',
    })
    .select('id')
    .single();

  if (campError || !campaignData) {
    console.error('[AutoDialV4] Failed to create campaign:', campError);
    throw campError;
  }

  const campaignId = campaignData.id;

  // 2. 상담원별 할당 슬라이스 계산 및 큐 아이템 생성
  // 라운드 로빈 및 타깃 쿼터 지원
  const totalTargetSum = allocations.reduce((sum, a) => sum + (a.targetCount || 0), 0);
  const queueInserts: any[] = [];
  const allocationInserts: any[] = [];

  let caseIndex = 0;
  let totalAssigned = 0;

  for (const alloc of allocations) {
    const quota = alloc.targetCount > 0 ? alloc.targetCount : Math.floor(candidateCases.length / allocations.length);
    const assignedLeads: Case[] = [];

    while (assignedLeads.length < quota && caseIndex < candidateCases.length) {
      assignedLeads.push(candidateCases[caseIndex]);
      caseIndex++;
    }

    allocationInserts.push({
      campaign_id: campaignId,
      org_id: orgId,
      agent_id: alloc.agentId,
      agent_name: alloc.agentName,
      target_count: assignedLeads.length,
      completed_count: 0,
      connected_count: 0,
      no_answer_count: 0,
      busy_count: 0,
      rejected_count: 0,
      current_status: 'idle',
      is_active: true,
    });

    assignedLeads.forEach((c, idx) => {
      // 듀얼 SIM 회전 옵션: 0 (SIM1)과 1 (SIM2) 교차 할당
      const simSlot = pacing.dualSimRotation ? (idx % 2) : 0;
      
      // 우선순위 점수: 신규=100, 부재1차=80, 부재2차=60, 재통화=120
      let priorityScore = 100;
      const statusText = c.status || '';
      if (statusText.includes('재통화')) priorityScore = 120;
      else if (statusText.includes('부재1')) priorityScore = 80;
      else if (statusText.includes('부재2')) priorityScore = 60;
      else if (statusText.includes('신규')) priorityScore = 100;

      queueInserts.push({
        campaign_id: campaignId,
        org_id: orgId,
        case_id: c.caseId,
        assigned_agent_id: alloc.agentId,
        customer_name: c.customerName || '무명고객',
        phone: c.phone,
        sim_slot: simSlot,
        priority_score: priorityScore,
        attempt_count: 0,
        max_attempts: pacing.maxRetry || 3,
        status: 'pending',
        sort_order: idx,
      });
      totalAssigned++;
    });
  }

  // 3. 할당 레코드 삽입
  if (allocationInserts.length > 0) {
    const { error: allocError } = await supabase
      .from('auto_dial_agent_allocations')
      .insert(allocationInserts);
    if (allocError) console.error('[AutoDialV4] Allocation insert error:', allocError);
  }

  // 4. 큐 레코드 대량 삽입 (청크 단위 배치)
  const CHUNK_SIZE = 200;
  for (let i = 0; i < queueInserts.length; i += CHUNK_SIZE) {
    const chunk = queueInserts.slice(i, i + CHUNK_SIZE);
    const { error: qError } = await supabase.from('auto_dial_queue').insert(chunk);
    if (qError) {
      console.error('[AutoDialV4] Queue insert chunk error:', qError);
    }
  }

  // 5. 총 할당 리드 수 캠페인에 반영
  await supabase
    .from('auto_dial_campaigns')
    .update({ total_leads: totalAssigned, updated_at: new Date().toISOString() })
    .eq('id', campaignId);

  return { campaignId, totalAssigned };
}

/** 캠페인 상태 변경 (시작, 일시정지, 종료) */
export async function updateCampaignStatus(campaignId: string, status: AutoDialCampaign['status']): Promise<void> {
  if (!supabase || !campaignId) return;
  await supabase
    .from('auto_dial_campaigns')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', campaignId);
}

/** 캠페인 삭제 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  if (!supabase || !campaignId) return;
  await supabase.from('auto_dial_campaigns').delete().eq('id', campaignId);
}

// -------------------------------------------------------------
// 상담원 런타임 HUD API
// -------------------------------------------------------------

/** 상담원 본인에게 활성화된 오토콜 할당 조회 (진행 중인 캠페인 우선) */
export async function fetchMyActiveAllocation(agentId: string): Promise<{ allocation: AutoDialAgentAllocation; campaign: AutoDialCampaign } | null> {
  if (!supabase || !agentId) return null;
  try {
    const { data: allocs, error } = await supabase
      .from('auto_dial_agent_allocations')
      .select('*, auto_dial_campaigns (*)')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error || !allocs || allocs.length === 0) return null;

    // 'running'인 캠페인 우선, 없으면 'ready'인 캠페인
    const active = allocs.find((a: any) => a.auto_dial_campaigns?.status === 'running') ||
                   allocs.find((a: any) => a.auto_dial_campaigns?.status === 'ready') ||
                   allocs[0];

    if (!active || !active.auto_dial_campaigns) return null;

    return {
      allocation: rowToAllocation(active),
      campaign: rowToCampaign(active.auto_dial_campaigns),
    };
  } catch (err) {
    console.error('[AutoDialV4] fetchMyActiveAllocation error:', err);
    return null;
  }
}

/** 상담원의 다음 통화 대기 리드 1건 취득 (원자적 락) */
export async function getNextQueueItem(campaignId: string, agentId: string): Promise<AutoDialQueueItem | null> {
  if (!supabase) return null;
  try {
    // 1. pending 상태인 리드 1건 조회 (우선순위 점수 높은 순, sort_order 오름차순)
    const { data, error } = await supabase
      .from('auto_dial_queue')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('assigned_agent_id', agentId)
      .eq('status', 'pending')
      .order('priority_score', { ascending: false })
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    // 2. 잠금 상태('locked')로 전환하여 중복 발신 방지
    await supabase
      .from('auto_dial_queue')
      .update({ status: 'locked', last_attempt_at: new Date().toISOString() })
      .eq('id', data.id);

    return rowToQueueItem({ ...data, status: 'locked' });
  } catch (err) {
    console.error('[AutoDialV4] getNextQueueItem error:', err);
    return null;
  }
}

/** 큐 아이템 상태 실시간 업데이트 */
export async function updateQueueItemStatus(
  queueItemId: string,
  status: AutoDialQueueItem['status'],
  updates?: Partial<AutoDialQueueItem>
): Promise<void> {
  if (!supabase || !queueItemId) return;
  const payload: any = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (updates?.result) payload.result = updates.result;
  if (updates?.resultMemo !== undefined) payload.result_memo = updates.resultMemo;
  if (updates?.callDurationSeconds !== undefined) payload.call_duration_seconds = updates.callDurationSeconds;
  if (updates?.attemptCount !== undefined) payload.attempt_count = updates.attemptCount;

  await supabase.from('auto_dial_queue').update(payload).eq('id', queueItemId);
}

/** 상담원 실시간 라이브 상태 변경 (플로어 전광판 실시간 방송) */
export async function updateAgentLiveStatus(
  allocationId: string,
  status: AutoDialAgentAllocation['currentStatus'],
  extra?: { caseId?: string; customerName?: string }
): Promise<void> {
  if (!supabase || !allocationId) return;
  const payload: any = {
    current_status: status,
    last_status_changed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (extra?.caseId !== undefined) payload.current_case_id = extra.caseId || null;
  if (extra?.customerName !== undefined) payload.current_customer_name = extra.customerName || null;

  await supabase.from('auto_dial_agent_allocations').update(payload).eq('id', allocationId);
}

export interface CompleteCallParams {
  queueItemId: string;
  campaignId: string;
  allocationId: string;
  caseId: string;
  agentId: string;
  result: 'connected' | 'no_answer' | 'busy' | 'rejected' | 'callback';
  caseStatusToSet: string;          // CRM 케이스 변경 상태 (예: '상담중', '부재 1차', '접수')
  resultMemo: string;
  durationSeconds: number;
}

/**
 * 통화 결과 최종 기록 & CRM 케이스/통화 이력 동기화
 */
export async function completeAutoDialCall(params: CompleteCallParams): Promise<void> {
  if (!supabase) return;

  const {
    queueItemId,
    campaignId,
    allocationId,
    caseId,
    agentId,
    result,
    caseStatusToSet,
    resultMemo,
    durationSeconds,
  } = params;

  const nowIso = new Date().toISOString();

  // 1. 큐 아이템 완료 처리
  await supabase
    .from('auto_dial_queue')
    .update({
      status: 'completed',
      result,
      result_memo: resultMemo,
      call_duration_seconds: durationSeconds,
      updated_at: nowIso,
    })
    .eq('id', queueItemId);

  // 2. CRM 리드 상태 변경 & 상담 메모 추가
  // [KIRO 2026-11-13] cases 의 키는 case_id(글자)이고 notes/total_call_duration/last_contact_date 칸은 없다.
  //   예전 코드는 .eq('id') + 없는 칸이라 매번 실패(오류는 삼킴) → 통화 결과가 리드에 반영되지 않았다.
  //   메모는 special_memo 배열 맨 앞(다른 화면과 같은 순서), 상태가 바뀌면 status_logs 에도 남긴다.
  //   통화 기록 자체는 앱이 communication_logs 에 올리므로 여기서 따로 남기지 않는다(call_histories 표 없음).
  try {
    const { data: currentCase, error: readErr } = await supabase
      .from('cases')
      .select('status, special_memo, status_logs')
      .eq('case_id', caseId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!currentCase) throw new Error('리드를 찾을 수 없습니다: ' + caseId);

    const timeStr = new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' });
    const content = `[오토콜 ${timeStr} - ${result === 'connected' ? '통화완료' : '부재'}] ${resultMemo || ''}`.trim();
    const memos = Array.isArray(currentCase.special_memo) ? currentCase.special_memo : [];
    const patch: Record<string, unknown> = {
      special_memo: [{ id: `memo_${Date.now()}`, createdAt: nowIso, content }, ...memos],
      updated_at: nowIso,
    };
    if (caseStatusToSet && caseStatusToSet !== currentCase.status) {
      const logs = Array.isArray(currentCase.status_logs) ? currentCase.status_logs : [];
      patch.status = caseStatusToSet;
      patch.status_logs = [...logs, {
        logId: `log_${Date.now()}`, caseId, changedAt: nowIso, changedBy: agentId || '오토콜',
        fromStatus: currentCase.status, toStatus: caseStatusToSet, memo: '오토콜 결과',
      }];
    }
    const { error: updErr } = await supabase.from('cases').update(patch).eq('case_id', caseId);
    if (updErr) throw updErr;
  } catch (caseErr) {
    console.error('[AutoDialV4] Error updating case after call:', caseErr);
  }
  // 4. 상담원 할당 카운트 증가
  try {
    const { data: alloc } = await supabase
      .from('auto_dial_agent_allocations')
      .select('completed_count, connected_count, no_answer_count, busy_count, rejected_count')
      .eq('id', allocationId)
      .maybeSingle();

    if (alloc) {
      const updates: any = {
        completed_count: (alloc.completed_count || 0) + 1,
        updated_at: nowIso,
      };
      if (result === 'connected') updates.connected_count = (alloc.connected_count || 0) + 1;
      else if (result === 'no_answer') updates.no_answer_count = (alloc.no_answer_count || 0) + 1;
      else if (result === 'busy') updates.busy_count = (alloc.busy_count || 0) + 1;
      else if (result === 'rejected') updates.rejected_count = (alloc.rejected_count || 0) + 1;

      await supabase.from('auto_dial_agent_allocations').update(updates).eq('id', allocationId);
    }
  } catch (allocErr) {
    console.error('[AutoDialV4] Error updating allocation stats:', allocErr);
  }

  // 5. 캠페인 카운트 증가
  try {
    const { data: camp } = await supabase
      .from('auto_dial_campaigns')
      .select('completed_leads, connected_leads, no_answer_leads')
      .eq('id', campaignId)
      .maybeSingle();

    if (camp) {
      const updates: any = {
        completed_leads: (camp.completed_leads || 0) + 1,
        updated_at: nowIso,
      };
      if (result === 'connected') updates.connected_leads = (camp.connected_leads || 0) + 1;
      else if (result === 'no_answer') updates.no_answer_leads = (camp.no_answer_leads || 0) + 1;

      await supabase.from('auto_dial_campaigns').update(updates).eq('id', campaignId);
    }
  } catch (campErr) {
    console.error('[AutoDialV4] Error updating campaign stats:', campErr);
  }
}

/**
 * 골든타임 부재 재투입: 당일 부재 건을 큐로 다시 복귀시켜 재회전
 */
export async function recycleMissedCalls(campaignId: string): Promise<number> {
  if (!supabase || !campaignId) return 0;
  try {
    // 1. 최대 시도 횟수 미만인 no_answer 건 조회
    const { data: missedItems, error } = await supabase
      .from('auto_dial_queue')
      .select('id, attempt_count, max_attempts, sim_slot')
      .eq('campaign_id', campaignId)
      .eq('result', 'no_answer')
      .lt('attempt_count', 3);

    if (error || !missedItems || missedItems.length === 0) return 0;

    // 2. 부재 건들의 상태를 다시 'pending'으로 바꾸고 차수 증가 + 유심 슬롯 교체 (스마트 교차)
    let recycledCount = 0;
    for (const item of missedItems) {
      await supabase
        .from('auto_dial_queue')
        .update({
          status: 'pending',
          attempt_count: (item.attempt_count || 0) + 1,
          sim_slot: item.sim_slot === 0 ? 1 : 0, // 다음엔 다른 SIM으로 발신
          priority_score: 70, // 2차 시도는 신규보다 약간 후순위
          result: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      recycledCount++;
    }

    return recycledCount;
  } catch (err) {
    console.error('[AutoDialV4] recycleMissedCalls error:', err);
    return 0;
  }
}

// -------------------------------------------------------------
// Realtime 구독 헬퍼
// -------------------------------------------------------------

/** 실시간 플로어 전광판 모니터링 구독 (상담원들의 상태/콜수 실시간 변경 감지) */
export function subscribeFloorAllocations(campaignId: string, onChange: () => void): () => void {
  if (!supabase || !campaignId) return () => {};

  const channel = supabase
    .channel(`floor_allocations_${campaignId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'auto_dial_agent_allocations',
        filter: `campaign_id=eq.${campaignId}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
