/**
 * 회사별 텔레그램 피드백 자동화 룰 엔진 서비스
 * 
 * 회사마다 다른 상태 관리 및 후속 조치 방침(예: 부재 시 바로 완료/종결 vs 자동 재통화 예정 배정)을
 * Supabase settings (key: 'telegram_feedback_rules')에 멀티테넌트(org_id) 단위로 저장/관리합니다.
 */

import { supabase } from './supabase';

export interface TelegramFeedbackRuleItem {
  feedbackType: string;
  label: string;
  applyMode: 'auto' | 'pending';       // 'auto' = 즉시 CRM 자동 반영(오토파일럿), 'pending' = 관리자 승인 대기
  targetStatus: string;                // 변경할 케이스 상태 (예: '재통화 예정', '종결', '계약 완료' 등)
  targetSecondaryStatus?: string;      // 보조 상태 (예: '부재 1차', '1차 재케어 요망' 등)
  incrementMissedCall: boolean;        // 부재 횟수(+1) 누적 여부
  queueToLiteDial: boolean;            // 간편콜(신입)/재통화 대기 큐 인입 여부
  autoCalendar: boolean;               // 캘린더 일정/리마인더 자동 생성 여부
  flagCareNeeded: boolean;             // 1차 TM 재케어(관리요망) 플래그 부착 및 담당자 알림 여부
}

export type TelegramCompanyRules = Record<string, TelegramFeedbackRuleItem>;

// 1. 기본 추천 프리셋 (균형 잡힌 표준 오토파일럿)
export const PRESET_SMART_DEFAULT: TelegramCompanyRules = {
  '부재': {
    feedbackType: '부재',
    label: '부재 / 연락두절',
    applyMode: 'auto',
    targetStatus: '재통화 예정',
    targetSecondaryStatus: '부재',
    incrementMissedCall: true,
    queueToLiteDial: true,
    autoCalendar: false,
    flagCareNeeded: false,
  },
  '지속부재': {
    feedbackType: '지속부재',
    label: '지속 부재',
    applyMode: 'auto',
    targetStatus: '재통화 예정',
    targetSecondaryStatus: '지속부재',
    incrementMissedCall: true,
    queueToLiteDial: true,
    autoCalendar: false,
    flagCareNeeded: false,
  },
  '출장예약': {
    feedbackType: '출장예약',
    label: '출장 상담 예약',
    applyMode: 'auto', // 즉시 자동 저장 (캘린더 리마인더 생성 및 상태 반영)
    targetStatus: '상담중',
    targetSecondaryStatus: '출장예약',
    incrementMissedCall: false,
    queueToLiteDial: false,
    autoCalendar: true,
    flagCareNeeded: false,
  },
  '방문예약': {
    feedbackType: '방문예약',
    label: '내방 / 방문 예약',
    applyMode: 'auto', // 즉시 자동 저장
    targetStatus: '상담중',
    targetSecondaryStatus: '내방예약',
    incrementMissedCall: false,
    queueToLiteDial: false,
    autoCalendar: true,
    flagCareNeeded: false,
  },
  '미팅예약': {
    feedbackType: '미팅예약',
    label: '미팅 / 상담 예약',
    applyMode: 'auto', // 즉시 자동 저장
    targetStatus: '상담중',
    targetSecondaryStatus: '미팅예약',
    incrementMissedCall: false,
    queueToLiteDial: false,
    autoCalendar: true,
    flagCareNeeded: false,
  },
  '통화예약': {
    feedbackType: '통화예약',
    label: '통화 예약 / 재통화',
    applyMode: 'auto',
    targetStatus: '재통화 예정',
    targetSecondaryStatus: '통화예약',
    incrementMissedCall: false,
    queueToLiteDial: true,
    autoCalendar: true,
    flagCareNeeded: false,
  },
  '비용부담거절': {
    feedbackType: '비용부담거절',
    label: '비용 부담 / 가족 상의',
    applyMode: 'auto',
    targetStatus: '재통화 예정',
    targetSecondaryStatus: '1차 재케어 요망',
    incrementMissedCall: false,
    queueToLiteDial: true,
    autoCalendar: false,
    flagCareNeeded: true,
  },
  '계약완료': {
    feedbackType: '계약완료',
    label: '계약 / 수임 / 입금 완료',
    applyMode: 'pending', // 수임료 및 계약금 확인을 위해 승인 대기 권장
    targetStatus: '계약 완료',
    targetSecondaryStatus: '수임완료',
    incrementMissedCall: false,
    queueToLiteDial: false,
    autoCalendar: false,
    flagCareNeeded: false,
  },
  '진행불가': {
    feedbackType: '진행불가',
    label: '진행불가 / 자격미달',
    applyMode: 'auto',
    targetStatus: '진행불가',
    targetSecondaryStatus: '조건불가',
    incrementMissedCall: false,
    queueToLiteDial: false,
    autoCalendar: false,
    flagCareNeeded: false,
  },
  '서류안내': {
    feedbackType: '서류안내',
    label: '서류 안내 / 명함 발송',
    applyMode: 'auto',
    targetStatus: '상담중',
    targetSecondaryStatus: '서류안내중',
    incrementMissedCall: false,
    queueToLiteDial: false,
    autoCalendar: false,
    flagCareNeeded: false,
  },
};

// 2. 패스트 종결 프리셋 (부재/거절 발생 시 신속 완료 처리하여 회전율 극대화)
export const PRESET_FAST_CLOSE: TelegramCompanyRules = {
  ...PRESET_SMART_DEFAULT,
  '부재': {
    ...PRESET_SMART_DEFAULT['부재'],
    applyMode: 'auto',
    targetStatus: '진행불가',
    targetSecondaryStatus: '부재종결',
    incrementMissedCall: true,
    queueToLiteDial: false,
  },
  '지속부재': {
    ...PRESET_SMART_DEFAULT['지속부재'],
    applyMode: 'auto',
    targetStatus: '진행불가',
    targetSecondaryStatus: '지속부재종결',
    incrementMissedCall: true,
    queueToLiteDial: false,
  },
  '비용부담거절': {
    ...PRESET_SMART_DEFAULT['비용부담거절'],
    applyMode: 'auto',
    targetStatus: '고객취소',
    targetSecondaryStatus: '비용부담거절종결',
    queueToLiteDial: false,
    flagCareNeeded: false,
  },
};

// 3. 철저 재케어 프리셋 (모든 부재 및 보류 건을 1차 TM에게 자동 재배정)
export const PRESET_DEEP_CARE: TelegramCompanyRules = {
  ...PRESET_SMART_DEFAULT,
  '부재': {
    ...PRESET_SMART_DEFAULT['부재'],
    applyMode: 'auto',
    targetStatus: '재통화 예정',
    targetSecondaryStatus: '1차 TM 긴급 재콜',
    incrementMissedCall: true,
    queueToLiteDial: true,
    flagCareNeeded: true,
  },
  '비용부담거절': {
    ...PRESET_SMART_DEFAULT['비용부담거절'],
    applyMode: 'auto',
    targetStatus: '재통화 예정',
    targetSecondaryStatus: '1차 TM 비용 재상담',
    incrementMissedCall: false,
    queueToLiteDial: true,
    flagCareNeeded: true,
  },
  '출장예약': {
    ...PRESET_SMART_DEFAULT['출장예약'],
    applyMode: 'auto', // 출장도 캘린더에 즉시 자동 반영
    autoCalendar: true,
  },
};

const SETTINGS_KEY = 'telegram_feedback_rules';

// 메모리 캐시
let cachedRules: TelegramCompanyRules | null = null;

/**
 * 회사의 텔레그램 피드백 룰 조회
 */
export async function fetchTelegramCompanyRules(orgId?: string): Promise<TelegramCompanyRules> {
  if (cachedRules) return cachedRules;

  try {
    if (supabase) {
      let query = supabase.from('settings').select('value').eq('key', SETTINGS_KEY);
      if (orgId) {
        query = query.eq('org_id', orgId);
      }
      const { data, error } = await query.maybeSingle();
      if (!error && data?.value) {
        cachedRules = { ...PRESET_SMART_DEFAULT, ...data.value };
        return cachedRules;
      }
    }
  } catch (err) {
    console.warn('[TelegramRules] Failed to load from server, using default:', err);
  }

  // 로컬스토리지 fallback
  try {
    const local = localStorage.getItem(`lm_rules_${orgId || 'default'}`);
    if (local) {
      cachedRules = { ...PRESET_SMART_DEFAULT, ...JSON.parse(local) };
      return cachedRules;
    }
  } catch {}

  cachedRules = { ...PRESET_SMART_DEFAULT };
  return cachedRules;
}

/**
 * 회사의 텔레그램 피드백 룰 저장
 */
export async function saveTelegramCompanyRules(rules: TelegramCompanyRules, orgId?: string): Promise<boolean> {
  cachedRules = rules;

  try {
    if (supabase) {
      const { error } = await supabase.from('settings').upsert({
        key: SETTINGS_KEY,
        value: rules,
        updated_at: new Date().toISOString(),
        ...(orgId ? { org_id: orgId } : {}),
      }, { onConflict: 'org_id,key' });

      if (error) {
        console.error('[TelegramRules] Save error:', error);
      }
    }
  } catch (err) {
    console.error('[TelegramRules] Save exception:', err);
  }

  try {
    localStorage.setItem(`lm_rules_${orgId || 'default'}`, JSON.stringify(rules));
  } catch {}

  return true;
}
