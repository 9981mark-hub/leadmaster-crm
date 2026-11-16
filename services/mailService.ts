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

/** 승인 안내 전문 고품격 HTML 이메일 템플릿 생성기 (신뢰성 및 프리미엄 브랜딩 강화) */
export const generateApprovalHtmlEmail = (params: {
  companyName: string;
  ownerEmail: string;
  loginUrl?: string;
}): string => {
  const loginUrl = params.loginUrl || 'https://www.lmaster.xyz/login';
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const trialEndDateStr = `${trialEnd.getFullYear()}년 ${trialEnd.getMonth() + 1}월 ${trialEnd.getDate()}일`;

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>리드마스터 CRM 가입 승인 및 워크스페이스 개설 안내</title>
  <style>
    @media only screen and (max-width: 620px) {
      .container-table { width: 100% !important; }
      .content-padding { padding: 24px 18px !important; }
      .grid-stack { display: block !important; width: 100% !important; margin-bottom: 10px !important; }
      .cta-btn { width: 100% !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #070c18; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9; -webkit-font-smoothing: antialiased; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #070c18; padding: 40px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" class="container-table" width="100%" style="max-width: 600px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); text-align: left;" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Top Accent Line -->
          <tr>
            <td height="5" style="background: linear-gradient(90deg, #3b82f6 0%, #6366f1 50%, #10b981 100%);"></td>
          </tr>

          <!-- Header Bar -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; background: linear-gradient(180deg, #131d33 0%, #0f172a 100%); border-bottom: 1px solid #1e293b;">
              <table width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <!-- Logo & Trust Badges -->
                    <table width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="left" style="vertical-align: middle;">
                          <div style="display: inline-flex; align-items: center; gap: 8px;">
                            <span style="font-size: 20px; font-weight: 900; letter-spacing: -0.03em; color: #ffffff;">
                              LEAD<span style="color: #3b82f6;">MASTER</span>
                            </span>
                            <span style="padding: 2px 7px; background-color: #1e293b; color: #94a3b8; border: 1px solid #334155; border-radius: 6px; font-size: 10px; font-weight: 700; letter-spacing: 0.05em;">
                              CRM
                            </span>
                          </div>
                        </td>
                        <td align="right" style="vertical-align: middle;">
                          <span style="display: inline-block; padding: 4px 10px; background-color: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.28); border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em;">
                            ✓ 호스트 공식 승인
                          </span>
                        </td>
                      </tr>
                    </table>

                    <!-- Welcome Title -->
                    <div style="margin-top: 24px;">
                      <h1 style="margin: 0 0 8px 0; font-size: 23px; font-weight: 800; color: #ffffff; letter-spacing: -0.03em; line-height: 1.35;">
                        <span style="color: #60a5fa;">${params.companyName}</span> 대표님,<br>
                        전용 워크스페이스 개설이 완료되었습니다.
                      </h1>
                      <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                        리드마스터 엔터프라이즈 클라우드에 오신 것을 환영합니다.<br>
                        오늘부터 <strong style="color: #34d399;">7일간 전체 기능을 무제한으로 체험</strong>하실 수 있습니다.
                      </p>
                    </div>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td class="content-padding" style="padding: 32px;">

              <!-- Executive Account Summary Box -->
              <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #131d33; border: 1px solid #1e293b; border-radius: 14px; overflow: hidden; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 14px 20px; background-color: #1a2744; border-bottom: 1px solid #24355a;">
                    <span style="font-size: 12px; font-weight: 700; color: #93c5fd; letter-spacing: 0.03em; text-transform: uppercase;">
                      📋 워크스페이스 개설 정보
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 20px;">
                    <table width="100%" cellspacing="0" cellpadding="6" border="0" style="font-size: 13px;">
                      <tr>
                        <td width="30%" style="color: #94a3b8; font-weight: 600;">고객사 상호</td>
                        <td style="color: #ffffff; font-weight: 700; font-size: 14px;">${params.companyName}</td>
                      </tr>
                      <tr>
                        <td style="color: #94a3b8; font-weight: 600;">관리자 구글 계정</td>
                        <td style="color: #60a5fa; font-weight: 700;">${params.ownerEmail}</td>
                      </tr>
                      <tr>
                        <td style="color: #94a3b8; font-weight: 600;">부여 권한 등급</td>
                        <td style="color: #e2e8f0; font-weight: 600;">총괄 대표 관리자 (Workspace Owner)</td>
                      </tr>
                      <tr>
                        <td style="color: #94a3b8; font-weight: 600;">무료 체험 기간</td>
                        <td style="color: #34d399; font-weight: 700;">
                          승인일로부터 7일간 (~${trialEndDateStr})
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #94a3b8; font-weight: 600;">데이터 보안</td>
                        <td style="color: #a5b4fc; font-weight: 600;">
                          🔒 독립 테넌트 RLS 암호화 격리 보호
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- 4 Core Systems Included -->
              <div style="margin-bottom: 28px;">
                <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #cbd5e1; letter-spacing: 0.02em;">
                  ⚡ 즉시 이용 가능한 4대 엔터프라이즈 기능
                </p>
                <table width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="grid-stack" width="48%" style="vertical-align: top; padding-right: 2%;">
                      <div style="background-color: #0b1324; border: 1px solid #1e293b; border-radius: 10px; padding: 12px 14px; margin-bottom: 8px;">
                        <span style="font-size: 13px; font-weight: 700; color: #60a5fa; display: block; margin-bottom: 2px;">
                          📞 스마트 자동콜 연동
                        </span>
                        <span style="font-size: 11px; color: #94a3b8; line-height: 1.4; display: block;">
                          안드로이드 스마트폰 1초 1콜 고속 발신 및 통화 녹음 자동 동기화
                        </span>
                      </div>
                    </td>
                    <td class="grid-stack" width="48%" style="vertical-align: top; padding-left: 2%;">
                      <div style="background-color: #0b1324; border: 1px solid #1e293b; border-radius: 10px; padding: 12px 14px; margin-bottom: 8px;">
                        <span style="font-size: 13px; font-weight: 700; color: #34d399; display: block; margin-bottom: 2px;">
                          💰 광고비 & 실시간 정산
                        </span>
                        <span style="font-size: 11px; color: #94a3b8; line-height: 1.4; display: block;">
                          DB 단가, 광고비 지출 집계, 상담원 급여·수당 및 청구서 자동 산출
                        </span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td class="grid-stack" width="48%" style="vertical-align: top; padding-right: 2%;">
                      <div style="background-color: #0b1324; border: 1px solid #1e293b; border-radius: 10px; padding: 12px 14px; margin-bottom: 8px;">
                        <span style="font-size: 13px; font-weight: 700; color: #a78bfa; display: block; margin-bottom: 2px;">
                          🤖 AI 통화 요약 & 텔레그램
                        </span>
                        <span style="font-size: 11px; color: #94a3b8; line-height: 1.4; display: block;">
                          녹취 파일 자동 텍스트 변환, AI 핵심 요약 및 실시간 텔레그램 허브
                        </span>
                      </div>
                    </td>
                    <td class="grid-stack" width="48%" style="vertical-align: top; padding-left: 2%;">
                      <div style="background-color: #0b1324; border: 1px solid #1e293b; border-radius: 10px; padding: 12px 14px; margin-bottom: 8px;">
                        <span style="font-size: 13px; font-weight: 700; color: #f59e0b; display: block; margin-bottom: 2px;">
                          🎯 AI 가상고객 훈련센터
                        </span>
                        <span style="font-size: 11px; color: #94a3b8; line-height: 1.4; display: block;">
                          1만 1천 명 가상 고객 데이터 기반 신입 상담원 실전 모의 훈련
                        </span>
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- 3-Step Quick Start -->
              <div style="background-color: #09101f; border: 1px solid #1e293b; border-radius: 12px; padding: 18px 20px; margin-bottom: 30px;">
                <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: #60a5fa; letter-spacing: 0.05em; text-transform: uppercase;">
                  🚀 3단계 원클릭 시작 가이드
                </p>
                <table width="100%" cellspacing="0" cellpadding="4" border="0" style="font-size: 13px; color: #cbd5e1;">
                  <tr>
                    <td width="24" style="vertical-align: top; color: #3b82f6; font-weight: 800;">1.</td>
                    <td>아래 <strong>[리드마스터 CRM 시작하기]</strong> 버튼을 클릭합니다.</td>
                  </tr>
                  <tr>
                    <td style="vertical-align: top; color: #3b82f6; font-weight: 800;">2.</td>
                    <td>로그인 페이지에서 <strong>[Google로 계속하기]</strong>를 클릭하고, 신청하신 구글 계정(<strong>${params.ownerEmail}</strong>)으로 원클릭 로그인합니다. (비밀번호 불필요)</td>
                  </tr>
                  <tr>
                    <td style="vertical-align: top; color: #3b82f6; font-weight: 800;">3.</td>
                    <td>로그인 즉시 대표 권한이 활성화되며, <strong>[팀원 관리]</strong>에서 상담원을 등록하고 스마트 콜 업무를 시작합니다.</td>
                  </tr>
                </table>
              </div>

              <!-- High-Trust CTA Button -->
              <table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" target="_blank" class="cta-btn" style="display: inline-block; width: 88%; max-width: 420px; padding: 17px 24px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-align: center; font-size: 15px; font-weight: 800; text-decoration: none; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.45); letter-spacing: -0.01em;">
                      리드마스터 CRM 워크스페이스 입장하기 →
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 10px;">
                    <span style="font-size: 11px; color: #64748b;">
                      직접 접속 링크: <a href="${loginUrl}" style="color: #64748b; text-decoration: underline;">${loginUrl}</a>
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Trust & Security Commitment Box -->
              <div style="background-color: rgba(15, 23, 42, 0.8); border: 1px solid #1e293b; border-left: 3px solid #10b981; padding: 14px 16px; border-radius: 6px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                  🛡️ <strong>데이터 격리 및 프라이버시 보증:</strong> 리드마스터 CRM은 모든 고객사의 데이터베이스와 통화 녹취를 상호 분리된 암호화 공간(RLS)에서 보관하며, 외부 유출이나 타사 공유가 원천 차단됩니다.
                </p>
              </div>

              <!-- Support Contact Box -->
              <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b1324; border: 1px solid #1e293b; border-radius: 10px; padding: 14px 16px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 700; color: #cbd5e1;">
                      💬 기술 지원 및 도입 문의
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                      스마트폰 연동 가이드, 요금제 상담 등 지원이 필요하신 경우 언제든 <a href="mailto:support@lmaster.xyz" style="color: #60a5fa; font-weight: 600; text-decoration: none;">support@lmaster.xyz</a> 로 문의해주시면 엔지니어가 신속히 답변해 드립니다. (평일 09:00 ~ 18:00)
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Official Legal Footer -->
          <tr>
            <td style="padding: 24px 32px 30px 32px; background-color: #070c18; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #64748b; letter-spacing: 0.02em;">
                리드마스터 플랫폼 총괄 운영국 (LeadMaster Enterprise Cloud)
              </p>
              <p style="margin: 0 0 10px 0; font-size: 11px; color: #475569; line-height: 1.5;">
                공식 도메인: <a href="https://www.lmaster.xyz" style="color: #64748b; text-decoration: none;">www.lmaster.xyz</a> | 고객지원: <a href="mailto:support@lmaster.xyz" style="color: #64748b; text-decoration: none;">support@lmaster.xyz</a>
              </p>
              <p style="margin: 0; font-size: 10px; color: #334155; line-height: 1.4;">
                본 메일은 정보통신망 이용촉진 및 정보보호 등에 관한 법률에 의거하여 서비스 가입을 신청하신 고객님께 발송되는 공식 업무용 승인 안내 메일입니다.
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
