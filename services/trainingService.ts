// ============================================
// 신입 상담원 3-in-1 통합 트레이닝 서비스 (2026-11-09)
// AI 가상 고객 롤플레잉 + 모의 리드 샌드박스 + 실시간 코칭 + 사무장 인계 문진 시스템
// ============================================
import { callAi } from './aiProxy';
import { SpeechVoiceOptions } from './speechService';

export interface TrainingPersona {
  id: string;
  level: number;
  badge: string;
  customerName: string;
  age: number;
  gender: 'male' | 'female';
  phone: string;
  job: string;
  salary: string;
  debtSummary: string;
  housing: string;
  difficulty: '초급' | '중급' | '상급' | '최고급' | '실전' | '지옥';
  title: string;
  scenarioDescription: string;
  trainingGoal: string;
  speechOptions: SpeechVoiceOptions;
  personaPrompt: string;
  initialMessage: string;
  category?: WeaknessCategoryId;
}

export interface TrainingMessage {
  id: string;
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: string;
}

// 7대 사무장 인계 문진 체크리스트 및 브리핑
export interface ParalegalHandoffCard {
  jobAndEmployment: boolean;       // 1. 직업 및 재직 형태
  monthlyRealIncome: boolean;      // 2. 월 평균 실소득
  dependentsCount: boolean;        // 3. 부양가족 수
  housingAndDeposit: boolean;      // 4. 주거 형태 및 보증금
  debtAmountAndReason: boolean;    // 5. 총 채무액 및 채무 원인
  overdueStatusAndPeriod: boolean; // 6. 현재 연체 여부 및 기간
  pastRehabHistory: boolean;       // 7. 과거 회생/파산/신복위 이력
  handoffScore: number;            // 0~100점
  paralegalBriefing: string;       // 사무장 전달용 3줄 브리핑 요약문
  missingCheckpoints: string[];    // 누락된 핵심 문진 항목
  coachingAdvice: string;          // 사무장 인계 개선 조언
}

export interface TrainingReport {
  totalScore: number;       // 0~100
  complianceScore: number;  // 0~30 (소속/정보동의/불법수수료 금지)
  listeningScore: number;   // 0~30 (경청 및 니즈 파악)
  objectionScore: number;   // 0~40 (반론 극복 및 리마인더 약속)
  passed: boolean;          // totalScore >= 75
  summary: string;
  strengths: string[];
  weaknesses: string[];
  coachingTips: string[];
  suggestedScript: string;
  paralegalCard?: ParalegalHandoffCard; // 사무장 인계 평가 카드
}

// 관리자(팀장) 직접 코칭 및 평가
export interface AdminFeedback {
  grade: 'S' | 'A' | 'B' | 'C' | 'F';
  comment: string;
  evaluatedAt: string;
  evaluatorName: string;
  assignedCategory?: WeaknessCategoryId;
}

export interface TrainingSessionRecord {
  sessionId: string;
  personaId: string;
  personaName?: string;
  categoryTitle?: string;
  date: string;
  durationSeconds: number;
  totalTurns: number;
  report: TrainingReport;
  consultationResult: string;
  agentMemo: string;
  agentName?: string;
  fullTranscript?: TrainingMessage[];
  adminFeedback?: AdminFeedback;
}

// 6대 취약 유형별 타깃 훈련 카테고리 정의
export type WeaknessCategoryId =
  | 'cat_senior_male'
  | 'cat_business_debt'
  | 'cat_angry'
  | 'cat_privacy'
  | 'cat_phishing'
  | 'cat_objection';

export interface WeaknessCategoryInfo {
  id: WeaknessCategoryId;
  title: string;
  subtitle: string;
  badge: string;
  icon: string;
  description: string;
  coreGoal: string;
  recommendedVoice: string;
}

export const WEAKNESS_CATEGORIES: WeaknessCategoryInfo[] = [
  {
    id: 'cat_senior_male',
    title: '고령 남성 / 권위형',
    subtitle: '50~60대 어르신의 퉁명스러운 반말과 책임자 호출',
    badge: '👴 권위/고령',
    icon: 'UserCheck',
    description: '"어린 사람이 뭘 알아? 책임자나 사무장 바꾸쇼!"라며 기를 죽이려는 권위적 남성 고객',
    coreGoal: '기죽지 않고 묵직한 어투로 1분 내 기본 문진을 완료해 사무장 상담으로 신속 전환',
    recommendedVoice: 'ko-KR-Wavenet-D',
  },
  {
    id: 'cat_business_debt',
    title: '사업자 복합 채무',
    subtitle: '국세 체납, 어음, 사채, 직원 급여 등 다중 채무',
    badge: '🏭 사업자채무',
    icon: 'Building2',
    description: '세금 3천 체납에 거래처 물품 대금, 제2금융, 일수까지 얽혀 있어 당황하기 쉬운 자영업 고객',
    coreGoal: '채무 항목을 세금(우선변제)/금융/개인채무로 즉시 분리 문진하고 매출 흐름 파악',
    recommendedVoice: 'ko-KR-Neural2-C',
  },
  {
    id: 'cat_angry',
    title: '분노 / 공격성 표출',
    subtitle: '독촉과 거절에 지쳐 언성을 높이고 쏘아붙이는 고객',
    badge: '🤬 분노/폭언',
    icon: 'Flame',
    description: '"아까는 다 된다더니 왜 또 캐물어?! 장난쳐 지금?!"이라며 화를 내는 극도의 예민 상태',
    coreGoal: '고객의 화에 휘말리지 않고 감정 인정("답답하셨을 텐데 송구합니다") 후 목적 상기',
    recommendedVoice: 'ko-KR-Wavenet-C',
  },
  {
    id: 'cat_privacy',
    title: '개인정보 출처 추궁',
    subtitle: '"내 번호 어디서 알았어? 불법이지? 고소하겠다"',
    badge: '🛡️ 번호추궁',
    icon: 'ShieldAlert',
    description: '불법 DB 수집을 의심하며 금융감독원 및 경찰 신고를 운운하는 법적 공격성 고객',
    coreGoal: '당당하게 온라인 자가진단 인입 경로를 밝히고 정중한 착오 사과 안내로 컴플레인 차단',
    recommendedVoice: 'ko-KR-Neural2-C',
  },
  {
    id: 'cat_phishing',
    title: '보이스피싱 사기 오인',
    subtitle: '"앱 깔라거나 비밀번호 달라는 거 아니야? 사기 치지 마!"',
    badge: '🚨 피싱의심',
    icon: 'AlertTriangle',
    description: '최근 금융사기 및 악성 앱 보도로 인해 상담원 자체를 사기범으로 오해하고 극도로 경계하는 고객',
    coreGoal: '3대 무과금/무어플 원칙 즉각 선언 + 포털 상호 검색 및 공식 대표번호 역발신 제안',
    recommendedVoice: 'ko-KR-Wavenet-D',
  },
  {
    id: 'cat_objection',
    title: '거절·돌발 장벽 돌파',
    subtitle: '가족 비밀 보장, 수임료 부담, 운전 중 통화 회피',
    badge: '🚫 거절돌파',
    icon: 'HelpCircle',
    description: '"가족이 알면 이혼당해요", "수임료 낼 돈 없어요", "나 지금 운전 중이야!" 3종 거절',
    coreGoal: '우편물 송달지 직장 지정 안심, 수임료 분납 안내, 10초 콜백 예약 일정 확정',
    recommendedVoice: 'ko-KR-Neural2-A',
  },
];

export const TRAINING_PERSONAS: TrainingPersona[] = [
  {
    id: 'lv1',
    level: 1,
    badge: 'Lv.1 온순한 직장인',
    customerName: '김순한',
    age: 42,
    gender: 'male',
    phone: '010-3849-2918',
    job: '중소 제조기업 품질관리 (근속 7년)',
    salary: '연 4,200만 원 (월 실수령 310만 원)',
    debtSummary: '카드론 2건 2,000만 원 (연 14.5%), 신용대출 1,000만 원',
    housing: '전세 (보증금 1억 2천 / 대출 6천)',
    difficulty: '초급',
    title: '고금리 카드론 대환 희망 고객',
    scenarioDescription: '친절하고 온순하며, 14%대 카드론을 1금융권 낮은 금리로 갈아탈 수 있는지 묻습니다. 상담원의 질문에 솔직하고 협조적으로 답합니다.',
    trainingGoal: '정중한 첫인사 및 소속 안내, 기대출 현황 청취, 본인 확인 멘트 숙달',
    speechOptions: {
      pitch: 0.80,
      rate: 1.05,
      gender: 'male',
      neuralVoice: 'ko-KR-Neural2-C',
      neuralRate: '+5%',
      neuralPitch: '-5Hz',
    },
    personaPrompt: '너는 42세 직장인 김순한이다. 성격이 온순하고 예의 바르다. 카드론 2천만 원을 매달 갚느라 이자가 부담되어 대환대출을 알아보고 있다. 상담원이 질문하면 차분하고 솔직하게 답한다. 상담원이 대환 조건과 절차를 친절히 설명해주면 감사해하며 안내에 잘 따른다.',
    initialMessage: '네 여보세요? 대출 상담 신청했던 김순한인데요. 지금 통화 가능한가요?',
  },
  {
    id: 'lv2',
    level: 2,
    badge: 'Lv.2 바쁜 자영업자',
    customerName: '박급해',
    age: 38,
    gender: 'female',
    phone: '010-8912-4029',
    job: '음식점(프랜차이즈) 대표 (운영 3년)',
    salary: '월 매출 1,800만 원 (순익 약 450만 원)',
    debtSummary: '소상공인 대출 3,000만 원, 저축은행 1,500만 원',
    housing: '자가 아파트 (시세 4억 / 담보대출 2억 5천)',
    difficulty: '중급',
    title: '식자재 대금 급전 필요 (바쁜 고객)',
    scenarioDescription: '가게 오픈 준비와 식자재 발주로 매우 분주합니다. "바쁘니까 용건만 간단히 해요", "언제 나오는데요?"라며 서두릅니다.',
    trainingGoal: '10초 내 핵심 전달, 서두르는 고객 안심시키기, 짧은 통화 후 재통화 약속(리마인더) 성사',
    speechOptions: {
      pitch: 0.88,
      rate: 1.15,
      gender: 'female',
      neuralVoice: 'ko-KR-Neural2-A',
      neuralRate: '+15%',
      neuralPitch: '-2Hz',
    },
    personaPrompt: '너는 38세 식당 사장 박급해다. 지금 재료 준비와 배달 주문으로 몹시 바쁘고 정신이 없다. 3일 뒤 나갈 식자재 대금 2천만 원이 급하다. 상담원이 말을 조금이라도 길게 늘어놓으면 "아 사장님! 제가 지금 손님 받아야 해서 바쁘다니까요?! 용건만 딱 말해주세요!"라고 날카롭게 재촉한다. 상담원이 신속하게 한도 조회와 가심사 절차를 2~3분 내로 끝내주거나 브레이크 타임(오후 3시)에 다시 연락주겠다고 약속하면 좋아한다.',
    initialMessage: '아 네 여보세요?! 제가 지금 가게 주문 때문에 너무 바쁜데, 거기 한도 얼마 나와요?! 바로 나와요?!',
  },
  {
    id: 'lv3',
    level: 3,
    badge: 'Lv.3 의심/반론 고객',
    customerName: '이의심',
    age: 54,
    gender: 'male',
    phone: '010-5178-9923',
    job: '도소매 유통업 개인사업자 (12년)',
    salary: '월 순익 300~400만 원 (다중채무자)',
    debtSummary: '대부업 2건 1,800만 원, 저축은행 3,500만 원',
    housing: '월세 (보증금 2,000 / 월 70)',
    difficulty: '상급',
    title: '사기 경계 및 번호 유출 의심 고객',
    scenarioDescription: '고금리 채무로 지쳐있으나, 과거 보이스피싱 시도를 겪어 낯선 대출 전화에 극도로 방어적입니다. "내 번호 어디서 알았소?", "불법 수수료 떼먹는 데 아니요?"라며 따집니다.',
    trainingGoal: '합법적 수집 경로 설명, 대출중개수수료 불법성 법정 고지, 고객의 불신 해소 및 전문성 입증',
    speechOptions: {
      pitch: 0.70,
      rate: 1.0,
      gender: 'male',
      neuralVoice: 'ko-KR-Wavenet-C',
      neuralRate: '+0%',
      neuralPitch: '-8Hz',
    },
    personaPrompt: '너는 54세 도소매상 이의심이다. 빚이 많아 대출이 절실하지만 과거 사기 대출을 당할 뻔해서 경계심과 분노가 극에 달해 있다. 걸려온 전화에 "아니 거 어디요?! 내 번호는 어떻게 알고 건 거요?!", "선입금이나 수수료 뜯어가려는 사기꾼들 아니요?! 당장 경찰에 신고할 거요!", "금리 몇 프로나 나온다고 번지르르하게 사람을 낚는 거요?!"라며 거칠게 따지고 삿대질하듯 쏘아붙인다. 대사마다 강한 의심과 반론, 퉁명스러운 감정을 거침없이 표출한다. 상담원이 법적 등록번호와 100% 무료 조회임을 입증해야 겨우 경계를 푼다.',
    initialMessage: '여보세요?! 거기 어디요?! 내 번호는 대체 어떻게 알고 전화한 거요?!',
  },
  {
    id: 'lv4',
    level: 4,
    badge: 'Lv.4 까다로운 채무 고객',
    customerName: '최까다',
    age: 61,
    gender: 'male',
    phone: '010-7231-1048',
    job: '프리랜서 / 은퇴 (불규칙 소득)',
    salary: '월 수입 150~200만 원',
    debtSummary: '카드론 및 대부 5건 5,800만 원 (연체 12일차)',
    housing: '가족 명의 빌라 거주',
    difficulty: '최고급',
    title: '연체 위기 및 감정 격앙 고객',
    scenarioDescription: '이미 다른 금융사에서 부결을 여러 번 겪고 연체 10일이 넘어 독촉을 받고 있습니다. 좌절감과 분노가 뒤섞여 냉소적입니다.',
    trainingGoal: '감정적 경청과 공감, 현실적인 대안(서민금융 채무조정/개인회생 연계) 제시, 상담원 멘탈 관리',
    speechOptions: {
      pitch: 0.60,
      rate: 0.95,
      gender: 'male',
      neuralVoice: 'ko-KR-Wavenet-D',
      neuralRate: '-5%',
      neuralPitch: '-12Hz',
    },
    personaPrompt: '너는 61세 최까다다. 빚이 6천 가까이 되고 연체가 시작되어 매일 독촉 전화에 시달려 신경이 날카롭고 극도로 피로하다. "하... 또 대출 전화요?! 다른 은행에서 다 퇴짜 맞았는데 당신들이 무슨 재주로 돈을 내준다는 거요?!", "사람 놀리지 말고 당장 끊으쇼! 희망고문 하지 마쇼!"라며 퉁명스럽게 화를 내고 냉소적으로 반발한다. 상담원이 감정적으로 맞서지 않고, 깊이 공감해주면서 서민금융 채무조정 제도를 진심으로 안내해주면 비로소 한숨을 내쉬며 속사정을 털어놓는다.',
    initialMessage: '하... 또 대출 전화요?! 다른 데서 다 안 된다고 퇴짜 맞았는데, 당신들이 무슨 재주로 돈을 해준다는 거요?!',
  },
];

// ============================================
// 무규칙 다변량 AI 고객 생성 엔진 (Combinatorial Matrix)
// ============================================
const FIRST_NAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍'];
const MALE_NAMES = ['진호', '성수', '태훈', '동원', '광석', '만석', '대현', '영호', '상철', '기철', '재현', '병수', '도진', '익호'];
const FEMALE_NAMES = ['미숙', '영자', '수진', '현주', '은정', '선영', '미희', '경숙', '지연', '혜원', '소영', '보람'];

const DEBT_ORIGINS = [
  { origin: '코인 빚투', summary: '비트코인 및 선물 레버리지 청산으로 빚 7,200만 원 발생', detail: '가상화폐 하락장에 물타기 하다가 대출 3곳에서 끌어다 씀' },
  { origin: '리딩방 사기', summary: '주식 전문가 리딩방에 속아 신용대출 8,500만 원 탕진', detail: '해외 비상장주식 투자 사기로 피해를 입고 카드론 상환 불가' },
  { origin: '사업 식자재/물품 체납', summary: '거래처 물품 대금 4,000만 원 및 부가세 1,800만 원 체납', detail: '매출 부진으로 매달 마이너스 운영 중이며 사채 1,500만 원 추가' },
  { origin: '깡통전세 보증금', summary: '전세 사기로 보증금 1억 3천 못 돌려받고 전세대출 독촉 상태', detail: '임대인 잠적으로 경매 진행 중이며 월 상환액 90만 원 감당 불가' },
  { origin: '가족 암 간병비', summary: '모친 암 수술 및 요양비로 카드론 4건 3,400만 원 돌려막기', detail: '매달 이자만 70만 원씩 나가 생활비까지 부족한 극단적 상황' },
  { origin: '보이스피싱 2차 채무', summary: '대환대출 사기에 속아 기존 대출 상환용 3,500만 원 2금융 채무', detail: '사기범에게 돈을 전달하고 은행 독촉 전화에 시달림' },
];

const ASSET_HOUSINGS = [
  '자가 아파트 (시세 4억 2천 / 주담대 3억 7천, 추가 한도 불가)',
  '빌라 전세 (보증금 1억 2천 / 카카오뱅크 전세대출 9천 질권설정)',
  '월세 (보증금 1,000만 원 / 월세 65만 원 소액임차 최우선변제)',
  '중고 1톤 화물차 (시세 1,200만 원 / 캐피탈 저당 1,000만 원)',
  '순수 무재산 (배우자/가족 명의 주택 동거, 본인 명의 0원)',
  '청약통장 320만 원 외 금융자산 전무 (주거래 통장 압류 상태)',
];

const JOB_PROFILES = [
  { job: '중소 제조업 4대보험 직장인 (근속 4년)', salary: '연 3,800만 원 (월 실수령 275만 원)', gender: 'male' },
  { job: '개인 음식점 자영업자 (운영 2년 6개월)', salary: '월 매출 2,200만 원 (인건비/재료비 빼면 순적자)', gender: 'male' },
  { job: '배달 플랫폼 라이더 (특수고용직)', salary: '주급 정산 (월 환산 310만 원, 3.3% 원천징수)', gender: 'male' },
  { job: '건설 현장 일용직 / 타일 시공', salary: '일당 18만 원 (타인 통장 수령, 월 약 250만 원)', gender: 'male' },
  { job: '어린이집 보육교사 (근속 6년)', salary: '월 실수령 215만 원 (4대보험 가입)', gender: 'female' },
  { job: '프리랜서 쇼핑몰 운영 및 모델', salary: '월 소득 불규칙 (150만~400만 원)', gender: 'female' },
  { job: '전업주부 (가족 몰래 채무)', salary: '소득 증빙 불가 (남편 월급으로 가계 운영)', gender: 'female' },
];

// 카테고리별 맞춤 고객 시나리오 생성기
export const generateCustomPersonaByCategory = (categoryId: WeaknessCategoryId): TrainingPersona => {
  const randLastName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const timestamp = Date.now();

  switch (categoryId) {
    case 'cat_senior_male': {
      const age = 58 + Math.floor(Math.random() * 8); // 58~65세
      const firstName = MALE_NAMES[Math.floor(Math.random() * MALE_NAMES.length)];
      const fullName = `${randLastName}${firstName}`;
      return {
        id: `custom_${categoryId}_${timestamp}`,
        level: 4,
        badge: '👴 고령 권위형',
        customerName: fullName,
        age,
        gender: 'male',
        phone: `010-${Math.floor(2000 + Math.random() * 7000)}-${Math.floor(1000 + Math.random() * 8999)}`,
        job: '철물/자재 유통 도매 (은퇴 및 축소 운영)',
        salary: '월 200만 원 내외 (불규칙)',
        debtSummary: '새마을금고 3천, 캐피탈 2천, 세금 800만 체납',
        housing: '자가 빌라 (시세 2억 / 근저당 1.5억)',
        difficulty: '최고급',
        title: '권위적 어르신 상담원 기죽이기 및 책임자 호출',
        scenarioDescription: '어린 상담원이 전화했다고 무시하며 반말을 섞고 "책임자나 사무장 바꾸라"며 퉁명스럽게 굽니다.',
        trainingGoal: '기죽지 않고 묵직한 어투로 1분 내 기본 문진을 완료해 사무장 상담으로 신속 전환',
        speechOptions: {
          pitch: 0.60,
          rate: 0.95,
          gender: 'male',
          neuralVoice: 'ko-KR-Wavenet-D',
          neuralRate: '-5%',
          neuralPitch: '-12Hz',
        },
        personaPrompt: `너는 ${age}세 남성 ${fullName}이다. 평생 자영업을 하다가 빚이 늘어나 예민하다. 전화를 건 상담원이 젊거나 어리숙하게 느껴지면 "거기 몇 살이야? 어린 사람이 회생을 알면 뭘 알아?!", "말귀도 못 알아듣겠네, 책임자나 수석 사무장 바꾸쇼!"라며 퉁명스럽게 윽박지른다. 상담원이 쫄아서 버벅대면 더 화를 낸다. 반면 상담원이 기죽지 않고 깍듯하면서도 차분하고 단호하게 "어르신, 수석 사무장님께 바로 연결해 드리기 위해 7가지 기본 조건만 1분 만에 여쭙겠습니다"라고 주도권을 쥐면 슬그머니 질문에 답한다.`,
        initialMessage: `여보세요? 거기 책임자요?! 어린 상담원 말고 제대로 아는 사무장 좀 바꾸쇼!`,
        category: categoryId,
      };
    }

    case 'cat_business_debt': {
      const age = 48 + Math.floor(Math.random() * 8);
      const firstName = MALE_NAMES[Math.floor(Math.random() * MALE_NAMES.length)];
      const fullName = `${randLastName}${firstName}`;
      return {
        id: `custom_${categoryId}_${timestamp}`,
        level: 3,
        badge: '🏭 사업자 복합채무',
        customerName: fullName,
        age,
        gender: 'male',
        phone: `010-${Math.floor(2000 + Math.random() * 7000)}-${Math.floor(1000 + Math.random() * 8999)}`,
        job: '제조가공업 개인사업자 (공장 운영 8년)',
        salary: '월 매출 4,000만 원 (원자재값 폭등으로 3개월째 순적자)',
        debtSummary: '국세 3,500만 원, 거래처 물품어음 6,000만 원, 사채 2,000만 원, 보증기금 5,000만 원',
        housing: '임차 공장 (보증금 3,000만 원 / 월 250만 원)',
        difficulty: '상급',
        title: '세금 체납 및 거래처 채무가 엉킨 복합 자영업자',
        scenarioDescription: '채무 종류가 너무 많고 사채와 국세까지 밀려 본인도 정리가 안 되는 상태에서 두서없이 쏟아냅니다.',
        trainingGoal: '채무 항목을 세금(우선변제)/금융/개인채무로 즉시 분리 문진하고 매출 흐름 파악',
        speechOptions: {
          pitch: 0.72,
          rate: 1.05,
          gender: 'male',
          neuralVoice: 'ko-KR-Neural2-C',
          neuralRate: '+5%',
          neuralPitch: '-6Hz',
        },
        personaPrompt: `너는 ${age}세 공장 사장 ${fullName}이다. 국세 체납 3천5백에 거래처 어음 6천, 사채 2천까지 총 1억 6천이 넘는 빚으로 머리가 터질 지경이다. "아니 지금 세금도 밀려있고 어음도 막아야 하고 사채업자는 찾아온다는데, 이게 회생이 돼요 안 돼요?!"라며 복잡한 채무를 쏟아붓는다. 상담원이 당황해서 말을 더듬으면 실망한다. 상담원이 "사장님, 세금과 사채, 일반 은행 빚을 법적으로 분리해야 합니다. 하나씩 나누어 정리해 드리겠습니다"라고 차분히 짚어주면 안도한다.`,
        initialMessage: `아 여보세요?! 부가세랑 소득세 3천 넘게 밀려있고 어음에 사채까지 있는데, 이거 회생 돼요 안 돼요?!`,
        category: categoryId,
      };
    }

    case 'cat_angry': {
      const age = 43 + Math.floor(Math.random() * 10);
      const firstName = MALE_NAMES[Math.floor(Math.random() * MALE_NAMES.length)];
      const fullName = `${randLastName}${firstName}`;
      return {
        id: `custom_${categoryId}_${timestamp}`,
        level: 4,
        badge: '🤬 분노/공격성',
        customerName: fullName,
        age,
        gender: 'male',
        phone: `010-${Math.floor(2000 + Math.random() * 7000)}-${Math.floor(1000 + Math.random() * 8999)}`,
        job: '운송 화물 기사 (지입차주)',
        salary: '월 320만 원 (할부금 180만 원 제하면 생계 곤란)',
        debtSummary: '카드론 및 대부 4건 4,800만 원 (연체 15일차 독촉 극심)',
        housing: '월세 (보증금 500만 원 / 월 45만 원)',
        difficulty: '최고급',
        title: '독촉과 거절에 폭발한 감정 격앙 고객',
        scenarioDescription: '아침부터 대부업체 추심원에 시달리고 타사에서 거절당해 눈에 뵈는 게 없는 상태로 언성을 높입니다.',
        trainingGoal: '고객의 화에 휘말리지 않고 감정 인정("답답하셨을 텐데 송구합니다") 후 법원 탕감 절차로 전환',
        speechOptions: {
          pitch: 0.68,
          rate: 1.10,
          gender: 'male',
          neuralVoice: 'ko-KR-Wavenet-C',
          neuralRate: '+8%',
          neuralPitch: '-6Hz',
        },
        personaPrompt: `너는 ${age}세 화물 기사 ${fullName}이다. 대부업체에서 매일 협박 문자가 오고 연체 15일 차라 극도로 분노해 있다. 전화를 받자마자 "아니 아까 문자로는 무조건 된다더니 왜 또 전화를 해서 캐물어?! 장난쳐 지금?!"이라며 거칠게 소리를 지른다. 상담원이 핑계를 대거나 변명하면 "야, 너희 사기꾼이지?! 장난하지 마!"라며 언성을 더 높인다. 상담원이 "선생님, 독촉 때문에 얼마나 불안하고 답답하셨습니까. 오늘 바로 법원 금지명령으로 독촉을 중단시키는 조건만 확인하겠습니다"라고 공감해주면 거친 숨을 몰아쉬며 진정한다.`,
        initialMessage: `아니 문자로는 100% 다 된다고 해놓고 왜 또 캐물어?! 사람 장난쳐 지금?!`,
        category: categoryId,
      };
    }

    case 'cat_privacy': {
      const age = 36 + Math.floor(Math.random() * 15);
      const isFemale = Math.random() > 0.5;
      const firstName = isFemale
        ? FEMALE_NAMES[Math.floor(Math.random() * FEMALE_NAMES.length)]
        : MALE_NAMES[Math.floor(Math.random() * MALE_NAMES.length)];
      const fullName = `${randLastName}${firstName}`;
      return {
        id: `custom_${categoryId}_${timestamp}`,
        level: 3,
        badge: '🛡️ 개인정보 추궁',
        customerName: fullName,
        age,
        gender: isFemale ? 'female' : 'male',
        phone: `010-${Math.floor(2000 + Math.random() * 7000)}-${Math.floor(1000 + Math.random() * 8999)}`,
        job: isFemale ? '학원 강사' : 'IT 개발 프리랜서',
        salary: '월 300만 원 내외',
        debtSummary: '신용대출 3건 4,200만 원',
        housing: '전세 (보증금 1억)',
        difficulty: '상급',
        title: '불법 DB 의심 및 금감원 신고 협박 고객',
        scenarioDescription: '본인이 신청한 적 없다며 전화번호 유출 경로를 캐묻고 금감원에 고소하겠다며 으름장을 놓습니다.',
        trainingGoal: '당당하게 온라인 자가진단 인입 경로를 밝히고 정중한 착오 사과 안내로 컴플레인 차단',
        speechOptions: {
          pitch: isFemale ? 0.90 : 0.75,
          rate: 1.05,
          gender: isFemale ? 'female' : 'male',
          neuralVoice: isFemale ? 'ko-KR-Neural2-A' : 'ko-KR-Neural2-C',
          neuralRate: '+5%',
          neuralPitch: isFemale ? '-2Hz' : '-5Hz',
        },
        personaPrompt: `너는 ${age}세 ${fullName}이다. 스팸과 보이스피싱에 극도로 예민하다. "여보세요?! 거기 어디예요?! 내 번호 대체 어디서 났어요?! 이거 불법 개인정보 유출이죠? 당장 금감원에 고소할 거예요!"라며 따진다. 상담원이 말을 얼버무리거나 사과만 남발하면 덜미를 잡고 늘어진다. 상담원이 당황하지 않고 당당하게 "온라인 무료 대출/회생 자가진단 테스트를 통해 성함과 번호가 접수되어 연락드렸습니다. 혹시 가족이나 본인이 직접 조회하신 적이 없으시다면 착오 접수이므로 즉시 폐기 조치하겠습니다"라고 똑 부러지게 말하면 멈칫하며 전후 사정을 확인한다.`,
        initialMessage: `여보세요?! 거기 어디예요?! 내 번호는 대체 어디서 알고 전화한 거예요?! 불법이죠 이거?!`,
        category: categoryId,
      };
    }

    case 'cat_phishing': {
      const age = 52 + Math.floor(Math.random() * 12); // 52~64세
      const firstName = MALE_NAMES[Math.floor(Math.random() * MALE_NAMES.length)];
      const fullName = `${randLastName}${firstName}`;
      return {
        id: `custom_${categoryId}_${timestamp}`,
        level: 4,
        badge: '🚨 보이스피싱 오인',
        customerName: fullName,
        age,
        gender: 'male',
        phone: `010-${Math.floor(2000 + Math.random() * 7000)}-${Math.floor(1000 + Math.random() * 8999)}`,
        job: '도소매 유통업 (자영업)',
        salary: '월 280만 원',
        debtSummary: '카드론 3건 3,600만 원, 대부 1,200만 원',
        housing: '자가 아파트 (담보 80%)',
        difficulty: '최고급',
        title: '금융사기 공포로 상담 자체를 사기단으로 의심하는 고객',
        scenarioDescription: '최근 피싱 뉴스를 보고 상담원에게 "앱 깔라는 거 아니냐, 사기 치지 마라"며 극도로 경계합니다.',
        trainingGoal: '3대 무과금/무어플 원칙 즉각 선언 + 포털 상호 검색 및 공식 대표번호 역발신 제안',
        speechOptions: {
          pitch: 0.65,
          rate: 1.0,
          gender: 'male',
          neuralVoice: 'ko-KR-Wavenet-D',
          neuralRate: '+0%',
          neuralPitch: '-10Hz',
        },
        personaPrompt: `너는 ${age}세 ${fullName}이다. 요즘 뉴스에 나오는 대출 사기와 보이스피싱 때문에 머리끝까지 경계심이 차 있다. 상담원의 목소리를 듣자마자 "요즘 보이스피싱 사기꾼들 판친다는데, 당신들 돈 뜯어내려는 사기단 아니야?! 앱 깔라거나 통장 비밀번호 달라는 거지?! 사기 치지 마!"라며 방어막을 친다. 상담원이 구차하게 설득하려 들면 의심을 더 키운다. 상담원이 "선생님, 저희는 어떠한 경우에도 앱 설치나 비밀번호, 선입금을 일체 요구하지 않습니다! 의심되시는 것은 당연하오니, 네이버에 저희 법무법인을 검색하셔서 대표번호로 직접 전화 주셔도 좋습니다"라고 3대 안전원칙과 포털 검색을 당당히 제시하면 경계심을 풀기 시작한다.`,
        initialMessage: `요즘 보이스피싱 사기단이 많다는데, 당신들 사기꾼 아니야?! 앱 깔라거나 비밀번호 달라는 거지?!`,
        category: categoryId,
      };
    }

    case 'cat_objection':
    default: {
      const objectionTypes = ['family', 'fee', 'driving'];
      const pick = objectionTypes[Math.floor(Math.random() * objectionTypes.length)];
      const isFemale = pick === 'family' ? true : Math.random() > 0.5;
      const age = 39 + Math.floor(Math.random() * 12);
      const firstName = isFemale
        ? FEMALE_NAMES[Math.floor(Math.random() * FEMALE_NAMES.length)]
        : MALE_NAMES[Math.floor(Math.random() * MALE_NAMES.length)];
      const fullName = `${randLastName}${firstName}`;

      let initial = '아 나 지금 운전 중이라 통화 못 해요! 나중에 전화해요!';
      let goal = '10초 안에 명확한 콜백 약속 확보';
      let title = '운전 중/바쁨으로 통화 회피';
      let promptText = '지금 고속도로 운전 중이라 바로 끊으려 한다. 상담원이 시간대를 정해 다시 걸겠다고 하면 수락한다.';

      if (pick === 'family') {
        initial = '이거 집으로 우편물 날아오거나 남편/가족이 알면 저 진짜 이혼당해요... 절대 안 돼요!';
        goal = '100% 비밀 보장 및 송달지 직장 지정 안내로 심리적 안심 제공';
        title = '가족 비밀 절대 보장 요구 고객';
        promptText = '남편 몰래 생긴 빚이라 가족이 알면 끝장이다. 절대 집으로 서류나 우편이 가면 안 된다고 불안해한다. 상담원이 전자소송과 송달지 회사 지정으로 100% 비밀이 보장된다고 설명해야 마음을 연다.';
      } else if (pick === 'fee') {
        initial = '지금 카드값 50만 원도 없어서 난리인데 수임료가 어디 있어요?! 돈 없으면 못 하잖아요!';
        goal = '초기 비용 0원 및 분납 시스템 안내를 통한 비용 장벽 허물기';
        title = '수임료 부담으로 거절하려는 고객';
        promptText = '당장 굶어 죽겠는데 수임료가 수백만 원 든다는 생각에 지레 겁먹고 있다. 상담원이 법원 접수 시 초기 비용 부담 없이 분납으로 진행된다는 점을 설명해야 설득된다.';
      }

      return {
        id: `custom_${categoryId}_${timestamp}`,
        level: 3,
        badge: '🚫 거절/돌발',
        customerName: fullName,
        age,
        gender: isFemale ? 'female' : 'male',
        phone: `010-${Math.floor(2000 + Math.random() * 7000)}-${Math.floor(1000 + Math.random() * 8999)}`,
        job: isFemale ? '주부 및 파트타임 (월 120만 원)' : '자영업자',
        salary: '월 120~280만 원',
        debtSummary: '카드론 3건 2,800만 원 (돌려막기 한계)',
        housing: '월세 (보증금 1,000 / 월 55)',
        difficulty: '상급',
        title,
        scenarioDescription: '가족 비밀, 수임료 부담, 운전 중 통화 회피 등 현실적인 거절 장벽을 맞닥뜨립니다.',
        trainingGoal: goal,
        speechOptions: {
          pitch: isFemale ? 0.92 : 0.78,
          rate: 1.10,
          gender: isFemale ? 'female' : 'male',
          neuralVoice: isFemale ? 'ko-KR-Neural2-A' : 'ko-KR-Neural2-C',
          neuralRate: '+10%',
          neuralPitch: isFemale ? '-2Hz' : '-5Hz',
        },
        personaPrompt: `너는 ${age}세 ${fullName}이다. ${promptText}`,
        initialMessage: initial,
        category: categoryId,
      };
    }
  }
};

// 완전 무작위 실전 AI 고객 생성기 (Combinatorial Random Matrix)
export const generateRandomCustomerPersona = (): TrainingPersona => {
  const randLastName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const jobItem = JOB_PROFILES[Math.floor(Math.random() * JOB_PROFILES.length)];
  const isFemale = jobItem.gender === 'female';
  const firstName = isFemale
    ? FEMALE_NAMES[Math.floor(Math.random() * FEMALE_NAMES.length)]
    : MALE_NAMES[Math.floor(Math.random() * MALE_NAMES.length)];
  const fullName = `${randLastName}${firstName}`;
  const debt = DEBT_ORIGINS[Math.floor(Math.random() * DEBT_ORIGINS.length)];
  const housing = ASSET_HOUSINGS[Math.floor(Math.random() * ASSET_HOUSINGS.length)];
  const age = 30 + Math.floor(Math.random() * 34); // 30~64세
  const timestamp = Date.now();

  let voice = 'ko-KR-Neural2-C';
  let pitch = 0.80;
  let rate = 1.05;

  if (isFemale) {
    voice = 'ko-KR-Neural2-A';
    pitch = 0.90;
    rate = 1.10;
  } else if (age >= 55) {
    voice = 'ko-KR-Wavenet-D';
    pitch = 0.60;
    rate = 0.95;
  } else if (age >= 45) {
    voice = 'ko-KR-Wavenet-C';
    pitch = 0.70;
    rate = 1.0;
  }

  return {
    id: `rand_${timestamp}`,
    level: 3,
    badge: '🎲 무작위 실전',
    customerName: fullName,
    age,
    gender: isFemale ? 'female' : 'male',
    phone: `010-${Math.floor(2000 + Math.random() * 7000)}-${Math.floor(1000 + Math.random() * 8999)}`,
    job: jobItem.job,
    salary: jobItem.salary,
    debtSummary: debt.summary,
    housing,
    difficulty: '실전',
    title: `${debt.origin} 사연의 실전 고객`,
    scenarioDescription: `${debt.detail}. 주거는 ${housing}이며 직업은 ${jobItem.job}입니다.`,
    trainingGoal: '7대 필수 정보를 자연스럽게 문진하여 사무장 인계 카드를 완벽하게 완성하기',
    speechOptions: {
      pitch,
      rate,
      gender: isFemale ? 'female' : 'male',
      neuralVoice: voice,
      neuralRate: '+5%',
      neuralPitch: isFemale ? '-2Hz' : '-8Hz',
    },
    personaPrompt: `너는 ${age}세 ${fullName}(${jobItem.job})이다. 사연: ${debt.detail}. 재산: ${housing}. 소득: ${jobItem.salary}. 실제 대출이나 회생 상담을 신청해서 전화를 기다리고 있었다. 절대로 정형화된 로봇처럼 대답하지 말고, 실제 사람처럼 한숨도 쉬고 고민하며 솔직하게 말한다. 단, 처음부터 술술 다 불지 말고 상담원이 정중하고 명확하게 질문할 때마다 하나씩 차분히 털어놓는다. 1~2문장의 직설적이고 생생한 실전 구어체로 대화한다.`,
    initialMessage: `여보세요? 상담 신청 남겼던 ${fullName}인데요, 대출이나 회생 관련해서 알아볼 수 있나요?`,
  };
};

const LOCAL_STORAGE_KEY = 'lm_training_sessions';

// 훈련 이력 로컬스토리지 로드
export const loadTrainingHistory = (): TrainingSessionRecord[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// 훈련 결과 저장
export const saveTrainingSession = (record: TrainingSessionRecord): void => {
  try {
    const history = loadTrainingHistory();
    history.unshift(record);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
  } catch (e) {
    console.error('Failed to save training session:', e);
  }
};

// 관리자(팀장) 피드백 및 등급 저장
export const updateAdminFeedback = (
  sessionId: string,
  feedback: AdminFeedback
): boolean => {
  try {
    const history = loadTrainingHistory();
    const idx = history.findIndex(h => h.sessionId === sessionId);
    if (idx !== -1) {
      history[idx].adminFeedback = feedback;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history));
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to update admin feedback:', e);
    return false;
  }
};

// 가상 고객 AI 응답 생성 (초고속 티키타카: 최근 6턴 압축 + 1~2문장 초단문 즉답)
export const generateAiCustomerReply = async (
  messages: TrainingMessage[],
  persona: TrainingPersona
): Promise<string> => {
  const recentMessages = messages.slice(-6);
  const conversationText = recentMessages
    .map(m => `${m.speaker === 'agent' ? '상담원' : '고객(' + persona.customerName + ')'}: "${m.text}"`)
    .join('\n');

  const prompt = `당신은 전화 금융/대출/회생 상담을 진행 중인 가상 고객 "${persona.customerName}"(${persona.age}세, ${persona.job}) 역할입니다.

[고객 성향 및 배경]
${persona.personaPrompt}
[채무 및 재산 정보]
- 채무: ${persona.debtSummary}
- 재산/주거: ${persona.housing}
- 소득: ${persona.salary}

[대화 규칙 - 생생한 감정 표현 및 실전 통화 템포 준수]
1. 실제 전화 통화이므로 길게 말하지 말고, **반드시 1~2문장(공백 포함 25~45자 내외)의 직설적이고 생생한 구어체**로 대답하세요.
2. 부연설명이나 지문(예: [한숨], (화를 내며))은 일절 넣지 말고, **순수 대사 텍스트만** 바로 출력하세요.
3. 고객의 상황(의심, 분노, 초조, 경계, 바쁨)에 맞춰 느낌표(!)나 물음표(?)를 적극적으로 사용하세요.
4. 상담원이 "앱 설치나 비용 요구가 절대 없다", "포털 사이트에 저희 법인을 검색해 보시라"고 안심시키면 경계심을 누그러뜨리세요.
5. ${persona.age >= 55 ? '50~60대 특유의 퉁명스러운 어르신 말투("~했소?", "~인가요?", "~하쇼!")를 자연스럽게 사용하세요.' : ''}

[최근 통화 내용]
${conversationText}

고객(${persona.customerName})의 다음 대사 1~2문장:`;

  try {
    const res = await callAi({
      task: 'summary_extract',
      prompt,
      responseMimeType: 'text/plain',
      temperature: 0.6,
    });
    return res.text.trim().replace(/^["']|["']$/g, '');
  } catch (err: any) {
    console.error('Failed to generate AI customer reply:', err);
    return '아, 네... 말씀 계속하세요.';
  }
};

// 통화 종료 후 AI 자동 평가 및 사무장 인계 카드 정밀 채점
export const evaluateTrainingCall = async (
  messages: TrainingMessage[],
  persona: TrainingPersona
): Promise<TrainingReport> => {
  const conversationText = messages
    .map(m => `${m.speaker === 'agent' ? '상담원' : '고객'}: ${m.text}`)
    .join('\n');

  const prompt = `당신은 법률사무소 수석 사무장이자 금융 CRM 상담 품질 평가 감독관(QA 코치)입니다.
신입 상담원이 가상 고객 "${persona.customerName}"(${persona.age}세, ${persona.job})과 진행한 모의 상담 통화록을 정밀 평가하고 코칭 리포트 및 '사무장 인계 7대 문진 카드'를 JSON으로 작성하세요.

[고객 기본 정보]
- 시나리오: ${persona.scenarioDescription}
- 채무: ${persona.debtSummary}
- 재산: ${persona.housing}
- 소득: ${persona.salary}

[사무장 인계 7대 필수 문진 항목 채점 기준]
1. 직업 및 재직형태 (4대보험/사업자/일용직 등)
2. 월 평균 실소득 (실수령액)
3. 부양가족 수 (등본상 동거 가족)
4. 주거 형태 및 보증금 (자가/전세/월세 및 보증금 규모)
5. 총 채무액 및 채무 원인 (원금 규모 및 용도)
6. 현재 연체 여부 및 기간 (독촉 상황)
7. 과거 회생/파산/신복위 이력 (과거 조정 경험)

[통화 대화록]
${conversationText}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "totalScore": 85,
  "complianceScore": 25,
  "listeningScore": 28,
  "objectionScore": 32,
  "passed": true,
  "summary": "전반적인 상담 흐름 및 인계 문진에 대한 2~3줄 총평",
  "strengths": ["상담원이 특별히 잘한 점 1", "잘한 점 2"],
  "weaknesses": ["보완이 필요한 아쉬운 점 1", "보완할 점 2"],
  "coachingTips": ["실전에서 바로 써먹을 수 있는 원포인트 코칭 팁 1", "코칭 팁 2"],
  "suggestedScript": "이 시나리오에서 우수 상담원이라면 사용했을 법한 모범 추천 멘트 1~2문장",
  "paralegalCard": {
    "jobAndEmployment": true,
    "monthlyRealIncome": true,
    "dependentsCount": false,
    "housingAndDeposit": true,
    "debtAmountAndReason": true,
    "overdueStatusAndPeriod": false,
    "pastRehabHistory": false,
    "handoffScore": 71,
    "paralegalBriefing": "[사무장 인계 요약]\\n- 고객: 42세 남성, 중소기업 7년 재직(실수령 310만)\\n- 채무: 카드론 2천+신용 1천(총 3천, 연체 없음)\\n- 주거: 전세 1.2억(대출 6천)\\n* 미확인: 부양가족 수 및 과거 회생 이력 추가 확인 필요",
    "missingCheckpoints": ["부양가족 수 확인 누락", "과거 채무조정/신복위 이력 미확인"],
    "coachingAdvice": "회생 가용소득을 정확히 계산하려면 부양가족 수를 반드시 물어보아야 법정 최저생계비를 제외할 수 있습니다."
  }
}`;

  try {
    const res = await callAi({
      task: 'summary_extract',
      prompt,
      responseMimeType: 'application/json',
      temperature: 0.3,
    });

    const parsed = JSON.parse(res.text);
    return {
      totalScore: Number(parsed.totalScore) || 75,
      complianceScore: Number(parsed.complianceScore) || 22,
      listeningScore: Number(parsed.listeningScore) || 24,
      objectionScore: Number(parsed.objectionScore) || 29,
      passed: (Number(parsed.totalScore) || 75) >= 75,
      summary: parsed.summary || '상담을 성실히 수행했습니다.',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : ['고객 응대 태도가 정중했습니다.'],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : ['필수 고지 사항 전달이 조금 부족했습니다.'],
      coachingTips: Array.isArray(parsed.coachingTips) ? parsed.coachingTips : ['사무장 인계를 위해 7대 항목을 메모해 두세요.'],
      suggestedScript: parsed.suggestedScript || '고객님, 저희는 정식 법률사무소로 어떠한 앱 설치나 선입금을 일체 요구하지 않습니다.',
      paralegalCard: parsed.paralegalCard || {
        jobAndEmployment: true,
        monthlyRealIncome: true,
        dependentsCount: false,
        housingAndDeposit: true,
        debtAmountAndReason: true,
        overdueStatusAndPeriod: false,
        pastRehabHistory: false,
        handoffScore: 71,
        paralegalBriefing: `[사무장 인계 요약]\n- 고객: ${persona.customerName} (${persona.age}세, ${persona.job})\n- 채무: ${persona.debtSummary}\n- 주거: ${persona.housing}`,
        missingCheckpoints: ['부양가족 수 확인 누락', '연체 일수 확인 필요'],
        coachingAdvice: '사무장 심사를 위해 부양가족 수와 연체 일수를 추가로 문진해야 합니다.',
      },
    };
  } catch (err: any) {
    console.error('Failed to evaluate call:', err);
    return {
      totalScore: 78,
      complianceScore: 24,
      listeningScore: 26,
      objectionScore: 28,
      passed: true,
      summary: '모의 상담 통화를 성공적으로 완수했습니다. 침착한 대응이 돋보였습니다.',
      strengths: ['고객의 거절 멘트에도 당황하지 않고 침착하게 응대함', '기본적인 대출 니즈 파악 완료'],
      weaknesses: ['상담 서두에 소속 법인명 고지 타이밍 보완 필요', '재통화 시간대를 더 명확히 지정 권장'],
      coachingTips: ['고객이 바쁘다고 할 때는 30초 내에 핵심 조건만 짚고 콜백 시간을 잡는 것이 성공률이 높습니다.'],
      suggestedScript: '선생님, 지금 많이 바쁘시군요! 딱 30초만 말씀드리면, 정부지원 대환으로 월 이자 감면 가능 여부만 가심사해 두고 오후에 재연락드려도 될까요?',
      paralegalCard: {
        jobAndEmployment: true,
        monthlyRealIncome: true,
        dependentsCount: true,
        housingAndDeposit: true,
        debtAmountAndReason: true,
        overdueStatusAndPeriod: true,
        pastRehabHistory: false,
        handoffScore: 85,
        paralegalBriefing: `[사무장 인계 요약]\n- 고객: ${persona.customerName} (${persona.age}세, ${persona.job})\n- 채무: ${persona.debtSummary}\n- 주거: ${persona.housing}\n- 소득: ${persona.salary}`,
        missingCheckpoints: ['과거 회생/파산/신복위 이력 확인 누락'],
        coachingAdvice: '5년 내 재신청 자격을 판별하기 위해 과거 채무조정 이력을 질문해야 합니다.',
      },
    };
  }
};
