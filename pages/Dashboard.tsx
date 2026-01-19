import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fetchCases, fetchPartners } from '../services/api';
import { Case, Partner, ReminderItem } from '../types';
import { getCaseWarnings, getReminderStatus, calculateNextSettlement } from '../utils';
import { Link } from 'react-router-dom';
import { AlertCircle, Calendar, PhoneCall, CheckCircle, Clock, Wallet, Phone, Briefcase, MapPin, MoreHorizontal } from 'lucide-react';
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

  /* New: Dashboard State for Calendar Interactivity */
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    Promise.all([fetchCases(), fetchPartners()]).then(([data, partnerData]) => {
      setCases(data);
      setPartners(partnerData);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-10 text-center text-gray-500">로딩중...</div>;

  // KPIs (Summary)
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

  // Determine events for Selected Date
  // FIX: Use date-fns format to keep local date instead of UTC from toISOString()
  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedDayEvents = allRemindersWithCase.filter(item => {
    if (!item.reminder.datetime) return false;
    return item.reminder.datetime.startsWith(selectedDateStr);
  }).sort((a, b) => a.reminder.datetime.localeCompare(b.reminder.datetime));

  const formatDateTitle = (d: Date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]}) 일정`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-4 md:pb-0">
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

      {/* NEW: Today's Schedule Box (Replaces 3 Lists) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/20 flex justify-between items-center">
          <h3 className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
            <Calendar size={20} />
            {formatDateTitle(selectedDate)}
          </h3>
          <span className="text-xs bg-white text-indigo-600 px-3 py-1 rounded-full font-bold shadow-sm">
            {selectedDayEvents.length}
          </span>
        </div>

        <div className="p-4 min-h-[150px] max-h-[300px] overflow-y-auto">
          {selectedDayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-gray-400">
              <p>등록된 일정이 없습니다.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {selectedDayEvents.map((item, idx) => {
                const timeStr = item.reminder.datetime.split(' ')[1];
                const type = item.reminder.type || '통화'; // Fallback

                // Color coding based on Type
                let typeColor = 'bg-gray-100 text-gray-600';
                if (type === '통화') typeColor = 'bg-blue-100 text-blue-700';
                else if (type === '출장미팅') typeColor = 'bg-green-100 text-green-700';
                else if (type === '방문미팅') typeColor = 'bg-purple-100 text-purple-700';
                else if (type === '기타') typeColor = 'bg-gray-100 text-gray-700';

                return (
                  <Link
                    to={`/case/${item.caseData.caseId}`}
                    key={item.reminder.id}
                    className="block group bg-gray-50 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-indigo-200 rounded-lg p-3 transition-all shadow-sm hover:shadow-md"
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                      {/* Mobile Row 1: Time, Badge */}
                      <div className="flex md:hidden items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-lg font-bold text-gray-700 dark:text-gray-300">{timeStr}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${typeColor} whitespace-nowrap`}>{type}</span>
                      </div>

                      {/* Desktop Row: Standard Layout */}
                      <div className="hidden md:flex items-center gap-3 md:w-auto flex-shrink-0">
                        <span className="font-mono text-lg font-bold text-gray-700 dark:text-gray-300">{timeStr}</span>
                        {/* Icon added */}
                        <span title={type} className="flex items-center justify-center">
                          {type === '통화' && <Phone size={16} className="text-blue-600" />}
                          {type === '출장미팅' && <Briefcase size={16} className="text-green-600" />}
                          {type === '방문미팅' && <MapPin size={16} className="text-purple-600" />}
                          {type === '기타' && <MoreHorizontal size={16} className="text-gray-600" />}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${typeColor} whitespace-nowrap`}>{type}</span>
                      </div>

                      {/* Content Row (Name & Content) */}
                      <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-0.5 md:gap-3">
                        <span className={`font-bold whitespace-nowrap ${item.reminder.resultStatus === '완료' ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-white'}`}>
                          {item.caseData.customerName}
                        </span>
                        <span className="hidden md:inline text-gray-300">|</span>
                        <span className={`text-xs md:text-sm truncate block w-full md:w-auto ${item.reminder.resultStatus === '완료' ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          {item.reminder.content || '내용 없음'}
                        </span>
                      </div>

                      {/* Result & Note Display (Right on Desktop, Row 3 on Mobile) */}
                      {(item.reminder.resultStatus || item.reminder.resultNote) && (
                        <div className="md:ml-auto flex items-center gap-2 text-xs mt-1 md:mt-0 flex-shrink-0">
                          {item.reminder.resultStatus && (
                            <span className={`px-2 py-1 rounded font-bold whitespace-nowrap shadow-sm ${item.reminder.resultStatus === '완료' ? 'bg-green-100 text-green-700' :
                              item.reminder.resultStatus === '미연결' ? 'bg-red-100 text-red-700' :
                                item.reminder.resultStatus === '재예약' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-600'
                              }`}>
                              {item.reminder.resultStatus === '완료' && "✅ "}
                              {item.reminder.resultStatus === '미연결' && "📞 "}
                              {item.reminder.resultStatus === '재예약' && "🔄 "}
                              {item.reminder.resultStatus}
                            </span>
                          )}
                          {item.reminder.resultNote && (
                            <span className="text-gray-600 bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 truncate max-w-[200px] md:max-w-[300px]" title={item.reminder.resultNote}>
                              {item.reminder.resultNote}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Desktop Only: Detail Arrow */}
                      <div className="hidden md:block text-right whitespace-nowrap flex-shrink-0">
                        <span className="text-xs text-gray-400 group-hover:text-indigo-500 font-medium transition-colors">→</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Calendar Section - Connected */}
      <div>
        <CalendarWidget
          cases={cases}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
        />
      </div>
    </div >
  );
}