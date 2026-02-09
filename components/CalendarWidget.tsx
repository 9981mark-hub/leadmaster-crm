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
  Calendar, List, Clock, Plus, Filter, DollarSign, FileText, Edit
} from 'lucide-react';
import { Case, SettlementBatch, CalendarMemo, CalendarEventType } from '../types';
import { Link } from 'react-router-dom';
import { fetchCalendarMemos, createCalendarMemo, updateCalendarMemo, deleteCalendarMemo } from '../services/calendarMemoService';
import CalendarMemoModal from './CalendarMemoModal';

interface CalendarWidgetProps {
  cases: Case[];
  batches?: SettlementBatch[];
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
  showFilters?: boolean;
}

type ViewMode = 'month' | 'week' | 'list';

interface UnifiedEvent {
  id: string;
  type: CalendarEventType;
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
  onDateSelect,
  selectedDate,
  showFilters = true
}: CalendarWidgetProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [memos, setMemos] = useState<CalendarMemo[]>([]);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [memoModalDate, setMemoModalDate] = useState<string | undefined>();
  const [editingMemo, setEditingMemo] = useState<CalendarMemo | null>(null);

  // Filters
  const [filters, setFilters] = useState<Record<CalendarEventType, boolean>>({
    reminder: true,
    settlement: true,
    tax: true,
    memo: true
  });

  // Load memos
  useEffect(() => {
    const loadMemos = async () => {
      try {
        const loadedMemos = await fetchCalendarMemos();
        setMemos(loadedMemos);
      } catch (e) {
        console.error('Failed to load memos:', e);
      }
    };
    loadMemos();
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

      // Expected deposits from cases
      cases.forEach(c => {
        (c.expectedDeposits || []).forEach((ed, idx) => {
          if (ed.date && isAfter(parseISO(ed.date), new Date())) {
            events.push({
              id: `expected-deposit-${c.caseId}-${idx}`,
              type: 'settlement',
              date: ed.date,
              title: `예상입금 ${ed.amount}만원`,
              subtitle: c.customerName,
              color: 'teal',
              icon: <DollarSign size={12} />
            });
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
      memos.forEach(m => {
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
      });
    }

    return events;
  }, [cases, batches, memos, filters, currentDate]);

  const getEventsForDay = (date: Date): UnifiedEvent[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return unifiedEvents.filter(ev => ev.date === dateStr)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  };

  const getColorClass = (color: string, type: 'bg' | 'text' | 'border' = 'bg') => {
    const colors: Record<string, Record<string, string>> = {
      blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300' },
      green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-300' },
      orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-300' },
      red: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-300' },
      purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-300' },
      teal: { bg: 'bg-teal-100', text: 'text-teal-600', border: 'border-teal-300' },
      gray: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
    };
    return colors[color]?.[type] || colors.gray[type];
  };

  const toggleFilter = (type: CalendarEventType) => {
    setFilters(prev => ({ ...prev, [type]: !prev[type] }));
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
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
      .slice(0, 20);
  }, [unifiedEvents]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <span className="text-xl">
              {viewMode === 'week'
                ? `${format(startDate, 'M/d', { locale: ko })} ~ ${format(endDate, 'M/d', { locale: ko })}`
                : format(currentDate, 'yyyy년 M월')
              }
            </span>
          </h3>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('month')}
                className={`px-2 py-1 text-xs rounded ${viewMode === 'month' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                title="월간"
              >
                <Calendar size={14} />
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-2 py-1 text-xs rounded ${viewMode === 'week' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                title="주간"
              >
                <Clock size={14} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-2 py-1 text-xs rounded ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                title="리스트"
              >
                <List size={14} />
              </button>
            </div>

            <button onClick={goToday} className="px-3 py-1 text-xs font-medium bg-gray-100 rounded hover:bg-gray-200 text-gray-600">
              오늘
            </button>
            <div className="flex rounded-md border border-gray-200 bg-white">
              <button onClick={prevMonth} className="p-1 hover:bg-gray-50 text-gray-600 border-r border-gray-200">
                <ChevronLeft size={20} />
              </button>
              <button onClick={nextMonth} className="p-1 hover:bg-gray-50 text-gray-600">
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
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${filters.reminder ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
                }`}
            >
              📞 리마인더
            </button>
            <button
              onClick={() => toggleFilter('settlement')}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${filters.settlement ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}
            >
              💰 정산
            </button>
            <button
              onClick={() => toggleFilter('tax')}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${filters.tax ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'
                }`}
            >
              📅 세금
            </button>
            <button
              onClick={() => toggleFilter('memo')}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${filters.memo ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'
                }`}
            >
              📝 메모
            </button>
            <button
              onClick={() => handleAddMemo(new Date())}
              className="px-3 py-1 text-xs rounded-full font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
            >
              <Plus size={12} /> 메모 추가
            </button>
          </div>
        )}
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div className="p-4 max-h-[500px] overflow-y-auto">
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
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
                      handleEditMemo(ev.id.replace('memo-', ''));
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
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
              <div key={day} className={`text-center py-2 text-xs font-semibold ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 bg-gray-200 gap-px">
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
                  className={`p-1 md:p-2 flex flex-col gap-1 cursor-pointer transition-colors ${viewMode === 'week' ? 'h-[260px]' : 'h-[104px] md:h-[156px]'} border border-gray-100 relative
                    ${isSelected ? 'bg-blue-50 ring-2 ring-blue-500 ring-inset z-10' : (!isCurrentMonth && viewMode === 'month' ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white hover:bg-gray-50')}
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
                            {ev.subtitle && <div className="text-gray-400">{ev.subtitle}</div>}
                          </div>
                        ))}
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-900" />
                    </div>
                  )}

                  <div className="flex justify-between items-start">
                    <span
                      className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                        ${isTodayDate ? 'bg-blue-600 text-white' : (isSelected ? 'text-blue-700 font-bold' : (isCurrentMonth || viewMode === 'week' ? 'text-gray-700' : 'text-gray-400'))}`}
                    >
                      {format(day, 'd')}
                    </span>
                    <div className="flex items-center gap-1">
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 rounded font-bold">
                          {dayEvents.length}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddMemo(day); }}
                        className="opacity-0 hover:opacity-100 p-0.5 hover:bg-blue-100 rounded text-blue-500"
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
                    {dayEvents.length > 5 && <span className="text-[8px] text-gray-400">+</span>}
                  </div>

                  {/* Desktop: Event List */}
                  <div className="hidden md:block flex-1 overflow-y-auto no-scrollbar space-y-0.5 mt-1">
                    {dayEvents.slice(0, viewMode === 'week' ? 8 : 3).map((ev) => (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (ev.type === 'memo') {
                            handleEditMemo(ev.id.replace('memo-', ''));
                          }
                        }}
                        className={`text-[10px] px-1 py-0.5 rounded truncate ${getColorClass(ev.color, 'bg')} ${getColorClass(ev.color, 'text')} cursor-pointer hover:opacity-80`}
                        title={`${ev.time || ''} ${ev.title} - ${ev.subtitle || ''}`}
                      >
                        {ev.time && <span className="font-mono mr-1">{ev.time}</span>}
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > (viewMode === 'week' ? 8 : 3) && (
                      <div className="text-[9px] text-gray-400 text-center">
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