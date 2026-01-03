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
}

export default function CalendarWidget({ cases }: CalendarWidgetProps) {
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

          return (
            <div 
              key={day.toISOString()} 
              className={`min-h-[100px] bg-white p-2 flex flex-col gap-1 ${!isCurrentMonth ? 'bg-gray-50' : ''}`}
            >
              <div className="flex justify-between items-start">
                <span 
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full 
                    ${isTodayDate ? 'bg-blue-600 text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}`}
                >
                  {format(day, 'd')}
                </span>
                {dayEvents.length > 0 && (
                   <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 rounded font-bold">
                     {dayEvents.length}건
                   </span>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-1 mt-1">
                {dayEvents.map((ev, index) => {
                    const timeStr = ev.datetime?.split(' ')[1] || ''; // HH:mm
                    return (
                        <Link 
                            key={`${ev.caseId}-${index}`} 
                            to={`/case/${ev.caseId}`}
                            className={`block text-[10px] p-1 rounded border truncate hover:opacity-80 transition-opacity
                                ${isTodayDate ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-600'}
                            `}
                        >
                            <div className="flex items-center gap-1">
                                <span className="font-mono font-bold text-gray-500">{timeStr}</span>
                                <span className="font-semibold">{ev.customerName}</span>
                            </div>
                        </Link>
                    );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}