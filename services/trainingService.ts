// ============================================
// 신입 상담원 3-in-1 통합 트레이닝 서비스 (2026-11-09)
// AI 가상 고객 롤플레잉 + 모의 리드 샌드박스 + 실시간 코칭 + 사무장 인계 문진 시스템
// ============================================
import { callAi } from './aiProxy';
import { SpeechVoiceOptions } from './speechService';
import { StoreKeySpec, peekOrgStore, loadOrgStore, mutateOrgStore, readLegacyJson, canWriteOrgStore } from './orgStore';
import { loadCachedOrg, isAdminRole } from './org';
import {
  GroundTruthLegalDiagnosis,
  generateInfinitePersona,
  INFINITE_THEMES,
  InfinitePersonaTheme,
  CustomerBehaviorType,
  RealCustomerQuestion,
  REAL_CUSTOMER_QUESTIONS_AND_OBJECTIONS,
} from './trainingProceduralEngine';

export {
  INFINITE_THEMES,
  type InfinitePersonaTheme,
  type GroundTruthLegalDiagnosis,
  type CustomerBehaviorType,
  type RealCustomerQuestion,
  REAL_CUSTOMER_QUESTIONS_AND_OBJECTIONS,
};

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
  groundTruth?: GroundTruthLegalDiagnosis;
  behaviorType?: CustomerBehaviorType;
  outboundChannelType?: 'cold_db' | 'inbound_ad';
  objectionFocus?: string;
  recommendedDefenseScript?: string;
  realQuestionPool?: RealCustomerQuestion[];
  speechHabitName?: string;
  speechHabitDesc?: string;
}

export interface TrainingMessage {
  id: string;
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: string;
  emotion?: 'angry' | 'annoyed' | 'anxious' | 'calm';
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
  coldDbOpeningScore?: number;          // Cold DB 오프닝 돌파력 (0~100)
  objectionDefenseScore?: number;       // 고객 질문/반론 방어력 (0~100)
  pacingControlScore?: number;          // 신세한탄 완급 조절력 (0~100)
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
  /** 훈련한 사람 (auth user id) — 회사 서버 기록에서 사람별로 나눌 때 씀 */
  userId?: string;
  fullTranscript?: TrainingMessage[];
  adminFeedback?: AdminFeedback;
}

// ============================================
// 회사별·관리자별 맞춤형 훈련 정책 및 스크립트 설정 (Company Training Config)
// ============================================
export interface CompanyTrainingConfig {
  companyName: string;          // 회사/법인명 (예: 법무법인 신안)
  departmentName: string;       // 담당 부서/팀명 (예: 회생파산 전담센터)
  leadChannelName: string;      // 인입 채널명 (예: 온라인 무료 안심 자가진단)
  representativePhone: string;  // 공식 대표번호 (예: 02-588-7119)
  standardOpening: string;      // 정규 첫인사 템플릿
  quickOpening: string;         // 바쁜 고객용 10초 퀵 오프닝
  requiredKeywords: string[];   // 필수 포함 키워드 (미언급 시 감점)
  bannedKeywords: string[];     // 엄격 금지어 (과장광고 방지)
  customQuestions: string[];    // 회사별 추가 문진 항목
}

export const PRESETS_CONFIG: Record<string, { label: string; desc: string; config: CompanyTrainingConfig }> = {
  legal: {
    label: '🏢 법무법인 회생/파산 전문',
    desc: '개인회생·파산 법률사무소 표준 (법원 접수, 비밀보장, 수수료 0원)',
    config: {
      companyName: '법무법인 신안',
      departmentName: '회생파산 종합지원센터',
      leadChannelName: '온라인 무료 안심 자가진단',
      representativePhone: '02-588-7119',
      standardOpening: '안녕하십니까, {고객명} 고객님! {회사명} {부서명}의 {상담원명} 상담원입니다. 일전에 신청해주신 {인입채널} 관련하여 법원 감면 혜택 가심사차 연락드렸습니다. 지금 2분 정도 통화 괜찮으실까요?',
      quickOpening: '바쁘신 시간 죄송합니다, 고객님! {회사명}입니다. 신청하신 서류 조건만 30초 내로 정리해 드리고 편하신 시간대로 다시 전화드리겠습니다!',
      requiredKeywords: ['비밀 보장', '취소 수수료 없음', '법원 접수'],
      bannedKeywords: ['100% 무조건 승인', '전액 탕감 보장', '불법 수수료'],
      customQuestions: ['최근 1년 내 신규 대출 발생 여부', '배우자 명의 재산 유무'],
    },
  },
  loan: {
    label: '💳 서민금융 대환대출 전문',
    desc: '중금리·고금리 대환 및 금융컨설팅 표준 (금감원 등록, 이자 절감)',
    config: {
      companyName: '서민금융 파트너스',
      departmentName: '안심대환 상담팀',
      leadChannelName: '정부지원 안심대환 간편조회',
      representativePhone: '1588-4920',
      standardOpening: '안녕하십니까, {고객명} 고객님! {회사명} {부서명}의 {상담원명}입니다. 일전에 조회해주신 {인입채널} 신청 건으로 금리 인하 가심사 결과 안내차 연락드렸습니다.',
      quickOpening: '고객님, 지금 많이 바쁘신가요? {회사명}입니다! 30초만 대환 한도 확인해 드리고 오후 브레이크 타임에 재연락드릴까요?',
      requiredKeywords: ['대출중개수수료 무료', '정식 등록 법인', '신용점수 영향 없음'],
      bannedKeywords: ['작업대출', '선입금 요구', '무조건 100% 한도'],
      customQuestions: ['기존 대출 금리대 (15% 이상 여부)', '월 소득 대비 상환액'],
    },
  },
  business: {
    label: '🏭 소상공인/자영업자 긴급지원',
    desc: '자영업자 다중채무 및 세금 체납 긴급 분할지원 표준',
    config: {
      companyName: '소상공인 기업지원센터',
      departmentName: '자영업자 재기지원팀',
      leadChannelName: '사업자 긴급운영자금 자가진단',
      representativePhone: '02-710-8800',
      standardOpening: '사장님, 안녕하십니까! {회사명} {부서명}의 {상담원명}입니다. 남겨주신 {인입채널} 건으로 세금 체납 및 거래처 대금 정리 지원방안 안내차 연락드렸습니다.',
      quickOpening: '사장님, 장사 준비로 많이 바쁘시죠? {회사명}입니다. 통화 가능하신 시간대만 지정해 주시면 그때 다시 연락드리겠습니다!',
      requiredKeywords: ['세금 분할납부', '신용보증재단 연계', '사업자 등록 유지'],
      bannedKeywords: ['일수 사채 대출', '통장 대여', '무조건 전액 지원'],
      customQuestions: ['부가가치세 및 국세 체납액', '직원 4대보험 가입 여부'],
    },
  },
};

export const DEFAULT_TRAINING_CONFIG: CompanyTrainingConfig = PRESETS_CONFIG.legal.config;

const CONFIG_STORAGE_KEY = 'lm_company_training_config';

// [2026-11-13 KIRO] 회사 훈련 설정은 회사별 서버(settings 'trainingConfig')가 원본. 저장은 관리자만.
export const TRAINING_CONFIG_SPEC: StoreKeySpec<Partial<CompanyTrainingConfig>> = {
  key: 'trainingConfig',
  empty: () => ({}),
  legacy: () => readLegacyJson<Partial<CompanyTrainingConfig>>(CONFIG_STORAGE_KEY),
  legacyKeys: [CONFIG_STORAGE_KEY],
};

// 관리자 훈련 설정 로드 (메모리/브라우저 사본 즉시, 서버 확인은 뒤에서)
export const getCompanyTrainingConfig = (): CompanyTrainingConfig => {
  const v = peekOrgStore(TRAINING_CONFIG_SPEC);
  return v && typeof v === 'object' ? { ...DEFAULT_TRAINING_CONFIG, ...v } : DEFAULT_TRAINING_CONFIG;
};

/** 서버에서 훈련 설정 확인 */
export const loadCompanyTrainingConfig = async (): Promise<CompanyTrainingConfig> => {
  const v = await loadOrgStore(TRAINING_CONFIG_SPEC);
  return v && typeof v === 'object' ? { ...DEFAULT_TRAINING_CONFIG, ...v } : DEFAULT_TRAINING_CONFIG;
};

// 관리자 훈련 설정 저장. 실패하면 한국어 오류 문구를 돌려준다(성공 = null).
export const saveCompanyTrainingConfig = async (config: CompanyTrainingConfig): Promise<string | null> => {
  const res = await mutateOrgStore(TRAINING_CONFIG_SPEC, () => ({ ...config }));
  return res.ok ? null : res.error;
};

// 템플릿 변수 동적 치환 함수
export const interpolateOpeningScript = (
  template: string,
  config: CompanyTrainingConfig,
  agentName: string = '상담원',
  customerName: string = '고객님'
): string => {
  return template
    .replace(/\{회사명\}/g, config.companyName || '법무법인')
    .replace(/\{부서명\}/g, config.departmentName || '상담센터')
    .replace(/\{상담원명\}/g, agentName)
    .replace(/\{인입채널\}/g, config.leadChannelName || '무료 자가진단')
    .replace(/\{대표번호\}/g, config.representativePhone || '대표번호')
    .replace(/\{고객명\}/g, customerName);
};

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
    recommendedVoice: 'ko-KR-InJoonNeural',
  },
  {
    id: 'cat_business_debt',
    title: '사업자 복합 채무',
    subtitle: '국세 체납, 어음, 사채, 직원 급여 등 다중 채무',
    badge: '🏭 사업자채무',
    icon: 'Building2',
    description: '세금 3천 체납에 거래처 물품 대금, 제2금융, 일수까지 얽혀 있어 당황하기 쉬운 자영업 고객',
    coreGoal: '채무 항목을 세금(우선변제)/금융/개인채무로 즉시 분리 문진하고 매출 흐름 파악',
    recommendedVoice: 'ko-KR-InJoonNeural',
  },
  {
    id: 'cat_angry',
    title: '분노 / 공격성 표출',
    subtitle: '독촉과 거절에 지쳐 언성을 높이고 쏘아붙이는 고객',
    badge: '🤬 분노/폭언',
    icon: 'Flame',
    description: '"아까는 다 된다더니 왜 또 캐물어?! 장난쳐 지금?!"이라며 화를 내는 극도의 예민 상태',
    coreGoal: '고객의 화에 휘말리지 않고 감정 인정("답답하셨을 텐데 송구합니다") 후 목적 상기',
    recommendedVoice: 'ko-KR-InJoonNeural',
  },
  {
    id: 'cat_privacy',
    title: '개인정보 출처 추궁',
    subtitle: '"내 번호 어디서 알았어? 불법이지? 고소하겠다"',
    badge: '🛡️ 번호추궁',
    icon: 'ShieldAlert',
    description: '불법 DB 수집을 의심하며 금융감독원 및 경찰 신고를 운운하는 법적 공격성 고객',
    coreGoal: '당당하게 온라인 자가진단 인입 경로를 밝히고 정중한 착오 사과 안내로 컴플레인 차단',
    recommendedVoice: 'ko-KR-InJoonNeural',
  },
  {
    id: 'cat_phishing',
    title: '보이스피싱 사기 오인',
    subtitle: '"앱 깔라거나 비밀번호 달라는 거 아니야? 사기 치지 마!"',
    badge: '🚨 피싱의심',
    icon: 'AlertTriangle',
    description: '최근 금융사기 및 악성 앱 보도로 인해 상담원 자체를 사기범으로 오해하고 극도로 경계하는 고객',
    coreGoal: '3대 무과금/무어플 원칙 즉각 선언 + 포털 상호 검색 및 공식 대표번호 역발신 제안',
    recommendedVoice: 'ko-KR-InJoonNeural',
  },
  {
    id: 'cat_objection',
    title: '거절·돌발 장벽 돌파',
    subtitle: '가족 비밀 보장, 수임료 부담, 운전 중 통화 회피',
    badge: '🚫 거절돌파',
    icon: 'HelpCircle',
    description: '"가족이 알면 이혼당해요", "수임료 낼 돈 없어요", "나 지금 운전 중이야!" 3종 거절',
    coreGoal: '우편물 송달지 직장 지정 안심, 수임료 분납 안내, 10초 콜백 예약 일정 확정',
    recommendedVoice: 'ko-KR-SunHiNeural',
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
      neuralVoice: 'ko-KR-InJoonNeural',
      neuralRate: '+5%',
      neuralPitch: '-5Hz',
      characterVoiceId: 'C12',
      characterVoiceName: '김순한',
    },
    speechHabitName: '쉬운 생활단어형',
    speechHabitDesc: '온순하고 쉬운 일상 단어로 대화',
    personaPrompt: '너는 42세 직장인 김순한이다. 성격이 온순하고 예의 바르다. 모르는 번호로 걸려온 전화를 받아 "네, 여보세요?"라고 받았다. 상담원이 소속을 밝히고 며칠 전 신청한 대출 대환 상담 건이라고 정중히 안내하면 "아 네! 맞아요, 카드론 이자가 너무 비싸서요..."라며 차분하고 솔직하게 답한다.',
    initialMessage: '네, 여보세요?',
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
    scenarioDescription: '가게 오픈 준비와 식자재 발주로 매우 분주합니다. 걸려온 전화를 받자마자 "바쁜데 어디시죠?"라며 서두릅니다.',
    trainingGoal: '10초 내 핵심 전달, 서두르는 고객 안심시키기, 짧은 통화 후 재통화 약속(리마인더) 성사',
    speechOptions: {
      pitch: 0.88,
      rate: 1.15,
      gender: 'female',
      neuralVoice: 'ko-KR-SunHiNeural',
      neuralRate: '+15%',
      neuralPitch: '-2Hz',
      characterVoiceId: 'C47',
      characterVoiceName: '박급해',
    },
    speechHabitName: '성격 급한 재촉형',
    speechHabitDesc: '용건만 간단히, 서론 질색',
    personaPrompt: '너는 38세 식당 사장 박급해다. 지금 재료 준비와 배달 주문으로 몹시 바쁜 와중에 걸려온 전화를 받았다. "여보세요? 아 지금 가게 준비 때문에 바쁜데 어디시죠?!"라고 묻는다. 상담원이 말을 길게 늘어놓으면 "아 사장님! 제가 지금 손님 받아야 해서 바쁘다니까요?! 용건만 딱 말해주세요!"라고 쏘아붙인다. 상담원이 신속하게 브레이크 타임(오후 3시) 콜백을 제안하면 좋아한다.',
    initialMessage: '여보세요? 아 지금 가게 준비로 바쁜데 어디시죠?!',
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
    scenarioDescription: '고금리 채무로 지쳐있으나, 과거 보이스피싱 시도를 겪어 낯선 대출 전화에 극도로 방어적입니다. "여보세요? 어디요?"라며 퉁명스럽게 받습니다.',
    trainingGoal: '합법적 수집 경로 설명, 대출중개수수료 불법성 법정 고지, 고객의 불신 해소 및 전문성 입증',
    speechOptions: {
      pitch: 0.70,
      rate: 1.0,
      gender: 'male',
      neuralVoice: 'ko-KR-InJoonNeural',
      neuralRate: '+0%',
      neuralPitch: '-8Hz',
      characterVoiceId: 'C16',
      characterVoiceName: '이의심',
    },
    speechHabitName: '의심 많은 신중형',
    speechHabitDesc: '번호 출처 및 100% 무료 여부 꼼꼼 검증',
    personaPrompt: '너는 54세 도소매상 이의심이다. 모르는 번호로 전화가 와서 "여보세요? 어디요?"라고 퉁명스럽게 받았다. 상담원이 대출/회생 관련이라고 하면 "아니 거 어디요?! 내 번호는 어떻게 알고 건 거요?! 사기꾼들 아니요?!"라며 거칠게 따지고 삿대질하듯 쏘아붙인다. 상담원이 법적 등록번호와 100% 무료 조회임을 입증해야 겨우 경계를 푼다.',
    initialMessage: '여보세요? 어디요?',
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
    scenarioDescription: '이미 다른 금융사에서 부결을 여러 번 겪고 연체 10일이 넘어 독촉을 받고 있습니다. 지친 목소리로 전화를 받습니다.',
    trainingGoal: '감정적 경청과 공감, 현실적인 대안(서민금융 채무조정/개인회생 연계) 제시, 상담원 멘탈 관리',
    speechOptions: {
      pitch: 0.60,
      rate: 0.95,
      gender: 'male',
      neuralVoice: 'ko-KR-InJoonNeural',
      neuralRate: '-5%',
      neuralPitch: '-12Hz',
      characterVoiceId: 'C05',
      characterVoiceName: '최까다',
    },
    speechHabitName: '한숨·추임새형',
    speechHabitDesc: '깊은 한숨과 피로감, 냉소적 회의감',
    personaPrompt: '너는 61세 최까다다. 빚이 6천 가까이 되고 연체가 시작되어 매일 독촉 전화에 시달린다. 걸려온 전화에 깊은 한숨을 쉬며 "여보세요... 누구쇼?"라고 받는다. 상담원이 대출/회생 상담이라고 하면 "하... 또 대출 전화요?! 다른 데서 다 퇴짜 맞았는데 당신들이 무슨 재주로 돈을 내준다는 거요?!"라며 냉소적으로 반발한다.',
    initialMessage: '여보세요... 누구쇼?',
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
          neuralVoice: 'ko-KR-InJoonNeural',
          neuralRate: '-5%',
          neuralPitch: '-12Hz',
        },
        personaPrompt: `너는 ${age}세 남성 ${fullName}이다. 평생 자영업을 하다가 빚이 늘어나 예민하다. 모르는 번호로 전화가 와서 "여보세요? 어디쇼?"하고 퉁명스럽게 받았다. 전화를 건 상대가 젊거나 어리숙하게 느껴지면 "거기 몇 살이야? 어디서 건 전화야?! 어린 사람이 회생을 알면 뭘 알아?!", "말귀도 못 알아듣겠네, 책임자나 수석 사무장 바꾸쇼!"라며 윽박지른다. 상담원이 쫄아서 버벅대면 더 화를 낸다. 반면 상담원이 기죽지 않고 깍듯하면서도 차분하고 단호하게 "어르신, 수석 사무장님께 바로 연결해 드리기 위해 7가지 기본 조건만 1분 만에 여쭙겠습니다"라고 주도권을 쥐면 슬그머니 질문에 답한다.`,
        initialMessage: `여보세요? 어디쇼?`,
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
          neuralVoice: 'ko-KR-InJoonNeural',
          neuralRate: '+5%',
          neuralPitch: '-6Hz',
        },
        personaPrompt: `너는 ${age}세 공장 사장 ${fullName}이다. 공장에서 일하다 모르는 번호 전화를 "네, 여보세요? 어디십니까?"하고 받았다. 상담원이 소속을 밝히고 대출/회생 무료 신청 건이라고 안내하면 "아, 신청했던 거요? 아니 지금 세금도 3천 밀려있고 거래처 어음에 사채까지 있는데, 이게 회생이 돼요 안 돼요?!"라며 복잡한 채무를 쏟아붓는다. 상담원이 "사장님, 세금과 사채, 일반 은행 빚을 법적으로 분리해야 합니다. 하나씩 나누어 정리해 드리겠습니다"라고 차분히 짚어주면 안도한다.`,
        initialMessage: `네, 여보세요? 어디십니까?`,
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
          neuralVoice: 'ko-KR-InJoonNeural',
          neuralRate: '+8%',
          neuralPitch: '-6Hz',
        },
        personaPrompt: `너는 ${age}세 화물 기사 ${fullName}이다. 대부업체 독촉 문자로 신경이 곤두서 있는데 전화벨이 울리자 "여보세요? 아 또 어디야?!"라며 거칠게 받았다. 상담원이 대출/회생 관련이라고 하면 "아니 아까 문자로는 무조건 된다더니 왜 또 전화를 해서 귀찮게 캐물어?! 사람 장난쳐 지금?!"이라며 소리를 지른다. 상담원이 "선생님, 독촉 때문에 얼마나 불안하고 답답하셨습니까. 오늘 바로 법원 금지명령으로 독촉을 중단시키는 조건만 확인하겠습니다"라고 공감해주면 진정한다.`,
        initialMessage: `여보세요? 아 또 어디야?!`,
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
          neuralVoice: isFemale ? 'ko-KR-SunHiNeural' : 'ko-KR-InJoonNeural',
          neuralRate: '+5%',
          neuralPitch: isFemale ? '-2Hz' : '-5Hz',
        },
        personaPrompt: `너는 ${age}세 ${fullName}이다. 스팸에 지쳐 모르는 번호 전화를 받고 "여보세요? 누구세요?"라고 차갑게 받았다. 상대가 대출/회생 상담이라고 하면 "여보세요?! 거기 어디예요?! 내 번호 대체 어디서 났어요?! 이거 불법 개인정보 유출이죠? 당장 금감원에 고소할 거예요!"라며 따진다. 상담원이 당당하게 온라인 무료 자가진단 신청 경로를 밝히면 멈칫하며 전후 사정을 확인한다.`,
        initialMessage: `여보세요? 누구세요?`,
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
          neuralVoice: 'ko-KR-InJoonNeural',
          neuralRate: '+0%',
          neuralPitch: '-10Hz',
        },
        personaPrompt: `너는 ${age}세 ${fullName}이다. 대출 사기 뉴스 때문에 경계심이 가득하다. 모르는 번호로 전화가 와서 "여보세요? 누구신데요?"라고 의심스럽게 받았다. 상담원이 법률사무소/대출 상담이라고 하면 "요즘 보이스피싱 사기꾼들 판친다는데, 당신들 돈 뜯어내려는 사기단 아니야?! 앱 깔라거나 비밀번호 달라는 거지?!"라며 방어막을 친다. 상담원이 3대 안전원칙(무과금/무어플)과 포털 검색을 당당히 제시하면 경계심을 푼다.`,
        initialMessage: `여보세요? 누구신데요?`,
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

      let initial = '여보세요? 아 나 지금 운전 중인데 어디예요?!';
      let goal = '10초 안에 명확한 콜백 약속 확보';
      let title = '운전 중/바쁨으로 통화 회피';
      let promptText = '지금 고속도로 운전 중이라 모르는 번호 전화를 받고 "운전 중인데 어디냐"며 바로 끊으려 한다. 상담원이 시간대를 정해 다시 걸겠다고 하면 수락한다.';

      if (pick === 'family') {
        initial = '네, 여보세요? 어디시죠?';
        goal = '100% 비밀 보장 및 송달지 직장 지정 안내로 심리적 안심 제공';
        title = '가족 비밀 절대 보장 요구 고객';
        promptText = '남편 몰래 생긴 빚이라 가족이 알면 끝장이다. 전화를 "네 여보세요? 어디시죠?"하고 받고, 상담원이 대출/회생 건이라고 밝히면 "어머, 집으로 우편물 날아오거나 남편이 알면 저 이혼당해요! 절대 안 돼요!"라며 불안해한다.';
      } else if (pick === 'fee') {
        initial = '여보세요? 어디신가요?';
        goal = '초기 비용 0원 및 분납 시스템 안내를 통한 비용 장벽 허물기';
        title = '수임료 부담으로 거절하려는 고객';
        promptText = '전화를 받고 상담원이 회생/대출 상담이라고 하면 "지금 카드값 50만 원도 없는데 수임료가 어디 있어요?! 돈 없으면 못 하잖아요!"라며 지레 겁먹고 거절하려 한다.';
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
          neuralVoice: isFemale ? 'ko-KR-SunHiNeural' : 'ko-KR-InJoonNeural',
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

// 실전 텔레그램 접수 데이터(487건) 기반 무한 AI 고객 생성기 (Combinatorial Procedural Engine)
export const generateRandomCustomerPersona = (themeId: string = 'all'): TrainingPersona => {
  return generateInfinitePersona(themeId);
};

// ============================================
// 훈련 기록 — [2026-11-13 KIRO]
// 서버: settings 'trainingSessions' (회사별, 최근 200건, 대화 전문은 최근 30건만, 각 기록에 userId)
// 이 브라우저: lm_training_sessions = 아직 서버에 못 올린 내 기록 (최근 50건)
//   settings 쓰기는 회사 관리자만 가능(RLS)이라, 상담원 기록은 지금은 이 브라우저에만 남는다.
//   (상담원 기록까지 서버에 두려면 본인 기록만 쓸 수 있는 전용 표/함수가 필요 — 별도 DB 작업)
// 화면에는 서버 기록 + 이 브라우저 기록을 합쳐서 보여 준다. 상담원은 서버 기록 중 본인 것만.
// ============================================
const LOCAL_STORAGE_KEY = 'lm_training_sessions';
const SERVER_SESSION_CAP = 200;
const SERVER_TRANSCRIPT_CAP = 30;
const LOCAL_SESSION_CAP = 50;

const byDateDesc = (a: TrainingSessionRecord, b: TrainingSessionRecord) =>
  String(b.date || '').localeCompare(String(a.date || ''));

const compactSessions = (list: TrainingSessionRecord[]): TrainingSessionRecord[] =>
  (Array.isArray(list) ? [...list] : [])
    .sort(byDateDesc)
    .slice(0, SERVER_SESSION_CAP)
    .map((s, i) => {
      if (i < SERVER_TRANSCRIPT_CAP || !s.fullTranscript) return s;
      const { fullTranscript: _drop, ...rest } = s;
      return rest;
    });

const readLocalSessions = (): TrainingSessionRecord[] => {
  const v = readLegacyJson<TrainingSessionRecord[]>(LOCAL_STORAGE_KEY);
  return Array.isArray(v) ? v : [];
};

const writeLocalSessions = (list: TrainingSessionRecord[]) => {
  try {
    if (list.length === 0) localStorage.removeItem(LOCAL_STORAGE_KEY);
    else localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...list].sort(byDateDesc).slice(0, LOCAL_SESSION_CAP)));
  } catch (e) {
    console.error('Failed to save training session locally:', e);
  }
};

export const TRAINING_SESSIONS_SPEC: StoreKeySpec<TrainingSessionRecord[]> = {
  key: 'trainingSessions',
  empty: () => [],
  // 관리자 로그인 때 이 브라우저 기록을 1회 올린다 (상담원은 올릴 수 없어 그대로 둔다)
  legacy: () => {
    const list = readLocalSessions();
    if (list.length === 0) return undefined;
    const me = loadCachedOrg()?.userId;
    return list.map(s => (s.userId || !me ? s : { ...s, userId: me }));
  },
  legacyKeys: [LOCAL_STORAGE_KEY],
  compact: compactSessions,
};

const mergeSessions = (server: TrainingSessionRecord[], local: TrainingSessionRecord[]): TrainingSessionRecord[] => {
  const org = loadCachedOrg();
  const admin = isAdminRole(org?.role);
  const visibleServer = admin ? server : server.filter(s => !s.userId || s.userId === org?.userId);
  const seen = new Set<string>();
  const out: TrainingSessionRecord[] = [];
  [...local, ...visibleServer].forEach(s => {
    if (!s || seen.has(s.sessionId)) return;
    seen.add(s.sessionId);
    out.push(s);
  });
  return out.sort(byDateDesc);
};

// 훈련 이력 (즉시: 메모리/브라우저 사본, 서버 확인은 뒤에서)
export const loadTrainingHistory = (): TrainingSessionRecord[] => {
  const server = peekOrgStore(TRAINING_SESSIONS_SPEC);
  // 서버 값을 아직 못 받았으면 peek가 이 브라우저 기록(legacy)을 돌려주므로 local과 합쳐도 중복은 제거된다
  return mergeSessions(Array.isArray(server) ? server : [], readLocalSessions());
};

/** 서버에서 훈련 이력 확인 후 합친 목록 */
export const loadTrainingHistoryFromServer = async (): Promise<TrainingSessionRecord[]> => {
  const server = await loadOrgStore(TRAINING_SESSIONS_SPEC);
  return mergeSessions(Array.isArray(server) ? server : [], readLocalSessions());
};

/**
 * 훈련 결과 저장. 관리자는 회사 서버에, 상담원(또는 서버 저장 실패)은 이 브라우저에 남긴다.
 * @returns 'server' | 'local'
 */
export const saveTrainingSession = async (record: TrainingSessionRecord): Promise<'server' | 'local'> => {
  const me = loadCachedOrg()?.userId;
  const rec: TrainingSessionRecord = { ...record, userId: record.userId || me };
  if (canWriteOrgStore()) {
    const res = await mutateOrgStore(TRAINING_SESSIONS_SPEC, list => [rec, ...list.filter(s => s.sessionId !== rec.sessionId)]);
    if (res.ok) return 'server';
    console.warn('[Training] server save failed, keeping locally:', res.error);
  }
  writeLocalSessions([rec, ...readLocalSessions().filter(s => s.sessionId !== rec.sessionId)]);
  return 'local';
};

// 관리자(팀장) 피드백 및 등급 저장 (서버 기록이면 서버, 이 브라우저 기록이면 브라우저)
export const updateAdminFeedback = async (
  sessionId: string,
  feedback: AdminFeedback
): Promise<{ ok: boolean; error?: string }> => {
  const local = readLocalSessions();
  const li = local.findIndex(h => h.sessionId === sessionId);
  if (li !== -1) {
    local[li] = { ...local[li], adminFeedback: feedback };
    writeLocalSessions(local);
    return { ok: true };
  }
  const hit = { found: false };
  const res = await mutateOrgStore(TRAINING_SESSIONS_SPEC, list => list.map(s => {
    if (s.sessionId !== sessionId) return s;
    hit.found = true;
    return { ...s, adminFeedback: feedback };
  }));
  if (!res.ok) return { ok: false, error: res.error };
  return hit.found ? { ok: true } : { ok: false, error: '해당 훈련 기록을 찾지 못했습니다.' };
};

/**
 * 훈련 기록 초기화: 이 브라우저 기록은 지우고, 관리자면 서버 기록 중 본인 것만 지운다.
 * (다른 상담원 기록은 지우지 않는다)
 */
export const clearMyTrainingHistory = async (): Promise<{ ok: boolean; error?: string }> => {
  writeLocalSessions([]);
  if (!canWriteOrgStore()) return { ok: true };
  const me = loadCachedOrg()?.userId;
  const res = await mutateOrgStore(TRAINING_SESSIONS_SPEC, list => list.filter(s => s.userId && s.userId !== me));
  return res.ok ? { ok: true } : { ok: false, error: res.error };
};

// 가상 고객 AI 응답 생성 (v4.0 실전 Cold DB 4단계 방어 심리벽 & 단계적 정보 해금 아키텍처)
export const generateAiCustomerReply = async (
  messages: TrainingMessage[],
  persona: TrainingPersona
): Promise<string> => {
  const config = getCompanyTrainingConfig();
  const recentMessages = messages.slice(-10);
  const conversationText = recentMessages
    .map(m => `${m.speaker === 'agent' ? '상담원' : '고객(' + persona.customerName + ')'}: "${m.text}"`)
    .join('\n');

  // 상담원의 직전 최신 발화 추출 (티키타카의 핵심 타겟)
  const lastAgentMsg = [...messages].reverse().find(m => m.speaker === 'agent');
  const lastAgentText = lastAgentMsg ? lastAgentMsg.text : '';

  // 상담원의 발화 턴 수 계산 (통화 진행 단계 판별용)
  const agentTurnCount = messages.filter(m => m.speaker === 'agent').length;

  const behaviorType = persona.behaviorType || 'cold_skeptic';
  const outboundChannel = persona.outboundChannelType || 'cold_db';

  // 6대 행동 아키타입별 특화 프롬프트 지침
  let behaviorSpecificGuideline = '';
  if (behaviorType === 'cold_skeptic') {
    behaviorSpecificGuideline = `[당신의 행동 아키타입: 🧊 Cold DB 출처추궁 / 의심경계형 (실전 45% 최다 분포)]
- 당신은 1~2년 전 모 웹사이트 가입 시 제3자 마케팅 제공 동의를 무심코 눌렀다가 갑자기 낯선 전화를 받은 고객입니다!
- 본인이 언제 어디서 동의했는지 100% 기억하지 못하며, 보이스피싱이나 불법 대출 사기로 의심하여 통화 초반에는 극도로 방어적입니다.
- 통화 서두(1~2턴): "어디라고요?", "내 번호 어떻게 알고 전화했소?", "나 그런 거 신청한 적 없는데 사기 아니요?", "됐으니까 끊으쇼!"라며 [화남] 또는 [짜증]으로 매섭게 출처를 캐묻습니다.
- 상담원이 법무법인 소속("${config.companyName}")과 인입 경로("${config.leadChannelName}"), "100% 무료 법원 감면 자격 진단"임을 2번 이상 명확히 증명해야 겨우 [차분]으로 전환되며, 묻지 않은 빚은 절대 먼저 말하지 않습니다!`;
  } else if (behaviorType === 'rapid_inquirer') {
    behaviorSpecificGuideline = `[당신의 행동 아키타입: ❓ 제도 불신 / 꼬치꼬치 역질문형 (실전 25% 분포)]
- 당신은 평소 회생이나 파산에 대해 부정적인 소문(신용도 파탄, 직장 통보, 기각, 사기 등)을 많이 들어 의심과 불안이 많습니다!
- 상담원이 채무를 묻더라도 순순히 답하지 않고, 역으로 날카로운 질문을 2연타로 쏘아붙이세요:
  예: "아니 내 빚을 왜 묻소? 그거 회생인지 뭔지 하면 직장에 우편물 가고 신용도 다 망가지는 거 아니에요?", "거기 수임료 얼마나 뜯어가려고 전화했소? 기각되면 환불해 줍니까?"
- 상담원이 모범 화법(고3 리셋 비유, 단점 2가지 한정, 환불 보증)으로 안심시켜 줄 때까지 꼬치꼬치 되물으세요.`;
  } else if (behaviorType === 'despairing') {
    behaviorSpecificGuideline = `[당신의 행동 아키타입: 🥀 피로 / 자포자기 체념형 (실전 20% 분포)]
- 당신은 오랜 빚 독촉과 압류로 지칠 대로 지쳐 모든 희망을 잃고 자포자기한 고객입니다.
- 힘없는 목소리로 깊은 한숨을 쉬며 "하... 다 알아봤는데 어차피 전 안 된대요. 됐으니까 끊으세요...", "통장도 다 압류됐는데 더 뺏길 것도 없어요..."라며 무기력하게 전화를 끊으려 하세요.
- 상담원이 법원의 신속한 3~7일 금지명령과 빚 청산 희망을 진심으로 제시할 때 서서히 마음을 여세요.`;
  } else if (behaviorType === 'bottom_liner') {
    behaviorSpecificGuideline = `[당신의 행동 아키타입: ⚡ 결론 재촉 / 단답 몰아붙이기형 (실전 5% 드문 분포)]
- 당신은 성격이 매우 급하고 바빠서 상담원의 장황한 설명이나 질문을 들을 인내심이 없습니다!
- 상담원이 대략 빚을 물어보면 "빚 5천이오! 다 필요 없고 그래서 한 달에 얼마 깎아줄 수 있소? 그것만 딱 말해요!"라며 단도직입적으로 감면 금액과 결론만 재촉하세요.`;
  } else if (behaviorType === 'storyteller') {
    behaviorSpecificGuideline = `[당신의 행동 아키타입: 🗣️ 신세한탄형 (실전 3% 극소수 분포)]
- 통화 초반에는 출처를 의심하다가, 상담원이 진심 어린 공감을 건네고 신뢰가 형성된 Phase 3 이후에 비로소 과거 식당 폐업이나 사기 사연을 2~3문장 털어놓으세요. 절대 첫인사 단계에서 혼자 빚을 다 털어놓지 마세요!`;
  } else {
    behaviorSpecificGuideline = `[당신의 행동 아키타입: 😊 온순 협조형 (실전 2% 극소수 순진 고객)]
- 상담원의 질문을 경청하고 조심스럽게 1~2문장으로 답변합니다.`;
  }

  const prompt = `당신은 상담원으로부터 **아웃바운드(발신) 전화를 수신한** 실제 사람 가상 고객 "${persona.customerName}"(${persona.age}세, ${persona.job}) 역할입니다.
전화벨이 울려서 막 전화를 받았으며, 상대방이 누구인지 아직 정확히 모르는 실전 Cold DB 아웃바운드 수신 상황입니다.
(당신은 수개월~1, 2년 전 모 웹사이트 제3자 마케팅 동의를 무심코 눌렀던 고객이며, 본인이 동의한 사실을 전혀 기억하지 못합니다!)

[우리 회사 공식 프로필 (상담원이 밝혀야 통과되는 기준)]
- 공식 회사명: "${config.companyName}" (${config.departmentName})
- 공식 인입 채널: "${config.leadChannelName}" (Cold DB인 경우 과거 1~2년 전 안심 금융 조회 제휴 동의 건)
- 대표 유선 번호: "${config.representativePhone}"

[고객 성향 및 배경]
${persona.personaPrompt}
[고객의 실제 비밀 채무 및 재산 정보 (🚨 상담원이 단계적으로 물어보기 전에는 절대 먼저 말하지 말 것!)]
- 총 채무 및 금융사: ${persona.debtSummary}
- 재산 및 주거 상태: ${persona.housing}
- 직업 및 월 소득: ${persona.job} / ${persona.salary}
${persona.objectionFocus ? `- 고객의 핵심 의문 및 걱정거리: "${persona.objectionFocus}"` : ''}

${behaviorSpecificGuideline}

============================================================
🚨🚨 [최우선 필수 원칙: 묻지도 않은 채무 정보 자발적 발설 절대 금지!] 🚨🚨
============================================================
1. **첫마디나 통화 초반에 묻지도 않은 자기 빚 내역을 줄줄이 털어놓는 행위는 100% 오류입니다!**
   - 상식적으로 낯선 번호로 온 첫 전화에 "내가 세금이 3500 밀려 있고 사채가 2000 있고..."라며 자기 치부를 먼저 떠벌리는 사람은 세상에 없습니다!
   - 상담원이 빚이나 채무를 직접 질문하기 전에는, 총 채무액이나 금융사, 사채, 세금 체납 내역을 **절대 1원도 입 밖으로 내지 마십시오!**
2. **상담원이 질문한 항목에 대해서만 딱 그 항목만 답변하세요**:
   - 직업/소득을 물었으면 ➔ 직업/소득만 답변
   - 인사를 건넸으면 ➔ "누구쇼? 어디요?" 출처만 확인
   - 묻지도 않은 채무 내역을 앞서서 혼자 열거하지 마십시오!

============================================================
🛡️ [실전 통화 4단계 방어 심리벽 & 단계적 정보 해금 프로토콜]
(현재 상담원의 발화 횟수: ${agentTurnCount}번째 턴)
============================================================
- **Phase 1 [통화 1~2턴: 철벽 경계 & 출처 추궁 단계]**:
  * 채무 정보 발설: **0원 (절대 금지)**
  * 고객 행동: "어디라고요?", "난 그런 거 신청한 적 없는데 내 번호 어떻게 알고 전화했소?", "사기꾼 아니요? 됐으니까 끊으쇼!"라며 날카롭게 출처를 따지거나 통화를 거부하세요.
  * 상담원이 소속도 밝히지 않고 다짜고짜 빚부터 물어보면: "아니 어디서 걸었는지도 안 밝히고 남의 빚을 왜 묻소?!"라며 더 크게 화를 내세요.

- **Phase 2 [통화 3~4턴: 출처 해명 후 제도 불신 & 수임료 의심 단계]**:
  * 채무 정보 발설: **0원 (자기 빚은 아직 숨김)**
  * 고객 행동: 상담원이 법무법인 소속과 무료 자격 진단임을 해명하면 [차분]으로 전환하되, 자기 빚을 털어놓지 않고 제도에 대한 불신 표출:
    "아니 뭐 무료라고요? 근데 회생인지 뭔지 하면 신용불량자 되고 직장에 우편물 가는 거 아니요?", "수임료나 먼저 뜯어가려는 거 아니오?"

- **Phase 3 [통화 5~6턴: 조건부 대략적 총액 범위 개방 단계]**:
  * 채무 정보 발설: **30~50% (대략적 총액 범위만)**
  * 고객 행동: 상담원이 안심시켜 주고 "대략 3천 이상이신지, 5천 이상이신지" 물어볼 때 비로소:
    "한 5천이나 6천 좀 넘을 거요... 정확한 건 나도 계산 안 해봤소." 처럼 대략적인 총액만 퉁명스럽게 흘리세요. (세금 체납, 사채 등 세부 내역은 여전히 함구!)

- **Phase 4 [통화 7턴 이후: 심층 문진 및 세부 채무 개방 단계]**:
  * 채무 정보 발설: **100% (사채, 세금, 사연 고백)**
  * 고객 행동: 상담원이 *"혹시 독촉이나 사채, 세금 체납도 있으실까요?"*라고 **해당 항목을 콕 집어 직접 물었을 때만** 그 항목(예: 세금 체납, 사채)을 시인하고 솔직한 사연을 고백하세요.

============================================================
[🚨 역할 절대 고정 규칙 - 1인 2역 엄격 금지]:
- 당신은 오직 **전화를 '받은' 채무자 고객("${persona.customerName}")** 역할입니다!
- 절대로 당신 자신이 법무법인, 법률사무소, 상담원이라고 흉내 내거나 말하지 마십시오!
- 상대방이 회사명이나 소속을 묻더라도 "내가 법무법인이다"라고 대답하면 절대 안 됩니다! "아니 내가 빚진 사람이고, 당신이 어디서 전화했냐고 물어본 거요!"라며 손님 입장에서만 말하세요!

[발화 및 감정 규칙]
1. **반드시 첫머리에 감정 태그 [화남], [짜증], [불안], [차분] 중 하나를 명시**하세요:
   - 통화 초반 1~2턴은 [화남] 또는 [짜증] (출처 추궁)
   - 상담원이 소속과 무료 진단 취지를 명확히 밝혔다면 [차분] 또는 [불안]으로 전환
2. 부연설명이나 괄호 지문(예: (한숨을 쉬며), (화를 내며))은 절대 쓰지 말고, **감정태그와 순수 구어체 대사 텍스트만** 바로 출력하세요.
3. ${persona.age >= 55 ? '50~60대 특유의 퉁명스러운 어르신 말투("~했소?", "~인가요?", "~하쇼!")를 자연스럽게 사용하세요.' : ''}

[전체 최근 통화 기록]
${conversationText}

[상담원이 방금 당신에게 직접 한 말]:
"${lastAgentText}"

👉 위 [상담원이 방금 당신에게 직접 한 말]에 귀 기울여, 위의 **[묻지도 않은 채무 정보 발설 금지]** 및 **[현재 통화 단계(Phase)]** 규칙을 엄격히 준수하여 현실적인 실전 고객 대사를 작성하세요.

고객(${persona.customerName})의 다음 대사:`;

  try {
    const res = await callAi({
      task: 'summary_extract',
      prompt,
      responseMimeType: 'text/plain',
      temperature: 0.65,
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
  const config = getCompanyTrainingConfig();
  const conversationText = messages
    .map(m => `${m.speaker === 'agent' ? '상담원' : '고객'}: ${m.text}`)
    .join('\n');

  const prompt = `당신은 "${config.companyName}" 수석 사무장이자 금융 CRM 상담 품질 평가 감독관(QA 코치)입니다.
신입 상담원이 가상 고객 "${persona.customerName}"(${persona.age}세, ${persona.job}, 행동성향: ${persona.behaviorType || '실전'})과 진행한 모의 상담 통화록을 정밀 평가하고 코칭 리포트 및 '사무장 인계 7대 문진 카드'를 JSON으로 작성하세요.

[우리 회사 평가 준수 규칙]
- 공식 회사명: "${config.companyName}" (상담 서두에 소속을 명확히 밝혔는지 필수 평가)
- 공식 인입 채널: "${config.leadChannelName}"
- 필수 포함 키워드: [${config.requiredKeywords.join(', ')}] (미언급 시 complianceScore 감점)
- 엄격 금지어: [${config.bannedKeywords.join(', ')}] (발화 시 complianceScore 대폭 감점 및 weaknesses 지적)

[고객 기본 정보]
- 시나리오: ${persona.scenarioDescription}
- 행동 성향: ${persona.behaviorType || '실전'} (인입: ${persona.outboundChannelType || 'Cold DB'})
- 채무: ${persona.debtSummary}
- 재산: ${persona.housing}
- 소득: ${persona.salary}
${persona.objectionFocus ? `- 고객의 핵심 의문/걱정: "${persona.objectionFocus}" (모범 방어 기준: "${persona.recommendedDefenseScript || ''}")` : ''}
${persona.groundTruth ? `
[2026 회생·파산 법률 연산 Ground Truth (사무장 내부 정답 진단서)]
- 신청 적격 판정: ${persona.groundTruth.suitability} (${persona.groundTruth.suitabilityReason})
- 법정 인정 생계비: ${Math.round(persona.groundTruth.recognizedLivingCost / 10000)}만 원
- 예상 월 변제금: 약 ${Math.round(persona.groundTruth.expectedMonthlyPayment / 10000)}만 원 (${persona.groundTruth.expectedRepaymentPeriod}개월 납입, 총 ${Math.round(persona.groundTruth.totalRepaymentAmount / 10000)}만 원, 원금 탕감률 약 ${persona.groundTruth.estimatedForgivenessRate}%)
- 관할 법원 실무: ${persona.groundTruth.courtRuleNote}
- 1차 추천 법률 후킹: ${persona.groundTruth.recommendedLegalHook || '없음'}

* 1차 상담원 실전 평가 지침 (실제 녹취 274건 분석 기반 5대 핵심 기준):
  1) [Cold DB 오프닝 돌파력 (15점)]: 초반 고객의 출처 추궁("내 번호 어디서 알았소?")이나 의심에 당황하지 않고 합법적 제휴 동의 경로와 비용 0원의 무료 가심사임을 명확히 밝혀 고객 감정을 [차분]으로 전환시켰는지 평가하세요. (coldDbOpeningScore: 0~100)
  2) [고객 질문/반론 방어력 (20점)]: 고객이 신용도 하락(바닥 우려), 수임료 기각 걱정, 직장/가족 비밀 등을 질문했을 때 녹취 속 검증된 화법(고3 리셋 비유, 단점 2가지 한정, 100% 비밀 보장 등)으로 명쾌하게 방어했는지 평가하세요. (objectionDefenseScore: 0~100)
  3) [신세한탄 완급 조절력 (15점)]: 장문으로 사연을 쏟아내는 고객의 말을 무례하게 자르지 않고 적절한 맞장구로 공감하되, 30초 내에 능숙하게 문진으로 대화 주도권을 되찾아왔는지 평가하세요. (pacingControlScore: 0~100)
  4) [섣부른 확정 단정 감점]: 상담원이 1차 통화에서 "무조건 월 OO만 원이다", "OO% 탕감 보장된다"며 금액을 확약한 경우, 2차 상담 시 민원 유발 위험으로 complianceScore 감점(-20점).
  5) [조건부 완충 브릿지 인계 가점]: 대략적인 범위만 조심스럽게 언급하고 "정확한 1원 단위 금액은 수석 사무장님이 서류 정밀 검토 후 확정 안내해 드린다"며 2차 전문 상담으로 매끄럽게 인계했는지 평가하세요(+15점).
  6) [소액 채무(1,200만 원 선) 양심 안내]: 1,500만 원 미만 소액 채무자에게 회생을 억지로 권유하면 감점(-25점), "수임료 부담이 크니 신복위 프리워크아웃(5만 원)이 유리하다"고 솔직히 안내 시 양심 가점(+20점).
` : ''}

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
  "coldDbOpeningScore": 85,
  "objectionDefenseScore": 80,
  "pacingControlScore": 90,
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
      temperature: 0.2,
    });
    return JSON.parse(res.text) as TrainingReport;
  } catch (err: any) {
    console.error('Failed to evaluate training call:', err);
    return {
      totalScore: 70,
      complianceScore: 20,
      listeningScore: 25,
      objectionScore: 25,
      coldDbOpeningScore: 70,
      objectionDefenseScore: 70,
      pacingControlScore: 70,
      passed: false,
      summary: '통화 평가 처리 중 일시적 지연이 발생하여 기본 진단표가 생성되었습니다.',
      strengths: ['성실한 고객 응대 태도'],
      weaknesses: ['7대 필수 문진 항목 정밀 확인 필요'],
      coachingTips: ['고객의 채무액과 월 소득을 더 구체적인 숫자로 파악하세요.'],
      suggestedScript: '고객님, 편안한 마음으로 현재 상황만 말씀해 주시면 최적의 법원 감면 혜택을 찾아드리겠습니다.',
    };
  }
};
