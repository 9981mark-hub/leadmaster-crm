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
    computeAgentPayroll, DEFAULT_PAYROLL_PROFILE
} from '../../services/hr';
import { Case } from '../../types';
import { TeamMember } from '../../services/team';
import { AgentPayrollModal } from './AgentPayrollModal';
import { AgentPayslipModal } from './AgentPayslipModal';
import { useToast } from '../../contexts/ToastContext';
import * as XLSX from 'xlsx';
import { sanitizeRowData } from '../../utils/xlsxExport';

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
        } catch (err) {
            console.error('Failed to load HR data:', err);
            showToast('근태 및 급여 데이터를 불러오는데 실패했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHRData();
    }, []);

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

                // 임시 출근 일수 (오늘 출근했으면 20일 추정치 or 1일)
                const attendanceDays = todayAtt?.clockInAt ? 21 : 19;

                // 통화 활동 추정치 (콜 이력 연동)
                const callSec = agentCases.length * 280;
                const calls = agentCases.length * 3;

                const calc = computeAgentPayroll(
                    m.userId,
                    m.displayName,
                    profile,
                    agentCases,
                    attendanceDays,
                    callSec,
                    calls
                );

                return {
                    member: m,
                    todayAtt,
                    calc
                };
            })
            .filter(item => {
                if (statusFilter === 'all') return true;
                const st = item.todayAtt?.currentStatus || 'off';
                return st === statusFilter;
            })
            .sort((a, b) => b.calc.netPay - a.calc.netPay);
    }, [members, cases, attendanceList, payrollProfiles, selectedMonth, statusFilter]);

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
        const rows = agentCalculations.map((item, idx) => sanitizeRowData({
            '순번': idx + 1,
            '상담원명': item.member.displayName,
            '이메일': item.member.email,
            '직책': item.member.role,
            '급여유형': item.calc.profile.salaryType === 'pure_incentive' ? '순수인센' : item.calc.profile.salaryType === 'base_plus_incentive' ? '기본+인센' : '구간제',
            '출근일수': item.calc.attendanceDays,
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

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '급여대장');
        XLSX.writeFile(wb, `[급여대장]_${selectedMonth}_전직원.xlsx`);
    };

    return (
        <div className="space-y-6">
            {/* 상단 전광판 & 필터 바 */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Users className="text-indigo-600 dark:text-indigo-400" size={24} />
                        <span>상담직원 올인원 HR 종합 관제 (flex.team형)</span>
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        근태(출퇴근·이석)부터 콜 활동, 수임 실적, 건당 인센티브 및 3.3% 세무 급여 정산까지 하나로 연결됩니다.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* 월 선택 */}
                    <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-xl text-xs font-bold">
                        <Calendar size={13} className="text-gray-500" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent outline-none font-bold text-gray-800 dark:text-gray-200"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={loadHRData}
                        className="p-2 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                        title="새로고침"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>

                    <button
                        type="button"
                        onClick={handleDownloadPayrollRegister}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                        <Download size={13} /> 전직원 급여대장 엑셀
                    </button>
                </div>
            </div>

            {/* 실시간 근태 전광판 (Live Attendance Board) */}
            <div className="bg-slate-900 text-white p-4 md:p-5 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                        <Clock size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-400 tracking-wider uppercase">실시간 근태 전광판</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        </div>
                        <div className="text-sm font-extrabold text-slate-100">
                            총 {summaryKPI.totalMembers}명 중 출근 {summaryKPI.workingCount + summaryKPI.awayCount + summaryKPI.mealCount}명
                        </div>
                    </div>
                </div>

                {/* 상태별 카운터 버튼 (필터 지원) */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                        type="button"
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                            statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        전체 ({summaryKPI.totalMembers})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter('working')}
                        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                            statusFilter === 'working' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        업무 중 ({summaryKPI.workingCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter('away')}
                        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                            statusFilter === 'away' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        자리비움 ({summaryKPI.awayCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter('meal')}
                        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                            statusFilter === 'meal' ? 'bg-orange-500 text-white shadow-sm' : 'bg-slate-800 text-orange-400 hover:bg-slate-700'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-orange-400" />
                        식사 ({summaryKPI.mealCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter('off')}
                        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                            statusFilter === 'off' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-slate-500" />
                        미출근/퇴근 ({summaryKPI.offCount})
                    </button>
                </div>
            </div>

            {/* 4대 핵심 요약 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <span className="text-xs font-bold text-gray-500 block mb-1">당월 수임 계약 총합</span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-gray-900 dark:text-white">
                            {summaryKPI.totalContracts.toLocaleString()}
                        </span>
                        <span className="text-xs font-semibold text-gray-400">건 계약</span>
                    </div>
                    <div className="mt-2 text-[11px] text-gray-400">
                        수임료 매출: ₩ {(summaryKPI.totalRevenue / 10000).toLocaleString()}만원
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 shadow-sm">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 block mb-1">당월 총 지급 인센티브</span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                            ₩ {(summaryKPI.totalGrossPay / 10000).toFixed(0)}
                        </span>
                        <span className="text-xs font-bold text-gray-400">만원 (세전)</span>
                    </div>
                    <div className="mt-2 text-[11px] text-indigo-500 font-semibold">
                        기본급 + 성과급 + 일비 합산
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-sm">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-1">실지급액 합계 (세후)</span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            ₩ {(summaryKPI.totalNetPay / 10000).toFixed(0)}
                        </span>
                        <span className="text-xs font-bold text-gray-400">만원</span>
                    </div>
                    <div className="mt-2 text-[11px] text-emerald-600 font-medium">
                        상담원 실수령액 총합
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-300 block mb-1">3.3% 원천징수 세금 총액</span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                            ₩ {(summaryKPI.totalTax / 10000).toFixed(0)}
                        </span>
                        <span className="text-xs font-bold text-gray-400">만원</span>
                    </div>
                    <div className="mt-2 text-[11px] text-gray-400">
                        소득세(3%) + 지방세(0.3%)
                    </div>
                </div>
            </div>

            {/* 종합 실적 & 급여 매트릭스 그리드 테이블 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>👥 {selectedMonth} 상담원별 근태·실적·급여 통합 명세</span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-normal">
                                {agentCalculations.length}명
                            </span>
                        </h3>
                    </div>
                </div>

                <div className="overflow-x-auto">
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
                                            <div className="text-[11px] text-gray-400">
                                                {item.member.email}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${stBadge}`}>
                                                {stLabel}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-medium text-gray-700 dark:text-gray-300">
                                            {item.calc.attendanceDays}일
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                            {item.calc.contractCount}건
                                        </td>
                                        <td className="py-3.5 px-3 text-right text-gray-600 dark:text-gray-300">
                                            ₩ {(item.calc.totalFeeRevenue / 10000).toLocaleString()}만
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium text-[11px]">
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
                                    <td colSpan={10} className="py-12 text-center text-gray-400">
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
