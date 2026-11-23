import React, { useState, useEffect } from 'react';
import { fetchExpenses, EXPENSE_CATEGORIES } from '../services/api';
import { ExpenseCategory } from '../types';
import { useOrgStore, mutateOrgStore } from '../services/orgStore';
import { BUDGETS_SPEC, Budget } from '../services/orgData';

interface BudgetManagementSectionProps {
    year: number;
    month: number;
}

const BudgetManagementSection: React.FC<BudgetManagementSectionProps> = ({ year, month }) => {
    // [2026-11-13 KIRO] 예산은 회사별 서버(settings 'budgets')가 원본
    const { value: allBudgets } = useOrgStore(BUDGETS_SPEC);
    const budgets: Budget[] = (Array.isArray(allBudgets) ? allBudgets : []).filter(b => b.year === year && b.month === month);
    const [spending, setSpending] = useState<Record<ExpenseCategory, number>>({} as any);
    const [isEditMode, setIsEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editBudgets, setEditBudgets] = useState<Record<ExpenseCategory, number>>({} as any);

    // 편집칸을 저장된 예산으로 채우기
    const loadBudgets = () => {
        const edit: Record<ExpenseCategory, number> = {} as any;
        budgets.forEach(b => {
            edit[b.category] = b.monthlyLimit;
        });
        setEditBudgets(edit);
    };

    // 예산 저장 (서버 최신값에서 이 달만 바꾼다)
    const saveBudgets = async () => {
        if (saving) return;
        const monthBudgets: Budget[] = [];
        (Object.entries(editBudgets) as [ExpenseCategory, number][]).forEach(([cat, limit]) => {
            if (limit > 0) {
                monthBudgets.push({
                    id: `${year}-${month}-${cat}`,
                    category: cat,
                    monthlyLimit: limit,
                    year,
                    month
                });
            }
        });
        setSaving(true);
        const res = await mutateOrgStore(BUDGETS_SPEC, list => [
            ...(Array.isArray(list) ? list : []).filter(b => !(b.year === year && b.month === month)),
            ...monthBudgets,
        ]);
        setSaving(false);
        if (!res.ok) {
            alert(`예산을 저장하지 못했습니다. ${res.error}`);
            return;
        }
        setIsEditMode(false);
    };

    // 지출 현황 로드
    const loadSpending = async () => {
        const expenses = await fetchExpenses();
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        const monthlyExpenses = expenses.filter(e => e.date.startsWith(monthStr));

        const byCategory: Record<ExpenseCategory, number> = {} as any;
        EXPENSE_CATEGORIES.forEach(cat => {
            byCategory[cat] = 0;
        });

        monthlyExpenses.forEach(exp => {
            byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
        });

        setSpending(byCategory);
    };

    useEffect(() => {
        loadSpending();
    }, [year, month]);

    // 서버 값이 오거나 달이 바뀌면 편집칸 다시 채우기 (편집 중에는 그대로)
    useEffect(() => {
        if (!isEditMode) loadBudgets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allBudgets, year, month]);

    // 예산 사용률 계산
    const getUsagePercent = (category: ExpenseCategory) => {
        const budget = budgets.find(b => b.category === category);
        if (!budget || budget.monthlyLimit === 0) return 0;
        return Math.round((spending[category] || 0) / budget.monthlyLimit * 100);
    };

    // 전체 예산 요약
    const totalBudget = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0);
    const totalSpending = (Object.values(spending) as number[]).reduce((sum, v) => sum + v, 0);
    const totalUsage = totalBudget > 0 ? Math.round(totalSpending / totalBudget * 100) : 0;

    return (
        <div className="bg-card text-card-foreground rounded-xl shadow-xs border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                        <h3 className="font-bold text-foreground flex items-center gap-2 text-xs sm:text-sm">
                            <span>💰 예산 관리</span>
                        </h3>
                        <p className="text-2xs text-muted-foreground mt-0.5">{year}년 {month}월 카테고리별 예산</p>
                    </div>
                    <button
                        onClick={() => isEditMode ? saveBudgets() : setIsEditMode(true)}
                        className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                        {isEditMode ? '저장' : '예산 설정'}
                    </button>
                </div>
            </div>

            <div className="p-4 sm:p-5">
                {/* 전체 요약 */}
                <div className="mb-4 p-4 rounded-xl bg-muted/40 border border-border">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground font-medium">전체 예산 사용률</span>
                        <span className={`text-base font-bold font-mono tabular-nums ${totalUsage > 100 ? 'text-red-500' : totalUsage > 80 ? 'text-amber-500' : 'text-primary'}`}>
                            {totalUsage}%
                        </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                        <div
                            className={`h-2.5 rounded-full transition-all ${totalUsage > 100 ? 'bg-red-500' : totalUsage > 80 ? 'bg-amber-500' : 'bg-primary'
                                }`}
                            style={{ width: `${Math.min(totalUsage, 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-2xs text-muted-foreground font-mono tabular-nums">
                        <span>사용: {totalSpending.toLocaleString()}원</span>
                        <span>예산: {totalBudget.toLocaleString()}원</span>
                    </div>
                </div>

                {/* 카테고리별 예산 */}
                <div className="space-y-2.5">
                    {EXPENSE_CATEGORIES.map(category => {
                        const budget = budgets.find(b => b.category === category);
                        const spent = spending[category] || 0;
                        const limit = budget?.monthlyLimit || 0;
                        const usage = limit > 0 ? Math.round(spent / limit * 100) : 0;
                        const isOver = usage > 100;
                        const isWarning = usage > 80;

                        return (
                            <div key={category} className="border border-border/60 bg-muted/20 rounded-xl p-3.5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-foreground">{category}</span>
                                    {isEditMode ? (
                                        <input
                                            type="number"
                                            value={editBudgets[category] || ''}
                                            onChange={e => setEditBudgets(prev => ({
                                                ...prev,
                                                [category]: parseInt(e.target.value) || 0
                                            }))}
                                            className="w-32 text-right bg-muted/40 border border-border rounded-lg px-2.5 py-1 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                                            placeholder="예산 (원)"
                                        />
                                    ) : (
                                        <span className={`text-xs font-bold font-mono tabular-nums ${isOver ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-foreground'}`}>
                                            {limit > 0 ? `${usage}%` : '-'}
                                        </span>
                                    )}
                                </div>

                                {!isEditMode && limit > 0 && (
                                    <>
                                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                            <div
                                                className={`h-2 rounded-full transition-all ${isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-primary'
                                                    }`}
                                                style={{ width: `${Math.min(usage, 100)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between mt-1 text-2xs text-muted-foreground font-mono tabular-nums">
                                            <span>{spent.toLocaleString()}원</span>
                                            <span>{limit.toLocaleString()}원</span>
                                        </div>
                                        {isOver && (
                                            <div className="mt-1 text-2xs text-red-500 flex items-center gap-1 font-medium">
                                                ⚠️ 예산 초과! (+{(spent - limit).toLocaleString()}원)
                                            </div>
                                        )}
                                    </>
                                )}

                                {!isEditMode && limit === 0 && (
                                    <div className="text-2xs text-muted-foreground font-mono">
                                        예산 미설정 | 지출: {spent.toLocaleString()}원
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {isEditMode && (
                    <div className="mt-4 flex gap-2">
                        <button
                            onClick={() => {
                                setIsEditMode(false);
                                loadBudgets();
                            }}
                            className="flex-1 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        >
                            취소
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BudgetManagementSection;
