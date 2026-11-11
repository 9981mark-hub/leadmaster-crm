import { supabase } from './supabase';
import { addInboundPath } from './api';

export interface LeadVendor {
  id: string;
  name: string;
  pricingType: 'cpl' | 'package' | 'fixed'; // 'cpl' (건당) | 'package' (N건에 N원) | 'fixed' (고정총액)
  defaultUnitCost: number; // 1건당 환산 단가 (원)
  packageLeads?: number;   // 대량 패키지 수량 (예: 3000건)
  packagePrice?: number;   // 대량 패키지 금액 (예: 500,000원)
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

// 기본 샘플 거래처 (CPL 방식 및 대량 패키지 3,000건/50만원 등 현실적 모델 포함)
export const DEFAULT_VENDORS: LeadVendor[] = [
  { 
    id: 'v-meta-1', 
    name: '메타(인스타/페이스북) 랜딩 1팀', 
    pricingType: 'cpl',
    defaultUnitCost: 28000, 
    leadType: '개인회생', 
    asPolicy: '결번/타지역 5일 이내 100% 무상 교환', 
    contactPerson: '김팀장 010-1234-5678', 
    isActive: true 
  },
  { 
    id: 'v-bulk-1', 
    name: '대량 TM DB 공급센터 (3,000건/50만원)', 
    pricingType: 'package',
    packageLeads: 3000,
    packagePrice: 500000,
    defaultUnitCost: 167, 
    leadType: '신용회복/대출', 
    asPolicy: '중복 번호 사전 필터링 완료 공급, 결번 10% 추가보너스 지급', 
    contactPerson: '최부장 010-9876-5432', 
    isActive: true 
  },
  { 
    id: 'v-naver-1', 
    name: '네이버 파워링크 검색광고', 
    pricingType: 'cpl',
    defaultUnitCost: 35000, 
    leadType: '개인회생', 
    asPolicy: '결번 신청 시 익월 광고비 차감', 
    contactPerson: '네이버 공식대행사', 
    isActive: true 
  },
  { 
    id: 'v-daangn-1', 
    name: '당근마켓 지역 광고', 
    pricingType: 'cpl',
    defaultUnitCost: 18000, 
    leadType: '신용회복', 
    asPolicy: '단순변심 제외, 중복 100% 차감', 
    contactPerson: '박매니저', 
    isActive: true 
  },
  { 
    id: 'v-referral-1', 
    name: '제휴 법무사/지인 소개', 
    pricingType: 'fixed',
    defaultUnitCost: 0, 
    packagePrice: 0,
    leadType: '개인회생', 
    asPolicy: '수수료 별도 정산', 
    contactPerson: '사내 제휴팀', 
    isActive: true 
  },
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

    return data.map((r: any) => {
      const pLeads = Number(r.package_leads || 0);
      const pPrice = Number(r.package_price || 0);
      const pricingType = (r.pricing_type || 'cpl') as 'cpl' | 'package' | 'fixed';
      
      let unitCost = Number(r.default_unit_cost || 0);
      if (pricingType === 'package' && pLeads > 0 && pPrice > 0) {
        unitCost = Math.round(pPrice / pLeads);
      }

      return {
        id: r.id,
        name: r.name,
        pricingType,
        defaultUnitCost: unitCost,
        packageLeads: pLeads > 0 ? pLeads : undefined,
        packagePrice: pPrice > 0 ? pPrice : undefined,
        leadType: r.lead_type || '개인회생',
        asPolicy: r.as_policy || '',
        contactPerson: r.contact_person || '',
        memo: r.memo || '',
        isActive: r.is_active ?? true,
        createdAt: r.created_at,
      };
    });
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

  const pLeads = Math.max(0, Number(vendor.packageLeads || 0));
  const pPrice = Math.max(0, Number(vendor.packagePrice || 0));
  const pricingType = vendor.pricingType || 'cpl';
  
  let unitCost = Math.max(0, Number(vendor.defaultUnitCost || 0));
  if (pricingType === 'package' && pLeads > 0 && pPrice > 0) {
    unitCost = Math.round(pPrice / pLeads);
  }

  const payload: any = {
    name: trimmedName,
    pricing_type: pricingType,
    package_leads: pLeads,
    package_price: pPrice,
    default_unit_cost: unitCost,
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

  // 시스템 유입경로(Inbound Paths) 목록에도 자동 동기화
  try {
    await addInboundPath(trimmedName);
  } catch (e) {
    console.warn('[VendorService] InboundPath 동기화 스킵:', e);
  }

  return {
    id: data.id,
    name: data.name,
    pricingType,
    defaultUnitCost: unitCost,
    packageLeads: pLeads > 0 ? pLeads : undefined,
    packagePrice: pPrice > 0 ? pPrice : undefined,
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
  if (patch.pricingType !== undefined) updateData.pricing_type = patch.pricingType;
  if (patch.packageLeads !== undefined) updateData.package_leads = Math.max(0, Number(patch.packageLeads));
  if (patch.packagePrice !== undefined) updateData.package_price = Math.max(0, Number(patch.packagePrice));
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
