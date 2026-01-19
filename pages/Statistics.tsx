import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, differenceInDays, parseISO } from 'date-fns';
import { fetchCases, fetchPartners, fetchInboundPaths, fetchStatuses } from '../services/api';
import { Case, Partner, CaseStatus } from '../types';
import { ChevronLeft, TrendingUp, Users, DollarSign, Target, PieChart, BarChart3, Calendar, Phone, Building, ArrowRight, Filter } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart as RechartsPie, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
    ComposedChart, Funnel, FunnelChart, LabelList
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

// KPI Card Component
const KPICard = ({ title, value, subValue, icon: Icon, color, trend }: any) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{title}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
            </div>
            <div className={`p-3 rounded-full bg-opacity-10 ${color.replace('text-', 'bg-')}`}>
                <Icon className={color} size={24} />
            </div>
        </div>
        {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                <TrendingUp size={12} className={trend < 0 ? 'rotate-180' : ''} />
                <span>{Math.abs(trend)}% 전월 대비</span>
            </div>
        )}
    </div>
);

// Chart Section Wrapper
const ChartSection = ({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) => (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 ${className}`}>
        <h3 className="text-base font-bold text-gray-800 dark:text-white mb-4">{title}</h3>
        {children}
    </div>
);

export default function Statistics() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [cases, setCases] = useState<Case[]>([]);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [inboundPaths, setInboundPaths] = useState<string[]>([]);
    const [statuses, setStatuses] = useState<CaseStatus[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [periodFilter, setPeriodFilter] = useState<'1w' | '1m' | '3m' | '6m' | '1y' | 'all'>('6m');
    const [partnerFilter, setPartnerFilter] = useState<string>('all');
    const [pathFilter, setPathFilter] = useState<string>('all');

    useEffect(() => {
        Promise.all([fetchCases(), fetchPartners(), fetchInboundPaths(), fetchStatuses()]).then(([cData, pData, iData, sData]) => {
            setCases(cData.filter(c => c.status !== '휴지통'));
            setPartners(pData);
            setInboundPaths(iData);
            setStatuses(sData);
            setLoading(false);
        });
    }, []);

    // Filtered Cases
    const filteredCases = useMemo(() => {
        const now = new Date();
        let startDate: Date | null = null;

        switch (periodFilter) {
            case '1w': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
            case '1m': startDate = subMonths(now, 1); break;
            case '3m': startDate = subMonths(now, 3); break;
            case '6m': startDate = subMonths(now, 6); break;
            case '1y': startDate = subMonths(now, 12); break;
            default: startDate = null;
        }

        return cases.filter(c => {
            if (startDate && c.createdAt) {
                const created = new Date(c.createdAt);
                if (created < startDate) return false;
            }
            if (partnerFilter !== 'all' && c.partnerId !== partnerFilter) return false;
            if (pathFilter !== 'all' && c.inboundPath !== pathFilter) return false;
            return true;
        });
    }, [cases, periodFilter, partnerFilter, pathFilter]);

    // ============ KPI Calculations ============
    const kpiData = useMemo(() => {
        const total = filteredCases.length;
        const contracted = filteredCases.filter(c => c.contractAt).length;
        const contractRate = total > 0 ? ((contracted / total) * 100).toFixed(1) : '0';
        const totalContractFee = filteredCases.reduce((sum, c) => sum + (c.contractFee || 0), 0);
        const avgContractFee = contracted > 0 ? Math.round(totalContractFee / contracted) : 0;

        // 입금 완료 건수 (depositHistory가 있고, 최소 1건 이상 입금)
        const deposited = filteredCases.filter(c => c.depositHistory && c.depositHistory.length > 0).length;
        const depositRate = contracted > 0 ? ((deposited / contracted) * 100).toFixed(1) : '0';

        return { total, contracted, contractRate, totalContractFee, avgContractFee, deposited, depositRate };
    }, [filteredCases]);

    // ============ Monthly Trend Data ============
    const monthlyTrendData = useMemo(() => {
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const date = subMonths(new Date(), 5 - i);
            return {
                name: format(date, 'MM월'),
                start: startOfMonth(date),
                end: endOfMonth(date),
                신규: 0,
                계약: 0,
                금액: 0
            };
        });

        filteredCases.forEach(c => {
            if (c.createdAt) {
                const created = new Date(c.createdAt);
                const monthData = last6Months.find(m => isWithinInterval(created, { start: m.start, end: m.end }));
                if (monthData) {
                    monthData.신규++;
                    if (c.contractAt) {
                        monthData.계약++;
                        monthData.금액 += c.contractFee || 0;
                    }
                }
            }
        });

        return last6Months;
    }, [filteredCases]);

    // ============ Funnel Data ============
    const funnelData = useMemo(() => {
        const statusGroups = {
            '신규접수': ['신규접수'],
            '상담진행': ['상담진행', '재통화예정', '상담중단'],
            '사무장접수': ['사무장 접수'],
            '계약완료': filteredCases.filter(c => c.contractAt).map(() => 'contracted')
        };

        const 신규 = filteredCases.length;
        const 상담 = filteredCases.filter(c => !['신규접수'].includes(c.status)).length;
        const 사무장 = filteredCases.filter(c => c.status === '사무장 접수' || c.contractAt).length;
        const 계약 = filteredCases.filter(c => c.contractAt).length;

        return [
            { name: '신규접수', value: 신규, fill: '#3B82F6' },
            { name: '상담진행', value: 상담, fill: '#10B981' },
            { name: '사무장접수', value: 사무장, fill: '#F59E0B' },
            { name: '계약완료', value: 계약, fill: '#8B5CF6' }
        ];
    }, [filteredCases]);

    // ============ Source Analysis Data ============
    const sourceData = useMemo(() => {
        const pathCounts: Record<string, { total: number; contracted: number; fee: number }> = {};

        filteredCases.forEach(c => {
            const path = c.inboundPath || '미분류';
            if (!pathCounts[path]) pathCounts[path] = { total: 0, contracted: 0, fee: 0 };
            pathCounts[path].total++;
            if (c.contractAt) {
                pathCounts[path].contracted++;
                pathCounts[path].fee += c.contractFee || 0;
            }
        });

        return Object.entries(pathCounts)
            .map(([name, data]) => ({
                name,
                건수: data.total,
                계약: data.contracted,
                전환율: data.total > 0 ? Math.round((data.contracted / data.total) * 100) : 0,
                금액: data.fee
            }))
            .sort((a, b) => b.건수 - a.건수)
            .slice(0, 8);
    }, [filteredCases]);

    // ============ Partner Analysis Data ============
    const partnerData = useMemo(() => {
        const partnerCounts: Record<string, { name: string; total: number; contracted: number; fee: number }> = {};

        filteredCases.forEach(c => {
            const partner = partners.find(p => p.partnerId === c.partnerId);
            const key = c.partnerId || 'unknown';
            const name = partner?.name || '미지정';

            if (!partnerCounts[key]) partnerCounts[key] = { name, total: 0, contracted: 0, fee: 0 };
            partnerCounts[key].total++;
            if (c.contractAt) {
                partnerCounts[key].contracted++;
                partnerCounts[key].fee += c.contractFee || 0;
            }
        });

        return Object.values(partnerCounts)
            .map(data => ({
                name: data.name,
                건수: data.total,
                계약: data.contracted,
                전환율: data.total > 0 ? Math.round((data.contracted / data.total) * 100) : 0,
                금액: data.fee
            }))
            .sort((a, b) => b.건수 - a.건수);
    }, [filteredCases, partners]);

    // ============ Status Distribution Data ============
    const statusData = useMemo(() => {
        const statusCounts: Record<string, number> = {};

        filteredCases.forEach(c => {
            const status = c.status || '미분류';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        return Object.entries(statusCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredCases]);

    // ============ Secondary Status Distribution ============
    const secondaryStatusData = useMemo(() => {
        const samuCases = filteredCases.filter(c => c.status === '사무장 접수');
        const statusCounts: Record<string, number> = {};

        samuCases.forEach(c => {
            const status = c.secondaryStatus || '미지정';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        return Object.entries(statusCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredCases]);

    // ============ Reminder Analysis ============
    const reminderData = useMemo(() => {
        let total = 0, completed = 0, missed = 0, rescheduled = 0, cancelled = 0;

        filteredCases.forEach(c => {
            (c.reminders || []).forEach(r => {
                total++;
                if (r.resultStatus === '완료') completed++;
                else if (r.resultStatus === '미연결') missed++;
                else if (r.resultStatus === '재예약') rescheduled++;
                else if (r.resultStatus === '취소') cancelled++;
            });
        });

        return [
            { name: '완료', value: completed, fill: '#10B981' },
            { name: '미연결', value: missed, fill: '#EF4444' },
            { name: '재예약', value: rescheduled, fill: '#3B82F6' },
            { name: '취소', value: cancelled, fill: '#6B7280' },
            { name: '미처리', value: total - completed - missed - rescheduled - cancelled, fill: '#F59E0B' }
        ].filter(d => d.value > 0);
    }, [filteredCases]);

    if (loading) return <div className="p-10 text-center text-gray-500">로딩중...</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link to="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        <ChevronLeft size={24} />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">📊 상세 통계</h1>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">필터:</span>
                    </div>

                    {/* Period Filter */}
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                        {[
                            { key: '1w', label: '1주' },
                            { key: '1m', label: '1개월' },
                            { key: '3m', label: '3개월' },
                            { key: '6m', label: '6개월' },
                            { key: '1y', label: '1년' },
                            { key: 'all', label: '전체' }
                        ].map(p => (
                            <button
                                key={p.key}
                                onClick={() => setPeriodFilter(p.key as any)}
                                className={`px-3 py-1 text-xs rounded-md transition-colors ${periodFilter === p.key
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Partner Filter */}
                    <select
                        value={partnerFilter}
                        onChange={e => setPartnerFilter(e.target.value)}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700"
                    >
                        <option value="all">모든 거래처</option>
                        {partners.map(p => (
                            <option key={p.partnerId} value={p.partnerId}>{p.name}</option>
                        ))}
                    </select>

                    {/* Path Filter */}
                    <select
                        value={pathFilter}
                        onChange={e => setPathFilter(e.target.value)}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700"
                    >
                        <option value="all">모든 유입경로</option>
                        {inboundPaths.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>

                    <span className="text-xs text-gray-400 ml-auto">
                        총 {filteredCases.length}건 조회됨
                    </span>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard title="총 케이스" value={kpiData.total} subValue="필터 기간 내" icon={Users} color="text-blue-600" />
                <KPICard title="계약 건수" value={kpiData.contracted} subValue={`전환율 ${kpiData.contractRate}%`} icon={Target} color="text-green-600" />
                <KPICard title="총 계약금액" value={`${kpiData.totalContractFee.toLocaleString()}만원`} subValue={`평균 ${kpiData.avgContractFee.toLocaleString()}만원`} icon={DollarSign} color="text-purple-600" />
                <KPICard title="입금 완료" value={kpiData.deposited} subValue={`입금률 ${kpiData.depositRate}%`} icon={TrendingUp} color="text-orange-600" />
            </div>

            {/* Row 1: Monthly Trend + Funnel */}
            <div className="grid md:grid-cols-2 gap-4">
                <ChartSection title="📈 월별 신규 접수 & 계약 추이">
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={monthlyTrendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                                <XAxis dataKey="name" stroke={isDark ? '#9CA3AF' : '#6B7280'} tick={{ fontSize: 11 }} />
                                <YAxis yAxisId="left" stroke={isDark ? '#9CA3AF' : '#6B7280'} tick={{ fontSize: 11 }} />
                                <YAxis yAxisId="right" orientation="right" stroke={isDark ? '#9CA3AF' : '#6B7280'} tick={{ fontSize: 11 }} />
                                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1F2937' : '#FFF', borderColor: isDark ? '#374151' : '#E5E7EB' }} />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                <Bar yAxisId="left" dataKey="신규" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                <Bar yAxisId="left" dataKey="계약" fill="#10B981" radius={[4, 4, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="금액" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </ChartSection>

                <ChartSection title="🎯 계약 전환 퍼널">
                    <div className="h-[280px] flex items-center justify-center">
                        <div className="w-full space-y-2">
                            {funnelData.map((stage, i) => {
                                const widthPercent = funnelData[0].value > 0 ? (stage.value / funnelData[0].value) * 100 : 0;
                                const conversionRate = i > 0 && funnelData[i - 1].value > 0
                                    ? ((stage.value / funnelData[i - 1].value) * 100).toFixed(0)
                                    : '100';
                                return (
                                    <div key={stage.name} className="flex items-center gap-3">
                                        <div className="w-20 text-xs text-right text-gray-500">{stage.name}</div>
                                        <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-700 rounded relative overflow-hidden">
                                            <div
                                                className="h-full rounded transition-all duration-500"
                                                style={{ width: `${widthPercent}%`, backgroundColor: stage.fill }}
                                            />
                                            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-difference">
                                                {stage.value}건 ({conversionRate}%)
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </ChartSection>
            </div>

            {/* Row 2: Source Analysis */}
            <div className="grid md:grid-cols-2 gap-4">
                <ChartSection title="📍 유입경로별 분포">
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsPie>
                                <Pie
                                    data={sourceData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    dataKey="건수"
                                    label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                                    labelLine={false}
                                >
                                    {sourceData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </RechartsPie>
                        </ResponsiveContainer>
                    </div>
                </ChartSection>

                <ChartSection title="📊 유입경로별 계약 전환율">
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sourceData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                                <Tooltip formatter={(v: any) => `${v}%`} />
                                <Bar dataKey="전환율" fill="#10B981" radius={[0, 4, 4, 0]}>
                                    <LabelList dataKey="전환율" position="right" formatter={(v: any) => `${v}%`} style={{ fontSize: 10 }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartSection>
            </div>

            {/* Row 3: Partner & Status Analysis */}
            <div className="grid md:grid-cols-2 gap-4">
                <ChartSection title="🏢 거래처별 성과">
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={partnerData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                                <XAxis type="number" tick={{ fontSize: 11 }} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                                <Bar dataKey="건수" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="계약" fill="#10B981" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartSection>

                <ChartSection title="📋 현재 상태 분포">
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={statusData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                                <XAxis type="number" tick={{ fontSize: 11 }} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]}>
                                    {statusData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartSection>
            </div>

            {/* Row 4: Secondary Status & Reminder */}
            <div className="grid md:grid-cols-2 gap-4">
                <ChartSection title="🔄 2차 상태 분포 (사무장 접수 케이스)">
                    <div className="h-[280px]">
                        {secondaryStatusData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPie>
                                    <Pie
                                        data={secondaryStatusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        dataKey="value"
                                        label={({ name, percent }) => percent > 0.05 ? `${name}` : ''}
                                    >
                                        {secondaryStatusData.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '11px' }} />
                                </RechartsPie>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                사무장 접수 케이스가 없습니다
                            </div>
                        )}
                    </div>
                </ChartSection>

                <ChartSection title="📞 리마인더 결과 분석">
                    <div className="h-[280px]">
                        {reminderData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPie>
                                    <Pie
                                        data={reminderData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        dataKey="value"
                                        label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                                    >
                                        {reminderData.map((entry, i) => (
                                            <Cell key={i} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '11px' }} />
                                </RechartsPie>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                리마인더 데이터가 없습니다
                            </div>
                        )}
                    </div>
                </ChartSection>
            </div>

            {/* Partner Ranking Table */}
            <ChartSection title="🏆 거래처별 누적 수임료 랭킹">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-2 px-3 text-gray-500">순위</th>
                                <th className="text-left py-2 px-3 text-gray-500">거래처</th>
                                <th className="text-right py-2 px-3 text-gray-500">케이스</th>
                                <th className="text-right py-2 px-3 text-gray-500">계약</th>
                                <th className="text-right py-2 px-3 text-gray-500">전환율</th>
                                <th className="text-right py-2 px-3 text-gray-500">누적 수임료</th>
                            </tr>
                        </thead>
                        <tbody>
                            {partnerData.slice(0, 10).map((p, i) => (
                                <tr key={i} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="py-2 px-3 font-bold text-gray-400">{i + 1}</td>
                                    <td className="py-2 px-3 font-medium">{p.name}</td>
                                    <td className="py-2 px-3 text-right">{p.건수}</td>
                                    <td className="py-2 px-3 text-right text-green-600">{p.계약}</td>
                                    <td className="py-2 px-3 text-right">{p.전환율}%</td>
                                    <td className="py-2 px-3 text-right font-bold text-purple-600">{p.금액.toLocaleString()}만원</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ChartSection>
        </div>
    );
}
