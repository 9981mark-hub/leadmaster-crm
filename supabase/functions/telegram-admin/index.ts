/**
 * Supabase Edge Function: telegram-admin (2026-11-01)
 *
 * 회사 관리자가 웹에서 호출: 자기 회사 텔레그램 봇 상태 확인 / 웹훅 등록.
 * - 호출자는 로그인한 사용자 JWT(Authorization: Bearer ...)를 보내야 하고, 그 회사의 owner/admin이어야 한다.
 * - 봇 토큰은 응답에 절대 넣지 않는다.
 *
 * Deploy: supabase functions deploy telegram-admin --project-ref cenksfblktflfurxjmtv
 *   (JWT 검증 켬: 로그인 사용자만 호출 가능)
 *
 * body: { action: 'status' | 'register' }
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HQ_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const HQ_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';
const HQ_ORG_ID = '00000000-0000-0000-0000-000000000001';

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function tg(token: string, method: string, params?: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  return await res.json();
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  // 1. 호출자 확인 (사용자 권한으로 회사·역할 조회)
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ ok: false, error: '로그인이 필요합니다' }, 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const [{ data: orgId }, { data: isAdmin }] = await Promise.all([
    userClient.rpc('current_org_id'),
    userClient.rpc('is_org_admin'),
  ]);
  if (!orgId) return json({ ok: false, error: '소속 회사가 없습니다' }, 403);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다' }, 403);

  // 2. 회사 봇 정보 (서버에서만 토큰 읽기)
  let token = '';
  let secret = '';
  if (orgId === HQ_ORG_ID) {
    token = HQ_BOT_TOKEN;
    secret = HQ_WEBHOOK_SECRET;
  }
  const { data: row } = await admin.from('org_telegram_bots')
    .select('bot_token, webhook_secret').eq('org_id', orgId).maybeSingle();
  if (row?.bot_token && orgId !== HQ_ORG_ID) {
    token = row.bot_token;
    secret = row.webhook_secret;
  }
  if (!token) return json({ ok: false, error: '등록된 봇 토큰이 없습니다. 먼저 봇 토큰을 저장하세요.' }, 400);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const action = body?.action || 'status';
  const webhookUrl = orgId === HQ_ORG_ID
    ? `${SUPABASE_URL}/functions/v1/telegram-webhook`
    : `${SUPABASE_URL}/functions/v1/telegram-webhook?org=${orgId}`;

  try {
    if (action === 'status') {
      const [me, info] = await Promise.all([tg(token, 'getMe'), tg(token, 'getWebhookInfo')]);
      const currentUrl: string = info?.result?.url || '';
      return json({
        ok: true,
        botUsername: me?.result?.username || null,
        botName: me?.result?.first_name || null,
        tokenValid: !!me?.ok,
        webhookConnected: currentUrl === webhookUrl,
        webhookUrlMatches: currentUrl === webhookUrl,
        pendingUpdates: info?.result?.pending_update_count ?? null,
        lastError: info?.result?.last_error_message || null,
        lastErrorAt: info?.result?.last_error_date ? new Date(info.result.last_error_date * 1000).toISOString() : null,
      });
    }

    if (action === 'register') {
      const me = await tg(token, 'getMe');
      if (!me?.ok) return json({ ok: false, error: '봇 토큰이 올바르지 않습니다 (텔레그램이 거부)' }, 400);
      const params: Record<string, unknown> = {
        url: webhookUrl,
        allowed_updates: ['message', 'edited_message', 'my_chat_member'],
        drop_pending_updates: false,
      };
      if (secret) params.secret_token = secret;
      const res = await tg(token, 'setWebhook', params);
      if (!res?.ok) return json({ ok: false, error: `웹훅 등록 실패: ${res?.description || '알 수 없음'}` }, 502);
      if (orgId !== HQ_ORG_ID) {
        await admin.from('org_telegram_bots')
          .update({ bot_username: me.result?.username || null, webhook_set_at: new Date().toISOString() })
          .eq('org_id', orgId);
      }
      return json({ ok: true, botUsername: me.result?.username || null });
    }

    return json({ ok: false, error: '알 수 없는 요청' }, 400);
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});
