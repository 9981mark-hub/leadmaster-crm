/**
 * Telegram Feedback Service
 * 
 * Supabase CRUD operations for telegram_feedbacks table.
 * Handles fetching, applying, confirming, and subscribing to real-time updates.
 */

import { supabase } from './supabase';
import { TelegramFeedback, TelegramFeedbackType, TelegramFeedbackUrgency, TelegramApplyMode } from '../types';

// ============================================
// DB → Frontend Type Mapping
// ============================================

interface DbTelegramFeedback {
  id: string;
  message_id: number;
  reply_to_message_id: number | null;
  sender_name: string;
  customer_name: string | null;
  feedback_type: string;
  feedback_content: string;
  chat_id: string | null;
  chat_title: string | null;
  matched_case_id: string | null;
  is_applied: boolean;
  is_confirmed: boolean;
  apply_mode: string;
  urgency: string;
  ai_classification: any;
  applied_at: string | null;
  applied_by: string | null;
  created_at: string;
}

function dbToFrontend(row: DbTelegramFeedback): TelegramFeedback {
  return {
    id: row.id,
    messageId: row.message_id,
    replyToMessageId: row.reply_to_message_id ?? undefined,
    senderName: row.sender_name,
    customerName: row.customer_name || '',
    feedbackType: row.feedback_type as TelegramFeedbackType,
    feedbackContent: row.feedback_content,
    chatId: row.chat_id ?? undefined,
    chatTitle: row.chat_title ?? undefined,
    matchedCaseId: row.matched_case_id ?? undefined,
    isApplied: row.is_applied,
    isConfirmed: row.is_confirmed,
    applyMode: row.apply_mode as TelegramApplyMode,
    urgency: row.urgency as TelegramFeedbackUrgency,
    aiClassification: row.ai_classification ?? undefined,
    createdAt: row.created_at,
    appliedAt: row.applied_at ?? undefined,
    appliedBy: row.applied_by ?? undefined,
  };
}

// ============================================
// Fetch Operations
// ============================================

/** 특정 Case의 텔레그램 피드백 목록 */
export async function fetchFeedbacksByCase(caseId: string): Promise<TelegramFeedback[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('telegram_feedbacks')
    .select('id, message_id, reply_to_message_id, sender_name, customer_name, feedback_type, feedback_content, chat_id, chat_title, matched_case_id, is_applied, is_confirmed, apply_mode, urgency, ai_classification, applied_at, applied_by, created_at') // [EGRESS FIX]
    .eq('matched_case_id', caseId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[TG] fetchFeedbacksByCase error:', error);
    return [];
  }
  return (data || []).map(dbToFrontend);
}

/** 승인 대기 중인 모든 피드백 (글로벌 알림용) */
export async function fetchPendingFeedbacks(): Promise<TelegramFeedback[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('telegram_feedbacks')
    .select('id, message_id, reply_to_message_id, sender_name, customer_name, feedback_type, feedback_content, chat_id, chat_title, matched_case_id, is_applied, is_confirmed, apply_mode, urgency, ai_classification, applied_at, applied_by, created_at') // [EGRESS FIX]
    .eq('is_confirmed', false)
    .eq('apply_mode', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[TG] fetchPendingFeedbacks error:', error);
    return [];
  }
  return (data || []).map(dbToFrontend);
}

/** 모든 텔레그램 피드백 (히스토리용) */
export async function fetchAllFeedbacks(): Promise<TelegramFeedback[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('telegram_feedbacks')
    .select('id, message_id, reply_to_message_id, sender_name, customer_name, feedback_type, feedback_content, chat_id, chat_title, matched_case_id, is_applied, is_confirmed, apply_mode, urgency, ai_classification, applied_at, applied_by, created_at') // [EGRESS FIX]
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[TG] fetchAllFeedbacks error:', error);
    return [];
  }
  return (data || []).map(dbToFrontend);
}

/** 승인 대기 중인 피드백 수 (배지용) */
export async function fetchPendingCount(): Promise<{ total: number; critical: number }> {
  if (!supabase) return { total: 0, critical: 0 };

  const { count: total } = await supabase
    .from('telegram_feedbacks')
    .select('*', { count: 'exact', head: true })
    .eq('is_confirmed', false)
    .eq('apply_mode', 'pending');

  const { count: critical } = await supabase
    .from('telegram_feedbacks')
    .select('*', { count: 'exact', head: true })
    .eq('is_confirmed', false)
    .eq('urgency', 'critical');

  return { total: total || 0, critical: critical || 0 };
}

/** 특정 Case의 미확인 피드백 수 */
export async function fetchCasePendingCount(caseId: string): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabase
    .from('telegram_feedbacks')
    .select('*', { count: 'exact', head: true })
    .eq('matched_case_id', caseId)
    .eq('is_confirmed', false);

  return count || 0;
}

// ============================================
// Update Operations
// ============================================

export interface ConfirmFeedbackOptions {
  selectedCaseId?: string;
  customStatus?: string;
  customSecondaryStatus?: string;
  incrementMissedCall?: boolean;
  missedCallCount?: number;
  addCalendar?: boolean;
  scheduleDateTime?: string;
  scheduleType?: string;
  scheduleLocation?: string;
  amounts?: { totalFee?: number; deposit?: number };
  appliedBy?: string;
  careNeeded?: boolean;
}

/** 피드백 승인 (CRM 반영 완료 표시) - 단건 및 옵션 지원 */
export async function confirmFeedback(
  feedback: TelegramFeedback,
  appliedByOrOptions: string | ConfirmFeedbackOptions = 'User',
  legacyCaseId?: string
): Promise<boolean> {
  const options: ConfirmFeedbackOptions = typeof appliedByOrOptions === 'object'
    ? appliedByOrOptions
    : { appliedBy: appliedByOrOptions, selectedCaseId: legacyCaseId };

  if (!supabase) return false;

  const appliedBy = options.appliedBy || 'User';
  const targetCaseId = options.selectedCaseId || feedback.matchedCaseId;
  if (!targetCaseId) {
    console.error('[TG] Cannot apply feedback without a target Case ID');
    return false;
  }

  try {
    // 1. Fetch current case data
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('case_id', targetCaseId)
      .single();

    if (!caseData || caseError) {
      console.error('[TG] confirmFeedback case fetch error:', caseError);
      return false;
    }

    const getArray = (val: any) => Array.isArray(val) ? val : (typeof val === 'string' ? JSON.parse(val) : []);

    const updates: Record<string, any> = {};
    const classification = feedback.aiClassification || {} as any;
    const { feedbackType, suggestedStatus, suggestedMemo } = classification;
    
    // 상태 및 보조상태 적용 (커스텀 룰 또는 제안 상태 우선)
    const finalTargetStatus = options.customStatus || suggestedStatus;
    if (finalTargetStatus) {
      updates.status = finalTargetStatus;
    }
    if (options.customSecondaryStatus) {
      updates.secondary_status = options.customSecondaryStatus;
    }

    // 부재 카운팅 처리
    if (options.incrementMissedCall ?? (feedbackType === '부재' || feedbackType === '지속부재')) {
      if (!options.customSecondaryStatus && !updates.secondary_status) {
        updates.secondary_status = '부재';
      }
      const newCount = options.missedCallCount ? Math.max(caseData.missed_call_count || 0, options.missedCallCount) : ((caseData.missed_call_count || 0) + 1);
      updates.missed_call_count = newCount;
      updates.last_missed_call_at = new Date().toISOString();
    }

    // 금액 (수임료 / 착수금) 적용
    if (options.amounts?.totalFee) {
      updates.actual_fee = options.amounts.totalFee;
    }
    if (options.amounts?.deposit) {
      updates.deposit = options.amounts.deposit;
    }

    // 출장 / 내방 / 방문 캘린더 리마인더 자동 생성
    if (options.addCalendar && options.scheduleDateTime) {
      const currentReminders = getArray(caseData.reminders);
      const reminderType = (options.scheduleType === '내방' ? '방문' : options.scheduleType === '통화예약' ? '재통화' : '출장');
      const newReminder = {
        id: `rem-tg-${Date.now()}`,
        type: reminderType,
        datetime: options.scheduleDateTime,
        note: `[TG-${feedback.senderName}] ${options.scheduleLocation ? `[${options.scheduleLocation}] ` : ''}${feedback.feedbackContent.substring(0, 100)}`,
        isCompleted: false,
        createdAt: new Date().toISOString(),
      };
      updates.reminders = [newReminder, ...currentReminders];
    }

    // 특이 메모 추가
    const isCare = options.careNeeded;
    const memoPrefix = isCare ? `[⚠️ 1차 TM 재관리 요망] [TG] ${feedback.senderName}:` : `[TG] ${feedback.senderName}:`;
    const memoContent = suggestedMemo || feedback.feedbackContent;

    const currentMemos = getArray(caseData.special_memo);
    const newMemo = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      content: `${memoPrefix} ${memoContent}`,
    };
    updates.special_memo = [newMemo, ...currentMemos];

    // 상태 변경 이력 로그
    const currentLogs = getArray(caseData.status_logs);
    const log = {
      logId: Date.now().toString(),
      fromStatus: `${caseData.status} (${caseData.secondary_status || '없음'})`,
      toStatus: `${updates.status || caseData.status} (${updates.secondary_status || caseData.secondary_status || '없음'})`,
      changedAt: new Date().toISOString(),
      changedBy: `TG-${feedback.senderName}`,
      memo: memoContent.substring(0, 200),
    };
    updates.status_logs = [log, ...currentLogs];

    // 2. Update case
    const { error: caseUpdateError } = await supabase
      .from('cases')
      .update(updates)
      .eq('case_id', targetCaseId);

    if (caseUpdateError) {
      console.error('[TG] confirmFeedback case update error:', caseUpdateError);
      return false;
    }

    // 3. Update feedback state
    const { error: feedbackError } = await supabase
      .from('telegram_feedbacks')
      .update({
        matched_case_id: targetCaseId,
        is_confirmed: true,
        is_applied: true,
        applied_at: new Date().toISOString(),
        applied_by: appliedBy,
      })
      .eq('id', feedback.id);

    if (feedbackError) {
      console.error('[TG] confirmFeedback feedback update error:', feedbackError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[TG] confirmFeedback generic error:', err);
    return false;
  }
}

/** 피드백 무시 (확인만 하고 CRM 반영하지 않음) */
export async function dismissFeedback(feedbackId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('telegram_feedbacks')
    .update({
      is_confirmed: true,
      is_applied: false,
      applied_at: new Date().toISOString(),
      applied_by: 'dismissed',
    })
    .eq('id', feedbackId);

  if (error) {
    console.error('[TG] dismissFeedback error:', error);
    return false;
  }
  return true;
}

/** 대량 피드백 일괄 승인 */
export async function confirmBatchFeedbacks(
  items: { feedback: TelegramFeedback; options?: ConfirmFeedbackOptions }[],
  appliedBy: string = 'User'
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  for (const item of items) {
    const ok = await confirmFeedback(item.feedback, { ...item.options, appliedBy });
    if (ok) success++;
    else failed++;
  }
  return { success, failed };
}

/** 대량 피드백 일괄 무시 */
export async function dismissBatchFeedbacks(feedbackIds: string[]): Promise<boolean> {
  if (!supabase || feedbackIds.length === 0) return false;
  const { error } = await supabase
    .from('telegram_feedbacks')
    .update({
      is_confirmed: true,
      is_applied: false,
      applied_at: new Date().toISOString(),
      applied_by: 'dismissed',
    })
    .in('id', feedbackIds);

  if (error) {
    console.error('[TG] dismissBatchFeedbacks error:', error);
    return false;
  }
  return true;
}

// ============================================
// Delete Operations
// ============================================

/** 특정 기간의 피드백 영구 삭제 (Hard Delete) */
export async function deleteFeedbacksByDateRange(startDate: string, endDate: string): Promise<boolean> {
  if (!supabase) return false;
  
  const { error } = await supabase
    .from('telegram_feedbacks')
    .delete()
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (error) {
    console.error('[TG] deleteFeedbacksByDateRange error:', error);
    return false;
  }
  return true;
}

// ============================================
// Real-time Subscription
// ============================================

/** 텔레그램 피드백 실시간 구독 */
export function subscribeTelegramFeedbacks(
  onInsert: (feedback: TelegramFeedback) => void
) {
  if (!supabase) return null;

  const channel = supabase
    .channel('telegram-feedbacks-realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'telegram_feedbacks',
      },
      (payload) => {
        if (payload.new) {
          onInsert(dbToFrontend(payload.new as DbTelegramFeedback));
        }
      }
    )
    .subscribe();

  return channel;
}
