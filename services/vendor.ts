import { supabase } from './supabase';
import { addInboundPath } from './api';

export interface LeadVendor {
  id: string;
  name: string;
  defaultUnitCost: number;
  leadType: string;
  asPolicy?: string;
  contactPerson?: string;
  memo?: string;
  isActive: boolean;
  createdAt?: string;
}

const need = () => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다');
  return supabase;
};

// 기본 샘플 거래처 (초기 DB가 비어있을 때 안내용)
export const DEFAULT_VENDORS: LeadVendor[] = [
  { id: 'v-meta-1', name: '메타(인스타/페이스북) 랜딩 1팀', defaultUnitCost: 28000, leadType: '개인회생', asPolicy: '결번/타지역 5일 이내 100% 무상 교환', contactPerson: '김팀장 010-1234-5678', isActive: true },
  { id: 'v-naver-1', name: '네이버 파워링크 검색광고', defaultUnitCost: 35000, leadType: '개인회생', asPolicy: '결번 신청 시 익월 광고비 차감', contactPerson: '네이버 공식대행사', isActive: true },
  { id: 'v-daangn-1', name: '당근마켓 지역 광고', defaultUnitCost: 18000, leadType: '신용회복', asPolicy: '단순변심 제외, 중복 100% 차감', contactPerson: '박매니저', isActive: true },
  { id: 'v-youtube-1', name: '유튜브 영상 프로모션 DB', defaultUnitCost: 32000, leadType: '개인회생', asPolicy: '결번 7일 이내 신청', contactPerson: '이실장', isActive: true },
  { id: 'v-referral-1', name: '제휴 법무사/지인 소개', defaultUnitCost: 0, leadType: '개인회생', asPolicy: '수수료 별도 정산', contactPerson: '사내 제휴팀', isActive: true },
];

/** DB 거래처 목록 조회 */
export const fetchLeadVendors = async (): Promise<LeadVendor[]> => {
  try {
    const sb = need();
    const { data, error } = await sb
      .from('lead_vendors')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.warn('[VendorService] DB 조회 실패, 기본 목록 반환:', error.message);
      return DEFAULT_VENDORS;
    }

    if (!data || data.length === 0) {
      return DEFAULT_VENDORS;
    }

    return data.map((r: any) => ({
      id: r.id,
      name: r.name,
      defaultUnitCost: Number(r.default_unit_cost || 0),
      leadType: r.lead_type || '개인회생',
      asPolicy: r.as_policy || '',
      contactPerson: r.contact_person || '',
      memo: r.memo || '',
      isActive: r.is_active ?? true,
      createdAt: r.created_at,
    }));
  } catch (err: any) {
    console.warn('[VendorService] 예외 발생, 기본 목록 반환:', err.message);
    return DEFAULT_VENDORS;
  }
};

/** 신규 DB 거래처 등록 */
export const createLeadVendor = async (
  vendor: Omit<LeadVendor, 'id' | 'createdAt' | 'isActive'>
): Promise<LeadVendor> => {
  const sb = need();
  const trimmedName = vendor.name.trim();
  if (!trimmedName) throw new Error('거래처 이름을 입력해주세요.');

  const payload: any = {
    name: trimmedName,
    default_unit_cost: Math.max(0, Number(vendor.defaultUnitCost || 0)),
    lead_type: vendor.leadType || '개인회생',
    as_policy: vendor.asPolicy || '',
    contact_person: vendor.contactPerson || '',
    memo: vendor.memo || '',
    is_active: true,
  };

  const { data, error } = await sb
    .from('lead_vendors')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || '거래처 등록에 실패했습니다.');
  }

  // 시스템 유입경로(Inbound Paths) 목록에도 자동 동기화하여 단건 등록에서도 즉시 선택 가능하게 연동
  try {
    await addInboundPath(trimmedName);
  } catch (e) {
    console.warn('[VendorService] InboundPath 동기화 스킵:', e);
  }

  return {
    id: data.id,
    name: data.name,
    defaultUnitCost: Number(data.default_unit_cost || 0),
    leadType: data.lead_type || '개인회생',
    asPolicy: data.as_policy || '',
    contactPerson: data.contact_person || '',
    memo: data.memo || '',
    isActive: true,
    createdAt: data.created_at,
  };
};

/** DB 거래처 수정 */
export const updateLeadVendor = async (
  id: string,
  patch: Partial<Omit<LeadVendor, 'id' | 'createdAt'>>
): Promise<void> => {
  const sb = need();
  const updateData: any = {};
  if (patch.name !== undefined) updateData.name = patch.name.trim();
  if (patch.defaultUnitCost !== undefined) updateData.default_unit_cost = Math.max(0, Number(patch.defaultUnitCost));
  if (patch.leadType !== undefined) updateData.lead_type = patch.leadType;
  if (patch.asPolicy !== undefined) updateData.as_policy = patch.asPolicy;
  if (patch.contactPerson !== undefined) updateData.contact_person = patch.contactPerson;
  if (patch.memo !== undefined) updateData.memo = patch.memo;
  if (patch.isActive !== undefined) updateData.is_active = patch.isActive;

  const { error } = await sb
    .from('lead_vendors')
    .update(updateData)
    .eq('id', id);

  if (error) throw new Error(error.message || '거래처 정보 수정 실패');
};

/** DB 거래처 삭제 (비활성화) */
export const deleteLeadVendor = async (id: string): Promise<void> => {
  const sb = need();
  const { error } = await sb
    .from('lead_vendors')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw new Error(error.message || '거래처 삭제 실패');
};

/** 과거 미회차 DB들을 거래처/유입경로별로 자동 소급 묶음화 */
export const retroactiveBatchExistingLeads = async (): Promise<{
  success: boolean;
  batchesCreated: number;
  casesLinked: number;
}> => {
  const sb = need();
  const { data, error } = await sb.rpc('retroactive_batch_existing_leads');
  if (error) {
    throw new Error(error.message || '과거 데이터 소급 묶음 생성에 실패했습니다.');
  }

  return {
    success: data?.success ?? true,
    batchesCreated: Number(data?.batches_created || 0),
    casesLinked: Number(data?.cases_linked || 0),
  };
};
