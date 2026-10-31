/**
 * Supabase Edge Function: app-session (2026-11-01)
 *
 * 안드로이드 앱 전용 로그인 세션을 만들어 준다.
 * - 웹(WebView)에서 구글 로그인한 사용자가 자기 JWT로 호출 → 같은 사용자의 "새 세션"(별도 refresh token)을 받는다.
 * - 웹과 앱이 refresh token을 같이 쓰면 한쪽이 갱신할 때 다른 쪽 세션이 끊기므로 따로 발급한다.
 * - 이메일을 보내지 않는다 (관리자 API로 1회용 토큰을 만들고 즉시 교환).
 * - 회사 멤버(활성)만 발급.
 *
 * Deploy: supabase functions deploy app-session --project-ref cenksfblktflfurxjmtv   (JWT 검증 켬)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ ok: false, error: '로그인이 필요합니다' }, 401);

  // 1. 호출자 확인
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user?.email) return json({ ok: false, error: '로그인 정보를 확인할 수 없습니다' }, 401);

  const { data: orgId } = await userClient.rpc('current_org_id');
  if (!orgId) return json({ ok: false, error: '소속 회사가 없거나 사용 중지된 계정입니다' }, 403);

  // 2. 같은 사용자의 새 세션 발급 (메일 발송 없음)
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return json({ ok: false, error: '앱 세션 발급 실패 (링크)' }, 500);

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  const session = verified?.session;
  if (verifyError || !session) return json({ ok: false, error: '앱 세션 발급 실패 (교환)' }, 500);
  if (session.user?.id !== user.id) return json({ ok: false, error: '세션 사용자 불일치' }, 500);

  return json({
    ok: true,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user_id: user.id,
    email: user.email,
  });
});
