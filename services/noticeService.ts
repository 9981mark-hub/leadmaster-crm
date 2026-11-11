import { supabase } from './supabase';

export interface Notice {
  id: string;
  org_id?: string | null;
  created_by: string;
  created_by_name?: string;
  title: string;
  content: string;
  notice_type: 'general' | 'urgent' | 'policy' | 'promotion';
  display_mode: 'banner' | 'feed' | 'modal';
  target_type: 'all' | 'team' | 'user';
  target_ids?: string[];
  is_pinned: boolean;
  starts_at: string;
  ends_at?: string | null;
  created_at: string;
  updated_at: string;
  is_read?: boolean;
  read_count?: number;
  // 멀티테넌트 B2B SaaS 플랫폼 공지 전용 필드
  is_platform_notice?: boolean;
  platform_target_role?: 'all' | 'admins_only';
  target_org_ids?: string[];
  require_popup_lock?: boolean;
}

export interface Directive {
  id: string;
  org_id: string;
  created_by: string;
  created_by_name?: string;
  assigned_to: string;
  assigned_to_name?: string;
  case_id?: string | null;
  case_name?: string | null;
  title: string;
  description?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'closed';
  due_date?: string | null;
  result_memo?: string | null;
  completed_at?: string | null;
  created_at: string;
}

const need = () => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');
  return supabase;
};

// 1. 활성 띠배너 공지 목록 조회 (상담원/관리자 공통, 상단 띠배너용)
export async function fetchActiveBanners(): Promise<Notice[]> {
  const sb = need();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('notices')
    .select('*')
    .eq('display_mode', 'banner')
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('fetchActiveBanners error:', error);
    return [];
  }

  // 내가 읽었는지(닫았는지) 확인
  const { data: reads } = await sb
    .from('notice_reads')
    .select('notice_id')
    .eq('user_id', user.id);

  const readSet = new Set((reads || []).map(r => r.notice_id));
  return (data || []).map(n => ({
    ...n,
    is_read: readSet.has(n.id)
  }));
}

// 2. 전체 공지사항 목록 조회 (공지사항 메뉴용)
export async function fetchNotices(): Promise<Notice[]> {
  const sb = need();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const { data, error } = await sb
    .from('notices')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  const { data: reads } = await sb
    .from('notice_reads')
    .select('notice_id')
    .eq('user_id', user.id);

  const readSet = new Set((reads || []).map(r => r.notice_id));

  // 읽음 카운트 가져오기
  const { data: allReads } = await sb
    .from('notice_reads')
    .select('notice_id');

  const countMap = new Map<string, number>();
  (allReads || []).forEach(r => {
    countMap.set(r.notice_id, (countMap.get(r.notice_id) || 0) + 1);
  });

  return (data || []).map(n => ({
    ...n,
    is_read: readSet.has(n.id),
    read_count: countMap.get(n.id) || 0
  }));
}

// 3. 새 공지사항 등록 (관리자 / 플랫폼 총괄 운영자)
export async function createNotice(payload: {
  title: string;
  content: string;
  notice_type?: 'general' | 'urgent' | 'policy' | 'promotion';
  display_mode?: 'banner' | 'feed' | 'modal';
  target_type?: 'all' | 'team' | 'user';
  target_ids?: string[];
  is_pinned?: boolean;
  ends_at?: string | null;
  // 플랫폼 공지 전용 파라미터
  is_platform_notice?: boolean;
  platform_target_role?: 'all' | 'admins_only';
  target_org_ids?: string[];
  require_popup_lock?: boolean;
}): Promise<Notice> {
  const sb = need();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const { data, error } = await sb
    .from('notices')
    .insert([{
      ...payload,
      created_by: user.id,
      notice_type: payload.notice_type || 'general',
      display_mode: payload.display_mode || 'banner',
      is_platform_notice: !!payload.is_platform_notice,
      platform_target_role: payload.platform_target_role || 'all',
      target_org_ids: payload.target_org_ids || [],
      require_popup_lock: !!payload.require_popup_lock
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 4. 공지사항 삭제 (관리자)
export async function deleteNotice(noticeId: string): Promise<void> {
  const sb = need();
  const { error } = await sb
    .from('notices')
    .delete()
    .eq('id', noticeId);

  if (error) throw error;
}

// 5. 공지사항 읽음 처리
export async function markNoticeRead(noticeId: string): Promise<void> {
  const sb = need();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { error } = await sb
    .from('notice_reads')
    .upsert([{
      notice_id: noticeId,
      user_id: user.id,
      read_at: new Date().toISOString(),
      confirmed: true,
      confirmed_at: new Date().toISOString()
    }], { onConflict: 'notice_id,user_id' });

  if (error) console.warn('markNoticeRead error:', error);
}

// 6. 업무 지시사항 목록 조회
export async function fetchDirectives(): Promise<Directive[]> {
  const sb = need();
  const { data, error } = await sb
    .from('directives')
    .select('*, cases(customer_name)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((d: any) => ({
    ...d,
    case_name: d.cases?.customer_name || null
  }));
}

// 7. 업무 지시사항 등록 (관리자)
export async function createDirective(payload: {
  assigned_to: string;
  title: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  case_id?: string | null;
  due_date?: string | null;
}): Promise<Directive> {
  const sb = need();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const { data, error } = await sb
    .from('directives')
    .insert([{
      ...payload,
      created_by: user.id,
      priority: payload.priority || 'normal',
      status: 'pending'
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 8. 업무 지시 상태 갱신 (확인 / 완료)
export async function updateDirectiveStatus(
  id: string,
  status: 'pending' | 'in_progress' | 'completed' | 'closed',
  resultMemo?: string
): Promise<void> {
  const sb = need();
  const updateData: any = { status, updated_at: new Date().toISOString() };
  if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
    if (resultMemo !== undefined) updateData.result_memo = resultMemo;
  }

  const { error } = await sb
    .from('directives')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
}

// 9. 특정 공지의 수신/미수신 멤버 조회 (관리자용 통계)
export async function fetchNoticeReadStats(noticeId: string): Promise<{
  readMembers: { userId: string; displayName: string; readAt: string }[];
  unreadMembers: { userId: string; displayName: string }[];
}> {
  const sb = need();
  const { data: members, error: mErr } = await sb.rpc('list_org_members');
  if (mErr) throw mErr;

  const { data: reads, error: rErr } = await sb
    .from('notice_reads')
    .select('user_id, read_at')
    .eq('notice_id', noticeId);
  if (rErr) throw rErr;

  const readMap = new Map<string, string>();
  (reads || []).forEach((r: any) => readMap.set(r.user_id, r.read_at));

  const readMembers: any[] = [];
  const unreadMembers: any[] = [];

  (members || []).forEach((m: any) => {
    if (readMap.has(m.user_id)) {
      readMembers.push({
        userId: m.user_id,
        displayName: m.display_name || m.email,
        readAt: readMap.get(m.user_id)
      });
    } else {
      unreadMembers.push({
        userId: m.user_id,
        displayName: m.display_name || m.email
      });
    }
  });

  return { readMembers, unreadMembers };
}