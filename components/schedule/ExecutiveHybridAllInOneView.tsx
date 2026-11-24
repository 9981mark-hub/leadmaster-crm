import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, isToday, parseISO, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Building, DollarSign, Users, Database, CreditCard, 
  AlertTriangle, Calendar, Clock, MapPin, Phone, PhoneForwarded,
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

  // 2. 오늘 센터 현장 운영 & 콜 영업 집중 관제 (통화/입금약속)
  const todayOperations = useMemo(() => {
    const callReminders: { caseData: Case; reminder: ReminderItem }[] = [];
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
          if (r.type === '입금') {
            depositPromises.push({ caseData: c, reminder: r });
          } else {
            callReminders.push({ caseData: c, reminder: r });
          }
        }

        // 미완료 지연(Overdue) 일정 (과거 미처리)
        if (!r.resultStatus && r.datetime < nowStr) {
          overdueRemindersCount++;
        }
      });
    });

    return {
      callReminders: callReminders.sort((a, b) => (a.reminder.datetime || '').localeCompare(b.reminder.datetime || '')),
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
      <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Sparkles size={20} strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-md border border-primary/20 tracking-tight">
                TM 최고경영자 · 현장 총괄 통합 뷰
              </span>
              <span className="text-2xs text-muted-foreground font-medium">{todayFormatted}</span>
            </div>
            <h3 className="text-sm font-semibold text-foreground mt-1">
              자금 흐름(수임료·인센티브·DB)과 당일 콜 영업(입금·미처리) 원스톱 관제
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/settlement"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-lg transition-all shadow-xs"
          >
            <Building size={13} strokeWidth={1.75} />
            정산·손익 센터 →
          </Link>
          <Link
            to="/billing"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-medium rounded-lg border border-border transition-all shadow-xs"
          >
            <CreditCard size={13} strokeWidth={1.75} />
            빌링 센터 →
          </Link>
        </div>
      </div>

      {/* 1단: 대표 핵심 경영 & 자금 타임라인 바 (Executive Financial Bar) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        
        {/* 제휴처 청구 수임료 */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5">
            <span className="flex items-center gap-1.5 text-foreground">
              <DollarSign size={14} strokeWidth={1.75} className="text-primary" />
              제휴처 수수료 매출
            </span>
            <span className="text-2xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 tracking-tight">
              {partners.length}개 로펌
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              ₩ {financialSummary.totalCommissionWon.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">원</span>
          </div>
          <div className="text-2xs text-muted-foreground mt-2 flex justify-between font-normal">
            <span>수금 ₩ {financialSummary.totalDepositedWon.toLocaleString()}원</span>
            <span className="text-amber-500 font-medium">미수 ₩ {financialSummary.outstandingWon.toLocaleString()}원</span>
          </div>
        </div>

        {/* 상담원 인센티브 지급 대기 */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5">
            <span className="flex items-center gap-1.5 text-foreground">
              <Users size={14} strokeWidth={1.75} className="text-primary" />
              상담원 수당 지급 대기
            </span>
            <span className="text-2xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 tracking-tight">
              지급 예정
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-semibold tracking-tight text-primary tabular-nums">
              ₩ {financialSummary.pendingPayoutWon.toLocaleString()}
            </span>
            <span className="text-xs text-primary font-medium">원</span>
          </div>
          <div className="text-2xs text-muted-foreground mt-2 font-normal">
            정기 수당 지급일 D-Day 카운트다운
          </div>
        </div>

        {/* 당일 통화 예약 (리마인더) 현황 */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5">
            <span className="flex items-center gap-1.5 text-foreground">
              <PhoneForwarded size={14} strokeWidth={1.75} className="text-primary" />
              오늘 통화 예약
            </span>
            <span className="text-2xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 tracking-tight">
              당일 콜
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {todayOperations.callReminders.length}
            </span>
            <span className="text-xs text-muted-foreground">건</span>
          </div>
          <div className="text-2xs text-muted-foreground mt-2 font-normal">
            재통화 및 고객 상담 예약 건
          </div>
        </div>

        {/* 지연된 미처리 콜 (Overdue) */}
        <div className={`p-4 rounded-xl border shadow-xs ${
          todayOperations.overdueRemindersCount > 0 
            ? 'bg-destructive/5 border-destructive/20' 
            : 'bg-card border-border'
        }`}>
          <div className="flex items-center justify-between text-xs font-medium mb-1.5">
            <span className={`flex items-center gap-1.5 ${todayOperations.overdueRemindersCount > 0 ? 'text-destructive font-semibold' : 'text-foreground'}`}>
              <AlertTriangle size={14} strokeWidth={1.75} className={todayOperations.overdueRemindersCount > 0 ? 'text-destructive' : 'text-muted-foreground'} />
              지연된 미처리 콜 (Overdue)
            </span>
            {todayOperations.overdueRemindersCount > 0 && (
              <span className="text-2xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20 tracking-tight">
                독려 필요
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-2xl font-semibold tracking-tight tabular-nums ${todayOperations.overdueRemindersCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {todayOperations.overdueRemindersCount}
            </span>
            <span className="text-xs text-muted-foreground">건</span>
          </div>
          <div className="text-2xs text-muted-foreground mt-2 font-normal">
            약속 시간 지난 미완료 고객 콜
          </div>
        </div>

      </div>

      {/* 2단: 오늘 센터 현장 영업 & 콜/입금약속 실시간 관제판 (2열 분할) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* 좌측: 오늘 예정된 고객 통화 리마인더 현황판 */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <PhoneForwarded size={16} strokeWidth={1.75} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">오늘 고객 통화 리마인더 현황</h4>
                <p className="text-xs text-muted-foreground">오늘 예정된 재통화 및 상담 예약 콜 목록입니다.</p>
              </div>
            </div>
            <span className="text-2xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 tracking-tight">
              총 {todayOperations.callReminders.length}건
            </span>
          </div>

          {todayOperations.callReminders.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs font-normal">
              오늘 예정된 고객 통화 예약 일정이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {todayOperations.callReminders.map(({ caseData, reminder }) => {
                const time = reminder.datetime?.split(' ')[1] || '시간미정';
                return (
                  <div
                    key={reminder.id}
                    onClick={() => navigate(`/cases/${caseData.caseId}`)}
                    className="p-3 rounded-lg bg-muted/40 border border-border hover:border-primary/40 hover:bg-muted/70 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-primary/10 text-primary border border-primary/20 tracking-tight">
                        {reminder.type}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                            {caseData.customerName || '고객명 미상'}
                          </span>
                          <span className="text-2xs text-muted-foreground">
                            담당: {caseData.assignee || '미지정'}
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

        {/* 우측: 오늘 핵심 수임료 입금 약속 건 (매출 실현 추적) */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <DollarSign size={16} strokeWidth={1.75} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">오늘 수임료 입금 약속 건 (현금흐름)</h4>
                <p className="text-xs text-muted-foreground">오늘 입금 완료되어야 할 착수금 및 분납금 건입니다.</p>
              </div>
            </div>
            <span className="text-2xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 tracking-tight">
              총 {todayOperations.depositPromises.length}건
            </span>
          </div>

          {todayOperations.depositPromises.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs font-normal">
              오늘 약속된 수임료 입금 일정이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {todayOperations.depositPromises.map(({ caseData, reminder }) => {
                const time = reminder.datetime?.split(' ')[1] || '시간미정';
                const totalContract = caseData.contractFee || 0;
                return (
                  <div
                    key={reminder.id}
                    onClick={() => navigate(`/cases/${caseData.caseId}`)}
                    className="p-3 rounded-lg bg-muted/40 border border-border hover:border-primary/40 hover:bg-muted/70 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-primary/10 text-primary border border-primary/20 tracking-tight">
                        입금약속
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                            {caseData.customerName || '고객명 미상'}
                          </span>
                          <span className="text-2xs text-muted-foreground tabular-nums">
                            계약금: ₩ {totalContract.toLocaleString()}원
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {reminder.content || '입금 메모 없음'}
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

      </div>

      {/* 3단: N개 제휴 법률사무소별 정산 정책 및 다가오는 D-Day 일정 */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Building size={16} strokeWidth={1.75} className="text-primary" />
            <h4 className="text-sm font-semibold text-foreground">제휴 법률사무소별 정산 마감 & 주간 파이프라인</h4>
          </div>
          <span className="text-2xs text-muted-foreground tracking-tight">복수 제휴처 개별 정산 정책 연동</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {financialSummary.partnerSchedules.map(p => (
            <div key={p.partnerId} className="p-3.5 rounded-lg bg-muted/40 border border-border">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-foreground">{p.name}</span>
                <span className="text-2xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 tracking-tight"><span className="tabular-nums">{p.caseCount}</span>건 유치</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                <span>정산 주기:</span>
                <span className="text-foreground font-medium">{p.cutoffLabel} → {p.payoutLabel}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground flex items-center justify-between">
                <span>예상 수수료:</span>
                <span className="text-primary font-semibold tabular-nums">₩ {p.commissionWon.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default ExecutiveHybridAllInOneView;
