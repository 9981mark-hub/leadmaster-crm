import React from 'react';
import { SmartInput } from '../../ui/SmartInput';
import { Case } from '../../../types';
import { FREE_HOUSING_OWNERS, HOUSING_DETAILS, HOUSING_TYPES, RENT_CONTRACTORS } from '../../../constants';
import { SectionCard, Choice, FIELD_GRID } from '../detailUi';

interface CaseDetailHousingProps {
    c: Case;
    onUpdate: (field: string, value: any) => void;
}

/** 3단계 주거 (거주형태에 따라 시세·대출 / 보증금·월세 / 명의자 칸이 바뀐다) */
export const CaseDetailHousing: React.FC<CaseDetailHousingProps> = ({
    c,
    onUpdate
}) => {
    return (
        <SectionCard step={3} title="주거" meta={`${c.housingType || '미지정'}${c.housingDetail ? ` (${c.housingDetail})` : ''}`}>
            <div className={FIELD_GRID}>
                <Choice
                    label="거주형태"
                    className="col-span-2"
                    options={HOUSING_TYPES}
                    value={c.housingType}
                    onPick={v => onUpdate('housingType', v)}
                />
                {/* 2026-11-02 거주지역: 한 칸 폭, 거주형태 바로 옆 */}
                <SmartInput
                    compact
                    label="거주지역 (관할법원 연계)"
                    value={c.region}
                    onChange={(v: any) => onUpdate('region', v)}
                    placeholder="예: 서울 강남"
                    updateOnBlur={true}
                />
                <Choice
                    label="주거상세"
                    className="col-span-2"
                    options={HOUSING_DETAILS}
                    value={c.housingDetail}
                    onPick={v => onUpdate('housingDetail', v)}
                />

                {c.housingType === '자가' ? (
                    <>
                        <SmartInput
                            compact
                            label="집 시세"
                            type="number"
                            value={c.ownHousePrice}
                            onChange={(v: any) => onUpdate('ownHousePrice', v)}
                            suffix="만원"
                            isCurrency={true}
                            updateOnBlur={true}
                        />
                        <SmartInput
                            compact
                            label="집 담보 대출"
                            type="number"
                            value={c.ownHouseLoan}
                            onChange={(v: any) => onUpdate('ownHouseLoan', v)}
                            suffix="만원"
                            isCurrency={true}
                            updateOnBlur={true}
                        />
                        <Choice
                            label="집 명의자"
                            className="col-span-2"
                            options={['본인', '배우자', '배우자 공동명의']}
                            value={c.ownHouseOwner}
                            onPick={v => onUpdate('ownHouseOwner', v)}
                        />
                    </>
                ) : c.housingType === '무상거주' ? (
                    <Choice
                        label="집 명의자"
                        className="col-span-2"
                        options={FREE_HOUSING_OWNERS}
                        value={c.freeHousingOwner}
                        onPick={v => onUpdate('freeHousingOwner', v)}
                    />
                ) : (
                    <>
                        <SmartInput
                            compact
                            label="보증금"
                            type="number"
                            value={c.deposit}
                            onChange={(v: any) => onUpdate('deposit', v)}
                            suffix="만원"
                            isCurrency={true}
                            updateOnBlur={true}
                        />
                        <SmartInput
                            compact
                            label="보증금 대출"
                            type="number"
                            value={c.depositLoanAmount}
                            onChange={(v: any) => onUpdate('depositLoanAmount', v)}
                            suffix="만원"
                            isCurrency={true}
                            updateOnBlur={true}
                        />
                        <SmartInput
                            compact
                            label="월세"
                            type="number"
                            value={c.rent}
                            onChange={(v: any) => onUpdate('rent', v)}
                            suffix="만원"
                            isCurrency={true}
                            updateOnBlur={true}
                        />
                        <Choice
                            label="임대차 계약인"
                            options={RENT_CONTRACTORS}
                            value={c.rentContractor}
                            onPick={v => onUpdate('rentContractor', v)}
                        />
                    </>
                )}
            </div>
        </SectionCard>
    );
};
