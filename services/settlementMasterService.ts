/**
 * services/settlementMasterService.ts
 * 통합 정산 & 경영 손익(P&L) 서비스
 *
 * - 정책 읽기/저장(org_settlement_policies, 회사별 1행)은 여기서
 * - 계산(분배·거래처 카드·상담원 수당·P&L)은 utils/settlementMaster.ts (서버 없이 점검 가능)
 */

import { supabase } from './supabase';
import { loadCachedOrg } from './org';
import {
  SettlementPolicy,
  DEFAULT_SETTLEMENT_POLICY,
  policyFromRow,
  policyToRow,
} from '../utils/settlementMaster';

export * from '../utils/settlementMaster';

// -------------------------------------------------------------
// 정책 읽기/저장
// -------------------------------------------------------------

/**
 * saved          : 서버에 저장된 회사 정책
 * default_unsaved: 표는 있지만 아직 저장한 정책 없음 → 기본값(저장 안 됨)
 * table_missing  : 서버에 정책 표가 아직 없음 → 서버 업데이트 필요
 * no_org         : 회사 정보를 모름 (로그인 확인 전)
 * error          : 읽기 실패 (네트워크 등)
 */
export type SettlementPolicySource = 'saved' | 'default_unsaved' | 'table_missing' | 'no_org' | 'error';

export interface SettlementPolicyLoad {
  policy: SettlementPolicy;
  source: SettlementPolicySource;
  message?: string;
}

const TABLE = 'org_settlement_policies';

/** PostgREST: 표 없음 = PGRST205 (schema cache), Postgres: 42P01 */
export const isMissingTableError = (err: any): boolean => {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  return code === 'PGRST205' || code === '42P01'
    || (msg.includes(TABLE) && /does not exist|schema cache|Could not find/i.test(msg));
};

export const SETTLEMENT_POLICY_TABLE_MISSING_MESSAGE =
  '서버 업데이트 필요: 정산 정책 표가 아직 서버에 없어 저장할 수 없습니다. 지금 화면의 분배는 기본값(회사 40% : 상담원 60%)으로 계산한 것입니다.';

const currentOrgId = (orgId?: string) => orgId || loadCachedOrg()?.orgId || undefined;

export async function loadSettlementPolicy(orgId?: string): Promise<SettlementPolicyLoad> {
  const org = currentOrgId(orgId);
  const fallback = { ...DEFAULT_SETTLEMENT_POLICY };
  if (!supabase) return { policy: fallback, source: 'error', message: '서버에 연결되어 있지 않습니다.' };
  if (!org) return { policy: fallback, source: 'no_org', message: '회사 정보를 확인하지 못해 기본값으로 계산합니다.' };
  try {
    const { data, error } = await supabase.from(TABLE).select('*').eq('org_id', org).maybeSingle();
    if (error) {
      if (isMissingTableError(error)) return { policy: fallback, source: 'table_missing', message: SETTLEMENT_POLICY_TABLE_MISSING_MESSAGE };
      console.warn('[SettlementMaster] loadSettlementPolicy error:', error.message);
      return { policy: fallback, source: 'error', message: '정산 정책을 읽지 못해 기본값으로 계산합니다.' };
    }
    if (!data) return { policy: { ...fallback, orgId: org }, source: 'default_unsaved' };
    return { policy: policyFromRow(data), source: 'saved' };
  } catch (err) {
    console.warn('[SettlementMaster] loadSettlementPolicy fallback:', err);
    return { policy: fallback, source: 'error', message: '정산 정책을 읽지 못해 기본값으로 계산합니다.' };
  }
}

/** 예전 호출 호환: 정책만 */
export async function fetchSettlementPolicy(orgId?: string): Promise<SettlementPolicy> {
  return (await loadSettlementPolicy(orgId)).policy;
}

/** 현재 회사 정책 저장 (회사당 1행, org_id 기준 upsert). 저장된 정책을 돌려준다 */
export async function saveSettlementPolicy(policy: SettlementPolicy, orgId?: string): Promise<SettlementPolicy> {
  if (!supabase) throw new Error('서버에 연결되어 있지 않아 저장하지 못했습니다.');
  const org = currentOrgId(orgId || policy.orgId);
  if (!org) throw new Error('회사 정보를 확인하지 못해 저장하지 못했습니다. 다시 로그인해 주세요.');

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(policyToRow(policy, org), { onConflict: 'org_id' })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[SettlementMaster] saveSettlementPolicy error:', error.message);
    if (isMissingTableError(error)) throw new Error(SETTLEMENT_POLICY_TABLE_MISSING_MESSAGE);
    throw new Error(`정책 저장에 실패했습니다: ${error.message}`);
  }
  return data ? policyFromRow(data) : { ...policyFromRow(policyToRow(policy, org)), orgId: org };
}
