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
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-amber-200/90 dark:border-amber-900/60 shadow-xs overflow-hidden">
            {/* 3. 앰버 컬러 헤더 밴드 */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50/40 dark:from-amber-950/50 dark:to-orange-950/30 px-4 py-2.5 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                        3
                    </span>
                    <h3 className="font-extrabold text-gray-900 dark:text-gray-100 text-sm">
                        주거 형태 및 주거비
                    </h3>
                </div>
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/50 px-2 py-0.5 rounded">
                    {c.housingType || '미지정'} {c.housingDetail && `(${c.housingDetail})`}
                </span>
            </div>

            {/* 카드 본문 */}
            <div className="p-4 space-y-3.5">
                {/* 거주형태 & 주거상세 (2열) */}
                <div className="grid grid-cols-2 gap-3">
                    <Select 
                        label="거주형태" 
                        value={c.housingType} 
                        onChange={(v: any) => onUpdate('housingType', v)} 
                        options={HOUSING_TYPES} 
                    />
                    <Select 
                        label="주거상세" 
                        value={c.housingDetail} 
                        onChange={(v: any) => onUpdate('housingDetail', v)} 
                        options={HOUSING_DETAILS} 
                    />
                </div>

                {/* 거주형태별 조건부 상세 블록 */}
                {c.housingType === '자가' ? (
                    <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl space-y-2.5">
                        <div className="grid grid-cols-2 gap-2.5">
                            <SmartInput 
                                label="집 시세" 
                                type="number" 
                                value={c.ownHousePrice} 
                                onChange={(v: any) => onUpdate('ownHousePrice', v)} 
                                suffix="만원"
                                isCurrency={true} 
                                updateOnBlur={true} 
                            />
                            <SmartInput 
                                label="집 담보 대출" 
                                type="number" 
                                value={c.ownHouseLoan} 
                                onChange={(v: any) => onUpdate('ownHouseLoan', v)} 
                                suffix="만원"
                                isCurrency={true} 
                                updateOnBlur={true} 
                            />
                        </div>
                        <Select 
                            label="집 명의자" 
                            value={c.ownHouseOwner} 
                            onChange={(v: any) => onUpdate('ownHouseOwner', v)} 
                            options={['본인', '배우자', '배우자 공동명의']} 
                        />
                    </div>
                ) : c.housingType === '무상거주' ? (
                    <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                        <Select 
                            label="집 명의자" 
                            value={c.freeHousingOwner} 
                            onChange={(v: any) => onUpdate('freeHousingOwner', v)} 
                            options={FREE_HOUSING_OWNERS} 
                        />
                    </div>
                ) : (
                    <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl space-y-2.5">
                        <div className="grid grid-cols-2 gap-2.5">
                            <SmartInput 
                                label="보증금" 
                                type="number" 
                                value={c.deposit} 
                                onChange={(v: any) => onUpdate('deposit', v)} 
                                suffix="만원"
                                isCurrency={true} 
                                updateOnBlur={true} 
                            />
                            <SmartInput 
                                label="보증금 대출" 
                                type="number" 
                                value={c.depositLoanAmount} 
                                onChange={(v: any) => onUpdate('depositLoanAmount', v)} 
                                suffix="만원"
                                isCurrency={true} 
                                updateOnBlur={true} 
                            />
                        </div>
                        <SmartInput 
                            label="월세" 
                            type="number" 
                            value={c.rent} 
                            onChange={(v: any) => onUpdate('rent', v)} 
                            suffix="만원"
                            isCurrency={true} 
                            updateOnBlur={true} 
                        />
                        <div>
                            <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">
                                임대차 계약인
                            </label>
                            <div className="flex gap-2">
                                {RENT_CONTRACTORS.map(opt => (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => onUpdate('rentContractor', opt)}
                                        className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all border ${
                                            c.rentContractor === opt 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 거주지역 (관할법원 연계) */}
                <SmartInput 
                    label="거주지역 (관할법원 연계)" 
                    value={c.region} 
                    onChange={(v: any) => onUpdate('region', v)} 
                    placeholder="예: 서울 강남 / 수원 팔달"
                    updateOnBlur={true} 
                />
            </div>
        </div>
    );
};
