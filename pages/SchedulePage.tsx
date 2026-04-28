import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Phone, Wallet, Briefcase, MessageSquare, MoreHorizontal, ChevronLeft, ChevronRight, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { useCases, useUpdateCaseMutation } from '../services/queries';
import { CaseDetailReminders } from '../components/case-detail/info/CaseDetailReminders';
import { useToast } from '../contexts/ToastContext';
import { Case, ReminderItem } from '../types';
import { getReminderStatus } from '../utils';

type SortOption = 'time_asc' | 'createdAt_desc' | 'updatedAt_desc';

export default function SchedulePage() {
  const { data: cases = [], isLoading } = useCases();
  const updateCaseMutation = useUpdateCaseMutation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [sortOrder, setSortOrder] = useState<SortOption>('time_asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Accordion state
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // 모든 리마인더 평탄화 (FlatMap) 및 오늘 날짜 필터링
  const todayReminders = useMemo(() => {
    const allReminders: { reminder: ReminderItem; caseData: Case }[] = [];
    cases.forEach(c => {
      // 삭제된 케이스 제외
      if (c.status === '휴지통' || c.deletedAt) return;
      
      (c.reminders || []).forEach(r => {
        // 이미 처리된(resultStatus가 있는) 리마인더 제외 (선택 사항이나 보통 오늘 해야할 일만 봅니다)
        if (r.resultStatus) return;
        
        // 오늘 일정인지 확인 (getReminderStatus가 'today' 또는 'overdue'인 경우도 포함할지? 'today'만 포함하도록 일단 설정)
        const status = getReminderStatus(r.datetime);
        if (status === 'today') {
          allReminders.push({ reminder: r, caseData: c });
        }
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
  }, [cases, sortOrder]);

  // 페이지네이션
  const totalItems = todayReminders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const currentItems = todayReminders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Calendar className="text-indigo-600" />
            오늘의 일정
            <span className="text-sm font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
              {totalItems}건
            </span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {format(new Date(), 'yyyy년 M월 d일 eeee', { locale: ko })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value as SortOption);
              setCurrentPage(1); // 정렬 변경 시 1페이지로
            }}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="time_asc">일정 시간순 (기본)</option>
            <option value="createdAt_desc">최근 등록순</option>
            <option value="updatedAt_desc">최근 수정순 (연락 포함)</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {currentItems.length === 0 ? (
          <div className="glass-panel p-12 text-center text-gray-500 rounded-xl">
            오늘 예정된 리마인더 일정이 없습니다.
          </div>
        ) : (
          currentItems.map((item, idx) => {
            const timeStr = item.reminder.datetime?.split(' ')[1] || '시간 미지정';
            const type = item.reminder.type || '통화';
            
            let typeColor = 'bg-gray-100 text-gray-700 border-gray-200';
            if (type === '통화') typeColor = 'bg-blue-50 text-blue-700 border-blue-200';
            else if (type === '출장미팅') typeColor = 'bg-green-50 text-green-700 border-green-200';
            else if (type === '방문미팅') typeColor = 'bg-purple-50 text-purple-700 border-purple-200';
            else if (type === '입금') typeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';

            const isExpanded = expandedCardId === item.reminder.id;

            return (
              <div
                key={`${item.reminder.id}-${idx}`}
                className="group glass-panel bg-white dark:bg-gray-800 hover:shadow-md transition-all rounded-xl border border-transparent hover:border-indigo-300 overflow-hidden"
              >
                {/* Main Card Content (Click to navigate) */}
                <div 
                  className="p-4 flex flex-col md:flex-row md:items-center gap-4 cursor-pointer"
                  onClick={() => navigate(`/case/${item.caseData.caseId}`)}
                >
                  {/* 시간 및 타입 바지 */}
                  <div className="flex md:flex-col items-center md:items-start gap-3 md:gap-1 md:w-32 flex-shrink-0">
                    <div className="font-mono text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                      <Clock size={16} className="text-gray-400" />
                      {timeStr}
                    </div>
                    <div className={`text-xs px-2 py-1 rounded font-bold border flex items-center gap-1 w-fit ${typeColor}`}>
                      {type === '통화' && <Phone size={12} />}
                      {type === '출장미팅' && <Briefcase size={12} />}
                      {type === '방문미팅' && <MapPin size={12} />}
                      {type === '입금' && <Wallet size={12} />}
                      {type === '기타' && <MoreHorizontal size={12} />}
                      {type === '문자' && <MessageSquare size={12} />}
                      {type}
                    </div>
                  </div>

                  {/* 고객 정보 및 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                        {item.caseData.customerName}
                      </span>
                      <span className="text-sm text-gray-500">{item.caseData.phone}</span>
                      <span className="ml-2 text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
                        {item.caseData.status}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm truncate">
                      {item.reminder.content || '내용 없음'}
                    </p>
                  </div>

                  {/* 등록/수정일 정보 (Desktop) */}
                  <div className="hidden md:block text-right text-xs text-gray-400">
                    <div>등록: {format(new Date(item.caseData.createdAt || 0), 'MM-dd')}</div>
                    <div>수정: {format(new Date(item.caseData.updatedAt || 0), 'MM-dd')}</div>
                  </div>
                  
                  {/* 화살표 아이콘 */}
                  <div className="hidden md:flex flex-shrink-0 ml-2">
                    <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900 transition-colors">
                      <ChevronRight size={18} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
                    </div>
                  </div>
                </div>

                {/* Expand Toggle Button */}
                <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-center">
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setExpandedCardId(isExpanded ? null : item.reminder.id); 
                    }}
                    className="w-full py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                  >
                    {isExpanded ? (
                      <><ChevronUp size={16} /> 접기</>
                    ) : (
                      <><ChevronDown size={16} /> 펼쳐보기 (리마인더 및 상담 이력)</>
                    )}
                  </button>
                </div>

                {/* Expanded Content (CaseDetailReminders) */}
                {isExpanded && (
                  <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 animate-in slide-in-from-top-2 duration-200">
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
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
