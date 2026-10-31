import React, { useCallback, useEffect, useState } from 'react';
import { Settings2, Save, Undo2, ArrowRightLeft, RefreshCw } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  AgentOverview, DistributionSettings, DEFAULT_SETTINGS, METHOD_LABEL, DistributionMethod,
  fetchDistributionOverview, fetchDistributionSettings, saveAgentDistribution, saveDistributionSettings, transferCases,
} from '../../services/distribution';
import { refreshLocalAssignments, fetchCases } from '../../services/api';

interface Props {
  orgId: string;
  statuses: string[];
  /** 배정이 바뀌었을 때 (팀 화면 새로고침용) */
  onChanged: () => void;
}

const fmt = (iso?: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** 팀 관리 → 리드 배분: 자동 배분·자동 회수 설정 + 상담원별 현황(받기·가중치·하루 상한) + 회수·담당 변경 */
export default function DistributionPanel({ orgId, statuses, onChanged }: Props) {
  const { showToast } = useToast();
  const [s, setS] = useState<DistributionSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState<DistributionSettings>(DEFAULT_SETTINGS);
  const [agents, setAgents] = useState<AgentOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferScope, setTransferScope] = useState<'open' | 'all'>('open');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [st, ov] = await Promise.all([fetchDistributionSettings(), fetchDistributionOverview()]);
      setS(st); setSaved(st); setAgents(ov); setNotReady(false);
    } catch (e: any) {
      // DB 업데이트(013) 전: 표·함수가 없음 → 안내만
      if (/does not exist|Could not find|schema cache/i.test(String(e?.message))) setNotReady(true);
      else showToast(`배분 정보를 불러오지 못했습니다: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);
  useEffect(() => { reload(); }, [reload]);

  const dirty = JSON.stringify({ ...s, exists: 0 }) !== JSON.stringify({ ...saved, exists: 0 });
  const agentRows = agents.filter(a => a.role === 'agent');
  const activeMembers = agents.filter(a => a.status === 'active');
  const allStatusesRaw: string[] = [...statuses, ...s.closedStatuses, ...s.reclaimStatuses, '휴지통'];
  const allStatuses = allStatusesRaw.filter((v, i) => !!v && allStatusesRaw.indexOf(v) === i);

  const save = async () => {
    if (s.autoAssign && agentRows.filter(a => a.status === 'active' && a.receiving).length === 0) {
      if (!window.confirm('리드를 받을 상담원이 없습니다. 이대로 켜면 새 리드는 미배정으로 남습니다. 저장할까요?')) return;
    }
    setBusy(true);
    try {
      await saveDistributionSettings(orgId, s);
      showToast('배분 설정을 저장했습니다.', 'success');
      await reload();
    } catch (e: any) {
      showToast(`저장 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const updateAgent = async (a: AgentOverview, patch: Partial<Pick<AgentOverview, 'receiving' | 'weight' | 'dailyCap'>>) => {
    const next = { receiving: a.receiving, weight: a.weight, dailyCap: a.dailyCap, ...patch };
    setAgents(prev => prev.map(x => x.userId === a.userId ? { ...x, ...next } : x));
    try {
      await saveAgentDistribution(orgId, a.userId, next);
    } catch (e: any) {
      showToast(`저장 실패: ${e.message}`, 'error');
      reload();
    }
  };

  const afterMove = async (msg: string) => {
    showToast(msg, 'success');
    const all = await fetchCases();
    await refreshLocalAssignments(all.map(c => c.caseId));
    await reload();
    onChanged();
  };

  const reclaimAll = async (a: AgentOverview) => {
    if (!window.confirm(`${a.displayName}님의 진행 중 리드 ${a.openCases}건을 회수해 미배정으로 돌릴까요?\n(끝난 상태의 리드는 그대로 둡니다)`)) return;
    setBusy(true);
    try {
      const n = await transferCases(a.userId, null, 'open', undefined, '팀 관리에서 일괄 회수');
      await afterMove(`${a.displayName}님의 리드 ${n}건을 회수했습니다.`);
    } catch (e: any) {
      showToast(`회수 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const doTransfer = async () => {
    const from = agents.find(a => a.userId === transferFrom);
    const to = agents.find(a => a.userId === transferTo);
    if (!from || !to || from.userId === to.userId) return showToast('보내는 사람과 받는 사람을 다르게 고르세요', 'error');
    const cnt = transferScope === 'open' ? from.openCases : from.totalCases;
    if (!window.confirm(`${from.displayName}님의 ${transferScope === 'open' ? '진행 중' : '전체'} 리드 ${cnt}건을 ${to.displayName}님에게 옮길까요?`)) return;
    setBusy(true);
    try {
      const n = await transferCases(from.userId, to.userId, transferScope, undefined, '팀 관리에서 담당 변경');
      await afterMove(`${n}건을 ${to.displayName}님에게 옮겼습니다.`);
    } catch (e: any) {
      showToast(`담당 변경 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleIn = (list: string[], v: string) => list.includes(v) ? list.filter(x => x !== v) : [...list, v];
  const numOrNull = (v: string) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };
  const input = 'border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm dark:bg-gray-700 dark:text-white';

  if (notReady) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-5 py-4 flex items-center gap-2 text-sm text-gray-500">
        <Settings2 size={18} className="text-gray-400" />
        <b className="text-gray-700 dark:text-gray-200">리드 배분 규칙</b> 서버 업데이트 후 사용할 수 있습니다.
        <button onClick={reload} className="ml-auto text-xs flex items-center gap-1"><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 다시 확인</button>
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-2">
        <Settings2 size={18} className="text-blue-600" />
        <h2 className="font-bold text-gray-800 dark:text-white">리드 배분 규칙</h2>
        <span className="text-xs text-gray-400">새 리드를 누구에게 줄지, 손대지 않은 리드를 언제 회수할지</span>
        <button onClick={reload} className="ml-auto text-xs text-gray-500 flex items-center gap-1"><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 새로고침</button>
      </div>

      <div className="p-5 grid lg:grid-cols-2 gap-5">
        {/* 자동 배분 */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
            <input type="checkbox" checked={s.autoAssign} onChange={e => setS({ ...s, autoAssign: e.target.checked })} />
            새 리드 자동 배분
          </label>
          <p className="text-xs text-gray-500 -mt-2">켜면 광고·랜딩·직접 등록으로 들어온 리드가 바로 상담원에게 갑니다. 끄면 미배정으로 들어오고 관리자가 나눠줍니다. (상담원이 직접 등록한 리드는 항상 본인 담당)</p>
          <div className={`space-y-2 ${s.autoAssign ? '' : 'opacity-50'}`}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-28 text-gray-600 dark:text-gray-300">나누는 방식</span>
              <select value={s.method} onChange={e => setS({ ...s, method: e.target.value as DistributionMethod })} className={input}>
                {(Object.keys(METHOD_LABEL) as DistributionMethod[]).map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-28 text-gray-600 dark:text-gray-300">1인 하루 상한</span>
              <input type="number" min={1} value={s.defaultDailyCap ?? ''} placeholder="제한 없음"
                onChange={e => setS({ ...s, defaultDailyCap: numOrNull(e.target.value) })} className={`${input} w-28`} />
              <span className="text-xs text-gray-400">건 (상담원별로 따로 정할 수도 있음)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-28 text-gray-600 dark:text-gray-300">1인 진행 중 상한</span>
              <input type="number" min={1} value={s.maxOpenPerAgent ?? ''} placeholder="제한 없음"
                onChange={e => setS({ ...s, maxOpenPerAgent: numOrNull(e.target.value) })} className={`${input} w-28`} />
              <span className="text-xs text-gray-400">건이 넘으면 그 사람은 건너뜀</span>
            </div>
          </div>
          <div className="text-sm">
            <div className="text-gray-600 dark:text-gray-300 mb-1">"끝난 리드"로 보는 상태 <span className="text-xs text-gray-400">(진행 중 건수·균형 배분·회수에서 뺌)</span></div>
            <div className="flex flex-wrap gap-1.5">
              {allStatuses.map(st => (
                <label key={st} className={`text-xs px-2 py-1 rounded border cursor-pointer ${s.closedStatuses.includes(st) ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-300 text-gray-600'}`}>
                  <input type="checkbox" className="hidden" checked={s.closedStatuses.includes(st)} onChange={() => setS({ ...s, closedStatuses: toggleIn(s.closedStatuses, st) })} />
                  {st}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 자동 회수 */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
            <input type="checkbox" checked={s.autoReclaim} onChange={e => setS({ ...s, autoReclaim: e.target.checked })} />
            손대지 않은 리드 자동 회수
          </label>
          <p className="text-xs text-gray-500 -mt-2">배정받고 정한 시간 동안 <b>상태가 그대로이고 그 번호로 통화·문자 기록이 없는</b> 리드를 회수합니다. 10분마다 확인합니다.</p>
          <div className={`space-y-2 ${s.autoReclaim ? '' : 'opacity-50'}`}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-28 text-gray-600 dark:text-gray-300">회수 기준 시간</span>
              <input type="number" min={10} step={10} value={s.reclaimAfterMinutes}
                onChange={e => setS({ ...s, reclaimAfterMinutes: parseInt(e.target.value, 10) || 60 })} className={`${input} w-24`} />
              <span className="text-xs text-gray-400">분 ({(s.reclaimAfterMinutes / 60).toFixed(1)}시간)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-28 text-gray-600 dark:text-gray-300">회수한 리드는</span>
              <select value={s.reclaimAction} onChange={e => setS({ ...s, reclaimAction: e.target.value as any })} className={input}>
                <option value="reassign">다른 상담원에게 바로 다시 배분</option>
                <option value="unassign">미배정으로 (관리자가 다시 나눔)</option>
              </select>
            </div>
            <div className="text-sm">
              <div className="text-gray-600 dark:text-gray-300 mb-1">회수 대상 상태</div>
              <div className="flex flex-wrap gap-1.5">
                {allStatuses.filter(st => !s.closedStatuses.includes(st)).map(st => (
                  <label key={st} className={`text-xs px-2 py-1 rounded border cursor-pointer ${s.reclaimStatuses.includes(st) ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-300 text-gray-600'}`}>
                    <input type="checkbox" className="hidden" checked={s.reclaimStatuses.includes(st)} onChange={() => setS({ ...s, reclaimStatuses: toggleIn(s.reclaimStatuses, st) })} />
                    {st}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={s.reclaimOnDisable} onChange={e => setS({ ...s, reclaimOnDisable: e.target.checked })} />
            멤버를 사용 중지하면 그 사람의 진행 중 리드를 미배정으로 회수
          </label>
          <div className="flex justify-end">
            <button onClick={save} disabled={busy || !dirty}
              className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1">
              <Save size={14} /> 규칙 저장
            </button>
          </div>
        </div>
      </div>

      {/* 상담원별 현황 */}
      <div className="border-t border-gray-100 dark:border-gray-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 text-xs">
            <tr>
              <th className="text-left px-5 py-2">상담원</th>
              <th className="px-2 py-2">자동 배분 받기</th>
              <th className="px-2 py-2">가중치</th>
              <th className="px-2 py-2">하루 상한</th>
              <th className="text-right px-2 py-2">오늘 배정</th>
              <th className="text-right px-2 py-2">진행 중</th>
              <th className="text-right px-2 py-2" title="회수 대상 상태(기본: 신규접수) 그대로인 리드">미처리</th>
              <th className="text-right px-2 py-2">전체</th>
              <th className="text-left px-2 py-2">마지막 배정</th>
              <th className="text-right px-5 py-2">회수</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {agentRows.map(a => (
              <tr key={a.userId} className={a.status === 'disabled' ? 'opacity-40' : ''}>
                <td className="px-5 py-2 font-medium text-gray-800 dark:text-gray-100">{a.displayName}{a.status === 'disabled' && <span className="ml-1 text-xs text-red-500">사용 중지</span>}</td>
                <td className="px-2 py-2 text-center"><input type="checkbox" checked={a.receiving} disabled={a.status !== 'active'} onChange={e => updateAgent(a, { receiving: e.target.checked })} /></td>
                <td className="px-2 py-2 text-center">
                  <select value={a.weight} disabled={s.method !== 'weighted'} onChange={e => updateAgent(a, { weight: Number(e.target.value) })} className={`${input} disabled:opacity-40`}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </td>
                <td className="px-2 py-2 text-center">
                  <input type="number" min={1} defaultValue={a.dailyCap ?? ''} placeholder={s.defaultDailyCap ? String(s.defaultDailyCap) : '없음'}
                    onBlur={e => { const v = numOrNull(e.target.value); if (v !== a.dailyCap) updateAgent(a, { dailyCap: v }); }}
                    className={`${input} w-20 text-right`} />
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{a.todayAssigned}</td>
                <td className="px-2 py-2 text-right tabular-nums">{a.openCases}</td>
                <td className={`px-2 py-2 text-right tabular-nums ${a.untouchedCases > 0 ? 'text-orange-600 font-semibold' : ''}`}>{a.untouchedCases}</td>
                <td className="px-2 py-2 text-right tabular-nums text-gray-500">{a.totalCases}</td>
                <td className="px-2 py-2 text-gray-500">{fmt(a.lastAssignedAt)}</td>
                <td className="px-5 py-2 text-right">
                  <button onClick={() => reclaimAll(a)} disabled={busy || a.openCases === 0}
                    className="text-xs text-orange-600 hover:underline disabled:opacity-30 inline-flex items-center gap-0.5"><Undo2 size={12} /> 진행 중 회수</button>
                </td>
              </tr>
            ))}
            {!loading && agentRows.length === 0 && (
              <tr><td colSpan={10} className="px-5 py-6 text-center text-gray-400">상담원이 없습니다. 위에서 상담원을 초대하세요.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 담당 변경 */}
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60 rounded-b-xl flex flex-wrap items-center gap-2 text-sm">
        <ArrowRightLeft size={16} className="text-indigo-600" />
        <span className="font-semibold text-gray-700 dark:text-gray-200">담당 변경</span>
        <select value={transferFrom} onChange={e => setTransferFrom(e.target.value)} className={input}>
          <option value="">— 보내는 사람 —</option>
          {agents.filter(a => a.totalCases > 0).map(a => <option key={a.userId} value={a.userId}>{a.displayName} (진행 {a.openCases}/전체 {a.totalCases})</option>)}
        </select>
        <span className="text-gray-500">의</span>
        <select value={transferScope} onChange={e => setTransferScope(e.target.value as any)} className={input}>
          <option value="open">진행 중 리드</option>
          <option value="all">전체 리드</option>
        </select>
        <span className="text-gray-500">를</span>
        <select value={transferTo} onChange={e => setTransferTo(e.target.value)} className={input}>
          <option value="">— 받는 사람 —</option>
          {activeMembers.filter(a => a.userId !== transferFrom).map(a => <option key={a.userId} value={a.userId}>{a.displayName}</option>)}
        </select>
        <button onClick={doTransfer} disabled={busy || !transferFrom || !transferTo}
          className="px-3 py-1.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40">옮기기</button>
        <span className="text-xs text-gray-400">퇴사·휴가 때 사용. 일부만 옮기려면 아래 목록에서 골라 "직접 배정"</span>
      </div>
    </section>
  );
}
