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

/** 승인 안내 전문 HTML 이메일 템플릿 생성기 */
export const generateApprovalHtmlEmail = (params: {
  companyName: string;
  ownerEmail: string;
  loginUrl?: string;
}): string => {
  const loginUrl = params.loginUrl || 'https://lmaster.xyz/login';
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const trialEndDateStr = `${trialEnd.getFullYear()}년 ${trialEnd.getMonth() + 1}월 ${trialEnd.getDate()}일`;

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>리드마스터 CRM 가입 승인 안내</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b1120; padding: 40px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 600px; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Header Bar -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-bottom: 1px solid #1e293b;">
              <table width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 9999px; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">
                      LeadMaster Enterprise CRM
                    </span>
                    <h1 style="margin: 14px 0 6px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                      ${params.companyName} 대표님, 환영합니다!
                    </h1>
                    <p style="margin: 0; font-size: 14px; color: #94a3b8;">
                      전용 워크스페이스 개설 승인 및 7일 무료 체험 시작 안내
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #cbd5e1;">
                안녕하세요, <strong>${params.companyName}</strong> 대표님.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #94a3b8; line-height: 1.7;">
                리드마스터 CRM 서비스 가입 신청이 호스트 승인 완료되었습니다.<br>
                대표님을 위한 전용 클라우드 워크스페이스가 정상 개설되었으며, 오늘부터 <strong>7일간 전체 기능을 무제한으로 체험</strong>하실 수 있습니다.
              </p>

              <!-- Information Box -->
              <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellspacing="0" cellpadding="6" border="0" style="font-size: 14px;">
                      <tr>
                        <td width="32%" style="color: #94a3b8; font-weight: 600;">승인 계정</td>
                        <td style="color: #60a5fa; font-weight: 700;">${params.ownerEmail}</td>
                      </tr>
                      <tr>
                        <td style="color: #94a3b8; font-weight: 600;">부여 권한</td>
                        <td style="color: #f1f5f9;">회사 총괄 대표 (Owner)</td>
                      </tr>
                      <tr>
                        <td style="color: #94a3b8; font-weight: 600;">무료 체험 기간</td>
                        <td style="color: #34d399; font-weight: 700;">승인일로부터 7일간 (~${trialEndDateStr})</td>
                      </tr>
                      <tr>
                        <td style="color: #94a3b8; font-weight: 600;">제공 서비스</td>
                        <td style="color: #e2e8f0;">DB분배·스마트자동콜·정산·AI모의훈련 전 기능</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button Section -->
              <table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" target="_blank" style="display: inline-block; width: 88%; max-width: 400px; padding: 16px 24px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-align: center; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 14px 0 rgba(37, 99, 235, 0.4);">
                      리드마스터 CRM 시작하기 →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Guide Note -->
              <div style="background-color: rgba(30, 41, 59, 0.5); border-left: 3px solid #3b82f6; padding: 14px 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
                  💡 <strong>로그인 안내:</strong> 위 버튼 클릭 후 로그인 페이지에서 <strong>[Google로 계속하기]</strong>를 클릭하시고 신청하신 구글 계정(<strong>${params.ownerEmail}</strong>)으로 인증하시면 별도의 비밀번호 없이 즉시 접속됩니다.
                </p>
              </div>

              <!-- Support Note -->
              <p style="margin: 0; font-size: 13px; color: #64748b;">
                도입 지원, 안드로이드 스마트폰 연동 또는 요금제 관련 문의 사항은 언제든지 <a href="mailto:support@lmaster.xyz" style="color: #60a5fa; text-decoration: underline;">support@lmaster.xyz</a> 로 문의해주시면 신속히 지원해 드리겠습니다.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0b1120; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                리드마스터 플랫폼 운영팀 (LeadMaster CRM)
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                문의 지원: <a href="mailto:support@lmaster.xyz" style="color: #64748b; text-decoration: none;">support@lmaster.xyz</a> | 본 메일은 신청자에게 자동 발송된 발신전용 안내메일입니다.
              </p>
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
