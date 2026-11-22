import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Building, DollarSign, Users, Database, CreditCard, 
  Calendar, Clock, AlertCircle, ArrowUpRight,
  TrendingUp, FileText, CheckCircle2, ChevronRight, ShieldCheck
} from 'lucide-react';
import { Case, Partner, SettlementBatch, ExpenseItem } from '../../types';
import { BatchQualityMetric } from '../../services/batchQuality';

interface ExecutiveFinancialViewProps {
  cases: Case[];
  partners: Partner[];
  batches?: SettlementBatch[];
  expenses?: ExpenseItem[];
  batchQualityList?: BatchQualityMetric[];
  onSelectDate?: (date: Date) => void;
}

export const ExecutiveFinancialView: React.FC<ExecutiveFinancialViewProps> = ({
  cases = [],
  partners = [],
  batches = [],
  expenses = [],
  batchQualityList = [],
}) => {
  const navigate = useNavigate();
  const todayFormatted = useMemo(() => format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko }), []);

  // 1. 자금 지표 계산
  const metrics = useMemo(() => {
    const activeCases = cases.filter(c => c.status !== '휴지통' && !c.deletedAt);

    // 총 수수료 매출 (만 단위 변환)
    const totalCommissionWon = activeCases.reduce((sum, c) => sum + (c.commission || 0) * 10000, 0);

    // 총 계약금 및 입금액 대사
    let totalContractFeeWon = 0;
    let totalDepositedWon = 0;
    activeCases.forEach(c => {
      totalContractFeeWon += (c.contractFee || 0);
      const deposited = (c.depositHistory || []).reduce((s, d) => s + (d.amount || 0), 0);
      totalDepositedWon += deposited;
    });
    const outstandingWon = Math.max(0, totalContractFeeWon - totalDepositedWon);

    // 상담원 미지급 수당 배치
    const pendingBatches = batches.filter(b => b.status === 'draft' || b.status === 'confirmed');
    const pendingPayoutWon = pendingBatches.reduce((sum, b) => sum + (b.totalPayableCommission || 0) * 10000, 0);

    // 제휴처별 정산 세부 현황
    const partnerBreakdown = partners.map(p => {
      const pCases = activeCases.filter(c => c.partnerId === p.partnerId);
      const pCommission = pCases.reduce((sum, c) => sum + (c.commission || 0) * 10000, 0);
      let pDeposited = 0;
      let pContract = 0;
      pCases.forEach(c => {
        pContract += (c.contractFee || 0);
        pDeposited += (c.depositHistory || []).reduce((s, d) => s + (d.amount || 0), 0);
      });
      const pOutstanding = Math.max(0, pContract - pDeposited);

      const cutoffDay = p.settlementConfig?.cutoffDay ?? 1;
      const payoutDay = p.settlementConfig?.payoutDay ?? 3;
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

      return {
        partnerId: p.partnerId,
        name: p.name,
        caseCount: pCases.length,
        commissionWon: pCommission,
        depositedWon: pDeposited,
        outstandingWon: pOutstanding,
        cutoffLabel: `매주 ${dayNames[cutoffDay]} 마감`,
        payoutLabel: `매주 ${dayNames[payoutDay]} 정산`,
      };
    });

    return {
      totalCommissionWon,
      totalDepositedWon,
      outstandingWon,
      pendingPayoutWon,
      partnerBreakdown
    };
  }, [cases, partners, batches]);

  // 2. 월간 주요 자금 캘린더 이벤트 D-Day
  const financialEvents = useMemo(() => {
    return [
      {
        id: '1',
        title: '센터 상담원 주간 정산 수당 지급일',
        category: '인건비 지급',
        dDay: 3,
        dateDesc: '매주 수요일 이체',
        amountWon: metrics.pendingPayoutWon,
        icon: Users,
        color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      },
      {
        id: '2',
        title: 'N개 제휴 로펌 수수료 청구서 발행 및 정산 마감',
        category: '제휴처 청구',
        dDay: 1,
        dateDesc: '매주 월요일 18:00',
        amountWon: metrics.totalCommissionWon,
        icon: Building,
        color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
      },
      {
        id: '3',
        title: '광고 대행사 DB 매입대금 정산 및 차수 결제',
        category: 'DB 원가',
        dDay: 2,
        dateDesc: '차수별 마감',
        amountWon: 4500000,
        icon: Database,
        color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30'
      },
      {
        id: '4',
        title: '센터 운영 고정비(임대료·인터넷·솔루션) 출금 예정',
        category: '고정비 관리',
        dDay: 6,
        dateDesc: '매월 25일 정기 출금',
        amountWon: 3800000,
        icon: CreditCard,
        color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
      }
    ];
  }, [metrics]);

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
              <span className="text-2xs font-mono font-medium text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                TM 대표 전용 · 경영 & 자금 전용 뷰
              </span>
              <span className="text-2xs text-muted-foreground font-mono">{todayFormatted}</span>
            </div>
            <h3 className="text-sm font-semibold text-foreground mt-1">
              제휴 로펌 수임료 청구, 상담원 인센티브, DB 원가 및 고정비 거시 캘린더
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

      {/* 1단: 자금 4대 핵심 지표 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span className="flex items-center gap-1.5 text-foreground">
              <DollarSign size={14} strokeWidth={1.75} className="text-primary" />
              로펌 수수료 총매출
            </span>
            <span className="text-2xs font-mono font-medium text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              {partners.length}개 로펌
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-semibold tracking-tight text-foreground font-mono tabular-nums">
              ₩ {metrics.totalCommissionWon.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">원</span>
          </div>
          <div className="text-2xs text-muted-foreground mt-2 font-mono">
            체결 수임 사건 누적 수수료
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span className="flex items-center gap-1.5 text-foreground">
              <CheckCircle2 size={14} strokeWidth={1.75} className="text-primary" />
              수금 완료 금액
            </span>
            <span className="text-2xs font-mono font-medium text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              정산 완료
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-semibold tracking-tight text-primary font-mono tabular-nums">
              ₩ {metrics.totalDepositedWon.toLocaleString()}
            </span>
            <span className="text-xs text-primary font-medium">원</span>
          </div>
          <div className="text-2xs text-muted-foreground mt-2 font-mono">
            실제 입금 완료된 계약금 총액
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span className="flex items-center gap-1.5 text-foreground">
              <AlertCircle size={14} strokeWidth={1.75} className="text-amber-500" />
              미수금 잔액
            </span>
            <span className="text-2xs font-mono font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              회수 관리
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-semibold tracking-tight text-amber-500 font-mono tabular-nums">
              ₩ {metrics.outstandingWon.toLocaleString()}
            </span>
            <span className="text-xs text-amber-500 font-medium">원</span>
          </div>
          <div className="text-2xs text-muted-foreground mt-2 font-mono">
            분납 약정 및 미입금 잔액
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span className="flex items-center gap-1.5 text-foreground">
              <Users size={14} strokeWidth={1.75} className="text-primary" />
              상담원 인센티브 대기
            </span>
            <span className="text-2xs font-mono font-medium text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              지급 예정
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-semibold tracking-tight text-foreground font-mono tabular-nums">
              ₩ {metrics.pendingPayoutWon.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">원</span>
          </div>
          <div className="text-2xs text-muted-foreground mt-2 font-mono">
            정산 확정 미지급 수당 총액
          </div>
        </div>
      </div>

      {/* 2단: 이달의 주요 자금 D-Day 캘린더 타임라인 */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Calendar size={18} strokeWidth={1.75} className="text-primary" />
            <div>
              <h4 className="text-sm font-semibold text-foreground">이번 달 핵심 자금 집행 & 수금 D-Day 타임라인</h4>
              <p className="text-xs text-muted-foreground">대표가 반드시 사전에 대비해야 할 주간/월간 자금 일정입니다.</p>
            </div>
          </div>
          <span className="text-2xs font-mono font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
            정기 집행 스케줄
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {financialEvents.map(evt => {
            const Icon = evt.icon;
            return (
              <div 
                key={evt.id}
                className="p-3.5 rounded-lg bg-muted/40 border border-border hover:border-primary/40 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center border bg-muted text-foreground border-border">
                    <Icon size={16} strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{evt.title}</span>
                      <span className="text-2xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                        {evt.category}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 font-mono">
                      <span>{evt.dateDesc}</span>
                      {evt.amountWon > 0 && (
                        <span className="font-semibold text-foreground tabular-nums">
                          규모: ₩ {evt.amountWon.toLocaleString()}원
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 rounded text-2xs font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                    D-{evt.dDay}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3단: N개 제휴 법률사무소별 정산 정책 & 대사 카드 */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Building size={18} strokeWidth={1.75} className="text-primary" />
            <div>
              <h4 className="text-sm font-semibold text-foreground">제휴 법률사무소별 계약 대사 & 정산 정책 현황</h4>
              <p className="text-xs text-muted-foreground">제휴처별 독립 수수료율 및 주간 정산 마감 주기</p>
            </div>
          </div>
          <Link
            to="/settlement"
            className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
          >
            정산 세부 대사 열기 <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {metrics.partnerBreakdown.map(p => (
            <div key={p.partnerId} className="p-3.5 rounded-lg bg-muted/40 border border-border flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">{p.name}</span>
                  <span className="text-2xs font-mono font-medium text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                    {p.caseCount}건 유치
                  </span>
                </div>
                <div className="mt-2.5 space-y-1 text-xs text-muted-foreground font-mono">
                  <div className="flex justify-between">
                    <span>정산 주기:</span>
                    <span className="text-foreground font-medium">{p.cutoffLabel} → {p.payoutLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>수수료 매출:</span>
                    <span className="text-foreground font-semibold tabular-nums">₩ {p.commissionWon.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>수금 / 미수:</span>
                    <span className="tabular-nums">
                      <span className="text-primary font-medium">₩ {p.depositedWon.toLocaleString()}</span> / 
                      <span className="text-amber-500 ml-1 font-medium">₩ {p.outstandingWon.toLocaleString()}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border flex justify-end">
                <button
                  onClick={() => navigate('/settlement')}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  제휴처 청구서 확인 <ArrowUpRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExecutiveFinancialView;
