import React from 'react';
import { Building, AlertCircle } from 'lucide-react';
import { SmartInput } from '../../ui/SmartInput';
import { Case, CaseStatusLog, Partner } from '../../../types';
import { CASE_TYPES } from '../../../constants';
import { normalizeBirthYear, safeFormat } from '../../../utils';
import { SectionCard, Field, Choice, FIELD_GRID, CONTROL, CONTROL_PLAIN } from '../detailUi';

interface CaseDetailPersonalInfoProps {
    c: Case;
    partners: Partner[];
    inboundPaths: string[];
    onUpdate: (field: string, value: any) => void;
    statusLogs?: CaseStatusLog[];
}

// 웹 리드 수집 정보 중 화면에 보이지 않게 하는 기술 정보
const HIDDEN_PRE_INFO = ['[referrer]', '[marketing_consent]', '[third_party_consent]', '[user_agent]'];

/** "채무 금액: 5천만원~1억 / 월 소득: 200~300만원" → [{ k: '채무 금액', v: '5천만원~1억' }, ...] */
const parsePreInfo = (pre?: string): { k: string; v: string }[] =>
    (pre || '')
        .split(/\s\/\s|\n/)
        .map(s => s.trim())
        .filter(line => line && !HIDDEN_PRE_INFO.some(h => line.toLowerCase().includes(h)))
        .map(line => {
            const i = line.indexOf(':');
            return i > 0 && i < line.length - 1 ? { k: line.slice(0, i).trim(), v: line.slice(i + 1).trim() } : { k: '', v: line };
        });

/**
 * 1단계 접수 · 인적사항
 * [2026-11-01] 칸을 답 길이에 맞는 폭으로 (넓은 화면에서 칸 하나가 반쪽 화면만큼 늘어나던 것 정리).
 * 최초 등록일시는 카드 제목 오른쪽(접수 시각)에 이미 있어 칸을 따로 두지 않는다.
 */
export const CaseDetailPersonalInfo: React.FC<CaseDetailPersonalInfoProps> = ({
    c,
    partners,
    inboundPaths,
    onUpdate
}) => {
    const partnerKnown = !!partners.find(p => p.partnerId === c.partnerId);
    const preInfo = parsePreInfo(c.preInfo);
    const partnerId = React.useId();
    const inboundId = React.useId();

    return (
        <SectionCard step={1} title="접수 · 인적사항" meta={`접수 ${c.createdAt ? safeFormat(c.createdAt, 'yy.MM.dd HH:mm') : '-'}`}>
            {/* 사전 고객 정보 (웹 리드 수집): 전화 걸기 전에 읽는 것이라 맨 위에 한 덩어리로 */}
            <div className={`mb-3 rounded-xl border px-3 py-2 text-xs ${preInfo.length
                ? 'border-indigo-100 bg-indigo-50/60 text-slate-800 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-gray-200'
                : 'border-slate-200 bg-slate-50 text-slate-400 dark:bg-gray-900/30 dark:border-gray-700'}`}>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-300 shrink-0">
                        <AlertCircle size={12} aria-hidden /> 사전 고객 정보
                    </span>
                    {preInfo.length > 0 ? preInfo.map((p, i) => (
                        <span key={i} className="inline-flex gap-1 min-w-0">
                            {p.k && <span className="font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">{p.k}:</span>}
                            <span className="break-words">{p.v}</span>
                        </span>
                    )) : <span>없음 (웹 리드 수집 정보가 없는 리드)</span>}
                </div>
            </div>

            <div className={FIELD_GRID}>
                <Field label="거래처 (법률사무소)" htmlFor={partnerId} className="col-span-2">
                    <div className="relative">
                        <select
                            id={partnerId}
                            className={`${CONTROL} pl-8 font-semibold ${partnerKnown
                                ? 'border-blue-200 bg-blue-50/50 text-blue-950 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                                : 'border-red-400 bg-red-50 text-red-900'}`}
                            value={c.partnerId}
                            onChange={e => onUpdate('partnerId', e.target.value)}
                        >
                            <option value="">거래처를 선택하세요</option>
                            {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                        </select>
                        <Building className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" size={15} aria-hidden />
                    </div>
                    {!partnerKnown && c.partnerId && (
                        <p className="text-xs text-red-500 mt-1">⚠️ 등록되지 않은 거래처({c.partnerId})입니다.</p>
                    )}
                </Field>

                <Field label="유입 경로" htmlFor={inboundId}>
                    <select
                        id={inboundId}
                        className={CONTROL_PLAIN}
                        value={c.inboundPath}
                        onChange={e => onUpdate('inboundPath', e.target.value)}
                    >
                        <option value="">선택하세요</option>
                        {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </Field>

                <Choice
                    label="사건 유형"
                    className="col-span-2"
                    options={CASE_TYPES}
                    value={c.caseType}
                    onPick={v => onUpdate('caseType', v)}
                    render={o => (o === '새출발기금' ? '새출발' : o)}
                />

                <SmartInput
                    compact
                    label="이름"
                    value={c.customerName}
                    onChange={(v: any) => onUpdate('customerName', v)}
                    updateOnBlur={true}
                />
                <SmartInput
                    compact
                    label="연락처"
                    value={c.phone}
                    onChange={(v: any) => onUpdate('phone', v)}
                    placeholder="010-0000-0000"
                    isPhone={true}
                    updateOnBlur={true}
                />
                <SmartInput
                    compact
                    label="출생년도 (2자리)"
                    value={c.birth}
                    // [2026-11-01] 저장할 때 바로 4자리로 (예전엔 한 번 늦게 바뀌었다)
                    onChange={(v: any) => onUpdate('birth', normalizeBirthYear(String(v ?? '')))}
                    placeholder="예: 77"
                    suffix={c.birth?.length === 4 ? '년생' : ''}
                    updateOnBlur={true}
                    needed
                />
                <Choice
                    label="성별"
                    options={['남', '여']}
                    value={c.gender}
                    onPick={v => onUpdate('gender', v)}
                />
            </div>
        </SectionCard>
    );
};
