import React, { useState, useEffect } from 'react';
import { fetchExpenses, EXPENSE_CATEGORIES } from '../services/api';
import { ExpenseCategory } from '../types';

interface Budget {
    id: string;
    category: ExpenseCategory;
    monthlyLimit: number;
    year: number;
    month: number;
}

interface BudgetManagementSectionProps {
    year: number;
    month: number;
}

const BUDGET_KEY = 'lm_budgets';

const BudgetManagementSection: React.FC<BudgetManagementSectionProps> = ({ year, month }) => {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [spending, setSpending] = useState<Record<ExpenseCategory, number>>({} as any);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editBudgets, setEditBudgets] = useState<Record<ExpenseCategory, number>>({} as any);

    // 예산 로드
    const loadBudgets = () => {
        try {
            const stored = localStorage.getItem(BUDGET_KEY);
            if (stored) {
                const all: Budget[] = JSON.parse(stored);
                const current = all.filter(b => b.year === year && b.month === month);
                setBudgets(current);

                const edit: Record<ExpenseCategory, number> = {} as any;
                current.forEach(b => {
                    edit[b.category] = b.monthlyLimit;
                });
                setEditBudgets(edit);
            }
        } catch (e) {
            console.error('Failed to load budgets:', e);
        }
    };

    // 예산 저장
    const saveBudgets = () => {
        try {
            const stored = localStorage.getItem(BUDGET_KEY);
            let all: Budget[] = stored ? JSON.parse(stored) : [];

            // 현재 년/월의 기존 예산 제거
            all = all.filter(b => !(b.year === year && b.month === month));

            // 새 예산 추가
            (Object.entries(editBudgets) as [ExpenseCategory, number][]).forEach(([cat, limit]) => {
                if (limit > 0) {
                    all.push({
                        id: `${year}-${month}-${cat}`,
                        category: cat,
                        monthlyLimit: limit,
                        year,
                        month
                    });
                }
            });

            localStorage.setItem(BUDGET_KEY, JSON.stringify(all));
            loadBudgets();
            setIsEditMode(false);
        } catch (e) {
            console.error('Failed to save budgets:', e);
        }
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
        loadBudgets();
        loadSpending();
    }, [year, month]);

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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-indigo-100 dark:border-gray-700 overflow-hidden">
            <div className="p-3 md:p-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                        <h3 className="font-bold text-indigo-700 flex items-center gap-2 text-sm md:text-base">
                            💰 예산 관리
                        </h3>
                        <p className="text-xs text-indigo-500 mt-0.5">{year}년 {month}월 카테고리별 예산</p>
                    </div>
                    <button
                        onClick={() => isEditMode ? saveBudgets() : setIsEditMode(true)}
                        className={`px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-lg ${isEditMode
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                    >
                        {isEditMode ? '저장' : '예산 설정'}
                    </button>
                </div>
            </div>

            <div className="p-3 md:p-4">
                {/* 전체 요약 */}
                <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-indigo-100 to-blue-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-indigo-700 font-medium">전체 예산 사용률</span>
                        <span className={`text-lg font-bold ${totalUsage > 100 ? 'text-red-600' : totalUsage > 80 ? 'text-amber-600' : 'text-indigo-700'}`}>
                            {totalUsage}%
                        </span>
                    </div>
                    <div className="w-full bg-white rounded-full h-3">
                        <div
                            className={`h-3 rounded-full transition-all ${totalUsage > 100 ? 'bg-red-500' : totalUsage > 80 ? 'bg-amber-500' : 'bg-indigo-500'
                                }`}
                            style={{ width: `${Math.min(totalUsage, 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-indigo-600">
                        <span>사용: {totalSpending.toLocaleString()}원</span>
                        <span>예산: {totalBudget.toLocaleString()}원</span>
                    </div>
                </div>

                {/* 카테고리별 예산 */}
                <div className="space-y-3">
                    {EXPENSE_CATEGORIES.map(category => {
                        const budget = budgets.find(b => b.category === category);
                        const spent = spending[category] || 0;
                        const limit = budget?.monthlyLimit || 0;
                        const usage = limit > 0 ? Math.round(spent / limit * 100) : 0;
                        const isOver = usage > 100;
                        const isWarning = usage > 80;

                        return (
                            <div key={category} className="border border-gray-100 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{category}</span>
                                    {isEditMode ? (
                                        <input
                                            type="number"
                                            value={editBudgets[category] || ''}
                                            onChange={e => setEditBudgets(prev => ({
                                                ...prev,
                                                [category]: parseInt(e.target.value) || 0
                                            }))}
                                            className="w-32 text-right border border-gray-300 rounded px-2 py-1 text-sm"
                                            placeholder="예산 (원)"
                                        />
                                    ) : (
                                        <span className={`text-sm font-bold ${isOver ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-gray-700'}`}>
                                            {limit > 0 ? `${usage}%` : '-'}
                                        </span>
                                    )}
                                </div>

                                {!isEditMode && limit > 0 && (
                                    <>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all ${isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-indigo-500'
                                                    }`}
                                                style={{ width: `${Math.min(usage, 100)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between mt-1 text-xs text-gray-500">
                                            <span>{spent.toLocaleString()}원</span>
                                            <span>{limit.toLocaleString()}원</span>
                                        </div>
                                        {isOver && (
                                            <div className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                ⚠️ 예산 초과! (+{(spent - limit).toLocaleString()}원)
                                            </div>
                                        )}
                                    </>
                                )}

                                {!isEditMode && limit === 0 && (
                                    <div className="text-xs text-gray-400">
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
                            className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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
