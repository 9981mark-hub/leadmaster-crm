/**
 * 한국어 텔레그램 피드백 텍스트 분석 및 스마트 엔티티 추출 유틸리티
 * 
 * 실제 텔레그램 4개 대화방(2,926개 메시지 / 894건 피드백) 패턴 기반:
 * - 1) 출장/내방/방문 예약 일시 및 장소 추출
 * - 2) 부재 차수(부재2, 부재3) 감지
 * - 3) 1차 상담원 재관리(Care) 요망 감지
 * - 4) 수임료/착수금/입금액 감지
 * - 5) 고객명 파싱 ('고객명 // 내용' or '고객명 내용')
 */

export interface ParsedFeedbackSchedule {
  isSchedule: boolean;
  type: '출장' | '내방' | '방문' | '통화예약' | '상담';
  datetimeStr?: string;      // ISO string or YYYY-MM-DD HH:mm
  dateDisplay?: string;      // 예: "2026-04-17 (금) 11:00"
  location?: string;         // 예: "부산", "용인", "마산"
  rawText?: string;
}

export interface ParsedFeedbackAmounts {
  hasAmount: boolean;
  totalFee?: number;         // 수임료 (원)
  deposit?: number;          // 착수금/입금액 (원)
  displayStr?: string;       // 예: "수임료: ₩6,600,000 / 착수금: ₩500,000"
}

export interface ParsedFeedbackInsights {
  customerName?: string;
  schedule?: ParsedFeedbackSchedule;
  missedCallCount?: number;  // 1, 2, 3...
  isCareNeeded: boolean;     // 1차 TM 재관리 요망
  careReason?: string;       // 예: "비용 고민", "가족 상의 후 연락"
  amounts?: ParsedFeedbackAmounts;
  cleanContent: string;
}

/**
 * 텍스트에서 한국어 금액(숫자+만/만원)을 원 단위 숫자로 변환
 * 예: "660" -> 6,600,000 (맥락상 660만원), "50만원" -> 500,000, "300만" -> 3,000,000
 */
function parseKoreanWon(str: string): number | undefined {
  if (!str) return undefined;
  const clean = str.replace(/[,\s]/g, '');
  
  // "300만원", "300만"
  const manMatch = clean.match(/^(\d+(?:\.\d+)?)\s*만(?:원)?$/);
  if (manMatch) {
    return Math.round(parseFloat(manMatch[1]) * 10000);
  }
  
  // "500000원", "500000"
  const rawNum = clean.replace(/[^0-9]/g, '');
  if (!rawNum) return undefined;
  const val = parseInt(rawNum, 10);
  
  // 만약 100~9999 사이의 세 자리~네 자리 숫자가 '수임료 660', '비용 350'처럼 쓰였으면 만원 단위로 해석
  if (val >= 100 && val <= 9999) {
    return val * 10000;
  }
  return val;
}

/**
 * 텔레그램 피드백 본문 텍스트 분석
 */
export function analyzeTelegramFeedbackText(content: string, referenceDate: Date = new Date()): ParsedFeedbackInsights {
  const text = (content || '').trim();
  const insights: ParsedFeedbackInsights = {
    isCareNeeded: false,
    cleanContent: text,
  };

  if (!text) return insights;

  // 1. 고객명 추출 (고객명 // 내용 또는 고객명 [부재/출장...])
  const slashMatch = text.match(/^([가-힣]{2,4})\s*(?:\([남여]\))?\s*\/\/\s*(.*)/s);
  if (slashMatch) {
    insights.customerName = slashMatch[1];
    insights.cleanContent = slashMatch[2].trim();
  } else {
    const spaceMatch = text.match(/^([가-힣]{2,4})\s+(부재|출장|내방|방문|재전|통화|계약|수임|명함|비용|조건|서류|상의|현재)/);
    if (spaceMatch) {
      insights.customerName = spaceMatch[1];
      insights.cleanContent = text.substring(spaceMatch[1].length).trim();
    }
  }

  // 2. 부재 차수 파싱 (부재2, 부재3, 부재십니다)
  const missedCountMatch = text.match(/부재\s*([0-9]+)/);
  if (missedCountMatch) {
    insights.missedCallCount = parseInt(missedCountMatch[1], 10);
  } else if (/부재|연결안됨|통화연결안됨|안받으심|전화안받/.test(text)) {
    insights.missedCallCount = 1;
  }

  // 3. 1차 TM 재관리(Care) 요망 감지
  if (/관리\s*부탁|관리요망|담당자\s*관리|재통\s*요망|재케어|상의\s*후\s*전화|배우자랑\s*상의|작은아들과\s*상의|남편과\s*상의|비용이\s*문제/.test(text)) {
    insights.isCareNeeded = true;
    if (/비용이\s*문제|비용.*상의/.test(text)) {
      insights.careReason = '수임 비용 부담/가족 상의';
    } else if (/상의\s*후/.test(text)) {
      insights.careReason = '가족/배우자 상의 후 결정';
    } else {
      insights.careReason = '사무장 1차 상담원 재케어 요청';
    }
  }

  // 4. 금액 (수임료 / 착수금 / 계약금) 감지
  const feeMatch = text.match(/(?:수임료|비용)\s*(?:은|이)?\s*[:\s]*(\d+(?:[,\.]\d+)?(?:\s*만)?(?:원)?|\d{3,4})/);
  const depositMatch = text.match(/(?:착수금|계약금|입금금액|선임료)\s*(?:은|이)?\s*[:\s]*(\d+(?:[,\.]\d+)?(?:\s*만)?(?:원)?)/) ||
                       text.match(/(\d+(?:\s*만)?(?:원)?)\s*(?:계약금|착수금)?\s*입금/);
  
  const totalFee = feeMatch ? parseKoreanWon(feeMatch[1]) : undefined;
  const deposit = depositMatch ? parseKoreanWon(depositMatch[1]) : undefined;

  if (totalFee || deposit) {
    const parts = [];
    if (totalFee) parts.push(`수임료: ₩${totalFee.toLocaleString()}`);
    if (deposit) parts.push(`착수금: ₩${deposit.toLocaleString()}`);
    insights.amounts = {
      hasAmount: true,
      totalFee,
      deposit,
      displayStr: parts.join(' / '),
    };
  }

  // 5. 출장 / 내방 / 방문 / 통화예약 일정 파싱
  const isScheduleKeyword = /출장|내방|방문|통화예약|재통화하기로|만나기|면담/.test(text);
  if (isScheduleKeyword) {
    let scheduleType: ParsedFeedbackSchedule['type'] = '출장';
    if (/내방/.test(text)) scheduleType = '내방';
    else if (/방문/.test(text)) scheduleType = '방문';
    else if (/통화예약|통화요청/.test(text)) scheduleType = '통화예약';

    // 날짜 및 시간 추출
    // 패턴 예: "4월 17일 금 오전 11시", "1/8(수)오후2시", "13일 오후2시", "9일 금요일 10시"
    const currentYear = referenceDate.getFullYear();
    let month = referenceDate.getMonth() + 1;
    let day = referenceDate.getDate();
    let hour = 14; // 기본 오후 2시
    let minute = 0;
    let foundDate = false;

    // "M월 D일" or "M/D"
    const mdMatch = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) || text.match(/(\d{1,2})\/(\d{1,2})/);
    if (mdMatch) {
      month = parseInt(mdMatch[1], 10);
      day = parseInt(mdMatch[2], 10);
      foundDate = true;
    } else {
      // "D일" (이번 달 또는 다음 달)
      const dMatch = text.match(/(\d{1,2})\s*일/);
      if (dMatch) {
        day = parseInt(dMatch[1], 10);
        foundDate = true;
      }
    }

    // 시간: "오전 11시", "오후 2시", "14시", "오후2시30분"
    const timeMatch = text.match(/(오전|오후|낮|저녁|아침)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/) || text.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      if (timeMatch[3] !== undefined) {
        // "오전/오후 시 분" 형식
        const ampm = timeMatch[1];
        let h = parseInt(timeMatch[2], 10);
        const m = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
        if (ampm === '오후' || ampm === '저녁') {
          if (h < 12) h += 12;
        } else if (ampm === '오전' || ampm === '아침') {
          if (h === 12) h = 0;
        } else {
          // 오전/오후 명시 없는데 1~6시면 보통 오후
          if (h >= 1 && h <= 6) h += 12;
        }
        hour = h;
        minute = m;
      } else if (timeMatch[2] !== undefined) {
        // "HH:MM" 형식
        hour = parseInt(timeMatch[1], 10);
        minute = parseInt(timeMatch[2], 10);
      }
    }

    // 지역/장소 추출 (예: "부산 출장예약", "용인 출장", "가포고등학교", "마산")
    const locMatch = text.match(/([가-힣]{2,10}(?:시|군|구|동|역|학교|빌딩)?)\s*(?:출장|내방|방문|에서)/);
    const location = locMatch ? locMatch[1] : undefined;

    if (foundDate || timeMatch) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${currentYear}-${pad(month)}-${pad(day)}`;
      const timeStr = `${pad(hour)}:${pad(minute)}`;
      const datetimeIso = `${dateStr}T${timeStr}:00`;

      // 요일 구하기
      const dateObj = new Date(currentYear, month - 1, day);
      const daysKo = ['일', '월', '화', '수', '목', '금', '토'];
      const dayOfWeek = daysKo[dateObj.getDay()];

      insights.schedule = {
        isSchedule: true,
        type: scheduleType,
        datetimeStr: datetimeIso,
        dateDisplay: `${month}월 ${day}일(${dayOfWeek}) ${hour >= 12 ? '오후' : '오전'} ${hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour)}시${minute > 0 ? ` ${minute}분` : ''}${location ? ` [${location}]` : ''}`,
        location,
        rawText: text,
      };
    }
  }

  return insights;
}
