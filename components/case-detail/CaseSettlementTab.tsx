import React from 'react';
import { Plus, X } from 'lucide-react';
import { SmartInput } from '../ui/SmartInput';
import { Case } from '../../types';

interface CaseSettlementTabProps {
    c: Case;
    commission: number;
    onUpdate: (field: string, value: any) => void;
}

export const CaseSettlementTab: React.FC<CaseSettlementTabProps> = ({
    c,
    commission,
    onUpdate
}) => {
    return (
        <div className="space-y-6">
            <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                <h3 className="font-bold text-green-800 mb-4 text-lg">계약 및 수임료</h3>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-green-900 mb-1">계약완료일 (정산기준)</label>
                            <input
                                type="date"
                                className="w-full p-2 border border-green-300 rounded"
                                value={c.contractAt || ''}
                                onChange={e => onUpdate('contractAt', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-green-900 mb-1 flex items-center justify-between">
                                분납 개월
                                <label className="flex items-center gap-1 cursor-pointer text-blue-600 bg-white px-2 py-0.5 rounded border border-blue-100">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox h-3 w-3"
                                        checked={c.useCapital || false}
                                        onChange={e => onUpdate('useCapital', e.target.checked)}
                                    />
                                    <span className="text-xs">캐피탈 사용</span>
                                </label>
                            </label>
                            <select
                                className="w-full p-2 border border-green-300 rounded bg-white"
                                value={c.installmentMonths || ''}
                                onChange={e => onUpdate('installmentMonths', e.target.value)}
                            >
                                <option value="">선택</option>
                                {!c.useCapital && <option value="완납">완납</option>}
                                {Array.from({ length: 8 }, (_, i) => i + 1).map(num => (
                                    (c.useCapital || num >= 2) ? (
                                        <option key={num} value={`${num} 개월`}>{num}개월</option>
                                    ) : null
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-green-900 mb-1">총 수임료 (만원)</label>
                        <SmartInput
                            type="number"
                            value={c.contractFee || 0}
                            onChange={(v: any) => onUpdate('contractFee', Number(v))}
                            updateOnBlur={true}
                            className="text-lg font-bold"
                            placeholder="0"
                        />

                        <div className="mt-4 pt-4 border-t border-green-200 flex justify-between items-center">
                            <span className="text-sm text-green-700 font-medium">예상 수당 (Commission):</span>
                            <span className="text-xl font-bold text-green-900">{commission.toLocaleString()}만원</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-700 text-lg">입금 내역</h3>
                    <button
                        onClick={() => {
                            const currentHistory = (c.depositHistory && c.depositHistory.length > 0)
                                ? c.depositHistory
                                : [
                                    { date: c.deposit1Date || '', amount: c.deposit1Amount || 0 },
                                    { date: c.deposit2Date || '', amount: c.deposit2Amount || 0 }
                                ];
                            const newHistory = [...currentHistory, { date: '', amount: 0 }];
                            onUpdate('depositHistory', newHistory);
                        }}
                        className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm"
                    >
                        <Plus size={16} /> 추가 ({(c.depositHistory?.length || 2) + 1}차)
                    </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    {/* Use depositHistory if available, else fallback to 1st/2nd legacy fields visually (but mapped) */}
                    {((c.depositHistory && c.depositHistory.length > 0) ? c.depositHistory : [
                        { date: c.deposit1Date || '', amount: c.deposit1Amount || 0 }, // 1차
                        { date: c.deposit2Date || '', amount: c.deposit2Amount || 0 }  // 2차
                    ]).map((deposit, idx) => (
                        <div key={idx} className="bg-white p-4 rounded border border-gray-200 shadow-sm relative group">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-gray-600 text-sm">{idx + 1}차 입금</h4>
                                {idx >= 2 && (
                                    <button
                                        onClick={() => {
                                            const current = c.depositHistory || [];
                                            const newHistory = current.filter((_, i) => i !== idx);
                                            onUpdate('depositHistory', newHistory);
                                        }}
                                        className="text-gray-400 hover:text-red-500"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">금액 (만원)</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border border-gray-300 rounded text-sm font-bold"
                                        value={deposit.amount || ''}
                                        onChange={e => {
                                            const currentHistory = (c.depositHistory && c.depositHistory.length > 0) ? [...c.depositHistory] : [
                                                { date: c.deposit1Date || '', amount: c.deposit1Amount || 0 },
                                                { date: c.deposit2Date || '', amount: c.deposit2Amount || 0 }
                                            ];
                                            currentHistory[idx].amount = Number(e.target.value);
                                            onUpdate('depositHistory', currentHistory);
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">입금일</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        value={deposit.date || ''}
                                        onChange={e => {
                                            const currentHistory = (c.depositHistory && c.depositHistory.length > 0) ? [...c.depositHistory] : [
                                                { date: c.deposit1Date || '', amount: c.deposit1Amount || 0 },
                                                { date: c.deposit2Date || '', amount: c.deposit2Amount || 0 }
                                            ];
                                            currentHistory[idx].date = e.target.value;
                                            onUpdate('depositHistory', currentHistory);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center">
                    <span className="font-bold text-gray-700">총 누적 입금액</span>
                    <span className="text-2xl font-bold text-blue-600">
                        {((c.depositHistory && c.depositHistory.length > 0)
                            ? c.depositHistory.reduce((sum, d) => sum + (d.amount || 0), 0)
                            : (c.deposit1Amount || 0) + (c.deposit2Amount || 0)
                        ).toLocaleString()} 만원
                    </span>
                </div>
            </div>
        </div>
    );
};
