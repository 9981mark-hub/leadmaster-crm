import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { fetchCases, fetchPartners, fetchInboundPaths, fetchStatuses, fetchTossAdsRecords, fetchTaxInvoices } from '../services/api';
import { Case, Partner, CaseStatus } from '../types';
import { calculatePayableCommission } from '../utils';
import { ChevronLeft, TrendingUp, Users, DollarSign, Target, PieChart, BarChart3, Calendar, Phone, Building, ArrowRight, Filter, Save, AlertTriangle, Download, Printer } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart as RechartsPie, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
    ComposedChart, Funnel, FunnelChart, LabelList
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

// Custom Glassmorphic Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="glass-panel p-3 rounded-lg border border-gray-200/50 dark:border-gray-700/50 shadow-lg text-xs">
                <p className="font-bold text-gray-800 dark:text-gray-100 mb-1">{label}</p>
                {payload.map((pld: any, index: number) => {
                    const value = typeof pld.value === 'number'
                        ? (pld.name.includes('금액') || pld.name.includes('수임료') || pld.name.includes('수수료') || pld.name.includes('광고비')
                            ? `${pld.value.toLocaleString()}만원`
                            : pld.name.includes('율') || pld.name.includes('ROAS')
                                ? `${pld.value}%`
                                : `${pld.value}건`)
                        : pld.value;
                    return (
                        <p key={index} style={{ color: pld.color || pld.fill }} className="font-medium">
                            {pld.name}: <span className="font-bold">{value}</span>
                        </p>
                    );
                })}
            </div>
        );
    }
    return null;
};

// KPI Card Component with Delta support
const KPICard = ({ title, value, subValue, icon: Icon, color, deltaComponent }: any) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 glass-panel hover:scale-[1.02] transition-transform duration-300">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{title}</p>
                <div className="flex items-baseline flex-wrap">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    {deltaComponent}
                </div>
                {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
            </div>
            <div className={`p-3 rounded-full bg-opacity-10 ${color.replace('text-', 'bg-')}`}>
                <Icon className={color} size={24} />
            </div>
        </div>
    </div>
);

// Chart Section Wrapper
const ChartSection = ({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) => (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 glass-panel ${className}`}>
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

    // Active Navigation Tab
    const [activeTab, setActiveTab] = useState<'overview' | 'marketing' | 'partners' | 'dropoffs'>('overview');

    // Filters
    const [periodFilter, setPeriodFilter] = useState<'1w' | '1m' | '3m' | '6m' | '1y' | 'all'>('6m');
    const [partnerFilter, setPartnerFilter] = useState<string>('all');
    const [pathFilter, setPathFilter] = useState<string>('all');

    // Target Contract Goal State (localStorage linked)
    const [targetContracts, setTargetContracts] = useState<number>(() => {
        const saved = localStorage.getItem('lm_target_contracts');
        return saved ? Number(saved) : 10; // Default: 10 cases
    });
    const [isEditingTarget, setIsEditingTarget] = useState(false);
    const [targetInput, setTargetInput] = useState(targetContracts.toString());

    useEffect(() => {
        Promise.all([fetchCases(), fetchPartners(), fetchInboundPaths(), fetchStatuses()]).then(([cData, pData, iData, sData]) => {
            setCases(cData.filter(c => c.status !== '휴지통'));
            setPartners(pData);
            setInboundPaths(iData);
            setStatuses(sData);
            setLoading(false);
        });
    }, []);

    // Filtered Cases (Current Period)
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

    // Previous Period Cases (For PoP Comparison)
    const prevPeriodCases = useMemo(() => {
        const now = new Date();
        let startDate: Date | null = null;
        let prevStartDate: Date | null = null;
        let prevEndDate: Date | null = null;

        switch (periodFilter) {
            case '1w':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                prevStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                prevEndDate = startDate;
                break;
            case '1m':
                startDate = subMonths(now, 1);
                prevStartDate = subMonths(startDate, 1);
                prevEndDate = startDate;
                break;
            case '3m':
                startDate = subMonths(now, 3);
                prevStartDate = subMonths(startDate, 3);
                prevEndDate = startDate;
                break;
            case '6m':
                startDate = subMonths(now, 6);
                prevStartDate = subMonths(startDate, 6);
                prevEndDate = startDate;
                break;
            case '1y':
                startDate = subMonths(now, 12);
                prevStartDate = subMonths(startDate, 12);
                prevEndDate = startDate;
                break;
            default:
                startDate = null;
                prevStartDate = null;
                prevEndDate = null;
        }

        if (!prevStartDate || !prevEndDate) return [];

        return cases.filter(c => {
            if (c.createdAt) {
                const created = new Date(c.createdAt);
                if (created < prevStartDate! || created >= prevEndDate!) return false;
            } else {
                return false;
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

        const deposited = filteredCases.filter(c => c.depositHistory && c.depositHistory.length > 0).length;
        const depositRate = contracted > 0 ? ((deposited / contracted) * 100).toFixed(1) : '0';

        return { total, contracted, contractRate, totalContractFee, avgContractFee, deposited, depositRate };
    }, [filteredCases]);

    // Previous KPI Calculations (For delta comparison)
    const prevKpiData = useMemo(() => {
        const total = prevPeriodCases.length;
        const contracted = prevPeriodCases.filter(c => c.contractAt).length;
        const contractRate = total > 0 ? ((contracted / total) * 100).toFixed(1) : '0';
        const totalContractFee = prevPeriodCases.reduce((sum, c) => sum + (c.contractFee || 0), 0);
        const avgContractFee = contracted > 0 ? Math.round(totalContractFee / contracted) : 0;

        const deposited = prevPeriodCases.filter(c => c.depositHistory && c.depositHistory.length > 0).length;
        const depositRate = contracted > 0 ? ((deposited / contracted) * 100).toFixed(1) : '0';

        return { total, contracted, contractRate, totalContractFee, avgContractFee, deposited, depositRate };
    }, [prevPeriodCases]);

    // Delta renderer helper (Positive growth is green, negative is red)
    const renderDelta = (curr: number, prev: number, isPercentPoint = false, isWon = false) => {
        if (periodFilter === 'all') return null;
        const diff = curr - prev;
        if (diff === 0) return <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal ml-1">(0)</span>;

        let displayDiff = '';
        if (isPercentPoint) {
            displayDiff = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%p`;
        } else if (isWon) {
            displayDiff = `${diff > 0 ? '+' : ''}${diff.toLocaleString()}만원`;
        } else {
            const percentChange = prev > 0 ? ((diff / prev) * 100).toFixed(1) : null;
            displayDiff = `${diff > 0 ? '+' : ''}${diff}건${percentChange ? ` (${diff > 0 ? '+' : ''}${percentChange}%)` : ''}`;
        }

        const isPositive = diff > 0;
        const colorClass = isPositive ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400';

        return (
            <span className={`text-[10px] font-semibold ml-1.5 flex items-center gap-0.5 ${colorClass}`}>
                {isPositive ? '▲' : '▼'} {displayDiff}
            </span>
        );
    };

    // Monthly contracts count for target tracking
    const currentMonthContracts = useMemo(() => {
        const now = new Date();
        const startOfCurrMonth = startOfMonth(now);
        const endOfCurrMonth = endOfMonth(now);
        return cases.filter(c => {
            if (!c.contractAt) return false;
            const contractDate = new Date(c.contractAt);
            return isWithinInterval(contractDate, { start: startOfCurrMonth, end: endOfCurrMonth });
        }).length;
    }, [cases]);

    const handleSaveTarget = () => {
        const val = parseInt(targetInput, 10);
        if (!isNaN(val) && val > 0) {
            setTargetContracts(val);
            localStorage.setItem('lm_target_contracts', val.toString());
        }
        setIsEditingTarget(false);
    };

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
            .sort((a, b) => b.금액 - a.금액);
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
            .sort((a, b) => b.금액 - a.금액);
    }, [filteredCases, partners]);

    const partnerRankingData = useMemo(() => {
        return [...partnerData].sort((a, b) => b.금액 - a.금액);
    }, [partnerData]);

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

    // ============ Ad Spend & ROI Data ============
    const [adSpendMonth, setAdSpendMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [adSpendData, setAdSpendData] = useState<Record<string, Record<string, number>>>(() => {
        try {
            const saved = localStorage.getItem('lm_ad_spend');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });
    const [adSpendEditing, setAdSpendEditing] = useState<Record<string, string>>({});
    const [showAdSpendInput, setShowAdSpendInput] = useState(false);
    const [roiData, setRoiData] = useState<{ name: string; 리드: number; 계약: number; 수임료: number; 수수료: number; 광고비: number; CPA: number; CPC: number; ROAS: number }[]>([]);

    const handleAdSpendChange = (path: string, value: string) => {
        setAdSpendEditing(prev => ({ ...prev, [path]: value }));
    };

    const saveAdSpend = () => {
        const monthData: Record<string, number> = {};
        Object.entries(adSpendEditing).forEach(([path, val]) => {
            const num = Number(val);
            if (num > 0) monthData[path] = num;
        });
        const updated = { ...adSpendData, [adSpendMonth]: monthData };
        setAdSpendData(updated);
        localStorage.setItem('lm_ad_spend', JSON.stringify(updated));
        setShowAdSpendInput(false);
    };

    useEffect(() => {
        const monthSpend = adSpendData[adSpendMonth] || {};
        const editing: Record<string, string> = {};
        inboundPaths.forEach(p => {
            editing[p] = monthSpend[p]?.toString() || '';
        });
        setAdSpendEditing(editing);
    }, [adSpendMonth, adSpendData, inboundPaths]);

    useEffect(() => {
        const calculateRoi = async () => {
            let startDate: Date | null = null;
            const now = new Date();
            switch (periodFilter) {
                case '1m': startDate = subMonths(now, 1); break;
                case '3m': startDate = subMonths(now, 3); break;
                case '6m': startDate = subMonths(now, 6); break;
                case '1y': startDate = subMonths(now, 12); break;
                default: startDate = null;
            }

            const aggregatedSpend: Record<string, number> = {};
            Object.entries(adSpendData).forEach(([monthStr, paths]) => {
                const monthDate = parseISO(`${monthStr}-01`);
                if (startDate && endOfMonth(monthDate) < startDate) return;

                Object.entries(paths).forEach(([path, amount]) => {
                    aggregatedSpend[path] = (aggregatedSpend[path] || 0) + amount;
                });
            });

            try {
                const tossAdsRecords = fetchTossAdsRecords();
                let tossAdsTotalSpendInManwon = 0;
                tossAdsRecords.forEach(record => {
                    if (startDate && new Date(record.date) < startDate) return;
                    tossAdsTotalSpendInManwon += Math.round(record.spendExVat / 10000);
                });

                if (tossAdsTotalSpendInManwon > 0) {
                    const tossPath = inboundPaths.find(p => p.includes('토스')) || '토스';
                    aggregatedSpend[tossPath] = (aggregatedSpend[tossPath] || 0) + tossAdsTotalSpendInManwon;
                }
            } catch (e) {
                console.error('Error integrating Toss Ads into ROI calculations:', e);
            }

            try {
                const purchaseInvoices = await fetchTaxInvoices(undefined, '매입');
                const filteredInvoices = purchaseInvoices.filter(inv => {
                    if (!startDate) return true;
                    return new Date(inv.issueDate) >= startDate;
                });

                const adKeywords = ['광고', '토스', 'toss', '배너', 'CPS', 'CPA', '마케팅', 'marketing'];
                filteredInvoices.forEach(inv => {
                    const desc = (inv.description || '').toLowerCase();
                    const company = (inv.companyName || '').toLowerCase();
                    const isAdSpend = adKeywords.some(k => desc.includes(k.toLowerCase()) || company.includes(k.toLowerCase()));
                    if (isAdSpend) {
                        let matchedPath = '';
                        if (desc.includes('토스') || company.includes('토스') || company.includes('비바리퍼블리카') || company.includes('toss')) {
                            matchedPath = inboundPaths.find(p => p.includes('토스')) || '토스';
                        } else {
                            matchedPath = inboundPaths.find(p => desc.includes(p.toLowerCase()) || company.includes(p.toLowerCase())) || '기타광고';
                        }
                        const amountInManwon = Math.round(inv.totalAmount / 10000);
                        aggregatedSpend[matchedPath] = (aggregatedSpend[matchedPath] || 0) + amountInManwon;
                    }
                });
            } catch (e) {
                console.error('Error integrating purchase invoices into ROI calculations:', e);
            }

            const pathCounts: Record<string, { leads: number; contracts: number; fee: number; commission: number; spend: number }> = {};
            inboundPaths.forEach(p => {
                pathCounts[p] = { leads: 0, contracts: 0, fee: 0, commission: 0, spend: aggregatedSpend[p] || 0 };
            });

            filteredCases.forEach(c => {
                const path = c.inboundPath || '미분류';
                if (!pathCounts[path]) pathCounts[path] = { leads: 0, contracts: 0, fee: 0, commission: 0, spend: 0 };
                pathCounts[path].leads++;
                if (c.contractAt) {
                    pathCounts[path].contracts++;
                    pathCounts[path].fee += c.contractFee || 0;

                    const partner = partners.find(p => p.partnerId === c.partnerId);
                    if (partner) {
                        const { payable } = calculatePayableCommission(c, partner.commissionRules, partner.settlementConfig);
                        pathCounts[path].commission += payable;
                    }
                }
            });

            const result = Object.entries(pathCounts)
                .filter(([_, d]) => d.leads > 0 || d.spend > 0)
                .map(([name, d]) => ({
                    name,
                    리드: d.leads,
                    계약: d.contracts,
                    수임료: d.fee,
                    수수료: d.commission,
                    광고비: d.spend,
                    CPA: d.spend > 0 && d.leads > 0 ? Math.round(d.spend / d.leads) : 0,
                    CPC: d.spend > 0 && d.contracts > 0 ? Math.round(d.spend / d.contracts) : 0,
                    ROAS: d.spend > 0 ? Math.round((d.commission / d.spend) * 100) : 0,
                }))
                .sort((a, b) => b.ROAS - a.ROAS);

            setRoiData(result);
        };

        calculateRoi();
    }, [filteredCases, adSpendData, inboundPaths, periodFilter, partners]);

    const exportRoiCsv = () => {
        if (!roiData || roiData.length === 0) return;
        let csvContent = "\uFEFF채널,광고비,리드(건),계약(건),수임료,수수료,CPA,CPC,ROAS(수수료 기준)\n";
        roiData.forEach(d => {
            csvContent += `"${d.name}","${d.광고비 > 0 ? `${d.광고비}만원` : '-'}","${d.리드}","${d.계약}","${d.수임료 > 0 ? `${d.수임료}만원` : '-'}","${d.수수료 > 0 ? `${d.수수료}만원` : '-'}","${d.CPA > 0 ? `${d.CPA}만원` : '-'}","${d.CPC > 0 ? `${d.CPC}만원` : '-'}","${d.ROAS > 0 ? `${d.ROAS}%` : '-'}"\n`;
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `광고_ROI_분석_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ============ Drop-Off Analysis ============
    const dropOffCases = useMemo(() => {
        return filteredCases.filter(c => ['고객취소', '진행불가'].includes(c.status));
    }, [filteredCases]);

    const totalDropOff = dropOffCases.length;

    const dropOffReasonData = useMemo(() => {
        const counts: Record<string, number> = {};
        dropOffCases.forEach(c => {
            if (c.dropOffReason) {
                counts[c.dropOffReason] = (counts[c.dropOffReason] || 0) + 1;
            }
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [dropOffCases]);

    const dropOffStageData = useMemo(() => {
        const stageCounts: Record<string, number> = {};
        dropOffCases.forEach(c => {
            if (c.statusLogs && c.statusLogs.length > 0) {
                const dropOffLog = c.statusLogs.find(log => ['고객취소', '진행불가'].includes(log.toStatus));
                if (dropOffLog) {
                    const fromStatus = dropOffLog.fromStatus || '알 수 없음';
                    stageCounts[fromStatus] = (stageCounts[fromStatus] || 0) + 1;
                }
            }
        });
        return Object.entries(stageCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [dropOffCases]);

    if (loading) return <div className="p-10 text-center text-gray-500">로딩중...</div>;

    const targetRadius = 24;
    const targetStrokeWidth = 5;
    const targetCircumference = 2 * Math.PI * targetRadius;
    const targetPercent = Math.min(100, Math.round((currentMonthContracts / targetContracts) * 100));
    const targetStrokeDashoffset = targetCircumference - (targetPercent / 100) * targetCircumference;

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Print styling media query */}
            <style>{`
                @media print {
                    body {
                        background: white !important;
                        color: black !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-layout {
                        display: grid !important;
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 15px !important;
                    }
                    .print-full-width {
                        grid-column: span 2 !important;
                    }
                    .glass-panel, .glass-card {
                        border: 1px solid #ccc !important;
                        box-shadow: none !important;
                        background: none !important;
                        backdrop-filter: none !important;
                    }
                }
            `}</style>

            {/* Header */}
            <div className="flex items-center justify-between no-print">
                <div className="flex items-center gap-3">
                    <Link to="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        <ChevronLeft size={24} />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">📊 상세 통계</h1>
                </div>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-gray-700 dark:text-gray-300"
                >
                    <Printer size={14} /> 보고서 인쇄 / PDF 출력
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 glass-panel no-print">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">필터:</span>
                    </div>

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

                    <select
                        value={partnerFilter}
                        onChange={e => setPartnerFilter(e.target.value)}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 glass-input"
                    >
                        <option value="all">모든 거래처</option>
                        {partners.map(p => (
                            <option key={p.partnerId} value={p.partnerId}>{p.name}</option>
                        ))}
                    </select>

                    <select
                        value={pathFilter}
                        onChange={e => setPathFilter(e.target.value)}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 glass-input"
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

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700 pb-1.5 no-print">
                {[
                    { id: 'overview', label: '📈 종합 분석', icon: BarChart3 },
                    { id: 'marketing', label: '💰 마케팅/ROI', icon: DollarSign },
                    { id: 'partners', label: '🏢 거래처 성과', icon: Building },
                    { id: 'dropoffs', label: '⚠️ 이탈 분석', icon: AlertTriangle }
                ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${isActive
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                        >
                            <Icon size={15} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* KPI Summary Block */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KPICard
                    title="총 케이스"
                    value={kpiData.total}
                    subValue="필터 기간 내"
                    icon={Users}
                    color="text-blue-600 dark:text-blue-400"
                    deltaComponent={renderDelta(kpiData.total, prevKpiData.total)}
                />
                <KPICard
                    title="계약 건수"
                    value={kpiData.contracted}
                    subValue={`전환율 ${kpiData.contractRate}%`}
                    icon={Target}
                    color="text-green-600 dark:text-green-400"
                    deltaComponent={renderDelta(kpiData.contracted, prevKpiData.contracted)}
                />
                <KPICard
                    title="총 계약금액"
                    value={`${kpiData.totalContractFee.toLocaleString()}만원`}
                    subValue={`평균 ${kpiData.avgContractFee.toLocaleString()}만원`}
                    icon={DollarSign}
                    color="text-purple-600 dark:text-purple-400"
                    deltaComponent={renderDelta(kpiData.totalContractFee, prevKpiData.totalContractFee, false, true)}
                />
                <KPICard
                    title="입금 완료"
                    value={kpiData.deposited}
                    subValue={`입금률 ${kpiData.depositRate}%`}
                    icon={TrendingUp}
                    color="text-orange-600 dark:text-orange-400"
                    deltaComponent={renderDelta(kpiData.deposited, prevKpiData.deposited)}
                />

                {/* Target Gauge Card */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between col-span-2 md:col-span-1 glass-panel">
                    <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">이번 달 계약 목표</p>
                        {isEditingTarget ? (
                            <div className="flex items-center gap-1 mt-1">
                                <input
                                    type="number"
                                    value={targetInput}
                                    onChange={e => setTargetInput(e.target.value)}
                                    className="w-16 p-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 text-center"
                                    min="1"
                                />
                                <button onClick={handleSaveTarget} className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">저장</button>
                            </div>
                        ) : (
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{currentMonthContracts}</span>
                                <span className="text-xs text-gray-400">/ {targetContracts}건</span>
                                <button
                                    onClick={() => { setTargetInput(targetContracts.toString()); setIsEditingTarget(true); }}
                                    className="text-[10px] text-gray-400 hover:text-blue-500 ml-1.5 underline"
                                >
                                    설정
                                </button>
                            </div>
                        )}
                        <p className="text-xs text-gray-400 mt-2">달성률 {targetPercent}%</p>
                    </div>
                    <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="28"
                                cy="28"
                                r={targetRadius}
                                className="stroke-gray-100 dark:stroke-gray-700"
                                strokeWidth={targetStrokeWidth}
                                fill="transparent"
                            />
                            <circle
                                cx="28"
                                cy="28"
                                r={targetRadius}
                                className="stroke-indigo-600 dark:stroke-indigo-400 transition-all duration-500 ease-out"
                                strokeWidth={targetStrokeWidth}
                                strokeDasharray={targetCircumference}
                                strokeDashoffset={targetStrokeDashoffset}
                                strokeLinecap="round"
                                fill="transparent"
                            />
                        </svg>
                        <span className="absolute text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{targetPercent}%</span>
                    </div>
                </div>
            </div>

            {/* Render Selected Tab content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                >
                    {/* ========================================================================= */}
                    {/* TAB 1: OVERVIEW */}
                    {/* ========================================================================= */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6 print-layout">
                            <div className="grid md:grid-cols-2 gap-4 print-full-width">
                                <ChartSection title="📈 월별 신규 접수 & 계약 추이 (그라데이션 분석)">
                                    <div className="h-[280px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={monthlyTrendData}>
                                                <defs>
                                                    <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                                                    </linearGradient>
                                                    <linearGradient id="colorContract" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                                                    </linearGradient>
                                                    <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                                                <XAxis dataKey="name" stroke={isDark ? '#9CA3AF' : '#6B7280'} tick={{ fontSize: 11 }} />
                                                <YAxis yAxisId="left" stroke={isDark ? '#9CA3AF' : '#6B7280'} tick={{ fontSize: 11 }} />
                                                <YAxis yAxisId="right" orientation="right" stroke={isDark ? '#9CA3AF' : '#6B7280'} tick={{ fontSize: 11 }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                                <Bar yAxisId="left" dataKey="신규" fill="url(#colorNew)" radius={[4, 4, 0, 0]} />
                                                <Bar yAxisId="left" dataKey="계약" fill="url(#colorContract)" radius={[4, 4, 0, 0]} />
                                                <Area yAxisId="right" type="monotone" dataKey="금액" fill="url(#colorAmt)" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4 }} name="금액" />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </ChartSection>

                                <ChartSection title="🎯 계약 전환 퍼널 (Leakage 분석)">
                                    <div className="h-[280px] flex items-center justify-center">
                                        <div className="w-full space-y-2.5">
                                            {funnelData.map((stage, i) => {
                                                const widthPercent = funnelData[0].value > 0 ? (stage.value / funnelData[0].value) * 100 : 0;
                                                const conversionRate = i > 0 && funnelData[i - 1].value > 0
                                                    ? ((stage.value / funnelData[i - 1].value) * 100).toFixed(0)
                                                    : '100';

                                                const dropOffPercent = i > 0 && funnelData[i - 1].value > 0
                                                    ? (100 - (stage.value / funnelData[i - 1].value) * 100).toFixed(0)
                                                    : '0';

                                                return (
                                                    <div key={stage.name} className="space-y-1">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-20 text-xs text-right text-gray-500 font-medium">{stage.name}</div>
                                                            <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-700/50 rounded-lg relative overflow-hidden glass-card">
                                                                <div
                                                                    className="h-full rounded-lg transition-all duration-500 shadow-inner"
                                                                    style={{
                                                                        width: `${widthPercent}%`,
                                                                        background: `linear-gradient(90deg, ${stage.fill}dd, ${stage.fill})`
                                                                    }}
                                                                />
                                                                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800 dark:text-white">
                                                                    {stage.value}건 ({i === 0 ? '100%' : `전환율 ${conversionRate}%`})
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {i > 0 && Number(dropOffPercent) > 0 && (
                                                            <div className="flex items-center justify-end pr-2 gap-1 text-[10px] text-red-500 font-semibold">
                                                                <span>이탈: -{dropOffPercent}%</span>
                                                                <span className="text-gray-400 font-normal">({funnelData[i - 1].value - stage.value}명 이탈)</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </ChartSection>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <ChartSection title="📋 현재 상태 분포">
                                    <div className="h-[280px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={statusData} layout="vertical">
                                                <defs>
                                                    <linearGradient id="colorStatus" x1="0" y1="0" x2="1" y2="0">
                                                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.2} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                                                <XAxis type="number" tick={{ fontSize: 11 }} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Bar dataKey="value" fill="url(#colorStatus)" radius={[0, 4, 4, 0]} name="케이스 수">
                                                    {statusData.map((_, i) => (
                                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
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
                                                        labelLine={false}
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
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 2: MARKETING & ROI */}
                    {/* ========================================================================= */}
                    {activeTab === 'marketing' && (
                        <div className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <ChartSection title="📍 유입경로별 분포">
                                    <div className="h-[280px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RechartsPie>
                                                <Pie
                                                    data={sourceData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={55}
                                                    outerRadius={85}
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
                                                <defs>
                                                    <linearGradient id="colorConv" x1="0" y1="0" x2="1" y2="0">
                                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.2} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                                                <Tooltip formatter={(v: any) => `${v}%`} />
                                                <Bar dataKey="전환율" fill="url(#colorConv)" radius={[0, 4, 4, 0]}>
                                                    <LabelList dataKey="전환율" position="right" formatter={(v: any) => `${v}%`} style={{ fontSize: 10 }} />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </ChartSection>
                            </div>

                            {/* ROI Box */}
                            <ChartSection title="💰 광고 ROI 분석">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-2 no-print">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            유입경로별 광고비를 입력하면 CPA, CPC, ROAS를 자동 계산합니다. <br />
                                            <span className="text-blue-600 dark:text-blue-400 font-medium">* 토스 애즈 및 매입 세금계산서의 광고비는 자동으로 합산 반영됩니다.</span>
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={exportRoiCsv}
                                                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                                            >
                                                <Download size={13} /> 엑셀 다운로드 (CSV)
                                            </button>
                                            <button
                                                onClick={() => setShowAdSpendInput(!showAdSpendInput)}
                                                className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium dark:bg-blue-900/30 dark:text-blue-400"
                                            >
                                                {showAdSpendInput ? '접기' : '광고비 직접 입력'}
                                            </button>
                                        </div>
                                    </div>

                                    {showAdSpendInput && (
                                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3 no-print">
                                            <div className="flex items-center gap-3">
                                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">월 선택</label>
                                                <input
                                                    type="month"
                                                    value={adSpendMonth}
                                                    onChange={e => setAdSpendMonth(e.target.value)}
                                                    className="p-1.5 border rounded text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                                {inboundPaths.map(path => (
                                                    <div key={path} className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-600 dark:text-gray-400 min-w-[60px] truncate" title={path}>{path}</span>
                                                        <div className="flex items-center">
                                                            <input
                                                                type="number"
                                                                placeholder="0"
                                                                value={adSpendEditing[path] || ''}
                                                                onChange={e => handleAdSpendChange(path, e.target.value)}
                                                                className="w-20 p-1.5 border rounded text-sm text-right bg-white dark:bg-gray-700 dark:border-gray-600"
                                                            />
                                                            <span className="text-xs text-gray-500 ml-1">만원</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <button
                                                onClick={saveAdSpend}
                                                className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                                            >
                                                <Save size={14} /> 저장
                                            </button>
                                        </div>
                                    )}

                                    {roiData.length > 0 && roiData.some(d => d.광고비 > 0) ? (
                                        <>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                    <thead>
                                                        <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500">
                                                            <th className="py-2 px-2">채널</th>
                                                            <th className="text-right py-2 px-2">광고비</th>
                                                            <th className="text-right py-2 px-2">리드</th>
                                                            <th className="text-right py-2 px-2">계약</th>
                                                            <th className="text-right py-2 px-2">수임료</th>
                                                            <th className="text-right py-2 px-2 font-semibold text-blue-600">수수료 (매출)</th>
                                                            <th className="text-right py-2 px-2">CPA</th>
                                                            <th className="text-right py-2 px-2">CPC</th>
                                                            <th className="text-right py-2 px-2 font-bold">ROAS <span className="text-[10px] font-normal text-gray-400 block">(수수료 기준)</span></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {roiData.map((d, i) => (
                                                            <tr key={i} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                                <td className="py-2 px-2 font-medium">{d.name}</td>
                                                                <td className="py-2 px-2 text-right text-gray-500">{d.광고비 > 0 ? `${d.광고비.toLocaleString()}만원` : '-'}</td>
                                                                <td className="py-2 px-2 text-right">{d.리드}건</td>
                                                                <td className="py-2 px-2 text-right text-green-600 font-semibold">{d.계약}건</td>
                                                                <td className="py-2 px-2 text-right text-purple-600">{d.수임료 > 0 ? `${d.수임료.toLocaleString()}만원` : '-'}</td>
                                                                <td className="py-2 px-2 text-right font-bold text-blue-600">{d.수수료 > 0 ? `${d.수수료.toLocaleString()}만원` : '-'}</td>
                                                                <td className="py-2 px-2 text-right">{d.CPA > 0 ? `${d.CPA.toLocaleString()}만원` : '-'}</td>
                                                                <td className="py-2 px-2 text-right">{d.CPC > 0 ? `${d.CPC.toLocaleString()}만원` : '-'}</td>
                                                                <td className={`py-2 px-2 text-right font-bold ${d.ROAS >= 300 ? 'text-green-600 dark:text-green-400' : d.ROAS >= 100 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                    {d.ROAS > 0 ? `${d.ROAS}%` : '-'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="h-[250px] mt-4">
                                                <p className="text-xs text-gray-400 mb-2 font-medium">ROAS 비교 (광고수익률 %)</p>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={roiData.filter(d => d.광고비 > 0)}>
                                                        <defs>
                                                            <linearGradient id="roasGreen" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                                                                <stop offset="95%" stopColor="#10B981" stopOpacity={0.2} />
                                                            </linearGradient>
                                                            <linearGradient id="roasBlue" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.2} />
                                                            </linearGradient>
                                                            <linearGradient id="roasRed" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8} />
                                                                <stop offset="95%" stopColor="#EF4444" stopOpacity={0.2} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                                        <YAxis tick={{ fontSize: 11 }} />
                                                        <Tooltip formatter={(value: any) => `${value}%`} />
                                                        <Bar dataKey="ROAS" radius={[4, 4, 0, 0]}>
                                                            {roiData.filter(d => d.광고비 > 0).map((entry, i) => (
                                                                <Cell
                                                                    key={i}
                                                                    fill={entry.ROAS >= 300 ? 'url(#roasGreen)' : entry.ROAS >= 100 ? 'url(#roasBlue)' : 'url(#roasRed)'}
                                                                />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center py-8 text-gray-400">
                                            <DollarSign size={32} className="mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">광고비를 입력하면 ROI 분석이 표시됩니다.</p>
                                        </div>
                                    )}
                                </div>
                            </ChartSection>
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 3: PARTNER PERFORMANCE */}
                    {/* ========================================================================= */}
                    {activeTab === 'partners' && (
                        <div className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <ChartSection title="🏢 거래처별 성과 (접수 건수 vs 계약 건수)">
                                    <div className="h-[280px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={partnerData} layout="vertical">
                                                <defs>
                                                    <linearGradient id="partnerTotal" x1="0" y1="0" x2="1" y2="0">
                                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.2} />
                                                    </linearGradient>
                                                    <linearGradient id="partnerContract" x1="0" y1="0" x2="1" y2="0">
                                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.2} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                                                <XAxis type="number" tick={{ fontSize: 11 }} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                                                <Bar dataKey="건수" fill="url(#partnerTotal)" radius={[0, 4, 4, 0]} name="접수 건수" />
                                                <Bar dataKey="계약" fill="url(#partnerContract)" radius={[0, 4, 4, 0]} name="계약 건수" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </ChartSection>

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
                            </div>

                            <ChartSection title="🏆 거래처별 누적 매출 및 수임 성과 랭킹">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500">
                                                <th className="py-2 px-3">순위</th>
                                                <th className="py-2 px-3">거래처명</th>
                                                <th className="text-right py-2 px-3">케이스 (접수)</th>
                                                <th className="text-right py-2 px-3">계약 (전환)</th>
                                                <th className="text-right py-2 px-3">계약 전환율</th>
                                                <th className="text-right py-2 px-3 font-semibold text-purple-600">누적 수임료(매출)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {partnerRankingData.slice(0, 15).map((p, i) => (
                                                <tr key={i} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                    <td className="py-2 px-3 font-bold text-gray-400">{i + 1}</td>
                                                    <td className="py-2 px-3 font-semibold text-gray-800 dark:text-white">{p.name}</td>
                                                    <td className="py-2 px-3 text-right">{p.건수}건</td>
                                                    <td className="py-2 px-3 text-right text-green-600 font-semibold">{p.계약}건</td>
                                                    <td className="py-2 px-3 text-right font-medium">{p.전환율}%</td>
                                                    <td className="py-2 px-3 text-right font-bold text-purple-600 dark:text-purple-400">{p.금액.toLocaleString()}만원</td>
                                                </tr>
                                            ))}
                                            {partnerRankingData.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="text-center py-6 text-gray-400">조회된 거래처 성과 정보가 없습니다.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </ChartSection>
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 4: DROP-OFF ANALYSIS */}
                    {/* ========================================================================= */}
                    {activeTab === 'dropoffs' && (
                        <div className="space-y-6">
                            <ChartSection title={`⚠️ 이탈 요인 분석 (총 ${totalDropOff}건의 이탈)`}>
                                <div className="space-y-4">
                                    {totalDropOff > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <p className="text-xs text-gray-400 mb-2 font-medium">이탈 분류 사유 분포 (dropOffReason)</p>
                                                <div className="h-[250px]">
                                                    {dropOffReasonData.length > 0 ? (
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <RechartsPie>
                                                                <Pie
                                                                    data={dropOffReasonData}
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    innerRadius={45}
                                                                    outerRadius={80}
                                                                    dataKey="value"
                                                                    label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                                                                    labelLine={false}
                                                                >
                                                                    {dropOffReasonData.map((_, i) => (
                                                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip />
                                                                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '11px' }} />
                                                            </RechartsPie>
                                                        </ResponsiveContainer>
                                                    ) : (
                                                        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                                                            <p className="text-center">분류 사유 데이터가 없습니다.<br />이탈 처리 시 사유를 입력하면 집계됩니다.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-xs text-gray-400 mb-2 font-medium">단계별 이탈 직전 시점</p>
                                                <div className="h-[250px]">
                                                    {dropOffStageData.length > 0 ? (
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={dropOffStageData} layout="vertical">
                                                                <defs>
                                                                    <linearGradient id="dropStageGrad" x1="0" y1="0" x2="1" y2="0">
                                                                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8} />
                                                                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0.2} />
                                                                    </linearGradient>
                                                                </defs>
                                                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                                                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                                                                <Tooltip />
                                                                <Bar dataKey="value" fill="url(#dropStageGrad)" radius={[0, 4, 4, 0]} name="이탈 건수" />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    ) : (
                                                        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                                                            <p>이탈 단계 로그가 존재하지 않습니다.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-400 font-medium">
                                            <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">현재 필터 기간 내 고객취소/진행불가 건이 없습니다.</p>
                                        </div>
                                    )}
                                </div>
                            </ChartSection>

                            {/* Drop-off Customer Raw Feedback List */}
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 glass-panel">
                                <div className="mb-4">
                                    <h3 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                        <AlertTriangle size={18} className="text-red-500" />
                                        📁 이탈 고객 상세 피드백 목록 (직접 입력값 확인)
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-1">
                                        * 고객 이탈 처리 시 작성한 상세 내용 원문입니다. 분류 사유는 추후 표준 항목으로 자동 집계 연동됩니다.
                                    </p>
                                </div>
                                {dropOffCases.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500">
                                                    <th className="py-2 px-3">고객명</th>
                                                    <th className="py-2 px-3">구분</th>
                                                    <th className="py-2 px-3">유입경로</th>
                                                    <th className="py-2 px-3">최종 상태</th>
                                                    <th className="py-2 px-3">이탈 사유 (Reason)</th>
                                                    <th className="py-2 px-3">상세 내용 (Detail)</th>
                                                    <th className="text-right py-2 px-3">일자</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dropOffCases.map((c, idx) => (
                                                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                        <td className="py-2 px-3 font-semibold">
                                                            <Link to={`/case/${c.caseId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                                                {c.customerName}
                                                            </Link>
                                                        </td>
                                                        <td className="py-2 px-3 text-gray-500 text-xs">{c.caseType || '-'}</td>
                                                        <td className="py-2 px-3 text-gray-500 text-xs">{c.inboundPath || '-'}</td>
                                                        <td className="py-2 px-3">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${c.status === '고객취소' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400' : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
                                                                {c.status}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3 font-medium">
                                                            <span className="bg-gray-100 dark:bg-gray-700/80 px-2 py-0.5 rounded text-xs text-gray-800 dark:text-gray-200">
                                                                {c.dropOffReason || '미분류/직접입력'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3 text-gray-600 dark:text-gray-300 max-w-sm truncate" title={c.dropOffDetail || ''}>
                                                            {c.dropOffDetail || <span className="text-gray-400 italic">상세 내용 없음</span>}
                                                        </td>
                                                        <td className="py-2 px-3 text-right text-gray-400 text-xs">
                                                            {c.createdAt ? format(new Date(c.createdAt), 'yyyy-MM-dd') : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-400">
                                        필터 조건 하에 등록된 이탈 피드백이 없습니다.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
