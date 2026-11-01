/**
 * Supabase Edge Function: drive-connect (2026-11-01)
 * 기획: docs/기획서_통화녹음_구글드라이브_장기보관_v1.md (5.1, 5.6)
 *
 * 회사 관리자가 자기 회사 구글 드라이브를 리드마스터에 연결한다 (녹음 장기 보관용).
 * - POST (로그인 JWT 필요, 회사 owner/admin만):
 *     { action: 'start', return_to }      → 구글 허락 화면 주소
 *     { action: 'create_folder', name? }  → 드라이브에 새 보관 폴더를 만들고 정함
 *     { action: 'picker_token' }          → 기존 폴더 고르기(Google Picker)용 1시간 토큰 (관리자 화면에서만)
 *     { action: 'set_folder', folder_id } → Picker에서 고른 폴더를 보관 폴더로 정함
 *     { action: 'test' }                  → 하위 폴더 만들기·작은 파일 올리기·확인·지우기 (단계별 결과 저장)
 *     { action: 'disconnect' }            → 구글 권한 취소 + 저장된 토큰 삭제
 * - GET ?code&state (구글이 돌려보냄): 토큰 교환 → Vault 저장 → 웹으로 돌아감 (#/team?drive=connected)
 *
 * 비밀값: GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET (서버 비밀값에만)
 * 구글 콜백은 JWT가 없으므로 JWT 검증을 끄고 배포한다. POST는 이 함수가 직접 사용자 JWT를 확인한다.
 * Deploy: supabase functions deploy drive-connect --no-verify-jwt --use-api --project-ref cenksfblktflfurxjmtv
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DRIVE_SCOPE, FOLDER_MIME, DriveError,
  getAccessToken, markOk, getFile, createFolder, deleteFile, listChildren, uploadSmall, decodeIdToken,
} from '../_shared/drive.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/drive-connect`;
const GOOGLE_PROJECT_NUMBER = '703402707746';

// 연결이 끝나면 돌아갈 수 있는 웹 주소 (이 밖으로는 보내지 않는다)
const ALLOWED_RETURN = [
  /^https:\/\/9981mark-hub\.github\.io\/leadmaster-crm\//,
  /^https:\/\/leadmastercrm\.vercel\.app\//,
  /^https:\/\/leadmaster-crm-sooty\.vercel\.app\//,
  /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}\//,
];
const DEFAULT_RETURN = 'https://9981mark-hub.github.io/leadmaster-crm/#/team';

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const randomState = () => {
  const b = new Uint8Array(32); crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const withParam = (url: string, key: string, val: string) => `${url}${url.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(val)}`;
const redirect = (url: string) => new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } });

// ---------------------------------------------
// 구글이 돌려보낸 요청 (GET)
// ---------------------------------------------
async function handleCallback(url: URL): Promise<Response> {
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const gErr = url.searchParams.get('error') || '';
  if (!state) return new Response('잘못된 요청입니다 (state 없음)', { status: 400 });

  // state는 한 번만 쓴다: 읽고 바로 지움
  const { data: st } = await admin.from('drive_oauth_states').select('*').eq('state', state).maybeSingle();
  await admin.from('drive_oauth_states').delete().eq('state', state);
  await admin.from('drive_oauth_states').delete().lt('expires_at', new Date().toISOString());
  if (!st) return redirect(withParam(DEFAULT_RETURN, 'drive', 'expired'));
  const back = st.return_to as string;
  if (new Date(st.expires_at).getTime() < Date.now()) return redirect(withParam(back, 'drive', 'expired'));
  if (gErr) return redirect(withParam(back, 'drive', gErr === 'access_denied' ? 'cancel' : 'error'));
  if (!code) return redirect(withParam(back, 'drive', 'error'));

  // 연결을 시작한 사람이 아직 그 회사 관리자인지 다시 확인
  const { data: mem } = await admin.from('org_members').select('role, status').eq('org_id', st.org_id).eq('user_id', st.user_id).maybeSingle();
  if (!mem || !['owner', 'admin'].includes(mem.role) || (mem.status && mem.status !== 'active')) return redirect(withParam(back, 'drive', 'forbidden'));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }),
  });
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.access_token) {
    console.error('[drive-connect] token exchange failed', tok.error || res.status);
    return redirect(withParam(back, 'drive', 'error'));
  }
  const scopes = String(tok.scope || '').split(' ');
  if (!scopes.includes(DRIVE_SCOPE)) return redirect(withParam(back, 'drive', 'noscope'));
  if (!tok.refresh_token) return redirect(withParam(back, 'drive', 'norefresh'));

  const idt = decodeIdToken(tok.id_token);
  const { data: prev } = await admin.from('org_drive_connections').select('google_sub, root_folder_id, root_folder_name, folder_mode').eq('org_id', st.org_id).maybeSingle();
  const sameAccount = prev && prev.google_sub && idt.sub && prev.google_sub === idt.sub;
  const now = new Date().toISOString();
  const { error: upErr } = await admin.from('org_drive_connections').upsert({
    org_id: st.org_id,
    google_email: idt.email || null,
    google_sub: idt.sub || null,
    scope: tok.scope || null,
    // 같은 구글 계정으로 다시 연결하면 정해 둔 폴더를 그대로 쓴다. 다른 계정이면 폴더를 다시 정해야 함
    root_folder_id: sameAccount ? prev.root_folder_id : null,
    root_folder_name: sameAccount ? prev.root_folder_name : null,
    folder_mode: sameAccount ? prev.folder_mode : null,
    status: 'connected',
    last_error: null,
    last_ok_at: now,
    connected_by: st.user_id,
    connected_at: now,
    updated_at: now,
  }, { onConflict: 'org_id' });
  if (upErr) { console.error('[drive-connect] save', upErr.message); return redirect(withParam(back, 'drive', 'error')); }
  const { data: secretId, error: vErr } = await admin.rpc('drive_store_refresh_token', { p_org: st.org_id, p_token: tok.refresh_token });
  if (vErr || !secretId) { console.error('[drive-connect] vault', vErr?.message); return redirect(withParam(back, 'drive', 'error')); }
  await admin.from('org_drive_connections').update({ token_secret_id: secretId }).eq('org_id', st.org_id);
  return redirect(withParam(back, 'drive', 'connected'));
}

// ---------------------------------------------
// 관리자 요청 (POST)
// ---------------------------------------------
async function handlePost(req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ ok: false, error: '로그인이 필요합니다' }, 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ ok: false, error: '로그인이 만료되었습니다. 다시 로그인하세요.' }, 401);
  const [{ data: orgId }, { data: isAdmin }] = await Promise.all([userClient.rpc('current_org_id'), userClient.rpc('is_org_admin')]);
  if (!orgId) return json({ ok: false, error: '소속 회사가 없습니다' }, 403);
  if (!isAdmin) return json({ ok: false, error: '회사 관리자만 사용할 수 있습니다' }, 403);
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return json({ ok: false, error: '서버에 구글 드라이브 설정이 없습니다' }, 500);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const action = String(body?.action || '');

  if (action === 'start') {
    const returnTo = typeof body.return_to === 'string' && ALLOWED_RETURN.some(r => r.test(body.return_to)) ? body.return_to : DEFAULT_RETURN;
    const state = randomState();
    const { error } = await admin.from('drive_oauth_states').insert({ state, org_id: orgId, user_id: u.user.id, return_to: returnTo });
    if (error) return json({ ok: false, error: '연결 준비 실패' }, 500);
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.search = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: `openid email ${DRIVE_SCOPE}`,
      access_type: 'offline',
      prompt: 'consent select_account',
      include_granted_scopes: 'false',
      state,
    }).toString();
    return json({ ok: true, url: auth.toString() });
  }

  if (action === 'disconnect') {
    try {
      const { data: refresh } = await admin.rpc('drive_get_refresh_token', { p_org: orgId });
      if (refresh) await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: String(refresh) }) });
    } catch (e) { console.error('[drive-connect] revoke', String(e)); }
    await admin.rpc('drive_forget_token', { p_org: orgId });
    return json({ ok: true });
  }

  // 여기부터는 드라이브 접근 필요
  const token = await getAccessToken(admin, orgId);

  if (action === 'picker_token') {
    // 관리자 브라우저의 구글 파일 선택 창에만 쓰는 1시간짜리 토큰 (drive.file 범위)
    return json({ ok: true, access_token: token, client_id: GOOGLE_CLIENT_ID, app_id: GOOGLE_PROJECT_NUMBER });
  }

  if (action === 'create_folder') {
    const name = (typeof body.name === 'string' && body.name.trim()) ? body.name.trim().slice(0, 100) : '리드마스터 통화녹음';
    const f = await createFolder(token, name);
    await admin.from('org_drive_connections').update({ root_folder_id: f.id, root_folder_name: f.name, folder_mode: 'created', updated_at: new Date().toISOString() }).eq('org_id', orgId);
    await markOk(admin, orgId);
    return json({ ok: true, folder: { id: f.id, name: f.name } });
  }

  if (action === 'set_folder') {
    const id = String(body.folder_id || '');
    if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return json({ ok: false, error: '폴더 id 형식 오류' }, 400);
    const f = await getFile(token, id);
    if (f.mimeType !== FOLDER_MIME) return json({ ok: false, error: '폴더가 아닙니다. 폴더를 고르세요.' }, 400);
    if (f.trashed) return json({ ok: false, error: '휴지통에 있는 폴더입니다' }, 400);
    if (f.capabilities && f.capabilities.canAddChildren === false) return json({ ok: false, error: '이 폴더에 파일을 넣을 권한이 없습니다' }, 403);
    await admin.from('org_drive_connections').update({ root_folder_id: f.id, root_folder_name: f.name, folder_mode: 'picked', updated_at: new Date().toISOString() }).eq('org_id', orgId);
    await markOk(admin, orgId);
    return json({ ok: true, folder: { id: f.id, name: f.name } });
  }

  if (action === 'test') {
    const { data: conn } = await admin.from('org_drive_connections').select('root_folder_id, root_folder_name').eq('org_id', orgId).maybeSingle();
    const steps: { step: string; ok: boolean; detail?: string }[] = [];
    const add = (step: string, ok: boolean, detail?: string) => { steps.push({ step, ok, detail }); return ok; };
    add('구글 토큰 받기', true);
    let subId = '', fileId = '';
    try {
      if (!conn?.root_folder_id) { add('보관 폴더', false, '보관 폴더를 먼저 정하세요'); throw new Error('stop'); }
      const root = await getFile(token, conn.root_folder_id);
      add('보관 폴더 열기', true, `${root.name}${root.capabilities?.canAddChildren === false ? ' (넣기 권한 없음)' : ''}`);
      // 5.6 ②: 폴더 안 기존 파일 중 리드마스터가 볼 수 있는 개수 (drive.file 권한으로는 허용된 파일만 보임)
      let visible = 0, pageToken: string | undefined;
      for (let i = 0; i < 5; i++) {
        const page = await listChildren(token, conn.root_folder_id, 100, pageToken);
        visible += (page.files || []).filter((x: any) => x.mimeType !== FOLDER_MIME).length;
        pageToken = page.nextPageToken; if (!pageToken) break;
      }
      add('폴더 안 기존 파일 중 열 수 있는 것', true, `${visible}개${pageToken ? ' 이상' : ''}`);
      const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
      const sub = await createFolder(token, `_리드마스터_연결시험_${stamp}`, conn.root_folder_id);
      subId = sub.id; add('하위 폴더 만들기', true);
      const text = new TextEncoder().encode(`리드마스터 드라이브 연결 시험 ${new Date().toISOString()}\n이 파일은 자동으로 지워집니다.`);
      const up = await uploadSmall(token, subId, 'connection-test.txt', 'text/plain', text, 'LeadMaster connection test');
      fileId = up.id; add('작은 파일 올리기', true, `${up.size || text.length}바이트`);
      const got = await getFile(token, fileId, 'id,size,md5Checksum');
      add('올린 파일 크기 확인', Number(got.size) === text.length, `${got.size}/${text.length}바이트, md5 ${got.md5Checksum ? '있음' : '없음'}`);
    } catch (e) {
      if (String((e as Error).message) !== 'stop') add('드라이브 요청', false, (e as Error).message);
    } finally {
      try { if (fileId) { await deleteFile(token, fileId); add('시험 파일 지우기', true); } } catch (e) { add('시험 파일 지우기', false, (e as Error).message); }
      try { if (subId) { await deleteFile(token, subId); add('시험 폴더 지우기', true); } } catch (e) { add('시험 폴더 지우기', false, (e as Error).message); }
    }
    const allOk = steps.every(s => s.ok);
    const result = { at: new Date().toISOString(), ok: allOk, steps };
    await admin.from('org_drive_connections').update({ last_test: result, ...(allOk ? { last_ok_at: result.at, last_error: null } : { last_error: steps.find(s => !s.ok)?.detail || '연결 시험 실패' }), updated_at: result.at }).eq('org_id', orgId);
    return json({ ok: true, test: result });
  }

  return json({ ok: false, error: '알 수 없는 요청' }, 400);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    if (req.method === 'GET') return await handleCallback(new URL(req.url));
    if (req.method === 'POST') return await handlePost(req);
    return json({ ok: false, error: 'method' }, 405);
  } catch (e) {
    if (e instanceof DriveError) return json({ ok: false, error: e.message, code: e.code }, e.status);
    console.error('[drive-connect]', String(e));
    return json({ ok: false, error: '서버 오류' }, 500);
  }
});
