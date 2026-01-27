import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SmartInput } from '../../ui/SmartInput';
import { Select } from '../../ui/Select';
import { Case, AssetItem, CreditLoanItem } from '../../../types';
import { ASSET_OWNERS, ASSET_TYPES } from '../../../constants';
import { getAutoCollateralString } from '../../../utils';

interface CaseDetailAssetsProps {
    c: Case;
    onUpdate: (field: string, value: any) => void;
    showToast: (msg: string) => void;
}

export const CaseDetailAssets: React.FC<CaseDetailAssetsProps> = ({
    c,
    onUpdate,
    showToast
}) => {
    const [newAsset, setNewAsset] = useState<Partial<AssetItem>>({ owner: '본인', type: '차량', amount: 0, loanAmount: 0, rentDeposit: 0, desc: '' });
    const [newCreditLoan, setNewCreditLoan] = useState<Partial<CreditLoanItem>>({ desc: '', amount: 0 });

    const handleAddAsset = () => {
        if (!newAsset.amount && !newAsset.loanAmount) {
            showToast('자산 시세 또는 담보대출금을 입력해주세요.');
            return;
        }
        const asset: AssetItem = {
            id: Date.now().toString(),
            owner: newAsset.owner as any,
            type: newAsset.type || '기타',
            amount: newAsset.amount || 0,
            loanAmount: newAsset.loanAmount || 0,
            rentDeposit: newAsset.rentDeposit || 0,
            desc: newAsset.desc || ''
        };
        const currentAssets = c.assets || [];
        onUpdate('assets', [...currentAssets, asset]);
        setNewAsset({ owner: '본인', type: '차량', amount: 0, loanAmount: 0, rentDeposit: 0, desc: '' });
    };

    const handleRemoveAsset = (id: string) => {
        onUpdate('assets', (c.assets || []).filter(a => a.id !== id));
    };

    const handleAddCreditLoan = () => {
        if (!newCreditLoan.amount) {
            showToast('대출 금액을 입력해주세요.');
            return;
        }
        const loan: CreditLoanItem = {
            id: Date.now().toString(),
            desc: newCreditLoan.desc || '신용대출',
            amount: newCreditLoan.amount || 0
        };
        const currentLoans = c.creditLoan || [];
        onUpdate('creditLoan', [...currentLoans, loan]);
        setNewCreditLoan({ desc: '', amount: 0 });
    };

    const handleRemoveCreditLoan = (id: string) => {
        onUpdate('creditLoan', (c.creditLoan || []).filter(l => l.id !== id));
    };

    // Calculate auto collateral string for display
    const autoCollateralString = getAutoCollateralString(c);

    return (
        <div>
            <h3 className="font-bold text-gray-700 border-b pb-2 mb-4">자산 / 부채</h3>

            <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-gray-700 mb-2 text-xs">자산 목록</h4>
                <div className="space-y-2 mb-3">
                    {(!c.assets || c.assets.length === 0) && <p className="text-xs text-gray-400 text-center py-2">등록된 자산이 없습니다.</p>}
                    {c.assets && c.assets.map((asset: AssetItem) => (
                        <div key={asset.id} className="bg-white p-2 rounded border flex justify-between items-center text-xs">
                            <div className="flex-1">
                                <span className="font-bold text-blue-600 mr-2">[{asset.owner}]</span>
                                <span className="font-semibold mr-2">{asset.type}</span>
                                <span className="text-gray-800 mr-2">시세 {asset.amount > 0 ? (asset.amount.toLocaleString() + " 만원") : '0원'}</span>
                                {asset.loanAmount > 0 && <span className="text-red-500 mr-2">담보 {asset.loanAmount.toLocaleString()}만원</span>}
                                {asset.rentDeposit && asset.rentDeposit > 0 && <span className="text-green-600 mr-2">전세 {asset.rentDeposit.toLocaleString()}만원</span>}
                                {asset.desc && <span className="text-gray-500">({asset.desc})</span>}
                            </div>
                            <button onClick={() => handleRemoveAsset(asset.id)} className="text-red-500 p-1">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add New Asset Form */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <select
                        className="p-1.5 border rounded text-xs bg-white"
                        value={newAsset.owner}
                        onChange={e => setNewAsset({ ...newAsset, owner: e.target.value as any })}
                    >
                        {ASSET_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select
                        className="p-1.5 border rounded text-xs bg-white"
                        value={newAsset.type}
                        onChange={e => setNewAsset({ ...newAsset, type: e.target.value })}
                    >
                        {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <SmartInput
                        label="시세"
                        type="number"
                        value={newAsset.amount}
                        onChange={(v: number) => setNewAsset({ ...newAsset, amount: v })}
                        placeholder="시세"
                        suffix="만원"
                        isCurrency={true}
                    />
                    <SmartInput
                        label="담보대출"
                        type="number"
                        value={newAsset.loanAmount}
                        onChange={(v: number) => setNewAsset({ ...newAsset, loanAmount: v })}
                        placeholder="담보대출"
                        suffix="만원"
                        isCurrency={true}
                    />
                </div>
                {['부동산', '토지'].includes(newAsset.type || '') && (
                    <div className="mb-2">
                        <SmartInput
                            label="전세금액"
                            type="number"
                            value={newAsset.rentDeposit}
                            onChange={(v: number) => setNewAsset({ ...newAsset, rentDeposit: v })}
                            placeholder="전세금액"
                            suffix="만원"
                            isCurrency={true}
                        />
                    </div>
                )}
                <div className="flex gap-2 mb-2">
                    <input
                        type="text"
                        placeholder="상세 내용 (예: 차종 등)"
                        className="flex-1 p-1.5 border rounded text-xs"
                        value={newAsset.desc || ''}
                        onChange={e => setNewAsset({ ...newAsset, desc: e.target.value })}
                    />
                    <button
                        type="button"
                        onClick={handleAddAsset}
                        className="w-24 bg-blue-600 text-white rounded text-xs font-bold flex justify-center items-center hover:bg-blue-700 flex-shrink-0"
                    >
                        <Plus size={14} className="mr-1" /> 추가
                    </button>
                </div>
            </div>

            <div className="mb-6 bg-pink-50 p-4 rounded-lg border border-pink-200">
                <h4 className="font-bold text-gray-700 mb-2 text-xs">신용대출 목록</h4>
                <div className="space-y-2 mb-3">
                    {(!c.creditLoan || c.creditLoan.length === 0) && <p className="text-xs text-gray-400 text-center py-2">등록된 신용대출이 없습니다.</p>}
                    {c.creditLoan?.map((loan: CreditLoanItem) => (
                        <div key={loan.id} className="bg-white p-2 rounded border flex justify-between items-center text-xs">
                            <div className="flex-1">
                                <span className="font-semibold mr-2">{loan.desc}</span>
                                <span className="text-gray-800">{loan.amount.toLocaleString()}만원</span>
                            </div>
                            <button type="button" onClick={() => handleRemoveCreditLoan(loan.id)} className="text-red-500 p-1">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                        type="text"
                        placeholder="대출 내용 (예: 햇살론)"
                        className="w-full p-1.5 border rounded text-xs col-span-2"
                        value={newCreditLoan.desc || ''}
                        onChange={e => setNewCreditLoan({ ...newCreditLoan, desc: e.target.value })}
                    />
                    <SmartInput
                        label="금액"
                        type="number"
                        value={newCreditLoan.amount}
                        onChange={(v: number) => setNewCreditLoan({ ...newCreditLoan, amount: v })}
                        placeholder="금액"
                        suffix="만원"
                        isCurrency={true}
                    />
                    <button
                        type="button"
                        onClick={handleAddCreditLoan}
                        className="w-auto px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-bold flex justify-center items-center hover:bg-blue-700 whitespace-nowrap"
                    >
                        <Plus size={14} className="mr-1" /> 신용대출 추가
                    </button>
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">담보 대출 내용 (자동 집계 + 추가)</label>
                <div className="bg-gray-50 p-2 rounded text-xs text-blue-800 font-medium mb-1">
                    자동 집계: {autoCollateralString}
                </div>
                <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                    value={c.collateralLoanMemo || ''}
                    onChange={e => onUpdate('collateralLoanMemo', e.target.value)}
                    placeholder="추가로 작성할 담보 대출 내용"
                />
            </div>

            <div className="grid grid-cols-2 gap-2">
                <Select label="신용카드 사용" value={c.creditCardUse} onChange={(v: any) => onUpdate('creditCardUse', v)} options={['사용', '미사용']} />
                {c.creditCardUse === '사용' && (
                    <SmartInput label="사용 금액(만원)" type="number" value={c.creditCardAmount} onChange={(v: any) => onUpdate('creditCardAmount', v)} isCurrency={true} updateOnBlur={true} />
                )}
            </div>
            <SmartInput label="월 대출납입(만원)" type="number" value={c.loanMonthlyPay} onChange={(v: any) => onUpdate('loanMonthlyPay', v)} isCurrency={true} updateOnBlur={true} />
        </div>
    );
};
