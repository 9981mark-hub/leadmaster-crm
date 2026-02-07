import React, { useState } from 'react';
import {
    format, addMonths, subMonths, startOfMonth, endOfMonth,
    startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, isToday
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { SettlementBatch } from '../types';

interface SettlementCalendarProps {
    batches: SettlementBatch[];
}

interface SettlementEvent {
    date: string;
    type: 'collection' | 'payout' | 'invoice';
    label: string;
    amount?: number;
    batchId: string;
    weekLabel: string;
}

export default function SettlementCalendar({ batches }: SettlementCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Extract events from batches - ensure batches is always an array
    const safeBatches = Array.isArray(batches) ? batches : [];
    const events: SettlementEvent[] = [];
    safeBatches.forEach(batch => {
        // Collection event - check both collectionInfo.collectedAt and status
        if (batch.collectionInfo?.collectedAt) {
            events.push({
                date: batch.collectionInfo.collectedAt,
                type: 'collection',
                label: '수금',
                amount: batch.collectionInfo.amount,
                batchId: batch.batchId,
                weekLabel: batch.weekLabel
            });
        } else if (['collected', 'paid', 'completed'].includes(batch.status)) {
            // Legacy: status is collected but no collectedAt date - use cutoffDate as fallback
            events.push({
                date: batch.endDate,
                type: 'collection',
                label: '수금 (상태기준)',
                amount: batch.totalCommission,
                batchId: batch.batchId,
                weekLabel: batch.weekLabel
            });
        }
        // Payout events
        (batch.payoutItems || []).forEach(item => {
            if (item.paidAt) {
                events.push({
                    date: item.paidAt,
                    type: 'payout',
                    label: `지급: ${item.partnerName || '미지정'}`,
                    amount: item.amount,
                    batchId: batch.batchId,
                    weekLabel: batch.weekLabel
                });
            }
        });
        // Invoice received
        if (batch.purchaseInvoice?.receivedAt) {
            events.push({
                date: batch.purchaseInvoice.receivedAt,
                type: 'invoice',
                label: '세금계산서 수취',
                batchId: batch.batchId,
                weekLabel: batch.weekLabel
            });
        }
    });

    const getEventsForDay = (date: Date): SettlementEvent[] => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return events.filter(e => {
            // Handle both ISO format (2026-02-06T12:34:56Z) and yyyy-MM-dd format
            const eventDateStr = e.date ? e.date.substring(0, 10) : '';
            return eventDateStr === dateStr;
        });
    };

    const renderHeader = () => (
        <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-full">
                <ChevronLeft size={20} />
            </button>
            <h3 className="text-lg font-bold text-gray-700">
                {format(currentMonth, 'yyyy년 M월', { locale: ko })}
            </h3>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-full">
                <ChevronRight size={20} />
            </button>
        </div>
    );

    const renderDays = () => {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return (
            <div className="grid grid-cols-7 mb-2">
                {days.map(day => (
                    <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">{day}</div>
                ))}
            </div>
        );
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        const rows = [];
        let days = [];
        let day = startDate;

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                const cloneDay = day;
                const dayEvents = getEventsForDay(day);
                const hasEvents = dayEvents.length > 0;
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                days.push(
                    <div
                        key={day.toString()}
                        onClick={() => {
                            if (hasEvents) {
                                setSelectedDate(cloneDay);
                                setIsModalOpen(true);
                            }
                        }}
                        className={`
              min-h-[60px] p-1 border border-gray-100 cursor-pointer transition-all
              ${!isCurrentMonth ? 'bg-gray-50 text-gray-300' : 'hover:bg-blue-50'}
              ${isToday(day) ? 'bg-blue-50 border-blue-300' : ''}
              ${isSelected ? 'ring-2 ring-blue-500' : ''}
            `}
                    >
                        <span className={`text-sm ${isToday(day) ? 'font-bold text-blue-600' : ''}`}>
                            {format(day, 'd')}
                        </span>
                        {hasEvents && (
                            <div className="mt-1 space-y-0.5">
                                {dayEvents.slice(0, 2).map((e, idx) => (
                                    <div
                                        key={idx}
                                        className={`text-[10px] px-1 py-0.5 rounded truncate
                      ${e.type === 'collection' ? 'bg-green-100 text-green-700' :
                                                e.type === 'payout' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-purple-100 text-purple-700'}`}
                                    >
                                        {e.type === 'collection' ? '💰' : e.type === 'payout' ? '💳' : '📥'} {e.amount ? `${e.amount}만원` : e.label}
                                    </div>
                                ))}
                                {dayEvents.length > 2 && (
                                    <div className="text-[10px] text-gray-500">+{dayEvents.length - 2}건 더</div>
                                )}
                            </div>
                        )}
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(<div key={day.toString()} className="grid grid-cols-7">{days}</div>);
            days = [];
        }
        return <div>{rows}</div>;
    };

    const renderModal = () => {
        if (!isModalOpen || !selectedDate) return null;
        const dayEvents = getEventsForDay(selectedDate);

        return (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setIsModalOpen(false)}>
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">
                            📅 {format(selectedDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
                        </h3>
                        <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {dayEvents.map((e, idx) => (
                            <div
                                key={idx}
                                className={`p-4 rounded-lg border
                  ${e.type === 'collection' ? 'bg-green-50 border-green-200' :
                                        e.type === 'payout' ? 'bg-orange-50 border-orange-200' :
                                            'bg-purple-50 border-purple-200'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className={`text-sm font-bold
                      ${e.type === 'collection' ? 'text-green-700' :
                                                e.type === 'payout' ? 'text-orange-700' : 'text-purple-700'}`}>
                                            {e.type === 'collection' ? '💰 수금' : e.type === 'payout' ? '💳 지급' : '📥 세금계산서'}
                                        </span>
                                        <p className="text-gray-600 text-sm mt-1">{e.label}</p>
                                        <p className="text-xs text-gray-400 mt-1">{e.weekLabel}</p>
                                    </div>
                                    {e.amount && (
                                        <span className="text-lg font-bold text-gray-800">{e.amount.toLocaleString()}만원</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-700">📆 정산 히스토리 캘린더</h3>
                    <p className="text-xs text-gray-400 mt-1">총 {events.length}개의 이벤트 / {safeBatches.length}개 배치</p>
                </div>
                <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">💰 수금</span>
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full">💳 지급</span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">📥 세금계산서</span>
                </div>
            </div>
            {renderHeader()}
            {renderDays()}
            {renderCells()}
            {renderModal()}
        </div>
    );
}
