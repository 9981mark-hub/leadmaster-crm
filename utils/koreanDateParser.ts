/**
 * 한국어 텔레그램 피드백 텍스트 분석 및 스마트 엔티티 추출 유틸리티
 * 
 * 실제 텔레그램 4개 대화방(2,926개 메시지 / 894건 피드백) 패턴 기반:
 * - 1) 출장/내방/방문/미팅 예약 일시 및 장소 추출 (상대 날짜 금일/내일 및 취소 일정 제외 완벽 지원)
 * - 2) 부재 차수(부재2, 부재3) 감지
 * - 3) 1차 상담원 재관리(Care) 요망 감지
 * - 4) 수임료/착수금/입금액 감지
 * - 5) 고객명 파싱 ('고객명 // 내용' or '고객명 내용')
 */

export interface ParsedFeedbackSchedule {
  isSchedule: boolean;
  type: '출장' | '내방' | '방문' | '통화예약' | '상담' | '미팅';
  datetimeStr?: string;      // ISO string or YYYY-MM-DDTHH:mm:00
  dateDisplay?: string;      // 예: "11월 12일(목) 오후 1시 00분 [미팅]"
  location?: string;         // 예: "부산", "용인", "안양"
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
    const spaceMatch = text.match(/^([가-힣]{2,4})\s+(부재|출장|내방|방문|미팅|재전|통화|계약|수임|명함|비용|조건|서류|상의|현재)/);
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

  // 5. 출장 / 내방 / 방문 / 통화예약 / 미팅 일정 파싱
  const isScheduleKeyword = /출장|내방|방문|통화예약|재통화하기로|만나기|면담|미팅|상담예약|약속/.test(text);
  if (isScheduleKeyword) {
    let scheduleType: ParsedFeedbackSchedule['type'] = '미팅';
    if (/내방/.test(text)) scheduleType = '내방';
    else if (/출장/.test(text)) scheduleType = '출장';
    else if (/방문/.test(text)) scheduleType = '방문';
    else if (/미팅/.test(text)) scheduleType = '미팅';
    else if (/통화예약|통화요청|재통화/.test(text)) scheduleType = '통화예약';
    else scheduleType = '상담';

    const currentYear = referenceDate.getFullYear();
    let targetYear = currentYear;
    let targetMonth = referenceDate.getMonth() + 1;
    let targetDay = referenceDate.getDate();
    let hour = 14; // 기본 오후 2시
    let minute = 0;
    let foundDate = false;
    let foundTime = false;

    // 상대 날짜 감지
    const hasToday = /(?:금일|오늘|당일)/.test(text);
    const hasTomorrow = /(?:내일|명일)/.test(text);
    const hasDayAfterTomorrow = /모레/.test(text);

    // 과거 취소/연기된 일자 색출 (예: '11/3일 출장예정이었다가 취소하셨는데')
    const canceledDateRegex = /(\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}\/\d{1,2}|\d{1,2}\s*일)[^\n\.\,]*?(?:취소|연기|불발)/g;
    const canceledDates = new Set<string>();
    let cm: RegExpExecArray | null;
    while ((cm = canceledDateRegex.exec(text)) !== null) {
      canceledDates.add(cm[1].replace(/\s+/g, ''));
    }

    if (hasTomorrow) {
      const t = new Date(referenceDate);
      t.setDate(t.getDate() + 1);
      targetMonth = t.getMonth() + 1;
      targetDay = t.getDate();
      foundDate = true;
    } else if (hasDayAfterTomorrow) {
      const t = new Date(referenceDate);
      t.setDate(t.getDate() + 2);
      targetMonth = t.getMonth() + 1;
      targetDay = t.getDate();
      foundDate = true;
    } else if (hasToday) {
      targetMonth = referenceDate.getMonth() + 1;
      targetDay = referenceDate.getDate();
      foundDate = true;
    } else {
      // 절대 날짜 매칭 ("M월 D일" or "M/D")
      const mdMatches = [...text.matchAll(/(\d{1,2})\s*월\s*(\d{1,2})\s*일|(\d{1,2})\/(\d{1,2})/g)];
      for (const m of mdMatches) {
        const raw = m[0].replace(/\s+/g, '');
        if (canceledDates.has(raw)) continue; // 취소된 일자 스킵
        targetMonth = parseInt(m[1] || m[3], 10);
        targetDay = parseInt(m[2] || m[4], 10);
        foundDate = true;
        break;
      }

      if (!foundDate) {
        // "D일"
        const dMatches = [...text.matchAll(/(\d{1,2})\s*일/g)];
        for (const m of dMatches) {
          const raw = m[0].replace(/\s+/g, '');
          if (canceledDates.has(raw)) continue;
          targetDay = parseInt(m[1], 10);
          foundDate = true;
          break;
        }
      }
    }

    // 시간 파싱 (절대 NaN 방지 및 비즈니스 오후 시간 스마트 보정)
    const colonMatch = text.match(/(\d{1,2}):(\d{2})/);
    if (colonMatch) {
      hour = parseInt(colonMatch[1], 10);
      minute = parseInt(colonMatch[2], 10);
      foundTime = true;
    } else {
      // 한국어 시간 패턴: (오전|오후|낮|저녁|아침|밤)? N시 (M분/반)?
      const korTimeMatch = text.match(/(오전|오후|낮|저녁|아침|밤)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분|\s*반)?/);
      if (korTimeMatch) {
        const ampm = korTimeMatch[1];
        let h = parseInt(korTimeMatch[2], 10);
        let m = 0;
        if (korTimeMatch[0].includes('반')) {
          m = 30;
        } else if (korTimeMatch[3]) {
          m = parseInt(korTimeMatch[3], 10);
        }

        if (ampm === '오후' || ampm === '저녁' || ampm === '밤') {
          if (h < 12) h += 12;
        } else if (ampm === '오전' || ampm === '아침') {
          if (h === 12) h = 0;
        } else {
          // 비즈니스 미팅/상담: 1시~6시 사이는 통상 오후(13~18시)로 해석
          if (h >= 1 && h <= 6) h += 12;
        }
        hour = isNaN(h) ? 14 : h;
        minute = isNaN(m) ? 0 : m;
        foundTime = true;
      }
    }

    // 지역/장소 추출 (예: "부산 출장예약", "용인 출장", "가포고등학교", "마산")
    const locMatch = text.match(/([가-힣]{2,10}(?:시|군|구|동|역|학교|빌딩)?)\s*(?:출장|내방|방문|미팅|에서)/);
    const location = locMatch ? locMatch[1] : undefined;

    if (foundDate || foundTime) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${targetYear}-${pad(targetMonth)}-${pad(targetDay)}`;
      const timeStr = `${pad(hour)}:${pad(minute)}`;
      const datetimeIso = `${dateStr}T${timeStr}:00`;

      // 요일 구하기
      const dateObj = new Date(targetYear, targetMonth - 1, targetDay);
      const daysKo = ['일', '월', '화', '수', '목', '금', '토'];
      const dayOfWeek = daysKo[dateObj.getDay()];
      const displayHour = hour >= 12 ? (hour > 12 ? hour - 12 : 12) : (hour === 0 ? 12 : hour);
      const ampmKo = hour >= 12 ? '오후' : '오전';

      insights.schedule = {
        isSchedule: true,
        type: scheduleType,
        datetimeStr: datetimeIso,
        dateDisplay: `${targetMonth}월 ${targetDay}일(${dayOfWeek}) ${ampmKo} ${displayHour}시 ${pad(minute)}분 [${scheduleType}${location ? ` - ${location}` : ''}]`,
        location,
        rawText: text,
      };
    }
  }

  return insights;
}
