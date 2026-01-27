import React from 'react';
import { SmartInput } from '../../ui/SmartInput';
import { Select } from '../../ui/Select';
import { Case, CaseStatusLog, Partner } from '../../../types';
import { CASE_TYPES } from '../../../constants';
import { format } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import { normalizeBirthYear } from '../../../utils';

interface CaseDetailPersonalInfoProps {
    c: Case;
    partners: Partner[];
    inboundPaths: string[];
    onUpdate: (field: string, value: any) => void;
    statusLogs: CaseStatusLog[];
}

export const CaseDetailPersonalInfo: React.FC<CaseDetailPersonalInfoProps> = ({
    c,
    partners,
    inboundPaths,
    onUpdate,
    statusLogs
}) => {
    return (
        <div>
            <h3 className="font-bold text-gray-700 border-b pb-2 mb-4">기본 정보</h3>

            {/* Partner & Inbound PathRow */}
            <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">거래처 (법률사무소)</label>
                    <select
                        className="w-full p-2 border border-gray-300 rounded text-sm bg-gray-50"
                        value={c.partnerId}
                        onChange={e => onUpdate('partnerId', e.target.value)}
                    >
                        {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">유입 경로</label>
                    <select
                        className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        value={c.inboundPath}
                        onChange={e => onUpdate('inboundPath', e.target.value)}
                    >
                        <option value="">선택하세요</option>
                        {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">사전 고객 정보 (리드 수집 정보)</label>
                <div className={"w-full p-2 border border-gray-200 rounded text-sm bg-gray-50 min-h-[40px] " + (!c.preInfo ? 'text-gray-400' : 'text-gray-800')}>
                    {c.preInfo ? c.preInfo.split(/\s\/\s|\n/).filter((line: string) => {
                        const lower = line.toLowerCase();
                        return !lower.includes('[referrer]') &&
                            !lower.includes('[marketing_consent]') &&
                            !lower.includes('[third_party_consent]') &&
                            !lower.includes('[user_agent]') &&
                            line.trim() !== '';
                    }).map((line: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-1">
                            <span className="text-blue-500 font-bold">*</span>
                            <span>{line.trim()}</span>
                        </div>
                    )) : <span className="text-gray-400 italic">사전 정보 없음</span>}
                </div>
            </div>

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

            <SmartInput
                label="최초 등록일시"
                value={c.createdAt ? format(new Date(c.createdAt), 'yyyy-MM-dd HH:mm') : '-'}
                readOnly={true}
                onChange={() => { }}
            />
            <div className="mb-4">
                <Select label="사건 유형" value={c.caseType} onChange={(v: any) => onUpdate('caseType', v)} options={CASE_TYPES} />
            </div>

            <SmartInput label="이름" value={c.customerName} onChange={(v: any) => onUpdate('customerName', v)} updateOnBlur={true} />
            <SmartInput
                label="연락처"
                value={c.phone}
                onChange={(v: any) => onUpdate('phone', v)}
                placeholder="010-0000-0000"
                isPhone={true}
                updateOnBlur={true}
            />
            <div className="grid grid-cols-2 gap-2">
                <SmartInput
                    label="출생년도 (2자리)"
                    value={c.birth}
                    onChange={(v: any) => onUpdate('birth', v)}
                    onBlur={() => {
                        const normalized = normalizeBirthYear(c.birth);
                        if (normalized !== c.birth) onUpdate('birth', normalized);
                    }}
                    placeholder="예: 77"
                    suffix={c.birth?.length === 4 ? "년생" : ""}
                    updateOnBlur={true}
                />
                <Select label="성별" value={c.gender} onChange={(v: any) => onUpdate('gender', v)} options={['남', '여']} />
            </div>
        </div>
    );
};
