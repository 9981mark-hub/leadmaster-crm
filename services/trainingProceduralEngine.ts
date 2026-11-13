// ============================================
// 실전 텔레그램 접수 DB(487건) 기반 무한 AI 가상 고객 페르소나 & 2026 회생·파산 법률 진단 엔진
// ============================================
import { TrainingPersona, ParalegalHandoffCard } from './trainingService';
import { SpeechVoiceOptions } from './speechService';

// ============================================
// 보건복지부 공식 고시 개인회생 법정 최저생계비 (기준 중위소득의 60%)
// 법원 개인회생 실무에서는 1원 단위까지 법정 고시 금액을 정확하게 적용합니다.
// ============================================

// 2025년 보건복지부 확정 고시 기준 (현재 법원 실무 기준)
export const LIVING_COST_2025 = {
  1: 1435208, // 1인 가구: 1,435,208원 (기준 중위소득 2,392,013원의 60%)
  2: 2359595, // 2인 가구: 2,359,595원 (기준 중위소득 3,932,658원의 60%)
  3: 3015212, // 3인 가구: 3,015,212원 (기준 중위소득 5,025,353원의 60%)
  4: 3658664, // 4인 가구: 3,658,664원 (기준 중위소득 6,097,773원의 60%)
  5: 4264915, // 5인 가구: 4,264,915원 (기준 중위소득 7,108,192원의 60%)
  6: 4838883, // 6인 가구: 4,838,883원 (기준 중위소득 8,064,805원의 60%)
};

// 2026년 개인회생 기준 중위소득 60%
export const LIVING_COST_2026 = {
  1: 1538543, // 1인 가구: 1,538,543원 (약 154만 원)
  2: 2519575, // 2인 가구: 2,519,575원 (약 252만 원)
  3: 3215422, // 3인 가구: 3,215,422원 (약 322만 원)
  4: 3896843, // 4인 가구: 3,896,843원 (약 390만 원)
  5: 4545000, // 5인 가구: 4,545,000원 (약 455만 원)
};

// 실무 기본 적용: 2025년 공식 확정 고시 기준 (개인회생 변제계획안 표준)
export const DEFAULT_LIVING_COST = LIVING_COST_2025;

// 법률 정답지 인터페이스 (Ground Truth)
export interface GroundTruthLegalDiagnosis {
  suitability: '개인회생' | '개인파산' | '신복위/워크아웃' | '일반회생';
  suitabilityReason: string;
  recognizedLivingCost: number;     // 인정 최저생계비 (원)
  expectedMonthlyPayment: number;   // 예상 월 변제금 (원)
  expectedRepaymentPeriod: number;  // 36개월 ~ 60개월
  totalRepaymentAmount: number;     // 총 변제 예상액 (원)
  estimatedForgivenessRate: number; // 원금 탕감률 (%)
  courtStayOrderDays: string;       // 금지명령 예상 소요일 (예: 3~7일)
  courtCommencementMonths: string;  // 개시결정 예상 소요기간 (예: 3~5개월)
  courtRuleNote: string;            // 관할 법원 실무준칙 특징
  recommendedLegalHook: string;     // 1차 TM 상담원 추천 법률 후킹 멘트 (분쟁 위험 0% + 고객 호기심/신뢰 유발)
}

export interface InfinitePersonaTheme {
  id: string;
  name: string;
  badge: string;
  desc: string;
}

export const INFINITE_THEMES: InfinitePersonaTheme[] = [
  { id: 'all', name: '전체 실전 무작위', badge: '🎲 전체 무작위', desc: '487건 실전 접수 및 소액(1200만)·초고액·재산초과 등 전 범위 무작위' },
  { id: 'small_debt', name: '소액채무 1200만선 (회생비추천)', badge: '💡 소액채무', desc: '채무 1,200만 원. 법원 수임료 부담 커서 회생 비추천, 신복위 워크아웃 솔직 권고 훈련' },
  { id: 'high_debt', name: '초고액 채무 (10억+ 일반회생)', badge: '🏛️ 초고액·일반회생', desc: '무담보 10억 초과 연쇄 부도. 개인회생 불가, 법원 전문재판부 일반회생 전담 배정' },
  { id: 'asset_rich', name: '재산초과 (기각위험/지급불능미달)', badge: '🚫 재산초과·기각위험', desc: '자가 아파트 잉여가치가 채무보다 큼. 법원 회생 기각 위험 및 자산대환 안내' },
  { id: 'stock_crypto', name: '주식/코인 빚투 청년', badge: '🪙 코인·주식', desc: '2030 토스/신용대출 레버리지 청산, 서울/수원 회생법원 준칙 준수' },
  { id: 'business_tax', name: '자영업/사업자 세금체납', badge: '🏭 사업자·세금', desc: '식자재/어음/부가세 체납, 매출 필요경비 공제 및 별제권' },
  { id: 'charter_fraud', name: '전세사기/LH임대', badge: '🏠 전세사기·LH', desc: '깡통전세 보증금 미반환, LH 전세임대 질권설정 및 소액보증금' },
  { id: 'bankruptcy_candidate', name: '파산/면책 적합군', badge: '⚖️ 파산·면책', desc: '고령, 장기 우울증/중증질환 근로불능, 수급자 및 무소득 1순위' },
  { id: 'workout_shift', name: '신복위 실패/갈아타기', badge: '🔄 워크아웃 전환', desc: '신속채무조정 유예 만료, 원금 감면 없는 워크아웃에서 회생 전환' },
  { id: 'busy_context', name: '운전/현장직 바쁜상황', badge: '🚗 운전·현장직', desc: '스피커폰 통화, 건설 현장 소음, 30초 내 용건 정리 및 콜백 요구' },
  { id: 'difficult_skeptic', name: '단답/의심/번호추궁', badge: '🛡️ 단답·의심형', desc: '"잘 몰라요", "내 번호 어디서 알았소?", 사기 경계 및 정보 회피' },
];

// 성씨 & 이름 풀
const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍', '유', '문', '배', '남', '하'];
const MALE_NAMES = ['동원', '성수', '태훈', '진호', '광석', '만석', '대현', '영호', '상철', '기철', '재현', '병수', '도진', '익호', '승백', '창홍', '경훈', '준혁', '태섭', '영민', '종원', '상훈', '정우', '민수', '형석'];
const FEMALE_NAMES = ['미숙', '영자', '수진', '현주', '은정', '선영', '미희', '경숙', '지연', '혜원', '소영', '보람', '나원', '지수', '유진', '은지', '서윤', '채은', '다혜', '민경', '하늘', '가영', '수현', '아름'];

// 1. 실전 직업 & 소득 풀 (실제 텔레그램 접수 기반)
interface JobSeed {
  job: string;
  category: 'office' | 'business' | 'special_logistics' | 'freelancer' | 'daily_part' | 'unemployed';
  salaryRaw: string;
  monthlyNetIncome: number; // 월 실수령액 (원)
  genderPreference?: 'male' | 'female';
}

const REAL_JOBS: JobSeed[] = [
  // 직장인
  { job: '중소 제조기업 품질관리 (근속 5년)', category: 'office', salaryRaw: '월 실수령 310만 원 (4대보험 가입)', monthlyNetIncome: 3100000, genderPreference: 'male' },
  { job: '건설회사 현장 시공팀 과장 (근속 7년)', category: 'office', salaryRaw: '월 실수령 360만 원 (연봉 4,800만)', monthlyNetIncome: 3600000, genderPreference: 'male' },
  { job: 'IT 스타트업 웹 퍼블리셔 (재직 2년)', category: 'office', salaryRaw: '월 실수령 250만 원 (4대보험 가입)', monthlyNetIncome: 2500000, genderPreference: 'female' },
  { job: '어린이집 정교사 (근속 6년)', category: 'office', salaryRaw: '월 실수령 210만 원 (4대보험 가입)', monthlyNetIncome: 2100000, genderPreference: 'female' },
  { job: '병원 간호조무사 (근속 4년)', category: 'office', salaryRaw: '월 실수령 230만 원 (연장수당 포함)', monthlyNetIncome: 2300000, genderPreference: 'female' },
  { job: '대기업 물류센터 계약직 (재직 8개월)', category: 'office', salaryRaw: '월 실수령 270만 원 (4대보험 가입)', monthlyNetIncome: 2700000 },
  { job: '퇴직 후 재입사 직장인 (근속 4개월)', category: 'office', salaryRaw: '월 실수령 260만 원 (4대보험 가입)', monthlyNetIncome: 2600000, genderPreference: 'male' },

  // 사업자/자영업
  { job: '프랜차이즈 음식점 대표 (운영 3년)', category: 'business', salaryRaw: '월 매출 2,200만 원 (필요경비 제하면 순익 약 380만 원)', monthlyNetIncome: 3800000 },
  { job: '무인 24시 카페 창업자 (운영 4개월 차)', category: 'business', salaryRaw: '월 매출 450만 원 (임대료/원두값 제외 실순익 150만 원 적자)', monthlyNetIncome: 1500000 },
  { job: '철물 및 자재 유통 도소매 사업자 (12년)', category: 'business', salaryRaw: '월 매출 3,500만 원 (경기 악화로 순익 220만 원 내외)', monthlyNetIncome: 2200000, genderPreference: 'male' },
  { job: '금속 가공 제조공장 대표 (운영 6년)', category: 'business', salaryRaw: '월 매출 5,000만 원 (원자재 폭등으로 실순익 400만 원 수준)', monthlyNetIncome: 4000000, genderPreference: 'male' },
  { job: '1인 미용실 헤어샵 원장 (운영 2년)', category: 'business', salaryRaw: '월 매출 650만 원 (재료비/임대료 제하고 실수령 240만 원)', monthlyNetIncome: 2400000, genderPreference: 'female' },

  // 특고/운송/배달
  { job: '배달 플랫폼 라이더 (배민/쿠팡 풀타임)', category: 'special_logistics', salaryRaw: '주급 환산 월 350만 원 (3.3% 원천징수, 기름값 차감 전 400)', monthlyNetIncome: 3500000, genderPreference: 'male' },
  { job: '1톤 지입 화물차 기사 (근무 4년)', category: 'special_logistics', salaryRaw: '월 운임 450만 원 (유류비/할부금 제외 실소득 280만 원)', monthlyNetIncome: 2800000, genderPreference: 'male' },
  { job: '쿠팡 퀵플렉스 택배 기사', category: 'special_logistics', salaryRaw: '건당 수수료 월 380만 원 (3.3% 원천세 공제)', monthlyNetIncome: 3800000, genderPreference: 'male' },
  { job: '야간 대리운전 기사 (투잡)', category: 'special_logistics', salaryRaw: '일 평균 9만 원, 월 약 220만 원 (현금+앱 정산)', monthlyNetIncome: 2200000, genderPreference: 'male' },

  // 프리랜서
  { job: '입시/보습학원 강사 (프리랜서)', category: 'freelancer', salaryRaw: '학생 수 비례 월 240만~320만 원 (평균 270만 원, 3.3%)', monthlyNetIncome: 2700000 },
  { job: 'IT 프리랜서 백엔드 개발자', category: 'freelancer', salaryRaw: '프로젝트 단위 월 500만 원 (계약 종료 시 무소득 기간 존재)', monthlyNetIncome: 5000000 },
  { job: '동대문 쇼핑몰 피팅 모델 및 피드 관리', category: 'freelancer', salaryRaw: '월 200만~250만 원 (불규칙 수령)', monthlyNetIncome: 2200000, genderPreference: 'female' },

  // 일용직/알바
  { job: '쿠팡 물류센터 일용직 (주 4~5일)', category: 'daily_part', salaryRaw: '일당 11만 원, 월 실수령 약 230만 원 (통장 입금 내역)', monthlyNetIncome: 2300000 },
  { job: '건설 현장 타일/도배 조공', category: 'daily_part', salaryRaw: '일당 18만 원, 노무비 대장 기준 월 약 320만 원', monthlyNetIncome: 3200000, genderPreference: 'male' },
  { job: '대형마트 캐셔 파트타임 (주 25시간)', category: 'daily_part', salaryRaw: '시급제 월 실수령 155만 원', monthlyNetIncome: 1550000, genderPreference: 'female' },

  // 무직/근로불능
  { job: '무직 (과거 우울증 및 공황장애로 8년 치료 중)', category: 'unemployed', salaryRaw: '소득 전무 (기초생활수급 생계급여 65만 원)', monthlyNetIncome: 0 },
  { job: '전업주부 (가족 몰래 채무 발생)', category: 'unemployed', salaryRaw: '본인 소득 0원 (남편 월급 350만 원으로 생활)', monthlyNetIncome: 0, genderPreference: 'female' },
  { job: '폐업 후 장기 미취업 고령자 (63세)', category: 'unemployed', salaryRaw: '소득 없음 (기초연금 33만 원 외 무소득)', monthlyNetIncome: 0, genderPreference: 'male' },
];

// 2. 실전 채무 구성 및 사연 풀 (487건 텔레그램 실제 접수 내용 100% 반영)
interface DebtSeed {
  causeType: 'crypto' | 'business' | 'fraud' | 'living' | 'medical' | 'workout_shift' | 'gambling' | 'small_debt' | 'high_debt' | 'asset_rich' | 'recent_debt' | 'tax_heavy';
  originTitle: string;
  totalDebt: number; // 총 채무액 (원)
  debtSummary: string;
  storyDetail: string;
  specialNote: string;
}

const REAL_DEBTS: DebtSeed[] = [
  // 소액 채무 (회생 비추천 / 신복위 워크아웃 솔직 권고 케이스)
  {
    causeType: 'small_debt',
    originTitle: '사회초년생 소액 카드론 및 비상금 대출 (1,200만 원)',
    totalDebt: 12000000,
    debtSummary: '카카오 비상금 300만, 신한카드 리볼빙/카드론 900만 (총 1,200만 원)',
    storyDetail: '첫 직장 퇴사 후 구직 기간 동안 생활비로 썼는데 월 이자가 20만 원씩 나와 연체 3일 차임. 급한 마음에 회생을 알아봄.',
    specialNote: '회생 수임료(약 150~200만) 부담으로 배보다 배꼽이 큼. 신복위 프리워크아웃(신청비 5만 원, 이자 감면 분할)을 안내하는 것이 양심적 정답.',
  },
  {
    causeType: 'small_debt',
    originTitle: '주부 쿠팡/배민 소액결제 및 캐피탈 (1,400만 원)',
    totalDebt: 14000000,
    debtSummary: '휴대폰 소액결제 400만, 현대캐피탈 소액대출 1,000만 (총 1,400만 원)',
    storyDetail: '가족 모르게 생활비로 소액결제를 돌려막다가 1,400만 원까지 불어남. 신복위 신속채무조정을 먼저 권유해야 함.',
    specialNote: '소액 채무로 법원 회생 실익 없음. 신복위 채무조정 권고 대상.',
  },

  // 초고액 채무 (무담보 10억 초과 / 일반회생 대상)
  {
    causeType: 'high_debt',
    originTitle: '제조업 하청 연쇄 부도 및 연대보증 (12억 5,000만 원)',
    totalDebt: 1250000000,
    debtSummary: '기술보증기금 5억, 신한은행 4억, 거래처 외상대금 3억 5,000만 (총 12억 5,000만 원)',
    storyDetail: '원청 부도로 연쇄 부도가 나면서 무담보 채무가 12억을 돌파함. 급여 압류 및 채권자 가압류 위기.',
    specialNote: '무담보 채무 10억 초과로 개인회생 불가! 법원 일반회생(도산 전담부) 또는 법인회생 상담 배정이 필수.',
  },

  // 재산 초과 (청산가치 초과 / 기각 위험 케이스)
  {
    causeType: 'asset_rich',
    originTitle: '자가 아파트 잉여가치 초과 (채무 5,500만 원 vs 아파트 지분 1억 2,000만 원)',
    totalDebt: 55000000,
    debtSummary: '신용대출 3,500만, 카드론 2,000만 (총 5,500만 원)',
    storyDetail: '보유 아파트(시세 5억, 담보 3.8억, 잉여 1.2억)가 있으나 일시적 사업 자금난으로 신용대출이 연체됨.',
    specialNote: '재산(1억 2천)이 채무(5,500만)보다 많아 회생/파산 모두 기각됨! 자산 매각이나 저금리 담보대환 안내 필요.',
  },

  // 최근 대출 90% 이상 (사기죄/기각 의심 집중 소명 케이스)
  {
    causeType: 'recent_debt',
    originTitle: '최근 2개월 내 집중 대출 및 코인 탕진 (사기죄/기각 위험)',
    totalDebt: 50000000,
    debtSummary: '1금융 신용 2,500만, 저축은행 2,000만, 카드론 500만 (모두 최근 60일 내 대출, 총 5,000만 원)',
    storyDetail: '2달 전 대출받아 해외선물로 날리고 첫 달 이자만 내고 바로 연체됨. 금융사에서 사기 대출 고소 경고 문자를 받음.',
    specialNote: '최근 채무 비중 90% 이상으로 법원 기각 및 사기파산 의심 압박 심각. 금융거래 내역 정밀 소명 전략 필수.',
  },

  // 불법 도박/사설 토토 (파산 불가 / 회생 고변제율 케이스)
  {
    causeType: 'gambling',
    originTitle: '불법 온라인 카지노 및 사설 토토 채무 (6,800만 원)',
    totalDebt: 68000000,
    debtSummary: '대부업 3,800만, 2금융 신용 3,000만 (총 6,800만 원)',
    storyDetail: '온라인 바카라에 빠져 고금리 대부업체를 썼음. 개인파산 면책불허가 대상.',
    specialNote: '도박 빚은 파산 면책 불가(채무자회생법 제564조). 개인회생만 가능하며 원금 변제율 80~100% 압박 대비 필요.',
  },

  // 세금 체납 압도적 비중 (우선변제 18개월 압박)
  {
    causeType: 'tax_heavy',
    originTitle: '자영업 부가가치세 및 종합소득세 대량 체납 (4,200만 원)',
    totalDebt: 62000000,
    debtSummary: '국세청 부가세 3,000만, 종소세 1,200만, 일반 은행 2,000만 (총 6,200만 원)',
    storyDetail: '식당 운영 중 세금을 안 내서 홈택스 전자세금계산서 발급 제한 및 통장 압류 들어옴.',
    specialNote: '조세채권은 탕감 불가 및 18개월 내 우선변제 필수 규정. 통장 압류 해제 및 분할 납부 플랜 수립.',
  },

  // 외국인 근로자 케이스
  {
    causeType: 'living',
    originTitle: 'F-4 재외동포 근로자 생활비 카드 대출 (3,500만 원)',
    totalDebt: 35000000,
    debtSummary: '국내 카드론 2,000만, 2금융 신용 1,500만 (총 3,500만 원)',
    storyDetail: '한국 제조공장에서 4년째 성실히 일하고 있으나 외국인도 개인회생이 되는지 몰라 불안해함.',
    specialNote: '외국인 등록증 및 거소지가 있으면 내국인과 100% 동일하게 개인회생 혜택 적용 가능함을 안내.',
  },

  // 기존 실전 채무 풀
  {
    causeType: 'crypto',
    originTitle: '주식 및 비트코인 선물 레버리지 청산',
    totalDebt: 78000000,
    debtSummary: '토스뱅크 3,200만, 카카오뱅크 2,600만, 케이뱅크 2,000만 (총 7,800만 원)',
    storyDetail: '2024~2025년 가상화폐 급등기에 신용대출을 풀로 당겨 레버리지 선물 투자를 하다가 마진콜 청산당함.',
    specialNote: '채무는 전액 코인/주식 손실금이며, 1금융권 인터넷은행 위주임. 서울/수원 회생법원 준칙(손실금 청산가치 제외) 탕감 혜택 안내가 핵심.',
  },
  {
    causeType: 'crypto',
    originTitle: '주식 전문가 리딩방 및 비상장 사기 투자',
    totalDebt: 95000000,
    debtSummary: '카드론 3건 4,500만, 저축은행 3,000만, 대부업 2,000만 (총 9,500만 원)',
    storyDetail: '유튜브 주식 리딩방에 속아 비상장 공모주 투자 명목으로 고금리 2금융과 카드론을 끌어다 사기당함.',
    specialNote: '이자만 월 180만 원씩 나가고 있어 원금 상환이 불가능함. 가족(배우자)이 알면 이혼당할까 봐 극도로 불안해함.',
  },
  {
    causeType: 'business',
    originTitle: '자영업 원자재 폭등 및 거래처 어음 체납',
    totalDebt: 145000000,
    debtSummary: '국세 2,500만, 신용보증기금 5,000만, 기업은행 4,000만, 사채(일수) 3,000만 (총 1억 4,500만 원)',
    storyDetail: '경기 침체로 거래처 납품 대금이 떼이고, 부가가치세 2,500만 원이 체납되어 계좌 압류 계고장을 받음.',
    specialNote: '국세는 100% 우선변제 채권이므로 회생 계획안 작성 시 36개월 내 전액 우선변제 배치가 필요함.',
  },
  {
    causeType: 'business',
    originTitle: '무인 카페 창업 실패 및 기계 리스 위약금',
    totalDebt: 58000000,
    debtSummary: '소상공인 진흥공단 대출 2,500만, 카드론 1,800만, 커피머신 리스 잔여금 1,500만 (총 5,800만 원)',
    storyDetail: '무인 카페를 열었으나 인근 경쟁점 난립으로 월세조차 안 나와 4개월 만에 폐업 위기에 몰림.',
    specialNote: '기계 담보(리스) 별제권 처리 문제와 사업자 폐업 후 일반 근로자/알바로 전향해 회생을 진행할지 여부 상담 필요.',
  },
  {
    causeType: 'fraud',
    originTitle: '전세 사기 (빌라왕 깡통전세 보증금 미반환)',
    totalDebt: 130000000,
    debtSummary: 'HUG/카카오 버팀목 전세자금대출 1억 2,000만 원 + 신용대출 1,000만 원',
    storyDetail: '임대인이 사망/잠적하여 전세 보증금 1억 3천을 돌려받지 못하고 경매가 개시됨. 전세대출 만기가 도래해 신용불량 위기.',
    specialNote: '전세사기 피해자 특별법 인정 여부 및 경매 배당 후 남은 잔여 전세대출 원금의 개인회생 포함 절차 안내.',
  },
  {
    causeType: 'fraud',
    originTitle: '저금리 대환대출 빙자 보이스피싱 2차 채무',
    totalDebt: 42000000,
    debtSummary: 'SBI저축은행 2,200만, OK저축은행 2,000만 (총 4,200만 원)',
    storyDetail: '기존 대출을 정부지원 저금리로 대환해 준다는 말에 속아 현금 인출 전달책에게 돈을 건네고 빚만 2배로 늚.',
    specialNote: '상담원을 사기범으로 극도로 경계하며 "또 사기 치려는 거 아니냐, 내 번호 어디서 알았냐"며 방어적으로 따짐.',
  },
  {
    causeType: 'living',
    originTitle: '생계비 부족으로 인한 카드론 및 돌려막기 누적',
    totalDebt: 52000000,
    debtSummary: '현대/삼성/신한 카드론 4건 3,400만, 현금서비스 800만, 햇살론 1,000만 (총 5,200만 원)',
    storyDetail: '자녀 학비와 물가 상승으로 생활비가 부족해 카드론을 쓰기 시작했고, 최근 6개월간 이자 돌려막기 한계에 도달함.',
    specialNote: '생계형 채무로 법원 심리가 매우 우호적임. 연체 5일 차로 추심 문자가 쏟아져 금지명령이 시급한 상황.',
  },
  {
    causeType: 'medical',
    originTitle: '모친 암 수술비 및 장기 요양 간병비',
    totalDebt: 64000000,
    debtSummary: '신용대출 3,000만, 2금융 캐피탈 2,400만, 지인 차용증 1,000만 (총 6,400만 원)',
    storyDetail: '어머니의 뇌경색과 암 수술, 매월 150만 원씩 들어가는 요양병원 간병비로 인해 대출이 눈덩이처럼 불어남.',
    specialNote: '부모님 부양가족 인정 여부(만 65세 이상, 재산 없음 입증)를 문진하여 법정 생계비를 높여줄 수 있는지 파악 필요.',
  },
  {
    causeType: 'workout_shift',
    originTitle: '신용회복위원회 신속채무조정 6개월 유예 만료',
    totalDebt: 68000000,
    debtSummary: '신복위 협약 채무 5,500만 (원금 감면 0원), 비협약 대부 1,300만 (총 6,800만 원)',
    storyDetail: '신복위에서 원금 탕감 없이 상환 유예만 2번 받았으나, 다음 달부터 월 110만 원씩 원금을 갚아야 해 도저히 감당 불가.',
    specialNote: '"신복위 하고 있는데 회생으로 갈아탈 수 있나요?"라고 직접 묻는 케이스. 원금 최대 90% 탕감 가능한 회생의 이점을 비교 설명.',
  },
  {
    causeType: 'workout_shift',
    originTitle: '개인 워크아웃 진행 중 원금 미탕감 불만',
    totalDebt: 45000000,
    debtSummary: '워크아웃 분납 잔액 3,800만 + 최근 신규 카드 700만 (총 4,500만 원)',
    storyDetail: '워크아웃을 1년째 갚고 있으나 원금이 거의 줄지 않고 신용등급이 영구히 묶여 있어 중도 포기 후 회생 전환을 원함.',
    specialNote: '채무 금액을 정확히 기억 못 하고 "대략 4천~5천 사이"라고 얼버무림. 정확한 부채증명서 발급 대행 안내 필요.',
  },
  {
    causeType: 'living',
    originTitle: '이혼 후 배우자 채무 독촉 및 양육비 체납',
    totalDebt: 60000000,
    debtSummary: '배우자 사업 연대보증 3,500만 + 본인 신용 2,500만 (총 6,000만 원)',
    storyDetail: '작년에 이혼했으나 전 배우자가 남긴 채무 독촉장이 본인에게 날아오고, 혼자 아이를 키우며 경제적 파탄 상태.',
    specialNote: '미성년 자녀 1명을 본인이 전담 양육 중이므로 2인 가구 생계비(233만 원) 인정 대상임을 짚어주어야 함.',
  },
  {
    causeType: 'living',
    originTitle: '아파트 청약 당첨 후 신용 관리 및 대출 절벽',
    totalDebt: 85000000,
    debtSummary: '신용대출 5,000만, 마이너스통장 3,500만 (총 8,500만 원)',
    storyDetail: '2028년 아파트 입주 예정으로 모기지 잔금 대출을 받아야 하는데, 기존 신용대출 8,500 때문에 계약금을 못 넣을 위기.',
    specialNote: '"개인회생 들어가면 청약 당첨된 아파트 취소되나요?"라며 극도로 불안해함. 분양권 청산가치 반영 및 입주 가능성 법률 상담.',
  },
];

// 3. 실전 주거 & 재산 풀 (청산가치 산정용)
interface HousingSeed {
  housingText: string;
  equityValue: number; // 본인 인정 재산 청산가치 (원)
  isExemptDeposit: boolean; // 소액임차보증금 최우선변제 보호 대상 여부
}

const REAL_HOUSINGS: HousingSeed[] = [
  { housingText: 'LH 임대아파트 (보증금 1,500만 원 전액 본인 자부담, 월세 14만 원)', equityValue: 0, isExemptDeposit: true },
  { housingText: 'LH 청년전세 (보증금 3,600만 원 중 LH 대출 3,500 / 본인 자부담 100만 원, 월세 없음)', equityValue: 1000000, isExemptDeposit: true },
  { housingText: '빌라 월세 (보증금 1,000만 원 / 월세 60만 원, 계약자 본인 명의)', equityValue: 0, isExemptDeposit: true },
  { housingText: '다가구 월세 (보증금 2,000만 원 / 월세 45만 원, 본인 명의)', equityValue: 0, isExemptDeposit: true },
  { housingText: '오피스텔 전세 (보증금 1억 2,000만 원 / 은행 전세대출 1억 원 질권설정, 본인 자부담 2,000만)', equityValue: 20000000, isExemptDeposit: false },
  { housingText: '무상거주 (부모님 명의 아파트 동거, 본인 명의 재산 0원)', equityValue: 0, isExemptDeposit: true },
  { housingText: '무상거주 (친구/지인 명의 빌라 동거, 본인 재산 전무)', equityValue: 0, isExemptDeposit: true },
  { housingText: '배우자 명의 빌라 (시세 3억 원 / 전세보증금 1억 9천 세안고 매매, 본인 재산 없음)', equityValue: 55000000, isExemptDeposit: false }, // 배우자 재산 50% 반영 시 청산가치 약 5,500만
  { housingText: '자가 아파트 (KB시세 4억 2천 / 1순위 은행 주택담보대출 3억 2천, 잉여가치 1억)', equityValue: 100000000, isExemptDeposit: false },
  { housingText: '자가 아파트 (시세 5억 원 / 은행 담보대출 3억 8천, 본인 잉여가치 1억 2,000만 원)', equityValue: 120000000, isExemptDeposit: false }, // 재산 초과 케이스용
  { housingText: '고시원 거주 (보증금 없음, 월세 45만 원, 주민등록 최근 재등록)', equityValue: 0, isExemptDeposit: true },
  { housingText: '중고 1톤 화물차 1대 (시세 1,200만 / 캐피탈 저당 잔여 1,000만)', equityValue: 2000000, isExemptDeposit: false },
];

// 4. 관할 법원 풀 (2026년 대전·대구·광주 회생법원 신설 개원 전격 반영)
interface CourtSeed {
  region: string;
  courtName: string;
  isSpecialized: boolean; // 2026 전국 6대 전문 회생법원(서울·수원·부산·대전·대구·광주) 여부
  stayOrderDays: string;
  commencementMonths: string;
  cryptoRule: 'exclude' | 'include'; // exclude = 주식/코인 손실금 청산가치 제외(유리), include = 반영(불리)
}

const REAL_COURTS: CourtSeed[] = [
  // 1) 서울회생법원
  { region: '서울 강서구 화곡동', courtName: '서울회생법원', isSpecialized: true, stayOrderDays: '3~5일', commencementMonths: '3~4개월', cryptoRule: 'exclude' },
  { region: '서울 은평구 응암동', courtName: '서울회생법원', isSpecialized: true, stayOrderDays: '3~5일', commencementMonths: '3~4개월', cryptoRule: 'exclude' },
  { region: '서울 송파구 잠실동', courtName: '서울회생법원', isSpecialized: true, stayOrderDays: '3~5일', commencementMonths: '3~4개월', cryptoRule: 'exclude' },

  // 2) 수원회생법원
  { region: '경기 수원시 팔달구', courtName: '수원회생법원', isSpecialized: true, stayOrderDays: '4~7일', commencementMonths: '4~5개월', cryptoRule: 'exclude' },
  { region: '경기 의왕시 / 안양시', courtName: '수원회생법원', isSpecialized: true, stayOrderDays: '4~7일', commencementMonths: '4~5개월', cryptoRule: 'exclude' },
  { region: '경기 화성시 / 동탄', courtName: '수원회생법원', isSpecialized: true, stayOrderDays: '4~7일', commencementMonths: '4~5개월', cryptoRule: 'exclude' },

  // 3) 부산회생법원
  { region: '부산 해운대구 / 기장역', courtName: '부산회생법원', isSpecialized: true, stayOrderDays: '4~7일', commencementMonths: '4~5개월', cryptoRule: 'exclude' },
  { region: '울산 남구 / 삼산동', courtName: '부산회생법원', isSpecialized: true, stayOrderDays: '4~7일', commencementMonths: '4~5개월', cryptoRule: 'exclude' },

  // 4) 대전회생법원 (2026년 신설 개원: 대전, 세종, 충남 전역)
  { region: '대전 서구 둔산동 / 유성구', courtName: '대전회생법원', isSpecialized: true, stayOrderDays: '3~7일', commencementMonths: '3~5개월', cryptoRule: 'exclude' },
  { region: '충남 천안시 / 아산시', courtName: '대전회생법원', isSpecialized: true, stayOrderDays: '3~7일', commencementMonths: '3~5개월', cryptoRule: 'exclude' },
  { region: '충남 예산군 / 당진시', courtName: '대전회생법원', isSpecialized: true, stayOrderDays: '3~7일', commencementMonths: '3~5개월', cryptoRule: 'exclude' },

  // 5) 대구회생법원 (2026년 신설 개원: 대구, 경북 전역)
  { region: '대구 수성구 / 범어동', courtName: '대구회생법원', isSpecialized: true, stayOrderDays: '4~7일', commencementMonths: '4~5개월', cryptoRule: 'exclude' },
  { region: '대구 달서구 / 달성군', courtName: '대구회생법원', isSpecialized: true, stayOrderDays: '4~7일', commencementMonths: '4~5개월', cryptoRule: 'exclude' },
  { region: '경북 구미시 / 포항시', courtName: '대구회생법원', isSpecialized: true, stayOrderDays: '4~7일', commencementMonths: '4~5개월', cryptoRule: 'exclude' },

  // 6) 광주회생법원 (2026년 신설 개원: 광주, 전남 전역)
  { region: '광주 서구 치평동 / 상무지구', courtName: '광주회생법원', isSpecialized: true, stayOrderDays: '4~7일', commencementMonths: '4~5개월', cryptoRule: 'exclude' },
  { region: '광주 북구 / 광산구', courtName: '광주회생법원', isSpecialized: true, stayOrderDays: '4~7일', commencementMonths: '4~5개월', cryptoRule: 'exclude' },
  { region: '전남 순천시 / 여수시', courtName: '광주회생법원', isSpecialized: true, stayOrderDays: '4~7일', commencementMonths: '4~5개월', cryptoRule: 'exclude' },

  // 7) 일반 지방법원 본원 도산부 (전문 회생법원 미설치 지역)
  { region: '인천 부평구 / 계양구', courtName: '인천지방법원', isSpecialized: false, stayOrderDays: '7~14일', commencementMonths: '6~8개월', cryptoRule: 'include' },
  { region: '경기 고양시 일산동구', courtName: '의정부지방법원', isSpecialized: false, stayOrderDays: '7~14일', commencementMonths: '6~9개월', cryptoRule: 'include' },
  { region: '전북 전주시 덕진구 / 군산시', courtName: '전주지방법원', isSpecialized: false, stayOrderDays: '7~14일', commencementMonths: '7~10개월', cryptoRule: 'include' },
  { region: '충북 청주시 상당구 / 충주시', courtName: '청주지방법원', isSpecialized: false, stayOrderDays: '7~12일', commencementMonths: '6~9개월', cryptoRule: 'include' },
  { region: '경남 창원시 성산구 / 김해시', courtName: '창원지방법원', isSpecialized: false, stayOrderDays: '7~14일', commencementMonths: '7~10개월', cryptoRule: 'include' },
];

// 5. 통화 당시 현실적 물리 환경 풀
interface PhysicalContextSeed {
  contextName: string;
  initialOpeningText: string;
  promptGuideline: string;
}

const PHYSICAL_CONTEXTS: PhysicalContextSeed[] = [
  {
    contextName: '🚗 차량 운전 중 (블루투스 스피커폰)',
    initialOpeningText: '여보세요? 아, 저 지금 운전 중인데요. 어디시죠?',
    promptGuideline: '너는 지금 고속도로나 시내 도로를 운전하며 핸즈프리/스피커폰으로 전화를 받았다. 주변 차 소음이 들릴 수 있고, 길게 말하기 어려워 단답으로 짧게 대답한다. 상담원이 "운전 중이시면 안전을 위해 30초 내로 핵심만 안내해 드리고 편하신 시간에 다시 연락드릴까요?"라고 배려하면 매우 고마워한다.',
  },
  {
    contextName: '🏗️ 건설/공사 현장 근무 중 (소음/주변 분주)',
    initialOpeningText: '여보세요! 아 지금 현장이라 소리가 잘 안 들려요! 어디시라고요?!',
    promptGuideline: '너는 건설 공사 현장에서 안전모를 쓰고 작업하다가 전화를 받았다. 주변 그라인더나 중장비 소음이 심하다. 목소리를 크게 내야 하고 "제가 지금 현장 일하느라 통화가 어려우니 5시 이후나 저녁에 다시 해주쇼!"라고 서두른다.',
  },
  {
    contextName: '🏢 사무실 근무 중 (상사 눈치/소곤소곤)',
    initialOpeningText: '여보세요... (소곤소곤) 네, 말씀하세요. 어디신가요?',
    promptGuideline: '너는 지금 회사 사무실에서 옆자리 팀장과 동료들 눈치를 보며 작은 목소리로 조심스럽게 전화를 받았다. 큰 소리로 빚이나 대출 이야기를 할 수 없다. 상담원이 "직장 동료분들 계셔서 통화 곤란하시죠? 카톡이나 문자로 1차 체크리스트 남겨드릴까요?"라고 눈치 있게 나오면 안도한다.',
  },
  {
    contextName: '🍳 식당 영업 준비 중 (오픈 준비/바쁜 상황)',
    initialOpeningText: '여보세요? 아 지금 장사 오픈 준비하느라 바쁜데 무슨 용건이시죠?!',
    promptGuideline: '너는 지금 식자재를 손질하고 손님 맞을 준비를 하느라 정신이 없다. 상담원이 말을 늘어놓으면 "아 사장님! 바쁘다니까요! 3시 브레이크 타임에 다시 해요!"라고 쏘아붙인다.',
  },
  {
    contextName: '🛋️ 자택 휴식 중 (편안한 통화 가능)',
    initialOpeningText: '네, 여보세요? 어디서 전화 주신 건가요?',
    promptGuideline: '너는 집에서 쉬고 있거나 여유로운 상태에서 전화를 받았다. 상담원이 정중하고 명확하게 질문하면 차분하게 자기 사연을 솔직히 털어놓을 준비가 되어 있다.',
  },
];

// 6. 심리적 태도/방어기제 유형 풀
interface PsychologicalSeed {
  traitName: string;
  attitudeTag: 'calm' | 'anxious' | 'annoyed' | 'angry';
  behaviorRule: string;
}

const PSYCHOLOGICAL_TRAITS: PsychologicalSeed[] = [
  {
    traitName: '😊 협조/순응형 (Easy)',
    attitudeTag: 'calm',
    behaviorRule: '상담원의 소속 안내와 질문에 솔직하고 차분하게 답한다. 자신의 빚 때문에 힘들었던 사정을 차분히 설명하며 법률적 도움을 간절히 바란다.',
  },
  {
    traitName: '😰 불안/패닉형 (Anxious)',
    attitudeTag: 'anxious',
    behaviorRule: '채권추심 문자와 급여 압류 딱지가 붙을까 봐 공포에 질려 있다. "정말 압류 들어오나요?", "직장에 알려지면 어떡하죠?"라며 다급하게 해결책을 되묻는다.',
  },
  {
    traitName: '🧐 의심/번호추궁형 (Skeptical)',
    attitudeTag: 'annoyed',
    behaviorRule: '"아니 내 번호는 어떻게 알고 건 거요?! 불법 사기 아니요?!", "수임료부터 뜯어가려는 거 아니오?"라며 삿대질하듯 따진다. 정식 법원 접수 및 100% 무료 조회임을 입증해야 경계를 푼다.',
  },
  {
    traitName: '🤐 단답/회피형 (Avoidant)',
    attitudeTag: 'calm',
    behaviorRule: '자존심이 상하거나 본인의 빚 상황을 남에게 말하기 껄끄러워 "네...", "아니요", "잘 몰라요", "기억 안 나요"로만 일관한다. 상담원이 질문을 구체적 선택지로 쪼개어 물어봐야만 겨우 입을 연다.',
  },
  {
    traitName: '🤬 분노/공격형 (Aggressive)',
    attitudeTag: 'angry',
    behaviorRule: '이미 다른 사무실에서 수수료만 뜯겼거나 타사에서 부결을 겪어 신경이 극도로 날카롭다. 시작부터 언성을 높이며 "아까는 된다더니 왜 또 귀찮게 전화질이야?!"라며 화를 낸다.',
  },
];

// ============================================
// 2026 회생·파산 법률 자동 계산 알고리즘 (Ground Truth)
// ============================================
export const calculateLegalDiagnosis = (
  monthlyIncome: number,
  dependentsCount: number,
  totalDebt: number,
  totalAssets: number,
  isUnemployed: boolean,
  court: CourtSeed,
  debtCause: string,
  housingText: string = '',
  age: number = 35
): GroundTruthLegalDiagnosis => {
  // 1. 인정 법정 최저생계비 산정 (보건복지부 공식 고시 기준 중위소득 60%)
  const recognizedLivingCost = DEFAULT_LIVING_COST[Math.min(dependentsCount, 6) as keyof typeof DEFAULT_LIVING_COST] || 1435208;

  // 2. 가용소득 (월 변제금) 산출
  let monthlyPayment = Math.max(0, monthlyIncome - recognizedLivingCost);

  // 3. 신청 적격 판정 (Suitability)
  let suitability: '개인회생' | '개인파산' | '신복위/워크아웃' | '일반회생' = '개인회생';
  let suitabilityReason = '';

  if (totalDebt > 1000000000) {
    // 무담보 채무 10억 초과 시 일반회생
    suitability = '일반회생';
    suitabilityReason = `무담보 채무가 10억 원을 초과(${Math.round(totalDebt / 100000000)}억 원대)하여 법률상 개인회생 신청 대상이 아니며, 법원 전문재판부 일반회생(고액도산) 대상입니다.`;
  } else if (totalAssets >= totalDebt && totalAssets > 30000000) {
    // 재산이 채무보다 많은 경우 (청산가치 초과 / 지급불능 미충족)
    suitability = '신복위/워크아웃';
    suitabilityReason = `보유 재산(청산가치 약 ${Math.round(totalAssets / 10000)}만 원)이 총 채무(${Math.round(totalDebt / 10000)}만 원)보다 많아, 법률상 [지급불능] 요건을 갖추지 못해 법원 회생/파산 모두 기각됩니다. 재산 매각 또는 1금융권 저금리 담보대환이 필요합니다.`;
  } else if (totalDebt < 15000000) {
    // 채무 1,500만 원 미만 (소액 채무: 1,200만 원 등)
    suitability = '신복위/워크아웃';
    suitabilityReason = `총 채무액이 ${Math.round(totalDebt / 10000)}만 원으로 소액입니다. 법원 개인회생 진행 시 수임료/송달료 등 비용 부담(약 150~250만 원)이 총 채무의 15% 이상을 차지하여 실익이 전혀 없습니다. 신청비 5만 원으로 원금 분할 상환이 가능한 신용회복위원회의 프리워크아웃 또는 신속채무조정이 최적의 정답입니다.`;
  } else if (isUnemployed || monthlyIncome <= recognizedLivingCost) {
    // 소득이 없거나 최저생계비 미만인 경우
    if (totalAssets > totalDebt) {
      suitability = '신복위/워크아웃';
      suitabilityReason = '재산이 채무보다 많아 회생/파산 모두 불가하며, 자산 매각 또는 신용회복위원회 분할상환 대상입니다.';
    } else {
      suitability = '개인파산';
      suitabilityReason = `월 소득(${Math.round(monthlyIncome / 10000)}만 원)이 법정 최저생계비(${Math.round(recognizedLivingCost / 10000)}만 원)에 미달하거나 근로 능력이 결여되어, 파산선고 및 면책 신청이 가장 유리합니다.`;
    }
  } else {
    suitability = '개인회생';
    suitabilityReason = `계속적·반복적 소득이 최저생계비를 초과(${Math.round(monthlyPayment / 10000)}만 원 가용소득 발생)하여 개인회생 신청 최적격입니다.`;
  }

  // 4. 변제기간 및 청산가치 보장의 원칙 계산
  let repaymentPeriod = 36; // 기본 36개월
  let totalRepayment = monthlyPayment * repaymentPeriod;

  // 36개월 총 변제금이 청산가치(재산)에 미달하는 경우 변제기간을 37~60개월까지 연장
  if (suitability === '개인회생' && totalAssets > 0) {
    if (totalRepayment < totalAssets && monthlyPayment > 0) {
      const requiredMonths = Math.ceil(totalAssets / monthlyPayment);
      repaymentPeriod = Math.min(60, Math.max(36, requiredMonths));
      totalRepayment = monthlyPayment * repaymentPeriod;
    }
  }

  // 총 변제액은 총 채무원금을 초과할 수 없음 (100% 원금 변제 시 조기 종료)
  if (totalRepayment > totalDebt) {
    totalRepayment = totalDebt;
    if (monthlyPayment > 0) {
      repaymentPeriod = Math.min(repaymentPeriod, Math.ceil(totalDebt / monthlyPayment));
    }
  }

  // 탕감률 계산
  const estimatedForgivenessRate = totalDebt > 0 && suitability === '개인회생'
    ? Math.max(0, Math.round(((totalDebt - totalRepayment) / totalDebt) * 100))
    : suitability === '개인파산' ? 100 : 0;

  // 5. 관할 법원 실무 특성 노트
  let courtRuleNote = `${court.courtName} 관할 (금지명령 ${court.stayOrderDays}, 개시결정 ${court.commencementMonths}). `;
  if (court.isSpecialized) {
    courtRuleNote += '2026년 전국 6대 전문 회생법원(서울·수원·부산·대전·대구·광주) 관할로, 전담 재판부의 신속한 개시 및 주식/코인 투자 손실금 청산가치 제외(준칙 408호) 등 채무자 탕감률에 매우 우호적임.';
  } else {
    courtRuleNote += '일반 지방법원 본원 관할로 최근 1년 채무 및 투자 손실금의 청산가치 가산 요구 등 심리가 상대적으로 보수적임.';
  }

  // 6. 1차 TM 상담원 추천 법률 후킹 멘트 (분쟁 위험 0% + 고객 신뢰/호기심 유발)
  let recommendedLegalHook = '';
  if (totalDebt < 15000000) {
    recommendedLegalHook = '💡 [소액채무 솔직 안내 후킹]: "고객님, 총 채무가 약 1,200~1,400만 원 선이시면 법원 회생을 하실 경우 수임료 등 비용이 너무 커서 배보다 배꼽이 더 큽니다! 저희 법률사무소의 이익보다 고객님의 실익을 먼저 생각해서 솔직히 말씀드리자면, 신용회복위원회 프리워크아웃(신청비 5만 원)을 먼저 신청하시는 것이 비용도 크게 아끼고 가장 현명하십니다!"';
  } else if (totalAssets >= totalDebt && totalAssets > 30000000) {
    recommendedLegalHook = '💡 [자산초과 기각안내 후킹]: "고객님, 법률상 보유 재산이 빚보다 많으시면 법원에서 회생 기각 결정이 납니다. 소중한 재산을 지키시려면 무리하게 회생을 넣기보다 1금융권 저금리 담보대출로 고금리 채무를 대환하거나 분할 상환 방식을 찾으셔야 합니다!"';
  } else if (totalDebt > 1000000000) {
    recommendedLegalHook = '💡 [초고액 일반회생 전문 후킹]: "무담보 채무가 10억 원을 초과하는 고액 채무는 일반 개인회생이 아닌 법원 [일반회생] 전담부로 가셔야 하므로, 고액 전문 도산 사무장님과의 정밀 심층 배정이 필수입니다!"';
  } else if (debtCause === 'recent_debt') {
    recommendedLegalHook = '💡 [최근 채무 소명 대비 후킹]: "최근 1~2개월 내 대출 비중이 높으시면 법원에서 사기 대출 의심과 엄격한 소명 요구가 나오지만, 저희 사무실의 금융 거래내역 정밀 소명 노하우로 기각 없이 안전하게 인가받을 수 있도록 방어해 드립니다!"';
  } else if (debtCause === 'gambling') {
    recommendedLegalHook = '💡 [도박채무 회생 준칙 후킹]: "도박이나 사설 토토 채무는 법률상 개인파산은 100% 면책 불허가로 기각되지만, 개인회생은 성실 변제 계획안을 제출하면 법원 인가를 받아 독촉을 끊어낼 수 있습니다!"';
  } else if (debtCause === 'tax_heavy') {
    recommendedLegalHook = '💡 [세금 우선변제 18개월 후킹]: "세금 체납은 탕감 대상은 아니지만, 회생을 통해 최대 18개월간 무이자 분할 납부로 유예받고 홈택스 발급 제한과 통장 압류를 즉시 해제할 수 있습니다!"';
  } else if (suitability === '개인파산') {
    recommendedLegalHook = '💡 [파산 면책 후킹]: "고객님처럼 소득이 없으시거나 건강상 근로가 어려우신 경우, 매달 갚아나가는 회생보다 빚을 100% 일시에 면책받는 개인파산이 법적으로 훨씬 적합하십니다!"';
  } else if (housingText.includes('배우자') || (court.isSpecialized && housingText.includes('빌라'))) {
    recommendedLegalHook = `💡 [배우자 재산 미반영 후킹]: "회생법원은 실무준칙상 배우자 명의의 재산을 신청인의 재산으로 보지 않기 때문에 회생 인가 확률과 탕감률이 훨씬 높아집니다!"`;
  } else if (debtCause === 'crypto' || debtCause.includes('코인')) {
    recommendedLegalHook = `💡 [코인·주식 준칙 후킹]: "${court.isSpecialized ? court.courtName : '회생법원'} 준칙 제408호에 따라 코인·주식으로 잃으신 손실금은 재산에 잡히지 않아 전액 탕감 대상으로 인정받으실 수 있습니다!"`;
  } else if (age <= 30) {
    recommendedLegalHook = '💡 [청년 단축 특례 후킹]: "고객님은 만 30세 이하 청년 특례 대상이실 수 있어, 36개월 대신 24개월 안팎으로 변제기간을 줄여 조기 졸업하실 수 있습니다!"';
  } else if (debtCause === 'business') {
    recommendedLegalHook = '💡 [사업자 체납 포함 후킹]: "개인회생은 은행 빚뿐만 아니라 사업자 부가가치세 체납과 4대보험 미납금까지 변제계획안에 함께 묶어 안전하게 분할 처리할 수 있습니다!"';
  } else {
    recommendedLegalHook = `💡 [신속 금지명령 후킹]: "접수 즉시 ${court.stayOrderDays} 안에 법원 금지명령이 나오므로, 빚 독촉 전화나 통장 압류부터 합법적으로 완벽히 막아드릴 수 있습니다!"`;
  }

  return {
    suitability,
    suitabilityReason,
    recognizedLivingCost,
    expectedMonthlyPayment: suitability === '개인회생' ? monthlyPayment : 0,
    expectedRepaymentPeriod: suitability === '개인회생' ? repaymentPeriod : 0,
    totalRepaymentAmount: suitability === '개인회생' ? totalRepayment : 0,
    estimatedForgivenessRate,
    courtStayOrderDays: court.stayOrderDays,
    courtCommencementMonths: court.commencementMonths,
    courtRuleNote,
    recommendedLegalHook,
  };
};

// ============================================
// 무한 AI 가상 고객 페르소나 생성기 (Infinite Procedural Engine)
// ============================================
export const generateInfinitePersona = (themeId: string = 'all'): TrainingPersona & { groundTruth: GroundTruthLegalDiagnosis } => {
  const timestamp = Date.now();

  // 1. 테마에 따른 필터링
  let candidateDebts = REAL_DEBTS;
  let candidateJobs = REAL_JOBS;
  let candidateHousings = REAL_HOUSINGS;
  let candidateContexts = PHYSICAL_CONTEXTS;
  let candidateTraits = PSYCHOLOGICAL_TRAITS;

  if (themeId === 'small_debt') {
    candidateDebts = REAL_DEBTS.filter(d => d.causeType === 'small_debt');
  } else if (themeId === 'high_debt') {
    candidateDebts = REAL_DEBTS.filter(d => d.causeType === 'high_debt');
    candidateJobs = REAL_JOBS.filter(j => j.category === 'business');
  } else if (themeId === 'asset_rich') {
    candidateDebts = REAL_DEBTS.filter(d => d.causeType === 'asset_rich');
    candidateHousings = REAL_HOUSINGS.filter(h => h.equityValue >= 100000000);
  } else if (themeId === 'stock_crypto') {
    candidateDebts = REAL_DEBTS.filter(d => d.causeType === 'crypto');
    candidateJobs = REAL_JOBS.filter(j => j.category === 'office' || j.category === 'freelancer');
  } else if (themeId === 'business_tax') {
    candidateDebts = REAL_DEBTS.filter(d => d.causeType === 'business' || d.causeType === 'tax_heavy');
    candidateJobs = REAL_JOBS.filter(j => j.category === 'business');
  } else if (themeId === 'charter_fraud') {
    candidateDebts = REAL_DEBTS.filter(d => d.causeType === 'fraud');
  } else if (themeId === 'bankruptcy_candidate') {
    candidateJobs = REAL_JOBS.filter(j => j.category === 'unemployed' || j.monthlyNetIncome < 1500000);
  } else if (themeId === 'workout_shift') {
    candidateDebts = REAL_DEBTS.filter(d => d.causeType === 'workout_shift');
  } else if (themeId === 'busy_context') {
    candidateContexts = PHYSICAL_CONTEXTS.filter(c => c.contextName.includes('운전') || c.contextName.includes('현장') || c.contextName.includes('오픈'));
  } else if (themeId === 'difficult_skeptic') {
    candidateTraits = PSYCHOLOGICAL_TRAITS.filter(t => t.traitName.includes('의심') || t.traitName.includes('단답') || t.traitName.includes('분노'));
  }

  // 2. 무작위 선택
  const debt = candidateDebts[Math.floor(Math.random() * candidateDebts.length)];
  const job = candidateJobs[Math.floor(Math.random() * candidateJobs.length)];
  const housing = candidateHousings[Math.floor(Math.random() * candidateHousings.length)];
  const court = REAL_COURTS[Math.floor(Math.random() * REAL_COURTS.length)];
  const context = candidateContexts[Math.floor(Math.random() * candidateContexts.length)];
  const trait = candidateTraits[Math.floor(Math.random() * candidateTraits.length)];

  // 성별 및 나이 결정
  const isFemale = job.genderPreference === 'female' ? true : job.genderPreference === 'male' ? false : Math.random() > 0.5;
  const age = job.category === 'unemployed' ? 55 + Math.floor(Math.random() * 12) : 26 + Math.floor(Math.random() * 32); // 26~58세

  const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
  const firstName = isFemale
    ? FEMALE_NAMES[Math.floor(Math.random() * FEMALE_NAMES.length)]
    : MALE_NAMES[Math.floor(Math.random() * MALE_NAMES.length)];
  const fullName = `${surname}${firstName}`;
  const phone = `010-${Math.floor(2000 + Math.random() * 7000)}-${Math.floor(1000 + Math.random() * 8999)}`;

  // 부양가족 수 결정 (나이 및 결혼 상태 반영)
  let dependentsCount = 1;
  let familyText = '미혼 1인 가구';
  if (age >= 34 && age <= 50 && Math.random() > 0.3) {
    const kids = 1 + Math.floor(Math.random() * 2); // 1~2명
    dependentsCount = 1 + kids;
    familyText = `기혼 (미성년 자녀 ${kids}명 부양, 법정 ${dependentsCount}인 가구)`;
  } else if (age >= 50 && Math.random() > 0.5) {
    dependentsCount = 2;
    familyText = '배우자 및 고령 모친 부양 (2인 가구 인정)';
  }

  // 3. 법률 진단 정답 계산
  const groundTruth = calculateLegalDiagnosis(
    job.monthlyNetIncome,
    dependentsCount,
    debt.totalDebt,
    housing.equityValue,
    job.category === 'unemployed',
    court,
    debt.causeType,
    housing.housingText,
    age
  );

  // 음성 및 성우 세팅
  let neuralVoice = isFemale ? 'ko-KR-Neural2-A' : 'ko-KR-Neural2-C';
  let neuralPitch = isFemale ? '+0Hz' : '-5Hz';
  let neuralRate = '+5%';
  let pitch = isFemale ? 1.0 : 0.75;

  if (age >= 55 && !isFemale) {
    neuralVoice = 'ko-KR-Wavenet-D';
    neuralPitch = '-10Hz';
    pitch = 0.60;
  } else if (trait.attitudeTag === 'angry' || trait.attitudeTag === 'annoyed') {
    neuralVoice = isFemale ? 'ko-KR-Neural2-B' : 'ko-KR-Wavenet-C';
    neuralRate = '+10%';
    pitch = isFemale ? 1.05 : 0.70;
  }

  // 페르소나 프롬프트 합성
  const personaPrompt = `너는 ${age}세 ${isFemale ? '여성' : '남성'} 고객 ${fullName}이다.
[직업 및 소득]: ${job.job}, ${job.salaryRaw}
[주거 및 재산]: ${housing.housingText} (인정 재산가치: 약 ${Math.round(housing.equityValue / 10000)}만 원)
[거주 지역]: ${court.region} (관할: ${court.courtName})
[부양가족]: ${familyText}
[채무 사연]: ${debt.debtSummary}. 원인: ${debt.storyDetail}
[특이사항 및 실전 배경]: ${debt.specialNote}
[통화 당시 물리적 상황]: ${context.contextName}
- ${context.promptGuideline}
[고객 심리 및 태도]: ${trait.traitName}
- ${trait.behaviorRule}

[대화 수칙 - 실제 아웃바운드 수신 상황]
1. 너는 전화를 걸어온 사람(상담원)이 누구인지 아직 정확히 모르며, 전화 첫마디는 반드시 "${context.initialOpeningText}"로 시작했다.
2. 상담원의 말투, 배려심, 전문성에 따라 [화남], [짜증], [불안], [차분] 태도를 실시간으로 표현하라.
3. 실제 전화 통화처럼 **단 1문장(공백 포함 15~28자 내외)**의 직설적이고 생생한 실전 구어체로만 즉각 맞받아쳐라! 절대 2문장 이상 길게 설명조로 말하지 마라.
4. 처음부터 자기 사연과 소득을 술술 다 불지 말고, 상담원이 질문할 때마다 성향에 맞춰 하나씩 차분히 털어놓아라.`;

  return {
    id: `inf_${timestamp}_${Math.floor(Math.random() * 1000)}`,
    level: groundTruth.suitability === '개인파산' ? 4 : trait.attitudeTag === 'angry' ? 4 : 3,
    badge: `실전: ${job.job.split(' ')[0]} / ${debt.causeType === 'crypto' ? '코인빚투' : debt.causeType === 'business' ? '사업체납' : '채무상담'}`,
    customerName: fullName,
    age,
    gender: isFemale ? 'female' : 'male',
    phone,
    job: job.job,
    salary: job.salaryRaw,
    debtSummary: debt.debtSummary,
    housing: housing.housingText,
    difficulty: trait.attitudeTag === 'angry' ? '최고급' : trait.attitudeTag === 'annoyed' ? '상급' : '실전',
    title: `${court.region} ${job.job.split(' ')[0]} (${context.contextName.split(' ')[0]} ${trait.traitName.split(' ')[0]})`,
    scenarioDescription: `[실전 접수 사례 기반] ${debt.originTitle}. ${familyText}. ${context.contextName}. ${trait.traitName}.`,
    trainingGoal: `7대 문진을 완료하여 [${groundTruth.suitability}] 적격 여부 및 예상 월 변제금(${Math.round(groundTruth.expectedMonthlyPayment / 10000)}만 원)을 정확히 도출하기`,
    speechOptions: {
      pitch,
      rate: 1.05,
      gender: isFemale ? 'female' : 'male',
      neuralVoice,
      neuralRate,
      neuralPitch,
    },
    personaPrompt,
    initialMessage: context.initialOpeningText,
    groundTruth,
  };
};
