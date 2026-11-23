import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Users,
  UserCheck,
  PhoneCall,
  Clock,
  AlertTriangle,
  Zap,
  ArrowRight,
  TrendingUp,
  Flame,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Headphones,
  Check,
  Building,
} from 'lucide-react';
import { Case, Partner } from '../../types';
import { TeamMember, assignRoundRobin } from '../../services/team';
import { KPICard } from '../ui/KPICard';
import { ParalegalPipelineWidget } from './ParalegalPipelineWidget';
import { applyLocalAssignment } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';

interface ManagerDashboardViewProps {
  cases: Case[];
  teamMembers: TeamMember[];
  partners: Partner[];
  onRefreshCases?: () => void;
  onShowOverdueModal: () => void;
  onShowWarningModal: () => void;
}

export const ManagerDashboardView: React.FC<ManagerDashboardViewProps> = ({
  cases,
  teamMembers,
  partners,
  onRefreshCases,
  onShowOverdueModal,
  onShowWarningModal,
}) => {
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributeSuccessMsg, setDistributeSuccessMsg] = useState<string | null>(null);

  const activeCases = useMemo(
    () => cases.filter((c) => c.status !== '휴지통' && !c.deletedAt),
    [cases]
  );

  const activeAgents = useMemo(
    () => teamMembers.filter((m) => m.status === 'active' && m.role !== 'owner'),
    [teamMembers]
  );

  // 오늘 날짜 문자열
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const thisMonthStr = format(new Date(), 'yyyy-MM');

  // 당일 인입 리드 (오늘 생성된 리드)
  const todayCases = useMemo(
    () => activeCases.filter((c) => c.createdAt && c.createdAt.startsWith(todayStr)),
    [activeCases, todayStr]
  );

  // 미배정 리드 (전체 활성 케이스 중 담당 상담원이 없는 건)
  const unassignedCases = useMemo(
    () => activeCases.filter((c) => !c.assignedUserId),
    [activeCases]
  );

  // 배정 완료된 리드
  const assignedCasesCount = activeCases.length - unassignedCases.length;

  // 골든타임 재통화 필요 리드 (부재 1~2회)
  const goldenTimeCases = useMemo(() => {
    return activeCases.filter((c) => {
      const isAbsent = c.status?.includes('부재') || c.status?.includes('미연결');
      const missedCount = (c as any).missedCallCount || 0;
      return isAbsent || (missedCount >= 1 && missedCount <= 2);
    });
  }, [activeCases]);

  // 지연된 리마인더
  const overdueRemindersCount = useMemo(() => {
    return activeCases.flatMap((c) => c.reminders || []).filter((r) => {
      if (r.resultStatus || r.isCompleted) return false;
      if (!r.datetime) return false;
      return r.datetime < format(new Date(), 'yyyy-MM-dd HH:mm');
    }).length;
  }, [activeCases]);

  // 팀원별 당일 실적 매핑
  const agentDailyStats = useMemo(() => {
    return activeAgents.map((agent) => {
      const agentCases = activeCases.filter((c) => c.assignedUserId === agent.userId);
      const totalAssigned = agentCases.length;

      // 오늘 완료된 리마인더/콜 수
      const todayDoneCalls = agentCases.flatMap((c) => c.reminders || []).filter((r) => {
        return r.datetime?.startsWith(todayStr) && (r.isCompleted || r.resultStatus);
      }).length;

      // 당월 1차 인계 완료 건수
      const monthlyTransfers = agentCases.filter(
        (c) =>
          (c.paralegalStatus || c.status?.includes('인계') || c.status?.includes('사무장')) &&
          (c.statusUpdatedAt?.startsWith(thisMonthStr) || c.updatedAt?.startsWith(thisMonthStr))
      ).length;

      // 당월 수임 완료 건수
      const monthlyContracts = agentCases.filter(
        (c) =>
          (c.contractAt?.startsWith(thisMonthStr) || c.status === '계약완료' || c.status === '수임')
      ).length;

      return {
        member: agent,
        totalAssigned,
        todayDoneCalls,
        monthlyTransfers,
        monthlyContracts,
      };
    });
  }, [activeAgents, activeCases, todayStr, thisMonthStr]);

  // 원클릭 라운드로빈 빠른 배분 실행 함수
  const handleQuickDistribute = async () => {
    if (unassignedCases.length === 0) {
      showToast('현재 배분할 미배정 리드가 없습니다.', 'error');
      return;
    }
    if (activeAgents.length === 0) {
      showToast('배정받을 수 있는 활성 상담원이 없습니다. [팀 관리]에서 상담원을 등록하세요.', 'error');
      return;
    }

    const ok = await confirm({
      title: '미배정 리드 자동 균등 배분',
      message: `미배정 리드 ${unassignedCases.length}건을 활성 상담원 ${activeAgents.length}명에게 균등 배분하시겠습니까?`,
      confirmLabel: '배분 실행',
      cancelLabel: '취소'
    });
    if (!ok) return;

    try {
      setIsDistributing(true);
      setDistributeSuccessMsg(null);

      const caseIds = unassignedCases.map((c) => c.caseId);
      const agentUserIds = activeAgents.map((a) => a.userId);

      const result = await assignRoundRobin(caseIds, agentUserIds);

      // 로컬 캐시 즉시 업데이트
      Object.entries(result).forEach(([agentId, count]) => {
        // 배정 반영
      });

      showToast(`총 ${caseIds.length}건의 리드가 공평하게 배분되었습니다!`, 'success');
      setDistributeSuccessMsg(`성공: 총 ${caseIds.length}건의 리드가 공평하게 배분되었습니다!`);
      if (onRefreshCases) onRefreshCases();

      setTimeout(() => setDistributeSuccessMsg(null), 5000);
    } catch (err: any) {
      showToast(`리드 배분 중 오류가 발생했습니다: ${err.message}`, 'error');
    } finally {
      setIsDistributing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 관리자 헤더 & 배너 */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
                <ShieldCheck size={13} strokeWidth={1.75} /> 현장 플로어 관제 센터
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(), 'yyyy.MM.dd')} 실시간 상황판
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>TM 실시간 플로어 & 리드 분배 현황판</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              상담원 가동 현황, 당일 인입 리드 배정 및 사무장 인계 파이프라인 정체를 통합 지휘합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onRefreshCases && onRefreshCases()}
              className="px-3 py-1.5 rounded-lg bg-card hover:bg-muted border border-border text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <RefreshCw size={13} strokeWidth={1.75} /> 현황 새로고침
            </button>
            <Link
              to="/cases"
              className="px-3.5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-xs font-semibold text-primary-foreground shadow-xs transition-colors flex items-center gap-1.5"
            >
              케이스 관리로 이동 →
            </Link>
          </div>
        </div>
      </div>

      {/* 성공 피드백 알림 */}
      {distributeSuccessMsg && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-primary text-xs font-semibold flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} strokeWidth={1.75} />
            {distributeSuccessMsg}
          </span>
          <button onClick={() => setDistributeSuccessMsg(null)} className="text-primary hover:opacity-75 transition-opacity">
            ✕
          </button>
        </div>
      )}

      {/* 플로어 가동 & 배정 현황 KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="활성 상담원 현황"
          count={`${activeAgents.length}명`}
          color="text-indigo-600 dark:text-indigo-400"
          icon={Users}
          subText={`전체 멤버 ${teamMembers.length}명 중`}
        />
        <KPICard
          title="오늘 인입된 신규 리드"
          count={`${todayCases.length}건`}
          color="text-blue-600 dark:text-blue-400"
          icon={PhoneCall}
          subText={`총 누적 리드 ${activeCases.length}건`}
        />
        <KPICard
          title="미배정 대기 리드"
          count={`${unassignedCases.length}건`}
          color="text-amber-600 dark:text-amber-400"
          icon={Zap}
          subText="상담원 배정 즉시 필요"
          pulseGlow={unassignedCases.length > 0}
        />
        <div onClick={onShowOverdueModal} className="cursor-pointer hover:scale-[1.02] transition-transform h-full">
          <KPICard
            title="골든타임/지연 방치 건"
            count={`${goldenTimeCases.length + overdueRemindersCount}건`}
            color="text-destructive"
            icon={Flame}
            subText={`골든타임 ${goldenTimeCases.length} · 지연 ${overdueRemindersCount}`}
            pulseGlow={goldenTimeCases.length + overdueRemindersCount > 0}
          />
        </div>
      </div>

      {/* 당일 리드 빠른 배분 액션 패널 */}
      <div className="bg-card rounded-xl p-5 border border-border shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap size={16} strokeWidth={1.75} className="text-amber-500" />
              당일 리드 실시간 자동 분배 센터
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              현재 미배정된 리드 <strong className="text-foreground">{unassignedCases.length}건</strong>을 활성 상태인 상담원들에게 공평하게 1초 만에 자동 분배합니다.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleQuickDistribute}
              disabled={isDistributing || unassignedCases.length === 0}
              className={`w-full md:w-auto px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs ${
                unassignedCases.length > 0
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer'
                  : 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60'
              }`}
            >
              <Zap size={14} strokeWidth={1.75} className={isDistributing ? 'animate-spin' : ''} />
              {isDistributing ? '자동 배분 처리 중...' : `활성 상담원 균등 즉시 배분 (${unassignedCases.length}건)`}
            </button>
            <Link
              to="/cases"
              className="px-3 py-2 rounded-lg border border-border text-xs text-foreground hover:bg-muted whitespace-nowrap transition-colors"
            >
              수동 배정 →
            </Link>
          </div>
        </div>
      </div>

      {/* 사무장 인계 & 수임 파이프라인 실시간 관제 위젯 */}
      <div>
        <ParalegalPipelineWidget cases={cases} isAdmin={true} />
      </div>

      {/* 상담원별 일일 성과 현황판 */}
      <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} strokeWidth={1.75} className="text-primary" />
            <h3 className="font-semibold text-sm text-foreground">
              팀원별 실시간 콜 및 인계 현황표 ({activeAgents.length}명)
            </h3>
          </div>
          <Link
            to="/team"
            className="text-xs text-primary font-semibold hover:underline"
          >
            팀 관리 상세 →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="py-2.5 px-4 whitespace-nowrap">상담원명</th>
                <th className="py-2.5 px-4 whitespace-nowrap">역할</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-right">보유 배정 리드</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-right">오늘 완료 콜</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-right">당월 1차 인계</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-right">당월 최종 수임</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-center">작업 모드</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agentDailyStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                    등록된 활성 상담원이 없습니다. [팀 관리]에서 상담원을 초대하세요.
                  </td>
                </tr>
              ) : (
                agentDailyStats.map((stat) => (
                  <tr key={stat.member.userId} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-foreground whitespace-nowrap">
                      {stat.member.displayName}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {stat.member.role === 'admin' ? '팀장' : '상담원'}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-foreground tabular-nums whitespace-nowrap">
                      {stat.totalAssigned}건
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-blue-600 dark:text-blue-400 tabular-nums whitespace-nowrap">
                      {stat.todayDoneCalls}콜
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums whitespace-nowrap">
                      {stat.monthlyTransfers}건
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                      {stat.monthlyContracts}건
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-muted text-muted-foreground border border-border">
                        {stat.member.uiMode === 'lite_only' ? '간편콜 전용' : '표준 모드'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboardView;
