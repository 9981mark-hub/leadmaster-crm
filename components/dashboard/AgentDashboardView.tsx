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
}

export const AgentDashboardView: React.FC<AgentDashboardViewProps> = ({
  myCases,
  onShowOverdueModal,
  onShowWarningModal,
  selectedDate,
  onSelectDate,
  userName = '상담원',
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

  return (
    <div className="space-y-6">
      {/* 상단 웰컴 & 인센티브 현황 바 */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 backdrop-blur-3xl transform skew-x-12 pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white flex items-center gap-1">
                <Headphones size={13} /> 개인 상담 워크스페이스
              </span>
              <span className="text-xs text-blue-100">
                {format(new Date(), 'yyyy년 M월 d일 (E)', { locale: ko })}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <span>반갑습니다, {userName} 상담원님!</span>
              <span className="text-base font-normal text-blue-100">오늘도 목표 달성을 응원합니다.</span>
            </h1>
          </div>

          {/* 당월 예상 인센티브 미니 배지 */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-4 shrink-0">
            <div>
              <div className="text-[11px] text-blue-100 font-medium flex items-center gap-1">
                <Wallet size={13} className="text-amber-300" /> 이번 달 예상 인센티브
              </div>
              <div className="text-xl font-black text-amber-300 tabular-nums">
                ₩{estimatedIncentive.toLocaleString()}
              </div>
              <div className="text-[10px] text-blue-100">
                1차 인계 {monthlyTransferred}건 · 수임 성사 {monthlyContracted.length}건
              </div>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div>
              <div className="text-[11px] text-blue-100 font-medium">오늘 콜 달성률</div>
              <div className="text-lg font-bold text-white tabular-nums">
                {todayCompletedCalls} / {dailyTarget}콜 ({callProgress}%)
              </div>
              <div className="w-24 bg-white/20 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${callProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4대 핵심 행동 KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="오늘 내 리마인더"
          count={todayReminders.length}
          color="text-blue-600"
          icon={PhoneCall}
          subText="오늘 약속된 통화 건"
          pulseGlow={todayReminders.length > 0}
        />
        <div
          onClick={onShowOverdueModal}
          className="cursor-pointer hover:scale-[1.02] transition-transform h-full"
        >
          <KPICard
            title="지연된 내 리마인더"
            count={overdueReminders.length}
            color="text-red-600"
            icon={Clock}
            subText="약속 시간 초과 (즉시 조치)"
            pulseGlow={overdueReminders.length > 0}
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
            color="text-amber-600"
            icon={Flame}
            subText="부재 1~2회 (연결확률 높음)"
            pulseGlow={goldenTimeCases.length > 0}
          />
        </Link>
        <Link
          to="/cases"
          className="hover:scale-[1.02] transition-transform h-full"
        >
          <KPICard
            title="오늘 신규 배정 리드"
            count={todayNewLeads.length}
            color="text-emerald-600"
            icon={UserCheck}
            subText="오늘 나에게 온 신규 리드"
          />
        </Link>
      </div>

      {/* 쾌속 영업 런처 & 오늘의 AI 코칭 팁 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 원터치 런처 바 */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl p-4 border border-slate-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mb-3">
              <Zap size={16} className="text-amber-500" />
              쾌속 영업 런처
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <Link
                to="/auto-dial"
                className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-600 text-white rounded-md">
                    <Zap size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-blue-900 dark:text-blue-100">
                      스마트 오토콜 시작
                    </div>
                    <div className="text-[11px] text-blue-600 dark:text-blue-300">
                      대기 없이 연속 자동 다이얼링
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-blue-500 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                to="/lite-call"
                className="flex items-center justify-between p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-600 text-white rounded-md">
                    <Headphones size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-indigo-900 dark:text-indigo-100">
                      간편 콜 모드 전환
                    </div>
                    <div className="text-[11px] text-indigo-600 dark:text-indigo-300">
                      다이얼패드 + 메모 집중 화면
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-indigo-500 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-gray-700 flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
            <span>내 보유 리드: <strong>{activeCases.length}건</strong></span>
            <Link to="/cases" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
              전체 보기 →
            </Link>
          </div>
        </div>

        {/* 오늘의 AI 코칭 팁 & 공지 */}
        <div className="lg:col-span-2 bg-gradient-to-br from-amber-50 to-orange-50/60 dark:from-gray-800 dark:to-gray-800/90 rounded-xl p-4 border border-amber-200/80 dark:border-amber-900/40 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <Sparkles size={15} className="text-amber-600" />
                오늘의 AI 통화 코칭 팁
              </span>
              <span className="text-[10px] bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded font-bold">
                성공률 +28% UP
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              "채무 상담 고객과의 첫 15초는 <strong>'빚이 얼마나 힘드셨습니까'</strong>라는 공감 질문으로 열었을 때 1차 인계 동의율이 가장 높습니다. 서류나 비용을 먼저 언급하기보다 현재 독촉 상태를 먼저 경청해주세요."
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-amber-200/60 dark:border-gray-700 flex items-center justify-between text-xs text-amber-800 dark:text-amber-400">
            <span className="flex items-center gap-1">
              <Award size={14} /> AI 스크립트 트레이닝 완료 시 건당 인계율 +15% 증가
            </span>
            <Link to="/training" className="font-bold underline hover:text-amber-900">
              AI 모의콜 연습하기 →
            </Link>
          </div>
        </div>
      </div>

      {/* 오늘 나의 콜 스케줄 타임라인 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50/70 dark:bg-gray-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-blue-600" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              오늘 나의 콜 스케줄 ({daySchedule.length}건)
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-gray-400">
            시간대별 약속 통화 리스트
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-gray-700/60 max-h-[360px] overflow-y-auto">
          {daySchedule.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-gray-500 text-xs">
              오늘 예정된 리마인더 일정이 없습니다. 신규 리드나 골든타임 재통화 큐를 확인하세요!
            </div>
          ) : (
            daySchedule.map((item) => {
              const timeStr = item.reminder.datetime?.split(' ')[1] || '00:00';
              const isDone = item.reminder.isCompleted || item.reminder.resultStatus;

              return (
                <div
                  key={item.reminder.id}
                  className="p-3.5 hover:bg-slate-50 dark:hover:bg-gray-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-gray-700 px-2 py-1 rounded shrink-0">
                      {timeStr}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/case/${item.caseData.caseId}`}
                          className="font-bold text-sm text-slate-800 dark:text-slate-100 hover:text-blue-600 hover:underline"
                        >
                          {item.caseData.customerName}
                        </Link>
                        <span className="text-xs text-slate-400">|</span>
                        <span className="text-xs text-slate-600 dark:text-gray-400">
                          {item.caseData.phone}
                        </span>
                        {item.caseData.inboundPath && (
                          <span className="text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded">
                            {item.caseData.inboundPath}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-gray-400 truncate mt-0.5">
                        {item.reminder.content || '예약 내용 없음'}
                      </p>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {isDone ? (
                      <span className="text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 font-semibold flex items-center gap-1">
                        <Check size={13} /> {item.reminder.resultStatus || '완료됨'}
                      </span>
                    ) : (
                      <>
                        <a
                          href={`tel:${item.caseData.phone}`}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                        >
                          <Phone size={12} /> 전화걸기
                        </a>
                        <Link
                          to={`/case/${item.caseData.caseId}`}
                          className="px-2.5 py-1 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-gray-200 rounded text-xs font-medium transition-colors"
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
