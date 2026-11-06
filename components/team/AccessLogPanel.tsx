import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, RefreshCw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { TeamMember } from '../../services/team';
import { Case } from '../../types';
import {
  ACCESS_ACTIONS, ACCESS_ACTION_LABEL, ACCESS_LOG_PAGE_SIZE, AccessAction, AccessLogRow,
  fetchAccessLogs, isAccessLogNotReady,
} from '../../services/accessLog';

interface Props {
  orgId: string;
  members: TeamMember[];
  /** 이미 불러 둔 리드 (리드 이름 표시용. 여기서 따로 조회하지 않는다) */
  cases: Case[];
}

type Period = 'today' | '7d' | '30d';
const PERIODS: { k: Period; label: string; daysBack: number }[] = [
  { k: 'today', label: '오늘', daysBack: 0 },
  { k: '7d', label: '7일', daysBack: 6 },
  { k: '30d', label: '30일', daysBack: 29 },
];

const KST_MS = 9 * 60 * 60 * 1000;
/** 한국 날짜 기준 N일 전 0시 (ISO) */
const kstDayStart = (daysBack: number) => {
  const d = new Date(Date.now() + KST_MS);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - KST_MS - daysBack * 86400000).toISOString();
};
const pad = (n: number) => String(n).padStart(2, '0');
/** 한국 시간 M/D HH:mm:ss */
const fmtKst = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + KST_MS);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
};

const ACTION_STYLE: Record<AccessAction, string> = {
  case_view: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  export: 'bg-amber-100 text-amber-800',
  case_trash: 'bg-orange-100 text-orange-700',
  case_restore: 'bg-green-100 text-green-700',
  case_purge: 'bg-red-100 text-red-700',
  recording_play: 'bg-purple-100 text-purple-700',
  recording_download: 'bg-fuchsia-100 text-fuchsia-700',
};

/** 팀 관리 → 접근 기록: 누가 언제 어떤 리드를 열람·내보내기·삭제·녹음 재생했는지 (관리자만) */
export default function AccessLogPanel({ orgId, members, cases }: Props) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<Period>('today');
  const [who, setWho] = useState('');
  const [action, setAction] = useState<AccessAction | ''>('');
  const [rows, setRows] = useState<AccessLogRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const reqSeq = useRef(0);

  const caseName = useMemo(() => {
    const m = new Map<string, string>();
    cases.forEach(c => { if (c.caseId) m.set(c.caseId, c.customerName || ''); });
    return m;
  }, [cases]);
  const memberName = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach(x => m.set(x.userId, x.displayName || x.email));
    return m;
  }, [members]);
  const sortedMembers = useMemo(() => [...members].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')), [members]);

  const fetchPage = useCallback(async (before?: { createdAt: string; id: number }) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const daysBack = PERIODS.find(p => p.k === period)?.daysBack ?? 0;
      const list = await fetchAccessLogs({
        orgId, since: kstDayStart(daysBack), userId: who || undefined, action: action || undefined, before,
      });
      if (seq !== reqSeq.current) return; // 조건이 바뀐 뒤 늦게 온 응답은 버림
      setRows(prev => (before ? [...prev, ...list] : list));
      setHasMore(list.length === ACCESS_LOG_PAGE_SIZE);
      setNotReady(false);
    } catch (e: any) {
      if (seq !== reqSeq.current) return;
      if (isAccessLogNotReady(e)) setNotReady(true);
      else showToast(`접근 기록을 불러오지 못했습니다: ${e?.message || e}`, 'error');
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [orgId, period, who, action, showToast]);

  // 펼쳤을 때만, 조건이 바뀔 때마다 처음부터 (접어 두면 서버에 묻지 않음)
  useEffect(() => { if (open) fetchPage(); }, [open, fetchPage]);

  const loadMore = () => {
    const last = rows[rows.length - 1];
    if (last) fetchPage({ createdAt: last.createdAt, id: last.id });
  };

  const personOf = (r: AccessLogRow) => memberName.get(r.userId) || r.actorEmail || `${r.userId.slice(0, 8)}…`;

  const leadCell = (r: AccessLogRow) => {
    if (r.caseId) {
      const name = caseName.get(r.caseId);
      if (name !== undefined) {
        return <Link to={`/case/${r.caseId}`} className="text-blue-600 dark:text-blue-400 hover:underline">{name || '(이름 없음)'}</Link>;
      }
      const label = typeof r.detail.label === 'string' && r.detail.label ? r.detail.label : '';
      return <span className="text-gray-400" title={r.caseId}>{label || '지금은 없는 리드'}</span>;
    }
    const ids: string[] = Array.isArray(r.detail.case_ids) ? r.detail.case_ids : [];
    if (ids.length > 0) {
      const labels: string[] = Array.isArray(r.detail.labels) ? r.detail.labels : [];
      const names = ids.map((id, i) => caseName.get(id) || labels[i] || '').filter(Boolean);
      const total = r.itemCount ?? ids.length;
      const shown = names.slice(0, 3).join(', ');
      return <span className="text-gray-700 dark:text-gray-200" title={names.join(', ')}>{shown || `${total}건`}{shown && total > 3 ? ` 외 ${total - 3}건` : ''}</span>;
    }
    return <span className="text-gray-300">-</span>;
  };

  const countCell = (r: AccessLogRow) => {
    const parts: string[] = [];
    if (typeof r.itemCount === 'number') parts.push(`${r.itemCount.toLocaleString()}건`);
    const file = typeof r.detail.file === 'string' ? r.detail.file : '';
    return (
      <span className="text-gray-600 dark:text-gray-300">
        {parts.join(' ')}
        {file && <span className="ml-1 text-gray-400 break-all" title={file}>{file}</span>}
        {!parts.length && !file && <span className="text-gray-300">-</span>}
      </span>
    );
  };

  if (notReady) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-5 py-4 flex items-center gap-2 text-sm text-gray-500">
        <ShieldCheck size={18} className="text-gray-400" />
        <b className="text-gray-700 dark:text-gray-200">접근 기록</b> 서버 업데이트 후 사용할 수 있습니다.
        <button onClick={() => fetchPage()} className="ml-auto text-xs flex items-center gap-1"><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 다시 확인</button>
      </section>
    );
  }

  const select = 'border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-white';
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="px-5 py-3 flex flex-wrap items-center gap-2">
        <ShieldCheck size={18} className="text-emerald-600" />
        <h2 className="font-bold text-gray-800 dark:text-white">접근 기록</h2>
        <span className="text-xs text-gray-400">누가 언제 어떤 리드를 열람·내보내기·삭제·녹음 재생했는지 · 정책 연동 보관(6개월/1년/2년) · 관리자 전용</span>
        <div className="ml-auto flex items-center gap-3">
          {open && (
            <button onClick={() => fetchPage()} disabled={loading} className="text-xs text-gray-500 flex items-center gap-1 disabled:opacity-50">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 새로고침
            </button>
          )}
          <button onClick={() => setOpen(o => !o)} aria-expanded={open}
            className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
            {open ? <>접기 <ChevronUp size={16} /></> : <>보기 <ChevronDown size={16} /></>}
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-2">
            <div className="flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-700" role="group" aria-label="기간">
              {PERIODS.map(p => (
                <button key={p.k} type="button" onClick={() => setPeriod(p.k)} aria-pressed={period === p.k}
                  className={`px-3 py-1 rounded-md text-sm ${period === p.k ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-bold shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <select value={who} onChange={e => setWho(e.target.value)} className={select} aria-label="사람">
              <option value="">모든 사람</option>
              {sortedMembers.map(m => <option key={m.userId} value={m.userId}>{m.displayName}{m.status === 'disabled' ? ' (사용 중지)' : ''}</option>)}
            </select>
            <select value={action} onChange={e => setAction(e.target.value as AccessAction | '')} className={select} aria-label="행동">
              <option value="">모든 행동</option>
              {ACCESS_ACTIONS.map(a => <option key={a} value={a}>{ACCESS_ACTION_LABEL[a]}</option>)}
            </select>
            <span className="text-xs text-gray-500 tabular-nums">{rows.length.toLocaleString()}건{hasMore ? '+' : ''}</span>
          </div>

          <div className="overflow-x-auto max-h-[520px] overflow-y-auto border-t border-gray-100 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 text-xs sticky top-0">
                <tr>
                  <th className="text-left px-5 py-2 whitespace-nowrap">시각</th>
                  <th className="text-left px-3 py-2">사람</th>
                  <th className="text-left px-3 py-2">행동</th>
                  <th className="text-left px-3 py-2">리드</th>
                  <th className="text-left px-3 py-2">건수 · 파일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="px-5 py-1.5 text-gray-500 whitespace-nowrap tabular-nums">{fmtKst(r.createdAt)}</td>
                    <td className="px-3 py-1.5 text-gray-800 dark:text-gray-100 whitespace-nowrap" title={r.actorEmail || r.userId}>{personOf(r)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${ACTION_STYLE[r.action] || ACTION_STYLE.case_view}`}>
                        {ACCESS_ACTION_LABEL[r.action] || r.action}{r.detail.auto ? ' (자동)' : ''}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">{leadCell(r)}</td>
                    <td className="px-3 py-1.5 text-xs">{countCell(r)}</td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">이 기간에 기록이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-2.5 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs text-gray-400">
            {loading && <Loader2 size={14} className="animate-spin" />}
            <span>최근 것부터 {ACCESS_LOG_PAGE_SIZE}건씩 · 시각은 한국 시간 · 같은 리드를 10분 안에 다시 연 것은 한 번만 남습니다</span>
            {hasMore && (
              <button onClick={loadMore} disabled={loading}
                className="ml-auto px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
                더 보기
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
