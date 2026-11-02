import React, { useState, useMemo } from 'react';
import { Shuffle, Zap, Users, CheckCircle2, AlertCircle, ArrowRight, Loader2, Filter, Layers } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { distributeUnassignedBulk, DistributeMode, ImportBatch } from '../../services/distribution';
import { TeamMember } from '../../services/team';

interface Props {
  unassignedCount: number;
  members: TeamMember[];
  importBatches?: ImportBatch[];
  inboundPaths?: string[];
  onDistributed: () => void;
}

export default function BulkDistributionSection({
  unassignedCount,
  members,
  importBatches = [],
  inboundPaths = [],
  onDistributed,
}: Props) {
  const { showToast } = useToast();

  const activeAgents = useMemo(() => {
    return members.filter(m => m.status === 'active' && m.role === 'agent');
  }, [members]);

  const [mode, setMode] = useState<'round_robin' | 'quota' | 'balanced'>('round_robin');
  const [quotaPerAgent, setQuotaPerAgent] = useState<number>(300);
  const [limitCount, setLimitCount] = useState<string>(''); // 비어있으면 전체
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedInbound, setSelectedInbound] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set(activeAgents.map(a => a.userId)));
  const [showFilters, setShowFilters] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [resultSummary, setResultSummary] = useState<{ total: number; summary: Record<string, number> } | null>(null);

  // 대상 상담원 수
  const targetUserCount = selectedUserIds.size;

  // 1인당 예상 수량 계산
  const effectiveTotal = limitCount ? Math.min(unassignedCount, parseInt(limitCount, 10) || unassignedCount) : unassignedCount;
  const estimatedPerAgent = targetUserCount > 0 ? Math.floor(effectiveTotal / targetUserCount) : 0;
  const remainder = targetUserCount > 0 ? effectiveTotal % targetUserCount : 0;

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectAllUsers = () => {
    setSelectedUserIds(new Set(activeAgents.map(a => a.userId)));
  };

  const clearAllUsers = () => {
    setSelectedUserIds(new Set());
  };

  const handleRunBulkDistribute = async () => {
    if (unassignedCount <= 0) {
      showToast('배분할 미배정 리드가 없습니다.', 'error');
      return;
    }
    if (targetUserCount === 0) {
      showToast('리드를 배분받을 상담원을 1명 이상 선택하세요.', 'error');
      return;
    }

    const modeText = mode === 'round_robin' 
      ? `1/N 균등 순번 분배 (1인당 약 ${estimatedPerAgent}건)` 
      : mode === 'quota' 
      ? `1인당 ${quotaPerAgent}건 쿼터 채우기` 
      : '진행 중 리드 적은 사람 우선(균형)';

    const confirmMessage = `[대량 자동 배분 실행]\n\n` +
      `• 대상 리드: 약 ${effectiveTotal.toLocaleString()}건\n` +
      `• 대상 상담원: ${targetUserCount}명\n` +
      `• 배분 방식: ${modeText}\n\n` +
      `지금 대량 배분을 시작하시겠습니까?`;

    if (!window.confirm(confirmMessage)) return;

    setDistributing(true);
    setResultSummary(null);

    try {
      const res = await distributeUnassignedBulk({
        limit: limitCount ? parseInt(limitCount, 10) : undefined,
        mode,
        userIds: Array.from(selectedUserIds),
        quotaPerAgent: mode === 'quota' ? quotaPerAgent : undefined,
        inboundPath: selectedInbound || undefined,
        batchId: selectedBatchId || undefined,
        note: `대용량 원클릭 자동 배분 (${modeText})`,
      });

      if (res.success) {
        setResultSummary({
          total: res.totalDistributed,
          summary: res.summary,
        });
        showToast(`총 ${res.totalDistributed.toLocaleString()}건 배분이 성공적으로 완료되었습니다!`, 'success');
        onDistributed();
      } else {
        showToast('배분 중 오류가 발생했습니다.', 'error');
      }
    } catch (err: any) {
      showToast(`대량 배분 실패: ${err.message}`, 'error');
    } finally {
      setDistributing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-50/50 to-indigo-50/30 dark:from-gray-800 dark:to-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600 text-white shadow-sm">
              <Zap size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                대용량 리드 스마트 자동 분배
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-semibold">
                  50인 · 15,000건+ 최적화
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                체크박스를 일일이 찍지 않고, 미배정 대량 DB를 상담원들에게 초고속(1초) 1/N 균등 또는 쿼터별로 일괄 배분합니다.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
              showFilters
                ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-gray-700 dark:text-blue-300'
                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter size={14} />
            조건부 필터 (유입경로/회차/상담원 선택)
          </button>
        </div>

        {/* 3대 핵심 현황 KPI 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="bg-white dark:bg-gray-700/60 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-600 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">배분 대기 (미배정)</span>
            <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
              {unassignedCount.toLocaleString()} <span className="text-xs font-normal text-gray-500">건</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-700/60 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-600 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">배분 대상 활동 상담원</span>
            <div className="text-2xl font-extrabold text-gray-800 dark:text-white mt-0.5 flex items-baseline gap-1.5">
              <span>{targetUserCount}</span>
              <span className="text-xs font-normal text-gray-400">/ 총 {activeAgents.length}명</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-700/60 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-600 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">1인당 예상 균등 배분량</span>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
              약 {estimatedPerAgent.toLocaleString()} <span className="text-xs font-normal text-gray-500">건{remainder > 0 ? ` (+잔여 ${remainder}건 순번)` : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form Body */}
      <div className="p-5 space-y-5">
        {/* Step 1: 배분 방식 선택 */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2.5">
            1. 배분 방식 선택
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div
              onClick={() => setMode('round_robin')}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                mode === 'round_robin'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 shadow-xs'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-gray-800 dark:text-white">1/N 완전 균등 분배</span>
                <input type="radio" checked={mode === 'round_robin'} readOnly className="text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                미배정 리드 전체를 상담원 {targetUserCount}명에게 공평하게 정확히 N개씩 차례대로 나눠줍니다.
              </p>
            </div>

            <div
              onClick={() => setMode('quota')}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                mode === 'quota'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 shadow-xs'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-gray-800 dark:text-white">1인당 쿼터 지정 (채우기)</span>
                <input type="radio" checked={mode === 'quota'} readOnly className="text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                상담원 1인당 정확히 지정한 건수(예: 300건)만큼 순차 배분합니다.
              </p>
              {mode === 'quota' && (
                <div className="mt-2.5 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">1인당 배정:</span>
                  <input
                    type="number"
                    min={1}
                    value={quotaPerAgent}
                    onChange={e => setQuotaPerAgent(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-24 px-2.5 py-1 text-sm font-bold border border-blue-400 rounded-lg text-right dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500">건 (총 {((quotaPerAgent || 0) * targetUserCount).toLocaleString()}건)</span>
                </div>
              )}
            </div>

            <div
              onClick={() => setMode('balanced')}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                mode === 'balanced'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 shadow-xs'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-gray-800 dark:text-white">보유량 균형 분배</span>
                <input type="radio" checked={mode === 'balanced'} readOnly className="text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                현재 진행 중인 리드를 적게 가지고 있는 상담원에게 우선적으로 배분하여 업무 부하를 맞춥니다.
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: 조건부 상세 필터 (펼치기/접기) */}
        {showFilters && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600 space-y-4 animate-fade-in">
            <div className="font-bold text-xs text-gray-700 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
              <Filter size={14} className="text-blue-600" /> 세부 분배 필터 설정
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  배분할 총 수량 제한 (선택)
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder={`전체 (${unassignedCount.toLocaleString()}건)`}
                  value={limitCount}
                  onChange={e => setLimitCount(e.target.value)}
                  className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[11px] text-gray-400 mt-0.5 block">비워두면 미배정 리드 전체를 배분합니다</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  특정 엑셀 업로드 회차만 배분
                </label>
                <select
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">모든 회차 / 전체 미배정</option>
                  {importBatches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.totalRows}건, {new Date(b.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  특정 유입경로만 배분
                </label>
                <select
                  value={selectedInbound}
                  onChange={e => setSelectedInbound(e.target.value)}
                  className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">모든 유입경로</option>
                  {inboundPaths.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 상담원 개별 선택 목록 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  배분 대상 상담원 선택 ({targetUserCount}/{activeAgents.length}명)
                </span>
                <div className="flex gap-2 text-xs">
                  <button onClick={selectAllUsers} className="text-blue-600 hover:underline">
                    전원 선택
                  </button>
                  <span className="text-gray-300">|</span>
                  <button onClick={clearAllUsers} className="text-gray-500 hover:underline">
                    선택 해제
                  </button>
                </div>
              </div>
              <div className="max-h-36 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {activeAgents.map(a => (
                  <label
                    key={a.userId}
                    className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200 cursor-pointer p-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(a.userId)}
                      onChange={() => toggleUser(a.userId)}
                      className="rounded text-blue-600"
                    />
                    <span className="truncate" title={a.displayName}>
                      {a.displayName}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Button & Execution State */}
        <div className="pt-2">
          <button
            onClick={handleRunBulkDistribute}
            disabled={distributing || unassignedCount <= 0 || targetUserCount === 0}
            className={`w-full py-4 px-6 rounded-xl font-bold text-white shadow-md transition-all flex items-center justify-center gap-3 text-base ${
              distributing || unassignedCount <= 0 || targetUserCount === 0
                ? 'bg-gray-400 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99]'
            }`}
          >
            {distributing ? (
              <>
                <Loader2 className="animate-spin" size={22} />
                <span>서버에서 대량 리드 배분을 고속 처리하고 있습니다...</span>
              </>
            ) : (
              <>
                <Zap size={22} className="text-amber-300 fill-amber-300" />
                <span>
                  {mode === 'round_robin' && `[원클릭 배분] 활동 상담원 ${targetUserCount}명에게 각 약 ${estimatedPerAgent}건씩 균등 분배 실행`}
                  {mode === 'quota' && `[원클릭 배분] 활동 상담원 ${targetUserCount}명에게 각 ${quotaPerAgent}건씩 채우기 실행`}
                  {mode === 'balanced' && `[원클릭 배분] 진행 중 리드 적은 상담원 우선 균형 배분 실행`}
                </span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>

        {/* Result Summary Modal / Panel */}
        {resultSummary && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3 animate-fade-in">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
              <CheckCircle2 size={18} className="text-emerald-600" />
              대량 배분이 성공적으로 완료되었습니다! (총 {resultSummary.total.toLocaleString()}건)
            </div>
            <div className="max-h-40 overflow-y-auto border border-emerald-200/60 dark:border-emerald-800 rounded-lg bg-white dark:bg-gray-800 p-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 text-xs">
                {Object.entries(resultSummary.summary).map(([uid, cnt]) => {
                  const m = members.find(x => x.userId === uid);
                  return (
                    <div key={uid} className="flex justify-between items-center p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                      <span className="text-gray-700 dark:text-gray-200 font-medium truncate">{m?.displayName || '상담원'}</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400 ml-1">{cnt}건</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
