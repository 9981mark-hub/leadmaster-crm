// ==============================================================================
// services/supportInquiryService.ts
// 1:1 서비스 문의 접수 · 플랫폼 총괄 관리자 실시간 알림 및 답변 · 문의자 답변 확인
// ==============================================================================
import { supabase } from './supabase';
import { StandardRoleKey } from './org';

export type InquiryCategory =
  | 'account_auth'
  | 'call_app'
  | 'telegram'
  | 'settlement_billing'
  | 'cases_autodial'
  | 'bug_error'
  | 'feature_request';

export type InquiryStatus = 'open' | 'in_progress' | 'answered' | 'closed';
export type InquiryPriority = 'normal' | 'urgent';

export interface SupportInquiry {
  id: string;
  orgId: string;
  orgName: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: StandardRoleKey;
  category: InquiryCategory;
  priority: InquiryPriority;
  subject: string;
  content: string;
  contextMeta: Record<string, any>;
  status: InquiryStatus;
  adminReply?: string | null;
  repliedBy?: string | null;
  repliedAt?: string | null;
  userReadReply: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInquiryInput {
  orgId: string;
  orgName: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: StandardRoleKey;
  category: InquiryCategory;
  priority: InquiryPriority;
  subject: string;
  content: string;
  contextMeta?: Record<string, any>;
}

export const INQUIRY_CATEGORY_META: Record<
  InquiryCategory,
  { label: string; desc: string }
> = {
  account_auth: { label: '계정 · 로그인 · 등급권한', desc: '초대 수락, 접근 권한, 세션 차단' },
  call_app: { label: '안드로이드 앱 · 010 통화 · 녹음', desc: '발신/수신 팝업, 녹음 업로드, 권한 설정' },
  telegram: { label: '텔레그램 봇 · 방 전송 · 피드백', desc: 'BotFather 설정, 방 연결, 전송 오류' },
  settlement_billing: { label: '요금제 · 정산 · 좌석 증설', desc: '이용료, 청구서, 인센티브/DB 정산' },
  cases_autodial: { label: '케이스 · 오토콜 · 교육/모의콜', desc: 'DB 엑셀 업로드, 자동분배, 오토콜, 모의콜' },
  bug_error: { label: '화면 오류 · 버그 신고', desc: '동작 불량, 데이터 미표시, 속도 이슈' },
  feature_request: { label: '기능 개선 · 추가 제안', desc: '신규 기능 아이디어, 불편 사항 개선' },
};

const LOCAL_KEY = 'lm_support_inquiries_fallback';
const SUPPORT_BROADCAST_CHANNEL = 'support_inquiries_realtime';

const mapRow = (row: any): SupportInquiry => ({
  id: row.id,
  orgId: row.org_id || '',
  orgName: row.org_name || '소속 미지정',
  userId: row.user_id,
  userEmail: row.user_email || '',
  userName: row.user_name || '',
  userRole: (row.user_role || 'agent') as StandardRoleKey,
  category: (row.category || 'bug_error') as InquiryCategory,
  priority: (row.priority || 'normal') as InquiryPriority,
  subject: row.subject || '',
  content: row.content || '',
  contextMeta: row.context_meta || {},
  status: (row.status || 'open') as InquiryStatus,
  adminReply: row.admin_reply ?? null,
  repliedBy: row.replied_by ?? null,
  repliedAt: row.replied_at ?? null,
  userReadReply: row.user_read_reply !== false,
  createdAt: row.created_at || new Date().toISOString(),
  updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
});

const readLocal = (): SupportInquiry[] => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeLocal = (items: SupportInquiry[]) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
};

const broadcastSupportEvent = async (event: {
  type: 'new_inquiry' | 'inquiry_replied';
  inquiryId: string;
  userId?: string;
  subject?: string;
  orgName?: string;
}) => {
  if (!supabase) return;
  try {
    const ch = supabase.channel(SUPPORT_BROADCAST_CHANNEL);
    await ch.send({
      type: 'broadcast',
      event: 'support_alert',
      payload: event,
    });
    supabase.removeChannel(ch);
  } catch { /* ignore */ }
};

export const submitSupportInquiry = async (
  input: CreateInquiryInput
): Promise<SupportInquiry> => {
  const now = new Date().toISOString();
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `inq-${Date.now()}`;

  const fallbackItem: SupportInquiry = {
    id,
    orgId: input.orgId,
    orgName: input.orgName || '미지정 조직',
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    userRole: input.userRole,
    category: input.category,
    priority: input.priority,
    subject: input.subject.trim(),
    content: input.content.trim(),
    contextMeta: input.contextMeta || {},
    status: 'open',
    adminReply: null,
    repliedBy: null,
    repliedAt: null,
    userReadReply: true,
    createdAt: now,
    updatedAt: now,
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('support_inquiries')
        .insert({
          id,
          org_id: input.orgId || null,
          org_name: fallbackItem.orgName,
          user_id: input.userId,
          user_email: input.userEmail,
          user_name: input.userName,
          user_role: input.userRole,
          category: input.category,
          priority: input.priority,
          subject: fallbackItem.subject,
          content: fallbackItem.content,
          context_meta: fallbackItem.contextMeta,
          status: 'open',
          user_read_reply: true,
        })
        .select('*')
        .single();

      if (!error && data) {
        const mapped = mapRow(data);
        await broadcastSupportEvent({
          type: 'new_inquiry',
          inquiryId: mapped.id,
          userId: mapped.userId,
          subject: mapped.subject,
          orgName: mapped.orgName,
        });
        return mapped;
      }
      if (error) {
        console.warn('[SupportInquiry] DB insert fallback:', error.message);
      }
    } catch (e) {
      console.warn('[SupportInquiry] DB insert exception:', e);
    }
  }

  const next = [fallbackItem, ...readLocal()];
  writeLocal(next);
  await broadcastSupportEvent({
    type: 'new_inquiry',
    inquiryId: fallbackItem.id,
    userId: fallbackItem.userId,
    subject: fallbackItem.subject,
    orgName: fallbackItem.orgName,
  });
  return fallbackItem;
};

export const fetchMyInquiries = async (userId: string): Promise<SupportInquiry[]> => {
  if (!userId) return [];
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('support_inquiries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data.map(mapRow);
      }
    } catch { /* fallback */ }
  }
  return readLocal().filter(it => it.userId === userId);
};

export const fetchAllInquiriesForPlatform = async (): Promise<SupportInquiry[]> => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('support_inquiries')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data.map(mapRow);
      }
    } catch { /* fallback */ }
  }
  return readLocal();
};

export const replyToSupportInquiry = async (
  inquiry: SupportInquiry,
  replyText: string,
  nextStatus: Extract<InquiryStatus, 'in_progress' | 'answered' | 'closed'>,
  adminEmail: string
): Promise<SupportInquiry> => {
  const now = new Date().toISOString();
  const trimmedReply = replyText.trim();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('support_inquiries')
        .update({
          admin_reply: trimmedReply,
          status: nextStatus,
          replied_by: adminEmail,
          replied_at: now,
          user_read_reply: false,
          updated_at: now,
        })
        .eq('id', inquiry.id)
        .select('*')
        .single();
      if (!error && data) {
        const mapped = mapRow(data);
        await broadcastSupportEvent({
          type: 'inquiry_replied',
          inquiryId: mapped.id,
          userId: mapped.userId,
          subject: mapped.subject,
          orgName: mapped.orgName,
        });
        return mapped;
      }
    } catch { /* fallback */ }
  }

  const updated: SupportInquiry = {
    ...inquiry,
    adminReply: trimmedReply,
    status: nextStatus,
    repliedBy: adminEmail,
    repliedAt: now,
    userReadReply: false,
    updatedAt: now,
  };
  writeLocal(readLocal().map(it => (it.id === inquiry.id ? updated : it)));
  await broadcastSupportEvent({
    type: 'inquiry_replied',
    inquiryId: updated.id,
    userId: updated.userId,
    subject: updated.subject,
    orgName: updated.orgName,
  });
  return updated;
};

export const markInquiryReplyRead = async (inquiryId: string): Promise<void> => {
  if (supabase) {
    try {
      await supabase
        .from('support_inquiries')
        .update({ user_read_reply: true, updated_at: new Date().toISOString() })
        .eq('id', inquiryId);
    } catch { /* fallback */ }
  }
  writeLocal(
    readLocal().map(it => (it.id === inquiryId ? { ...it, userReadReply: true } : it))
  );
};

export const subscribeToSupportAlerts = (
  onUpdate: (payload?: { type?: string; userId?: string; subject?: string; orgName?: string }) => void
): (() => void) => {
  if (!supabase) return () => {};

  const dbChannel = supabase
    .channel(`support_inquiries_db_${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'support_inquiries' },
      (payload: any) => {
        const row = payload?.new;
        onUpdate({
          type: payload?.eventType === 'INSERT' ? 'new_inquiry' : 'inquiry_replied',
          userId: row?.user_id,
          subject: row?.subject,
          orgName: row?.org_name,
        });
      }
    )
    .subscribe();

  const bChannel = supabase
    .channel(SUPPORT_BROADCAST_CHANNEL)
    .on('broadcast', { event: 'support_alert' }, (msg: any) => {
      onUpdate(msg?.payload);
    })
    .subscribe();

  return () => {
    supabase?.removeChannel(dbChannel);
    supabase?.removeChannel(bChannel);
  };
};
