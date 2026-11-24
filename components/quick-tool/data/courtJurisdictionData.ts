/**
 * 전국 지역별 개인회생·파산 관할법원 스마트 매핑 데이터셋
 * 실무 핵심: 지방법원 '지원'에는 개인회생 관할이 없으며 반드시 '본원' 또는 '회생법원'에 접수해야 함.
 */

export interface CourtJurisdiction {
  regionName: string;         // 검색 매칭용 지역명 (예: "수원시", "화성시", "부천시", "강남구")
  province: string;           // 시/도
  competentCourt: string;     // 관할 법원 정식 명칭 (접수 법원)
  isSpecializedCourt: boolean;// 전담 회생법원 여부 (서울/수원/부산)
  branchWarning?: string;     // 지방법원 지원 접수 불가 주의 경고 문구
  courtPhone: string;         // 대표 전화번호 / 개인회생과 안내
  courtAddress: string;       // 법원 소재지
  tips: string;               // 상담원 안내 팁 (실무준칙상 유리한 점 등)
}

export const COURT_JURISDICTION_LIST: CourtJurisdiction[] = [
  // 1. 서울특별시 (서울회생법원)
  {
    regionName: '서울특별시 (강남/서초/송파/마포/영등포 등 25개 구 전역)',
    province: '서울',
    competentCourt: '서울회생법원 (전담)',
    isSpecializedCourt: true,
    courtPhone: '02-530-1114 (종합민원실)',
    courtAddress: '서울특별시 서초구 서초중앙로 157 (서초동)',
    tips: '전국에서 인가율 및 변제기간 단축(24개월 청년특례)에 가장 전향적임. 주식·코인 손실금 청산가치 제외 준칙 최초 시행.',
  },

  // 2. 경기도 남부 (수원회생법원)
  {
    regionName: '수원시, 화성시, 오산시, 용인시 (처인/기흥/수지)',
    province: '경기 남부',
    competentCourt: '수원회생법원 (전담)',
    isSpecializedCourt: true,
    courtPhone: '031-600-6000 (종합민원실)',
    courtAddress: '경기도 수원시 영통구 법조로 105 (하동)',
    tips: '수도권 남부 전담 회생법원으로 신속 처리. 주식/가상자산 손실금 및 청년·취약계층 변제 단축 준칙 서울과 동일하게 적극 적용.',
  },
  {
    regionName: '성남시, 광주시, 하남시, 이천시, 양평군',
    province: '경기 남부',
    competentCourt: '수원회생법원 (전담)',
    isSpecializedCourt: true,
    branchWarning: '수원지방법원 성남지원/여주지원에는 회생 신청 불가! 관할은 수원회생법원 본원입니다.',
    courtPhone: '031-600-6000',
    courtAddress: '경기도 수원시 영통구 법조로 105',
    tips: '성남/하남 거주자는 성남지원 대신 반드시 수원회생법원에 접수해야 합니다.',
  },
  {
    regionName: '안산시, 시흥시, 광명시',
    province: '경기 남부',
    competentCourt: '수원회생법원 (전담)',
    isSpecializedCourt: true,
    branchWarning: '수원지방법원 안산지원에는 회생 관할이 없음. 수원회생법원으로 접수.',
    courtPhone: '031-600-6000',
    courtAddress: '경기도 수원시 영통구 법조로 105',
    tips: '광명시는 서울 바로 인접이나 관할은 수원회생법원 (단, 직장이 서울인 경우 서울회생법원 신청 가능).',
  },
  {
    regionName: '평택시, 안성시',
    province: '경기 남부',
    competentCourt: '수원회생법원 (전담)',
    isSpecializedCourt: true,
    branchWarning: '평택지원에는 회생 신청 불가! 수원회생법원으로 접수.',
    courtPhone: '031-600-6000',
    courtAddress: '경기도 수원시 영통구 법조로 105',
    tips: '평택/안성 거주자도 수원회생법원 전담 관할로 편입되어 처리 속도가 대폭 개선됨.',
  },
  {
    regionName: '안양시, 군포시, 의왕시, 과천시',
    province: '경기 남부',
    competentCourt: '수원회생법원 (전담)',
    isSpecializedCourt: true,
    branchWarning: '안양지원에는 회생 관할 없음. 수원회생법원 접수.',
    courtPhone: '031-600-6000',
    courtAddress: '경기도 수원시 영통구 법조로 105',
    tips: '직장이 서울 서초/강남일 경우 서울회생법원으로 관할 선택 가능.',
  },

  // 3. 인천 및 경기 서북부
  {
    regionName: '인천광역시, 부천시, 김포시',
    province: '인천/경기 서부',
    competentCourt: '인천지방법원 (본원)',
    isSpecializedCourt: false,
    branchWarning: '부천지원(부천시, 김포시)에는 개인회생 단독 관할이 없음! 인천 미추홀구 학익동 본원에 접수.',
    courtPhone: '032-860-1114',
    courtAddress: '인천광역시 미추홀구 소성로 163 (학익동)',
    tips: '인천지법은 최근 대출 및 최근 채무 발생 원인에 대해 보정권고가 꼼꼼한 편이므로 금융거래내역 소명 철저 필요.',
  },

  // 4. 경기 북부 (의정부)
  {
    regionName: '의정부시, 양주시, 남양주시, 구리시, 포천시, 동두천시, 가평군, 연천군, 철원군',
    province: '경기 북부',
    competentCourt: '의정부지방법원 (본원)',
    isSpecializedCourt: false,
    branchWarning: '남양주지원에는 회생 관할이 없음. 의정부 녹양동 본원에 접수.',
    courtPhone: '031-828-0114',
    courtAddress: '경기도 의정부시 녹양로34번길 23 (녹양동)',
    tips: '경기 북부 총괄 본원. 직장이 서울인 경우 서울회생법원으로 관할 유도 권장.',
  },
  {
    regionName: '고양시 (덕양구/일산동구/일산서구), 파주시',
    province: '경기 북부',
    competentCourt: '의정부지방법원 (본원)',
    isSpecializedCourt: false,
    branchWarning: '⚠️ 고양지원(마두동)에는 개인회생 신청 불가! 반드시 의정부지방법원 본원에 신청해야 합니다.',
    courtPhone: '031-828-0114',
    courtAddress: '경기도 의정부시 녹양로34번길 23',
    tips: '고양/파주 고객 중 상당수가 고양지원에 접수 가능한 줄 알고 있으므로 본원 접수 필수 안내.',
  },

  // 5. 부산광역시 (부산회생법원)
  {
    regionName: '부산광역시 전역 (해운대/사하/부산진/동래/금정/남구/연제 등)',
    province: '부산',
    competentCourt: '부산회생법원 (전담)',
    isSpecializedCourt: true,
    courtPhone: '051-590-0000',
    courtAddress: '부산광역시 연제구 법원로 31 (거제동)',
    tips: '영남권 유일의 전담 회생법원으로 인가 속도가 빠르고 주식·가상자산 특례 준칙 적용.',
  },

  // 6. 울산 및 경남
  {
    regionName: '울산광역시, 양산시 (일부)',
    province: '울산',
    competentCourt: '울산지방법원 (본원)',
    isSpecializedCourt: false,
    courtPhone: '052-216-8114',
    courtAddress: '울산광역시 남구 옥현로 12 (옥동)',
    tips: '산업단지 근로자 및 자영업자 회생 사건 다수. 양산시 거주자는 부산회생법원 또는 울산지법 선택 검토.',
  },
  {
    regionName: '창원시 (의창/성산/마산합포/마산회원/진해), 김해시, 밀양시, 진주시, 통영시, 거제시',
    province: '경남',
    competentCourt: '창원지방법원 (본원)',
    isSpecializedCourt: false,
    branchWarning: '마산지원, 진주지원, 통영지원, 밀양지원, 거창지원에는 회생 신청 불가! 창원 사파동 본원에 접수.',
    courtPhone: '055-239-2114',
    courtAddress: '경상남도 창원시 성산구 창이대로 681 (사파동)',
    tips: '경남 전역의 회생 사건은 창원지법 본원에서만 단독 처리.',
  },

  // 7. 대전/충청
  {
    regionName: '대전광역시, 세종특별자치시, 금산군',
    province: '대전/세종',
    competentCourt: '대전지방법원 (본원)',
    isSpecializedCourt: false,
    courtPhone: '042-470-1114',
    courtAddress: '대전광역시 서구 둔산서로 45 (둔산동)',
    tips: '대전/세종 전역 본원 처리. 공무원 및 연구직 회생 사건 비중이 높음.',
  },
  {
    regionName: '천안시, 아산시, 서산시, 당진시, 공주시, 논산시, 보령시, 홍성군, 예산군',
    province: '충남',
    competentCourt: '대전지방법원 (본원)',
    isSpecializedCourt: false,
    branchWarning: '천안지원, 서산지원, 공주지원, 논산지원, 홍성지원에는 회생 신청 불가! 대전지방법원 본원 접수 필수.',
    courtPhone: '042-470-1114',
    courtAddress: '대전광역시 서구 둔산서로 45',
    tips: '천안/아산 인구가 많으나 천안지원 접수가 불가능하므로 대전 본원 접수 안내 필수.',
  },
  {
    regionName: '청주시, 충주시, 제천시, 증평군, 진천군, 음성군, 옥천군, 영동군',
    province: '충북',
    competentCourt: '청주지방법원 (본원)',
    isSpecializedCourt: false,
    branchWarning: '충주지원, 제천지원, 영동지원에는 회생 관할 없음. 청주 산남동 본원 접수.',
    courtPhone: '043-249-7114',
    courtAddress: '충청북도 청주시 서원구 산남로62번길 51 (산남동)',
    tips: '충북 전역 사건을 청주 본원에서 처리.',
  },

  // 8. 대구/경북
  {
    regionName: '대구광역시, 경산시, 영천시, 청도군, 칠곡군, 성주군, 고령군',
    province: '대구/경북',
    competentCourt: '대구지방법원 (본원)',
    isSpecializedCourt: false,
    branchWarning: '대구 서부지원에는 회생 관할 없음. 범어동 대구지방법원 본원 접수.',
    courtPhone: '053-757-6114',
    courtAddress: '대구광역시 수성구 동대구로 364 (범어동)',
    tips: '대구지법은 최근 주식/도박 채무에 대해 보정 심리가 엄격하므로 반성문 및 근로 의지 소명 준비 철저 권장.',
  },
  {
    regionName: '포항시, 경주시, 안동시, 구미시, 김천시, 상주시, 영주시, 문경시, 영덕군',
    province: '경북',
    competentCourt: '대구지방법원 (본원)',
    isSpecializedCourt: false,
    branchWarning: '포항지원, 안동지원, 김천지원, 상주지원, 영덕지원, 의성지원 접수 불가! 대구 범어동 본원 접수.',
    courtPhone: '053-757-6114',
    courtAddress: '대구광역시 수성구 동대구로 364',
    tips: '포항/구미 대형 도시라도 지방법원 지원에는 회생 관할이 전혀 없음.',
  },

  // 9. 광주/전남/전북
  {
    regionName: '광주광역시, 나주시, 화순군, 장성군, 담양군, 곡성군, 영광군',
    province: '광주/전남',
    competentCourt: '광주지방법원 (본원)',
    isSpecializedCourt: false,
    courtPhone: '062-231-1114',
    courtAddress: '광주광역시 동구 준법로 7-12 (지산동)',
    tips: '호남권 중심 본원. 직장 기준 관할도 적극 검토 필요.',
  },
  {
    regionName: '순천시, 여수시, 광양시, 목포시, 무안군, 해남군, 영암군',
    province: '전남',
    competentCourt: '광주지방법원 (본원)',
    isSpecializedCourt: false,
    branchWarning: '순천지원, 목포지원, 해남지원, 장흥지원에는 회생 신청 불가! 광주 지산동 본원 접수.',
    courtPhone: '062-231-1114',
    courtAddress: '광주광역시 동구 준법로 7-12',
    tips: '여수/순천 산단 고객 대상 순천지원 신청 불가 사실 안내 중요.',
  },
  {
    regionName: '전주시, 완주군, 익산시, 군산시, 정읍시, 남원시, 김제시, 부안군',
    province: '전북',
    competentCourt: '전주지방법원 (본원)',
    isSpecializedCourt: false,
    branchWarning: '군산지원, 정읍지원, 남원지원에는 회생 신청 불가! 전주 덕진동 본원 접수.',
    courtPhone: '063-259-5114',
    courtAddress: '전북특별자치도 전주시 덕진구 가인로 33 (만성동)',
    tips: '전북 전역 전주 본원 처리.',
  },

  // 10. 강원/제주
  {
    regionName: '춘천시, 홍천군, 양구군, 인제군, 화천군, 원주시, 횡성군, 강릉시, 동해시, 속초시, 삼척시, 태백시',
    province: '강원',
    competentCourt: '춘천지방법원 (본원)',
    isSpecializedCourt: false,
    branchWarning: '원주지원, 강릉지원, 속초지원, 영월지원에는 회생 신청 불가! 춘천 효자동 본원 접수.',
    courtPhone: '033-259-9114',
    courtAddress: '강원특별자치도 춘천시 효자길 13 (효자동)',
    tips: '원주/강릉 거주자라도 춘천 본원에 접수해야 함. 전자소송 접수 권장.',
  },
  {
    regionName: '제주특별자치도 (제주시, 서귀포시)',
    province: '제주',
    competentCourt: '제주지방법원 (본원)',
    isSpecializedCourt: false,
    branchWarning: '서귀포시 법원 지원에는 관할 없음. 제주시 이도이동 본원 접수.',
    courtPhone: '064-729-2114',
    courtAddress: '제주특별자치도 제주시 남광북1길 5 (이도이동)',
    tips: '관광/숙박/자영업 회생 사건 다수.',
  },
];

/**
 * 키워드로 관할 법원 검색
 */
export function findCompetentCourt(keyword: string): CourtJurisdiction[] {
  const cleanKey = keyword.trim().toLowerCase();
  if (!cleanKey) return COURT_JURISDICTION_LIST;

  return COURT_JURISDICTION_LIST.filter(item => 
    item.regionName.toLowerCase().includes(cleanKey) ||
    item.province.toLowerCase().includes(cleanKey) ||
    item.competentCourt.toLowerCase().includes(cleanKey)
  );
}
