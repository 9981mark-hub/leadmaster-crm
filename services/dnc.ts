import { supabase } from './supabase';

export interface DncRecord {
  id: number;
  phoneNumber: string;
  reason: 'refusal' | 'wrong_number' | 'abuse' | 'invalid';
  registeredBy?: string;
  sourceCaseId?: string;
  note?: string;
  createdAt: string;
}

export const DNC_REASON_LABEL: Record<string, string> = {
  refusal: '수신 거부 (통화 원치 않음)',
  wrong_number: '신청 안 함 (오신청/타인)',
  abuse: '악성 민원 / 욕설',
  invalid: '결번 / 없는 번호',
};

const need = () => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다');
  return supabase;
};

/** DNC 목록 조회 */
export const fetchDncList = async (limit = 100): Promise<DncRecord[]> => {
  try {
    const { data, error } = await need()
      .from('org_dnc_numbers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[DNC] fetchDncList error:', error.message);
      return [];
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      phoneNumber: r.phone_number,
      reason: r.reason,
      registeredBy: r.registered_by || undefined,
      sourceCaseId: r.source_case_id || undefined,
      note: r.note || undefined,
      createdAt: r.created_at,
    }));
  } catch (e) {
    console.error('[DNC] fetchDncList exception:', e);
    return [];
  }
};

/** 수신거부(DNC) 번호 등록 및 케이스 수신정지 동기화 */
export const registerDnc = async (
  phone: string,
  reason: 'refusal' | 'wrong_number' | 'abuse' | 'invalid' = 'refusal',
  caseId?: string,
  note?: string
): Promise<boolean> => {
  try {
    const { data, error } = await need().rpc('register_dnc_number', {
      p_phone: phone,
      p_reason: reason,
      p_case_id: caseId || null,
      p_note: note || null,
    });
    if (error) throw error;
    return !!data;
  } catch (e: any) {
    console.error('[DNC] registerDnc error:', e);
    throw e;
  }
};

/** DNC 차단 해제 */
export const removeDnc = async (id: number): Promise<void> => {
  const { error } = await need().from('org_dnc_numbers').delete().eq('id', id);
  if (error) throw error;
};

/** 번호 목록 중 DNC로 등록된 번호 확인 (대량 업로드 사전 필터용) */
export const findDncPhones = async (phones: string[]): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  if (phones.length === 0) return out;

  for (let i = 0; i < phones.length; i += 1000) {
    const chunk = phones.slice(i, i + 1000);
    const { data, error } = await need().rpc('find_dnc_phones', { p_phones: chunk });
    if (error) {
      console.warn('[DNC] findDncPhones error:', error.message);
      continue;
    }
    (data || []).forEach((r: any) => out.set(r.phone_number, r.reason));
  }
  return out;
};

/** 연속 부재 / 정체 리드 스마트 로테이션 실행 */
export const runSmartRotation = async (minMissed = 3, stagnantHours = 48, limit = 200): Promise<{ success: boolean; rotatedCount: number }> => {
  const { data, error } = await need().rpc('auto_rotate_missed_cases', {
    p_min_missed_count: minMissed,
    p_stagnant_hours: stagnantHours,
    p_limit: limit,
  });
  if (error) throw error;
  return {
    success: !!data?.success,
    rotatedCount: Number(data?.rotated_count || 0),
  };
};
