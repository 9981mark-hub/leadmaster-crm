import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { formatPhone } from '../../constants';
import { Partner, Case } from '../../types';
import { importCasesToBatch, refreshLocalAssignments } from '../../services/api';
import { createImportBatch, distributeCases, findExistingPhones, updateImportBatch, DistributeMode } from '../../services/distribution';
import { findDncPhones } from '../../services/dnc';

interface Agent { userId: string; displayName: string; }
interface Props {
  agents: Agent[];
  partners: Partner[];
  onClose: () => void;
  onDone: () => void;
}

type Mode = 'none' | 'auto' | DistributeMode;
const MODE_LABEL: Record<Mode, string> = {
  none: '배분 안 함 (미배정으로 넣고 나중에 나눠주기)',
  auto: '자동 배분 규칙대로 (리드 배분 규칙의 방식·상한 적용)',
  round_robin: '고른 상담원에게 순번으로',
  balanced: '고른 상담원 중 진행 중 리드가 적은 사람부터',
  quantity: '상담원마다 건수 정해서',
};

const digits = (v: any) => String(v ?? '').replace(/[^0-9]/g, '').replace(/^82(?=1)/, '0');
const guess = (headers: string[], re: RegExp) => headers.findIndex(h => re.test(h));

/** 팀 관리 → 수신동의 DB 업로드: 열 고르기 → 중복 확인(파일 안 + 회사 전체) → 묶음으로 저장 → 배분 */
export default function LeadUploadModal({ agents, partners, onClose, onDone }: Props) {
  const { showToast } = useToast();
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [col, setCol] = useState({ name: -1, phone: -1, inbound: -1, type: -1 });
  const [memoCols, setMemoCols] = useState<number[]>([]);
  const [batchName, setBatchName] = useState('');
  const [source, setSource] = useState('');
  const [fixedInbound, setFixedInbound] = useState('');
  const [partnerId, setPartnerId] = useState(partners[0]?.partnerId || '');
  const [mode, setMode] = useState<Mode>('none');
  const [picked, setPicked] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [existing, setExisting] = useState<Map<string, any> | null>(null);
  const [dncMap, setDncMap] = useState<Map<string, string> | null>(null);
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: false });
        const hdr = (aoa[0] || []).map((h: any, i: number) => String(h || `열${i + 1}`).trim());
        const body = aoa.slice(1).filter(r => r.some((v: any) => String(v ?? '').trim() !== ''));
        setFileName(f.name);
        setHeaders(hdr);
        setRows(body);
        let phone = guess(hdr, /전화|연락처|휴대|핸드폰|폰번|phone|mobile|tel/i);
        if (phone < 0) {
          // 값이 전화번호처럼 생긴 열
          let best = -1, bestN = 0;
          hdr.forEach((_, i) => {
            const n = body.slice(0, 50).filter(r => /^0?1[0-9]{8,9}$/.test(digits(r[i]))).length;
            if (n > bestN) { best = i; bestN = n; }
          });
          phone = best;
        }
        const name = guess(hdr, /이름|성명|고객|name/i);
        const inbound = guess(hdr, /유입|경로|매체|채널|source|media/i);
        const type = guess(hdr, /유형|사건|구분|type/i);
        setCol({ name, phone, inbound, type });
        setMemoCols(hdr.map((_, i) => i).filter(i => ![name, phone, inbound, type].includes(i)));
        const base = f.name.replace(/\.[^.]+$/, '');
        setBatchName(`${base} (${new Date().toLocaleDateString('ko-KR')})`);
        setExisting(null);
        setResult(null);
      } catch (err: any) {
        showToast(`파일을 읽지 못했습니다: ${err.message}`, 'error');
      }
    };
    reader.readAsArrayBuffer(f);
  };

  // 행 정리 + 파일 안 중복 / 형식 오류
  const parsed = useMemo(() => {
    const seen = new Set<string>();
    return rows.map((r, idx) => {
      const p = col.phone >= 0 ? digits(r[col.phone]) : '';
      const valid = /^0[0-9]{8,10}$/.test(p);
      const dupInFile = valid && seen.has(p);
      if (valid) seen.add(p);
      return { idx, r, phone: p, valid, dupInFile };
    });
  }, [rows, col.phone]);

  const validRows = parsed.filter(x => x.valid && !x.dupInFile);
  const invalidCount = parsed.filter(x => !x.valid).length;
  const fileDupCount = parsed.filter(x => x.dupInFile).length;
  const existingCount = existing ? validRows.filter(x => existing.has(x.phone)).length : 0;
  const dncCount = dncMap ? validRows.filter(x => !existing?.has(x.phone) && dncMap.has(x.phone)).length : 0;
  const toInsert = existing
    ? validRows.filter(x => !existing.has(x.phone) && (!dncMap || !dncMap.has(x.phone)))
    : [];

  const checkExisting = async () => {
    setChecking(true);
    try {
      const [exPhones, dncPhones] = await Promise.all([
        findExistingPhones(validRows.map(x => x.phone)),
        findDncPhones(validRows.map(x => x.phone)),
      ]);
      setExisting(exPhones);
      setDncMap(dncPhones);
    } catch (e: any) {
      showToast(`중복 확인 실패: ${e.message}`, 'error');
    } finally {
      setChecking(false);
    }
  };

  const quantityTotal = picked.reduce((sum, u) => sum + (counts[u] || 0), 0);

  const run = async () => {
    if (!existing) return;
    if (toInsert.length === 0) return showToast('넣을 새 번호가 없습니다', 'error');
    if (['round_robin', 'balanced', 'quantity'].includes(mode) && picked.length === 0) return showToast('나눠줄 상담원을 고르세요', 'error');
    if (!window.confirm(`새 리드 ${toInsert.length}건을 '${batchName}' 묶음으로 넣을까요?\n(중복 ${existingCount + fileDupCount}건, 번호 오류 ${invalidCount}건은 제외)`)) return;
    setRunning(true);
    setProgress('묶음 만드는 중…');
    try {
      const distribution: any = { mode, method: mode, agents: picked, counts: mode === 'quantity' ? picked.map(u => counts[u] || 0) : undefined };
      const batchId = await createImportBatch({ name: batchName.trim() || fileName, source: source.trim(), fileName, totalRows: rows.length, distribution });
      const inbound = (x: any[]) => (col.inbound >= 0 ? String(x[col.inbound] || '').trim() : '') || fixedInbound.trim() || source.trim() || 'DB';
      const payload: Partial<Case>[] = toInsert.map(x => {
        const memo = memoCols
          .map(i => [headers[i], String(x.r[i] ?? '').trim()] as const)
          .filter(([, v]) => v)
          .map(([h, v]) => `${h}: ${v}`)
          .join('\n');
        return {
          customerName: (col.name >= 0 ? String(x.r[col.name] || '').trim() : '') || '이름없음',
          phone: formatPhone(x.phone),
          inboundPath: inbound(x.r),
          caseType: (col.type >= 0 ? String(x.r[col.type] || '').trim() : '') || '개인회생',
          preInfo: [source.trim() ? `DB 출처: ${source.trim()}` : '', memo].filter(Boolean).join('\n'),
          partnerId: partnerId || undefined,
          isNew: true,
        };
      });
      const { created, failed, errors } = await importCasesToBatch(payload, batchId, (d, t) => setProgress(`저장 중… ${d}/${t}`));
      let distSummary = '';
      if (created.length > 0 && ['round_robin', 'balanced', 'quantity'].includes(mode)) {
        setProgress('나눠주는 중…');
        const res = await distributeCases(created.map(c => c.caseId), mode as DistributeMode, picked,
          mode === 'quantity' ? picked.map(u => counts[u] || 0) : undefined, `DB 업로드: ${batchName}`);
        await refreshLocalAssignments(created.map(c => c.caseId));
        distSummary = picked.map(u => `${agents.find(a => a.userId === u)?.displayName || '?'} ${res[u] || 0}건`).join(', ');
        distribution.result = res;
      } else if (mode === 'auto') {
        const per: Record<string, number> = {};
        created.forEach(c => { if (c.assignedUserId) per[c.assignedUserId] = (per[c.assignedUserId] || 0) + 1; });
        const un = created.filter(c => !c.assignedUserId).length;
        distSummary = Object.entries(per).map(([u, n]) => `${agents.find(a => a.userId === u)?.displayName || '?'} ${n}건`).join(', ') + (un ? `, 미배정 ${un}건(상한·받을 사람 없음)` : '');
        distribution.result = per;
      }
      await updateImportBatch(batchId, { inserted: created.length, duplicates: existingCount + fileDupCount, invalid: invalidCount + failed, distribution });
      const msg = `${created.length}건 저장${failed ? `, 실패 ${failed}건 (${errors[0] || ''})` : ''}${distSummary ? ` · 배분: ${distSummary}` : ''}`;
      setResult(msg);
      showToast(msg, failed ? 'error' : 'success');
      onDone();
    } catch (e: any) {
      showToast(`업로드 실패: ${e.message}`, 'error');
    } finally {
      setRunning(false);
      setProgress('');
    }
  };

  const sel = 'border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-white';
  const colSelect = (key: keyof typeof col, label: string, required = false) => (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-24 text-gray-600 dark:text-gray-300">{label}{required && <span className="text-red-500">*</span>}</span>
      <select value={col[key]} onChange={e => { const v = Number(e.target.value); setCol({ ...col, [key]: v }); setMemoCols(m => m.filter(i => i !== v)); setExisting(null); }} className={`${sel} flex-1`}>
        <option value={-1}>— 없음 —</option>
        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
      </select>
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3" onClick={() => !running && onClose()}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b dark:border-gray-700">
          <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><FileSpreadsheet size={18} className="text-green-600" /> 수신동의 DB 업로드</h3>
          <button onClick={onClose} disabled={running} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* 1. 파일 */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="px-3 py-2 rounded-lg border border-dashed border-gray-400 cursor-pointer text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Upload size={16} /> 엑셀·CSV 파일 고르기
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
            </label>
            {fileName && <span className="text-sm text-gray-600 dark:text-gray-300">{fileName} · {rows.length.toLocaleString()}행</span>}
          </div>

          {headers.length > 0 && (
            <>
              {/* 2. 열 고르기 + 묶음 정보 */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">열 고르기</div>
                  {colSelect('phone', '전화번호', true)}
                  {colSelect('name', '이름')}
                  {colSelect('inbound', '유입경로')}
                  {colSelect('type', '사건 유형')}
                  <div className="text-sm">
                    <div className="text-gray-600 dark:text-gray-300 mb-1">사전정보로 넣을 열 <span className="text-xs text-gray-400">("열이름: 값"으로 저장)</span></div>
                    <div className="flex flex-wrap gap-1.5">
                      {headers.map((h, i) => [col.phone, col.name, col.inbound, col.type].includes(i) ? null : (
                        <label key={i} className={`text-xs px-2 py-1 rounded border cursor-pointer ${memoCols.includes(i) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
                          <input type="checkbox" className="hidden" checked={memoCols.includes(i)} onChange={() => setMemoCols(m => m.includes(i) ? m.filter(x => x !== i) : [...m, i])} />
                          {h}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">묶음 정보</div>
                  <label className="flex items-center gap-2 text-sm"><span className="w-24 text-gray-600 dark:text-gray-300">묶음 이름</span>
                    <input value={batchName} onChange={e => setBatchName(e.target.value)} className={`${sel} flex-1`} /></label>
                  <label className="flex items-center gap-2 text-sm"><span className="w-24 text-gray-600 dark:text-gray-300">DB 출처</span>
                    <input value={source} onChange={e => setSource(e.target.value)} placeholder="예: ○○DB, 11월 구매분" className={`${sel} flex-1`} /></label>
                  {col.inbound < 0 && (
                    <label className="flex items-center gap-2 text-sm"><span className="w-24 text-gray-600 dark:text-gray-300">유입경로</span>
                      <input value={fixedInbound} onChange={e => setFixedInbound(e.target.value)} placeholder={source || 'DB'} className={`${sel} flex-1`} /></label>
                  )}
                  <label className="flex items-center gap-2 text-sm"><span className="w-24 text-gray-600 dark:text-gray-300">거래처</span>
                    <select value={partnerId} onChange={e => setPartnerId(e.target.value)} className={`${sel} flex-1`}>
                      <option value="">— 미정 —</option>
                      {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                    </select></label>
                </div>
              </div>

              {/* 3. 확인 */}
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm space-y-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>전체 {rows.length.toLocaleString()}행</span>
                  <span className={invalidCount ? 'text-red-600' : ''}>번호 오류 {invalidCount}</span>
                  <span className={fileDupCount ? 'text-orange-600' : ''}>파일 안 중복 {fileDupCount}</span>
                  {existing && <span className={existingCount ? 'text-orange-600' : ''}>이미 있는 번호 {existingCount}</span>}
                  {dncMap && <span className={dncCount ? 'text-rose-600 font-semibold' : ''}>🚫 수신거부(DNC) {dncCount}</span>}
                  {existing && <span className="font-bold text-green-700">새로 넣을 리드 {toInsert.length.toLocaleString()}</span>}
                </div>
                {!existing ? (
                  <button onClick={checkExisting} disabled={checking || col.phone < 0 || validRows.length === 0}
                    className="px-3 py-1.5 rounded bg-gray-800 text-white text-sm disabled:opacity-40 flex items-center gap-1">
                    {checking && <Loader2 size={14} className="animate-spin" />} 회사 전체에서 중복 & DNC 확인
                  </button>
                ) : (
                  <>
                    {existingCount > 0 && (
                      <details className="text-xs text-gray-500">
                        <summary className="cursor-pointer">이미 있는 번호 보기 ({existingCount}건 넣지 않음)</summary>
                        <ul className="mt-1 max-h-32 overflow-y-auto">
                          {validRows.filter(x => existing.has(x.phone)).slice(0, 200).map(x => {
                            const e = existing.get(x.phone);
                            return <li key={x.idx}>{formatPhone(x.phone)} → {e.customerName} ({e.status})</li>;
                          })}
                        </ul>
                      </details>
                    )}
                    {dncMap && dncCount > 0 && (
                      <details className="text-xs text-rose-500">
                        <summary className="cursor-pointer">🚫 수신거부(DNC) 번호 보기 ({dncCount}건 자동 제외)</summary>
                        <ul className="mt-1 max-h-32 overflow-y-auto">
                          {validRows.filter(x => !existing?.has(x.phone) && dncMap.has(x.phone)).slice(0, 200).map(x => (
                            <li key={x.idx}>{formatPhone(x.phone)} (사유: {dncMap.get(x.phone) || '수신거부'})</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )}
                {parsed.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="text-gray-400"><tr><th className="text-left pr-3">이름</th><th className="text-left pr-3">전화</th><th className="text-left pr-3">유입경로</th><th className="text-left">사전정보</th></tr></thead>
                      <tbody>
                        {parsed.slice(0, 5).map(x => (
                          <tr key={x.idx} className={!x.valid || x.dupInFile ? 'text-red-500' : ''}>
                            <td className="pr-3">{col.name >= 0 ? x.r[col.name] : ''}</td>
                            <td className="pr-3">{x.valid ? formatPhone(x.phone) : `${x.r[col.phone] ?? ''} (오류)`}</td>
                            <td className="pr-3">{(col.inbound >= 0 ? x.r[col.inbound] : '') || fixedInbound || source || 'DB'}</td>
                            <td className="truncate max-w-[280px]">{memoCols.map(i => `${headers[i]}: ${x.r[i] ?? ''}`).join(' / ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 4. 배분 */}
              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">넣은 뒤 배분</div>
                <div className="grid md:grid-cols-2 gap-1">
                  {(Object.keys(MODE_LABEL) as Mode[]).map(m => (
                    <label key={m} className="flex items-center gap-2 text-sm">
                      <input type="radio" checked={mode === m} onChange={() => setMode(m)} /> {MODE_LABEL[m]}
                    </label>
                  ))}
                </div>
                {['round_robin', 'balanced', 'quantity'].includes(mode) && (
                  <div className="flex flex-wrap gap-3 pl-1 pt-1">
                    {agents.length === 0 && <span className="text-xs text-gray-400">상담원이 없습니다</span>}
                    {agents.map(a => (
                      <label key={a.userId} className="flex items-center gap-1 text-sm">
                        <input type="checkbox" checked={picked.includes(a.userId)} onChange={() => setPicked(p => p.includes(a.userId) ? p.filter(x => x !== a.userId) : [...p, a.userId])} />
                        {a.displayName}
                        {mode === 'quantity' && picked.includes(a.userId) && (
                          <input type="number" min={0} value={counts[a.userId] ?? ''} onChange={e => setCounts({ ...counts, [a.userId]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                            className={`${sel} w-16 ml-1`} placeholder="건" />
                        )}
                      </label>
                    ))}
                    {agents.length > 1 && <button onClick={() => setPicked(agents.map(a => a.userId))} className="text-xs text-blue-600 underline">모두</button>}
                    {mode === 'quantity' && existing && (
                      <span className={`text-xs ${quantityTotal > toInsert.length ? 'text-red-600' : 'text-gray-500'}`}>
                        합계 {quantityTotal} / {toInsert.length}건 {quantityTotal < toInsert.length ? `(남는 ${toInsert.length - quantityTotal}건은 미배정)` : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {result && (
            <div className="flex items-start gap-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded p-3">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {result}
            </div>
          )}
          {headers.length > 0 && col.phone < 0 && (
            <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> 전화번호 열을 골라 주세요.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 rounded-b-xl">
          {progress && <span className="mr-auto text-sm text-gray-500 flex items-center gap-1"><Loader2 size={14} className="animate-spin" /> {progress}</span>}
          <button onClick={onClose} disabled={running} className="px-4 py-2 rounded border border-gray-300 bg-white text-sm">{result ? '닫기' : '취소'}</button>
          {!result && (
            <button onClick={run} disabled={running || !existing || toInsert.length === 0}
              className="px-4 py-2 rounded bg-green-600 text-white font-bold text-sm disabled:opacity-40 flex items-center gap-1">
              {running ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {existing ? `${toInsert.length.toLocaleString()}건 넣기` : '중복 확인 후 넣기'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
