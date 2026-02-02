import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Phone, PhoneMissed, AlertTriangle, MessageSquare, Trash2, Sparkles, MapPin, Briefcase, MoreHorizontal, ChevronDown } from 'lucide-react';
import { Case, Partner, ReminderItem, CaseStatusLog } from '../../types'; // Adjust imports
import { getCaseWarnings, safeFormat, parseReminder } from '../../utils';
import HoverCheckTooltip from '../HoverCheckTooltip';
import { STATUS_COLOR_MAP } from '../../constants';
import { fetchCaseStatusLogs, fetchCases } from '../../services/api';

// --- Shared Helper Components ---
// Copied from CaseList.tsx
const SECONDARY_STATUS_COLOR_MAP: Record<string, string> = {
    '고객취소': 'text-red-400',
    '진행불가': 'text-red-400',
    '연락안받음': 'text-orange-400',
    '출장예약': 'text-green-400',
    '방문예약': 'text-blue-400',
    '고민중': 'text-yellow-400',
    '계약서작성': 'text-cyan-400',
    '관리중': 'text-indigo-400',
    '착수금입금': 'text-emerald-400',
    '기준비용입금': 'text-emerald-400',
};

const StatusHistoryTooltipContent = ({ caseId }: { caseId: string }) => {
    const [logs, setLogs] = useState<CaseStatusLog[] | null>(null);
    const [secondaryChanges, setSecondaryChanges] = useState<{ date: string; from: string; to: string; memo?: string }[]>([]);

    useEffect(() => {
        // Fetch status logs
        fetchCaseStatusLogs(caseId).then(setLogs);

        // Fetch case to get secondary status changes from memos
        fetchCases().then(cases => {
            const foundCase = cases.find(c => c.caseId === caseId);
            if (foundCase?.specialMemo) {
                const changes = foundCase.specialMemo
                    .filter(m => m.content.startsWith('[2차 상태 변경]'))
                    .map(m => {
                        const match = m.content.match(/\[2차 상태 변경\] (.+?) → (.+?)(\n|$)/);
                        return {
                            date: m.createdAt,
                            from: match?.[1] || '없음',
                            to: match?.[2] || '없음',
                            memo: m.content.includes('사유:') ? m.content.split('사유:')[1]?.trim() : undefined
                        };
                    });
                setSecondaryChanges(changes);
            }
        });
    }, [caseId]);

    if (!logs) return <span>로딩중...</span>;
    if (logs.length === 0 && secondaryChanges.length === 0) return <span>이력이 없습니다.</span>;

    return (
        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
            {/* 1차 상태 변경 이력 */}
            {logs.length > 0 && (
                <>
                    <p className="font-bold text-blue-300 border-b border-gray-600 pb-1 sticky top-0 bg-gray-900/90">1차 상태 변경 이력</p>
                    {logs.map((log, i) => (
                        <div key={i} className="text-[11px] border-b border-gray-700 last:border-0 pb-1 mb-1">
                            <div className="flex justify-between text-gray-400 mb-0.5">
                                <span>{log.fromStatus || '신규'} → <span className="text-blue-300">{log.toStatus}</span></span>
                                <span className="text-[10px]">{log.changedAt.split('T')[0]}</span>
                            </div>
                            {log.memo && <div className="text-gray-300 pl-1 border-l-2 border-gray-600">{log.memo}</div>}
                        </div>
                    ))}
                </>
            )}

            {secondaryChanges.length > 0 && (
                <>
                    <p className="font-bold text-purple-300 border-b border-gray-600 pb-1 mt-2">2차 상태 변경 이력</p>
                    {secondaryChanges.map((change, i) => (
                        <div key={i} className="text-[11px] border-b border-gray-700 last:border-0 pb-1 mb-1">
                            <div className="flex justify-between text-gray-400 mb-0.5">
                                <span>
                                    <span className={SECONDARY_STATUS_COLOR_MAP[change.from] || 'text-gray-300'}>{change.from}</span>
                                    {' → '}
                                    <span className={SECONDARY_STATUS_COLOR_MAP[change.to] || 'text-purple-300'}>{change.to}</span>
                                </span>
                                <span className="text-[10px]">{change.date.split('T')[0]}</span>
                            </div>
                            {change.memo && <div className="text-gray-300 pl-1 border-l-2 border-purple-600">{change.memo}</div>}
                        </div>
                    ))}
                </>
            )}
        </div>
    );
};

const getNextUpcomingReminder = (reminders?: ReminderItem[]): ReminderItem | null => {
    if (!reminders || reminders.length === 0) return null;

    const now = new Date();
    const upcoming = reminders
        .map(r => ({ ...r, dateObj: parseReminder(r.datetime) }))
        .filter(r => r.dateObj && r.dateObj >= now)
        .sort((a, b) => a.dateObj!.getTime() - b.dateObj!.getTime());

    return upcoming.length > 0 ? upcoming[0] : null;
};

const getLastConsultationDate = (c: Case): string => {
    if (!c.specialMemo || !Array.isArray(c.specialMemo) || c.specialMemo.length === 0) {
        return c.updatedAt;
    }
    const sortedMemos = [...c.specialMemo].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return sortedMemos[0]?.createdAt || c.updatedAt;
};


interface CaseListTableProps {
    cases: Case[];
    partners: Partner[];
    viewMode: 'active' | 'trash';
    missedCallStatus: string;
    missedCallInterval: number;
    statuses: string[]; // [NEW] Status list for quick change dropdown
    onDelete: (id: string, e: React.MouseEvent) => void;
    onRestore: (id: string, e: React.MouseEvent) => void;
    onMissedCall: (e: React.MouseEvent, c: Case) => void;
    onStatusChange: (caseId: string, newStatus: string, oldStatus: string) => void; // [NEW]
}

export const CaseListTable: React.FC<CaseListTableProps> = ({
    cases,
    partners,
    viewMode,
    missedCallStatus,
    missedCallInterval,
    statuses,
    onDelete,
    onRestore,
    onMissedCall,
    onStatusChange
}) => {
    // [NEW] State for status dropdown
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpenDropdownId(null);
            }
        };
        if (openDropdownId) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openDropdownId]);

    if (cases.length === 0) {
        return <div className="p-8 text-center text-gray-400 flex-1 flex items-center justify-center">검색 결과가 없습니다.</div>;
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 min-h-[500px] flex flex-col">
            {/* Mobile View (Cards) */}
            <div className="md:hidden space-y-4 p-4">
                {cases.map((c, index) => {
                    const partner = partners.find(p => p.partnerId === c.partnerId);
                    const warnings = getCaseWarnings(c, partner);
                    return (
                        <div key={c.caseId} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg flex flex-col gap-2 relative">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2 relative">
                                    {/* [NEW] Mobile Status with Long Press to Change */}
                                    <div
                                        className="relative"
                                        ref={openDropdownId === `mobile_${c.caseId}` ? dropdownRef : null}
                                    >
                                        <HoverCheckTooltip
                                            trigger={
                                                <button
                                                    className={`px-2 py-0.5 rounded text-xs font-bold ${c.status === '진행불가' || c.status === '고객취소' ? 'bg-red-100 text-red-700' : STATUS_COLOR_MAP[c.status] || 'bg-blue-100 text-blue-700'}`}
                                                    onTouchStart={(e) => {
                                                        const timer = setTimeout(() => {
                                                            setOpenDropdownId(`mobile_${c.caseId}`);
                                                        }, 500); // 500ms long press
                                                        (e.target as any)._longPressTimer = timer;
                                                    }}
                                                    onTouchEnd={(e) => {
                                                        if ((e.target as any)._longPressTimer) {
                                                            clearTimeout((e.target as any)._longPressTimer);
                                                        }
                                                    }}
                                                    onTouchMove={(e) => {
                                                        if ((e.target as any)._longPressTimer) {
                                                            clearTimeout((e.target as any)._longPressTimer);
                                                        }
                                                    }}
                                                >
                                                    {c.status}
                                                </button>
                                            }
                                            content={<StatusHistoryTooltipContent caseId={c.caseId} />}
                                        />

                                        {/* Mobile Status Change Dropdown */}
                                        <AnimatePresence>
                                            {openDropdownId === `mobile_${c.caseId}` && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -5 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="absolute z-50 top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 min-w-[140px] max-h-[250px] overflow-y-auto"
                                                >
                                                    <div className="px-2 py-1 text-[10px] text-gray-400 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                                        <span>상태 변경</span>
                                                        <button
                                                            onClick={() => setOpenDropdownId(null)}
                                                            className="text-gray-500 hover:text-gray-700"
                                                        >✕</button>
                                                    </div>
                                                    {statuses.map((status) => (
                                                        <button
                                                            key={status}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (status !== c.status) {
                                                                    onStatusChange(c.caseId, status, c.status);
                                                                }
                                                                setOpenDropdownId(null);
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${status === c.status ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'
                                                                }`}
                                                        >
                                                            <span className={`w-2 h-2 rounded-full ${STATUS_COLOR_MAP[status]?.split(' ')[0] || 'bg-gray-300'}`}></span>
                                                            {status}
                                                            {status === c.status && <span className="ml-auto text-blue-500">✓</span>}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    {c.isNew && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">NEW</span>}
                                </div>
                                <span className="text-xs text-gray-400">{safeFormat(c.createdAt, 'MM-dd')}</span>
                            </div>

                            <div className="flex justify-between items-center mt-1">
                                <Link to={c.isNew ? `/new?leadId=${c.caseId}` : `/case/${c.caseId}`} className="font-bold text-lg text-gray-800 dark:text-gray-200">
                                    {c.customerName}
                                </Link>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{c.phone}</span>

                                    {/* [Mobile] Missed Call Management */}
                                    {c.status === missedCallStatus && (
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={(e) => onMissedCall(e, c)}
                                                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border transition-all shadow-sm ${c.lastMissedCallAt && (new Date().getTime() - new Date(c.lastMissedCallAt).getTime()) > (missedCallInterval * 24 * 60 * 60 * 1000)
                                                    ? 'bg-red-50 border-red-200 text-red-600 animate-pulse ring-1 ring-red-100'
                                                    : 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50'
                                                    }`}
                                            >
                                                <PhoneMissed size={12} />
                                                <span>부재 +{c.missedCallCount || 0}</span>
                                            </button>
                                            <span className="text-[10px] text-gray-500 font-mono">
                                                {safeFormat(c.lastMissedCallAt, 'MM.dd HH:mm')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* [Mobile] Reminder Info */}
                            {(() => {
                                const nextReminder = getNextUpcomingReminder(c.reminders);
                                if (!nextReminder) return null;
                                return (
                                    <div className="mt-1">
                                        <HoverCheckTooltip
                                            mobileAlign="left"
                                            trigger={
                                                <div className="flex items-center gap-1.5 p-1 px-2 bg-yellow-50 dark:bg-yellow-900/30 rounded border border-yellow-100 dark:border-yellow-900/50 w-fit">
                                                    {(() => {
                                                        const rType = nextReminder.type || '통화';
                                                        if (rType === '통화') return <Phone size={12} className="text-blue-600" />;
                                                        if (rType === '출장미팅') return <Briefcase size={12} className="text-green-600" />;
                                                        if (rType === '방문미팅') return <MapPin size={12} className="text-purple-600" />;
                                                        return <MoreHorizontal size={12} className="text-gray-600" />;
                                                    })()}
                                                    <span className="text-xs font-bold text-yellow-800 dark:text-yellow-300">
                                                        {nextReminder.datetime}
                                                    </span>
                                                    {(c.reminders?.length || 0) > 1 && (
                                                        <span className="text-[10px] text-gray-500 bg-white dark:bg-gray-800 px-1 rounded-full border border-gray-200 dark:border-gray-600">
                                                            +{((c.reminders?.length || 0) - 1)}
                                                        </span>
                                                    )}
                                                </div>
                                            }
                                            content={
                                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                                    <p className="font-bold text-gray-200 border-b border-gray-600 pb-1 sticky top-0 bg-gray-900/90">리마인더 일정</p>
                                                    {c.reminders?.map((reminder, idx) => (
                                                        <div key={idx} className="text-[11px] border-b border-gray-700 last:border-0 pb-1.5 mb-1.5">
                                                            <p className="text-gray-300 font-medium">{reminder.datetime}</p>
                                                            {reminder.content && (
                                                                <p className="text-gray-400 mt-0.5 pl-1 border-l-2 border-gray-600">
                                                                    {reminder.content}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            }
                                        />
                                    </div>
                                );
                            })()}

                            <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                <div className="flex flex-col text-xs text-gray-500">
                                    <span>{c.caseType} | {c.inboundPath}</span>
                                    <span>{partner?.name}</span>
                                </div>
                                <div className="flex gap-2">
                                    <a href={`tel:${c.phone}`} className="p-2 bg-green-100 text-green-600 rounded-full">
                                        <Phone size={16} />
                                    </a>
                                    <HoverCheckTooltip
                                        mobileAlign="right"
                                        trigger={
                                            <button className="p-2 bg-blue-100 text-blue-600 rounded-full">
                                                <MessageSquare size={16} />
                                            </button>
                                        }
                                        content={
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                <p className="font-bold text-gray-300 border-b border-gray-600 pb-1">최근 상담 내역</p>
                                                {c.specialMemo && Array.isArray(c.specialMemo) && c.specialMemo.filter(m => !m.content.startsWith('[상태변경]')).length > 0 ? (
                                                    c.specialMemo
                                                        .filter(m => !m.content.startsWith('[상태변경]'))
                                                        .slice(0, 5)
                                                        .map((m, i) => (
                                                            <div key={i} className="text-[11px] leading-relaxed border-b border-gray-700 last:border-0 pb-1">
                                                                <span className="text-blue-300 mr-1">[{m.createdAt.split('T')[0]}]</span>
                                                                {m.content}
                                                            </div>
                                                        ))
                                                ) : (
                                                    <span className="text-gray-500 italic">상담 내역 없음</span>
                                                )}
                                            </div>
                                        }
                                    />
                                    <button
                                        onClick={(e) => onDelete(c.caseId, e)}
                                        className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                                        title="휴지통으로 이동"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop View (Table) */}
            <div className="hidden md:block flex-1">
                <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300 table-fixed">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 uppercase font-medium text-xs">
                        <tr>
                            <th className="px-4 py-3 w-[15%]">유형/경로/거래처</th>
                            <th className="px-4 py-3 w-[12%]">고객명</th>
                            <th className="px-4 py-3 w-[13%]">연락처</th>
                            <th className="px-4 py-3 w-[10%]">상태</th>
                            <th className="px-4 py-3 w-[10%]">등록일</th>
                            <th className="px-4 py-3 w-[10%]">최종상담일</th>
                            <th className="px-4 py-3 w-[20%]">리마인더</th>
                            <th className="px-4 py-3 w-[10%] text-center">삭제</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cases.map((c, index) => {
                            const partner = partners.find(p => p.partnerId === c.partnerId);
                            const warnings = getCaseWarnings(c, partner);
                            const lastConsultDate = getLastConsultationDate(c);
                            const nextReminder = getNextUpcomingReminder(c.reminders);

                            return (
                                <motion.tr
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    key={`${c.caseId}_${index}`}
                                    className="border-b border-gray-50 dark:border-gray-700 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">{c.caseType}</span>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400">{c.inboundPath}</span>
                                            <span className="text-[10px] text-gray-400 dark:text-gray-500">{partner?.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            to={c.isNew ? `/new?leadId=${c.caseId}` : `/case/${c.caseId}`}
                                            className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                        >
                                            <span className="truncate max-w-[90px] inline-block align-bottom" title={c.customerName}>
                                                {c.customerName}
                                            </span>
                                            {c.isNew && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pulse flex-shrink-0">NEW</span>}
                                        </Link>

                                        {/* Hover Tooltip for Quick Memo View */}
                                        <div className="ml-1 inline-block">
                                            <HoverCheckTooltip
                                                trigger={
                                                    <MessageSquare size={14} className="text-gray-300 hover:text-blue-500 transition-colors" />
                                                }
                                                content={
                                                    <div className="space-y-2">
                                                        <p className="font-bold text-gray-300 border-b border-gray-600 pb-1">최근 상담 내역</p>
                                                        {c.specialMemo && Array.isArray(c.specialMemo) && c.specialMemo.filter(m => !m.content.startsWith('[상태변경]')).length > 0 ? (
                                                            c.specialMemo
                                                                .filter(m => !m.content.startsWith('[상태변경]'))
                                                                .slice(0, 3)
                                                                .map((m, i) => (
                                                                    <div key={i} className="text-[11px] leading-relaxed">
                                                                        <span className="text-blue-300 mr-1">[{m.createdAt.split('T')[0]}]</span>
                                                                        {m.content}
                                                                    </div>
                                                                ))
                                                        ) : (
                                                            <span className="text-gray-500 italic">내역 없음</span>
                                                        )}
                                                    </div>
                                                }
                                            />
                                        </div>

                                        {warnings.length > 0 && <span className="ml-2 text-red-500 text-xs">⚠</span>}
                                    </td>
                                    <td className={`px-4 py-3 font-medium ${c.status === '진행불가' || c.status === '고객취소'
                                        ? 'text-red-600 dark:text-red-400'
                                        : ''
                                        }`}>{c.phone}</td>
                                    <td className="px-4 py-3 relative">
                                        {/* [NEW] Status with Click-to-Change Dropdown */}
                                        <div className="relative" ref={openDropdownId === c.caseId ? dropdownRef : null}>
                                            <HoverCheckTooltip
                                                trigger={
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenDropdownId(openDropdownId === c.caseId ? null : c.caseId);
                                                        }}
                                                        className="flex items-center gap-1 group"
                                                    >
                                                        {c.status === '사무장 접수' && c.secondaryStatus ? (
                                                            // 2차 상태가 있을 때: 복합 뱃지 (상태별 색상 적용)
                                                            <span className="inline-flex items-center px-2 py-1 rounded text-xs whitespace-nowrap bg-gradient-to-r from-green-50 to-purple-50 border border-purple-200">
                                                                <span className="text-green-700 font-medium">✓사무장</span>
                                                                <span className="text-gray-400 mx-0.5">›</span>
                                                                <span className={`font-medium ${c.secondaryStatus === '고객취소' || c.secondaryStatus === '진행불가' ? 'text-red-600' :
                                                                    c.secondaryStatus === '연락안받음' ? 'text-orange-600' :
                                                                        c.secondaryStatus === '출장예약' ? 'text-green-600' :
                                                                            c.secondaryStatus === '방문예약' ? 'text-blue-600' :
                                                                                c.secondaryStatus === '고민중' ? 'text-yellow-600' :
                                                                                    c.secondaryStatus === '계약서작성' ? 'text-cyan-600' :
                                                                                        c.secondaryStatus === '관리중' ? 'text-indigo-600' :
                                                                                            c.secondaryStatus === '착수금입금' || c.secondaryStatus === '기준비용입금' ? 'text-emerald-600' :
                                                                                                'text-purple-700'
                                                                    }`}>{c.secondaryStatus}</span>
                                                            </span>
                                                        ) : (
                                                            // 일반 상태 표시
                                                            <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${STATUS_COLOR_MAP[c.status]
                                                                ? STATUS_COLOR_MAP[c.status].replace('bg-blue-50', 'bg-blue-100')
                                                                : 'bg-gray-100 dark:bg-gray-700'
                                                                } ${c.status === '진행불가' || c.status === '고객취소' ? 'text-red-700 bg-red-100' : ''
                                                                } ${c.status === '사무장 접수' ? 'bg-green-100 text-green-700' : ''}`}>
                                                                {c.status === '사무장 접수' ? '✓ 사무장접수' : c.status}
                                                            </span>
                                                        )}
                                                        <ChevronDown size={12} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                                                    </button>
                                                }
                                                content={<StatusHistoryTooltipContent caseId={c.caseId} />}
                                            />

                                            {/* Status Change Dropdown */}
                                            <AnimatePresence>
                                                {openDropdownId === c.caseId && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -5 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="absolute z-50 top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 min-w-[140px] max-h-[300px] overflow-y-auto"
                                                    >
                                                        <div className="px-2 py-1 text-[10px] text-gray-400 border-b border-gray-100 dark:border-gray-700">
                                                            상태 변경
                                                        </div>
                                                        {statuses.map((status) => (
                                                            <button
                                                                key={status}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (status !== c.status) {
                                                                        onStatusChange(c.caseId, status, c.status);
                                                                    }
                                                                    setOpenDropdownId(null);
                                                                }}
                                                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${status === c.status ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'
                                                                    }`}
                                                            >
                                                                <span className={`w-2 h-2 rounded-full ${STATUS_COLOR_MAP[status]?.split(' ')[0] || 'bg-gray-300'}`}></span>
                                                                {status}
                                                                {status === c.status && <span className="ml-auto text-blue-500">✓</span>}
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        {/* Missed Call Button (Desktop) - Appears next to status if missed */}
                                        {c.status === missedCallStatus && (
                                            <div className="mt-1 flex items-center gap-1">
                                                <button
                                                    onClick={(e) => onMissedCall(e, c)}
                                                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${c.lastMissedCallAt && (new Date().getTime() - new Date(c.lastMissedCallAt).getTime()) > (missedCallInterval * 24 * 60 * 60 * 1000)
                                                        ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
                                                        : 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50'
                                                        }`}
                                                    title={`마지막 부재: ${safeFormat(c.lastMissedCallAt, 'yyyy-MM-dd HH:mm', '없음')}`}
                                                >
                                                    <PhoneMissed size={10} />
                                                    <span>+{c.missedCallCount || 0}</span>
                                                </button>
                                                <span className="text-[10px] text-gray-500 tracking-tight">
                                                    {safeFormat(c.lastMissedCallAt, 'MM.dd HH:mm')}
                                                </span>
                                            </div>
                                        )}

                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500">
                                        {safeFormat(c.createdAt, 'yyyy-MM-dd')}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500">
                                        {safeFormat(lastConsultDate, 'yyyy-MM-dd')}
                                    </td>
                                    <td className="px-4 py-3 text-xs">
                                        {nextReminder ? (
                                            <HoverCheckTooltip
                                                trigger={
                                                    <div className="flex items-center gap-1.5 cursor-help">
                                                        {/* Icon for Reminder Type */}
                                                        {(() => {
                                                            const rType = nextReminder.type || '통화';
                                                            if (rType === '통화') return <Phone size={14} className="text-blue-600" />;
                                                            if (rType === '출장미팅') return <Briefcase size={14} className="text-green-600" />;
                                                            if (rType === '방문미팅') return <MapPin size={14} className="text-purple-600" />;
                                                            return <MoreHorizontal size={14} className="text-gray-600" />;
                                                        })()}
                                                        <span className="text-gray-700 dark:text-gray-300 font-medium">{nextReminder.datetime}</span>
                                                        {(c.reminders?.length || 0) > 1 && <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded-sm">+{((c.reminders?.length || 0) - 1)}</span>}
                                                    </div>
                                                }
                                                content={
                                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                                        <p className="font-bold text-gray-200 border-b border-gray-600 pb-1 sticky top-0 bg-gray-900/90">리마인더 일정</p>
                                                        {c.reminders?.map((reminder, idx) => (
                                                            <div key={idx} className="text-[11px] border-b border-gray-700 last:border-0 pb-1.5 mb-1.5">
                                                                <p className="text-gray-300 font-medium">{reminder.datetime}</p>
                                                                {reminder.content && (
                                                                    <p className="text-gray-400 mt-0.5 pl-1 border-l-2 border-gray-600">
                                                                        {reminder.content}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                }
                                            />
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {viewMode === 'trash' ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={(e) => onRestore(c.caseId, e)}
                                                    className="text-green-500 hover:text-green-700 p-1.5 rounded hover:bg-green-50"
                                                    title="복구"
                                                >
                                                    <Sparkles size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => onDelete(c.caseId, e)}
                                                    className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50"
                                                    title="영구 삭제"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={(e) => onDelete(c.caseId, e)}
                                                className="text-gray-300 hover:text-red-500 p-2 rounded transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                                                title="삭제"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </motion.tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
