import React, { useState, useEffect } from 'react';
import { createExpense, EXPENSE_CATEGORIES } from '../services/api';
import { ExpenseCategory } from '../types';

interface FixedCost {
    id: string;
    name: string;
    amount: number;
    category: ExpenseCategory;
    dueDay: number; // 매월 결제일 (1-31)
    description: string;
    isActive: boolean;
    createdAt: string;
}

interface FixedCostSectionProps {
    year: number;
    month: number;
    onExpenseCreated?: () => void;
}

const FIXED_COST_KEY = 'lm_fixed_costs';

const FixedCostSection: React.FC<FixedCostSectionProps> = ({ year, month, onExpenseCreated }) => {
    const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        amount: 0,
        category: '사무비용' as ExpenseCategory,
        dueDay: 1,
        description: ''
    });

    // 고정비 로드
    const loadFixedCosts = () => {
        try {
            const stored = localStorage.getItem(FIXED_COST_KEY);
            if (stored) {
                setFixedCosts(JSON.parse(stored));
            }
        } catch (e) {
            console.error('Failed to load fixed costs:', e);
        }
    };

    // 고정비 저장
    const saveFixedCosts = (costs: FixedCost[]) => {
        try {
            localStorage.setItem(FIXED_COST_KEY, JSON.stringify(costs));
            setFixedCosts(costs);
        } catch (e) {
            console.error('Failed to save fixed costs:', e);
        }
    };

    useEffect(() => {
        loadFixedCosts();
    }, []);

    // 고정비 추가
    const handleAdd = () => {
        if (!formData.name || formData.amount <= 0) {
            alert('항목명과 금액을 입력해주세요.');
            return;
        }

        const newCost: FixedCost = {
            id: crypto.randomUUID(),
            name: formData.name,
            amount: formData.amount,
            category: formData.category,
            dueDay: formData.dueDay,
            description: formData.description,
            isActive: true,
            createdAt: new Date().toISOString()
        };

        saveFixedCosts([...fixedCosts, newCost]);
        setIsAddModalOpen(false);
        setFormData({
            name: '',
            amount: 0,
            category: '사무비용',
            dueDay: 1,
            description: ''
        });
    };

    // 고정비 삭제
    const handleDelete = (id: string) => {
        if (confirm('이 고정비를 삭제하시겠습니까?')) {
            saveFixedCosts(fixedCosts.filter(c => c.id !== id));
        }
    };

    // 고정비 활성화/비활성화
    const toggleActive = (id: string) => {
        saveFixedCosts(fixedCosts.map(c =>
            c.id === id ? { ...c, isActive: !c.isActive } : c
        ));
    };

    // 이번 달 지출로 일괄 등록
    const registerAsExpenses = async () => {
        const activeCosts = fixedCosts.filter(c => c.isActive);
        if (activeCosts.length === 0) {
            alert('등록할 활성 고정비가 없습니다.');
            return;
        }

        if (!confirm(`${activeCosts.length}개 고정비를 ${month}월 지출로 등록하시겠습니까?`)) {
            return;
        }

        try {
            for (const cost of activeCosts) {
                const dueDay = Math.min(cost.dueDay, new Date(year, month, 0).getDate());
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;

                await createExpense({
                    date: dateStr,
                    amount: cost.amount,
                    category: cost.category,
                    description: `[고정비] ${cost.name}${cost.description ? ` - ${cost.description}` : ''}`
                });
            }
            alert(`${activeCosts.length}개 고정비가 지출로 등록되었습니다.`);
            onExpenseCreated?.();
        } catch (e) {
            console.error('Failed to register expenses:', e);
            alert('지출 등록 중 오류가 발생했습니다.');
        }
    };

    // 요약 계산
    const totalActive = fixedCosts.filter(c => c.isActive).reduce((sum, c) => sum + c.amount, 0);
    const totalInactive = fixedCosts.filter(c => !c.isActive).reduce((sum, c) => sum + c.amount, 0);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-teal-100 overflow-hidden">
            <div className="p-4 border-b border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-teal-700 flex items-center gap-2">
                            📌 고정비용 관리
                        </h3>
                        <p className="text-xs text-teal-500 mt-1">매월 반복되는 지출 항목</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={registerAsExpenses}
                            className="px-3 py-1.5 bg-teal-100 text-teal-700 text-sm rounded-lg hover:bg-teal-200"
                        >
                            📥 {month}월 지출 등록
                        </button>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="px-3 py-1.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700"
                        >
                            + 고정비 추가
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4">
                {/* 요약 */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-teal-50 p-3 rounded-lg border border-teal-200">
                        <p className="text-xs text-teal-600">월 고정비 (활성)</p>
                        <p className="text-lg font-bold text-teal-700">{totalActive.toLocaleString()}원</p>
                        <p className="text-xs text-teal-500">{fixedCosts.filter(c => c.isActive).length}개 항목</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-600">비활성 항목</p>
                        <p className="text-lg font-bold text-gray-700">{totalInactive.toLocaleString()}원</p>
                        <p className="text-xs text-gray-500">{fixedCosts.filter(c => !c.isActive).length}개 항목</p>
                    </div>
                </div>

                {/* 고정비 목록 */}
                {fixedCosts.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {fixedCosts.map(cost => (
                            <div
                                key={cost.id}
                                className={`flex items-center justify-between p-3 rounded-lg border ${cost.isActive ? 'bg-white border-teal-200' : 'bg-gray-50 border-gray-200 opacity-60'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => toggleActive(cost.id)}
                                        className={`w-5 h-5 rounded border flex items-center justify-center ${cost.isActive
                                                ? 'bg-teal-500 border-teal-500 text-white'
                                                : 'bg-white border-gray-300'
                                            }`}
                                    >
                                        {cost.isActive && '✓'}
                                    </button>
                                    <div>
                                        <p className="font-medium text-gray-800">{cost.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {cost.category} | 매월 {cost.dueDay}일
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="font-bold text-teal-700">{cost.amount.toLocaleString()}원</p>
                                    <button
                                        onClick={() => handleDelete(cost.id)}
                                        className="text-gray-400 hover:text-red-500"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-400">
                        등록된 고정비용이 없습니다.
                    </div>
                )}
            </div>

            {/* 추가 모달 */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-4 border-b bg-gradient-to-r from-teal-50 to-cyan-50">
                            <h3 className="font-bold text-teal-700">📌 고정비 추가</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">항목명 *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="예: 사무실 임대료"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">금액 *</label>
                                <input
                                    type="number"
                                    value={formData.amount || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                                <select
                                    value={formData.category}
                                    onChange={e => setFormData(prev => ({ ...prev, category: e.target.value as ExpenseCategory }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                >
                                    {EXPENSE_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">매월 결제일</label>
                                <select
                                    value={formData.dueDay}
                                    onChange={e => setFormData(prev => ({ ...prev, dueDay: parseInt(e.target.value) }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                >
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                        <option key={day} value={day}>{day}일</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="선택사항"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t flex gap-2">
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleAdd}
                                className="flex-1 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FixedCostSection;
