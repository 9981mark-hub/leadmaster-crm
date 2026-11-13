// ============================================
// 회사별 서버 저장소 (settings 표 key/value) — 2026-11-13
// 예전에 브라우저(localStorage)에만 있던 업무 데이터(고정비·예산·원천세·은행 거래내역·
// 세무 알림·광고비·교육 설정/기록·지출)를 회사(org)별로 서버에 둔다.
//
// - 서버가 원본. 브라우저에는 빠른 표시용 사본(lm_store_<key>)만 둔다.
// - 읽기: 처음 쓸 때 1번 + 탭 복귀 시 최대 5분에 1번 (updated_at만 먼저 보고 바뀐 경우에만 값을 받음).
// - 쓰기: 회사 관리자(owner/admin)만 (settings RLS). 쓰기 직전에 서버 최신값을 확인하고
//   그 위에 변경을 적용해서 올린다(다른 PC가 쓴 내용을 빈 캐시로 덮어쓰지 않게).
// - 1회 이전: 서버 값이 비어 있고 예전 localStorage에 값이 있으면 관리자 로그인 때 한 번 올리고
//   lm_migrated_<key>_<orgId> 표시를 남긴다. 둘 다 있으면 서버 값을 쓰고 경고만 남긴다.
//   예전 localStorage 사본은 업로드가 성공한 뒤에만 지운다.
// ============================================
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { loadCachedOrg, isAdminRole } from './org';

export interface StoreKeySpec<T> {
  /** settings.key (camelCase) */
  key: string;
  /** 값이 없을 때 */
  empty: () => T;
  /** 예전 localStorage 값 읽기 (없으면 undefined) — 1회 이전용 */
  legacy?: () => T | undefined;
  /** 1회 이전 성공 후 지울 예전 localStorage 키 */
  legacyKeys?: string[];
  /** 비었는지 판단 (기본: 빈 배열/빈 객체/null) */
  isEmpty?: (v: T) => boolean;
  /** 저장 직전 정리 (개수 제한 등) */
  compact?: (v: T) => T;
  /** 이 크기(바이트)를 넘으면 저장 거부. 기본 4MB */
  maxBytes?: number;
  /** 이 크기를 넘으면 경고 로그. 기본 1MB */
  warnBytes?: number;
}

// ok=true면 value, ok=false면 error(한국어 안내 문구)
export interface StoreWriteResult<T> { ok: boolean; value?: T; error?: string }

const REFRESH_MS = 5 * 60 * 1000; // 탭 복귀 시 최소 간격
const LOCAL_PREFIX = 'lm_store_';
const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;
const DEFAULT_WARN_BYTES = 1024 * 1024;

/** 이 저장소가 관리하는 settings key (전체 settings 조회에서 뺀다 → 대역폭 절약) */
export const ORG_STORE_KEYS = [
  'expenses',
  'fixedCosts',
  'budgets',
  'withholdingRecords',
  'bankTransactions',
  'taxReminders',
  'adMetrics',
  'trainingConfig',
  'trainingSessions',
] as const;

interface Entry {
  orgId: string;
  value: any;
  updatedAt: string | null;
  loaded: boolean;       // 서버에서 한 번이라도 확인했는지
  lastCheckMs: number;
  lastLoadFailed: boolean; // 마지막 서버 확인이 실패했는지
  inflight: Promise<any> | null;
  writeChain: Promise<any>;
}

const entries = new Map<string, Entry>();
const specs = new Map<string, StoreKeySpec<any>>();
const subscribers = new Map<string, Set<(v: any) => void>>();

const currentOrg = () => loadCachedOrg();
const entryId = (orgId: string, key: string) => `${orgId}:${key}`;

const defaultIsEmpty = (v: any) =>
  v === null || v === undefined ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

const isEmptyBy = <T,>(spec: StoreKeySpec<T>, v: T | undefined | null) =>
  v === undefined || v === null || (spec.isEmpty ? spec.isEmpty(v) : defaultIsEmpty(v));

const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

const readLocalCache = (orgId: string, key: string): { value: any; updatedAt: string | null } | null => {
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.orgId !== orgId) return null;
    return { value: parsed.value, updatedAt: parsed.updatedAt || null };
  } catch {
    return null;
  }
};

const writeLocalCache = (orgId: string, key: string, value: any, updatedAt: string | null) => {
  try {
    localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify({ orgId, updatedAt, value }));
  } catch (e) {
    // 용량 초과 등: 사본만 못 남기는 것이므로 서버 값은 그대로 쓴다
    console.warn(`[OrgStore] local cache write failed (${key}):`, e);
    try { localStorage.removeItem(LOCAL_PREFIX + key); } catch { /* ignore */ }
  }
};

const notify = (key: string, value: any) => {
  subscribers.get(key)?.forEach(cb => {
    try { cb(value); } catch (e) { console.warn('[OrgStore] subscriber error:', e); }
  });
};

const getEntry = <T,>(spec: StoreKeySpec<T>, orgId: string): Entry => {
  specs.set(spec.key, spec);
  const id = entryId(orgId, spec.key);
  let e = entries.get(id);
  if (!e) {
    const cached = readLocalCache(orgId, spec.key);
    e = {
      orgId,
      value: cached ? cached.value : undefined,
      updatedAt: cached ? cached.updatedAt : null,
      loaded: false,
      lastCheckMs: 0,
      lastLoadFailed: false,
      inflight: null,
      writeChain: Promise.resolve(),
    };
    entries.set(id, e);
  }
  return e;
};

const migratedFlag = (key: string, orgId: string) => `lm_migrated_${key}_${orgId}`;

const safeLegacy = <T,>(spec: StoreKeySpec<T>): T | undefined => {
  if (!spec.legacy) return undefined;
  try { return spec.legacy(); } catch { return undefined; }
};

const errorMessage = (err: any): string => {
  const code = err?.code;
  const msg = String(err?.message || err || '');
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return '저장 권한이 없습니다. 회사 관리자만 저장할 수 있습니다.';
  }
  if (/Failed to fetch|NetworkError|network/i.test(msg)) {
    return '서버에 연결하지 못해 저장하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
  }
  return `서버 저장에 실패했습니다: ${msg || '알 수 없는 오류'}`;
};

const upsertRaw = async (orgId: string, key: string, value: any): Promise<string> => {
  if (!supabase) throw new Error('서버가 설정되지 않았습니다');
  const { data, error } = await supabase
    .from('settings')
    .upsert({ org_id: orgId, key, value, updated_at: new Date().toISOString() }, { onConflict: 'org_id,key' })
    .select('updated_at')
    .maybeSingle();
  if (error) throw error;
  return (data as any)?.updated_at || new Date().toISOString();
};

/**
 * 동기 조회: 메모리/브라우저 사본 값을 바로 돌려준다 (없으면 empty, 예전 localStorage 값 우선 표시).
 * 서버 확인이 필요하면 뒤에서 불러오고, 끝나면 subscribeOrgStore 구독자에게 알린다.
 */
export const peekOrgStore = <T,>(spec: StoreKeySpec<T>): T => {
  const org = currentOrg();
  if (!org) {
    const legacy = safeLegacy(spec);
    return legacy !== undefined ? legacy : spec.empty();
  }
  const e = getEntry(spec, org.orgId);
  if (!e.loaded || Date.now() - e.lastCheckMs > REFRESH_MS) {
    loadOrgStore(spec).catch(() => { /* 로그는 loadOrgStore 안에서 */ });
  }
  if (e.value !== undefined) return e.value as T;
  const legacy = safeLegacy(spec);
  return legacy !== undefined ? legacy : spec.empty();
};

/**
 * 서버에서 값을 확인해 돌려준다.
 * - 이미 불러왔고 5분이 안 지났으면 서버에 묻지 않는다 (force면 updated_at만 확인).
 * - 서버 값이 비어 있고 예전 localStorage 값이 있으면 1회 이전 (관리자만).
 */
export const loadOrgStore = async <T,>(spec: StoreKeySpec<T>, opts: { force?: boolean } = {}): Promise<T> => {
  const org = currentOrg();
  if (!org || !supabase) {
    const legacy = safeLegacy(spec);
    return legacy !== undefined ? legacy : spec.empty();
  }
  const e = getEntry(spec, org.orgId);
  if (!opts.force && e.loaded && Date.now() - e.lastCheckMs < REFRESH_MS) {
    return (e.value !== undefined ? e.value : spec.empty()) as T;
  }
  if (e.inflight) return e.inflight;

  e.inflight = (async () => {
    try {
      // 1) 바뀌었는지 먼저 (값 없이 updated_at만) — 브라우저 사본이 있을 때만 의미 있음
      if (e.value !== undefined && e.updatedAt) {
        const { data: head, error: headErr } = await supabase!
          .from('settings')
          .select('updated_at')
          .eq('org_id', org.orgId)
          .eq('key', spec.key)
          .maybeSingle();
        if (headErr) throw headErr;
        if (head && (head as any).updated_at === e.updatedAt) {
          e.loaded = true;
          e.lastLoadFailed = false;
          e.lastCheckMs = Date.now();
          return e.value as T;
        }
      }

      // 2) 값 받기
      const { data, error } = await supabase!
        .from('settings')
        .select('value, updated_at')
        .eq('org_id', org.orgId)
        .eq('key', spec.key)
        .maybeSingle();
      if (error) throw error;

      let value: any = data ? (data as any).value : undefined;
      let updatedAt: string | null = data ? (data as any).updated_at : null;

      // 3) 1회 이전
      const flag = migratedFlag(spec.key, org.orgId);
      const alreadyMigrated = localStorage.getItem(flag) === '1';
      const legacy = alreadyMigrated ? undefined : safeLegacy(spec);
      const hasLegacy = legacy !== undefined && !isEmptyBy(spec, legacy);

      if (hasLegacy) {
        if (isEmptyBy(spec, value)) {
          if (isAdminRole(org.role)) {
            try {
              const toUpload = spec.compact ? spec.compact(legacy as T) : legacy;
              updatedAt = await upsertRaw(org.orgId, spec.key, toUpload);
              value = toUpload;
              localStorage.setItem(flag, '1');
              (spec.legacyKeys || []).forEach(k => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
              console.log(`[OrgStore] migrated local "${spec.key}" to server (org ${org.orgId.slice(0, 8)})`);
            } catch (upErr) {
              // 업로드 실패: 예전 사본은 지우지 않고 화면에는 그 값을 보여 준다 (다음에 다시 시도)
              console.warn(`[OrgStore] migration upload failed (${spec.key}):`, upErr);
              value = legacy;
              updatedAt = null;
            }
          } else {
            // 관리자가 아니면 올릴 수 없음 → 이 브라우저 값만 보여 준다
            value = legacy;
            updatedAt = null;
          }
        } else {
          console.warn(`[OrgStore] "${spec.key}": server and local copies both exist → using server data (local copy kept, not uploaded)`);
          localStorage.setItem(flag, '1');
        }
      }

      if (value === undefined || value === null) value = spec.empty();
      e.value = value;
      e.updatedAt = updatedAt;
      e.loaded = true;
      e.lastLoadFailed = false;
      e.lastCheckMs = Date.now();
      if (updatedAt) writeLocalCache(org.orgId, spec.key, value, updatedAt);
      notify(spec.key, value);
      return value as T;
    } catch (err) {
      console.warn(`[OrgStore] load failed (${spec.key}):`, err);
      e.lastLoadFailed = true;
      // 실패하면 1분 뒤에 다시 시도할 수 있게
      e.lastCheckMs = Date.now() - REFRESH_MS + 60 * 1000;
      if (e.value !== undefined) return e.value as T;
      const legacy = safeLegacy(spec);
      return (legacy !== undefined ? legacy : spec.empty()) as T;
    } finally {
      e.inflight = null;
    }
  })();
  return e.inflight;
};

/**
 * 서버 최신값 위에 변경을 적용해서 저장한다 (관리자만).
 * mutate는 서버 최신값의 복사본을 받아 새 값을 돌려준다.
 */
export const mutateOrgStore = <T,>(spec: StoreKeySpec<T>, mutate: (current: T) => T): Promise<StoreWriteResult<T>> => {
  const org = currentOrg();
  if (!org || !supabase) {
    return Promise.resolve({ ok: false, error: '로그인(회사 정보)이 확인되지 않아 저장하지 못했습니다. 다시 로그인해 주세요.' });
  }
  if (!isAdminRole(org.role)) {
    return Promise.resolve({ ok: false, error: '이 항목은 회사 관리자만 저장할 수 있습니다.' });
  }
  const e = getEntry(spec, org.orgId);

  const run = async (): Promise<StoreWriteResult<T>> => {
    try {
      // 서버 최신값 확인 (바뀌지 않았으면 updated_at만 받는다)
      const current = await loadOrgStore(spec, { force: true });
      if (!e.loaded || e.lastLoadFailed) {
        return { ok: false, error: '서버에서 최신 데이터를 확인하지 못해 저장하지 않았습니다. 잠시 뒤 다시 시도해 주세요.' };
      }
      let next = mutate(clone(current));
      if (spec.compact) next = spec.compact(next);

      const size = new Blob([JSON.stringify(next)]).size;
      const max = spec.maxBytes ?? DEFAULT_MAX_BYTES;
      if (size > max) {
        return { ok: false, error: `저장할 데이터가 너무 큽니다 (${Math.round(size / 1024)}KB). 오래된 항목을 정리한 뒤 다시 시도해 주세요.` };
      }
      if (size > (spec.warnBytes ?? DEFAULT_WARN_BYTES)) {
        console.warn(`[OrgStore] "${spec.key}" is large: ${Math.round(size / 1024)}KB`);
      }

      const updatedAt = await upsertRaw(org.orgId, spec.key, next);
      e.value = next;
      e.updatedAt = updatedAt;
      e.loaded = true;
      e.lastCheckMs = Date.now();
      writeLocalCache(org.orgId, spec.key, next, updatedAt);
      notify(spec.key, next);
      return { ok: true, value: next };
    } catch (err) {
      console.error(`[OrgStore] save failed (${spec.key}):`, err);
      return { ok: false, error: errorMessage(err) };
    }
  };

  // 같은 key 쓰기는 차례대로 (내 쓰기끼리 덮어쓰지 않게)
  const p = e.writeChain.then(run, run);
  e.writeChain = p.catch(() => undefined);
  return p;
};

/** 값 바뀜 구독 (서버에서 새 값을 받았거나 저장했을 때). 해제 함수를 돌려준다. */
export const subscribeOrgStore = <T,>(spec: StoreKeySpec<T>, cb: (v: T) => void): (() => void) => {
  specs.set(spec.key, spec);
  let set = subscribers.get(spec.key);
  if (!set) { set = new Set(); subscribers.set(spec.key, set); }
  set.add(cb as any);
  ensureFocusListener();
  return () => { set!.delete(cb as any); };
};

/** 증분 동기화에서 바뀐 key를 알려 주면, 지금 화면에서 쓰는 key만 다시 확인한다. */
export const markOrgStoreKeysChanged = (keys: string[]) => {
  keys.forEach(key => {
    const spec = specs.get(key);
    if (!spec || !(subscribers.get(key)?.size)) return;
    loadOrgStore(spec, { force: true }).catch(() => undefined);
  });
};

/**
 * 저장 실패 안내 (같은 문구는 3초 안에 한 번만). 화면 코드가 토스트를 못 쓰는 곳(동기 함수 등)에서 쓴다.
 */
let lastErrorMsg = '';
let lastErrorAt = 0;
export const reportOrgStoreError = (message: string) => {
  const now = Date.now();
  if (message === lastErrorMsg && now - lastErrorAt < 3000) return;
  lastErrorMsg = message;
  lastErrorAt = now;
  console.error('[OrgStore]', message);
  if (typeof window !== 'undefined') {
    try { window.alert(message); } catch { /* ignore */ }
  }
};

export const isOrgStoreKey = (key: string) => (ORG_STORE_KEYS as readonly string[]).includes(key);

/** 지금 로그인한 사람이 저장할 수 있는지 (관리자) */
export const canWriteOrgStore = (): boolean => isAdminRole(currentOrg()?.role);

/**
 * 전체 settings 조회 (이 저장소 key 제외) — 은행 거래내역처럼 큰 값을 동기화 때마다 받지 않게.
 * 실패하면 빈 객체 (기존 fetchSettingsFromSupabase와 같은 동작).
 */
export const fetchSettingsExceptOrgStore = async (): Promise<Record<string, any>> => {
  if (!supabase) return {};
  try {
    const list = ORG_STORE_KEYS.map(k => `"${k}"`).join(',');
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .not('key', 'in', `(${list})`);
    if (error) throw error;
    const settings: Record<string, any> = {};
    (data || []).forEach((row: any) => { settings[row.key] = row.value; });
    return settings;
  } catch (err) {
    console.error('[OrgStore] settings fetch failed:', err);
    return {};
  }
};

// 탭 복귀: 지금 화면에서 구독 중인 key만, 5분이 지났을 때만 확인
let focusListenerInstalled = false;
const ensureFocusListener = () => {
  if (focusListenerInstalled || typeof document === 'undefined') return;
  focusListenerInstalled = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    subscribers.forEach((set, key) => {
      if (!set.size) return;
      const spec = specs.get(key);
      if (spec) loadOrgStore(spec).catch(() => undefined);
    });
  });
};

/**
 * 화면용 훅: 처음엔 브라우저 사본(없으면 empty)을 보여 주고, 서버 확인이 끝나면 바꾼다.
 * 다른 곳에서 저장하거나 탭 복귀로 새 값을 받으면 자동 갱신.
 */
export const useOrgStore = <T,>(spec: StoreKeySpec<T>): { value: T; loading: boolean } => {
  const [value, setValue] = useState<T>(() => peekOrgStore(spec));
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const unsub = subscribeOrgStore(spec, v => { if (alive) setValue(v); });
    loadOrgStore(spec).then(v => {
      if (!alive) return;
      setValue(v);
      setLoading(false);
    });
    return () => { alive = false; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.key]);
  return { value, loading };
};

/** 예전 localStorage JSON 읽기 도우미 */
export const readLegacyJson = <T,>(key: string): T | undefined => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};
