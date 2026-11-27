import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Phone, PhoneMissed, AlertTriangle, MessageSquare, Trash2, Sparkles, MapPin, Briefcase, MoreHorizontal, ChevronDown, ChevronRight, Star, History, Archive, Scale, Eye } from 'lucide-react';
import { Case, Partner, ReminderItem, CaseStatusLog, MissedCallIntervalTier } from '../../types';
import { getCaseWarnings, safeFormat, parseReminder, isOverdueMissedCall } from '../../utils';
import HoverCheckTooltip from '../HoverCheckTooltip';
import CommunicationHistoryTooltipContent from './CommunicationHistoryTooltipContent';
import { StatusCell } from './StatusCell';
import { BatteryProgress } from '../common/BatteryProgress';
import { cn } from '../ui/cn';

import CallConfirmPopup from '../CallConfirmPopup';
import { STATUS_COLOR_MAP } from '../../constants';
import { fetchCaseStatusLogs, fetchCases, fetchPhonesWithSmsOut } from '../../services/api';
import { useActiveCall } from '../../contexts/ActiveCallContext';
import { useAuth } from '../../contexts/AuthContext';
import { canViewInboundPath, canViewRealPartnerName, getPartnerDisplayName } from '../../services/org';
import { useVisibilityPolicy } from '../../services/visibilityPolicy';
import { logAccess } from '../../services/accessLog';

// --- Shared Helper Components ---
// Copied from CaseList.tsx
const SECONDARY_STATUS_COLOR_MAP: Record<string, string> = {
    '고객취소': 'text-red-600 dark:text-red-400',
    '진행불가': 'text-red-600 dark:text-red-400',
    '연락안받음': 'text-orange-500 font-bold',
    '서류보완요청': 'text-amber-500 font-bold',
    '사무장부재': 'text-orange-500 font-bold',
    '출장예약': 'text-green-600 dark:text-green-400',
    '방문예약': 'text-blue-600 dark:text-blue-400',
    '고민중': 'text-yellow-600 dark:text-yellow-400',
    '계약서작성': 'text-cyan-600 dark:text-cyan-400',
    '관리중': 'text-indigo-600 dark:text-indigo-400',
    '착수금입금': 'text-emerald-600 dark:text-emerald-400',
    '기준비용입금': 'text-emerald-600 dark:text-emerald-400',
};

// [2026-11-01] 툴팁을 열 때마다 전체 리드를 복사하던 것을, 이미 가진 리드 정보로 바로 그린다
const StatusHistoryTooltipContent = ({ c }: { c: Case }) => {
    const logs: CaseStatusLog[] = c.statusLogs || [];
    const secondaryChanges = (c.specialMemo || [])
        .filter(m => String(m.content || '').startsWith('[2차 상태 변경]'))
        .map(m => {
            const match = m.content.match(/\[2차 상태 변경\] (.+?) → (.+?)(\n|$)/);
            return {
                date: m.createdAt || (m as any).datetime,
                from: match?.[1] || '없음',
                to: match?.[2] || '없음',
                memo: m.content.includes('사유:') ? m.content.split('사유:')[1]?.trim() : undefined
            };
        });

    if (logs.length === 0 && secondaryChanges.length === 0) return <span>이력이 없습니다.</span>;

    return (
        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
            {/* 1차 상태 변경 이력 */}
            {logs.length > 0 && (
                <>
                    <p className="font-bold text-blue-300 border-b border-gray-600 pb-1 sticky top-0 bg-gray-900/90">1차 상태 변경 이력</p>
                    {logs.map((log, i) => (
                        <div key={i} className="text-xs border-b border-gray-700 last:border-0 pb-1 mb-1">
                            <div className="flex justify-between text-gray-500 dark:text-gray-400 mb-0.5">
                                <span>{log.fromStatus || '신규'} → <span className="text-blue-300">{log.toStatus}</span></span>
                                <span className="text-xs">{log.changedAt?.split('T')[0] || ''}</span>
                            </div>
                            {log.memo && <div className="text-gray-600 dark:text-gray-300 pl-1 border-l-2 border-gray-600">{log.memo}</div>}
                        </div>
                    ))}
                </>
            )}

            {secondaryChanges.length > 0 && (
                <>
                    <p className="font-bold text-purple-300 border-b border-gray-600 pb-1 mt-2">2차 상태 변경 이력</p>
                    {secondaryChanges.map((change, i) => (
                        <div key={i} className="text-xs border-b border-gray-700 last:border-0 pb-1 mb-1">
                            <div className="flex justify-between text-gray-500 dark:text-gray-400 mb-0.5">
                                <span>
                                    <span className={SECONDARY_STATUS_COLOR_MAP[change.from] || 'text-gray-600 dark:text-gray-300'}>{change.from}</span>
                                    {' → '}
                                    <span className={SECONDARY_STATUS_COLOR_MAP[change.to] || 'text-purple-300'}>{change.to}</span>
                                </span>
                                <span className="text-xs">{change.date?.split('T')[0] || ''}</span>
                            </div>
                            {change.memo && <div className="text-gray-600 dark:text-gray-300 pl-1 border-l-2 border-purple-600">{change.memo}</div>}
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

/** 지난(처리 안 한) 일정: 가장 오래된 것 */
const getOverdueReminder = (reminders?: ReminderItem[]): ReminderItem | null => {
    if (!reminders || reminders.length === 0) return null;
    const now = Date.now();
    const past = reminders
        .filter(r => !r.resultStatus && !r.isCompleted)
        .map(r => ({ r, t: parseReminder(r.datetime)?.getTime() ?? NaN }))
        .filter(x => !isNaN(x.t) && x.t < now)
        .sort((a, b) => a.t - b.t);
    return past.length ? past[0].r : null;
};

const getLastConsultationDate = (c: Case): string => {
    if (!c.specialMemo || !Array.isArray(c.specialMemo) || c.specialMemo.length === 0) {
        return c.updatedAt;
    }
    const sortedMemos = [...c.specialMemo].sort((a, b) => String(b.createdAt || (b as any).datetime || '').localeCompare(String(a.createdAt || (a as any).datetime || '')));
    return sortedMemos[0]?.createdAt || (sortedMemos[0] as any)?.datetime || c.updatedAt;
};


interface CaseListTableProps {
    cases: Case[];
    partners: Partner[];
    viewMode: 'active' | 'archived' | 'trash';
    missedCallStatus: string;
    missedCallIntervalTiers: MissedCallIntervalTier[];
    statuses: string[]; // [NEW] Status list for quick change dropdown
    onDelete: (id: string, e: React.MouseEvent) => void;
    onRestore: (id: string, e: React.MouseEvent) => void;
    onArchive?: (id: string, e: React.MouseEvent) => void;
    onMissedCall: (e: React.MouseEvent, c: Case) => void;
    onStatusChange: (caseId: string, newStatus: string, oldStatus: string) => void; // [NEW]
    onToggleStar: (caseId: string, currentStarred: boolean) => void; // [NEW] 중요 표시
    onOpenDrawer?: (c: Case) => void; // [NEW] 퀵 인스펙터 슬라이드 드로어
    onOpenParalegalModal?: (c: Case) => void; // [NEW] 사무장 사건 심사
    // [2026-11-01] 여러 건 선택 · 담당자 표시
    selectedIds?: Set<string>;
    onToggleSelect?: (caseId: string) => void;
    onToggleSelectAll?: (caseIds: string[], on: boolean) => void;
    memberName?: (userId?: string) => string;
    density?: 'standard' | 'compact';
}

export const CaseListTable: React.FC<CaseListTableProps> = ({
    cases,
    partners,
    viewMode,
    missedCallStatus,
    missedCallIntervalTiers,
    statuses,
    onDelete,
    onRestore,
    onArchive,
    onMissedCall,
    onStatusChange,
    onToggleStar,
    onOpenDrawer,
    onOpenParalegalModal,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    memberName,
    density = 'standard',
}) => {
    const visibilityPolicy = useVisibilityPolicy();
    const isCompact = density === 'compact';
    const cellPadding = isCompact ? 'py-1.5 px-3' : 'py-3 px-4';
    const headerPadding = isCompact ? 'py-2 px-3' : 'py-3 px-4';
    const textScale = isCompact ? 'text-xs' : 'text-sm';
    const selectable = !!onToggleSelect && (viewMode === 'active' || viewMode === 'archived');
    const pageIds = cases.map(c => c.caseId);
    const allOnPage = selectable && pageIds.length > 0 && pageIds.every(id => selectedIds?.has(id));
    // [NEW] State for status dropdown
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // [NEW] State for call confirm popup
    const [callTarget, setCallTarget] = useState<{ name: string; phone: string; caseId?: string } | null>(null);
    const { startCall } = useActiveCall();

    // [NEW] SMS_OUT 존재 여부 (History 아이콘 색상용)
    const [phonesWithSmsOut, setPhonesWithSmsOut] = useState<Set<string>>(new Set());

    // 1차 상태가 이 목록에 해당하면 SMS_OUT 없어도 빨간색 표시 안 함
    const SMS_OUT_EXEMPT_STATUSES = ['신규접수', '사무장 접수', '수신정지'];

    // 배치로 SMS_OUT 존재 여부 조회 (보이는 번호가 바뀔 때만 — 저장할 때마다 다시 부르지 않게)
    const phoneKey = cases.map(c => c.phone).filter(Boolean).join(',');
    useEffect(() => {
        const phones = phoneKey ? phoneKey.split(',') : [];
        if (phones.length === 0) return;
        fetchPhonesWithSmsOut(phones).then(setPhonesWithSmsOut);
    }, [phoneKey]);

    // History 아이콘이 빨간색이어야 하는지 판단하는 헬퍼
    const shouldShowRedHistory = (phone: string, status: string): boolean => {
        if (SMS_OUT_EXEMPT_STATUSES.includes(status)) return false;
        const normalizedPhone = phone.replace(/[^0-9]/g, '');
        return !phonesWithSmsOut.has(normalizedPhone);
    };

    // [Security Feature 3] 회사별 리드 목록 개인정보 보호 정책 연동 (대표/총괄 관리자 선택 가능)
    const { org, isAdmin } = useAuth();
    const showInboundPath = canViewInboundPath(org, visibilityPolicy);
    const showRealPartnerName = canViewRealPartnerName(org, visibilityPolicy);
    const [companyMaskingPolicy, setCompanyMaskingPolicy] = useState<'masked' | 'unmasked'>(() => {
        return (localStorage.getItem('lm_company_list_masking_policy') as 'masked' | 'unmasked') || 'masked';
    });

    useEffect(() => {
        const handleStorage = () => {
            const current = (localStorage.getItem('lm_company_list_masking_policy') as 'masked' | 'unmasked') || 'masked';
            setCompanyMaskingPolicy(current);
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // 대표/관리자는 항상 원본 공개, 일반 상담원은 회사 정책이 'masked'일 때만 마스킹 적용
    const isMaskingEnabled = !isAdmin && companyMaskingPolicy === 'masked' && (org?.securityProfile?.masking ?? true);
    const [unmaskedCases, setUnmaskedCases] = useState<Set<string>>(new Set());

    const getDisplayName = (name: string, caseId: string) => {
        if (!isMaskingEnabled || unmaskedCases.has(caseId)) return name;
        const s = String(name || '').trim();
        if (s.length <= 1) return s;
        if (s.length === 2) return `${s[0]}*`;
        return `${s[0]}${'*'.repeat(Math.min(s.length - 2, 2))}${s[s.length - 1]}`;
    };

    const getDisplayPhone = (phone: string, caseId: string) => {
        if (!isMaskingEnabled || unmaskedCases.has(caseId)) return phone;
        const digits = String(phone || '').replace(/[^0-9]/g, '');
        if (digits.length >= 8) {
            return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
        }
        return phone;
    };

    const handleUnmask = (e: React.MouseEvent, caseId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setUnmaskedCases(prev => new Set(prev).add(caseId));
        logAccess('case_view', { caseId, detail: { unmasked_list_view: true } });
    };

    const handlePhoneClick = (e: React.MouseEvent, customerName: string, phone: string, caseId?: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (caseId) setUnmaskedCases(prev => new Set(prev).add(caseId));
        // 모바일에서는 팝업 없이 바로 전화 연결 (Android 앱 WebView에서 tel: 처리)
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
            window.location.href = `tel:${phone.replace(/[^0-9+]/g, '')}`;
            return;
        }
        // PC에서만 확인 팝업 표시
        setCallTarget({ name: customerName, phone, caseId });
    };

    const handleCallConfirm = () => {
        setCallTarget(null);
    };

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

    // 4대 monday.com Vibe 그룹 분할 (React Hooks 규칙: early return 전에 무조건 호출)
    const caseGroups = useMemo(() => {
        if (!cases || cases.length === 0) return [];

        if (viewMode !== 'active') {
            return [
                {
                    id: viewMode,
                    title: viewMode === 'archived' ? '보관함 리드' : '휴지통 리드',
                    color: viewMode === 'archived' ? '#676879' : '#df2f4a',
                    cases,
                }
            ];
        }

        const groups = [
            {
                id: 'new',
                title: '신규 접수 리드',
                color: '#0073ea',
                cases: cases.filter(c => c.isNew || ['신규', '접수', '배정대기', '광고'].some(k => (c.status || '').includes(k))),
            },
            {
                id: 'working',
                title: '1차 상담 & 재통화/부재 관리',
                color: '#fdab3d',
                cases: cases.filter(c => !c.isNew && ['상담', '재통화', '재컨택', '부재', '진행', '통화예약'].some(k => (c.status || '').includes(k)) && !['사무장', '적격', '심사', '계약', '수임', '불가', '취소'].some(k => (c.status || '').includes(k))),
            },
            {
                id: 'paralegal',
                title: '사무장 접수 & 법무팀 인계',
                color: '#00a2ae',
                cases: cases.filter(c => !c.isNew && ['사무장', '인계', '법무'].some(k => (c.status || '').includes(k))),
            },
            {
                id: 'qualified',
                title: '적격 심사 & 계약 준비',
                color: '#579bfc',
                cases: cases.filter(c => !c.isNew && ['적격', '심사', '계약서작성', '서류보완'].some(k => (c.status || '').includes(k)) && !['계약 완료', '계약완료', '수임'].some(k => (c.status || '').includes(k))),
            },
            {
                id: 'done',
                title: '계약 / 수임 완료',
                color: '#00c875',
                cases: cases.filter(c => ['계약완료', '수임완료', '완료', '계약 완료', '수임 완료', '입금완료'].some(k => (c.status || '').includes(k))),
            },
            {
                id: 'stuck',
                title: '보류 / 취소 / 종결',
                color: '#df2f4a',
                cases: cases.filter(c => ['진행불가', '고객취소', '거절', '부적격'].some(k => (c.status || '').includes(k))),
            },
        ];

        const assignedIds = new Set(groups.flatMap(g => g.cases.map(c => c.caseId)));
        const others = cases.filter(c => !assignedIds.has(c.caseId));
        if (others.length > 0) {
            groups.push({
                id: 'other',
                title: '기타 보류 리드',
                color: '#676879',
                cases: others,
            });
        }

        return groups.filter(g => g.cases.length > 0);
    }, [cases, viewMode]);

    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const toggleGroupCollapse = (groupId: string) => {
        setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    // 모든 훅이 호출된 후 빈 데이터 처리 (React Error #300 방지)
    if (cases.length === 0) {
        return (
            <div className="bg-card rounded-[8px] border border-[#d0d4e4] dark:border-border p-12 text-center text-[#676879] dark:text-gray-400 flex-1 flex flex-col items-center justify-center min-h-[300px]">
                <p className="text-sm font-semibold">
                    {viewMode === 'archived' ? '보관함에 보관된 리드가 없습니다.' : viewMode === 'trash' ? '휴지통이 비어 있습니다.' : '검색 결과가 없습니다.'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    {viewMode === 'archived' ? '관리자에 의해 보관 처리된 고객 DB가 여기에 표시됩니다.' : viewMode === 'trash' ? '삭제된 케이스가 없습니다.' : '필터 조건을 변경하거나 검색어를 지워보세요.'}
                </p>
            </div>
        );
    }

    return (
        <div className="bg-card rounded-xl shadow-xs border border-border min-h-[500px] flex flex-col overflow-hidden">
            {/* Mobile View (Cards) */}
            <div className="md:hidden space-y-3 p-4">
                {cases.map((c, index) => {
                    const partner = partners.find(p => p.partnerId === c.partnerId);
                    const warnings = getCaseWarnings(c, partner);
                    return (
                        <div key={c.caseId} className={`bg-card border border-border p-4 rounded-xl flex flex-col gap-2 relative shadow-2xs ${c.isStarred ? 'ring-1 ring-amber-500/30' : ''}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2 relative">
                                    {/* Star Toggle (Mobile) */}
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleStar(c.caseId, !!c.isStarred); }}
                                        className={`p-0.5 transition-all active:scale-125 ${c.isStarred ? 'text-amber-500' : 'text-muted-foreground hover:text-foreground'}`}
                                        title={c.isStarred ? '중요 표시 해제' : '중요 표시'}
                                    >
                                        <Star size={16} strokeWidth={1.75} fill={c.isStarred ? 'currentColor' : 'none'} />
                                    </button>
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
                                            content={() => <StatusHistoryTooltipContent c={c} />}
                                        />

                                        {/* Mobile Status Change Dropdown */}
                                        <AnimatePresence>
                                            {openDropdownId === `mobile_${c.caseId}` && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -5 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="absolute z-50 top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px] max-h-[250px] overflow-y-auto"
                                                >
                                                    <div className="px-2 py-1 text-xs text-muted-foreground border-b border-border flex justify-between items-center">
                                                        <span>상태 변경</span>
                                                        <button
                                                            onClick={() => setOpenDropdownId(null)}
                                                            className="text-muted-foreground hover:text-foreground"
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
                                    {c.isNew && <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">NEW</span>}
                                    {c.status === '사무장 접수' && onOpenParalegalModal && (
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenParalegalModal(c); }}
                                            className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-xs active:scale-95"
                                        >
                                            <Scale size={11} />
                                            <span>사무장 심사</span>
                                        </button>
                                    )}
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{safeFormat(c.createdAt, 'MM-dd')}</span>
                            </div>

                            <div className="flex justify-between items-center mt-1">
                                <div className="flex items-center gap-2">
                                    <Link to={`/case/${c.caseId}`} onClick={(e) => { if (onOpenDrawer && !e.ctrlKey && !e.metaKey) { e.preventDefault(); onOpenDrawer(c); } }} className="font-semibold text-lg text-foreground hover:text-primary">
                                        {getDisplayName(c.customerName, c.caseId)}
                                    </Link>
                                    {c.isArchived && (
                                        <span className="text-[10px] bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded-md font-medium" title={c.archivedReason || '보관됨'}>
                                            보관
                                        </span>
                                    )}
                                    <HoverCheckTooltip
                                        mobileAlign="left"
                                        trigger={
                                            <div className={`p-1.5 rounded-full cursor-pointer transition-colors ${
                                                shouldShowRedHistory(c.phone, c.status)
                                                    ? 'bg-red-50 dark:bg-red-900/30 active:bg-red-100 dark:active:bg-red-800'
                                                    : 'bg-blue-50 dark:bg-blue-900/30 active:bg-blue-100 dark:active:bg-blue-800'
                                            }`}>
                                                <History size={16} className={shouldShowRedHistory(c.phone, c.status) ? 'text-red-500 dark:text-red-400' : 'text-blue-500 dark:text-blue-400'} />
                                            </div>
                                        }
                                        content={() => <CommunicationHistoryTooltipContent phone={c.phone} />}
                                    />
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={(e) => handlePhoneClick(e, c.customerName, c.phone, c.caseId)}
                                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline active:text-blue-800 transition-colors"
                                        >{getDisplayPhone(c.phone, c.caseId)}</button>
                                        {isMaskingEnabled && !unmaskedCases.has(c.caseId) && (
                                            <button
                                                type="button"
                                                onClick={(e) => handleUnmask(e, c.caseId)}
                                                className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-600 dark:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                title="마스킹 해제 (열람 기록 남김)"
                                            >
                                                <Eye size={13} />
                                            </button>
                                        )}
                                    </div>

                                    {/* [Mobile] Missed Call Management */}
                                    {c.status === missedCallStatus && (
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={(e) => onMissedCall(e, c)}
                                                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border transition-all shadow-sm ${isOverdueMissedCall(c, missedCallStatus, missedCallIntervalTiers)
                                                    ? 'bg-red-50 border-red-200 text-red-600 animate-pulse ring-1 ring-red-100'
                                                    : 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50'
                                                    }`}
                                            >
                                                <PhoneMissed size={12} />
                                                <span>부재 +{c.missedCallCount || 0}</span>
                                            </button>
                                            <span className="text-xs text-gray-500 font-mono">
                                                {safeFormat(c.lastMissedCallAt, 'MM.dd HH:mm')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* [Mobile] 지난 일정 */}
                            {(() => {
                                const o = getOverdueReminder(c.reminders);
                                return o ? <div className="mt-1 w-fit text-xs px-2 py-0.5 rounded bg-red-50 text-red-700 font-semibold dark:bg-red-900/30 dark:text-red-300">지난 일정 {o.datetime.slice(5)}</div> : null;
                            })()}
                            {memberName && (
                                <div className={`text-xs ${c.assignedUserId ? 'text-slate-500' : 'text-orange-500'}`}>{c.assignedUserId ? `담당 ${memberName(c.assignedUserId) || '?'}` : '미배정'}</div>
                            )}

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
                                                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full border border-border">
                                                            +{((c.reminders?.length || 0) - 1)}
                                                        </span>
                                                    )}
                                                </div>
                                            }
                                            content={
                                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                                    <p className="font-bold text-gray-200 border-b border-gray-600 pb-1 sticky top-0 bg-gray-900/90">리마인더 일정</p>
                                                    {c.reminders?.map((reminder, idx) => (
                                                        <div key={idx} className="text-xs border-b border-gray-700 last:border-0 pb-1.5 mb-1.5">
                                                            <p className="text-gray-600 dark:text-gray-300 font-medium">{reminder.datetime}</p>
                                                            {reminder.content && (
                                                                <p className="text-gray-500 dark:text-gray-400 mt-0.5 pl-1 border-l-2 border-gray-600">
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

                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-border gap-2">
                                <div className="text-[11px] text-muted-foreground truncate min-w-0">
                                    <span>{c.caseType}{showInboundPath && c.inboundPath ? ` · ${c.inboundPath}` : ''}</span>
                                    {partner && <span> · {getPartnerDisplayName(partner, showRealPartnerName)}</span>}
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                    <button onClick={(e) => handlePhoneClick(e, c.customerName, c.phone, c.caseId)} className="p-2 bg-primary/10 text-primary rounded-full hover:bg-primary/20 active:scale-95 transition-all">
                                        <Phone size={15} />
                                    </button>
                                    <HoverCheckTooltip
                                        mobileAlign="right"
                                        trigger={
                                            <button className="p-2 bg-muted text-foreground rounded-full hover:bg-muted/80">
                                                <MessageSquare size={15} />
                                            </button>
                                        }
                                        content={
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                <p className="font-bold text-gray-600 dark:text-gray-300 border-b border-gray-600 pb-1">최근 상담 내역</p>
                                                {c.specialMemo && Array.isArray(c.specialMemo) && c.specialMemo.filter(m => !m.content.startsWith('[상태변경]')).length > 0 ? (
                                                    c.specialMemo
                                                        .filter(m => !m.content.startsWith('[상태변경]'))
                                                        .slice(0, 5)
                                                        .map((m, i) => (
                                                            <div key={i} className="text-xs leading-relaxed border-b border-gray-700 last:border-0 pb-1">
                                                                <span className="text-blue-300 mr-1">[{(m.createdAt || (m as any).datetime)?.split('T')[0]?.split(' ')[0] || ''}]</span>
                                                                {m.content}
                                                            </div>
                                                        ))
                                                ) : (
                                                    <span className="text-gray-500 italic">상담 내역 없음</span>
                                                )}
                                            </div>
                                        }
                                    />
                                    {viewMode === 'trash' ? (
                                        <>
                                            <button
                                                onClick={(e) => onRestore(c.caseId, e)}
                                                className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors"
                                                title="복구"
                                            >
                                                <Sparkles size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => onDelete(c.caseId, e)}
                                                className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                                                title="영구 삭제"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    ) : viewMode === 'archived' ? (
                                        <>
                                            <button
                                                onClick={(e) => onRestore(c.caseId, e)}
                                                className="p-2 bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition-colors"
                                                title="활성 리드로 복원"
                                            >
                                                <Sparkles size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => onDelete(c.caseId, e)}
                                                className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                                                title="휴지통으로 이동"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop View (monday.com Multi-Group Accordion Table) */}
            <div className="hidden md:block flex-1 overflow-x-auto space-y-4 p-2 bg-[#f6f7fb] dark:bg-transparent">
                {caseGroups.map(group => {
                    const isCollapsed = !!collapsedGroups[group.id];
                    const groupStatusCounts = Object.entries(
                        group.cases.reduce((acc, c) => {
                            acc[c.status] = (acc[c.status] || 0) + 1;
                            return acc;
                        }, {} as Record<string, number>)
                    ).map(([status, count]) => ({ status, count }));

                    return (
                        <div 
                            key={group.id} 
                            className="bg-white dark:bg-card rounded-lg border border-[#d0d4e4] dark:border-border shadow-xs overflow-hidden transition-all duration-200"
                        >
                            {/* Group Accordion Header */}
                            <div 
                                onClick={() => toggleGroupCollapse(group.id)}
                                className="flex items-center justify-between px-3.5 py-2.5 bg-white dark:bg-card hover:bg-[#f6f7fb] dark:hover:bg-muted/40 cursor-pointer select-none transition-colors border-b border-[#d0d4e4]/60 dark:border-border"
                            >
                                <div className="flex items-center gap-2.5">
                                    <span 
                                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" 
                                        style={{ backgroundColor: group.color }} 
                                    />
                                    <ChevronDown 
                                        size={16} 
                                        style={{ color: group.color }}
                                        className={cn(
                                            "transition-transform duration-150 shrink-0", 
                                            isCollapsed && "-rotate-90"
                                        )} 
                                    />
                                    <h3 
                                        className="font-bold text-[15px] tracking-tight text-[#323338] dark:text-foreground"
                                    >
                                        {group.title}
                                    </h3>
                                    <span 
                                        className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold"
                                        style={{ 
                                            backgroundColor: `${group.color}15`,
                                            color: group.color 
                                        }}
                                    >
                                        {group.cases.length}건
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className="text-[12px] text-[#676879] dark:text-muted-foreground hidden sm:inline">
                                        {isCollapsed ? '펼치기' : '접기'}
                                    </span>
                                </div>
                            </div>

                            {/* Group Table */}
                            {!isCollapsed && (
                                <>
                                    <table className={`w-full ${textScale} text-left text-muted-foreground table-fixed`}>
                                        <thead className="bg-[#f6f7fb]/80 dark:bg-muted/40 text-[#676879] dark:text-muted-foreground font-medium text-[13px] border-b border-[#d0d4e4] dark:border-border">
                                            <tr className="h-9">
                                                {selectable && (
                                                    <th className="pl-3 pr-1 w-[3%] text-center">
                                                        <input 
                                                            type="checkbox" 
                                                            aria-label="이 쪽 모두 선택" 
                                                            checked={allOnPage} 
                                                            onChange={() => onToggleSelectAll?.(pageIds, !allOnPage)} 
                                                        />
                                                    </th>
                                                )}
                                                <th className="px-2 w-[3%] text-center whitespace-nowrap">
                                                    <Star size={14} strokeWidth={1.75} className="inline text-muted-foreground" />
                                                </th>
                                                <th className="px-3.5 w-[14%] whitespace-nowrap">유형/경로/거래처</th>
                                                <th className="px-3.5 w-[12%] whitespace-nowrap">고객명</th>
                                                <th className="px-3.5 w-[13%] whitespace-nowrap">연락처</th>
                                                <th className="px-3.5 w-[13%] whitespace-nowrap">상태</th>
                                                <th className="px-3.5 w-[9%] whitespace-nowrap">등록일</th>
                                                <th className="px-3.5 w-[9%] whitespace-nowrap">최종상담일</th>
                                                <th className={`px-3.5 ${viewMode === 'active' ? 'w-[27%]' : 'w-[17%]'} whitespace-nowrap`}>리마인더</th>
                                                {viewMode !== 'active' && (
                                                    <th className="px-3.5 w-[10%] text-center whitespace-nowrap">
                                                        {viewMode === 'archived' ? '보관·삭제' : '휴지통 관리'}
                                                    </th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#d0d4e4]/70 dark:divide-border bg-white dark:bg-card">
                                            {group.cases.map((c) => {
                                                const partner = partners.find(p => p.partnerId === c.partnerId);
                                                const warnings = getCaseWarnings(c, partner);
                                                const lastConsultDate = getLastConsultationDate(c);
                                                const nextReminder = getNextUpcomingReminder(c.reminders);
                                                const overdueReminder = getOverdueReminder(c.reminders);
                                                const isSelected = !!selectedIds?.has(c.caseId);

                                                return (
                                                    <tr
                                                        key={c.caseId}
                                                        className={`h-10 hover:bg-[#f5f6f8] dark:hover:bg-muted/40 transition-colors duration-70 ${isSelected ? 'bg-[#cce5ff]/20 dark:bg-primary/5' : c.isStarred ? 'bg-amber-500/5' : ''}`}
                                                    >
                                                        {selectable && (
                                                            <td className="pl-3 pr-1 py-[9px] text-center">
                                                                <input 
                                                                    type="checkbox" 
                                                                    aria-label={`${c.customerName} 선택`} 
                                                                    checked={isSelected} 
                                                                    onChange={() => onToggleSelect?.(c.caseId)} 
                                                                />
                                                            </td>
                                                        )}
                                                        {/* Star Column */}
                                                        <td className="px-2 py-[9px] text-center">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onToggleStar(c.caseId, !!c.isStarred); }}
                                                                className={`p-1 rounded-[4px] transition-all hover:scale-110 ${c.isStarred ? 'text-amber-500' : 'text-muted-foreground/60 hover:text-amber-500'}`}
                                                                title={c.isStarred ? '중요 표시 해제' : '중요 표시'}
                                                            >
                                                                <Star size={15} strokeWidth={1.75} fill={c.isStarred ? 'currentColor' : 'none'} />
                                                            </button>
                                                        </td>
                                                        <td className="px-3.5 py-[9px]">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-xs font-semibold text-[#323338] dark:text-foreground">{c.caseType}</span>
                                                                {showInboundPath && <span className="text-[11px] text-[#676879] dark:text-muted-foreground">{c.inboundPath}</span>}
                                                                <span className="text-[11px] text-[#676879]/75 dark:text-muted-foreground/75">{partner ? getPartnerDisplayName(partner, showRealPartnerName) : ''}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3.5 py-[9px]">
                                                            <div className="flex items-center gap-1.5">
                                                                <Link
                                                                    to={`/case/${c.caseId}`}
                                                                    onClick={(e) => { if (onOpenDrawer && !e.ctrlKey && !e.metaKey) { e.preventDefault(); onOpenDrawer(c); } }}
                                                                    className="font-semibold text-[#323338] dark:text-foreground hover:text-[#0073ea] dark:hover:text-primary transition-colors flex items-center gap-1 text-[14px]"
                                                                >
                                                                    <span className="truncate max-w-[90px] inline-block align-bottom" title={c.customerName}>
                                                                        {getDisplayName(c.customerName, c.caseId)}
                                                                    </span>
                                                                    {c.isNew && <span className="text-[10px] font-semibold bg-[#0073ea]/15 text-[#0073ea] border border-[#0073ea]/30 px-1.5 py-0.2 rounded-[4px] flex-shrink-0">NEW</span>}
                                                                    {c.isArchived && <span className="text-[10px] bg-muted text-muted-foreground border border-border px-1.5 py-0.2 rounded-[4px] flex-shrink-0 font-medium" title={c.archivedReason || '보관됨'}>보관</span>}
                                                                </Link>
                                                                <HoverCheckTooltip
                                                                    desktopAlign="left"
                                                                    trigger={
                                                                        <div className={`p-1 rounded-full cursor-pointer transition-colors ${
                                                                            shouldShowRedHistory(c.phone, c.status)
                                                                                ? 'bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-800'
                                                                                : 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800'
                                                                        }`} title={shouldShowRedHistory(c.phone, c.status) ? '발신 문자 없음 - 통화 및 문자 기록' : '통화 및 문자 기록'}>
                                                                            <History size={13} className={shouldShowRedHistory(c.phone, c.status) ? 'text-red-500 dark:text-red-400' : 'text-blue-500 dark:text-blue-400'} />
                                                                        </div>
                                                                    }
                                                                    content={() => <CommunicationHistoryTooltipContent phone={c.phone} />}
                                                                />
                                                            </div>

                                                            {/* Hover Tooltip for Quick Memo View */}
                                                            <div className="ml-1 inline-block">
                                                                <HoverCheckTooltip
                                                                    trigger={
                                                                        <MessageSquare size={14} className="text-gray-600 dark:text-gray-300 hover:text-blue-500 transition-colors" />
                                                                    }
                                                                    content={
                                                                        <div className="space-y-2">
                                                                            <p className="font-bold text-gray-600 dark:text-gray-300 border-b border-gray-600 pb-1">최근 상담 내역</p>
                                                                            {c.specialMemo && Array.isArray(c.specialMemo) && c.specialMemo.filter(m => !m.content.startsWith('[상태변경]')).length > 0 ? (
                                                                                c.specialMemo
                                                                                    .filter(m => !m.content.startsWith('[상태변경]'))
                                                                                    .slice(0, 3)
                                                                                    .map((m, i) => (
                                                                                        <div key={i} className="text-xs leading-relaxed">
                                                                                            <span className="text-blue-300 mr-1">[{(m.createdAt || (m as any).datetime)?.split('T')[0]?.split(' ')[0] || ''}]</span>
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

                                                            {warnings.length > 0 && <span className="ml-2 text-red-500 text-xs" title={warnings.join(', ')}>⚠</span>}
                                                            {memberName && (
                                                                <div className={`text-xs mt-0.5 ${c.assignedUserId ? 'text-slate-500' : 'text-orange-500'}`}>
                                                                    {c.assignedUserId ? `담당 ${memberName(c.assignedUserId) || '?'}` : '미배정'}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3.5 py-[9px] font-medium font-mono tabular-nums">
                                                            <div className="flex items-center gap-1.5">
                                                                <button
                                                                    onClick={(e) => handlePhoneClick(e, c.customerName, c.phone, c.caseId)}
                                                                    className="hover:text-[#0073ea] dark:hover:text-blue-400 hover:underline transition-colors cursor-pointer text-[13px] text-[#323338] dark:text-foreground"
                                                                >
                                                                    {getDisplayPhone(c.phone, c.caseId)}
                                                                </button>
                                                                {isMaskingEnabled && !unmaskedCases.has(c.caseId) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleUnmask(e, c.caseId)}
                                                                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                                        title="마스킹 해제 (열람 기록 남김)"
                                                                    >
                                                                        <Eye size={12} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3.5 py-[9px] relative">
                                                            {/* monday.com Signature Full-Block Status Cell */}
                                                            <StatusCell 
                                                                status={c.status} 
                                                                onStatusChange={(newStatus) => onStatusChange(c.caseId, newStatus, c.status)} 
                                                                availableStatuses={statuses} 
                                                            />
                                                            {c.status === '사무장 접수' && onOpenParalegalModal && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); onOpenParalegalModal(c); }}
                                                                    className="mt-1 px-2 py-0.5 rounded-[4px] text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-2xs transition-all active:scale-95"
                                                                    title="사무장 사건 심사 & 수임 판정 열기"
                                                                >
                                                                    <Scale size={11} />
                                                                    <span>사무장 심사</span>
                                                                </button>
                                                            )}

                                                            {/* Missed Call Button (Desktop) */}
                                                            {c.status === missedCallStatus && (
                                                                <div className="mt-1 flex items-center gap-1">
                                                                    <button
                                                                        onClick={(e) => onMissedCall(e, c)}
                                                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs font-bold border transition-all ${isOverdueMissedCall(c, missedCallStatus, missedCallIntervalTiers)
                                                                            ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
                                                                            : 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50'
                                                                            }`}
                                                                        title={`마지막 부재: ${safeFormat(c.lastMissedCallAt, 'yyyy-MM-dd HH:mm', '없음')}`}
                                                                    >
                                                                        <PhoneMissed size={10} />
                                                                        <span>+{c.missedCallCount || 0}</span>
                                                                    </button>
                                                                    <span className="text-[11px] text-gray-500 tracking-tight font-mono">
                                                                        {safeFormat(c.lastMissedCallAt, 'MM.dd HH:mm')}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3.5 py-[9px] text-xs font-mono tabular-nums text-[#676879] dark:text-muted-foreground">
                                                            {safeFormat(c.createdAt, 'yyyy-MM-dd')}
                                                        </td>
                                                        <td className="px-3.5 py-[9px] text-xs font-mono tabular-nums text-[#676879] dark:text-muted-foreground">
                                                            {safeFormat(lastConsultDate, 'yyyy-MM-dd')}
                                                        </td>
                                                        <td className="px-3.5 py-[9px] text-xs font-mono tabular-nums">
                                                            {overdueReminder && (
                                                                <div className="mb-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-red-50 text-red-700 font-semibold dark:bg-red-900/30 dark:text-red-300" title={overdueReminder.content || ''}>
                                                                    지난 일정 {overdueReminder.datetime.slice(5)}
                                                                </div>
                                                            )}
                                                            {nextReminder ? (
                                                                <HoverCheckTooltip
                                                                    trigger={
                                                                        <div className="flex items-center gap-1.5 cursor-help">
                                                                            {(() => {
                                                                                const rType = nextReminder.type || '통화';
                                                                                if (rType === '통화') return <Phone size={14} className="text-[#0073ea]" />;
                                                                                if (rType === '출장미팅') return <Briefcase size={14} className="text-[#00c875]" />;
                                                                                if (rType === '방문미팅') return <MapPin size={14} className="text-[#9d50dd]" />;
                                                                                return <MoreHorizontal size={14} className="text-gray-600" />;
                                                                            })()}
                                                                            <span className="text-[#323338] dark:text-gray-300 font-medium">{nextReminder.datetime}</span>
                                                                            {(c.reminders?.length || 0) > 1 && <span className="text-[10px] text-[#676879] dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded-[4px]">+{((c.reminders?.length || 0) - 1)}</span>}
                                                                        </div>
                                                                    }
                                                                    content={
                                                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                                                            <p className="font-bold text-gray-200 border-b border-gray-600 pb-1 sticky top-0 bg-gray-900/90">리마인더 일정</p>
                                                                            {c.reminders?.map((reminder, idx) => (
                                                                                <div key={idx} className="text-xs border-b border-gray-700 last:border-0 pb-1.5 mb-1.5">
                                                                                    <p className="text-gray-600 dark:text-gray-300 font-medium">{reminder.datetime}</p>
                                                                                    {reminder.content && (
                                                                                        <p className="text-gray-500 dark:text-gray-400 mt-0.5 pl-1 border-l-2 border-gray-600">
                                                                                            {reminder.content}
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    }
                                                                />
                                                            ) : (overdueReminder ? null : '-')}
                                                        </td>
                                                        {viewMode !== 'active' && (
                                                            <td className="px-3.5 py-[9px] text-center">
                                                                {viewMode === 'trash' ? (
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <button
                                                                            onClick={(e) => onRestore(c.caseId, e)}
                                                                            className="text-green-500 hover:text-green-700 p-1.5 rounded-[4px] hover:bg-green-50"
                                                                            title="복구"
                                                                        >
                                                                            <Sparkles size={16} />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => onDelete(c.caseId, e)}
                                                                            className="text-red-500 hover:text-red-700 p-1.5 rounded-[4px] hover:bg-red-50"
                                                                            title="영구 삭제"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <button
                                                                            onClick={(e) => onRestore(c.caseId, e)}
                                                                            className="text-purple-600 hover:text-purple-800 p-1.5 rounded-[4px] hover:bg-purple-50 dark:hover:bg-purple-900/30"
                                                                            title="활성 리드로 복원 (상담원 공개)"
                                                                        >
                                                                            <Sparkles size={16} />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => onDelete(c.caseId, e)}
                                                                            className="text-gray-500 dark:text-gray-400 hover:text-red-500 p-1.5 rounded-[4px] transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                            title="휴지통으로 이동"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>

                                    {/* Group Summary Row with BatteryProgress */}
                                    <div className="px-4 py-2 bg-[#f6f7fb]/70 dark:bg-card border-t border-[#d0d4e4] dark:border-border flex items-center justify-between text-xs text-[#676879] dark:text-muted-foreground">
                                        <div className="flex items-center gap-2 font-medium">
                                            <span>{group.title} 합계 <strong className="text-[#323338] dark:text-foreground font-mono">{group.cases.length}건</strong></span>
                                        </div>
                                        <div className="w-64 max-w-sm flex items-center gap-2">
                                            <span className="text-[11px] text-[#676879] dark:text-muted-foreground shrink-0 font-medium">상태 비중</span>
                                            <BatteryProgress items={groupStatusCounts} height={12} />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Call Confirm Popup */}
            <CallConfirmPopup
                isOpen={!!callTarget}
                customerName={callTarget?.name || ''}
                phoneNumber={callTarget?.phone || ''}
                caseId={callTarget?.caseId}
                onConfirm={handleCallConfirm}
                onCancel={() => setCallTarget(null)}
            />
        </div>
    );
};
