import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
    Scale, PhoneMissed, Briefcase, CheckCircle2, Clock, 
    ChevronRight, AlertTriangle, ArrowUpRight, Phone, ShieldAlert 
} from 'lucide-react';
import { Case } from '../../types';

interface ParalegalPipelineWidgetProps {
    cases: Case[];
    isAdmin: boolean;
}

export const ParalegalPipelineWidget: React.FC<ParalegalPipelineWidgetProps> = ({
    cases,
    isAdmin
}) => {
    const navigate = useNavigate();

    // 1. 인계 사건 및 활성 사건 추출
    const activeCases = cases.filter(c => c.status !== '휴지통' && !c.deletedAt && !c.isArchived);
    const paralegalCases = activeCases.filter(c => c.status === '사무장 접수');

    // 2. 카테고리별 집계
    const newCount = paralegalCases.filter(c => !c.secondaryStatus).length;
    const missedCases = paralegalCases.filter(c => c.secondaryStatus === '연락안받음');
    const inProgressCases = paralegalCases.filter(c => c.secondaryStatus && c.secondaryStatus !== '연락안받음');

    // 이번 달 계약 완료 건수 및 수임료 집계
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const contractedCases = activeCases.filter(c => {
        if (c.status !== '계약 완료') return false;
        const dt = c.contractAt || c.updatedAt;
        return dt && dt.startsWith(currentMonthPrefix);
    });
    const totalContractFee = contractedCases.reduce((sum, c) => sum + (Number(c.contractFee) || 0), 0);

    // 전환율 계산 (수임 완료 / (현재 인계건 + 수임완료))
    const totalHandoffs = paralegalCases.length + contractedCases.length;
    const conversionRate = totalHandoffs > 0 
        ? Math.round((contractedCases.length / totalHandoffs) * 100) 
        : 0;

    // 만원 단위 포맷팅
    const formatManwon = (val: number) => {
        if (!val || val <= 0) return '0원';
        if (val >= 10000) {
            const uk = Math.floor(val / 10000);
            const rem = val % 10000;
            return rem > 0 ? `${uk}억 ${rem.toLocaleString()}만` : `${uk}억원`;
        }
        return `${val.toLocaleString()}만원`;
    };

    // 3. 연락안받음 방치 건 중 고액 채무 리드 TOP 3
    const getDebt = (c: Case) => c.creditLoan?.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0) || 0;
    const urgentMissedCases = [...missedCases]
        .sort((a, b) => getDebt(b) - getDebt(a))
        .slice(0, 3);

    // 인계 큐로 바로가기 핸들러
    const handleGoToParalegalQueue = (secondaryFilter?: string) => {
        sessionStorage.setItem('lm_quickView', 'paralegal');
        if (secondaryFilter !== undefined) {
            sessionStorage.setItem('lm_secondaryStatusFilter', secondaryFilter);
        } else {
            sessionStorage.removeItem('lm_secondaryStatusFilter');
        }
        navigate('/cases');
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-100 dark:border-gray-700 shadow-sm overflow-hidden transition-all">
            {/* 상단 헤더 */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                        <Scale size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-base tracking-tight">사무장 인계 & 수임 파이프라인 실시간 관제</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                                실시간 동기화
                            </span>
                        </div>
                        <p className="text-xs text-indigo-200/80 mt-0.5">
                            1차 문진 완료 인계부터 사무장 직접 진행, 연락안받음 부재 방치, 최종 수임 실적까지 한눈에 파악합니다.
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => handleGoToParalegalQueue()}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-indigo-100 border border-white/20 flex items-center gap-1 transition-all active:scale-95"
                >
                    <span>사무장 인계 큐 전체보기</span>
                    <ArrowUpRight size={14} />
                </button>
            </div>

            {/* 4대 핵심 관제 카드 */}
            <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* 카드 1: 미확인 신규 인계건 */}
                    <div 
                        onClick={() => handleGoToParalegalQueue('')}
                        className="bg-slate-50 dark:bg-gray-900/40 p-4 rounded-xl border border-slate-200/80 dark:border-gray-700 hover:border-indigo-300 cursor-pointer transition-all hover:shadow-xs group"
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-slate-500 dark:text-gray-400">1. 미확인 신규 인계</span>
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">{newCount}건</span>
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">첫 통화 대기</span>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                            <span>사무장 첫 접촉 필요</span>
                            <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                        </p>
                    </div>

                    {/* 카드 2: 사무장 심층 진행 중 */}
                    <div 
                        onClick={() => handleGoToParalegalQueue('')}
                        className="bg-slate-50 dark:bg-gray-900/40 p-4 rounded-xl border border-slate-200/80 dark:border-gray-700 hover:border-indigo-300 cursor-pointer transition-all hover:shadow-xs group"
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-slate-500 dark:text-gray-400">2. 사무장 직접 진행</span>
                            <Briefcase size={14} className="text-blue-500" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">{inProgressCases.length}건</span>
                            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">정상 진행중</span>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                            <span>방문/출장/계약서작성</span>
                            <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                        </p>
                    </div>

                    {/* 카드 3: 🚨 연락안받음 방치 경보 (핵심) */}
                    <div 
                        onClick={() => handleGoToParalegalQueue('연락안받음')}
                        className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-xs group ${
                            missedCases.length > 0 
                                ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60 ring-1 ring-amber-400/20' 
                                : 'bg-slate-50 dark:bg-gray-900/40 border-slate-200/80 dark:border-gray-700'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                <PhoneMissed size={14} className="text-amber-600" />
                                <span>3. 연락안받음 (부재)</span>
                            </span>
                            {missedCases.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-500 text-white animate-pulse">
                                    집중재시도
                                </span>
                            )}
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-amber-700 dark:text-amber-400">{missedCases.length}건</span>
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">재통화 필요</span>
                        </div>
                        <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1 flex items-center gap-1 font-medium">
                            <span>클릭 시 해당 리드만 모아보기</span>
                            <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                        </p>
                    </div>

                    {/* 카드 4: 이번달 최종 수임 체결 실적 */}
                    <div 
                        onClick={() => navigate('/cases')}
                        className="bg-emerald-50/70 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/50 hover:border-emerald-400 cursor-pointer transition-all hover:shadow-xs group"
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">4. 당월 수임 완료</span>
                            <CheckCircle2 size={14} className="text-emerald-600" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{contractedCases.length}건</span>
                            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-300">
                                {formatManwon(totalContractFee)}
                            </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-medium">
                            <span>인계 전환율: <b>{conversionRate}%</b></span>
                            <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </div>
                </div>

                {/* 파이프라인 단계별 실시간 퍼널 진행 바 */}
                <div className="bg-slate-50 dark:bg-gray-900/50 p-4 rounded-xl border border-slate-200/80 dark:border-gray-700">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-gray-300 mb-2">
                        <span>사무장 인계 파이프라인 진행 퍼널</span>
                        <span className="text-slate-400 font-normal">총 인계 접수: {totalHandoffs}건</span>
                    </div>

                    <div className="h-3 w-full bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                        {/* 1. 미확인 */}
                        <div 
                            style={{ width: `${totalHandoffs > 0 ? (newCount / totalHandoffs) * 100 : 0}%` }}
                            className="bg-amber-400 h-full" 
                            title={`미확인 인계: ${newCount}건`}
                        />
                        {/* 2. 심층진행 */}
                        <div 
                            style={{ width: `${totalHandoffs > 0 ? (inProgressCases.length / totalHandoffs) * 100 : 0}%` }}
                            className="bg-indigo-500 h-full" 
                            title={`심층 진행: ${inProgressCases.length}건`}
                        />
                        {/* 3. 연락안받음 */}
                        <div 
                            style={{ width: `${totalHandoffs > 0 ? (missedCases.length / totalHandoffs) * 100 : 0}%` }}
                            className="bg-amber-600 h-full" 
                            title={`연락안받음/부재: ${missedCases.length}건`}
                        />
                        {/* 4. 수임완료 */}
                        <div 
                            style={{ width: `${totalHandoffs > 0 ? (contractedCases.length / totalHandoffs) * 100 : 0}%` }}
                            className="bg-emerald-500 h-full" 
                            title={`수임 체결: ${contractedCases.length}건`}
                        />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 text-[11px] text-slate-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                            <span>미확인 대기: {newCount}건</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                            <span>사무장 직접진행: {inProgressCases.length}건</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
                            <span>연락안받음(부재): {missedCases.length}건</span>
                        </span>
                        <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            <span>수임 체결: {contractedCases.length}건</span>
                        </span>
                    </div>
                </div>

                {/* 🚨 긴급 조치 요망: '사무장 전화를 안 받아 방치된 고액 채무 리드' (TOP 3) */}
                {urgentMissedCases.length > 0 && (
                    <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/40 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <ShieldAlert size={16} className="text-amber-600" />
                                <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                                    🚨 긴급 재시도 요망: 사무장 전화 부재 고액 채무 리드 (TOP {urgentMissedCases.length})
                                </span>
                            </div>
                            <button
                                onClick={() => handleGoToParalegalQueue('연락안받음')}
                                className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                            >
                                <span>부재 리드 전체보기 ({missedCases.length}건)</span>
                                <ChevronRight size={12} />
                            </button>
                        </div>

                        <div className="space-y-2">
                            {urgentMissedCases.map((c) => {
                                const debt = getDebt(c);
                                return (
                                    <div
                                        key={c.caseId}
                                        className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-amber-200/80 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 shadow-xs"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-extrabold text-xs text-slate-800 dark:text-gray-100">
                                                {c.customerName}
                                            </span>
                                            <span className="text-xs text-slate-500 dark:text-gray-400 font-mono">
                                                {c.phone}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                                총채무 {debt > 0 ? formatManwon(debt) : '미입력'}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                담당 1차: {c.managerName || '상담원'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-bold">
                                                부재 {c.missedCallCount || 1}회 시도
                                            </span>
                                            <Link
                                                to={`/case/${c.caseId}`}
                                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 shadow-xs transition-all active:scale-95"
                                            >
                                                <Phone size={12} />
                                                <span>즉시 재발신</span>
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
