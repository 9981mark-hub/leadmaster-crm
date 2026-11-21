import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Zap,
  Crown,
  Users,
  DollarSign,
  TrendingUp,
  BarChart3,
  Flame,
  PhoneCall,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Case, Partner, SettlementBatch } from '../../types';
import { TeamMember, assignRoundRobin } from '../../services/team';
import { KPICard } from '../ui/KPICard';
import { ParalegalPipelineWidget } from './ParalegalPipelineWidget';

interface HybridDashboardViewProps {
  cases: Case[];
  partners: Partner[];
  batches: SettlementBatch[];
  teamMembers: TeamMember[];
  onRefreshCases?: () => void;
  onShowOverdueModal: () => void;
  onShowWarningModal: () => void;
}

export const HybridDashboardView: React.FC<HybridDashboardViewProps> = ({
  cases,
  partners,
  batches,
  teamMembers,
  onRefreshCases,
  onShowOverdueModal,
  onShowWarningModal,
}) => {
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributeSuccessMsg, setDistributeSuccessMsg] = useState<string | null>(null);

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const thisMonthStr = format(now, 'yyyy-MM');
  const todayStr = format(now, 'yyyy-MM-dd');

  const activeCases = useMemo(
    () => cases.filter((c) => c.status !== '휴지통' && !c.deletedAt),
    [cases]
  );

  const activeAgents = useMemo(
    () => teamMembers.filter((m) => m.status === 'active' && m.role !== 'owner'),
    [teamMembers]
  );

  // 미배정 리드
  const unassignedCases = useMemo(
    () => activeCases.filter((c) => !c.assignedUserId),
    [activeCases]
  );

  // 오늘 신규 인입 리드
  const todayLeads = useMemo(
    () => activeCases.filter((c) => c.createdAt && c.createdAt.startsWith(todayStr)),
    [activeCases, todayStr]
  );

  // 재무 요약
  const isInRange = (dateStr: string | undefined, start: Date, end: Date): boolean => {
    if (!dateStr) return false;
    try {
      const d = parseISO(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
      return d >= start && d <= end;
    } catch {
      return false;
    }
  };

  const thisMonthContracts = useMemo(
    () => activeCases.filter((c) => isInRange(c.contractAt, thisMonthStart, thisMonthEnd)),
    [activeCases, thisMonthStart, thisMonthEnd]
  );

  const thisRevenue = useMemo(
    () => thisMonthContracts.reduce((sum, c) => sum + (c.contractFee || 0), 0),
    [thisMonthContracts]
  );

  const totalDbCost = activeCases.filter((c) => c.createdAt?.startsWith(thisMonthStr)).length * 35000;
  const netProfit = Math.max(0, thisRevenue - totalDbCost - 100000);
  const profitMargin = thisRevenue > 0 ? Math.round((netProfit / thisRevenue) * 100) : 0;

  // 골든타임 재통화 필요 건
  const goldenTimeCases = useMemo(() => {
    return activeCases.filter((c) => {
      const isAbsent = c.status?.includes('부재') || c.status?.includes('미연결');
      const missedCount = (c as any).missedCallCount || 0;
      return isAbsent || (missedCount >= 1 && missedCount <= 2);
    });
  }, [activeCases]);

  // 원클릭 라운드로빈 빠른 배분 실행 함수
  const handleQuickDistribute = async () => {
    if (unassignedCases.length === 0) {
      alert('현재 배분할 미배정 리드가 없습니다.');
      return;
    }
    if (activeAgents.length === 0) {
      alert('배정받을 수 있는 활성 상담원이 없습니다. [팀 관리]에서 상담원을 등록하세요.');
      return;
    }

    const confirmMsg = `미배정 리드 ${unassignedCases.length}건을 활성 상담원 ${activeAgents.length}명에게 균등 배분하시겠습니까?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsDistributing(true);
      setDistributeSuccessMsg(null);

      const caseIds = unassignedCases.map((c) => c.caseId);
      const agentUserIds = activeAgents.map((a) => a.userId);

      await assignRoundRobin(caseIds, agentUserIds);

      setDistributeSuccessMsg(`성공: 총 ${caseIds.length}건의 리드가 활성 상담원에게 공평하게 배분되었습니다!`);
      if (onRefreshCases) onRefreshCases();

      setTimeout(() => setDistributeSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`리드 배분 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsDistributing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 웰컴 배너 */}
      <div className="bg-card rounded-xl p-5 text-foreground shadow-xs border border-border relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 border border-primary/20 text-primary flex items-center gap-1">
                <Zap size={13} strokeWidth={1.75} /> 대표 겸 팀장 올인원 통합 관제
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(), 'yyyy.MM.dd (E)', { locale: ko })}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
              <span>경영 손익 & 현장 리드 배분 올인원 대시보드</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              대표이사의 전사 손익 모니터링과 현장 리드 즉시 배분을 한 화면에서 원스톱으로 처리합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onRefreshCases && onRefreshCases()}
              className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <RefreshCw size={14} strokeWidth={1.75} /> 새로고침
            </button>
          </div>
        </div>
      </div>

      {/* 배분 성공 알림 */}
      {distributeSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            {distributeSuccessMsg}
          </span>
          <button onClick={() => setDistributeSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900">
            ✕
          </button>
        </div>
      )}

      {/* 상단 1: 경영 핵심 KPI 4종 (매출 / DB원가 / 마진 / 미배정) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="당월 총 수임/매출"
          count={`₩${thisRevenue.toLocaleString()}`}
          color="text-emerald-600"
          icon={DollarSign}
          subText={`수임 성사 ${thisMonthContracts.length}건`}
        />
        <KPICard
          title="실질 영업 순마진"
          count={`₩${netProfit.toLocaleString()}`}
          color="text-blue-600"
          icon={TrendingUp}
          subText={`마진율 ${profitMargin}% (DB원가 차감)`}
        />
        <KPICard
          title="미배정 대기 리드"
          count={`${unassignedCases.length}건`}
          color="text-amber-600"
          icon={Zap}
          subText="1클릭 균등 배분 지원"
          pulseGlow={unassignedCases.length > 0}
        />
        <KPICard
          title="오늘 신규 인입"
          count={`${todayLeads.length}건`}
          color="text-indigo-600"
          icon={PhoneCall}
          subText={`총 보유 리드 ${activeCases.length}건`}
        />
      </div>

      {/* 중단 1: 당일 리드 빠른 배분 액션 패널 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-slate-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Zap size={16} className="text-amber-500" />
              당일 리드 실시간 자동 분배 패널
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              현재 미배정 상태인 리드 <strong>{unassignedCases.length}건</strong>을 활성 상담원 <strong>{activeAgents.length}명</strong>에게 균등하게 즉시 분배합니다.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleQuickDistribute}
              disabled={isDistributing || unassignedCases.length === 0}
              className={`w-full md:w-auto px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                unassignedCases.length > 0
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white cursor-pointer hover:shadow'
                  : 'bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-slate-400 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              <Zap size={14} className={isDistributing ? 'animate-spin' : ''} />
              {isDistributing ? '자동 배분 처리 중...' : `활성 상담원 균등 즉시 배분 (${unassignedCases.length}건)`}
            </button>
            <Link
              to="/cases"
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 text-xs text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 whitespace-nowrap transition-colors"
            >
              상세 관리 →
            </Link>
          </div>
        </div>
      </div>

      {/* 중단 2: 사무장 인계 & 수임 파이프라인 관제 센터 */}
      <div>
        <ParalegalPipelineWidget cases={cases} isAdmin={true} />
      </div>

      {/* 하단: 팀원별 현황 & 상담원 생산성 보드 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50/70 dark:bg-gray-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-blue-600" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              상담원별 실시간 실적 현황 ({activeAgents.length}명)
            </h3>
          </div>
          <Link
            to="/team"
            className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            팀 관리로 이동 →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-gray-700/50 text-slate-500 dark:text-gray-400 font-semibold border-b border-slate-200 dark:border-gray-700">
              <tr>
                <th className="py-2.5 px-4 whitespace-nowrap">상담원명</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-right">보유 배정 리드</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-right">오늘 완료 콜</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-right">당월 1차 인계</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-right">당월 수임 매출 기여액</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-700/60">
              {activeAgents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                    등록된 활성 상담원이 없습니다.
                  </td>
                </tr>
              ) : (
                activeAgents.map((agent) => {
                  const agentCases = activeCases.filter((c) => c.assignedUserId === agent.userId);
                  const totalAssigned = agentCases.length;

                  const todayCalls = agentCases.flatMap((c) => c.reminders || []).filter((r) => {
                    return r.datetime?.startsWith(todayStr) && (r.isCompleted || r.resultStatus);
                  }).length;

                  const transfers = agentCases.filter(
                    (c) => c.paralegalStatus || c.status?.includes('인계') || c.status?.includes('사무장')
                  ).length;

                  const revenue = agentCases.filter((c) => c.contractFee && c.contractFee > 0)
                    .reduce((sum, c) => sum + (c.contractFee || 0), 0);

                  return (
                    <tr key={agent.userId} className="hover:bg-slate-50 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {agent.displayName}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        {totalAssigned}건
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-blue-600 dark:text-blue-400 tabular-nums whitespace-nowrap">
                        {todayCalls}콜
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400 tabular-nums whitespace-nowrap">
                        {transfers}건
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                        ₩{revenue.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="text-xs px-2 py-0.5 rounded font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                          가동 중
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HybridDashboardView;
