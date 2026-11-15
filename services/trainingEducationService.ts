// ============================================
// 신입 상담원 실전 교육자료 · 모범 녹취 · FAQ 허브 서비스
// 첨부 PDF 교육자료(1차 스크립트, Q&A, 기준표, 반론화법) 디지털 교재화 및
// 관리자 CMS / NotebookLM 연동 데이터 관리
// ============================================

import { StoreKeySpec, peekOrgStore, loadOrgStore, mutateOrgStore, readLegacyJson, canWriteOrgStore } from './orgStore';
import { callAi } from './aiProxy';

export interface IntakeFieldItem {
  id: number;
  title: string;
  category: '기본인적' | '소득직장' | '채무상황' | '재산주거' | '제도이력';
  description: string;
  required: boolean;
  example: string;
  tip: string;
}

export interface EducationScriptModule {
  title: string;
  opening: string;
  openingSub: string;
  middleBridge: string;
  intakeFields: IntakeFieldItem[];
  closing: string;
  prohibitedRules: Array<{
    id: number;
    rule: string;
    reason: string;
    severity: 'critical' | 'warning';
  }>;
  transferCriteria: Array<{
    id: number;
    condition: string;
    action: string;
    note: string;
  }>;
}

export interface LivingCostItem {
  householdSize: number;
  medianIncome: string; // 2026 기준 중위소득 (기존 호환)
  minLivingCost: string; // 2026 기준 법정 최저생계비 (기존 호환)
  medianIncome2026: string;
  minLivingCost2026: string;
  medianIncome2025: string;
  minLivingCost2025: string;
  advice: string;
}

export interface PriorityRepaymentItem {
  region: string;
  targetCities: string;
  maxDeposit: string; // 소액임차인 보증금 한도
  priorityAmount: string; // 최우선 변제금
}

export interface ReliefSchemeItem {
  id: string;
  name: string;
  organ: string; // 법원 vs 신용회복위원회
  debtReq: string; // 채무 요건
  delinquencyReq: string; // 연체 기간 요건
  reductionRate: string; // 원금/이자 감면율
  pros: string; // 장점
  cons: string; // 단점
}

export interface LegalStandardModule {
  year: string;
  livingCosts: LivingCostItem[];
  priorityRepayments: PriorityRepaymentItem[];
  reliefSchemes: ReliefSchemeItem[];
}

export interface ObjectionStep {
  step: number;
  stepTitle: string;
  speech: string;
  psychology: string; // 고객 심리
}

export interface ObjectionGuideItem {
  id: string;
  title: string;
  customerObjection: string;
  coreIntent: string; // 고객의 근본적 불안
  steps: ObjectionStep[];
}

export interface EducationFaqItem {
  id: string;
  category: 'eligibility' | 'objection' | 'intake_rule' | 'system_transfer';
  question: string;
  answer: string;
  highlightKeyword?: string;
  tags: string[];
}

export interface EducationVideoItem {
  id: string;
  title: string;
  description: string;
  youtubeId: string; // 유튜브 영상 ID (또는 embed URL)
  duration: string;
  category: string;
  keyTakeaway: string;
}

export interface DialogueTurn {
  turn: number;
  speaker: '상담원' | '고객';
  text: string;
  timeSec: number;
  timeLabel: string;
  coachingTip?: string;
}

export interface ModelRecordingItem {
  id: string;
  title: string;
  personaName: string;
  personaType: string;
  duration: string;
  totalSeconds: number;
  score: number;
  grade: string;
  summary: string;
  audioUrl?: string; // 오디오 파일 경로 (없을 시 내장 시뮬레이터 재생)
  highlightTags: string[];
  dialogue: DialogueTurn[];
}

export interface NotebookLmConfig {
  sharedUrl: string;
  notebookTitle: string;
  notebookDescription: string;
  guideSteps: string[];
  sampleQuestions: string[];
}

export interface TrainingEducationMaterials {
  scriptModule: EducationScriptModule;
  legalStandards: LegalStandardModule;
  objectionGuides: ObjectionGuideItem[];
  faqs: EducationFaqItem[];
  videos: EducationVideoItem[];
  recordings: ModelRecordingItem[];
  notebookLm: NotebookLmConfig;
  lastUpdated: string;
  updatedBy?: string;
}

// -------------------------------------------------------------
// 기본 내장 교육 데이터 (대표님 제공 PDF 3종 전수 분석 반영)
// -------------------------------------------------------------

export const DEFAULT_EDUCATION_MATERIALS: TrainingEducationMaterials = {
  scriptModule: {
    title: '1차 TM 상담원 정석 스크립트 및 15대 필수 인계 양식',
    opening: `안녕하세요. 광고전화 드린 건 아니고요~ 정부지원 채무 탕감제도 안내 차, 연락드렸습니다.\n(대출이나 스팸 전화는 아니고요~) 가지고 계신 채무의 이자는 전액 감면받으시고, 원금도 최대 50% 이상 탕감받아 보실 수 있도록 '무료 법률상담 접수' 도와드리고 있는데요~ 현재 가지고 계신 총 채무가 어느 정도 되실까요?`,
    openingSub: `💡 고객이 "어디시죠?", "무슨 전화죠?"라고 할 때 당황하지 않고 '스팸/대출 권유가 아니며, 정부지원 이자 전액 감면 및 원금 탕감 무료 접수'임을 3초 안에 명확히 전달합니다.`,
    middleBridge: `아이고... 월 대출금 내시느라 생활비도 빠듯하셨을 텐데 정말 고생 많으셨습니다. 혼자 끙끙 앓으실 필요 전혀 없으시고요, 법률 전문 사무장님이 고객님 상황에 딱 맞춰서 매달 갚으실 금액을 확 줄여드릴 수 있는지 정밀하게 확인해 드리겠습니다.`,
    intakeFields: [
      { id: 1, title: '담당자', category: '기본인적', description: '상담원 본인 성함', required: true, example: '김상담', tip: '인계장에 정확히 기재' },
      { id: 2, title: '고객 성함', category: '기본인적', description: '신청인 실명', required: true, example: '홍길동', tip: '가명인지 본명인지 확인' },
      { id: 3, title: '생년월일 및 성별', category: '기본인적', description: '출생연도 및 성별 파악', required: true, example: '1985년생(41세) 남성', tip: '연령에 따른 취업/부양능력 파악' },
      { id: 4, title: '직장명 및 직종', category: '소득직장', description: '직장명 (말하기 꺼리면 업종/직종)', required: true, example: '제조업체 생산직 / 음식점 홀서빙', tip: '소득의 연속성 확인' },
      { id: 5, title: '재직기간', category: '소득직장', description: '현재 직장 근무 기간', required: true, example: '6개월 (급여 통장 수령)', tip: '최소 1회 이상 급여 수령 필수' },
      { id: 6, title: '4대보험 가입 유무', category: '소득직장', description: '4대보험 직장가입 여부', required: true, example: '미가입 (통장 수령)', tip: '미가입/일용직도 통장 거래내역 있으면 가능' },
      { id: 7, title: '연락처', category: '기본인적', description: '통화 가능한 본인 명의 휴대폰 번호', required: true, example: '010-1234-5678', tip: '사무장 2차 통화 가능 시간대 확인' },
      { id: 8, title: '거주지역', category: '재산주거', description: '실제 거주 시/군/구', required: true, example: '경기도 수원시 영통구', tip: '관할 법원(서울/수원/지방) 결정 기준' },
      { id: 9, title: '결혼 및 부양가족 수', category: '기본인적', description: '배우자, 미성년 자녀, 65세 이상 부모', required: true, example: '기혼, 자녀 2명(초등학생)', tip: '최저생계비 인정 인원수 결정 핵심' },
      { id: 10, title: '월 세후 실소득', category: '소득직장', description: '통장에 실제 입금되는 실수령액', required: true, example: '월 240만 원', tip: '최저생계비(1인 약 143만 원) 초과분 확인' },
      { id: 11, title: '월 대출 납입금', category: '채무상황', description: '원금과 이자로 매월 나가는 총 상환액', required: true, example: '월 180만 원', tip: '소득 대비 과다 상환액 강조 및 공감' },
      { id: 12, title: '거주형태 및 보증금', category: '재산주거', description: '자가, 전세, 월세 보증금', required: true, example: '월세 보증금 3,000만 / 월세 60만', tip: '소액임차 최우선변제금 공제 후 재산 산정' },
      { id: 13, title: '본인 및 배우자 재산', category: '재산주거', description: '부동산 시세, 차량 시세, 보험 해약환급금', required: true, example: '차량(중고 500만), 예금 200만', tip: '재산총액이 채무보다 적어야 회생 가능' },
      { id: 14, title: '채무 기관 및 내역', category: '채무상황', description: '1금융, 2금융(카드/캐피탈/저축), 대부업 구분', required: true, example: '은행 2천, 카드론 2천, 저축은행 1.5천 (총 5.5천)', tip: '사채/개인돈 포함 여부 체크' },
      { id: 15, title: '최근 5년 조정 이력', category: '제도이력', description: '과거 회생/파산/신용회복 면책 이력', required: true, example: '과거 이력 전혀 없음', tip: '회생 면책 후 5년, 파산 후 7년 경과 필수' },
    ],
    closing: `네 고객님, 말씀해 주신 내용 잘 정리되었고요. 저희 법무법인 도산 전문 사무장님이 순차적으로 연락드릴 거니까 전화 꼭 잘 받아주시고요~ 무료상담만 받아보셔도 매달 나가시는 이자와 원금을 어떻게 줄일 수 있는지 확실한 길을 찾으실 수 있습니다. 꼭 좋은 결과 있으시길 바라겠습니다. 감사합니다!`,
    prohibitedRules: [
      { id: 1, rule: '상담 접수 후 사무장 2차 통화 전까지 [문자 발송 절대 금지]', reason: '사무장 정밀 상담 전에 회사의 안내 문자를 임의 발송할 경우 고객의 불안감 및 오인 신고가 발생할 수 있습니다.', severity: 'critical' },
      { id: 2, rule: '상담원이 임의로 [구체적인 감면율(00%), 변제금액(00원)] 단정 언급 금지', reason: '법원 심리와 채권자 집회에 따라 탕감률은 1원 단위까지 변동되므로, 1차 상담원이 확정 수치를 말하면 100% 분쟁 및 민원이 됩니다.', severity: 'critical' },
      { id: 3, rule: '1차 통화에서 [개인회생과 신용회복 2가지를 동시 안내]하여 혼란 야기 금지', reason: '제도를 둘 다 설명하면 고객은 비교하다가 이탈합니다. 우선 법원 개인회생의 강력한 원금 탕감 실익으로 접수 후 사무장이 2차에서 정밀 진단합니다.', severity: 'warning' },
      { id: 4, rule: '고객과의 불필요한 언쟁 및 시비 금지', reason: '출처를 따지거나 강한 불만을 표시하는 고객은 붙잡지 말고 "불편하셨다면 죄송합니다. 즉시 삭제하겠습니다"로 신속 선종료합니다.', severity: 'warning' },
    ],
    transferCriteria: [
      { id: 1, condition: '재산이 총 채무보다 많은 경우 (재산초과자)', action: '신속 컨설팅 팀장 이관', note: '청산가치 보장의 원칙상 기각되므로 담보대출 대환이나 신용회복 검토' },
      { id: 2, condition: '월 세후 소득이 150만 원 미만인 경우', action: '타제도(파산/신복위) 안내 또는 신속 컨설팅 이관', note: '1인 최저생계비(약 143만 원) 미달로 변제 수행 불가능' },
      { id: 3, condition: '총 채무가 2,000만 원 미만인 소액 채무자', action: '신용회복위원회(신청비 5만 원) 권장 이관', note: '법원 수임료 대비 탕감 실익이 적어 배보다 배꼽이 큼' },
      { id: 4, condition: '과거 개인회생 면책 후 5년 미경과자 / 파산 후 7년 미경과자', action: '접수 반려 및 기간 도래 안내', note: '법률상 재신청 금지 기간이므로 접수 불가' },
    ],
  },
  legalStandards: {
    year: '2025~2026년 기준',
    livingCosts: [
      {
        householdSize: 1,
        medianIncome: '2,564,238원',
        minLivingCost: '1,538,543원',
        medianIncome2026: '2,564,238원',
        minLivingCost2026: '1,538,543원',
        medianIncome2025: '2,391,613원',
        minLivingCost2025: '1,434,968원',
        advice: '전년 대비 +103,575원 인상 (월 실수령 155만 원 이상 권장)',
      },
      {
        householdSize: 2,
        medianIncome: '4,199,292원',
        minLivingCost: '2,519,575원',
        medianIncome2026: '4,199,292원',
        minLivingCost2026: '2,519,575원',
        medianIncome2025: '3,932,828원',
        minLivingCost2025: '2,359,697원',
        advice: '전년 대비 +159,878원 인상 (2인 생계비 251만 원 공제로 변제금 경감)',
      },
      {
        householdSize: 3,
        medianIncome: '5,359,036원',
        minLivingCost: '3,215,422원',
        medianIncome2026: '5,359,036원',
        minLivingCost2026: '3,215,422원',
        medianIncome2025: '5,025,353원',
        minLivingCost2025: '3,015,212원',
        advice: '전년 대비 +200,210원 인상 (3인 생계비 321만 원 보장)',
      },
      {
        householdSize: 4,
        medianIncome: '6,494,738원',
        minLivingCost: '3,896,843원',
        medianIncome2026: '6,494,738원',
        minLivingCost2026: '3,896,843원',
        medianIncome2025: '6,097,773원',
        minLivingCost2025: '3,658,664원',
        advice: '전년 대비 +238,179원 인상 (4인 가구 생계비 약 390만 원 보장)',
      },
      {
        householdSize: 5,
        medianIncome: '7,556,719원',
        minLivingCost: '4,534,031원',
        medianIncome2026: '7,556,719원',
        minLivingCost2026: '4,534,031원',
        medianIncome2025: '7,108,170원',
        minLivingCost2025: '4,264,902원',
        advice: '전년 대비 +269,129원 인상 (5인 가구 생계비 약 453만 원 보장)',
      },
      {
        householdSize: 6,
        medianIncome: '8,574,383원',
        minLivingCost: '5,144,630원',
        medianIncome2026: '8,574,383원',
        minLivingCost2026: '5,144,630원',
        medianIncome2025: '8,064,845원',
        minLivingCost2025: '4,838,907원',
        advice: '전년 대비 +305,723원 인상 (6인 가구 생계비 약 514만 원 보장)',
      },
    ],
    priorityRepayments: [
      { region: '서울특별시', targetCities: '서울 전역', maxDeposit: '1억 6,500만 원 이하', priorityAmount: '5,500만 원 (재산에서 공제)' },
      { region: '과밀억제권역 등', targetCities: '인천(강화·옹진 제외), 수원, 성남, 고양, 부천, 안양, 광명, 과천, 의왕, 군포, 하남, 남양주, 구리, 시흥, 세종, 용인, 화성, 김포', maxDeposit: '1억 4,500만 원 이하', priorityAmount: '4,800만 원 (재산에서 공제)' },
      { region: '광역시 및 주요도시', targetCities: '부산, 대구, 광주, 대전, 울산, 안산, 광주(경기), 파주, 이천, 평택', maxDeposit: '8,500만 원 이하', priorityAmount: '2,800만 원 (재산에서 공제)' },
      { region: '그 밖의 전국 지역', targetCities: '강원, 충북, 충남, 전북, 전남, 경북, 경남, 제주 등 기타 시·군', maxDeposit: '7,500만 원 이하', priorityAmount: '2,500만 원 (재산에서 공제)' },
    ],
    reliefSchemes: [
      {
        id: 'rehabilitation',
        name: '개인회생',
        organ: '관할 지방법원',
        debtReq: '담보 15억, 무담보 10억 이하 (최소 1,500만 원 이상 권장)',
        delinquencyReq: '연체 전에도 즉시 신청 가능 (독촉 전 선제 차단)',
        reductionRate: '이자 100% 전액 탕감 + 원금 최대 90% 탕감',
        pros: '사채, 사기피해, 코인/주식 빚 모두 포함 가능. 금지명령으로 압류/독촉 1주일 내 즉시 차단. 공무원/교사/의사 전문직 자격 유지.',
        cons: '법원 수임료 및 송달료 발생. 3년간 변제금 성실 납부 의무.',
      },
      {
        id: 'bankruptcy',
        name: '개인파산 및 면책',
        organ: '관할 지방법원',
        debtReq: '채무 제한 없음 (소득이 최저생계비 미달이거나 근로능력 상실)',
        delinquencyReq: '연체 여부 무관',
        reductionRate: '원금 및 이자 100% 전액 면책 (빚 완전 소멸)',
        pros: '빚을 1원도 갚지 않고 전액 탕감받음.',
        cons: '고령(60대 이상), 중증질환, 장애 등 명백한 무소득 사유 필요. 일정 기간 자격 제한.',
      },
      {
        id: 'rapid_workout',
        name: '신속채무조정 (신복위)',
        organ: '신용회복위원회',
        debtReq: '협약 가입 금융기관 채무만 가능',
        delinquencyReq: '연체 30일 이하 (정상 상환자 중 위기자)',
        reductionRate: '원금 감면 없음 (이자율만 소폭 인하, 상환기간 연장)',
        pros: '신청비 5만 원으로 저렴. 신용점수 하락 최소화.',
        cons: '원금 탕감이 전혀 없어 100% 원금을 다 갚아야 함. 사채/비협약 채무 불가.',
      },
      {
        id: 'pre_workout',
        name: '프리워크아웃 (신복위)',
        organ: '신용회복위원회',
        debtReq: '협약 가입 금융기관 채무만 가능',
        delinquencyReq: '연체 31일 ~ 89일 사이',
        reductionRate: '원금 감면 없음 (이자율 30~70% 감면)',
        pros: '약정 이자율 대폭 인하 및 분할상환 기간 최대 10년 연장.',
        cons: '원금 탕감이 없어 장기간 갚아야 함. 카드/대출 연체 기록 남음.',
      },
      {
        id: 'individual_workout',
        name: '개인워크아웃 (신복위)',
        organ: '신용회복위원회',
        debtReq: '협약 가입 금융기관 채무만 가능',
        delinquencyReq: '연체 90일 이상 (신용불량자 등재 필수)',
        reductionRate: '상각채권 원금 최대 70%, 미상각채권 0~30% 감면',
        pros: '상각채권의 경우 원금 감면 가능.',
        cons: '90일 동안 극심한 추심과 독촉, 통장 압류를 견뎌야 신청 가능. 사채/보증채무 제외.',
      },
    ],
  },
  objectionGuides: [
    {
      id: 'fee_too_high',
      title: '수임료가 비싸요 (핵심 화법 3단계)',
      customerObjection: '아니, 돈이 없어서 빚 탕감받으려는 건데 변호사 수임료가 몇백만 원이라니 너무 비싸네요. 차라리 신용회복위원회 5만 원짜리 할래요.',
      coreIntent: '당장 목돈이 없는 절박함 + 수임료를 낼 여유가 없다는 방어 심리',
      steps: [
        {
          step: 1,
          stepTitle: '1단계: 원금 탕감 실익 비교 (수천만 원 탕감 vs 100만 원 아끼기)',
          speech: `고객님 말씀이 백번 맞습니다. 당장 한 푼이 아쉬우신 상황인데 수임료 부담스러우신 거 당연합니다.\n하지만 고객님, 신용회복위원회에서 수임료 100~200만 원 아끼시려다가 원금 7천만 원을 8~10년 동안 다 갚으시는 것과, 법원 개인회생을 통해 원금 4~5천만 원을 통째로 탕감받으시는 것 중 어떤 게 고객님께 수천만 원 더 큰 이득이실까요?`,
          psychology: '수임료라는 비용이 아니라, 원금 수천만 원을 절약하는 투자 개념으로 프레임을 바꿉니다.',
        },
        {
          step: 2,
          stepTitle: '2단계: 대출금 상환 중단 효과 (매달 나가던 150만 원 여유자금 확보)',
          speech: `그리고 고객님, 저희가 법원에 서류를 접수하고 일주일 안에 금지명령이 나오면, 매달 꼬박꼬박 빠져나가던 대출 원리금 150만 원, 200만 원 상환이 그 즉시 법적으로 완전 중단됩니다! 독촉 전화도 단 한 통도 오지 않고요.\n그 매달 내시던 대출금을 안내셔도 되기 때문에, 그 여유 자금으로 수임료를 충분히 충당하고도 남으십니다.`,
          psychology: '금지명령으로 월 지출이 즉각 0원이 되는 현실적 여유 자금을 인지시킵니다.',
        },
        {
          step: 3,
          stepTitle: '3단계: 무이자 장기 분납 안심 (한 번에 내실 필요 전혀 없음)',
          speech: `게다가 저희 법무법인에서는 목돈을 한 번에 내시라고 절대 말씀 안 드립니다. 서류 준비부터 법원 인가까지 4개월에서 최장 6개월에 걸쳐 무이자로 편하게 나누어 내실 수 있도록 대표님 배려로 분납을 열어드리고 있습니다.\n그러니 비용 걱정은 전혀 하지 마시고, 일단 전문 사무장님께 1원 단위까지 얼마나 탕감받으실 수 있는지 무료 계산부터 받아보세요!`,
          psychology: '분납 지원과 무료 계산 안내로 상담 진입 장벽을 완전히 허물어줍니다.',
        },
      ],
    },
    {
      id: 'spam_scam_doubt',
      title: '스팸/보이스피싱 의심 및 출처 불만',
      customerObjection: '어디서 번호 알고 전화한 건가요? 이런 광고 전화 불법 아닌가요? 스팸 같은데 끊어요.',
      coreIntent: '개인정보 유출에 대한 경계심 + 낯선 번호에 대한 원초적 불안',
      steps: [
        {
          step: 1,
          stepTitle: '1단계: 대출 권유가 아님을 즉각 선언',
          speech: `아, 고객님 놀라셨죠? 죄송합니다. 대출 받으라는 스팸 전화는 절대 아니고요~ 정부지원 채무감면 제도 안내 차 연락드렸습니다.`,
          psychology: '스팸/대출 권유라는 오해를 첫 문장에서 1초 만에 해소합니다.',
        },
        {
          step: 2,
          stepTitle: '2단계: 합법적 번호 생성 및 삭제 권리 안내',
          speech: `이전에 금융사 상담 이력이 있으신 분들 대상으로 시스템 무작위 번호로 연결된 거고요, 혹시 불편하시면 통화 끝나고 제 전산에서 즉시 삭제 처리해 드리겠습니다.`,
          psychology: '삭제 권한을 고객에게 넘겨 통제감을 부여합니다.',
        },
        {
          step: 3,
          stepTitle: '3단계: 10초 혜택 제시로 호기심 전환',
          speech: `다만 요즘 금리가 너무 높다 보니 이자는 전액 면제받고 원금도 최대 90%까지 합법적으로 감면받으실 수 있는 법원 제도 접수 기간이라 연락드린 건데요, 현재 매달 갚으시는 대출금이 혹시 있으실까요?`,
          psychology: '이자 100% 감면이라는 파격적 혜택으로 자연스럽게 문진을 시작합니다.',
        },
      ],
    },
    {
      id: 'prefer_credit_recovery',
      title: '신용회복위원회 먼저 알아볼게요',
      customerObjection: '신용회복위원회 워크아웃이 비용도 5만 원이고 공공기관이라 안전하다던데 거기로 할게요.',
      coreIntent: '공공기관 선호 + 저렴한 비용 + 사기업에 대한 막연한 불안',
      steps: [
        {
          step: 1,
          stepTitle: '1단계: 신복위 제도의 장점 인정 (공감)',
          speech: `네, 고객님! 신용회복위원회도 정말 좋은 국가 제도입니다. 신청비 5만 원으로 저렴하고요.`,
          psychology: '고객의 주장을 부정하지 않고 인정하여 저항을 무력화합니다.',
        },
        {
          step: 2,
          stepTitle: '2단계: 신복위의 치명적 한계 팩트 전달',
          speech: `그런데 고객님, 신용회복위원회는 협약된 금융기관 채무만 가능하고, 대부업체나 통신비, 사채, 개인돈은 전혀 해결이 안 됩니다. 무엇보다 연체가 90일 이상 심각하게 넘어가 신용불량자가 되어야만 겨우 일부 원금을 깎아줍니다.`,
          psychology: '신복위의 3대 한계(90일 추심 견뎌야 함, 협약기관만 가능, 원금 감면 미미)를 명확히 밝힙니다.',
        },
        {
          step: 3,
          stepTitle: '3단계: 법원 개인회생의 완전한 포괄성 강조',
          speech: `반면에 법원 개인회생은 연체가 단 하루도 없어도 바로 신청하실 수 있고, 은행·카드·대부업은 물론 통신비와 개인 빚까지 전부 묶어서 원금의 최대 90%까지 나라에서 판결로 탕감해 줍니다. 사무장님 통화로 두 제도를 1분 만에 비교해 드릴 테니 들어보고 결정하세요!`,
          psychology: '연체 전 신청 가능 및 원금 대폭 탕감이라는 독보적 우위를 심어줍니다.',
        },
      ],
    },
    {
      id: 'family_secret',
      title: '가족이나 배우자, 직장 모르게 하고 싶어요',
      customerObjection: '집사람이나 남편이 알면 난리 납니다. 회사에 알려지면 해고당할 수도 있고요. 비밀 보장 되나요?',
      coreIntent: '가정 파탄 및 직장 불이익에 대한 극심한 공포',
      steps: [
        {
          step: 1,
          stepTitle: '1단계: 100% 비밀보장 법적 근거 제시',
          speech: `고객님, 그 부분은 걱정 전혀 안 하셔도 됩니다! 개인회생 신청 시 법원에서 오는 모든 통지서와 우편물은 고객님 댁이나 직장이 아니라, 저희 법무법인 사무실로만 독점 송달되도록 '송달영수인 지정'을 신청합니다.`,
          psychology: '법적 송달 제도로 우편물이 집으로 절대 가지 않는다는 확신을 줍니다.',
        },
        {
          step: 2,
          stepTitle: '2단계: 직장 통보 불가 및 신분 보장 안내',
          speech: `또한 채무자회생법 법률상 직장에 개인회생 사실이 절대 통보되지 않으며, 공무원이나 대기업 재직자분들도 직장에 아무런 통보 없이 조용히 인가받으십니다.`,
          psychology: '법 조항과 공무원 사례를 들어 직장 안전성을 입증합니다.',
        },
      ],
    },
  ],
  faqs: [
    {
      id: 'faq_1',
      category: 'eligibility',
      question: '소득이 없는 전업주부나 무직자도 개인회생 신청이 가능한가요?',
      answer: '개인회생은 "지속적이고 반복적인 소득"이 필수 조건입니다. 따라서 완전 무직자는 신청이 어렵습니다. 하지만 아르바이트, 파트타임, 식당 서빙, 프리랜서, 배달 등 4대보험이 안 되더라도 월 1회 이상 통장으로 급여를 수령하시거나 수령할 예정이라면 즉시 신청 가능합니다. 완전 무소득이면서 고령/질병이 있으신 경우 개인파산을 검토합니다.',
      highlightKeyword: '지속적 소득 필수 (알바/일용직 가능)',
      tags: ['무직자', '주부', '알바', '소득요건'],
    },
    {
      id: 'faq_2',
      category: 'eligibility',
      question: '빚이 1,500만 원인데 개인회생 하는 게 이득인가요?',
      answer: '법률상 1,500만 원도 신청은 가능합니다. 그러나 법원 인지대/송달료 및 법무법인 수임료를 감안하면 실질적인 탕감 실익이 크지 않을 수 있습니다. 통상 총 채무가 2,000만~2,500만 원 이상일 때 개인회생의 실익이 가장 크며, 1,500만 원 이하 소액 채무는 신용회복위원회 프리워크아웃(신청비 5만 원) 또는 신속 컨설팅 이관을 권장합니다.',
      highlightKeyword: '2,000만 원 이상 권장',
      tags: ['소액채무', '신복위', '실익비교'],
    },
    {
      id: 'faq_3',
      category: 'eligibility',
      question: '배우자 명의로 아파트나 자산이 있으면 남편이 회생 신청을 못 하나요?',
      answer: '신청 가능합니다! 원칙적으로 본인 명의 채무와 본인 재산이 기준입니다. 다만 서울회생법원, 수원회생법원, 부산회생법원 외의 일부 지방법원에서는 혼인 기간 중 형성된 배우자 재산의 50%를 신청인의 청산가치에 반영하라는 보정권고가 나올 수 있으므로, 배우자 재산 유무를 반드시 기재해 사무장에게 인계해야 정밀 계산이 가능합니다.',
      highlightKeyword: '배우자 자산 50% 청산가치 반영 여부 확인',
      tags: ['배우자재산', '청산가치', '회생법원'],
    },
    {
      id: 'faq_4',
      category: 'objection',
      question: '고객이 "내 번호 어디서 알았냐? 개인정보보호법 위반 아니냐?"고 따지면요?',
      answer: '"이전에 금융기관에서 대출이나 채무 상담을 남겨주셨던 이력 데이터를 기반으로 시스템 무작위 번호 연결되었습니다. 불편을 드렸다면 진심으로 사과드리며, 지금 통화 종료 후 즉시 전산에서 삭제 처리해 드리겠습니다"라고 정중히 응대한 후 신속히 통화를 종료합니다. 계속해서 시비를 거는 고객은 잡지 말고 선종료합니다.',
      highlightKeyword: '정중한 사과 + 전산 삭제 확약 + 선종료',
      tags: ['번호출처', '스팸항의', '선종료'],
    },
    {
      id: 'faq_5',
      category: 'objection',
      question: '고객이 "구체적으로 원금 몇 % 탕감되냐? 월 얼마 내냐?"고 집요하게 물어보면요?',
      answer: '상담원이 임의로 "80% 탕감됩니다", "월 30만 원만 내시면 됩니다"라고 숫자를 말하면 100% 민원과 분쟁이 발생합니다. "고객님의 월 실수령 소득, 부양가족 수, 주거지역 최우선변제금, 그리고 채권자 수에 따라 법원 규정이 1원 단위까지 달라집니다. 그래서 전문 사무장님이 2차 정밀 통화 때 고객님 조건에 딱 맞춘 예상 변제금을 무료로 정확히 산출해 드립니다"라고 정중히 사무장 통화로 넘겨야 합니다.',
      highlightKeyword: '확정 수치 언급 금지! 사무장 정밀 산출로 유도',
      tags: ['탕감률질문', '변제금', '금지사항'],
    },
    {
      id: 'faq_6',
      category: 'intake_rule',
      question: '상담 접수 후 고객에게 접수 완료 안내 문자를 보내도 되나요?',
      answer: '절대 금지입니다! 1차 상담 접수 후 사무장이 고객과 2차 정밀 상담을 진행하기 전까지는 회사의 어떠한 안내 문자도 임의로 발송하지 않습니다. 문자가 먼저 갈 경우 고객이 스팸이나 사기로 오인하여 차단하거나 불안해할 수 있습니다. 2차 사무장 통화가 성사된 이후 공식 양식으로 발송됩니다.',
      highlightKeyword: '사무장 통화 전 문자 발송 절대 금지',
      tags: ['문자발송금지', '접수규정', '컴플라이언스'],
    },
    {
      id: 'faq_7',
      category: 'intake_rule',
      question: '고객이 직장명을 절대 말하기 싫어하면 어떻게 하나요?',
      answer: '회사 상호를 억지로 캐물을 필요 없습니다! "아, 회사명은 말씀 안 하셔도 괜찮습니다~ 직종이 제조업 쪽이신지, 서비스업이신지, 아니면 사무직이신지만 편하게 말씀해 주시면 됩니다"라고 업종/직종으로 대체하여 기재하시면 됩니다. 급여 통장 수령 여부만 확인되면 충분합니다.',
      highlightKeyword: '직장명 대신 업종/직종 기재 가능',
      tags: ['직장명', '문진요령', '거부감해소'],
    },
    {
      id: 'faq_8',
      category: 'system_transfer',
      question: '타사무소 이관이나 신속 컨설팅으로 넘겨야 하는 기준은 무엇인가요?',
      answer: '1) 재산이 채무보다 많은 재산초과자, 2) 월 세후 소득이 150만 원 미만인 저소득자, 3) 총 채무가 2,000만 원 미만인 소액 채무자, 4) 과거 회생 면책 후 5년 / 파산 면책 후 7년이 지나지 않은 미도래자입니다. 이 경우 일반 회생 진행이 어려우므로 신속 컨설팅 팀장님께 이관하거나 대환/신복위 안내를 진행합니다.',
      highlightKeyword: '재산초과 / 소득150만미만 / 채무2천미만 / 면책미도래',
      tags: ['이관기준', '신속컨설팅', '자격미달'],
    },
  ],
  videos: [
    {
      id: 'vid_1',
      title: '개인회생 vs 개인파산 10분 총정리 (자격요건 및 탕감률 차이)',
      description: '회생과 파산의 결정적 자격 차이(소득 유무, 부양가족, 재산)와 신청 시 장단점을 신입 상담원의 눈높이에서 알기 쉽게 해설한 필수 기초 영상입니다.',
      youtubeId: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // 임베드 플레이어 연동
      duration: '11분 24초',
      category: '기초 법률 제도',
      keyTakeaway: '소득이 최저생계비 이상이면 회생, 근로능력 상실/고령이면 파산으로 구분.',
    },
    {
      id: 'vid_2',
      title: '신용회복위원회 워크아웃 vs 법원 개인회생 결정적 차이',
      description: '고객이 "신복위 할게요"라고 했을 때 1초 만에 법원 개인회생의 원금 탕감 우위를 설득할 수 있도록 두 제도의 팩트와 장단점을 비교 분석합니다.',
      youtubeId: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      duration: '14분 05초',
      category: '제도 비교 및 반론',
      keyTakeaway: '신복위는 90일 연체 후 협약기관만 가능 vs 회생은 연체 전에도 모든 채무 원금 최대 90% 탕감.',
    },
    {
      id: 'vid_3',
      title: '아웃바운드 TM 초반 10초 고객 거절을 극복하는 마법의 오프닝',
      description: '전화 받자마자 끊으려는 고객의 호기심을 유발하고, "광고전화 아닙니다"라는 첫마디로 통화 유지 시간을 2배 이상 늘리는 실전 화법 강의입니다.',
      youtubeId: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      duration: '9분 42초',
      category: '실전 화법 코칭',
      keyTakeaway: '대출 권유 거부감을 1초 만에 없애고 정부지원 감면 혜택으로 프레임 전환.',
    },
    {
      id: 'vid_4',
      title: '고객의 "수임료가 비싸요" 거절을 100% 뒤집는 3단계 클로징',
      description: '목돈이 없어 망설이는 고객에게 원금 탕감 실익, 대출 상환 중단 효과, 무이자 장기 분납을 순차 제시하여 인계율을 80% 이상 끌어올리는 비결입니다.',
      youtubeId: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      duration: '12분 18초',
      category: '거절 극복 마스터',
      keyTakeaway: '수임료 100만 원 아끼기 vs 원금 5천만 원 탕감받기 비교 프레임.',
    },
  ],
  recordings: [
    {
      id: 'rec_1',
      title: 'Lv.1 온순한 직장인 (총 채무 6,500만 원 완벽 접수)',
      personaName: '김순한 (42세)',
      personaType: '일반 직장인 / 원리금 상환 부담',
      duration: '2분 10초',
      totalSeconds: 130,
      score: 98,
      grade: '🏆 S등급 (최우수 모범)',
      summary: '오프닝에서 광고 스팸 거부감을 말끔히 없앤 후, 15대 필수 인계 항목을 부드러운 공감과 함께 누락 없이 100% 수집하고 사무장 인계를 완벽히 성공한 모범 통화.',
      highlightTags: ['15대 문진 완벽', '부드러운 공감', '소속 명시', '사무장 인계'],
      dialogue: [
        { turn: 1, speaker: '상담원', timeSec: 0, timeLabel: '00:00', text: '안녕하세요. 광고전화 드린 건 아니고요~ 정부지원 채무 탕감제도 안내 차 연락드렸습니다.', coachingTip: '광고 거부감을 차단하는 정석 오프닝' },
        { turn: 2, speaker: '고객', timeSec: 6, timeLabel: '00:06', text: '네? 어디신데요? 대출 받으라는 건가요?' },
        { turn: 3, speaker: '상담원', timeSec: 10, timeLabel: '00:10', text: '아닙니다 고객님! 대출이나 스팸 전화는 절대 아니고요~ 가지고 계신 채무의 이자는 전액 면제받으시고 원금도 최대 90%까지 탕감받아 보실 수 있는 법원 무료 접수 안내입니다. 현재 총 채무가 어느 정도 되실까요?', coachingTip: '대출 선긋기 + 탕감 혜택 즉시 제시' },
        { turn: 4, speaker: '고객', timeSec: 23, timeLabel: '00:23', text: '어휴... 은행이랑 카드론 합쳐서 한 6,500만 원 정도 돼요. 매달 이자 내느라 죽겠습니다.' },
        { turn: 5, speaker: '상담원', timeSec: 31, timeLabel: '00:31', text: '아이고... 매달 이자 납입하시느라 생활비도 빠듯하셨을 텐데 정말 고생 많으셨습니다. 월 대출금으로 얼마씩 나가시나요?', coachingTip: '진정성 있는 공감 리액션 후 월 상환액 파악' },
        { turn: 6, speaker: '고객', timeSec: 42, timeLabel: '00:42', text: '한 달에 원리금 합쳐서 거의 210만 원씩 나갑니다. 월급의 대부분이에요.' },
        { turn: 7, speaker: '상담원', timeSec: 50, timeLabel: '00:50', text: '210만 원이면 정말 힘드셨겠어요. 현재 직장 근무 중이신가요? 월 실수령액과 재직 기간이 어떻게 되실까요?', coachingTip: '재직 및 실수령 소득 문진' },
        { turn: 8, speaker: '고객', timeSec: 60, timeLabel: '01:00', text: '네, 일반 중소기업 3년째 다니고 있고 실수령은 270만 원 정도 됩니다. 4대보험 되고요.' },
        { turn: 9, speaker: '상담원', timeSec: 72, timeLabel: '01:12', text: '확인 감사합니다. 가족분들과 함께 거주하시나요? 혹시 전월세 보증금이나 자가, 차량 재산은 어느 정도이신지요?', coachingTip: '부양가족 및 거주/재산 파악' },
        { turn: 10, speaker: '고객', timeSec: 85, timeLabel: '01:25', text: '아내랑 미성년 자녀 한 명 있고요, 경기도 수원에 보증금 3,000만 원 월세 살고 있습니다. 차는 10년 된 아반떼 하나 있어요.' },
        { turn: 11, speaker: '상담원', timeSec: 98, timeLabel: '01:38', text: '수원 거주에 3인 가구이시면 2025년 기준 법정 최저생계비가 약 300만 원 인정되기 때문에, 고객님의 경우 원금의 상당 부분을 합법적으로 탕감받으실 가능성이 매우 높습니다!', coachingTip: '최저생계비 기준과 연계한 희망 부여' },
        { turn: 12, speaker: '상담원', timeSec: 112, timeLabel: '01:52', text: '저희 도산전문 법무법인 사무장님이 순차적으로 연락드려 1원 단위까지 정밀 산출해 드릴 테니 전화 꼭 잘 받아주시고요, 무료 상담만으로도 큰 힘 되실 겁니다. 감사합니다!', coachingTip: '사무장 2차 통화 확약 및 깔끔한 클로징' },
      ],
    },
    {
      id: 'rec_2',
      title: 'Lv.3 까칠한 자영업자 (수임료 반론 극복 및 안심 인계)',
      personaName: '박의심 (54세)',
      personaType: '음식점 자영업자 / 수임료 및 사기 의심',
      duration: '2분 40초',
      totalSeconds: 160,
      score: 95,
      grade: '🏆 S등급 (최우수 모범)',
      summary: '"수임료 비싼데 왜 하냐, 신복위 갈 거다"라는 강한 거절을 3단계 반론 화법(원금 탕감 실익 비교 ➔ 대출 상환 즉시 중단 ➔ 무이자 분납)으로 매끄럽게 극복한 실전 통화.',
      highlightTags: ['수임료 반론 극복', '신복위 비교', '금지명령 상환중단', '분납 안심'],
      dialogue: [
        { turn: 1, speaker: '고객', timeSec: 0, timeLabel: '00:00', text: '아니 변호사 사무실 수임료 몇백만 원씩 받으면서 무슨 무료상담이에요? 신용회복위원회는 5만 원이면 된다는데 거기로 갈 겁니다!' },
        { turn: 2, speaker: '상담원', timeSec: 12, timeLabel: '00:12', text: '사장님, 말씀이 백번 맞습니다! 당장 가게 매출도 안 나와서 힘드신데 수임료 몇백만 원 당연히 부담스러우시죠.', coachingTip: '고객 말 100% 인정 및 공감으로 저항 해제' },
        { turn: 3, speaker: '상담원', timeSec: 24, timeLabel: '00:24', text: '하지만 사장님, 신용회복위원회에서 100만 원 아끼시려다가 총 채무 9천만 원을 8년 동안 원금 다 갚으시는 것과, 법원 개인회생으로 원금 6천만 원을 통째로 탕감받으시는 것 중 어떤 게 사장님께 수천만 원 더 이득이실까요?', coachingTip: '1단계: 원금 탕감 실익 비교 프레임' },
        { turn: 4, speaker: '고객', timeSec: 42, timeLabel: '00:42', text: '...그거야 탕감 많이 받는 게 좋지만, 당장 목돈이 없는데 어쩌라는 겁니까?' },
        { turn: 5, speaker: '상담원', timeSec: 52, timeLabel: '00:52', text: '그 점 때문에 연락드린 겁니다! 법원에 서류가 들어가면 일주일 안에 금지명령이 나와서 매달 내시던 대출 원리금 상환이 그 즉시 전면 중단됩니다. 매달 나가던 대출금을 안 내셔도 되기 때문에 그 여유 자금으로 충분히 해결되시고요.', coachingTip: '2단계: 금지명령 대출 상환 중단 효과 강조' },
        { turn: 6, speaker: '상담원', timeSec: 72, timeLabel: '01:12', text: '게다가 한 번에 내시는 게 아니라 4~6개월에 걸쳐 무이자로 편하게 나누어 내실 수 있도록 분납을 다 열어드립니다. 돈 한 푼 안 들이고 일단 얼마나 탕감되는지 계산부터 받아보세요!', coachingTip: '3단계: 무이자 장기 분납 제시' },
        { turn: 7, speaker: '고객', timeSec: 90, timeLabel: '01:30', text: '정말 분납이 돼요? 그럼 일단 얼마 탕감되는지나 한번 알아나 봅시다.' },
        { turn: 8, speaker: '상담원', timeSec: 102, timeLabel: '01:42', text: '네 사장님! 현명한 선택이십니다. 현재 사업자 명의와 월 평균 매출, 총 채무액만 간단히 확인해 주시면 사무장님이 1원 단위까지 정밀 산출해 드리겠습니다.', coachingTip: '안도감 부여 후 신속 문진 착수' },
      ],
    },
    {
      id: 'rec_3',
      title: 'Lv.2 의심 많은 주부 (가족 비밀 보장 및 신용회복 비교)',
      personaName: '이보호 (38세)',
      personaType: '가정주부 / 남편 몰래 채무 해결 희망',
      duration: '2분 05초',
      totalSeconds: 125,
      score: 96,
      grade: '🏆 S등급 (최우수 모범)',
      summary: '"남편이 알면 이혼당한다"며 두려워하는 주부 고객에게 법무법인 송달영수인 지정 및 100% 비밀보장 법적 절차를 명확히 설명해 안심시키고 인계를 성사시킨 통화.',
      highlightTags: ['100% 비밀보장', '송달영수인 지정', '주부 파트타임 회생', '심리적 안도'],
      dialogue: [
        { turn: 1, speaker: '고객', timeSec: 0, timeLabel: '00:00', text: '저기요... 카드빚이랑 대출이 3,800만 원 정도 있는데요, 이거 남편이 알면 진짜 이혼당하거든요. 집으로 우편물 안 오게 할 수 있나요?' },
        { turn: 2, speaker: '상담원', timeSec: 11, timeLabel: '00:11', text: '고객님, 그 부분은 걱정 전혀 안 하셔도 됩니다! 개인회생을 접수할 때 법원에서 오는 모든 우편물과 통지서는 고객님 댁이 아니라 저희 법무법인 사무실로만 오도록 송달영수인 지정을 필수로 진행합니다.', coachingTip: '송달영수인 제도로 우편물 원천 차단 확약' },
        { turn: 3, speaker: '고객', timeSec: 28, timeLabel: '00:28', text: '진짜 집으로 편지 한 통도 안 가나요? 그리고 제가 지금 파트타임 알바만 하는데도 신청이 되나요?' },
        { turn: 4, speaker: '상담원', timeSec: 38, timeLabel: '00:38', text: '네! 자택은 물론 직장에도 일체 통보되지 않고요. 파트타임이나 식당 알바라도 통장으로 월 1회 이상 급여를 수령하고 계시면 법률상 완벽하게 개인회생 신청 대상이 되십니다.', coachingTip: '알바 소득 인정 자격 요건 안내' },
        { turn: 5, speaker: '상담원', timeSec: 55, timeLabel: '00:55', text: '혼자 끙끙 앓다가 연체되어 집에 독촉장 날아오기 전에, 비밀 보장되는 지금 미리 접수하셔서 이자 전액 면제받으시는 게 가정을 지키시는 가장 빠른 길입니다. 전문 사무장님이 고객님 통화 편하신 시간대에 조용히 연락드리도록 하겠습니다!', coachingTip: '연체 전 선제 조치의 중요성 강조 및 인계 성공' },
      ],
    },
  ],
  notebookLm: {
    sharedUrl: 'https://notebooklm.google.com/',
    notebookTitle: '법무법인 개인회생·파산 실무 및 1차 스크립트 AI 지침서',
    notebookDescription: '대법원 회생·파산 실무준칙, 2025 최저생계비, 소액임차 최우선변제금, 1차 정석 스크립트가 탑재된 Google NotebookLM 지식 베이스입니다.',
    guideSteps: [
      '대표님의 Google 계정으로 NotebookLM(notebooklm.google.com)에 로그인합니다.',
      '새 노트북을 만들고 "법무법인 채무조정 실무 AI 가이드"로 명명합니다.',
      '대표님이 보유하신 교육자료 PDF 3종 및 실무준칙 문서를 소스(Sources)로 업로드합니다.',
      '우측 상단 [공유] 버튼을 눌러 "링크가 있는 모든 사용자(뷰어)"로 설정한 후 링크를 복사합니다.',
      '관리자 편집 모드에서 위 복사한 링크를 등록하면, 모든 상담원이 원클릭으로 1:1 법률 사수를 활용할 수 있습니다.',
    ],
    sampleQuestions: [
      '최근 1~2달 사이에 신규 대출이 총 채무의 70%인데 개인회생 신청이 가능한가요?',
      '배우자 명의로 시세 5억 원 아파트(담보대출 3억)가 있을 때 신청인의 청산가치는 얼마로 계산되나요?',
      '주식/코인 투자로 빚을 진 경우 서울회생법원과 부산회생법원의 탕감 기준 차이는 무엇인가요?',
      '고객이 "신용회복위원회 워크아웃 할래요"라고 거절할 때 가장 설득력 있는 답변 멘트를 작성해줘.',
      '월 세후 실수령액 230만 원인 1인 가구 직장인의 2025년 기준 월 예상 변제금 계산식을 알려줘.',
    ],
  },
  lastUpdated: new Date().toISOString(),
  updatedBy: '시스템 기본값',
};

// -------------------------------------------------------------
// orgStore 연동 키 스펙
// -------------------------------------------------------------

export const EDUCATION_MATERIALS_SPEC: StoreKeySpec<Partial<TrainingEducationMaterials>> = {
  key: 'trainingEducationMaterials',
  empty: () => ({}),
  legacy: () => readLegacyJson<Partial<TrainingEducationMaterials>>('lm_training_education_materials'),
  legacyKeys: ['lm_training_education_materials'],
};

/** 메모리/로컬 캐시 즉시 조회 */
export const getEducationMaterials = (): TrainingEducationMaterials => {
  const v = peekOrgStore(EDUCATION_MATERIALS_SPEC);
  if (v && typeof v === 'object' && Object.keys(v).length > 0) {
    return {
      ...DEFAULT_EDUCATION_MATERIALS,
      ...v,
      scriptModule: { ...DEFAULT_EDUCATION_MATERIALS.scriptModule, ...(v.scriptModule || {}) },
      legalStandards: { ...DEFAULT_EDUCATION_MATERIALS.legalStandards, ...(v.legalStandards || {}) },
      notebookLm: { ...DEFAULT_EDUCATION_MATERIALS.notebookLm, ...(v.notebookLm || {}) },
    };
  }
  return DEFAULT_EDUCATION_MATERIALS;
};

/** 서버 최신값 동기화 조회 */
export const loadEducationMaterials = async (): Promise<TrainingEducationMaterials> => {
  const v = await loadOrgStore(EDUCATION_MATERIALS_SPEC);
  if (v && typeof v === 'object' && Object.keys(v).length > 0) {
    return {
      ...DEFAULT_EDUCATION_MATERIALS,
      ...v,
      scriptModule: { ...DEFAULT_EDUCATION_MATERIALS.scriptModule, ...(v.scriptModule || {}) },
      legalStandards: { ...DEFAULT_EDUCATION_MATERIALS.legalStandards, ...(v.legalStandards || {}) },
      notebookLm: { ...DEFAULT_EDUCATION_MATERIALS.notebookLm, ...(v.notebookLm || {}) },
    };
  }
  return DEFAULT_EDUCATION_MATERIALS;
};

/** 관리자 전용 교육 자료 저장 (Supabase settings + 로컬 캐시) */
export const saveEducationMaterials = async (
  materials: TrainingEducationMaterials,
  adminName: string = '관리자'
): Promise<string | null> => {
  const payload: TrainingEducationMaterials = {
    ...materials,
    lastUpdated: new Date().toISOString(),
    updatedBy: adminName,
  };

  const res = await mutateOrgStore(EDUCATION_MATERIALS_SPEC, () => ({ ...payload }));
  return res.ok ? null : res.error;
};

/** 기본값으로 초기화 */
export const resetEducationMaterialsToDefault = async (adminName: string = '관리자'): Promise<string | null> => {
  return saveEducationMaterials(DEFAULT_EDUCATION_MATERIALS, adminName);
};

export interface InAppChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * [CRM 내장형 NotebookLM 법률 AI 사수]
 * 사이트 내부에서 2025 법정 기준표 및 대표님 제공 교육자료(PDF 3종)에 근거해 즉시 질의응답 처리
 */
export const askEducationAssistant = async (
  question: string,
  materials: TrainingEducationMaterials = DEFAULT_EDUCATION_MATERIALS
): Promise<string> => {
  const q = question.trim();
  if (!q) return '질문 내용을 입력해 주세요.';

  const prompt = `당신은 대한민국 도산 전문(개인회생·개인파산·채무조정) 법무법인의 핵심 요약 법률 사수 AI입니다.
신입 상담원이 통화 중 또는 상담 준비 중 빠른 확인을 위해 질문했습니다.

[핵심 지식 데이터]:
1. 2026년 공식 확정 기준 중위소득 및 개인회생 법정 최저생계비 (중위 60%):
- 1인 가구: 기준 중위소득 2,564,238원 / 최저생계비 1,538,543원
- 2인 가구: 기준 중위소득 4,199,292원 / 최저생계비 2,519,575원 (전년 대비 +159,878원)
- 3인 가구: 기준 중위소득 5,359,036원 / 최저생계비 3,215,422원
- 4인 가구: 기준 중위소득 6,494,738원 / 최저생계비 3,896,843원
- 5인 가구: 기준 중위소득 7,556,719원 / 최저생계비 4,534,031원
- 6인 가구: 기준 중위소득 8,574,383원 / 최저생계비 5,144,630원
※ 2026년 기준은 보건복지부 및 법원에 의해 이미 공식 확정 고시되었습니다. 절대로 "미발표"라고 하지 마세요.

2. 2023년 주택임대차 소액보증금 최우선변제금 (재산공제액):
- 서울: 보증금 한도 1.65억 이하 / 최우선변제금 5,500만 원 공제
- 과밀억제권역(수원/인천/성남/용인/화성 등): 한도 1.45억 이하 / 최우선변제금 4,800만 원 공제
- 광역시/안산/파주/이천/평택: 한도 8,500만 이하 / 최우선변제금 2,800만 원 공제
- 기타 전국: 한도 7,500만 이하 / 최우선변제금 2,500만 원 공제

3. 채무조정 5대 제도 핵심 비교:
- 개인회생: 연체 전에도 즉시 신청 가능, 사채/코인/대부업 포함, 원금 최대 90% 탕감 + 이자 100% 감면
- 개인파산: 소득이 없거나 최저생계비 미달(고령/질병), 빚 전액 100% 면책
- 신복위: 연체 90일 이상 필수(신용불량), 협약 금융기관만 가능, 원금 감면 미미

4. 수임료 반론 3단계 핵심:
- 1단계: 원금 탕감 실익 비교 (수임료 100만 아끼려다 원금 7천 다 갚는 신복위 vs 원금 5천 탕감 회생)
- 2단계: 금지명령으로 대출 원리금 상환 즉시 전면 중단 (매달 내던 대출금으로 수임료 충당)
- 3단계: 4~6개월 무이자 장기 분납

5. 컴플라이언스 절대 금지:
- 사무장 2차 통화 전 문자 발송 절대 금지
- 상담원이 임의로 감면율(00%), 변제금액(00원) 확정 수치 언급 금지

[신입 상담원의 질문]:
"${q}"

[🚨 답변 스타일 필수 원칙 - 엄격 준수]:
1. ❌ 서두 인사말(예: "반갑습니다", "20년 차 수석 사무장입니다", "질문하신 내용에 대해..." 등)이나 자기소개, 쓸데없는 잡담은 100% 금지합니다! 첫 글자부터 바로 본론으로 들어가세요.
2. ❌ 장황한 설명이나 불필요한 미사여구를 일체 빼고, 전체 분량을 3~5줄 내외로 간결하고 명료하게 핵심만 압축하세요.
3. ✅ 반드시 아래의 간결한 3개 블록 형식으로만 작성하세요:

📌 **결론**: 질문에 대한 정확한 핵심 답변 및 법정 수치 (1~2줄)
🎯 **실전 멘트**: 상담원이 고객에게 통화 중 바로 읽어줄 구어체 대사 1~2문장 ("...")
⚠️ **참고**: 꼭 주의해야 할 핵심 팁 1줄 (있을 때만 간결히 작성)`;

  try {
    const res = await callAi({
      task: 'summary_extract',
      prompt,
      responseMimeType: 'text/plain',
      temperature: 0.2,
    });
    return res.text.trim();
  } catch (err: any) {
    console.error('Failed to call AI for education assistant:', err);
    const lower = q.toLowerCase();
    if (lower.includes('생계비') || lower.includes('중위소득')) {
      let size = 1;
      if (lower.includes('2인') || lower.includes('이인')) size = 2;
      else if (lower.includes('3인') || lower.includes('삼인')) size = 3;
      else if (lower.includes('4인') || lower.includes('사인')) size = 4;
      else if (lower.includes('5인') || lower.includes('오인')) size = 5;
      else if (lower.includes('6인') || lower.includes('육인')) size = 6;

      const data: Record<number, { median: string; cost: string; prevCost: string; diff: string }> = {
        1: { median: '2,564,238원', cost: '1,538,543원', prevCost: '1,434,968원', diff: '10만 3,575원' },
        2: { median: '4,199,292원', cost: '2,519,575원', prevCost: '2,359,697원', diff: '15만 9,878원' },
        3: { median: '5,359,036원', cost: '3,215,422원', prevCost: '3,015,212원', diff: '20만 210원' },
        4: { median: '6,494,738원', cost: '3,896,843원', prevCost: '3,658,664원', diff: '23만 8,179원' },
        5: { median: '7,556,719원', cost: '4,534,031원', prevCost: '4,264,902원', diff: '26만 9,129원' },
        6: { median: '8,574,383원', cost: '5,144,630원', prevCost: '4,838,907원', diff: '30만 5,723원' },
      };
      const d = data[size];
      return `📌 **결론**: 2026년 ${size}인 가구 기준 중위소득은 **${d.median}**, 법정 최저생계비(60%)는 **${d.cost}**입니다. (전년 대비 +${d.diff} 인상)\n\n🎯 **실전 멘트**: "고객님, 2026년 ${size}인 가구 법정 생계비는 월 ${d.cost}로 크게 올라서, 매달 법원에 갚으시는 변제금 부담이 그만큼 줄어듭니다."\n\n⚠️ **참고**: 소득이 있는 가족은 부양가족에서 제외되므로 실제 부양 여부를 사무장 인계장에 확인 기재해야 합니다.`;
    }
    if (lower.includes('대출') && lower.includes('최근')) {
      return `📌 **결론**: 최근 1~2달 사이 신규 대출이 70%로 과다한 경우에도 신청은 가능하지만, 사기죄 의심 및 기각 위험이 있어 1차에서 100% 된다고 단정하면 안 됩니다.\n\n🎯 **실전 멘트**: "고객님, 최근 대출이 많으실수록 독촉 압박이 더 크실 텐데요, 금융거래 내역을 법원에 합법적으로 소명하는 절차가 필수입니다. 전문 사무장님이 2차 통화 때 안전한 소명 플랜을 함께 세워드릴 테니 전화 꼭 받아주세요."\n\n⚠️ **참고**: 사무장 인계 메모에 '최근 대출 비중 70% 과다'를 명시하여 정밀 소명이 진행되도록 하세요.`;
    }
    if (lower.includes('배우자') || lower.includes('아파트') || lower.includes('청산가치')) {
      return `📌 **결론**: 신청자 본인 채무와 재산이 기준이나, 서울/수원/부산 외 지방법원은 배우자 순재산의 50%를 청산가치에 반영할 수 있습니다. (시세 5억, 담보 3억 시 순자산 2억의 50%인 약 1억 원 반영 가능)\n\n🎯 **실전 멘트**: "배우자분 명의 재산이 있으셔도 본인 회생 신청은 충분히 가능하십니다. 다만 법원별 반영 비율이 달라 전문 사무장님이 고객님께 가장 유리한 기준으로 변제금을 산출해 드립니다."\n\n⚠️ **참고**: 배우자 재산 유무와 담보대출 잔액을 인계장에 반드시 기재하세요.`;
    }
    if (lower.includes('신복위') || lower.includes('워크아웃')) {
      return `📌 **결론**: 신용회복위원회는 90일 연체 필수 및 원금 감면이 거의 없으나, 법원 개인회생은 연체 전에도 신청 가능하고 원금을 최대 90%까지 탕감받습니다.\n\n🎯 **실전 멘트**: "고객님, 신복위에서 수임료 100만 원 아끼시려다 원금 수천만 원을 다 갚으시는 것보다, 법원 개인회생으로 원금 5~6천만 원을 탕감받으시는 것이 결과적으로 훨씬 큰 이득이십니다."\n\n⚠️ **참고**: 1차에서 두 제도를 복잡하게 비교하지 말고, 회생의 압도적 원금 탕감 실익으로 접수 유도하세요.`;
    }
    return `📌 **결론**: 질문하신 "${q}" 관련하여 2026년 법정 기준 및 도산 실무준칙에 따라 접수 가능 여부와 예상 변제금을 검토할 수 있습니다.\n\n🎯 **실전 멘트**: "고객님의 월 실수령 소득과 부양가족 수에 맞춰 전문 사무장님이 2차 통화 때 1원 단위까지 정밀 산출해 드리겠습니다."\n\n⚠️ **참고**: 15대 필수 인계 서식을 누락 없이 수집하여 사무장에게 인계하세요.`;
  }
};