/**
 * 주택임대차보호법 시행령 소액임차보증금 및 채무자회생법상 면제재산/압류금지 한도 데이터셋
 */

export interface HousingExemptionRegion {
  key: string;
  name: string;
  maxDeposit: number;       // 소액보증금 해당 기준 (이하)
  exemptAmount: number;     // 최우선변제금 (면제재산 한도)
  targetAreas: string[];    // 대표 해당 지역
  description: string;
}

export const HOUSING_EXEMPTION_REGIONS: HousingExemptionRegion[] = [
  {
    key: 'seoul',
    name: '1. 서울특별시',
    maxDeposit: 165000000, // 1억 6,500만원
    exemptAmount: 55000000, // 5,500만원
    targetAreas: ['서울특별시 25개 구 전역'],
    description: '서울 전역 단일 기준 적용',
  },
  {
    key: 'overcrowded',
    name: '2. 과밀억제권역 및 주요 도시',
    maxDeposit: 145000000, // 1억 4,500만원
    exemptAmount: 48000000, // 4,800만원
    targetAreas: [
      '세종특별자치시', '용인시', '화성시', '김포시',
      '인천광역시 (강화/옹진/송도/청라/영종/서구 일부 등 제외)',
      '의정부시', '구리시', '남양주시 (호평/평내/금곡/일패 등 일부)',
      '하남시', '고양시', '수원시', '성남시', '안양시', '부천시',
      '광명시', '과천시', '의왕시', '군포시', '시흥시'
    ],
    description: '수도권 과밀억제권역 및 주택임대차 세종/용인/화성/김포',
  },
  {
    key: 'metropolitan',
    name: '3. 광역시 및 특례 시·군',
    maxDeposit: 85000000, // 8,500만원
    exemptAmount: 28000000, // 2,800만원
    targetAreas: [
      '부산광역시', '대구광역시', '광주광역시', '대전광역시', '울산광역시',
      '안산시', '광주시', '파주시', '이천시', '평택시'
    ],
    description: '5대 광역시(군지역 제외) 및 지정 성장관리 시',
  },
  {
    key: 'others',
    name: '4. 그 밖의 지역',
    maxDeposit: 75000000, // 7,500만원
    exemptAmount: 25000000, // 2,500만원
    targetAreas: ['강원도', '충청북도', '충청남도', '전북/전남', '경북/경남', '제주특별자치도 등 기타 시·군 전역'],
    description: '1~3호 외 전국 시·군 지역',
  },
];

/**
 * 법정 압류금지 재산 및 면제재산 기본 한도표
 */
export const STATUTORY_EXEMPT_ASSETS = [
  {
    category: '6개월간 생계비',
    limit: 18500000, // 1,850만원
    unit: '1,850만원',
    law: '채무자회생법 시행령 제16조',
    note: '채무자 및 피부양자의 6개월간 생계유지를 위해 필요한 예금/현금 면제재산',
  },
  {
    category: '압류금지 소액예금',
    limit: 18500000, // 185만원
    unit: '185만원',
    law: '민사집행법 시행령 제7조',
    note: '개인별 전 금융기관 합산 185만원 이하 잔고는 전액 압류금지 보호',
  },
  {
    category: '보장성 보험 해약환급금',
    limit: 1500000, // 150만원
    unit: '150만원 이하',
    law: '민사집행법 시행령 제6조',
    note: '사망보험금 1,000만원 이하, 상해·질병 치료비/수술비는 전액 압류금지',
  },
  {
    category: '퇴직금 / 퇴직연금',
    limit: 0,
    unit: '1/2 압류금지 (연금은 전액 보호)',
    law: '근로자퇴직급여보장법 제7조',
    note: '일반 퇴직금은 50%만 재산 반영, DC/DB형 퇴직연금은 전액 압류 불가(청산가치 0원)',
  },
];

/**
 * 소액임차보증금 면제재산 판정
 */
export function checkDepositExemption(regionKey: string, actualDeposit: number) {
  const region = HOUSING_EXEMPTION_REGIONS.find(r => r.key === regionKey) || HOUSING_EXEMPTION_REGIONS[0];

  const isEligibleForSmallDeposit = actualDeposit <= region.maxDeposit;
  const protectedAmount = isEligibleForSmallDeposit 
    ? Math.min(actualDeposit, region.exemptAmount) 
    : 0;
  const liquidationValue = Math.max(0, actualDeposit - protectedAmount);

  return {
    region,
    actualDeposit,
    isEligibleForSmallDeposit,
    protectedAmount,
    liquidationValue, // 청산가치(재산목록)에 반영되어야 할 금액
  };
}
