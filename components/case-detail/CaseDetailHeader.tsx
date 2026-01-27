import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Case, CaseStatus, Partner } from '../../types';
import { getCaseWarnings } from '../../utils';
import { STATUS_COLOR_MAP } from '../../constants';

interface CaseDetailHeaderProps {
    c: Case;
    partner: Partner | undefined;
    statuses: CaseStatus[];
    secondaryStatuses: string[];
    onStatusChangeStart: (status: CaseStatus) => void;
    onSecondaryStatusChangeStart: (status: string | null) => void;
}

export const CaseDetailHeader: React.FC<CaseDetailHeaderProps> = ({
    c,
    partner,
    statuses,
    secondaryStatuses,
    onStatusChangeStart,
    onSecondaryStatusChangeStart
}) => {
    const warnings = getCaseWarnings(c, partner);

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 sticky top-0 z-10">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={"px-2 py-0.5 rounded text-xs font-bold text-white whitespace-nowrap " + (['개인회생', '파산'].includes(c.caseType || '') ? 'bg-indigo-500' : 'bg-gray-500')}>
                            {c.caseType}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold border border-gray-200 whitespace-nowrap">
                            {partner?.name || '거래처 미정'}
                        </span>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 whitespace-nowrap">{c.customerName}</h1>
                        <span className="text-gray-500 whitespace-nowrap">{c.phone}</span>
                    </div>
                    {warnings.length > 0 && (
                        <div className="flex gap-2 mt-2">
                            {warnings.map(w => (
                                <span key={w} className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold flex items-center">
                                    <AlertTriangle size={12} className="mr-1" /> {w}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-2">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400 font-medium">1차 상태</label>
                        <select
                            className={"p-2 border border-gray-300 rounded font-semibold outline-none min-w-[140px] " + (STATUS_COLOR_MAP[c.status] || 'bg-blue-50 text-blue-800')}
                            value={c.status}
                            onChange={(e) => onStatusChangeStart(e.target.value as CaseStatus)}
                        >
                            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    {/* 2차 상태 (사무장 접수 이후에만 표시) */}
                    {c.status === '사무장 접수' && (
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-purple-500 font-medium">2차 상태</label>
                            <select
                                className="p-2 border border-purple-300 rounded font-semibold outline-none min-w-[140px] bg-purple-50 text-purple-800"
                                value={c.secondaryStatus || ''}
                                onChange={(e) => onSecondaryStatusChangeStart(e.target.value || null)}
                            >
                                <option value="">선택 안함</option>
                                {secondaryStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
