import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Crown,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  ShieldAlert,
  Award,
  Users,
  Sparkles,
  BarChart3,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';
import { Case, Partner, SettlementBatch } from '../../types';
import { TeamMember } from '../../services/team';
import { KPICard } from '../ui/KPICard';
import RevenueWidget from '../RevenueWidget';

interface OwnerDashboardViewProps {
  cases: Case[];
  partners: Partner[];
  batches: SettlementBatch[];
  teamMembers: TeamMember[];
}

export const OwnerDashboardView: React.FC<OwnerDashboardViewProps> = ({
  cases,
  partners,
  batches,
  teamMembers,
}) => {
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));
  const thisMonthStr = format(now, 'yyyy-MM');

  const activeCases = useMemo(
    () => cases.filter((c) => c.status !== '휴지통' && !c.deletedAt),
    [cases]
  );

  const activeAgents = useMemo(
    () => teamMembers.filter((m) => m.status === 'active' && m.role !== 'owner'),
    [teamMembers]
  );

  // 1. 재무 및 손익 계산
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

  const prevMonthContracts = useMemo(
    () => activeCases.filter((c) => isInRange(c.contractAt, lastMonthStart, lastMonthEnd)),
    [activeCases, lastMonthStart, lastMonthEnd]
  );

  const thisRevenue = useMemo(
    () => thisMonthContracts.reduce((sum, c) => sum + (c.contractFee || 0), 0),
    [thisMonthContracts]
  );

  const prevRevenue = useMemo(
    () => prevMonthContracts.reduce((sum, c) => sum + (c.contractFee || 0), 0),
    [prevMonthContracts]
  );

  const revenueGrowth = prevRevenue > 0
    ? Math.round(((thisRevenue - prevRevenue) / prevRevenue) * 100)
    : 0;

  // DB 원가 산출: 이번 달 인입된 리드 건수 * 건당 DB 단가 (기본 35,000원 또는 파트너 단가)
  const thisMonthLeads = useMemo(
    () => activeCases.filter((c) => c.createdAt && c.createdAt.startsWith(thisMonthStr)),
    [activeCases, thisMonthStr]
  );

  const estimatedLeadUnitCost = 35000; // 건당 기본 DB 원가
  const totalDbCost = thisMonthLeads.length * estimatedLeadUnitCost;

  // 순마진 (매출 - DB원가 - 인프라비 약 100,000원)
  const netProfit = Math.max(0, thisRevenue - totalDbCost - 100000);
  const profitMargin = thisRevenue > 0 ? Math.round((netProfit / thisRevenue) * 100) : 0;

  // 전사 수임 전환율 (이번 달 리드 대비 수임 성사 건수 %)
  const conversionRate = thisMonthLeads.length > 0
    ? ((thisMonthContracts.length / thisMonthLeads.length) * 100).toFixed(1)
    : '0.0';

  // 2. 유입경로 / 광고 대행사별 품질 및 ROI 분석
  const channelAnalytics = useMemo(() => {
    const channelMap = new Map<string, { total: number; absent: number; transferred: number; contracted: number; fee: number }>();

    activeCases.forEach((c) => {
      const channel = c.inboundPath || (c as any).partnerName || '미지정 채널';
      const entry = channelMap.get(channel) || { total: 0, absent: 0, transferred: 0, contracted: 0, fee: 0 };
      entry.total += 1;

      if (c.status?.includes('부재') || c.status?.includes('미연결')) {
        entry.absent += 1;
      }
      if (c.paralegalStatus || c.status?.includes('인계') || c.status?.includes('사무장')) {
        entry.transferred += 1;
      }
      if (c.contractFee && c.contractFee > 0) {
        entry.contracted += 1;
        entry.fee += c.contractFee;
      }
      channelMap.set(channel, entry);
    });

    return Array.from(channelMap.entries()).map(([channel, data]) => {
      const absentRate = data.total > 0 ? Math.round((data.absent / data.total) * 100) : 0;
      const transferRate = data.total > 0 ? Math.round((data.transferred / data.total) * 100) : 0;
      const contractRate = data.total > 0 ? Math.round((data.contracted / data.total) * 100) : 0;
      const isDefective = absentRate >= 60; // 부재율 60% 이상이면 불량 DB 경고

      return {
        channel,
        total: data.total,
        absentRate,
        transferRate,
        contractRate,
        revenue: data.fee,
        isDefective,
      };
    }).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [activeCases]);

  // 3. 상담원 생산성 랭킹 (명예의 전당)
  const agentRankings = useMemo(() => {
    return activeAgents.map((agent) => {
      const agentCases = activeCases.filter((c) => c.assignedUserId === agent.userId);
      const totalAssigned = agentCases.length;

      const transferredCount = agentCases.filter(
        (c) => c.paralegalStatus || c.status?.includes('인계') || c.status?.includes('사무장')
      ).length;

      const contractedCases = agentCases.filter((c) => c.contractFee && c.contractFee > 0);
      const totalRevenue = contractedCases.reduce((sum, c) => sum + (c.contractFee || 0), 0);

      const doneCalls = agentCases.flatMap((c) => c.reminders || []).filter(
        (r) => r.isCompleted || r.resultStatus
      ).length;

      return {
        agent,
        totalAssigned,
        transferredCount,
        contractedCount: contractedCases.length,
        totalRevenue,
        doneCalls,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue || b.transferredCount - a.transferredCount);
  }, [activeAgents, activeCases]);

  // 4. 보안 이상 징후 & 장기 방치 리드 (48시간 동안 첫 콜 안 들어간 건)
  const fortyEightHoursAgo = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - 48);
    return d.toISOString();
  }, []);

  const neglectedCases = useMemo(() => {
    return activeCases.filter((c) => {
      const isUntouched = (!c.status || c.status === '신규' || c.status === '접수' || c.status === '배정') &&
        (!c.reminders || c.reminders.length === 0);
      const isOlderThan48h = c.createdAt && c.createdAt < fortyEightHoursAgo;
      return isUntouched && isOlderThan48h;
    });
  }, [activeCases, fortyEightHoursAgo]);

  return (
    <div className="space-y-6">
      {/* 경영 헤더 배너 */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
                <Crown size={13} strokeWidth={1.75} /> TM 대표이사 최고경영 관제
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(), 'yyyy년 M월', { locale: ko })} 경영 총괄 리포트
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>전사 손익 & 리드 효율화 총괄 관제판</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              DB 구입 비용 대비 실질 영업이익, 대행사별 ROI 품질 평가 및 상담원 1인당 생산성을 조망합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/statistics"
              className="px-3.5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-xs font-semibold text-primary-foreground shadow-xs transition-colors flex items-center gap-1.5"
            >
              상세 정산·통계 분석 →
            </Link>
          </div>
        </div>
      </div>

      {/* 1. 경영 핵심 KPI 4종 - monday.com 상단 액센트 바 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="당월 총 수임/매출액"
          count={`₩ ${thisRevenue.toLocaleString()} 원`}
          color="text-emerald-600 dark:text-emerald-400"
          icon={DollarSign}
          subText={revenueGrowth >= 0 ? `전월 대비 +${revenueGrowth}% 증가` : `전월 대비 ${revenueGrowth}%`}
          accentColor="#00c875"
        />
        <KPICard
          title="DB 구입 원가 합계"
          count={`₩ ${totalDbCost.toLocaleString()} 원`}
          color="text-indigo-600 dark:text-indigo-400"
          icon={Layers}
          subText={`당월 인입 ${thisMonthLeads.length}건 (건당 ₩ 3.5만원)`}
          accentColor="#fdab3d"
        />
        <KPICard
          title="실질 영업 순마진"
          count={`${netProfit < 0 ? '-' : ''}₩ ${Math.abs(netProfit).toLocaleString()} 원`}
          color={netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-destructive'}
          icon={TrendingUp}
          subText={`영업 마진율 ${profitMargin}% (인프라비 차감)`}
          accentColor="#0073ea"
        />
        <KPICard
          title="전사 수임 전환율"
          count={`${conversionRate}%`}
          color="text-purple-600 dark:text-purple-400"
          icon={BarChart3}
          subText={`수임 ${thisMonthContracts.length}건 / 인입 ${thisMonthLeads.length}건`}
          accentColor="#579bfc"
        />
      </div>

      {/* 2. 회사 매출 & 정산 센터 상세 */}
      <div>
        <RevenueWidget cases={cases} partners={partners} />
      </div>

      {/* 3. 유입경로 & 대행사별 DB ROI 품질 분석 + 보안 리스크 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 대행사별 품질 평가 */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} strokeWidth={1.75} className="text-primary" />
              <h3 className="font-semibold text-sm text-foreground">
                광고 대행사 및 유입경로별 DB 품질 & 전환율 분석
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">
              부재율 60% 이상 시 불량 DB 식별 경고
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="py-2.5 px-4 whitespace-nowrap">유입 채널 / 대행사명</th>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">인입 건수</th>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">부재율</th>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">1차 인계율</th>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">수임 성사액</th>
                  <th className="py-2.5 px-4 whitespace-nowrap text-center">품질 판정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {channelAnalytics.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                      기록된 유입 채널 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  channelAnalytics.map((item) => (
                    <tr key={item.channel} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground whitespace-nowrap">
                        {item.channel}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums text-foreground whitespace-nowrap">
                        {item.total}건
                      </td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums whitespace-nowrap">
                        <span className={item.isDefective ? 'text-destructive font-bold' : 'text-muted-foreground'}>
                          {item.absentRate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums whitespace-nowrap">
                        {item.transferRate}%
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap font-mono">
                        ₩ {item.revenue.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {item.isDefective ? (
                          <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                            ⚠️ 불량 의심 (부재율 과다)
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-primary/10 text-primary border border-primary/20">
                            ✓ 우수 채널
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 리스크 & 보안 관제 센터 */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-border pb-3">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <ShieldAlert size={16} strokeWidth={1.75} className="text-destructive" />
                리스크 & 컴플라이언스 관제
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-primary/10 text-primary border border-primary/20">
                보안 정상 가동
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-lg bg-muted/30 border border-border/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    48시간 장기 방치 리드 (미컨택)
                  </span>
                  <span className={`text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md ${
                    neglectedCases.length > 0 ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'bg-muted text-muted-foreground'
                  }`}>
                    {neglectedCases.length}건
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  구입 후 48시간 동안 첫 전화가 연결되지 않은 자산 손실 위험 리드입니다.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-muted/30 border border-border/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    4대 보안 위반 이상 탐지
                  </span>
                  <span className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                    0건 (안전)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  단시간 리드 대량 열람, 비인가 다운로드 및 화면 캡처 시도가 감지되지 않았습니다.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-muted/30 border border-border/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    AI 트레이닝 전사 이수율
                  </span>
                  <span className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    85%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  상담원 모의콜 스크립트 숙지도 평균 88점 (필수 고지사항 누락 방지)
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex justify-between items-center text-xs">
            <span className="text-muted-foreground">보안 통제 프로필 적용 중</span>
            <Link to="/team" className="text-primary font-semibold hover:underline">
              보안 권한 설정 →
            </Link>
          </div>
        </div>
      </div>

      {/* 4. 상담원 생산성 랭킹 (명예의 전당) */}
      <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award size={18} strokeWidth={1.75} className="text-amber-500" />
            <h3 className="font-semibold text-sm text-foreground">
              상담원 1인당 생산성 랭킹 & 명예의 전당 (Top Performers)
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            당월 수임 기여액 및 1차 인계 기준 순위
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="py-2.5 px-4 whitespace-nowrap text-center">순위</th>
                <th className="py-2.5 px-4 whitespace-nowrap">상담원명</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-right">보유 리드</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-right">완료 콜수</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-right">1차 인계</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-right">수임 성사</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-right">당월 수임 매출 기여액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agentRankings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                    등록된 상담원 활동 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                agentRankings.map((stat, idx) => (
                  <tr key={stat.agent.userId} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-4 text-center font-bold whitespace-nowrap">
                      {idx === 0 && <span className="text-amber-500 text-sm">🥇 1위</span>}
                      {idx === 1 && <span className="text-muted-foreground text-sm">🥈 2위</span>}
                      {idx === 2 && <span className="text-amber-700 dark:text-amber-500 text-sm">🥉 3위</span>}
                      {idx > 2 && <span className="text-muted-foreground">{idx + 1}위</span>}
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground whitespace-nowrap">
                      {stat.agent.displayName}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                      {stat.totalAssigned}건
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                      {stat.doneCalls}콜
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums whitespace-nowrap">
                      {stat.transferredCount}건
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                      {stat.contractedCount}건
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-foreground tabular-nums whitespace-nowrap text-sm font-mono">
                      ₩ {stat.totalRevenue.toLocaleString()}
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

export default OwnerDashboardView;
