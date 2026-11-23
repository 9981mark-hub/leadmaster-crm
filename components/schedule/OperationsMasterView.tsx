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
      <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Building size={20} strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-md border border-primary/20 tracking-tight">
                총괄 관리자 · 센터 운영 관제 뷰
              </span>
              <span className="text-2xs text-muted-foreground font-medium">{todayFormatted}</span>
            </div>
            <h3 className="text-sm font-semibold text-foreground mt-1">
              센터 전사 외근(방문/출장), 팀별 지연 콜 병목 모니터링 및 실무 파이프라인
            </h3>
          </div>
        </div>

        {/* 팀 필터 칩 */}
        <div className="flex items-center gap-2">
          <span className="text-2xs text-muted-foreground font-medium flex items-center gap-1">
            <Filter size={12} strokeWidth={1.75} /> 팀 필터:
          </span>
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/80">
            <button
              onClick={() => setSelectedTeamFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                selectedTeamFilter === 'all'
                  ? 'bg-background text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              전체
            </button>
            {availableTeams.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTeamFilter(t)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  selectedTeamFilter === t
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
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
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span className="flex items-center gap-1.5 text-foreground">
              <Users size={14} strokeWidth={1.75} className="text-primary" />
              센터 상담 인력
            </span>
            <span className="text-2xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 tracking-tight">
              가동 중
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              정상 근무
            </span>
          </div>
          <div className="text-2xs text-muted-foreground mt-2 font-normal">
            전체 팀 영업 가동 상태
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span className="flex items-center gap-1.5 text-foreground">
              <MapPin size={14} strokeWidth={1.75} className="text-muted-foreground" />
              오늘 대면 미팅
            </span>
            <span className="text-2xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border tracking-tight">
              외근·방문
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {operationsData.fieldMeetings.length}
            </span>
            <span className="text-xs text-muted-foreground">건</span>
          </div>
          <div className="text-2xs text-muted-foreground mt-2 font-normal">
            출장 {operationsData.fieldMeetings.filter(m => m.reminder.type === '출장미팅').length}건 / 
            방문 {operationsData.fieldMeetings.filter(m => m.reminder.type === '방문미팅').length}건
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span className="flex items-center gap-1.5 text-foreground">
              <DollarSign size={14} strokeWidth={1.75} className="text-primary" />
              오늘 입금 약속
            </span>
            <span className="text-2xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 tracking-tight">
              예상 실현
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-semibold tracking-tight text-primary tabular-nums">
              {operationsData.depositPromises.length}
            </span>
            <span className="text-xs text-primary font-medium">건</span>
          </div>
          <div className="text-2xs text-muted-foreground mt-2 font-normal tabular-nums">
            예상 약정액: ₩ {operationsData.depositTotalAmount.toLocaleString()}원
          </div>
        </div>

        <div className={`p-4 rounded-xl border shadow-xs ${
          operationsData.totalOverdue > 0 ? 'bg-destructive/5 border-destructive/20' : 'bg-card border-border'
        }`}>
          <div className="flex items-center justify-between text-xs font-medium mb-1">
            <span className={`flex items-center gap-1.5 ${operationsData.totalOverdue > 0 ? 'text-destructive font-semibold' : 'text-foreground'}`}>
              <AlertTriangle size={14} strokeWidth={1.75} className={operationsData.totalOverdue > 0 ? 'text-destructive' : 'text-muted-foreground'} />
              지연된 콜 (Overdue)
            </span>
            {operationsData.totalOverdue > 0 && (
              <span className="text-2xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20 tracking-tight">
                집중 관리
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-2xl font-semibold tracking-tight tabular-nums ${operationsData.totalOverdue > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {operationsData.totalOverdue}
            </span>
            <span className="text-xs text-muted-foreground">건</span>
          </div>
          <div className="text-2xs text-muted-foreground mt-2 font-normal">
            약속시간 경과 미완료 리마인더
          </div>
        </div>
      </div>

      {/* 2단: 오늘 전사 외근/방문 미팅 현황판 */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-foreground">
              <MapPin size={16} strokeWidth={1.75} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">오늘 전사 외근(출장/방문) 미팅 통합 현황판</h4>
              <p className="text-xs text-muted-foreground">외근 나간 상담원 위치 및 계약 체결 대면 일정을 확인하세요.</p>
            </div>
          </div>
          <span className="text-2xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-md border border-border tracking-tight">
            총 {filteredMeetings.length}건
          </span>
        </div>

        {filteredMeetings.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-xs font-normal">
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
                  className="p-3 rounded-lg bg-muted/40 border border-border hover:border-primary/40 hover:bg-muted/70 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-muted text-foreground border border-border tracking-tight">
                      {reminder.type}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                          {caseData.customerName || '고객명 미상'}
                        </span>
                        <span className="text-2xs text-muted-foreground">
                          [{team}] {caseData.assignee || '미지정'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {reminder.content || '상세 메모 없음'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-right">
                    <div className="text-xs font-medium text-primary flex items-center gap-1">
                      <Clock size={12} strokeWidth={1.75} />
                      {time}
                    </div>
                    <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3단: 팀별 지연(Overdue) 리마인더 병목 감지 및 독려 패널 */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} strokeWidth={1.75} className="text-destructive" />
            <div>
              <h4 className="text-sm font-semibold text-foreground">팀별 지연(Overdue) 리마인더 병목 모니터링</h4>
              <p className="text-xs text-muted-foreground">각 팀별로 당일 처리되지 않고 밀린 고객 콜 건수와 독려 상태입니다.</p>
            </div>
          </div>
          <span className="text-2xs font-semibold text-destructive bg-destructive/10 px-2.5 py-1 rounded-md border border-destructive/20 tracking-tight">
            총 {operationsData.totalOverdue}건 지연
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.entries(operationsData.teamOverdueMap) as [string, { count: number; items: { caseData: Case; reminder: ReminderItem }[] }][]).map(([teamName, data]) => {
            const hasOverdue = data.count > 0;
            return (
              <div 
                key={teamName}
                className={`p-3.5 rounded-lg border flex flex-col justify-between transition-all ${
                  hasOverdue 
                    ? 'bg-destructive/5 border-destructive/20' 
                    : 'bg-muted/40 border-border'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">{teamName}</span>
                    <span className={`text-2xs font-semibold px-2 py-0.5 rounded border tracking-tight ${
                      hasOverdue ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-primary/10 text-primary border border-primary/20'
                    }`}>
                      {hasOverdue ? `${data.count}건 지연` : '정상 완료'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {hasOverdue 
                      ? '약속 시간이 지난 미완료 상담 건이 있습니다.'
                      : '모든 리마인더가 정상 처리되었습니다.'}
                  </p>
                </div>

                {hasOverdue && (
                  <div className="mt-3 pt-2.5 border-t border-destructive/20 flex justify-end">
                    <button
                      onClick={() => handleNudgeTeam(teamName, data.count)}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-medium rounded-md border border-destructive/20 transition-all shadow-2xs"
                    >
                      <BellRing size={12} strokeWidth={1.75} />
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
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Calendar size={18} strokeWidth={1.75} className="text-primary" />
            <div>
              <h4 className="text-sm font-semibold text-foreground">센터 주간 정산 & 운영 실무 파이프라인</h4>
              <p className="text-xs text-muted-foreground">주간 마감부터 청구서 발행, 급여 지급 및 DB 회수까지의 실무 타임라인</p>
            </div>
          </div>
          <span className="text-2xs font-medium text-muted-foreground tracking-tight">단계별 정규 프로세스</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg bg-muted/40 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">[1단계] 수임 건 마감</span>
              <span className="text-2xs bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-semibold tracking-tight">완료</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              전 팀 수임 사건 계약서 및 입금 내역 1차 대사 마감
            </p>
            <div className="text-2xs text-muted-foreground mt-2 font-normal">매주 월요일 18:00</div>
          </div>

          <div className="p-3.5 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">[2단계] 로펌 청구서 발송</span>
              <span className="text-2xs bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-semibold tracking-tight">진행중</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              제휴 법률사무소별 세금계산서 발행 및 수수료 입금 요청
            </p>
            <div className="text-2xs text-primary mt-2 font-normal">매주 화요일 정기 발송</div>
          </div>

          <div className="p-3.5 rounded-lg bg-muted/40 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">[3단계] 수당 지급</span>
              <span className="text-2xs bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded font-semibold tracking-tight">D-1 대기</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              상담원 개인별 인센티브 확정 및 급여 계좌 일괄 이체
            </p>
            <div className="text-2xs text-muted-foreground mt-2 font-normal">매주 수요일 정오(12:00)</div>
          </div>

          <div className="p-3.5 rounded-lg bg-muted/40 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">[4단계] DB 수명 관리</span>
              <span className="text-2xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-semibold tracking-tight">정기 회수</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              3일 이상 미접촉 장기 방치 리드 40건 일괄 회수 및 재배분
            </p>
            <div className="text-2xs text-muted-foreground mt-2 font-normal">매주 목요일 10:00</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationsMasterView;
