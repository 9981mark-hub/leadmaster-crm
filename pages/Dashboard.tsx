import React, { useEffect, useState, useMemo } from 'react';
import { format, parseISO, isSameDay, isToday, isBefore } from 'date-fns';
import { ko } from 'date-fns/locale';
import { fetchCases, fetchPartners, fetchSettlementBatches } from '../services/api';
import { Case, Partner, ReminderItem, SettlementBatch, CalendarEventType } from '../types';
import { getCaseWarnings, getReminderStatus, calculateNextSettlement } from '../utils';
import { Link } from 'react-router-dom';
import { AlertCircle, Calendar, PhoneCall, CheckCircle, Clock, Wallet, Phone, Briefcase, MapPin, MoreHorizontal, X, DollarSign, FileText, Bell } from 'lucide-react';
import { DEFAULT_STATUS_LIST } from '../constants';
import CalendarWidget from '../components/CalendarWidget';
import { MonthlyTrendChart, StatusPieChart } from '../components/DashboardCharts';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';
import { CardSkeleton } from '../components/Skeleton';

const KPICard = ({ title, count, color, icon: Icon, subText }: any) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className="glass-panel p-4 rounded-xl flex items-center justify-between transition-all h-full"
  >
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${color}`}>{count}</p>
      {subText && <p className="text-xs text-gray-400 mt-1">{subText}</p>}
    </div>
    <div className={`p-3 rounded-full bg-gray-50 dark:bg-gray-700 ${color.replace('text', 'text-opacity-20')}`}>
      <Icon size={24} className={color} />
    </div>
  </motion.div>
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
  const [batches, setBatches] = useState<SettlementBatch[]>([]);
  const [loading, setLoading] = useState(true);

  /* New: Dashboard State for Calendar Interactivity */
  const [selectedDate, setSelectedDate] = useState(new Date());

  /* [NEW] State for Overdue Reminders Modal */
  const [showOverdueModal, setShowOverdueModal] = useState(false);

  /* [NEW] State for Warning Cases Modal */
  const [showWarningModal, setShowWarningModal] = useState(false);

  useEffect(() => {
    Promise.all([fetchCases(), fetchPartners(), fetchSettlementBatches()]).then(([data, partnerData, batchData]) => {
      setCases(data);
      setPartners(partnerData);
      setBatches(batchData);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 pt-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="h-64 glass-panel rounded-xl"></div>
      </div>
    );
  }

  // [NEW] Missed call settings from localStorage
  const missedCallStatus = localStorage.getItem('lm_missedStatus') || '부재';
  const missedCallInterval = Number(localStorage.getItem('lm_missedInterval')) || 3;

  // [NEW] Calculate overdue missed call count (재통화 필요 건수)
  const overdueMissedCallCount = cases.filter(c => {
    if (c.status !== missedCallStatus) return false;
    if (!c.lastMissedCallAt) return false;
    const now = new Date().getTime();
    const lastCall = new Date(c.lastMissedCallAt).getTime();
    return (now - lastCall) > (missedCallInterval * 24 * 60 * 60 * 1000);
  }).length;

  // KPIs (Summary)
  const allRemindersWithCase = cases.flatMap(c =>
    (c.reminders || []).map(r => ({ reminder: r, caseData: c }))
  );

  const todayReminders = allRemindersWithCase.filter(item =>
    getReminderStatus(item.reminder.datetime) === 'today' &&
    // [FIX] Exclude completed reminders from count
    !item.reminder.resultStatus
  );
  const overdueReminders = allRemindersWithCase.filter(item =>
    getReminderStatus(item.reminder.datetime) === 'overdue' &&
    // [CHANGED] Any result status means it's been handled
    !item.reminder.resultStatus
  );

  // Warnings - with details
  const warningCasesWithDetails = cases.map(c => {
    const partner = partners.find(p => p.partnerId === c.partnerId);
    const warnings = getCaseWarnings(c, partner);
    return { caseData: c, warnings };
  }).filter(item => item.warnings.length > 0);

  const warningCases = warningCasesWithDetails.map(item => item.caseData);

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-7xl mx-auto pb-4 md:pb-0"
    >
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">대시보드</h2>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard title="오늘 리마인더" count={todayReminders.length} color="text-blue-600" icon={PhoneCall} />
        <div onClick={() => setShowOverdueModal(true)} className="cursor-pointer hover:scale-[1.02] transition-transform h-full">
          <KPICard title="지연된 리마인더" count={overdueReminders.length} color="text-red-600" icon={Clock} />
        </div>
        <div onClick={() => setShowWarningModal(true)} className="cursor-pointer hover:scale-[1.02] transition-transform h-full">
          <KPICard title="조치 필요 (경고)" count={warningCases.length} color="text-yellow-600" icon={AlertCircle} />
        </div>
        <Link to="/cases" onClick={() => sessionStorage.setItem('lm_showOverdueMissed', 'true')}>
          <KPICard title="재통화 필요" count={overdueMissedCallCount} color="text-orange-600" icon={Phone} subText={`${missedCallInterval}일 이상 경과`} />
        </Link>

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
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">영업 현황</h3>
          <Link
            to="/statistics"
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:underline"
          >
            📊 상세 통계 보기 →
          </Link>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <MonthlyTrendChart cases={cases} isDark={theme === 'dark'} />
          <StatusPieChart cases={cases} isDark={theme === 'dark'} />
        </div>
      </div>

      {/* NEW: Today's Schedule Box (Replaces 3 Lists) */}
      <div className="glass-panel rounded-xl">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-indigo-50/50 dark:bg-indigo-900/20 flex justify-between items-center rounded-t-xl">
          <h3 className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
            <Calendar size={20} />
            {formatDateTitle(selectedDate)}
          </h3>
          <span className="text-xs bg-white/80 backdrop-blur text-indigo-600 px-3 py-1 rounded-full font-bold shadow-sm">
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
                else if (type === '입금') typeColor = 'bg-emerald-100 text-emerald-700';
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
                          {type === '입금' && <Wallet size={16} className="text-emerald-600" />}
                          {type === '기타' && <MoreHorizontal size={16} className="text-gray-600" />}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${typeColor} whitespace-nowrap`}>{type}</span>
                      </div>

                      {/* Content Row (Name & Content) */}
                      <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-0.5 md:gap-3">
                        <span className={`font-bold whitespace-nowrap ${item.reminder.resultStatus ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-white'}`}>
                          {item.caseData.customerName}
                        </span>
                        <span className="hidden md:inline text-gray-300">|</span>
                        <span className={`text-xs md:text-sm truncate block w-full md:w-auto ${item.reminder.resultStatus ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
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

      {/* Today's Events Banner */}
      {(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const currentYear = new Date().getFullYear();

        // Tax schedules for today check
        const TAX_SCHEDULES = [
          { month: 1, day: 25, name: '부가세 확정신고' },
          { month: 2, day: 10, name: '원천세 납부' },
          { month: 3, day: 10, name: '원천세 납부' },
          { month: 4, day: 10, name: '원천세 납부' },
          { month: 4, day: 25, name: '부가세 예정신고' },
          { month: 5, day: 10, name: '원천세 납부' },
          { month: 5, day: 31, name: '종합소득세 신고' },
          { month: 6, day: 10, name: '원천세 납부' },
          { month: 7, day: 10, name: '원천세 납부' },
          { month: 7, day: 25, name: '부가세 확정신고' },
          { month: 8, day: 10, name: '원천세 납부' },
          { month: 9, day: 10, name: '원천세 납부' },
          { month: 10, day: 10, name: '원천세 납부' },
          { month: 10, day: 25, name: '부가세 예정신고' },
          { month: 11, day: 10, name: '원천세 납부' },
          { month: 12, day: 10, name: '원천세 납부' },
        ];

        const todayEvents: { type: CalendarEventType; title: string; time?: string; color: string }[] = [];

        // Reminders for today
        allRemindersWithCase.filter(item =>
          item.reminder.datetime?.startsWith(todayStr) && !item.reminder.resultStatus
        ).forEach(item => {
          todayEvents.push({
            type: 'reminder',
            title: `${item.caseData.customerName} (${item.reminder.type || '통화'})`,
            time: item.reminder.datetime?.split(' ')[1],
            color: 'blue'
          });
        });

        // Settlement events for today
        batches.forEach(b => {
          if (b.collectionInfo?.collectedAt?.startsWith(todayStr)) {
            todayEvents.push({ type: 'settlement', title: `수금 ${b.totalCommission}만원`, color: 'green' });
          }
          (b.payoutItems || []).forEach(p => {
            if (p.paidAt?.startsWith(todayStr)) {
              todayEvents.push({ type: 'settlement', title: `지급 ${p.amount}만원`, color: 'orange' });
            }
          });
        });

        // Tax events for today
        const today = new Date();
        TAX_SCHEDULES.forEach(s => {
          if (today.getMonth() + 1 === s.month && today.getDate() === s.day) {
            todayEvents.push({ type: 'tax', title: s.name, color: 'red' });
          }
        });

        if (todayEvents.length === 0) return null;

        return (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-4 text-white shadow-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell size={20} />
                <span className="font-bold text-lg">오늘의 일정</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm font-bold">
                  {todayEvents.length}건
                </span>
              </div>
              <span className="text-sm opacity-80">
                {format(new Date(), 'M월 d일 (E)', { locale: ko })}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {todayEvents.slice(0, 5).map((ev, idx) => (
                <div
                  key={idx}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${ev.type === 'reminder' ? 'bg-blue-400/30' :
                    ev.type === 'settlement' ? 'bg-green-400/30' :
                      ev.type === 'tax' ? 'bg-red-400/30' : 'bg-purple-400/30'
                    }`}
                >
                  {ev.type === 'reminder' && <Phone size={14} />}
                  {ev.type === 'settlement' && <DollarSign size={14} />}
                  {ev.type === 'tax' && <FileText size={14} />}
                  {ev.time && <span className="font-mono">{ev.time}</span>}
                  <span>{ev.title}</span>
                </div>
              ))}
              {todayEvents.length > 5 && (
                <span className="text-sm opacity-70">+{todayEvents.length - 5}개 더</span>
              )}
            </div>
          </motion.div>
        );
      })()}

      {/* Calendar Section - Connected with Batches */}
      <div>
        <CalendarWidget
          cases={cases}
          batches={batches}
          partners={partners}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
        />
      </div>

      {/* [NEW] Overdue Reminders Modal */}
      {showOverdueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowOverdueModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20 rounded-t-xl">
              <h3 className="font-bold text-red-800 dark:text-red-300 flex items-center gap-2">
                <Clock size={20} />
                지연된 리마인더 ({overdueReminders.length}건)
              </h3>
              <button onClick={() => setShowOverdueModal(false)} className="p-1 hover:bg-red-100 dark:hover:bg-red-800 rounded-full transition-colors">
                <X size={20} className="text-red-600 dark:text-red-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {overdueReminders.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  지연된 리마인더가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {overdueReminders.map(item => (
                    <Link
                      key={item.reminder.id}
                      to={`/case/${item.caseData.caseId}`}
                      onClick={() => setShowOverdueModal(false)}
                      className="block p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg border border-gray-100 dark:border-gray-600 hover:border-red-200 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 dark:text-white">{item.caseData.customerName}</span>
                            <span className="text-xs text-gray-400">|</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">{item.caseData.phone}</span>
                          </div>
                          <div className="text-xs text-red-500 dark:text-red-400 mt-1 font-medium">
                            📅 {item.reminder.datetime}
                          </div>
                          {item.reminder.content && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate max-w-[300px]">
                              {item.reminder.content}
                            </div>
                          )}
                        </div>
                        <span className="text-xs bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 px-2 py-1 rounded font-bold">
                          지연
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* [NEW] Warning Cases Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowWarningModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20 rounded-t-xl">
              <h3 className="font-bold text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                <AlertCircle size={20} />
                조치 필요 케이스 ({warningCases.length}건)
              </h3>
              <button onClick={() => setShowWarningModal(false)} className="p-1 hover:bg-yellow-100 dark:hover:bg-yellow-800 rounded-full transition-colors">
                <X size={20} className="text-yellow-600 dark:text-yellow-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {warningCasesWithDetails.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  조치가 필요한 케이스가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {warningCasesWithDetails.map(item => (
                    <Link
                      key={item.caseData.caseId}
                      to={`/case/${item.caseData.caseId}`}
                      onClick={() => setShowWarningModal(false)}
                      className="block p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg border border-gray-100 dark:border-gray-600 hover:border-yellow-200 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 dark:text-white">{item.caseData.customerName}</span>
                            <span className="text-xs text-gray-400">|</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">{item.caseData.phone}</span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {item.caseData.status}
                          </div>
                          {/* Warning Tags */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.warnings.map((warning, idx) => (
                              <span key={idx} className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400 px-2 py-0.5 rounded font-medium">
                                ⚠ {warning}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 mt-1">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div >
  );
}