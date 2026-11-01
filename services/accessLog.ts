// ============================================
// 개인정보 접근 기록 (DB: 015_access_logs.sql)
// 누가 언제 어떤 리드를 열람·내보내기·휴지통·영구 삭제·녹음 재생했는지 남긴다.
// - 넣기만 한다. 결과를 돌려받지 않으므로(select 없음) 대역폭이 거의 들지 않는다.
// - 실패해도 화면에는 아무 영향이 없다 (예외를 던지지 않고, 기다리게 하지 않는다).
// - 짧은 시간에 생긴 기록은 한 번의 요청으로 보낸다. 여러 건 휴지통·영구 삭제처럼
//   같은 일을 연달아 하면 한 줄(건수 + 리드 목록)로 합친다.
// - 보기: 회사 관리자만 (팀 관리 → 접근 기록). 015 적용 전에는 조용히 아무것도 안 한다.
// ============================================
import { supabase } from './supabase';
import { loadCachedOrg, isAdminRole } from './org';

export type AccessAction =
  | 'case_view' | 'export' | 'case_trash' | 'case_restore' | 'case_purge'
  | 'recording_play' | 'recording_download';

export const ACCESS_ACTION_LABEL: Record<AccessAction, string> = {
  case_view: '리드 열람',
  export: '내보내기',
  case_trash: '휴지통으로',
  case_restore: '휴지통 복구',
  case_purge: '영구 삭제',
  recording_play: '녹음 재생',
  recording_download: '녹음 다운로드',
};
export const ACCESS_ACTIONS = Object.keys(ACCESS_ACTION_LABEL) as AccessAction[];

export interface AccessLogOptions {
  caseId?: string;
  /** 처리한 건수 (내보낸 행 수 등) */
  count?: number;
  /** 파일 이름 등. 개인정보 원문(전체 이름·번호)은 넣지 않는다 */
  detail?: Record<string, unknown>;
}

interface PendingRow {
  action: AccessAction;
  case_id: string | null;
  item_count: number | null;
  detail: Record<string, unknown>;
}

const TABLE = 'access_logs';
/** 연달아 생기면 한 줄로 합치는 행동 (리드 하나에 한 번씩 불리는 것들) */
const MERGEABLE: AccessAction[] = ['case_trash', 'case_restore', 'case_purge'];
const FLUSH_DELAY_MS = 1500;     // 마지막 기록 뒤 이만큼 조용하면 보냄
const FLUSH_MAX_WAIT_MS = 5000;  // 아무리 이어져도 이 안에는 보냄
const MAX_QUEUE = 50;
const MAX_IDS_IN_BULK = 100;
const MAX_DETAIL_CHARS = 8000;   // DB 한도(16KB)보다 작게. 넘으면 내용 대신 표시만

let queue: PendingRow[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let firstQueuedAt = 0;
let disabled = false;   // 015 전(표 없음)이거나 계속 실패하면 이 탭에서는 더 보내지 않음
let failStreak = 0;

/** 015 적용 전(표 없음)인지 */
export const isAccessLogNotReady = (e: any): boolean => {
  const code = String(e?.code || '');
  return code === '42P01' || code === 'PGRST205'
    || /does not exist|Could not find the table|schema cache/i.test(String(e?.message || e || ''));
};

/** 리드 데이터 내보내기 권한: 회사 관리자(대표·관리자)만.
 *  화면 규칙(useAuth().isAdmin)과 같게, 회사 정보를 아직 모르면 막지 않는다. */
export const canExportCaseData = (): boolean => {
  const org = loadCachedOrg();
  return org ? isAdminRole(org.role) : true;
};

/** 영구 삭제처럼 리드가 사라지는 기록에 남길 표시 (예: 김*수 ·1234). 이름·번호 원문은 남기지 않는다 */
export const maskedCaseLabel = (name?: string, phone?: string): string => {
  const s = String(name || '').trim();
  const masked = s.length <= 1 ? s : s.length === 2 ? `${s[0]}*` : `${s[0]}${'*'.repeat(Math.min(s.length - 2, 3))}${s[s.length - 1]}`;
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  const tail = digits.length >= 4 ? digits.slice(-4) : '';
  return [masked, tail && `·${tail}`].filter(Boolean).join(' ');
};

const withoutLabel = (d: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  Object.keys(d).forEach(k => { if (k !== 'label') out[k] = d[k]; });
  return out;
};

/** 같은 행동(같은 부가정보)을 리드마다 한 줄씩 남긴 것들을 한 줄로 합친다 */
const mergeRows = (rows: PendingRow[]): PendingRow[] => {
  const result: PendingRow[] = [];
  const groups = new Map<string, { list: PendingRow[]; index: number }>();
  rows.forEach(r => {
    if (!MERGEABLE.includes(r.action) || !r.case_id || r.item_count !== null) { result.push(r); return; }
    const key = `${r.action}|${JSON.stringify(withoutLabel(r.detail))}`;
    const g = groups.get(key);
    if (g) { g.list.push(r); return; }
    groups.set(key, { list: [r], index: result.length });
    result.push(r);
  });
  groups.forEach(({ list, index }) => {
    if (list.length < 2) return;
    const ids = list.map(r => r.case_id as string);
    const labels = list.map(r => r.detail.label).filter((v): v is string => typeof v === 'string' && v.length > 0);
    const detail: Record<string, unknown> = { ...withoutLabel(list[0].detail), case_ids: ids.slice(0, MAX_IDS_IN_BULK) };
    if (labels.length > 0) detail.labels = labels.slice(0, MAX_IDS_IN_BULK);
    if (ids.length > MAX_IDS_IN_BULK) detail.truncated = true;
    result[index] = { action: list[0].action, case_id: null, item_count: list.length, detail };
  });
  return result;
};

const flush = (): void => {
  if (timer) { clearTimeout(timer); timer = null; }
  if (queue.length === 0) return;
  const rows = mergeRows(queue);
  queue = [];
  firstQueuedAt = 0;
  if (!supabase || disabled) return;
  try {
    // select()를 붙이지 않는다: 상담원은 기록을 읽을 권한이 없고, 돌려받을 필요도 없다
    supabase.from(TABLE).insert(rows).then(({ error }) => {
      if (!error) { failStreak = 0; return; }
      if (isAccessLogNotReady(error)) { disabled = true; return; }
      failStreak += 1;
      if (failStreak >= 3) disabled = true; // 로그인 풀림·소속 없음 등 → 이 탭에서는 그만 보냄
      console.warn('[AccessLog] 기록 실패:', error.message);
    }, () => { /* 네트워크 오류: 버린다 */ });
  } catch { /* 기록 실패는 무시 */ }
};

const schedule = (): void => {
  const now = Date.now();
  if (!firstQueuedAt) firstQueuedAt = now;
  if (timer) clearTimeout(timer);
  const wait = Math.max(0, Math.min(FLUSH_DELAY_MS, firstQueuedAt + FLUSH_MAX_WAIT_MS - now));
  timer = setTimeout(flush, wait);
};

// 탭을 닫거나 다른 앱으로 넘어갈 때 남은 기록을 바로 보낸다 (최선)
try {
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', flush);
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  }
} catch { /* 브라우저가 아닌 환경(점검 스크립트 등) */ }

/**
 * 접근 기록 남기기. 기다릴 필요 없고, 실패해도 예외를 던지지 않는다.
 * 회사·사람·이메일·시각은 서버가 채운다.
 */
export function logAccess(action: AccessAction, opts: AccessLogOptions = {}): void {
  try {
    if (!supabase || disabled) return;
    const count = typeof opts.count === 'number' && Number.isFinite(opts.count) ? Math.max(0, Math.round(opts.count)) : null;
    let detail: Record<string, unknown> = opts.detail && typeof opts.detail === 'object' ? opts.detail : {};
    try {
      if (JSON.stringify(detail).length > MAX_DETAIL_CHARS) detail = { truncated: true };
    } catch { detail = {}; }
    queue.push({
      action,
      case_id: opts.caseId ? String(opts.caseId).slice(0, 200) : null,
      item_count: count,
      detail,
    });
    if (queue.length >= MAX_QUEUE) flush();
    else schedule();
  } catch { /* 기록 실패는 무시 */ }
}

// ---- 같은 탭에서 10분 안에 같은 것을 다시 열면 기록하지 않음 (sessionStorage) ----
const SEEN_KEY = 'lm_access_seen';
const SEEN_TTL_MS = 10 * 60 * 1000;
const MAX_SEEN = 300;

const seenRecently = (key: string): boolean => {
  try {
    const now = Date.now();
    const who = loadCachedOrg()?.userId || '';
    const k = `${who}:${key}`;
    let seen: Record<string, number> = {};
    try { seen = JSON.parse(sessionStorage.getItem(SEEN_KEY) || '{}') || {}; } catch { seen = {}; }
    if (typeof seen[k] === 'number' && now - seen[k] < SEEN_TTL_MS) return true;
    const fresh: Record<string, number> = {};
    Object.keys(seen)
      .filter(x => typeof seen[x] === 'number' && now - seen[x] < SEEN_TTL_MS)
      .sort((a, b) => seen[b] - seen[a])
      .slice(0, MAX_SEEN - 1)
      .forEach(x => { fresh[x] = seen[x]; });
    fresh[k] = now;
    try { sessionStorage.setItem(SEEN_KEY, JSON.stringify(fresh)); } catch { /* 저장 못 해도 기록은 남김 */ }
    return false;
  } catch {
    return false;
  }
};

/** 리드 상세를 열었을 때. 같은 탭에서 10분 안에 같은 리드를 다시 열면 건너뛴다 */
export function logCaseView(caseId: string): void {
  if (!caseId || seenRecently(`case:${caseId}`)) return;
  logAccess('case_view', { caseId });
}

/** 통화 녹음을 재생했을 때. 일시정지 후 다시 재생 등은 10분 안에 한 번만 */
export function logRecordingPlay(caseId: string, recordingId: string): void {
  if (!recordingId || seenRecently(`rec:${recordingId}`)) return;
  logAccess('recording_play', { caseId, detail: { recording_id: recordingId } });
}

// ============================================
// 관리자 화면용 조회 (팀 관리 → 접근 기록)
// ============================================
export interface AccessLogRow {
  id: number;
  userId: string;
  actorEmail?: string;
  action: AccessAction;
  caseId?: string;
  itemCount?: number;
  detail: Record<string, any>;
  createdAt: string;
}

export const ACCESS_LOG_PAGE_SIZE = 200;

// PostgREST or 필터 안에서 쓰는 값은 큰따옴표로 감싼다 (시각에 . : + 가 들어 있음)
const pgQuote = (v: string) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * 최근 것부터 한 쪽(기본 200건). 더 보기 = 마지막 줄의 { createdAt, id }를 before로.
 * 015 전에는 Postgrest 오류를 그대로 던진다 (isAccessLogNotReady로 구분).
 */
export const fetchAccessLogs = async (opts: {
  orgId: string;
  since: string;
  userId?: string;
  action?: AccessAction;
  before?: { createdAt: string; id: number };
  limit?: number;
}): Promise<AccessLogRow[]> => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다');
  let q = supabase.from(TABLE)
    .select('id, user_id, actor_email, action, case_id, item_count, detail, created_at')
    .eq('org_id', opts.orgId)            // 플랫폼 관리자는 모든 회사를 볼 수 있으므로 지금 회사로 좁힌다
    .gte('created_at', opts.since);
  if (opts.userId) q = q.eq('user_id', opts.userId);
  if (opts.action) q = q.eq('action', opts.action);
  if (opts.before) {
    const t = pgQuote(opts.before.createdAt);
    q = q.or(`created_at.lt.${t},and(created_at.eq.${t},id.lt.${Number(opts.before.id)})`);
  }
  const { data, error } = await q
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(opts.limit ?? ACCESS_LOG_PAGE_SIZE);
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: Number(r.id),
    userId: r.user_id,
    actorEmail: r.actor_email || undefined,
    action: r.action,
    caseId: r.case_id || undefined,
    itemCount: r.item_count ?? undefined,
    detail: r.detail && typeof r.detail === 'object' ? r.detail : {},
    createdAt: r.created_at,
  }));
};
