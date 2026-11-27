import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserCog, UserPlus, Users, Shuffle, RefreshCw, X, Check, Ban, RotateCcw,
  FileUp, History, Award, SlidersHorizontal, Layers, ShieldAlert, PhoneCall, Archive, GraduationCap, Shield,
  Lock, ShieldCheck, UserCheck, Sparkles, Mail
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { fetchCases, applyLocalAssignment, refreshLocalAssignments } from '../services/api';
import {
  ROLE_LABEL,
  OrgRole,
  DEFAULT_TIER1_PERMISSIONS,
  DEFAULT_TIER3_PERMISSIONS,
  OWNER_FULL_PERMISSIONS,
  getStandardRoleInfo,
  StandardRoleKey
} from '../services/org';
import {
  TeamMember, TeamInvite, fetchTeamMembers, updateTeamMember, updateMemberTeam, fetchPendingInvites,
  createInvite, cancelInvite, assignCases, revokeMemberSession, MemberSecurityProfile
} from '../services/team';
import { Case } from '../types';
import { checkOrgSeatLimit, OrgSeatStatus } from '../services/sessionGuard';
import { useVisibilityPolicy, saveVisibilityPolicy } from '../services/visibilityPolicy';
import { sendTeamInviteEmails } from '../services/mailService';
import TelegramBotSection from '../components/TelegramBotSection';
import DistributionPanel from '../components/team/DistributionPanel';
import ImportModal from '../components/ImportModal';
import RecordingSettingsPanel from '../components/team/RecordingSettingsPanel';
import AccessLogPanel from '../components/team/AccessLogPanel';
import BulkDistributionSection from '../components/team/BulkDistributionSection';
import BatchQualityPanel from '../components/team/BatchQualityPanel';
import DncManagementPanel from '../components/team/DncManagementPanel';
import AgentPerformancePanel from '../components/team/AgentPerformancePanel';
import TeamCallAuditPanel from '../components/team/TeamCallAuditPanel';
import LifecyclePolicyPanel from '../components/team/LifecyclePolicyPanel';
import BulkInviteModal from '../components/team/BulkInviteModal';
import MemberSecurityModal from '../components/team/MemberSecurityModal';
import AdminPermissionModal from '../components/team/AdminPermissionModal';
import MemberHrModal from '../components/team/MemberHrModal';
import { SeatExpansionModal } from '../components/billing/SeatExpansionModal';
import { AgentHRHub } from '../components/hr/AgentHRHub';
import {
  AssignmentLog, DistributeMode, REASON_LABEL, distributeCases,
  fetchAssignmentLogs, fetchImportBatches, ImportBatch
} from '../services/distribution';
import { usePartners, useStatuses, useInboundPaths } from '../services/queries';

type TeamTab = 'hr' | 'performance' | 'call_audit' | 'bulk_assign' | 'rules' | 'lifecycle' | 'quality' | 'dnc' | 'members';
type AssignFilter = 'unassigned' | 'all' | string; // string = 특정 멤버 userId

// tsconfig lib 설정상 Array.from(Set)이 unknown[]으로 추론되어 직접 변환
const setToArray = (s: Set<string>): string[] => {
  const out: string[] = [];
  s.forEach(v => out.push(v));
  return out;
};

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('ko-KR') : '-');
const maskPhone = (p?: string) => {
  const d = (p || '').replace(/[^0-9]/g, '');
  return d.length >= 8 ? `${d.slice(0, 3)}-****-${d.slice(-4)}` : (p || '');
};

const TeamLockedView: React.FC<{ title: string; desc: string }> = ({ title, desc }) => (
  <div className="bg-card text-card-foreground rounded-2xl p-8 sm:p-10 text-center border border-border shadow-xs max-w-lg mx-auto my-12 animate-scale-in">
    <div className="w-14 h-14 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xs">
      <Lock size={26} strokeWidth={1.75} />
    </div>
    <h3 className="text-base font-bold text-foreground mb-2">
      {title}
    </h3>
    <p className="text-xs text-muted-foreground leading-relaxed mb-4">
      {desc}<br />
      작업 권한이 필요한 경우 대표이사에게 <strong>[관리자 권한 승급(Tier 2/3)]</strong>을 요청하세요.
    </p>
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border text-xs font-semibold">
      🔒 권한 제한 (상위 티어 승인 필요)
    </span>
  </div>
);

export default function TeamPage() {
  const { org, user, isPlatformAdmin } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const queryClient = useQueryClient();

  const isOwner = org?.role === 'owner';
  const visibilityPolicy = useVisibilityPolicy();
  const handleToggleVisibilityPolicy = async (key: 'teamLeadShowInboundPath' | 'agentShowInboundPath' | 'teamLeadShowRealPartnerName' | 'agentShowRealPartnerName') => {
    try {
      await saveVisibilityPolicy({ [key]: !visibilityPolicy[key] });
      showToast('직원 등급별 노출 정책이 저장되었습니다.', 'success');
    } catch (e: any) {
      showToast(e?.message || '정책 저장 실패', 'error');
    }
  };
  const myTeamPerms = isOwner
    ? OWNER_FULL_PERMISSIONS.team
    : (org?.adminPermissions?.team || DEFAULT_TIER1_PERMISSIONS.team);

  // 상단 탭 상태
  const [activeTab, setActiveTab] = useState<TeamTab>('hr');

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // 초대 폼
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('agent');

  // 배정 필터 및 조작
  const [assignFilter, setAssignFilter] = useState<AssignFilter>('unassigned');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetUser, setTargetUser] = useState('');
  const [rrUsers, setRrUsers] = useState<Set<string>>(new Set());
  const [distMode, setDistMode] = useState<DistributeMode>('round_robin');
  const [distCounts, setDistCounts] = useState<Record<string, number>>({});
  const [showUpload, setShowUpload] = useState(false);
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [showSeatExpansion, setShowSeatExpansion] = useState(false);
  const [securityTargetMember, setSecurityTargetMember] = useState<TeamMember | null>(null);
  const [permissionTargetMember, setPermissionTargetMember] = useState<TeamMember | null>(null);
  const [hrTargetMember, setHrTargetMember] = useState<TeamMember | null>(null);
  const [logs, setLogs] = useState<AssignmentLog[]>([]);
  const [panelKey, setPanelKey] = useState(0);
  const [seatStatus, setSeatStatus] = useState<OrgSeatStatus | null>(null);

  const { data: cases = [] } = useQuery({ queryKey: ['cases'], queryFn: fetchCases });
  const { data: partners = [] } = usePartners();
  const { data: statusList = [] } = useStatuses();
  const { data: inboundPaths = [] } = useInboundPaths();

  const reload = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const [m, i, l, b, s] = await Promise.all([
        fetchTeamMembers(),
        fetchPendingInvites(org.orgId),
        fetchAssignmentLogs({ limit: 50 }).catch(() => [] as AssignmentLog[]),
        fetchImportBatches(30).catch(() => [] as ImportBatch[]),
        checkOrgSeatLimit(org.orgId).catch(() => null),
      ]);
      setMembers(m);
      setInvites(i);
      setLogs(l);
      setImportBatches(b);
      if (s) setSeatStatus(s);
    } catch (e: any) {
      showToast(`팀 정보를 불러오지 못했습니다: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [org, showToast]);

  useEffect(() => { reload(); }, [reload]);

  const activeMembers = useMemo(() => members.filter(m => m.status === 'active'), [members]);
  const agents = useMemo(() => activeMembers.filter(m => m.role === 'agent'), [activeMembers]);
  const memberName = useCallback((uid?: string) => {
    if (!uid) return '미배정';
    return members.find(m => m.userId === uid)?.displayName || '알 수 없음';
  }, [members]);

  const liveCases = useMemo(() => cases.filter((c: Case) => c.status !== '휴지통'), [cases]);
  const statuses = useMemo(() => Array.from(new Set(liveCases.map(c => c.status))).sort(), [liveCases]);
  const unassignedCount = useMemo(() => liveCases.filter(c => !c.assignedUserId).length, [liveCases]);

  const filteredCases = useMemo(() => {
    const q = search.trim();
    return liveCases.filter(c => {
      if (assignFilter === 'unassigned' && c.assignedUserId) return false;
      if (assignFilter !== 'unassigned' && assignFilter !== 'all' && c.assignedUserId !== assignFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (q && !(c.customerName || '').includes(q) && !(c.phone || '').includes(q) && !(c.inboundPath || '').includes(q)) return false;
      return true;
    }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [liveCases, assignFilter, statusFilter, search]);

  // 필터가 바뀌면 선택 초기화
  useEffect(() => { setSelected(new Set()); }, [assignFilter, statusFilter, search]);

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const visibleCases = useMemo(() => filteredCases.slice(0, 500), [filteredCases]);
  const allVisibleSelected = visibleCases.length > 0 && visibleCases.every(c => selected.has(c.caseId));
  const toggleAllVisible = () => setSelected(allVisibleSelected ? new Set() : new Set(visibleCases.map(c => c.caseId)));

  const afterAssign = async (msg: string) => {
    showToast(msg, 'success');
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ['cases'] });
    setPanelKey(k => k + 1);
    await reload();
  };

  const handleAssign = async () => {
    const ids = setToArray(selected);
    if (ids.length === 0) return showToast('배정할 리드를 고르세요', 'error');
    if (!targetUser) return showToast('누구에게 배정할지 고르세요', 'error');
    const uid = targetUser === '__none__' ? null : targetUser;
    setBusy(true);
    try {
      const n = await assignCases(ids, uid);
      applyLocalAssignment(ids, uid);
      await afterAssign(uid ? `${memberName(uid)}님에게 ${n}건 배정했습니다` : `${n}건 배정을 해제했습니다`);
    } catch (e: any) {
      showToast(`배정 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  // 나눠주기: 순번 / 균형(진행 중이 적은 사람부터) / 수량 지정
  const handleDistribute = async () => {
    const ids = setToArray(selected);
    const users = setToArray(rrUsers);
    if (ids.length === 0) return showToast('나눠줄 리드를 고르세요', 'error');
    if (users.length === 0) return showToast('나눠줄 상담원을 한 명 이상 체크하세요', 'error');
    const counts = distMode === 'quantity' ? users.map(u => distCounts[u] || 0) : undefined;
    if (counts && counts.reduce((a, b) => a + b, 0) === 0) return showToast('상담원마다 건수를 입력하세요', 'error');
    const label = distMode === 'round_robin' ? '차례대로' : distMode === 'balanced' ? '진행 중 리드가 적은 사람부터' : '정한 건수만큼';
    const ok = await confirm({
      title: '리드 자동 나눠주기',
      message: `${ids.length}건을 상담원 ${users.length}명에게 ${label} 나눠줄까요?`,
      confirmText: '나눠주기 실행',
      cancelText: '취소',
      variant: 'default',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await distributeCases(ids, distMode, users, counts);
      await refreshLocalAssignments(ids);
      const summary = users.map(u => `${memberName(u)} ${result[u] || 0}건`).join(', ');
      await afterAssign(`나눠주기 완료: ${summary}`);
    } catch (e: any) {
      showToast(`나눠주기 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async () => {
    if (!org) return;
    setBusy(true);
    try {
      const cleanEmail = inviteEmail.trim().toLowerCase();
      await createInvite(org.orgId, inviteEmail, inviteRole, inviteName);
      const mailRes = await sendTeamInviteEmails({
        orgName: org.orgName || 'LeadMaster CRM',
        inviterName: org.displayName || user?.email || '관리자',
        invites: [{ email: cleanEmail, displayName: inviteName.trim() || undefined, role: inviteRole }],
      });
      if (mailRes.sentCount > 0) {
        showToast(`${cleanEmail}님에게 초대 메일을 발송했습니다. 구글 계정 로그인 시 자동 연결됩니다.`, 'success');
      } else {
        showToast(`${cleanEmail} 초대가 등록되었습니다. (메일 발송 보류: ${mailRes.failed[0]?.reason || '발송 설정 확인 필요'} — 해당 구글 계정 로그인 시 자동 연결됩니다)`, 'info');
      }
      setInviteEmail('');
      setInviteName('');
      await reload();
    } catch (e: any) {
      showToast(`초대 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleResendInviteEmail = async (inv: TeamInvite) => {
    if (!org) return;
    setBusy(true);
    try {
      const mailRes = await sendTeamInviteEmails({
        orgName: org.orgName || 'LeadMaster CRM',
        inviterName: org.displayName || user?.email || '관리자',
        invites: [{ email: inv.email, displayName: inv.displayName, role: inv.role, expiresAt: inv.expiresAt }],
      });
      if (mailRes.sentCount > 0) {
        showToast(`${inv.email}님에게 초대 메일을 다시 발송했습니다.`, 'success');
      } else {
        showToast(`메일 발송 실패: ${mailRes.failed[0]?.reason || '발송 설정을 확인해주세요.'}`, 'error');
      }
    } catch (e: any) {
      showToast(`메일 발송 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleMemberChange = async (m: TeamMember, changes: Parameters<typeof updateTeamMember>[1], confirmMsg?: string) => {
    if (confirmMsg) {
      const ok = await confirm({
        title: '팀원 정보 변경',
        message: confirmMsg,
        confirmText: '확인',
        cancelText: '취소',
        variant: 'default',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await updateTeamMember(m.userId, changes);
      showToast('변경했습니다', 'success');
      await reload();
    } catch (e: any) {
      showToast(`변경 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSecurityProfile = async (userId: string, profile: MemberSecurityProfile) => {
    setBusy(true);
    try {
      await updateTeamMember(userId, { securityProfile: profile });
      showToast('상담원 보안 설정이 저장되었습니다.', 'success');
      await reload();
    } catch (e: any) {
      showToast(`보안 설정 저장 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeSession = async (userId: string) => {
    if (!org) return;
    setBusy(true);
    try {
      await revokeMemberSession(org.orgId, userId);
      showToast('상담원의 세션이 즉시 강제 파기되었습니다.', 'success');
      await reload();
    } catch (e: any) {
      showToast(`세션 파기 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const canEditRole = (m: TeamMember) => m.userId !== org?.userId && (org?.role === 'owner' || m.role !== 'owner');

  if (!org) {
    return <div className="p-6 text-gray-500">회사 정보를 확인하는 중입니다. 잠시 후 다시 열어주세요.</div>;
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 sm:space-y-6">
      {/* 상단 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-border">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserCog size={20} strokeWidth={1.75} className="text-primary shrink-0" />
            <span className="truncate">팀 관리 & 콜센터 운영</span>
          </h1>
          <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">
            {org.orgName} · 상담원 성과/콜 분석, 인센티브, 15,000건 스마트 대량 배정, DB 회차 품질 관리
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Link
            to="/training"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 text-xs font-medium text-foreground bg-muted hover:bg-muted/80 border border-border rounded-lg shadow-2xs transition-colors whitespace-nowrap"
          >
            <GraduationCap size={13} strokeWidth={1.75} />
            <span className="sm:hidden">교육 센터</span>
            <span className="hidden sm:inline">신입 트레이닝 센터</span>
          </Link>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            title="케이스 일괄/간편 등록 (엑셀 대량 업로드, AI 영수증/신청서 OCR, 시트 입력, 간편 수기 등록)"
          >
            <FileUp size={13} strokeWidth={1.75} />
            <span className="sm:hidden">신규 DB</span>
            <span className="hidden sm:inline">신규 DB 등록</span>
          </button>
          <button
            onClick={reload}
            disabled={loading || busy}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors disabled:opacity-50 cursor-pointer"
            title="새로고침"
          >
            <RefreshCw size={13} strokeWidth={1.75} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 모바일 전용: 전체 메뉴 드롭다운 + 주요 4개 퀵 칩 */}
      <div className="md:hidden space-y-2">
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as any)}
          className="w-full h-10 px-3 rounded-xl border border-border bg-card text-sm font-semibold text-foreground shadow-2xs"
          aria-label="팀 관리 메뉴 선택"
        >
          <option value="hr">👥 직원 HR 종합 관제 (근태·급여)</option>
          <option value="performance">🏆 팀원 성과 · 인센티브</option>
          <option value="call_audit">📞 콜 활동 · AI 요약</option>
          <option value="bulk_assign">🔀 대용량 리드 배정 {unassignedCount > 0 ? `(${unassignedCount}건)` : ''}</option>
          <option value="rules">⚙️ 배분 규칙 · 로테이션</option>
          <option value="lifecycle">📦 DB 수명주기 · 보관</option>
          <option value="quality">📊 회차별 DB 품질</option>
          <option value="dnc">🚫 수신거부 (전화금지)</option>
          <option value="members">👤 멤버 & 설정</option>
        </select>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { id: 'hr', label: 'HR 관제' },
            { id: 'performance', label: '성과·수당' },
            { id: 'bulk_assign', label: unassignedCount > 0 ? `배정(${unassignedCount > 99 ? '99+' : unassignedCount})` : '리드 배정' },
            { id: 'members', label: '멤버' },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveTab(chip.id as any)}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold border transition-colors truncate ${
                activeTab === chip.id
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-card text-muted-foreground border-border'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* 데스크톱 8대 전문 탭 네비게이션 (Shadcn Segmented Control) */}
      <div className="hidden md:flex bg-muted/70 p-1 rounded-lg border border-border/60 items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('hr')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap btn-tactile ${
            activeTab === 'hr'
              ? 'bg-background text-foreground shadow-2xs border border-border font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <Users size={13} strokeWidth={1.75} className="text-primary" />
          <span>직원 HR 종합 관제</span>
        </button>

        <button
          onClick={() => setActiveTab('performance')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap btn-tactile ${
            activeTab === 'performance'
              ? 'bg-background text-foreground shadow-2xs border border-border font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <Award size={13} strokeWidth={1.75} />
          <span>팀원 성과 · 인센티브</span>
          {!isOwner && !myTeamPerms.canViewPerformance && <Lock size={11} className="text-amber-500 shrink-0" strokeWidth={1.75} />}
        </button>

        <button
          onClick={() => setActiveTab('call_audit')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap btn-tactile ${
            activeTab === 'call_audit'
              ? 'bg-background text-foreground shadow-2xs border border-border font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <PhoneCall size={13} strokeWidth={1.75} />
          <span>콜 활동 · AI 요약</span>
        </button>

        <button
          onClick={() => setActiveTab('bulk_assign')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap btn-tactile ${
            activeTab === 'bulk_assign'
              ? 'bg-background text-foreground shadow-2xs border border-border font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <Shuffle size={13} strokeWidth={1.75} />
          <span>대용량 리드 배정</span>
          {unassignedCount > 0 && (
            <span className="px-1.5 py-0.2 text-2xs font-mono font-medium rounded bg-destructive/10 text-destructive border border-destructive/20 tabular-nums">
              {unassignedCount > 999 ? '999+' : unassignedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap btn-tactile ${
            activeTab === 'rules'
              ? 'bg-background text-foreground shadow-2xs border border-border font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <SlidersHorizontal size={13} strokeWidth={1.75} />
          <span>배분 규칙 · 로테이션</span>
          {!isOwner && !myTeamPerms.canModifyRules && <Lock size={11} className="text-amber-500 shrink-0" strokeWidth={1.75} />}
        </button>

        <button
          onClick={() => setActiveTab('lifecycle')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap btn-tactile ${
            activeTab === 'lifecycle'
              ? 'bg-background text-foreground shadow-2xs border border-border font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <Archive size={13} strokeWidth={1.75} />
          <span>DB 수명주기 · 보관</span>
          {!isOwner && !myTeamPerms.canModifyRules && <Lock size={11} className="text-amber-500 shrink-0" strokeWidth={1.75} />}
        </button>

        <button
          onClick={() => setActiveTab('quality')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap btn-tactile ${
            activeTab === 'quality'
              ? 'bg-background text-foreground shadow-2xs border border-border font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <Layers size={13} strokeWidth={1.75} />
          <span>회차별 DB 품질</span>
        </button>

        <button
          onClick={() => setActiveTab('dnc')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap btn-tactile ${
            activeTab === 'dnc'
              ? 'bg-background text-foreground shadow-2xs border border-border font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <ShieldAlert size={13} strokeWidth={1.75} />
          <span>수신거부 (전화금지)</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap btn-tactile ${
            activeTab === 'members'
              ? 'bg-background text-foreground shadow-2xs border border-border font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <Users size={13} strokeWidth={1.75} />
          <span>멤버 & 설정</span>
        </button>
      </div>

      {/* 탭 콘텐츠 영역 (스무스 전환) */}
      <div key={activeTab} className="animate-tab-in space-y-6">
      {/* 탭 0: 올인원 HR 종합 관제 (근태·활동·실적·급여) */}
      {activeTab === 'hr' && (
        <AgentHRHub members={members} cases={cases} />
      )}

      {/* 탭 1: 팀원 성과 & 인센티브 */}
      {activeTab === 'performance' && (
        !isOwner && !myTeamPerms.canViewPerformance ? (
          <TeamLockedView
            title="팀원 성과 & 인센티브 보드 잠김"
            desc="상담원별 수당 산출 및 성과 지표는 Tier 2(수석 팀장) 이상 또는 대표이사 승인이 필요합니다."
          />
        ) : (
          <AgentPerformancePanel />
        )
      )}

      {/* 탭: 콜 활동 · AI 요약 및 대화록 모니터링 */}
      {activeTab === 'call_audit' && (
        <TeamCallAuditPanel members={members} />
      )}

      {/* 탭 2: 대용량 리드 배정 (스마트 일괄 배분 + 세부 수동 배정 테이블) */}
      {activeTab === 'bulk_assign' && (
        <div className="space-y-6">
          {!isOwner && !myTeamPerms.canBulkDistribute ? (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock size={16} className="shrink-0 text-amber-600" />
                <span>스마트 대량 배분(균등/가중치 자동 배분)은 Tier 2(수석 팀장) 이상 권한이 필요합니다. Tier 1 플로어 팀장은 아래 [정밀 개별/필터 배정]을 사용하실 수 있습니다.</span>
              </div>
            </div>
          ) : (
            <BulkDistributionSection
              unassignedCount={unassignedCount}
              members={members}
              importBatches={importBatches}
              inboundPaths={inboundPaths}
              onDistributed={() => {
                queryClient.invalidateQueries({ queryKey: ['cases'] });
                reload();
              }}
            />
          )}

          {/* 세부 선택 배정 (소규모/개별 지정) */}
          <section className="bg-card rounded-xl border border-border shadow-2xs">
            <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-2">
              <Shuffle size={18} className="text-primary" />
              <h2 className="font-bold text-foreground">정밀 개별/필터 배정</h2>
              <span className="text-xs text-muted-foreground">직접 체크박스로 특정 리드를 골라 배정하거나 해제할 수 있습니다</span>
            </div>

            <div className="px-5 py-3 flex flex-wrap gap-2 items-center border-b border-border bg-card">
              <select
                value={assignFilter}
                onChange={e => setAssignFilter(e.target.value)}
                className="border border-border rounded-lg px-3 py-1.5 text-xs bg-muted/40 text-foreground font-mono"
              >
                <option value="unassigned">미배정 리드만</option>
                <option value="all">전체 리드</option>
                {activeMembers.map(m => (
                  <option key={m.userId} value={m.userId}>{m.displayName} 담당</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="border border-border rounded-lg px-3 py-1.5 text-xs bg-muted/40 text-foreground"
              >
                <option value="">모든 상태</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="이름·번호·유입경로 검색"
                className="flex-1 min-w-[180px] border border-border rounded-lg px-3 py-1.5 text-xs bg-muted/40 text-foreground font-mono placeholder:text-muted-foreground"
              />
              <span className="text-xs text-muted-foreground font-mono">
                {filteredCases.length.toLocaleString()}건 중 {selected.size.toLocaleString()}건 선택
              </span>
            </div>

            {/* 개별 배정 실행 바 */}
            <div className="px-5 py-3 grid md:grid-cols-2 gap-3 border-b border-border bg-muted/30">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-foreground">선택한 리드를</span>
                <select
                  value={targetUser}
                  onChange={e => setTargetUser(e.target.value)}
                  className="border border-border rounded-lg px-3 py-1.5 text-xs bg-card text-foreground"
                >
                  <option value="">— 담당자 선택 —</option>
                  {activeMembers.map(m => (
                    <option key={m.userId} value={m.userId}>{m.displayName} ({ROLE_LABEL[m.role]})</option>
                  ))}
                  <option value="__none__">배정 해제 (미배정으로 전환)</option>
                </select>
                <button
                  onClick={handleAssign}
                  disabled={busy || selected.size === 0 || !targetUser}
                  className="px-3.5 py-1.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                >
                  <Check size={14} /> 배정 적용
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">체크 인원 나눠주기:</span>
                <select
                  value={distMode}
                  onChange={e => setDistMode(e.target.value as DistributeMode)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-white"
                >
                  <option value="round_robin">순번 (1/N)</option>
                  <option value="balanced">보유량 균형</option>
                  <option value="quantity">수량 직접입력</option>
                </select>

                {agents.length === 0 && <span className="text-xs text-gray-500 dark:text-gray-400">상담원이 없습니다</span>}
                {agents.map(a => (
                  <label key={a.userId} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={rrUsers.has(a.userId)}
                      onChange={() => setRrUsers(prev => {
                        const n = new Set(prev);
                        n.has(a.userId) ? n.delete(a.userId) : n.add(a.userId);
                        return n;
                      })}
                    />
                    {a.displayName}
                    {distMode === 'quantity' && rrUsers.has(a.userId) && (
                      <input
                        type="number"
                        min={0}
                        value={distCounts[a.userId] ?? ''}
                        placeholder="건"
                        onChange={e => setDistCounts({
                          ...distCounts,
                          [a.userId]: Math.max(0, parseInt(e.target.value, 10) || 0)
                        })}
                        onClick={e => e.stopPropagation()}
                        className="w-14 border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-sm dark:bg-gray-700 dark:text-white"
                      />
                    )}
                  </label>
                ))}
                {agents.length > 1 && (
                  <button onClick={() => setRrUsers(new Set(agents.map(a => a.userId)))} className="text-xs text-blue-600 hover:underline">
                    모두
                  </button>
                )}
                <button
                  onClick={handleDistribute}
                  disabled={busy || selected.size === 0 || rrUsers.size === 0}
                  className="px-3 py-1.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 shadow-sm"
                >
                  <Shuffle size={14} /> 분배
                </button>
              </div>
            </div>

            {/* 테이블 */}
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted text-muted-foreground font-mono">
                  <tr>
                    <th className="sticky top-0 z-10 bg-muted px-4 py-2.5 w-10 text-center border-b border-border">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="rounded border-input text-primary focus:ring-primary cursor-pointer" />
                    </th>
                    <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 font-semibold border-b border-border">고객명</th>
                    <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 font-semibold border-b border-border">연락처</th>
                    <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 font-semibold border-b border-border">상태</th>
                    <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 font-semibold border-b border-border">유입경로</th>
                    <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 font-semibold border-b border-border">등록일</th>
                    <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 font-semibold border-b border-border">담당자</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleCases.map(c => (
                    <tr
                      key={c.caseId}
                      onClick={() => toggle(c.caseId)}
                      className={`cursor-pointer transition-colors ${
                        selected.has(c.caseId)
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted/40'
                      }`}
                    >
                      <td className="px-4 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(c.caseId)} onChange={() => toggle(c.caseId)} className="rounded border-input text-primary focus:ring-primary cursor-pointer" />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{c.customerName}</td>
                      <td className="px-3 py-2.5 text-muted-foreground font-mono tabular-nums">{maskPhone(c.phone)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{c.status}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{c.inboundPath}</td>
                      <td className="px-3 py-2.5 text-muted-foreground font-mono">{fmtDate(c.createdAt)}</td>
                      <td className={`px-3 py-2.5 ${c.assignedUserId ? 'text-foreground font-medium' : 'text-amber-500 font-semibold'}`}>
                        {memberName(c.assignedUserId)}
                      </td>
                    </tr>
                  ))}
                  {filteredCases.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground font-mono">조건에 맞는 리드가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {filteredCases.length > 500 && (
                <div className="px-5 py-2.5 text-xs text-muted-foreground border-t border-border bg-muted/20 font-mono">
                  화면에는 500건까지만 보입니다. "모두 선택"은 보이는 500건만 고릅니다. 필터로 범위를 좁히거나 상단 대용량 배분을 이용하세요.
                </div>
              )}
            </div>
          </section>

          {/* 최근 배정 기록 */}
          <section className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <History size={16} className="text-primary" />
              <h2 className="font-bold text-foreground text-sm">최근 배정 기록</h2>
              <span className="text-xs text-muted-foreground font-mono">최근 50건 · 배정 이력 추적</span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted text-muted-foreground font-mono">
                  <tr>
                    <th className="sticky top-0 z-10 bg-muted text-left px-4 py-2.5 font-semibold whitespace-nowrap border-b border-border">일시</th>
                    <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 font-semibold border-b border-border">대상 고객</th>
                    <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 font-semibold whitespace-nowrap border-b border-border">배정 경로</th>
                    <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 font-semibold border-b border-border">사유</th>
                    <th className="sticky top-0 z-10 bg-muted text-left px-4 py-2.5 font-semibold border-b border-border">처리자 · 메모</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map(l => {
                    const cs = liveCases.find(c => c.caseId === l.caseId);
                    return (
                      <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2 text-muted-foreground font-mono whitespace-nowrap">
                          {new Date(l.createdAt).toLocaleString('ko-KR', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-3 py-2 font-medium text-foreground">
                          {cs?.customerName || l.caseId}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap font-mono">
                          {l.fromUser ? memberName(l.fromUser) : '미배정'} → <span className="text-primary font-semibold">{l.toUser ? memberName(l.toUser) : '미배정'}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded-md text-2xs font-mono font-medium bg-muted text-foreground border border-border">
                            {REASON_LABEL[l.reason] || l.reason}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground font-mono">
                          <span className="text-foreground">{l.byUser ? memberName(l.byUser) : '시스템'}</span>{l.note ? ` · ${l.note}` : ''}
                        </td>
                      </tr>
                    );
                  })}
                  {logs.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground font-mono">아직 배정 기록이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* 탭 3: 리드 배분 규칙 */}
      {activeTab === 'rules' && (
        !isOwner && !myTeamPerms.canModifyRules ? (
          <TeamLockedView
            title="배분 규칙 & 로테이션 설정 잠김"
            desc="라운드로빈 분배 쿼터 및 우선순위 규칙 수정은 Tier 3(총괄 실장) 또는 대표이사 전용입니다."
          />
        ) : (
          <div key={panelKey}>
            <DistributionPanel
              orgId={org.orgId}
              statuses={statusList as string[]}
              onChanged={() => {
                queryClient.invalidateQueries({ queryKey: ['cases'] });
                reload();
              }}
            />
          </div>
        )
      )}

      {/* 탭: DB 수명주기 & 보관 관리 */}
      {activeTab === 'lifecycle' && (
        !isOwner && !myTeamPerms.canModifyRules ? (
          <TeamLockedView
            title="DB 수명주기 & 보관 정책 잠김"
            desc="부재 자동 회수 시간 및 장기 미컨택 리드 정리 규칙은 Tier 3(총괄 실장) 또는 대표이사 전용입니다."
          />
        ) : (
          <LifecyclePolicyPanel
            cases={cases}
            onChanged={() => {
              queryClient.invalidateQueries({ queryKey: ['cases'] });
              reload();
            }}
          />
        )
      )}

      {/* 탭 4: 회차별 DB 품질 분석 */}
      {activeTab === 'quality' && (
        <BatchQualityPanel />
      )}

      {/* 탭 5: 수신거부 DNC */}
      {activeTab === 'dnc' && (
        <DncManagementPanel />
      )}

      {/* 탭 6: 멤버 & 환경설정 */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          {/* 멤버 목록 */}
          <section className="bg-card rounded-xl border border-border shadow-xs">
            <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users size={16} strokeWidth={1.75} className="text-primary" />
                <h2 className="font-semibold text-sm text-foreground">멤버 {members.length}명</h2>
                <span className="text-2xs font-mono text-muted-foreground">
                  사용 중 {activeMembers.length}명
                </span>
              </div>
              {/* 4대 표준 직급 분포 현황 뱃지 */}
              <div className="flex flex-wrap items-center gap-1 text-2xs font-mono">
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                  👑 대표 {members.filter(m => m.status === 'active' && m.role === 'owner').length}
                </span>
                <span className="px-2 py-0.5 rounded bg-muted text-foreground border border-border font-medium">
                  🎖️ 총괄 {members.filter(m => m.status === 'active' && m.role === 'admin' && m.adminPermissions?.tier === 3).length}
                </span>
                <span className="px-2 py-0.5 rounded bg-muted text-foreground border border-border font-medium">
                  🛡️ 팀장 {members.filter(m => m.status === 'active' && m.role === 'admin' && (m.adminPermissions?.tier || 1) < 3).length}
                </span>
                <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                  🎧 상담원 {members.filter(m => m.status === 'active' && m.role === 'agent').length}
                </span>
              </div>
            </div>
            {/* TM대표 · 총괄관리자 전용: 등급별 유입경로 및 거래처명(방명) 노출 정책 */}
            {(isOwner || org?.adminPermissions?.tier === 3) && (
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-primary shrink-0" />
                  <div>
                    <span className="font-bold text-foreground">등급별 영업기밀 노출 설정</span>
                    <span className="text-2xs text-muted-foreground ml-2 hidden sm:inline">
                      TM대표·총괄(Tier 3)은 항상 전체 노출 · 아래 토글로 팀장/상담원 노출 여부를 일괄 제어합니다 (개별 예외는 멤버별 [보안] 버튼).
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleVisibilityPolicy('teamLeadShowInboundPath')}
                    className={`px-2.5 py-1 rounded-lg border text-2xs font-semibold transition-colors cursor-pointer ${
                      visibilityPolicy.teamLeadShowInboundPath
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-card text-muted-foreground border-border'
                    }`}
                  >
                    팀장 유입정보: {visibilityPolicy.teamLeadShowInboundPath ? '노출' : '숨김'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleVisibilityPolicy('agentShowInboundPath')}
                    className={`px-2.5 py-1 rounded-lg border text-2xs font-semibold transition-colors cursor-pointer ${
                      visibilityPolicy.agentShowInboundPath
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-card text-muted-foreground border-border'
                    }`}
                  >
                    상담원 유입정보: {visibilityPolicy.agentShowInboundPath ? '노출' : '숨김'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleVisibilityPolicy('teamLeadShowRealPartnerName')}
                    className={`px-2.5 py-1 rounded-lg border text-2xs font-semibold transition-colors cursor-pointer ${
                      visibilityPolicy.teamLeadShowRealPartnerName
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    }`}
                  >
                    팀장 거래처명: {visibilityPolicy.teamLeadShowRealPartnerName ? '실명' : '텔레그램 방명'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleVisibilityPolicy('agentShowRealPartnerName')}
                    className={`px-2.5 py-1 rounded-lg border text-2xs font-semibold transition-colors cursor-pointer ${
                      visibilityPolicy.agentShowRealPartnerName
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    }`}
                  >
                    상담원 거래처명: {visibilityPolicy.agentShowRealPartnerName ? '실명' : '텔레그램 방명'}
                  </button>
                </div>
              </div>
            )}
            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-border">
              {members.map(m => {
                const roleInfo = getStandardRoleInfo(m.role, m.adminPermissions?.tier);
                return (
                <div key={m.userId} className={`px-4 py-3 space-y-2 ${m.status === 'disabled' ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <button
                        type="button"
                        onClick={() => setHrTargetMember(m)}
                        className="font-medium text-foreground hover:text-primary hover:underline text-left cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>{m.displayName}</span>
                        <UserCheck size={13} className="text-muted-foreground" />
                      </button>
                      {m.userId === org.userId && <span className="ml-1 text-xs text-primary font-mono font-semibold">(나)</span>}
                      {m.status === 'disabled' && <span className="ml-2 text-2xs font-mono text-destructive px-1.5 py-0.2 rounded bg-destructive/10 border border-destructive/20 font-medium">사용 중지</span>}
                    </div>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="text-2xs px-2 py-0.5 rounded bg-muted/50 text-foreground border border-border">
                        {m.teamName || '1팀'}
                      </span>
                      <span className={`text-2xs px-2 py-0.5 rounded font-medium border ${roleInfo.colorClass}`}>
                        {roleInfo.badgeText}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">{m.email}</p>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex gap-3">
                      <span className="text-muted-foreground">담당 <strong className="text-foreground">{m.assignedCases.toLocaleString()}</strong>건</span>
                      <span className="text-muted-foreground">로그인 {fmtDate(m.lastSignInAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setHrTargetMember(m)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                      >
                        <UserCheck size={13} /> 인사 정보
                      </button>
                      {canEditRole(m) && (isOwner || myTeamPerms.canDisableMembers) && (m.status === 'active' ? (
                        <button
                          disabled={busy}
                          onClick={() => handleMemberChange(m, { status: 'disabled' },
                            `${m.displayName}님을 사용 중지할까요?\n바로 로그인과 데이터 접근이 막힙니다. 담당 리드 ${m.assignedCases}건은 그대로 남으니 다른 상담원에게 다시 배정하세요.`)}
                          className="inline-flex items-center gap-1 text-destructive hover:underline disabled:opacity-50 cursor-pointer"
                        >
                          <Ban size={13} /> 중지
                        </button>
                      ) : (
                        <button
                          disabled={busy}
                          onClick={() => handleMemberChange(m, { status: 'active' })}
                          className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-50 cursor-pointer"
                        >
                          <RotateCcw size={13} /> 복원
                        </button>
                      ))}
                    </div>
                  </div>
                  {canEditRole(m) && (isOwner || myTeamPerms.canManageSecurity) && (
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setSecurityTargetMember(m)}
                        className="inline-flex items-center gap-1 text-xs text-primary font-mono hover:underline cursor-pointer"
                      >
                        <Shield size={13} />
                        <span>보안 설정 ({
                          !m.securityProfile?.watermark && !m.securityProfile?.appCaptureBlock && !m.securityProfile?.masking && !m.securityProfile?.anomalyAlert
                            ? '🌟 팀장급 해제'
                            : '🛡️ 보안 적용'
                        })</span>
                      </button>
                    </div>
                  )}
                  {isOwner && m.role === 'admin' && (
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700/50">
                      <button
                        type="button"
                        onClick={() => setPermissionTargetMember(m)}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                      >
                        <ShieldCheck size={13} />
                        <span>관리자 권한 설정 ({m.adminPermissions?.tier || 1}등급)</span>
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
              {!loading && members.length === 0 && (
                <div className="px-5 py-6 text-center text-gray-500 dark:text-gray-400">멤버 정보를 불러오지 못했습니다.</div>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[920px]">
                <thead className="bg-muted/40 text-muted-foreground text-2xs font-mono border-b border-border select-none">
                  <tr>
                    <th className="text-left px-5 py-2.5 whitespace-nowrap min-w-[140px]">이름</th>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap min-w-[90px]">소속 팀</th>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap min-w-[180px]">이메일</th>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap min-w-[100px]">역할</th>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap min-w-[150px]">업무 모드</th>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap min-w-[140px]">보안 통제</th>
                    <th className="text-right px-3 py-2.5 whitespace-nowrap min-w-[90px]">담당 리드</th>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap min-w-[120px]">최근 로그인</th>
                    <th className="text-right px-5 py-2.5 whitespace-nowrap min-w-[120px]">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map(m => (
                    <tr key={m.userId} className={m.status === 'disabled' ? 'opacity-50' : ''}>
                      <td className="px-5 py-2.5 font-medium whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setHrTargetMember(m)}
                          className="font-medium text-foreground hover:text-primary hover:underline transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          title="직원 인사 상세 정보 관리 열기"
                        >
                          <span>{m.displayName}</span>
                          <UserCheck size={13} className="text-muted-foreground hover:text-primary transition-colors" />
                        </button>
                        {m.userId === org.userId && <span className="ml-1 text-xs text-primary font-mono font-semibold">(나)</span>}
                        {m.status === 'disabled' && <span className="ml-2 text-2xs font-mono text-destructive px-1.5 py-0.2 rounded bg-destructive/10 border border-destructive/20 font-medium whitespace-nowrap">사용 중지</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {canEditRole(m) && (isOwner || myTeamPerms.canModifyRules) ? (
                          <select
                            value={m.teamName || '1팀'}
                            disabled={busy}
                            onChange={async (e) => {
                              try {
                                await updateMemberTeam(m.userId, e.target.value);
                                showToast(`${m.displayName}님의 소속 팀이 '${e.target.value}'(으)로 변경되었습니다.`, 'success');
                                reload();
                              } catch (err: any) {
                                showToast(`팀 변경 실패: ${err.message}`, 'error');
                              }
                            }}
                            className="text-xs font-semibold border border-border rounded px-2 py-1 bg-muted/50 text-foreground font-mono cursor-pointer"
                          >
                            <option value="1팀">1팀</option>
                            <option value="2팀">2팀</option>
                            <option value="3팀">3팀</option>
                            <option value="본부">본부</option>
                          </select>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted/50 text-foreground border border-border font-mono">
                            {m.teamName || '1팀'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{m.email}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {canEditRole(m) && m.role !== 'owner' ? (
                            (() => {
                              const currentRoleKey: StandardRoleKey =
                                m.role === 'owner'
                                  ? 'owner'
                                  : m.role === 'admin' && m.adminPermissions?.tier === 3
                                  ? 'general_admin'
                                  : m.role === 'admin'
                                  ? 'team_admin'
                                  : 'agent';

                              return (
                                <select
                                  value={currentRoleKey}
                                  disabled={busy}
                                  onChange={async (e) => {
                                    const targetKey = e.target.value as StandardRoleKey;
                                    if (targetKey === 'agent') {
                                      await handleMemberChange(m, { role: 'agent' });
                                      showToast(`${m.displayName}님의 역할이 '상담원'으로 변경되었습니다.`, 'success');
                                    } else if (targetKey === 'team_admin') {
                                      const nextPerms = m.adminPermissions && m.adminPermissions.tier < 3
                                        ? m.adminPermissions
                                        : DEFAULT_TIER1_PERMISSIONS;
                                      await handleMemberChange(m, { role: 'admin', adminPermissions: nextPerms });
                                      showToast(`${m.displayName}님의 역할이 '팀장 (중간 관리자)'으로 변경되었습니다.`, 'success');
                                    } else if (targetKey === 'general_admin') {
                                      await handleMemberChange(m, { role: 'admin', adminPermissions: DEFAULT_TIER3_PERMISSIONS });
                                      showToast(`${m.displayName}님의 역할이 '총괄 관리자 (Tier 3 전사 운영)'로 승격되었습니다.`, 'success');
                                    } else if (targetKey === 'owner') {
                                      await handleMemberChange(m, { role: 'owner' });
                                      showToast(`${m.displayName}님의 역할이 '대표이사'로 변경되었습니다.`, 'success');
                                    }
                                  }}
                                  className="text-xs font-bold border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer shadow-2xs focus:ring-2 focus:ring-indigo-500"
                                >
                                  <option value="agent">🎧 상담원</option>
                                  <option value="team_admin">🛡️ 팀장 (중간 관리자)</option>
                                  <option value="general_admin">🎖️ 총괄 관리자 (전사 운영)</option>
                                  {org.role === 'owner' && <option value="owner">👑 대표이사</option>}
                                </select>
                              );
                            })()
                          ) : (
                            (() => {
                              const roleInfo = getStandardRoleInfo(m.role, m.adminPermissions?.tier);
                              return (
                                <span className={`text-xs px-2.5 py-1 rounded-lg font-bold whitespace-nowrap shadow-2xs ${roleInfo.colorClass}`}>
                                  {roleInfo.badgeText}
                                </span>
                              );
                            })()
                          )}

                          {isOwner && m.role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => setPermissionTargetMember(m)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors shrink-0 cursor-pointer shadow-2xs bg-card hover:bg-muted text-foreground border-border font-mono"
                              title={m.adminPermissions?.tier === 3 ? "총괄 관리자 전사 권한 세부 설정" : "팀장 스코프 권한 세부 설정"}
                            >
                              <ShieldCheck size={12} className="text-primary" />
                              <span>{m.adminPermissions?.tier === 3 ? 'Tier 3 (총괄 권한)' : `Tier ${m.adminPermissions?.tier || 1} 설정`}</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {m.role === 'agent' && canEditRole(m) ? (
                          <select
                            value={m.uiMode || 'standard'}
                            disabled={busy}
                            onChange={e => handleMemberChange(m, { uiMode: e.target.value as 'standard' | 'lite_only' })}
                            className={`text-xs font-semibold rounded-lg px-2 py-1 border transition-colors ${
                              m.uiMode === 'lite_only'
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'bg-muted/50 text-foreground border-border'
                            }`}
                          >
                            <option value="standard">일반 모드</option>
                            <option value="lite_only">⚡ 간편콜 전용 (신입)</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                            m.uiMode === 'lite_only'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'text-muted-foreground'
                          }`}>
                            {m.uiMode === 'lite_only' ? '⚡ 간편콜 전용' : '일반'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {canEditRole(m) && (isOwner || myTeamPerms.canManageSecurity) ? (
                          <button
                            type="button"
                            onClick={() => setSecurityTargetMember(m)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover:bg-muted cursor-pointer bg-card border-border text-foreground shadow-2xs whitespace-nowrap shrink-0"
                          >
                            <Shield size={13} className="text-primary shrink-0" />
                            <span className="whitespace-nowrap font-mono">
                              {!m.securityProfile?.watermark && !m.securityProfile?.appCaptureBlock && !m.securityProfile?.masking && !m.securityProfile?.anomalyAlert
                                ? '팀장급 (해제)'
                                : m.securityProfile?.watermark && m.securityProfile?.appCaptureBlock && m.securityProfile?.masking && m.securityProfile?.anomalyAlert
                                  ? '표준 보안'
                                  : '맞춤 보안'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">보안 권한 제한</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{m.assignedCases.toLocaleString()}건</td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(m.lastSignInAt)}</td>
                      <td className="px-5 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setHrTargetMember(m)}
                            className="inline-flex items-center gap-1 text-xs font-mono text-primary hover:underline whitespace-nowrap cursor-pointer"
                            title="직원 인사 상세 정보 관리 (전화번호, 주소, 입사일, 생일, 급여계좌, 비상연락망 등)"
                          >
                            <UserCheck size={13} /> 인사 정보
                          </button>
                          {canEditRole(m) && (isOwner || myTeamPerms.canDisableMembers) ? (
                          m.status === 'active' ? (
                            <button
                              disabled={busy}
                              onClick={() => handleMemberChange(m, { status: 'disabled' },
                                `${m.displayName}님을 사용 중지할까요?\n바로 로그인과 데이터 접근이 막힙니다. 담당 리드 ${m.assignedCases}건은 그대로 남으니 다른 상담원에게 다시 배정하세요.`)}
                              className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-50 whitespace-nowrap shrink-0"
                            >
                              <Ban size={14} className="shrink-0" /> 사용 중지
                            </button>
                          ) : (
                            <button
                              disabled={busy}
                              onClick={() => handleMemberChange(m, { status: 'active' })}
                              className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline disabled:opacity-50 whitespace-nowrap shrink-0"
                            >
                              <RotateCcw size={14} className="shrink-0" /> 다시 사용
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">권한 제한</span>
                        )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && members.length === 0 && (
                    <tr><td colSpan={9} className="px-5 py-6 text-center text-gray-500 dark:text-gray-400">멤버 정보를 불러오지 못했습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 초대 및 라이선스 좌석 현황 */}
            <div className="px-5 py-4 border-t border-border bg-muted/30 rounded-b-xl space-y-3">
              {/* 좌석 하드 리밋(Hard Seat Limit) 현황 게이지 바 */}
              {seatStatus && seatStatus.maxSeats < 999999 && (
                <div className="p-3 bg-card border border-border rounded-xl space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <ShieldCheck size={14} className="text-primary" />
                      <span>라이선스 좌석 현황 (Seat Limit)</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-muted-foreground">사용 중: <strong className="text-foreground">{seatStatus.totalOccupied}석</strong> / 최대 {seatStatus.maxSeats}석</span>
                      <span className={`px-2 py-0.5 rounded text-2xs font-semibold border ${seatStatus.isLimitReached ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                        {seatStatus.isLimitReached ? '한도 소진' : `잔여 ${seatStatus.remainingSeats}석`}
                      </span>
                      {(isOwner || isPlatformAdmin) && (
                        <button
                          type="button"
                          onClick={() => setShowSeatExpansion(true)}
                          className="ml-1 px-2.5 py-1 text-2xs font-semibold rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Sparkles size={11} /> 좌석 증설 요청
                        </button>
                      )}
                    </div>
                  </div>
                  {/* 진행률 바 */}
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden border border-border/40">
                    <div 
                      className={`h-full transition-all duration-300 rounded-full ${seatStatus.isLimitReached ? 'bg-destructive' : seatStatus.remainingSeats <= 2 ? 'bg-amber-500' : 'bg-primary'}`}
                      style={{ width: `${Math.min(100, Math.round((seatStatus.totalOccupied / seatStatus.maxSeats) * 100))}%` }}
                    />
                  </div>
                  {seatStatus.isLimitReached && (
                    <div className="text-xs text-destructive flex items-center gap-1 pt-0.5 font-mono">
                      <ShieldAlert size={12} className="shrink-0" />
                      <span>보유 라이선스 좌석을 모두 소진하여 추가 초대가 차단되었습니다. 추가 등록을 원하시면 플랫폼 관리자에게 좌석 확장을 요청하세요.</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <UserPlus size={15} className="text-primary" /> 새 멤버 초대
                </div>
                {(isOwner || myTeamPerms.canInviteMembers) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (seatStatus?.isLimitReached) {
                        showToast(`보유 좌석(${seatStatus.maxSeats}석)을 모두 사용하여 대량 초대를 할 수 없습니다.`, 'error');
                        return;
                      }
                      setShowBulkInvite(true);
                    }}
                    disabled={seatStatus?.isLimitReached}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border shadow-2xs cursor-pointer ${
                      seatStatus?.isLimitReached 
                        ? 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground border-border' 
                        : 'text-primary bg-primary/10 hover:bg-primary/20 border-primary/20'
                    }`}
                  >
                    <Users size={13} /> 상담원 대량 초대 (10~50명)
                  </button>
                )}
              </div>
              {!isOwner && !myTeamPerms.canInviteMembers ? (
                <div className="p-3 bg-muted/40 border border-border rounded-lg flex items-center gap-2 text-xs text-muted-foreground font-medium">
                  <Lock size={14} className="shrink-0 text-muted-foreground" />
                  <span>새 멤버 초대 권한은 Tier 2(수석 팀장) 이상 또는 대표이사에게만 부여되어 있습니다.</span>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="구글 계정 이메일"
                      disabled={seatStatus?.isLimitReached}
                      className="flex-1 min-w-[220px] border border-border rounded-lg px-3 py-1.5 text-xs bg-muted/40 text-foreground font-mono disabled:opacity-50 placeholder:text-muted-foreground"
                    />
                    <input
                      value={inviteName}
                      onChange={e => setInviteName(e.target.value)}
                      placeholder="표시 이름 (선택)"
                      disabled={seatStatus?.isLimitReached}
                      className="w-40 border border-border rounded-lg px-3 py-1.5 text-xs bg-muted/40 text-foreground disabled:opacity-50 placeholder:text-muted-foreground"
                    />
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as OrgRole)}
                      disabled={seatStatus?.isLimitReached}
                      className="border border-border rounded-lg px-3 py-1.5 text-xs bg-muted/40 text-foreground disabled:opacity-50"
                    >
                      <option value="agent">상담원</option>
                      {isOwner && <option value="admin">관리자</option>}
                      {isOwner && <option value="owner">대표</option>}
                    </select>
                    <button
                      onClick={handleInvite}
                      disabled={busy || !inviteEmail.trim() || seatStatus?.isLimitReached}
                      className="px-4 py-1.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 shadow-2xs transition-colors cursor-pointer"
                    >
                      초대 만들기
                    </button>
                  </div>
                  <p className="text-2xs text-muted-foreground">
                    초대받은 사람이 이 사이트에서 <b>같은 구글 계정</b>으로 로그인하면 자동으로 팀에 들어옵니다. 초대는 14일 동안 유효합니다.
                  </p>
                </>
              )}
              {invites.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground font-mono">수락 대기 {invites.length}건</div>
                  {invites.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between text-xs bg-card border border-border rounded-lg px-3 py-1.5 font-mono shadow-2xs">
                      <span className="text-foreground">
                        {inv.email} <span className="text-muted-foreground">· {ROLE_LABEL[inv.role]}{inv.displayName ? ` · ${inv.displayName}` : ''} · {fmtDate(inv.expiresAt)}까지</span>
                      </span>
                      <div className="flex items-center gap-2.5">
                        <button
                          disabled={busy}
                          onClick={() => handleResendInviteEmail(inv)}
                          className="text-xs text-primary hover:underline flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Mail size={12} /> 메일 재발송
                        </button>
                        <button
                          disabled={busy}
                          onClick={async () => {
                            await cancelInvite(inv.id).catch(e => showToast(e.message, 'error'));
                            reload();
                          }}
                          className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-0.5 transition-colors cursor-pointer"
                        >
                          <X size={13} /> 취소
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 텔레그램 봇 */}
          <TelegramBotSection orgId={org.orgId} />

          {/* 통화 녹음 · AI 정리 */}
          <RecordingSettingsPanel orgId={org.orgId} />

          {/* 접근 기록 (015) */}
          <AccessLogPanel orgId={org.orgId} members={members} cases={cases} />
        </div>
      )}
      </div>

      {/* 케이스 페이지와 100% 동일한 통합 [케이스 일괄/간편 등록] 모달 */}
      {showUpload && (
        <ImportModal
          isOpen={showUpload}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            queryClient.invalidateQueries({ queryKey: ['cases'] });
            setPanelKey(k => k + 1);
            reload();
            showToast('신규 DB 등록이 완료되었습니다. [대용량 리드 배정] 탭에서 상담원에게 즉시 배분하실 수 있습니다.', 'success');
          }}
          partners={partners}
          inboundPaths={inboundPaths}
        />
      )}

      {/* 상담원 대량 초대 모달 */}
      <BulkInviteModal
        orgId={org.orgId}
        orgName={org.orgName}
        inviterName={org.displayName || user?.email || undefined}
        isOpen={showBulkInvite}
        onClose={() => setShowBulkInvite(false)}
        onSuccess={() => {
          reload();
          queryClient.invalidateQueries({ queryKey: ['cases'] });
        }}
        existingEmails={members.map(m => m.email)}
      />

      {/* 상담원별 차등 보안 설정 모달 */}
      <MemberSecurityModal
        member={securityTargetMember}
        isOpen={securityTargetMember !== null}
        onClose={() => setSecurityTargetMember(null)}
        onSave={handleSaveSecurityProfile}
        onRevokeSession={handleRevokeSession}
      />

      {/* 중간 관리자 권한 및 오픈 스코프 설정 모달 (대표 전용) */}
      <AdminPermissionModal
        member={permissionTargetMember}
        isOpen={permissionTargetMember !== null}
        onClose={() => setPermissionTargetMember(null)}
        onSuccess={() => {
          reload();
          queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
        }}
      />

      {/* 직원 인사(HR) 정보 관리 모달 (전화번호, 주소, 입사일, 생일, 급여계좌, 비상연락망, 특이사항) */}
      <MemberHrModal
        isOpen={hrTargetMember !== null}
        onClose={() => setHrTargetMember(null)}
        member={hrTargetMember}
        orgId={org.orgId}
        canEdit={isOwner || myTeamPerms.canModifyRules || myTeamPerms.canManageSecurity}
        onSaved={() => {
          reload();
          queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
        }}
      />

      {/* 라이선스 좌석(Seat) 증설 요청 모달 */}
      <SeatExpansionModal
        isOpen={showSeatExpansion}
        onClose={() => setShowSeatExpansion(false)}
        orgId={org.orgId}
        orgName={org.orgName}
        requesterEmail={user?.email}
        requesterName={user?.name}
        activeSeats={seatStatus?.totalOccupied || members.length}
        currentMaxSeats={seatStatus?.maxSeats || 20}
        onSuccess={() => {
          reload();
          queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
        }}
      />
    </div>
  );
}
