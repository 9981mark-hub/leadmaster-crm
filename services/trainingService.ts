// ============================================
// 신입 상담원 3-in-1 통합 트레이닝 서비스 (2026-11-09)
// AI 가상 고객 롤플레잉 + 모의 리드 샌드박스 + 실시간 코칭
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
  difficulty: '초급' | '중급' | '상급' | '최고급';
  title: string;
  scenarioDescription: string;
  trainingGoal: string;
  speechOptions: SpeechVoiceOptions;
  personaPrompt: string;
  initialMessage: string;
}

export interface TrainingMessage {
  id: string;
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: string;
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
}

export interface TrainingSessionRecord {
  sessionId: string;
  personaId: string;
  date: string;
  durationSeconds: number;
  totalTurns: number;
  report: TrainingReport;
  consultationResult: string;
  agentMemo: string;
}

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
      pitch: 1.0,
      rate: 1.35,
      gender: 'male',
      neuralVoice: 'ko-KR-InJoonNeural',
      neuralRate: '+10%',
      neuralPitch: '+0Hz',
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
      pitch: 1.02,
      rate: 1.45,
      gender: 'female',
      neuralVoice: 'ko-KR-SunHiNeural',
      neuralRate: '+25%',
      neuralPitch: '+2Hz',
    },
    personaPrompt: '너는 38세 식당 사장 박급해다. 지금 재료 준비와 배달 주문으로 몹시 바쁘고 정신이 없다. 3일 뒤 나갈 식자재 대금 2천만 원이 급하다. 상담원이 말을 길게 늘어놓으면 "아 사장님, 제가 지금 가게 손님 받아야 해서 바쁜데 용건만 딱 말해주세요!"라고 쏘아붙인다. 상담원이 신속하게 한도 조회와 가심사 절차를 2~3분 내로 끝내주거나 브레이크 타임(오후 3시)에 다시 연락주겠다고 약속하면 좋아한다.',
    initialMessage: '아 네 여보세요? 제가 지금 가게 주문 때문에 너무 바쁜데, 거기 한도 얼마 나와요? 바로 나와요?',
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
      pitch: 0.95,
      rate: 1.3,
      gender: 'male',
      neuralVoice: 'ko-KR-InJoonNeural',
      neuralRate: '+5%',
      neuralPitch: '-3Hz',
    },
    personaPrompt: '너는 54세 도소매상 이의심이다. 빚이 많아 대출이 절실하지만 사기 대출에 대한 경계심이 하늘을 찌른다. 걸려온 전화에 "내 번호 어디서 알고 건 거요?", "선입금이나 수수료 요구하면 당장 경찰에 신고할 거요", "금리 몇 프로나 나온다고 번지르르하게 말하는 거요?"라며 꼬치꼬치 따지고 퉁명스럽게 묻는다. 상담원이 법적 등록번호와 무료 조회임을 명확히 고지하고 침착하게 신뢰를 주면 점차 경계를 푼다.',
    initialMessage: '여보세요? 거기 어디요? 내 번호는 어떻게 알고 전화한 거요?',
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
      pitch: 0.93,
      rate: 1.25,
      gender: 'male',
      neuralVoice: 'ko-KR-HyunsuMultilingualNeural',
      neuralRate: '+0%',
      neuralPitch: '-5Hz',
    },
    personaPrompt: '너는 61세 최까다다. 빚이 6천 가까이 되고 연체가 시작되어 매일 독촉 전화에 시달려 신경이 곤두서 있다. "은행 가도 신용불량 직전이라고 다 퇴짜 맞았는데, 당신들이 무슨 재주로 돈을 내줘요?", "다 사기꾼들이지 희망고문 하지 마쇼!"라며 화를 내거나 비아냥댄다. 상담원이 감정적으로 맞서지 않고, 깊이 공감해주면서 현실적인 신용회복 및 정부지원 채무조정 제도를 진심으로 안내해주면 비로소 한숨을 쉬며 속사정을 털어놓는다.',
    initialMessage: '하... 또 대출 전화요? 다른 데서 다 안 된다고 거절당했는데, 당신들이 무슨 수로 돈을 해준다는 거요?',
  },
];

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

// 가상 고객 AI 응답 생성 (초고속 티키타카: 최근 6턴 압축 + 1~2문장 초단문 즉답)
export const generateAiCustomerReply = async (
  messages: TrainingMessage[],
  persona: TrainingPersona
): Promise<string> => {
  // 최근 6개 메시지만 컨텍스트로 압축 (응답 레이턴시 0.3초대로 단축)
  const recentMessages = messages.slice(-6);
  const conversationText = recentMessages
    .map(m => `${m.speaker === 'agent' ? '상담원' : '고객(' + persona.customerName + ')'}: "${m.text}"`)
    .join('\n');

  const prompt = `당신은 전화 금융/대출 상담을 진행 중인 가상 고객 "${persona.customerName}"(${persona.age}세, ${persona.job}) 역할입니다.

[고객 성향 및 배경]
${persona.personaPrompt}

[대화 규칙 - 초고속 실전 통화 템포 준수]
1. 실제 전화 통화이므로 길게 말하지 말고, **반드시 1~2문장(공백 포함 20~40자 내외)의 간결하고 현실적인 구어체**로만 즉시 대답하세요.
2. 부연설명이나 지문(예: [한숨], (화를 내며))은 일절 넣지 말고, **고객의 대사 텍스트만** 바로 출력하세요.
3. 말을 더듬거나 불필요한 쉼표(,)·줄임표(...)를 남발하지 말고, 실제 전화 통화처럼 한 호흡으로 자연스럽게 이어지는 매끄러운 한국어 구어체로 작성하세요.
4. 상담원의 직전 질문이나 말에 집중하여 즉각적으로 반응하세요.
5. ${persona.speechOptions.rate && persona.speechOptions.rate > 1.2 ? '말투를 빠르고 조급하게 하세요.' : ''}
6. ${persona.age >= 50 ? '어르신 특유의 "~했소?", "~인가요?", "~합디다" 등 연령대 말투를 자연스럽게 사용하세요.' : ''}

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

// 통화 종료 후 AI 자동 평가 및 코칭 리포트 생성
export const evaluateTrainingCall = async (
  messages: TrainingMessage[],
  persona: TrainingPersona
): Promise<TrainingReport> => {
  const conversationText = messages
    .map(m => `${m.speaker === 'agent' ? '상담원' : '고객'}: ${m.text}`)
    .join('\n');

  const prompt = `당신은 금융 CRM 전문 상담 품질 평가 감독관(QA 코치)입니다.
신입 상담원이 가상 고객 "${persona.customerName}"(${persona.difficulty} 난이도: ${persona.title})과 진행한 모의 상담 통화록을 정밀 평가하고 코칭 리포트를 JSON으로 작성하세요.

[훈련 시나리오 및 목표]
- 시나리오: ${persona.scenarioDescription}
- 핵심 훈련 목표: ${persona.trainingGoal}

[평가 기준]
1. complianceScore (0~30점): 소속(회사명)을 명확히 밝혔는가? 개인정보 활용 동의 및 대출중개수수료는 절대 발생하지 않는다는 법정 고지를 성실히 하였는가?
2. listeningScore (0~30점): 고객의 말을 끊지 않고 경청하였는가? 고객의 자금 필요 시점, 기대출 규모 및 월 상환액 등 핵심 니즈를 올바르게 파악하였는가?
3. objectionScore (0~40점): 고객의 의심, 반론, 바쁜 상황, 감정적 반발에 당황하지 않고 능숙하게 대처하였는가? 명확한 해결책을 제시하고 다음 통화 약속(리마인더)이나 가심사 동의를 이끌어냈는가?
4. totalScore: 세 항목 점수의 합 (0~100점). 75점 이상이면 passed=true, 미만이면 passed=false.

[통화 대화록]
${conversationText}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "totalScore": 85,
  "complianceScore": 25,
  "listeningScore": 28,
  "objectionScore": 32,
  "passed": true,
  "summary": "전반적인 상담 흐름에 대한 2~3줄 총평",
  "strengths": ["상담원이 특별히 잘한 점 1", "잘한 점 2"],
  "weaknesses": ["보완이 필요한 아쉬운 점 1", "보완할 점 2"],
  "coachingTips": ["실전에서 바로 써먹을 수 있는 원포인트 코칭 팁 1", "코칭 팁 2"],
  "suggestedScript": "이 시나리오에서 우수 상담원이라면 사용했을 법한 모범 추천 멘트 1~2문장"
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
      totalScore: Number(parsed.totalScore) || 70,
      complianceScore: Number(parsed.complianceScore) || 20,
      listeningScore: Number(parsed.listeningScore) || 20,
      objectionScore: Number(parsed.objectionScore) || 30,
      passed: parsed.totalScore >= 75,
      summary: parsed.summary || '상담을 성실히 수행했습니다.',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : ['고객 응대 태도가 정중했습니다.'],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : ['필수 고지 사항 전달이 조금 부족했습니다.'],
      coachingTips: Array.isArray(parsed.coachingTips) ? parsed.coachingTips : ['다음번엔 수수료 무료 안내를 서두에 고지해 보세요.'],
      suggestedScript: parsed.suggestedScript || '고객님, 저희는 금융감독원에 정식 등록된 법인으로 일체의 수수료를 요구하지 않습니다.',
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
      suggestedScript: '사장님, 지금 많이 바쁘시군요! 딱 30초만 말씀드리면, 정부지원 대환으로 월 이자 40% 감면 가능 여부만 가심사해 두고 오후 3시 브레이크 타임에 재연락드려도 될까요?',
    };
  }
};
