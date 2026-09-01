import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { differenceInMinutes, parse, isValid } from 'date-fns';
import { Case, ReminderItem } from '../types';
import { fetchCases, subscribe } from '../services/api';

interface ReminderNotification {
    id: string; // Unique ID for notification (caseId + reminderId)
    caseId: string;
    customerName: string;
    reminder: ReminderItem;
    timestamp: number;
}

interface ReminderContextType {
    notifications: ReminderNotification[];
    dismissNotification: (id: string) => void;
    refreshReminders: () => Promise<void>;
}

const ReminderContext = createContext<ReminderContextType | undefined>(undefined);

// ============================================
// [FIX] localStorage 기반 중복 방지 유틸
// 페이지 새로고침 후에도 이미 표시된 알림을 다시 표시하지 않음
// ============================================
const PROCESSED_KEY = 'lm_processed_reminders';

const loadProcessedReminders = (): Map<string, number> => {
    try {
        const stored = localStorage.getItem(PROCESSED_KEY);
        if (!stored) return new Map();
        const entries: [string, number][] = JSON.parse(stored);
        // 24시간 이상 된 항목은 자동 정리
        const now = Date.now();
        const DAY_MS = 24 * 60 * 60 * 1000;
        return new Map(entries.filter(([, ts]) => now - ts < DAY_MS));
    } catch {
        return new Map();
    }
};

const saveProcessedReminders = (map: Map<string, number>) => {
    try {
        localStorage.setItem(PROCESSED_KEY, JSON.stringify(Array.from(map.entries())));
    } catch {
        // localStorage full 등 예외 무시
    }
};

export const ReminderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [cases, setCases] = useState<Case[]>([]);
    const [notifications, setNotifications] = useState<ReminderNotification[]>([]);
    // [FIX] useRef(Set) → localStorage 기반 Map (key: reminderUniqueId, value: timestamp)
    const processedReminders = useRef<Map<string, number>>(loadProcessedReminders());

    // Permission for browser notifications
    useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, []);

    const refreshReminders = useCallback(async () => {
        try {
            const data = await fetchCases();
            setCases(data);
        } catch (error) {
            console.error("Failed to fetch cases for reminders:", error);
        }
    }, []);

    // Initial fetch and periodic refresh (every 5 mins)
    // [REMINDER FIX] subscribe()로 실시간 데이터 변경 감지 추가
    useEffect(() => {
        refreshReminders();
        const fetchInterval = setInterval(refreshReminders, 5 * 60 * 1000);

        // [REMINDER FIX] api.ts의 실시간 업데이트 구독
        // 케이스가 변경되면 즉시 리마인더 데이터 갱신
        const unsubscribe = subscribe(() => {
            fetchCases().then(data => setCases(data)).catch(() => {});
        });

        return () => {
            clearInterval(fetchInterval);
            unsubscribe();
        };
    }, [refreshReminders]);

    // Check queue every 30 seconds
    useEffect(() => {
        const checkReminders = () => {
            const now = new Date();

            // [REMINDER FIX] 1단계: 이미 떠 있는 팝업 중 처리 완료된 것 자동 제거 (reconcile)
            setNotifications(prev => {
                const filtered = prev.filter(n => {
                    const c = cases.find(cs => cs.caseId === n.caseId);
                    if (!c) return false; // 케이스 삭제됨
                    const r = c.reminders?.find(rem => rem.id === n.reminder.id);
                    if (!r) return false; // 리마인더 삭제됨
                    if (r.resultStatus) {
                        // 결과가 이미 입력됨 → 팝업 제거 및 processed에 기록
                        processedReminders.current.set(n.id, Date.now());
                        saveProcessedReminders(processedReminders.current);
                        console.log(`[ReminderCheck] Auto-dismissed: ${n.customerName} (${r.resultStatus})`);
                        return false;
                    }
                    return true;
                });
                if (filtered.length !== prev.length) return filtered;
                return prev; // 변경 없으면 리렌더 방지
            });

            // [REMINDER FIX] 2단계: 새 알림 트리거
            cases.forEach(c => {
                c.reminders?.forEach(r => {
                    if (!r.datetime || r.resultStatus) return; // Skip if no date or already completed

                    // Parse date "YYYY-MM-DD HH:mm"
                    let rDate = parse(r.datetime, 'yyyy-MM-dd HH:mm', new Date());
                    if (!isValid(rDate)) {
                        return;
                    }

                    const diff = differenceInMinutes(rDate, now);
                    const reminderUniqueId = `${c.caseId}-${r.id}`;

                    // 트리거 윈도우: 8~12분 전
                    if (diff >= 8 && diff <= 12 && !processedReminders.current.has(reminderUniqueId)) {
                        console.log(`[ReminderCheck] TRIGGERING ALERT for ${c.customerName}`);
                        const newNotification: ReminderNotification = {
                            id: reminderUniqueId,
                            caseId: c.caseId,
                            customerName: c.customerName,
                            reminder: r,
                            timestamp: Date.now()
                        };

                        setNotifications(prev => {
                            if (prev.some(n => n.id === newNotification.id)) return prev;
                            return [...prev, newNotification];
                        });

                        // localStorage에 저장하여 새로고침 후에도 중복 방지
                        processedReminders.current.set(reminderUniqueId, Date.now());
                        saveProcessedReminders(processedReminders.current);

                        // Browser Notification
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification(`[LeadMaster] 10분 전 알림: ${c.customerName}`, {
                                body: `${r.datetime.split(' ')[1]} ${r.type || '일정'} - ${r.content || '내용 없음'}`,
                                icon: '/vite.svg'
                            });
                        }
                    }
                });
            });
        };

        checkReminders(); // [REMINDER FIX] cases 변경 시 즉시 reconcile 실행
        const checkerInterval = setInterval(checkReminders, 30 * 1000); // Check every 30s
        return () => clearInterval(checkerInterval);
    }, [cases]);

    const dismissNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        // [FIX] dismiss 시에도 processedReminders에 확실히 기록
        processedReminders.current.set(id, Date.now());
        saveProcessedReminders(processedReminders.current);
        console.log(`[ReminderNotification] Dismissed notification ${id}`);
    };

    return (
        <ReminderContext.Provider value={{ notifications, dismissNotification, refreshReminders }}>
            {children}
        </ReminderContext.Provider>
    );
};

export const useReminder = () => {
    const context = useContext(ReminderContext);
    if (!context) {
        throw new Error('useReminder must be used within a ReminderProvider');
    }
    return context;
};
