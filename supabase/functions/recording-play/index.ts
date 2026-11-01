/**
 * Supabase Edge Function: recording-play (2026-11-02)
 * 기획: docs/기획서_통화녹음_구글드라이브_장기보관_v1.md (5.4)
 *
 * 회사 구글 드라이브의 비공개 녹음을 CRM에서 듣게 한다. 드라이브 파일은 공개하지 않는다.
 * 1) POST (로그인 JWT) { recording_id }               → call_recordings(드라이브 보관) 듣기 주소
 *    POST (로그인 JWT) { case_id, drive_file_id }      → 리드 상세의 예전 녹음(cases.recordings 드라이브 링크) 듣기 주소
 *    → 사용자 권한(RLS)으로 녹음·리드를 읽을 수 있을 때만 서명된 주소(1시간)를 준다.
 * 2) GET ?t=<서명된 값>  → 서버가 회사 드라이브에서 받아 그대로 흘려보냄 (구간 재생 Range 지원)
 *
 * <audio src>는 Authorization 헤더를 못 보내므로, 1시간짜리 서명 주소를 쓴다 (서명 키 = 서버 비밀값에서 파생).
 * 대역폭: 재생한 만큼 Supabase 함수 대역폭을 쓴다 (3분 녹음 ≈ 3MB).
 * Deploy: supabase functions deploy recording-play --no-verify-jwt --use-api --project-ref cenksfblktflfurxjmtv
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { DriveError, getAccessToken } from '../_shared/drive.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TTL_SEC = 3600;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ---------- 서명 ----------
const enc = new TextEncoder();
let keyP: Promise<CryptoKey> | null = null;
const hmacKey = () => keyP ??= crypto.subtle.importKey('raw', enc.encode(`lm-recording-play:${SUPABASE_SERVICE_ROLE_KEY}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));

async function sign(payload: Record<string, unknown>) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(body)));
  return `${body}.${b64u(sig)}`;
}
async function verify(t: string): Promise<any | null> {
  const [body, sig] = t.split('.');
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(), unb64u(sig), enc.encode(body));
  if (!ok) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(unb64u(body)));
    if (!p.exp || Date.now() / 1000 > p.exp) return null;
    return p;
  } catch { return null; }
}

// 같은 함수 인스턴스 안에서는 구글 토큰을 잠깐 다시 쓴다 (구간 재생 요청이 여러 번 옴)
const tokenCache = new Map<string, { token: string; until: number }>();
async function orgToken(orgId: string) {
  const c = tokenCache.get(orgId);
  if (c && c.until > Date.now()) return c.token;
  const token = await getAccessToken(admin, orgId);
  tokenCache.set(orgId, { token, until: Date.now() + 45 * 60_000 });
  return token;
}

const driveIdFromUrl = (url: string) => (url.match(/\/d\/([A-Za-z0-9_-]{10,})/) || url.match(/[?&]id=([A-Za-z0-9_-]{10,})/) || [])[1] || '';

// ---------- 듣기 주소 발급 ----------
async function handleSign(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ ok: false, error: '로그인이 필요합니다' }, 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ ok: false, error: '로그인이 만료되었습니다. 다시 로그인하세요.' }, 401);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  let orgId = '', fileId = '', mime = 'audio/mp4', caseId = '';
  if (body.recording_id) {
    const { data: rec } = await userClient.from('call_recordings')
      .select('id, org_id, case_id, storage_kind, drive_file_id, mime_type, audio_deleted_at').eq('id', String(body.recording_id)).maybeSingle();
    if (!rec) return json({ ok: false, error: '녹음을 찾을 수 없거나 권한이 없습니다' }, 404);
    if (rec.storage_kind !== 'gdrive' || !rec.drive_file_id) return json({ ok: false, error: '드라이브에 보관된 녹음이 아닙니다' }, 400);
    if (rec.audio_deleted_at) return json({ ok: false, error: '녹음 파일이 삭제되었습니다' }, 410);
    orgId = rec.org_id; fileId = rec.drive_file_id; mime = rec.mime_type || mime; caseId = rec.case_id;
  } else if (body.case_id && body.drive_file_id) {
    fileId = String(body.drive_file_id);
    if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return json({ ok: false, error: '파일 id 형식 오류' }, 400);
    // 사용자 권한으로 리드를 읽을 수 있어야 하고, 그 리드에 실제로 그 파일 링크가 있어야 한다
    const { data: c } = await userClient.from('cases').select('case_id, org_id, recordings').eq('case_id', String(body.case_id)).maybeSingle();
    if (!c) return json({ ok: false, error: '리드를 찾을 수 없거나 권한이 없습니다' }, 404);
    const item = (Array.isArray(c.recordings) ? c.recordings : []).find((r: any) => driveIdFromUrl(String(r?.url || '')) === fileId);
    if (!item) return json({ ok: false, error: '이 리드의 녹음이 아닙니다' }, 403);
    orgId = c.org_id; mime = item.mimeType || mime; caseId = c.case_id;
  } else {
    return json({ ok: false, error: '녹음이 지정되지 않았습니다' }, 400);
  }

  // 회사 드라이브가 연결돼 있는지 미리 확인 (주소를 줬는데 재생이 안 되는 일을 줄임)
  const { data: conn } = await admin.from('org_drive_connections').select('status, token_secret_id').eq('org_id', orgId).maybeSingle();
  if (!conn || conn.status !== 'connected' || !conn.token_secret_id) return json({ ok: false, error: '회사 구글 드라이브가 연결되어 있지 않습니다', code: 'not_connected' }, 409);

  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  const t = await sign({ o: orgId, f: fileId, m: mime, c: caseId, u: u.user.id, exp });
  return json({ ok: true, url: `${SUPABASE_URL}/functions/v1/recording-play?t=${t}`, expires_at: new Date(exp * 1000).toISOString() });
}

// ---------- 재생 ----------
async function handleStream(req: Request, url: URL) {
  const p = await verify(url.searchParams.get('t') || '');
  if (!p) return new Response('듣기 주소가 만료되었거나 잘못되었습니다. 화면을 새로고침하세요.', { status: 403, headers: CORS });
  const token = await orgToken(p.o);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const range = req.headers.get('range');
  if (range) headers.Range = range;
  const up = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(p.f)}?alt=media&supportsAllDrives=true`, { headers });
  if (!up.ok && up.status !== 206) {
    if (up.status === 401) tokenCache.delete(p.o);
    await up.body?.cancel();
    const msg = up.status === 404 ? '드라이브에서 녹음을 찾을 수 없거나 리드마스터에 허용되지 않았습니다' : `드라이브 오류 (HTTP ${up.status})`;
    return new Response(msg, { status: up.status === 404 ? 404 : 502, headers: CORS });
  }
  const out = new Headers(CORS);
  out.set('Content-Type', up.headers.get('content-type')?.startsWith('audio/') ? up.headers.get('content-type')! : p.m);
  for (const h of ['content-length', 'content-range']) { const v = up.headers.get(h); if (v) out.set(h, v); }
  out.set('Accept-Ranges', 'bytes');
  out.set('Cache-Control', 'private, max-age=600');
  out.set('Content-Disposition', 'inline');
  return new Response(up.body, { status: up.status, headers: out });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = new URL(req.url);
    if (req.method === 'GET' || req.method === 'HEAD') return await handleStream(req, url);
    if (req.method === 'POST') return await handleSign(req);
    return json({ ok: false, error: 'method' }, 405);
  } catch (e) {
    if (e instanceof DriveError) return json({ ok: false, error: e.message, code: e.code }, e.status);
    console.error('[recording-play]', String(e));
    return json({ ok: false, error: '서버 오류' }, 500);
  }
});
