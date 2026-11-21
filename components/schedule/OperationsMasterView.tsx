import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Building, Users, MapPin, DollarSign, AlertTriangle, 
  Clock, ArrowUpRight, CheckCircle2, ChevronRight,
  Filter, BellRing, RefreshCw, PhoneForwarded, Calendar
} from 'lucide-react';
import { Case, ReminderItem } from '../../types';
import { useToast } from '../../contexts/ToastContext';

interface OperationsMasterViewProps {
  cases: Case[];
  onSelectDate?: (date: Date) => void;
}

export const OperationsMasterView: React.FC<OperationsMasterViewProps> = ({
  cases = [],
  onSelectDate
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const todayFormatted = useMemo(() => format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko }), []);

  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');

  // 팀 목록 추출
  const availableTeams = useMemo(() => {
    const teams = new Set<string>();
    cases.forEach(c => {
      if (c.teamName) teams.add(c.teamName);
    });
    return Array.from(teams);
  }, [cases]);

  // 1. 센터 전체 당일 가동 현황 계산
  const operationsData = useMemo(() => {
    const activeCases = cases.filter(c => c.status !== '휴지통' && !c.deletedAt);
    const nowStr = format(new Date(), 'yyyy-MM-dd HH:mm');

    const fieldMeetings: { caseData: Case; reminder: ReminderItem; team: string }[] = [];
    const depositPromises: { caseData: Case; reminder: ReminderItem; team: string }[] = [];
    
    // 팀별 Overdue 집계
    const teamOverdueMap: Record<string, { count: number; items: { caseData: Case; reminder: ReminderItem }[] }> = {};
    let totalOverdue = 0;

    activeCases.forEach(c => {
      const team = c.teamName || '미지정팀';
      if (!teamOverdueMap[team]) {
        teamOverdueMap[team] = { count: 0, items: [] };
      }

      (c.reminders || []).forEach(r => {
        if (!r.datetime) return;
        const dateStr = r.datetime.split(' ')[0];

        // 오늘 일정
        if (dateStr === todayStr) {
          if (r.type === '출장미팅' || r.type === '방문미팅') {
            fieldMeetings.push({ caseData: c, reminder: r, team });
          }
          if (r.type === '입금') {
            depositPromises.push({ caseData: c, reminder: r, team });
          }
        }

        // 지연(Overdue) 일정
        if (!r.resultStatus && r.datetime < nowStr) {
          totalOverdue++;
          teamOverdueMap[team].count++;
          teamOverdueMap[team].items.push({ caseData: c, reminder: r });
        }
      });
    });

    // 예상 입금 총액 계산
    const depositTotalAmount = depositPromises.reduce((sum, item) => sum + (item.caseData.contractFee || 0), 0);

    return {
      fieldMeetings: fieldMeetings.sort((a, b) => (a.reminder.datetime || '').localeCompare(b.reminder.datetime || '')),
      depositPromises: depositPromises.sort((a, b) => (a.reminder.datetime || '').localeCompare(b.reminder.datetime || '')),
      teamOverdueMap,
      totalOverdue,
      depositTotalAmount
    };
  }, [cases, todayStr]);

  // 필터링된 대면 미팅
  const filteredMeetings = useMemo(() => {
    if (selectedTeamFilter === 'all') return operationsData.fieldMeetings;
    return operationsData.fieldMeetings.filter(m => m.team === selectedTeamFilter);
  }, [operationsData.fieldMeetings, selectedTeamFilter]);

  // 팀장 독려 알림 핸들러
  const handleNudgeTeam = (teamName: string, overdueCount: number) => {
    showToast(`[${teamName}] 팀장에게 지연된 고객 콜(${overdueCount}건) 처리 독려 알림을 발송했습니다.`, 'info');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 상단 헤더 배너 */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-purple-100 to-purple-50 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900 border border-purple-200 dark:border-purple-900/40 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-inner">
            <Building size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-100/80 dark:bg-purple-950/80 px-2.5 py-0.5 rounded-full border border-purple-200/60 dark:border-purple-800/60">
                총괄 관리자 · 센터 운영 관제 뷰
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{todayFormatted}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              센터 전사 외근(방문/출장), 팀별 지연 콜 병목 모니터링 및 실무 파이프라인
            </h3>
          </div>
        </div>

        {/* 팀 필터 칩 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
            <Filter size={12} /> 팀 필터:
          </span>
          <div className="flex items-center gap-1 bg-white dark:bg-gray-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setSelectedTeamFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedTeamFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-white'
              }`}
            >
              전체
            </button>
            {availableTeams.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTeamFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedTeamFilter === t
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 1단: 오늘 센터 가동 핵심 요약 바 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <Users size={14} className="text-indigo-600 dark:text-indigo-400" />
              센터 상담 인력
            </span>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-800/50">
              가동 중
            </span>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            정상 근무
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            전체 팀 영업 가동 상태
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-purple-600 dark:text-purple-400" />
              오늘 대면 미팅
            </span>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-bold bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded border border-purple-200/50 dark:border-purple-800/50">
              외근·방문
            </span>
          </div>
          <div className="text-xl font-black text-purple-300">
            {operationsData.fieldMeetings.length}건
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            출장 {operationsData.fieldMeetings.filter(m => m.reminder.type === '출장미팅').length}건 / 
            방문 {operationsData.fieldMeetings.filter(m => m.reminder.type === '방문미팅').length}건
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <DollarSign size={14} className="text-emerald-600 dark:text-emerald-400" />
              오늘 입금 약속
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/50">
              예상 실현
            </span>
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {operationsData.depositPromises.length}건
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            예상 약정액: ₩ {operationsData.depositTotalAmount.toLocaleString()}원
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-sm ${
          operationsData.totalOverdue > 0 ? 'bg-rose-100/20 dark:bg-rose-950/20 border-rose-900/40' : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800/80'
        }`}>
          <div className="flex items-center justify-between text-xs font-semibold mb-1">
            <span className={`flex items-center gap-1.5 ${operationsData.totalOverdue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
              <AlertTriangle size={14} className={operationsData.totalOverdue > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-500 dark:text-slate-400'} />
              지연된 콜 (Overdue)
            </span>
            {operationsData.totalOverdue > 0 && (
              <span className="text-xs text-rose-600 dark:text-rose-400 font-bold bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded border border-rose-200/50 dark:border-rose-800/50">
                집중 관리
              </span>
            )}
          </div>
          <div className={`text-xl font-black ${operationsData.totalOverdue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
            {operationsData.totalOverdue}건
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            약속시간 경과 미완료 리마인더
          </div>
        </div>
      </div>

      {/* 2단: 오늘 전사 외근/방문 미팅 현황판 */}
      <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <MapPin size={16} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">오늘 전사 외근(출장/방문) 미팅 통합 현황판</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">외근 나간 상담원 위치 및 계약 체결 대면 일정을 확인하세요.</p>
            </div>
          </div>
          <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-100/80 dark:bg-purple-950/80 px-2.5 py-1 rounded-full border border-purple-200/50 dark:border-purple-800/50">
            총 {filteredMeetings.length}건
          </span>
        </div>

        {filteredMeetings.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            오늘 예정된 출장 또는 방문 대면 미팅이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredMeetings.map(({ caseData, reminder, team }) => {
              const time = reminder.datetime?.split(' ')[1] || '시간미정';
              const isOut = reminder.type === '출장미팅';
              return (
                <div
                  key={reminder.id}
                  onClick={() => navigate(`/cases/${caseData.caseId}`)}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-purple-500/50 hover:bg-slate-100/40 dark:bg-slate-800/40 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      isOut ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}>
                      {reminder.type}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-purple-300 transition-colors">
                          {caseData.customerName || '고객명 미상'}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          [{team}] {caseData.assignee || '미지정'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {reminder.content || '상세 메모 없음'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-right">
                    <div className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                      <Clock size={12} />
                      {time}
                    </div>
                    <ArrowUpRight size={16} className="text-slate-500 group-hover:text-purple-600 dark:text-purple-400 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3단: 팀별 지연(Overdue) 리마인더 병목 감지 및 독려 패널 */}
      <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400" />
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">팀별 지연(Overdue) 리마인더 병목 모니터링</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">각 팀별로 당일 처리되지 않고 밀린 고객 콜 건수와 독려 상태입니다.</p>
            </div>
          </div>
          <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-100/80 dark:bg-rose-950/80 px-2.5 py-1 rounded-full border border-rose-200/50 dark:border-rose-800/50">
            총 {operationsData.totalOverdue}건 지연
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {(Object.entries(operationsData.teamOverdueMap) as [string, { count: number; items: { caseData: Case; reminder: ReminderItem }[] }][]).map(([teamName, data]) => {
            const hasOverdue = data.count > 0;
            return (
              <div 
                key={teamName}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  hasOverdue 
                    ? 'bg-rose-100/20 dark:bg-rose-950/20 border-rose-900/50' 
                    : 'bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/70 dark:border-slate-800/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{teamName}</span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded ${
                      hasOverdue ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {hasOverdue ? `${data.count}건 지연` : '정상 완료'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    {hasOverdue 
                      ? '약속 시간이 지난 미완료 상담 건이 있습니다.'
                      : '모든 리마인더가 정상 처리되었습니다.'}
                  </p>
                </div>

                {hasOverdue && (
                  <div className="mt-4 pt-3 border-t border-rose-900/30 flex justify-end">
                    <button
                      onClick={() => handleNudgeTeam(teamName, data.count)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                    >
                      <BellRing size={13} />
                      팀장 독려 알림
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4단: 주간 정산 & 운영 파이프라인 트래커 */}
      <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-indigo-600 dark:text-indigo-400" />
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">센터 주간 정산 & 운영 실무 파이프라인</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">주간 마감부터 청구서 발행, 급여 지급 및 DB 회수까지의 실무 타임라인</p>
            </div>
          </div>
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">단계별 정규 프로세스</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">[1단계] 수임 건 마감</span>
              <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">완료</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              전 팀 수임 사건 계약서 및 입금 내역 1차 대사 마감
            </p>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">매주 월요일 18:00</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-indigo-200/40 dark:border-indigo-900/40 bg-indigo-950/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300">[2단계] 로펌 청구서 발송</span>
              <span className="text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold">진행중</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              제휴 법률사무소별 세금계산서 발행 및 수수료 입금 요청
            </p>
            <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 font-medium">매주 화요일 정기 발송</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">[3단계] 수당 지급</span>
              <span className="text-xs bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded font-bold">D-1 대기</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              상담원 개인별 인센티브 확정 및 급여 계좌 일괄 이체
            </p>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">매주 수요일 정오(12:00)</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">[4단계] DB 수명 관리</span>
              <span className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold">정기 회수</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              3일 이상 미접촉 장기 방치 리드 40건 일괄 회수 및 재배분
            </p>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">매주 목요일 10:00</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationsMasterView;
