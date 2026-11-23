// ==============================================================================
// services/seatExpansionService.ts
// 라이선스 좌석(Seat) 증설 요청 및 플랫폼 총괄 어드민(HOST) 실시간 알림 서비스
// DB 테이블: public.seat_expansion_requests (Migration 048)
// 폴백 지원: settings 테이블 + localStorage + Supabase Realtime Broadcast
// ==============================================================================
import { supabase } from './supabase';
import { updateOrgFeaturePermissions, getOrgFeaturePermissions } from './platform';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface SeatExpansionRequest {
  id: string;
  orgId: string;
  orgName: string;
  requesterEmail: string;
  requesterName?: string;
  currentSeats: number;
  requestedSeats: number;
  memo?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SeatExpansionInput {
  orgId: string;
  orgName: string;
  requesterEmail: string;
  requesterName?: string;
  currentSeats: number;
  requestedSeats: number;
  memo?: string;
}

const LOCAL_STORAGE_KEY = 'lm_seat_expansion_requests';
const REALTIME_CHANNEL_NAME = 'platform_admin_alerts';

/** 로컬 스토리지 백업 데이터 가져오기 */
const getLocalSeatRequests = (): SeatExpansionRequest[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/** 로컬 스토리지 백업 저장 */
const saveLocalSeatRequests = (list: SeatExpansionRequest[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('[SeatExpansion] local backup save error:', e);
  }
};

/**
 * 1. 팀 대표의 좌석 증설 요청 접수
 * - DB 저장 및 Supabase Realtime 브로드캐스트로 플랫폼 총괄 어드민에 즉시 팝업/알림 전파
 */
export const submitSeatExpansionRequest = async (
  input: SeatExpansionInput
): Promise<SeatExpansionRequest> => {
  const orgId = input.orgId;
  const orgName = (input.orgName || '우리 조직').trim();
  const requesterEmail = (input.requesterEmail || '').trim().toLowerCase();
  const requesterName = (input.requesterName || '').trim();
  const currentSeats = Math.max(0, Number(input.currentSeats) || 0);
  const requestedSeats = Number(input.requestedSeats);
  const memo = (input.memo || '').trim();
  const now = new Date().toISOString();

  if (!orgId) throw new Error('조직 고유 식별자가 누락되었습니다.');
  if (!requestedSeats || requestedSeats <= currentSeats) {
    throw new Error(`현재 좌석(${currentSeats}석)보다 큰 희망 좌석 수를 입력해주세요.`);
  }

  const newRequest: SeatExpansionRequest = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `seat-req-${Date.now()}`,
    orgId,
    orgName,
    requesterEmail,
    requesterName,
    currentSeats,
    requestedSeats,
    memo,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  // 1. Supabase 전용 테이블에 저장 시도
  let savedToDb = false;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('seat_expansion_requests')
        .insert({
          id: newRequest.id,
          org_id: orgId,
          org_name: orgName,
          requester_email: requesterEmail,
          requester_name: requesterName,
          current_seats: currentSeats,
          requested_seats: requestedSeats,
          memo,
          status: 'pending',
        })
        .select()
        .single();

      if (!error && data) {
        newRequest.id = data.id || newRequest.id;
        savedToDb = true;
      } else if (error) {
        console.warn('[SeatExpansion] Supabase table insert warning, using settings fallback:', error.message);
      }
    } catch (e) {
      console.warn('[SeatExpansion] DB insert network error:', e);
    }

    // 2. 만약 전용 테이블이 아직 없을 경우 공용 settings 테이블에 백업 upsert
    if (!savedToDb) {
      try {
        const { data: currentSettings } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'seat_expansion_requests')
          .maybeSingle();

        const existingList: SeatExpansionRequest[] = currentSettings?.value || [];
        const updatedList = [newRequest, ...existingList.filter(r => r.id !== newRequest.id)];

        await supabase
          .from('settings')
          .upsert({
            key: 'seat_expansion_requests',
            value: updatedList,
          });
      } catch (settingsErr) {
        console.warn('[SeatExpansion] settings table fallback error:', settingsErr);
      }
    }

    // 3. 실시간 알림 브로드캐스트 전송 (플랫폼 총괄 어드민 페이지에 실시간 팝업 트리거)
    try {
      const channel = supabase.channel(REALTIME_CHANNEL_NAME);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'seat_request',
            payload: newRequest,
          });
        }
      });
    } catch (realtimeErr) {
      console.warn('[SeatExpansion] Realtime broadcast error:', realtimeErr);
    }
  }

  // 4. 로컬 스토리지에 보존
  const localList = getLocalSeatRequests();
  const updatedLocal = [newRequest, ...localList.filter(r => r.id !== newRequest.id)];
  saveLocalSeatRequests(updatedLocal);

  // 5. 윈도우 커스텀 이벤트 (동일 브라우저 탭/창 실시간 연동)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lm_seat_request_created', { detail: newRequest }));
  }

  return newRequest;
};

/**
 * 2. 플랫폼 관리자용: 좌석 증설 요청 목록 전체 조회
 */
export const fetchSeatExpansionRequests = async (): Promise<SeatExpansionRequest[]> => {
  let dbList: SeatExpansionRequest[] = [];
  let foundInDb = false;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('seat_expansion_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        dbList = data.map((r: any) => ({
          id: r.id,
          orgId: r.org_id,
          orgName: r.org_name,
          requesterEmail: r.requester_email,
          requesterName: r.requester_name || '',
          currentSeats: Number(r.current_seats || 0),
          requestedSeats: Number(r.requested_seats || 0),
          memo: r.memo || '',
          status: r.status,
          approvedBy: r.approved_by || undefined,
          approvedAt: r.approved_at || undefined,
          rejectionReason: r.rejection_reason || undefined,
          rejectedAt: r.rejected_at || undefined,
          createdAt: r.created_at,
          updatedAt: r.updated_at || undefined,
        }));
        foundInDb = true;
      }
    } catch (e) {
      console.warn('[SeatExpansion] fetch error:', e);
    }

    // 전용 테이블에 없거나 비어있는 경우 settings 테이블 조회
    if (!foundInDb) {
      try {
        const { data: settingsRow } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'seat_expansion_requests')
          .maybeSingle();

        if (settingsRow?.value && Array.isArray(settingsRow.value)) {
          dbList = settingsRow.value;
          foundInDb = true;
        }
      } catch (settingsErr) {
        console.warn('[SeatExpansion] settings fetch error:', settingsErr);
      }
    }
  }

  // 로컬 스토리지 목록과 병합 (중복 제거)
  const localList = getLocalSeatRequests();
  const mergedMap = new Map<string, SeatExpansionRequest>();

  // DB 데이터 우선 저장
  dbList.forEach(r => mergedMap.set(r.id, r));
  // 로컬에만 있는 최신 내역 보충
  localList.forEach(r => {
    if (!mergedMap.has(r.id)) {
      mergedMap.set(r.id, r);
    }
  });

  const merged = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return merged;
};

/**
 * 3. 플랫폼 총괄 어드민: 좌석 증설 요청 승인 (즉시 maxSeats 한도 반영)
 */
export const approveSeatExpansionRequest = async (
  requestId: string,
  orgId: string,
  requestedSeats: number,
  approvedBy: string = '플랫폼 총괄 관리자'
): Promise<void> => {
  const now = new Date().toISOString();

  // 1. 해당 테넌트(조직)의 maxSeats 권한 즉시 업데이트
  try {
    await updateOrgFeaturePermissions(orgId, {
      maxSeats: requestedSeats,
    });
  } catch (err) {
    console.warn('[SeatExpansion] maxSeats 권한 업데이트 경고:', err);
  }

  // 2. 요청 레코드 상태 'approved'로 갱신
  if (supabase) {
    try {
      await supabase
        .from('seat_expansion_requests')
        .update({
          status: 'approved',
          approved_by: approvedBy,
          approved_at: now,
          updated_at: now,
        })
        .eq('id', requestId);
    } catch {}

    // settings 백업 테이블 동기화
    try {
      const { data: settingsRow } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'seat_expansion_requests')
        .maybeSingle();

      if (settingsRow?.value && Array.isArray(settingsRow.value)) {
        const updated = settingsRow.value.map((r: SeatExpansionRequest) =>
          r.id === requestId
            ? { ...r, status: 'approved' as const, approvedBy, approvedAt: now, updatedAt: now }
            : r
        );
        await supabase
          .from('settings')
          .upsert({ key: 'seat_expansion_requests', value: updated });
      }
    } catch {}

    // 승인 완료 브로드캐스트
    try {
      const channel = supabase.channel(REALTIME_CHANNEL_NAME);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'seat_approved',
            payload: { requestId, orgId, requestedSeats, approvedAt: now },
          });
        }
      });
    } catch {}
  }

  // 3. 로컬 스토리지 갱신
  const localList = getLocalSeatRequests().map(r =>
    r.id === requestId
      ? { ...r, status: 'approved' as const, approvedBy, approvedAt: now, updatedAt: now }
      : r
  );
  saveLocalSeatRequests(localList);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lm_seat_request_approved', {
      detail: { requestId, orgId, requestedSeats }
    }));
  }
};

/**
 * 4. 플랫폼 총괄 어드민: 좌석 증설 요청 반려
 */
export const rejectSeatExpansionRequest = async (
  requestId: string,
  rejectionReason: string = '운영 정책 및 심사 기준 미달'
): Promise<void> => {
  const now = new Date().toISOString();

  if (supabase) {
    try {
      await supabase
        .from('seat_expansion_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          rejected_at: now,
          updated_at: now,
        })
        .eq('id', requestId);
    } catch {}

    try {
      const { data: settingsRow } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'seat_expansion_requests')
        .maybeSingle();

      if (settingsRow?.value && Array.isArray(settingsRow.value)) {
        const updated = settingsRow.value.map((r: SeatExpansionRequest) =>
          r.id === requestId
            ? { ...r, status: 'rejected' as const, rejectionReason, rejectedAt: now, updatedAt: now }
            : r
        );
        await supabase
          .from('settings')
          .upsert({ key: 'seat_expansion_requests', value: updated });
      }
    } catch {}

    try {
      const channel = supabase.channel(REALTIME_CHANNEL_NAME);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'seat_rejected',
            payload: { requestId, rejectionReason, rejectedAt: now },
          });
        }
      });
    } catch {}
  }

  const localList = getLocalSeatRequests().map(r =>
    r.id === requestId
      ? { ...r, status: 'rejected' as const, rejectionReason, rejectedAt: now, updatedAt: now }
      : r
  );
  saveLocalSeatRequests(localList);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lm_seat_request_rejected', {
      detail: { requestId, rejectionReason }
    }));
  }
};

/**
 * 5. 플랫폼 총괄 어드민용 실시간 알림 구독기
 * - 신규 좌석 증설 신청, 신규 가입 신청 발생 시 콜백 호출
 */
export const subscribeToPlatformAlerts = (
  onAlert: (event: { type: 'seat_request' | 'seat_approved' | 'seat_rejected' | 'new_app'; data: any }) => void
): (() => void) => {
  let channel: RealtimeChannel | null = null;

  if (supabase) {
    try {
      channel = supabase
        .channel(REALTIME_CHANNEL_NAME)
        .on('broadcast', { event: 'seat_request' }, (payload) => {
          onAlert({ type: 'seat_request', data: payload.payload });
        })
        .on('broadcast', { event: 'seat_approved' }, (payload) => {
          onAlert({ type: 'seat_approved', data: payload.payload });
        })
        .on('broadcast', { event: 'seat_rejected' }, (payload) => {
          onAlert({ type: 'seat_rejected', data: payload.payload });
        })
        .subscribe();
    } catch (e) {
      console.warn('[SeatExpansion] Realtime subscription error:', e);
    }
  }

  // 윈도우 이벤트 리스너도 함께 바인딩
  const handleLocalReq = (e: any) => onAlert({ type: 'seat_request', data: e.detail });
  const handleLocalApprove = (e: any) => onAlert({ type: 'seat_approved', data: e.detail });
  const handleLocalReject = (e: any) => onAlert({ type: 'seat_rejected', data: e.detail });

  if (typeof window !== 'undefined') {
    window.addEventListener('lm_seat_request_created', handleLocalReq);
    window.addEventListener('lm_seat_request_approved', handleLocalApprove);
    window.addEventListener('lm_seat_request_rejected', handleLocalReject);
  }

  return () => {
    if (channel && supabase) {
      supabase.removeChannel(channel);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('lm_seat_request_created', handleLocalReq);
      window.removeEventListener('lm_seat_request_approved', handleLocalApprove);
      window.removeEventListener('lm_seat_request_rejected', handleLocalReject);
    }
  };
};
