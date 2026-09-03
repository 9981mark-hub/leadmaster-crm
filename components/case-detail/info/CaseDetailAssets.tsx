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
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-rose-200/90 dark:border-rose-900/60 shadow-xs overflow-hidden">
            {/* 4. 로즈 컬러 헤더 밴드 */}
            <div className="bg-gradient-to-r from-rose-50 to-pink-50/40 dark:from-rose-950/50 dark:to-pink-950/30 px-4 py-2.5 border-b border-rose-200 dark:border-rose-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                        4
                    </span>
                    <h3 className="font-extrabold text-gray-900 dark:text-gray-100 text-sm">
                        자산 및 부채 관리
                    </h3>
                </div>
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-900/50 px-2 py-0.5 rounded">
                    대출 {c.creditLoan?.length || 0}건 | 자산 {c.assets?.length || 0}건
                </span>
            </div>

            {/* 카드 본문 */}
            <div className="p-4 space-y-3.5">
                {/* 4-A: 보유 자산 목록 */}
                <div>
                    <label className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                            <span>🚗 보유 자산 목록</span>
                            <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.2 rounded-full text-[11px] font-bold">
                                {c.assets?.length || 0}건
                            </span>
                        </span>
                    </label>

                    {/* 등록된 자산 리스트 */}
                    <div className="space-y-1.5 mb-2.5 max-h-40 overflow-y-auto pr-1">
                        {(!c.assets || c.assets.length === 0) && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2.5 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                등록된 자산이 없습니다.
                            </p>
                        )}
                        {c.assets && c.assets.map((asset: AssetItem) => (
                            <div key={asset.id} className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs">
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-gray-800 dark:text-gray-200 truncate">
                                        <span className="text-blue-600 dark:text-blue-400 font-bold mr-1">[{asset.owner}]</span>
                                        <span>{asset.type}</span>
                                        {asset.desc && <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">({asset.desc})</span>}
                                    </div>
                                    <div className="flex gap-2.5 text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                        <span>시세: <b>{asset.amount > 0 ? `${asset.amount.toLocaleString()}만` : '0'}</b></span>
                                        {asset.loanAmount > 0 && <span className="text-rose-600 dark:text-rose-400 font-bold">담보: {asset.loanAmount.toLocaleString()}만</span>}
                                        {asset.rentDeposit && asset.rentDeposit > 0 && <span className="text-amber-600 font-bold">전세: {asset.rentDeposit.toLocaleString()}만</span>}
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => handleRemoveAsset(asset.id)} 
                                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                                    title="삭제"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* 자산 추가 박스 */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <select
                                className="px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                                value={newAsset.owner}
                                onChange={e => setNewAsset({ ...newAsset, owner: e.target.value as any })}
                            >
                                {ASSET_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                            <select
                                className="px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                                value={newAsset.type}
                                onChange={e => setNewAsset({ ...newAsset, type: e.target.value })}
                            >
                                {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="number"
                                placeholder="시세 (만원)"
                                className="px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                                value={newAsset.amount || ''}
                                onChange={e => setNewAsset({ ...newAsset, amount: Number(e.target.value) })}
                            />
                            <input
                                type="number"
                                placeholder="담보대출 (만원)"
                                className="px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                                value={newAsset.loanAmount || ''}
                                onChange={e => setNewAsset({ ...newAsset, loanAmount: Number(e.target.value) })}
                            />
                        </div>
                        {['부동산', '토지'].includes(newAsset.type || '') && (
                            <input
                                type="number"
                                placeholder="전세금액 (만원)"
                                className="w-full px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                                value={newAsset.rentDeposit || ''}
                                onChange={e => setNewAsset({ ...newAsset, rentDeposit: Number(e.target.value) })}
                            />
                        )}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="상세 내용 (차종, 지목 등)"
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                                value={newAsset.desc || ''}
                                onChange={e => setNewAsset({ ...newAsset, desc: e.target.value })}
                            />
                            <button
                                type="button"
                                onClick={handleAddAsset}
                                className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3.5 py-2 rounded-lg text-xs flex items-center gap-1 shrink-0"
                            >
                                <Plus size={13} />
                                <span>추가</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 4-B: 신용대출 목록 */}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <label className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                            <span>💳 신용대출 내역</span>
                            <span className="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 px-2 py-0.2 rounded-full text-[11px] font-bold">
                                {c.creditLoan?.length || 0}건
                            </span>
                        </span>
                    </label>

                    {/* 등록된 신용대출 리스트 */}
                    <div className="space-y-1.5 mb-2.5 max-h-36 overflow-y-auto pr-1">
                        {(!c.creditLoan || c.creditLoan.length === 0) && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2.5 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                등록된 신용대출이 없습니다.
                            </p>
                        )}
                        {c.creditLoan?.map((loan: CreditLoanItem) => (
                            <div key={loan.id} className="bg-rose-50/50 dark:bg-rose-950/20 p-2.5 rounded-xl border border-rose-200/70 dark:border-rose-900/40 flex justify-between items-center text-xs">
                                <div className="flex-1 min-w-0">
                                    <span className="font-bold text-gray-900 dark:text-gray-100">{loan.desc || '신용대출'}</span>
                                    <span className="text-rose-600 dark:text-rose-400 font-extrabold ml-2 text-xs">
                                        {loan.amount > 0 ? `${loan.amount.toLocaleString()}만원` : '0원'}
                                    </span>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => handleRemoveCreditLoan(loan.id)} 
                                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                                    title="삭제"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* 신용대출 인라인 추가 바 */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="대출 내용 (예: 햇살론, 카카오)"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                            value={newCreditLoan.desc || ''}
                            onChange={e => setNewCreditLoan({ ...newCreditLoan, desc: e.target.value })}
                        />
                        <input
                            type="number"
                            placeholder="금액(만원)"
                            className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none text-right"
                            value={newCreditLoan.amount || ''}
                            onChange={e => setNewCreditLoan({ ...newCreditLoan, amount: Number(e.target.value) })}
                        />
                        <button
                            type="button"
                            onClick={handleAddCreditLoan}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3.5 py-2 rounded-lg text-xs flex items-center gap-1 shrink-0"
                        >
                            <Plus size={13} />
                            <span>추가</span>
                        </button>
                    </div>
                </div>

                {/* 담보 대출 내용 (자동 집계) */}
                <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl text-xs">
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">담보대출 자동 집계: </span>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{autoCollateralString}</span>
                </div>

                {/* 신용카드 사용 & 사용금액 (2열) */}
                <div className="grid grid-cols-2 gap-3">
                    <Select 
                        label="신용카드 사용" 
                        value={c.creditCardUse} 
                        onChange={(v: any) => onUpdate('creditCardUse', v)} 
                        options={['사용', '미사용']} 
                    />
                    {c.creditCardUse === '사용' ? (
                        <SmartInput 
                            label="사용 금액" 
                            type="number" 
                            value={c.creditCardAmount} 
                            onChange={(v: any) => onUpdate('creditCardAmount', v)} 
                            suffix="만원"
                            isCurrency={true} 
                            updateOnBlur={true} 
                        />
                    ) : (
                        <div className="hidden" />
                    )}
                </div>

                {/* 월 총 대출납입금 */}
                <SmartInput 
                    label="월 총 대출 납입액" 
                    type="number" 
                    value={c.loanMonthlyPay} 
                    onChange={(v: any) => onUpdate('loanMonthlyPay', v)} 
                    suffix="만원"
                    isCurrency={true} 
                    updateOnBlur={true} 
                />
            </div>
        </div>
    );
};
