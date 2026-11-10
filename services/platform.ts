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
  const totalMonthlyRevenue = totalSeats * PRICE_PER_AGENT_MONTH;
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
  const supplyPrice = seats * PRICE_PER_AGENT_MONTH;
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
| **상호 / 회사명** | 리드마스터 (대표: 진성훈) | **${org.name}** |
| **담당자 이메일** | beanbull@gmail.com | ${org.ownerInviteEmail || '등록 계정'} |
| **서비스 명칭** | LeadMaster Cloud CRM SaaS | 기업 전용 엔터프라이즈 테넌트 |

---

### 2. 당월 이용 내역 및 청구 금액 산출 내역

| 서비스 항목 | 과금 기준 | 수량 (활성 좌석) | 단가 | 공급가액 |
| :--- | :--- | :---: | :---: | :---: |
| **LeadMaster CRM 정기 라이선스** | 활성 상담원 계정 수 | **${seats} 석** | ₩48,000 | ₩${supplyPrice.toLocaleString()} |
| **안드로이드 자동콜 연동 패키지** | 무제한 통화/녹음 연동 | 포함 | ₩0 | ₩0 |
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
