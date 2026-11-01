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

const CHILDREN_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];

/** 2단계 직업 · 소득 · 가족 (직업을 고르면 그 직업의 월수입 칸이 바로 옆에 생긴다) */
export const CaseDetailJobFamily: React.FC<CaseDetailJobFamilyProps> = ({
    c,
    onUpdate,
    onIncomeChange,
    onJobTypeChange
}) => {
    const jobs = c.jobTypes || [];
    const income = c.incomeDetails || ({} as Case['incomeDetails']);
    return (
        <SectionCard step={2} title="직업 · 소득 · 가족" meta={c.incomeNet > 0 ? `월 소득 ${c.incomeNet.toLocaleString()}만원` : undefined}>
            <div className={FIELD_GRID}>
                <Choice
                    label="직업 형태 (복수 선택)"
                    className="col-span-2"
                    options={JOB_TYPES}
                    value={jobs}
                    onPick={onJobTypeChange}
                    multi
                />

                {jobs.includes('직장인') && (
                    <SmartInput
                        compact
                        label="직장인 월수입"
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
                        type="number"
                        value={income?.freelance}
                        onChange={(v: any) => onIncomeChange('freelance', v)}
                        suffix="만원"
                        isCurrency={true}
                        updateOnBlur={true}
                    />
                )}

                <Choice
                    label="4대보험"
                    options={['가입', '미가입']}
                    value={c.insurance4}
                    onPick={v => onUpdate('insurance4', v)}
                />
                <Choice
                    label="결혼여부"
                    options={['미혼', '기혼', '이혼']}
                    value={c.maritalStatus}
                    onPick={v => onUpdate('maritalStatus', v)}
                />

                {/* 미성년 자녀 수 (기혼/이혼 시) */}
                {c.maritalStatus !== '미혼' && (
                    <Choice
                        label="미성년 자녀 수 (명)"
                        className="col-span-full"
                        options={CHILDREN_OPTIONS}
                        value={c.childrenCount}
                        onPick={v => onUpdate('childrenCount', v)}
                        tone="emerald"
                        buttonClassName="flex-1 basis-0 md:flex-none md:basis-auto w-9 md:w-9 px-0 tabular-nums"
                    />
                )}
            </div>
        </SectionCard>
    );
};
