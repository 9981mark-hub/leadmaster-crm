import React from 'react';
import { SmartInput } from '../../ui/SmartInput';
import { Select } from '../../ui/Select';
import { Case, CaseStatusLog } from '../../../types';
import { JOB_TYPES } from '../../../constants';

interface CaseDetailJobFamilyProps {
    c: Case;
    onUpdate: (field: string, value: any) => void;
    onIncomeChange: (field: string, value: any) => void;
    onJobTypeChange: (value: any) => void;
    statusLogs?: CaseStatusLog[];
}

export const CaseDetailJobFamily: React.FC<CaseDetailJobFamilyProps> = ({
    c,
    onUpdate,
    onIncomeChange,
    onJobTypeChange
}) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-gray-100 text-sm">직업 · 소득 · 가족</h3>
                {c.incomeNet > 0 && (
                    <span className="text-[11px] text-slate-500 tabular-nums">월 소득 {c.incomeNet.toLocaleString()}만원</span>
                )}
            </div>

            {/* 카드 본문 */}
            <div className="p-4 space-y-3.5">
                {/* 직업 형태 (복수선택) */}
                <div>
                    <Select 
                        label="직업 형태 (복수선택 가능)" 
                        value={c.jobTypes} 
                        onChange={onJobTypeChange} 
                        options={JOB_TYPES} 
                        isMulti={true} 
                    />
                </div>

                {/* 조건부 직업별 수입 인풋 */}
                {(c.jobTypes?.includes('직장인') || c.jobTypes?.includes('개인사업자') || c.jobTypes?.includes('법인사업자') || c.jobTypes?.includes('프리랜서')) && (
                    <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl space-y-2.5">
                        {c.jobTypes?.includes('직장인') && (
                            <SmartInput 
                                label="직장인 월수입" 
                                type="number" 
                                value={c.incomeDetails.salary} 
                                onChange={(v: any) => onIncomeChange('salary', v)} 
                                suffix="만원"
                                isCurrency={true} 
                                updateOnBlur={true} 
                            />
                        )}
                        {(c.jobTypes?.includes('개인사업자') || c.jobTypes?.includes('법인사업자')) && (
                            <SmartInput 
                                label="사업자 월수입" 
                                type="number" 
                                value={c.incomeDetails.business} 
                                onChange={(v: any) => onIncomeChange('business', v)} 
                                suffix="만원"
                                isCurrency={true} 
                                updateOnBlur={true} 
                            />
                        )}
                        {c.jobTypes?.includes('프리랜서') && (
                            <SmartInput 
                                label="프리랜서 월수입" 
                                type="number" 
                                value={c.incomeDetails.freelance} 
                                onChange={(v: any) => onIncomeChange('freelance', v)} 
                                suffix="만원"
                                isCurrency={true} 
                                updateOnBlur={true} 
                            />
                        )}
                    </div>
                )}

                {/* 4대보험 & 결혼여부 (2열) */}
                <div className="grid grid-cols-2 gap-3">
                    <Select 
                        label="4대보험" 
                        value={c.insurance4} 
                        onChange={(v: any) => onUpdate('insurance4', v)} 
                        options={['가입', '미가입']} 
                    />
                    <Select 
                        label="결혼여부" 
                        value={c.maritalStatus} 
                        onChange={(v: any) => onUpdate('maritalStatus', v)} 
                        options={['미혼', '기혼', '이혼']} 
                    />
                </div>

                {/* 미성년 자녀 수 (기혼/이혼 시) */}
                {c.maritalStatus !== '미혼' && (
                    <div>
                        <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">
                            미성년 자녀 수
                        </label>
                        <div className="flex gap-1 flex-wrap">
                            {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => onUpdate('childrenCount', num)}
                                    className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all border ${
                                        c.childrenCount === num 
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {num}명
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
