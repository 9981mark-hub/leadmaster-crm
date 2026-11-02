import React from 'react';
import { SmartInput } from '../../ui/SmartInput';
import { Case, CaseStatusLog } from '../../../types';
import { JOB_TYPES } from '../../../constants';
import { SectionCard, Choice, FIELD_GRID } from '../detailUi';

interface CaseDetailJobFamilyProps {
    c: Case;
    onUpdate: (field: string, value: any) => void;
    onIncomeChange: (field: string, value: any) => void;
    onJobTypeChange: (value: any) => void;
    statusLogs?: CaseStatusLog[];
}

const CHILDREN_BASE = [0, 1, 2, 3];
const CHILDREN_MORE = [0, 1, 2, 3, 4, 5];
/** 직장 소재지를 받는 직업 */
const WORKPLACE_JOBS = ['직장인', '프리랜서'];
/** 사업장 소재지를 받는 직업 */
const BUSINESS_JOBS = ['개인사업자', '법인사업자'];

/** 2단계 직업 · 소득 · 가족 (직업을 고르면 그 직업의 월수입 칸이 바로 옆에 생긴다) */
export const CaseDetailJobFamily: React.FC<CaseDetailJobFamilyProps> = ({
    c,
    onUpdate,
    onIncomeChange,
    onJobTypeChange
}) => {
    const jobs = c.jobTypes || [];
    const income = c.incomeDetails || ({} as Case['incomeDetails']);
    const [moreKids, setMoreKids] = React.useState(false);
    // 이미 4명 이상으로 저장된 리드는 처음부터 펼쳐 보여줌 (예전 6·7명 값도 그대로 보이게)
    const showMoreKids = moreKids || (c.childrenCount || 0) > 3;
    return (
        <SectionCard step={2} title="직업 · 소득 · 가족" meta={c.incomeNet > 0 ? `월 소득 ${c.incomeNet.toLocaleString()}만원` : undefined}>
            <div className={FIELD_GRID}>
                <Choice
                    label="직업 형태 (복수 선택)"
                    className="col-span-full"
                    options={JOB_TYPES}
                    value={jobs}
                    onPick={onJobTypeChange}
                    multi
                />

                {jobs.includes('직장인') && (
                    <SmartInput
                        compact
                        label="직장인 월수입"
                        className="md:max-w-[9.5rem]"
                        type="number"
                        value={income?.salary}
                        onChange={(v: any) => onIncomeChange('salary', v)}
                        suffix="만원"
                        isCurrency={true}
                        updateOnBlur={true}
                    />
                )}
                {(jobs.includes('개인사업자') || jobs.includes('법인사업자')) && (
                    <SmartInput
                        compact
                        label="사업자 월수입"
                        className="md:max-w-[9.5rem]"
                        type="number"
                        value={income?.business}
                        onChange={(v: any) => onIncomeChange('business', v)}
                        suffix="만원"
                        isCurrency={true}
                        updateOnBlur={true}
                    />
                )}
                {jobs.includes('프리랜서') && (
                    <SmartInput
                        compact
                        label="프리랜서 월수입"
                        className="md:max-w-[9.5rem]"
                        type="number"
                        value={income?.freelance}
                        onChange={(v: any) => onIncomeChange('freelance', v)}
                        suffix="만원"
                        isCurrency={true}
                        updateOnBlur={true}
                    />
                )}
                {/* 2026-11-02 소재지 (income_details에 저장, DB 변경 없음)
                    직장 소재지 = 직장인·프리랜서 (workplace) / 사업장 소재지 = 개인사업자·법인사업자 (businessPlace) */}
                {jobs.some(j => WORKPLACE_JOBS.includes(j)) && (
                    <SmartInput
                        compact
                        label="직장 소재지"
                        value={income?.workplace || ''}
                        onChange={(v: any) => onUpdate('incomeDetails', { ...income, workplace: String(v || '').trim() })}
                        placeholder="예: 서울 강남구"
                        updateOnBlur={true}
                    />
                )}
                {jobs.some(j => BUSINESS_JOBS.includes(j)) && (
                    <SmartInput
                        compact
                        label="사업장 소재지"
                        value={income?.businessPlace || ''}
                        onChange={(v: any) => onUpdate('incomeDetails', { ...income, businessPlace: String(v || '').trim() })}
                        placeholder="예: 서울 강남구"
                        updateOnBlur={true}
                    />
                )}

                <Choice
                    label="4대보험"
                    options={['가입', '미가입']}
                    value={c.insurance4}
                    onPick={v => onUpdate('insurance4', v)}
                />
                {/* 결혼여부 + 미성년 자녀 수 한 줄 (좁으면 다음 줄로) */}
                <div className="col-span-full flex flex-wrap items-start gap-x-6 gap-y-3">
                    <Choice
                        label="결혼여부"
                        options={['미혼', '기혼', '사실혼', '이혼', '사별']}
                        value={c.maritalStatus}
                        onPick={v => onUpdate('maritalStatus', v)}
                    />
                    {/* 미성년 자녀 수 (미혼이 아닐 때): 0~3명, + 누르면 5명까지 */}
                    {c.maritalStatus !== '미혼' && (
                        <div className="min-w-0">
                            <div className="flex items-end gap-1">
                                <Choice
                                    label="미성년 자녀 수 (명)"
                                    options={showMoreKids ? CHILDREN_MORE : CHILDREN_BASE}
                                    value={c.childrenCount}
                                    onPick={v => onUpdate('childrenCount', v)}
                                    tone="emerald"
                                    fill={false}
                                    buttonClassName="w-9 px-0 tabular-nums"
                                />
                                {!showMoreKids && (
                                    <button type="button" onClick={() => setMoreKids(true)} title="4~5명"
                                        className="h-9 w-9 rounded-lg border border-dashed border-slate-300 dark:border-gray-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-gray-700 text-sm font-bold">+</button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </SectionCard>
    );
};
