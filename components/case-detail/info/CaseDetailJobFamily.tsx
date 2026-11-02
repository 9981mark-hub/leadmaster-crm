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
    // [2026-11-02] 모바일: 월수입 칸이 하나뿐이면 이름을 "월수입"으로 줄여 월수입·소재지·4대보험이 한 줄에 들어가게
    const incomeCount = (jobs.includes('직장인') ? 1 : 0) + ((jobs.includes('개인사업자') || jobs.includes('법인사업자')) ? 1 : 0) + (jobs.includes('프리랜서') ? 1 : 0);
    const incomeLabel = (full: string): React.ReactNode => incomeCount === 1
        ? <><span className="md:hidden">월수입</span><span className="hidden md:inline">{full}</span></>
        : full;
    // 모바일 한 줄 배치용 크기 (PC는 md:contents로 기존 격자 그대로)
    const M_INCOME = 'flex-1 min-w-[5.5rem] md:max-w-[9.5rem]';
    const M_PLACE = 'flex-[1.2] min-w-[4.5rem]';
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

                {/* 모바일: 월수입 · 소재지 · 4대보험 한 줄 (칸이 모자라면 다음 줄). PC: md:contents → 기존 격자 그대로 */}
                <div className="col-span-full flex flex-wrap items-start gap-2 md:contents">
                {jobs.includes('직장인') && (
                    <SmartInput
                        compact
                        label={incomeLabel('직장인 월수입')}
                        className={M_INCOME}
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
                        label={incomeLabel('사업자 월수입')}
                        className={M_INCOME}
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
                        label={incomeLabel('프리랜서 월수입')}
                        className={M_INCOME}
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
                        className={M_PLACE}
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
                        className={M_PLACE}
                        value={income?.businessPlace || ''}
                        onChange={(v: any) => onUpdate('incomeDetails', { ...income, businessPlace: String(v || '').trim() })}
                        placeholder="예: 서울 강남구"
                        updateOnBlur={true}
                    />
                )}

                <Choice
                    label="4대보험"
                    className={incomeCount > 0 || jobs.some(j => WORKPLACE_JOBS.includes(j) || BUSINESS_JOBS.includes(j)) ? 'w-[6rem] shrink-0 md:w-auto' : 'w-[9rem] md:w-auto'}
                    options={['가입', '미가입']}
                    value={c.insurance4}
                    onPick={v => onUpdate('insurance4', v)}
                />
                </div>
                {/* 결혼여부 + 미성년 자녀 수 한 줄. 모바일은 버튼을 좁게 해서 한 줄에 넣는다 */}
                <div className="col-span-full flex flex-wrap items-start gap-x-2 gap-y-3 md:gap-x-6">
                    {/* 아주 좁은 폰(360px 폭)에서는 결혼여부 버튼이 두 줄로 깨지지 않게 자녀 수가 다음 줄로 내려간다 */}
                    <Choice
                        label="결혼여부"
                        className="flex-1 min-w-[11.5rem] md:flex-none md:min-w-0"
                        options={['미혼', '기혼', '사실혼', '이혼', '사별']}
                        value={c.maritalStatus}
                        onPick={v => onUpdate('maritalStatus', v)}
                        buttonClassName="flex-1 basis-0 px-0.5 md:flex-none md:basis-auto md:px-2.5 md:min-w-[2.75rem]"
                    />
                    {/* 미성년 자녀 수 (미혼이 아닐 때): 0~3명, + 누르면 5명까지 */}
                    {c.maritalStatus !== '미혼' && (
                        <div className="min-w-0 shrink-0">
                            <div className="flex items-end gap-1">
                                <Choice
                                    label={<><span className="md:hidden">자녀 수</span><span className="hidden md:inline">미성년 자녀 수 (명)</span></>}
                                    options={showMoreKids ? CHILDREN_MORE : CHILDREN_BASE}
                                    value={c.childrenCount}
                                    onPick={v => onUpdate('childrenCount', v)}
                                    tone="emerald"
                                    fill={false}
                                    buttonClassName="w-7 md:w-9 px-0 tabular-nums"
                                />
                                {!showMoreKids && (
                                    <button type="button" onClick={() => setMoreKids(true)} title="4~5명"
                                        className="h-9 w-7 md:w-9 shrink-0 rounded-lg border border-dashed border-slate-300 dark:border-gray-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-gray-700 text-sm font-bold">+</button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </SectionCard>
    );
};
