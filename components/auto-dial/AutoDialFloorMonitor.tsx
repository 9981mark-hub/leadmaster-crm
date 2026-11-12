/**
 * components/auto-dial/AutoDialFloorMonitor.tsx
 * 관리자 전용 실시간 TM 플로어 전광판 (Floor Monitoring Dashboard)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, PhoneCall, Phone, PhoneOff, PhoneMissed,
  Clock, Zap, RefreshCw, Play, Pause, AlertCircle,
  Moon, CheckCircle2, ChevronRight, Eye
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  AutoDialCampaign,
  AutoDialAgentAllocation,
  fetchAutoDialCampaign,
  fetchCampaignAllocations,
  updateCampaignStatus,
  updateAgentLiveStatus,
  recycleMissedCalls,
  subscribeFloorAllocations
} from '../../services/autoDialV4Service';

interface AutoDialFloorMonitorProps {
  campaignId: string;
  onClose?: () => void;
}

export const AutoDialFloorMonitor: React.FC<AutoDialFloorMonitorProps> = ({
  campaignId,
  onClose,
}) => {
  const { showToast } = useToast();
  const [campaign, setCampaign] = useState<AutoDialCampaign | null>(null);
  const [allocations, setAllocations] = useState<AutoDialAgentAllocation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRecycling, setIsRecycling] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // 실시간 지속 시간 렌더링을 위한 1초 타이머
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    if (!campaignId) return;
    try {
      const [camp, allocs] = await Promise.all([
        fetchAutoDialCampaign(campaignId),
        fetchCampaignAllocations(campaignId),
      ]);
      if (camp) setCampaign(camp);
      setAllocations(allocs);
    } catch (err) {
      console.error('[AutoDialFloorMonitor] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 실시간 웹소켓 구독
  useEffect(() => {
    if (!campaignId) return;
    const unsub = subscribeFloorAllocations(campaignId, () => {
      loadData();
    });
    return unsub;
  }, [campaignId, loadData]);

  // 자동 폴링 (3초)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  // 캠페인 상태 변경
  const handleToggleCampaignStatus = async () => {
    if (!campaign) return;
    const nextStatus = campaign.status === 'running' ? 'paused' : 'running';
    try {
      await updateCampaignStatus(campaign.id, nextStatus);
      setCampaign(prev => prev ? { ...prev, status: nextStatus } : null);
      showToast(`캠페인이 ${nextStatus === 'running' ? '재개' : '일시정지'}되었습니다.`, 'info');
    } catch (err) {
      showToast('상태 변경에 실패했습니다.', 'error');
    }
  };

  // 골든타임 부재 재투입
  const handleRecycleMissed = async () => {
    if (!campaign) return;
    if (!window.confirm('당일 부재 건을 상담원 큐로 다시 재투입하시겠습니까? (유심 자동 교차 발신 적용)')) return;

    setIsRecycling(true);
    try {
      const count = await recycleMissedCalls(campaign.id);
      showToast(`${count}건의 부재 리드가 큐로 재투입되었습니다!`, 'success');
      loadData();
    } catch (err) {
      showToast('부재 재투입 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsRecycling(false);
    }
  };

  // 상담원 대기 전환 (복귀 요청)
  const handleResetAgentStatus = async (allocId: string, name: string) => {
    try {
      await updateAgentLiveStatus(allocId, 'idle');
      showToast(`${name} 상담원을 대기 상태로 전환했습니다.`, 'success');
      loadData();
    } catch (err) {
      showToast('전환에 실패했습니다.', 'error');
    }
  };

  // 요약 통계
  const totalAgents = allocations.length;
  const talkingCount = allocations.filter(a => a.currentStatus === 'talking').length;
  const ringingCount = allocations.filter(a => a.currentStatus === 'dialing' || a.currentStatus === 'ringing').length;
  const wrapupCount = allocations.filter(a => a.currentStatus === 'wrapup').length;
  const pausedCount = allocations.filter(a => a.currentStatus === 'paused').length;
  const idleCount = allocations.filter(a => a.currentStatus === 'idle' || a.currentStatus === 'offline').length;

  const totalAssignedLeads = allocations.reduce((sum, a) => sum + (a.targetCount || 0), 0);
  const totalCompletedLeads = allocations.reduce((sum, a) => sum + (a.completedCount || 0), 0);
  const totalConnectedLeads = allocations.reduce((sum, a) => sum + (a.connectedCount || 0), 0);
  const totalNoAnswerLeads = allocations.reduce((sum, a) => sum + (a.noAnswerCount || 0), 0);

  const overallProgress = totalAssignedLeads > 0 ? Math.round((totalCompletedLeads / totalAssignedLeads) * 100) : 0;
  const overallConnectRate = totalCompletedLeads > 0 ? Math.round((totalConnectedLeads / totalCompletedLeads) * 100) : 0;

  // 지속 시간 포맷팅 (초 ➔ MM:SS)
  const formatDuration = (isoString?: string) => {
    if (!isoString) return '00:00';
    const startMs = new Date(isoString).getTime();
    const diffSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    const m = Math.floor(diffSec / 60);
    const s = diffSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. 상단 관제탑 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                campaign?.status === 'running' ? 'bg-emerald-400' : 'bg-amber-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-3 w-3 ${
                campaign?.status === 'running' ? 'bg-emerald-500' : 'bg-amber-500'
              }`} />
            </span>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              {campaign?.name || '오토콜 실시간 플로어 전광판'}
            </h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              campaign?.status === 'running'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
            }`}>
              {campaign?.status === 'running' ? 'LIVE 통화 진행중' : '캠페인 일시정지'}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-3">
            <span>링 제한: {campaign?.pacingSettings.ringTimeoutSeconds || 20}초</span>
            <span>·</span>
            <span>후처리: {campaign?.pacingSettings.wrapUpLimitSeconds || 10}초</span>
            <span>·</span>
            <span>듀얼SIM 교차: {campaign?.pacingSettings.dualSimRotation ? '활성(ON)' : '단일'}</span>
            <span>·</span>
            <span>실시간 전광판 3초 자동 갱신</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* 부재 골든타임 재투입 */}
          <button
            type="button"
            onClick={handleRecycleMissed}
            disabled={isRecycling}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
            title="당일 부재 건을 SIM 교차 설정으로 다시 큐에 투입합니다."
          >
            <Moon size={14} />
            {isRecycling ? '재투입 처리중...' : '🌙 골든타임 부재 재투입'}
          </button>

          {/* 캠페인 시작 / 일시정지 */}
          <button
            type="button"
            onClick={handleToggleCampaignStatus}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
              campaign?.status === 'running'
                ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm'
            }`}
          >
            {campaign?.status === 'running' ? (
              <>
                <Pause size={14} />
                캠페인 일시정지
              </>
            ) : (
              <>
                <Play size={14} />
                캠페인 재개
              </>
            )}
          </button>

          {/* 수동 새로고침 */}
          <button
            type="button"
            onClick={loadData}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl"
            title="새로고침"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
            >
              닫기
            </button>
          )}
        </div>
      </div>

      {/* 2. 라이브 플로어 KPI 카운터 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 통화중 */}
        <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <span>🟢 통화중</span>
            <PhoneCall size={14} className="animate-pulse text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-200 font-mono">
              {talkingCount}
            </span>
            <span className="text-xs text-emerald-600 font-medium">명</span>
          </div>
        </div>

        {/* 신호/링중 */}
        <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
            <span>🟡 신호대기 (링)</span>
            <Phone size={14} className="text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-amber-700 dark:text-amber-200 font-mono">
              {ringingCount}
            </span>
            <span className="text-xs text-amber-600 font-medium">명</span>
          </div>
        </div>

        {/* 후처리 */}
        <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-blue-800 dark:text-blue-300">
            <span>🔵 후처리 (카운트)</span>
            <Clock size={14} className="text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-blue-700 dark:text-blue-200 font-mono">
              {wrapupCount}
            </span>
            <span className="text-xs text-blue-600 font-medium">명</span>
          </div>
        </div>

        {/* 휴식/일시정지 */}
        <div className="bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300">
            <span>🔴 일시정지 (휴식)</span>
            <Pause size={14} className="text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-rose-700 dark:text-rose-200 font-mono">
              {pausedCount}
            </span>
            <span className="text-xs text-rose-600 font-medium">명</span>
          </div>
        </div>

        {/* 총 진행 진척도 */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
            <span>당일 콜 소화율</span>
            <span className="text-indigo-600 font-mono">{overallProgress}%</span>
          </div>
          <div className="mt-2">
            <span className="text-lg font-black text-gray-900 dark:text-white font-mono">
              {totalCompletedLeads}
            </span>
            <span className="text-xs text-gray-400 font-mono"> / {totalAssignedLeads}</span>
            <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* 연결률 */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
            <span>통화 연결률</span>
            <span className="text-emerald-600 font-mono">{overallConnectRate}%</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-black text-emerald-600 font-mono">
              {totalConnectedLeads}건
            </span>
            <span className="text-xs text-gray-400 font-mono">부재 {totalNoAnswerLeads}</span>
          </div>
        </div>
      </div>

      {/* 3. 전체 상담원 실시간 라이브 보드 (Floor Table) */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/40">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <Users size={15} className="text-indigo-600" />
            상담원별 실시간 콜 상태 및 소화 현황 ({allocations.length}명)
          </span>
          <span className="text-xs text-gray-400">
            상태 뱃지 클릭 시 세션 리셋 가능
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900/80 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="py-3 px-6">상담원</th>
                <th className="py-3 px-4">실시간 상태</th>
                <th className="py-3 px-4">지속 시간</th>
                <th className="py-3 px-4">현재 통화 대상</th>
                <th className="py-3 px-6">당일 소화율 (완료 / 목표)</th>
                <th className="py-3 px-4 text-center">연결 성공</th>
                <th className="py-3 px-4 text-center">부재 / 거절</th>
                <th className="py-3 px-6 text-right">관리자 실시간 액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium">
              {allocations.map(alloc => {
                const progress = alloc.targetCount > 0 ? Math.round((alloc.completedCount / alloc.targetCount) * 100) : 0;
                const duration = formatDuration(alloc.lastStatusChangedAt);

                return (
                  <tr
                    key={alloc.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    {/* 상담원 */}
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                          {alloc.agentName.slice(0, 1)}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                            {alloc.agentName}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {alloc.agentId}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 실시간 상태 */}
                    <td className="py-3.5 px-4">
                      {alloc.currentStatus === 'talking' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          통화중
                        </span>
                      )}
                      {(alloc.currentStatus === 'dialing' || alloc.currentStatus === 'ringing') && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          신호 대기
                        </span>
                      )}
                      {alloc.currentStatus === 'wrapup' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-300">
                          <Clock size={11} />
                          후처리
                        </span>
                      )}
                      {alloc.currentStatus === 'paused' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300">
                          <Pause size={11} />
                          휴식 (이석)
                        </span>
                      )}
                      {(alloc.currentStatus === 'idle' || alloc.currentStatus === 'offline') && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-500 bg-gray-100 dark:bg-gray-700">
                          대기
                        </span>
                      )}
                    </td>

                    {/* 지속 시간 */}
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-700 dark:text-gray-300 text-xs">
                      {duration}
                    </td>

                    {/* 현재 고객 */}
                    <td className="py-3.5 px-4">
                      {alloc.currentCustomerName ? (
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {alloc.currentCustomerName} 고객
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>

                    {/* 당일 소화율 */}
                    <td className="py-3.5 px-6">
                      <div className="w-44">
                        <div className="flex items-center justify-between text-xs font-mono mb-1">
                          <span className="font-bold text-gray-800 dark:text-gray-200">
                            {alloc.completedCount} / {alloc.targetCount}
                          </span>
                          <span className="text-indigo-600 font-bold">{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(100, progress)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 연결 성공 */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        {alloc.connectedCount}
                      </span>
                    </td>

                    {/* 부재 / 거절 */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-mono text-gray-600 dark:text-gray-400">
                        {alloc.noAnswerCount} <span className="text-gray-300">/</span> {alloc.rejectedCount}
                      </span>
                    </td>

                    {/* 관리자 실시간 액션 */}
                    <td className="py-3.5 px-6 text-right">
                      {alloc.currentStatus === 'paused' ? (
                        <button
                          type="button"
                          onClick={() => handleResetAgentStatus(alloc.id, alloc.agentName)}
                          className="px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors"
                        >
                          대기 복귀 지시
                        </button>
                      ) : alloc.currentStatus === 'talking' ? (
                        <span className="text-xs text-emerald-600 font-semibold">
                          통화 경청 대기
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleResetAgentStatus(alloc.id, alloc.agentName)}
                          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:underline"
                        >
                          세션 리셋
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AutoDialFloorMonitor;
