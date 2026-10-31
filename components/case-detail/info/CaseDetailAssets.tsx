import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SmartInput } from '../../ui/SmartInput';
import { Select } from '../../ui/Select';
import { Case, AssetItem, CreditLoanItem } from '../../../types';
import { ASSET_OWNERS, ASSET_TYPES } from '../../../constants';
import { getAutoCollateralString, formatKoreanMoney } from '../../../utils';
import { getDebtSummary } from '../../../utils/intake';

interface CaseDetailAssetsProps {
    c: Case;
    onUpdate: (field: string, value: any) => void;
    showToast: (msg: string) => void;
}

/** 쉼표 있는 만원 입력 (모바일 숫자 키패드) */
const MoneyField: React.FC<{ value: number; onChange: (v: number) => void; placeholder?: string; className?: string; onBlur?: () => void }> = ({ value, onChange, placeholder, className = '', onBlur }) => (
    <input
        inputMode="numeric"
        placeholder={placeholder}
        className={`px-2.5 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200 outline-none focus:border-blue-500 text-right tabular-nums ${className}`}
        value={value ? Number(value).toLocaleString() : ''}
        onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); onChange(v === '' ? 0 : Number(v)); }}
        onBlur={onBlur}
    />
);

/** 이미 입력한 신용 채무 한 줄: 바로 고칠 수 있다 (칸을 벗어나면 저장) */
const LoanRow: React.FC<{ loan: CreditLoanItem; onSave: (l: CreditLoanItem) => void; onRemove: () => void }> = ({ loan, onSave, onRemove }) => {
    const [desc, setDesc] = useState(loan.desc || '');
    const [amount, setAmount] = useState(loan.amount || 0);
    useEffect(() => { setDesc(loan.desc || ''); setAmount(loan.amount || 0); }, [loan.desc, loan.amount]);
    const commit = () => { if (desc !== (loan.desc || '') || amount !== (loan.amount || 0)) onSave({ ...loan, desc, amount }); };
    return (
        <div className="flex items-center gap-1.5">
            <input
                className="flex-1 min-w-0 px-2.5 py-1.5 border border-transparent hover:border-slate-200 focus:border-blue-500 rounded-lg text-xs font-semibold text-slate-800 dark:text-gray-100 bg-rose-50/60 dark:bg-rose-950/20 outline-none"
                value={desc} onChange={e => setDesc(e.target.value)} onBlur={commit} placeholder="금융사·종류"
            />
            <MoneyField value={amount} onChange={setAmount} onBlur={commit} className="w-24 !py-1.5 font-bold text-rose-700" />
            <span className="text-[11px] text-slate-400">만원</span>
            <button type="button" onClick={onRemove} className="p-1 text-slate-300 hover:text-red-500 rounded" title="삭제" aria-label="삭제"><Trash2 size={14} /></button>
        </div>
    );
};

export const CaseDetailAssets: React.FC<CaseDetailAssetsProps> = ({
    c,
    onUpdate,
    showToast
}) => {
    const [newAsset, setNewAsset] = useState<Partial<AssetItem>>({ owner: '본인', type: '자동차', amount: 0, loanAmount: 0, rentDeposit: 0, desc: '' });
    const [newCreditLoan, setNewCreditLoan] = useState<Partial<CreditLoanItem>>({ desc: '', amount: 0 });

    const handleAddAsset = () => {
        if (!newAsset.amount && !newAsset.loanAmount) {
            showToast('재산 시세 또는 담보대출금을 입력해주세요.');
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
        onUpdate('assets', [...(c.assets || []), asset]);
        setNewAsset({ owner: '본인', type: '자동차', amount: 0, loanAmount: 0, rentDeposit: 0, desc: '' });
    };

    const handleRemoveAsset = (id: string) => {
        onUpdate('assets', (c.assets || []).filter(a => a.id !== id));
    };

    const handleAddCreditLoan = () => {
        if (!newCreditLoan.amount) {
            showToast('채무 금액을 입력해주세요.');
            return;
        }
        const loan: CreditLoanItem = {
            id: Date.now().toString(),
            desc: newCreditLoan.desc || '신용대출',
            amount: newCreditLoan.amount || 0
        };
        onUpdate('creditLoan', [...(c.creditLoan || []), loan]);
        setNewCreditLoan({ desc: '', amount: 0 });
    };

    const autoCollateralString = getAutoCollateralString(c);
    const debt = getDebtSummary(c);
    const income = c.incomeNet || 0;
    const payRatio = income > 0 && c.loanMonthlyPay ? Math.round((c.loanMonthlyPay / income) * 100) : null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-gray-100 text-sm">채무 · 재산</h3>
                <span className="text-[11px] text-slate-500">채무 {c.creditLoan?.length || 0}건 · 재산 {c.assets?.length || 0}건</span>
            </div>

            {/* 채무 합계: 상담하면서 바로 보이게 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100 dark:bg-gray-700 border-b border-slate-100 dark:border-gray-700">
                {[
                    { k: '총 채무', v: debt.total, strong: true },
                    { k: '신용 (카드 포함)', v: debt.credit },
                    { k: '담보', v: debt.collateral },
                    { k: '월 상환', v: c.loanMonthlyPay || 0, extra: payRatio !== null ? `소득의 ${payRatio}%` : '' },
                ].map(x => (
                    <div key={x.k} className="bg-white dark:bg-gray-800 px-3 py-2">
                        <div className="text-[11px] text-slate-500">{x.k}</div>
                        <div className={`tabular-nums ${x.strong ? 'text-lg font-extrabold text-rose-700 dark:text-rose-400' : 'text-sm font-bold text-slate-800 dark:text-gray-100'}`}>
                            {x.v > 0 ? formatKoreanMoney(x.v) : '-'}
                        </div>
                        {x.extra && <div className="text-[11px] text-slate-400">{x.extra}</div>}
                    </div>
                ))}
            </div>

            <div className="p-4 space-y-4">
                {/* 신용 채무 */}
                <div>
                    <div className="text-xs font-semibold text-slate-600 dark:text-gray-300 mb-1.5">신용 채무 (금융사·카드론·대부업 등, 바로 고칠 수 있음)</div>
                    <div className="space-y-1.5 mb-2">
                        {(!c.creditLoan || c.creditLoan.length === 0) && (
                            <p className="text-xs text-slate-400 py-2 text-center bg-slate-50 dark:bg-gray-900/30 rounded-lg border border-dashed border-slate-200 dark:border-gray-700">아직 입력한 채무가 없습니다. 채권자별로 하나씩 넣으세요.</p>
                        )}
                        {c.creditLoan?.map((loan) => (
                            <LoanRow key={loan.id} loan={loan}
                                onSave={l => onUpdate('creditLoan', (c.creditLoan || []).map(x => x.id === l.id ? l : x))}
                                onRemove={() => onUpdate('creditLoan', (c.creditLoan || []).filter(x => x.id !== loan.id))} />
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="예: 국민카드 카드론, 러시앤캐시"
                            className="flex-1 min-w-0 px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200 outline-none focus:border-blue-500"
                            value={newCreditLoan.desc || ''}
                            onChange={e => setNewCreditLoan({ ...newCreditLoan, desc: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') handleAddCreditLoan(); }}
                        />
                        <MoneyField value={newCreditLoan.amount || 0} onChange={v => setNewCreditLoan({ ...newCreditLoan, amount: v })} placeholder="금액(만원)" className="w-28" />
                        <button type="button" onClick={handleAddCreditLoan} className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-2 rounded-lg text-xs flex items-center gap-1 shrink-0">
                            <Plus size={13} /> 추가
                        </button>
                    </div>
                </div>

                {/* 신용카드 · 월 상환 */}
                <div className="grid grid-cols-2 gap-3">
                    <Select label="신용카드 사용" value={c.creditCardUse} onChange={(v: any) => onUpdate('creditCardUse', v)} options={['사용', '미사용']} />
                    {c.creditCardUse === '사용' ? (
                        <SmartInput label="카드 사용 금액" type="number" value={c.creditCardAmount} onChange={(v: any) => onUpdate('creditCardAmount', v)} suffix="만원" isCurrency updateOnBlur />
                    ) : <div />}
                </div>
                <SmartInput label="월 총 대출 납입액" type="number" value={c.loanMonthlyPay} onChange={(v: any) => onUpdate('loanMonthlyPay', v)} suffix="만원" isCurrency updateOnBlur needed />

                {/* 재산 */}
                <div className="pt-3 border-t border-slate-100 dark:border-gray-700">
                    <div className="text-xs font-semibold text-slate-600 dark:text-gray-300 mb-1.5">재산 (본인·배우자)</div>
                    <div className="space-y-1.5 mb-2">
                        {(!c.assets || c.assets.length === 0) && (
                            <p className="text-xs text-slate-400 py-2 text-center bg-slate-50 dark:bg-gray-900/30 rounded-lg border border-dashed border-slate-200 dark:border-gray-700">재산이 없으면 상담 메모에 "재산 없음"이라고 적어 두세요.</p>
                        )}
                        {c.assets?.map((asset: AssetItem) => (
                            <div key={asset.id} className="bg-slate-50 dark:bg-gray-900/50 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-gray-700 flex justify-between items-center text-xs">
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-slate-800 dark:text-gray-200 truncate">
                                        <span className="text-blue-700 dark:text-blue-400 mr-1">[{asset.owner}]</span>{asset.type}
                                        {asset.desc && <span className="text-slate-500 font-normal ml-1">({asset.desc})</span>}
                                    </div>
                                    <div className="flex gap-2.5 text-slate-600 dark:text-gray-400 mt-0.5 tabular-nums">
                                        <span>시세 <b>{asset.amount > 0 ? formatKoreanMoney(asset.amount) : '-'}</b></span>
                                        {asset.loanAmount > 0 && <span className="text-rose-600 font-semibold">담보 {formatKoreanMoney(asset.loanAmount)}</span>}
                                        {!!asset.rentDeposit && asset.rentDeposit > 0 && <span className="text-amber-700 font-semibold">전세 {formatKoreanMoney(asset.rentDeposit)}</span>}
                                    </div>
                                </div>
                                <button type="button" onClick={() => handleRemoveAsset(asset.id)} className="p-1 text-slate-300 hover:text-red-500 rounded" title="삭제" aria-label="삭제"><Trash2 size={14} /></button>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-gray-900/40 rounded-lg border border-slate-200 dark:border-gray-700 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <select className="px-2.5 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200 outline-none"
                                value={newAsset.owner} onChange={e => setNewAsset({ ...newAsset, owner: e.target.value as any })}>
                                {ASSET_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                            <select className="px-2.5 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200 outline-none"
                                value={newAsset.type} onChange={e => setNewAsset({ ...newAsset, type: e.target.value })}>
                                {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <MoneyField value={newAsset.amount || 0} onChange={v => setNewAsset({ ...newAsset, amount: v })} placeholder="시세 (만원)" />
                            <MoneyField value={newAsset.loanAmount || 0} onChange={v => setNewAsset({ ...newAsset, loanAmount: v })} placeholder="담보대출 (만원)" />
                        </div>
                        {['부동산', '토지'].includes(newAsset.type || '') && (
                            <MoneyField value={newAsset.rentDeposit || 0} onChange={v => setNewAsset({ ...newAsset, rentDeposit: v })} placeholder="세입자 전세금 (만원)" className="w-full" />
                        )}
                        <div className="flex gap-2">
                            <input type="text" placeholder="차종·연식, 지번 등"
                                className="flex-1 min-w-0 px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200 outline-none"
                                value={newAsset.desc || ''} onChange={e => setNewAsset({ ...newAsset, desc: e.target.value })} />
                            <button type="button" onClick={handleAddAsset} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-2 rounded-lg text-xs flex items-center gap-1 shrink-0">
                                <Plus size={13} /> 추가
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-3 py-2 bg-slate-50 dark:bg-gray-900/30 rounded-lg text-xs">
                    <span className="font-semibold text-slate-600 dark:text-gray-300">담보 채무 자동 집계: </span>
                    <span className="text-slate-700 dark:text-gray-300">{autoCollateralString}</span>
                </div>
            </div>
        </div>
    );
};
