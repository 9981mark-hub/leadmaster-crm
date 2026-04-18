import React from 'react';
import { SmartInput } from '../../ui/SmartInput';
import { Select } from '../../ui/Select';
import { Case, CaseStatusLog } from '../../../types';
import { JOB_TYPES } from '../../../constants';
import { format } from 'date-fns';
import { CalendarClock } from 'lucide-react';

interface CaseDetailJobFamilyProps {
    c: Case;
    onUpdate: (field: string, value: any) => void;
    onIncomeChange: (field: string, value: any) => void;
    onJobTypeChange: (value: any) => void;
    statusLogs: CaseStatusLog[];
}

export const CaseDetailJobFamily: React.FC<CaseDetailJobFamilyProps> = ({
    c,
    onUpdate,
    onIncomeChange,
    onJobTypeChange,
    statusLogs
}) => {
    return (
        <div>
            {/* Status History Section */}
            {statusLogs.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                    <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                        <CalendarClock size={16} /> 상태 변경 이력
                    </h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {statusLogs.map(log => (
                            <div key={log.logId} className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm text-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-400 line-through text-xs px-2 py-0.5 bg-gray-100 rounded">{log.fromStatus}</span>
                                        <span className="text-gray-400">→</span>
                                        <span className="font-bold text-blue-600 text-xs px-2 py-0.5 bg-blue-50 rounded border border-blue-100">{log.toStatus}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-400">{format(new Date(log.changedAt), 'yy.MM.dd HH:mm')}</span>
                                </div>
                                {log.memo && (
                                    <div className="mt-2 text-gray-600 bg-gray-50 p-2 rounded text-xs leading-relaxed">
                                        {log.memo}
                                    </div>
                                )}
                                <div className="mt-1 text-right">
                                    <span className="text-[10px] text-gray-400">Changed by {log.changedBy}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
