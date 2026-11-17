// ==============================================================================
// services/sessionGuard.ts
// 1계정당 [PC 웹 1대] + [안드로이드 폰 1대] 단일 세션 강제화 및 중복 로그인 킥아웃
// 조직 라이선스 좌석 수 (maxSeats) 하드 리밋 검증
// ==============================================================================
import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export type SessionPlatform = 'web' | 'android';

export interface KickoutEvent {
  reason: 'duplicate_login' | 'seat_limit_exceeded' | 'admin_forced';
  platform: SessionPlatform;
  timestamp: number;
  message?: string;
}

export interface OrgSeatStatus {
  maxSeats: number;
  activeMembers: number;
  pendingInvites: number;
  totalOccupied: number;
  remainingSeats: number;
  isLimitReached: boolean;
}

/** 현재 실행 환경이 안드로이드 전용 앱인지 판별 */
export const detectCurrentPlatform = (): SessionPlatform => {
  if (typeof window === 'undefined') return 'web';
  const bridge = (window as any).AndroidBridge;
  if (bridge?.isAndroidApp?.() || bridge?.supportsAppSession?.()) {
    return 'android';
  }
  return 'web';
};

/** 브라우저 세션당 고유 ID 생성/유지 (탭 새로고침 시 유지, 새 창/기기에서는 신규 발급) */
export const getOrCreateSessionId = (): string => {
  if (typeof window === 'undefined') return 'server-session';
  let sid = sessionStorage.getItem('leadmaster_session_id');
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    sessionStorage.setItem('leadmaster_session_id', sid);
  }
  return sid;
};

let activeChannel: RealtimeChannel | null = null;
let heartbeatTimer: any = null;
let currentEmail: string | null = null;
let kickoutCallback: ((event: KickoutEvent) => void) | null = null;

/**
 * 실시간 세션 가드 초기화 및 중복 로그인 감시 시작
 */
export const startSessionGuard = async (
  email: string,
  userId?: string,
  onKickout?: (event: KickoutEvent) => void
): Promise<void> => {
  if (!email || !supabase) return;

  const cleanEmail = email.trim().toLowerCase();
  const platform = detectCurrentPlatform();
  const sessionId = getOrCreateSessionId();

  currentEmail = cleanEmail;
  if (onKickout) kickoutCallback = onKickout;

  // 1. 기존 채널 및 타이머 정리
  stopSessionGuard();

  // 2. DB에 현재 세션 등록 (RPC)
  try {
    const { data, error } = await supabase.rpc('register_user_session', {
      p_platform: platform,
      p_session_id: sessionId,
      p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
    if (error) {
      console.warn('[SessionGuard] RPC register session warning:', error.message);
    } else {
      console.log('[SessionGuard] Registered active session:', platform, sessionId, data);
    }
  } catch (err) {
    console.warn('[SessionGuard] Failed to register session in DB:', err);
  }

  // 3. Supabase Realtime Broadcast 채널 구독 (0.1초 실시간 킥아웃 통지)
  const channelName = `session_guard_${cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  activeChannel = supabase.channel(channelName, {
    config: { broadcast: { self: false } },
  });

  activeChannel
    .on('broadcast', { event: 'kickout' }, ({ payload }) => {
      // 나에게 온 킥아웃 메시지인지 확인:
      // 동일 플랫폼(web이면 web, android면 android)이고 세션 ID가 나와 다르면 중복 로그인 발생!
      if (payload && payload.platform === platform && payload.newSessionId !== sessionId) {
        console.warn('[SessionGuard] Duplicate login detected! Triggering kickout.');
        if (kickoutCallback) {
          kickoutCallback({
            reason: 'duplicate_login',
            platform,
            timestamp: payload.timestamp || Date.now(),
            message: payload.message || '동일한 계정으로 다른 기기(브라우저)에서 새로 로그인되었습니다.',
          });
        }
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // 구독 완료 시 다른 기기에 새 세션 시작 알림(브로드캐스트)을 보내어 이전 세션을 종료시킴
        activeChannel?.send({
          type: 'broadcast',
          event: 'kickout',
          payload: {
            platform,
            newSessionId: sessionId,
            timestamp: Date.now(),
            message: '동일한 계정으로 다른 기기(브라우저)에서 새로 로그인되었습니다.',
          },
        });
      }
    });

  // 4. 주기적 하트비트 검증 (45초 주기: 네트워크 복귀나 Realtime 미수신 시 안전망)
  heartbeatTimer = setInterval(async () => {
    if (!supabase || !currentEmail) return;
    try {
      const { data: isValid, error } = await supabase.rpc('check_user_session_valid', {
        p_platform: platform,
        p_session_id: sessionId,
      });

      if (!error && isValid === false) {
        console.warn('[SessionGuard] Heartbeat check failed! Session was replaced by another device.');
        if (kickoutCallback) {
          kickoutCallback({
            reason: 'duplicate_login',
            platform,
            timestamp: Date.now(),
            message: '동일한 계정으로 다른 기기(브라우저)에서 새로 로그인되었습니다.',
          });
        }
      }
    } catch (err) {
      // 네트워크 일시 오류 무시
    }
  }, 45000);
};

/**
 * 세션 가드 감시 중단
 */
export const stopSessionGuard = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (activeChannel) {
    supabase?.removeChannel(activeChannel);
    activeChannel = null;
  }
  currentEmail = null;
};

/**
 * 조직 라이선스 좌석 수 (maxSeats) 및 잔여 좌석 상태 조회
 */
export const checkOrgSeatLimit = async (orgId: string): Promise<OrgSeatStatus> => {
  if (!supabase || !orgId) {
    return {
      maxSeats: 20,
      activeMembers: 0,
      pendingInvites: 0,
      totalOccupied: 0,
      remainingSeats: 20,
      isLimitReached: false,
    };
  }

  try {
    const { data, error } = await supabase.rpc('check_org_seat_availability', {
      p_org_id: orgId,
    });

    if (error || !data) {
      console.warn('[SessionGuard] check_org_seat_availability error:', error?.message);
      return {
        maxSeats: 20,
        activeMembers: 0,
        pendingInvites: 0,
        totalOccupied: 0,
        remainingSeats: 20,
        isLimitReached: false,
      };
    }

    return {
      maxSeats: Number(data.max_seats ?? 20),
      activeMembers: Number(data.active_members ?? 0),
      pendingInvites: Number(data.pending_invites ?? 0),
      totalOccupied: Number(data.total_occupied ?? 0),
      remainingSeats: Number(data.remaining_seats ?? 0),
      isLimitReached: Boolean(data.is_limit_reached),
    };
  } catch (err) {
    console.warn('[SessionGuard] Error checking seat availability:', err);
    return {
      maxSeats: 20,
      activeMembers: 0,
      pendingInvites: 0,
      totalOccupied: 0,
      remainingSeats: 20,
      isLimitReached: false,
    };
  }
};
