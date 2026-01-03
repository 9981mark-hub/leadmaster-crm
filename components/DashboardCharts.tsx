import React, { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Case } from '../types';

interface ChartProps {
    cases: Case[];
    isDark: boolean;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280'];

export const MonthlyTrendChart: React.FC<ChartProps> = ({ cases, isDark }) => {
    const data = useMemo(() => {
        const today = new Date();
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const date = subMonths(today, 5 - i);
            return {
                name: format(date, 'yyyy-MM'),
                start: startOfMonth(date),
                end: endOfMonth(date),
                count: 0
            };
        });

        cases.forEach(c => {
            if (!c.createdAt) return;
            const created = new Date(c.createdAt);
            const monthData = last6Months.find(m => isWithinInterval(created, { start: m.start, end: m.end }));
            if (monthData) {
                monthData.count++;
            }
        });

        return last6Months.map(m => ({
            name: format(m.start, 'MM월'),
            건수: m.count
        }));
    }, [cases]);

    return (
        <div className="h-[350px] w-full bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors flex flex-col">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">월별 신규 접수 추이</h3>
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{
                            top: 5,
                            right: 30,
                            left: 10,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                        <XAxis dataKey="name" stroke={isDark ? '#9CA3AF' : '#6B7280'} tick={{ fontSize: 12 }} />
                        <YAxis stroke={isDark ? '#9CA3AF' : '#6B7280'} tick={{ fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                                borderColor: isDark ? '#374151' : '#E5E7EB',
                                color: isDark ? '#F3F4F6' : '#111827'
                            }}
                        />
                        <Bar dataKey="건수" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export const StatusPieChart: React.FC<ChartProps> = ({ cases, isDark }) => {
    const data = useMemo(() => {
        const statusCounts: Record<string, number> = {};
        cases.forEach(c => {
            const status = c.status || '미분류';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        return Object.entries(statusCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value); // Sort by count desc
    }, [cases]);

    return (
        <div className="h-[350px] w-full bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors flex flex-col">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">진행 상태 분포</h3>
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ percent }) => (percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : '')} // Only show % inside if significant
                            labelLine={false}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                                borderColor: isDark ? '#374151' : '#E5E7EB',
                                color: isDark ? '#F3F4F6' : '#111827'
                            }}
                        />
                        <Legend
                            layout="vertical"
                            verticalAlign="middle"
                            align="right"
                            wrapperStyle={{
                                color: isDark ? '#D1D5DB' : '#374151',
                                fontSize: '12px'
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
