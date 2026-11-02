/**
 * Supabase Edge Function: recording-upload (2026-11-02)
 * 기획: docs/기획서_통화녹음_구글드라이브_장기보관_v1.md (5.2)
 *
 * 통화 녹음 원본은 회사 구글 드라이브에만 저장한다. 리드마스터 서버(Supabase 저장소)에는 올리지 않는다.
 * 녹음 파일은 이 함수를 지나가지 않는다: 함수는 권한 확인 + 드라이브 "이어 올리기 주소"만 만들고,
 * 폰이 그 주소로 드라이브에 직접 올린다 (구글 토큰은 폰에 주지 않는다. 2026-11-02 토큰 없이 PUT 동작 확인).
 *
 * POST (로그인 JWT, 상담원·관리자)
 *   { action: 'start', case_id, phone, direction?, call_started_at, duration_sec, size_bytes, mime_type, file_name?, source_app?, sha256, md5 }
 *     → { status: 'upload', recording_id, upload_url }   폰이 upload_url에 PUT
 *     → { status: 'exists', recording_id }                같은 원본(sha256)이 이미 드라이브에 있음
 *     → 409 { code: 'not_connected' }                     회사 드라이브 미연결 → 폰은 파일을 두고 나중에 다시
 *   { action: 'finish', recording_id, drive_file_id }
 *     → 드라이브에서 파일 크기·md5·표시(appProperties)를 확인하고 "보관 완료"로 기록
 *
 * Deploy: supabase functions deploy recording-upload --use-api --project-ref cenksfblktflfurxjmtv   (JWT 검증 켬)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { DriveError, getAccessToken, markOk, ensureFolder, getFile } from '../_shared/drive.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_BYTES = 200 * 1024 * 1024;   // 드라이브는 더 커도 되지만 통화 녹음으로는 이 정도면 충분

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const HEX64 = /^[0-9a-f]{64}$/;
const HEX32 = /^[0-9a-f]{32}$/;
const pad = (n: number) => String(n).padStart(2, '0');
const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000);
/** 드라이브 이름에 쓸 수 없는 글자 정리 */
const safe = (s: string, max = 40) => s.replace(/[\\/:*?"<>|\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || '이름없음';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ ok: false, error: '로그인이 필요합니다' }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ ok: false, error: '로그인이 만료되었습니다' }, 401);
    const { data: orgId } = await userClient.rpc('current_org_id');
    if (!orgId) return json({ ok: false, error: '소속 회사가 없거나 사용 중지된 계정입니다' }, 403);

    let body: any = {};
    try { body = await req.json(); } catch { /* empty */ }
    const action = String(body?.action || '');

    // ---------------------------------------------------------------
    if (action === 'start') {
      const caseId = String(body.case_id || '').trim();
      const phone = String(body.phone || '').replace(/[^0-9]/g, '');
      const sha256 = String(body.sha256 || '').toLowerCase();
      const md5 = String(body.md5 || '').toLowerCase();
      const size = Math.round(Number(body.size_bytes) || 0);
      const startedAt = String(body.call_started_at || '');
      const mime = String(body.mime_type || 'audio/mp4').toLowerCase().split(';')[0].slice(0, 60);
      if (!caseId || !phone) return json({ ok: false, error: '리드·번호가 없습니다' }, 400);
      if (!HEX64.test(sha256) || !HEX32.test(md5)) return json({ ok: false, error: '파일 지문 형식 오류' }, 400);
      if (size <= 0 || size > MAX_BYTES) return json({ ok: false, error: '파일 크기 오류' }, 400);
      if (!startedAt || isNaN(new Date(startedAt).getTime())) return json({ ok: false, error: '통화 시각 형식 오류' }, 400);
      if (!/^audio\//.test(mime)) return json({ ok: false, error: '오디오 파일만 올릴 수 있습니다' }, 400);

      // 사용자 권한으로 리드 확인 (상담원 = 본인 배정 리드만)
      const { data: c } = await userClient.from('cases').select('case_id, org_id, customer_name, created_at').eq('case_id', caseId).maybeSingle();
      if (!c || c.org_id !== orgId) return json({ ok: false, error: '리드를 찾을 수 없거나 권한이 없습니다' }, 403);

      const { data: conn } = await admin.from('org_drive_connections').select('status, token_secret_id, root_folder_id').eq('org_id', orgId).maybeSingle();
      if (!conn || conn.status !== 'connected' || !conn.token_secret_id || !conn.root_folder_id) {
        return json({ ok: false, code: 'not_connected', error: '회사 구글 드라이브가 연결되지 않았습니다. 녹음은 폰에 두고 연결 후 올립니다.' }, 409);
      }

      // 같은 원본이 이미 있으면 다시 올리지 않는다
      const { data: prev } = await admin.from('call_recordings').select('id, archive_status, drive_file_id, case_id').eq('org_id', orgId).eq('sha256', sha256).maybeSingle();
      if (prev && prev.archive_status === 'archived' && prev.drive_file_id) return json({ ok: true, status: 'exists', recording_id: prev.id });

      const token = await getAccessToken(admin, orgId);
      // 폴더: {보관 폴더}/{리드 등록 연도}/{고객명}_{번호 뒤 4자리}_{리드ID 앞 8자리}
      const year = String(kst(c.created_at || startedAt).getUTCFullYear());
      const yearId = await ensureFolder(admin, token, orgId, conn.root_folder_id, `year:${year}`, year, conn.root_folder_id);
      const caseFolderName = `${safe(c.customer_name || '이름없음', 20)}_${phone.slice(-4)}_${caseId.slice(0, 8)}`;
      const caseFolderId = await ensureFolder(admin, token, orgId, conn.root_folder_id, `case:${caseId}`, caseFolderName, yearId);

      const { data: member } = await admin.from('org_members').select('display_name').eq('org_id', orgId).eq('user_id', u.user.id).maybeSingle();
      const agent = safe(member?.display_name || u.user.email?.split('@')[0] || '상담원', 20);
      const dur = Math.max(0, Math.round(Number(body.duration_sec) || 0));
      const dir = body.direction === 'CALL_IN' ? 'CALL_IN' : body.direction === 'CALL_OUT' ? 'CALL_OUT' : null;
      const t = kst(startedAt);
      const ext = (String(body.file_name || '').match(/\.([a-z0-9]{2,5})$/i)?.[1] || 'm4a').toLowerCase();
      const fileName = `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}_${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}${pad(t.getUTCSeconds())}`
        + `_${dir === 'CALL_IN' ? '수신' : dir === 'CALL_OUT' ? '발신' : '통화'}_${agent}_${Math.floor(dur / 60)}분${pad(dur % 60)}초.${ext}`;

      // 녹음 기록 (올리는 중). 같은 지문으로 끝나지 않은 행이 있으면 그 행을 다시 쓴다
      let recId = prev?.id as string | undefined;
      const rowData = {
        case_id: caseId, phone, user_id: u.user.id, direction: dir, call_started_at: new Date(startedAt).toISOString(),
        duration_sec: dur, size_bytes: size, mime_type: mime, file_name: String(body.file_name || '').slice(0, 200) || null,
        source_app: body.source_app ? String(body.source_app).slice(0, 100) : null,
        storage_kind: 'gdrive', archive_status: 'uploading', drive_folder_id: caseFolderId, sha256, source: 'app',
      };
      if (recId) {
        await admin.from('call_recordings').update(rowData).eq('id', recId);
      } else {
        const { data: ins, error: insErr } = await admin.from('call_recordings').insert({ org_id: orgId, status: 'uploaded', ...rowData }).select('id').single();
        if (insErr || !ins) {
          // 동시에 같은 파일을 올리는 경우 (지문 유일) → 그 행을 쓴다
          const { data: again } = await admin.from('call_recordings').select('id, archive_status, drive_file_id').eq('org_id', orgId).eq('sha256', sha256).maybeSingle();
          if (again?.archive_status === 'archived' && again.drive_file_id) return json({ ok: true, status: 'exists', recording_id: again.id });
          if (!again) return json({ ok: false, error: '녹음 기록을 만들지 못했습니다' }, 500);
          recId = again.id;
        } else recId = ins.id;
      }

      const description = [
        'LeadMaster 통화 녹음 원본',
        `리드 ${caseId} · 고객 번호 끝 ${phone.slice(-4)} · 상담원 ${u.user.email || ''}`,
        `통화 ${new Date(startedAt).toISOString()} · ${dur}초 · ${dir || ''}`,
        `SHA-256 ${sha256}`,
      ].join('\n');
      const init = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,size,md5Checksum', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(size),
        },
        body: JSON.stringify({
          name: fileName, parents: [caseFolderId], description, mimeType: mime,
          appProperties: { lm_rec_id: recId, lm_org: orgId, lm_case: caseId, lm_sha256: sha256 },
        }),
      });
      const location = init.headers.get('location');
      if (!init.ok || !location) {
        const txt = await init.text().catch(() => '');
        const quota = /storageQuotaExceeded/.test(txt);
        await admin.from('call_recordings').update({ archive_status: 'failed', error: quota ? '드라이브 저장 공간 부족' : `드라이브 업로드 준비 실패 (HTTP ${init.status})` }).eq('id', recId);
        if (quota) await admin.from('org_drive_connections').update({ last_error: '구글 드라이브 저장 공간이 가득 찼습니다', updated_at: new Date().toISOString() }).eq('org_id', orgId);
        return json({ ok: false, code: quota ? 'quota_full' : 'drive_error', error: quota ? '구글 드라이브 저장 공간이 가득 찼습니다' : '드라이브 업로드 준비 실패' }, quota ? 507 : 502);
      }
      await markOk(admin, orgId);
      return json({ ok: true, status: 'upload', recording_id: recId, upload_url: location, expected_md5: md5 });
    }

    // ---------------------------------------------------------------
    if (action === 'finish') {
      const recId = String(body.recording_id || '');
      const fileId = String(body.drive_file_id || '');
      if (!/^[0-9a-f-]{36}$/i.test(recId) || !/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return json({ ok: false, error: '형식 오류' }, 400);
      // 사용자 권한으로 보이는 녹음인지 + 본인이 올린 것인지
      const { data: rec } = await userClient.from('call_recordings').select('id, org_id, user_id, size_bytes, sha256, archive_status, drive_file_id').eq('id', recId).maybeSingle();
      if (!rec || rec.org_id !== orgId || rec.user_id !== u.user.id) return json({ ok: false, error: '녹음을 찾을 수 없거나 권한이 없습니다' }, 403);
      if (rec.archive_status === 'archived' && rec.drive_file_id === fileId) return json({ ok: true, status: 'archived', recording_id: recId });

      const token = await getAccessToken(admin, orgId);
      const f = await getFile(token, fileId, 'id,size,md5Checksum,parents,trashed,appProperties');
      const problems: string[] = [];
      if (f.appProperties?.lm_rec_id !== recId) problems.push('표시 불일치');
      if (Number(f.size) !== Number(rec.size_bytes)) problems.push(`크기 ${f.size}/${rec.size_bytes}`);
      const expectedMd5 = String(body.md5 || '').toLowerCase();
      if (expectedMd5 && f.md5Checksum && f.md5Checksum !== expectedMd5) problems.push('md5 불일치');
      if (f.trashed) problems.push('휴지통');
      if (problems.length) {
        await admin.from('call_recordings').update({ archive_status: 'failed', error: `드라이브 확인 실패: ${problems.join(', ')}` }).eq('id', recId);
        return json({ ok: false, code: 'verify_failed', error: `드라이브 파일 확인 실패 (${problems.join(', ')})` }, 422);
      }
      await admin.from('call_recordings').update({
        drive_file_id: fileId, archive_status: 'archived', archived_at: new Date().toISOString(), error: null,
      }).eq('id', recId);
      await markOk(admin, orgId);
      return json({ ok: true, status: 'archived', recording_id: recId });
    }

    return json({ ok: false, error: '알 수 없는 요청' }, 400);
  } catch (e) {
    if (e instanceof DriveError) return json({ ok: false, error: e.message, code: e.code }, e.status);
    console.error('[recording-upload]', String(e));
    return json({ ok: false, error: '서버 오류' }, 500);
  }
});
