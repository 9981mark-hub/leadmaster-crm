// ============================================
// 플랫폼 관리 (HOST 전용) — DB 함수: 004 create_organization, 012 list_organizations / set_organization_status
// ============================================
import { supabase } from './supabase';

export interface PlatformOrg {
  id: string;
  name: string;
  slug?: string;
  status: 'active' | 'suspended';
  createdAt: string;
  members: number;
  activeMembers: number;
  cases: number;
  ownerInviteEmail?: string;
  ownerInviteAccepted: boolean;
  hasTelegramBot: boolean;
}

const need = () => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다');
  return supabase;
};
const fail = (error: any): never => {
  const msg = String(error?.message || error || '알 수 없는 오류');
  throw new Error(msg.replace(/^.*?ERROR:\s*/, ''));
};

export const fetchOrganizations = async (): Promise<PlatformOrg[]> => {
  const { data, error } = await need().rpc('list_organizations');
  if (error) fail(error);
  return (data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    slug: r.slug || undefined,
    status: r.status,
    createdAt: r.created_at,
    members: Number(r.members || 0),
    activeMembers: Number(r.active_members || 0),
    cases: Number(r.cases || 0),
    ownerInviteEmail: r.owner_invite_email || undefined,
    ownerInviteAccepted: !!r.owner_invite_accepted,
    hasTelegramBot: !!r.has_telegram_bot,
  }));
};

/** 새 고객 회사 생성 + 대표(owner) 초대. 대표가 그 구글 계정으로 로그인하면 자동으로 회사에 들어간다 */
export const createOrganization = async (name: string, ownerEmail: string): Promise<string> => {
  const n = name.trim();
  const e = ownerEmail.trim().toLowerCase();
  if (n.length < 2) throw new Error('회사 이름을 입력하세요');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('대표 이메일 형식이 올바르지 않습니다');
  const { data, error } = await need().rpc('create_organization', { p_name: n, p_owner_email: e, p_slug: null });
  if (error) fail(error);
  return String(data);
};

export const setOrganizationStatus = async (orgId: string, status: 'active' | 'suspended'): Promise<void> => {
  const { error } = await need().rpc('set_organization_status', { p_org_id: orgId, p_status: status });
  if (error) fail(error);
};
