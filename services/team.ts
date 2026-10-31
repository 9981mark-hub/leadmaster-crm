// ============================================
// 팀 관리 (멤버·초대·리드 배정) — DB 함수: 007_team_management.sql
// ============================================
import { supabase } from './supabase';
import { OrgRole } from './org';

export interface TeamMember {
  userId: string;
  email: string;
  displayName: string;
  role: OrgRole;
  status: 'active' | 'disabled';
  joinedAt: string;
  lastSignInAt?: string;
  assignedCases: number;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: OrgRole;
  displayName?: string;
  createdAt: string;
  expiresAt: string;
}

const need = () => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다');
  return supabase;
};

/** 한국어 오류 문구로 바꿔서 던진다 (DB 함수가 한국어 메시지를 RAISE함) */
const fail = (error: any): never => {
  const msg = String(error?.message || error || '알 수 없는 오류');
  throw new Error(msg.replace(/^.*?ERROR:\s*/, ''));
};

export const fetchTeamMembers = async (): Promise<TeamMember[]> => {
  const { data, error } = await need().rpc('list_org_members');
  if (error) fail(error);
  return (data || []).map((r: any) => ({
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name || r.email,
    role: r.role,
    status: r.status,
    joinedAt: r.joined_at,
    lastSignInAt: r.last_sign_in_at || undefined,
    assignedCases: Number(r.assigned_cases || 0),
  }));
};

export const updateTeamMember = async (
  userId: string,
  changes: { role?: OrgRole; status?: 'active' | 'disabled'; displayName?: string },
): Promise<void> => {
  const { error } = await need().rpc('update_org_member', {
    p_user_id: userId,
    p_role: changes.role ?? null,
    p_status: changes.status ?? null,
    p_display_name: changes.displayName ?? null,
  });
  if (error) fail(error);
};

export const fetchPendingInvites = async (orgId: string): Promise<TeamInvite[]> => {
  const { data, error } = await need()
    .from('org_invites')
    .select('id, email, role, display_name, created_at, expires_at')
    .eq('org_id', orgId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });
  if (error) fail(error);
  return (data || []).map((r: any) => ({
    id: r.id, email: r.email, role: r.role, displayName: r.display_name || undefined,
    createdAt: r.created_at, expiresAt: r.expires_at,
  }));
};

export const createInvite = async (orgId: string, email: string, role: OrgRole, displayName?: string): Promise<void> => {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error('이메일 형식이 올바르지 않습니다');
  const { error } = await need().from('org_invites').upsert(
    {
      org_id: orgId, email: clean, role, display_name: displayName?.trim() || null,
      accepted_at: null, expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: 'org_id,email' },
  );
  if (error) fail(error);
};

export const cancelInvite = async (inviteId: string): Promise<void> => {
  const { error } = await need().from('org_invites').delete().eq('id', inviteId);
  if (error) fail(error);
};

/** 리드 여러 건 배정 (userId = null 이면 배정 해제). 바뀐 건수 반환 */
export const assignCases = async (caseIds: string[], userId: string | null): Promise<number> => {
  if (caseIds.length === 0) return 0;
  let total = 0;
  // 한 번에 너무 많이 보내지 않도록 500건씩
  for (let i = 0; i < caseIds.length; i += 500) {
    const { data, error } = await need().rpc('assign_cases', { p_case_ids: caseIds.slice(i, i + 500), p_user_id: userId });
    if (error) fail(error);
    total += Number(data || 0);
  }
  return total;
};

/**
 * 순번 배정: 리드를 고른 상담원들에게 차례대로 나눠준다 (A, B, C, A, B, C …).
 * @returns 상담원별 배정 건수
 */
export const assignRoundRobin = async (caseIds: string[], userIds: string[]): Promise<Record<string, number>> => {
  if (userIds.length === 0) throw new Error('나눠줄 상담원을 한 명 이상 고르세요');
  const buckets: Record<string, string[]> = Object.fromEntries(userIds.map(u => [u, []]));
  caseIds.forEach((id, i) => buckets[userIds[i % userIds.length]].push(id));
  const result: Record<string, number> = {};
  for (const uid of userIds) result[uid] = await assignCases(buckets[uid], uid);
  return result;
};
