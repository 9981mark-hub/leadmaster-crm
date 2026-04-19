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
    .select('*')
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
    .select('*')
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
    .select('*')
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

/** 피드백 승인 (CRM 반영 완료 표시) */
export async function confirmFeedback(
  feedbackId: string,
  appliedBy: string = 'User'
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('telegram_feedbacks')
    .update({
      is_confirmed: true,
      is_applied: true,
      applied_at: new Date().toISOString(),
      applied_by: appliedBy,
    })
    .eq('id', feedbackId);

  if (error) {
    console.error('[TG] confirmFeedback error:', error);
    return false;
  }
  return true;
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
