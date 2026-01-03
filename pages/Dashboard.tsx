import React, { useEffect, useState } from 'react';
import { fetchCases, fetchPartners } from '../services/api';
import { Case, Partner, ReminderItem } from '../types';
import { getCaseWarnings, getReminderStatus, calculateNextSettlement } from '../utils';
import { Link } from 'react-router-dom';
import { AlertCircle, Calendar, PhoneCall, CheckCircle, Clock, Wallet } from 'lucide-react';
import { DEFAULT_STATUS_LIST } from '../constants';
import CalendarWidget from '../components/CalendarWidget';
import { MonthlyTrendChart, StatusPieChart } from '../components/DashboardCharts';
import { useTheme } from '../contexts/ThemeContext';

const KPICard = ({ title, count, color, icon: Icon, subText }: any) => (
  <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between transition-colors">
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${color}`}>{count}</p>
      {subText && <p className="text-xs text-gray-400 mt-1">{subText}</p>}
    </div>
    <div className={`p-3 rounded-full bg-gray-50 dark:bg-gray-700 ${color.replace('text', 'text-opacity-20')}`}>
      <Icon size={24} className={color} />
    </div>
  </div>
);

interface CaseListItemProps {
  c: Case;
  type: 'today' | 'overdue' | 'warning';
  reminder?: ReminderItem;
}

const CaseListItem: React.FC<CaseListItemProps> = ({ c, type, reminder }) => {
  let badgeColor = 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  let badgeText = c.status;

  if (type === 'overdue') badgeColor = 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
  if (type === 'today') badgeColor = 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
  if (type === 'warning') badgeColor = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';

  return (
    <Link to={`/case/${c.caseId}`} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800 dark:text-gray-100">{c.customerName}</span>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">{c.phone}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-1.5 py-0.5 rounded">{c.caseType || '-'}</span>
          {c.inboundPath && <span className="text-[10px] bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded">{c.inboundPath}</span>}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 flex gap-2">
          <span>{c.status}</span>
          {reminder && <span className={type === 'overdue' ? 'text-red-500 dark:text-red-400 font-medium' : ''}>📅 {reminder.datetime}</span>}
        </div>
      </div>
      <span className={`px-2 py-1 rounded text-xs font-medium ${badgeColor}`}>
        {type === 'overdue' ? '지연' : type === 'today' ? '오늘' : '확인'}
      </span>
    </Link>
  );
};

export default function Dashboard() {
  const { theme } = useTheme();
  const [cases, setCases] = useState<Case[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCases(), fetchPartners()]).then(([data, partnerData]) => {
      setCases(data);
      setPartners(partnerData);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-10 text-center text-gray-500">로딩중...</div>;

  // KPIs
  const allRemindersWithCase = cases.flatMap(c =>
    (c.reminders || []).map(r => ({ reminder: r, caseData: c }))
  );

  const todayReminders = allRemindersWithCase.filter(item => getReminderStatus(item.reminder.datetime) === 'today');
  const overdueReminders = allRemindersWithCase.filter(item => getReminderStatus(item.reminder.datetime) === 'overdue');

  // Warnings
  const warningCases = cases.filter(c => {
    const partner = partners.find(p => p.partnerId === c.partnerId);
    return getCaseWarnings(c, partner).length > 0;
  });

  // Next Settlement Calc
  let settlementInfo = null;
  if (partners.length > 0) {
    settlementInfo = calculateNextSettlement(cases, partners[0]);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">대시보드</h2>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="오늘 리마인더" count={todayReminders.length} color="text-blue-600" icon={PhoneCall} />
        <KPICard title="지연된 리마인더" count={overdueReminders.length} color="text-red-600" icon={Clock} />
        <KPICard title="조치 필요 (경고)" count={warningCases.length} color="text-yellow-600" icon={AlertCircle} />

        {/* Settlement Card */}
        {settlementInfo && (
          <KPICard
            title={settlementInfo.isEligible ? "지급 예정 수당" : "누적 입금액(미달성)"}
            count={settlementInfo.isEligible ? `${settlementInfo.expectedCommission.toLocaleString()}만원` : `${settlementInfo.currentTotalDeposit.toLocaleString()}만원`}
            color={settlementInfo.isEligible ? "text-green-600" : "text-gray-400"}
            icon={Wallet}
            subText={settlementInfo.isEligible ? `지급일: ${settlementInfo.payoutDate}` : `목표: ${settlementInfo.threshold}만원`}
          />
        )}
      </div>

      {/* Charts Section */}
      <div className="grid md:grid-cols-2 gap-6">
        <MonthlyTrendChart cases={cases} isDark={theme === 'dark'} />
        <StatusPieChart cases={cases} isDark={theme === 'dark'} />
      </div>

      {/* List Section (Today, Overdue, Warnings) */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Today's Calls */}
        {/* Today's Calls */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-blue-50 dark:bg-blue-900/20">
            <h3 className="font-semibold text-blue-800 flex items-center gap-2">
              <PhoneCall size={18} /> 오늘 연락 예정
            </h3>
            <span className="text-xs bg-white text-blue-600 px-2 py-0.5 rounded-full font-bold">{todayReminders.length}</span>
          </div>
          <div className="p-2">
            {todayReminders.length === 0 ? <p className="text-center text-gray-400 py-4 text-sm">일정이 없습니다.</p> :
              todayReminders.map(item => <CaseListItem key={item.reminder.id} c={item.caseData} reminder={item.reminder} type="today" />)}
          </div>
        </div>

        {/* Overdue Calls */}
        {/* Overdue Calls */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-red-50 dark:bg-red-900/20">
            <h3 className="font-semibold text-red-800 flex items-center gap-2">
              <Clock size={18} /> 오버듀 (연락지연)
            </h3>
            <span className="text-xs bg-white text-red-600 px-2 py-0.5 rounded-full font-bold">{overdueReminders.length}</span>
          </div>
          <div className="p-2">
            {overdueReminders.length === 0 ? <p className="text-center text-gray-400 py-4 text-sm">지연된 건이 없습니다.</p> :
              overdueReminders.map(item => <CaseListItem key={item.reminder.id} c={item.caseData} reminder={item.reminder} type="overdue" />)}
          </div>
        </div>

        {/* Missing Info / Warnings */}
        {/* Missing Info / Warnings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-yellow-50 dark:bg-yellow-900/20">
            <h3 className="font-semibold text-yellow-800 flex items-center gap-2">
              <AlertCircle size={18} /> 누락/경고
            </h3>
            <span className="text-xs bg-white text-yellow-600 px-2 py-0.5 rounded-full font-bold">{warningCases.length}</span>
          </div>
          <div className="p-2 max-h-80 overflow-y-auto no-scrollbar">
            {warningCases.length === 0 ? <p className="text-center text-gray-400 py-4 text-sm">완벽합니다!</p> :
              warningCases.map(c => <CaseListItem key={c.caseId} c={c} type="warning" />)}
          </div>
        </div>
      </div>

      {/* Calendar Section */}
      <div>
        <CalendarWidget cases={cases} />
      </div>
    </div >
  );
}