// ============================================
// 회사 데이터 긴급 영구 파기 (Emergency Kill-Switch)
// RPC: get_emergency_purge_summary, emergency_purge_company_data
// ============================================
import { supabase } from './supabase';
import { Case } from '../types';

export interface PurgeSummary {
  orgId: string;
  orgName: string;
  role: string;
  isOwner: boolean;
  casesCount: number;
  recordingsCount: number;
  dncCount: number;
  batchesCount: number;
}

export interface PurgeResult {
  ok: boolean;
  orgId: string;
  orgName: string;
  purgedCases: number;
  purgedRecordings: number;
  purgedDnc: number;
  executedAt: string;
}

const need = () => {
  if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
  return supabase;
};

/**
 * 긴급 파기 대상 현황 사전 조회 (RPC)
 */
export const fetchPurgeSummary = async (): Promise<PurgeSummary> => {
  const { data, error } = await need().rpc('get_emergency_purge_summary');
  if (error) {
    throw new Error(error.message || '파기 요약 정보를 불러오지 못했습니다.');
  }

  return {
    orgId: data.org_id,
    orgName: data.org_name,
    role: data.role,
    isOwner: Boolean(data.is_owner),
    casesCount: Number(data.cases_count || 0),
    recordingsCount: Number(data.recordings_count || 0),
    dncCount: Number(data.dnc_count || 0),
    batchesCount: Number(data.batches_count || 0),
  };
};

/**
 * 파기 직전 오프라인 비상 백업 JSON 파일 다운로드
 */
export const downloadEmergencyBackupFile = (
  orgName: string,
  cases: Case[],
  summary: PurgeSummary
) => {
  const backupPayload = {
    meta: {
      title: 'LEADMASTER EMERGENCY OFFLINE BACKUP',
      orgId: summary.orgId,
      orgName: orgName,
      exportedAt: new Date().toISOString(),
      casesCount: cases.length,
      notice: '본 파일은 법적 비상 사태 대비 대표자 소장용 오프라인 백업입니다. 개인정보보호법에 의거하여 안전하게 보관하십시오.',
    },
    cases: cases,
  };

  const jsonStr = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `[비상백업]_${orgName}_${nowStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * 회사 DB 완전 영구 파기 RPC 실행
 */
export const executeEmergencyPurge = async (
  confirmText: string,
  reason: string = 'Emergency Purge Requested by Owner'
): Promise<PurgeResult> => {
  const { data, error } = await need().rpc('emergency_purge_company_data', {
    p_confirm_text: confirmText,
    p_reason: reason,
  });

  if (error) {
    throw new Error(error.message || '데이터 영구 파기 실행에 실패했습니다.');
  }

  // 브라우저 로컬 캐시 즉시 비우기
  try {
    localStorage.removeItem('lm_cases');
    localStorage.removeItem('lm_active_calls');
    localStorage.removeItem('lm_dnc');
  } catch {
    // Ignore storage clear error
  }

  return {
    ok: Boolean(data.ok),
    orgId: data.org_id,
    orgName: data.org_name,
    purgedCases: Number(data.purged_cases || 0),
    purgedRecordings: Number(data.purged_recordings || 0),
    purgedDnc: Number(data.purged_dnc || 0),
    executedAt: data.executed_at,
  };
};
