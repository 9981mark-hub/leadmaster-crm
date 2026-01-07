import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { differenceInMinutes, parse, isValid } from 'date-fns';
import { Case, ReminderItem } from '../types';
import { fetchCases } from '../services/api';

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

export const ReminderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [cases, setCases] = useState<Case[]>([]);
    const [notifications, setNotifications] = useState<ReminderNotification[]>([]);
    const processedReminders = useRef<Set<string>>(new Set()); // Track processed reminders to avoid double alerts

    // Permission for browser notifications
    useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, []);

    const refreshReminders = async () => {
        try {
            const data = await fetchCases();
            setCases(data);
        } catch (error) {
            console.error("Failed to fetch cases for reminders:", error);
        }
    };

    // Initial fetch and periodic refresh (every 5 mins)
    useEffect(() => {
        refreshReminders();
        const fetchInterval = setInterval(refreshReminders, 5 * 60 * 1000);
        return () => clearInterval(fetchInterval);
    }, []);

    // Check queue every 30 seconds
    useEffect(() => {
        const checkReminders = () => {
            const now = new Date();
            console.log(`[ReminderCheck] Checking ${cases.length} cases at ${now.toLocaleTimeString()}`);

            cases.forEach(c => {
                c.reminders?.forEach(r => {
                    if (!r.datetime || r.resultStatus) return; // Skip if no date or already completed

                    // Parse date "YYYY-MM-DD HH:mm"
                    let rDate = parse(r.datetime, 'yyyy-MM-dd HH:mm', new Date());
                    if (!isValid(rDate)) {
                        console.warn(`[ReminderCheck] Invalid date for case ${c.customerName}: ${r.datetime}`);
                        // Try appending seconds if needed, or fallback logic? 
                        // Currently assuming standard format.
                        return;
                    }

                    const diff = differenceInMinutes(rDate, now);
                    console.log(`[ReminderCheck] ${c.customerName} - ${r.datetime} (Diff: ${diff}m)`);
                    // Trigger window: 9 to 11 minutes (target is 10)
                    // Also check if not already processed
                    const reminderUniqueId = `${c.caseId}-${r.id}`;

                    // Modified logic: Catch anything between 0 and 12 minutes to be safe for testing
                    // Original: 9 to 11
                    if (diff >= 0 && diff <= 12 && !processedReminders.current.has(reminderUniqueId)) {
                        console.log(`[ReminderCheck] TRIGGERING ALERT for ${c.customerName}`);
                        // Trigger Notification
                        const newNotification: ReminderNotification = {
                            id: reminderUniqueId,
                            caseId: c.caseId,
                            customerName: c.customerName,
                            reminder: r,
                            timestamp: Date.now()
                        };

                        setNotifications(prev => {
                            // Prevent duplicates in state just in case
                            if (prev.some(n => n.id === newNotification.id)) return prev;
                            return [...prev, newNotification];
                        });

                        processedReminders.current.add(reminderUniqueId);

                        // Browser Notification
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification(`[LeadMaster] 10분 전 알림: ${c.customerName}`, {
                                body: `${r.datetime.split(' ')[1]} ${r.type || '일정'} - ${r.content || '내용 없음'}`,
                                icon: '/vite.svg' // Optional icon
                            });
                        }

                        // Optional: Beep sound
                        // const audio = new Audio('/notification.mp3');
                        // audio.play().catch(e => console.log("Audio play failed", e));
                    }
                });
            });
        };

        const checkerInterval = setInterval(checkReminders, 30 * 1000); // Check every 30s
        return () => clearInterval(checkerInterval);
    }, [cases]);

    const dismissNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
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
