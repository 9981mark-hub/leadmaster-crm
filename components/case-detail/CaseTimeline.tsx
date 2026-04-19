import React, { useState, useMemo } from 'react';
import { format, parseISO, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
    ArrowRightLeft, MessageSquare, Banknote, Phone, Mic,
    Calendar, Filter, ChevronDown, ChevronUp, Smartphone, AlertTriangle
} from 'lucide-react';
import { Case, CaseStatusLog, MemoItem, ReminderItem, RecordingItem, TelegramFeedback } from '../../types';

// 타임라인 이벤트 유형
type TimelineEventType = 'status' | 'memo' | 'deposit' | 'reminder' | 'recording' | 'telegram' | 'telegram_pending';

interface TimelineEvent {
    id: string;
    type: TimelineEventType;
    datetime: string; // ISO string
    title: string;
    description?: string;
    amount?: number;
    meta?: Record<string, string>;
}

interface CaseTimelineProps {
    c: Case;
    statusLogs: CaseStatusLog[];
    telegramFeedbacks?: TelegramFeedback[];
    onConfirmTelegram?: (feedback: TelegramFeedback) => void;
}

// 유형별 스타일 설정
const EVENT_CONFIG: Record<TimelineEventType, {
    icon: React.FC<any>;
    label: string;
    bgColor: string;
    dotColor: string;
    textColor: string;
    borderColor: string;
    emoji: string;
}> = {
    status: {
        icon: ArrowRightLeft,
        label: '상태 변경',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        dotColor: 'bg-purple-500',
        textColor: 'text-purple-700 dark:text-purple-300',
        borderColor: 'border-purple-200 dark:border-purple-700',
        emoji: '🔄'
    },
    memo: {
        icon: MessageSquare,
        label: '메모',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        dotColor: 'bg-blue-500',
        textColor: 'text-blue-700 dark:text-blue-300',
        borderColor: 'border-blue-200 dark:border-blue-700',
        emoji: '💬'
    },
    deposit: {
        icon: Banknote,
        label: '입금',
        bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
        dotColor: 'bg-emerald-500',
        textColor: 'text-emerald-700 dark:text-emerald-300',
        borderColor: 'border-emerald-200 dark:border-emerald-700',
        emoji: '💵'
    },
    reminder: {
        icon: Phone,
        label: '리마인더',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        dotColor: 'bg-orange-500',
        textColor: 'text-orange-700 dark:text-orange-300',
        borderColor: 'border-orange-200 dark:border-orange-700',
        emoji: '📞'
    },
    recording: {
        icon: Mic,
        label: '녹취',
        bgColor: 'bg-gray-50 dark:bg-gray-700/30',
        dotColor: 'bg-gray-500',
        textColor: 'text-gray-700 dark:text-gray-300',
        borderColor: 'border-gray-200 dark:border-gray-600',
        emoji: '🎙️'
    },
    telegram: {
        icon: Smartphone,
        label: 'TG 피드백',
        bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
        dotColor: 'bg-indigo-500',
        textColor: 'text-indigo-700 dark:text-indigo-300',
        borderColor: 'border-indigo-200 dark:border-indigo-700',
        emoji: '📱'
    },
    telegram_pending: {
        icon: AlertTriangle,
        label: '승인 대기',
        bgColor: 'bg-rose-50 dark:bg-rose-900/20',
        dotColor: 'bg-rose-500',
        textColor: 'text-rose-700 dark:text-rose-300',
        borderColor: 'border-rose-200 dark:border-rose-700',
        emoji: '⚠️'
    }
};

// 날짜 그룹 라벨
function getDateGroup(datetime: string): string {
    try {
        const date = parseISO(datetime);
        if (isToday(date)) return '오늘';
        if (isYesterday(date)) return '어제';
        if (isThisWeek(date, { weekStartsOn: 1 })) return '이번 주';
        if (isThisMonth(date)) return '이번 달';
        return format(date, 'yyyy년 M월', { locale: ko });
    } catch {
        return '기타';
    }
}

export const CaseTimeline: React.FC<CaseTimelineProps> = ({ c, statusLogs, telegramFeedbacks, onConfirmTelegram }) => {
    const [activeFilters, setActiveFilters] = useState<Set<TimelineEventType>>(
        new Set(['status', 'memo', 'deposit', 'reminder', 'recording', 'telegram', 'telegram_pending'])
    );
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // 모든 이벤트를 수집하여 통합
    const allEvents = useMemo<TimelineEvent[]>(() => {
        const events: TimelineEvent[] = [];

        // 1. 상태 변경 로그
        (statusLogs || []).forEach(log => {
            events.push({
                id: `status-${log.logId || log.changedAt}`,
                type: 'status',
                datetime: log.changedAt,
                title: `${log.fromStatus} → ${log.toStatus}`,
                description: log.memo || undefined,
                meta: { changedBy: log.changedBy || 'User' }
            });
        });

        // 2. 메모
        (c.specialMemo || []).forEach(memo => {
            events.push({
                id: `memo-${memo.id}`,
                type: 'memo',
                datetime: memo.createdAt || (memo as any).datetime,
                title: memo.content.length > 60 ? memo.content.substring(0, 60) + '...' : memo.content,
                description: memo.content.length > 60 ? memo.content : undefined
            });
        });

        // 3. 입금 내역
        (c.depositHistory || []).forEach((deposit, idx) => {
            const depositDatetime = deposit.date.includes('T') ? deposit.date : deposit.date + 'T00:00:00';
            events.push({
                id: `deposit-${idx}-${deposit.date}`,
                type: 'deposit',
                datetime: depositDatetime,
                title: `${idx + 1}차 입금`,
                amount: deposit.amount,
                description: deposit.memo || undefined
            });
        });

        // 4. 리마인더
        (c.reminders || []).forEach(reminder => {
            const reminderDatetime = reminder.datetime.includes('T')
                ? reminder.datetime
                : reminder.datetime.replace(' ', 'T') + ':00';
            const resultLabel = reminder.resultStatus ? ` [${reminder.resultStatus}]` : '';
            events.push({
                id: `reminder-${reminder.id}`,
                type: 'reminder',
                datetime: reminderDatetime,
                title: `${reminder.type || '통화'}${resultLabel}`,
                description: [reminder.content, reminder.resultNote].filter(Boolean).join(' — ') || undefined,
                meta: {
                    ...(reminder.resultStatus ? { result: reminder.resultStatus } : {})
                }
            });
        });

        // 5. 녹취
        (c.recordings || []).forEach(rec => {
            events.push({
                id: `recording-${rec.id}`,
                type: 'recording',
                datetime: rec.uploadDate,
                title: rec.filename,
                meta: rec.duration ? { duration: `${Math.floor(rec.duration / 60)}분 ${rec.duration % 60}초` } : {}
            });
        });

        // 6. 텔레그램 피드백
        (telegramFeedbacks || []).forEach(tf => {
            const isPending = tf.applyMode === 'pending' && !tf.isConfirmed;
            events.push({
                id: `tg-${tf.id}`,
                type: isPending ? 'telegram_pending' : 'telegram',
                datetime: tf.createdAt,
                title: `${tf.senderName} (${tf.feedbackType})`,
                description: tf.feedbackContent,
                meta: {
                    originalData: JSON.stringify(tf),
                    isPending: isPending ? 'true' : 'false'
                }
            });
        });

        // 날짜 기준 최신순 정렬
        events.sort((a, b) => String(b.datetime || '').localeCompare(String(a.datetime || '')));
        return events;
    }, [c, statusLogs, telegramFeedbacks]);

    // 필터 적용
    const filteredEvents = useMemo(() =>
        allEvents.filter(e => activeFilters.has(e.type)),
        [allEvents, activeFilters]
    );

    // 날짜 그룹별 분류
    const groupedEvents = useMemo(() => {
        const groups: { label: string; events: TimelineEvent[] }[] = [];
        let currentGroup = '';

        filteredEvents.forEach(event => {
            const group = getDateGroup(event.datetime);
            if (group !== currentGroup) {
                groups.push({ label: group, events: [event] });
                currentGroup = group;
            } else {
                groups[groups.length - 1].events.push(event);
            }
        });

        return groups;
    }, [filteredEvents]);

    // 필터 토글
    const toggleFilter = (type: TimelineEventType) => {
        setActiveFilters(prev => {
            const next = new Set(prev);
            if (next.has(type)) {
                if (next.size > 1) next.delete(type); // 최소 1개
            } else {
                next.add(type);
            }
            return next;
        });
    };

    const toggleAll = () => {
        if (activeFilters.size === 7) {
            setActiveFilters(new Set(['status']));
        } else {
            setActiveFilters(new Set(['status', 'memo', 'deposit', 'reminder', 'recording', 'telegram', 'telegram_pending']));
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // 시간 포맷
    const formatTime = (datetime: string) => {
        try {
            const d = parseISO(datetime);
            return format(d, 'HH:mm');
        } catch {
            return '';
        }
    };

    const formatDate = (datetime: string) => {
        try {
            const d = parseISO(datetime);
            return format(d, 'M/d (E)', { locale: ko });
        } catch {
            return '';
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex-shrink-0">
                        <Calendar size={20} className="text-gray-500" />
                    </div>
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 leading-tight">
                        커뮤니케이션<br className="block sm:hidden" /><span className="hidden sm:inline"> </span>타임라인
                    </h3>
                    <div className="flex-shrink-0">
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full whitespace-nowrap">
                            {filteredEvents.length}/{allEvents.length}건
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isFilterOpen
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200'
                        }`}
                >
                    <Filter size={14} className="flex-shrink-0" />
                    <span className="whitespace-nowrap">필터</span>
                    {isFilterOpen ? <ChevronUp size={14} className="flex-shrink-0" /> : <ChevronDown size={14} className="flex-shrink-0" />}
                </button>
            </div>

            {/* Filter Panel */}
            {isFilterOpen && (
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <button
                        onClick={toggleAll}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${activeFilters.size === 7
                                ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-800'
                                : 'bg-white text-gray-500 border border-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
                            }`}
                    >
                        전체
                    </button>
                    {(Object.keys(EVENT_CONFIG) as TimelineEventType[]).map(type => {
                        const config = EVENT_CONFIG[type];
                        const isActive = activeFilters.has(type);
                        const count = allEvents.filter(e => e.type === type).length;
                        return (
                            <button
                                key={type}
                                onClick={() => toggleFilter(type)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${isActive
                                        ? `${config.bgColor} ${config.textColor} ring-1 ring-current`
                                        : 'bg-white text-gray-400 border border-gray-200 dark:bg-gray-700 dark:text-gray-500 dark:border-gray-600'
                                    }`}
                            >
                                <span>{config.emoji}</span>
                                {config.label}
                                <span className="opacity-60">({count})</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Timeline */}
            {filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Calendar size={40} className="mb-3 opacity-50" />
                    <p className="text-sm">표시할 활동이 없습니다.</p>
                </div>
            ) : (
                <div className="relative">
                    {groupedEvents.map((group, groupIdx) => (
                        <div key={`${group.label}-${groupIdx}`} className="mb-6">
                            {/* Date Group Header */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                    {group.label}
                                </span>
                                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                            </div>

                            {/* Events in group */}
                            <div className="relative pl-8">
                                {/* Vertical line */}
                                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />

                                {group.events.map((event, eventIdx) => {
                                    const config = EVENT_CONFIG[event.type];
                                    const IconComponent = config.icon;
                                    const isExpanded = expandedIds.has(event.id);
                                    const hasExpandableContent = event.description && event.description.length > 80;

                                    return (
                                        <div key={event.id} className="relative mb-3 last:mb-0">
                                            {/* Dot */}
                                            <div className={`absolute -left-5 top-3 w-3 h-3 rounded-full ${config.dotColor} ring-2 ring-white dark:ring-gray-900 z-10`} />

                                            {/* Card */}
                                            <div
                                                className={`${config.bgColor} border ${config.borderColor} rounded-lg p-3 transition-all hover:shadow-sm cursor-default`}
                                                onClick={() => hasExpandableContent && toggleExpand(event.id)}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-start gap-2 min-w-0 flex-1">
                                                        <div className={`flex-shrink-0 mt-0.5 ${config.textColor}`}>
                                                            <IconComponent size={16} />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`text-xs font-bold ${config.textColor}`}>
                                                                    {config.emoji} {config.label}
                                                                </span>
                                                                {event.meta?.result && (
                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${event.meta.result === '완료' ? 'bg-green-100 text-green-700' :
                                                                            event.meta.result === '미연결' ? 'bg-red-100 text-red-700' :
                                                                                event.meta.result === '재예약' ? 'bg-blue-100 text-blue-700' :
                                                                                    'bg-gray-100 text-gray-600'
                                                                        }`}>
                                                                        {event.meta.result}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 font-medium">
                                                                {event.title}
                                                            </p>
                                                            {event.description && (
                                                                <p className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${hasExpandableContent && !isExpanded ? 'line-clamp-2' : ''
                                                                    }`}>
                                                                    {event.description}
                                                                </p>
                                                            )}
                                                            {hasExpandableContent && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); toggleExpand(event.id); }}
                                                                    className="text-[10px] text-gray-400 hover:text-gray-600 mt-0.5"
                                                                >
                                                                    {isExpanded ? '접기 ↑' : '더보기 ↓'}
                                                                </button>
                                                            )}
                                                            
                                                            {event.type === 'telegram_pending' && event.meta?.isPending === 'true' && onConfirmTelegram && (
                                                                <div className="mt-3 flex gap-2">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (event.meta?.originalData) {
                                                                                onConfirmTelegram(JSON.parse(event.meta.originalData));
                                                                            }
                                                                        }}
                                                                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-md shadow-sm transition-colors"
                                                                    >
                                                                        선택하여 승인 처리
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end flex-shrink-0">
                                                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                                            {formatDate(event.datetime)}
                                                        </span>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                            {formatTime(event.datetime)}
                                                        </span>
                                                        {event.amount !== undefined && (
                                                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                                                {event.amount.toLocaleString()}만원
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
