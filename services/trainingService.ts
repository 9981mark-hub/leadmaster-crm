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

// 트레이닝 영업 모드: 일반 콜드콜(아웃바운드) vs 광고 신청 인바운드 리드
export type TrainingMode = 'cold_call' | 'inbound_lead';

// 광고 유입 온라인 상담신청서 (인바운드 리드) 상세 데이터
export interface InboundAdLeadContext {
  channel: 'instagram' | 'facebook' | 'youtube' | 'naver' | 'blind' | 'kakao';
  channelLabel: string; // 예: "인스타그램 광고"
  channelBadgeColor: string; // 예: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20"
  campaignName: string; // 예: "2026 개인회생 탕감율 무료 자가진단"
  appliedAt: string;    // 예: "방금 전 (약 3분 전)"
  customerName: string;
  customerAge: number;
  customerPhone: string;
  declaredDebt: string; // 고객 입력 채무 (예: "약 7,500만 원 (카드론 3건, 저축은행 2건, 대부업 1건)")
  delinquencyStatus: string; // 연체 상태 (예: "25일째 연체 중 (추심 독촉 전화 빗발침)")
  incomeAndJob: string;      // 소득/직업 (예: "중소기업 제조업 정규직 (실수령 약 280만 원)")
  inquiryNote: string;       // 고객 남김말
}

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
  mode?: TrainingMode;
  leadContext?: InboundAdLeadContext;
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
  grade?: 'S' | 'A' | 'B' | 'C' | 'D' | 'F'; // 실전 6단계 평가 등급
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
  /** 소속 팀명 (직급별/팀별 관제용) */
  teamName?: string;
  /** 훈련한 사람 (auth user id) — 회사 서버 기록에서 사람별로 나눌 때 씀 */
  userId?: string;
  fullTranscript?: TrainingMessage[];
  adminFeedback?: AdminFeedback;
}

// ============================================
// 회사별·관리자별 맞춤형 훈련 정책 및 듀얼 브랜딩 설정 (Company Training Config)
// 아웃바운드 TM(사칭 방지/지원센터) vs 인바운드 리드(법무법인/광고신청) 분리 지원
// ============================================

export interface OutboundTrainingConfig {
  orgName: string;            // 소속 기관/센터명 (예: 채무조정 지원센터, 서민금융 지원본부)
  roleTitle: string;          // 직책/호칭 (예: 팀장, 수석팀장, 과장)
  sourceText: string;         // 출처 소명 문구 (예: 온라인 제휴 안심 자가진단 이력)
  openingScript: string;      // 표준 첫인사 템플릿
  quickOpeningScript: string; // 10초 바쁜 고객용 퀵 오프닝
  closingHandoverScript?: string; // 7대 문진 완료 후 제휴 법무법인 사무장 인계 브릿지 멘트
}

export interface InboundTrainingConfig {
  companyName: string;        // 공식 법인명 (예: 법무법인 신안)
  departmentName: string;     // 담당 부서명 (예: 회생파산 종합지원센터)
  roleTitle: string;          // 직책/호칭 (예: 전담 상담원, 선임 상담관)
  leadChannelName: string;    // 인입 채널명 (예: 온라인 무료 안심 자가진단)
  openingScript: string;      // 표준 첫인사 템플릿
  quickOpeningScript: string; // 10초 퀵 오프닝
}

export interface CompanyTrainingConfig {
  // 📞 1. 아웃바운드 (콜드콜/외부DB) 전용
  outbound: OutboundTrainingConfig;

  // 📋 2. 인바운드 (광고신청/Warm Lead) 전용
  inbound: InboundTrainingConfig;

  // 공통 환경 및 컴플라이언스
  representativePhone: string;  // 공식 대표번호 (예: 1588-4920, 02-588-7119)
  requiredKeywords: string[];   // 필수 포함 키워드 (미언급 시 감점)
  bannedKeywords: string[];     // 엄격 금지어 (과장광고 방지)
  customQuestions: string[];    // 회사별 추가 문진 항목
  usePhoneFilter?: boolean;     // [대표 전용] 전사 스마트폰 수화기 대역 주파수(300~3400Hz) 필터 강제 적용 (기본 true)

  // 레거시 호환 필드 (하위 호환 보장)
  companyName?: string;
  departmentName?: string;
  leadChannelName?: string;
  standardOpening?: string;
  quickOpening?: string;
}

export const PRESETS_CONFIG: Record<string, { label: string; desc: string; config: CompanyTrainingConfig }> = {
  outbound_agency: {
    label: '🏢 독립 아웃바운드 TM 대행사 (추천)',
    desc: '변호사법 사칭 방지! "채무조정 지원센터 OOO 팀장" 표준 + 제휴 DB 출처 소명',
    config: {
      outbound: {
        orgName: '채무조정 지원센터',
        roleTitle: '팀장',
        sourceText: '온라인 제휴 안심 자가진단 이력',
        openingScript: '안녕하십니까, {고객명} 고객님! {소속명}의 {상담원명} {직책}입니다. 일전에 안심 금융 조회하셨던 이력 관련하여 정부/법원 채무 감면 혜택 대상자 무료 가심사차 연락드렸습니다. 지금 2분 정도 통화 괜찮으실까요?',
        quickOpeningScript: '바쁘신 시간 죄송합니다, 고객님! {소속명} {직책}입니다. 감면 적격 조건만 30초 내로 확인해 드리고 편하신 시간대로 다시 연락드리겠습니다!',
        closingHandoverScript: '고객님, 1차 지원센터 가심사 결과 조건에 적격하셔서, 사건을 전담해 주실 제휴 법원 도산 전문 수석 사무장님께 직통 배정해 드리겠습니다.',
      },
      inbound: {
        companyName: '채무조정 안심접수처',
        departmentName: '1차 심사과',
        roleTitle: '전담 상담원',
        leadChannelName: '온라인 자가진단 신청건',
        openingScript: '안녕하세요, {고객명} 고객님 맞으실까요? 방금 신청 남겨주신 [{회사명} 개인회생 자격진단] 건으로 신속히 도움드리고자 연락드렸습니다. 지금 통화 가능하실까요?',
        quickOpeningScript: '안녕하세요, 고객님! 신청하신 무료 진단 건으로 30초만 일정 확인차 연락드렸습니다.',
      },
      representativePhone: '1588-4920',
      requiredKeywords: ['비밀 보장', '취소 수수료 없음', '정부/법원 채무조정'],
      bannedKeywords: ['100% 무조건 승인', '전액 탕감 보장', '불법 수수료', '작업대출'],
      customQuestions: ['최근 1년 내 신규 대출 발생 여부', '배우자 명의 재산 유무'],
      usePhoneFilter: true,
      companyName: '채무조정 지원센터',
      departmentName: '상담1팀',
      leadChannelName: '온라인 제휴 안심 자가진단',
      standardOpening: '안녕하십니까, {고객명} 고객님! {소속명}의 {상담원명} {직책}입니다. 일전에 안심 금융 조회하셨던 이력 관련하여 정부/법원 채무 감면 혜택 대상자 무료 가심사차 연락드렸습니다. 지금 2분 정도 통화 괜찮으실까요?',
      quickOpening: '바쁘신 시간 죄송합니다, 고객님! {소속명} {직책}입니다. 감면 적격 조건만 30초 내로 확인해 드리고 편하신 시간대로 다시 연락드리겠습니다!',
    },
  },
  legal: {
    label: '⚖️ 법무법인 직영 콜센터',
    desc: '개인회생·파산 법률사무소 표준 (법원 정식 접수, 비밀보장, 광고 신청건)',
    config: {
      outbound: {
        orgName: '법무법인 신안 지원센터',
        roleTitle: '상담팀장',
        sourceText: '법무법인 안심 금융조회 제휴망',
        openingScript: '안녕하십니까, {고객명} 고객님! {소속명}의 {상담원명} {직책}입니다. 일전에 제휴 채널에서 조회해주신 법원 채무 감면 혜택 무료 심사차 연락드렸습니다.',
        quickOpeningScript: '고객님, 바쁘시죠! {소속명}입니다. 30초만 감면 요건 체크해 드리고 편하신 시간에 다시 연락드리겠습니다.',
        closingHandoverScript: '고객님, 가심사 결과 개인회생 신청 요건에 충분히 부합하셔서 담당 수석 사무장님께 사건을 즉시 인계해 드리겠습니다.',
      },
      inbound: {
        companyName: '법무법인 신안',
        departmentName: '회생파산 종합지원센터',
        roleTitle: '전담 상담원',
        leadChannelName: '온라인 무료 안심 자가진단',
        openingScript: '안녕하세요, {고객명} 고객님 맞으실까요? 방금 {인입채널}에서 신청 남겨주신 [{회사명} 개인회생 무료 자격진단] 건으로 신속히 도움드리고자 연락드렸습니다. 지금 2분 정도 통화 괜찮으실까요?',
        quickOpeningScript: '바쁘신 시간 죄송합니다, 고객님! 방금 신청해주신 {회사명} 무료 자격진단 건으로 30초만 일정 확인차 연락드렸습니다!',
      },
      representativePhone: '02-588-7119',
      requiredKeywords: ['비밀 보장', '취소 수수료 없음', '법원 접수'],
      bannedKeywords: ['100% 무조건 승인', '전액 탕감 보장', '불법 수수료'],
      customQuestions: ['최근 1년 내 신규 대출 발생 여부', '배우자 명의 재산 유무'],
      usePhoneFilter: true,
      companyName: '법무법인 신안',
      departmentName: '회생파산 종합지원센터',
      leadChannelName: '온라인 무료 안심 자가진단',
      standardOpening: '안녕하십니까, {고객명} 고객님! {회사명} {부서명}의 {상담원명} 상담원입니다. 일전에 신청해주신 {인입채널} 관련하여 법원 감면 혜택 가심사차 연락드렸습니다. 지금 2분 정도 통화 괜찮으실까요?',
      quickOpening: '바쁘신 시간 죄송합니다, 고객님! {회사명}입니다. 신청하신 서류 조건만 30초 내로 정리해 드리고 편하신 시간대로 다시 전화드리겠습니다!',
    },
  },
  hybrid: {
    label: '🤝 하이브리드 파트너사',
    desc: '지원센터 1차 스크리닝 후 제휴 법무법인 수석 사무장으로 직통 인계',
    config: {
      outbound: {
        orgName: '서민금융 채무조정 지원본부',
        roleTitle: '수석팀장',
        sourceText: '서민금융 안심 자가진단 제휴망',
        openingScript: '안녕하십니까, {고객명} 고객님! {소속명}의 {상담원명} {직책}입니다. 정부/법원 채무조정 지원 대상자로 매칭되셔서 무료 감면율 가심사차 연락드렸습니다. 지금 2분 정도 통화 괜찮으실까요?',
        quickOpeningScript: '바쁘신 중 실례합니다! {소속명}입니다. 감면 적격 여부만 30초 확인해 드리고 다시 전화드릴까요?',
        closingHandoverScript: '고객님, 기본 문진 결과 원금 최대 90% 탕감 대상자로 확인되셨습니다. 서류 접수와 법원 금지명령을 직접 총괄해주실 제휴 법무법인 수석 사무장님 직통으로 바로 연결해 드리겠습니다.',
      },
      inbound: {
        companyName: '제휴 법률지원 상담팀',
        departmentName: '1차 심사과',
        roleTitle: '선임상담원',
        leadChannelName: '포털 안심 무료상담 신청건',
        openingScript: '안녕하세요, {고객명} 고객님! 남겨주신 [{회사명}] 채무조정 가심사 신청서 확인되어 연락드렸습니다. 지금 통화 가능하신가요?',
        quickOpeningScript: '고객님, 남겨주신 신청서 확인차 30초만 시간 괜찮으실까요?',
      },
      representativePhone: '02-588-7119',
      requiredKeywords: ['비밀 보장', '취소 수수료 없음', '수석 사무장 배정'],
      bannedKeywords: ['100% 무조건 승인', '전액 탕감 보장', '선입금 요구'],
      customQuestions: ['기존 채무 연체 여부', '가족 및 직장 비밀보장 희망 여부'],
      usePhoneFilter: true,
      companyName: '서민금융 채무조정 지원본부',
      departmentName: '제휴상담팀',
      leadChannelName: '서민금융 안심 자가진단',
      standardOpening: '안녕하십니까, {고객명} 고객님! {소속명}의 {상담원명} {직책}입니다. 정부/법원 채무조정 지원 대상자로 매칭되셔서 연락드렸습니다.',
      quickOpening: '고객님, {소속명}입니다. 30초만 감면 적격 확인 후 다시 연락드리겠습니다.',
    },
  },
  loan: {
    label: '💳 서민금융 대환대출 전문',
    desc: '중금리·고금리 대환 및 금융컨설팅 표준 (금감원 등록, 이자 절감)',
    config: {
      outbound: {
        orgName: '서민금융 파트너스 지원센터',
        roleTitle: '과장',
        sourceText: '금융 마이데이터 제휴 안심조회',
        openingScript: '안녕하십니까, {고객명} 고객님! {소속명}의 {상담원명} {직책}입니다. 일전에 조회해주신 고금리 대환 및 채무통합 지원 대상자 가심사 결과 안내차 연락드렸습니다.',
        quickOpeningScript: '고객님, 많이 바쁘신가요? 30초만 대환 한도 확인해 드리고 오후 브레이크 타임에 재연락드릴까요?',
        closingHandoverScript: '고객님, 1차 진단 결과 이자 절감 및 원금 감면 플랜에 적격하셔서 금융 전문 위원님께 직통 연결해 드리겠습니다.',
      },
      inbound: {
        companyName: '서민금융 파트너스',
        departmentName: '안심대환 상담팀',
        roleTitle: '선임상담원',
        leadChannelName: '정부지원 안심대환 간편조회',
        openingScript: '안녕하세요, {고객명} 고객님! 일전에 조회해주신 [{회사명} {인입채널}] 신청 건으로 가심사 결과 안내차 연락드렸습니다.',
        quickOpeningScript: '고객님, 신청해주신 대환 조회 건으로 30초만 확인 연락드렸습니다.',
      },
      representativePhone: '1588-4920',
      requiredKeywords: ['대출중개수수료 무료', '정식 등록 법인', '신용점수 영향 없음'],
      bannedKeywords: ['작업대출', '선입금 요구', '무조건 100% 한도'],
      customQuestions: ['기존 대출 금리대 (15% 이상 여부)', '월 소득 대비 상환액'],
      usePhoneFilter: true,
      companyName: '서민금융 파트너스',
      departmentName: '안심대환 상담팀',
      leadChannelName: '정부지원 안심대환 간편조회',
      standardOpening: '안녕하십니까, {고객명} 고객님! {회사명} {부서명}의 {상담원명}입니다. 일전에 조회해주신 {인입채널} 신청 건으로 금리 인하 가심사 결과 안내차 연락드렸습니다.',
      quickOpening: '고객님, 지금 많이 바쁘신가요? {회사명}입니다! 30초만 대환 한도 확인해 드리고 오후 브레이크 타임에 재연락드릴까요?',
    },
  },
};

export const DEFAULT_TRAINING_CONFIG: CompanyTrainingConfig = PRESETS_CONFIG.outbound_agency.config;

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
  const orgName = loadCachedOrg()?.orgName;
  const base: CompanyTrainingConfig = JSON.parse(JSON.stringify(DEFAULT_TRAINING_CONFIG));
  if (orgName && orgName !== '리드마스터 CRM' && orgName !== '리드마스터 본사') {
    base.inbound.companyName = orgName;
    base.companyName = orgName;
  }
  if (!v || typeof v !== 'object') return base;

  // 하위 호환 및 듀얼 브랜딩 머지
  const merged: CompanyTrainingConfig = {
    ...base,
    ...v,
    outbound: {
      ...base.outbound,
      ...(v.outbound || {}),
    },
    inbound: {
      ...base.inbound,
      ...(v.inbound || {}),
    },
  };
  return merged;
};

/** 서버에서 훈련 설정 확인 */
export const loadCompanyTrainingConfig = async (): Promise<CompanyTrainingConfig> => {
  const v = await loadOrgStore(TRAINING_CONFIG_SPEC);
  const orgName = loadCachedOrg()?.orgName;
  const base: CompanyTrainingConfig = JSON.parse(JSON.stringify(DEFAULT_TRAINING_CONFIG));
  if (orgName && orgName !== '리드마스터 CRM' && orgName !== '리드마스터 본사') {
    base.inbound.companyName = orgName;
    base.companyName = orgName;
  }
  if (!v || typeof v !== 'object') return base;

  const merged: CompanyTrainingConfig = {
    ...base,
    ...v,
    outbound: {
      ...base.outbound,
      ...(v.outbound || {}),
    },
    inbound: {
      ...base.inbound,
      ...(v.inbound || {}),
    },
  };
  return merged;
};

// 관리자 훈련 설정 저장. 실패하면 한국어 오류 문구를 돌려준다(성공 = null).
export const saveCompanyTrainingConfig = async (config: CompanyTrainingConfig): Promise<string | null> => {
  const res = await mutateOrgStore(TRAINING_CONFIG_SPEC, () => ({ ...config }));
  return res.ok ? null : res.error;
};

// 템플릿 변수 동적 치환 함수 (아웃바운드 vs 인바운드 모드 완벽 분기)
export const interpolateOpeningScript = (
  template: string,
  config: CompanyTrainingConfig,
  agentName: string = '상담원',
  customerName: string = '고객님',
  mode: 'cold_call' | 'inbound_lead' = 'cold_call'
): string => {
  if (!template) return '';
  const isOutbound = mode === 'cold_call';
  const orgName = isOutbound
    ? (config.outbound?.orgName || config.companyName || '채무조정 지원센터')
    : (config.inbound?.companyName || config.companyName || '법무법인');
  const roleTitle = isOutbound
    ? (config.outbound?.roleTitle || '팀장')
    : (config.inbound?.roleTitle || '상담원');
  const deptName = isOutbound
    ? ''
    : (config.inbound?.departmentName || config.departmentName || '상담센터');
  const sourceOrChannel = isOutbound
    ? (config.outbound?.sourceText || '온라인 제휴 안심 자가진단 이력')
    : (config.inbound?.leadChannelName || config.leadChannelName || '온라인 무료 안심 자가진단');

  return template
    .replace(/\{소속명\}/g, orgName)
    .replace(/\{회사명\}/g, orgName)
    .replace(/\{직책\}/g, roleTitle)
    .replace(/\{부서명\}/g, deptName)
    .replace(/\{상담원명\}/g, agentName)
    .replace(/\{인입채널\}/g, sourceOrChannel)
    .replace(/\{출처\}/g, sourceOrChannel)
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

// 6대 광고신청 인바운드리드 특화 카테고리 정의
export type InboundCategoryId =
  | 'inbound_cat_ad_doubt'
  | 'inbound_cat_fee_compare'
  | 'inbound_cat_investment_anxiety'
  | 'inbound_cat_privacy_secret'
  | 'inbound_cat_urgent_collection'
  | 'inbound_cat_qualification_only';

export interface InboundCategoryInfo {
  id: InboundCategoryId;
  title: string;
  subtitle: string;
  badge: string;
  icon: string;
  description: string;
  coreGoal: string;
  recommendedVoice: string;
}

export const INBOUND_CATEGORIES: InboundCategoryInfo[] = [
  {
    id: 'inbound_cat_ad_doubt',
    title: '광고 기대치 검증형',
    subtitle: '"광고에선 90% 다 탕감해준다더니 진짜인가요? 낚시 아니죠?"',
    badge: '🎯 광고검증',
    icon: 'Sparkles',
    description: '인스타그램/페이스북 자가진단 광고를 보고 기대감 반 의심 반으로 신청한 고객',
    coreGoal: '섣부른 확답 금지, 법정 최저생계비와 가용소득 원리로 현실적 기대치 형성 및 신뢰 구축',
    recommendedVoice: 'ko-KR-InJoonNeural',
  },
  {
    id: 'inbound_cat_fee_compare',
    title: '수임료·비용 최우선 비교형',
    subtitle: '"다른 데도 알아보고 있거든요? 거긴 얼마라던데 여긴 수임료 얼마예요?"',
    badge: '💰 비용비교',
    icon: 'BadgePercent',
    description: '네이버 파워링크 검색으로 2~3곳에 동시 신청해 가격부터 떠보는 깐깐한 비교 고객',
    coreGoal: '가격부터 말하지 않고, 100% 기각 시 환불 보장제 및 무이자 분납 안내로 사건 관리 가치 입증',
    recommendedVoice: 'ko-KR-SunHiNeural',
  },
  {
    id: 'inbound_cat_investment_anxiety',
    title: '주식·코인·도박 불안형',
    subtitle: '"블라인드 보고 신청했는데 코인 선물 빚도 진짜 기각 안 되고 돼요?"',
    badge: '📉 투자/불안',
    icon: 'AlertCircle',
    description: '커뮤니티 배너를 보고 신청했으나 인터넷에서 본 기각 루머 때문에 불안에 떠는 고객',
    coreGoal: '서울회생법원 준칙 제408호(손실금 청산가치 제외) 및 맞춤 소명 노하우로 기각 공포 불식',
    recommendedVoice: 'ko-KR-InJoonNeural',
  },
  {
    id: 'inbound_cat_privacy_secret',
    title: '가족·직장 극비 보장형',
    subtitle: '"와이프랑 회사에 절대 알리면 안 돼요. 법원 우편물 오면 저 이혼당합니다"',
    badge: '🔒 극비보장',
    icon: 'Lock',
    description: '가족 몰래 생긴 빚이라 신분 노출 시 가정이 파탄 날 위기에 처한 절박한 고객',
    coreGoal: '송달장소를 법무법인 사무실로 지정하여 자택/직장 우편물 100% 원천 차단 확약',
    recommendedVoice: 'ko-KR-SunHiNeural',
  },
  {
    id: 'inbound_cat_urgent_collection',
    title: '당일 독촉·압류 공황형',
    subtitle: '"오늘 당장 통장 압류 들어온다고 문자 왔어요! 오늘 당장 막아줄 수 있어요?!"',
    badge: '🚨 긴급독촉',
    icon: 'AlertTriangle',
    description: '유튜브 숏츠를 보고 당일 압류 독촉에 패닉 상태로 급히 신청서를 남긴 고객',
    coreGoal: '금지명령 및 채무자대리인 제도로 즉시 추심 차단 가능함을 알리고 패스트트랙 접수 안내',
    recommendedVoice: 'ko-KR-InJoonNeural',
  },
  {
    id: 'inbound_cat_qualification_only',
    title: '자격만 간보기형',
    subtitle: '"사무장 상담이고 뭐고, 내 조건에서 되는지만 딱 30초 안에 말해요"',
    badge: '⚡ 자격간보기',
    icon: 'Zap',
    description: '카카오 비즈보드로 가볍게 신청해 바쁘다며 꼬치꼬치 묻는 것을 거부하는 고객',
    coreGoal: '정중한 주도권 장악: 잘못된 안내 방지를 위해 법원이 보는 핵심 2가지만 30초 내 확인',
    recommendedVoice: 'ko-KR-InJoonNeural',
  },
];

// 인바운드 광고신청건 전용 7대 문진 체크리스트 인터페이스
export interface InboundParalegalChecklist {
  leadConfirmation: boolean;       // 1. 광고 신청 내역 및 본인 확인
  expectationAnchoring: boolean;   // 2. 광고 기대치 현실화 (법정 원리 설명)
  debtAndOverdue: boolean;         // 3. 총 채무액 및 연체 팩트체크
  incomeAndJob: boolean;           // 4. 직업 및 실수령 소득 파악
  assetsAndDeposit: boolean;       // 5. 재산/보증금/배우자 청산가치
  privacyAssurance: boolean;       // 6. 비밀보장 및 우편물 대리수령 확약
  paralegalClosing: boolean;       // 7. 수석 사무장 심층 상담/방문 예약 클로징
}

export const INBOUND_PARALEGAL_QUESTIONS: { key: keyof InboundParalegalChecklist; label: string; desc: string }[] = [
  { key: 'leadConfirmation', label: '1. 신청 리드 및 본인 확인', desc: '유입 채널 및 온라인 자가진단 신청 맥락 정확히 언급' },
  { key: 'expectationAnchoring', label: '2. 광고 기대치 현실화', desc: '무조건 90% 확답 금지, 법정 생계비 원리로 신뢰 형성' },
  { key: 'debtAndOverdue', label: '3. 총 채무액 및 연체 팩트체크', desc: '신청서 기재 채무 외 카드론/대부/사채 추가 내역 확인' },
  { key: 'incomeAndJob', label: '4. 직업 및 실수령 소득 파악', desc: '4대보험 유무, 최근 3개월 평균 실수령 소득 확인' },
  { key: 'assetsAndDeposit', label: '5. 재산 및 청산가치 파악', desc: '주거형태(보증금 공제한도), 차량, 배우자 재산 확인' },
  { key: 'privacyAssurance', label: '6. 가족·직장 비밀보장 확약', desc: '우편물 송달지 법무법인 지정으로 100% 비밀 안내' },
  { key: 'paralegalClosing', label: '7. 수석 사무장 심층 상담 예약', desc: '예상 변제금 정밀 시뮬레이션을 위한 30분 내 사무장 인계 클로징' },
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
    behaviorType: 'gentle',
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
    behaviorType: 'bottom_liner',
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
    behaviorType: 'cold_skeptic',
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
    behaviorType: 'despairing',
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

// 6대 광고신청 인바운드 리드 전용 페르소나 생성기
export const generateInboundLeadPersona = (categoryId: InboundCategoryId): TrainingPersona => {
  const timestamp = Date.now();

  switch (categoryId) {
    case 'inbound_cat_ad_doubt': {
      const leadContext: InboundAdLeadContext = {
        channel: 'instagram',
        channelLabel: '인스타그램 광고',
        channelBadgeColor: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30',
        campaignName: '2026 개인회생 탕감율 무료 자가진단 (Meta Ads)',
        appliedAt: '방금 전 (약 3분 전)',
        customerName: '김태호',
        customerAge: 38,
        customerPhone: '010-8921-3482',
        declaredDebt: '약 7,500만 원 (카드론 3건, 저축은행 2건, 대부업 1건)',
        delinquencyStatus: '25일째 연체 중 (추심 독촉 전화 빗발침)',
        incomeAndJob: '중소 제조업 정규직 (실수령 약 280만 원)',
        inquiryNote: '이번 달 카드값 막을 길이 없습니다. 급여 압류 들어온다는데 진짜 해결 가능한가요?',
      };
      return {
        id: `inbound_${categoryId}_${timestamp}`,
        level: 3,
        badge: '🎯 광고기대치 검증',
        customerName: leadContext.customerName,
        age: leadContext.customerAge,
        gender: 'male',
        phone: leadContext.customerPhone,
        job: leadContext.incomeAndJob,
        salary: '월 실수령 280만 원',
        debtSummary: leadContext.declaredDebt,
        housing: '월세 (보증금 1,000만 원 / 월 55만 원)',
        difficulty: '중급',
        title: '인스타 90% 탕감 광고를 보고 과장/낚시를 의심하는 고객',
        scenarioDescription: '인스타그램 자가진단 광고를 보고 직접 신청했으나, "진짜 90% 다 깎아주는 거 맞냐, 낚시 광고 아니냐"며 탕감율 확답을 요구합니다.',
        trainingGoal: '섣부른 탕감 확답 금지, 법정 최저생계비와 가용소득 원리로 현실적 기대치 형성 및 신뢰 구축',
        speechOptions: {
          pitch: 0.75,
          rate: 1.05,
          gender: 'male',
          neuralVoice: 'ko-KR-InJoonNeural',
          neuralRate: '+3%',
          neuralPitch: '-4Hz',
        },
        mode: 'inbound_lead',
        leadContext,
        outboundChannelType: 'inbound_ad',
        personaPrompt: `너는 38세 남성 ${leadContext.customerName}이다. 인스타그램에서 "내 빚 최대 90% 탕감" 광고를 보고 방금 자가진단 신청서를 제출했다. 모르는 번호로 전화가 와서 "여보세요? 방금 인스타에서 빚 탕감 진단 신청했는데요. 광고 보니까 빚 90% 다 깎아준다던데 저도 진짜 그렇게 되나요? 낚시 광고 아니죠?"라고 직설적으로 묻는다. 상담원이 "무조건 90% 다 탕감됩니다"라고 거짓 장담하면 "사기꾼 아니냐"며 더 의심하고, 반대로 "그건 광고고 실제로는 얼마 안 돼요"라고 찬물을 끼얹으면 실망해서 전화를 끊으려 한다. 상담원이 "법원에서 인정하는 최저생계비를 제외한 가용소득으로 변제금이 산정되기 때문에 고객님 조건에 따라 최대 90%까지 가능한 것이며, 고객님의 정확한 변제금 산출을 위해 몇 가지만 확인해 드리겠습니다"라고 법적 원리를 차분하게 설명하면 비로소 고개를 끄덕이며 협조한다.`,
        initialMessage: `여보세요? 방금 인스타에서 빚 탕감 진단 신청했는데요. 광고 보니까 빚 90% 다 깎아준다던데 저도 진짜 그렇게 되나요? 낚시 광고 아니죠?`,
      };
    }

    case 'inbound_cat_fee_compare': {
      const leadContext: InboundAdLeadContext = {
        channel: 'naver',
        channelLabel: '네이버 파워링크 검색',
        channelBadgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        campaignName: '개인회생 수임료 분납 지원 센터 (파워링크)',
        appliedAt: '약 7분 전',
        customerName: '이수진',
        customerAge: 32,
        customerPhone: '010-4712-9081',
        declaredDebt: '신용대출 2건, 마이너스통장 1건 합산 4,200만 원',
        delinquencyStatus: '연체 직전 (이번 달 돌려막기 불가)',
        incomeAndJob: 'IT 스타트업 마케터 (실수령 약 250만 원)',
        inquiryNote: '다른 곳도 상담 신청해 뒀습니다. 수임료 얼마인지와 분납 개월 수 알려주세요.',
      };
      return {
        id: `inbound_${categoryId}_${timestamp}`,
        level: 3,
        badge: '💰 수임료 가격비교',
        customerName: leadContext.customerName,
        age: leadContext.customerAge,
        gender: 'female',
        phone: leadContext.customerPhone,
        job: leadContext.incomeAndJob,
        salary: '월 실수령 250만 원',
        debtSummary: leadContext.declaredDebt,
        housing: '전세 (보증금 8,000만 원 / 청년전세대출 6,000만 원)',
        difficulty: '상급',
        title: '타사 3곳에 동시 신청해 수임료부터 떠보는 깐깐한 직장인',
        scenarioDescription: '네이버 파워링크로 여러 곳에 동시 신청해 방금 전에도 타사와 통화했습니다. 수임료 금액부터 단도직입적으로 캐묻습니다.',
        trainingGoal: '가격부터 말하지 않고, 100% 기각 시 환불 보장제 및 무이자 분납 안내로 사건 관리 가치 입증',
        speechOptions: {
          pitch: 0.95,
          rate: 1.10,
          gender: 'female',
          neuralVoice: 'ko-KR-SunHiNeural',
          neuralRate: '+8%',
          neuralPitch: '-2Hz',
        },
        mode: 'inbound_lead',
        leadContext,
        outboundChannelType: 'inbound_ad',
        personaPrompt: `너는 32세 여성 ${leadContext.customerName}이다. 네이버 검색으로 법무법인 세 곳에 동시에 상담 신청서를 남겼고, 방금 다른 법무법인 한 곳과 통화하고 나서 전화를 받았다. 전화를 받고 "여보세요? 저 네이버에서 보고 상담 신청 남겼는데요, 솔직히 다른 법무법인에도 신청해놔서 방금 통화했거든요. 거긴 수임료 150 부르던데 여긴 수임료 얼마예요? 몇 개월 분납 돼요?"라고 가격을 먼저 묻는다. 상담원이 덜컥 금액만 부르면 "네, 다른 데랑 비교해보고 연락드릴게요"하고 바로 끊으려 한다. 반면 상담원이 "고객님, 수임료만 비교하시다가 사건이 기각되면 그 비용을 전부 날리게 됩니다. 저희는 기각 시 100% 전액 환불 보장제와 무이자 6개월 분납을 지원하고 있으며, 무엇보다 고객님의 통장 압류를 가장 빠르게 막아드리는 것이 핵심입니다"라며 법무법인의 전문성과 안전장치(기각보상제)를 짚어주면 귀를 기울이며 상담에 응한다.`,
        initialMessage: `여보세요? 저 네이버에서 보고 상담 신청 남겼는데요, 솔직히 다른 법무법인에도 신청해놔서 방금 통화했거든요. 거긴 수임료 150 부르던데 여긴 수임료 얼마예요? 몇 개월 분납 돼요?`,
      };
    }

    case 'inbound_cat_investment_anxiety': {
      const leadContext: InboundAdLeadContext = {
        channel: 'blind',
        channelLabel: '블라인드 직장인 배너 광고',
        channelBadgeColor: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
        campaignName: '직장인 주식·코인 투자 채무 탕감 솔루션',
        appliedAt: '약 12분 전',
        customerName: '박성민',
        customerAge: 41,
        customerPhone: '010-3819-7724',
        declaredDebt: '코인 선물거래 및 신용대출 합산 6,800만 원',
        delinquencyStatus: '연체 10일째 (사금융 독촉 문자 시작)',
        incomeAndJob: '대기업 계열사 사무직 (실수령 약 360만 원)',
        inquiryNote: '코인 선물하다가 빚졌는데 인터넷 보니까 투자 실패는 기각된다던데 진짜 신청 가능한가요?',
      };
      return {
        id: `inbound_${categoryId}_${timestamp}`,
        level: 4,
        badge: '📉 투자빚 기각불안',
        customerName: leadContext.customerName,
        age: leadContext.customerAge,
        gender: 'male',
        phone: leadContext.customerPhone,
        job: leadContext.incomeAndJob,
        salary: '월 실수령 360만 원',
        debtSummary: leadContext.declaredDebt,
        housing: '자가 아파트 (시세 4억 / 주담대 3억)',
        difficulty: '상급',
        title: '코인·주식 투자 실패 빚으로 법원 기각을 극도로 두려워하는 고객',
        scenarioDescription: '블라인드 배너를 보고 신청했으나, 인터넷에서 본 "주식/코인은 무조건 기각된다"는 글 때문에 죄책감과 공포에 사로잡혀 있습니다.',
        trainingGoal: '서울회생법원 준칙 제408호(손실금 청산가치 제외) 및 맞춤 소명 노하우로 기각 공포 불식',
        speechOptions: {
          pitch: 0.70,
          rate: 1.0,
          gender: 'male',
          neuralVoice: 'ko-KR-InJoonNeural',
          neuralRate: '+0%',
          neuralPitch: '-6Hz',
        },
        mode: 'inbound_lead',
        leadContext,
        outboundChannelType: 'inbound_ad',
        personaPrompt: `너는 41세 남성 ${leadContext.customerName}이다. 대기업에 다니지만 코인 선물거래에 손을 댔다가 6,800만 원의 빚을 졌다. 인터넷 커뮤니티에서 "투자 빚은 법원에서 괘씸죄로 100% 기각당한다"는 글을 보고 패닉 상태에서 블라인드 배너 광고를 보고 신청했다. 전화를 받고 "여보세요... 제가 블라인드에서 보고 신청했는데요, 제가 코인 선물거래 하다가 빚이 6천 생겼거든요. 인터넷 보니까 투자 빚은 무조건 기각된다고 하던데 저도 회생 신청이 진짜 되나요?"라며 불안해한다. 상담원이 "서울회생법원 실무준칙 제408호에 따라 주식·코인 손실금을 청산가치에 반영하지 않는 기준이 마련되어 있으며, 어떻게 소명하느냐에 따라 기각 없이 안전하게 인가를 받을 수 있다"고 법적 근거를 들어 안심시켜 주면 깊이 감사하며 모든 질문에 솔직하게 털어놓는다.`,
        initialMessage: `여보세요... 제가 블라인드에서 보고 신청했는데요, 제가 코인 선물거래 하다가 빚이 6천 생겼거든요. 인터넷 보니까 투자 빚은 무조건 기각된다고 하던데 저도 회생 신청이 진짜 되나요?`,
      };
    }

    case 'inbound_cat_privacy_secret': {
      const leadContext: InboundAdLeadContext = {
        channel: 'facebook',
        channelLabel: '페이스북 피드 광고',
        channelBadgeColor: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
        campaignName: '100% 비밀보장 개인회생 비공개 무료진단',
        appliedAt: '약 5분 전',
        customerName: '정은지',
        customerAge: 36,
        customerPhone: '010-5591-6238',
        declaredDebt: '남편 모르는 생활비/카드 대출 합산 3,500만 원',
        delinquencyStatus: '연체 5일째',
        incomeAndJob: '어린이집 교사 (실수령 약 210만 원)',
        inquiryNote: '남편과 시댁에서 알면 절대 안 됩니다. 집으로 우편물이나 연락 안 오게 할 수 있나요?',
      };
      return {
        id: `inbound_${categoryId}_${timestamp}`,
        level: 3,
        badge: '🔒 가족극비 보장요구',
        customerName: leadContext.customerName,
        age: leadContext.customerAge,
        gender: 'female',
        phone: leadContext.customerPhone,
        job: leadContext.incomeAndJob,
        salary: '월 실수령 210만 원',
        debtSummary: leadContext.declaredDebt,
        housing: '남편 명의 아파트 거주',
        difficulty: '상급',
        title: '남편과 시댁에 채무 노출 시 이혼 위기라 극비 보장을 요구하는 고객',
        scenarioDescription: '페이스북 광고를 보고 신청했으나, 집으로 법원 등기나 서류가 날아오면 가정이 파탄 난다며 비밀 유지를 최우선으로 요구합니다.',
        trainingGoal: '송달장소를 법무법인 사무실로 지정하여 자택/직장 우편물 100% 원천 차단 확약',
        speechOptions: {
          pitch: 0.90,
          rate: 1.05,
          gender: 'female',
          neuralVoice: 'ko-KR-SunHiNeural',
          neuralRate: '+5%',
          neuralPitch: '-2Hz',
        },
        mode: 'inbound_lead',
        leadContext,
        outboundChannelType: 'inbound_ad',
        personaPrompt: `너는 36세 여성 ${leadContext.customerName}이다. 남편 몰래 카드 돌려막기와 대출로 3,500만 원의 빚이 생겼다. 페이스북 비밀보장 광고를 보고 절박하게 신청했다. 전화를 받고 "여보세요? 페이스북 보고 신청했는데요, 진짜 중요한 게 저희 남편이랑 직장에 절대 비밀이 보장되나요? 법원 우편물 집으로 오면 저 바로 이혼당합니다."라고 다급하게 말한다. 상담원이 "법원에서 오는 모든 우편물의 송달장소를 저희 법무법인 사무실로 지정하여 자택이나 직장으로는 단 한 통의 우편물도 가지 않도록 100% 원천 차단해 드립니다"라고 확약해주면 비로소 안도의 한숨을 쉬며 협조한다.`,
        initialMessage: `여보세요? 페이스북 보고 신청했는데요, 진짜 중요한 게 저희 남편이랑 직장에 절대 비밀이 보장되나요? 법원 우편물 집으로 오면 저 바로 이혼당합니다.`,
      };
    }

    case 'inbound_cat_urgent_collection': {
      const leadContext: InboundAdLeadContext = {
        channel: 'youtube',
        channelLabel: '유튜브 숏츠 채무 솔루션',
        channelBadgeColor: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
        campaignName: '급여/통장 압류 즉시 중단 긴급 회생 신청',
        appliedAt: '약 1분 전 (초긴급 접수)',
        customerName: '최동석',
        customerAge: 49,
        customerPhone: '010-2184-4903',
        declaredDebt: '카드론 4건, 대부 3건 합산 8,200만 원',
        delinquencyStatus: '연체 35일째 (당일 통장 압류 예고 통지서 수신)',
        incomeAndJob: '개인용달 운전기사 (실수령 약 290만 원)',
        inquiryNote: '오늘 당장 통장 압류 들어온다고 독촉 문자 왔습니다. 제발 오늘 안에 막아주세요!',
      };
      return {
        id: `inbound_${categoryId}_${timestamp}`,
        level: 4,
        badge: '🚨 당일압류 공황상태',
        customerName: leadContext.customerName,
        age: leadContext.customerAge,
        gender: 'male',
        phone: leadContext.customerPhone,
        job: leadContext.incomeAndJob,
        salary: '월 실수령 290만 원',
        debtSummary: leadContext.declaredDebt,
        housing: '월세 (보증금 500만 원 / 월 40만 원)',
        difficulty: '최고급',
        title: '당일 통장 압류 예고 문자를 받고 극도의 공황 상태로 신청한 고객',
        scenarioDescription: '유튜브 숏츠 광고를 보고 급히 신청했습니다. 오늘 당장 압류를 막아주지 않으면 죽는다고 울먹이며 패닉을 보입니다.',
        trainingGoal: '금지명령 및 채무자대리인 제도로 즉시 추심 차단 가능함을 알리고 패스트트랙 접수 안내',
        speechOptions: {
          pitch: 0.65,
          rate: 1.15,
          gender: 'male',
          neuralVoice: 'ko-KR-InJoonNeural',
          neuralRate: '+12%',
          neuralPitch: '-5Hz',
        },
        mode: 'inbound_lead',
        leadContext,
        outboundChannelType: 'inbound_ad',
        personaPrompt: `너는 49세 남성 ${leadContext.customerName}이다. 용달 운전을 하며 대부업체 빚이 연체되어 오늘 아침 "통장 및 급여 압류 절차 착수" 문자를 받고 극도의 공황 상태다. 유튜브 숏츠를 보다 긴급 신청을 남겼다. 전화를 받고 "여보세요?! 저 오늘 당장 급여 통장 압류 들어온다고 독촉 문자 와서 유튜브 보고 급하게 신청했거든요! 이거 오늘 당장 압류 막을 수 있어요? 제발 도와주세요!"라고 다급하게 소리친다. 상담원이 "선생님, 당황하지 마십시오. 법원 금지명령 접수 패스트트랙과 함께, 합법적으로 채권자의 직접 추심을 즉시 차단하는 채무자대리인 제도를 오늘 바로 가동해 드릴 수 있습니다"라며 신속한 솔루션을 제시하면 상담원을 은인처럼 신뢰하며 사무장 인계에 적극 응한다.`,
        initialMessage: `여보세요?! 저 오늘 당장 급여 통장 압류 들어온다고 독촉 문자 와서 유튜브 보고 급하게 신청했거든요! 이거 오늘 당장 압류 막을 수 있어요? 제발 도와주세요!`,
      };
    }

    case 'inbound_cat_qualification_only':
    default: {
      const leadContext: InboundAdLeadContext = {
        channel: 'kakao',
        channelLabel: '카카오 비즈보드 배너 광고',
        channelBadgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
        campaignName: '1분 간편 자격조회 빚 탕감 테스트',
        appliedAt: '약 15분 전',
        customerName: '강민구',
        customerAge: 45,
        customerPhone: '010-7382-1194',
        declaredDebt: '은행 신용대출 5,000만 원, 카드사 1,500만 원',
        delinquencyStatus: '연체 없음 (정상 상환 중이나 한계 도달)',
        incomeAndJob: '중견기업 과장 (실수령 약 380만 원)',
        inquiryNote: '연체는 아직 안 됐는데 자격 되는지만 빠르게 알고 싶습니다.',
      };
      return {
        id: `inbound_${categoryId}_${timestamp}`,
        level: 3,
        badge: '⚡ 30초 자격간보기',
        customerName: leadContext.customerName,
        age: leadContext.customerAge,
        gender: 'male',
        phone: leadContext.customerPhone,
        job: leadContext.incomeAndJob,
        salary: '월 실수령 380만 원',
        debtSummary: leadContext.declaredDebt,
        housing: '전세 (보증금 1억 8,000만 원 / 전세대출 1억 2,000만 원)',
        difficulty: '상급',
        title: '바쁘다며 질문을 사절하고 되는지만 30초 안에 결론 내라는 고객',
        scenarioDescription: '카카오톡 상단 배너로 가볍게 신청했습니다. 쓸데없는 질문은 거부하고 자격 되는지만 딱 잘라 말하라고 재촉합니다.',
        trainingGoal: '정중한 주도권 장악: 잘못된 안내 방지를 위해 법원이 보는 핵심 2가지만 30초 내 확인',
        speechOptions: {
          pitch: 0.78,
          rate: 1.10,
          gender: 'male',
          neuralVoice: 'ko-KR-InJoonNeural',
          neuralRate: '+8%',
          neuralPitch: '-5Hz',
        },
        mode: 'inbound_lead',
        leadContext,
        outboundChannelType: 'inbound_ad',
        personaPrompt: `너는 45세 남성 ${leadContext.customerName}이다. 회사 업무 중 카카오톡 배너 광고를 보고 간편 신청을 남겼다. 지금도 일하는 중이라 매우 바쁘고 성격이 급하다. 전화를 받고 "여보세요? 카카오에서 보고 신청했는데요. 딴소리 마시고, 제 조건에서 회생 되는지 안 되는지만 딱 30초 안에 말해요. 꼬치꼬치 묻지 말고요."라고 퉁명스럽게 말한다. 상담원이 "선생님, 잘못된 안내로 소중한 시간 낭비하시지 않도록, 법원이 회생 자격을 심사하는 핵심 조건 딱 2가지(소득과 재산)만 30초 안에 여쭙고 바로 결론을 말씀드리겠습니다"라고 단호하고 명쾌하게 리드하면 수긍하며 빠르게 답한다.`,
        initialMessage: `여보세요? 카카오에서 보고 신청했는데요. 딴소리 마시고, 제 조건에서 회생 되는지 안 되는지만 딱 30초 안에 말해요. 꼬치꼬치 묻지 말고요.`,
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
  const cached = loadCachedOrg();
  const me = cached?.userId;
  const team = cached?.teamName || '1팀';
  const rec: TrainingSessionRecord = {
    ...record,
    userId: record.userId || me,
    teamName: record.teamName || team,
  };
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

// ⚡ 실전 오프닝 1턴 고속 응답 헬퍼 (프리로드 및 체감 0초 티키타카용)
export const getPersonaOpeningReply = (persona: TrainingPersona): { emotion: 'angry' | 'annoyed' | 'anxious' | 'calm'; text: string } => {
  const behaviorType = persona.behaviorType || (persona.level === 1 ? 'gentle' : persona.level === 2 ? 'bottom_liner' : 'cold_skeptic');
  
  if (behaviorType === 'gentle') {
    return { emotion: 'calm', text: '네, 여보세요? 어디서 연락 주셨나요?' };
  } else if (behaviorType === 'bottom_liner') {
    return { emotion: 'annoyed', text: '여보세요? 바쁜데 어디시죠?' };
  } else if (behaviorType === 'despairing') {
    return { emotion: 'anxious', text: '네... 여보세요... 어디신가요...' };
  } else if (behaviorType === 'rapid_inquirer') {
    return { emotion: 'annoyed', text: '네, 여보세요? 진짜 빚 깎아주는 거 맞아요?' };
  } else if (behaviorType === 'storyteller') {
    return { emotion: 'calm', text: '네, 여보세요... 아휴, 어디시죠?' };
  } else {
    // cold_skeptic
    if (persona.age >= 55) {
      return { emotion: 'annoyed', text: '여보세요? 어디쇼?' };
    }
    return { emotion: 'annoyed', text: '여보세요? 누구시죠?' };
  }
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

  // ⚡ [체감 0초 티키타카] 1턴 오프닝 Fast Path:
  // 상담원의 첫마디가 인사/본인확인("안녕하세요", "여보세요", 고객 이름, "통화 되시나요" 등)인 경우
  // 외부 LLM 네트워크(1.5초)를 기다리지 않고, 0ms 즉시 고유 오프닝 단답을 반환하여 즉각 음성 출력!
  const isSimpleGreeting = agentTurnCount === 1 && (
    /^(안녕|여보|네|예|반갑|혹시|고객님|선생님|사장님|통화|말씀|어디)/.test(lastAgentText.trim()) ||
    lastAgentText.trim().length <= 15
  );
  if (isSimpleGreeting) {
    const opening = getPersonaOpeningReply(persona);
    const tag = opening.emotion === 'angry' ? '[화남]' : opening.emotion === 'annoyed' ? '[짜증]' : opening.emotion === 'anxious' ? '[불안]' : '[차분]';
    console.log('[1턴 고속 응답 Fast Path 적중 0ms]:', opening.text);
    return `${tag} ${opening.text}`;
  }

  // ⚡ [체감 0초 티키타카] 2턴 출처/목적 확인 Fast Path:
  // 상담원이 소속/회사명이나 채무 감면 조회를 밝혔을 때, 고객 성향별 대표 반론 0ms 즉답!
  if (agentTurnCount === 2) {
    const isIntro = /(법무법인|법률|회생|채무|감면|조회|탕감|안심|지원|센터|사무소)/.test(lastAgentText);
    if (isIntro) {
      if (persona.behaviorType === 'cold_skeptic') {
        return '[짜증] 근데 제 번호는 도대체 어디서 알고 전화하신 건데요?';
      } else if (persona.behaviorType === 'bottom_liner') {
        return '[짜증] 바쁜데 그래서 한 달에 얼마 깎아줄 수 있는 건데요?';
      } else if (persona.behaviorType === 'despairing') {
        return '[불안] 하... 저 다 알아봤는데 안 된대요. 끊으세요.';
      } else if (persona.behaviorType === 'rapid_inquirer') {
        return '[짜증] 회생하면 직장에 통보가고 신용점수 다 망가지는 거 아니에요?';
      }
    }
  }

  const behaviorType = persona.behaviorType || (persona.level === 1 ? 'gentle' : persona.level === 2 ? 'bottom_liner' : 'cold_skeptic');
  const outboundChannel = persona.outboundChannelType || 'cold_db';

  const isInbound = !!persona.leadContext || persona.outboundChannelType === 'inbound_ad' || persona.mode === 'inbound_lead';
  const orgLabel = isInbound
    ? (config.inbound?.companyName || config.companyName || '법무법인 신안')
    : (config.outbound?.orgName || '채무조정 지원센터');
  const roleLabel = isInbound
    ? (config.inbound?.roleTitle || '전담 상담원')
    : (config.outbound?.roleTitle || '팀장');
  const sourceLabel = isInbound
    ? (persona.leadContext?.channelLabel || config.inbound?.leadChannelName || config.leadChannelName || '온라인 무료 자가진단')
    : (config.outbound?.sourceText || '온라인 제휴 안심 자가진단 이력');

  // 6대 행동 아키타입별 특화 프롬프트 지침 (실전 단답형 호흡 강화)
  let behaviorSpecificGuideline = '';
  if (behaviorType === 'cold_skeptic') {
    behaviorSpecificGuideline = `[당신의 행동 아키타입: 🧊 Cold DB 출처추궁 / 의심경계형 (실전 45% 최다 분포)]
- 당신은 1~2년 전 사이트 가입 시 마케팅 제공 동의를 무심코 눌렀다가 갑자기 낯선 전화를 받은 고객입니다!
- 본인이 언제 어디서 동의했는지 전혀 기억하지 못하며, 보이스피싱이나 불법 대출 사기로 의심하여 통화 초반에는 극도로 방어적입니다.
- 통화 서두(1~2턴): 절대로 장황하게 묻지 말고, "어디라고요?", "누구신데요?", "내 번호 어떻게 알았소?" 중 딱 한 마디만 10~20자 내외로 퉁명스럽게 뱉으세요! (한 번에 여러 질문 쏟아붓기 절대 금지)
- 상담원이 소속("${orgLabel} ${roleLabel}")과 인입/제휴 경로("${sourceLabel}"), "100% 무료 법원 감면 자격 진단"임을 명확히 소명해야 겨우 [차분]으로 전환되며, 묻지 않은 빚은 절대 먼저 말하지 않습니다!`;
  } else if (behaviorType === 'rapid_inquirer') {
    behaviorSpecificGuideline = `[당신의 행동 아키타입: ❓ 제도 불신 / 꼬치꼬치 역질문형 (실전 25% 분포)]
- 당신은 평소 회생이나 파산에 대해 부정적인 소문(신용도 파탄, 직장 통보, 기각 등)을 들어 의심과 불안이 많습니다!
- 상담원의 질문에 순순히 답하지 않고, 날카로운 질문을 1턴에 딱 하나만(15~30자 내외) 던지세요:
  예: "회생하면 직장에 우편물 가고 신용도 다 망가지는 거 아니에요?", "거기 수임료 얼마나 뜯어가려고 전화했소?"
- 절대로 2~3개 질문을 한꺼번에 연달아 쏟아붓지 마세요. 하나 묻고 상담원의 답변을 듣고 나서 다음 질문을 던지세요.`;
  } else if (behaviorType === 'despairing') {
    behaviorSpecificGuideline = `[당신의 행동 아키타입: 🥀 피로 / 자포자기 체념형 (실전 20% 분포)]
- 당신은 오랜 빚 독촉과 압류로 지칠 대로 지쳐 모든 희망을 잃고 자포자기한 고객입니다.
- 힘없는 목소리로 깊은 한숨을 쉬며 1문장(10~25자)으로 무기력하게 끊으려 하세요:
  예: "하... 다 알아봤는데 전 안 된대요. 끊으세요.", "통장도 다 압류돼서 더 뺏길 것도 없어요..."
- 상담원이 법원의 신속한 3~7일 금지명령과 빚 청산 희망을 진심으로 제시할 때 서서히 마음을 여세요.`;
  } else if (behaviorType === 'bottom_liner') {
    behaviorSpecificGuideline = `[당신의 행동 아키타입: ⚡ 결론 재촉 / 단답 몰아붙이기형 (실전 5% 드문 분포)]
- 당신은 성격이 매우 급하고 바빠서 상담원의 긴 설명이나 서론을 들을 인내심이 없습니다!
- 10~20자 내외 초단답으로 결론과 감면 금액만 툭 던지세요:
  예: "빚 5천이오! 그래서 한 달에 얼마 깎아줄 수 있소? 그것만 말해요!", "바쁜데 용건만 간단히 해요."`;
  } else if (behaviorType === 'storyteller') {
    behaviorSpecificGuideline = `[당신의 행동 아키타입: 🗣️ 신세한탄형 (실전 3% 극소수 분포)]
- 통화 초반에는 출처를 의심하다가, 상담원이 진심 어린 공감을 건네고 신뢰가 형성된 Phase 3 이후에 비로소 과거 식당 폐업이나 사기 사연을 2문장(50~80자) 털어놓으세요. 절대 첫인사 단계에서 혼자 빚을 다 털어놓지 마세요!`;
  } else {
    behaviorSpecificGuideline = `[당신의 행동 아키타입: 😊 온순 협조형 (실전 2% 온순 고객)]
- 성격이 온순하고 예의 바르며, 상담원의 질문에 조심스럽게 한 문장(10~25자)으로만 짧게 답합니다.
- 예: "네, 여보세요? 어디서 연락 주신 건가요?", "아 네 맞아요, 카드론 이자가 너무 비싸서요."`;
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
🚨🚨 [실전 통화 호흡 절대 수칙: 현실 70% 단답형 원칙] 🚨🚨
============================================================
1. **실제 전화 통화에서 한국 사람 대다수(70~80%)는 길게 말하지 않고 단답으로 툭툭 받습니다!**
   - 고객의 대사는 **반드시 1문장(공백 포함 8~25자 내외, 최대 35자 이내)**으로 매우 짧게 끊어 치세요!
   - 35자가 넘어가는 긴 장문은 절대 금지합니다! (단, 신세한탄형 테마 제외)
2. **1턴 1의도(Single-Intent) 절대 준수**:
   - 절대로 한 번에 질문을 2~3개씩 쏟아붓지 마십시오! (100% 오류!)
   - ❌ 절대 금지: "누구신데 대뜸 전화해서 인사를 하시는 거죠? 어디시길래 제 번호로 전화를 하신 건지 먼저 밝히셔야 하는 거 아닙니까? 낯선 번호라 좀 불안한데, 대체 어디시죠?" (질문 4개 연타 ❌)
   - ⭕ 현실 모범: "네, 여보세요? 누구시죠?" (14자 ⭕)
   - ⭕ 현실 모범: "네 어디세요?" (7자 ⭕)
   - ⭕ 현실 모범: "제 번호는 어떻게 알고 거셨어요?" (19자 ⭕)
3. **통화 초반 1~2턴 (인사/출처 확인 단계)**:
   - 상담원이 "안녕하세요"라고 인사를 건넸다면, 무조건 15자 이하 초단답으로만 받으세요:
   - "네, 여보세요? 누구시죠?", "네 어디세요?", "네 말씀하세요.", "바쁜데요 어디쇼?"

============================================================
🚨🚨 [최우선 필수 원칙: 묻지도 않은 채무 정보 자발적 발설 절대 금지!] 🚨🚨
============================================================
1. **첫마디나 통화 초반에 묻지도 않은 자기 빚 내역을 털어놓는 행위는 100% 오류입니다!**
   - 상담원이 빚이나 채무를 직접 질문하기 전에는, 총 채무액이나 금융사, 사채, 세금 체납 내역을 **절대 1원도 입 밖으로 내지 마십시오!**
2. **상담원이 질문한 딱 그 한 가지만 짧게 답변하세요**:
   - 직업/소득을 물었으면 ➔ 직업/소득만 단답 ("제조업 다니고요, 한 280 받아요.")
   - 인사를 건넸으면 ➔ "누구쇼? 어디요?" 출처만 확인

============================================================
🛡️ [실전 통화 4단계 방어 심리벽 & 단계적 정보 해금 프로토콜]
(현재 상담원의 발화 횟수: ${agentTurnCount}번째 턴)
============================================================
- **Phase 1 [통화 1~2턴: 철벽 경계 & 출처 추궁 단계]**:
  * 채무 정보 발설: **0원 (절대 금지)**
  * 고객 행동: **1턴 1마디 단답(8~20자)**으로 "어디라고요?", "누구신데요?", "내 번호 어떻게 알고 전화했소?" 중 딱 하나만 퉁명스럽게 뱉으세요.
  * 상담원이 소속도 밝히지 않고 다짜고짜 빚부터 물어보면: "어디서 걸었는지도 안 밝히고 남의 빚을 왜 묻소?!"라며 짧게 쏘아붙이세요.

- **Phase 2 [통화 3~4턴: 출처 해명 후 제도 불신 & 수임료 의심 단계]**:
  * 채무 정보 발설: **0원 (자기 빚은 아직 숨김)**
  * 고객 행동: 상담원이 법무법인 소속과 무료 자격 진단임을 해명하면 [차분]으로 전환하되, 제도 불신을 1문장(15~30자)으로만 표출:
    "근데 회생하면 신용불량자 되고 직장에 통보 가는 거 아니오?", "수임료 얼마나 뜯어가려는 거요?"

- **Phase 3 [통화 5~6턴: 조건부 대략적 총액 범위 개방 단계]**:
  * 채무 정보 발설: **30~50% (대략적 총액 범위만)**
  * 고객 행동: 상담원이 안심시켜 주고 대략적인 범위를 물어볼 때 비로소 단답으로 흘리세요:
    "한 5천이나 6천 좀 넘을 거요... 정확한 건 나도 몰라요." (세금 체납, 사채 등 세부 내역은 여전히 함구!)

- **Phase 4 [통화 7턴 이후: 심층 문진 및 세부 채무 개방 단계]**:
  * 채무 정보 발설: **100% (사채, 세금, 사연 고백)**
  * 고객 행동: 상담원이 *"혹시 독촉이나 사채, 세금 체납도 있으실까요?"*라고 **해당 항목을 콕 집어 직접 물었을 때만** 그 항목만 짧게 시인하세요.

============================================================
[🚨 역할 절대 고정 규칙 - 1인 2역 엄격 금지]:
- 당신은 오직 **전화를 '받은' 채무자 고객("${persona.customerName}")** 역할입니다!
- 절대로 당신 자신이 법무법인, 법률사무소, 상담원이라고 흉내 내거나 말하지 마십시오!

[발화 및 감정 규칙]
1. **반드시 첫머리에 감정 태그 [화남], [짜증], [불안], [차분] 중 하나를 명시**하세요:
   - 통화 초반 1~2턴은 고객 성향에 따라 [짜증], [불안], 또는 온순형은 [차분]
   - 상담원이 소속과 무료 진단 취지를 명확히 밝혔다면 [차분] 또는 [불안]으로 전환
2. 부연설명이나 괄호 지문(예: (한숨을 쉬며), (화를 내며))은 절대 쓰지 말고, **감정태그와 1문장 단답 대사(8~25자)**만 바로 출력하세요.
3. ${persona.age >= 55 ? '50~60대 특유의 퉁명스러운 어르신 말투("~했소?", "~인가요?", "~하쇼!")를 자연스럽게 사용하세요.' : ''}

[전체 최근 통화 기록]
${conversationText}

[상담원이 방금 당신에게 직접 한 말]:
"${lastAgentText}"

👉 위 [상담원이 방금 당신에게 직접 한 말]에 귀 기울여, 위의 **[현실 70% 단답형 원칙 (최대 1문장, 25자 내외)]** 및 **[1턴 1의도]** 규칙을 엄격히 준수하여 진짜 사람 같은 짧고 현실적인 대사를 작성하세요.

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

  // 🚨 [F등급 컷오프: 조기 종료 / 상담 미진행 케이스 엄격 분기]
  // 상담원 발화가 1턴 이하이거나 총 글자 수가 20자 미만인 경우 (예: "여보세요", "안녕하세요"만 하고 통화 종료):
  // 불필요한 AI 호출 없이 5~10점대 칼같은 탈락 판정 리포트 즉시 반환!
  const agentMessages = messages.filter(m => m.speaker === 'agent');
  const agentTotalChars = agentMessages.reduce((sum, m) => sum + m.text.trim().length, 0);
  const agentTurnCount = agentMessages.length;

  const isInboundLead = persona.mode === 'inbound_lead' || !!persona.leadContext;
  const currentOrgName = isInboundLead
    ? (config.inbound?.companyName || config.companyName || '법무법인 신안')
    : (config.outbound?.orgName || '채무조정 지원센터');
  const currentRoleTitle = isInboundLead
    ? (config.inbound?.roleTitle || '전담 상담원')
    : (config.outbound?.roleTitle || '팀장');
  const currentSource = isInboundLead
    ? (persona.leadContext?.channelLabel || config.inbound?.leadChannelName || config.leadChannelName || '온라인 자가진단 신청건')
    : (config.outbound?.sourceText || '온라인 제휴 안심 자가진단 이력');

  if (agentTurnCount <= 1 || agentTotalChars < 20) {
    const suggested = isInboundLead
      ? (config.inbound?.openingScript || '안녕하세요 고객님! 신청하신 무료 진단 건으로 연락드렸습니다.')
      : (config.outbound?.openingScript || '안녕하십니까, 고객님! 채무조정 지원센터 팀장입니다.');

    return {
      totalScore: agentTurnCount === 0 ? 0 : 8,
      grade: 'F',
      complianceScore: 3,
      listeningScore: 5,
      objectionScore: 0,
      coldDbOpeningScore: 10,
      objectionDefenseScore: 0,
      pacingControlScore: 0,
      passed: false,
      summary: `통화가 연결된 후 실질적인 상담 및 소속 고지가 이루어지지 않고 즉시 종료되었습니다. (상담원 발화 ${agentTurnCount}회, 7대 문진 0건 달성)`,
      strengths: agentTurnCount > 0 ? ['통화 연결 후 첫 응대 시도'] : [],
      weaknesses: [
        isInboundLead
          ? `상담 서두에 법인 소속(${currentOrgName}) 및 신청 목적 미고지 (컴플라이언스 미이행)`
          : `상담 서두에 소속(${currentOrgName} ${currentRoleTitle}) 및 DB 출처 미고지 (컴플라이언스 미이행)`,
        '고객과의 실질적인 대화 및 7대 필수 문진 진행 불가',
        '조기 통화 종료로 인한 고객 니즈 파악 실패',
      ],
      coachingTips: [
        `전화를 걸었을 때는 반드시 소속("${currentOrgName} ${currentRoleTitle}")과 ${isInboundLead ? '신청 접수 건명을' : '합법적 제휴 출처를'} 당당히 밝히고 시작하세요.`,
        '고객이 "여보세요?"라고 받으면 당황하지 말고 오프닝 10초 스크립트로 주도권을 잡으세요.',
        '고객의 의심이 나오기 전에 "100% 무료 법원 가심사"임을 먼저 밝혀 방어벽을 낮추세요.',
      ],
      suggestedScript: interpolateOpeningScript(suggested, config, '상담원', persona.customerName, isInboundLead ? 'inbound_lead' : 'cold_call'),
      paralegalCard: {
        jobAndEmployment: false,
        monthlyRealIncome: false,
        dependentsCount: false,
        housingAndDeposit: false,
        debtAmountAndReason: false,
        overdueStatusAndPeriod: false,
        pastRehabHistory: false,
        handoffScore: 0,
        paralegalBriefing: '[상담 미진행]\n- 상담 조기 종료로 고객 기본 인적사항 및 채무 내역 파악 불가 (사무장 인계 불가)',
        missingCheckpoints: [
          '1. 직업 및 재직형태 미확인',
          '2. 월 실수령액 미확인',
          '3. 부양가족 수 미확인',
          '4. 주거/보증금 미확인',
          '5. 총 채무액 미확인',
          '6. 연체 여부 미확인',
          '7. 과거 회생/신복위 이력 미확인',
        ],
        coachingAdvice: '통화 시작 10초 내에 고객을 안심시키고 첫 번째 질문(직업/재직형태)으로 진입하는 오프닝 훈련이 필수적입니다.',
      },
    };
  }

  const conversationText = messages
    .map(m => `${m.speaker === 'agent' ? '상담원' : '고객'}: ${m.text}`)
    .join('\n');

  const prompt = `당신은 "${currentOrgName}" 수석 사무장이자 금융 CRM 상담 품질 평가 감독관(QA 코치)입니다.
신입 상담원이 가상 고객 "${persona.customerName}"(${persona.age}세, ${persona.job}, 인입유형: ${isInboundLead ? '광고신청 인바운드리드' : '일반 콜드콜'})과 진행한 모의 상담 통화록을 정밀 평가하고 코칭 리포트 및 '사무장 인계 7대 문진 카드'를 JSON으로 작성하세요.

[우리 회사 평가 준수 규칙]
- 공식 소속 및 직책: "${currentOrgName} ${currentRoleTitle}" (${isInboundLead ? '인바운드: 고객이 신청한 법인명과 신청 건명 안내 여부 필수 평가' : '아웃바운드 TM: 변호사법 준수를 위해 법무법인을 사칭하지 않고 설정된 지원센터명/직책 및 합법적 DB 출처를 당당히 고지했는지 평가'})
- 공식 인입/출처: "${currentSource}"
- 필수 포함 키워드: [${config.requiredKeywords.join(', ')}] (미언급 시 complianceScore 감점)
- 엄격 금지어: [${config.bannedKeywords.join(', ')}] (발화 시 complianceScore 대폭 감점 및 weaknesses 지적)

[고객 기본 정보]
- 시나리오: ${persona.scenarioDescription}
- 행동 성향: ${persona.behaviorType || '실전'} (인입: ${isInboundLead ? '광고신청 인바운드 리드' : 'Cold DB'})
- 채무: ${persona.debtSummary}
- 재산: ${persona.housing}
- 소득: ${persona.salary}
${persona.leadContext ? `
[고객이 온라인 제출한 상담 신청서 데이터 (인바운드 리드 프리뷰)]
- 유입 매체: ${persona.leadContext.channelLabel} (${persona.leadContext.campaignName})
- 신청 접수: ${persona.leadContext.appliedAt}
- 고객 입력 채무: ${persona.leadContext.declaredDebt}
- 연체 상태: ${persona.leadContext.delinquencyStatus}
- 직업 및 소득: ${persona.leadContext.incomeAndJob}
- 고객 남김말: "${persona.leadContext.inquiryNote}"
` : ''}
${persona.objectionFocus ? `- 고객의 핵심 의문/걱정: "${persona.objectionFocus}" (모범 방어 기준: "${persona.recommendedDefenseScript || ''}")` : ''}
${persona.groundTruth ? `
[2026 회생·파산 법률 연산 Ground Truth (사무장 내부 정답 진단서)]
- 신청 적격 판정: ${persona.groundTruth.suitability} (${persona.groundTruth.suitabilityReason})
- 법정 인정 생계비: ${Math.round(persona.groundTruth.recognizedLivingCost / 10000)}만 원
- 예상 월 변제금: 약 ${Math.round(persona.groundTruth.expectedMonthlyPayment / 10000)}만 원 (${persona.groundTruth.expectedRepaymentPeriod}개월 납입, 총 ${Math.round(persona.groundTruth.totalRepaymentAmount / 10000)}만 원, 원금 탕감률 약 ${persona.groundTruth.estimatedForgivenessRate}%)
- 관할 법원 실무: ${persona.groundTruth.courtRuleNote}
- 1차 추천 법률 후킹: ${persona.groundTruth.recommendedLegalHook || '없음'}
` : ''}

${isInboundLead ? `
* [광고신청 인바운드 리드 전용 5대 QA 평가 기준]:
  1) [신청 리드 확인 및 오프닝 (20점)]: 고객이 직접 온라인에서 신청서를 남긴 건이므로, 상담 서두에 "방금 ${persona.leadContext?.channelLabel || '온라인'}에서 개인회생 무료 진단 신청 남겨주셔서 신속히 연락드렸습니다"라며 신청 맥락을 정확히 짚었는지 평가하세요. (만약 콜드콜처럼 "합법적 경로로 수집되어..."라고 변명조로 말했다면 complianceScore -20점 대폭 감점!)
  2) [광고 기대치 현실화 & 신뢰 형성 (25점)]: 고객의 90% 탕감 과장 광고 의심("진짜 90% 다 깎아주나요? 낚시 아니죠?")에 대해 섣부른 확답을 피하고, "법정 최저생계비를 뺀 가용소득으로 법원이 결정한다"는 원리를 차분히 설명하여 신뢰를 형성했는지 평가하세요.
  3) [수임료 비교 방어 & 가치 입증 (20점)]: 타사와 가격을 비교하거나 수임료부터 캐묻는 고객에게 덜컥 금액만 부르지 않고, 기각 시 100% 전액 환불 보장제 및 무이자 분납 제도를 제시하며 사건 관리의 가치를 설득했는지 평가하세요.
  4) [신세한탄 완급 조절력 (15점)]: 채무 고민을 쏟아내는 고객에게 공감하되, 30초 내에 능숙하게 문진으로 대화 주도권을 가져왔는지 평가하세요.
  5) [수석 사무장 심층 인계 클로징 (20점)]: 1차 통화에서 자의적으로 단정 짓지 않고, "수수료 분납 계획 및 예상 변제금 정밀 시뮬레이션을 위해 30분 내 수석 사무장님 직통 상담으로 연결해 드리겠다"며 2차 전문 상담으로 매끄럽게 연결했는지 평가하세요.
` : `
* 1차 상담원 실전 평가 지침 (실제 녹취 274건 분석 기반 5대 핵심 기준):
  1) [Cold DB 오프닝 돌파력 (15점)]: 초반 고객의 출처 추궁("내 번호 어디서 알았소?")이나 의심에 당황하지 않고 합법적 제휴 동의 경로와 비용 0원의 무료 가심사임을 명확히 밝혀 고객 감정을 [차분]으로 전환시켰는지 평가하세요. (coldDbOpeningScore: 0~100)
  2) [고객 질문/반론 방어력 (20점)]: 고객이 신용도 하락(바닥 우려), 수임료 기각 걱정, 직장/가족 비밀 등을 질문했을 때 녹취 속 검증된 화법(고3 리셋 비유, 단점 2가지 한정, 100% 비밀 보장 등)으로 명쾌하게 방어했는지 평가하세요. (objectionDefenseScore: 0~100)
  3) [신세한탄 완급 조절력 (15점)]: 장문으로 사연을 쏟아내는 고객의 말을 무례하게 자르지 않고 적절한 맞장구로 공감하되, 30초 내에 능숙하게 문진으로 대화 주도권을 되찾아왔는지 평가하세요. (pacingControlScore: 0~100)
  4) [섣부른 확정 단정 감점]: 상담원이 1차 통화에서 "무조건 월 OO만 원이다", "OO% 탕감 보장된다"며 금액을 확약한 경우, 2차 상담 시 민원 유발 위험으로 complianceScore 감점(-20점).
  5) [조건부 완충 브릿지 인계 가점]: 대략적인 범위만 조심스럽게 언급하고 "정확한 1원 단위 금액은 수석 사무장님이 서류 정밀 검토 후 확정 안내해 드린다"며 2차 전문 상담으로 매끄럽게 인계했는지 평가하세요(+15점).
  6) [소액 채무(1,200만 원 선) 양심 안내]: 1,500만 원 미만 소액 채무자에게 회생을 억지로 권유하면 감점(-25점), "수임료 부담이 크니 신복위 프리워크아웃(5만 원)이 유리하다"고 솔직히 안내 시 양심 가점(+20점).
`}

[사무장 인계 7대 필수 문진 항목 채점 기준]
${isInboundLead ? `
1. 신청 리드 및 본인 확인 (유입 채널 및 온라인 자가진단 신청 맥락)
2. 광고 기대치 현실화 (무조건 90% 확답 금지, 법정 생계비 원리 설명)
3. 총 채무액 및 연체 팩트체크 (신청서 외 카드론/대부/사채 추가 내역)
4. 직업 및 실수령 소득 (4대보험/사업소득 및 최근 3개월 실수령액)
5. 재산 및 청산가치 (주거형태 보증금, 차량, 배우자 재산)
6. 비밀보장 및 불안 해소 (우편물 사무소 대리수령 확약)
7. 수석 사무장 심층 인계 (방문/전화 예약 클로징)
` : `
1. 직업 및 재직형태 (4대보험/사업자/일용직 등)
2. 월 평균 실소득 (실수령액)
3. 부양가족 수 (등본상 동거 가족)
4. 주거 형태 및 보증금 (자가/전세/월세 및 보증금 규모)
5. 총 채무액 및 채무 원인 (원금 규모 및 용도)
6. 현재 연체 여부 및 기간 (독촉 상황)
7. 과거 회생/파산/신복위 이력 (과거 조정 경험)
`}

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
    const report = JSON.parse(res.text) as TrainingReport;

    // 🚨 [문진 달성률 기반 점수 상한제 (Cap System)]
    // 초보자가 말을 많이 했어도 7대 문진을 놓치면 점수 거품을 칼같이 차단!
    const card = report.paralegalCard;
    const checkCount = card ? [
      card.jobAndEmployment,
      card.monthlyRealIncome,
      card.dependentsCount,
      card.housingAndDeposit,
      card.debtAmountAndReason,
      card.overdueStatusAndPeriod,
      card.pastRehabHistory,
    ].filter(Boolean).length : 0;

    if (checkCount === 0) {
      report.totalScore = Math.min(25, report.totalScore); // 문진 0개: 최대 25점 (D등급 이하)
    } else if (checkCount <= 2) {
      report.totalScore = Math.min(55, report.totalScore); // 문진 1~2개: 최대 55점 (C등급 이하)
    } else if (checkCount <= 4) {
      report.totalScore = Math.min(74, report.totalScore); // 문진 3~4개: 최대 74점 (B등급 이하)
    }

    // 실전 6단계 평가 등급 부여
    if (report.totalScore >= 90 && checkCount >= 6) {
      report.grade = 'S';
    } else if (report.totalScore >= 75 && checkCount >= 5) {
      report.grade = 'A';
    } else if (report.totalScore >= 60) {
      report.grade = 'B';
    } else if (report.totalScore >= 40) {
      report.grade = 'C';
    } else if (report.totalScore >= 16) {
      report.grade = 'D';
    } else {
      report.grade = 'F';
    }

    report.passed = report.totalScore >= 75 && checkCount >= 5;
    return report;
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
