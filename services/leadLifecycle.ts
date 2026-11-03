// ============================================
// 스마트 리드 수명주기(Lifecycle) 및 데이터 아카이브·보안 거버넌스
// DB: cases (is_archived, archived_at, archived_reason, archived_by)
//     org_lifecycle_policies
// RPC: get_lifecycle_stats, archive_cases, restore_archived_cases, run_auto_lifecycle_cleanup
// ============================================
import { supabase } from './supabase';
import { Case } from '../types';

export interface LifecycleStats {
  activeCount: number;
  archivedCount: number;
  trashCount: number;
}

export interface LifecyclePolicy {
  autoArchiveContract: boolean;
  contractGraceDays: number;
  autoArchiveStale: boolean;
  staleDays: number;
  autoTrashInvalid: boolean;
}

export const DEFAULT_LIFECYCLE_POLICY: LifecyclePolicy = {
  autoArchiveContract: true,
  contractGraceDays: 7,
  autoArchiveStale: true,
  staleDays: 45,
  autoTrashInvalid: true,
};

const need = () => {
  if (!supabase) throw new Error('Supabase 클라이언트가 설정되지 않았습니다.');
  return supabase;
};

/**
 * 수명주기 통계 조회 (활성, 보관함, 휴지통 건수)
 */
export const fetchLifecycleStats = async (localCasesList: Case[] = []): Promise<LifecycleStats> => {
  try {
    const { data, error } = await need().rpc('get_lifecycle_stats');
    if (!error && data) {
      return {
        activeCount: Number(data.active_count || 0),
        archivedCount: Number(data.archived_count || 0),
        trashCount: Number(data.trash_count || 0),
      };
    }
  } catch {
    // RPC 실패 시 클라이언트 캐시 기반 폴백 계산
  }

  const active = localCasesList.filter(c => !c.deletedAt && !c.isArchived).length;
  const archived = localCasesList.filter(c => !c.deletedAt && !!c.isArchived).length;
  const trash = localCasesList.filter(c => !!c.deletedAt).length;

  return {
    activeCount: active,
    archivedCount: archived,
    trashCount: trash,
  };
};

/**
 * 회사별 자동 수명주기 정책 조회
 */
export const fetchLifecyclePolicy = async (): Promise<LifecyclePolicy> => {
  try {
    const { data, error } = await need()
      .from('org_lifecycle_policies')
      .select('*')
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_LIFECYCLE_POLICY;
    }

    return {
      autoArchiveContract: data.auto_archive_contract ?? true,
      contractGraceDays: Number(data.contract_grace_days ?? 7),
      autoArchiveStale: data.auto_archive_stale ?? true,
      staleDays: Number(data.stale_days ?? 45),
      autoTrashInvalid: data.auto_trash_invalid ?? true,
    };
  } catch (e) {
    console.warn('[Lifecycle] policy fetch fallback to default:', e);
    return DEFAULT_LIFECYCLE_POLICY;
  }
};

/**
 * 회사별 자동 수명주기 정책 저장
 */
export const saveLifecyclePolicy = async (policy: LifecyclePolicy): Promise<void> => {
  const { error } = await need()
    .from('org_lifecycle_policies')
    .upsert({
      auto_archive_contract: policy.autoArchiveContract,
      contract_grace_days: policy.contractGraceDays,
      auto_archive_stale: policy.autoArchiveStale,
      stale_days: policy.staleDays,
      auto_trash_invalid: policy.autoTrashInvalid,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(error.message || '정책 저장 실패');
  }
};

/**
 * 선택 리드 일괄 보관함(상담원 숨김) 처리
 */
export const archiveCases = async (
  caseIds: string[],
  reason: string = 'manual'
): Promise<number> => {
  if (!caseIds || caseIds.length === 0) return 0;

  try {
    const { data, error } = await need().rpc('archive_cases', {
      p_case_ids: caseIds,
      p_reason: reason,
    });
    if (!error) return Number(data || 0);
  } catch {
    // RPC 실패 시 테이블 직접 업데이트 폴백
  }

  const { data, error } = await need()
    .from('cases')
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .in('case_id', caseIds)
    .select('case_id');

  if (error) throw new Error(error.message || '리드 보관 처리 실패');
  return data?.length || 0;
};

/**
 * 선택 리드 보관 해제 (활성 리드로 복원)
 */
export const restoreArchivedCases = async (caseIds: string[]): Promise<number> => {
  if (!caseIds || caseIds.length === 0) return 0;

  try {
    const { data, error } = await need().rpc('restore_archived_cases', {
      p_case_ids: caseIds,
    });
    if (!error) return Number(data || 0);
  } catch {
    // RPC 실패 시 테이블 직접 업데이트 폴백
  }

  const { data, error } = await need()
    .from('cases')
    .update({
      is_archived: false,
      archived_at: null,
      archived_reason: null,
      updated_at: new Date().toISOString(),
    })
    .in('case_id', caseIds)
    .select('case_id');

  if (error) throw new Error(error.message || '리드 복원 처리 실패');
  return data?.length || 0;
};

/**
 * 자동 수명주기 정리 지금 즉시 실행
 */
export const runAutoLifecycleCleanup = async (): Promise<{
  archivedContracts: number;
  archivedStale: number;
  trashedInvalid: number;
}> => {
  const { data, error } = await need().rpc('run_auto_lifecycle_cleanup');
  if (error) {
    throw new Error(error.message || '자동 정리 실행 실패');
  }

  return {
    archivedContracts: Number(data?.archived_contracts || 0),
    archivedStale: Number(data?.archived_stale || 0),
    trashedInvalid: Number(data?.trashed_invalid || 0),
  };
};
