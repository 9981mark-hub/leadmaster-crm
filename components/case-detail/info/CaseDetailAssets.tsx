import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SmartInput } from '../../ui/SmartInput';
import { Case, AssetItem, CreditLoanItem } from '../../../types';
import { ASSET_OWNERS, ASSET_TYPES } from '../../../constants';
import { getAutoCollateralString, formatKoreanMoney } from '../../../utils';
import { getDebtSummary } from '../../../utils/intake';
import { SectionCard, Choice, FIELD_GRID, SPLIT_GRID, LABEL } from '../detailUi';

interface CaseDetailAssetsProps {
    c: Case;
    onUpdate: (field: string, value: any) => void;
    showToast: (msg: string) => void;
}

const SMALL_CONTROL = 'h-9 px-2.5 border border-border rounded-lg text-xs bg-card text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring shadow-2xs';

/** 쉼표 있는 만원 입력 (모바일 숫자 키패드) */
const MoneyField: React.FC<{ value: number; onChange: (v: number) => void; placeholder?: string; className?: string; onBlur?: () => void; ariaLabel?: string }> = ({ value, onChange, placeholder, className = '', onBlur, ariaLabel }) => (
    <input
        inputMode="numeric"
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        className={`${SMALL_CONTROL} text-right tabular-nums ${className}`}
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
                className="flex-1 min-w-0 h-8 px-2.5 border border-border focus:border-primary rounded-lg text-xs font-semibold text-foreground bg-muted/40 outline-none"
                value={desc} onChange={e => setDesc(e.target.value)} onBlur={commit} placeholder="금융사·종류" aria-label="금융사·종류"
            />
            <MoneyField value={amount} onChange={setAmount} onBlur={commit} ariaLabel="채무 금액(만원)" className="w-24 !h-8 font-bold font-mono text-foreground" />
            <span className="text-xs text-muted-foreground">만원</span>
            <button type="button" onClick={onRemove} className="p-1 text-muted-foreground hover:text-destructive rounded" title="삭제" aria-label="삭제"><Trash2 size={14} /></button>
        </div>
    );
};

/**
 * 4단계 채무 · 재산
 * [2026-11-01] 넓은 카드에서는 신용 채무(왼쪽)와 카드·월 상환·재산(오른쪽)을 나란히, 좁으면 위아래.
 */
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
        <SectionCard step={4} title="채무 · 재산" meta={`채무 ${c.creditLoan?.length || 0}건 · 재산 ${c.assets?.length || 0}건`} bodyClassName="">
            {/* 채무 합계: 상담하면서 바로 보이게 */}
            <div className="grid grid-cols-2 md:grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] divide-x divide-border border-b border-border bg-card">
                {[
                    { k: '총 채무', v: debt.total, strong: true },
                    { k: '신용 (카드 포함)', v: debt.credit },
                    { k: '담보', v: debt.collateral },
                    { k: '월 상환', v: c.loanMonthlyPay || 0, extra: payRatio !== null ? `소득의 ${payRatio}%` : '' },
                ].map(x => (
                    <div key={x.k} className="px-3.5 py-2.5 bg-card">
                        <div className="text-xs text-muted-foreground font-medium">{x.k}</div>
                        <div className={`tabular-nums font-mono ${x.strong ? 'text-lg font-bold text-foreground' : 'text-sm font-semibold text-foreground'}`}>
                            {x.v > 0 ? formatKoreanMoney(x.v) : '-'}
                        </div>
                        {x.extra && <div className="text-xs text-muted-foreground font-mono">{x.extra}</div>}
                    </div>
                ))}
            </div>

            <div className="p-4 space-y-3">
                <div className={SPLIT_GRID}>
                    {/* 신용 채무 */}
                    <div className="min-w-0">
                        <div className={LABEL}>신용 채무 (금융사·카드론·대부업 등, 바로 고칠 수 있음)</div>
                        <div className="space-y-1.5 mb-2">
                            {(!c.creditLoan || c.creditLoan.length === 0) && (
                                <p className="text-xs text-muted-foreground py-2 text-center bg-muted/20 rounded-lg border border-dashed border-border">아직 입력한 채무가 없습니다. 채권자별로 하나씩 넣으세요.</p>
                            )}
                            {c.creditLoan?.map((loan) => (
                                <LoanRow key={loan.id} loan={loan}
                                    onSave={l => onUpdate('creditLoan', (c.creditLoan || []).map(x => x.id === l.id ? l : x))}
                                    onRemove={() => onUpdate('creditLoan', (c.creditLoan || []).filter(x => x.id !== loan.id))} />
                            ))}
                        </div>
                        <div className="flex gap-1.5">
                            <input
                                type="text"
                                placeholder="예: 국민카드 카드론, 러시앤캐시"
                                aria-label="새 채무 금융사·종류"
                                className={`flex-1 min-w-0 ${SMALL_CONTROL}`}
                                value={newCreditLoan.desc || ''}
                                onChange={e => setNewCreditLoan({ ...newCreditLoan, desc: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddCreditLoan(); }}
                            />
                            <MoneyField value={newCreditLoan.amount || 0} onChange={v => setNewCreditLoan({ ...newCreditLoan, amount: v })} placeholder="금액(만원)" className="w-28" />
                            <button type="button" onClick={handleAddCreditLoan} className="h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-3 rounded-lg text-xs flex items-center gap-1 shrink-0 transition-colors shadow-2xs">
                                <Plus size={13} strokeWidth={1.75} /> 추가
                            </button>
                        </div>
                    </div>

                    {/* 카드 · 월 상환 · 재산 */}
                    <div className="min-w-0 space-y-3">
                        <div className={FIELD_GRID}>
                            <Choice label="신용카드 사용" options={['사용', '미사용']} value={c.creditCardUse} onPick={v => onUpdate('creditCardUse', v)} />
                            {c.creditCardUse === '사용' && (
                                <SmartInput compact label="카드 사용 금액" type="number" value={c.creditCardAmount} onChange={(v: any) => onUpdate('creditCardAmount', v)} suffix="만원" isCurrency updateOnBlur />
                            )}
                            <SmartInput compact label="월 총 대출 납입액" type="number" value={c.loanMonthlyPay} onChange={(v: any) => onUpdate('loanMonthlyPay', v)} suffix="만원" isCurrency updateOnBlur needed />
                        </div>

                        <div>
                            <div className={LABEL}>재산 (본인·배우자)</div>
                            <div className="space-y-1.5 mb-2">
                                {(!c.assets || c.assets.length === 0) && (
                                    <p className="text-xs text-muted-foreground py-2 text-center bg-muted/20 rounded-lg border border-dashed border-border">재산이 없으면 상담 메모에 "재산 없음"이라고 적어 두세요.</p>
                                )}
                                {c.assets?.map((asset: AssetItem) => (
                                    <div key={asset.id} className="bg-muted/30 px-2.5 py-1.5 rounded-lg border border-border flex justify-between items-center gap-2 text-xs">
                                        <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                                            <span className="font-semibold text-foreground truncate">
                                                <span className="text-primary mr-1">[{asset.owner}]</span>{asset.type}
                                                {asset.desc && <span className="text-muted-foreground font-normal ml-1">({asset.desc})</span>}
                                            </span>
                                            <span className="text-muted-foreground tabular-nums font-mono">시세 <b>{asset.amount > 0 ? formatKoreanMoney(asset.amount) : '-'}</b></span>
                                            {asset.loanAmount > 0 && <span className="text-foreground font-semibold tabular-nums font-mono">담보 {formatKoreanMoney(asset.loanAmount)}</span>}
                                            {!!asset.rentDeposit && asset.rentDeposit > 0 && <span className="text-foreground font-semibold tabular-nums font-mono">전세 {formatKoreanMoney(asset.rentDeposit)}</span>}
                                        </div>
                                        <button type="button" onClick={() => handleRemoveAsset(asset.id)} className="p-1 text-muted-foreground hover:text-destructive rounded" title="삭제" aria-label="삭제"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                            <div className="p-2.5 bg-muted/20 rounded-lg border border-border grid grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-1.5">
                                <select className={SMALL_CONTROL} aria-label="재산 명의"
                                    value={newAsset.owner} onChange={e => setNewAsset({ ...newAsset, owner: e.target.value as any })}>
                                    {ASSET_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                                <select className={SMALL_CONTROL} aria-label="재산 종류"
                                    value={newAsset.type} onChange={e => setNewAsset({ ...newAsset, type: e.target.value })}>
                                    {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <MoneyField value={newAsset.amount || 0} onChange={v => setNewAsset({ ...newAsset, amount: v })} placeholder="시세 (만원)" />
                                <MoneyField value={newAsset.loanAmount || 0} onChange={v => setNewAsset({ ...newAsset, loanAmount: v })} placeholder="담보대출 (만원)" />
                                {['부동산', '토지'].includes(newAsset.type || '') && (
                                    <MoneyField value={newAsset.rentDeposit || 0} onChange={v => setNewAsset({ ...newAsset, rentDeposit: v })} placeholder="세입자 전세금 (만원)" className="col-span-2" />
                                )}
                                <div className="col-span-full flex gap-1.5">
                                    <input type="text" placeholder="차종·연식, 지번 등" aria-label="재산 설명"
                                        className={`flex-1 min-w-0 ${SMALL_CONTROL}`}
                                        value={newAsset.desc || ''} onChange={e => setNewAsset({ ...newAsset, desc: e.target.value })} />
                                    <button type="button" onClick={handleAddAsset} className="h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-3 rounded-lg text-xs flex items-center gap-1 shrink-0 transition-colors shadow-2xs">
                                        <Plus size={13} strokeWidth={1.75} /> 추가
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-3 py-2 bg-muted/30 rounded-lg text-xs border border-border">
                    <span className="font-semibold text-foreground">담보 채무 자동 집계: </span>
                    <span className="text-muted-foreground font-mono">{autoCollateralString}</span>
                </div>
            </div>
        </SectionCard>
    );
};
