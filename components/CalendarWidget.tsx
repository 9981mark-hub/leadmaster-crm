import React, { useState, useEffect, useMemo } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays,
  eachDayOfInterval, parse, isToday, addWeeks, subWeeks,
  isBefore, isAfter, parseISO
} from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Phone, Briefcase, MapPin, MoreHorizontal,
  Calendar, List, Clock, Plus, Filter, DollarSign, FileText, Edit, Download, Gift
} from 'lucide-react';
import { Case, SettlementBatch, CalendarMemo, CalendarEventType, Partner, CommissionRule, SettlementConfig } from '../types';
import { Link } from 'react-router-dom';
import { fetchCalendarMemos, createCalendarMemo, updateCalendarMemo, deleteCalendarMemo } from '../services/calendarMemoService';
import { fetchKoreanHolidays, HolidayEvent, downloadICS } from '../services/icsService';
import CalendarMemoModal from './CalendarMemoModal';
import KoreanLunarCalendar from 'korean-lunar-calendar';

interface CalendarWidgetProps {
  cases: Case[];
  batches?: SettlementBatch[];
  partners?: Partner[];
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
  showFilters?: boolean;
}

// 수수료 규칙 찾기
const getCommission = (contractFee: number, rules: CommissionRule[]): CommissionRule | null => {
  const activeRules = rules.filter(r => r.active).sort((a, b) => a.priority - b.priority);
  for (const rule of activeRules) {
    const maxFee = rule.maxFee || Infinity;
    if (contractFee >= rule.minFee && contractFee <= maxFee) {
      return rule;
    }
  }
  return null;
};

// 지급일 계산: 입금이 속한 주차 마감 후 다음 주 화요일
const calculatePayoutDate = (depositDate: string, config: SettlementConfig): string => {
  const date = parseISO(depositDate);
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  const nextMonday = addDays(weekEnd, 1);
  const payoutDayOffset = config.payoutDay === 0 ? 6 : config.payoutDay - 1;
  let payoutDate = addDays(nextMonday, payoutDayOffset);
  if (config.payoutWeekDelay === 1) {
    payoutDate = addDays(payoutDate, 7);
  }
  return format(payoutDate, 'yyyy-MM-dd');
};

type ViewMode = 'month' | 'week' | 'list';
type ExtendedEventType = CalendarEventType | 'holiday';

interface UnifiedEvent {
  id: string;
  type: ExtendedEventType;
  date: string;
  time?: string;
  title: string;
  subtitle?: string;
  color: string;
  icon?: React.ReactNode;
  link?: string;
}

// 세무 일정 데이터
const TAX_SCHEDULES = [
  { month: 1, day: 25, name: '부가세 확정신고', desc: '7~12월분', type: '부가세' },
  { month: 2, day: 10, name: '원천세 납부', desc: '1월분', type: '원천세' },
  { month: 3, day: 10, name: '원천세 납부', desc: '2월분', type: '원천세' },
  { month: 4, day: 10, name: '원천세 납부', desc: '3월분', type: '원천세' },
  { month: 4, day: 25, name: '부가세 예정신고', desc: '1~3월분', type: '부가세' },
  { month: 5, day: 10, name: '원천세 납부', desc: '4월분', type: '원천세' },
  { month: 5, day: 31, name: '종합소득세 신고', desc: '전년도분', type: '소득세' },
  { month: 6, day: 10, name: '원천세 납부', desc: '5월분', type: '원천세' },
  { month: 7, day: 10, name: '원천세 납부', desc: '6월분', type: '원천세' },
  { month: 7, day: 25, name: '부가세 확정신고', desc: '1~6월분', type: '부가세' },
  { month: 8, day: 10, name: '원천세 납부', desc: '7월분', type: '원천세' },
  { month: 9, day: 10, name: '원천세 납부', desc: '8월분', type: '원천세' },
  { month: 10, day: 10, name: '원천세 납부', desc: '9월분', type: '원천세' },
  { month: 10, day: 25, name: '부가세 예정신고', desc: '7~9월분', type: '부가세' },
  { month: 11, day: 10, name: '원천세 납부', desc: '10월분', type: '원천세' },
  { month: 12, day: 10, name: '원천세 납부', desc: '11월분', type: '원천세' },
];

export default function CalendarWidget({
  cases,
  batches = [],
  partners = [],
  onDateSelect,
  selectedDate,
  showFilters = true
}: CalendarWidgetProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [memos, setMemos] = useState<CalendarMemo[]>([]);
  const [holidays, setHolidays] = useState<HolidayEvent[]>([]);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [memoModalDate, setMemoModalDate] = useState<string | undefined>();
  const [editingMemo, setEditingMemo] = useState<CalendarMemo | null>(null);

  // Filters (including holiday)
  const [filters, setFilters] = useState<Record<ExtendedEventType, boolean>>({
    reminder: true,
    settlement: true,
    tax: true,
    memo: true,
    holiday: true
  });

  // Load memos and holidays
  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedMemos, loadedHolidays] = await Promise.all([
          fetchCalendarMemos(),
          fetchKoreanHolidays()
        ]);
        setMemos(loadedMemos);
        setHolidays(loadedHolidays);
      } catch (e) {
        console.error('Failed to load calendar data:', e);
      }
    };
    loadData();
  }, []);

  const prevMonth = () => setCurrentDate(viewMode === 'week' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(viewMode === 'week' ? addWeeks(currentDate, 1) : addMonths(currentDate, 1));
  const goToday = () => setCurrentDate(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(viewMode === 'week' ? currentDate : monthStart);
  const endDate = viewMode === 'week' ? endOfWeek(currentDate) : endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  // Build unified events
  const unifiedEvents = useMemo(() => {
    const events: UnifiedEvent[] = [];
    const currentYear = currentDate.getFullYear();

    // 1. Reminders from cases
    if (filters.reminder) {
      cases.forEach(c => {
        (c.reminders || []).forEach(r => {
          if (!r.datetime) return;
          const [dateStr, timeStr] = r.datetime.split(' ');
          events.push({
            id: `reminder-${c.caseId}-${r.id}`,
            type: 'reminder',
            date: dateStr,
            time: timeStr,
            title: c.customerName,
            subtitle: r.type || '통화',
            color: r.type === '방문미팅' ? 'purple' : r.type === '출장미팅' ? 'green' : 'blue',
            icon: r.type === '방문미팅' ? <MapPin size={12} /> :
              r.type === '출장미팅' ? <Briefcase size={12} /> : <Phone size={12} />,
            link: `/case/${c.caseId}`
          });
        });
      });
    }

    // 2. Settlement events from batches
    if (filters.settlement) {
      batches.forEach(b => {
        // Collection date (수금일)
        if (b.collectionInfo?.collectedAt) {
          events.push({
            id: `settlement-collection-${b.batchId}`,
            type: 'settlement',
            date: b.collectionInfo.collectedAt.split('T')[0],
            title: `수금 ${b.collectionInfo.amount?.toLocaleString() || b.totalCommission.toLocaleString()}만원`,
            subtitle: b.weekLabel,
            color: 'green',
            icon: <DollarSign size={12} />
          });
        }

        // Payout dates (지급일)
        (b.payoutItems || []).forEach(p => {
          if (p.paidAt) {
            events.push({
              id: `settlement-payout-${b.batchId}-${p.id}`,
              type: 'settlement',
              date: p.paidAt.split('T')[0],
              title: `지급 ${p.amount.toLocaleString()}만원`,
              subtitle: p.partnerName,
              color: 'orange',
              icon: <DollarSign size={12} />
            });
          }
        });
      });

      // Deposit history from cases (입금 내역)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      cases.forEach(c => {
        // 입금 내역 (depositHistory)
        (c.depositHistory || []).forEach((d, idx) => {
          if (d.date) {
            const depositDate = parseISO(d.date);
            const isFuture = isAfter(depositDate, today);
            events.push({
              id: `deposit-${c.caseId}-${idx}`,
              type: 'settlement',
              date: d.date,
              title: isFuture ? `${idx + 1}차 입금(예정) ${d.amount}만원` : `${idx + 1}차 입금 ${d.amount}만원`,
              subtitle: c.customerName,
              color: isFuture ? 'cyan' : 'blue',
              icon: <DollarSign size={12} />
            });
          }
        });

        // 수수료 지급 내역 (commissionPayments)
        (c.commissionPayments || []).forEach((p, idx) => {
          if (p.date) {
            events.push({
              id: `commission-${c.caseId}-${idx}`,
              type: 'settlement',
              date: p.date,
              title: p.isExpected ? `${idx + 1}차 수수료(예정) ${p.amount}만원` : `${idx + 1}차 수수료 ${p.amount}만원`,
              subtitle: c.customerName,
              color: p.isExpected ? 'lime' : 'emerald',
              icon: <DollarSign size={12} />
            });
          }
        });
      });

      // Expected deposits from cases (예상 입금)
      cases.forEach(c => {
        (c.expectedDeposits || []).forEach((ed, idx) => {
          if (ed.date) {
            const depositNum = (c.depositHistory?.length || 0) + idx + 1;
            events.push({
              id: `expected-deposit-${c.caseId}-${idx}`,
              type: 'settlement',
              date: ed.date,
              title: `${depositNum}차 입금(예정) ${ed.amount}만원`,
              subtitle: c.customerName,
              color: 'cyan',
              icon: <DollarSign size={12} />
            });
          }
        });
      });

      // Auto-calculated commission payouts (same logic as SettlementCalendar)
      // [FIX] Skip cases that already have commissionPayments to avoid duplicate/split display
      const safePartners = Array.isArray(partners) ? partners : [];
      cases.forEach(caseItem => {
        if (!caseItem.contractFee || caseItem.contractFee <= 0) return;
        // If this case already has commissionPayments recorded, skip auto-calculation
        if (caseItem.commissionPayments && caseItem.commissionPayments.length > 0) return;

        // Find partner for this case
        const partner = safePartners.find(p =>
          p.partnerId === (caseItem as any).partnerId ||
          p.name === (caseItem as any).partnerName ||
          p.name === (caseItem as any).lawFirm
        );
        if (!partner || !partner.commissionRules || !partner.settlementConfig) return;

        const rule = getCommission(caseItem.contractFee, partner.commissionRules);
        if (!rule) return;

        const config = partner.settlementConfig;
        const totalCommission = rule.commission;
        // [FIX] 구간 최저값(rule.minFee) 기준으로 계약금 비율 적용
        const downPaymentThreshold = rule.minFee * (config.downPaymentPercentage / 100);
        const fullPayoutThreshold = rule.fullPayoutThreshold || totalCommission;
        const firstPayoutAmount = totalCommission * (config.firstPayoutPercentage / 100);
        const secondPayoutAmount = totalCommission - firstPayoutAmount;

        // Combine all deposits
        const allDeposits = [
          ...(caseItem.depositHistory || []).map(d => ({
            ...d,
            isExpected: isAfter(parseISO(d.date), today)
          })),
          ...(caseItem.expectedDeposits || []).map(d => ({ ...d, isExpected: true }))
        ].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

        let cumulativeDeposit = 0;
        let firstPayoutTriggered = false;
        let secondPayoutTriggered = false;

        allDeposits.forEach((deposit) => {
          cumulativeDeposit += deposit.amount;

          let firstTriggeredThisDeposit = false;
          let secondTriggeredThisDeposit = false;

          // 1st payout: cumulative >= downPaymentThreshold
          if (!firstPayoutTriggered && cumulativeDeposit >= downPaymentThreshold) {
            firstPayoutTriggered = true;
            firstTriggeredThisDeposit = true;
          }

          // 2nd payout: cumulative >= fullPayoutThreshold
          if (!secondPayoutTriggered && cumulativeDeposit >= fullPayoutThreshold) {
            secondPayoutTriggered = true;
            secondTriggeredThisDeposit = true;
          }

          const payoutDate = (firstTriggeredThisDeposit || secondTriggeredThisDeposit)
            ? calculatePayoutDate(deposit.date, config)
            : '';

          // [FIX] 같은 입금에서 1차와 2차가 동시에 발생하면 (완납) 합산하여 한 건으로 표시
          if (firstTriggeredThisDeposit && secondTriggeredThisDeposit) {
            events.push({
              id: `auto-commission-full-${caseItem.caseId}`,
              type: 'settlement',
              date: payoutDate,
              title: deposit.isExpected ? `수수료 전액(예정) ${totalCommission}만원` : `수수료 전액 ${totalCommission}만원`,
              subtitle: caseItem.customerName,
              color: deposit.isExpected ? 'lime' : 'emerald',
              icon: <DollarSign size={12} />
            });
          } else {
            if (firstTriggeredThisDeposit) {
              events.push({
                id: `auto-commission-1st-${caseItem.caseId}`,
                type: 'settlement',
                date: payoutDate,
                title: deposit.isExpected ? `1차 수수료(예정) ${firstPayoutAmount}만원` : `1차 수수료 ${firstPayoutAmount}만원`,
                subtitle: caseItem.customerName,
                color: deposit.isExpected ? 'lime' : 'emerald',
                icon: <DollarSign size={12} />
              });
            }
            if (secondTriggeredThisDeposit) {
              events.push({
                id: `auto-commission-2nd-${caseItem.caseId}`,
                type: 'settlement',
                date: payoutDate,
                title: deposit.isExpected ? `잔금 수수료(예정) ${secondPayoutAmount}만원` : `잔금 수수료 ${secondPayoutAmount}만원`,
                subtitle: caseItem.customerName,
                color: deposit.isExpected ? 'lime' : 'emerald',
                icon: <DollarSign size={12} />
              });
            }
          }
        });
      });
    }

    // 3. Tax schedules
    if (filters.tax) {
      TAX_SCHEDULES.forEach((s, idx) => {
        let scheduleDate = new Date(currentYear, s.month - 1, s.day);
        if (isBefore(scheduleDate, new Date())) {
          scheduleDate = new Date(currentYear + 1, s.month - 1, s.day);
        }
        const dateStr = format(scheduleDate, 'yyyy-MM-dd');

        events.push({
          id: `tax-${idx}-${s.name}`,
          type: 'tax',
          date: dateStr,
          title: s.name,
          subtitle: s.desc,
          color: s.type === '부가세' ? 'teal' : s.type === '소득세' ? 'purple' : 'orange',
          icon: <FileText size={12} />
        });
      });
    }

    // 4. User memos
    if (filters.memo) {
      const startYear = currentDate.getFullYear() - 1;
      const endYear = currentDate.getFullYear() + 2;
      const viewStart = new Date(startYear, 0, 1);
      const viewEnd = new Date(endYear, 11, 31);

      memos.forEach(m => {
        if (!m.repeatType || m.repeatType === 'none') {
          events.push({
            id: `memo-${m.id}`,
            type: 'memo',
            date: m.date,
            time: m.time,
            title: m.title,
            subtitle: m.content?.substring(0, 20),
            color: m.color || 'purple',
            icon: <Edit size={12} />
          });
        } else {
          const memoDateObj = parseISO(m.date);
          const memoYear = memoDateObj.getFullYear();
          const memoMonth = memoDateObj.getMonth();
          const memoDay = memoDateObj.getDate();
          let occurrences: string[] = [];

          if (m.repeatType === 'weekly') {
            let cur = memoDateObj;
            if (isBefore(cur, viewStart)) {
                const diffWeeks = Math.floor((viewStart.getTime() - cur.getTime()) / (7 * 24 * 60 * 60 * 1000));
                cur = addWeeks(cur, diffWeeks);
                while (isBefore(cur, viewStart)) cur = addWeeks(cur, 1);
            }
            while (isBefore(cur, viewEnd) || isSameDay(cur, viewEnd)) {
                occurrences.push(format(cur, 'yyyy-MM-dd'));
                cur = addWeeks(cur, 1);
            }
          } else if (m.repeatType === 'monthly') {
            const startY = Math.max(memoYear, startYear);
            for (let y = startY; y <= endYear; y++) {
                for (let mo = (y === memoYear ? memoMonth : 0); mo < 12; mo++) {
                    const d = new Date(y, mo, memoDay);
                    if (d.getMonth() === mo) {
                        occurrences.push(format(d, 'yyyy-MM-dd'));
                    }
                }
            }
          } else if (m.repeatType === 'yearly') {
            const startY = Math.max(memoYear, startYear);
            for (let y = startY; y <= endYear; y++) {
                const d = new Date(y, memoMonth, memoDay);
                if (d.getMonth() === memoMonth) {
                    occurrences.push(format(d, 'yyyy-MM-dd'));
                }
            }
          } else if (m.repeatType === 'lunar_yearly') {
            const startY = Math.max(memoYear, startYear);
            const lunarMonth = memoMonth + 1;
            const lunarDay = memoDay;
            const calendar = new KoreanLunarCalendar();
            for (let y = startY; y <= endYear; y++) {
                calendar.setLunarDate(y, lunarMonth, lunarDay, false);
                const solar = calendar.getSolarCalendar();
                if (solar && solar.year && solar.month && solar.day) {
                    const d = new Date(solar.year, solar.month - 1, solar.day);
                    occurrences.push(format(d, 'yyyy-MM-dd'));
                }
            }
          }

          occurrences.forEach((occDate, idx) => {
            events.push({
              id: `memo-${m.id}-${idx}`,
              type: 'memo',
              date: occDate,
              time: m.time,
              title: m.title + (m.repeatType === 'lunar_yearly' ? ' (음력)' : ''),
              subtitle: m.content?.substring(0, 20),
              color: m.color || 'purple',
              icon: <Edit size={12} />
            });
          });
        }
      });
    }

    // 5. Korean holidays
    if (filters.holiday) {
      holidays.forEach(h => {
        events.push({
          id: `holiday-${h.id}`,
          type: 'holiday',
          date: h.date,
          title: h.name,
          color: 'red',
          icon: <Gift size={12} />
        });
      });
    }

    return events;
  }, [cases, batches, partners, memos, holidays, filters, currentDate]);

  const getEventsForDay = (date: Date): UnifiedEvent[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return unifiedEvents.filter(ev => ev.date === dateStr)
      .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  };

  const getColorClass = (color: string, type: 'bg' | 'text' | 'border' = 'bg') => {
    const colors: Record<string, Record<string, string>> = {
      blue: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-800' },
      green: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', border: 'border-green-300 dark:border-green-800' },
      orange: { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-800' },
      red: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-300 dark:border-red-800' },
      purple: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-800' },
      teal: { bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-300 dark:border-teal-800' },
      gray: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-300 dark:border-gray-700' },
      cyan: { bg: 'bg-cyan-100 dark:bg-cyan-900/40', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-300 dark:border-cyan-800' },
      lime: { bg: 'bg-lime-100 dark:bg-lime-900/40', text: 'text-lime-700 dark:text-lime-300', border: 'border-lime-300 dark:border-lime-800' },
      emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-800' },
    };
    return colors[color]?.[type] || colors.gray[type];
  };

  const toggleFilter = (type: ExtendedEventType) => {
    setFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // Export handler
  const handleExport = () => {
    const exportEvents = unifiedEvents
      .filter(ev => ev.type !== 'holiday') // Don't export holidays (they're public)
      .map(ev => ({
        id: ev.id,
        title: ev.title,
        description: ev.subtitle,
        startDate: ev.date,
        startTime: ev.time,
        isAllDay: !ev.time
      }));

    downloadICS(exportEvents, `leadmaster-calendar-${format(new Date(), 'yyyy-MM')}.ics`);
  };

  const handleAddMemo = (date: Date) => {
    setMemoModalDate(format(date, 'yyyy-MM-dd'));
    setEditingMemo(null);
    setIsMemoModalOpen(true);
  };

  const handleEditMemo = (memoId: string) => {
    const memo = memos.find(m => m.id === memoId);
    if (memo) {
      setEditingMemo(memo);
      setMemoModalDate(memo.date);
      setIsMemoModalOpen(true);
    }
  };

  const handleSaveMemo = async (memoData: Omit<CalendarMemo, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingMemo) {
        await updateCalendarMemo(editingMemo.id, memoData);
      } else {
        await createCalendarMemo(memoData);
      }
      const updated = await fetchCalendarMemos();
      setMemos(updated);
      setIsMemoModalOpen(false);
      setEditingMemo(null);
    } catch (e) {
      console.error('Failed to save memo:', e);
    }
  };

  const handleDeleteMemo = async () => {
    if (!editingMemo) return;
    try {
      await deleteCalendarMemo(editingMemo.id);
      const updated = await fetchCalendarMemos();
      setMemos(updated);
      setIsMemoModalOpen(false);
      setEditingMemo(null);
    } catch (e) {
      console.error('Failed to delete memo:', e);
    }
  };

  // List view: Get upcoming events
  const upcomingEvents = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return unifiedEvents
      .filter(ev => ev.date >= today)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.time || '').localeCompare(String(b.time || '')))
      .slice(0, 20);
  }, [unifiedEvents]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-150 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-150 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="text-xl">
              {viewMode === 'week'
                ? `${format(startDate, 'M/d', { locale: ko })} ~ ${format(endDate, 'M/d', { locale: ko })}`
                : format(currentDate, 'yyyy년 M월')
              }
            </span>
          </h3>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700/80 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('month')}
                className={`px-2 py-1 text-xs rounded transition-colors ${viewMode === 'month' ? 'bg-white dark:bg-gray-800 shadow-xs text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
                title="월간"
              >
                <Calendar size={14} />
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-2 py-1 text-xs rounded transition-colors ${viewMode === 'week' ? 'bg-white dark:bg-gray-800 shadow-xs text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
                title="주간"
              >
                <Clock size={14} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-2 py-1 text-xs rounded transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-800 shadow-xs text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
                title="리스트"
              >
                <List size={14} />
              </button>
            </div>

            <button onClick={goToday} className="px-3 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded transition-colors">
              오늘
            </button>
            <div className="flex rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <button onClick={prevMonth} className="p-1 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 transition-colors">
                <ChevronLeft size={20} />
              </button>
              <button onClick={nextMonth} className="p-1 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Buttons */}
        {showFilters && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => toggleFilter('reminder')}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${filters.reminder 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-1 ring-blue-400/30' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-650'}`}
            >
              📞 리마인더
            </button>
            <button
              onClick={() => toggleFilter('settlement')}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${filters.settlement 
                ? 'bg-green-100 text-green-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-1 ring-emerald-400/30' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-650'}`}
            >
              💰 정산
            </button>
            <button
              onClick={() => toggleFilter('tax')}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${filters.tax 
                ? 'bg-red-100 text-red-700 dark:bg-rose-900/40 dark:text-rose-300 ring-1 ring-rose-400/30' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-650'}`}
            >
              📅 세금
            </button>
            <button
              onClick={() => toggleFilter('memo')}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${filters.memo 
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 ring-1 ring-purple-400/30' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-650'}`}
            >
              📝 메모
            </button>
            <button
              onClick={() => toggleFilter('holiday')}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${filters.holiday 
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 ring-1 ring-rose-400/30' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-650'}`}
            >
              🎌 공휴일
            </button>
            <div className="flex-1" />
            <button
              onClick={() => handleAddMemo(new Date())}
              className="px-3 py-1 text-xs rounded-full font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 shadow-xs transition-colors"
            >
              <Plus size={12} /> 메모 추가
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1 text-xs rounded-full font-medium bg-gray-600 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 flex items-center gap-1 shadow-xs transition-colors"
              title="ICS 파일로 내보내기"
            >
              <Download size={12} /> 내보내기
            </button>
          </div>
        )}
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div className="p-4 max-h-[500px] overflow-y-auto">
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              예정된 일정이 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map(ev => (
                <div
                  key={ev.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${getColorClass(ev.color, 'border')} ${getColorClass(ev.color, 'bg')} cursor-pointer hover:opacity-80`}
                  onClick={() => {
                    if (ev.type === 'memo' && ev.id.startsWith('memo-')) {
                      const memoId = ev.id.replace('memo-', '').replace(/-\d+$/, '');
                      handleEditMemo(memoId);
                    }
                  }}
                >
                  <div className={`p-2 rounded-lg bg-white ${getColorClass(ev.color, 'text')}`}>
                    {ev.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 truncate">{ev.title}</span>
                      {ev.time && <span className="text-xs text-gray-500">{ev.time}</span>}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span>{format(parseISO(ev.date), 'M/d (E)', { locale: ko })}</span>
                      {ev.subtitle && <span>• {ev.subtitle}</span>}
                    </div>
                  </div>
                  {ev.link && (
                    <Link to={ev.link} className="text-blue-500 hover:text-blue-600 text-xs">
                      보기
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calendar Grid (Month/Week View) */}
      {viewMode !== 'list' && (
        <>
          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-gray-150 dark:border-gray-700 bg-gray-50 dark:bg-gray-850">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
              <div key={day} className={`text-center py-2 text-xs font-bold ${idx === 0 ? 'text-red-500 dark:text-red-400' : idx === 6 ? 'text-blue-500 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'}`}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 bg-gray-200 dark:bg-gray-700 gap-px">
            {calendarDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isTodayDate = isToday(day);
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => onDateSelect && onDateSelect(day)}
                  onMouseEnter={() => dayEvents.length > 0 && setHoveredDate(day.toISOString())}
                  onMouseLeave={() => setHoveredDate(null)}
                  className={`p-1 md:p-2 flex flex-col gap-1 cursor-pointer transition-colors ${viewMode === 'week' ? 'h-[260px]' : 'h-[104px] md:h-[156px]'} border border-gray-100 dark:border-gray-700/60 relative
                    ${isSelected 
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500 ring-inset z-10' 
                      : (!isCurrentMonth && viewMode === 'month' 
                          ? 'bg-gray-50/70 dark:bg-gray-900/60 hover:bg-gray-100 dark:hover:bg-gray-850' 
                          : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750')
                    }
                  `}
                >
                  {/* Tooltip */}
                  {hoveredDate === day.toISOString() && dayEvents.length > 0 && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-64 bg-gray-900 text-white rounded-lg shadow-xl p-3 animate-fade-in"
                    >
                      <div className="text-xs font-bold text-blue-300 mb-2 border-b border-gray-700 pb-1">
                        {format(day, 'M월 d일')} 일정 ({dayEvents.length}건)
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {dayEvents.map((ev) => (
                          <div key={ev.id} className={`text-xs border-l-2 ${getColorClass(ev.color, 'border')} pl-2`}>
                            <div className="flex items-center gap-1">
                              {ev.time && <span className="font-mono font-bold text-yellow-300">{ev.time}</span>}
                              <span className="font-medium text-white">{ev.title}</span>
                            </div>
                            {ev.subtitle && <div className="text-gray-500 dark:text-gray-400">{ev.subtitle}</div>}
                          </div>
                        ))}
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-900" />
                    </div>
                  )}

                  <div className="flex justify-between items-start">
                    <span
                      className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                        ${isTodayDate 
                          ? 'bg-blue-600 text-white shadow-xs' 
                          : (isSelected 
                              ? 'text-blue-700 dark:text-blue-300 font-extrabold' 
                              : (isCurrentMonth || viewMode === 'week' 
                                  ? 'text-gray-800 dark:text-gray-200 font-bold' 
                                  : 'text-gray-400 dark:text-gray-500')
                            )}`}
                    >
                      {format(day, 'd')}
                    </span>
                    <div className="flex items-center gap-1">
                      {dayEvents.length > 0 && (
                        <span className="text-xs bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 px-1.5 rounded font-bold">
                          {dayEvents.length}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddMemo(day); }}
                        className="opacity-0 hover:opacity-100 p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded text-blue-500 dark:text-blue-400 transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Mobile: Dot View */}
                  <div className="md:hidden flex flex-wrap gap-1 content-end mt-auto px-1 pb-1">
                    {dayEvents.slice(0, 5).map((ev, i) => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full ${getColorClass(ev.color, 'bg').replace('100', '500')}`} />
                    ))}
                    {dayEvents.length > 5 && <span className="text-[8px] text-gray-500 dark:text-gray-400">+</span>}
                  </div>

                  {/* Desktop: Event List */}
                  <div className="hidden md:block flex-1 overflow-y-auto no-scrollbar space-y-0.5 mt-1">
                    {dayEvents.slice(0, viewMode === 'week' ? 8 : 3).map((ev) => {
                      // Settlement events get special styling
                      const isSettlement = ev.type === 'settlement';
                      const isHoliday = ev.type === 'holiday';
                      const isTax = ev.type === 'tax';

                      // Get icon based on content/type
                      const getEventIcon = () => {
                        if (isHoliday) return '🎌';
                        if (isTax) return '📋';
                        if (isSettlement) {
                          if (ev.title.includes('입금')) return '💵';
                          if (ev.title.includes('수수료')) return '💸';
                          if (ev.title.includes('수금')) return '💰';
                          if (ev.title.includes('지급')) return '💳';
                          return '💰';
                        }
                        return '';
                      };

                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (ev.type === 'memo') {
                              const memoId = ev.id.replace('memo-', '').replace(/-\d+$/, '');
                              handleEditMemo(memoId);
                            }
                          }}
                          className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 flex items-center gap-1
                            ${isSettlement
                              ? (ev.title.includes('예정')
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-dashed border-emerald-300 dark:border-emerald-700'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium border border-emerald-200 dark:border-emerald-800')
                              : isHoliday
                                ? 'bg-red-100 dark:bg-rose-950/60 text-red-700 dark:text-rose-300 font-medium border border-rose-200 dark:border-rose-800'
                                : `${getColorClass(ev.color, 'bg')} ${getColorClass(ev.color, 'text')}`
                            }`}
                          title={`${ev.time || ''} ${ev.title} - ${ev.subtitle || ''}`}
                        >
                          {(isSettlement || isHoliday || isTax) && (
                            <span className="flex-shrink-0">{getEventIcon()}</span>
                          )}
                          {ev.time && <span className="font-mono">{ev.time}</span>}
                          <span className="truncate">{ev.title}</span>
                        </div>
                      );
                    })}
                    {dayEvents.length > (viewMode === 'week' ? 8 : 3) && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        +{dayEvents.length - (viewMode === 'week' ? 8 : 3)}개 더
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Memo Modal */}
      <CalendarMemoModal
        isOpen={isMemoModalOpen}
        onClose={() => { setIsMemoModalOpen(false); setEditingMemo(null); }}
        onSave={handleSaveMemo}
        onDelete={editingMemo ? handleDeleteMemo : undefined}
        initialDate={memoModalDate}
        editingMemo={editingMemo}
      />
    </div>
  );
}