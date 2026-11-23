import React, { useEffect, useState, useMemo } from 'react';
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
  CheckCheck,
  Crown,
  Globe,
  Building2,
  ShieldCheck,
  SlidersHorizontal,
  Check,
  AlertCircle,
  Eye,
  Tag,
  FileCheck,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
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
import {
  fetchTeamMembers,
  TeamMember,
  NoticeAdminPermissions,
  DEFAULT_TIER1_PERMISSIONS,
  OWNER_FULL_PERMISSIONS,
} from '../services/team';
import { PlatformOrg, fetchOrganizations } from '../services/platform';

export const NoticePage: React.FC = () => {
  const { isAdmin, isPlatformAdmin, org, user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const navigate = useNavigate();

  // 4대 직급 및 권한 판별
  const isOwner = org?.role === 'owner' || user?.email === (org as any)?.ownerEmail;
  const noticePerms: NoticeAdminPermissions =
    org?.adminPermissions?.notice || (isOwner ? OWNER_FULL_PERMISSIONS.notice : DEFAULT_TIER1_PERMISSIONS.notice);
  const canViewAll = isOwner || isPlatformAdmin || noticePerms.noticeScope === 'all' || noticePerms.directiveScope === 'all';
  const isTeamScope = !canViewAll && isAdmin;
  const isAgent = !isAdmin && !isOwner && !isPlatformAdmin;
  const myTeam = org?.teamName || '1팀';

  // Tabs: 'notices' | 'directives'
  const [activeTab, setActiveTab] = useState<'notices' | 'directives'>('notices');

  // Notices state
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticeFilter, setNoticeFilter] = useState<string>('all');
  const [loadingNotices, setLoadingNotices] = useState(false);

  // Directives state
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [directiveFilter, setDirectiveFilter] = useState<string>('all');
  const [teamDirectiveFilter, setTeamDirectiveFilter] = useState<string>('all');
  const [memberDirectiveFilter, setMemberDirectiveFilter] = useState<string>('all');
  const [loadingDirectives, setLoadingDirectives] = useState(false);

  // Members for assignment & stats, and Organizations for platform targeting
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [orgsList, setOrgsList] = useState<PlatformOrg[]>([]);

  // Modals
  const [showCreateNoticeModal, setShowCreateNoticeModal] = useState(false);
  const [showCreateDirectiveModal, setShowCreateDirectiveModal] = useState(false);
  const [statsNotice, setStatsNotice] = useState<Notice | null>(null);
  const [statsData, setStatsData] = useState<{
    readMembers: { userId: string; displayName: string; teamName: string; readAt: string }[];
    unreadMembers: { userId: string; displayName: string; teamName: string }[];
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Form states
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    content: '',
    notice_type: 'urgent' as const,
    display_mode: 'banner' as const,
    is_pinned: true,
    ends_at: '',
    target_team_name: isTeamScope ? myTeam : 'all',
    // 멀티테넌트 플랫폼 전역 공지 설정
    is_platform_notice: isPlatformAdmin,
    platform_target_role: 'admins_only' as 'all' | 'admins_only',
    target_org_ids: [] as string[],
    require_popup_lock: false
  });

  useEffect(() => {
    if (isPlatformAdmin) {
      setNoticeForm(f => ({ ...f, is_platform_notice: true }));
    }
    if (isTeamScope) {
      setNoticeForm(f => ({ ...f, target_team_name: myTeam }));
    }
  }, [isPlatformAdmin, isTeamScope, myTeam]);

  const [directiveForm, setDirectiveForm] = useState({
    assigned_to: '',
    assigned_team_name: isTeamScope ? myTeam : '',
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

      // 클라이언트 보안 방어선: 일반 상담원(!isAdmin)인 경우 플랫폼 대표/관리자 전용 공지 원천 제외
      const safeNotices = nList.filter(n => {
        if (n.is_platform_notice) {
          if (n.platform_target_role === 'admins_only' && !isAdmin && !isPlatformAdmin) {
            return false;
          }
          if (n.target_org_ids && n.target_org_ids.length > 0 && org?.orgId) {
            if (!n.target_org_ids.includes(org.orgId) && !isPlatformAdmin) {
              return false;
            }
          }
        }
        return true;
      });

      setNotices(safeNotices);
      setDirectives(dList);

      try {
        const mList = await fetchTeamMembers();
        setMembers(mList);
      } catch (_) {}

      if (isPlatformAdmin) {
        try {
          const oList = await fetchOrganizations();
          setOrgsList(oList);
        } catch (_) {}
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
  }, [isAdmin, isPlatformAdmin]);

  // 팀 및 멤버 맵핑 헬퍼
  const availableTeams = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => set.add(m.teamName || '1팀'));
    if (myTeam) set.add(myTeam);
    return Array.from(set).sort();
  }, [members, myTeam]);

  const myTeamMembers = useMemo(() => {
    if (canViewAll) return members;
    return members.filter(m => (m.teamName || '1팀') === myTeam);
  }, [members, canViewAll, myTeam]);

  const myTeamMemberIds = useMemo(() => new Set(myTeamMembers.map(m => m.userId)), [myTeamMembers]);
  const memberNameMap = useMemo(() => new Map(members.map(m => [m.userId, m.displayName || m.email])), [members]);
  const memberTeamMap = useMemo(() => new Map(members.map(m => [m.userId, m.teamName || '1팀'])), [members]);

  // Notice Handlers
  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeForm.title.trim() || !noticeForm.content.trim()) {
      showToast('제목과 내용을 모두 입력해 주세요.', 'error');
      return;
    }
    const targetTeam = isTeamScope
      ? myTeam
      : (noticeForm.target_team_name === 'all' ? null : noticeForm.target_team_name);

    try {
      await createNotice({
        title: noticeForm.title.trim(),
        content: noticeForm.content.trim(),
        notice_type: noticeForm.notice_type,
        display_mode: noticeForm.display_mode,
        is_pinned: noticeForm.is_pinned,
        ends_at: noticeForm.ends_at ? new Date(noticeForm.ends_at).toISOString() : null,
        target_team_name: targetTeam,
        is_platform_notice: isPlatformAdmin && noticeForm.is_platform_notice,
        platform_target_role: noticeForm.platform_target_role,
        target_org_ids: noticeForm.target_org_ids,
        require_popup_lock: noticeForm.require_popup_lock
      });

      showToast(
        noticeForm.is_platform_notice
          ? (noticeForm.platform_target_role === 'admins_only'
              ? '👑 고객사 대표/관리자 전용 플랫폼 공지가 송출되었습니다.'
              : '🌐 전체 고객사 모든 사용자에게 플랫폼 공지가 송출되었습니다.')
          : (targetTeam ? `👥 ${targetTeam} 전용 공지사항이 등록되었습니다.` : '전사 공지사항이 성공적으로 등록되었습니다.'),
        'success'
      );

      setShowCreateNoticeModal(false);
      setNoticeForm({
        title: '',
        content: '',
        notice_type: 'urgent',
        display_mode: 'banner',
        is_pinned: true,
        ends_at: '',
        target_team_name: isTeamScope ? myTeam : 'all',
        is_platform_notice: isPlatformAdmin,
        platform_target_role: 'admins_only',
        target_org_ids: [],
        require_popup_lock: false
      });
      loadData();
    } catch (err: any) {
      showToast(err.message || '공지 등록 실패', 'error');
    }
  };

  const handleDeleteNotice = async (id: string) => {
    const ok = await confirm({
      title: '공지사항 삭제',
      message: '이 공지사항을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.',
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'danger',
    });
    if (!ok) return;
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
    const assignedMember = members.find(m => m.userId === directiveForm.assigned_to);
    const assignedTeam = isTeamScope ? myTeam : (assignedMember?.teamName || '1팀');

    try {
      await createDirective({
        assigned_to: directiveForm.assigned_to,
        assigned_team_name: assignedTeam,
        title: directiveForm.title.trim(),
        description: directiveForm.description.trim(),
        priority: directiveForm.priority,
        due_date: directiveForm.due_date ? new Date(directiveForm.due_date).toISOString() : null
      });
      showToast('업무 지시가 상담원에게 전달되었습니다.', 'success');
      setShowCreateDirectiveModal(false);
      setDirectiveForm({
        assigned_to: '',
        assigned_team_name: isTeamScope ? myTeam : '',
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

  // Role Scoped Filtering
  const roleFilteredNotices = useMemo(() => {
    return notices.filter(n => {
      if (n.is_platform_notice) {
        if (n.platform_target_role === 'admins_only' && isAgent) return false;
        return true;
      }
      if (canViewAll) return true;
      if (!n.target_team_name || n.target_team_name === 'all') return true;
      return n.target_team_name === myTeam;
    });
  }, [notices, canViewAll, isAgent, myTeam]);

  const filteredNotices = useMemo(() => {
    return roleFilteredNotices.filter(n => {
      if (noticeFilter === 'all') return true;
      if (noticeFilter === 'unread') return !n.is_read;
      if (noticeFilter === 'platform') return !!n.is_platform_notice;
      if (noticeFilter === 'team') return n.target_team_name === myTeam;
      return n.notice_type === noticeFilter;
    });
  }, [roleFilteredNotices, noticeFilter, myTeam]);

  const unreadNoticeCount = useMemo(() => {
    return roleFilteredNotices.filter(n => !n.is_read).length;
  }, [roleFilteredNotices]);

  const roleFilteredDirectives = useMemo(() => {
    return directives.filter(d => {
      if (canViewAll) return true;
      if (isTeamScope) {
        if (d.assigned_team_name && d.assigned_team_name === myTeam) return true;
        if (myTeamMemberIds.has(d.assigned_to)) return true;
        if (d.created_by === user?.id) return true;
        return false;
      }
      // 일반 상담원은 오직 본인 배정 건만 열람
      return d.assigned_to === user?.id;
    });
  }, [directives, canViewAll, isTeamScope, user, myTeam, myTeamMemberIds]);

  const filteredDirectives = useMemo(() => {
    return roleFilteredDirectives.filter(d => {
      if (directiveFilter !== 'all' && d.status !== directiveFilter) return false;
      if (canViewAll && teamDirectiveFilter !== 'all') {
        const teamOfD = d.assigned_team_name || memberTeamMap.get(d.assigned_to) || '1팀';
        if (teamOfD !== teamDirectiveFilter) return false;
      }
      if (memberDirectiveFilter !== 'all' && d.assigned_to !== memberDirectiveFilter) {
        return false;
      }
      return true;
    });
  }, [roleFilteredDirectives, directiveFilter, teamDirectiveFilter, memberDirectiveFilter, canViewAll, memberTeamMap]);

  const directiveMetrics = useMemo(() => {
    const total = roleFilteredDirectives.length;
    const pending = roleFilteredDirectives.filter(d => d.status === 'pending').length;
    const inProgress = roleFilteredDirectives.filter(d => d.status === 'in_progress').length;
    const completed = roleFilteredDirectives.filter(d => d.status === 'completed').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, pending, inProgress, completed, completionRate };
  }, [roleFilteredDirectives]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Bell size={20} strokeWidth={1.75} />
            </span>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">공지사항 & 업무 지시</h1>
            {isPlatformAdmin ? (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <Crown size={13} className="text-primary" /> LeadMaster 총괄 운영자 모드
              </span>
            ) : isOwner ? (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-muted text-foreground border border-border">
                <Crown size={13} className="text-primary" /> 최고경영 총괄 모드
              </span>
            ) : canViewAll ? (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-muted text-muted-foreground border border-border">
                <ShieldCheck size={13} strokeWidth={1.75} /> 총괄 운영 관리 모드 (전사)
              </span>
            ) : isTeamScope ? (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-muted text-muted-foreground border border-border">
                <Users size={13} strokeWidth={1.75} /> {myTeam} 플로어 지휘 모드
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-muted text-muted-foreground border border-border">
                <UserCheck size={13} strokeWidth={1.75} /> 내 공지 및 업무함 ({myTeam})
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isPlatformAdmin
              ? '전체 입점 고객사 대표·관리자 및 전사 사용자 대상 멀티테넌트 플랫폼 공지 송출 관제'
              : isOwner
              ? '전사 공지사항 송출 및 전 팀 업무 지시 이행 총괄 감독'
              : canViewAll
              ? '전사 운영 지침 전달 및 플로어 팀별 업무 지시 이행률 관제'
              : isTeamScope
              ? `${myTeam} 소속 팀원 대상 팀 공지 및 1:1 업무 지시 관리`
              : `본사 및 소속팀(${myTeam}) 지침 확인과 나에게 할당된 업무 지시 이행`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Admin Create Buttons */}
          {isAdmin && (isOwner || noticePerms.canCreateNotice) && (
            <button
              onClick={() => setShowCreateNoticeModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <Plus size={15} strokeWidth={1.75} /> {isPlatformAdmin ? '플랫폼 공지 송출' : isTeamScope ? `${myTeam} 공지 작성` : '새 공지 작성'}
            </button>
          )}

          {isAdmin && (isOwner || noticePerms.canIssueDirective) && (
            <button
              onClick={() => setShowCreateDirectiveModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-card border border-border hover:bg-muted text-foreground font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <Send size={14} strokeWidth={1.75} className="text-primary" /> {isTeamScope ? '팀원 업무 지시 하달' : '업무 지시 하달'}
            </button>
          )}

          {/* Agent Action Shortcuts */}
          {isAgent && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setActiveTab('notices'); setNoticeFilter('unread'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  unreadNoticeCount > 0
                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border border-amber-300 dark:border-amber-700 animate-pulse'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                <AlertCircle size={14} className={unreadNoticeCount > 0 ? 'text-amber-600' : 'text-gray-500 dark:text-gray-400'} />
                <span>미확인 공지 {unreadNoticeCount}건</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('directives'); setDirectiveFilter('pending'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  directiveMetrics.pending > 0
                    ? 'bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-200 border border-red-300 dark:border-red-700'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                <Clock size={14} className={directiveMetrics.pending > 0 ? 'text-red-600' : 'text-gray-500 dark:text-gray-400'} />
                <span>확인 대기 지시 {directiveMetrics.pending}건</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('notices')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'notices'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bell size={18} />
          공지사항
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">
            {roleFilteredNotices.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('directives')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'directives'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Send size={18} />
          업무 지시사항
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">
            {roleFilteredDirectives.length}
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
              ...(unreadNoticeCount > 0 ? [{ id: 'unread', label: `⚠️ 미확인 공지 (${unreadNoticeCount})` }] : []),
              { id: 'platform', label: '👑 LeadMaster 본사 공식' },
              { id: 'urgent', label: '🚨 긴급/필독' },
              { id: 'policy', label: '📋 지침변경' },
              { id: 'promotion', label: '🎉 프로모션' },
              { id: 'team', label: `👥 ${myTeam} 공지` },
              { id: 'general', label: '📢 일반공지' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setNoticeFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  noticeFilter === f.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Notice Card List */}
          {loadingNotices ? (
            <div className="text-center py-12 text-muted-foreground">공지사항을 불러오는 중...</div>
          ) : filteredNotices.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-xl border border-border text-muted-foreground">
              등록된 공지사항이 없습니다.
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredNotices.map(notice => {
                const isUrgent = notice.notice_type === 'urgent' || notice.notice_type === 'policy';
                return (
                  <div
                    key={notice.id}
                    className="p-5 rounded-xl border border-border transition-all bg-card shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {notice.is_platform_notice && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-xs">
                              <Crown size={12} className="text-amber-300" /> LeadMaster 본사 공식
                            </span>
                          )}
                          {notice.is_platform_notice && (
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              notice.platform_target_role === 'admins_only'
                                ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                                : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            }`}>
                              {notice.platform_target_role === 'admins_only' ? '🔒 고객사 대표·관리자 전용' : '👥 전 고객사 전원 (대표+직원)'}
                            </span>
                          )}
                          {notice.is_platform_notice && notice.target_org_ids && notice.target_org_ids.length > 0 && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              🎯 특정 고객사 지정 ({notice.target_org_ids.length}개사)
                            </span>
                          )}
                          {notice.require_popup_lock && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                              🚨 필수 확인 팝업
                            </span>
                          )}

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
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                              상단 띠배너 노출
                            </span>
                          )}
                          {notice.target_team_name ? (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                              👥 {notice.target_team_name} 공지
                            </span>
                          ) : (
                            !notice.is_platform_notice && (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 border border-blue-300 dark:border-blue-800">
                                🌐 전사 공지
                              </span>
                            )
                          )}
                          <h3 className="text-base font-bold text-gray-900 dark:text-white">
                            {notice.title}
                          </h3>
                        </div>

                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed pt-1">
                          {notice.content}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 pt-2">
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
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer animate-pulse"
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
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium transition-colors cursor-pointer"
                            >
                              <Users size={14} />
                              확인 {notice.read_count || 0}명
                            </button>
                            {(isOwner || canViewAll || noticePerms.canDeleteNotice) && (
                              <button
                                onClick={() => handleDeleteNotice(notice.id)}
                                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                                title="공지 삭제"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
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
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* KPI 1: Total */}
            <div className="bg-card text-card-foreground p-4 rounded-xl border border-border shadow-2xs">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
                <span>{canViewAll ? '전사 누적 지시' : isTeamScope ? `${myTeam} 하달 건수` : '내게 온 업무 지시'}</span>
                <Send size={15} className="text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground font-mono tabular-nums">
                {directiveMetrics.total}<span className="text-xs font-normal text-muted-foreground ml-1">건</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {canViewAll ? '전사 하달 누적 건' : isTeamScope ? '소속 팀원 지시 총합' : '본인 할당 전체 지시'}
              </div>
            </div>

            {/* KPI 2: Pending (Action Needed) */}
            <div className={`p-4 rounded-xl border shadow-2xs transition-all ${
              directiveMetrics.pending > 0
                ? 'bg-destructive/10 border-destructive/30 text-destructive'
                : 'bg-card text-card-foreground border-border'
            }`}>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span>{isAgent ? '새 지시 (확인 필요)' : isTeamScope ? '팀원 미확인 대기' : '전사 확인 대기'}</span>
                <Clock size={15} className={directiveMetrics.pending > 0 ? 'text-destructive animate-pulse' : 'text-muted-foreground'} />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums">
                {directiveMetrics.pending}<span className="text-xs font-normal ml-1">건</span>
              </div>
              <div className="text-xs opacity-80 mt-1">
                {isAgent ? '내용 확인 후 즉시 조치 착수' : '상담원이 아직 확인 안 한 건'}
              </div>
            </div>

            {/* KPI 3: In Progress */}
            <div className="bg-card text-card-foreground p-4 rounded-xl border border-border shadow-2xs">
              <div className="flex items-center justify-between text-xs text-foreground font-bold mb-1">
                <span>{isAgent ? '내가 조치 진행 중' : isTeamScope ? '팀원 조치 진행 중' : '전사 진행 중'}</span>
                <Clock size={15} className="text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground font-mono tabular-nums">
                {directiveMetrics.inProgress}<span className="text-xs font-normal text-muted-foreground ml-1">건</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                현재 현장 상담/통화 조치 중인 건
              </div>
            </div>

            {/* KPI 4: Completion Rate */}
            <div className="bg-card text-card-foreground p-4 rounded-xl border border-border shadow-2xs">
              <div className="flex items-center justify-between text-xs text-primary font-bold mb-1">
                <span>{isAgent ? '내 조치 완료 업무' : isTeamScope ? `${myTeam} 이행 완료율` : '전사 지시 완료율'}</span>
                <CheckCircle2 size={15} className="text-primary" />
              </div>
              <div className="text-2xl font-bold text-primary font-mono tabular-nums">
                {isAgent ? directiveMetrics.completed : `${directiveMetrics.completionRate}%`}
                <span className="text-xs font-normal text-muted-foreground ml-1">{isAgent ? '건' : `(${directiveMetrics.completed}건 완료)`}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                결과 메모 제출 완료된 업무
              </div>
            </div>
          </div>

          {/* Directive Filter Bar */}
          <div className="bg-card p-3 rounded-xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              {[
                { id: 'all', label: '전체' },
                { id: 'pending', label: '대기 (미확인)' },
                { id: 'in_progress', label: '진행중' },
                { id: 'completed', label: '완료' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setDirectiveFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    directiveFilter === f.id
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Dropdown Filters for Managers */}
            <div className="flex items-center gap-2 flex-wrap">
              {canViewAll && (
                <select
                  value={teamDirectiveFilter}
                  onChange={e => setTeamDirectiveFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-bold"
                >
                  <option value="all">전체 팀 관제</option>
                  {availableTeams.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}

              {isTeamScope && (
                <span className="px-2.5 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 font-bold">
                  👥 {myTeam} 고정
                </span>
              )}

              {!isAgent && (
                <select
                  value={memberDirectiveFilter}
                  onChange={e => setMemberDirectiveFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-medium"
                >
                  <option value="all">전체 상담원</option>
                  {myTeamMembers.map(m => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName || m.email} ({m.teamName || '1팀'})
                    </option>
                  ))}
                </select>
              )}

              {isAgent && (
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                  <UserCheck size={13} className="text-emerald-500" /> 나에게 할당된 업무 지시만 표시됩니다.
                </span>
              )}
            </div>
          </div>

          {loadingDirectives ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">업무 지시를 불러오는 중...</div>
          ) : filteredDirectives.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">
              해당 조건의 업무 지시사항이 없습니다.
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredDirectives.map(directive => {
                const assignedMember = members.find(m => m.userId === directive.assigned_to);
                const assignedName = directive.assigned_to_name || assignedMember?.displayName || assignedMember?.email || '상담원';
                const assignedTeam = directive.assigned_team_name || assignedMember?.teamName || myTeam;
                const isForMe = directive.assigned_to === user?.id;

                return (
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
                          {directive.priority === 'urgent' ? '🚨 긴급' : directive.priority === 'high' ? '높음' : '보통'}
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
                            ? '완료됨'
                            : directive.status === 'in_progress'
                            ? '진행중'
                            : '확인대기'}
                        </span>

                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                          <Users size={12} /> {assignedName} ({assignedTeam})
                        </span>

                        {directive.case_name && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            고객: {directive.case_name}
                          </span>
                        )}

                        <h4 className="text-base font-bold text-gray-900 dark:text-white">
                          {directive.title}
                        </h4>
                      </div>

                      {directive.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 pt-1">
                          {directive.description}
                        </p>
                      )}

                      {directive.result_memo && (
                        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 mt-2 flex items-start gap-1.5">
                          <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">조치 완료 보고 메모: </span>
                            {directive.result_memo}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 pt-1">
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
                      {isForMe ? (
                        <>
                          {directive.status === 'pending' && (
                            <button
                              onClick={() => handleAcknowledgeDirective(directive.id)}
                              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer animate-pulse"
                            >
                              지시 확인 (조치 시작)
                            </button>
                          )}
                          {directive.status !== 'completed' && (
                            <button
                              onClick={() => {
                                setCompletingDirective(directive);
                                setCompletionMemo('');
                              }}
                              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
                            >
                              조치 완료 보고
                            </button>
                          )}
                          {directive.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                              <CheckCheck size={15} /> 완료 제출됨
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="text-right text-xs">
                          {directive.status === 'completed' ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCheck size={14} /> 이행 완료
                            </span>
                          ) : directive.status === 'in_progress' ? (
                            <span className="text-sky-600 dark:text-sky-400 font-medium flex items-center gap-1">
                              <Clock size={13} /> 조치 진행 중
                            </span>
                          ) : (
                            <span className="text-red-500 font-medium flex items-center gap-1">
                              <AlertCircle size={13} /> 미확인 대기
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Create Notice */}
      {showCreateNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-card text-card-foreground rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-border space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Plus size={18} className="text-primary" /> {isPlatformAdmin ? '플랫폼 전역 공지 송출' : '새 공지사항 작성'}
            </h3>

            <form onSubmit={handleCreateNotice} className="space-y-4 text-xs">
              {/* 총괄 운영자 전용 멀티테넌트 플랫폼 타겟팅 컨트롤 */}
              {isPlatformAdmin && (
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Crown size={15} className="text-primary" /> LeadMaster 총괄 운영자 모드
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-primary">
                      <input
                        type="checkbox"
                        checked={noticeForm.is_platform_notice}
                        onChange={e => setNoticeForm(f => ({ ...f, is_platform_notice: e.target.checked }))}
                        className="accent-primary"
                      />
                      전체 입점 고객사 플랫폼 공지
                    </label>
                  </div>

                  {noticeForm.is_platform_notice && (
                    <div className="space-y-2.5 pt-1 border-t border-border text-xs">
                      <div>
                        <span className="font-semibold text-foreground block mb-1">
                          수신 대상 지정 (Target Audience)
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setNoticeForm(f => ({ ...f, platform_target_role: 'admins_only' }))}
                            className={`p-2.5 rounded-lg border text-left transition-all ${
                              noticeForm.platform_target_role === 'admins_only'
                                ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                                : 'border-border text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            <div className="font-bold flex items-center gap-1">🔒 각 고객사 대표·관리자만</div>
                            <div className="text-2xs text-muted-foreground mt-0.5">과금/정산/약관/관리자 기능 (상담원 비공개)</div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setNoticeForm(f => ({ ...f, platform_target_role: 'all' }))}
                            className={`p-2.5 rounded-lg border text-left transition-all ${
                              noticeForm.platform_target_role === 'all'
                                ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                                : 'border-border text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            <div className="font-bold flex items-center gap-1">👥 모든 고객사 전원 (대표+직원)</div>
                            <div className="text-2xs text-muted-foreground mt-0.5">서버점검/앱업데이트/전체 기능 안내</div>
                          </button>
                        </div>
                      </div>

                      {/* 고객사 타겟팅 (전체 vs 특정사 선택) */}
                      {orgsList.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-foreground">
                              대상 고객사 범위
                            </span>
                            <span className="text-2xs text-muted-foreground">
                              {noticeForm.target_org_ids.length === 0 ? '모든 입점 고객사' : `${noticeForm.target_org_ids.length}개 고객사 선택됨`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setNoticeForm(f => ({ ...f, target_org_ids: [] }))}
                              className={`px-2 py-1 rounded text-xs font-semibold border ${
                                noticeForm.target_org_ids.length === 0
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-card text-foreground border-border hover:bg-muted'
                              }`}
                            >
                              전체 고객사 일괄 송출
                            </button>
                            <select
                              value=""
                              onChange={e => {
                                const selectedId = e.target.value;
                                if (!selectedId) return;
                                if (!noticeForm.target_org_ids.includes(selectedId)) {
                                  setNoticeForm(f => ({ ...f, target_org_ids: [...f.target_org_ids, selectedId] }));
                                }
                              }}
                              className="flex-1 px-2 py-1 rounded border border-input bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="">+ 특정 고객사 추가 선택...</option>
                              {orgsList.map(o => (
                                <option key={o.id} value={o.id}>{o.name} ({o.ownerEmail})</option>
                              ))}
                            </select>
                          </div>
                          {noticeForm.target_org_ids.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {noticeForm.target_org_ids.map(id => {
                                const orgObj = orgsList.find(o => o.id === id);
                                return (
                                  <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary text-2xs font-semibold">
                                    {orgObj?.name || id}
                                    <button
                                      type="button"
                                      onClick={() => setNoticeForm(f => ({ ...f, target_org_ids: f.target_org_ids.filter(x => x !== id) }))}
                                      className="text-primary hover:text-foreground cursor-pointer"
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 긴급 필독 팝업 체크박스 */}
                      <label className="flex items-center gap-2 pt-1 text-foreground font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={noticeForm.require_popup_lock}
                          onChange={e => setNoticeForm(f => ({ ...f, require_popup_lock: e.target.checked }))}
                          className="accent-primary"
                        />
                        <span>🚨 접속 시 긴급 필독 팝업 잠금 (확인 버튼을 누를 때까지 필수 노출)</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* 사내 공지 수신 대상 팀 선택 */}
              {!noticeForm.is_platform_notice && (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    수신 대상 범위 (Target Audience)
                  </label>
                  {isTeamScope ? (
                    <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold flex items-center gap-2">
                      <Users size={15} />
                      <span>{myTeam} 소속 팀원 전용 공지로 등록됩니다.</span>
                    </div>
                  ) : (
                    <select
                      value={noticeForm.target_team_name}
                      onChange={e => setNoticeForm(f => ({ ...f, target_team_name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="all">🌐 전사 전체 임직원 대상</option>
                      {availableTeams.map(t => (
                        <option key={t} value={t}>👥 {t} 전용 공지</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
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
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        noticeForm.notice_type === t.id
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  노출 방식
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNoticeForm(f => ({ ...f, display_mode: 'banner' }))}
                    className={`p-2.5 text-xs font-semibold rounded-lg border text-left transition-all cursor-pointer ${
                      noticeForm.display_mode === 'banner'
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="font-bold">상단 띠배너 + 목록</div>
                    <div className="text-2xs text-muted-foreground mt-0.5">화면 최상단 띠배너로 즉시 강조 노출</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoticeForm(f => ({ ...f, display_mode: 'feed' }))}
                    className={`p-2.5 text-xs font-semibold rounded-lg border text-left transition-all cursor-pointer ${
                      noticeForm.display_mode === 'feed'
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="font-bold">공지사항 목록만</div>
                    <div className="text-2xs text-muted-foreground mt-0.5">공지 게시판 메뉴에만 조용히 등록</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  공지 제목
                </label>
                <input
                  type="text"
                  value={noticeForm.title}
                  onChange={e => setNoticeForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예: [긴급] 11월 회생 리드 심사 기준 변경 안내"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  공지 본문 내용
                </label>
                <textarea
                  rows={4}
                  value={noticeForm.content}
                  onChange={e => setNoticeForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="상담원들에게 전달할 구체적인 내용 및 지침을 작성하세요."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    게시 종료일 (선택)
                  </label>
                  <input
                    type="date"
                    value={noticeForm.ends_at}
                    onChange={e => setNoticeForm(f => ({ ...f, ends_at: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={noticeForm.is_pinned}
                      onChange={e => setNoticeForm(f => ({ ...f, is_pinned: e.target.checked }))}
                      className="accent-primary"
                    />
                    목록 상단에 고정
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateNoticeModal(false)}
                  className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-muted text-xs font-medium cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold cursor-pointer shadow-xs"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-card text-card-foreground rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-border space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Send size={18} className="text-primary" /> 새 업무 지시 하달
            </h3>

            <form onSubmit={handleCreateDirective} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  담당 상담원 지정 {isTeamScope && <span className="text-primary font-bold">({myTeam} 팀원 한정)</span>}
                </label>
                <select
                  value={directiveForm.assigned_to}
                  onChange={e => setDirectiveForm(f => ({ ...f, assigned_to: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs font-medium focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="">지시를 전달할 상담원을 선택하세요</option>
                  {myTeamMembers.map(m => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName} ({m.email}) - {m.teamName || '1팀'}
                    </option>
                  ))}
                </select>
                {isTeamScope && (
                  <p className="text-xs text-muted-foreground mt-1">
                    중간 관리자(팀장)는 본인 소속 팀원에게만 업무 지시를 내릴 수 있습니다.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
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
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        directiveForm.priority === p.id
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  지시 제목
                </label>
                <input
                  type="text"
                  value={directiveForm.title}
                  onChange={e => setDirectiveForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예: 김김김 고객 3차 부재건 오늘 중 추가 재콜 진행"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  상세 지시 내용
                </label>
                <textarea
                  rows={3}
                  value={directiveForm.description}
                  onChange={e => setDirectiveForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="구체적인 업무 내용 및 주의사항을 작성하세요."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  처리 마감 시한 (선택)
                </label>
                <input
                  type="datetime-local"
                  value={directiveForm.due_date}
                  onChange={e => setDirectiveForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateDirectiveModal(false)}
                  className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-muted text-xs font-medium cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold cursor-pointer shadow-xs"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-card text-card-foreground rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 size={18} className="text-primary" /> 업무 조치 완료 보고
            </h3>
            <p className="text-xs text-muted-foreground">
              지시: <span className="font-semibold text-foreground">{completingDirective.title}</span>
            </p>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                이행 결과 메모
              </label>
              <textarea
                rows={3}
                value={completionMemo}
                onChange={e => setCompletionMemo(e.target.value)}
                placeholder="어떻게 조치 완료되었는지 간단히 기록하세요 (예: 고객 통화 완료, 내일 오전 서류 접수 약속)"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setCompletingDirective(null)}
                className="px-3.5 py-2 rounded-lg text-muted-foreground hover:bg-muted text-xs font-medium cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmitCompletion}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold cursor-pointer shadow-xs"
              >
                완료 보고 제출
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Admin Notice Read Stats */}
      {statsNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-card text-card-foreground rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Users size={18} className="text-primary" /> 공지 수신 확인 현황
              </h3>
              <button
                onClick={() => setStatsNotice(null)}
                className="text-muted-foreground hover:text-foreground p-1 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground font-medium truncate">
              {statsNotice.title}
            </p>

            {loadingStats ? (
              <div className="py-8 text-center text-xs text-muted-foreground">통계 집계 중...</div>
            ) : statsData ? (
              <div className="space-y-4 text-xs">
                {/* Stats Summary Gauge */}
                {(() => {
                  const scopedRead = canViewAll ? statsData.readMembers : statsData.readMembers.filter(m => (m.teamName || '1팀') === myTeam);
                  const scopedUnread = canViewAll ? statsData.unreadMembers : statsData.unreadMembers.filter(m => (m.teamName || '1팀') === myTeam);
                  const totalCount = scopedRead.length + scopedUnread.length;
                  const rate = totalCount > 0 ? Math.round((scopedRead.length / totalCount) * 100) : 0;

                  return (
                    <>
                      <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-foreground">
                            {isTeamScope ? `${myTeam} 확인 인원:` : '확인 인원:'} {scopedRead.length}명 / 전체 {totalCount}명
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            수신율: <span className="font-mono font-bold text-primary">{rate}%</span>
                          </div>
                        </div>
                        <span className="text-xl font-bold font-mono text-primary tabular-nums">
                          {rate}%
                        </span>
                      </div>

                      {/* Unread List */}
                      {scopedUnread.length > 0 && (
                        <div className="space-y-1">
                          <div className="font-bold text-destructive flex items-center gap-1">
                            <AlertTriangle size={12} /> {isTeamScope ? `${myTeam} 미확인 인원` : '미확인 인원'} ({scopedUnread.length}명)
                          </div>
                          <div className="max-h-28 overflow-y-auto p-2 rounded-lg bg-destructive/10 border border-destructive/20 space-y-1">
                            {scopedUnread.map(m => (
                              <div key={m.userId} className="text-foreground flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <span>{m.displayName}</span>
                                  <span className="text-2xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">{m.teamName || '1팀'}</span>
                                </span>
                                <span className="text-2xs text-destructive font-bold">미확인</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Read List */}
                      <div className="space-y-1">
                        <div className="font-bold text-primary flex items-center gap-1">
                          <CheckCircle2 size={12} /> {isTeamScope ? `${myTeam} 확인 완료 인원` : '확인 완료 인원'} ({scopedRead.length}명)
                        </div>
                        <div className="max-h-32 overflow-y-auto p-2 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
                          {scopedRead.map(m => (
                            <div key={m.userId} className="text-foreground flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5">
                                <span>{m.displayName}</span>
                                <span className="text-2xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{m.teamName || '1팀'}</span>
                              </span>
                              <span className="text-2xs text-muted-foreground font-mono">{new Date(m.readAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : null}

            <div className="pt-2 border-t border-border flex justify-end">
              <button
                onClick={() => setStatsNotice(null)}
                className="px-4 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-semibold text-foreground transition-colors cursor-pointer"
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