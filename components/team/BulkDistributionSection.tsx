import React, { useState, useMemo } from 'react';
import { Shuffle, Zap, Users, CheckCircle2, AlertCircle, ArrowRight, Loader2, Filter, Layers } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
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
  const { confirm } = useConfirmDialog();

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

    const ok = await confirm({
      title: '대량 자동 배분 실행',
      message: `• 대상 리드: 약 ${effectiveTotal.toLocaleString()}건\n• 대상 상담원: ${targetUserCount}명\n• 배분 방식: ${modeText}\n\n지금 대량 배분을 시작하시겠습니까?`,
      confirmText: '대량 배분 시작',
      cancelText: '취소',
      variant: 'default',
    });

    if (!ok) return;

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
    <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-2xs">
              <Zap size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                대용량 리드 스마트 자동 분배
                <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  50인 · 15,000건+ 최적화
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                체크박스를 일일이 찍지 않고, 미배정 대량 DB를 상담원들에게 초고속(1초) 1/N 균등 또는 쿼터별로 일괄 배분합니다.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-2.5 py-1 text-2xs font-mono font-medium rounded-md border transition-colors flex items-center gap-1.5 ${
              showFilters
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Filter size={13} strokeWidth={1.75} />
            조건부 필터 (유입경로/회차/상담원 선택)
          </button>
        </div>

        {/* 3대 핵심 현황 KPI 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div className="bg-muted/40 p-3 rounded-lg border border-border">
            <span className="text-2xs font-mono font-medium text-muted-foreground">배분 대기 (미배정)</span>
            <div className="text-2xl font-semibold tracking-tight text-foreground font-mono tabular-nums mt-0.5">
              {unassignedCount.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">건</span>
            </div>
          </div>

          <div className="bg-muted/40 p-3 rounded-lg border border-border">
            <span className="text-2xs font-mono font-medium text-muted-foreground">배분 대상 활동 상담원</span>
            <div className="text-2xl font-semibold tracking-tight text-foreground font-mono tabular-nums mt-0.5 flex items-baseline gap-1.5">
              <span>{targetUserCount}</span>
              <span className="text-xs font-normal text-muted-foreground">/ 총 {activeAgents.length}명</span>
            </div>
          </div>

          <div className="bg-muted/40 p-3 rounded-lg border border-border">
            <span className="text-2xs font-mono font-medium text-muted-foreground">1인당 예상 균등 배분량</span>
            <div className="text-2xl font-semibold tracking-tight text-primary font-mono tabular-nums mt-0.5">
              약 {estimatedPerAgent.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">건{remainder > 0 ? ` (+잔여 ${remainder}건 순번)` : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form Body */}
      <div className="p-4 space-y-4">
        {/* Step 1: 배분 방식 선택 */}
        <div>
          <label className="block text-xs font-mono font-medium text-foreground mb-2">
            1. 배분 방식 선택
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div
              onClick={() => setMode('round_robin')}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                mode === 'round_robin'
                  ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/20 shadow-2xs'
                  : 'border-border bg-card hover:bg-muted/40 text-muted-foreground'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-foreground">1/N 완전 균등 분배</span>
                <input type="radio" checked={mode === 'round_robin'} readOnly className="accent-primary" />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                미배정 리드 전체를 상담원 {targetUserCount}명에게 공평하게 정확히 N개씩 차례대로 나눠줍니다.
              </p>
            </div>

            <div
              onClick={() => setMode('quota')}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                mode === 'quota'
                  ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/20 shadow-2xs'
                  : 'border-border bg-card hover:bg-muted/40 text-muted-foreground'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-foreground">1인당 쿼터 지정 (채우기)</span>
                <input type="radio" checked={mode === 'quota'} readOnly className="accent-primary" />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                상담원 1인당 정확히 지정한 건수(예: 300건)만큼 순차 배분합니다.
              </p>
              {mode === 'quota' && (
                <div className="mt-2.5 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <span className="text-xs font-mono text-muted-foreground">1인당 배정:</span>
                  <input
                    type="number"
                    min={1}
                    value={quotaPerAgent}
                    onChange={e => setQuotaPerAgent(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-24 px-2.5 py-1 text-sm font-mono font-medium border border-border rounded-md text-right bg-card text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-xs font-mono text-muted-foreground">건 (총 {((quotaPerAgent || 0) * targetUserCount).toLocaleString()}건)</span>
                </div>
              )}
            </div>

            <div
              onClick={() => setMode('balanced')}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                mode === 'balanced'
                  ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/20 shadow-2xs'
                  : 'border-border bg-card hover:bg-muted/40 text-muted-foreground'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-foreground">보유량 균형 분배</span>
                <input type="radio" checked={mode === 'balanced'} readOnly className="accent-primary" />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                현재 진행 중인 리드를 적게 가지고 있는 상담원에게 우선적으로 배분하여 업무 부하를 맞춥니다.
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: 조건부 상세 필터 (펼치기/접기) */}
        {showFilters && (
          <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4 animate-fade-in">
            <div className="font-mono text-xs font-medium text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Filter size={13} className="text-primary" /> 세부 분배 필터 설정
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-mono text-muted-foreground mb-1">
                  배분할 총 수량 제한 (선택)
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder={`전체 (${unassignedCount.toLocaleString()}건)`}
                  value={limitCount}
                  onChange={e => setLimitCount(e.target.value)}
                  className="w-full p-2 text-sm font-mono border border-border rounded-md bg-card text-foreground outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-2xs text-muted-foreground mt-1 block">비워두면 미배정 리드 전체를 배분합니다</span>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted-foreground mb-1">
                  특정 엑셀 업로드 회차만 배분
                </label>
                <select
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  className="w-full p-2 text-sm font-mono border border-border rounded-md bg-card text-foreground outline-none focus:ring-1 focus:ring-primary"
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
                <label className="block text-xs font-mono text-muted-foreground mb-1">
                  특정 유입경로만 배분
                </label>
                <select
                  value={selectedInbound}
                  onChange={e => setSelectedInbound(e.target.value)}
                  className="w-full p-2 text-sm font-mono border border-border rounded-md bg-card text-foreground outline-none focus:ring-1 focus:ring-primary"
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
                <span className="text-xs font-mono text-muted-foreground">
                  배분 대상 상담원 선택 ({targetUserCount}/{activeAgents.length}명)
                </span>
                <div className="flex gap-2 text-2xs font-mono">
                  <button onClick={selectAllUsers} className="text-primary hover:underline">
                    전원 선택
                  </button>
                  <span className="text-border">|</span>
                  <button onClick={clearAllUsers} className="text-muted-foreground hover:underline">
                    선택 해제
                  </button>
                </div>
              </div>
              <div className="max-h-36 overflow-y-auto border border-border rounded-md p-2 bg-card grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {activeAgents.map(a => (
                  <label
                    key={a.userId}
                    className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground cursor-pointer p-1 rounded hover:bg-muted/40 hover:text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(a.userId)}
                      onChange={() => toggleUser(a.userId)}
                      className="rounded accent-primary"
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
        <div className="pt-1">
          <button
            onClick={handleRunBulkDistribute}
            disabled={distributing || unassignedCount <= 0 || targetUserCount === 0}
            className={`w-full py-3 px-5 rounded-lg font-mono text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-2xs ${
              distributing || unassignedCount <= 0 || targetUserCount === 0
                ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }`}
          >
            {distributing ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>서버에서 대량 리드 배분을 고속 처리하고 있습니다...</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>
                  {mode === 'round_robin' && `[원클릭 배분] 활동 상담원 ${targetUserCount}명에게 각 약 ${estimatedPerAgent}건씩 균등 분배 실행`}
                  {mode === 'quota' && `[원클릭 배분] 활동 상담원 ${targetUserCount}명에게 각 ${quotaPerAgent}건씩 채우기 실행`}
                  {mode === 'balanced' && `[원클릭 배분] 진행 중 리드 적은 상담원 우선 균형 배분 실행`}
                </span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>

        {/* Result Summary Modal / Panel */}
        {resultSummary && (
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-3 animate-fade-in">
            <div className="flex items-center gap-2 text-primary font-medium text-sm font-mono">
              <CheckCircle2 size={16} className="text-primary" />
              대량 배분이 성공적으로 완료되었습니다! (총 {resultSummary.total.toLocaleString()}건)
            </div>
            <div className="max-h-40 overflow-y-auto border border-border rounded-md bg-card p-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 text-xs font-mono">
                {Object.entries(resultSummary.summary).map(([uid, cnt]) => {
                  const m = members.find(x => x.userId === uid);
                  return (
                    <div key={uid} className="flex justify-between items-center p-1.5 bg-muted/40 rounded border border-border/40">
                      <span className="text-muted-foreground font-medium truncate">{m?.displayName || '상담원'}</span>
                      <span className="font-semibold text-primary ml-1 tabular-nums">{cnt}건</span>
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
