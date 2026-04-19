import React, { useState, useMemo } from 'react';
import {
    format, addMonths, subMonths, startOfMonth, endOfMonth,
    startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, isToday,
    parseISO, nextTuesday, isBefore, isAfter
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { SettlementBatch, Case, Partner, CommissionRule, SettlementConfig } from '../types';

interface SettlementCalendarProps {
    batches: SettlementBatch[];
    cases?: Case[];
    partners?: Partner[];
}

interface SettlementEvent {
    date: string;
    type: 'collection' | 'payout' | 'invoice' | 'deposit' | 'expected_deposit' | 'commission_received' | 'expected_commission';
    label: string;
    amount?: number;
    batchId?: string;
    weekLabel?: string;
    customerName?: string;
    isExpected?: boolean;  // 예상 이벤트 여부
}

export default function SettlementCalendar({ batches, cases = [], partners = [] }: SettlementCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 수수료 계산 함수: 수임료 기준 수당 계산
    const getCommission = (contractFee: number, rules: CommissionRule[]): CommissionRule | null => {
        const activeRules = rules.filter(r => r.active).sort((a, b) => a.priority - b.priority);
        for (const rule of activeRules) {
            const maxFee = rule.maxFee || Infinity;
            if (contractFee >= rule.minFee && contractFee <= maxFee) {
                return rule;
            }
        }
        return null;
    };

    // 지급일 계산: 입금이 속한 주차 마감(일요일) 후 다음 주 화요일
    const calculatePayoutDate = (depositDate: string, config: SettlementConfig): string => {
        const date = parseISO(depositDate);

        // 정산 주기: 월요일(1) ~ 일요일(0)
        // 주 시작을 월요일로 설정
        const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // 월요일 시작
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 }); // 일요일 마감

        // 주차 마감일(일요일) 다음날은 다음 주 월요일
        const nextMonday = addDays(weekEnd, 1);

        // 지급 요일 계산 (화요일 = 2)
        // payoutDay: 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
        const payoutDayOffset = config.payoutDay === 0 ? 6 : config.payoutDay - 1;
        let payoutDate = addDays(nextMonday, payoutDayOffset);

        // payoutWeekDelay 적용 (0=이번주(차주), 1=다다음주)
        // "이번 주 (금주)" = 마감 후 첫 번째 해당 요일
        if (config.payoutWeekDelay === 1) {
            payoutDate = addDays(payoutDate, 7);
        }

        return format(payoutDate, 'yyyy-MM-dd');
    };

    // Extract events from batches - ensure batches is always an array
    const safeBatches = Array.isArray(batches) ? batches : [];
    const safeCases = Array.isArray(cases) ? cases : [];
    const events: SettlementEvent[] = [];

    // 1. 배치에서 이벤트 추출
    safeBatches.forEach(batch => {
        // Collection event - check both collectionInfo.collectedAt and status
        if (batch.collectionInfo?.collectedAt) {
            events.push({
                date: batch.collectionInfo.collectedAt,
                type: 'collection',
                label: '수금 완료',
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

    // 2. 케이스의 depositHistory에서 입금 이벤트 추출 (미래 날짜는 자동으로 예상 입금 처리)
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // 오늘 날짜의 시작

    safeCases.forEach(caseItem => {
        // 2-1. 입금 내역 (실제 + 예상 자동 판별)
        if (caseItem.depositHistory && Array.isArray(caseItem.depositHistory)) {
            caseItem.depositHistory.forEach((deposit, idx) => {
                if (deposit.date) {
                    const depositDate = parseISO(deposit.date);
                    const isFuture = isAfter(depositDate, today) || isSameDay(depositDate, today) && isAfter(new Date(), today);
                    // 미래 날짜인 경우 오늘 이후이면 예상으로 처리
                    const isFutureDeposit = isAfter(depositDate, today);

                    events.push({
                        date: deposit.date,
                        type: isFutureDeposit ? 'expected_deposit' : 'deposit',
                        label: isFutureDeposit ? `${idx + 1}차 입금 (예정)` : `${idx + 1}차 입금`,
                        amount: deposit.amount,
                        customerName: caseItem.customerName,
                        isExpected: isFutureDeposit
                    });
                }
            });
        }

        // 2-2. 예상 입금 (별도 필드 - 이전 호환성)
        if (caseItem.expectedDeposits && Array.isArray(caseItem.expectedDeposits)) {
            caseItem.expectedDeposits.forEach((deposit, idx) => {
                if (deposit.date) {
                    const depositNum = (caseItem.depositHistory?.length || 0) + idx + 1;
                    events.push({
                        date: deposit.date,
                        type: 'expected_deposit',
                        label: `${depositNum}차 입금 (예정)`,
                        amount: deposit.amount,
                        customerName: caseItem.customerName,
                        isExpected: true
                    });
                }
            });
        }

        // 2-3. 수수료 지급 내역 (실제/예상)
        if (caseItem.commissionPayments && Array.isArray(caseItem.commissionPayments)) {
            caseItem.commissionPayments.forEach((payment, idx) => {
                if (payment.date) {
                    events.push({
                        date: payment.date,
                        type: payment.isExpected ? 'expected_commission' : 'commission_received',
                        label: payment.isExpected
                            ? `${idx + 1}차 수수료 지급 (예정)`
                            : `${idx + 1}차 수수료 지급`,
                        amount: payment.amount,
                        customerName: caseItem.customerName,
                        isExpected: payment.isExpected
                    });
                }
            });
        }
    });

    // 3. 케이스별 수수료 지급 자동 계산 (파트너 설정 기반)
    const safePartners = Array.isArray(partners) ? partners : [];
    safeCases.forEach(caseItem => {
        // 케이스에 계약 정보가 없으면 스킵
        if (!caseItem.contractFee || caseItem.contractFee <= 0) return;

        // 수동 입력된 수수료 지급 내역이 있으면 자동 계산 스킵 (중복 방지)
        if (caseItem.commissionPayments && Array.isArray(caseItem.commissionPayments) && caseItem.commissionPayments.length > 0) return;

        // 파트너 찾기 (케이스의 파트너 ID 또는 거래처 이름으로 매칭)
        const partner = safePartners.find(p =>
            p.partnerId === (caseItem as any).partnerId ||
            p.name === (caseItem as any).partnerName ||
            p.name === (caseItem as any).lawFirm
        );
        if (!partner || !partner.commissionRules || !partner.settlementConfig) return;

        // 수수료 규칙 찾기
        const rule = getCommission(caseItem.contractFee, partner.commissionRules);
        if (!rule) return;

        const config = partner.settlementConfig;
        const totalCommission = rule.commission; // 총 수수료 (만원)
        // [FIX] 구간 최저값(rule.minFee) 기준으로 계약금 비율 적용
        const downPaymentThreshold = rule.minFee * (config.downPaymentPercentage / 100); // 선지급 기준 금액
        const fullPayoutThreshold = rule.fullPayoutThreshold || totalCommission; // 완납 기준 금액
        const firstPayoutAmount = totalCommission * (config.firstPayoutPercentage / 100); // 1차 지급액
        const secondPayoutAmount = totalCommission - firstPayoutAmount; // 2차 지급액 (잔금)

        // 모든 입금 내역 합치기 (날짜 기준으로 미래면 예상으로 자동 처리)
        const allDeposits = [
            ...(caseItem.depositHistory || []).map(d => ({
                ...d,
                isExpected: isAfter(parseISO(d.date), today)
            })),
            ...(caseItem.expectedDeposits || []).map(d => ({ ...d, isExpected: true }))
        ].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

        let cumulativeDeposit = 0;
        let firstPayoutTriggered = false;
        let secondPayoutTriggered = false;

        allDeposits.forEach((deposit, idx) => {
            cumulativeDeposit += deposit.amount;

            let firstTriggeredThisDeposit = false;
            let secondTriggeredThisDeposit = false;

            // 1차 지급 조건: 누적 입금 >= 선지급 기준 (수임료의 10%)
            if (!firstPayoutTriggered && cumulativeDeposit >= downPaymentThreshold) {
                firstPayoutTriggered = true;
                firstTriggeredThisDeposit = true;
            }

            // 2차 지급 조건: 누적 입금 >= 완납 기준
            if (!secondPayoutTriggered && cumulativeDeposit >= fullPayoutThreshold) {
                secondPayoutTriggered = true;
                secondTriggeredThisDeposit = true;
            }

            const payoutDate = (firstTriggeredThisDeposit || secondTriggeredThisDeposit)
                ? calculatePayoutDate(deposit.date, config)
                : '';

            // 같은 입금에서 1차와 2차가 동시에 발생하면 (완납) 합산하여 한 건으로 표시
            if (firstTriggeredThisDeposit && secondTriggeredThisDeposit) {
                events.push({
                    date: payoutDate,
                    type: deposit.isExpected ? 'expected_commission' : 'commission_received',
                    label: deposit.isExpected ? '수수료 전액 (예정)' : '수수료 전액 지급',
                    amount: totalCommission,
                    customerName: caseItem.customerName,
                    isExpected: deposit.isExpected
                });
            } else {
                if (firstTriggeredThisDeposit) {
                    events.push({
                        date: payoutDate,
                        type: deposit.isExpected ? 'expected_commission' : 'commission_received',
                        label: deposit.isExpected ? '1차 수수료 (예정)' : '1차 수수료 지급',
                        amount: firstPayoutAmount,
                        customerName: caseItem.customerName,
                        isExpected: deposit.isExpected
                    });
                }
                if (secondTriggeredThisDeposit) {
                    events.push({
                        date: payoutDate,
                        type: deposit.isExpected ? 'expected_commission' : 'commission_received',
                        label: deposit.isExpected ? '잔금 수수료 (예정)' : '잔금 수수료 지급',
                        amount: secondPayoutAmount,
                        customerName: caseItem.customerName,
                        isExpected: deposit.isExpected
                    });
                }
            }
        });
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
                                {dayEvents.slice(0, 2).map((e, idx) => {
                                    const getEventStyle = () => {
                                        const baseStyle = e.isExpected ? 'border border-dashed ' : '';
                                        switch (e.type) {
                                            case 'deposit': return baseStyle + 'bg-blue-100 text-blue-700';
                                            case 'expected_deposit': return 'bg-blue-50 text-blue-600 border border-dashed border-blue-300';
                                            case 'commission_received': return baseStyle + 'bg-emerald-100 text-emerald-700';
                                            case 'expected_commission': return 'bg-emerald-50 text-emerald-600 border border-dashed border-emerald-300';
                                            case 'collection': return baseStyle + 'bg-green-100 text-green-700';
                                            case 'payout': return baseStyle + 'bg-orange-100 text-orange-700';
                                            default: return baseStyle + 'bg-purple-100 text-purple-700';
                                        }
                                    };
                                    const getIcon = () => {
                                        switch (e.type) {
                                            case 'deposit': return '💵';
                                            case 'expected_deposit': return '📅💵';
                                            case 'commission_received': return '💸';
                                            case 'expected_commission': return '📅💸';
                                            case 'collection': return '💰';
                                            case 'payout': return '💳';
                                            default: return '📥';
                                        }
                                    };
                                    return (
                                        <div
                                            key={idx}
                                            className={`text-[10px] px-1 py-0.5 rounded truncate ${getEventStyle()}`}
                                        >
                                            {getIcon()} {e.amount ? `${e.amount}만원` : e.label}
                                        </div>
                                    );
                                })}
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
                    <div className="space-y-3 max-h-[400px] overflow-y-auto" style={{ overscrollBehavior: 'auto' }}>
                        {dayEvents.map((e, idx) => {
                            const getModalStyle = () => {
                                const baseBorder = e.isExpected ? 'border-dashed ' : '';
                                switch (e.type) {
                                    case 'deposit': return 'bg-blue-50 border-blue-200 ' + baseBorder;
                                    case 'expected_deposit': return 'bg-blue-50/50 border-dashed border-blue-300';
                                    case 'commission_received': return 'bg-emerald-50 border-emerald-200 ' + baseBorder;
                                    case 'expected_commission': return 'bg-emerald-50/50 border-dashed border-emerald-300';
                                    case 'collection': return 'bg-green-50 border-green-200 ' + baseBorder;
                                    case 'payout': return 'bg-orange-50 border-orange-200 ' + baseBorder;
                                    default: return 'bg-purple-50 border-purple-200 ' + baseBorder;
                                }
                            };
                            const getModalTextColor = () => {
                                switch (e.type) {
                                    case 'deposit': case 'expected_deposit': return 'text-blue-700';
                                    case 'commission_received': case 'expected_commission': return 'text-emerald-700';
                                    case 'collection': return 'text-green-700';
                                    case 'payout': return 'text-orange-700';
                                    default: return 'text-purple-700';
                                }
                            };
                            const getModalIcon = () => {
                                switch (e.type) {
                                    case 'deposit': return '💵 입금';
                                    case 'expected_deposit': return '📅 예정 입금';
                                    case 'commission_received': return '💸 수수료 지급';
                                    case 'expected_commission': return '📅 예정 수수료';
                                    case 'collection': return '💰 수금';
                                    case 'payout': return '💳 지급';
                                    default: return '📥 세금계산서';
                                }
                            };
                            return (
                                <div
                                    key={idx}
                                    className={`p-4 rounded-lg border ${getModalStyle()}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className={`text-sm font-bold ${getModalTextColor()}`}>
                                                {getModalIcon()}
                                            </span>
                                            <p className="text-gray-600 text-sm mt-1">{e.customerName ? `${e.customerName} - ${e.label}` : e.label}</p>
                                            {e.weekLabel && <p className="text-xs text-gray-400 mt-1">{e.weekLabel}</p>}
                                        </div>
                                        {e.amount && (
                                            <span className="text-lg font-bold text-gray-800">{e.amount.toLocaleString()}만원</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
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
                <div className="flex gap-1.5 text-xs flex-wrap">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">💵 입금</span>
                    <span className="px-2 py-1 bg-blue-50 text-blue-600 border border-dashed border-blue-300 rounded-full">📅 예정입금</span>
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">💸 수수료</span>
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-dashed border-emerald-300 rounded-full">📅 예정수수료</span>
                </div>
            </div>
            {renderHeader()}
            {renderDays()}
            {renderCells()}
            {renderModal()}
        </div>
    );
}
