import React from 'react';
import { SmartInput } from '../../ui/SmartInput';
import { Select } from '../../ui/Select';
import { Case } from '../../../types';
import { FREE_HOUSING_OWNERS, HOUSING_DETAILS, HOUSING_TYPES, RENT_CONTRACTORS } from '../../../constants';

interface CaseDetailHousingProps {
    c: Case;
    onUpdate: (field: string, value: any) => void;
}

export const CaseDetailHousing: React.FC<CaseDetailHousingProps> = ({
    c,
    onUpdate
}) => {
    return (
        <div>
            <h3 className="font-bold text-gray-700 border-b pb-2 mb-4">주거</h3>
            <Select label="거주형태" value={c.housingType} onChange={(v: any) => onUpdate('housingType', v)} options={HOUSING_TYPES} />
            <Select label="주거상세" value={c.housingDetail} onChange={(v: any) => onUpdate('housingDetail', v)} options={HOUSING_DETAILS} />

            {/* Conditional Fields based on Housing Type */}
            {c.housingType === '자가' ? (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <SmartInput label="집 시세(만원)" type="number" value={c.ownHousePrice} onChange={(v: any) => onUpdate('ownHousePrice', v)} isCurrency={true} />
                        <SmartInput label="집 담보 대출(만원)" type="number" value={c.ownHouseLoan} onChange={(v: any) => onUpdate('ownHouseLoan', v)} isCurrency={true} />
                    </div>
                    <Select label="집 명의자" value={c.ownHouseOwner} onChange={(v: any) => onUpdate('ownHouseOwner', v)} options={['본인', '배우자', '배우자 공동명의']} />
                </>
            ) : c.housingType === '무상거주' ? (
                <>
                    <Select label="집 명의자" value={c.freeHousingOwner} onChange={(v: any) => onUpdate('freeHousingOwner', v)} options={FREE_HOUSING_OWNERS} />
                </>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <SmartInput label="보증금(만원)" type="number" value={c.deposit} onChange={(v: any) => onUpdate('deposit', v)} isCurrency={true} />
                        <SmartInput label="보증금 대출(만원)" type="number" value={c.depositLoanAmount} onChange={(v: any) => onUpdate('depositLoanAmount', v)} isCurrency={true} />
                    </div>
                    <SmartInput label="월세(만원)" type="number" value={c.rent} onChange={(v: any) => onUpdate('rent', v)} isCurrency={true} />
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-500 mb-1">임대차 계약인</label>
                        <div className="flex gap-2">
                            {RENT_CONTRACTORS.map(opt => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => onUpdate('rentContractor', opt)}
                                    className={"flex-1 py-1.5 text-xs rounded border " + (c.rentContractor === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50')}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <SmartInput label="거주지역" value={c.region} onChange={(v: any) => onUpdate('region', v)} />
        </div>
    );
};
