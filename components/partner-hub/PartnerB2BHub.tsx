import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Building2, Scale, Users, CheckCircle2, TrendingUp, DollarSign, 
    Calendar, ArrowUpRight, ChevronDown, ChevronUp, FileText, Check, 
    AlertTriangle, ShieldCheck, Phone, Briefcase, BadgePercent, Clock,
    HelpCircle, Download
} from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Partner, Case } from '../../types';
import { calculatePartnerIncentive } from '../../utils';
import { PartnerInvoiceModal } from './PartnerInvoiceModal';

interface PartnerB2BHubProps {
    partners: Partner[];
    cases: Case[];
    isDark?: boolean;
    onUpdateCase?: (caseId: string, updates: Partial<Case>) => Promise<void>;
}

export const PartnerB2BHub: React.FC<PartnerB2BHubProps> = ({
    partners,
    cases,
    isDark = false,
    onUpdateCase
}) => {
    // 필터 상태
    const [periodFilter, setPeriodFilter] = useState<'1m' | '3m' | '6m' | '1y' | 'all'>('3m');
    const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all');
    const [selectedCaseType, setSelectedCaseType] = useState<string>('all');
    
    // 접이식 상세 테이블
    const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null);

    // 청구서 모달 상태
    const [invoicePartner, setInvoicePartner] = useState<Partner | null>(null);

    // 날짜 필터링 헬퍼
    const now = new Date();
    const filteredCases = useMemo(() => {
        let base = cases.filter(c => c.status !== '휴지통' && c.status !== '취소');

        // 기간 필터
        if (periodFilter !== 'all') {
            const cutoff = new Date();
            if (periodFilter === '1m') cutoff.setMonth(now.getMonth() - 1);
            else if (periodFilter === '3m') cutoff.setMonth(now.getMonth() - 3);
            else if (periodFilter === '6m') cutoff.setMonth(now.getMonth() - 6);
            else if (periodFilter === '1y') cutoff.setFullYear(now.getFullYear() - 1);

            base = base.filter(c => {
                const targetDate = c.contractAt ? new Date(c.contractAt) : new Date(c.createdAt);
                return targetDate >= cutoff;
            });
        }

        // 거래처 필터
        if (selectedPartnerId !== 'all') {
            base = base.filter(c => c.partnerId === selectedPartnerId);
        }

        // 사건 종류 필터
        if (selectedCaseType !== 'all') {
            base = base.filter(c => (c.contractType || c.caseType) === selectedCaseType);
        }

        return base;
    }, [cases, periodFilter, selectedPartnerId, selectedCaseType]);

    // 거래처별 집계 매트릭스 데이터 생성
    const partnerStats = useMemo(() => {
        const statsMap: Record<string, {
            partner: Partner;
            totalHandedOver: number; // 사무장 인계 건수 (사무장 접수 이력이 있거나 계약 완료)
            contractedCount: number; // 실제 수임 완료 건수
            totalContractFee: number; // 총 수임료 합계 (만원)
            totalIncentiveFee: number; // TM사 수령 인센티브 합계 (만원)
            paidIncentiveFee: number; // 입금 완료 인센티브 (만원)
            unpaidIncentiveFee: number; // 미수 인센티브 (만원)
            cases: Case[];
        }> = {};

        // 파트너 목록 초기화
        partners.forEach(p => {
            statsMap[p.partnerId] = {
                partner: p,
                totalHandedOver: 0,
                contractedCount: 0,
                totalContractFee: 0,
                totalIncentiveFee: 0,
                paidIncentiveFee: 0,
                unpaidIncentiveFee: 0,
                cases: []
            };
        });

        // 케이스 순회
        filteredCases.forEach(c => {
            const pid = c.partnerId;
            if (!pid || !statsMap[pid]) return;

            const st = statsMap[pid];
            st.cases.push(c);

            // 인계 건수 판별: 사무장 접수 상태였거나, 계약 완료되었거나, 인계 이력이 있는 경우
            const isHandedOver = c.status === '사무장 접수' || c.status === '계약 완료' || !!c.contractAt || !!c.secondaryStatus;
            if (isHandedOver) {
                st.totalHandedOver++;
            }

            // 수임 완료 판별
            if (c.contractAt && (c.contractFee || 0) > 0) {
                st.contractedCount++;
                const fee = c.contractFee || 0;
                st.totalContractFee += fee;

                // TM 인센티브 계산
                const incentive = c.expectedIncentiveFee ?? calculatePartnerIncentive(fee, c.contractType || c.caseType, st.partner).amount;
                st.totalIncentiveFee += incentive;

                if (c.incentiveStatus === 'paid') {
                    st.paidIncentiveFee += (c.actualIncentiveFee ?? incentive);
                } else {
                    st.unpaidIncentiveFee += incentive;
                }
            }
        });

        return Object.values(statsMap).map(st => {
            const successRate = st.totalHandedOver > 0 
                ? Math.round((st.contractedCount / st.totalHandedOver) * 1000) / 10 
                : 0;
            return {
                ...st,
                successRate,
                avgContractFee: st.contractedCount > 0 ? Math.round(st.totalContractFee / st.contractedCount) : 0
            };
        }).sort((a, b) => b.totalIncentiveFee - a.totalIncentiveFee);
    }, [partners, filteredCases]);

    // 전체 KPI 합계
    const totalKPI = useMemo(() => {
        let totalHandedOver = 0;
        let totalContracted = 0;
        let totalContractFee = 0;
        let totalIncentive = 0;
        let totalPaidIncentive = 0;
        let totalUnpaidIncentive = 0;

        partnerStats.forEach(st => {
            totalHandedOver += st.totalHandedOver;
            totalContracted += st.contractedCount;
            totalContractFee += st.totalContractFee;
            totalIncentive += st.totalIncentiveFee;
            totalPaidIncentive += st.paidIncentiveFee;
            totalUnpaidIncentive += st.unpaidIncentiveFee;
        });

        const overallSuccessRate = totalHandedOver > 0 
            ? Math.round((totalContracted / totalHandedOver) * 1000) / 10 
            : 0;

        return {
            totalHandedOver,
            totalContracted,
            overallSuccessRate,
            totalContractFee,
            totalIncentive,
            totalPaidIncentive,
            totalUnpaidIncentive
        };
    }, [partnerStats]);

    // 차트 데이터 (상위 거래처 6개)
    const chartData = useMemo(() => {
        return partnerStats.slice(0, 6).map(st => ({
            name: st.partner.name,
            인계건: st.totalHandedOver,
            수임건: st.contractedCount,
            성공률: st.successRate,
            인센티브: st.totalIncentiveFee
        }));
    }, [partnerStats]);

    // 인센티브 상태 토글 (미수 ➔ 입금완료)
    const handleToggleIncentiveStatus = async (c: Case) => {
        if (!onUpdateCase) return;
        const nextStatus = c.incentiveStatus === 'paid' ? 'unpaid' : 'paid';
        const nowIso = new Date().toISOString().slice(0, 10);
        await onUpdateCase(c.caseId, {
            incentiveStatus: nextStatus,
            incentivePaidAt: nextStatus === 'paid' ? nowIso : undefined,
            actualIncentiveFee: nextStatus === 'paid' ? (c.expectedIncentiveFee || 0) : 0
        });
    };

    return (
        <div className="space-y-6">
            {/* 상단 필터 및 헤더 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Building2 className="text-indigo-600 dark:text-indigo-400" size={24} />
                        <span>제휴 법률사무소 B2B 통합 실적 & 인센티브 관제</span>
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        거래처별 인계 건수, 수임 성공률(실력), TM 수령 인센티브 및 미수금을 한눈에 비교 분석합니다.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* 기간 선택 */}
                    <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-1 rounded-xl text-xs font-bold">
                        {[
                            { key: '1m', label: '1개월' },
                            { key: '3m', label: '3개월' },
                            { key: '6m', label: '6개월' },
                            { key: 'all', label: '전체' }
                        ].map(p => (
                            <button
                                key={p.key}
                                onClick={() => setPeriodFilter(p.key as any)}
                                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                                    periodFilter === p.key
                                        ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* 거래처 선택 */}
                    <select
                        value={selectedPartnerId}
                        onChange={(e) => setSelectedPartnerId(e.target.value)}
                        className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none"
                    >
                        <option value="all">모든 제휴처 ({partners.length}곳)</option>
                        {partners.map(p => (
                            <option key={p.partnerId} value={p.partnerId}>{p.name}</option>
                        ))}
                    </select>

                    {/* 사건종류 선택 */}
                    <select
                        value={selectedCaseType}
                        onChange={(e) => setSelectedCaseType(e.target.value)}
                        className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none"
                    >
                        <option value="all">모든 사건 종류</option>
                        <option value="개인회생">개인회생</option>
                        <option value="파산">개인파산</option>
                        <option value="신용회복">신용회복</option>
                        <option value="새출발기금">새출발기금</option>
                    </select>
                </div>
            </div>

            {/* 4대 통합 KPI 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. 총 인계 건수 */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-bold mb-2">
                        <span>사무장 인계 리드</span>
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <Users size={16} />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-gray-900 dark:text-white">
                            {totalKPI.totalHandedOver.toLocaleString()}
                        </span>
                        <span className="text-xs font-semibold text-gray-500">건</span>
                    </div>
                    <div className="mt-2 text-[11px] text-gray-400">
                        1차 상담원이 적격 판정 후 사무장에 넘긴 건수
                    </div>
                </div>

                {/* 2. 실제 수임 & 성공률 */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-bold mb-2">
                        <span>수임 완료 & 인계 성공률</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <CheckCircle2 size={16} />
                        </div>
                    </div>
                    <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                {totalKPI.totalContracted.toLocaleString()}
                            </span>
                            <span className="text-xs font-semibold text-gray-500">건 수임</span>
                        </div>
                        <span className="text-sm font-black px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                            {totalKPI.overallSuccessRate}%
                        </span>
                    </div>
                    <div className="mt-2 text-[11px] text-gray-400">
                        고객 총 수임료: ₩ {(totalKPI.totalContractFee / 10000).toFixed(1)}억원
                    </div>
                </div>

                {/* 3. TM사 인센티브 수령 총액 */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-indigo-50/20 dark:from-gray-800 dark:to-indigo-950/20">
                    <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300 text-xs font-bold mb-2">
                        <span>TM사 수령 인센티브 총액</span>
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <DollarSign size={16} />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                            ₩ {totalKPI.totalIncentive.toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-gray-500">만원</span>
                    </div>
                    <div className="mt-2 text-[11px] text-indigo-600/80 dark:text-indigo-400/80 font-semibold">
                        법률사무소로부터 수령하는 TM사 순수수료
                    </div>
                </div>

                {/* 4. 미수금 vs 입금완료 */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-bold mb-2">
                        <span>인센티브 수금 상태</span>
                        <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <Clock size={16} />
                        </div>
                    </div>
                    <div className="flex items-baseline justify-between">
                        <div className="text-sm font-bold text-gray-600 dark:text-gray-300">
                            입금완료: <span className="font-black text-gray-900 dark:text-white">{totalKPI.totalPaidIncentive.toLocaleString()}만</span>
                        </div>
                        <div className="text-sm font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-0.5 rounded-full">
                            미수: {totalKPI.totalUnpaidIncentive.toLocaleString()}만
                        </div>
                    </div>
                    <div className="mt-2 text-[11px] text-gray-400">
                        {totalKPI.totalUnpaidIncentive > 0 ? '⚠️ 제휴처에 인센티브 정산 청구 필요' : '🎉 모든 인센티브 입금 완료'}
                    </div>
                </div>
            </div>

            {/* 거래처별 종합 성적표 & 인센티브 랭킹 매트릭스 그리드 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>🏆 제휴 법률사무소별 실적 랭킹 & 정산 매트릭스</span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-normal">
                                {partnerStats.length}곳 제휴
                            </span>
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            인계 성공률이 높고 인센티브가 제때 입금되는 우량 법률사무소를 한눈에 비교합니다.
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-750 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="py-3 px-4 w-12 text-center font-bold">순위</th>
                                <th className="py-3 px-4 font-bold">제휴 법률사무소 / 담당자</th>
                                <th className="py-3 px-3 text-right font-bold">인계 건수</th>
                                <th className="py-3 px-3 text-right font-bold">수임 완료</th>
                                <th className="py-3 px-4 text-center font-bold w-40">인계 성공률 (실력)</th>
                                <th className="py-3 px-4 text-right font-bold">총 수임료 (매출)</th>
                                <th className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">TM 인센티브</th>
                                <th className="py-3 px-4 text-right font-bold">정산 상태 (입금/미수)</th>
                                <th className="py-3 px-4 text-center font-bold">정산 청구</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {partnerStats.map((st, idx) => {
                                const isExpanded = expandedPartnerId === st.partner.partnerId;
                                const rate = st.successRate;
                                const rateColor = rate >= 50 
                                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
                                    : rate >= 30
                                        ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50'
                                        : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50';

                                const barColor = rate >= 50 ? 'bg-emerald-500' : rate >= 30 ? 'bg-amber-500' : 'bg-rose-500';

                                return (
                                    <React.Fragment key={st.partner.partnerId}>
                                        <tr className="hover:bg-gray-50/80 dark:hover:bg-gray-750/50 transition-colors">
                                            <td className="py-3.5 px-4 text-center font-bold text-gray-400">
                                                {idx + 1}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                                                    <span>{st.partner.name}</span>
                                                    {st.partner.notes && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 font-normal">
                                                            {st.partner.notes}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                                                    <span>{st.partner.managerName || '담당자 미지정'}</span>
                                                    {st.partner.contactPhone && <span>• {st.partner.contactPhone}</span>}
                                                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                                        ({st.partner.incentiveType === 'fixed' ? `건당 ${st.partner.incentiveFixedAmount || 50}만` : `${st.partner.incentiveRate || 30}%`})
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-3 text-right font-medium text-gray-700 dark:text-gray-300">
                                                {st.totalHandedOver.toLocaleString()}건
                                            </td>
                                            <td className="py-3.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                {st.contractedCount.toLocaleString()}건
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${rateColor}`}>
                                                        {st.successRate}%
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">
                                                        {st.contractedCount}/{st.totalHandedOver}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${barColor} transition-all duration-500`}
                                                        style={{ width: `${Math.min(100, st.successRate)}%` }}
                                                    />
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-medium text-gray-800 dark:text-gray-200">
                                                ₩ {st.totalContractFee.toLocaleString()}만
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-black text-indigo-600 dark:text-indigo-400 text-sm">
                                                ₩ {st.totalIncentiveFee.toLocaleString()}만
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                    입금: {st.paidIncentiveFee.toLocaleString()}만
                                                </div>
                                                {st.unpaidIncentiveFee > 0 ? (
                                                    <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                                        미수: {st.unpaidIncentiveFee.toLocaleString()}만
                                                    </div>
                                                ) : (
                                                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                                        완납
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setInvoicePartner(st.partner)}
                                                        className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center gap-1 transition-colors"
                                                    >
                                                        <FileText size={13} /> 청구서
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedPartnerId(isExpanded ? null : st.partner.partnerId)}
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                    >
                                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* 접이식 상세 수임 내역 */}
                                        {isExpanded && (
                                            <tr className="bg-slate-50/70 dark:bg-gray-900/40">
                                                <td colSpan={9} className="p-4">
                                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-3">
                                                        <div className="flex justify-between items-center text-xs font-bold text-gray-700 dark:text-gray-300">
                                                            <span>[{st.partner.name}] 수임 완료 사건 및 인센티브 정산 내역 ({st.contractedCount}건)</span>
                                                            <span className="text-[11px] text-gray-400 font-normal">
                                                                클릭하여 입금 완료/미수를 즉시 토글할 수 있습니다.
                                                            </span>
                                                        </div>

                                                        <div className="max-h-60 overflow-y-auto">
                                                            <table className="w-full text-left text-xs">
                                                                <thead className="bg-gray-50 dark:bg-gray-700/60 text-gray-500">
                                                                    <tr>
                                                                        <th className="py-2 px-3">고객명</th>
                                                                        <th className="py-2 px-3">사건종류</th>
                                                                        <th className="py-2 px-3 text-center">계약체결일</th>
                                                                        <th className="py-2 px-3 text-right">총 수임료</th>
                                                                        <th className="py-2 px-3 text-right text-indigo-600 font-bold">TM 인센티브</th>
                                                                        <th className="py-2 px-3 text-center">정산 상태</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                                    {st.cases.filter(c => c.contractAt).map(c => {
                                                                        const incAmt = c.expectedIncentiveFee ?? calculatePartnerIncentive(c.contractFee || 0, c.contractType || c.caseType, st.partner).amount;
                                                                        const isPaid = c.incentiveStatus === 'paid';

                                                                        return (
                                                                            <tr key={c.caseId} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                                                                                <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200">
                                                                                    {c.customerName}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                                                                                    {c.contractType || c.caseType || '개인회생'}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-center text-gray-500">
                                                                                    {c.contractAt}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-right font-medium">
                                                                                    {c.contractFee ? `${c.contractFee.toLocaleString()}만원` : '-'}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                                                                    {incAmt.toLocaleString()}만원
                                                                                </td>
                                                                                <td className="py-2 px-3 text-center">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleToggleIncentiveStatus(c)}
                                                                                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                                                                                            isPaid
                                                                                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200'
                                                                                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-200'
                                                                                        }`}
                                                                                    >
                                                                                        {isPaid ? `✓ 입금완료 (${c.incentivePaidAt || '확인'})` : '⚠️ 미수금 (입금 처리)'}
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                    {st.cases.filter(c => c.contractAt).length === 0 && (
                                                                        <tr>
                                                                            <td colSpan={6} className="py-6 text-center text-gray-400">
                                                                                수임 완료된 케이스가 없습니다.
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {partnerStats.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-gray-400">
                                        등록된 제휴 법률사무소가 없습니다. 설정에서 거래처를 등록해주세요.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 비교 인터랙티브 차트 (상위 거래처 인계건 vs 수임건 vs 성공률) */}
            {chartData.length > 0 && (
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <TrendingUp size={18} className="text-indigo-600" />
                            거래처별 인계 건수 대비 수임 전환율(성공률) 비교
                        </span>
                        <span className="text-xs text-gray-400 font-normal">
                            성공률(선 그래프)이 높을수록 리드를 계약으로 잘 이끄는 우량 거래처입니다.
                        </span>
                    </h3>

                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                                <XAxis dataKey="name" stroke={isDark ? '#9CA3AF' : '#6B7280'} tick={{ fontSize: 11 }} />
                                <YAxis yAxisId="left" stroke={isDark ? '#9CA3AF' : '#6B7280'} tick={{ fontSize: 11 }} label={{ value: '건수', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#10B981" tick={{ fontSize: 11 }} unit="%" />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: isDark ? '#1F2937' : '#FFFFFF', 
                                        borderColor: isDark ? '#374151' : '#E5E7EB',
                                        borderRadius: '12px',
                                        fontSize: '12px'
                                    }} 
                                />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                                <Bar yAxisId="left" dataKey="인계건" fill="#93C5FD" name="인계 건수" radius={[4, 4, 0, 0]} />
                                <Bar yAxisId="left" dataKey="수임건" fill="#6366F1" name="수임 완료 건수" radius={[4, 4, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="성공률" stroke="#10B981" strokeWidth={3} name="인계 성공률 (%)" dot={{ r: 4 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* 정산 청구서 모달 */}
            {invoicePartner && (
                <PartnerInvoiceModal
                    isOpen={!!invoicePartner}
                    onClose={() => setInvoicePartner(null)}
                    partner={invoicePartner}
                    cases={partnerStats.find(s => s.partner.partnerId === invoicePartner.partnerId)?.cases || []}
                    periodLabel={periodFilter === '1m' ? '최근 1개월' : periodFilter === '3m' ? '최근 3개월' : '당월'}
                />
            )}
        </div>
    );
};
