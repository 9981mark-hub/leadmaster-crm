/**
 * Supabase Edge Function: recording-purge
 *
 * 6개월(180일) 보존 기한 만료 후 3주(21일) 유예 기간이 경과한
 * call-recordings 버킷 오디오 파일을 Storage에서 실제 삭제하고 DB에 삭제 시각을 기록합니다.
 * (AI 요약문·대화록·메타데이터는 그대로 보존)
 *
 * 호출 방식: Supabase Cron / 스케줄러 또는 플랫폼 관리자 수동 POST 호출
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('RECORDING_PURGE_SECRET') || '';

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-purge-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Cron 시크릿 또는 Service Role 인증 확인
  const authHeader = req.headers.get('authorization') || '';
  const secretHeader = req.headers.get('x-purge-secret') || '';
  const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  const isValidSecret = Boolean(CRON_SECRET && secretHeader === CRON_SECRET);

  if (!isServiceRole && !isValidSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { data: targets, error: fetchErr } = await admin.rpc('get_recordings_to_purge', {
      p_limit: 200,
    });
    if (fetchErr) throw fetchErr;

    const rows = (targets || []) as Array<{ id: string; org_id: string; storage_path: string }>;
    if (rows.length === 0) {
      return json({ purgedCount: 0, message: '삭제 대상(만료+3주 유예 경과) 녹음이 없습니다.' });
    }

    const paths = rows.map((r) => r.storage_path).filter(Boolean);
    if (paths.length > 0) {
      const { error: removeErr } = await admin.storage
        .from('call-recordings')
        .remove(paths);
      if (removeErr) {
        console.error('[recording-purge] Storage remove error:', removeErr);
        throw removeErr;
      }
    }

    const ids = rows.map((r) => r.id);
    const { data: markedCount, error: markErr } = await admin.rpc('mark_expired_recordings_purged', {
      p_recording_ids: ids,
    });
    if (markErr) throw markErr;

    return json({
      purgedCount: Number(markedCount ?? rows.length),
      deletedPaths: paths.length,
    });
  } catch (err: any) {
    console.error('[recording-purge] Failed:', err);
    return json({ error: err?.message || 'Purge failed' }, 500);
  }
});
