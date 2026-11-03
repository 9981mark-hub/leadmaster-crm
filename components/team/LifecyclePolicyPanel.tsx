import React, { useState, useEffect, useCallback } from 'react';
import {
  Archive, RotateCcw, Trash2, Clock, CheckCircle2, ShieldCheck,
  AlertTriangle, Save, RefreshCw, Zap, Layers, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useQueryClient } from '@tanstack/react-query';
import { Case } from '../../types';
import {
  LifecyclePolicy, LifecycleStats, DEFAULT_LIFECYCLE_POLICY,
  fetchLifecyclePolicy, saveLifecyclePolicy, fetchLifecycleStats,
  archiveCases, restoreArchivedCases, runAutoLifecycleCleanup
} from '../../services/leadLifecycle';

interface LifecyclePolicyPanelProps {
  cases: Case[];
  onChanged?: () => void;
}

export default function LifecyclePolicyPanel({ cases, onChanged }: LifecyclePolicyPanelProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // 정책 및 통계 상태
  const [policy, setPolicy] = useState<LifecyclePolicy>(DEFAULT_LIFECYCLE_POLICY);
  const [savedPolicy, setSavedPolicy] = useState<LifecyclePolicy>(DEFAULT_LIFECYCLE_POLICY);
  const [stats, setStats] = useState<LifecycleStats>({ activeCount: 0, archivedCount: 0, trashCount: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  // 대량 일괄 아카이빙 필터 상태
  const [filterStaleDays, setFilterStaleDays] = useState<number>(60);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [batchActionRunning, setBatchActionRunning] = useState(false);

  const reloadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        fetchLifecyclePolicy(),
        fetchLifecycleStats(cases),
      ]);
      setPolicy(p);
      setSavedPolicy(p);
      setStats(s);
    } catch (e: any) {
      console.warn('[LifecyclePolicyPanel] reload error:', e);
    } finally {
      setLoading(false);
    }
  }, [cases]);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  const isDirty = JSON.stringify(policy) !== JSON.stringify(savedPolicy);

  const handleSavePolicy = async () => {
    setSaving(true);
    try {
      await saveLifecyclePolicy(policy);
      setSavedPolicy(policy);
      showToast('DB 수명주기 자동화 정책이 저장되었습니다.', 'success');
      onChanged?.();
    } catch (e: any) {
      showToast(`저장 실패: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRunCleanupNow = async () => {
    if (!window.confirm('설정된 수명주기 규칙에 따라 조건에 부합하는 리드들을 지금 즉시 자동 정리하시겠습니까?')) return;
    setCleaning(true);
    try {
      const res = await runAutoLifecycleCleanup();
      showToast(
        `자동 정리 완료: 계약 완료 ${res.archivedContracts}건 보관, 장기 미활동 ${res.archivedStale}건 보관, 결번/DNC ${res.trashedInvalid}건 휴지통 이동`,
        'success'
      );
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      await reloadData();
      onChanged?.();
    } catch (e: any) {
      showToast(`자동 정리 실패: ${e.message}`, 'error');
    } finally {
      setCleaning(false);
    }
  };

  // 조건에 부합하는 오래된 리드 일괄 선별
  const targetStaleCases = React.useMemo(() => {
    const cutoff = Date.now() - filterStaleDays * 24 * 60 * 60 * 1000;
    return cases.filter(c => {
      if (c.deletedAt || c.isArchived) return false;
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      const t = c.updatedAt ? new Date(c.updatedAt).getTime() : 0;
      return t < cutoff;
    });
  }, [cases, filterStaleDays, filterStatus]);

  const handleBatchArchiveStale = async () => {
    if (targetStaleCases.length === 0) {
      showToast('조건에 일치하는 대상 리드가 없습니다.');
      return;
    }
    if (!window.confirm(`선택된 조건(${filterStaleDays}일 이상 경과)의 활성 리드 ${targetStaleCases.length}건을 상담원 시야에서 숨기고 보관함으로 이동하시겠습니까?`)) {
      return;
    }

    setBatchActionRunning(true);
    try {
      const ids = targetStaleCases.map(c => c.caseId);
      const count = await archiveCases(ids, 'batch_cleanup');
      showToast(`${count}건의 리드가 보관함으로 이동(상담원 숨김)되었습니다.`, 'success');
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      await reloadData();
      onChanged?.();
    } catch (e: any) {
      showToast(`일괄 보관 실패: ${e.message}`, 'error');
    } finally {
      setBatchActionRunning(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* 1. 상단 수명주기 3단계 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Tier 1: 활성 리드 */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-2">
            <span className="text-xs font-bold flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Tier 1. 활성 리드
            </span>
            <span className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
              상담원 노출
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.activeCount.toLocaleString()} <span className="text-xs font-normal text-gray-400">건</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            오늘 당장 상담/통화가 진행 중인 실전 영업 DB
          </p>
        </div>

        {/* Tier 2: 보관함 (상담원 숨김) */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-purple-200 dark:border-purple-800 shadow-xs">
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 mb-2">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <Archive size={15} /> Tier 2. 보관함 (아카이브)
            </span>
            <span className="text-xs bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-semibold">
              🔒 상담원 은닉
            </span>
          </div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {stats.archivedCount.toLocaleString()} <span className="text-xs font-normal text-gray-400">건</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            계약 완료/장기 미접촉 격리 DB (재인입 시 자동 부활)
          </p>
        </div>

        {/* Tier 3: 휴지통 */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-2">
            <span className="text-xs font-bold flex items-center gap-1.5 text-rose-600">
              <Trash2 size={15} /> Tier 3. 휴지통 (삭제 대기)
            </span>
            <span className="text-xs bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full font-medium">
              30일 유예
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.trashCount.toLocaleString()} <span className="text-xs font-normal text-gray-400">건</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            결번, 수신거부 및 수동 삭제된 DB
          </p>
        </div>

      </div>

      {/* 2. 자동 수명주기 규칙 설정 카드 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              <Clock size={20} />
            </span>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                DB 자동 수명주기 및 상담원 숨김 정책
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                계약이 끝나거나 장기간 방치된 리드를 자동으로 상담원 목록에서 숨겨 업무 혼선을 방지합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunCleanupNow}
              disabled={cleaning}
              className="px-3.5 py-2 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 rounded-lg border border-purple-200 dark:border-purple-800 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Zap size={14} className={cleaning ? 'animate-spin' : ''} />
              <span>지금 즉시 자동 정리 실행</span>
            </button>
            <button
              onClick={handleSavePolicy}
              disabled={saving || !isDirty}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-40"
            >
              <Save size={14} />
              <span>정책 저장</span>
            </button>
          </div>
        </div>

        {/* 정책 규칙 토글 및 입력 */}
        <div className="space-y-4 text-xs">
          
          {/* 규칙 1: 계약 완료 건 자동 격리 */}
          <div className="flex items-start justify-between p-3.5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="space-y-1 pr-4">
              <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <span>계약 완료 건 상담원 목록에서 자동 숨김</span>
                <span className="px-2 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                  개인정보 보호
                </span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                상태가 '계약 완료'로 변경된 후 지정한 일수가 지나면 상담원 화면에서 숨기고 관리자 보관함으로 이동합니다.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={policy.contractGraceDays}
                onChange={e => setPolicy(p => ({ ...p, contractGraceDays: Number(e.target.value) }))}
                disabled={!policy.autoArchiveContract}
                className="px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-xs"
              >
                <option value={1}>1일 후</option>
                <option value={3}>3일 후</option>
                <option value={7}>7일 후 (권장)</option>
                <option value={14}>14일 후</option>
                <option value={30}>30일 후</option>
              </select>
              <input
                type="checkbox"
                checked={policy.autoArchiveContract}
                onChange={e => setPolicy(p => ({ ...p, autoArchiveContract: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          </div>

          {/* 규칙 2: 장기 미접촉 방치 DB 자동 보관 */}
          <div className="flex items-start justify-between p-3.5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="space-y-1 pr-4">
              <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <span>장기 미활동/미접촉 방치 DB 자동 보관</span>
                <span className="px-2 py-0.2 rounded text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-semibold">
                  콜 집중도 향상
                </span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                최종 통화 또는 활동이 없는 채로 일정 기간 방치된 '죽은 DB'를 자동으로 보관함으로 이동합니다.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={policy.staleDays}
                onChange={e => setPolicy(p => ({ ...p, staleDays: Number(e.target.value) }))}
                disabled={!policy.autoArchiveStale}
                className="px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-xs"
              >
                <option value={30}>30일 경과</option>
                <option value={45}>45일 경과 (권장)</option>
                <option value={60}>60일 경과</option>
                <option value={90}>90일 경과</option>
              </select>
              <input
                type="checkbox"
                checked={policy.autoArchiveStale}
                onChange={e => setPolicy(p => ({ ...p, autoArchiveStale: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          </div>

          {/* 규칙 3: 결번 / 수신거부 자동 휴지통 */}
          <div className="flex items-start justify-between p-3.5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="space-y-1 pr-4">
              <div className="font-bold text-gray-800 dark:text-gray-200">
                결번 / 수신거부 DB 자동 휴지통 이동
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                통화 결과 상태가 '결번' 또는 '수신거부'로 확정된 리드는 활성 목록에서 제거하고 휴지통으로 보냅니다.
              </p>
            </div>
            <div className="flex items-center shrink-0">
              <input
                type="checkbox"
                checked={policy.autoTrashInvalid}
                onChange={e => setPolicy(p => ({ ...p, autoTrashInvalid: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          </div>

        </div>
      </div>

      {/* 3. 대량 일괄 아카이빙 콘솔 (Batch Pruning) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Filter size={16} />
            </span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              오래된 미접촉 DB 조건부 대량 일괄 보관 콘솔
            </h3>
          </div>
          <span className="text-xs text-gray-400">
            필터 조건에 부합하는 리드를 1클릭으로 상담원 시야에서 일제히 은닉합니다.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">방치 기간:</span>
            <select
              value={filterStaleDays}
              onChange={e => setFilterStaleDays(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-medium"
            >
              <option value={30}>최근 30일 이상 미활동</option>
              <option value={60}>최근 60일 이상 미활동</option>
              <option value={90}>최근 90일 이상 미활동</option>
              <option value={180}>최근 6개월 이상 미활동</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">대상 상태:</span>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200"
            >
              <option value="all">전체 상태</option>
              <option value="진행불가">진행불가</option>
              <option value="고객취소">고객취소</option>
              <option value="부재">부재</option>
              <option value="계약 완료">계약 완료</option>
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-purple-700 dark:text-purple-300 font-semibold bg-purple-50 dark:bg-purple-950/40 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800">
              일치 대상: <strong>{targetStaleCases.length.toLocaleString()}</strong>건
            </span>
            <button
              onClick={handleBatchArchiveStale}
              disabled={batchActionRunning || targetStaleCases.length === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors shadow-sm disabled:opacity-40 flex items-center gap-1.5"
            >
              <Archive size={14} />
              <span>{targetStaleCases.length.toLocaleString()}건 일괄 보관(상담원 숨김)</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
