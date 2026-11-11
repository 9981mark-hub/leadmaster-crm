import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Pin,
  Trash2,
  Users,
  Calendar,
  Send,
  MessageSquare,
  Search,
  ExternalLink,
  ShieldAlert,
  ChevronRight,
  Filter,
  CheckCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  fetchNotices,
  createNotice,
  deleteNotice,
  markNoticeRead,
  fetchDirectives,
  createDirective,
  updateDirectiveStatus,
  fetchNoticeReadStats,
  Notice,
  Directive
} from '../services/noticeService';
import { fetchTeamMembers, TeamMember } from '../services/team';

export const NoticePage: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Tabs: 'notices' | 'directives'
  const [activeTab, setActiveTab] = useState<'notices' | 'directives'>('notices');

  // Notices state
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticeFilter, setNoticeFilter] = useState<string>('all');
  const [loadingNotices, setLoadingNotices] = useState(false);

  // Directives state
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [directiveFilter, setDirectiveFilter] = useState<string>('all');
  const [loadingDirectives, setLoadingDirectives] = useState(false);

  // Members for assignment & stats
  const [members, setMembers] = useState<TeamMember[]>([]);

  // Modals
  const [showCreateNoticeModal, setShowCreateNoticeModal] = useState(false);
  const [showCreateDirectiveModal, setShowCreateDirectiveModal] = useState(false);
  const [statsNotice, setStatsNotice] = useState<Notice | null>(null);
  const [statsData, setStatsData] = useState<{ readMembers: any[]; unreadMembers: any[] } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Form states
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    content: '',
    notice_type: 'urgent' as const,
    display_mode: 'banner' as const,
    is_pinned: true,
    ends_at: ''
  });

  const [directiveForm, setDirectiveForm] = useState({
    assigned_to: '',
    title: '',
    description: '',
    priority: 'high' as const,
    due_date: ''
  });

  const [completingDirective, setCompletingDirective] = useState<Directive | null>(null);
  const [completionMemo, setCompletionMemo] = useState('');

  // Initial load
  const loadData = async () => {
    setLoadingNotices(true);
    setLoadingDirectives(true);
    try {
      const [nList, dList] = await Promise.all([
        fetchNotices(),
        fetchDirectives()
      ]);
      setNotices(nList);
      setDirectives(dList);

      if (isAdmin) {
        const mList = await fetchTeamMembers();
        setMembers(mList);
      }
    } catch (err: any) {
      showToast(err.message || '데이터를 불러오지 못했습니다.', 'error');
    } finally {
      setLoadingNotices(false);
      setLoadingDirectives(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  // Notice Handlers
  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeForm.title.trim() || !noticeForm.content.trim()) {
      showToast('제목과 내용을 모두 입력해 주세요.', 'error');
      return;
    }
    try {
      await createNotice({
        title: noticeForm.title.trim(),
        content: noticeForm.content.trim(),
        notice_type: noticeForm.notice_type,
        display_mode: noticeForm.display_mode,
        is_pinned: noticeForm.is_pinned,
        ends_at: noticeForm.ends_at ? new Date(noticeForm.ends_at).toISOString() : null
      });
      showToast('공지사항이 성공적으로 등록되었습니다.', 'success');
      setShowCreateNoticeModal(false);
      setNoticeForm({
        title: '',
        content: '',
        notice_type: 'urgent',
        display_mode: 'banner',
        is_pinned: true,
        ends_at: ''
      });
      loadData();
    } catch (err: any) {
      showToast(err.message || '공지 등록 실패', 'error');
    }
  };

  const handleDeleteNotice = async (id: string) => {
    if (!confirm('이 공지사항을 삭제하시겠습니까?')) return;
    try {
      await deleteNotice(id);
      showToast('공지가 삭제되었습니다.', 'info');
      setNotices(prev => prev.filter(n => n.id !== id));
    } catch (err: any) {
      showToast(err.message || '공지 삭제 실패', 'error');
    }
  };

  const handleMarkRead = async (noticeId: string) => {
    try {
      await markNoticeRead(noticeId);
      showToast('공지사항 내용을 확인 완료했습니다.', 'success');
      setNotices(prev =>
        prev.map(n => n.id === noticeId ? { ...n, is_read: true, read_count: (n.read_count || 0) + 1 } : n)
      );
    } catch (err: any) {
      showToast(err.message || '확인 처리 실패', 'error');
    }
  };

  const handleOpenStats = async (notice: Notice) => {
    setStatsNotice(notice);
    setLoadingStats(true);
    try {
      const data = await fetchNoticeReadStats(notice.id);
      setStatsData(data);
    } catch (err: any) {
      showToast('수신 현황을 불러오지 못했습니다.', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  // Directive Handlers
  const handleCreateDirective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directiveForm.title.trim() || !directiveForm.assigned_to) {
      showToast('업무 제목과 담당 상담원을 지정해 주세요.', 'error');
      return;
    }
    try {
      await createDirective({
        assigned_to: directiveForm.assigned_to,
        title: directiveForm.title.trim(),
        description: directiveForm.description.trim(),
        priority: directiveForm.priority,
        due_date: directiveForm.due_date ? new Date(directiveForm.due_date).toISOString() : null
      });
      showToast('업무 지시가 상담원에게 전달되었습니다.', 'success');
      setShowCreateDirectiveModal(false);
      setDirectiveForm({
        assigned_to: '',
        title: '',
        description: '',
        priority: 'high',
        due_date: ''
      });
      loadData();
    } catch (err: any) {
      showToast(err.message || '업무 지시 등록 실패', 'error');
    }
  };

  const handleAcknowledgeDirective = async (id: string) => {
    try {
      await updateDirectiveStatus(id, 'in_progress');
      showToast('지시사항을 확인하고 진행 중으로 변경했습니다.', 'info');
      setDirectives(prev => prev.map(d => d.id === id ? { ...d, status: 'in_progress' } : d));
    } catch (err: any) {
      showToast(err.message || '상태 변경 실패', 'error');
    }
  };

  const handleSubmitCompletion = async () => {
    if (!completingDirective) return;
    try {
      await updateDirectiveStatus(completingDirective.id, 'completed', completionMemo.trim());
      showToast('업무 지시를 완료 처리했습니다.', 'success');
      setCompletingDirective(null);
      setCompletionMemo('');
      loadData();
    } catch (err: any) {
      showToast(err.message || '완료 처리 실패', 'error');
    }
  };

  // Filtered lists
  const filteredNotices = notices.filter(n => {
    if (noticeFilter === 'all') return true;
    return n.notice_type === noticeFilter;
  });

  const filteredDirectives = directives.filter(d => {
    if (directiveFilter === 'all') return true;
    return d.status === directiveFilter;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              <Bell size={22} />
            </span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">공지사항 & 업무 지시</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            관리자 지침 및 공지 전달, 상담원 실시간 확인 및 업무 이행 관리
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateNoticeModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-sm"
            >
              <Plus size={16} /> 새 공지 작성
            </button>
            <button
              onClick={() => setShowCreateDirectiveModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors shadow-sm"
            >
              <Send size={16} /> 업무 지시 하달
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('notices')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'notices'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <Bell size={18} />
          공지사항
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
            {notices.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('directives')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'directives'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <Send size={18} />
          업무 지시사항
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
            {directives.length}
          </span>
        </button>
      </div>

      {/* TAB 1: NOTICES */}
      {activeTab === 'notices' && (
        <div className="space-y-4">
          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: '전체 보기' },
              { id: 'urgent', label: '🚨 긴급/필독' },
              { id: 'policy', label: '📋 지침변경' },
              { id: 'promotion', label: '🎉 프로모션' },
              { id: 'general', label: '📢 일반공지' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setNoticeFilter(f.id)}
                className={`px-3 py-1.5 rounded-full font-medium transition-all ${
                  noticeFilter === f.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Notice Card List */}
          {loadingNotices ? (
            <div className="text-center py-12 text-gray-400">공지사항을 불러오는 중...</div>
          ) : filteredNotices.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-400">
              등록된 공지사항이 없습니다.
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredNotices.map(notice => {
                const isUrgent = notice.notice_type === 'urgent' || notice.notice_type === 'policy';
                return (
                  <div
                    key={notice.id}
                    className={`p-5 rounded-xl border transition-all bg-white dark:bg-gray-800 shadow-sm ${
                      notice.is_pinned
                        ? 'border-blue-400 dark:border-blue-600 ring-1 ring-blue-400/30'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {notice.is_pinned && (
                            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                              <Pin size={12} /> 상단고정
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              notice.notice_type === 'urgent'
                                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                : notice.notice_type === 'policy'
                                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                                : notice.notice_type === 'promotion'
                                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {notice.notice_type === 'urgent'
                              ? '🚨 긴급'
                              : notice.notice_type === 'policy'
                              ? '📋 지침'
                              : notice.notice_type === 'promotion'
                              ? '🎉 프로모션'
                              : '일반'}
                          </span>
                          {notice.display_mode === 'banner' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                              상단 띠배너 노출
                            </span>
                          )}
                          <h3 className="text-base font-bold text-gray-900 dark:text-white">
                            {notice.title}
                          </h3>
                        </div>

                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed pt-1">
                          {notice.content}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500 pt-2">
                          <span>등록일: {new Date(notice.created_at).toLocaleDateString('ko-KR')}</span>
                          {notice.ends_at && (
                            <span>게시 종료: {new Date(notice.ends_at).toLocaleDateString('ko-KR')}</span>
                          )}
                        </div>
                      </div>

                      {/* Right Action / Status */}
                      <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0">
                        {/* Agent Read Button */}
                        {!isAdmin && (
                          notice.is_read ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                              <CheckCheck size={16} /> 확인 완료
                            </span>
                          ) : (
                            <button
                              onClick={() => handleMarkRead(notice.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-sm"
                            >
                              <CheckCircle2 size={14} /> 내용 확인 완료
                            </button>
                          )
                        )}

                        {/* Admin Stats & Delete */}
                        {isAdmin && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenStats(notice)}
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium transition-colors"
                            >
                              <Users size={14} />
                              확인 {notice.read_count || 0}명
                            </button>
                            <button
                              onClick={() => handleDeleteNotice(notice.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                              title="공지 삭제"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DIRECTIVES */}
      {activeTab === 'directives' && (
        <div className="space-y-4">
          {/* Directive Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: '전체' },
              { id: 'pending', label: '대기 (미확인)' },
              { id: 'in_progress', label: '진행중' },
              { id: 'completed', label: '완료' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setDirectiveFilter(f.id)}
                className={`px-3 py-1.5 rounded-full font-medium transition-all ${
                  directiveFilter === f.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loadingDirectives ? (
            <div className="text-center py-12 text-gray-400">업무 지시를 불러오는 중...</div>
          ) : filteredDirectives.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-400">
              지시사항이 없습니다.
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredDirectives.map(directive => (
                <div
                  key={directive.id}
                  className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          directive.priority === 'urgent'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            : directive.priority === 'high'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        }`}
                      >
                        {directive.priority === 'urgent' ? '긴급' : directive.priority === 'high' ? '높음' : '보통'}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          directive.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : directive.status === 'in_progress'
                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {directive.status === 'completed'
                          ? '완료'
                          : directive.status === 'in_progress'
                          ? '진행중'
                          : '확인대기'}
                      </span>

                      <h4 className="text-base font-bold text-gray-900 dark:text-white">
                        {directive.title}
                      </h4>
                    </div>

                    {directive.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {directive.description}
                      </p>
                    )}

                    {directive.result_memo && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 mt-2">
                        <span className="font-bold">이행 결과 보고: </span>
                        {directive.result_memo}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500 pt-1">
                      {directive.due_date && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                          <Clock size={12} /> 마감: {new Date(directive.due_date).toLocaleString('ko-KR')}
                        </span>
                      )}
                      <span>등록: {new Date(directive.created_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {directive.status === 'pending' && (
                      <button
                        onClick={() => handleAcknowledgeDirective(directive.id)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                      >
                        지시 확인
                      </button>
                    )}
                    {directive.status !== 'completed' && (
                      <button
                        onClick={() => {
                          setCompletingDirective(directive);
                          setCompletionMemo('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                      >
                        조치 완료 보고
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Create Notice */}
      {showCreateNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Plus size={20} className="text-blue-600" /> 새 공지사항 작성
            </h3>

            <form onSubmit={handleCreateNotice} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  공지 유형
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'urgent', label: '🚨 긴급필독' },
                    { id: 'policy', label: '📋 지침변경' },
                    { id: 'promotion', label: '🎉 프로모션' },
                    { id: 'general', label: '📢 일반공지' }
                  ].map(t => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setNoticeForm(f => ({ ...f, notice_type: t.id as any }))}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                        noticeForm.notice_type === t.id
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  노출 방식
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNoticeForm(f => ({ ...f, display_mode: 'banner' }))}
                    className={`p-2.5 text-xs font-semibold rounded-lg border text-left transition-all ${
                      noticeForm.display_mode === 'banner'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <div className="font-bold">상단 띠배너 + 목록</div>
                    <div className="text-[11px] opacity-75">화면 최상단 띠배너로 즉시 강조 노출</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoticeForm(f => ({ ...f, display_mode: 'feed' }))}
                    className={`p-2.5 text-xs font-semibold rounded-lg border text-left transition-all ${
                      noticeForm.display_mode === 'feed'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <div className="font-bold">공지사항 목록만</div>
                    <div className="text-[11px] opacity-75">공지 게시판 메뉴에만 조용히 등록</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  공지 제목
                </label>
                <input
                  type="text"
                  value={noticeForm.title}
                  onChange={e => setNoticeForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예: [긴급] 11월 회생 리드 심사 기준 변경 안내"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  공지 본문 내용
                </label>
                <textarea
                  rows={4}
                  value={noticeForm.content}
                  onChange={e => setNoticeForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="상담원들에게 전달할 구체적인 내용 및 지침을 작성하세요."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    게시 종료일 (선택)
                  </label>
                  <input
                    type="date"
                    value={noticeForm.ends_at}
                    onChange={e => setNoticeForm(f => ({ ...f, ends_at: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={noticeForm.is_pinned}
                      onChange={e => setNoticeForm(f => ({ ...f, is_pinned: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    목록 상단에 고정
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowCreateNoticeModal(false)}
                  className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-medium"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  공지 등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Directive */}
      {showCreateDirectiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Send size={20} className="text-indigo-600" /> 새 업무 지시 하달
            </h3>

            <form onSubmit={handleCreateDirective} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  담당 상담원 선택
                </label>
                <select
                  value={directiveForm.assigned_to}
                  onChange={e => setDirectiveForm(f => ({ ...f, assigned_to: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">상담원을 선택하세요</option>
                  {members.map(m => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  우선순위
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'urgent', label: '긴급' },
                    { id: 'high', label: '높음' },
                    { id: 'normal', label: '보통' }
                  ].map(p => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setDirectiveForm(f => ({ ...f, priority: p.id as any }))}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                        directiveForm.priority === p.id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  지시 제목
                </label>
                <input
                  type="text"
                  value={directiveForm.title}
                  onChange={e => setDirectiveForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예: 김김김 고객 3차 부재건 오늘 중 추가 재콜 진행"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  상세 지시 내용
                </label>
                <textarea
                  rows={3}
                  value={directiveForm.description}
                  onChange={e => setDirectiveForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="구체적인 업무 내용 및 주의사항을 작성하세요."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  처리 마감 시한 (선택)
                </label>
                <input
                  type="datetime-local"
                  value={directiveForm.due_date}
                  onChange={e => setDirectiveForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowCreateDirectiveModal(false)}
                  className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-medium"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  지시 하달하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Completion Memo */}
      {completingDirective && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600" /> 업무 조치 완료 보고
            </h3>
            <p className="text-xs text-gray-500">
              지시: <span className="font-semibold text-gray-700 dark:text-gray-300">{completingDirective.title}</span>
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                이행 결과 메모
              </label>
              <textarea
                rows={3}
                value={completionMemo}
                onChange={e => setCompletionMemo(e.target.value)}
                placeholder="어떻게 조치 완료되었는지 간단히 기록하세요 (예: 고객 통화 완료, 내일 오전 서류 접수 약속)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setCompletingDirective(null)}
                className="px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-medium"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmitCompletion}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                완료 보고 제출
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Admin Notice Read Stats */}
      {statsNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users size={18} className="text-blue-600" /> 공지 수신 확인 현황
              </h3>
              <button
                onClick={() => setStatsNotice(null)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 font-medium truncate">
              {statsNotice.title}
            </p>

            {loadingStats ? (
              <div className="py-8 text-center text-xs text-gray-400">통계 집계 중...</div>
            ) : statsData ? (
              <div className="space-y-4 text-xs">
                {/* Stats Summary Gauge */}
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-blue-900 dark:text-blue-200">
                      확인 인원: {statsData.readMembers.length}명 / 전체 {statsData.readMembers.length + statsData.unreadMembers.length}명
                    </div>
                    <div className="text-[11px] text-blue-700 dark:text-blue-300">
                      수신율: {Math.round((statsData.readMembers.length / (statsData.readMembers.length + statsData.unreadMembers.length || 1)) * 100)}%
                    </div>
                  </div>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {Math.round((statsData.readMembers.length / (statsData.readMembers.length + statsData.unreadMembers.length || 1)) * 100)}%
                  </span>
                </div>

                {/* Unread List */}
                {statsData.unreadMembers.length > 0 && (
                  <div className="space-y-1">
                    <div className="font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertTriangle size={12} /> 미확인 인원 ({statsData.unreadMembers.length}명)
                    </div>
                    <div className="max-h-28 overflow-y-auto p-2 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 space-y-1">
                      {statsData.unreadMembers.map(m => (
                        <div key={m.userId} className="text-gray-700 dark:text-gray-300 flex items-center justify-between">
                          <span>{m.displayName}</span>
                          <span className="text-[10px] text-red-500 font-medium">미확인</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Read List */}
                <div className="space-y-1">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> 확인 완료 인원 ({statsData.readMembers.length}명)
                  </div>
                  <div className="max-h-32 overflow-y-auto p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 space-y-1">
                    {statsData.readMembers.map(m => (
                      <div key={m.userId} className="text-gray-700 dark:text-gray-300 flex items-center justify-between text-[11px]">
                        <span>{m.displayName}</span>
                        <span className="text-[10px] text-gray-400">{new Date(m.readAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setStatsNotice(null)}
                className="px-4 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoticePage;