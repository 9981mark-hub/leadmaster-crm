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

const REPEAT_OPTIONS = [
    { value: 'none', label: '반복 안함' },
    { value: 'weekly', label: '매주' },
    { value: 'monthly', label: '매월' },
    { value: 'yearly', label: '매년 (양력)' },
    { value: 'lunar_yearly', label: '매년 (음력)' },
];

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
    const [repeatType, setRepeatType] = useState<'none' | 'weekly' | 'monthly' | 'yearly' | 'lunar_yearly'>('none');

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
            setRepeatType(editingMemo.repeatType || 'none');
        } else {
            setTitle('');
            setContent('');
            setDate(initialDate || format(new Date(), 'yyyy-MM-dd'));
            setTime('');
            setIsAllDay(true);
            setColor('blue');
            setHasNotification(false);
            setNotifyMinutesBefore(30);
            setRepeatType('none');
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
            repeatType: repeatType === 'none' ? undefined : repeatType,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
            <div className="relative w-full max-w-md max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-card shrink-0">
                    <h2 className="text-base font-bold text-foreground">
                        {editingMemo ? '메모 수정' : '새 메모'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="창 닫기">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar text-xs">
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">제목 *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="일정 제목을 입력하세요"
                            className="w-full px-3 py-2 border border-input bg-background text-foreground placeholder:text-muted-foreground rounded-xl focus:ring-1 focus:ring-primary outline-none transition-colors text-xs"
                            autoFocus
                        />
                    </div>

                    {/* Date and Repeat */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-foreground mb-1">날짜</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-xl focus:ring-1 focus:ring-primary outline-none transition-colors text-xs font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-foreground mb-1">반복 설정</label>
                            <select
                                value={repeatType}
                                onChange={(e) => setRepeatType(e.target.value as any)}
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-xl focus:ring-1 focus:ring-primary outline-none transition-colors text-xs"
                            >
                                {REPEAT_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value} className="bg-card text-foreground">{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* All Day Toggle */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">종일</span>
                        <button
                            type="button"
                            onClick={() => setIsAllDay(!isAllDay)}
                            className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${isAllDay ? 'bg-primary' : 'bg-muted'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow-xs transform transition-transform ${isAllDay ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {/* Time (if not all day) */}
                    {!isAllDay && (
                        <div>
                            <label className="block text-xs font-semibold text-foreground mb-1">
                                <Clock size={13} className="inline mr-1 text-muted-foreground" />
                                시간
                            </label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-xl focus:ring-1 focus:ring-primary outline-none transition-colors text-xs font-mono"
                            />
                        </div>
                    )}

                    {/* Content */}
                    <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">메모 내용</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="상세 내용을 입력하세요 (선택)"
                            rows={3}
                            className="w-full px-3 py-2 border border-input bg-background text-foreground placeholder:text-muted-foreground rounded-xl focus:ring-1 focus:ring-primary resize-none outline-none transition-colors text-xs"
                        />
                    </div>

                    {/* Color */}
                    <div>
                        <label className="block text-xs font-semibold text-foreground mb-2">
                            <Palette size={13} className="inline mr-1 text-muted-foreground" />
                            라벨 색상
                        </label>
                        <div className="flex gap-2">
                            {COLORS.map((c) => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => setColor(c.value)}
                                    className={`w-7 h-7 rounded-full ${c.className} ${color === c.value ? 'ring-2 ring-offset-2 ring-primary ring-offset-background scale-110' : 'opacity-80 hover:opacity-100'} transition-all cursor-pointer`}
                                    title={c.label}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Notification */}
                    <div className="bg-secondary/40 border border-border rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <Bell size={13} className="text-primary" />
                                알림 설정
                            </span>
                            <button
                                type="button"
                                onClick={() => setHasNotification(!hasNotification)}
                                className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${hasNotification ? 'bg-primary' : 'bg-muted'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-xs transform transition-transform ${hasNotification ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {hasNotification && (
                            <div>
                                <select
                                    value={notifyMinutesBefore}
                                    onChange={(e) => setNotifyMinutesBefore(Number(e.target.value))}
                                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-xl focus:ring-1 focus:ring-primary outline-none transition-colors text-xs"
                                >
                                    {NOTIFY_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value} className="bg-card text-foreground">{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-card flex items-center justify-end gap-2 shrink-0">
                    {editingMemo && onDelete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="mr-auto px-4 py-2.5 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                            삭제
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-muted text-foreground text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                    >
                        취소 / 닫기
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!title.trim()}
                        className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        저장
                    </button>
                </div>
            </div>
        </div>
    );
}
