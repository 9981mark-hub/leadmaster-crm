import React from 'react';
import { SmartInput } from '../../ui/SmartInput';
import { Select } from '../../ui/Select';
import { Case } from '../../../types';
import { JOB_TYPES } from '../../../constants';

interface CaseDetailJobFamilyProps {
    c: Case;
    onUpdate: (field: string, value: any) => void;
    onIncomeChange: (field: string, value: any) => void;
    onJobTypeChange: (value: any) => void;
}

export const CaseDetailJobFamily: React.FC<CaseDetailJobFamilyProps> = ({
    c,
    onUpdate,
    onIncomeChange,
    onJobTypeChange
}) => {
    return (
        <div>
            <h3 className="font-bold text-gray-700 border-b pb-2 mb-4">직업 / 가족</h3>
            <Select label="직업 (복수선택 가능)" value={c.jobTypes} onChange={onJobTypeChange} options={JOB_TYPES} isMulti={true} />

            {c.jobTypes?.includes('직장인') &&
                <SmartInput label="직장인 월수입(만원)" type="number" value={c.incomeDetails.salary} onChange={(v: any) => onIncomeChange('salary', v)} isCurrency={true} updateOnBlur={true} />
            }
            {(c.jobTypes?.includes('개인사업자') || c.jobTypes?.includes('법인사업자')) &&
                <SmartInput label="사업자 월수입(만원)" type="number" value={c.incomeDetails.business} onChange={(v: any) => onIncomeChange('business', v)} isCurrency={true} updateOnBlur={true} />
            }
            {c.jobTypes?.includes('프리랜서') &&
                <SmartInput label="프리랜서 월수입(만원)" type="number" value={c.incomeDetails.freelance} onChange={(v: any) => onIncomeChange('freelance', v)} isCurrency={true} updateOnBlur={true} />
            }

            <Select label="4대보험" value={c.insurance4} onChange={(v: any) => onUpdate('insurance4', v)} options={['가입', '미가입']} />
            <Select label="결혼여부" value={c.maritalStatus} onChange={(v: any) => onUpdate('maritalStatus', v)} options={['미혼', '기혼', '이혼']} />

            {c.maritalStatus !== '미혼' && (
                <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">미성년 자녀 수</label>
                    <div className="flex gap-2 flex-wrap">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                            <button
                                key={num}
                                type="button"
                                onClick={() => onUpdate('childrenCount', num)}
                                className={"px-3 py-1.5 text-xs rounded border " + (c.childrenCount === num ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50')}
                            >
                                {num}명
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
