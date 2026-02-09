import React, { useState, useEffect } from 'react';
import { X, Bell, Clock, Palette } from 'lucide-react';
import { CalendarMemo } from '../types';
import { format } from 'date-fns';

interface CalendarMemoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (memo: Omit<CalendarMemo, 'id' | 'createdAt' | 'updatedAt'>) => void;
    onDelete?: () => void;
    initialDate?: string;
    editingMemo?: CalendarMemo | null;
}

const COLORS: { value: CalendarMemo['color']; label: string; className: string }[] = [
    { value: 'blue', label: '파랑', className: 'bg-blue-500' },
    { value: 'green', label: '초록', className: 'bg-green-500' },
    { value: 'orange', label: '주황', className: 'bg-orange-500' },
    { value: 'red', label: '빨강', className: 'bg-red-500' },
    { value: 'purple', label: '보라', className: 'bg-purple-500' },
    { value: 'gray', label: '회색', className: 'bg-gray-500' },
];

const NOTIFY_OPTIONS = [
    { value: 0, label: '정시' },
    { value: 10, label: '10분 전' },
    { value: 30, label: '30분 전' },
    { value: 60, label: '1시간 전' },
    { value: 1440, label: '1일 전' },
];

export default function CalendarMemoModal({
    isOpen,
    onClose,
    onSave,
    onDelete,
    initialDate,
    editingMemo
}: CalendarMemoModalProps) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [date, setDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
    const [time, setTime] = useState('');
    const [isAllDay, setIsAllDay] = useState(true);
    const [color, setColor] = useState<CalendarMemo['color']>('blue');
    const [hasNotification, setHasNotification] = useState(false);
    const [notifyMinutesBefore, setNotifyMinutesBefore] = useState(30);

    useEffect(() => {
        if (editingMemo) {
            setTitle(editingMemo.title);
            setContent(editingMemo.content || '');
            setDate(editingMemo.date);
            setTime(editingMemo.time || '');
            setIsAllDay(editingMemo.isAllDay ?? true);
            setColor(editingMemo.color || 'blue');
            setHasNotification(editingMemo.hasNotification || false);
            setNotifyMinutesBefore(editingMemo.notifyMinutesBefore || 30);
        } else {
            setTitle('');
            setContent('');
            setDate(initialDate || format(new Date(), 'yyyy-MM-dd'));
            setTime('');
            setIsAllDay(true);
            setColor('blue');
            setHasNotification(false);
            setNotifyMinutesBefore(30);
        }
    }, [editingMemo, initialDate, isOpen]);

    const handleSave = () => {
        if (!title.trim()) return;

        onSave({
            date,
            time: isAllDay ? undefined : time,
            title: title.trim(),
            content: content.trim() || undefined,
            color,
            isAllDay,
            hasNotification,
            notifyMinutesBefore: hasNotification ? notifyMinutesBefore : undefined,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">
                        {editingMemo ? '메모 수정' : '새 메모'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="일정 제목을 입력하세요"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            autoFocus
                        />
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* All Day Toggle */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">종일</span>
                        <button
                            onClick={() => setIsAllDay(!isAllDay)}
                            className={`w-12 h-6 rounded-full transition-colors ${isAllDay ? 'bg-blue-500' : 'bg-gray-300'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${isAllDay ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                    </div>

                    {/* Time (if not all day) */}
                    {!isAllDay && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Clock size={14} className="inline mr-1" />
                                시간
                            </label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    )}

                    {/* Content */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">메모 내용</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="상세 내용 (선택)"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                    </div>

                    {/* Color */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Palette size={14} className="inline mr-1" />
                            색상
                        </label>
                        <div className="flex gap-2">
                            {COLORS.map((c) => (
                                <button
                                    key={c.value}
                                    onClick={() => setColor(c.value)}
                                    className={`w-8 h-8 rounded-full ${c.className} ${color === c.value ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                                    title={c.label}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Notification */}
                    <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                <Bell size={14} />
                                알림 설정
                            </span>
                            <button
                                onClick={() => setHasNotification(!hasNotification)}
                                className={`w-12 h-6 rounded-full transition-colors ${hasNotification ? 'bg-blue-500' : 'bg-gray-300'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${hasNotification ? 'translate-x-6' : 'translate-x-0.5'}`} />
                            </button>
                        </div>

                        {hasNotification && (
                            <div>
                                <select
                                    value={notifyMinutesBefore}
                                    onChange={(e) => setNotifyMinutesBefore(Number(e.target.value))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                >
                                    {NOTIFY_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 flex gap-2">
                    {editingMemo && onDelete && (
                        <button
                            onClick={onDelete}
                            className="flex-1 py-2 px-4 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors"
                        >
                            삭제
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!title.trim()}
                        className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        저장
                    </button>
                </div>
            </div>
        </div>
    );
}
