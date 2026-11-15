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
  permissions?: OrgFeaturePermissions;
}

/** 테넌트별 5대 세부 기능 권한 및 라이선스 */
export type PricingModelType = 'volume_tier' | 'custom_seat' | 'flat_fee';

export interface OrgFeaturePermissions {
  /** 1. 광고비 & 정산 센터 권한 (DB 단가, 광고비 지출 집계, 상담원 급여/수당 계산, 주간 청구서) */
  settlementEnabled: boolean;
  /** 2. 스마트 오토콜 발신 권한 (안드로이드 폰 연동 1초 1콜 자동 다이얼러) */
  autoDialEnabled: boolean;
  /** 3. AI 음성 가상 고객 트레이닝 센터 권한 (1만2천명 가상 고객 실전 전화 훈련) */
  aiTrainingEnabled: boolean;
  /** 4. 사내 텔레그램 리드 전송 봇 연동 권한 */
  telegramHubEnabled: boolean;
  /** 5. 보안 프로필 강제 모드 (화면 캡처 차단 FLAG_SECURE, 번호 마스킹 필수화) */
  enforceSecurity: boolean;
  /** 6. 무료 체험 만료일 (ISO 문자열) */
  trialExpiresAt?: string;
  /** 7. 상담원 좌석 수 한도 (0 = 무제한, 기본값 20) */
  maxSeats: number;
  /** 8. 요금제 모델 (volume_tier | custom_seat | flat_fee) */
  pricingModel?: PricingModelType;
  /** 9. 좌석당 맞춤 단가 (원/석/월) */
  customUnitPrice?: number;
  /** 10. 월 고정 정액 금액 (원/월) */
  flatMonthlyFee?: number;
}

export const DEFAULT_ORG_FEATURE_PERMISSIONS: OrgFeaturePermissions = {
  settlementEnabled: true,
  autoDialEnabled: true,
  aiTrainingEnabled: true,
  telegramHubEnabled: true,
  enforceSecurity: false,
  maxSeats: 20,
  pricingModel: 'volume_tier',
};

/** 스타터 ₩58,000 ~ 메가 센터 ₩38,000 기준 고객사별 월 이용료 및 단가 자동 계산 */
export const calculateOrgMonthlyBill = (
  activeSeats: number,
  permissions?: OrgFeaturePermissions
): { unitPrice: number; totalPrice: number; tierName: string } => {
  // 1. 월 고정 정액제
  if (permissions?.pricingModel === 'flat_fee' && permissions?.flatMonthlyFee) {
    return {
      unitPrice: Math.round(permissions.flatMonthlyFee / Math.max(1, activeSeats)),
      totalPrice: permissions.flatMonthlyFee,
      tierName: '월 고정 정액제',
    };
  }

  // 2. 호스트 맞춤 단가
  if (permissions?.pricingModel === 'custom_seat' && permissions?.customUnitPrice) {
    return {
      unitPrice: permissions.customUnitPrice,
      totalPrice: activeSeats * permissions.customUnitPrice,
      tierName: '호스트 맞춤 단가',
    };
  }

  // 3. 스타터 ₩58,000 ~ 메가센터 ₩38,000 볼륨 자동 티어링
  if (activeSeats >= 101) return { unitPrice: 38000, totalPrice: activeSeats * 38000, tierName: '메가 센터 (101인+)' };
  if (activeSeats >= 51)  return { unitPrice: 42000, totalPrice: activeSeats * 42000, tierName: '엔터프라이즈 (51~100인)' };
  if (activeSeats >= 21)  return { unitPrice: 46000, totalPrice: activeSeats * 46000, tierName: '프로 (21~50인)' };
  if (activeSeats >= 6)   return { unitPrice: 52000, totalPrice: activeSeats * 52000, tierName: '비즈니스 (6~20인)' };
  return { unitPrice: 58000, totalPrice: activeSeats * 58000, tierName: '스타터 (1~5인)' };
};

/** 승인 완료 안내 이메일 내용 생성기 (7일 무료 체험) */
export const generateApprovalEmailContent = (
  companyName: string,
  ownerEmail: string,
  loginUrl: string = 'https://lmaster.xyz/login'
): { subject: string; body: string } => {
  const subject = `[리드마스터 CRM] '${companyName}' 워크스페이스 승인 완료 및 7일 무료 체험 안내`;
  const body = `안녕하세요, ${companyName} 대표님!

리드마스터 CRM 가입 신청이 성공적으로 승인되었습니다.

대표님 전용 엔터프라이즈 워크스페이스 개설이 완료되었으며, 오늘부터 7일간 전체 기능을 자유롭게 이용하실 수 있는 무료 체험이 시작되었습니다.

신청하신 구글 계정(${ownerEmail})으로 아래 주소에서 로그인하시면 즉시 시작하실 수 있습니다.

■ 로그인 주소: ${loginUrl}
■ 로그인 방법: [Google로 계속하기] 원클릭 로그인
■ 무료 체험 기간: 승인일로부터 7일간 (전체 기능 무제한 이용)
■ 고객지원 및 문의: beanhull@gmail.com

감사합니다.
리드마스터 플랫폼 운영팀 드림`;

  return { subject, body };
};

export const PRICE_PER_AGENT_MONTH = 48000;

export interface PlatformBillingSummary {
  totalOrgs: number;
  activeOrgs: number;
  totalSeats: number;
  totalMonthlyRevenue: number;
  estimatedInfraCost: number; // 월 약 66,500원 (Supabase Pro $25 + Vercel Pro $20 + GitHub Pro $4)
  netMargin: number;
  marginPercent: number;
}

export const computeBillingSummary = (orgs: PlatformOrg[]): PlatformBillingSummary => {
  const totalOrgs = orgs.length;
  const activeOrgs = orgs.filter(o => o.status === 'active').length;
  // 본사(hq / 00000000-0000-0000-0000-000000000001) 제외 외부 고객사만 과금 산출
  const clientOrgs = orgs.filter(o => o.slug !== 'hq' && o.id !== '00000000-0000-0000-0000-000000000001');
  const totalSeats = clientOrgs.reduce((acc, o) => acc + (o.status === 'active' ? o.activeMembers : 0), 0);
  const totalMonthlyRevenue = clientOrgs.reduce((acc, o) => {
    if (o.status !== 'active') return acc;
    const bill = calculateOrgMonthlyBill(Math.max(1, o.activeMembers), o.permissions);
    return acc + bill.totalPrice;
  }, 0);
  const estimatedInfraCost = totalSeats > 0 ? 66500 : 0;
  const netMargin = Math.max(0, totalMonthlyRevenue - estimatedInfraCost);
  const marginPercent = totalMonthlyRevenue > 0 ? Math.round((netMargin / totalMonthlyRevenue) * 100) : 0;

  return {
    totalOrgs,
    activeOrgs,
    totalSeats,
    totalMonthlyRevenue,
    estimatedInfraCost,
    netMargin,
    marginPercent,
  };
};

/**
 * 고객사용 월간 이용료 청구서 마크다운 생성기
 * docs/billing/월간_이용료_청구서_양식_v1.md 표준 규격 준수
 */
export const generateOrgInvoiceMarkdown = (org: PlatformOrg, billingMonth?: string): string => {
  const now = new Date();
  const ym = billingMonth || `${now.getFullYear()}년 ${String(now.getMonth() + 1).padStart(2, '0')}월`;
  const seats = Math.max(1, org.activeMembers);
  const bill = calculateOrgMonthlyBill(seats, org.permissions);
  const supplyPrice = bill.totalPrice;
  const vat = Math.floor(supplyPrice * 0.1);
  const totalPrice = supplyPrice + vat;
  const issueDate = now.toISOString().slice(0, 10);

  return `# 리드마스터 CRM 월간 서비스 이용료 청구서

**문서 번호**: LM-INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${org.id.slice(0, 8).toUpperCase()}  
**발행 일자**: ${issueDate}  
**청구 기간**: ${ym}분 (1개월)  

---

### 1. 공급자 및 공급받는 자

| 구분 | 공급자 (서비스 제공자) | 공급받는 자 (고객사) |
| :--- | :--- | :--- |
| **상호 / 회사명** | 리드마스터 (대표: 진성호) | **${org.name}** |
| **담당자 이메일** | beanhull@gmail.com | ${org.ownerInviteEmail || '등록 계정'} |
| **서비스 명칭** | LeadMaster Cloud CRM SaaS | 기업 전용 엔터프라이즈 테넌트 |

---

### 2. 당월 이용 내역 및 청구 금액 산출 내역

| 서비스 항목 | 과금 기준 | 수량 (활성 좌석) | 적용 단가 | 공급가액 |
| :--- | :--- | :---: | :---: | :---: |
| **LeadMaster CRM 라이선스 (${bill.tierName})** | 활성 상담원 계정 수 | **${seats} 석** | ₩${bill.unitPrice.toLocaleString()} | ₩${supplyPrice.toLocaleString()} |
| **안드로이드 스마트 자동콜 연동** | 무제한 통화/녹음 연동 | 포함 | ₩0 | ₩0 |
| **AI 통화 요약 & 텔레그램 허브** | 표준 제공량 포함 | 포함 | ₩0 | ₩0 |

- **공급가액**: **₩${supplyPrice.toLocaleString()}**
- **부가가치세 (VAT 10%)**: **₩${vat.toLocaleString()}**
- **최종 청구 합계 금액**: **₩${totalPrice.toLocaleString()} 원 (VAT 포함)**

---

### 3. 입금 계좌 및 결제 안내
- **결제 방식**: 계좌이체 (세금계산서 청구/영수 발행)
- **입금 기한**: 익월 10일까지
- **문의 및 지원**: 플랫폼 관리국 (beanbull@gmail.com)

*본 청구서는 리드마스터 클라우드 시스템에 기록된 실제 활성 상담원 계정 수에 근거하여 자동 발행되었습니다.*
`;
};

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

/** 새 고객 회사 생성 + 대표(owner) 초대 + (옵션) 실무 표준 프리셋 초기 세팅 */
export const createOrganization = async (
  name: string,
  ownerEmail: string,
  applyTmPreset: boolean = true
): Promise<string> => {
  const n = name.trim();
  const e = ownerEmail.trim().toLowerCase();
  if (n.length < 2) throw new Error('회사 이름을 입력하세요');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('대표 이메일 형식이 올바르지 않습니다');
  const { data, error } = await need().rpc('create_organization', { p_name: n, p_owner_email: e, p_slug: null });
  if (error) fail(error);
  const newOrgId = String(data);

  if (applyTmPreset) {
    try {
      await initializeOrgPresets(newOrgId, n);
    } catch (presetErr) {
      console.warn('[Platform] 프리셋 초기화 경고:', presetErr);
    }
  }

  // 7일(일주일) 무료 체험 만료일 자동 세팅 (현재 시각 + 7일)
  try {
    const trialExpireDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await updateOrgFeaturePermissions(newOrgId, {
      trialExpiresAt: trialExpireDate,
    });
  } catch (trialErr) {
    console.warn('[Platform] 7일 무료체험 세팅 경고:', trialErr);
  }

  return newOrgId;
};

/** 신규 테넌트에 TM 실무 표준 상태, 정책, 녹음 보존 기간 주입 */
export const initializeOrgPresets = async (orgId: string, orgName: string): Promise<void> => {
  const client = need();

  // 1. 표준 상태값 프리셋 세팅
  const standardStatuses = ['신규접수', '부재중', '상담중', '사무장접수', '계약완료', '진행불가', '보류', '휴지통'];
  const standardSecondary = [
    '1차부재', '2차부재', '3차부재', '단순변심',
    '방문예약', '출장예약', '고민중', '계약서작성', '착수금입금', '서류보완요청'
  ];

  await Promise.allSettled([
    client.from('settings').upsert([
      { org_id: orgId, key: 'statusStages', value: standardStatuses },
      { org_id: orgId, key: 'secondaryStatuses', value: standardSecondary },
      {
        org_id: orgId,
        key: 'training_policy',
        value: {
          companyName: orgName,
          departmentName: '회생상담팀',
          inboundChannel: '공식 온라인 접수',
          representativePhone: '1588-0000',
          openingScriptTemplate: '안녕하세요, {고객명}님! {회사명} {부서명} {상담원명}입니다. 온라인으로 무료 지원 신청 남겨주셔서 전화드렸습니다.',
          mandatoryKeywords: ['비밀 보장', '무료 상담', '법원 접수'],
          prohibitedKeywords: ['100% 무조건 승인', '전액 탕감 보장'],
          strictMode: false,
        }
      }
    ]),
    client.from('org_recording_settings').upsert({
      org_id: orgId,
      auto_upload: true,
      auto_analyze: true,
      min_duration_sec: 20,
      retention_days: 3650, // 10년 영구 보존
      daily_analyze_cap: 300,
      wifi_only: false
    })
  ]);
};

export const setOrganizationStatus = async (orgId: string, status: 'active' | 'suspended'): Promise<void> => {
  const { error } = await need().rpc('set_organization_status', { p_org_id: orgId, p_status: status });
  if (error) fail(error);
};

// ============================================
// 테넌트 기능 권한 (Feature Permissions) 제어 함수
// ============================================

const PERM_STORAGE_KEY_PREFIX = 'lm_org_permissions_';

/** 특정 테넌트의 기능 권한 조회 (DB + 로컬 캐시 결합) */
export const getOrgFeaturePermissions = async (orgId: string): Promise<OrgFeaturePermissions> => {
  const localKey = `${PERM_STORAGE_KEY_PREFIX}${orgId}`;
  let cached: Partial<OrgFeaturePermissions> = {};
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) cached = JSON.parse(raw);
  } catch {}

  try {
    const client = need();
    const { data } = await client
      .from('settings')
      .select('value')
      .eq('org_id', orgId)
      .eq('key', 'feature_permissions')
      .maybeSingle();

    if (data?.value) {
      const merged: OrgFeaturePermissions = {
        ...DEFAULT_ORG_FEATURE_PERMISSIONS,
        ...cached,
        ...data.value,
      };
      localStorage.setItem(localKey, JSON.stringify(merged));
      return merged;
    }
  } catch (e) {
    console.warn('[Platform] 권한 DB 조회 실패, 로컬 폴백 사용:', e);
  }

  return {
    ...DEFAULT_ORG_FEATURE_PERMISSIONS,
    ...cached,
  };
};

/** 특정 테넌트의 기능 권한 업데이트 (DB + 로컬 저장 동기화) */
export const updateOrgFeaturePermissions = async (
  orgId: string,
  updates: Partial<OrgFeaturePermissions>
): Promise<OrgFeaturePermissions> => {
  const current = await getOrgFeaturePermissions(orgId);
  const updated: OrgFeaturePermissions = {
    ...current,
    ...updates,
  };

  const localKey = `${PERM_STORAGE_KEY_PREFIX}${orgId}`;
  localStorage.setItem(localKey, JSON.stringify(updated));

  try {
    const client = need();
    await client
      .from('settings')
      .upsert({
        org_id: orgId,
        key: 'feature_permissions',
        value: updated,
      });
  } catch (e) {
    console.warn('[Platform] 권한 DB 저장 경고 (로컬 반영 완료):', e);
  }

  return updated;
};

/** 모든 테넌트의 기능 권한 일괄 조회 */
export const fetchAllOrgPermissions = async (orgIds: string[]): Promise<Record<string, OrgFeaturePermissions>> => {
  const result: Record<string, OrgFeaturePermissions> = {};
  if (orgIds.length === 0) return result;

  // 1. 로컬 캐시 우선 채우기
  orgIds.forEach(id => {
    try {
      const raw = localStorage.getItem(`${PERM_STORAGE_KEY_PREFIX}${id}`);
      if (raw) result[id] = { ...DEFAULT_ORG_FEATURE_PERMISSIONS, ...JSON.parse(raw) };
    } catch {}
  });

  // 2. DB 일괄 조회
  try {
    const client = need();
    const { data } = await client
      .from('settings')
      .select('org_id, value')
      .in('org_id', orgIds)
      .eq('key', 'feature_permissions');

    if (data) {
      data.forEach((row: any) => {
        if (row.org_id && row.value) {
          result[row.org_id] = {
            ...DEFAULT_ORG_FEATURE_PERMISSIONS,
            ...result[row.org_id],
            ...row.value,
          };
          localStorage.setItem(`${PERM_STORAGE_KEY_PREFIX}${row.org_id}`, JSON.stringify(result[row.org_id]));
        }
      });
    }
  } catch (e) {
    console.warn('[Platform] 전체 권한 DB 조회 실패:', e);
  }

  // 3. 미설정 테넌트는 기본값 부여
  orgIds.forEach(id => {
    if (!result[id]) {
      result[id] = { ...DEFAULT_ORG_FEATURE_PERMISSIONS };
    }
  });

  return result;
};
