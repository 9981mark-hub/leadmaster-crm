import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserCog, UserPlus, Users, Shuffle, RefreshCw, X, Check, Ban, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { fetchCases, applyLocalAssignment } from '../services/api';
import { ROLE_LABEL, OrgRole } from '../services/org';
import {
  TeamMember, TeamInvite, fetchTeamMembers, updateTeamMember, fetchPendingInvites,
  createInvite, cancelInvite, assignCases, assignRoundRobin,
} from '../services/team';
import { Case } from '../types';
import TelegramBotSection from '../components/TelegramBotSection';

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

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // 초대 폼
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('agent');

  // 배정
  const [assignFilter, setAssignFilter] = useState<AssignFilter>('unassigned');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetUser, setTargetUser] = useState('');
  const [rrUsers, setRrUsers] = useState<Set<string>>(new Set());

  const { data: cases = [] } = useQuery({ queryKey: ['cases'], queryFn: fetchCases });

  const reload = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const [m, i] = await Promise.all([fetchTeamMembers(), fetchPendingInvites(org.orgId)]);
      setMembers(m);
      setInvites(i);
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

  const handleRoundRobin = async () => {
    const ids = setToArray(selected);
    const users = setToArray(rrUsers);
    if (ids.length === 0) return showToast('나눠줄 리드를 고르세요', 'error');
    if (users.length === 0) return showToast('나눠줄 상담원을 한 명 이상 체크하세요', 'error');
    if (!window.confirm(`${ids.length}건을 상담원 ${users.length}명에게 차례대로 나눠 배정할까요?`)) return;
    setBusy(true);
    try {
      // 오래된 리드부터 차례대로
      const ordered = filteredCases.filter(c => selected.has(c.caseId))
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).map(c => c.caseId);
      const result = await assignRoundRobin(ordered, users);
      users.forEach((uid, idx) => applyLocalAssignment(ordered.filter((_, i) => i % users.length === idx), uid));
      const summary = users.map(u => `${memberName(u)} ${result[u] || 0}건`).join(', ');
      await afterAssign(`순번 배정 완료: ${summary}`);
    } catch (e: any) {
      showToast(`순번 배정 실패: ${e.message}`, 'error');
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

  const canEditRole = (m: TeamMember) => m.userId !== org?.userId && (org?.role === 'owner' || m.role !== 'owner');

  if (!org) {
    return <div className="p-6 text-gray-500">회사 정보를 확인하는 중입니다. 잠시 후 다시 열어주세요.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2"><UserCog size={24} /> 팀 관리</h1>
          <p className="text-sm text-gray-500 mt-1">{org.orgName} · 멤버 초대, 역할 변경, 리드 배정</p>
        </div>
        <button onClick={reload} disabled={loading || busy}
          className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>

      {/* ===== 멤버 ===== */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <Users size={18} className="text-blue-600" />
          <h2 className="font-bold text-gray-800 dark:text-white">멤버 {members.length}명</h2>
          <span className="text-xs text-gray-400">사용 중 {activeMembers.length}명 · 상담원 {agents.length}명</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 text-xs">
              <tr>
                <th className="text-left px-5 py-2">이름</th>
                <th className="text-left px-3 py-2">이메일</th>
                <th className="text-left px-3 py-2">역할</th>
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
                      <select value={m.role} disabled={busy}
                        onChange={e => handleMemberChange(m, { role: e.target.value as OrgRole })}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white">
                        <option value="agent">상담원</option>
                        <option value="admin">관리자</option>
                        {org.role === 'owner' && <option value="owner">대표</option>}
                      </select>
                    ) : (
                      <span className="text-gray-700 dark:text-gray-200">{ROLE_LABEL[m.role]}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.assignedCases.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">{fmtDate(m.lastSignInAt)}</td>
                  <td className="px-5 py-2.5 text-right">
                    {canEditRole(m) && (m.status === 'active' ? (
                      <button disabled={busy}
                        onClick={() => handleMemberChange(m, { status: 'disabled' },
                          `${m.displayName}님을 사용 중지할까요?\n바로 로그인과 데이터 접근이 막힙니다. 담당 리드 ${m.assignedCases}건은 그대로 남으니 다른 상담원에게 다시 배정하세요.`)}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-50">
                        <Ban size={14} /> 사용 중지
                      </button>
                    ) : (
                      <button disabled={busy} onClick={() => handleMemberChange(m, { status: 'active' })}
                        className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline disabled:opacity-50">
                        <RotateCcw size={14} /> 다시 사용
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
              {!loading && members.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-6 text-center text-gray-400">멤버 정보를 불러오지 못했습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 초대 */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60 rounded-b-xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200"><UserPlus size={16} /> 새 멤버 초대</div>
          <div className="flex flex-wrap gap-2">
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="구글 계정 이메일"
              className="flex-1 min-w-[220px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
            <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="표시 이름 (선택)"
              className="w-40 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as OrgRole)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white">
              <option value="agent">상담원</option>
              <option value="admin">관리자</option>
              {org.role === 'owner' && <option value="owner">대표</option>}
            </select>
            <button onClick={handleInvite} disabled={busy || !inviteEmail.trim()}
              className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">초대 만들기</button>
          </div>
          <p className="text-xs text-gray-500">초대받은 사람이 이 사이트에서 <b>같은 구글 계정</b>으로 로그인하면 자동으로 팀에 들어옵니다. 초대는 14일 동안 유효합니다.</p>
          {invites.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-500">수락 대기 {invites.length}건</div>
              {invites.map(inv => (
                <div key={inv.id} className="flex items-center justify-between text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5">
                  <span className="text-gray-700 dark:text-gray-200">
                    {inv.email} <span className="text-xs text-gray-400">· {ROLE_LABEL[inv.role]}{inv.displayName ? ` · ${inv.displayName}` : ''} · {fmtDate(inv.expiresAt)}까지</span>
                  </span>
                  <button disabled={busy} onClick={async () => { await cancelInvite(inv.id).catch(e => showToast(e.message, 'error')); reload(); }}
                    className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-0.5"><X size={14} /> 취소</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== 텔레그램 봇 ===== */}
      <TelegramBotSection orgId={org.orgId} />

      {/* ===== 리드 배정 ===== */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-2">
          <Shuffle size={18} className="text-blue-600" />
          <h2 className="font-bold text-gray-800 dark:text-white">리드 배정</h2>
          <span className="text-xs text-gray-400">미배정 {unassignedCount.toLocaleString()}건 · 상담원은 배정받은 리드만 볼 수 있습니다</span>
        </div>

        <div className="px-5 py-3 flex flex-wrap gap-2 items-center border-b border-gray-100 dark:border-gray-700">
          <select value={assignFilter} onChange={e => setAssignFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white">
            <option value="unassigned">미배정 리드</option>
            <option value="all">전체 리드</option>
            {activeMembers.map(m => <option key={m.userId} value={m.userId}>{m.displayName} 담당</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white">
            <option value="">모든 상태</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름·번호·유입경로 검색"
            className="flex-1 min-w-[180px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white" />
          <span className="text-xs text-gray-500">{filteredCases.length.toLocaleString()}건 · 선택 {selected.size.toLocaleString()}건</span>
        </div>

        {/* 배정 실행 */}
        <div className="px-5 py-3 grid md:grid-cols-2 gap-3 border-b border-gray-100 dark:border-gray-700 bg-blue-50/40 dark:bg-blue-900/10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">선택한 리드를</span>
            <select value={targetUser} onChange={e => setTargetUser(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white">
              <option value="">— 담당자 선택 —</option>
              {activeMembers.map(m => <option key={m.userId} value={m.userId}>{m.displayName} ({ROLE_LABEL[m.role]})</option>)}
              <option value="__none__">배정 해제</option>
            </select>
            <button onClick={handleAssign} disabled={busy || selected.size === 0 || !targetUser}
              className="px-3 py-1.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
              <Check size={14} /> 배정
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">순번으로 나눠주기:</span>
            {agents.length === 0 && <span className="text-xs text-gray-400">상담원이 없습니다</span>}
            {agents.map(a => (
              <label key={a.userId} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200">
                <input type="checkbox" checked={rrUsers.has(a.userId)}
                  onChange={() => setRrUsers(prev => { const n = new Set(prev); n.has(a.userId) ? n.delete(a.userId) : n.add(a.userId); return n; })} />
                {a.displayName}
              </label>
            ))}
            {agents.length > 1 && (
              <button onClick={() => setRrUsers(new Set(agents.map(a => a.userId)))} className="text-xs text-blue-600 hover:underline">모두</button>
            )}
            <button onClick={handleRoundRobin} disabled={busy || selected.size === 0 || rrUsers.size === 0}
              className="px-3 py-1.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1">
              <Shuffle size={14} /> 나눠주기
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 text-xs sticky top-0">
              <tr>
                <th className="px-5 py-2 w-10"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} /></th>
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
                <tr key={c.caseId} onClick={() => toggle(c.caseId)}
                  className={`cursor-pointer ${selected.has(c.caseId) ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}>
                  <td className="px-5 py-2" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(c.caseId)} onChange={() => toggle(c.caseId)} />
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{c.customerName}</td>
                  <td className="px-3 py-2 text-gray-500 tabular-nums">{maskPhone(c.phone)}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{c.status}</td>
                  <td className="px-3 py-2 text-gray-500">{c.inboundPath}</td>
                  <td className="px-3 py-2 text-gray-500">{fmtDate(c.createdAt)}</td>
                  <td className={`px-3 py-2 ${c.assignedUserId ? 'text-gray-700 dark:text-gray-200' : 'text-orange-500'}`}>{memberName(c.assignedUserId)}</td>
                </tr>
              ))}
              {filteredCases.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">조건에 맞는 리드가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
          {filteredCases.length > 500 && (
            <div className="px-5 py-2 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-700">
              화면에는 500건까지만 보입니다. "모두 선택"은 보이는 500건만 고릅니다. 필터로 범위를 좁혀주세요.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
