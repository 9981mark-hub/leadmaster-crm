
import { CaseStatus } from './types';

// This is the initial default list.
// Actual statuses are now managed in services/api.ts (Mock DB)
export const DEFAULT_STATUS_LIST: CaseStatus[] = [
  '신규접수', '부재', '재통화 예정', '진행불가', '고객취소', '장기관리중',
  '상담중', '사무장 접수', '계약 완료',
  '1차 입금완료', '2차 입금완료'
];

export const STATUS_COLOR_MAP: Record<string, string> = {
  '신규접수': 'bg-blue-100 text-blue-800',
  '광고유입': 'bg-blue-100 text-blue-800', // Assuming similar to New
  '부재': 'bg-orange-100 text-orange-800',
  '재통화 예정': 'bg-yellow-100 text-yellow-800',
  '진행불가': 'bg-gray-200 text-gray-700',
  '고객취소': 'bg-gray-200 text-gray-700',
  '장기관리중': 'bg-purple-100 text-purple-800',
  '상담중': 'bg-indigo-100 text-indigo-800',
  '사무장 접수': 'bg-teal-100 text-teal-800',
  '계약 완료': 'bg-green-100 text-green-800',
  '1차 입금완료': 'bg-green-200 text-green-900',
  '2차 입금완료': 'bg-green-300 text-green-900'
};

export const MANAGER_NAME = "Mark";

export const CASE_TYPES = ['개인회생', '파산', '새출발기금', '신용회복'];

export const JOB_TYPES = ['직장인', '개인사업자', '법인사업자', '프리랜서', '무직'];
export const HOUSING_TYPES = ['자가', '전세', '월세', '무상거주'];
export const HOUSING_DETAILS = ['아파트', '빌라', '단독주택', '오피스텔', '기타'];

export const ASSET_OWNERS = ['본인', '배우자', '배우자 공동명의'];
export const RENT_CONTRACTORS = ['본인', '배우자'];
export const FREE_HOUSING_OWNERS = ['부모님', '형제', '자녀', '지인', '기타'];

export const ASSET_TYPES = [
  '자동차', '부동산', '토지', '예금/적금',
  '주식/가상화폐', '영업용 차량', '영업용 차량 면허',
  '사업장 보증금', '사업장 권리금', '사업장 시설금', '기타'
];

export const HISTORY_TYPES = ['없음', '개인회생', '파산', '신용회복', '새출발기금'];

// Validation Logic Helpers
export const REMINDER_REQUIRED_STATUSES: CaseStatus[] = ['재통화 예정', '장기관리중'];
export const CONTRACT_COMPLETED_STATUSES: CaseStatus[] = ['계약 완료', '1차 입금완료', '2차 입금완료'];

export const formatMoney = (amount: number | undefined) => {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString()}만원`;
};

export const formatPhone = (value: string) => {
  if (!value) return value;
  const clean = value.replace(/[^\d]/g, "");

  // 02 Case (Seoul area code)
  if (clean.startsWith('02')) {
    if (clean.length < 3) return clean;
    if (clean.length < 6) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
    if (clean.length < 10) return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5)}`;
    // Max 10 digits for 02 (02-1234-5678)
    return `${clean.slice(0, 2)}-${clean.slice(2, 6)}-${clean.slice(6, 10)}`;
  }

  // Standard Case (010, 031, etc)
  if (clean.length < 4) return clean;
  if (clean.length < 7) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  if (clean.length < 11) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
  // Max 11 digits for standard mobile (010-1234-5678)
  return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7, 11)}`;
};

export const DEFAULT_SUMMARY_TEMPLATE = `* 담당자 : {{managerName}}
* 고객이름 : {{customerName}}
* 연락처 : {{phone}}
* 출생년도 : {{birth}}
* 성별 : {{gender}}
* 거주지역 : {{region}}
* 직업 : {{jobTypes}}
* 4대보험 가입유무 : {{insurance4}}
* 결혼유무 : {{maritalStatus}}
* 미성년 자녀 수 : {{childrenCount}}
* 월 세후소득 (실급여) : {{incomeDetails}}
* 월 대출납입금 : {{loanMonthlyPay}}
* 거주 형태 : {{housingType}} ({{housingDetail}})
* 보증금, 월세 : {{depositRentStr}}
* 자산 : {{assetsStr}}
* 신용 대출 : {{creditLoanStr}}
* 담보 대출 (차량 /집/토지 등) : {{collateralStr}}
* 신용카드 사용유무 : {{creditCardUse}}
* 신용카드 사용금액 : {{creditCardAmountStr}}
* 개인회생 / 파산 / 회복 이력 : {{historyStr}}
* 특이사항 :
{{specialMemo}}`;

export const DEFAULT_AI_PROMPT = `당신은 법률 사무소의 전문 상담원 보조 AI입니다.
업로드된 통화 녹음 파일을 분석하여 다음 핵심 내용을 요약해주세요.

1. 고객 상황 (채무, 소득, 재산 등)
2. 주요 상담 내용 (질문 및 답변)
3. 향후 계획 및 조치
4. 특이사항

[작성 규칙]
- "## 요약" 같은 제목(헤더)을 절대 넣지 마세요. 본문만 바로 작성하세요.
- 별표(*)나 마크다운 볼드체(**)를 절대 사용하지 마세요. (AI 티가 나지 않게 하세요)
- 목록 나열이 필요하면 하이픈(-)을 사용하세요.
- 말투는 간결하고 명확한 '해요체'를 사용하세요.
- 사람이 직접 작성한 상담 메모처럼 자연스럽게 작성하세요.`;

export const DEFAULT_OCR_PROMPT = `Extract the following information from the provided document image/pdf.
Return ONLY a raw JSON object (no markdown, no backticks).
Fields:
- customerName: (string) Name of the client
- phone: (string) Phone number
- summary: (string) specific details found in the doc (debt amount, job, etc)

If a field is not found, use empty string.`;

export const AVAILABLE_FIELDS_CONFIG = [
  { key: 'childrenCount', label: '자녀 수' },
  { key: 'depositLoan', label: '보증금 대출' },
  { key: 'rentContractor', label: '임대차 계약인' },
  { key: 'spouseAssets', label: '배우자 자산 (통합)' },
  { key: 'creditCard', label: '신용카드 사용' },
  { key: 'history', label: '회생/파산 이력' },
  { key: 'assets', label: '자산 상세 입력' }
];
