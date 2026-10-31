/**
 * Supabase Edge Function: telegram-deliver (2026-11-01)
 *
 * 리드 상세의 [텔레그램 전달] 버튼.
 * - 로그인한 사용자(관리자 또는 그 리드를 배정받은 상담원)가 호출
 * - 리드의 거래처(변호사 사무실)에 설정된 텔레그램 방으로 "회사 봇"이 글을 보낸다
 * - 보낸 메시지 번호를 case_deliveries에 기록 → 사무실이 그 메시지에 답장하면 telegram-webhook이 바로 이 리드에 연결
 *
 * 요청 body
 *   { action: 'deliver', caseId, text, force? }   리드 전달 (같은 리드를 60초 안에 다시 보내면 force 필요)
 *   { action: 'test', chatId }                    관리자: 방에 연결 시험 메시지 (봇이 그 방에 글을 쓸 수 있는지 확인)
 *
 * 권한: 리드는 "사용자 권한"으로 읽는다(RLS) → 볼 수 없는 리드는 보낼 수 없다.
 *       봇 토큰과 기록 저장만 service_role.
 *
 * Deploy: supabase functions deploy telegram-deliver --use-api --project-ref cenksfblktflfurxjmtv   (JWT 검증 켬)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HQ_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const HQ_ORG_ID = '00000000-0000-0000-0000-000000000001';

const MAX_TOTAL = 12000;   // 한 번에 보낼 수 있는 글 길이 (텔레그램 1개 메시지는 4096자 → 나눠 보냄)
const PART_LIMIT = 3800;
const RESEND_GUARD_SEC = 60;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function tg(token: string, method: string, params: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
}

// 텔레그램 오류를 사용자가 할 일로 바꿔 준다
function explainTelegramError(res: any): string {
  const d = String(res?.description || '');
  const migrated = res?.parameters?.migrate_to_chat_id;
  if (migrated) return `이 방이 슈퍼그룹으로 바뀌어 방 ID가 ${migrated} 로 바뀌었습니다. 설정 → 거래처에서 방을 다시 선택하세요.`;
  if (/chat not found/i.test(d)) return '봇이 그 방을 찾지 못했습니다. 방 ID가 맞는지, 회사 봇이 그 방에 초대돼 있는지 확인하세요.';
  if (/bot was kicked|bot is not a member|not enough rights|have no rights/i.test(d)) return '회사 봇이 그 방에서 글을 쓸 수 없습니다. 봇을 방에 다시 초대하거나 글쓰기 권한을 주세요.';
  if (/Too Many Requests/i.test(d)) return `텔레그램이 잠시 전송을 막았습니다. ${res?.parameters?.retry_after || '수십'}초 후 다시 시도하세요.`;
  if (/Unauthorized/i.test(d)) return '회사 봇 토큰이 더 이상 유효하지 않습니다. 팀 관리 → 텔레그램 봇 연결에서 토큰을 다시 등록하세요.';
  return `텔레그램 전송 실패: ${d || '알 수 없는 오류'}`;
}

// 줄 단위로 끊어서 PART_LIMIT 이하 조각으로 나눈다
function splitText(text: string): string[] {
  if (text.length <= PART_LIMIT) return [text];
  const parts: string[] = [];
  let cur = '';
  for (const line of text.split('\n')) {
    let l = line;
    while (l.length > PART_LIMIT) { // 한 줄이 너무 긴 경우
      if (cur) { parts.push(cur); cur = ''; }
      parts.push(l.slice(0, PART_LIMIT));
      l = l.slice(PART_LIMIT);
    }
    if ((cur ? cur.length + 1 : 0) + l.length > PART_LIMIT) { parts.push(cur); cur = l; }
    else cur = cur ? `${cur}\n${l}` : l;
  }
  if (cur) parts.push(cur);
  return parts;
}

async function getBotToken(orgId: string): Promise<string> {
  if (orgId === HQ_ORG_ID) return HQ_BOT_TOKEN;
  const { data } = await admin.from('org_telegram_bots').select('bot_token').eq('org_id', orgId).maybeSingle();
  return data?.bot_token || '';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ ok: false, error: '로그인이 필요합니다' }, 401);

  // 1. 호출자 확인
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ ok: false, error: '로그인 정보를 확인할 수 없습니다' }, 401);
  const [{ data: orgId }, { data: isAdmin }] = await Promise.all([
    userClient.rpc('current_org_id'),
    userClient.rpc('is_org_admin'),
  ]);
  if (!orgId) return json({ ok: false, error: '소속 회사가 없거나 사용 중지된 계정입니다' }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const action = body?.action || 'deliver';

  const token = await getBotToken(orgId);
  if (!token) return json({ ok: false, error: '회사 텔레그램 봇이 아직 연결되지 않았습니다. 팀 관리 → 텔레그램 봇 연결에서 먼저 등록하세요.' }, 400);

  try {
    // ── 연결 시험 (관리자) ──
    if (action === 'test') {
      if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다' }, 403);
      const chatId = String(body?.chatId || '').trim();
      if (!/^-?\d{5,20}$/.test(chatId)) return json({ ok: false, error: '방 ID 형식이 올바르지 않습니다 (예: -1001234567890)' }, 400);
      const res = await tg(token, 'sendMessage', {
        chat_id: chatId,
        text: '[리드마스터] 연결 시험 메시지입니다. 이 방으로 상담 접수서가 전달됩니다.',
        disable_web_page_preview: true,
      });
      if (!res?.ok) return json({ ok: false, error: explainTelegramError(res) }, 502);
      const chat = res.result?.chat || {};
      await admin.from('org_telegram_chats').upsert({
        org_id: orgId, chat_id: String(chat.id ?? chatId), title: chat.title || null, chat_type: chat.type || null,
        bot_status: 'member', updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id,chat_id' });
      return json({ ok: true, chatTitle: chat.title || null });
    }

    if (action !== 'deliver') return json({ ok: false, error: '알 수 없는 요청' }, 400);

    // ── 리드 전달 ──
    const caseId = String(body?.caseId || '').trim();
    const text = String(body?.text || '').replace(/\r\n/g, '\n').trim();
    if (!caseId) return json({ ok: false, error: '리드가 지정되지 않았습니다' }, 400);
    if (text.length < 5) return json({ ok: false, error: '보낼 내용이 비어 있습니다' }, 400);
    if (text.length > MAX_TOTAL) return json({ ok: false, error: `내용이 너무 깁니다 (${text.length}자, 최대 ${MAX_TOTAL}자)` }, 400);

    // 사용자 권한으로 리드 조회 → 볼 수 없는 리드면 여기서 막힌다
    const { data: c } = await userClient.from('cases')
      .select('case_id, org_id, partner_id, customer_name').eq('case_id', caseId).maybeSingle();
    if (!c || c.org_id !== orgId) return json({ ok: false, error: '리드를 찾을 수 없거나 전달 권한이 없습니다' }, 404);

    // 거래처 → 텔레그램 방
    const { data: st } = await userClient.from('settings').select('value').eq('org_id', orgId).eq('key', 'partners').maybeSingle();
    const partners: any[] = Array.isArray(st?.value) ? st!.value : [];
    const partner = partners.find(p => p?.partnerId === c.partner_id);
    if (!partner) return json({ ok: false, error: '이 리드에 거래처(변호사 사무실)가 지정되지 않았습니다' }, 400);
    const chatId = String(partner.telegramChatId || '').trim();
    if (!chatId) return json({ ok: false, error: `'${partner.name}' 거래처에 텔레그램 방이 설정되지 않았습니다. 설정 → 거래처에서 방을 선택하세요.` }, 400);

    // 연속 전송 방지
    if (!body?.force) {
      const since = new Date(Date.now() - RESEND_GUARD_SEC * 1000).toISOString();
      const { data: recent } = await admin.from('case_deliveries').select('id')
        .eq('org_id', orgId).eq('case_id', caseId).gte('sent_at', since).limit(1);
      if (recent && recent.length > 0) return json({ ok: false, code: 'RECENT', error: '방금 이 리드를 전달했습니다. 다시 보내려면 한 번 더 누르세요.' }, 409);
    }

    const parts = splitText(text);
    const sent: { messageId: number; partNo: number }[] = [];
    let chatTitle: string | null = null;
    let failure: string | null = null;
    for (let i = 0; i < parts.length; i++) {
      const prefix = parts.length > 1 ? `(${i + 1}/${parts.length})\n` : '';
      const res = await tg(token, 'sendMessage', { chat_id: chatId, text: prefix + parts[i], disable_web_page_preview: true });
      if (!res?.ok) { failure = explainTelegramError(res); break; }
      chatTitle = res.result?.chat?.title || chatTitle;
      sent.push({ messageId: res.result.message_id, partNo: i + 1 });
    }

    if (sent.length > 0) {
      const { error: insErr } = await admin.from('case_deliveries').insert(sent.map(s => ({
        org_id: orgId, case_id: caseId, partner_id: c.partner_id, chat_id: chatId, chat_title: chatTitle,
        message_id: s.messageId, part_no: s.partNo, part_count: parts.length,
        sent_by: user.id, sent_by_email: user.email || null,
      })));
      if (insErr) console.error('[telegram-deliver] 기록 저장 실패', insErr.message);
      await admin.from('org_telegram_chats').upsert({
        org_id: orgId, chat_id: chatId, title: chatTitle, bot_status: 'member', updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id,chat_id' });
    }

    if (failure) {
      return json({ ok: false, error: sent.length > 0 ? `${parts.length}개 중 ${sent.length}개만 보냈습니다. ${failure}` : failure, sentCount: sent.length }, 502);
    }
    return json({ ok: true, chatTitle, partnerName: partner.name, messageIds: sent.map(s => s.messageId), parts: parts.length });
  } catch (err) {
    console.error('[telegram-deliver] error', err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
