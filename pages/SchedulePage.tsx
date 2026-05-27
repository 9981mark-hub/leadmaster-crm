import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, addDays, subDays, isSameDay, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, MapPin, Phone, Wallet, Briefcase, 
  MessageSquare, MoreHorizontal, ChevronLeft, ChevronRight, 
  Filter, ChevronDown, ChevronUp, CheckCircle, Search, 
  RefreshCw, CheckSquare, Square, AlertCircle, FileText
} from 'lucide-react';
import { useCases, useUpdateCaseMutation, useStatuses } from '../services/queries';
import { CaseDetailReminders } from '../components/case-detail/info/CaseDetailReminders';
import CallConfirmPopup from '../components/CallConfirmPopup';
import { useToast } from '../contexts/ToastContext';
import { useActiveCall } from '../contexts/ActiveCallContext';
import { Case, ReminderItem } from '../types';

type SortOption = 'time_asc' | 'createdAt_desc' | 'updatedAt_desc';

const DROP_OFF_STATUSES = ['고객취소', '진행불가'];
const DROP_OFF_REASONS = ['비용 부담', '타 사무소 선택', '연락 두절', '자격 미달', '본인 의사 취소', '시기 미정', '기타'];
const ALL_TYPES = ['통화', '출장미팅', '방문미팅', '입금', '문자', '기타'];

export default function SchedulePage() {
  const { data: cases = [], isLoading } = useCases();
  const updateCaseMutation = useUpdateCaseMutation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { startCall } = useActiveCall(); // Keep for dependency hook consistency
  
  const { data: statuses = [] } = useStatuses();
  
  // State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCompleted, setShowCompleted] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(ALL_TYPES);
  const [sortOrder, setSortOrder] = useState<SortOption>('time_asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Accordion state
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Drop-off Modal State
  const [isDropOffModalOpen, setIsDropOffModalOpen] = useState(false);
  const [dropOffCaseId, setDropOffCaseId] = useState<string>('');
  const [dropOffNewStatus, setDropOffNewStatus] = useState<string>('');
  const [dropOffOldStatus, setDropOffOldStatus] = useState<string>('');
  const [dropOffReason, setDropOffReason] = useState<string>('');
  const [dropOffDetail, setDropOffDetail] = useState<string>('');

  // Call Confirm State
  const [callTarget, setCallTarget] = useState<{ name: string; phone: string } | null>(null);

  // --- 주간 캘린더 날짜 바 계산 ---
  const weekStart = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]); // 월요일 시작
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const handlePrevWeek = () => {
    setSelectedDate(prev => subDays(prev, 7));
    setCurrentPage(1);
  };

  const handleNextWeek = () => {
    setSelectedDate(prev => addDays(prev, 7));
    setCurrentPage(1);
  };

  const handleGoToday = () => {
    setSelectedDate(new Date());
    setCurrentPage(1);
  };

  // --- 날짜별 일정 개수 사전 계산 ---
  const weekDaysReminderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    cases.forEach(c => {
      if (c.status === '휴지통' || c.deletedAt) return;
      (c.reminders || []).forEach(r => {
        if (!r.datetime) return;
        const dateStr = r.datetime.split(' ')[0];
        counts[dateStr] = (counts[dateStr] || 0) + 1;
      });
    });
    return counts;
  }, [cases]);

  // --- 오늘의 지표 요약 계산 ---
  const selectedDateStats = useMemo(() => {
    let total = 0;
    let pending = 0;
    let completed = 0;
    let overdue = 0;
    
    const nowStr = format(new Date(), 'yyyy-MM-dd HH:mm');
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    
    cases.forEach(c => {
      if (c.status === '휴지통' || c.deletedAt) return;
      (c.reminders || []).forEach(r => {
        if (!r.datetime) return;
        const reminderDateStr = r.datetime.split(' ')[0];
        if (reminderDateStr !== selectedDateStr) return;
        
        total++;
        if (r.resultStatus) {
          completed++;
        } else {
          pending++;
          // 지연 상태 판단: 미완료 리마인더가 현재 시간보다 과거인 경우
          if (r.datetime < nowStr) {
            overdue++;
          }
        }
      });
    });
    
    return { total, pending, completed, overdue };
  }, [cases, selectedDate]);

  // --- 연락처 클릭 링커 ---
  const handlePhoneClick = (e: React.MouseEvent, customerName: string, phone: string) => {
    e.preventDefault();
    e.stopPropagation();
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `tel:${phone.replace(/[^0-9+]/g, '')}`;
      return;
    }
    setCallTarget({ name: customerName, phone });
  };

  const handleCallConfirm = () => {
    setCallTarget(null);
  };

  // --- 인라인 일정 완료 토글 처리 ---
  const handleToggleReminderComplete = async (e: React.MouseEvent, caseId: string, reminderId: string) => {
    e.stopPropagation(); // 카드 상세페이지 이동 차단
    
    const targetCase = cases.find(c => c.caseId === caseId);
    if (!targetCase) return;
    
    const updatedReminders = (targetCase.reminders || []).map(r => {
      if (r.id === reminderId) {
        return {
          ...r,
          resultStatus: r.resultStatus ? undefined : '완료',
          resultNote: r.resultStatus ? undefined : '오늘의 일정 목록에서 인라인 완료 처리됨'
        };
      }
      return r;
    });
    
    try {
      await updateCaseMutation.mutateAsync({
        id: caseId,
        updates: { reminders: updatedReminders }
      });
      
      const isCompleted = updatedReminders.find(r => r.id === reminderId)?.resultStatus === '완료';
      showToast(isCompleted ? '일정이 완료 처리되었습니다.' : '일정 완료 처리가 취소되었습니다.');
    } catch (err) {
      showToast('일정 상태 변경에 실패했습니다.', 'error');
    }
  };

  // --- CRM 퀵 상태 변경 및 이탈 모달 연동 ---
  const handleQuickStatusChange = async (caseId: string, newStatus: string, oldStatus: string) => {
    if (newStatus === oldStatus) return;
    
    if (DROP_OFF_STATUSES.includes(newStatus)) {
      setDropOffCaseId(caseId);
      setDropOffNewStatus(newStatus);
      setDropOffOldStatus(oldStatus);
      setDropOffReason('');
      setDropOffDetail('');
      setIsDropOffModalOpen(true);
      return;
    }

    const now = new Date().toISOString();
    updateCaseMutation.mutate({ 
      id: caseId, 
      updates: { status: newStatus, statusUpdatedAt: now } 
    });
    showToast(`상태가 "${newStatus}"(으)로 변경되었습니다.`);
  };

  const confirmDropOffStatusChange = () => {
    if (!dropOffReason) {
      showToast('이탈 사유를 선택해주세요.', 'error');
      return;
    }
    const now = new Date().toISOString();
    const log = {
      logId: Date.now().toString(),
      fromStatus: dropOffOldStatus,
      toStatus: dropOffNewStatus,
      changedAt: now,
      changedBy: 'User',
      memo: `[이탈사유: ${dropOffReason}] ${dropOffDetail}`.trim()
    };
    
    const targetCase = cases.find(c => c.caseId === dropOffCaseId);
    
    updateCaseMutation.mutate({
      id: dropOffCaseId,
      updates: {
        status: dropOffNewStatus,
        statusUpdatedAt: now,
        statusLogs: [log, ...(targetCase?.statusLogs || [])],
        dropOffReason: dropOffReason,
        dropOffDetail: dropOffDetail || undefined,
      }
    });
    showToast(`상태가 "${dropOffNewStatus}"(으)로 변경되었습니다.`);
    setIsDropOffModalOpen(false);
  };

  // --- 요일 텍스트 색상 결정 (토요일 파랑, 일요일 빨강) ---
  const getDayColor = (day: Date, isSelected: boolean) => {
    if (isSelected) return 'text-white';
    const dayOfWeek = day.getDay();
    if (dayOfWeek === 0) return 'text-red-500 dark:text-red-400';
    if (dayOfWeek === 6) return 'text-blue-500 dark:text-blue-400';
    return 'text-gray-700 dark:text-gray-200';
  };

  const getDayNameColor = (day: Date, isSelected: boolean) => {
    if (isSelected) return 'text-white/80';
    const dayOfWeek = day.getDay();
    if (dayOfWeek === 0) return 'text-red-400/80';
    if (dayOfWeek === 6) return 'text-blue-400/80';
    return 'text-gray-400 dark:text-gray-500';
  };

  // --- 복합 일정 가공 (필터링, 검색, 정렬) ---
  const filteredReminders = useMemo(() => {
    const allReminders: { reminder: ReminderItem; caseData: Case }[] = [];
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    
    cases.forEach(c => {
      if (c.status === '휴지통' || c.deletedAt) return;
      
      (c.reminders || []).forEach(r => {
        if (!r.datetime) return;
        const dateStr = r.datetime.split(' ')[0];
        if (dateStr !== selectedDateStr) return;
        
        // 완료 여부 필터
        if (r.resultStatus && !showCompleted) return;
        
        // 일정 종류 필터
        const type = r.type || '통화';
        if (!selectedTypes.includes(type)) return;

        // 검색어 필터 (고객명, 연락처, 일정 메모)
        const q = searchQuery.toLowerCase().trim();
        if (q) {
          const nameMatch = c.customerName?.toLowerCase().includes(q);
          const phoneMatch = c.phone?.replace(/-/g, '').includes(q.replace(/-/g, ''));
          const memoMatch = r.content?.toLowerCase().includes(q);
          if (!nameMatch && !phoneMatch && !memoMatch) return;
        }

        allReminders.push({ reminder: r, caseData: c });
      });
    });

    // 정렬
    return allReminders.sort((a, b) => {
      if (sortOrder === 'time_asc') {
        const timeA = a.reminder.datetime?.split(' ')[1] || '23:59';
        const timeB = b.reminder.datetime?.split(' ')[1] || '23:59';
        return timeA.localeCompare(timeB);
      } else if (sortOrder === 'createdAt_desc') {
        const timeA = new Date(a.caseData.createdAt || 0).getTime();
        const timeB = new Date(b.caseData.createdAt || 0).getTime();
        return timeB - timeA;
      } else if (sortOrder === 'updatedAt_desc') {
        const timeA = new Date(a.caseData.updatedAt || 0).getTime();
        const timeB = new Date(b.caseData.updatedAt || 0).getTime();
        return timeB - timeA;
      }
      return 0;
    });
  }, [cases, selectedDate, showCompleted, selectedTypes, searchQuery, sortOrder]);

  // --- 가장 가까운 지연되지 않은 다음 일정 하이라이트 아이디 계산 ---
  const nextReminderId = useMemo(() => {
    if (!isToday(selectedDate)) return null;
    const nowStr = format(new Date(), 'HH:mm');
    const upcoming = filteredReminders.filter(item => {
      if (item.reminder.resultStatus) return false;
      const time = item.reminder.datetime?.split(' ')[1] || '';
      return time >= nowStr;
    });
    return upcoming.length > 0 ? upcoming[0].reminder.id : null;
  }, [filteredReminders, selectedDate]);

  // 페이지네이션
  const totalItems = filteredReminders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const currentItems = filteredReminders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleTypeFilter = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* 1. 상단 타이틀 영역 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Calendar className="text-indigo-500" />
            일정 스케줄러
            <span className="text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
              총 {totalItems}건
            </span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {format(selectedDate, 'yyyy년 M월 d일 eeee', { locale: ko })}
            {isToday(selectedDate) && <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded">오늘</span>}
          </p>
        </div>

        {/* 정렬 셀렉터 */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <Filter size={14} className="text-gray-400" />
          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value as SortOption);
              setCurrentPage(1);
            }}
            className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-md text-xs font-medium text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            <option value="time_asc">일정 시간순</option>
            <option value="createdAt_desc">최근 등록순</option>
            <option value="updatedAt_desc">최근 수정순</option>
          </select>
        </div>
      </div>

      {/* 2. 오늘의 지표 위젯 (Stats Widget Row) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-panel p-4 bg-white/40 dark:bg-gray-800/40 rounded-2xl flex flex-col justify-between hover:scale-[1.02] transition-transform duration-200">
          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">전체 일정</span>
          <span className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{selectedDateStats.total}건</span>
        </div>
        <div className="glass-panel p-4 bg-white/40 dark:bg-gray-800/40 rounded-2xl flex flex-col justify-between hover:scale-[1.02] transition-transform duration-200">
          <span className="text-xs font-bold text-blue-400 dark:text-blue-500 uppercase">진행 대기</span>
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{selectedDateStats.pending}건</span>
        </div>
        <div className="glass-panel p-4 bg-white/40 dark:bg-gray-800/40 rounded-2xl flex flex-col justify-between hover:scale-[1.02] transition-transform duration-200">
          <span className="text-xs font-bold text-emerald-400 dark:text-emerald-500 uppercase">완료함</span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{selectedDateStats.completed}건</span>
        </div>
        <div className="glass-panel p-4 bg-white/40 dark:bg-gray-800/40 rounded-2xl flex flex-col justify-between hover:scale-[1.02] transition-transform duration-200 border-l-4 border-red-500/50">
          <span className="text-xs font-bold text-red-400 dark:text-red-500 uppercase">미처리 지연</span>
          <span className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{selectedDateStats.overdue}건</span>
        </div>
      </div>

      {/* 3. 주간 수평 캘린더 리본 (Weekly Calendar Ribbon) */}
      <div className="glass-panel p-3 bg-white/50 dark:bg-gray-800/50 rounded-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button 
            onClick={handlePrevWeek}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-300"
            title="이전 주"
          >
            <ChevronLeft size={18} />
          </button>
          
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
            {format(weekStart, 'yyyy년 M월')}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleGoToday}
              className="px-2.5 py-1 text-xs font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
            >
              오늘
            </button>
            <button 
              onClick={handleNextWeek}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-300"
              title="다음 주"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* 주간 7일 탭 */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day, idx) => {
            const isSelected = isSameDay(day, selectedDate);
            const dateStr = format(day, 'yyyy-MM-dd');
            const reminderCount = weekDaysReminderCounts[dateStr] || 0;
            const isTodayDay = isToday(day);

            return (
              <button
                key={idx}
                onClick={() => {
                  setSelectedDate(day);
                  setCurrentPage(1);
                }}
                className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all relative ${
                  isSelected 
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-100 dark:shadow-none' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                {/* 요일 */}
                <span className={`text-[10px] font-bold ${getDayNameColor(day, isSelected)}`}>
                  {format(day, 'E', { locale: ko })}
                </span>
                {/* 날짜 */}
                <span className={`text-sm font-bold ${getDayColor(day, isSelected)}`}>
                  {format(day, 'd')}
                </span>
                
                {/* 미니 개수 표시 배지 */}
                {reminderCount > 0 && (
                  <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-indigo-500'
                  }`} />
                )}

                {/* 오늘 표시 밑줄 */}
                {isTodayDay && (
                  <span className={`absolute bottom-1 w-3 h-0.5 rounded-full ${
                    isSelected ? 'bg-white/80' : 'bg-indigo-500'
                  }`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. 검색창 및 필터 패널 */}
      <div className="glass-panel p-4 bg-white/40 dark:bg-gray-800/40 rounded-2xl space-y-3">
        {/* 검색 인풋 */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="고객명, 연락처 또는 메모 내용으로 검색..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-md text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        {/* 유형 필터 칩스 & 완료 토글 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* 타입 칩 목록 */}
          <div className="flex flex-wrap gap-1.5">
            {ALL_TYPES.map(type => {
              const isActive = selectedTypes.includes(type);
              let typeColor = 'hover:border-gray-400 dark:hover:border-gray-500';
              if (isActive) {
                if (type === '통화') typeColor = 'bg-blue-500 border-blue-500 text-white';
                else if (type === '출장미팅') typeColor = 'bg-green-500 border-green-500 text-white';
                else if (type === '방문미팅') typeColor = 'bg-purple-500 border-purple-500 text-white';
                else if (type === '입금') typeColor = 'bg-emerald-500 border-emerald-500 text-white';
                else if (type === '문자') typeColor = 'bg-cyan-500 border-cyan-500 text-white';
                else typeColor = 'bg-gray-600 border-gray-600 text-white';
              }
              return (
                <button
                  key={type}
                  onClick={() => toggleTypeFilter(type)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                    !isActive 
                      ? 'bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400' 
                      : ''
                  } ${typeColor}`}
                >
                  {type}
                </button>
              );
            })}
          </div>

          {/* 완료된 일정 포함 여부 토글 */}
          <label className="flex items-center gap-2 cursor-pointer self-end sm:self-center select-none text-xs font-semibold text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => {
                setShowCompleted(e.target.checked);
                setCurrentPage(1);
              }}
              className="sr-only peer"
            />
            <span>완료된 일정 포함</span>
            <div className="relative w-7 h-4 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      {/* 5. 타임라인 목록 영역 */}
      <div className="space-y-4 relative pl-0 sm:pl-6">
        
        {/* 데스크탑 세로 타임라인 라인 */}
        {currentItems.length > 0 && (
          <div className="hidden sm:block absolute left-2.5 top-5 bottom-5 w-[2px] bg-gradient-to-b from-indigo-300 via-purple-300 to-indigo-100 dark:from-indigo-900 dark:via-purple-900 dark:to-gray-800 border-dashed border-l-[1.5px] border-indigo-200 dark:border-indigo-900" />
        )}

        <AnimatePresence mode="popLayout">
          {currentItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-panel p-12 text-center text-gray-500 dark:text-gray-400 rounded-2xl"
            >
              선택한 필터 범위 내에 일치하는 일정이 없습니다.
            </motion.div>
          ) : (
            currentItems.map((item, idx) => {
              const timeStr = item.reminder.datetime?.split(' ')[1] || '시간 미지정';
              const type = item.reminder.type || '통화';
              const isCompleted = !!item.reminder.resultStatus;
              const isNext = item.reminder.id === nextReminderId;
              
              let typeColor = 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
              if (type === '통화') typeColor = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50';
              else if (type === '출장미팅') typeColor = 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/50';
              else if (type === '방문미팅') typeColor = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/50';
              else if (type === '입금') typeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50';
              else if (type === '문자') typeColor = 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/50';

              const isExpanded = expandedCardId === item.reminder.id;

              return (
                <motion.div
                  key={`${item.reminder.id}-${idx}`}
                  layoutId={item.reminder.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className={`group relative glass-panel bg-white/70 dark:bg-gray-800/70 hover:shadow-lg transition-all rounded-2xl border ${
                    isCompleted 
                      ? 'opacity-65 grayscale-[30%] border-gray-100 dark:border-gray-800' 
                      : isNext 
                        ? 'border-indigo-400 shadow-md shadow-indigo-50/50 dark:shadow-none ring-2 ring-indigo-500/10' 
                        : 'border-transparent hover:border-indigo-300 dark:hover:border-indigo-800'
                  }`}
                >
                  {/* 데스크탑 타임라인 원형 노드 */}
                  <span className={`hidden sm:block absolute -left-[28px] top-6 w-4.5 h-4.5 rounded-full border-2 bg-white dark:bg-gray-800 transition-all ${
                    isCompleted 
                      ? 'border-gray-300 dark:border-gray-700' 
                      : isNext 
                        ? 'border-indigo-500 ring-4 ring-indigo-500/10 scale-110' 
                        : 'border-indigo-300 dark:border-indigo-700 group-hover:border-indigo-500'
                  }`} />

                  {/* 활성 플로우 하이라이트 배지 */}
                  {isNext && (
                    <span className="absolute top-0 left-4 -translate-y-1/2 text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-sm">
                      Next up
                    </span>
                  )}

                  {/* 카드 헤더 및 간편 완료 체크박스 */}
                  <div className="p-4 flex items-start gap-3">
                    
                    {/* 인라인 완료 체크 박스 */}
                    <button
                      onClick={(e) => handleToggleReminderComplete(e, item.caseData.caseId, item.reminder.id)}
                      className="mt-1 text-gray-300 hover:text-indigo-500 dark:text-gray-600 dark:hover:text-indigo-400 transition-colors"
                      title={isCompleted ? '진행 상태로 변경' : '일정 완료 처리'}
                    >
                      {isCompleted ? (
                        <CheckSquare className="text-indigo-500 dark:text-indigo-400" size={19} />
                      ) : (
                        <Square size={19} />
                      )}
                    </button>

                    {/* 본체 */}
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(`/case/${item.caseData.caseId}`)}
                    >
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        {/* 시간 정보 */}
                        <div className="flex items-center gap-3 md:w-32 flex-shrink-0">
                          <div className="font-mono text-base font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                            <Clock size={15} className="text-gray-400" />
                            {timeStr}
                          </div>
                          
                          <div className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold border flex items-center gap-1 ${typeColor}`}>
                            {type}
                          </div>
                        </div>

                        {/* 이름 및 연락처 */}
                        <div className="flex-1 flex flex-wrap items-center gap-2">
                          <span className={`font-bold text-base text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors ${
                            isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : ''
                          }`}>
                            {item.caseData.customerName}
                          </span>
                          
                          <button
                            onClick={(e) => handlePhoneClick(e, item.caseData.customerName, item.caseData.phone)}
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline active:text-blue-800 transition-colors"
                          >
                            {item.caseData.phone}
                          </button>

                          {/* 상태 드롭다운 */}
                          <select
                            className="text-[10px] bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 outline-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            value={item.caseData.status}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleQuickStatusChange(item.caseData.caseId, e.target.value, item.caseData.status);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {statuses.filter(s => s !== '휴지통').map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        {/* 수정일/등록일 (Desktop) */}
                        <div className="hidden md:block text-right text-[10px] text-gray-400">
                          <div>등록: {format(new Date(item.caseData.createdAt || 0), 'MM-dd')}</div>
                          <div>수정: {format(new Date(item.caseData.updatedAt || 0), 'MM-dd')}</div>
                        </div>
                      </div>

                      {/* 메모 내용 */}
                      <p className={`text-gray-600 dark:text-gray-400 text-xs mt-2 break-all ${
                        isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : ''
                      }`}>
                        {item.reminder.content || '내용 없음'}
                      </p>
                    </div>
                  </div>

                  {/* 퀵 아코디언 버튼 */}
                  <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 flex justify-center">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setExpandedCardId(isExpanded ? null : item.reminder.id); 
                      }}
                      className="w-full py-1.5 flex items-center justify-center gap-1 text-[11px] font-bold text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors rounded-b-2xl"
                    >
                      {isExpanded ? (
                        <><ChevronUp size={14} /> 접기</>
                      ) : (
                        <><ChevronDown size={14} /> 일정 메모 및 상담 상세 이력 펼쳐보기</>
                      )}
                    </button>
                  </div>

                  {/* 아코디언 상세 정보 (Framer Motion 확장) */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                        className="border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden rounded-b-2xl"
                      >
                        <div className="p-4 space-y-4">
                          {/* 사전 정보 */}
                          <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                              <FileText size={14} className="text-blue-500" />
                              사전 인바운드 접수 정보
                            </h4>
                            <div className={`text-xs ${!item.caseData.preInfo ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                              {item.caseData.preInfo ? item.caseData.preInfo.split(/\s\/\s|\n/).filter((line: string) => {
                                  const lower = line.toLowerCase();
                                  return !lower.includes('[referrer]') &&
                                      !lower.includes('[marketing_consent]') &&
                                      !lower.includes('[third_party_consent]') &&
                                      !lower.includes('[user_agent]') &&
                                      line.trim() !== '';
                              }).map((line: string, idx: number) => {
                                  const trimmed = line.trim();
                                  const colonIdx = trimmed.indexOf(':');
                                  if (colonIdx > 0 && colonIdx < trimmed.length - 1) {
                                      const label = trimmed.substring(0, colonIdx).trim();
                                      const value = trimmed.substring(colonIdx + 1).trim();
                                      return (
                                          <div key={idx} className="flex items-start gap-1.5 mb-1.5 last:mb-0">
                                              <span className="text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap min-w-[65px]">{label}:</span>
                                              <span className="text-gray-800 dark:text-gray-200">{value}</span>
                                          </div>
                                      );
                                  }
                                  return (
                                      <div key={idx} className="flex items-start gap-1.5 mb-1.5 last:mb-0">
                                          <span className="text-blue-500 font-bold mt-0.5">•</span>
                                          <span className="text-gray-800 dark:text-gray-200">{trimmed}</span>
                                      </div>
                                  );
                              }) : <span className="italic text-gray-400">사전 정보가 등록되어 있지 않습니다.</span>}
                            </div>
                          </div>

                          {/* 리마인더 & 메모 타일 컴포넌트 */}
                          <CaseDetailReminders
                            reminders={item.caseData.reminders || []}
                            memos={item.caseData.specialMemo || []}
                            onUpdateReminders={(newReminders) => {
                              updateCaseMutation.mutate({ id: item.caseData.caseId, updates: { reminders: newReminders } });
                            }}
                            onUpdateMemos={(newMemos) => {
                              updateCaseMutation.mutate({ id: item.caseData.caseId, updates: { specialMemo: newMemos } });
                            }}
                            showToast={showToast}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* 6. 페이지네이션 (Pagination) */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 text-gray-500 dark:text-gray-300 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 text-gray-500 dark:text-gray-300 disabled:opacity-40 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* 7. 이탈 사유 입력 모달 */}
      {isDropOffModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-[440px] shadow-2xl border-t-4 border-red-500 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-4 text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={20} />
              상담 중단(이탈) 확인
            </h3>
            <p className="mb-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              상태를 <span className="font-bold text-indigo-600 dark:text-indigo-400">{dropOffOldStatus}</span>에서{' '}
              <span className="font-bold text-red-600 dark:text-red-400">{dropOffNewStatus}</span>(으)로 변경하시겠습니까?
            </p>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                이탈 사유 <span className="text-red-500">*필수</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DROP_OFF_REASONS.map(reason => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setDropOffReason(reason)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      dropOffReason === reason
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-red-400 hover:text-red-600'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">상세 피드백 (선택)</label>
              <textarea
                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 resize-none h-20 focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="상담 중단 사유를 구체적으로 남겨주세요..."
                value={dropOffDetail}
                onChange={e => setDropOffDetail(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDropOffModalOpen(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-gray-800 dark:text-gray-300 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-650 transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmDropOffStatusChange}
                className="px-4 py-2 bg-red-600 rounded-xl text-white text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                중단 처리
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. 호환성 전화 아웃바운드 팝업 */}
      <CallConfirmPopup
        isOpen={!!callTarget}
        customerName={callTarget?.name || ''}
        phoneNumber={callTarget?.phone || ''}
        onConfirm={handleCallConfirm}
        onCancel={() => setCallTarget(null)}
      />
    </div>
  );
}
