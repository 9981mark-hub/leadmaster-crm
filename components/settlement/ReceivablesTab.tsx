import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Plus, Trash2, Copy, Download, Landmark, AlertTriangle, ChevronRight, X, Loader2 } from 'lucide-react';
import { Case, Partner } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import {
  Collection, PartnerLedger, buildPartnerLedger, todayKST, fmtMan, statementText, vatModeOf, VAT_LABEL, daysBetween,
} from '../../utils/settlement';
import { fetchCollections, addCollection, deleteCollection } from '../../services/settlementLedger';
import { fetchBankTransactions, matchTransactionsWithPartners } from '../../services/api';
import { exportToExcel } from '../../utils/xlsxExport';

interface Props { cases: Case[]; partners: Partner[]; }

const STATE_CLS: Record<string, string> = {
  '받음': 'text-emerald-700 bg-emerald-50',
  '일부 받음': 'text-amber-800 bg-amber-50',
  '연체': 'text-red-700 bg-red-50',
  '받을 예정': 'text-slate-700 bg-slate-100',
};
const md = (ymd?: string) => (ymd ? `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}` : '-');
const num = 'tabular-nums';

/** 정산 → 받을 돈: 변호사 사무실별 청구·받은 돈·미수금·연체 + 받은 돈 기록 + 월 정산서 */
export default function ReceivablesTab({ cases, partners }: Props) {
  const { showToast } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>('');
  const today = todayKST();

  useEffect(() => {
    fetchCollections().then(setCollections).catch(e => showToast(`받은 돈 기록을 불러오지 못했습니다: ${e.message}`, 'error')).finally(() => setLoading(false));
  }, [showToast]);

  const ledgers = useMemo(
    () => partners.filter(p => p.active !== false).map(p => buildPartnerLedger(p, cases, collections, today))
      .filter(lg => lg.lines.length + lg.planned.length + lg.problems.length > 0 || collections.some(c => c.partnerId === lg.partner.partnerId)),
    [partners, cases, collections, today],
  );
  const totals = useMemo(() => ({
    outstanding: ledgers.reduce((s, l) => s + Math.max(0, l.outstanding), 0),
    overdue: ledgers.reduce((s, l) => s + l.overdue, 0),
    dueSoon: ledgers.reduce((s, l) => s + l.dueSoon, 0),
    thisMonth: ledgers.reduce((s, l) => s + l.lines.filter(x => x.earnedAt.startsWith(today.slice(0, 7))).reduce((a, x) => a + x.billed, 0), 0),
    planned: ledgers.reduce((s, l) => s + l.planned.reduce((a, x) => a + x.billed, 0), 0),
  }), [ledgers, today]);

  const current = ledgers.find(l => l.partner.partnerId === selected) || null;

  if (loading) return <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> 불러오는 중…</div>;

  return (
    <div className="space-y-5">
      {/* 한눈에: 지금 받을 돈 */}
      <section className="rounded-2xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 p-5">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <div className="text-sm text-slate-500">사무실에서 아직 받지 못한 돈</div>
            <div className={`text-4xl font-extrabold text-slate-900 dark:text-white ${num}`}>{fmtMan(Math.round(totals.outstanding * 10) / 10)}</div>
          </div>
          <Stat label="받기로 한 날 지남" value={totals.overdue} tone={totals.overdue > 0 ? 'red' : 'plain'} />
          <Stat label="7일 안에 받을 돈" value={totals.dueSoon} />
          <Stat label="이번 달 새로 생긴 청구" value={totals.thisMonth} />
          <Stat label="고객 입금 예정으로 생길 돈" value={totals.planned} tone="muted" />
        </div>
        <p className="text-xs text-slate-400 mt-3">고객이 사무실에 낸 입금(리드 상세 → 수임료/정산)과 거래처별 수당 룰로 계산합니다. 받은 돈을 기록하면 오래된 청구부터 차감합니다.</p>
      </section>

      {/* 사무실별 */}
      <section className="rounded-2xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-gray-700/40 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-4 py-2">사무실</th>
              <th className="text-right px-3 py-2">청구할 금액</th>
              <th className="text-right px-3 py-2">받은 돈</th>
              <th className="text-right px-3 py-2">남은 돈</th>
              <th className="text-right px-3 py-2">연체</th>
              <th className="text-left px-3 py-2">다음 받을 날</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
            {ledgers.map(lg => (
              <tr key={lg.partner.partnerId} onClick={() => setSelected(lg.partner.partnerId)}
                className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/40 ${selected === lg.partner.partnerId ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}>
                <td className="px-4 py-3 font-semibold text-slate-800 dark:text-gray-100">
                  {lg.partner.name}
                  <span className="ml-2 text-[11px] font-normal text-slate-400">{VAT_LABEL[vatModeOf(lg.partner)]}</span>
                  {lg.problems.length > 0 && <span className="ml-2 text-[11px] font-normal text-amber-700">확인 필요 {lg.problems.length}건</span>}
                </td>
                <td className={`px-3 py-3 text-right ${num}`}>{fmtMan(lg.billedTotal)}</td>
                <td className={`px-3 py-3 text-right text-emerald-700 ${num}`}>{fmtMan(lg.receivedTotal)}</td>
                <td className={`px-3 py-3 text-right font-bold ${lg.outstanding > 0 ? 'text-slate-900 dark:text-white' : 'text-emerald-700'} ${num}`}>
                  {lg.outstanding < 0 ? `더 받음 ${fmtMan(-lg.outstanding)}` : fmtMan(lg.outstanding)}
                </td>
                <td className={`px-3 py-3 text-right ${lg.overdue > 0 ? 'text-red-600 font-semibold' : 'text-slate-300'} ${num}`}>{lg.overdue > 0 ? fmtMan(lg.overdue) : '-'}</td>
                <td className="px-3 py-3 text-slate-600">{lg.nextDueAt ? `${md(lg.nextDueAt)} (${daysBetween(today, lg.nextDueAt)}일 뒤)` : '-'}</td>
                <td className="px-3 py-3 text-slate-400"><ChevronRight size={16} /></td>
              </tr>
            ))}
            {ledgers.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">아직 계산할 계약이 없습니다. 리드 상세 → 수임료/정산에 계약일·수임료·고객 입금을 넣으면 여기에 나옵니다.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {current && (
        <PartnerDetail lg={current} today={today} onClose={() => setSelected('')}
          onCollectionsChange={setCollections} collections={collections.filter(c => c.partnerId === current.partner.partnerId)} />
      )}
    </div>
  );
}

function Stat({ label, value, tone = 'plain' }: { label: string; value: number; tone?: 'plain' | 'red' | 'muted' }) {
  const color = tone === 'red' ? 'text-red-600' : tone === 'muted' ? 'text-slate-400' : 'text-slate-800 dark:text-gray-100';
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-bold ${color} ${num}`}>{fmtMan(Math.round(value * 10) / 10)}</div>
    </div>
  );
}

function PartnerDetail({ lg, today, collections, onCollectionsChange, onClose }: {
  lg: PartnerLedger; today: string; collections: Collection[]; onCollectionsChange: (c: Collection[]) => void; onClose: () => void;
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ date: today, amount: '', memo: '' });
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [showBank, setShowBank] = useState(false);
  const p = lg.partner;
  const bankText = p.bankInfo ? `${p.bankInfo.bankName} ${p.bankInfo.accountNumber} (${p.bankInfo.accountHolder})` : '';

  const save = async (row: { date: string; amount: number; memo?: string; bankTxId?: string }) => {
    setSaving(true);
    try {
      onCollectionsChange(await addCollection({ partnerId: p.partnerId, ...row }));
      showToast(`${p.name}에서 받은 ${fmtMan(row.amount)}을 기록했습니다.`);
      setForm({ date: today, amount: '', memo: '' });
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally { setSaving(false); }
  };

  const bankRows = useMemo(() => {
    if (!showBank) return [];
    const year = Number(today.slice(0, 4));
    const txs = matchTransactionsWithPartners([...fetchBankTransactions(year), ...fetchBankTransactions(year - 1)], [p]);
    const used = new Set(collections.map(c => c.bankTxId).filter(Boolean));
    return txs.filter(t => t.type === 'income' && t.matchedPartnerId === p.partnerId && !used.has(t.id)).slice(0, 30);
  }, [showBank, collections, p, today]);

  const stmt = useMemo(() => statementText(lg, month, { bank: bankText }), [lg, month, bankText]);
  const monthRows = lg.lines.filter(l => l.earnedAt.startsWith(month));

  return (
    <section className="rounded-2xl bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 shadow-sm">
      <header className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex flex-wrap items-center gap-3">
        <Wallet size={18} className="text-slate-700 dark:text-gray-200" />
        <h3 className="font-bold text-lg text-slate-900 dark:text-white">{p.name}</h3>
        <span className={`text-sm text-slate-500 ${num}`}>청구 {fmtMan(lg.billedTotal)} · 받음 {fmtMan(lg.receivedTotal)} · <b className="text-slate-900 dark:text-white">남음 {fmtMan(Math.max(0, lg.outstanding))}</b></span>
        <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-slate-100 dark:hover:bg-gray-700" aria-label="닫기"><X size={18} /></button>
      </header>

      <div className="p-5 grid xl:grid-cols-3 gap-6">
        {/* 청구 내역 */}
        <div className="xl:col-span-2 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-gray-200 mb-2">청구 내역 <span className="font-normal text-slate-400">(받은 돈은 받기로 한 날이 빠른 것부터 차감)</span></h4>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-gray-700/40 text-xs text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2">고객</th><th className="text-left px-2">단계</th>
                    <th className="text-left px-2">생긴 날</th><th className="text-left px-2">받을 날</th>
                    <th className="text-right px-2">청구</th><th className="text-right px-2">남음</th><th className="text-left px-3">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                  {[...lg.lines].reverse().map(l => (
                    <tr key={l.key} className={l.cancelled ? 'bg-amber-50/50' : ''}>
                      <td className="px-3 py-2"><Link to={`/case/${l.caseId}`} className="font-medium text-slate-800 dark:text-gray-100 hover:underline">{l.customerName}</Link>
                        {l.cancelled && <span className="ml-1 text-[11px] text-amber-700">({l.status})</span>}</td>
                      <td className="px-2 text-slate-600 text-xs">{l.stageLabel}</td>
                      <td className={`px-2 text-slate-500 ${num}`}>{md(l.earnedAt)}</td>
                      <td className={`px-2 text-slate-500 ${num}`}>{md(l.dueAt)}</td>
                      <td className={`px-2 text-right ${num}`}>{fmtMan(l.billed)}</td>
                      <td className={`px-2 text-right font-semibold ${num}`}>{l.outstanding > 0 ? fmtMan(l.outstanding) : '-'}</td>
                      <td className="px-3"><span className={`text-xs px-1.5 py-0.5 rounded ${STATE_CLS[l.state]}`}>{l.state}{l.state === '연체' ? ` ${l.overdueDays}일` : ''}</span></td>
                    </tr>
                  ))}
                  {lg.lines.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">아직 지급 사유가 생긴 건이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {lg.planned.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-gray-200 mb-2">고객 입금 예정으로 생길 청구</h4>
              <ul className="text-sm divide-y divide-slate-100 dark:divide-gray-700 rounded-lg border border-slate-200 dark:border-gray-700">
                {lg.planned.map(l => (
                  <li key={l.key} className="px-3 py-2 flex items-center gap-3">
                    <Link to={`/case/${l.caseId}`} className="font-medium hover:underline">{l.customerName}</Link>
                    <span className="text-xs text-slate-500">{l.stageLabel}</span>
                    <span className={`ml-auto text-slate-500 ${num}`}>입금 {md(l.earnedAt)} → 받을 날 {md(l.dueAt)}</span>
                    <span className={`w-24 text-right ${num}`}>{fmtMan(l.billed)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(lg.problems.length > 0 || lg.cancelledWithCommission.length > 0) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm space-y-1">
              <div className="font-semibold text-amber-900 flex items-center gap-1"><AlertTriangle size={14} /> 확인이 필요한 건</div>
              {lg.problems.map(x => (
                <div key={x.caseId}><Link to={`/case/${x.caseId}`} className="underline">{x.customerName}</Link> — {x.problem === '수당 룰 없음' ? '수임료에 맞는 수당 룰이 없습니다 (설정 → 거래처 → 수당 계산 룰)' : x.problem}</div>
              ))}
              {lg.cancelledWithCommission.map(l => (
                <div key={l.key}><Link to={`/case/${l.caseId}`} className="underline">{l.customerName}</Link> — {l.status} 상태인데 {l.stageLabel} {fmtMan(l.billed)}이 계산됐습니다. 사무실과 환불·환수 여부를 확인하세요.</div>
              ))}
            </div>
          )}
        </div>

        {/* 받은 돈 + 정산서 */}
        <div className="space-y-5">
          <div className="rounded-xl bg-slate-50 dark:bg-gray-900/40 p-4 space-y-2">
            <h4 className="text-sm font-bold text-slate-700 dark:text-gray-200">받은 돈 기록</h4>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="border border-slate-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700" />
              <div className="relative">
                <input inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="금액" className={`w-full border border-slate-300 dark:border-gray-600 rounded px-2 py-1.5 pr-10 text-sm text-right dark:bg-gray-700 ${num}`} />
                <span className="absolute right-2 top-1.5 text-xs text-slate-400">만원</span>
              </div>
            </div>
            <input value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })} placeholder="메모 (예: 10월분 일부)" className="w-full border border-slate-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700" />
            <div className="flex gap-2">
              <button disabled={saving || !(Number(form.amount) > 0)} onClick={() => save({ date: form.date, amount: Number(form.amount), memo: form.memo.trim() || undefined })}
                className="flex-1 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-1"><Plus size={14} /> 기록하기</button>
              <button onClick={() => setShowBank(v => !v)} className="px-3 py-2 rounded-lg border border-slate-300 text-sm flex items-center gap-1" title="정산 → 지출 탭에 올린 통장 내역 중 이 사무실 입금"><Landmark size={14} /> 통장에서</button>
            </div>
            {showBank && (
              <div className="max-h-48 overflow-y-auto text-xs space-y-1 pt-1">
                {bankRows.length === 0 && <p className="text-slate-400">이 사무실 입금으로 찾은 통장 내역이 없습니다. (설정 → 거래처 → 입금자명, 정산 → 지출 탭에서 통장 엑셀 업로드)</p>}
                {bankRows.map(t => (
                  <div key={t.id} className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded px-2 py-1">
                    <span className={num}>{t.date}</span><span className="truncate">{t.counterparty}</span>
                    <span className={`ml-auto ${num}`}>{t.amount.toLocaleString()}원</span>
                    <button disabled={saving} onClick={() => save({ date: t.date, amount: Math.round(t.amount / 1000) / 10, memo: `통장: ${t.counterparty}`, bankTxId: t.id })} className="text-blue-600 font-semibold">기록</button>
                  </div>
                ))}
              </div>
            )}
            {collections.length > 0 && (
              <ul className="pt-2 text-xs divide-y divide-slate-200 dark:divide-gray-700">
                {collections.slice(0, 12).map(c => (
                  <li key={c.id} className="py-1.5 flex items-center gap-2">
                    <span className={`text-slate-500 ${num}`}>{c.date}</span>
                    <span className="truncate text-slate-500">{c.memo}</span>
                    <span className={`ml-auto font-semibold ${num}`}>{fmtMan(c.amount)}</span>
                    <button onClick={async () => { if (!window.confirm(`${c.date} ${fmtMan(c.amount)} 기록을 지울까요?`)) return; try { onCollectionsChange(await deleteCollection(c.id)); } catch (e: any) { showToast(e.message, 'error'); } }}
                      className="text-slate-300 hover:text-red-600" aria-label="기록 삭제"><Trash2 size={13} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-gray-700 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-700 dark:text-gray-200">월 정산서</h4>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="ml-auto border border-slate-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700" />
            </div>
            <pre className="text-xs whitespace-pre-wrap font-sans bg-slate-50 dark:bg-gray-900/40 rounded p-3 max-h-64 overflow-y-auto text-slate-700 dark:text-gray-200">{stmt}</pre>
            <div className="flex gap-2">
              <button onClick={async () => { try { await navigator.clipboard.writeText(stmt); showToast('정산서를 복사했습니다. 카톡·텔레그램에 붙여넣으세요.'); } catch { showToast('복사하지 못했습니다.', 'error'); } }}
                className="flex-1 py-2 rounded-lg border border-slate-300 text-sm flex items-center justify-center gap-1"><Copy size={14} /> 글 복사</button>
              <button onClick={() => {
                if (monthRows.length === 0) return showToast('이 달에 생긴 청구가 없습니다.', 'error');
                exportToExcel(`${p.name}_정산서_${month}`, monthRows.map(l => ({
                  '고객': l.customerName, '계약일': l.contractAt || '', '수임료(만원)': l.contractFee, '단계': l.stageLabel,
                  '수수료(만원)': l.amount, '청구액(만원)': l.billed, '지급 사유 발생일': l.earnedAt, '받을 날': l.dueAt,
                  '받은 금액(만원)': l.received, '남은 금액(만원)': l.outstanding, '상태': l.state, '리드 상태': l.status,
                })), `${month}`);
              }} className="flex-1 py-2 rounded-lg border border-slate-300 text-sm flex items-center justify-center gap-1"><Download size={14} /> 엑셀</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
