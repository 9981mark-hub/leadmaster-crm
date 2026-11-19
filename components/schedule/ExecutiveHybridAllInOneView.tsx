import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, isToday, parseISO, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Building, DollarSign, Users, Database, CreditCard, 
  AlertTriangle, Calendar, Clock, MapPin, Phone, 
  ChevronRight, CheckCircle2, AlertCircle, ArrowUpRight,
  TrendingUp, FileText, ShieldAlert, Sparkles
} from 'lucide-react';
import { Case, Partner, SettlementBatch, ExpenseItem, ReminderItem } from '../../types';
import { BatchQualityMetric } from '../../services/batchQuality';

interface ExecutiveHybridAllInOneViewProps {
  cases: Case[];
  partners: Partner[];
  batches?: SettlementBatch[];
  expenses?: ExpenseItem[];
  batchQualityList?: BatchQualityMetric[];
  onSelectDate?: (date: Date) => void;
  onNavigateTab?: (tabName: string) => void;
}

export const ExecutiveHybridAllInOneView: React.FC<ExecutiveHybridAllInOneViewProps> = ({
  cases = [],
  partners = [],
  batches = [],
  expenses = [],
  batchQualityList = [],
  onSelectDate,
  onNavigateTab
}) => {
  const navigate = useNavigate();
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const todayFormatted = useMemo(() => format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko }), []);

  // 1. 자금 & 정산 관련 핵심 지표 계산
  const financialSummary = useMemo(() => {
    // 활성 케이스 필터
    const activeCases = cases.filter(c => c.status !== '휴지통' && !c.deletedAt);

    // 총 수임 계약 수수료
    const totalCommissionWon = activeCases.reduce((sum, c) => sum + (c.commission || 0) * 10000, 0);

    // 실제 입금 완료액 vs 미수금
    let totalDepositedWon = 0;
    let totalContractFeeWon = 0;
    activeCases.forEach(c => {
      totalContractFeeWon += (c.contractFee || 0);
      const deposited = (c.depositHistory || []).reduce((s, d) => s + (d.amount || 0), 0);
      totalDepositedWon += deposited;
    });
    const outstandingWon = Math.max(0, totalContractFeeWon - totalDepositedWon);

    // 주간 정산 배치 기준 최신 미지급 수당
    const pendingBatches = batches.filter(b => b.status === 'draft' || b.status === 'confirmed');
    const pendingPayoutWon = pendingBatches.reduce((sum, b) => sum + (b.totalPayableCommission || 0) * 10000, 0);

    // N개 제휴 법률사무소 수수료율 및 정산일정 매핑
    const partnerSchedules = partners.map(p => {
      const pCases = activeCases.filter(c => c.partnerId === p.partnerId);
      const pCommission = pCases.reduce((sum, c) => sum + (c.commission || 0) * 10000, 0);
      const cutoffDay = p.settlementConfig?.cutoffDay ?? 1; // 1:월
      const payoutDay = p.settlementConfig?.payoutDay ?? 3; // 3:수
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      return {
        partnerId: p.partnerId,
        name: p.name,
        commissionWon: pCommission,
        caseCount: pCases.length,
        cutoffLabel: `매주 ${dayNames[cutoffDay]} 마감`,
        payoutLabel: `매주 ${dayNames[payoutDay]} 정산`,
      };
    });

    return {
      totalCommissionWon,
      totalDepositedWon,
      outstandingWon,
      pendingPayoutWon,
      partnerSchedules
    };
  }, [cases, partners, batches]);

  // 2. 오늘 센터 현장 운영 & 영업 집중 관제 (외근/방문/입금약속)
  const todayOperations = useMemo(() => {
    const fieldMeetings: { caseData: Case; reminder: ReminderItem }[] = [];
    const depositPromises: { caseData: Case; reminder: ReminderItem }[] = [];
    let todayTotalReminders = 0;
    let overdueRemindersCount = 0;
    const nowStr = format(new Date(), 'yyyy-MM-dd HH:mm');

    cases.forEach(c => {
      if (c.status === '휴지통' || c.deletedAt) return;

      (c.reminders || []).forEach(r => {
        if (!r.datetime) return;
        const dateStr = r.datetime.split(' ')[0];

        // 당일 일정
        if (dateStr === todayStr) {
          todayTotalReminders++;
          if (r.type === '출장미팅' || r.type === '방문미팅') {
            fieldMeetings.push({ caseData: c, reminder: r });
          }
          if (r.type === '입금') {
            depositPromises.push({ caseData: c, reminder: r });
          }
        }

        // 미완료 지연(Overdue) 일정 (과거 미처리)
        if (!r.resultStatus && r.datetime < nowStr) {
          overdueRemindersCount++;
        }
      });
    });

    return {
      fieldMeetings: fieldMeetings.sort((a, b) => (a.reminder.datetime || '').localeCompare(b.reminder.datetime || '')),
      depositPromises: depositPromises.sort((a, b) => (a.reminder.datetime || '').localeCompare(b.reminder.datetime || '')),
      todayTotalReminders,
      overdueRemindersCount
    };
  }, [cases, todayStr]);

  // 3. 다가오는 핵심 경영 캘린더 이벤트 (최근 7일)
  const upcomingEvents = useMemo(() => {
    const list: { title: string; category: string; dateStr: string; dDay: number; badgeColor: string; link?: string }[] = [];
    const today = new Date();

    // 제휴처별 정산 마감 D-Day
    partners.forEach(p => {
      list.push({
        title: `[${p.name}] 주간 정산 대사 마감`,
        category: '제휴처 정산',
        dateStr: '매주 지정요일',
        dDay: 2,
        badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
        link: '/settlement'
      });
    });

    // DB 매입 및 대행사 결제
    if (batchQualityList.length > 0) {
      list.push({
        title: '광고 대행사 DB 매입 대금 결제 및 차수 검수',
        category: 'DB 원가',
        dateStr: '금주 마감',
        dDay: 1,
        badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
        link: '/billing'
      });
    }

    // 직원 급여/인센티브 지급일
    list.push({
      title: '센터 상담원 주간/월간 수당 일괄 지급 D-Day',
      category: '인건비 지급',
      dateStr: '정기 지급일',
      dDay: 3,
      badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      link: '/settlement'
    });

    return list;
  }, [partners, batchQualityList]);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 최상단 배너: 대표 겸직 모드 상태 안내 */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-white dark:from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/40 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
            <Sparkles size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-800/60">
                TM 최고경영자 · 현장 총괄 통합 뷰
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{todayFormatted}</span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">
              자금 흐름(수임료·인센티브·DB)과 당일 현장 영업(외근·입금·미처리) 원스톱 관제
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/settlement"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            <Building size={14} />
            정산·손익 센터 →
          </Link>
          <Link
            to="/billing"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
          >
            <CreditCard size={14} />
            빌링 센터 →
          </Link>
        </div>
      </div>

      {/* 1단: 대표 핵심 경영 & 자금 타임라인 바 (Executive Financial Bar) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        
        {/* 제휴처 청구 수임료 */}
        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1.5">
            <span className="flex items-center gap-1.5">
              <DollarSign size={14} className="text-sky-600 dark:text-sky-400" />
              제휴처 수수료 매출
            </span>
            <span className="text-xs text-sky-600 dark:text-sky-400 font-bold bg-sky-950 px-2 py-0.5 rounded border border-sky-800/40">
              {partners.length}개 로펌
            </span>
          </div>
          <div className="text-xl font-black text-white">
            ₩{financialSummary.totalCommissionWon.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
            <span>수금 ₩{financialSummary.totalDepositedWon.toLocaleString()}</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">미수 ₩{financialSummary.outstandingWon.toLocaleString()}</span>
          </div>
        </div>

        {/* 상담원 인센티브 지급 대기 */}
        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1.5">
            <span className="flex items-center gap-1.5">
              <Users size={14} className="text-emerald-600 dark:text-emerald-400" />
              상담원 수당 지급 대기
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/40">
              지급 예정
            </span>
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            ₩{financialSummary.pendingPayoutWon.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            정기 수당 지급일 D-Day 카운트다운
          </div>
        </div>

        {/* 당일 외근/대면 미팅 현황 */}
        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1.5">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-purple-600 dark:text-purple-400" />
              오늘 대면 미팅 (외근/방문)
            </span>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-bold bg-purple-950 px-2 py-0.5 rounded border border-purple-800/40">
              클로징 중요
            </span>
          </div>
          <div className="text-xl font-black text-purple-300">
            {todayOperations.fieldMeetings.length}건
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            출장 {todayOperations.fieldMeetings.filter(m => m.reminder.type === '출장미팅').length}건 / 
            방문 {todayOperations.fieldMeetings.filter(m => m.reminder.type === '방문미팅').length}건
          </div>
        </div>

        {/* 지연된 미처리 콜 (Overdue) */}
        <div className={`p-4 rounded-2xl border shadow-md ${
          todayOperations.overdueRemindersCount > 0 
            ? 'bg-rose-950/20 border-rose-900/40' 
            : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800/80'
        }`}>
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span className={`flex items-center gap-1.5 ${todayOperations.overdueRemindersCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
              <AlertTriangle size={14} className={todayOperations.overdueRemindersCount > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-500 dark:text-slate-400'} />
              지연된 미처리 콜 (Overdue)
            </span>
            {todayOperations.overdueRemindersCount > 0 && (
              <span className="text-xs text-rose-600 dark:text-rose-400 font-bold bg-rose-950 px-2 py-0.5 rounded border border-rose-800/50">
                독려 필요
              </span>
            )}
          </div>
          <div className={`text-xl font-black ${todayOperations.overdueRemindersCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
            {todayOperations.overdueRemindersCount}건
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            약속 시간 지난 미완료 고객 콜
          </div>
        </div>

      </div>

      {/* 2단: 오늘 센터 현장 영업 & 외근/입금약속 실시간 관제판 (2열 분할) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* 좌측: 오늘 외근/방문 미팅 현황판 (클로징 동행 및 현장 관제) */}
        <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <MapPin size={16} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">오늘 대면 미팅 현황 (출장·센터방문)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">외근 나간 상담원과 클로징 미팅 일정을 확인하세요.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-950/80 px-2.5 py-1 rounded-full border border-purple-800/50">
              총 {todayOperations.fieldMeetings.length}건
            </span>
          </div>

          {todayOperations.fieldMeetings.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              오늘 예정된 출장 또는 센터 방문 대면 미팅이 없습니다.
            </div>
          ) : (
            <div className="space-y-2.5">
              {todayOperations.fieldMeetings.map(({ caseData, reminder }) => {
                const time = reminder.datetime?.split(' ')[1] || '시간미정';
                const isOut = reminder.type === '출장미팅';
                return (
                  <div
                    key={reminder.id}
                    onClick={() => navigate(`/cases/${caseData.caseId}`)}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-100/40 dark:bg-slate-800/40 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                        isOut ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}>
                        {reminder.type}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                            {caseData.customerName || '고객명 미상'}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            담당: {caseData.assignee || '미지정'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {reminder.content || '상세 메모 없음'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-right">
                      <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <Clock size={12} />
                        {time}
                      </div>
                      <ArrowUpRight size={16} className="text-slate-500 group-hover:text-indigo-600 dark:text-indigo-400 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 우측: 오늘 핵심 수임료 입금 약속 건 (매출 실현 추적) */}
        <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <DollarSign size={16} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">오늘 수임료 입금 약속 건 (현금흐름)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">오늘 입금 완료되어야 할 착수금 및 분납금 건입니다.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800/50">
              총 {todayOperations.depositPromises.length}건
            </span>
          </div>

          {todayOperations.depositPromises.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              오늘 약속된 수임료 입금 일정이 없습니다.
            </div>
          ) : (
            <div className="space-y-2.5">
              {todayOperations.depositPromises.map(({ caseData, reminder }) => {
                const time = reminder.datetime?.split(' ')[1] || '시간미정';
                const totalContract = caseData.contractFee || 0;
                return (
                  <div
                    key={reminder.id}
                    onClick={() => navigate(`/cases/${caseData.caseId}`)}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/50 hover:bg-slate-100/40 dark:bg-slate-800/40 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        입금약속
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
                            {caseData.customerName || '고객명 미상'}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            계약금: ₩{totalContract.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {reminder.content || '입금 메모 없음'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-right">
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Clock size={12} />
                        {time}
                      </div>
                      <ArrowUpRight size={16} className="text-slate-500 group-hover:text-emerald-600 dark:text-emerald-400 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* 3단: N개 제휴 법률사무소별 정산 정책 및 다가오는 D-Day 일정 */}
      <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Building size={16} className="text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-sm font-bold text-white">제휴 법률사무소별 정산 마감 & 주간 파이프라인</h4>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">복수 제휴처 개별 정산 정책 연동</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {financialSummary.partnerSchedules.map(p => (
            <div key={p.partnerId} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-white">{p.name}</span>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{p.caseCount}건 유치</span>
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>정산 주기:</span>
                <span className="text-slate-200 font-medium">{p.cutoffLabel} → {p.payoutLabel}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>예상 수수료:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">₩{p.commissionWon.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default ExecutiveHybridAllInOneView;
