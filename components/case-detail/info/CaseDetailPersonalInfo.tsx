import React from 'react';
import { SmartInput } from '../../ui/SmartInput';
import { Select } from '../../ui/Select';
import { Case, CaseStatusLog, Partner } from '../../../types';
import { CASE_TYPES } from '../../../constants';
import { Building, AlertCircle } from 'lucide-react';
import { normalizeBirthYear, safeFormat } from '../../../utils';

interface CaseDetailPersonalInfoProps {
    c: Case;
    partners: Partner[];
    inboundPaths: string[];
    onUpdate: (field: string, value: any) => void;
    statusLogs?: CaseStatusLog[];
}

export const CaseDetailPersonalInfo: React.FC<CaseDetailPersonalInfoProps> = ({
    c,
    partners,
    inboundPaths,
    onUpdate
}) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-blue-200/90 dark:border-blue-900/60 shadow-xs overflow-hidden">
            {/* 1. 블루 컬러 헤더 밴드 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50/40 dark:from-blue-950/50 dark:to-indigo-950/30 px-4 py-2.5 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                        1
                    </span>
                    <h3 className="font-extrabold text-gray-900 dark:text-gray-100 text-sm">
                        기본 인적사항 및 접수
                    </h3>
                </div>
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-900/50 px-2 py-0.5 rounded">
                    접수: {c.createdAt ? safeFormat(c.createdAt, 'yy.MM.dd') : '-'}
                </span>
            </div>

            {/* 카드 본문 */}
            <div className="p-4 space-y-3.5">
                {/* 거래처 & 유입경로 (2열) */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">
                            거래처 (법률사무소)
                        </label>
                        <div className="relative">
                            <select
                                className={`w-full pl-8 pr-2.5 py-2 border rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 ${
                                    !partners.find(p => p.partnerId === c.partnerId) 
                                        ? 'border-red-400 bg-red-50 text-red-900' 
                                        : 'border-blue-200 bg-blue-50/50 text-blue-950 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                                }`}
                                value={c.partnerId}
                                onChange={e => onUpdate('partnerId', e.target.value)}
                            >
                                <option value="">거래처를 선택하세요</option>
                                {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                            </select>
                            <Building className="absolute left-2.5 top-2.5 text-blue-500" size={15} />
                        </div>
                        {!partners.find(p => p.partnerId === c.partnerId) && c.partnerId && (
                            <p className="text-xs text-red-500 mt-1">⚠️ 등록되지 않은 거래처({c.partnerId})입니다.</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">
                            유입 경로
                        </label>
                        <select
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={c.inboundPath}
                            onChange={e => onUpdate('inboundPath', e.target.value)}
                        >
                            <option value="">선택하세요</option>
                            {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>

                {/* 사전 고객 정보 (리드 수집 정보) */}
                <div>
                    <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5 flex items-center gap-1">
                        <AlertCircle size={13} className="text-blue-500" />
                        <span>사전 고객 정보 (웹 리드 수집)</span>
                    </label>
                    <div className={"w-full p-2.5 border rounded-xl text-xs min-h-[38px] " + (!c.preInfo ? 'border-gray-200 bg-gray-50 dark:bg-gray-900/30 text-gray-400' : 'border-indigo-100 bg-indigo-50/60 dark:bg-indigo-950/30 dark:border-indigo-900/40 text-gray-800 dark:text-gray-200')}>
                        {c.preInfo ? c.preInfo.split(/\s\/\s|\n/).filter((line: string) => {
                            const lower = line.toLowerCase();
                            return !lower.includes('[referrer]') &&
                                !lower.includes('[marketing_consent]') &&
                                !lower.includes('[third_party_consent]') &&
                                !lower.includes('[user_agent]') &&
                                line.trim() !== '';
                        }).map((line: string, idx: number) => {
                            const trimmed = line.trim();
                            const colonIdx = trimmed.indexOf(':');
                            if (colonIdx > 0 && colonIdx < trimmed.length - 1) {
                                const label = trimmed.substring(0, colonIdx).trim();
                                const value = trimmed.substring(colonIdx + 1).trim();
                                return (
                                    <div key={idx} className="flex items-start gap-1 py-0.5">
                                        <span className="text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap">{label}:</span>
                                        <span>{value}</span>
                                    </div>
                                );
                            }
                            return (
                                <div key={idx} className="flex items-start gap-1 py-0.5">
                                    <span className="text-blue-500 font-bold">•</span>
                                    <span>{trimmed}</span>
                                </div>
                            );
                        }) : <span className="text-gray-400 italic">사전 정보 없음</span>}
                    </div>
                </div>

                {/* 최초 등록일시 & 사건 유형 (2열) */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">
                            최초 등록일시
                        </label>
                        <input
                            type="text"
                            value={c.createdAt ? safeFormat(c.createdAt, 'yyyy-MM-dd HH:mm') : '-'}
                            readOnly
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 font-mono outline-none cursor-default"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">
                            사건 유형
                        </label>
                        <div className="grid grid-cols-4 gap-1">
                            {CASE_TYPES.map(opt => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => onUpdate('caseType', opt)}
                                    className={`py-1.5 text-xs rounded-lg font-bold transition-all border ${
                                        c.caseType === opt
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    {opt === '새출발기금' ? '새출발' : opt}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 이름 & 연락처 (2열) */}
                <div className="grid grid-cols-2 gap-3">
                    <SmartInput 
                        label="이름" 
                        value={c.customerName} 
                        onChange={(v: any) => onUpdate('customerName', v)} 
                        updateOnBlur={true} 
                    />
                    <SmartInput
                        label="연락처"
                        value={c.phone}
                        onChange={(v: any) => onUpdate('phone', v)}
                        placeholder="010-0000-0000"
                        isPhone={true}
                        updateOnBlur={true}
                    />
                </div>

                {/* 출생년도 & 성별 (2열) */}
                <div className="grid grid-cols-2 gap-3">
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
                    <div>
                        <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">
                            성별
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {['남', '여'].map(g => (
                                <button
                                    key={g}
                                    type="button"
                                    onClick={() => onUpdate('gender', g)}
                                    className={`py-2 text-xs rounded-lg font-bold transition-all border ${
                                        c.gender === g
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
