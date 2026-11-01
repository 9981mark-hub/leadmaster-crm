/**
 * 구글 드라이브 공통 함수 (2026-11-01)
 * - 회사별 갱신 토큰은 DB Vault에 있고 service_role 함수(drive_get_refresh_token)로만 읽는다.
 * - 권한 범위는 drive.file (리드마스터가 만들었거나 사용자가 골라 준 파일·폴더만).
 * - 토큰 값은 로그·응답에 넣지 않는다.
 */
import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') || '';
export const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') || '';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export class DriveError extends Error {
  constructor(message: string, public status = 500, public code = 'drive_error') { super(message); }
}

/** 회사 드라이브 접근 토큰 (1시간짜리). 연결이 끊겼으면 상태를 error로 바꾸고 DriveError */
export async function getAccessToken(admin: SupabaseClient, orgId: string): Promise<string> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new DriveError('서버에 구글 드라이브 설정이 없습니다', 500, 'not_configured');
  const { data: refresh, error } = await admin.rpc('drive_get_refresh_token', { p_org: orgId });
  if (error) throw new DriveError('드라이브 연결 정보를 읽지 못했습니다', 500);
  if (!refresh) throw new DriveError('구글 드라이브가 연결되어 있지 않습니다', 409, 'not_connected');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: String(refresh), grant_type: 'refresh_token' }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) {
    const revoked = j.error === 'invalid_grant';
    const msg = revoked
      ? '구글 드라이브 연결이 끊어졌습니다 (구글에서 권한이 해제되었거나 만료됨). 녹음 설정에서 다시 연결하세요.'
      : `구글 토큰 갱신 실패 (${j.error || res.status})`;
    await admin.from('org_drive_connections').update({ status: revoked ? 'error' : undefined, last_error: msg, updated_at: new Date().toISOString() }).eq('org_id', orgId);
    throw new DriveError(msg, revoked ? 409 : 502, revoked ? 'revoked' : 'token_failed');
  }
  return j.access_token as string;
}

export async function markOk(admin: SupabaseClient, orgId: string) {
  await admin.from('org_drive_connections').update({ last_ok_at: new Date().toISOString(), last_error: null, status: 'connected', updated_at: new Date().toISOString() }).eq('org_id', orgId);
}

async function driveJson(token: string, url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  if (res.status === 204) return null;
  const text = await res.text();
  let j: any = null; try { j = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (!res.ok) {
    const reason = j?.error?.errors?.[0]?.reason || j?.error?.status || '';
    const message = j?.error?.message || text.slice(0, 200) || `HTTP ${res.status}`;
    if (reason === 'storageQuotaExceeded') throw new DriveError('구글 드라이브 저장 공간이 가득 찼습니다', 507, 'quota_full');
    if (res.status === 404) throw new DriveError('드라이브에서 파일·폴더를 찾을 수 없거나 리드마스터에 허용되지 않았습니다', 404, 'not_found');
    if (res.status === 403) throw new DriveError(`드라이브 권한 없음: ${message}`, 403, reason || 'forbidden');
    throw new DriveError(`드라이브 오류: ${message}`, res.status >= 500 ? 502 : 400, reason || 'drive_error');
  }
  return j;
}

export const getFile = (token: string, id: string, fields = 'id,name,mimeType,trashed,size,md5Checksum,parents,capabilities(canAddChildren,canTrash,canDelete,canShare)') =>
  driveJson(token, `${DRIVE}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`);

export const createFolder = (token: string, name: string, parentId?: string) =>
  driveJson(token, `${DRIVE}/files?fields=id,name&supportsAllDrives=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
  });

export const deleteFile = (token: string, id: string) =>
  driveJson(token, `${DRIVE}/files/${encodeURIComponent(id)}?supportsAllDrives=true`, { method: 'DELETE' });

export const trashFile = (token: string, id: string) =>
  driveJson(token, `${DRIVE}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,trashed`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
  });

export const listChildren = (token: string, parentId: string, pageSize = 100, pageToken?: string) =>
  driveJson(token, `${DRIVE}/files?q=${encodeURIComponent(`'${parentId.replace(/'/g, "\\'")}' in parents and trashed = false`)}&pageSize=${pageSize}&fields=${encodeURIComponent('nextPageToken,files(id,name,mimeType,size)')}&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);

/** 작은 파일 한 번에 올리기 (시험·메모용, 5MB 이하) */
export async function uploadSmall(token: string, parentId: string, name: string, mime: string, bytes: Uint8Array, description?: string) {
  const boundary = 'lm' + crypto.randomUUID().replace(/-/g, '');
  const meta = JSON.stringify({ name, parents: [parentId], ...(description ? { description } : {}) });
  const enc = new TextEncoder();
  const head = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`);
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0); body.set(bytes, head.length); body.set(tail, head.length + bytes.length);
  return driveJson(token, `${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,size,md5Checksum`, {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
  });
}

/** 회사 폴더 아래 key별 폴더를 찾거나 만든다 (drive_folders에 기억) */
export async function ensureFolder(admin: SupabaseClient, token: string, orgId: string, rootId: string, key: string, name: string, parentId: string): Promise<string> {
  const { data: row } = await admin.from('drive_folders').select('folder_id').eq('org_id', orgId).eq('root_id', rootId).eq('folder_key', key).maybeSingle();
  if (row?.folder_id) {
    try {
      const f = await getFile(token, row.folder_id, 'id,trashed');
      if (f && !f.trashed) return row.folder_id;
    } catch (e) { if (!(e instanceof DriveError && e.code === 'not_found')) throw e; }
  }
  const created = await createFolder(token, name, parentId);
  await admin.from('drive_folders').upsert({ org_id: orgId, root_id: rootId, folder_key: key, folder_id: created.id, name }, { onConflict: 'org_id,root_id,folder_key' });
  return created.id as string;
}

/** 구글 id_token 내용 (구글 토큰 응답에서 직접 받은 것만 사용, 서명 검사 생략) */
export function decodeIdToken(idToken?: string): { email?: string; sub?: string } {
  if (!idToken) return {};
  try {
    const p = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(p + '='.repeat((4 - (p.length % 4)) % 4)));
  } catch { return {}; }
}
