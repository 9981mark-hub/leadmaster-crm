/**
 * Supabase Edge Function: send-invite-email
 *
 * 팀 관리에서 새 멤버(상담원/팀장/관리자/대표)를 초대할 때
 * Brevo API(support@lmaster.xyz)로 초대 안내 메일을 발송합니다.
 * - 테넌트 대표/관리자가 호출해도 본사 Brevo API 키가 브라우저에 노출되지 않도록 서버에서 조회/발송합니다.
 *
 * Deploy: npx supabase functions deploy send-invite-email --no-verify-jwt --use-api --project-ref cenksfblktflfurxjmtv
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
  const loginUrl = escapeHtml(params.loginUrl);

  return `<!DOCTYPE html>
<html lang="ko" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${orgName} 팀 워크스페이스 초대</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style type="text/css">
    body, table, td, p, a, span, h1 { font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    a { text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .wrap { width: 100% !important; min-width: 100% !important; border-radius: 12px !important; }
      .pad { padding-left: 24px !important; padding-right: 24px !important; }
      .outer-pad { padding: 24px 12px !important; }
      .hero-title { font-size: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕','Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;color:#111827;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f3f4f6;">
    ${inviterName}님이 ${orgName} 워크스페이스(${roleLabel})에 초대했습니다. Google 계정으로 로그인하면 즉시 합류됩니다.
    &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" class="outer-pad" style="padding:48px 16px;">

        <!-- Main Card -->
        <table role="presentation" class="wrap" width="540" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;width:100%;background-color:#ffffff;border-radius:16px;border:1px solid #e5e7eb;box-shadow:0 4px 24px rgba(15,23,42,0.05);overflow:hidden;">

          <!-- Top Accent Bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#0f172a 0%,#2563eb 55%,#4f46e5 100%);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td class="pad" style="padding:28px 40px 0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align:middle;">
                          <div style="width:30px;height:30px;background:linear-gradient(135deg,#1d4ed8,#2563eb);border-radius:8px;text-align:center;line-height:30px;color:#ffffff;font-weight:800;font-size:13px;letter-spacing:-0.5px;">LM</div>
                        </td>
                        <td style="padding-left:10px;vertical-align:middle;">
                          <span style="font-size:16px;font-weight:800;color:#0f172a;letter-spacing:-0.4px;">LeadMaster</span>
                          <span style="font-size:12px;font-weight:600;color:#64748b;margin-left:4px;letter-spacing:-0.2px;">CRM</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:4px 9px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.6px;text-transform:uppercase;">INVITATION &middot; ${todayStr}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td class="pad" style="padding:20px 40px 0 40px;">
              <div style="height:1px;background-color:#f1f5f9;"></div>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td class="pad" style="padding:28px 40px 0 40px;">
              <div style="margin-bottom:12px;">
                <span style="display:inline-block;padding:4px 11px;background-color:#eff6ff;border:1px solid #dbeafe;color:#1d4ed8;font-size:11px;font-weight:700;border-radius:999px;letter-spacing:-0.2px;">팀 워크스페이스 초대</span>
              </div>
              <h1 class="hero-title" style="margin:0 0 14px 0;font-size:22px;font-weight:800;color:#0f172a;line-height:1.38;letter-spacing:-0.6px;word-break:keep-all;">
                ${orgName} 팀에 초대되었습니다
              </h1>
              <p style="margin:0;font-size:15px;color:#475569;line-height:1.7;letter-spacing:-0.25px;word-break:keep-all;">
                안녕하세요, <strong style="color:#0f172a;">${inviteeLabel}</strong>님.<br>
                <strong style="color:#0f172a;">${inviterName}</strong>님이 <strong style="color:#0f172a;">${orgName}</strong> 워크스페이스에
                <strong style="color:#2563eb;">${roleLabel}</strong> 권한으로 초대했습니다.
                별도 회원가입 없이 초대된 Google 계정으로 로그인하면 즉시 합류됩니다.
              </p>
            </td>
          </tr>

          <!-- Invitation Details Card -->
          <tr>
            <td class="pad" style="padding:24px 40px 0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:18px 22px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:13.5px;">
                      <tr>
                        <td style="padding:7px 0;color:#64748b;width:104px;vertical-align:top;letter-spacing:-0.2px;">소속 회사</td>
                        <td style="padding:7px 0;font-weight:700;color:#0f172a;letter-spacing:-0.2px;">${orgName}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="height:1px;background-color:#e2e8f0;"></td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;color:#64748b;vertical-align:top;letter-spacing:-0.2px;">초대자</td>
                        <td style="padding:7px 0;font-weight:600;color:#334155;letter-spacing:-0.2px;">${inviterName}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="height:1px;background-color:#e2e8f0;"></td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;color:#64748b;vertical-align:top;letter-spacing:-0.2px;">부여 권한</td>
                        <td style="padding:7px 0;">
                          <span style="display:inline-block;padding:2px 9px;background-color:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:12px;font-weight:700;border-radius:6px;">${roleLabel}</span>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="height:1px;background-color:#e2e8f0;"></td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;color:#64748b;vertical-align:top;letter-spacing:-0.2px;">로그인 계정</td>
                        <td style="padding:7px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:13px;font-weight:600;color:#2563eb;word-break:break-all;">${inviteeEmail}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="height:1px;background-color:#e2e8f0;"></td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;color:#64748b;vertical-align:top;letter-spacing:-0.2px;">초대 유효기간</td>
                        <td style="padding:7px 0;color:#334155;font-weight:500;letter-spacing:-0.2px;">${expStr}까지 (14일간 유효)</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Primary CTA -->
          <tr>
            <td class="pad" style="padding:26px 40px 0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${loginUrl}" style="height:48px;v-text-anchor:middle;width:100%;" arcsize="18%" stroke="f" fillcolor="#2563eb">
                      <w:anchorlock/>
                      <center style="font-size:15px;font-weight:700;color:#ffffff;font-family:sans-serif;">Google 계정으로 팀 합류하기 &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${loginUrl}" target="_blank" style="display:block;width:100%;padding:14px 0;background-color:#2563eb;color:#ffffff;font-size:15px;font-weight:700;text-align:center;text-decoration:none;border-radius:10px;letter-spacing:-0.3px;box-sizing:border-box;">
                      Google 계정으로 팀 합류하기 &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0 0;text-align:center;font-size:11.5px;color:#94a3b8;line-height:1.5;">
                버튼이 동작하지 않으면 아래 주소를 브라우저에 붙여넣으세요<br>
                <a href="${loginUrl}" target="_blank" style="color:#64748b;font-family:'SF Mono',Consolas,monospace;font-size:11px;text-decoration:underline;word-break:break-all;">${loginUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Onboarding Steps -->
          <tr>
            <td class="pad" style="padding:26px 40px 0 40px;">
              <div style="height:1px;background-color:#f1f5f9;margin-bottom:22px;"></div>
              <p style="margin:0 0 14px 0;font-size:13px;font-weight:700;color:#0f172a;letter-spacing:-0.2px;">합류 절차 안내</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="28" style="vertical-align:top;padding-top:2px;">
                    <div style="width:20px;height:20px;background-color:#eff6ff;border:1px solid #dbeafe;border-radius:50%;text-align:center;line-height:20px;font-size:11px;font-weight:700;color:#2563eb;">1</div>
                  </td>
                  <td style="padding:0 0 10px 0;font-size:13.5px;color:#475569;line-height:1.6;word-break:keep-all;">
                    상단의 <strong style="color:#0f172a;">Google 계정으로 팀 합류하기</strong> 버튼을 클릭합니다.
                  </td>
                </tr>
                <tr>
                  <td width="28" style="vertical-align:top;padding-top:2px;">
                    <div style="width:20px;height:20px;background-color:#eff6ff;border:1px solid #dbeafe;border-radius:50%;text-align:center;line-height:20px;font-size:11px;font-weight:700;color:#2563eb;">2</div>
                  </td>
                  <td style="padding:0 0 10px 0;font-size:13.5px;color:#475569;line-height:1.6;word-break:keep-all;">
                    로그인 화면에서 반드시 <span style="font-family:'SF Mono',Consolas,monospace;font-size:12.5px;color:#2563eb;font-weight:600;">${inviteeEmail}</span> Google 계정을 선택해 로그인합니다.
                  </td>
                </tr>
                <tr>
                  <td width="28" style="vertical-align:top;padding-top:2px;">
                    <div style="width:20px;height:20px;background-color:#eff6ff;border:1px solid #dbeafe;border-radius:50%;text-align:center;line-height:20px;font-size:11px;font-weight:700;color:#2563eb;">3</div>
                  </td>
                  <td style="padding:0;font-size:13.5px;color:#475569;line-height:1.6;word-break:keep-all;">
                    인증이 완료되면 <strong style="color:#0f172a;">${orgName}</strong> 워크스페이스로 자동 연결됩니다.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td class="pad" style="padding:22px 40px 28px 40px;">
              <div style="background-color:#f8fafc;border-left:3px solid #94a3b8;padding:11px 14px;border-radius:0 8px 8px 0;font-size:12px;color:#64748b;line-height:1.6;word-break:keep-all;">
                <strong style="color:#334155;">보안 안내</strong> &middot; 본 초대장은 지정된 Google 계정 전용으로 발급되었습니다. 다른 계정으로 로그인할 경우 팀에 연결되지 않으니 이메일 주소를 꼭 확인해 주세요.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="pad" style="padding:20px 40px 26px 40px;background-color:#f8fafc;border-top:1px solid #f1f5f9;">
              <p style="margin:0 0 6px 0;font-size:12px;color:#64748b;line-height:1.6;word-break:keep-all;">
                이용 중 도움이 필요하시면 <a href="mailto:support@lmaster.xyz" style="color:#2563eb;text-decoration:underline;">support@lmaster.xyz</a>로 문의해 주세요.
              </p>
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;word-break:keep-all;">
                본 메일은 ${orgName} 관리자의 팀원 초대에 따라 발송되는 보안 안내 메일입니다.
              </p>
            </td>
          </tr>

        </table>

        <!-- Copyright -->
        <table role="presentation" class="wrap" width="540" cellspacing="0" cellpadding="0" border="0" style="text-align:center;">
          <tr>
            <td style="padding:20px 0 0 0;font-size:11px;color:#94a3b8;letter-spacing:-0.1px;">
              &copy; ${now.getFullYear()} LeadMaster CRM &middot; <a href="https://www.lmaster.xyz" style="color:#94a3b8;text-decoration:none;">lmaster.xyz</a>
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

  try {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ ok: false, error: '로그인이 필요합니다' }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user?.email) return json({ ok: false, error: '로그인 정보를 확인할 수 없습니다' }, 401);

  const [{ data: orgId }, { data: isAdmin }] = await Promise.all([
    userClient.rpc('current_org_id'),
    userClient.rpc('is_org_admin'),
  ]);
  if (!orgId) return json({ ok: false, error: '소속 회사가 없거나 사용 중지된 계정입니다' }, 403);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: member, error: memberError } = await admin
    .from('org_members')
    .select('role, display_name, admin_permissions')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError) {
    console.warn('[send-invite-email] member lookup warning:', memberError.message);
  }
  if (!member && !isAdmin) {
    return json({ ok: false, error: '활성 멤버 정보를 찾을 수 없습니다' }, 403);
  }

  const perms = ((member?.admin_permissions || {}) as { tier?: number; canInviteMembers?: boolean });
  const canInvite =
    Boolean(isAdmin) ||
    member?.role === 'owner' ||
    member?.role === 'admin' ||
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
  const inviterName = String(body?.inviterName || member?.display_name || user.email);
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[send-invite-email] unhandled error:', msg);
    return json({ ok: false, error: `서버 오류: ${msg}` }, 500);
  }
});
