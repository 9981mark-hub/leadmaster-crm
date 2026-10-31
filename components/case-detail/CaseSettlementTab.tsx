import React, { useEffect, useState } from 'react';
import { Plus, X, Calendar, FileText, CheckCircle, Clock } from 'lucide-react';
import { SmartInput } from '../ui/SmartInput';
import { Case, SettlementBatch, Partner } from '../../types';
import { findBatchForCase, getSettlementStatusLabel } from '../../services/api';
import { computeCaseCommission, todayKST, fmtMan, VAT_LABEL, vatModeOf } from '../../utils/settlement';

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
    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-slate-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-slate-600 dark:text-gray-300 text-sm">{idx + 1}차 입금</h4>
                {removable && <button onClick={onRemove} className="text-slate-300 hover:text-red-500" aria-label="입금 줄 삭제"><X size={16} /></button>}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-500">금액 (만원)
                    <input inputMode="numeric" className="mt-1 w-full p-2 border border-slate-300 dark:border-gray-600 rounded-lg text-sm font-bold text-right tabular-nums dark:bg-gray-900"
                        value={amount ? amount.toLocaleString() : ''}
                        onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setAmount(v ? Number(v) : 0); }}
                        onBlur={() => commit({})} />
                </label>
                <label className="text-xs text-slate-500">입금일
                    <input type="date" className="mt-1 w-full p-2 border border-slate-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-900"
                        value={date} onChange={e => { setDate(e.target.value); commit({ date: e.target.value }); }} />
                </label>
            </div>
            {date && date > todayKST() && <p className="text-[11px] text-slate-400 mt-1">입금 예정 (오늘 이후)</p>}
        </div>
    );
};

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

    return (
        <div className="space-y-6">
            {/* [NEW] Settlement Batch Info Section */}
            <div className="bg-blue-50 p-4 md:p-6 rounded-xl border border-blue-100">
                <h3 className="font-bold text-blue-800 mb-3 text-lg flex items-center">
                    <Calendar className="mr-2" size={20} /> 정산 배치 정보
                </h3>

                {isLoadingBatch ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock size={14} className="animate-spin" />
                        로딩 중...
                    </div>
                ) : settlementBatch ? (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="bg-white px-4 py-2 rounded-lg border border-blue-200 shadow-sm">
                                <span className="text-xs text-gray-500 block">주차</span>
                                <span className="font-bold text-blue-800">{settlementBatch.weekLabel}</span>
                            </div>
                            <div className="bg-white px-4 py-2 rounded-lg border border-blue-200 shadow-sm">
                                <span className="text-xs text-gray-500 block">기간</span>
                                <span className="font-medium text-gray-700 text-sm">
                                    {settlementBatch.startDate} ~ {settlementBatch.endDate}
                                </span>
                            </div>
                            <div className={`px-4 py-2 rounded-lg ${getStatusBadgeColor(settlementBatch.status)}`}>
                                <span className="text-xs block">상태</span>
                                <span className="font-bold">{getSettlementStatusLabel(settlementBatch.status)}</span>
                            </div>
                        </div>

                        {/* Invoice Info */}
                        {settlementBatch.invoiceInfo?.approvalNumber && (
                            <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-green-200">
                                <FileText className="text-green-600" size={18} />
                                <div>
                                    <span className="text-xs text-gray-500 block">세금계산서</span>
                                    <span className="font-medium text-green-700">
                                        발행완료 ({settlementBatch.invoiceInfo.issueDate})
                                    </span>
                                    <span className="text-xs text-gray-500 ml-2">
                                        승인번호: {settlementBatch.invoiceInfo.approvalNumber}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Collection Info */}
                        {settlementBatch.collectionInfo?.collectedAt && (
                            <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-green-200">
                                <CheckCircle className="text-green-600" size={18} />
                                <div>
                                    <span className="text-xs text-gray-500 block">수금</span>
                                    <span className="font-medium text-green-700">
                                        수금완료 ({settlementBatch.collectionInfo.collectedAt})
                                    </span>
                                    <span className="font-bold text-green-800 ml-2">
                                        {settlementBatch.collectionInfo.amount?.toLocaleString()}만원
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-gray-500">
                        <Clock size={16} />
                        <span className="text-sm">아직 정산 배치에 포함되지 않았습니다.</span>
                        {c.contractAt && (
                            <span className="text-xs text-gray-400 ml-2">
                                (계약일: {c.contractAt} 기준 주차에 자동 배정 예정)
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                <h3 className="font-bold text-green-800 mb-4 text-lg">계약 및 수임료</h3>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-green-900 mb-1">계약완료일 (정산기준)</label>
                            <input
                                type="date"
                                className="w-full p-2 border border-green-300 rounded"
                                value={c.contractAt || ''}
                                onChange={e => onUpdate('contractAt', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-green-900 mb-1 flex items-center justify-between">
                                분납 개월
                                <label className="flex items-center gap-1 cursor-pointer text-blue-600 bg-white px-2 py-0.5 rounded border border-blue-100">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox h-3 w-3"
                                        checked={c.useCapital || false}
                                        onChange={e => onUpdate('useCapital', e.target.checked)}
                                    />
                                    <span className="text-xs">캐피탈 사용</span>
                                </label>
                            </label>
                            <select
                                className="w-full p-2 border border-green-300 rounded bg-white"
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
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-green-900 mb-1">총 수임료 (만원)</label>
                        <SmartInput
                            type="number"
                            value={c.contractFee || 0}
                            onChange={(v: any) => onUpdate('contractFee', Number(v))}
                            updateOnBlur={true}
                            className="text-lg font-bold"
                            placeholder="0"
                        />

                        <div className="mt-4 pt-4 border-t border-green-200 flex justify-between items-center">
                            <span className="text-sm text-green-700 font-medium">예상 수당 (Commission):</span>
                            <span className={`text-xl font-bold ${commission > 0 ? 'text-green-900' : 'text-red-500'}`}>{commission.toLocaleString()}만원</span>
                        </div>
                        {commission === 0 && (c.contractFee || 0) > 0 && (
                            <p className="text-xs text-red-500 mt-2 bg-red-50 p-2 rounded border border-red-200">
                                ⚠️ 수당이 0원입니다. &quot;정보 수정&quot; 탭에서 거래처를 올바르게 설정했는지 확인해주세요.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* 이 리드로 사무실에서 받을 수수료 (정산 → 받을 돈과 같은 계산) */}
            <div className="bg-white dark:bg-gray-800 p-4 md:p-5 rounded-xl border border-slate-200 dark:border-gray-700">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                    <h3 className="font-bold text-slate-800 dark:text-gray-100">받을 수수료</h3>
                    {partner && <span className="text-xs text-slate-500">{partner.name} · {VAT_LABEL[vatModeOf(partner)]}</span>}
                </div>
                {cc.problem ? (
                    <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">{cc.problem === '수당 룰 없음' ? '수임료에 맞는 수당 룰이 없습니다. 설정 → 거래처 → 수당 계산 룰을 확인하세요.' : cc.problem === '거래처 없음' ? '거래처를 먼저 고르세요.' : '총 수임료를 넣으면 계산합니다.'}</p>
                ) : (
                    <div className="space-y-2 text-sm">
                        <div className="text-slate-600 dark:text-gray-300">
                            전체 수수료 <b className="text-slate-900 dark:text-white">{fmtMan(cc.total)}</b> · 고객 입금 {fmtMan(cc.depositActual)}{cc.depositPlanned > 0 && ` (예정 ${fmtMan(cc.depositPlanned)})`}
                            <span className="block text-xs text-slate-400 mt-0.5">계약금 단계 기준 {fmtMan(cc.firstThreshold)} 입금 · 완납 단계 기준 {fmtMan(cc.fullThreshold)} 입금</span>
                        </div>
                        {cc.stages.length === 0 ? (
                            <p className="text-slate-400">아직 지급 사유가 없습니다. 고객 입금이 {fmtMan(cc.firstThreshold)} 이상이 되면 1단계가 생깁니다.</p>
                        ) : (
                            <ul className="divide-y divide-slate-100 dark:divide-gray-700 rounded-lg border border-slate-200 dark:border-gray-700">
                                {cc.stages.map(s => (
                                    <li key={s.key} className="px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
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
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/30 p-4 md:p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 text-lg">고객 입금 내역 <span className="text-xs font-normal text-slate-400">(고객 → 사무실)</span></h3>
                    <button
                        onClick={() => saveDeposits([...deposits, { date: '', amount: 0 }])}
                        className="flex items-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-800"
                    >
                        <Plus size={16} /> {deposits.length + 1}차 추가
                    </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    {deposits.map((d, idx) => (
                        <DepositRow key={idx} idx={idx} d={d} removable={idx >= 2}
                            onSave={nd => saveDeposits(deposits.map((x, i) => i === idx ? nd : x))}
                            onRemove={() => saveDeposits(deposits.filter((_, i) => i !== idx))} />
                    ))}
                </div>
                <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center">
                    <span className="font-bold text-gray-700">총 누적 입금액</span>
                    <span className="text-2xl font-bold text-blue-600">
                        {/* 오늘(한국 날짜)까지 들어온 입금만 합산 */}
                        {deposits
                            .filter(d => d.date && d.date <= todayKST())
                            .reduce((sum, d) => sum + (d.amount || 0), 0).toLocaleString()} 만원
                    </span>
                </div>
            </div>
        </div>
    );
};
