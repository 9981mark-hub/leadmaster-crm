import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserCog, UserPlus, Users, Shuffle, RefreshCw, X, Check, Ban, RotateCcw,
  FileUp, History, Award, SlidersHorizontal, Layers, ShieldAlert, PhoneCall, Archive, GraduationCap, Shield
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { fetchCases, applyLocalAssignment, refreshLocalAssignments } from '../services/api';
import { ROLE_LABEL, OrgRole } from '../services/org';
import {
  TeamMember, TeamInvite, fetchTeamMembers, updateTeamMember, fetchPendingInvites,
  createInvite, cancelInvite, assignCases, revokeMemberSession, MemberSecurityProfile
} from '../services/team';
import { Case } from '../types';
import TelegramBotSection from '../components/TelegramBotSection';
import DistributionPanel from '../components/team/DistributionPanel';
import LeadUploadModal from '../components/team/LeadUploadModal';
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
import {
  AssignmentLog, DistributeMode, REASON_LABEL, distributeCases,
  fetchAssignmentLogs, fetchImportBatches, ImportBatch
} from '../services/distribution';
import { usePartners, useStatuses, useInboundPaths } from '../services/queries';

type TeamTab = 'performance' | 'call_audit' | 'bulk_assign' | 'rules' | 'lifecycle' | 'quality' | 'dnc' | 'members';
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

export default function TeamPage() {
  const { org } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // 상단 탭 상태
  const [activeTab, setActiveTab] = useState<TeamTab>('performance');

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
  const [securityTargetMember, setSecurityTargetMember] = useState<TeamMember | null>(null);
  const [logs, setLogs] = useState<AssignmentLog[]>([]);
  const [panelKey, setPanelKey] = useState(0);

  const { data: cases = [] } = useQuery({ queryKey: ['cases'], queryFn: fetchCases });
  const { data: partners = [] } = usePartners();
  const { data: statusList = [] } = useStatuses();
  const { data: inboundPaths = [] } = useInboundPaths();

  const reload = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const [m, i, l, b] = await Promise.all([
        fetchTeamMembers(),
        fetchPendingInvites(org.orgId),
        fetchAssignmentLogs({ limit: 50 }).catch(() => [] as AssignmentLog[]),
        fetchImportBatches(30).catch(() => [] as ImportBatch[]),
      ]);
      setMembers(m);
      setInvites(i);
      setLogs(l);
      setImportBatches(b);
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
    if (!window.confirm(`${ids.length}건을 상담원 ${users.length}명에게 ${label} 나눠줄까요?`)) return;
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
      await createInvite(org.orgId, inviteEmail, inviteRole, inviteName);
      showToast(`${inviteEmail} 초대를 만들었습니다. 이 구글 계정으로 로그인하면 자동으로 연결됩니다.`, 'success');
      setInviteEmail('');
      setInviteName('');
      await reload();
    } catch (e: any) {
      showToast(`초대 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleMemberChange = async (m: TeamMember, changes: Parameters<typeof updateTeamMember>[1], confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
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
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* 상단 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <UserCog size={26} className="text-blue-600" /> 팀 관리 & 콜센터 운영
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {org.orgName} · 상담원 성과/콜 분석, 인센티브, 15,000건 스마트 대량 배정, DB 회차 품질 관리
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/training"
            className="px-3 py-2 text-sm font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <GraduationCap size={16} /> 신입 트레이닝 센터
          </Link>
          <button
            onClick={() => setShowUpload(true)}
            className="px-3.5 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-sm flex items-center gap-1.5"
          >
            <FileUp size={16} /> 신규 DB 업로드
          </button>
          <button
            onClick={reload}
            disabled={loading || busy}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 새로고침
          </button>
        </div>
      </div>

      {/* 7대 전문 탭 네비게이션 */}
      <div className="flex items-center gap-1 p-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-x-auto border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('performance')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'performance'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Award size={16} /> 팀원 성과 · 인센티브
        </button>

        <button
          onClick={() => setActiveTab('call_audit')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'call_audit'
              ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <PhoneCall size={16} /> 콜 활동 · AI 요약
        </button>

        <button
          onClick={() => setActiveTab('bulk_assign')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'bulk_assign'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Shuffle size={16} /> 대용량 리드 배정
          {unassignedCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              {unassignedCount > 999 ? '999+' : unassignedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'rules'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <SlidersHorizontal size={16} /> 배분 규칙 · 로테이션
        </button>

        <button
          onClick={() => setActiveTab('lifecycle')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'lifecycle'
              ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Archive size={16} /> DB 수명주기 · 보관
        </button>

        <button
          onClick={() => setActiveTab('quality')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'quality'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Layers size={16} /> 회차별 DB 품질
        </button>

        <button
          onClick={() => setActiveTab('dnc')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'dnc'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <ShieldAlert size={16} /> 수신거부 (DNC)
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'members'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Users size={16} /> 멤버 & 환경설정
        </button>
      </div>

      {/* 탭 1: 팀원 성과 & 인센티브 */}
      {activeTab === 'performance' && (
        <AgentPerformancePanel />
      )}

      {/* 탭: 콜 활동 · AI 요약 및 대화록 모니터링 */}
      {activeTab === 'call_audit' && (
        <TeamCallAuditPanel members={members} />
      )}

      {/* 탭 2: 대용량 리드 배정 (스마트 일괄 배분 + 세부 수동 배정 테이블) */}
      {activeTab === 'bulk_assign' && (
        <div className="space-y-6">
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

          {/* 세부 선택 배정 (소규모/개별 지정) */}
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-2">
              <Shuffle size={18} className="text-blue-600" />
              <h2 className="font-bold text-gray-800 dark:text-white">정밀 개별/필터 배정</h2>
              <span className="text-xs text-gray-400">직접 체크박스로 특정 리드를 골라 배정하거나 해제할 수 있습니다</span>
            </div>

            <div className="px-5 py-3 flex flex-wrap gap-2 items-center border-b border-gray-100 dark:border-gray-700">
              <select
                value={assignFilter}
                onChange={e => setAssignFilter(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white"
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
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white"
              >
                <option value="">모든 상태</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="이름·번호·유입경로 검색"
                className="flex-1 min-w-[180px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white"
              />
              <span className="text-xs text-gray-500">
                {filteredCases.length.toLocaleString()}건 중 {selected.size.toLocaleString()}건 선택
              </span>
            </div>

            {/* 개별 배정 실행 바 */}
            <div className="px-5 py-3 grid md:grid-cols-2 gap-3 border-b border-gray-100 dark:border-gray-700 bg-blue-50/40 dark:bg-blue-900/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">선택한 리드를</span>
                <select
                  value={targetUser}
                  onChange={e => setTargetUser(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white"
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
                  className="px-3 py-1.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 shadow-sm"
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

                {agents.length === 0 && <span className="text-xs text-gray-400">상담원이 없습니다</span>}
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
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 text-xs sticky top-0">
                  <tr>
                    <th className="px-5 py-2 w-10">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
                    </th>
                    <th className="text-left px-3 py-2">고객</th>
                    <th className="text-left px-3 py-2">연락처</th>
                    <th className="text-left px-3 py-2">상태</th>
                    <th className="text-left px-3 py-2">유입경로</th>
                    <th className="text-left px-3 py-2">등록일</th>
                    <th className="text-left px-3 py-2">담당</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {visibleCases.map(c => (
                    <tr
                      key={c.caseId}
                      onClick={() => toggle(c.caseId)}
                      className={`cursor-pointer ${
                        selected.has(c.caseId)
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                      }`}
                    >
                      <td className="px-5 py-2" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(c.caseId)} onChange={() => toggle(c.caseId)} />
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{c.customerName}</td>
                      <td className="px-3 py-2 text-gray-500 tabular-nums">{maskPhone(c.phone)}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{c.status}</td>
                      <td className="px-3 py-2 text-gray-500">{c.inboundPath}</td>
                      <td className="px-3 py-2 text-gray-500">{fmtDate(c.createdAt)}</td>
                      <td className={`px-3 py-2 ${c.assignedUserId ? 'text-gray-700 dark:text-gray-200' : 'text-orange-500 font-semibold'}`}>
                        {memberName(c.assignedUserId)}
                      </td>
                    </tr>
                  ))}
                  {filteredCases.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-gray-400">조건에 맞는 리드가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {filteredCases.length > 500 && (
                <div className="px-5 py-2 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-700">
                  화면에는 500건까지만 보입니다. "모두 선택"은 보이는 500건만 고릅니다. 필터로 범위를 좁히거나 상단 대용량 배분을 이용하세요.
                </div>
              )}
            </div>
          </section>

          {/* 최근 배정 기록 */}
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <History size={16} className="text-gray-500" />
              <h2 className="font-bold text-gray-800 dark:text-white text-sm">최근 배정 기록</h2>
              <span className="text-xs text-gray-400">최근 50건 · 배정 이력 추적</span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {logs.map(l => {
                    const cs = liveCases.find(c => c.caseId === l.caseId);
                    return (
                      <tr key={l.id}>
                        <td className="px-5 py-1.5 text-gray-400 whitespace-nowrap">
                          {new Date(l.createdAt).toLocaleString('ko-KR', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-2 py-1.5 font-medium text-gray-700 dark:text-gray-200">
                          {cs?.customerName || l.caseId}
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {l.fromUser ? memberName(l.fromUser) : '미배정'} → {l.toUser ? memberName(l.toUser) : '미배정'}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {REASON_LABEL[l.reason] || l.reason}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-gray-400">
                          {l.byUser ? memberName(l.byUser) : '시스템'}{l.note ? ` · ${l.note}` : ''}
                        </td>
                      </tr>
                    );
                  })}
                  {logs.length === 0 && (
                    <tr><td className="px-5 py-4 text-center text-gray-400">아직 배정 기록이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* 탭 3: 리드 배분 규칙 */}
      {activeTab === 'rules' && (
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
      )}

      {/* 탭: DB 수명주기 & 보관 관리 */}
      {activeTab === 'lifecycle' && (
        <LifecyclePolicyPanel
          cases={cases}
          onChanged={() => {
            queryClient.invalidateQueries({ queryKey: ['cases'] });
            reload();
          }}
        />
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
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <h2 className="font-bold text-gray-800 dark:text-white">멤버 {members.length}명</h2>
              <span className="text-xs text-gray-400">사용 중 {activeMembers.length}명 · 상담원 {agents.length}명</span>
            </div>
            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
              {members.map(m => (
                <div key={m.userId} className={`px-4 py-3 space-y-2 ${m.status === 'disabled' ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-800 dark:text-gray-100">{m.displayName}</span>
                      {m.userId === org.userId && <span className="ml-1 text-xs text-blue-500">(나)</span>}
                      {m.status === 'disabled' && <span className="ml-2 text-xs text-red-500">사용 중지</span>}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {ROLE_LABEL[m.role]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.email}</p>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex gap-3">
                      <span className="text-gray-500 dark:text-gray-400">담당 <span className="font-semibold text-gray-700 dark:text-gray-200">{m.assignedCases.toLocaleString()}</span>건</span>
                      <span className="text-gray-500 dark:text-gray-400">로그인 {fmtDate(m.lastSignInAt)}</span>
                    </div>
                    {canEditRole(m) && (m.status === 'active' ? (
                      <button
                        disabled={busy}
                        onClick={() => handleMemberChange(m, { status: 'disabled' },
                          `${m.displayName}님을 사용 중지할까요?\n바로 로그인과 데이터 접근이 막힙니다. 담당 리드 ${m.assignedCases}건은 그대로 남으니 다른 상담원에게 다시 배정하세요.`)}
                        className="inline-flex items-center gap-1 text-red-600 hover:underline disabled:opacity-50"
                      >
                        <Ban size={14} /> 중지
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => handleMemberChange(m, { status: 'active' })}
                        className="inline-flex items-center gap-1 text-green-600 hover:underline disabled:opacity-50"
                      >
                        <RotateCcw size={14} /> 복원
                      </button>
                    ))}
                  </div>
                  {canEditRole(m) && (
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700/50">
                      <button
                        type="button"
                        onClick={() => setSecurityTargetMember(m)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
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
                </div>
              ))}
              {!loading && members.length === 0 && (
                <div className="px-5 py-6 text-center text-gray-400">멤버 정보를 불러오지 못했습니다.</div>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 text-xs">
                  <tr>
                    <th className="text-left px-5 py-2">이름</th>
                    <th className="text-left px-3 py-2">이메일</th>
                    <th className="text-left px-3 py-2">역할</th>
                    <th className="text-left px-3 py-2">업무 모드</th>
                    <th className="text-left px-3 py-2">보안 통제</th>
                    <th className="text-right px-3 py-2">담당 리드</th>
                    <th className="text-left px-3 py-2">최근 로그인</th>
                    <th className="text-right px-5 py-2">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {members.map(m => (
                    <tr key={m.userId} className={m.status === 'disabled' ? 'opacity-50' : ''}>
                      <td className="px-5 py-2.5 font-medium text-gray-800 dark:text-gray-100">
                        {m.displayName}{m.userId === org.userId && <span className="ml-1 text-xs text-blue-500">(나)</span>}
                        {m.status === 'disabled' && <span className="ml-2 text-xs text-red-500">사용 중지</span>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">{m.email}</td>
                      <td className="px-3 py-2.5">
                        {canEditRole(m) ? (
                          <select
                            value={m.role}
                            disabled={busy}
                            onChange={e => handleMemberChange(m, { role: e.target.value as OrgRole })}
                            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
                          >
                            <option value="agent">상담원</option>
                            <option value="admin">관리자</option>
                            {org.role === 'owner' && <option value="owner">대표</option>}
                          </select>
                        ) : (
                          <span className="text-gray-700 dark:text-gray-200">{ROLE_LABEL[m.role]}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {m.role === 'agent' && canEditRole(m) ? (
                          <select
                            value={m.uiMode || 'standard'}
                            disabled={busy}
                            onChange={e => handleMemberChange(m, { uiMode: e.target.value as 'standard' | 'lite_only' })}
                            className={`text-xs font-semibold rounded-lg px-2 py-1 border transition-colors ${
                              m.uiMode === 'lite_only'
                                ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                                : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            <option value="standard">일반 모드</option>
                            <option value="lite_only">⚡ 간편콜 전용 (신입)</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            m.uiMode === 'lite_only'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {m.uiMode === 'lite_only' ? '⚡ 간편콜 전용' : '일반'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {canEditRole(m) ? (
                          <button
                            type="button"
                            onClick={() => setSecurityTargetMember(m)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover:shadow-xs cursor-pointer bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
                          >
                            <Shield size={13} className={
                              !m.securityProfile?.watermark && !m.securityProfile?.appCaptureBlock && !m.securityProfile?.masking && !m.securityProfile?.anomalyAlert
                                ? 'text-amber-500'
                                : 'text-blue-500'
                            } />
                            <span>
                              {!m.securityProfile?.watermark && !m.securityProfile?.appCaptureBlock && !m.securityProfile?.masking && !m.securityProfile?.anomalyAlert
                                ? '🌟 팀장급 (해제)'
                                : m.securityProfile?.watermark && m.securityProfile?.appCaptureBlock && m.securityProfile?.masking && m.securityProfile?.anomalyAlert
                                  ? '🛡️ 표준 보안'
                                  : '⚙️ 맞춤 보안'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">자율 권한</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{m.assignedCases.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">{fmtDate(m.lastSignInAt)}</td>
                      <td className="px-5 py-2.5 text-right">
                        {canEditRole(m) && (m.status === 'active' ? (
                          <button
                            disabled={busy}
                            onClick={() => handleMemberChange(m, { status: 'disabled' },
                              `${m.displayName}님을 사용 중지할까요?\n바로 로그인과 데이터 접근이 막힙니다. 담당 리드 ${m.assignedCases}건은 그대로 남으니 다른 상담원에게 다시 배정하세요.`)}
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            <Ban size={14} /> 사용 중지
                          </button>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() => handleMemberChange(m, { status: 'active' })}
                            className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline disabled:opacity-50"
                          >
                            <RotateCcw size={14} /> 다시 사용
                          </button>
                        ))}
                      </td>
                    </tr>
                  ))}
                  {!loading && members.length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-6 text-center text-gray-400">멤버 정보를 불러오지 못했습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 초대 */}
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60 rounded-b-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                  <UserPlus size={16} /> 새 멤버 초대
                </div>
                <button
                  type="button"
                  onClick={() => setShowBulkInvite(true)}
                  className="px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg flex items-center gap-1.5 transition-colors border border-blue-200 dark:border-blue-800 shadow-sm"
                >
                  <Users size={14} /> 상담원 대량 초대 (10~50명)
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="구글 계정 이메일"
                  className="flex-1 min-w-[220px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                />
                <input
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="표시 이름 (선택)"
                  className="w-40 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as OrgRole)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                >
                  <option value="agent">상담원</option>
                  <option value="admin">관리자</option>
                  {org.role === 'owner' && <option value="owner">대표</option>}
                </select>
                <button
                  onClick={handleInvite}
                  disabled={busy || !inviteEmail.trim()}
                  className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  초대 만들기
                </button>
              </div>
              <p className="text-xs text-gray-500">
                초대받은 사람이 이 사이트에서 <b>같은 구글 계정</b>으로 로그인하면 자동으로 팀에 들어옵니다. 초대는 14일 동안 유효합니다.
              </p>
              {invites.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-500">수락 대기 {invites.length}건</div>
                  {invites.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5">
                      <span className="text-gray-700 dark:text-gray-200">
                        {inv.email} <span className="text-xs text-gray-400">· {ROLE_LABEL[inv.role]}{inv.displayName ? ` · ${inv.displayName}` : ''} · {fmtDate(inv.expiresAt)}까지</span>
                      </span>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          await cancelInvite(inv.id).catch(e => showToast(e.message, 'error'));
                          reload();
                        }}
                        className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-0.5"
                      >
                        <X size={14} /> 취소
                      </button>
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

      {/* 업로드 모달 */}
      {showUpload && (
        <LeadUploadModal
          agents={agents.map(a => ({ userId: a.userId, displayName: a.displayName }))}
          partners={partners}
          onClose={() => setShowUpload(false)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ['cases'] });
            setPanelKey(k => k + 1);
            reload();
          }}
        />
      )}

      {/* 상담원 대량 초대 모달 */}
      <BulkInviteModal
        orgId={org.orgId}
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
    </div>
  );
}
