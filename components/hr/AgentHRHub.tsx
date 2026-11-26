import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, Clock, PhoneCall, Award, DollarSign, Calendar, 
    FileText, Settings, Download, RefreshCw, CheckCircle2, 
    AlertTriangle, ShieldCheck, ChevronRight, Pause, Coffee, Power, Filter
} from 'lucide-react';
import { 
    AttendanceItem, AgentPayrollProfile, AgentPayrollCalculation,
    fetchTodayAttendanceBoard, fetchAllPayrollProfiles, saveAgentPayrollProfile,
    computeAgentPayroll, DEFAULT_PAYROLL_PROFILE,
    fetchMonthlyAttendanceDays, fetchMonthlyCallStats, MonthlyCallStats
} from '../../services/hr';
import { Case } from '../../types';
import { TeamMember } from '../../services/team';
import { AgentPayrollModal } from './AgentPayrollModal';
import { AgentPayslipModal } from './AgentPayslipModal';
import { useToast } from '../../contexts/ToastContext';
import { exportToExcel } from '../../utils/xlsxExport';

interface AgentHRHubProps {
    members: TeamMember[];
    cases: Case[];
    isDark?: boolean;
}

export const AgentHRHub: React.FC<AgentHRHubProps> = ({
    members,
    cases,
    isDark = false
}) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [attendanceList, setAttendanceList] = useState<AttendanceItem[]>([]);
    const [payrollProfiles, setPayrollProfiles] = useState<Record<string, AgentPayrollProfile>>({});
    // [2026-11-13 KIRO] 실제 값만: 월 출근일(agent_attendance_logs), 월 통화(communication_logs 집계 RPC). 못 받으면 null → "-"
    const [attendanceDaysMap, setAttendanceDaysMap] = useState<Record<string, number> | null>(null);
    const [callStatsMap, setCallStatsMap] = useState<Record<string, MonthlyCallStats> | null>(null);
    
    // 필터
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    });
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // 모달 상태
    const [targetPayrollAgent, setTargetPayrollAgent] = useState<{ member: TeamMember; profile: AgentPayrollProfile } | null>(null);
    const [targetPayslipCalculation, setTargetPayslipCalculation] = useState<AgentPayrollCalculation | null>(null);

    // 데이터 로드
    const loadHRData = async () => {
        setLoading(true);
        try {
            const [att, profiles] = await Promise.all([
                fetchTodayAttendanceBoard(),
                fetchAllPayrollProfiles()
            ]);
            setAttendanceList(att);
            setPayrollProfiles(profiles);
        } catch (err: any) {
            console.error('Failed to load HR data:', err);
            showToast(err?.message || '근태 및 급여 데이터를 불러오는데 실패했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHRData();
    }, []);

    // 선택한 달의 실제 출근일·통화 기록
    useEffect(() => {
        let alive = true;
        setAttendanceDaysMap(null);
        setCallStatsMap(null);
        fetchMonthlyAttendanceDays(selectedMonth).then(m => { if (alive) setAttendanceDaysMap(m); });
        fetchMonthlyCallStats(selectedMonth).then(m => { if (alive) setCallStatsMap(m); });
        return () => { alive = false; };
    }, [selectedMonth]);

    // 상담원별 급여 및 실적 계산 매트릭스 생성
    const agentCalculations = useMemo(() => {
        return members
            .filter(m => m.status === 'active')
            .map(m => {
                // 해당 상담원에게 배정된 케이스 (선택된 월 기준)
                const agentCases = cases.filter(c => {
                    if (c.assignedUserId !== m.userId) return false;
                    const d = c.contractAt ? c.contractAt : c.createdAt;
                    return d.startsWith(selectedMonth);
                });

                // 오늘 근태 정보
                const todayAtt = attendanceList.find(a => a.userId === m.userId);

                // 급여 프로필
                const profile = payrollProfiles[m.userId] || {
                    ...DEFAULT_PAYROLL_PROFILE,
                    userId: m.userId
                };

                // 실제 출근 일수 (근태 기록에서 출근 시각이 있는 날). 못 받았으면 모름(null)
                const attendanceDays: number | null = attendanceDaysMap ? (attendanceDaysMap[m.userId] || 0) : null;

                // 실제 발신 통화 (communication_logs 집계). 못 받았으면 모름(null)
                const callStats: MonthlyCallStats | null = callStatsMap ? (callStatsMap[m.userId] || { totalCalls: 0, totalDurationSeconds: 0 }) : null;

                const calc = computeAgentPayroll(
                    m.userId,
                    m.displayName,
                    profile,
                    agentCases,
                    attendanceDays ?? 0, // 모르면 일비 0으로 계산 (화면·엑셀에는 "-")
                    callStats?.totalDurationSeconds ?? 0,
                    callStats?.totalCalls ?? 0
                );

                return {
                    member: m,
                    todayAtt,
                    calc,
                    attendanceKnown: attendanceDays !== null,
                    callsKnown: callStats !== null,
                };
            })
            .filter(item => {
                if (statusFilter === 'all') return true;
                const st = item.todayAtt?.currentStatus || 'off';
                return st === statusFilter;
            })
            .sort((a, b) => b.calc.netPay - a.calc.netPay);
    }, [members, cases, attendanceList, payrollProfiles, selectedMonth, statusFilter, attendanceDaysMap, callStatsMap]);

    // 전체 KPI 합계
    const summaryKPI = useMemo(() => {
        let totalContracts = 0;
        let totalRevenue = 0;
        let totalGrossPay = 0;
        let totalTax = 0;
        let totalNetPay = 0;
        let workingCount = 0;
        let awayCount = 0;
        let mealCount = 0;
        let offCount = 0;

        members.forEach(m => {
            const att = attendanceList.find(a => a.userId === m.userId);
            const st = att?.currentStatus || 'off';
            if (st === 'working') workingCount++;
            else if (st === 'away') awayCount++;
            else if (st === 'meal') mealCount++;
            else offCount++;
        });

        agentCalculations.forEach(item => {
            totalContracts += item.calc.contractCount;
            totalRevenue += item.calc.totalFeeRevenue;
            totalGrossPay += item.calc.grossPay;
            totalTax += item.calc.taxDeduction;
            totalNetPay += item.calc.netPay;
        });

        return {
            totalContracts,
            totalRevenue,
            totalGrossPay,
            totalTax,
            totalNetPay,
            workingCount,
            awayCount,
            mealCount,
            offCount,
            totalMembers: members.length
        };
    }, [members, attendanceList, agentCalculations]);

    // 전직원 급여대장 엑셀 다운로드
    const handleDownloadPayrollRegister = () => {
        const attendanceKnown = attendanceDaysMap !== null;
        const callsKnown = callStatsMap !== null;
        // 출근일을 모르면 일비가 0으로 계산되므로, 일비가 있는 사람이 있으면 만들지 않는다
        if (!attendanceKnown && agentCalculations.some(item => (item.calc.profile.dailyAllowance || 0) > 0)) {
            showToast('출근 기록을 불러오지 못해 일비가 정확하지 않습니다. 잠시 뒤 다시 시도해 주세요.', 'error');
            return;
        }
        const rows = agentCalculations.map((item, idx) => ({
            '순번': idx + 1,
            '상담원명': item.member.displayName,
            '이메일': item.member.email,
            '직책': item.member.role,
            '급여유형': item.calc.profile.salaryType === 'pure_incentive' ? '순수인센' : item.calc.profile.salaryType === 'base_plus_incentive' ? '기본+인센' : '구간제',
            // 실제 기록을 받은 경우에만 칸을 넣는다
            ...(attendanceKnown ? { '출근일수': item.calc.attendanceDays } : {}),
            ...(callsKnown ? {
                '발신통화(건)': item.calc.totalCalls,
                '통화시간(분)': Math.round(item.calc.totalCallDurationSeconds / 60),
            } : {}),
            '수임계약(건)': item.calc.contractCount,
            '수임매출(원)': item.calc.totalFeeRevenue,
            '기본급(원)': item.calc.basePay,
            '인센티브(원)': item.calc.incentivePay,
            '일비/수당(원)': item.calc.allowancePay,
            '세전총액(원)': item.calc.grossPay,
            '3.3%공제세금(원)': item.calc.taxDeduction,
            '실지급액(원)': item.calc.netPay,
            '은행명': item.calc.profile.bankName || '',
            '계좌번호': item.calc.profile.accountNumber || '',
            '예금주': item.calc.profile.accountHolder || item.member.displayName
        }));

        // 공통 내보내기(관리자 확인·수식 소독·접근 기록)를 지난다
        const ok = exportToExcel(`[급여대장]_${selectedMonth}_전직원`, rows, '급여대장');
        if (!ok) showToast('엑셀 내보내기는 회사 관리자만 할 수 있습니다.', 'error');
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* 상단 전광판 & 필터 바 */}
            <div className="bg-card text-card-foreground p-3.5 sm:p-5 rounded-xl shadow-xs border border-border flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 sm:gap-4">
                <div>
                    <h2 className="text-base sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Users className="text-primary shrink-0" size={20} strokeWidth={1.75} />
                        <span>상담직원 근태 · 실적 · 급여 관제</span>
                    </h2>
                    <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">
                        근태(출퇴근·이석)부터 콜 활동, 수임 실적, 건당 인센티브 및 3.3% 세무 급여 정산까지 하나로 연결됩니다.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* 월 선택 */}
                    <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold flex-1 sm:flex-none">
                        <Calendar size={13} className="text-gray-500 shrink-0" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent outline-none font-bold text-gray-800 dark:text-gray-200 w-full sm:w-auto"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={loadHRData}
                        className="p-2 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors shrink-0"
                        title="새로고침"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>

                    <button
                        type="button"
                        onClick={handleDownloadPayrollRegister}
                        className="px-3 sm:px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
                    >
                        <Download size={13} />
                        <span className="sm:hidden">급여대장</span>
                        <span className="hidden sm:inline">전직원 급여대장 엑셀</span>
                    </button>
                </div>
            </div>

            {/* 실시간 근태 전광판 (Live Attendance Board) */}
            <div className="bg-white dark:bg-gray-900 text-slate-900 dark:text-white p-4 md:p-5 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                        <Clock size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">실시간 근태 전광판</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                            총 <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{summaryKPI.totalMembers}</span>명 중 출근 <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{summaryKPI.workingCount + summaryKPI.awayCount + summaryKPI.mealCount}</span>명
                        </div>
                    </div>
                </div>

                {/* 상태별 카운터 버튼 (필터 지원) */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                        type="button"
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                            statusFilter === 'all' ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        전체 ({summaryKPI.totalMembers})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter('working')}
                        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                            statusFilter === 'working' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        업무 중 ({summaryKPI.workingCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter('away')}
                        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                            statusFilter === 'away' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        자리비움 ({summaryKPI.awayCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter('meal')}
                        className={`btn-tactile px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                            statusFilter === 'meal' ? 'bg-orange-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-orange-600 dark:text-orange-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-orange-400" />
                        식사 ({summaryKPI.mealCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter('off')}
                        className={`btn-tactile px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                            statusFilter === 'off' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-slate-500" />
                        미출근/퇴근 ({summaryKPI.offCount})
                    </button>
                </div>
            </div>

            {/* 4대 핵심 요약 카드 (모바일 2x2 격자 / PC 4열) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <div className="bg-card text-card-foreground p-3.5 sm:p-5 rounded-xl border border-border shadow-xs card-interactive hover:border-primary/40 transition-all">
                    <span className="text-[11px] sm:text-xs font-medium text-muted-foreground block mb-1 sm:mb-1.5">당월 수임 계약</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-foreground">
                            {summaryKPI.totalContracts.toLocaleString()}
                        </span>
                        <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">건</span>
                    </div>
                    <div className="mt-1.5 sm:mt-2.5 text-[11px] sm:text-xs text-muted-foreground font-normal truncate">
                        매출: ₩ {(summaryKPI.totalRevenue / 10000).toLocaleString()}만
                    </div>
                </div>

                <div className="bg-card text-card-foreground p-3.5 sm:p-5 rounded-xl border border-border shadow-xs card-interactive hover:border-primary/40 transition-all">
                    <span className="text-[11px] sm:text-xs font-medium text-muted-foreground block mb-1 sm:mb-1.5">총 지급 인센티브</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-foreground">
                            ₩{(summaryKPI.totalGrossPay / 10000).toFixed(0)}
                        </span>
                        <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">만원</span>
                    </div>
                    <div className="mt-1.5 sm:mt-2.5 text-[11px] sm:text-xs text-muted-foreground font-normal truncate">
                        세전 (기본+성과+일비)
                    </div>
                </div>

                <div className="bg-card text-card-foreground p-3.5 sm:p-5 rounded-xl border border-border shadow-xs card-interactive hover:border-primary/40 transition-all">
                    <span className="text-[11px] sm:text-xs font-medium text-muted-foreground block mb-1 sm:mb-1.5">실지급액 (세후)</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-primary">
                            ₩{(summaryKPI.totalNetPay / 10000).toFixed(0)}
                        </span>
                        <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">만원</span>
                    </div>
                    <div className="mt-1.5 sm:mt-2.5 text-[11px] sm:text-xs text-muted-foreground font-normal truncate">
                        상담원 실수령 총합
                    </div>
                </div>

                <div className="bg-card text-card-foreground p-3.5 sm:p-5 rounded-xl border border-border shadow-xs card-interactive hover:border-primary/40 transition-all">
                    <span className="text-[11px] sm:text-xs font-medium text-muted-foreground block mb-1 sm:mb-1.5">3.3% 세금 총액</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-foreground">
                            ₩{(summaryKPI.totalTax / 10000).toFixed(0)}
                        </span>
                        <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">만원</span>
                    </div>
                    <div className="mt-1.5 sm:mt-2.5 text-[11px] sm:text-xs text-muted-foreground font-normal truncate">
                        소득세(3%)+지방세(0.3%)
                    </div>
                </div>
            </div>

            {/* 종합 실적 & 급여 매트릭스 그리드 테이블 */}
            <div className="bg-card text-card-foreground rounded-xl shadow-xs border border-border overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-border flex justify-between items-center bg-muted/40">
                    <div>
                        <h3 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                            <span>👥 {selectedMonth} 상담원별 근태·실적·급여</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-normal whitespace-nowrap">
                                {agentCalculations.length}명
                            </span>
                        </h3>
                    </div>
                </div>

                {/* 모바일 전용 카드 리스트 (글자 꺾임/가로 스크롤 제거) */}
                <div className="md:hidden divide-y divide-border">
                    {agentCalculations.map((item) => {
                        const st = item.todayAtt?.currentStatus || 'off';
                        const stBadge = st === 'working'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : st === 'away'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : st === 'meal'
                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
                        const stLabel = st === 'working' ? '업무중' : st === 'away' ? '이석중' : st === 'meal' ? '식사' : '미출근';
                        const salaryLabel = item.calc.profile.salaryType === 'pure_incentive'
                            ? `건당 ${(item.calc.profile.unitIncentive / 10000).toFixed(0)}만`
                            : item.calc.profile.salaryType === 'base_plus_incentive'
                                ? '기본+인센'
                                : '구간식';

                        return (
                            <div key={item.member.userId} className="p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-foreground truncate">{item.member.displayName}</div>
                                        <div className="text-xs text-muted-foreground truncate">{item.member.email}</div>
                                    </div>
                                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs whitespace-nowrap shrink-0 ${stBadge}`}>
                                        {stLabel}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/60 text-center">
                                    <div>
                                        <span className="text-[11px] text-muted-foreground block">출근일수</span>
                                        <span className="text-xs font-bold text-foreground font-mono">
                                            {item.attendanceKnown ? `${item.calc.attendanceDays}일` : '-'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] text-muted-foreground block">수임 계약</span>
                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                            {item.calc.contractCount}건
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] text-muted-foreground block">수임 매출</span>
                                        <span className="text-xs font-bold text-foreground font-mono">
                                            ₩{(item.calc.totalFeeRevenue / 10000).toLocaleString()}만
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-0.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium text-xs whitespace-nowrap shrink-0">
                                            {salaryLabel}
                                        </span>
                                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono truncate">
                                            ₩{item.calc.netPay.toLocaleString()}원
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setTargetPayrollAgent({ member: item.member, profile: item.calc.profile })}
                                            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-indigo-600 hover:bg-muted transition-colors"
                                            title="급여 체계 설정"
                                        >
                                            <Settings size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTargetPayslipCalculation(item.calc)}
                                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1 whitespace-nowrap"
                                        >
                                            <FileText size={13} /> 명세서
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {agentCalculations.length === 0 && (
                        <div className="py-10 text-center text-xs text-muted-foreground">
                            등록된 상담원 또는 조회된 근태/실적 데이터가 없습니다.
                        </div>
                    )}
                </div>

                {/* 데스크톱 테이블 */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-750 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="py-3 px-4 font-bold">상담원</th>
                                <th className="py-3 px-3 text-center font-bold">오늘 근태</th>
                                <th className="py-3 px-3 text-right font-bold">출근일수</th>
                                <th className="py-3 px-3 text-right font-bold">수임 계약</th>
                                <th className="py-3 px-3 text-right font-bold">수임 매출</th>
                                <th className="py-3 px-4 font-bold text-center">급여 방식</th>
                                <th className="py-3 px-4 text-right font-bold text-indigo-600">세전 총액</th>
                                <th className="py-3 px-3 text-right font-bold text-rose-500">3.3% 공제</th>
                                <th className="py-3 px-4 text-right font-black text-emerald-600">실수령액</th>
                                <th className="py-3 px-4 text-center font-bold">관리 액션</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {agentCalculations.map((item) => {
                                const st = item.todayAtt?.currentStatus || 'off';
                                const stBadge = st === 'working'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : st === 'away'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                        : st === 'meal'
                                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
                                const stLabel = st === 'working' ? '업무중' : st === 'away' ? '이석중' : st === 'meal' ? '식사' : '미출근';

                                return (
                                    <tr key={item.member.userId} className="hover:bg-gray-50/80 dark:hover:bg-gray-750/50 transition-colors">
                                        <td className="py-3.5 px-4">
                                            <div className="font-bold text-gray-900 dark:text-white">
                                                {item.member.displayName}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {item.member.email}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${stBadge}`}>
                                                {stLabel}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-medium text-gray-700 dark:text-gray-300">
                                            {item.attendanceKnown ? `${item.calc.attendanceDays}일` : '-'}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                            {item.calc.contractCount}건
                                        </td>
                                        <td className="py-3.5 px-3 text-right text-gray-600 dark:text-gray-300">
                                            ₩ {(item.calc.totalFeeRevenue / 10000).toLocaleString()}만
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium text-xs">
                                                {item.calc.profile.salaryType === 'pure_incentive' 
                                                    ? `건당 ${(item.calc.profile.unitIncentive / 10000).toFixed(0)}만` 
                                                    : item.calc.profile.salaryType === 'base_plus_incentive' 
                                                        ? '기본+인센' 
                                                        : '구간식'}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-bold text-indigo-700 dark:text-indigo-300">
                                            ₩ {item.calc.grossPay.toLocaleString()}원
                                        </td>
                                        <td className="py-3.5 px-3 text-right text-rose-500 font-medium">
                                            -₩ {item.calc.taxDeduction.toLocaleString()}원
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                            ₩ {item.calc.netPay.toLocaleString()}원
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setTargetPayrollAgent({ member: item.member, profile: item.calc.profile })}
                                                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                    title="급여 체계 설정"
                                                >
                                                    <Settings size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setTargetPayslipCalculation(item.calc)}
                                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1 transition-colors"
                                                >
                                                    <FileText size={13} /> 명세서
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {agentCalculations.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-gray-500 dark:text-gray-400">
                                        등록된 상담원 또는 조회된 근태/실적 데이터가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 급여 설정 모달 */}
            {targetPayrollAgent && (
                <AgentPayrollModal
                    isOpen={!!targetPayrollAgent}
                    onClose={() => setTargetPayrollAgent(null)}
                    agentName={targetPayrollAgent.member.displayName}
                    profile={targetPayrollAgent.profile}
                    onSave={async (updated) => {
                        await saveAgentPayrollProfile(updated);
                        setPayrollProfiles(prev => ({ ...prev, [updated.userId]: updated }));
                    }}
                />
            )}

            {/* 급여명세서 모달 */}
            {targetPayslipCalculation && (
                <AgentPayslipModal
                    isOpen={!!targetPayslipCalculation}
                    onClose={() => setTargetPayslipCalculation(null)}
                    calculation={targetPayslipCalculation}
                    payrollMonth={selectedMonth}
                />
            )}
        </div>
    );
};
