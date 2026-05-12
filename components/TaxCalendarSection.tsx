import React, { useState } from 'react';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AlertTriangle, CheckCircle, Clock, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

interface TaxEvent {
    id: string;
    date: string;
    title: string;
    description: string;
    layer: 'deadline' | 'prep' | 'routine' | 'risk' | 'saving';
    tag: '신고마감' | '자료준비' | '매출정산' | '인건비' | '증빙점검' | '세무사전달';
    period?: string;
    isDone?: boolean;
    actionLabel?: string;
    actionSection?: string;
}

const TAG_STYLE: Record<string, string> = {
    '신고마감': 'bg-red-100 text-red-700 border-red-200',
    '자료준비': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    '매출정산': 'bg-blue-100 text-blue-700 border-blue-200',
    '인건비':   'bg-purple-100 text-purple-700 border-purple-200',
    '증빙점검': 'bg-green-100 text-green-700 border-green-200',
    '세무사전달':'bg-gray-100 text-gray-700 border-gray-200',
};

const TAX_EVENTS_2026: TaxEvent[] = [
    // ── 1월 ──
    { id:'e1',  date:'2026-01-25', title:'2025년 2기 부가세 확정신고·납부', description:'2025.7~12월분. 개업일(11/29) 이후분만 해당. 홈택스 전자신고.', layer:'deadline', tag:'신고마감', period:'2025 7~12월', actionLabel: '예상 부가세 확인', actionSection: 'VAT' },
    { id:'e2',  date:'2026-01-05', title:'2025년 2기 부가세 자료 수집 시작', description:'플랫폼 정산자료 다운로드, 카드매출/현금영수증/세금계산서 취합.', layer:'prep', tag:'자료준비', period:'', actionLabel: '매출/매입 자료 대사', actionSection: 'RECONCILIATION' },
    { id:'e3',  date:'2026-01-15', title:'매출·매입 세금계산서 최종 확인', description:'누락 세금계산서 재요청, 매입공제 항목 분류.', layer:'prep', tag:'증빙점검', period:'', actionLabel: '세금계산서 수집 현황', actionSection: 'TAX_INVOICE' },

    // ── 매월 10일 원천세 ──
    { id:'m1',  date:'2026-02-10', title:'원천세 신고·납부 (2월)', description:'1월 지급분 원천징수세액. 사업소득 3.3%, 근로소득 간이세액표.', layer:'routine', tag:'인건비', period:'1월 지급분', actionLabel: '원천세 내역 확인', actionSection: 'WITHHOLDING' },
    { id:'m2',  date:'2026-03-10', title:'원천세 신고·납부 (3월)', description:'2월 지급분 원천징수세액.', layer:'routine', tag:'인건비', period:'2월 지급분', actionLabel: '원천세 내역 확인', actionSection: 'WITHHOLDING' },
    { id:'m3',  date:'2026-04-10', title:'원천세 신고·납부 (4월)', description:'3월 지급분 원천징수세액.', layer:'routine', tag:'인건비', period:'3월 지급분', actionLabel: '원천세 내역 확인', actionSection: 'WITHHOLDING' },
    { id:'m4',  date:'2026-05-11', title:'원천세 신고·납부 (5월)', description:'4월 지급분 원천징수세액.', layer:'routine', tag:'인건비', period:'4월 지급분', actionLabel: '원천세 내역 확인', actionSection: 'WITHHOLDING' },
    { id:'m5',  date:'2026-06-10', title:'원천세 신고·납부 (6월)', description:'5월 지급분 원천징수세액.', layer:'routine', tag:'인건비', period:'5월 지급분', actionLabel: '원천세 내역 확인', actionSection: 'WITHHOLDING' },
    { id:'m6',  date:'2026-07-10', title:'원천세 신고·납부 (7월)', description:'6월 지급분 원천징수세액.', layer:'routine', tag:'인건비', period:'6월 지급분', actionLabel: '원천세 내역 확인', actionSection: 'WITHHOLDING' },
    { id:'m7',  date:'2026-08-10', title:'원천세 신고·납부 (8월)', description:'7월 지급분 원천징수세액.', layer:'routine', tag:'인건비', period:'7월 지급분', actionLabel: '원천세 내역 확인', actionSection: 'WITHHOLDING' },
    { id:'m8',  date:'2026-09-10', title:'원천세 신고·납부 (9월)', description:'8월 지급분 원천징수세액.', layer:'routine', tag:'인건비', period:'8월 지급분', actionLabel: '원천세 내역 확인', actionSection: 'WITHHOLDING' },
    { id:'m9',  date:'2026-10-12', title:'원천세 신고·납부 (10월)', description:'9월 지급분 원천징수세액.', layer:'routine', tag:'인건비', period:'9월 지급분', actionLabel: '원천세 내역 확인', actionSection: 'WITHHOLDING' },
    { id:'m10', date:'2026-11-10', title:'원천세 신고·납부 (11월)', description:'10월 지급분 원천징수세액.', layer:'routine', tag:'인건비', period:'10월 지급분', actionLabel: '원천세 내역 확인', actionSection: 'WITHHOLDING' },
    { id:'m11', date:'2026-12-10', title:'원천세 신고·납부 (12월)', description:'11월 지급분 원천징수세액.', layer:'routine', tag:'인건비', period:'11월 지급분', actionLabel: '원천세 내역 확인', actionSection: 'WITHHOLDING' },

    // ── 4월 예정신고 ──
    { id:'e4',  date:'2026-04-13', title:'1기 부가세 예정신고 자료 준비', description:'1~3월 매출·매입 자료 취합. 광고비·플랫폼 정산 확인.', layer:'prep', tag:'자료준비', period:'2026 1~3월' },
    { id:'e5',  date:'2026-04-20', title:'세무사 자료 전달', description:'1기 예정신고 전 세무사 전달 마감.', layer:'prep', tag:'세무사전달', period:'' },
    { id:'e6',  date:'2026-04-27', title:'1기 부가세 예정신고·납부', description:'2026.1~3월분. 4/25 공휴일로 4/27 마감.', layer:'deadline', tag:'신고마감', period:'2026 1~3월' },

    // ── 5월 종합소득세 ──
    { id:'e7',  date:'2026-04-01', title:'종합소득세 자료 수집 시작', description:'2025년 귀속 전체 매출·경비·공제자료 정리. 카드·현금영수증·세금계산서.', layer:'prep', tag:'자료준비', period:'2025 귀속' },
    { id:'e8',  date:'2026-05-15', title:'종합소득세 신고 세무사 전달', description:'종소세 신고 전 서류 전달.', layer:'prep', tag:'세무사전달', period:'' },
    { id:'e9',  date:'2026-06-01', title:'2025 귀속 종합소득세 신고·납부', description:'5/31 일요일 → 6/1 마감. 성실신고 대상자는 6/30.', layer:'deadline', tag:'신고마감', period:'2025 귀속' },
    { id:'e10', date:'2026-06-30', title:'성실신고확인 종합소득세 (해당자)', description:'복식부기 의무자 중 매출 일정기준 초과 시 해당.', layer:'deadline', tag:'신고마감', period:'2025 귀속 (성실신고)' },

    // ── 7월 확정신고 ──
    { id:'e11', date:'2026-07-06', title:'1기 부가세 확정신고 자료 수집', description:'1~6월 전체 매출·매입 최종 취합.', layer:'prep', tag:'자료준비', period:'2026 1~6월' },
    { id:'e12', date:'2026-07-20', title:'세무사 자료 전달 (1기 확정)', description:'1기 확정신고 전 자료 전달 마감.', layer:'prep', tag:'세무사전달', period:'' },
    { id:'e13', date:'2026-07-27', title:'1기 부가세 확정신고·납부', description:'2026.1~6월분. 7/25 토요일 → 7/27 마감.', layer:'deadline', tag:'신고마감', period:'2026 1~6월' },

    // ── 10월 예정신고 ──
    { id:'e14', date:'2026-10-12', title:'2기 부가세 예정신고 자료 준비', description:'7~9월 매출·매입 자료 취합.', layer:'prep', tag:'자료준비', period:'2026 7~9월' },
    { id:'e15', date:'2026-10-26', title:'2기 부가세 예정신고·납부', description:'2026.7~9월분. 10/25 일요일 → 10/26 마감.', layer:'deadline', tag:'신고마감', period:'2026 7~9월' },

    // ── 11월 중간예납 ──
    { id:'e16', date:'2026-11-30', title:'종합소득세 중간예납', description:'고지 대상 여부 확인 후 납부. 전년도 세액 기준 50%.', layer:'deadline', tag:'신고마감', period:'' },

    // ── 연말 점검 ──
    { id:'e17', date:'2026-12-10', title:'연말 비용·증빙 마감 점검', description:'미수금, 카드/계좌, 자산구입, 접대비 정리. 절세 항목 최종 확인.', layer:'saving', tag:'증빙점검', period:'' },
    { id:'e18', date:'2026-12-31', title:'2기 부가세 확정신고 자료 준비 시작', description:'7~12월 매출·매입 자료 사전 취합.', layer:'prep', tag:'자료준비', period:'2026 7~12월' },
    { id:'e19', date:'2027-01-25', title:'2기 부가세 확정신고·납부', description:'2026.7~12월분.', layer:'deadline', tag:'신고마감', period:'2026 7~12월' },

    // ── 분기별 절세 점검 ──
    { id:'s1', date:'2026-03-31', title:'상반기 예상 세액 예비 계산', description:'전년도 종소세 신고 자료 정리. 필요경비 누락 체크.', layer:'saving', tag:'증빙점검', period:'' },
    { id:'s2', date:'2026-06-30', title:'상반기 매출·경비 점검', description:'1~6월 업종별 매출 구분, 광고비 대납 정리, 외주비 원천세 점검.', layer:'saving', tag:'증빙점검', period:'' },
    { id:'s3', date:'2026-09-30', title:'예상 종소세 중간 계산', description:'연간 예상 매출 기준 종소세 시뮬레이션. 중간예납 납부 준비.', layer:'saving', tag:'증빙점검', period:'' },
];

const LAYER_META = {
    deadline: { label: '신고·납부 마감', color: 'bg-red-500', icon: '🚨' },
    prep:     { label: '자료 준비',      color: 'bg-yellow-500', icon: '📋' },
    routine:  { label: '월별 루틴',      color: 'bg-blue-500', icon: '🔄' },
    risk:     { label: '리스크 알림',    color: 'bg-orange-500', icon: '⚠️' },
    saving:   { label: '절세 점검',      color: 'bg-green-500', icon: '💡' },
};

interface TaxCalendarSectionProps {
    onActionClick?: (section: string) => void;
}

export default function TaxCalendarSection({ onActionClick }: TaxCalendarSectionProps = {}) {
    const today = new Date();
    const [filterLayer, setFilterLayer] = useState<string>('all');
    const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const toggleDone = (id: string) => {
        setDoneIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const upcomingEvents = TAX_EVENTS_2026
        .map(e => ({
            ...e,
            daysLeft: differenceInCalendarDays(parseISO(e.date), today),
            isDone: doneIds.has(e.id),
        }))
        .filter(e => filterLayer === 'all' || e.layer === filterLayer)
        .sort((a, b) => a.daysLeft - b.daysLeft);

    const nextDeadline = upcomingEvents.find(e => e.layer === 'deadline' && e.daysLeft >= 0);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-rose-100 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-rose-100 bg-gradient-to-r from-rose-50 to-orange-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h3 className="font-bold text-rose-800 flex items-center gap-2 text-base">
                            🗓️ 세무 캘린더 2026
                        </h3>
                        <p className="text-xs text-rose-500 mt-0.5">개인사업자 · 일반과세자 · 광고대행/이커머스/개발업 기준</p>
                    </div>
                    {nextDeadline && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                            nextDeadline.daysLeft <= 7 ? 'bg-red-100 border-red-300 animate-pulse' :
                            nextDeadline.daysLeft <= 30 ? 'bg-orange-100 border-orange-300' :
                            'bg-yellow-50 border-yellow-200'
                        }`}>
                            <AlertTriangle size={16} className={nextDeadline.daysLeft <= 7 ? 'text-red-600' : 'text-orange-500'} />
                            <div>
                                <p className="text-xs font-bold text-gray-700">다음 신고 마감</p>
                                <p className="text-sm font-bold text-red-700">{nextDeadline.title}</p>
                                <p className="text-xs text-gray-500">{nextDeadline.date} · <span className="font-bold">D-{nextDeadline.daysLeft}</span></p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Layer Filter */}
                <div className="flex flex-wrap gap-2 mt-3">
                    <button
                        onClick={() => setFilterLayer('all')}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filterLayer === 'all' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >전체</button>
                    {Object.entries(LAYER_META).map(([key, meta]) => (
                        <button
                            key={key}
                            onClick={() => setFilterLayer(key)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filterLayer === key ? `${meta.color} text-white border-transparent` : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                            {meta.icon} {meta.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Event List */}
            <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
                {upcomingEvents.map(event => {
                    const isExpanded = expandedId === event.id;
                    const isPast = event.daysLeft < 0;
                    const isUrgent = event.daysLeft >= 0 && event.daysLeft <= 7;
                    const isSoon = event.daysLeft >= 0 && event.daysLeft <= 30;

                    return (
                        <div
                            key={event.id}
                            className={`rounded-lg border transition-all ${
                                event.isDone ? 'bg-gray-50 border-gray-200 opacity-60' :
                                isUrgent ? 'bg-red-50 border-red-200' :
                                isSoon ? 'bg-orange-50 border-orange-200' :
                                isPast ? 'bg-gray-50 border-gray-200' :
                                'bg-white border-gray-200 hover:border-rose-200'
                            }`}
                        >
                            <div
                                className="flex items-center gap-3 p-3 cursor-pointer"
                                onClick={() => setExpandedId(isExpanded ? null : event.id)}
                            >
                                {/* Done checkbox */}
                                <button
                                    onClick={e => { e.stopPropagation(); toggleDone(event.id); }}
                                    className="shrink-0"
                                >
                                    {event.isDone
                                        ? <CheckCircle size={18} className="text-green-500" />
                                        : <div className={`w-[18px] h-[18px] rounded-full border-2 ${isUrgent ? 'border-red-400' : 'border-gray-300'}`} />
                                    }
                                </button>

                                {/* Layer icon */}
                                <span className="text-base shrink-0">{LAYER_META[event.layer].icon}</span>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${TAG_STYLE[event.tag]}`}>
                                            {event.tag}
                                        </span>
                                        <span className="text-xs text-gray-500">{event.date}</span>
                                        {event.period && (
                                            <span className="text-xs text-gray-400">({event.period})</span>
                                        )}
                                    </div>
                                    <p className={`text-sm font-medium mt-0.5 ${event.isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                        {event.title}
                                    </p>
                                </div>

                                {/* D-day badge */}
                                <div className="shrink-0 text-right">
                                    {isPast
                                        ? <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">완료</span>
                                        : event.daysLeft === 0
                                        ? <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">오늘!</span>
                                        : <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isUrgent ? 'bg-red-100 text-red-700' : isSoon ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                            D-{event.daysLeft}
                                        </span>
                                    }
                                    {isExpanded ? <ChevronUp size={14} className="text-gray-400 ml-1 inline" /> : <ChevronDown size={14} className="text-gray-400 ml-1 inline" />}
                                </div>
                            </div>

                            {/* Expanded detail */}
                            {isExpanded && (
                                <div className="px-4 pb-3 pt-0 border-t border-gray-100">
                                    <p className="text-sm text-gray-600 mt-2">{event.description}</p>
                                    <div className="mt-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Clock size={12} className="text-gray-400" />
                                            <span className="text-xs text-gray-400">
                                                {format(parseISO(event.date), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
                                            </span>
                                        </div>
                                    </div>
                                    {event.actionLabel && event.actionSection && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onActionClick) onActionClick(event.actionSection!);
                                            }}
                                            className="mt-3 w-full py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg text-sm font-bold hover:bg-rose-100 transition-colors"
                                        >
                                            {event.actionLabel} &rarr;
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {upcomingEvents.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                        <Calendar size={32} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">해당 항목이 없습니다.</p>
                    </div>
                )}
            </div>

            {/* Footer legend */}
            <div className="p-3 border-t border-gray-100 bg-gray-50">
                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {Object.entries(TAG_STYLE).map(([tag, style]) => (
                        <span key={tag} className={`px-2 py-0.5 rounded border ${style}`}>{tag}</span>
                    ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">※ 신고 기한이 공휴일·토요일이면 다음 영업일로 연장됩니다. 실제 신고 전 홈택스 및 세무대리인 확인 권장.</p>
            </div>
        </div>
    );
}
