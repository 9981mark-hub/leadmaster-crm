import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  PhoneCall,
  Clock,
  AlertCircle,
  Phone,
  Flame,
  CheckCircle2,
  Calendar,
  Zap,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Award,
  Wallet,
  UserCheck,
  Headphones,
  Check,
} from 'lucide-react';
import { Case, ReminderItem } from '../../types';
import { KPICard } from '../ui/KPICard';
import { getReminderStatus } from '../../utils';

interface AgentDashboardViewProps {
  myCases: Case[];
  allCasesCount?: number;
  onShowOverdueModal: () => void;
  onShowWarningModal: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  userName?: string;
  isOwner?: boolean;
}

export const AgentDashboardView: React.FC<AgentDashboardViewProps> = ({
  myCases,
  onShowOverdueModal,
  onShowWarningModal,
  selectedDate,
  onSelectDate,
  userName = '상담원',
  isOwner = false,
}) => {
  const activeCases = useMemo(
    () => myCases.filter((c) => c.status !== '휴지통' && !c.deletedAt),
    [myCases]
  );

  const allRemindersWithCase = useMemo(() => {
    return activeCases.flatMap((c) =>
      (c.reminders || []).map((r) => ({ reminder: r, caseData: c }))
    );
  }, [activeCases]);

  // 1. 오늘 내 리마인더
  const todayReminders = useMemo(() => {
    return allRemindersWithCase.filter(
      (item) =>
        getReminderStatus(item.reminder.datetime) === 'today' &&
        !item.reminder.resultStatus &&
        !item.reminder.isCompleted
    );
  }, [allRemindersWithCase]);

  // 2. 지연된 내 리마인더 (30일 이내)
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);

  const overdueReminders = useMemo(() => {
    return allRemindersWithCase.filter((item) => {
      if (getReminderStatus(item.reminder.datetime) !== 'overdue') return false;
      if (item.reminder.resultStatus || item.reminder.isCompleted) return false;
      if (item.reminder.datetime) {
        const reminderDate = new Date(item.reminder.datetime.replace(' ', 'T'));
        if (!isNaN(reminderDate.getTime()) && reminderDate < thirtyDaysAgo) return false;
      }
      return true;
    });
  }, [allRemindersWithCase, thirtyDaysAgo]);

  // 3. 골든타임 재통화 큐 (부재 1~2회로 지금 바로 전화걸면 성사율 높은 건)
  const goldenTimeCases = useMemo(() => {
    return activeCases.filter((c) => {
      const isAbsent = c.status?.includes('부재') || c.status?.includes('미연결');
      const missedCount = (c as any).missedCallCount || 0;
      return isAbsent || (missedCount >= 1 && missedCount <= 2);
    });
  }, [activeCases]);

  // 4. 오늘 신규 배정 리드 (오늘 생성되었거나 오늘 배정된 리드 중 미처리 건)
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayNewLeads = useMemo(() => {
    return activeCases.filter((c) => {
      const assignedToday = c.assignedAt && c.assignedAt.startsWith(todayStr);
      const createdToday = c.createdAt && c.createdAt.startsWith(todayStr);
      const isUntouched = !c.status || c.status === '신규' || c.status === '접수' || c.status === '배정';
      return (assignedToday || createdToday) && isUntouched;
    });
  }, [activeCases, todayStr]);

  // 5. 오늘 나의 실적 & 인센티브 계산
  const todayCompletedCalls = useMemo(() => {
    return allRemindersWithCase.filter((item) => {
      const isTodayReminder = item.reminder.datetime?.startsWith(todayStr);
      const isDone = item.reminder.isCompleted || item.reminder.resultStatus === '완료';
      return isTodayReminder && isDone;
    }).length;
  }, [allRemindersWithCase, todayStr]);

  // 당월 1차 인계 건수 및 수임 건수
  const thisMonthStart = format(new Date(), 'yyyy-MM');
  const monthlyTransferred = useMemo(() => {
    return activeCases.filter(
      (c) =>
        (c.paralegalStatus || c.status?.includes('인계') || c.status?.includes('사무장')) &&
        (c.statusUpdatedAt?.startsWith(thisMonthStart) || c.updatedAt?.startsWith(thisMonthStart))
    ).length;
  }, [activeCases, thisMonthStart]);

  const monthlyContracted = useMemo(() => {
    return activeCases.filter(
      (c) =>
        (c.contractAt?.startsWith(thisMonthStart) || c.status === '계약완료' || c.status === '수임') &&
        !c.deletedAt
    );
  }, [activeCases, thisMonthStart]);

  // 예상 인센티브 (1차 인계 건당 30,000원 + 수임 건당 50,000원)
  const estimatedIncentive = (monthlyTransferred * 30000) + (monthlyContracted.length * 50000);
  const dailyTarget = 50; // 일일 목표 콜 50콜
  const callProgress = Math.min(100, Math.round((todayCompletedCalls / dailyTarget) * 100));

  // 6. 오늘 시간대별 리마인더 스케줄
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const daySchedule = useMemo(() => {
    return allRemindersWithCase
      .filter((item) => item.reminder.datetime?.startsWith(selectedDateStr))
      .sort((a, b) =>
        String(a.reminder.datetime || '').localeCompare(String(b.reminder.datetime || ''))
      );
  }, [allRemindersWithCase, selectedDateStr]);

  const greetingTitle = useMemo(() => {
    // 1. 대표 직급이거나 userName이 '대표'인 경우
    if (isOwner) {
      if (!userName || userName === '대표' || userName === '상담원') {
        return '대표님';
      }
      if (userName.endsWith('대표') || userName.endsWith('대표님')) {
        return userName.endsWith('님') ? userName : `${userName}님`;
      }
      return `${userName} 대표님`;
    }

    // 2. 일반 상담원 분기
    if (!userName || userName === '상담원') {
      return '상담원님';
    }
    if (userName === '대표') {
      return '대표님';
    }
    if (userName.endsWith('대표') || userName.endsWith('대표님')) {
      return userName.endsWith('님') ? userName : `${userName}님`;
    }
    if (userName.endsWith('상담원') || userName.endsWith('상담원님')) {
      return userName.endsWith('님') ? userName : `${userName}님`;
    }
    if (userName.endsWith('팀장') || userName.endsWith('팀장님')) {
      return userName.endsWith('님') ? userName : `${userName}님`;
    }
    if (userName.endsWith('님')) {
      return userName;
    }
    return `${userName} 상담원님`;
  }, [userName, isOwner]);

  return (
    <div className="space-y-6">
      {/* 상단 웰컴 & 인센티브 현황 바 */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
                <Headphones size={13} strokeWidth={1.75} /> 개인 상담 워크스페이스
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(), 'yyyy년 M월 d일 (E)', { locale: ko })}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>반갑습니다, {greetingTitle}!</span>
              <span className="text-sm font-normal text-muted-foreground">오늘도 목표 달성을 응원합니다.</span>
            </h1>
          </div>

          {/* 당월 예상 인센티브 미니 배지 */}
          <div className="bg-muted/40 border border-border rounded-xl p-3.5 flex items-center gap-4 shrink-0">
            <div>
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Wallet size={13} strokeWidth={1.75} className="text-amber-500" /> 이번 달 예상 인센티브
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold text-foreground tabular-nums font-mono">
                  ₩ {estimatedIncentive.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">원</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                1차 인계 {monthlyTransferred}건 · 수임 성사 {monthlyContracted.length}건
              </div>
            </div>
            <div className="h-9 w-px bg-border" />
            <div>
              <div className="text-xs text-muted-foreground font-medium">오늘 콜 달성률</div>
              <div className="text-base font-bold text-foreground tabular-nums mt-0.5">
                {todayCompletedCalls} / {dailyTarget}콜 <span className="text-xs text-primary font-semibold">({callProgress}%)</span>
              </div>
              <div className="w-28 bg-muted h-1.5 rounded-full overflow-hidden mt-1.5 border border-border/50">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${callProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4대 핵심 행동 KPI 카드 - monday.com 상단 액센트 바 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="오늘 내 리마인더"
          count={todayReminders.length}
          color="text-blue-600 dark:text-blue-400"
          icon={PhoneCall}
          subText="오늘 약속된 통화 건"
          pulseGlow={todayReminders.length > 0}
          accentColor="#0073ea"
        />
        <div
          onClick={onShowOverdueModal}
          className="cursor-pointer hover:scale-[1.02] transition-transform h-full"
        >
          <KPICard
            title="지연된 내 리마인더"
            count={overdueReminders.length}
            color="text-destructive"
            icon={Clock}
            subText="약속 시간 초과 (즉시 조치)"
            pulseGlow={overdueReminders.length > 0}
            accentColor="#df2f4a"
          />
        </div>
        <Link
          to="/cases"
          onClick={() => sessionStorage.setItem('lm_showOverdueMissed', 'true')}
          className="hover:scale-[1.02] transition-transform h-full"
        >
          <KPICard
            title="골든타임 재통화 큐"
            count={goldenTimeCases.length}
            color="text-amber-600 dark:text-amber-400"
            icon={Flame}
            subText="부재 1~2회 (연결확률 높음)"
            pulseGlow={goldenTimeCases.length > 0}
            accentColor="#fdab3d"
          />
        </Link>
        <Link
          to="/cases"
          className="hover:scale-[1.02] transition-transform h-full"
        >
          <KPICard
            title="오늘 신규 배정 리드"
            count={todayNewLeads.length}
            color="text-emerald-600 dark:text-emerald-400"
            icon={UserCheck}
            subText="오늘 나에게 온 신규 리드"
            accentColor="#00c875"
          />
        </Link>
      </div>

      {/* 쾌속 영업 런처 & 오늘의 AI 코칭 팁 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 원터치 런처 바 */}
        <div className="lg:col-span-1 bg-card rounded-xl p-5 border border-border shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-3">
              <Zap size={16} strokeWidth={1.75} className="text-amber-500" />
              쾌속 영업 런처
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              <Link
                to="/auto-dial"
                className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted border border-border transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-primary/10 text-primary rounded-md border border-primary/20">
                    <Zap size={16} strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      스마트 오토콜 시작
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      대기 없이 연속 자동 다이얼링
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} strokeWidth={1.75} className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                to="/lite-call"
                className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted border border-border transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md border border-indigo-500/20">
                    <Headphones size={16} strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      간편 콜 모드 전환
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      다이얼패드 + 메모 집중 화면
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} strokeWidth={1.75} className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>내 보유 리드: <strong className="text-foreground">{activeCases.length}건</strong></span>
            <Link to="/cases" className="text-primary font-medium hover:underline">
              전체 보기 →
            </Link>
          </div>
        </div>

        {/* 오늘의 AI 코칭 팁 & 공지 */}
        <div className="lg:col-span-2 bg-card rounded-xl p-5 border border-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles size={15} strokeWidth={1.75} className="text-amber-500" />
                오늘의 AI 통화 코칭 팁
              </span>
              <span className="text-[11px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md font-semibold">
                성공률 +28% UP
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              "채무 상담 고객과의 첫 15초는 <strong className="text-foreground">'빚이 얼마나 힘드셨습니까'</strong>라는 공감 질문으로 열었을 때 1차 인계 동의율이 가장 높습니다. 서류나 비용을 먼저 언급하기보다 현재 독촉 상태를 먼저 경청해주세요."
            </p>
          </div>

          <div className="mt-3.5 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Award size={14} strokeWidth={1.75} className="text-amber-500" /> AI 스크립트 트레이닝 완료 시 건당 인계율 +15% 증가
            </span>
            <Link to="/training" className="font-semibold text-primary hover:underline">
              AI 모의콜 연습하기 →
            </Link>
          </div>
        </div>
      </div>

      {/* 오늘 나의 콜 스케줄 타임라인 */}
      <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={16} strokeWidth={1.75} className="text-primary" />
            <h3 className="font-semibold text-sm text-foreground">
              오늘 나의 콜 스케줄 ({daySchedule.length}건)
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            시간대별 약속 통화 리스트
          </span>
        </div>

        <div className="divide-y divide-border max-h-[360px] overflow-y-auto">
          {daySchedule.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              오늘 예정된 리마인더 일정이 없습니다. 신규 리드나 골든타임 재통화 큐를 확인하세요!
            </div>
          ) : (
            daySchedule.map((item) => {
              const timeStr = item.reminder.datetime?.split(' ')[1] || '00:00';
              const isDone = item.reminder.isCompleted || item.reminder.resultStatus;

              return (
                <div
                  key={item.reminder.id}
                  className="p-3.5 hover:bg-muted/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-semibold text-foreground bg-muted border border-border px-2 py-1 rounded-md shrink-0 tabular-nums">
                      {timeStr}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/case/${item.caseData.caseId}`}
                          className="font-semibold text-xs text-foreground hover:text-primary transition-colors"
                        >
                          {item.caseData.customerName}
                        </Link>
                        <span className="text-xs text-muted-foreground/50">|</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {item.caseData.phone}
                        </span>
                        {item.caseData.inboundPath && (
                          <span className="text-[10px] bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded-md font-medium">
                            {item.caseData.inboundPath}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.reminder.content || '예약 내용 없음'}
                      </p>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {isDone ? (
                      <span className="text-xs px-2.5 py-1 rounded-md bg-muted text-muted-foreground border border-border font-medium flex items-center gap-1">
                        <Check size={13} strokeWidth={1.75} /> {item.reminder.resultStatus || '완료됨'}
                      </span>
                    ) : (
                      <>
                        <a
                          href={`tel:${item.caseData.phone}`}
                          className="px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                        >
                          <Phone size={12} strokeWidth={1.75} /> 전화걸기
                        </a>
                        <Link
                          to={`/case/${item.caseData.caseId}`}
                          className="px-2.5 py-1 bg-card hover:bg-muted border border-border text-foreground rounded-md text-xs font-medium transition-colors shadow-xs"
                        >
                          상세보기
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentDashboardView;
