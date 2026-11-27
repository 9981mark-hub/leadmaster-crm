/**
 * Supabase Edge Function: send-invite-email
 *
 * 팀 관리에서 새 멤버(상담원/팀장/관리자/대표)를 초대할 때
 * Brevo API(support@lmaster.xyz)로 초대 안내 메일을 발송합니다.
 * - 테넌트 대표/관리자가 호출해도 본사 Brevo API 키가 브라우저에 노출되지 않도록 서버에서 조회/발송합니다.
 *
 * Deploy: npx supabase functions deploy send-invite-email --project-ref cenksfblktflfurxjmtv
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HQ_ORG_ID = '00000000-0000-0000-0000-000000000001';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const ROLE_LABELS: Record<string, string> = {
  owner: '대표이사',
  admin: '관리자',
  agent: '상담원',
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const buildInviteHtml = (params: {
  orgName: string;
  inviterName: string;
  inviteeEmail: string;
  inviteeName?: string;
  roleLabel: string;
  expiresAt?: string;
  loginUrl: string;
}) => {
  const now = new Date();
  const todayStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const expDate = params.expiresAt ? new Date(params.expiresAt) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const expStr = `${expDate.getFullYear()}년 ${expDate.getMonth() + 1}월 ${expDate.getDate()}일`;
  const orgName = escapeHtml(params.orgName);
  const inviterName = escapeHtml(params.inviterName);
  const inviteeEmail = escapeHtml(params.inviteeEmail);
  const inviteeLabel = escapeHtml(params.inviteeName?.trim() || params.inviteeEmail.split('@')[0]);
  const roleLabel = escapeHtml(params.roleLabel);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${orgName} 팀 초대</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f8f9fa;">
    ${orgName} 워크스페이스에 ${roleLabel} 권한으로 초대되었습니다. 구글 계정으로 로그인하면 즉시 합류됩니다.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8f9fa;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;width:100%;background-color:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr><td style="height:3px;background:linear-gradient(90deg,#2563eb,#6366f1);"></td></tr>
          <tr>
            <td style="padding:32px 40px 0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="display:inline-block;width:28px;height:28px;background:#2563eb;border-radius:7px;text-align:center;line-height:28px;color:#fff;font-weight:800;font-size:13px;vertical-align:middle;">LM</span>
                    <span style="margin-left:8px;font-size:16px;font-weight:800;color:#111827;vertical-align:middle;">LeadMaster</span>
                  </td>
                  <td align="right" style="font-size:11px;color:#6b7280;">${todayStr}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="padding:20px 40px 0 40px;"><div style="height:1px;background-color:#f3f4f6;"></div></td></tr>
          <tr>
            <td style="padding:32px 40px 0 40px;">
              <span style="display:inline-block;padding:4px 10px;background-color:#eff6ff;color:#2563eb;font-size:11px;font-weight:700;border-radius:999px;">팀 워크스페이스 초대</span>
              <h1 style="margin:14px 0 12px 0;font-size:22px;font-weight:800;color:#111827;line-height:1.35;letter-spacing:-0.5px;">
                ${orgName} 팀에 초대되었습니다
              </h1>
              <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.7;word-break:keep-all;">
                안녕하세요, <strong>${inviteeLabel}</strong>님.<br>
                <strong>${inviterName}</strong>님이 <strong>${orgName}</strong> 워크스페이스에 <strong>${roleLabel}</strong> 역할로 초대했습니다.<br>
                아래 버튼을 눌러 초대받은 구글 계정으로 로그인하면 별도 가입 절차 없이 바로 팀에 합류됩니다.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb;border:1px solid #f3f4f6;border-radius:10px;">
                <tr>
                  <td style="padding:16px 20px;font-size:13px;color:#374151;line-height:1.8;">
                    <div><span style="color:#6b7280;display:inline-block;width:96px;">초대 회사</span> <strong>${orgName}</strong></div>
                    <div><span style="color:#6b7280;display:inline-block;width:96px;">부여 역할</span> <strong>${roleLabel}</strong></div>
                    <div><span style="color:#6b7280;display:inline-block;width:96px;">로그인 계정</span> <strong style="font-family:monospace;">${inviteeEmail}</strong></div>
                    <div><span style="color:#6b7280;display:inline-block;width:96px;">초대 유효기간</span> ${expStr}까지 (14일)</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 40px 0 40px;">
              <a href="${params.loginUrl}" style="display:inline-block;padding:13px 26px;background-color:#2563eb;color:#ffffff;font-size:14px;font-weight:700;border-radius:8px;text-decoration:none;">
                구글 계정으로 시작하기 &rarr;
              </a>
              <p style="margin:12px 0 0 0;font-size:12px;color:#9ca3af;word-break:keep-all;">
                반드시 초대된 구글 계정(<strong>${inviteeEmail}</strong>)으로 로그인해 주세요.
              </p>
            </td>
          </tr>
          <tr><td style="padding:32px 0 0 0;"></td></tr>
          <tr>
            <td style="padding:20px 40px 28px 40px;background-color:#f9fafb;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af;line-height:1.6;">
              도움이 필요하시면 <a href="mailto:support@lmaster.xyz" style="color:#6b7280;text-decoration:underline;">support@lmaster.xyz</a>로 문의해 주세요.<br>
              본 메일은 ${orgName} 관리자의 팀원 초대에 따라 발송된 안내 메일입니다.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ ok: false, error: '로그인이 필요합니다' }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user?.email) return json({ ok: false, error: '로그인 정보를 확인할 수 없습니다' }, 401);

  const { data: orgId } = await userClient.rpc('current_org_id');
  if (!orgId) return json({ ok: false, error: '소속 회사가 없거나 사용 중지된 계정입니다' }, 403);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: member } = await admin
    .from('org_members')
    .select('role, display_name, admin_permissions')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .is('disabled_at', null)
    .maybeSingle();

  if (!member) return json({ ok: false, error: '활성 멤버 정보를 찾을 수 없습니다' }, 403);

  const perms = (member.admin_permissions || {}) as { tier?: number; canInviteMembers?: boolean };
  const canInvite =
    member.role === 'owner' ||
    member.role === 'admin' ||
    Boolean(perms.canInviteMembers) ||
    Number(perms.tier || 1) >= 2;
  if (!canInvite) return json({ ok: false, error: '팀원 초대 권한이 없습니다' }, 403);

  const body = await req.json().catch(() => ({}));
  const rawInvites = Array.isArray(body?.invites) ? body.invites : [];
  if (rawInvites.length === 0) return json({ ok: false, error: '발송할 초대 대상이 없습니다' }, 400);

  let brevoApiKey = (Deno.env.get('BREVO_API_KEY') || '').trim();
  if (!brevoApiKey) {
    const { data: setting } = await admin
      .from('settings')
      .select('value')
      .eq('org_id', HQ_ORG_ID)
      .eq('key', 'brevo_api_key')
      .maybeSingle();
    if (setting?.value?.apiKey) {
      brevoApiKey = String(setting.value.apiKey).trim();
    }
  }

  if (!brevoApiKey) {
    return json({ ok: false, code: 'BREVO_NOT_CONFIGURED', error: 'Brevo API 키가 설정되지 않았습니다' }, 200);
  }

  const { data: orgRow } = await admin.from('organizations').select('name').eq('id', orgId).maybeSingle();
  const orgName = String(body?.orgName || orgRow?.name || 'LeadMaster CRM');
  const inviterName = String(body?.inviterName || member.display_name || user.email);
  const loginUrl = String(body?.loginUrl || 'https://www.lmaster.xyz/login');

  let sentCount = 0;
  const failed: { email: string; reason: string }[] = [];

  for (const item of rawInvites.slice(0, 50)) {
    const toEmail = String(item?.email || '').trim().toLowerCase();
    if (!toEmail) continue;
    const toName = item?.displayName ? String(item.displayName).trim() : undefined;
    const role = String(item?.role || 'agent');
    const roleLabel = ROLE_LABELS[role] || '상담원';
    const expiresAt = item?.expiresAt ? String(item.expiresAt) : undefined;

    const htmlContent = buildInviteHtml({
      orgName,
      inviterName,
      inviteeEmail: toEmail,
      inviteeName: toName,
      roleLabel,
      expiresAt,
      loginUrl,
    });
    const textContent = `[LeadMaster CRM] ${inviterName}님이 ${orgName} 워크스페이스에 ${roleLabel} 역할로 초대했습니다.\n로그인 주소: ${loginUrl}\n반드시 ${toEmail} 구글 계정으로 로그인해 주세요.`;

    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: '리드마스터 CRM', email: 'support@lmaster.xyz' },
        to: [{ email: toEmail, name: toName || toEmail }],
        replyTo: { name: '리드마스터 고객지원팀', email: 'support@lmaster.xyz' },
        subject: `[LeadMaster] ${orgName} 팀에 초대되었습니다`,
        textContent,
        htmlContent,
      }),
    });

    if (res.ok) {
      sentCount++;
    } else {
      let reason = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        reason = err?.message || reason;
      } catch {}
      failed.push({ email: toEmail, reason });
    }
  }

  return json({
    ok: sentCount > 0 && failed.length === 0,
    sentCount,
    failedCount: failed.length,
    failed,
  });
});
