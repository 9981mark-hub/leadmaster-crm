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
      <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 via-sky-100 to-sky-50 dark:from-slate-900 dark:via-sky-950 dark:to-slate-900 border border-sky-200 dark:border-sky-900/40 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-inner">
            <Building size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-100/80 dark:bg-sky-950/80 px-2.5 py-0.5 rounded-full border border-sky-200/60 dark:border-sky-800/60">
                TM 대표 전용 · 경영 & 자금 전용 뷰
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{todayFormatted}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              제휴 로펌 수임료 청구, 상담원 인센티브, DB 원가 및 고정비 거시 캘린더
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/settlement"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
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

      {/* 1단: 자금 4대 핵심 지표 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <DollarSign size={14} className="text-sky-600 dark:text-sky-400" />
              로펌 수수료 총매출
            </span>
            <span className="text-xs text-sky-600 dark:text-sky-400 font-bold bg-sky-100 dark:bg-sky-950 px-2 py-0.5 rounded border border-sky-200/50 dark:border-sky-800/50">
              {partners.length}개 로펌
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
              ₩ {metrics.totalCommissionWon.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">원</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            체결 수임 사건 누적 수수료
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
              수금 완료 금액
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/50">
              정산 완료
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
              ₩ {metrics.totalDepositedWon.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">원</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            실제 입금 완료된 계약금 총액
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <AlertCircle size={14} className="text-amber-600 dark:text-amber-400" />
              미수금 잔액
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded border border-amber-200/50 dark:border-amber-800/50">
              회수 관리
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono tabular-nums">
              ₩ {metrics.outstandingWon.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">원</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            분납 약정 및 미입금 잔액
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <Users size={14} className="text-purple-600 dark:text-purple-400" />
              상담원 인센티브 대기
            </span>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-bold bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded border border-purple-200/50 dark:border-purple-800/50">
              지급 예정
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-purple-600 dark:text-purple-300 font-mono tabular-nums">
              ₩ {metrics.pendingPayoutWon.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-300">원</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            정산 확정 미지급 수당 총액
          </div>
        </div>
      </div>

      {/* 2단: 이달의 주요 자금 D-Day 캘린더 타임라인 */}
      <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-sky-600 dark:text-sky-400" />
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">이번 달 핵심 자금 집행 & 수금 D-Day 타임라인</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">대표가 반드시 사전에 대비해야 할 주간/월간 자금 일정입니다.</p>
            </div>
          </div>
          <span className="text-xs text-sky-600 dark:text-sky-400 bg-sky-100/80 dark:bg-sky-950/80 px-2.5 py-1 rounded-full border border-sky-200/50 dark:border-sky-800/50 font-bold">
            정기 집행 스케줄
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {financialEvents.map(evt => {
            const Icon = evt.icon;
            return (
              <div 
                key={evt.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-200 dark:border-slate-700 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${evt.color}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{evt.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {evt.category}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                      <span>{evt.dateDesc}</span>
                      {evt.amountWon > 0 && (
                        <span className="font-semibold text-slate-200 font-mono">
                          규모: ₩ {evt.amountWon.toLocaleString()}원
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                    D-{evt.dDay}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3단: N개 제휴 법률사무소별 정산 정책 & 대사 카드 */}
      <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Building size={18} className="text-indigo-600 dark:text-indigo-400" />
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">제휴 법률사무소별 계약 대사 & 정산 정책 현황</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">제휴처별 독립 수수료율 및 주간 정산 마감 주기</p>
            </div>
          </div>
          <Link
            to="/settlement"
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold"
          >
            정산 세부 대사 열기 <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {metrics.partnerBreakdown.map(p => (
            <div key={p.partnerId} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{p.name}</span>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-100/80 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-200/40 dark:border-indigo-800/40">
                    {p.caseCount}건 유치
                  </span>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>정산 주기:</span>
                    <span className="text-slate-200 font-medium">{p.cutoffLabel} → {p.payoutLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>수수료 매출:</span>
                    <span className="text-sky-300 font-bold font-mono">₩ {p.commissionWon.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>수금 / 미수:</span>
                    <span className="font-mono">
                      <span className="text-emerald-600 dark:text-emerald-400">₩ {p.depositedWon.toLocaleString()}</span> / 
                      <span className="text-amber-600 dark:text-amber-400 ml-1">₩ {p.outstandingWon.toLocaleString()}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex justify-end">
                <button
                  onClick={() => navigate('/settlement')}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
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
