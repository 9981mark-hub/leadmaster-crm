import React, { useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
    TrendingUp, TrendingDown, Minus, FileText, Banknote, Wallet, AlertTriangle
} from 'lucide-react';
import { Case, Partner, CommissionRule } from '../types';
import { calculateCommission } from '../utils';
import { motion } from 'framer-motion';

interface RevenueWidgetProps {
    cases: Case[];
    partners: Partner[];
}

interface RevenueKPI {
    label: string;
    value: number;
    prevValue: number;
    unit: string;
    icon: React.FC<any>;
    color: string;
    bgGradient: string;
    subLabel?: string;
    subValue?: string | number;
}

export default function RevenueWidget({ cases, partners }: RevenueWidgetProps) {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const kpis = useMemo<RevenueKPI[]>(() => {
        // Helper: 날짜가 특정 월에 속하는지
        const isInRange = (dateStr: string | undefined, start: Date, end: Date): boolean => {
            if (!dateStr) return false;
            try {
                const d = parseISO(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
                return d >= start && d <= end;
            } catch { return false; }
        };

        // ── 1. 수임료 총액 (contractAt 기준) ──
        const thisMonthContracts = cases.filter(c => isInRange(c.contractAt, thisMonthStart, thisMonthEnd));
        const prevMonthContracts = cases.filter(c => isInRange(c.contractAt, lastMonthStart, lastMonthEnd));
        const thisContractFee = thisMonthContracts.reduce((sum, c) => sum + (c.contractFee || 0), 0);
        const prevContractFee = prevMonthContracts.reduce((sum, c) => sum + (c.contractFee || 0), 0);

        // ── 2. 입금 총액 (depositHistory에서 이번 달 입금 합산) ──
        let thisDeposit = 0;
        let prevDeposit = 0;
        cases.forEach(c => {
            (c.depositHistory || []).forEach(d => {
                if (isInRange(d.date, thisMonthStart, thisMonthEnd)) thisDeposit += d.amount;
                if (isInRange(d.date, lastMonthStart, lastMonthEnd)) prevDeposit += d.amount;
            });
        });

        // ── 3. 수수료 총액 (이번 달 계약 건의 수수료) ──
        const getCommission = (caseItem: Case) => {
            const partner = partners.find(p =>
                p.partnerId === caseItem.partnerId ||
                p.name === (caseItem as any).partnerName ||
                p.name === (caseItem as any).lawFirm
            );
            if (!partner) return 0;
            return calculateCommission(caseItem.contractFee || 0, partner.commissionRules || []);
        };
        const thisCommission = thisMonthContracts.reduce((sum, c) => sum + getCommission(c), 0);
        const prevCommission = prevMonthContracts.reduce((sum, c) => sum + getCommission(c), 0);

        // ── 4. 미수금 (수임료 - 누적입금 > 0인 건) ──
        const receivables = cases.filter(c => {
            if (!c.contractFee || c.contractFee <= 0) return false;
            if (c.deletedAt) return false;
            const totalDeposited = (c.depositHistory || []).reduce((sum, d) => sum + d.amount, 0);
            return c.contractFee > totalDeposited;
        });
        const totalReceivable = receivables.reduce((sum, c) => {
            const totalDeposited = (c.depositHistory || []).reduce((s, d) => s + d.amount, 0);
            return sum + (c.contractFee || 0) - totalDeposited;
        }, 0);

        return [
            {
                label: '이번 달 수임료',
                value: thisContractFee,
                prevValue: prevContractFee,
                unit: '만원',
                icon: FileText,
                color: 'text-blue-600',
                bgGradient: 'from-blue-500 to-blue-600',
                subLabel: `${thisMonthContracts.length}건 계약`
            },
            {
                label: '이번 달 입금액',
                value: thisDeposit,
                prevValue: prevDeposit,
                unit: '만원',
                icon: Banknote,
                color: 'text-emerald-600',
                bgGradient: 'from-emerald-500 to-emerald-600'
            },
            {
                label: '이번 달 수수료',
                value: thisCommission,
                prevValue: prevCommission,
                unit: '만원',
                icon: Wallet,
                color: 'text-violet-600',
                bgGradient: 'from-violet-500 to-violet-600'
            },
            {
                label: '미수금 현황',
                value: totalReceivable,
                prevValue: 0, // 미수금은 전월 비교 의미 없으므로 0
                unit: '만원',
                icon: AlertTriangle,
                color: totalReceivable > 0 ? 'text-amber-600' : 'text-green-600',
                bgGradient: totalReceivable > 0 ? 'from-amber-500 to-orange-500' : 'from-green-500 to-emerald-500',
                subLabel: receivables.length > 0 ? `${receivables.length}건 미수` : '미수금 없음',
                subValue: receivables.length > 0 ? undefined : '✅'
            }
        ];
    }, [cases, partners]);

    // 증감률 계산
    const getChangeInfo = (current: number, prev: number) => {
        if (prev === 0 && current === 0) return { pct: 0, direction: 'same' as const };
        if (prev === 0) return { pct: 100, direction: 'up' as const };
        const pct = Math.round(((current - prev) / prev) * 100);
        if (pct > 0) return { pct, direction: 'up' as const };
        if (pct < 0) return { pct: Math.abs(pct), direction: 'down' as const };
        return { pct: 0, direction: 'same' as const };
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center mb-1">
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                    <span>매출 및 정산 현황</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                        ({format(now, 'yyyy년 M월', { locale: ko })})
                    </span>
                </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {kpis.map((kpi, idx) => {
                    const change = kpi.label !== '미수금 현황'
                        ? getChangeInfo(kpi.value, kpi.prevValue)
                        : null;
                    const Icon = kpi.icon;

                    return (
                        <motion.div
                            key={kpi.label}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05, duration: 0.2 }}
                            className="bg-card border border-border rounded-xl p-4 relative overflow-hidden group hover:border-primary/40 transition-all shadow-xs"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                                <div className={`p-1.5 rounded-lg bg-muted text-foreground`}>
                                    <Icon size={15} strokeWidth={1.75} />
                                </div>
                            </div>

                            <div className="flex items-baseline gap-1.5 mb-1.5">
                                <span className="text-xl md:text-2xl font-black text-foreground font-mono tabular-nums">
                                    ₩ {kpi.value.toLocaleString()}
                                </span>
                                <span className="text-xs font-semibold text-muted-foreground">{kpi.unit}</span>
                            </div>

                            {/* 전월 비교 or subLabel */}
                            <div className="flex items-center gap-1.5 text-xs">
                                {change && change.direction !== 'same' ? (
                                    <span className={`font-semibold flex items-center gap-0.5 tabular-nums ${change.direction === 'up'
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-destructive'
                                        }`}>
                                        {change.direction === 'up' ? <TrendingUp size={12} strokeWidth={1.75} /> : <TrendingDown size={12} strokeWidth={1.75} />}
                                        {change.direction === 'up' ? '+' : '-'}{change.pct}%
                                        <span className="text-muted-foreground font-normal ml-0.5">전월비</span>
                                    </span>
                                ) : change ? (
                                    <span className="text-muted-foreground flex items-center gap-0.5">
                                        <Minus size={12} strokeWidth={1.75} /> 전월 동일
                                    </span>
                                ) : null}
                                {kpi.subLabel && (
                                    <span className={`text-[11px] ${kpi.label === '미수금 현황' && kpi.value > 0
                                        ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                        : 'text-muted-foreground'
                                        }`}>
                                        {kpi.subValue || ''} {kpi.subLabel}
                                    </span>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
