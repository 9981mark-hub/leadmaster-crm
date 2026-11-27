// ============================================
// 플랫폼 총괄 어드민 이메일 발송 서비스 (Brevo API 기반)
// 발신자: support@lmaster.xyz (인증 완료된 도메인)
// ============================================
import { supabase } from './supabase';
import { HQ_ORG_ID } from './org';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const STORAGE_KEY = 'lm_platform_brevo_api_key';
const SETTING_KEY = 'brevo_api_key';

let memoryApiKey: string = '';

/** 저장된 Brevo API 키 가져오기 (메모리 -> 로컬스토리지 -> Supabase DB -> 환경변수) */
export const getBrevoApiKey = async (): Promise<string> => {
  if (memoryApiKey) return memoryApiKey;

  // 1. LocalStorage
  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local && local.trim()) {
      memoryApiKey = local.trim();
      return memoryApiKey;
    }
  } catch {}

  // 2. Supabase Settings DB (본사 HQ)
  if (supabase) {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('org_id', HQ_ORG_ID)
        .eq('key', SETTING_KEY)
        .maybeSingle();

      if (data?.value?.apiKey) {
        memoryApiKey = String(data.value.apiKey).trim();
        localStorage.setItem(STORAGE_KEY, memoryApiKey);
        return memoryApiKey;
      }
    } catch (e) {
      console.warn('[MailService] DB API key lookup failed:', e);
    }
  }

  // 3. Vite 환경변수
  const envKey = (import.meta as any).env?.VITE_BREVO_API_KEY;
  if (envKey && String(envKey).trim()) {
    memoryApiKey = String(envKey).trim();
    return memoryApiKey;
  }

  return '';
};

/** Brevo API 키 영구 저장 */
export const saveBrevoApiKey = async (apiKey: string): Promise<void> => {
  const trimmed = apiKey.trim();
  memoryApiKey = trimmed;

  try {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {}

  if (supabase) {
    try {
      await supabase.from('settings').upsert({
        org_id: HQ_ORG_ID,
        key: SETTING_KEY,
        value: { apiKey: trimmed, updatedAt: new Date().toISOString() },
      });
    } catch (e) {
      console.warn('[MailService] DB API key save failed:', e);
    }
  }
};

/** Brevo API 키 설정 여부 확인 동기 함수 (빠른 UI 체크용) */
export const checkLocalBrevoApiKey = (): boolean => {
  if (memoryApiKey) return true;
  try {
    const local = localStorage.getItem(STORAGE_KEY);
    return !!(local && local.trim());
  } catch {
    return false;
  }
};

export interface SendEmailParams {
  toEmail: string;
  toName?: string;
  subject: string;
  textContent: string;
  htmlContent: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Brevo 트랜잭션 메일 발송 API 호출 */
export const sendBrevoEmail = async (params: SendEmailParams): Promise<SendEmailResult> => {
  const apiKey = await getBrevoApiKey();
  if (!apiKey) {
    throw new Error('Brevo API Key가 설정되지 않았습니다. API 키를 먼저 등록해주세요.');
  }

  const payload = {
    sender: {
      name: '리드마스터 CRM',
      email: 'support@lmaster.xyz',
    },
    to: [
      {
        email: params.toEmail,
        name: params.toName || params.toEmail,
      },
    ],
    replyTo: {
      name: '리드마스터 고객지원팀',
      email: 'support@lmaster.xyz',
    },
    subject: params.subject,
    textContent: params.textContent,
    htmlContent: params.htmlContent,
  };

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errMsg = `메일 발송 실패 (${response.status})`;
    try {
      const errJson = await response.json();
      errMsg = errJson.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const resJson = await response.json();
  return {
    success: true,
    messageId: resJson.messageId,
  };
};

/** 승인 안내 하이엔드 미니멀 HTML 이메일 템플릿 (Resend / Linear / Notion 벤치마킹) */
export const generateApprovalHtmlEmail = (params: {
  companyName: string;
  ownerEmail: string;
  loginUrl?: string;
}): string => {
  const loginUrl = params.loginUrl || 'https://www.lmaster.xyz/login';
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const trialEndDateStr = `${trialEnd.getFullYear()}년 ${trialEnd.getMonth() + 1}월 ${trialEnd.getDate()}일`;
  const todayStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

  return `
<!DOCTYPE html>
<html lang="ko" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>워크스페이스 개설 완료</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style type="text/css">
    body, table, td, p, a, span { font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; outline: none; -ms-interpolation-mode: bicubic; }
    a { text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .wrap { width: 100% !important; min-width: 100% !important; }
      .pad { padding-left: 24px !important; padding-right: 24px !important; }
      .pad-sm { padding-left: 20px !important; padding-right: 20px !important; }
      .stack { display: block !important; width: 100% !important; }
      .hide-mobile { display: none !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', '맑은 고딕', 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased;">

<!-- Preheader (Gmail snippet) -->
<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #f8f9fa;">
  ${params.companyName} 전용 워크스페이스가 개설되었습니다. 7일 무료 체험이 시작됩니다.
  &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
</div>

<!-- Full-width wrapper -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8f9fa;">
  <tr>
    <td align="center" style="padding: 48px 16px;">

      <!-- ======================== CARD ======================== -->
      <table role="presentation" class="wrap" width="520" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">

        <!-- ─── Top accent bar ─── -->
        <tr>
          <td style="height: 3px; background: linear-gradient(90deg, #2563eb, #6366f1);"></td>
        </tr>

        <!-- ─── Logo row ─── -->
        <tr>
          <td class="pad" style="padding: 32px 40px 0 40px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="vertical-align: middle;">
                  <table cellspacing="0" cellpadding="0" border="0"><tr>
                    <td style="vertical-align: middle;">
                      <div style="width: 28px; height: 28px; background: #2563eb; border-radius: 7px; text-align: center; line-height: 28px; color: #fff; font-weight: 800; font-size: 13px; letter-spacing: -0.5px;">LM</div>
                    </td>
                    <td style="padding-left: 8px; vertical-align: middle;">
                      <span style="font-size: 16px; font-weight: 800; color: #111827; letter-spacing: -0.5px;">LeadMaster</span>
                    </td>
                  </tr></table>
                </td>
                <td align="right" style="vertical-align: middle;">
                  <span style="font-size: 11px; color: #6b7280; letter-spacing: -0.2px;">${todayStr}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ─── Divider ─── -->
        <tr>
          <td class="pad" style="padding: 20px 40px 0 40px;">
            <div style="height: 1px; background-color: #f3f4f6;"></div>
          </td>
        </tr>

        <!-- ─── Hero text ─── -->
        <tr>
          <td class="pad" style="padding: 28px 40px 0 40px;">
            <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.6px; line-height: 1.36; word-break: keep-all;">
              워크스페이스가 준비되었습니다
            </h1>
            <p style="margin: 0; font-size: 15px; color: #4b5563; line-height: 1.7; letter-spacing: -0.3px; word-break: keep-all;">
              ${params.companyName} 대표님, 가입 신청이 승인되었습니다.<br>
              오늘부터 <span style="color: #2563eb; font-weight: 600;">7일간 모든 기능을 무료로 체험</span>하실 수 있습니다.
            </p>
          </td>
        </tr>

        <!-- ─── Info card ─── -->
        <tr>
          <td class="pad" style="padding: 24px 40px 0 40px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px;">
              <tr>
                <td style="padding: 20px 24px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 14px; color: #374151;">
                    <!-- Row 1 -->
                    <tr>
                      <td style="padding: 6px 0; color: #9ca3af; font-size: 13px; width: 110px; vertical-align: top; letter-spacing: -0.2px;">회사명</td>
                      <td style="padding: 6px 0; font-weight: 700; color: #111827; letter-spacing: -0.3px;">${params.companyName}</td>
                    </tr>
                    <!-- Row 2 -->
                    <tr>
                      <td style="padding: 6px 0; color: #9ca3af; font-size: 13px; vertical-align: top; letter-spacing: -0.2px;">계정</td>
                      <td style="padding: 6px 0; font-weight: 600; color: #2563eb; font-family: 'SF Mono', Consolas, 'Courier New', monospace; font-size: 13px; letter-spacing: -0.2px;">${params.ownerEmail}</td>
                    </tr>
                    <!-- Row 3 -->
                    <tr>
                      <td style="padding: 6px 0; color: #9ca3af; font-size: 13px; vertical-align: top; letter-spacing: -0.2px;">권한</td>
                      <td style="padding: 6px 0; color: #374151; letter-spacing: -0.3px;">총괄 대표 관리자</td>
                    </tr>
                    <!-- Row 4 -->
                    <tr>
                      <td style="padding: 6px 0; color: #9ca3af; font-size: 13px; vertical-align: top; letter-spacing: -0.2px;">체험 기간</td>
                      <td style="padding: 6px 0; color: #374151; letter-spacing: -0.3px;">~${trialEndDateStr}까지 (7일)</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ─── CTA Button ─── -->
        <tr>
          <td class="pad" style="padding: 28px 40px 0 40px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${loginUrl}" style="height:48px;v-text-anchor:middle;width:100%;" arcsize="17%" stroke="f" fillcolor="#2563eb">
                    <w:anchorlock/>
                    <center style="font-size:15px;font-weight:700;color:#ffffff;font-family:sans-serif;">워크스페이스 시작하기</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="${loginUrl}" target="_blank" style="display: block; width: 100%; padding: 14px 0; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 700; text-align: center; text-decoration: none; border-radius: 8px; letter-spacing: -0.3px; box-sizing: border-box;">
                    워크스페이스 시작하기
                  </a>
                  <!--<![endif]-->
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ─── Fallback link ─── -->
        <tr>
          <td class="pad" style="padding: 12px 40px 0 40px; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5; letter-spacing: -0.2px;">
              버튼이 작동하지 않으면 아래 링크를 복사하세요
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px; word-break: break-all;">
              <a href="${loginUrl}" target="_blank" style="color: #6b7280; font-family: 'SF Mono', Consolas, monospace; font-size: 11px; text-decoration: underline;">${loginUrl}</a>
            </p>
          </td>
        </tr>

        <!-- ─── Divider ─── -->
        <tr>
          <td class="pad" style="padding: 28px 40px 0 40px;">
            <div style="height: 1px; background-color: #f3f4f6;"></div>
          </td>
        </tr>

        <!-- ─── Steps ─── -->
        <tr>
          <td class="pad" style="padding: 24px 40px 0 40px;">
            <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 700; color: #111827; letter-spacing: -0.3px;">시작하기</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <!-- Step 1 -->
              <tr>
                <td width="28" style="vertical-align: top; padding-top: 2px;">
                  <div style="width: 20px; height: 20px; background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 50%; text-align: center; line-height: 20px; font-size: 11px; font-weight: 700; color: #2563eb;">1</div>
                </td>
                <td style="padding: 0 0 14px 0; font-size: 14px; color: #4b5563; line-height: 1.6; letter-spacing: -0.3px; word-break: keep-all;">
                  위 버튼을 클릭해 로그인 페이지로 이동합니다.
                </td>
              </tr>
              <!-- Step 2 -->
              <tr>
                <td width="28" style="vertical-align: top; padding-top: 2px;">
                  <div style="width: 20px; height: 20px; background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 50%; text-align: center; line-height: 20px; font-size: 11px; font-weight: 700; color: #2563eb;">2</div>
                </td>
                <td style="padding: 0 0 14px 0; font-size: 14px; color: #4b5563; line-height: 1.6; letter-spacing: -0.3px; word-break: keep-all;">
                  <span style="font-weight: 600; color: #111827;">Google로 계속하기</span>를 눌러 <span style="font-family: 'SF Mono', Consolas, monospace; font-size: 13px; color: #2563eb; font-weight: 600;">${params.ownerEmail}</span> 계정으로 로그인합니다.
                </td>
              </tr>
              <!-- Step 3 -->
              <tr>
                <td width="28" style="vertical-align: top; padding-top: 2px;">
                  <div style="width: 20px; height: 20px; background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 50%; text-align: center; line-height: 20px; font-size: 11px; font-weight: 700; color: #2563eb;">3</div>
                </td>
                <td style="padding: 0 0 0 0; font-size: 14px; color: #4b5563; line-height: 1.6; letter-spacing: -0.3px; word-break: keep-all;">
                  <span style="font-weight: 600; color: #111827;">팀원 관리</span>에서 상담원을 초대하고 업무를 시작합니다.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ─── Features (compact list) ─── -->
        <tr>
          <td class="pad" style="padding: 24px 40px 0 40px;">
            <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #111827; letter-spacing: -0.3px;">포함된 기능</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px; color: #6b7280; line-height: 1.6; letter-spacing: -0.2px;">
              <tr>
                <td style="padding: 4px 0; vertical-align: top; width: 22px; color: #2563eb;">&#x2022;</td>
                <td style="padding: 4px 0; word-break: keep-all;">스마트 자동콜 &mdash; 안드로이드 1초 1콜 발신 · 녹음 동기화</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; vertical-align: top; color: #2563eb;">&#x2022;</td>
                <td style="padding: 4px 0; word-break: keep-all;">광고비 · 정산 &mdash; DB 단가 집계 · 급여 · 청구서 자동 산출</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; vertical-align: top; color: #2563eb;">&#x2022;</td>
                <td style="padding: 4px 0; word-break: keep-all;">AI 통화 요약 &mdash; 녹취 텍스트 변환 · 텔레그램 실시간 허브</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; vertical-align: top; color: #2563eb;">&#x2022;</td>
                <td style="padding: 4px 0; word-break: keep-all;">AI 가상고객 &mdash; 11,000명 데이터 기반 신입 상담원 모의 훈련</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ─── Bottom padding ─── -->
        <tr>
          <td style="padding: 32px 0 0 0;"></td>
        </tr>

        <!-- ─── Footer ─── -->
        <tr>
          <td class="pad" style="padding: 20px 40px 28px 40px; background-color: #f9fafb; border-top: 1px solid #f3f4f6;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="font-size: 12px; color: #9ca3af; line-height: 1.6; letter-spacing: -0.2px; word-break: keep-all;">
                  <p style="margin: 0 0 6px 0;">
                    도움이 필요하시면 <a href="mailto:support@lmaster.xyz" style="color: #6b7280; text-decoration: underline;">support@lmaster.xyz</a>로 문의해 주세요.
                  </p>
                  <p style="margin: 0; font-size: 11px; color: #d1d5db;">
                    본 메일은 서비스 가입 신청에 따라 발송되는 업무용 안내 메일입니다.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!-- =================== END CARD =================== -->

      <!-- Copyright outside card -->
      <table role="presentation" width="520" class="wrap" cellspacing="0" cellpadding="0" border="0" style="text-align: center;">
        <tr>
          <td style="padding: 20px 0; font-size: 11px; color: #d1d5db; letter-spacing: -0.2px;">
            &copy; ${now.getFullYear()} LeadMaster CRM &middot; <a href="https://www.lmaster.xyz" style="color: #d1d5db; text-decoration: none;">lmaster.xyz</a>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>

</body>
</html>
  `.trim();
};

export interface TeamInviteEmailItem {
  email: string;
  displayName?: string;
  role: string;
  expiresAt?: string;
}

export interface TeamInviteEmailResult {
  sentCount: number;
  failedCount: number;
  notConfigured?: boolean;
  failed: { email: string; reason: string }[];
}

const INVITE_ROLE_LABELS: Record<string, string> = {
  owner: '대표이사',
  admin: '관리자',
  agent: '상담원',
};

/** 팀원 초대 안내 HTML 이메일 템플릿 (클라이언트 폴백용 — B2B 엔터프라이즈 화이트카드) */
export const generateTeamInviteHtmlEmail = (params: {
  orgName: string;
  inviterName: string;
  inviteeEmail: string;
  inviteeName?: string;
  role: string;
  expiresAt?: string;
  loginUrl?: string;
}): string => {
  const loginUrl = params.loginUrl || `${typeof window !== 'undefined' ? window.location.origin : 'https://www.lmaster.xyz'}/login`;
  const roleLabel = INVITE_ROLE_LABELS[params.role] || '상담원';
  const now = new Date();
  const todayStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const expDate = params.expiresAt ? new Date(params.expiresAt) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const expStr = `${expDate.getFullYear()}년 ${expDate.getMonth() + 1}월 ${expDate.getDate()}일`;
  const inviteeLabel = params.inviteeName?.trim() || params.inviteeEmail.split('@')[0];

  return `<!DOCTYPE html>
<html lang="ko" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <title>${params.orgName} 팀 워크스페이스 초대</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css">
  <style type="text/css">
    body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; }
    table { border-collapse: collapse; }
    a { text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .wrap { width: 100% !important; min-width: 100% !important; border-radius: 12px !important; }
      .pad { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" class="wrap" width="540" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;width:100%;background-color:#ffffff;border-radius:16px;border:1px solid #e5e7eb;box-shadow:0 4px 24px rgba(15,23,42,0.05);overflow:hidden;">
          <tr><td style="height:4px;background:linear-gradient(90deg,#0f172a 0%,#2563eb 55%,#4f46e5 100%);"></td></tr>
          <tr>
            <td class="pad" style="padding:28px 40px 0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="display:inline-block;width:30px;height:30px;background:linear-gradient(135deg,#1d4ed8,#2563eb);border-radius:8px;text-align:center;line-height:30px;color:#ffffff;font-weight:800;font-size:13px;vertical-align:middle;">LM</span>
                    <span style="margin-left:8px;font-size:16px;font-weight:800;color:#0f172a;vertical-align:middle;">LeadMaster</span>
                    <span style="margin-left:4px;font-size:12px;font-weight:600;color:#64748b;vertical-align:middle;">CRM</span>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:4px 9px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.6px;">INVITATION &middot; ${todayStr}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td class="pad" style="padding:20px 40px 0 40px;"><div style="height:1px;background-color:#f1f5f9;"></div></td></tr>
          <tr>
            <td class="pad" style="padding:28px 40px 0 40px;">
              <span style="display:inline-block;padding:4px 11px;background-color:#eff6ff;border:1px solid #dbeafe;color:#1d4ed8;font-size:11px;font-weight:700;border-radius:999px;">팀 워크스페이스 초대</span>
              <h1 style="margin:12px 0 14px 0;font-size:22px;font-weight:800;color:#0f172a;line-height:1.38;letter-spacing:-0.6px;word-break:keep-all;">${params.orgName} 팀에 초대되었습니다</h1>
              <p style="margin:0;font-size:15px;color:#475569;line-height:1.7;word-break:keep-all;">
                안녕하세요, <strong style="color:#0f172a;">${inviteeLabel}</strong>님.<br>
                <strong style="color:#0f172a;">${params.inviterName}</strong>님이 <strong style="color:#0f172a;">${params.orgName}</strong> 워크스페이스에 <strong style="color:#2563eb;">${roleLabel}</strong> 권한으로 초대했습니다.
                별도 회원가입 없이 초대된 Google 계정으로 로그인하면 즉시 합류됩니다.
              </p>
            </td>
          </tr>
          <tr>
            <td class="pad" style="padding:24px 40px 0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:18px 22px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:13.5px;">
                      <tr><td style="padding:7px 0;color:#64748b;width:104px;">소속 회사</td><td style="padding:7px 0;font-weight:700;color:#0f172a;">${params.orgName}</td></tr>
                      <tr><td colspan="2" style="height:1px;background-color:#e2e8f0;"></td></tr>
                      <tr><td style="padding:7px 0;color:#64748b;">초대자</td><td style="padding:7px 0;font-weight:600;color:#334155;">${params.inviterName}</td></tr>
                      <tr><td colspan="2" style="height:1px;background-color:#e2e8f0;"></td></tr>
                      <tr><td style="padding:7px 0;color:#64748b;">부여 권한</td><td style="padding:7px 0;"><span style="display:inline-block;padding:2px 9px;background-color:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:12px;font-weight:700;border-radius:6px;">${roleLabel}</span></td></tr>
                      <tr><td colspan="2" style="height:1px;background-color:#e2e8f0;"></td></tr>
                      <tr><td style="padding:7px 0;color:#64748b;">로그인 계정</td><td style="padding:7px 0;font-family:'SF Mono',Consolas,monospace;font-size:13px;font-weight:600;color:#2563eb;">${params.inviteeEmail}</td></tr>
                      <tr><td colspan="2" style="height:1px;background-color:#e2e8f0;"></td></tr>
                      <tr><td style="padding:7px 0;color:#64748b;">초대 유효기간</td><td style="padding:7px 0;color:#334155;font-weight:500;">${expStr}까지 (14일간 유효)</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="pad" style="padding:26px 40px 28px 40px;">
              <a href="${loginUrl}" target="_blank" style="display:block;width:100%;padding:14px 0;background-color:#2563eb;color:#ffffff;font-size:15px;font-weight:700;text-align:center;text-decoration:none;border-radius:10px;box-sizing:border-box;">Google 계정으로 팀 합류하기 &rarr;</a>
              <p style="margin:12px 0 0 0;text-align:center;font-size:11.5px;color:#94a3b8;">버튼이 동작하지 않으면 아래 주소를 복사하세요<br><a href="${loginUrl}" style="color:#64748b;font-family:monospace;font-size:11px;text-decoration:underline;">${loginUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td class="pad" style="padding:20px 40px 26px 40px;background-color:#f8fafc;border-top:1px solid #f1f5f9;font-size:12px;color:#64748b;line-height:1.6;">
              도움이 필요하시면 <a href="mailto:support@lmaster.xyz" style="color:#2563eb;text-decoration:underline;">support@lmaster.xyz</a>로 문의해 주세요.<br>
              <span style="font-size:11px;color:#94a3b8;">본 메일은 ${params.orgName} 관리자의 팀원 초대에 따라 발송되는 보안 안내 메일입니다.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
};

/**
 * 팀원 초대 이메일 발송 (단건/대량 공용)
 * 1차: Supabase Edge Function(send-invite-email) 호출 (테넌트 대표도 API 키 노출 없이 발송)
 * 2차: Edge Function 미배포/오류 시 로컬 또는 HQ Brevo API 키가 있으면 직접 발송 폴백
 */
export const sendTeamInviteEmails = async (params: {
  orgName: string;
  inviterName: string;
  invites: TeamInviteEmailItem[];
}): Promise<TeamInviteEmailResult> => {
  const loginUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/login` : 'https://www.lmaster.xyz/login';

  if (params.invites.length === 0) {
    return { sentCount: 0, failedCount: 0, failed: [] };
  }

  // 1차: Edge Function 호출
  let edgeErrorReason = '';
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('send-invite-email', {
        body: {
          orgName: params.orgName,
          inviterName: params.inviterName,
          loginUrl,
          invites: params.invites,
        },
      });
      if (!error && data) {
        if (data.code === 'BREVO_NOT_CONFIGURED') {
          return {
            sentCount: 0,
            failedCount: params.invites.length,
            notConfigured: true,
            failed: params.invites.map(i => ({ email: i.email, reason: 'Brevo API 키 미설정' })),
          };
        }
        if (typeof data.sentCount === 'number') {
          return {
            sentCount: data.sentCount,
            failedCount: Number(data.failedCount || 0),
            failed: Array.isArray(data.failed) ? data.failed : [],
          };
        }
        if (data.error) {
          edgeErrorReason = String(data.error);
        }
      } else if (error) {
        const ctx = (error as any)?.context;
        const status = typeof ctx?.status === 'number' ? ctx.status : undefined;
        let serverMsg = '';
        try {
          const errJson = await ctx?.json?.();
          if (errJson?.error) serverMsg = String(errJson.error);
        } catch {}
        edgeErrorReason = serverMsg || (status ? `Edge Function 오류 (HTTP ${status})` : error.message || 'Edge Function 호출 실패');
        console.warn('[MailService] send-invite-email error:', edgeErrorReason, error);
      }
    } catch (e: any) {
      edgeErrorReason = e?.message || 'Edge Function 네트워크 오류';
      console.warn('[MailService] send-invite-email exception:', e);
    }
  }

  // 2차 폴백: 클라이언트 키가 있는 경우 직접 Brevo API 호출
  const localKey = await getBrevoApiKey();
  if (!localKey) {
    return {
      sentCount: 0,
      failedCount: params.invites.length,
      notConfigured: true,
      failed: params.invites.map(i => ({
        email: i.email,
        reason: edgeErrorReason || '메일 발송 서버(Edge Function) 미연결',
      })),
    };
  }

  let sentCount = 0;
  const failed: { email: string; reason: string }[] = [];
  for (const inv of params.invites) {
    try {
      const roleLabel = INVITE_ROLE_LABELS[inv.role] || '상담원';
      await sendBrevoEmail({
        toEmail: inv.email,
        toName: inv.displayName || inv.email,
        subject: `[LeadMaster] ${params.orgName} 팀에 초대되었습니다`,
        textContent: `[LeadMaster CRM] ${params.inviterName}님이 ${params.orgName} 워크스페이스에 ${roleLabel} 역할로 초대했습니다.\n로그인 주소: ${loginUrl}\n반드시 ${inv.email} 구글 계정으로 로그인해 주세요.`,
        htmlContent: generateTeamInviteHtmlEmail({
          orgName: params.orgName,
          inviterName: params.inviterName,
          inviteeEmail: inv.email,
          inviteeName: inv.displayName,
          role: inv.role,
          expiresAt: inv.expiresAt,
          loginUrl,
        }),
      });
      sentCount++;
    } catch (err: any) {
      failed.push({ email: inv.email, reason: err?.message || '발송 실패' });
    }
  }

  return {
    sentCount,
    failedCount: failed.length,
    failed,
  };
};
