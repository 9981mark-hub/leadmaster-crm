// ============================================
// 리드 → 변호사 사무실 텔레그램 방 전달 (009_telegram_delivery.sql + Edge Function telegram-deliver)
// 회사 봇이 보내고, 보낸 메시지 번호를 기록해 두면 사무실의 "답장"이 자동으로 이 리드에 연결된다.
// ============================================
import { supabase } from './supabase';

export interface CaseDelivery {
  id: string;
  chatId: string;
  chatTitle?: string;
  messageId: number;
  partNo: number;
  partCount: number;
  sentByEmail?: string;
  sentAt: string;
}

export interface KnownTelegramChat {
  chatId: string;
  title?: string;
  chatType?: string;
  botStatus?: string;
  migratedTo?: string;
  lastMessageAt?: string;
}

export class DeliveryError extends Error {
  code?: string;
  constructor(message: string, code?: string) { super(message); this.code = code; }
}

const need = () => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다');
  return supabase;
};

const invokeDeliver = async (body: Record<string, unknown>) => {
  const { data, error } = await need().functions.invoke('telegram-deliver', { body });
  if (error) {
    let msg = error.message;
    let code: string | undefined;
    try {
      const b = await (error as any).context?.json?.();
      if (b?.error) msg = b.error;
      code = b?.code;
    } catch { /* ignore */ }
    throw new DeliveryError(msg, code);
  }
  if (!data?.ok) throw new DeliveryError(data?.error || '요청 실패', data?.code);
  return data;
};

/** 리드 전달. 60초 안에 같은 리드를 다시 보내면 code='RECENT' 오류 → force=true로 다시 호출 */
export const deliverCaseToTelegram = async (caseId: string, text: string, force = false):
  Promise<{ chatTitle?: string; partnerName?: string; parts: number }> => {
  const d = await invokeDeliver({ action: 'deliver', caseId, text, force });
  return { chatTitle: d.chatTitle || undefined, partnerName: d.partnerName || undefined, parts: d.parts || 1 };
};

/** 관리자: 방에 연결 시험 메시지 */
export const sendTelegramTestMessage = async (chatId: string): Promise<string | undefined> => {
  const d = await invokeDeliver({ action: 'test', chatId });
  return d.chatTitle || undefined;
};

/** 이 리드의 전달 기록 (최근 순). 테이블이 아직 없거나 권한이 없으면 빈 목록 */
export const fetchCaseDeliveries = async (caseId: string): Promise<CaseDelivery[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('case_deliveries')
    .select('id, chat_id, chat_title, message_id, part_no, part_count, sent_by_email, sent_at')
    .eq('case_id', caseId)
    .order('sent_at', { ascending: false })
    .limit(20);
  if (error) { console.warn('[Delivery] 기록 조회 실패', error.message); return []; }
  return (data || []).map((r: any) => ({
    id: r.id,
    chatId: r.chat_id,
    chatTitle: r.chat_title || undefined,
    messageId: Number(r.message_id),
    partNo: r.part_no,
    partCount: r.part_count,
    sentByEmail: r.sent_by_email || undefined,
    sentAt: r.sent_at,
  }));
};

/** 관리자: 회사 봇이 들어가 있는(또는 메시지를 받은) 방 목록 */
export const fetchKnownTelegramChats = async (): Promise<KnownTelegramChat[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('org_telegram_chats')
    .select('chat_id, title, chat_type, bot_status, migrated_to, last_message_at')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) { console.warn('[Delivery] 방 목록 조회 실패', error.message); return []; }
  return (data || []).map((r: any) => ({
    chatId: r.chat_id,
    title: r.title || undefined,
    chatType: r.chat_type || undefined,
    botStatus: r.bot_status || undefined,
    migratedTo: r.migrated_to || undefined,
    lastMessageAt: r.last_message_at || undefined,
  }));
};
