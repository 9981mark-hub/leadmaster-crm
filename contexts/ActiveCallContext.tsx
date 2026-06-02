import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

// ============================================
// Active Call State Management
// ============================================

export type ActiveCallMode = 'pending' | 'dialing' | 'calling' | 'ended';

interface ActiveCallState {
    isActive: boolean;
    mode: ActiveCallMode;
    customerName: string;
    phoneNumber: string;
    caseId?: string;
    startedAt?: Date;
    dialedAt?: string;
}

interface ActiveCallContextType {
    callState: ActiveCallState;
    startCall: (name: string, phone: string, caseId?: string) => void;
    dismissCall: () => void;
}

const initialState: ActiveCallState = {
    isActive: false,
    mode: 'pending',
    customerName: '',
    phoneNumber: '',
};

const ActiveCallContext = createContext<ActiveCallContextType>({
    callState: initialState,
    startCall: () => {},
    dismissCall: () => {},
});

export const useActiveCall = () => useContext(ActiveCallContext);

// phone → cases 매칭으로 고객명 찾기 (캐시된 cases 사용)
const findCustomerByPhone = async (phone: string): Promise<{ name: string; caseId?: string } | null> => {
    try {
        const { fetchCases } = await import('../services/api');
        const cases = await fetchCases();
        const normalizedPhone = phone.replace(/[^0-9]/g, '');
        const found = cases.find(c => c.phone.replace(/[^0-9]/g, '') === normalizedPhone);
        if (found) {
            return { name: found.customerName, caseId: found.caseId };
        }
    } catch (e) {
        console.error('[ActiveCall] Failed to find customer by phone:', e);
    }
    return null;
};

// 전화번호 정규화 유틸
const normalizePhone = (phone: string) => phone.replace(/[^0-9]/g, '');

export const ActiveCallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [callState, setCallState] = useState<ActiveCallState>(initialState);
    const channelRef = useRef<any>(null);
    const pendingCallChannelRef = useRef<any>(null);

    // 발신 시작
    const startCall = useCallback((name: string, phone: string, caseId?: string) => {
        setCallState({
            isActive: true,
            mode: 'pending',
            customerName: name,
            phoneNumber: phone,
            caseId,
            startedAt: new Date(),
        });
    }, []);

    // 팝업 종료
    const dismissCall = useCallback(() => {
        setCallState(initialState);
    }, []);

    // ============================================
    // Supabase Realtime: communication_logs 구독
    // ============================================
    useEffect(() => {
        if (!supabase) return;

        channelRef.current = supabase
            .channel('active-call-monitor')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'communication_logs' },
                async (payload: any) => {
                    const row = payload.new;
                    if (!row) return;

                    const type = row.type; // CALL_OUT | CALL_IN | SMS_OUT | etc.
                    const phone = row.phone_number;

                    if (type === 'CALL_OUT') {
                        // 발신 감지 → 통화중 모드로 전환 또는 새 발신자 정보 갱신
                        const customer = await findCustomerByPhone(phone);
                        setCallState(prev => {
                            if (prev.isActive) {
                                // 기존 팝업이 있으면 정보 갱신 + calling 모드
                                return {
                                    ...prev,
                                    mode: 'calling',
                                    customerName: customer?.name || phone,
                                    phoneNumber: phone,
                                    caseId: customer?.caseId,
                                    startedAt: new Date(),
                                };
                            } else {
                                // 팝업이 없으면 새로 생성 (핸드폰에서 직접 발신한 경우)
                                return {
                                    isActive: true,
                                    mode: 'calling',
                                    customerName: customer?.name || phone,
                                    phoneNumber: phone,
                                    caseId: customer?.caseId,
                                    startedAt: new Date(),
                                };
                            }
                        });
                    } else if (type === 'CALL_IN') {
                        // 수신 감지 → 미니팝업 자동 종료
                        setCallState(prev => {
                            if (prev.isActive && prev.mode === 'ended') {
                                return initialState;
                            }
                            // 통화중이면 ended로 전환 후 종료 (수신이 들어왔으니 이전 발신은 끝)
                            if (prev.isActive) {
                                return initialState;
                            }
                            return prev;
                        });
                    }
                }
            )
            .subscribe((status: string) => {
                console.log('[ActiveCall] Realtime communication_logs status:', status);
            });

        return () => {
            if (channelRef.current && supabase) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, []);

    // ============================================
    // Supabase Realtime: pending_calls 구독
    // Android가 pending_calls 상태를 업데이트하면 즉시 감지
    // dialed → calling 모드, ended → ended 모드 (자동 dismiss)
    // ============================================
    useEffect(() => {
        if (!supabase) return;

        pendingCallChannelRef.current = supabase
            .channel('pending-call-monitor')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'pending_calls' },
                (payload: any) => {
                    const row = payload.new;
                    if (!row) return;

                    const status = row.status;
                    const rowPhone = normalizePhone(row.phone_number || '');

                    setCallState(prev => {
                        if (!prev.isActive) return prev;

                        const prevPhone = normalizePhone(prev.phoneNumber);

                        // 전화번호가 매칭되는 경우만 처리
                        if (rowPhone && prevPhone && rowPhone !== prevPhone) return prev;

                        if (status === 'dialed') {
                            const dbDialedAt = row.dialed_at;
                            const dbCustomerName = row.customer_name || '';
                            const isCallingMarker = dbCustomerName.includes('::calling');
                            const cleanCustomerName = dbCustomerName.replace('::calling', '');

                            if (isCallingMarker) {
                                console.log('[ActiveCall] pending_calls: ::calling marker found → calling mode, name:', cleanCustomerName);
                                return {
                                    ...prev,
                                    mode: 'calling',
                                    customerName: cleanCustomerName || prev.customerName,
                                    startedAt: dbDialedAt ? new Date(dbDialedAt) : new Date(),
                                    dialedAt: dbDialedAt
                                };
                            }

                            if (prev.mode === 'pending' || (prev.mode === 'dialing' && !prev.dialedAt)) {
                                // Android가 다이얼러를 열었음 → 연결 대기 (아직 통화 시작 아님)
                                console.log('[ActiveCall] pending_calls: dialed → dialing mode, dialedAt:', dbDialedAt);
                                return { 
                                    ...prev, 
                                    mode: 'dialing', 
                                    customerName: cleanCustomerName || prev.customerName,
                                    dialedAt: dbDialedAt 
                                };
                            } else if (prev.mode === 'dialing') {
                                // 이미 연결 대기 중인데 dialed_at이 업데이트 됨 -> Android가 통화 시작(OFFHOOK) 감지!
                                if (dbDialedAt && prev.dialedAt !== dbDialedAt) {
                                    console.log('[ActiveCall] pending_calls: dialed_at changed → calling mode, new dialedAt:', dbDialedAt);
                                    return { 
                                        ...prev, 
                                        mode: 'calling', 
                                        customerName: cleanCustomerName || prev.customerName,
                                        startedAt: new Date(dbDialedAt), 
                                        dialedAt: dbDialedAt 
                                    };
                                }
                            }
                        }

                        if (status === 'ended') {
                            // Android가 통화 종료를 감지함 → ended
                            console.log('[ActiveCall] pending_calls: ended → ended mode');
                            return { ...prev, mode: 'ended' };
                        }

                        return prev;
                    });
                }
            )
            .subscribe((status: string) => {
                console.log('[ActiveCall] Realtime pending_calls status:', status);
            });

        return () => {
            if (pendingCallChannelRef.current && supabase) {
                supabase.removeChannel(pendingCallChannelRef.current);
            }
        };
    }, []);

    // ============================================
    // 통화 종료 후 자동 dismiss (5초)
    // ============================================
    useEffect(() => {
        if (callState.mode !== 'ended') return;

        const timer = setTimeout(() => {
            setCallState(initialState);
        }, 5000);

        return () => clearTimeout(timer);
    }, [callState.mode]);

    // ============================================
    // Polling Fallback: Realtime 연결 끊김 및 복제 누락 대비
    // ============================================
    useEffect(() => {
        if (!supabase || !callState.isActive || callState.mode === 'ended') return;

        const cleanPhone = normalizePhone(callState.phoneNumber);
        if (!cleanPhone) return;

        const pollInterval = setInterval(async () => {
            try {
                const { data, error } = await supabase
                    .from('pending_calls')
                    .select('status, dialed_at, customer_name')
                    .eq('phone_number', cleanPhone)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (error || !data || data.length === 0) return;

                const latestCall = data[0];
                const status = latestCall.status;

                setCallState(prev => {
                    if (!prev.isActive) return prev;

                    const dbDialedAt = latestCall.dialed_at;
                    const dbCustomerName = latestCall.customer_name || '';
                    const isCallingMarker = dbCustomerName.includes('::calling');
                    const cleanCustomerName = dbCustomerName.replace('::calling', '');

                    // 데이터베이스 상태와 현재 모드가 일치하며 dialed_at 및 이름까지 같은 경우 변경 없음
                    if (status === 'pending' && prev.mode === 'pending') return prev;
                    if (status === 'dialed' && prev.mode === 'calling' && prev.customerName === cleanCustomerName && prev.dialedAt === dbDialedAt) return prev;
                    if (status === 'dialed' && prev.mode === 'dialing' && !isCallingMarker && prev.dialedAt === dbDialedAt) return prev;
                    if (status === 'ended' && prev.mode === 'ended') return prev;

                    if (status === 'dialed') {
                        if (isCallingMarker) {
                            console.log('[ActiveCall Poll] pending_calls: ::calling marker found → calling mode, name:', cleanCustomerName);
                            return {
                                ...prev,
                                mode: 'calling',
                                customerName: cleanCustomerName || prev.customerName,
                                startedAt: dbDialedAt ? new Date(dbDialedAt) : new Date(),
                                dialedAt: dbDialedAt
                            };
                        }

                        if (prev.mode === 'pending' || (prev.mode === 'dialing' && !prev.dialedAt)) {
                            console.log('[ActiveCall Poll] pending_calls: dialed → dialing mode, dialedAt:', dbDialedAt);
                            return { 
                                ...prev, 
                                mode: 'dialing', 
                                customerName: cleanCustomerName || prev.customerName,
                                dialedAt: dbDialedAt 
                            };
                        } else if (prev.mode === 'dialing') {
                            if (dbDialedAt && prev.dialedAt !== dbDialedAt) {
                                // dialed_at이 새로 갱신된 경우만 통화 시작으로 간주
                                console.log('[ActiveCall Poll] pending_calls: dialed_at updated → calling mode, new dialedAt:', dbDialedAt);
                                return { 
                                    ...prev, 
                                    mode: 'calling', 
                                    customerName: cleanCustomerName || prev.customerName,
                                    startedAt: new Date(dbDialedAt), 
                                    dialedAt: dbDialedAt 
                                };
                            }
                        }
                    }

                    if (status === 'ended') {
                        console.log('[ActiveCall Poll] pending_calls: ended → ended mode');
                        return { ...prev, mode: 'ended' };
                    }

                    return prev;
                });
            } catch (e) {
                console.error('[ActiveCall Poll] Failed to poll call status:', e);
            }
        }, 2000); // 2초 간격으로 폴링

        return () => clearInterval(pollInterval);
    }, [callState.isActive, callState.mode, callState.phoneNumber]);

    // ============================================
    // pending/dialing 모드 안전 타임아웃 (2분) 및 calling 모드 안전 타임아웃 (1시간)
    // Realtime 이벤트 누락으로 팝업이 stuck되는 것 방지
    // ============================================
    useEffect(() => {
        if (!callState.isActive || callState.mode === 'ended') return;

        const timeoutMs = callState.mode === 'calling'
            ? 60 * 60 * 1000 // 통화 중일 때는 1시간 안전 대기
            : 2 * 60 * 1000; // 대기/발신 중일 때는 2분 안전 대기

        const safetyTimer = setTimeout(() => {
            console.log(`[ActiveCall] Safety timeout triggered for mode: ${callState.mode}`);
            setCallState(initialState);
        }, timeoutMs);

        return () => clearTimeout(safetyTimer);
    }, [callState.isActive, callState.mode]);

    // CALL_OUT 감지 후 통화 종료 판단:
    // communication_logs에 duration이 업데이트되면 ended로 전환
    useEffect(() => {
        if (!supabase || (callState.mode !== 'calling' && callState.mode !== 'dialing')) return;

        const updateChannel = supabase
            .channel('call-duration-monitor')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'communication_logs' },
                (payload: any) => {
                    const row = payload.new;
                    if (!row || row.type !== 'CALL_OUT') return;

                    const phone = row.phone_number;
                    const normalizedCallPhone = callState.phoneNumber.replace(/[^0-9]/g, '');

                    if (phone === normalizedCallPhone && row.duration !== null && row.duration !== undefined) {
                        // duration이 기록됨 → 통화 종료
                        setCallState(prev => ({
                            ...prev,
                            mode: 'ended',
                        }));
                    }
                }
            )
            .subscribe();

        return () => {
            if (supabase) {
                supabase.removeChannel(updateChannel);
            }
        };
    }, [callState.mode, callState.phoneNumber]);

    return (
        <ActiveCallContext.Provider value={{ callState, startCall, dismissCall }}>
            {children}
        </ActiveCallContext.Provider>
    );
};
