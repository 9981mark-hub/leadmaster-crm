import React, { useCallback, useEffect, useState } from 'react';
import {
  Settings2, Save, Undo2, ArrowRightLeft, RefreshCw, Zap, Shuffle, RotateCcw,
  AlertCircle, Users, CheckCircle2, PhoneMissed, Clock, ChevronRight, X
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  AgentOverview, DistributionSettings, DEFAULT_SETTINGS, METHOD_LABEL, DistributionMethod,
  fetchDistributionOverview, fetchDistributionSettings, saveAgentDistribution, saveDistributionSettings, transferCases,
  executeInstantAutoReclaim, executeCrossAgentShuffle, reclaimAgentUntouchedOnly, fetchMissedCasesCount, fetchReclaimableCases,
  ShuffleSummary, ReclaimSummary,
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

  // [다담세일즈형 스마트 DB 순환 엔진]
  const [reclaimableCount, setReclaimableCount] = useState<number>(0);
  const [missedCount, setMissedCount] = useState<number>(0);
  const [showShuffleModal, setShowShuffleModal] = useState<boolean>(false);
  const [minMissedInput, setMinMissedInput] = useState<number>(3);
  const [isShuffling, setIsShuffling] = useState<boolean>(false);
  const [isReclaiming, setIsReclaiming] = useState<boolean>(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [st, ov, recList, missRes] = await Promise.all([
        fetchDistributionSettings(),
        fetchDistributionOverview(),
        fetchReclaimableCases().catch(() => []),
        fetchMissedCasesCount(minMissedInput).catch(() => ({ total: 0, byAgent: {} })),
      ]);
      setS(st);
      setSaved(st);
      setAgents(ov);
      setReclaimableCount(recList.length);
      setMissedCount(missRes.total);
      setNotReady(false);
    } catch (e: any) {
      // DB 업데이트(013) 전: 표·함수가 없음 → 안내만
      if (/does not exist|Could not find|schema cache/i.test(String(e?.message))) setNotReady(true);
      else showToast(`배분 정보를 불러오지 못했습니다: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, minMissedInput]);
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

  // [NEW] 미처리 DB만 쏙 빼서 회수
  const handleReclaimUntouched = async (a: AgentOverview) => {
    if (a.untouchedCases === 0) return showToast('미처리 리드가 없습니다.', 'info');
    const choice = window.prompt(
      `[${a.displayName}] 상담원의 아직 손대지 않은 미처리 리드 ${a.untouchedCases}건을 회수합니다.\n(진행 중인 다른 상담 건은 안전하게 유지됩니다)\n\n원하시는 방식을 입력하세요:\n1 : 다른 활성 상담원들에게 균등 재배분 (권장)\n2 : 미배정으로 회수 (관리자가 직접 나눔)`,
      '1'
    );
    if (!choice) return;

    const action = choice.trim() === '2' ? 'unassign' : 'reassign';
    setBusy(true);
    try {
      const count = await reclaimAgentUntouchedOnly(a.userId, action);
      if (action === 'reassign') {
        await afterMove(`${a.displayName}님의 미처리 리드 ${count}건을 다른 상담원들에게 균등 재배분했습니다.`);
      } else {
        await afterMove(`${a.displayName}님의 미처리 리드 ${count}건을 미배정으로 회수했습니다.`);
      }
    } catch (e: any) {
      showToast(`미처리 회수 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  // [NEW] 지금 즉시 미처리 DB 일괄 회수 & 재배분
  const handleInstantAutoReclaim = async () => {
    if (reclaimableCount === 0) {
      return showToast('현재 회수 기준(시간 초과 및 미처리 상태)을 만족하는 리드가 없습니다.', 'info');
    }
    const actionLabel = s.reclaimAction === 'reassign' ? '활성 상담원들에게 순환 재배분' : '미배정(풀기)으로 회수';
    if (!window.confirm(`조건(배정 후 ${(s.reclaimAfterMinutes / 60).toFixed(1)}시간 초과 미컨택)에 해당하는 리드 ${reclaimableCount}건을 즉시 회수하여 [${actionLabel}] 하시겠습니까?`)) {
      return;
    }

    setIsReclaiming(true);
    try {
      const res: ReclaimSummary = await executeInstantAutoReclaim();
      if (res.reclaimedCount === 0) {
        showToast('회수 대상 리드가 없습니다.', 'info');
      } else if (res.reassignedCount > 0) {
        const breakdownStr = Object.entries(res.agentBreakdown)
          .map(([uid, cnt]) => `${agents.find(a => a.userId === uid)?.displayName || '상담원'}: ${cnt}건`)
          .join(', ');
        await afterMove(`총 ${res.reclaimedCount}건의 미처리 DB를 회수하여 재배분했습니다. (${breakdownStr})`);
      } else {
        await afterMove(`총 ${res.reclaimedCount}건의 미처리 DB를 미배정으로 회수했습니다.`);
      }
    } catch (e: any) {
      showToast(`미처리 DB 즉시 회수 실패: ${e.message}`, 'error');
    } finally {
      setIsReclaiming(false);
    }
  };

  // [NEW] 부재중 DB 상담원 교차 셔플 실행
  const handleCrossAgentShuffle = async () => {
    if (missedCount === 0) {
      return showToast(`현재 부재 ${minMissedInput}회 이상인 리드가 없습니다.`, 'info');
    }
    const activeReceivers = agents.filter(a => a.status === 'active' && a.receiving);
    if (activeReceivers.length < 2) {
      return showToast('교차 셔플을 진행하려면 리드를 수신할 활성 상담원이 최소 2명 이상이어야 합니다.', 'error');
    }
    if (!window.confirm(`부재 ${minMissedInput}회 이상인 리드 ${missedCount}건을 기존 담당자가 아닌 다른 상담원들에게 균등 교차 셔플 배분하시겠습니까? (새로운 상담원이 전화를 걸어 컨택률을 극대화합니다)`)) {
      return;
    }

    setIsShuffling(true);
    try {
      const res: ShuffleSummary = await executeCrossAgentShuffle(minMissedInput);
      setShowShuffleModal(false);
      const breakdownStr = Object.entries(res.agentBreakdown)
        .map(([uid, cnt]) => `${agents.find(a => a.userId === uid)?.displayName || '상담원'}: ${cnt}건`)
        .join(', ');
      await afterMove(`총 ${res.totalShuffled}건의 부재중 DB가 상담원 간 교차 셔플되었습니다! (${breakdownStr})`);
    } catch (e: any) {
      showToast(`부재중 DB 교차 셔플 실패: ${e.message}`, 'error');
    } finally {
      setIsShuffling(false);
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

      {/* ⚡ 실시간 DB 순환 & 스마트 액션 허브 (다담세일즈형) */}
      <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gradient-to-r from-slate-50 via-blue-50/40 to-indigo-50/30 dark:from-gray-900/40 dark:via-gray-800/60 dark:to-gray-900/40 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">
              실시간 DB 순환 & 교차 셔플 허브
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold">
              다담세일즈형 쾌속 순환
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            방치된 잠자는 DB를 깨워 통화 성공률을 20% 이상 반등시킵니다.
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Action 1: 장기 미처리 DB 즉시 회수 */}
          <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-orange-500" /> 장기 미처리 DB 즉시 회수
                </span>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${reclaimableCount > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 animate-pulse' : 'bg-gray-100 text-gray-500'}`}>
                  {reclaimableCount}건 대상
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                배정 후 <b>{(s.reclaimAfterMinutes / 60).toFixed(1)}시간</b> 동안 통화나 문자 기록이 없는 미컨택 DB를 지금 즉시 회수하여 활성 상담원들에게 균등 재배분하거나 미배정으로 전환합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleInstantAutoReclaim}
              disabled={isReclaiming || busy || reclaimableCount === 0}
              className="w-full py-2 px-3 rounded-lg text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-98"
            >
              <Zap className="w-3.5 h-3.5" />
              {isReclaiming ? '회수 및 재배분 진행 중...' : `미처리 DB ${reclaimableCount}건 즉시 회수 실행`}
            </button>
          </div>

          {/* Action 2: 부재중 DB 상담원 교차 셔플 */}
          <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                  <Shuffle className="w-4 h-4 text-blue-500" /> 부재중 DB 상담원 교차 셔플
                </span>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${missedCount > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' : 'bg-gray-100 text-gray-500'}`}>
                  부재 {minMissedInput}회+ {missedCount}건
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                동일 상담원이 여러 번 걸어도 안 받는 DB를 <b>다른 상담원에게 교차 재배분</b>합니다. 목소리와 발신 번호가 바뀌어 고객이 전화를 받을 확률이 높아집니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowShuffleModal(true)}
              disabled={isShuffling || busy || missedCount === 0}
              className="w-full py-2 px-3 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-98"
            >
              <Shuffle className="w-3.5 h-3.5" />
              부재중 DB 교차 셔플 설정 & 실행
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
                <td className="px-2 py-2 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className={`tabular-nums font-semibold ${a.untouchedCases > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                      {a.untouchedCases}
                    </span>
                    {a.untouchedCases > 0 && (
                      <button
                        type="button"
                        onClick={() => handleReclaimUntouched(a)}
                        disabled={busy}
                        title="진행 중 상담 건은 건드리지 않고, 손대지 않은 미처리 DB만 회수/재배분합니다"
                        className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/50 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 transition-colors"
                      >
                        회수
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-gray-500">{a.totalCases}</td>
                <td className="px-2 py-2 text-gray-500">{fmt(a.lastAssignedAt)}</td>
                <td className="px-5 py-2 text-right">
                  <button onClick={() => reclaimAll(a)} disabled={busy || a.openCases === 0}
                    className="text-xs text-orange-600 hover:underline disabled:opacity-30 inline-flex items-center gap-0.5"><Undo2 size={12} /> 진행 중 전체 회수</button>
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

      {/* [NEW] 부재중 DB 교차 셔플 모달 */}
      {showShuffleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Shuffle className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-gray-900 dark:text-white">
                  부재중 DB 상담원 교차 셔플
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShuffleModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200 leading-relaxed">
                💡 <strong>교차 셔플 원리 (다담세일즈형):</strong><br />
                A 상담원의 부재중 DB는 B, C 상담원에게 가고, B 상담원의 부재중 DB는 A, C 상담원에게 균등 배분됩니다. 기존 담당자에게는 다시 배정되지 않아 새로운 목소리로 통화 성공률을 높입니다.
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  부재 횟수 기준
                </label>
                <div className="flex items-center gap-2">
                  {[2, 3, 4, 5].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={async () => {
                        setMinMissedInput(cnt);
                        const res = await fetchMissedCasesCount(cnt).catch(() => ({ total: 0, byAgent: {} }));
                        setMissedCount(res.total);
                      }}
                      className={`flex-1 py-1.5 rounded-lg font-bold border transition-all ${
                        minMissedInput === cnt
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-transparent hover:bg-gray-200'
                      }`}
                    >
                      {cnt}회 이상
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">교차 셔플 대상 리드</span>
                <span className="text-base font-black text-blue-600 dark:text-blue-400">
                  총 {missedCount}건
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowShuffleModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCrossAgentShuffle}
                disabled={isShuffling || missedCount === 0}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5 shadow-md shadow-blue-500/20"
              >
                <Shuffle className="w-3.5 h-3.5" />
                {isShuffling ? '교차 셔플 중...' : `지금 교차 셔플 실행 (${missedCount}건)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
