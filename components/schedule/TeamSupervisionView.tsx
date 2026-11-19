import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Users, DollarSign, MapPin, Clock, Phone, AlertTriangle, 
  ArrowUpRight, CheckCircle2, MessageSquare, Handshake,
  Calendar, ShieldCheck, Sparkles, ChevronRight
} from 'lucide-react';
import { Case, ReminderItem } from '../../types';
import { useToast } from '../../contexts/ToastContext';

interface TeamSupervisionViewProps {
  cases: Case[];
  currentTeamName?: string;
  onSelectDate?: (date: Date) => void;
}

export const TeamSupervisionView: React.FC<TeamSupervisionViewProps> = ({
  cases = [],
  currentTeamName = '영업 1팀',
  onSelectDate
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const todayFormatted = useMemo(() => format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko }), []);

  // 1. 우리 팀 케이스만 필터링 (팀 격리 원칙)
  const teamCases = useMemo(() => {
    return cases.filter(c => {
      if (c.status === '휴지통' || c.deletedAt) return false;
      // 팀명이 일치하거나, 팀명이 없는 경우 포함
      if (currentTeamName && c.teamName) {
        return c.teamName.trim().toLowerCase() === currentTeamName.trim().toLowerCase();
      }
      return true;
    });
  }, [cases, currentTeamName]);

  // 2. 팀원 목록 추출
  const teamMembers = useMemo(() => {
    const members = new Set<string>();
    teamCases.forEach(c => {
      if (c.assignee) members.add(c.assignee);
    });
    return Array.from(members);
  }, [teamCases]);

  // 3. 팀 오늘 핵심 일정 집계
  const teamTodayData = useMemo(() => {
    const depositPromises: { caseData: Case; reminder: ReminderItem }[] = [];
    const fieldMeetings: { caseData: Case; reminder: ReminderItem }[] = [];
    const closerRequests: { caseData: Case; reminder: ReminderItem }[] = [];
    let overdueCount = 0;
    const nowStr = format(new Date(), 'yyyy-MM-dd HH:mm');

    // 팀원별 일정 매핑
    const memberTimelineMap: Record<string, { caseData: Case; reminder: ReminderItem }[]> = {};

    teamCases.forEach(c => {
      const member = c.assignee || '미지정 상담원';
      if (!memberTimelineMap[member]) {
        memberTimelineMap[member] = [];
      }

      (c.reminders || []).forEach(r => {
        if (!r.datetime) return;
        const dateStr = r.datetime.split(' ')[0];

        // 오늘 일정
        if (dateStr === todayStr) {
          memberTimelineMap[member].push({ caseData: c, reminder: r });

          if (r.type === '입금') {
            depositPromises.push({ caseData: c, reminder: r });
          }
          if (r.type === '출장미팅' || r.type === '방문미팅') {
            fieldMeetings.push({ caseData: c, reminder: r });
          }
          // 클로징 동행 요청 (메모에 '동행', '3자', '팀장' 포함 시)
          if (
            (r.content && (r.content.includes('동행') || r.content.includes('3자') || r.content.includes('팀장') || r.content.includes('클로징')))
          ) {
            closerRequests.push({ caseData: c, reminder: r });
          }
        }

        // 지연(Overdue)
        if (!r.resultStatus && r.datetime < nowStr) {
          overdueCount++;
        }
      });
    });

    // 각 팀원별 시간순 정렬
    Object.keys(memberTimelineMap).forEach(m => {
      memberTimelineMap[m].sort((a, b) => (a.reminder.datetime || '').localeCompare(b.reminder.datetime || ''));
    });

    return {
      depositPromises,
      fieldMeetings,
      closerRequests,
      overdueCount,
      memberTimelineMap
    };
  }, [teamCases, todayStr]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 상단 헤더 배너 */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/40 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
            <Users size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-400 bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-800/60">
                일반 관리자 / 팀장 · 팀 영업 코칭 뷰
              </span>
              <span className="text-xs text-slate-400 font-medium">[{currentTeamName}] · {todayFormatted}</span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">
              우리 팀원들의 당일 핵심 계약 건(입금·대면)과 클로징 동행 서포트 캘린더
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            소속 팀원: {teamMembers.length}명
          </span>
        </div>
      </div>

      {/* 1단: 팀 오늘 핵심 이벤트 바 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <DollarSign size={14} className="text-emerald-400" />
              팀 수임 입금 약속
            </span>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/50">
              핵심
            </span>
          </div>
          <div className="text-xl font-black text-emerald-400">
            {teamTodayData.depositPromises.length}건
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            오늘 당일 수임료 결제 예정
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-purple-400" />
              팀 대면 미팅
            </span>
            <span className="text-[10px] text-purple-400 font-bold bg-purple-950 px-2 py-0.5 rounded border border-purple-800/50">
              외근·방문
            </span>
          </div>
          <div className="text-xl font-black text-purple-300">
            {teamTodayData.fieldMeetings.length}건
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            출장/센터방문 계약 체결 건
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <Handshake size={14} className="text-amber-400" />
              클로징 동행 서포트
            </span>
            <span className="text-[10px] text-amber-400 font-bold bg-amber-950 px-2 py-0.5 rounded border border-amber-800/50">
              팀장 지원
            </span>
          </div>
          <div className="text-xl font-black text-amber-400">
            {teamTodayData.closerRequests.length}건
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            3자 통화 및 외근 동행 요청
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-sm ${
          teamTodayData.overdueCount > 0 ? 'bg-rose-950/20 border-rose-900/40' : 'bg-slate-900/80 border-slate-800/80'
        }`}>
          <div className="flex items-center justify-between text-xs font-semibold mb-1">
            <span className={`flex items-center gap-1.5 ${teamTodayData.overdueCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              <AlertTriangle size={14} className={teamTodayData.overdueCount > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-400'} />
              우리 팀 지연 콜
            </span>
            {teamTodayData.overdueCount > 0 && (
              <span className="text-[10px] text-rose-400 font-bold bg-rose-950 px-2 py-0.5 rounded border border-rose-800/50">
                독려 필요
              </span>
            )}
          </div>
          <div className={`text-xl font-black ${teamTodayData.overdueCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
            {teamTodayData.overdueCount}건
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            팀원 미완료 지연 리마인더
          </div>
        </div>
      </div>

      {/* 2단: 클로징 동행 및 3자 통화(Closer) 요청 하이라이트 (있을 때만) */}
      {teamTodayData.closerRequests.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-900/50 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Handshake size={18} className="text-amber-400" />
            <h4 className="text-sm font-bold text-amber-300">
              🤝 팀장 클로징 동행 및 3자 통화 지원 요청 ({teamTodayData.closerRequests.length}건)
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {teamTodayData.closerRequests.map(({ caseData, reminder }) => (
              <div 
                key={reminder.id}
                onClick={() => navigate(`/cases/${caseData.caseId}`)}
                className="p-3 rounded-xl bg-slate-950/70 border border-amber-900/40 hover:border-amber-500/50 cursor-pointer flex items-center justify-between transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white">{caseData.customerName}</span>
                    <span className="text-[11px] text-slate-400">담당: {caseData.assignee}</span>
                    <span className="text-[10px] text-amber-400 font-bold bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800/40">
                      서포트 요청
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-1">{reminder.content}</p>
                </div>
                <ArrowUpRight size={15} className="text-slate-400 hover:text-amber-400" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3단: 팀원별 오늘 타임라인 매트릭스 */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-indigo-400" />
            <div>
              <h4 className="text-sm font-bold text-white">팀원별 오늘 상담·미팅 타임라인 매트릭스</h4>
              <p className="text-[11px] text-slate-400">팀원들의 시간대별 일정 흐름을 비교하고 빈틈없이 코칭하세요.</p>
            </div>
          </div>
          <span className="text-xs text-indigo-400 font-semibold">{todayFormatted}</span>
        </div>

        {teamMembers.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            소속된 팀원 데이터가 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {teamMembers.map(member => {
              const items = teamTodayData.memberTimelineMap[member] || [];
              return (
                <div key={member} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                        {member.slice(0, 1)}
                      </div>
                      <span className="text-sm font-bold text-white">{member}</span>
                      <span className="text-xs text-slate-400 font-medium">
                        (오늘 일정 {items.length}건)
                      </span>
                    </div>

                    <button
                      onClick={() => showToast(`[${member}] 상담원과의 1:1 코칭 노트를 엽니다.`)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                      1:1 코칭 메모 →
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-2">
                      오늘 등록된 영업 일정이 없습니다. (신규 DB 콜 분배 필요)
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                      {items.map(({ caseData, reminder }) => {
                        const time = reminder.datetime?.split(' ')[1] || '시간미정';
                        const isCompleted = !!reminder.resultStatus;
                        const isDeposit = reminder.type === '입금';
                        const isField = reminder.type === '출장미팅' || reminder.type === '방문미팅';

                        return (
                          <div
                            key={reminder.id}
                            onClick={() => navigate(`/cases/${caseData.caseId}`)}
                            className={`flex-shrink-0 p-2.5 rounded-xl border text-xs cursor-pointer transition-all min-w-[180px] max-w-[220px] ${
                              isCompleted 
                                ? 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-70'
                                : isDeposit
                                ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                                : isField
                                ? 'bg-purple-950/30 border-purple-800/50 text-purple-300'
                                : 'bg-slate-900 border-slate-700/80 text-slate-200 hover:border-indigo-500/50'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span className="flex items-center gap-1">
                                <Clock size={11} />
                                {time}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40">
                                {reminder.type}
                              </span>
                            </div>
                            <div className="font-semibold text-xs mt-1 text-white truncate">
                              {caseData.customerName}
                            </div>
                            <div className="text-[11px] opacity-80 truncate mt-0.5">
                              {reminder.content || '메모 없음'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamSupervisionView;
