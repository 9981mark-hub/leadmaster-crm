// ============================================
// 회사별 텔레그램 봇 연결 (008_telegram_per_org.sql + Edge Function telegram-admin)
// 봇 토큰은 저장만 하고 화면으로 다시 읽어오지 않는다 (끝 4자리만 표시)
// ============================================
import { supabase } from './supabase';

export interface TelegramBotDbStatus {
  hasBot: boolean;
  botUsername?: string;
  tokenTail?: string;
  ownSenderNames: string[];
  webhookSetAt?: string;
}

export interface TelegramBotLiveStatus {
  tokenValid: boolean;
  botUsername?: string;
  webhookConnected: boolean;
  pendingUpdates?: number | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
}

const need = () => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다');
  return supabase;
};

export const fetchTelegramBotDbStatus = async (): Promise<TelegramBotDbStatus | null> => {
  const { data, error } = await need().rpc('get_org_telegram_status');
  if (error) throw new Error(error.message);
  const row = (data || [])[0];
  if (!row) return null;
  return {
    hasBot: !!row.has_bot,
    botUsername: row.bot_username || undefined,
    tokenTail: row.token_tail || undefined,
    ownSenderNames: row.own_sender_names || [],
    webhookSetAt: row.webhook_set_at || undefined,
  };
};

export const saveTelegramBotToken = async (token: string, ownSenderNames?: string[]): Promise<void> => {
  const { error } = await need().rpc('set_org_telegram_bot', {
    p_bot_token: token.trim(),
    p_own_sender_names: ownSenderNames ?? null,
  });
  if (error) throw new Error(error.message);
};

export const saveTelegramOwnSenders = async (names: string[]): Promise<void> => {
  const { error } = await need().rpc('set_org_telegram_senders', { p_own_sender_names: names });
  if (error) throw new Error(error.message);
};

const callAdmin = async (action: 'status' | 'register') => {
  const { data, error } = await need().functions.invoke('telegram-admin', { body: { action } });
  if (error) {
    // Edge Function이 보낸 한국어 오류 메시지를 꺼낸다
    let msg = error.message;
    try { const body = await (error as any).context?.json?.(); if (body?.error) msg = body.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (!data?.ok) throw new Error(data?.error || '요청 실패');
  return data;
};

export const fetchTelegramBotLiveStatus = async (): Promise<TelegramBotLiveStatus> => {
  const d = await callAdmin('status');
  return {
    tokenValid: !!d.tokenValid,
    botUsername: d.botUsername || undefined,
    webhookConnected: !!d.webhookConnected,
    pendingUpdates: d.pendingUpdates,
    lastError: d.lastError,
    lastErrorAt: d.lastErrorAt,
  };
};

export const registerTelegramWebhook = async (): Promise<string | undefined> => {
  const d = await callAdmin('register');
  return d.botUsername || undefined;
};
