import React, { useState } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays,
  eachDayOfInterval, parse, isToday
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Phone, User } from 'lucide-react';
import { Case } from '../types';
import { Link } from 'react-router-dom';

interface CalendarWidgetProps {
  cases: Case[];
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
}

export default function CalendarWidget({ cases, onDateSelect, selectedDate }: CalendarWidgetProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToday = () => setCurrentDate(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const events = cases.flatMap(c =>
    (c.reminders || []).map(r => ({
      caseId: c.caseId,
      customerName: c.customerName,
      datetime: r.datetime,
      type: r.type || '통화', // Default to '통화' if undefined
    }))
  );

  const getEventsForDay = (date: Date) => {
    return events.filter(ev => {
      if (!ev.datetime) return false;
      const eventDate = parse(ev.datetime, 'yyyy-MM-dd HH:mm', new Date());
      return isSameDay(eventDate, date);
    }).sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <span className="text-xl">{format(currentDate, 'yyyy년 M월')}</span>
        </h3>
        <div className="flex items-center gap-2">
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

      {/* Days Header */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
          <div key={day} className={`text-center py-2 text-xs font-semibold ${idx === 0 ? 'text-red-500' : 'text-gray-500'}`}>
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
              className={`p-1 md:p-2 flex flex-col gap-1 cursor-pointer transition-colors h-[80px] md:h-[140px] border border-gray-100
                ${isSelected ? 'bg-blue-50 ring-2 ring-blue-500 ring-inset z-10' : (!isCurrentMonth ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white hover:bg-gray-50')}
              `}
            >
              <div className="flex justify-between items-start">
                <span
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                    ${isTodayDate ? 'bg-blue-600 text-white' : (isSelected ? 'text-blue-700 font-bold' : (isCurrentMonth ? 'text-gray-700' : 'text-gray-400'))}`}
                >
                  {format(day, 'd')}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 rounded font-bold">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Mobile: Dot View */}
              <div className="md:hidden flex flex-wrap gap-1 content-end mt-auto px-1 pb-1">
                {dayEvents.slice(0, 5).map((ev, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${ev.type === '방문미팅' ? 'bg-purple-500' :
                      ev.type === '출장미팅' ? 'bg-green-500' :
                        'bg-blue-500'
                      }`}
                  />
                ))}
                {dayEvents.length > 5 && <span className="text-[8px] text-gray-400 text-xs">+</span>}
              </div>

              {/* Desktop: Event List (Fixed height) */}
              <div className="hidden md:block h-[96px] overflow-y-auto no-scrollbar space-y-1 mt-1">
                {dayEvents.map((ev, index) => {
                  const timeStr = ev.datetime?.split(' ')[1] || ''; // HH:mm
                  // Truncate name to 4 chars
                  const truncatedName = ev.customerName.length > 4
                    ? ev.customerName.substring(0, 4) + '...'
                    : ev.customerName;

                  return (
                    <Link
                      key={`${ev.caseId}-${index}`}
                      to={`/case/${ev.caseId}`}
                      className={`block text-[10px] px-1 py-0.5 rounded border border-transparent hover:border-blue-200 transition-colors truncate
                                ${isTodayDate ? 'bg-blue-50 text-blue-700' : 'bg-white hover:bg-gray-50 text-gray-600'}
                            `}
                      title={`${timeStr} [${ev.type}] ${ev.customerName}`}
                    >
                      <div className="flex items-center gap-1 w-full">
                        <span className="font-mono font-bold text-gray-500 whitespace-nowrap">{timeStr}</span>
                        <span className={`font-bold whitespace-nowrap ${ev.type === '방문미팅' ? 'text-purple-600' :
                          ev.type === '출장미팅' ? 'text-green-600' :
                            'text-blue-600'
                          }`}>[{ev.type}]</span>
                        <span className="font-medium truncate flex-1 text-left">{truncatedName}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div >
    </div >
  );
}