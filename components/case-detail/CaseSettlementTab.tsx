import React, { useEffect, useState } from 'react';
import { Plus, X, Calendar, FileText, CheckCircle, Clock } from 'lucide-react';
import { SmartInput } from '../ui/SmartInput';
import { Case, SettlementBatch, Partner } from '../../types';
import { findBatchForCase, getSettlementStatusLabel } from '../../services/api';
import { computeCaseCommission, todayKST, fmtMan, VAT_LABEL, vatModeOf } from '../../utils/settlement';
import { SectionCard, Field, FIELD_GRID, CONTROL_PLAIN, LABEL } from './detailUi';

interface CaseSettlementTabProps {
    c: Case;
    commission: number;
    onUpdate: (field: string, value: any) => void;
    partner?: Partner;
}

type Deposit = { date: string; amount: number; memo?: string };

/** 입금 한 줄: 입력하는 동안은 화면에만, 칸을 벗어나면 저장 (예전엔 글자 칠 때마다 저장 요청) */
const DepositRow: React.FC<{ idx: number; d: Deposit; removable: boolean; onSave: (d: Deposit) => void; onRemove: () => void }> = ({ idx, d, removable, onSave, onRemove }) => {
    const [amount, setAmount] = useState<number>(d.amount || 0);
    const [date, setDate] = useState<string>(d.date || '');
    useEffect(() => { setAmount(d.amount || 0); setDate(d.date || ''); }, [d.amount, d.date]);
    const commit = (next: Partial<Deposit>) => {
        const merged = { ...d, amount, date, ...next };
        if (merged.amount !== (d.amount || 0) || merged.date !== (d.date || '')) onSave(merged);
    };
    const future = !!date && date > todayKST();
    return (
        <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/30 px-3 py-2.5">
            <div className="flex justify-between items-center mb-1.5">
                <h4 className="font-semibold text-slate-700 dark:text-gray-200 text-xs">
                    {idx + 1}차 입금 {future && <span className="ml-1 font-normal text-slate-400">입금 예정</span>}
                </h4>
                {removable && <button onClick={onRemove} className="text-slate-300 hover:text-red-500" aria-label={`${idx + 1}차 입금 줄 삭제`}><X size={15} /></button>}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
                <input inputMode="numeric" aria-label={`${idx + 1}차 입금 금액(만원)`} placeholder="금액 (만원)"
                    className={`${CONTROL_PLAIN} font-bold text-right tabular-nums`}
                    value={amount ? amount.toLocaleString() : ''}
                    onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setAmount(v ? Number(v) : 0); }}
                    onBlur={() => commit({})} />
                <input type="date" aria-label={`${idx + 1}차 입금일`}
                    className={`${CONTROL_PLAIN} px-2`}
                    value={date} onChange={e => { setDate(e.target.value); commit({ date: e.target.value }); }} />
            </div>
        </div>
    );
};

/**
 * 리드 상세 → 수임료/정산 탭
 * [2026-11-01] 넓은 화면에서 계약·수임료와 받을 수수료를 나란히, 입금 줄은 한 줄에 여러 개.
 * 정산 배치 정보는 한 줄로. 색은 상태(배치 상태·수당 0원 경고)에만 쓴다.
 */
export const CaseSettlementTab: React.FC<CaseSettlementTabProps> = ({
    c,
    commission,
    onUpdate,
    partner
}) => {
    const cc = computeCaseCommission(c, partner);
    const deposits: Deposit[] = (c.depositHistory && c.depositHistory.length > 0)
        ? c.depositHistory.map(d => ({ ...d }))
        : [
            { date: c.deposit1Date || '', amount: c.deposit1Amount || 0 },
            { date: c.deposit2Date || '', amount: c.deposit2Amount || 0 }
        ];
    const saveDeposits = (next: Deposit[]) => onUpdate('depositHistory', next);
    const [settlementBatch, setSettlementBatch] = useState<SettlementBatch | null>(null);
    const [isLoadingBatch, setIsLoadingBatch] = useState(true);
    const contractId = React.useId();
    const installmentId = React.useId();

    useEffect(() => {
        const loadBatch = async () => {
            setIsLoadingBatch(true);
            const batch = await findBatchForCase(c.caseId);
            setSettlementBatch(batch);
            setIsLoadingBatch(false);
        };
        loadBatch();
    }, [c.caseId]);

    // Get status badge color
    const getStatusBadgeColor = (status: string) => {
        const colors: Record<string, string> = {
            draft: 'bg-gray-100 text-gray-600',
            confirmed: 'bg-blue-100 text-blue-700',
            invoiced: 'bg-yellow-100 text-yellow-700',
            collected: 'bg-green-100 text-green-700',
            paid: 'bg-purple-100 text-purple-700',
            completed: 'bg-emerald-100 text-emerald-700'
        };
        return colors[status] || 'bg-gray-100 text-gray-600';
    };

    // 오늘(한국 날짜)까지 들어온 입금만 합산
    const depositedTotal = deposits
        .filter(d => d.date && d.date <= todayKST())
        .reduce((sum, d) => sum + (d.amount || 0), 0);

    return (
        <div className="space-y-3">
            {/* 정산 배치 정보 (한 줄) */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                <span className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-gray-100">
                    <Calendar size={15} className="text-blue-600" aria-hidden /> 정산 배치
                </span>
                {isLoadingBatch ? (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500"><Clock size={13} className="animate-spin" aria-hidden /> 불러오는 중…</span>
                ) : settlementBatch ? (
                    <>
                        <span className="font-semibold text-blue-800 dark:text-blue-300">{settlementBatch.weekLabel}</span>
                        <span className="text-xs text-slate-500 tabular-nums">{settlementBatch.startDate} ~ {settlementBatch.endDate}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getStatusBadgeColor(settlementBatch.status)}`}>{getSettlementStatusLabel(settlementBatch.status)}</span>
                        {settlementBatch.invoiceInfo?.approvalNumber && (
                            <span className="flex items-center gap-1 text-xs text-green-700">
                                <FileText size={13} aria-hidden /> 세금계산서 발행 ({settlementBatch.invoiceInfo.issueDate}) · 승인번호 {settlementBatch.invoiceInfo.approvalNumber}
                            </span>
                        )}
                        {settlementBatch.collectionInfo?.collectedAt && (
                            <span className="flex items-center gap-1 text-xs text-green-700">
                                <CheckCircle size={13} aria-hidden /> 수금 완료 ({settlementBatch.collectionInfo.collectedAt}) <b className="tabular-nums">{settlementBatch.collectionInfo.amount?.toLocaleString()}만원</b>
                            </span>
                        )}
                    </>
                ) : (
                    <span className="text-xs text-slate-500">
                        아직 정산 배치에 포함되지 않았습니다.
                        {c.contractAt && <span className="text-slate-400 ml-1">(계약일 {c.contractAt} 기준 주차에 자동 배정 예정)</span>}
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                {/* 계약 및 수임료 */}
                <SectionCard title="계약 및 수임료" meta={commission > 0 ? `예상 수당 ${commission.toLocaleString()}만원` : undefined}>
                    <div className={FIELD_GRID}>
                        <Field label="계약완료일 (정산 기준)" htmlFor={contractId}>
                            <input
                                id={contractId}
                                type="date"
                                className={`${CONTROL_PLAIN} px-2`}
                                value={c.contractAt || ''}
                                onChange={e => onUpdate('contractAt', e.target.value)}
                            />
                        </Field>
                        <SmartInput
                            compact
                            label="총 수임료"
                            type="number"
                            value={c.contractFee || 0}
                            onChange={(v: any) => onUpdate('contractFee', Number(v))}
                            updateOnBlur={true}
                            suffix="만원"
                            isCurrency={true}
                            placeholder="0"
                        />
                        <div className="min-w-0">
                            <div className={`${LABEL} justify-between`}>
                                <label htmlFor={installmentId}>분납 개월</label>
                                <label className="flex items-center gap-1 cursor-pointer font-normal text-blue-700 dark:text-blue-300">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox h-3 w-3"
                                        checked={c.useCapital || false}
                                        onChange={e => onUpdate('useCapital', e.target.checked)}
                                    />
                                    캐피탈
                                </label>
                            </div>
                            <select
                                id={installmentId}
                                className={CONTROL_PLAIN}
                                value={c.installmentMonths || ''}
                                onChange={e => onUpdate('installmentMonths', e.target.value)}
                            >
                                <option value="">선택</option>
                                {!c.useCapital && <option value="완납">완납</option>}
                                {Array.from({ length: 8 }, (_, i) => i + 1).map(num => (
                                    (c.useCapital || num >= 2) ? (
                                        <option key={num} value={`${num} 개월`}>{num}개월</option>
                                    ) : null
                                ))}
                            </select>
                        </div>
                        <div className="min-w-0">
                            <div className={LABEL}>예상 수당</div>
                            <div className={`h-9 flex items-center justify-end px-2.5 rounded-lg bg-slate-50 dark:bg-gray-900/40 text-base font-bold tabular-nums ${commission > 0 ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>
                                {commission.toLocaleString()}만원
                            </div>
                        </div>
                    </div>
                    {commission === 0 && (c.contractFee || 0) > 0 && (
                        <p className="text-xs text-red-600 mt-3 bg-red-50 p-2 rounded-lg border border-red-200">
                            ⚠️ 수당이 0원입니다. 상담 정보 탭에서 거래처를 올바르게 골랐는지, 설정 → 거래처 → 수당 계산 룰을 확인하세요.
                        </p>
                    )}
                </SectionCard>

                {/* 이 리드로 사무실에서 받을 수수료 (정산 → 받을 돈과 같은 계산) */}
                <SectionCard title="받을 수수료" meta={partner ? `${partner.name} · ${VAT_LABEL[vatModeOf(partner)]}` : undefined}>
                    {cc.problem ? (
                        <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">{cc.problem === '수당 룰 없음' ? '수임료에 맞는 수당 룰이 없습니다. 설정 → 거래처 → 수당 계산 룰을 확인하세요.' : cc.problem === '거래처 없음' ? '거래처를 먼저 고르세요.' : '총 수임료를 넣으면 계산합니다.'}</p>
                    ) : (
                        <div className="space-y-2 text-sm">
                            <div className="text-slate-600 dark:text-gray-300">
                                전체 수수료 <b className="text-slate-900 dark:text-white tabular-nums">{fmtMan(cc.total)}</b> · 고객 입금 <span className="tabular-nums">{fmtMan(cc.depositActual)}</span>{cc.depositPlanned > 0 && <span className="tabular-nums"> (예정 {fmtMan(cc.depositPlanned)})</span>}
                                <span className="block text-xs text-slate-400 mt-0.5">계약금 단계 기준 {fmtMan(cc.firstThreshold)} 입금 · 완납 단계 기준 {fmtMan(cc.fullThreshold)} 입금</span>
                            </div>
                            {cc.stages.length === 0 ? (
                                <p className="text-slate-400 text-xs">아직 지급 사유가 없습니다. 고객 입금이 {fmtMan(cc.firstThreshold)} 이상이 되면 1단계가 생깁니다.</p>
                            ) : (
                                <ul className="divide-y divide-slate-100 dark:divide-gray-700 rounded-lg border border-slate-200 dark:border-gray-700">
                                    {cc.stages.map(s => (
                                        <li key={s.key} className="px-3 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                            <span className="font-semibold text-slate-800 dark:text-gray-100">{s.stageLabel}</span>
                                            <span className="tabular-nums">{fmtMan(s.amount)} → 청구 {fmtMan(s.billed)}</span>
                                            <span className="ml-auto text-xs text-slate-500 tabular-nums">{s.future ? '입금 예정 ' : ''}{s.earnedAt} 입금 기준 · 받을 날 {s.dueAt}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <p className="text-xs text-slate-400">받은 돈 기록과 미수금은 정산 → 받을 돈에서 사무실별로 관리합니다.</p>
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* 고객 입금 내역 */}
            <SectionCard
                title={<>고객 입금 내역 <span className="text-xs font-normal text-slate-400">(고객 → 사무실)</span></>}
                meta={<span className="text-sm">누적 입금 <b className="text-blue-600 dark:text-blue-400">{depositedTotal.toLocaleString()}만원</b></span>}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
                    {deposits.map((d, idx) => (
                        <DepositRow key={idx} idx={idx} d={d} removable={idx >= 2}
                            onSave={nd => saveDeposits(deposits.map((x, i) => i === idx ? nd : x))}
                            onRemove={() => saveDeposits(deposits.filter((_, i) => i !== idx))} />
                    ))}
                    <button
                        type="button"
                        onClick={() => saveDeposits([...deposits, { date: '', amount: 0 }])}
                        className="min-h-[76px] rounded-xl border border-dashed border-slate-300 dark:border-gray-600 text-sm font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 flex items-center justify-center gap-1"
                    >
                        <Plus size={15} /> {deposits.length + 1}차 입금 추가
                    </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">누적 입금은 오늘(한국 날짜)까지 들어온 입금만 더합니다. 날짜가 오늘 이후면 "입금 예정"입니다.</p>
            </SectionCard>
        </div>
    );
};
