// ICS Service for Calendar Import/Export
// Handles Korean holidays and ICS file generation

import ICAL from 'ical.js';
import { format, parseISO } from 'date-fns';

export interface HolidayEvent {
    id: string;
    date: string;      // YYYY-MM-DD
    name: string;
    isHoliday: boolean;
}

// Korean Holiday Calendar ICS URL
const KOREAN_HOLIDAY_ICS = 'https://calendar.google.com/calendar/ical/ko.south_korea%23holiday%40group.v.calendar.google.com/public/basic.ics';

// CORS Proxy (needed for browser requests)
const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
];

let holidayCache: HolidayEvent[] | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch Korean holidays from Google Calendar
 */
export const fetchKoreanHolidays = async (): Promise<HolidayEvent[]> => {
    // Return cached data if still valid
    if (holidayCache && Date.now() - lastFetchTime < CACHE_DURATION) {
        return holidayCache;
    }

    // Try each CORS proxy
    for (const proxy of CORS_PROXIES) {
        try {
            const response = await fetch(proxy + encodeURIComponent(KOREAN_HOLIDAY_ICS), {
                headers: { 'Accept': 'text/calendar' }
            });

            if (!response.ok) continue;

            const icsText = await response.text();
            const holidays = parseICS(icsText);

            holidayCache = holidays;
            lastFetchTime = Date.now();

            // Also cache in localStorage for offline use
            try {
                localStorage.setItem('lm_holidays_cache', JSON.stringify(holidays));
                localStorage.setItem('lm_holidays_time', String(Date.now()));
            } catch (e) {
                // Ignore storage errors
            }

            return holidays;
        } catch (e) {
            console.warn('CORS proxy failed:', proxy, e);
        }
    }

    // Fallback to localStorage cache
    try {
        const cached = localStorage.getItem('lm_holidays_cache');
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (e) {
        // Ignore
    }

    console.error('Failed to fetch Korean holidays');
    return [];
};

/**
 * Parse ICS text to holiday events
 */
const parseICS = (icsText: string): HolidayEvent[] => {
    try {
        const jcalData = ICAL.parse(icsText);
        const comp = new ICAL.Component(jcalData);
        const events = comp.getAllSubcomponents('vevent');

        return events.map((event: any) => {
            const vevent = new ICAL.Event(event);
            const startDate = vevent.startDate;

            return {
                id: vevent.uid || `holiday-${startDate.toString()}`,
                date: format(startDate.toJSDate(), 'yyyy-MM-dd'),
                name: vevent.summary || '공휴일',
                isHoliday: true
            };
        });
    } catch (e) {
        console.error('Failed to parse ICS:', e);
        return [];
    }
};

/**
 * Get holidays for a specific month
 */
export const getHolidaysForMonth = async (year: number, month: number): Promise<HolidayEvent[]> => {
    const holidays = await fetchKoreanHolidays();
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    return holidays.filter(h => h.date.startsWith(monthStr));
};

/**
 * Check if a date is a Korean holiday
 */
export const isKoreanHoliday = async (date: string): Promise<HolidayEvent | null> => {
    const holidays = await fetchKoreanHolidays();
    return holidays.find(h => h.date === date) || null;
};

// ============================================
// ICS Export Functions
// ============================================

interface ExportEvent {
    id: string;
    title: string;
    description?: string;
    startDate: string;     // YYYY-MM-DD
    startTime?: string;    // HH:mm
    endDate?: string;
    endTime?: string;
    isAllDay?: boolean;
}

/**
 * Generate ICS file content from events
 */
export const generateICS = (events: ExportEvent[], calendarName: string = 'LeadMaster Calendar'): string => {
    const now = new Date();
    const dtstamp = formatICSDate(now);

    let ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//LeadMaster CRM//Calendar Export//KO',
        `X-WR-CALNAME:${calendarName}`,
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
    ];

    events.forEach(event => {
        const eventLines = [
            'BEGIN:VEVENT',
            `UID:${event.id}@leadmaster.app`,
            `DTSTAMP:${dtstamp}`,
        ];

        if (event.isAllDay || !event.startTime) {
            // All-day event
            eventLines.push(`DTSTART;VALUE=DATE:${event.startDate.replace(/-/g, '')}`);
            if (event.endDate) {
                eventLines.push(`DTEND;VALUE=DATE:${event.endDate.replace(/-/g, '')}`);
            }
        } else {
            // Timed event
            const startDT = `${event.startDate.replace(/-/g, '')}T${event.startTime.replace(/:/g, '')}00`;
            eventLines.push(`DTSTART:${startDT}`);

            if (event.endTime) {
                const endDT = `${(event.endDate || event.startDate).replace(/-/g, '')}T${event.endTime.replace(/:/g, '')}00`;
                eventLines.push(`DTEND:${endDT}`);
            }
        }

        eventLines.push(`SUMMARY:${escapeICS(event.title)}`);

        if (event.description) {
            eventLines.push(`DESCRIPTION:${escapeICS(event.description)}`);
        }

        eventLines.push('END:VEVENT');
        ics = ics.concat(eventLines);
    });

    ics.push('END:VCALENDAR');
    return ics.join('\r\n');
};

/**
 * Format date for ICS (YYYYMMDDTHHMMSSZ)
 */
const formatICSDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

/**
 * Escape special characters for ICS
 */
const escapeICS = (text: string): string => {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
};

/**
 * Download ICS file
 */
export const downloadICS = (events: ExportEvent[], filename: string = 'leadmaster-calendar.ics') => {
    const icsContent = generateICS(events);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
