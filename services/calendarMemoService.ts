// Calendar Memo Service
// IndexedDB based storage for user calendar memos

import { CalendarMemo } from '../types';

const DB_NAME = 'leadmaster_calendar';
const STORE_NAME = 'memos';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

// Initialize IndexedDB
const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('date', 'date', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };
    });
};

// Generate unique ID
const generateId = (): string => {
    return `memo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Fetch all memos for a year/month
export const fetchCalendarMemos = async (year?: number, month?: number): Promise<CalendarMemo[]> => {
    const database = await initDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            let memos = request.result as CalendarMemo[];

            // Filter by year/month if provided
            if (year !== undefined) {
                memos = memos.filter(m => {
                    const memoDate = new Date(m.date);
                    if (month !== undefined) {
                        return memoDate.getFullYear() === year && memoDate.getMonth() + 1 === month;
                    }
                    return memoDate.getFullYear() === year;
                });
            }

            resolve(memos);
        };

        request.onerror = () => reject(request.error);
    });
};

// Create a new memo
export const createCalendarMemo = async (memo: Omit<CalendarMemo, 'id' | 'createdAt' | 'updatedAt'>): Promise<CalendarMemo> => {
    const database = await initDB();
    const now = new Date().toISOString();

    const newMemo: CalendarMemo = {
        ...memo,
        id: generateId(),
        createdAt: now,
        updatedAt: now
    };

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(newMemo);

        request.onsuccess = () => resolve(newMemo);
        request.onerror = () => reject(request.error);
    });
};

// Update an existing memo
export const updateCalendarMemo = async (id: string, updates: Partial<CalendarMemo>): Promise<CalendarMemo | null> => {
    const database = await initDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
            const existing = getRequest.result as CalendarMemo | undefined;
            if (!existing) {
                resolve(null);
                return;
            }

            const updated: CalendarMemo = {
                ...existing,
                ...updates,
                id: existing.id,
                createdAt: existing.createdAt,
                updatedAt: new Date().toISOString()
            };

            const putRequest = store.put(updated);
            putRequest.onsuccess = () => resolve(updated);
            putRequest.onerror = () => reject(putRequest.error);
        };

        getRequest.onerror = () => reject(getRequest.error);
    });
};

// Delete a memo
export const deleteCalendarMemo = async (id: string): Promise<boolean> => {
    const database = await initDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
};

// Get memo by ID
export const getCalendarMemo = async (id: string): Promise<CalendarMemo | null> => {
    const database = await initDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

// Get memos for a specific date
export const getMemosForDate = async (date: string): Promise<CalendarMemo[]> => {
    const database = await initDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('date');
        const request = index.getAll(date);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};
