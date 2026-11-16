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

/** 승인 안내 전문 엔터프라이즈급 고품격 HTML 이메일 템플릿 생성기 (Stripe / Linear / Vercel 스타일의 높은 가독성과 신뢰성) */
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
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a { font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; margin: auto !important; }
      .header-padding { padding: 28px 20px 20px 20px !important; }
      .body-padding { padding: 24px 18px !important; }
      .footer-padding { padding: 24px 18px !important; }
      .mobile-stack { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .mobile-stack-gutter { margin-bottom: 12px !important; }
      .btn-table { width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', '맑은 고딕', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased; line-height: 1.6;">

  <!-- Outer Full Width Wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 40px 10px;">
    <tr>
      <td align="center">
        
        <!-- Main Card Container -->
        <table role="presentation" class="email-container" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.08); text-align: left;" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Top Accent Gradient Line -->
          <tr>
            <td height="5" style="background: linear-gradient(90deg, #2563eb 0%, #4f46e5 50%, #10b981 100%);"></td>
          </tr>

          <!-- Header Section -->
          <tr>
            <td class="header-padding" style="padding: 36px 36px 24px 36px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
              <table width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <!-- Brand Logo -->
                    <table cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: middle;">
                          <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 8px; text-align: center; line-height: 32px; color: #ffffff; font-weight: 900; font-size: 16px; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);">
                            LM
                          </div>
                        </td>
                        <td style="padding-left: 10px; vertical-align: middle;">
                          <span style="font-size: 20px; font-weight: 900; letter-spacing: -0.03em; color: #0f172a;">
                            LEAD<span style="color: #2563eb;">MASTER</span>
                          </span>
                        </td>
                        <td style="padding-left: 8px; vertical-align: middle;">
                          <span style="display: inline-block; padding: 2px 8px; background-color: #eff6ff; color: #1d4ed8; border: 1px solid #dbeafe; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em;">
                            CRM
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <!-- Trust Status Badge -->
                    <span style="display: inline-block; padding: 5px 12px; background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 12px; font-weight: 700; letter-spacing: 0.02em;">
                      ✓ 공식 승인 완료
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Main Greeting Headline -->
              <div style="margin-top: 26px;">
                <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.03em; line-height: 1.35;">
                  <span style="color: #2563eb;">${params.companyName}</span> 대표님,<br>
                  전용 워크스페이스가 개설되었습니다.
                </h1>
                <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">
                  리드마스터 엔터프라이즈 클라우드 서비스 가입 신청이 호스트 승인 완료되었습니다.<br>
                  오늘부터 <strong style="color: #059669; font-weight: 700;">7일간 전체 기능을 무제한으로 무료 체험</strong>하실 수 있습니다.
                </p>
              </div>

            </td>
          </tr>

          <!-- Main Body Content -->
          <tr>
            <td class="body-padding" style="padding: 32px 36px;">

              <!-- Workspace Detail Card (Stripe-Style Clean Spec Table) -->
              <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 12px 20px; background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 12px; font-weight: 800; color: #334155; letter-spacing: 0.04em; text-transform: uppercase;">
                      📋 워크스페이스 개설 명세
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" cellspacing="0" cellpadding="7" border="0" style="font-size: 14px;">
                      <tr>
                        <td width="32%" style="color: #64748b; font-weight: 600;">고객사 상호</td>
                        <td style="color: #0f172a; font-weight: 800; font-size: 14px;">${params.companyName}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 600;">관리자 구글 계정</td>
                        <td style="color: #2563eb; font-weight: 700; font-mono: true;">${params.ownerEmail}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 600;">부여 권한 등급</td>
                        <td style="color: #1e293b; font-weight: 600;">총괄 대표 관리자 (Workspace Owner)</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 600;">무료 체험 혜택</td>
                        <td style="color: #059669; font-weight: 700;">
                          승인일로부터 7일간 무제한 이용 (~${trialEndDateStr})
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 600;">데이터 보안 상태</td>
                        <td style="color: #334155; font-weight: 600;">
                          🔒 독립 테넌트 RLS 암호화 격리 보호 가동
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- 4 Core Enterprise Capabilities (2x2 Clean Cards) -->
              <div style="margin-bottom: 30px;">
                <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 800; color: #0f172a; letter-spacing: 0.02em;">
                  ⚡ 즉시 이용 가능한 4대 핵심 가동 엔진
                </p>
                <table width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <!-- Card 1 -->
                    <td class="mobile-stack mobile-stack-gutter" width="48%" style="vertical-align: top; padding-right: 2%;">
                      <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px;">
                        <tr>
                          <td>
                            <span style="font-size: 13px; font-weight: 800; color: #1d4ed8; display: block; margin-bottom: 4px;">
                              📞 스마트 자동콜 연동
                            </span>
                            <span style="font-size: 12px; color: #64748b; line-height: 1.5; display: block;">
                              안드로이드 스마트폰 1초 1콜 고속 발신 및 통화 녹음 자동 동기화
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <!-- Card 2 -->
                    <td class="mobile-stack" width="48%" style="vertical-align: top; padding-left: 2%;">
                      <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px;">
                        <tr>
                          <td>
                            <span style="font-size: 13px; font-weight: 800; color: #059669; display: block; margin-bottom: 4px;">
                              💰 광고비 & 실시간 정산
                            </span>
                            <span style="font-size: 12px; color: #64748b; line-height: 1.5; display: block;">
                              DB 단가, 광고비 지출 집계, 상담원 급여·수당 및 청구서 자동 산출
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr><td height="10" colspan="2"></td></tr>
                  <tr>
                    <!-- Card 3 -->
                    <td class="mobile-stack mobile-stack-gutter" width="48%" style="vertical-align: top; padding-right: 2%;">
                      <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px;">
                        <tr>
                          <td>
                            <span style="font-size: 13px; font-weight: 800; color: #6d28d9; display: block; margin-bottom: 4px;">
                              🤖 AI 통화 요약 & 텔레그램
                            </span>
                            <span style="font-size: 12px; color: #64748b; line-height: 1.5; display: block;">
                              녹취 파일 자동 텍스트 변환, AI 핵심 요약 및 실시간 텔레그램 허브
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <!-- Card 4 -->
                    <td class="mobile-stack" width="48%" style="vertical-align: top; padding-left: 2%;">
                      <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px;">
                        <tr>
                          <td>
                            <span style="font-size: 13px; font-weight: 800; color: #b45309; display: block; margin-bottom: 4px;">
                              🎯 AI 가상고객 훈련센터
                            </span>
                            <span style="font-size: 12px; color: #64748b; line-height: 1.5; display: block;">
                              1만 1천 명 가상 고객 데이터 기반 신입 상담원 실전 모의 훈련
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- 3-Step Quick Start Guide (Linear Style) -->
              <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 22px; margin-bottom: 32px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 800; color: #2563eb; letter-spacing: 0.05em; text-transform: uppercase;">
                      🚀 3단계 원클릭 시작 가이드
                    </p>
                    <table width="100%" cellspacing="0" cellpadding="6" border="0" style="font-size: 13.5px; color: #334155;">
                      <tr>
                        <td width="26" style="vertical-align: top; padding-top: 6px;">
                          <div style="width: 20px; height: 20px; background-color: #2563eb; color: #ffffff; border-radius: 50%; text-align: center; line-height: 20px; font-size: 11px; font-weight: 800;">
                            1
                          </div>
                        </td>
                        <td style="line-height: 1.5;">
                          하단의 파란색 <strong>[리드마스터 CRM 입장하기]</strong> 버튼을 클릭합니다.
                        </td>
                      </tr>
                      <tr>
                        <td style="vertical-align: top; padding-top: 6px;">
                          <div style="width: 20px; height: 20px; background-color: #2563eb; color: #ffffff; border-radius: 50%; text-align: center; line-height: 20px; font-size: 11px; font-weight: 800;">
                            2
                          </div>
                        </td>
                        <td style="line-height: 1.5;">
                          로그인 화면에서 <strong>[Google로 계속하기]</strong>를 클릭하고, 신청하신 구글 계정(<strong>${params.ownerEmail}</strong>)으로 원클릭 로그인합니다. (별도의 비밀번호 없이 즉시 접속)
                        </td>
                      </tr>
                      <tr>
                        <td style="vertical-align: top; padding-top: 6px;">
                          <div style="width: 20px; height: 20px; background-color: #2563eb; color: #ffffff; border-radius: 50%; text-align: center; line-height: 20px; font-size: 11px; font-weight: 800;">
                            3
                          </div>
                        </td>
                        <td style="line-height: 1.5;">
                          상단 메뉴의 <strong>[팀원 관리]</strong>에서 상담원 계정을 초대하고, 스마트 콜과 실시간 정산 업무를 가동합니다.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Bulletproof High-Impact CTA Button (Vercel/Stripe Cross-Client Standard) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <table role="presentation" class="btn-table" cellspacing="0" cellpadding="0" border="0" style="width: 86%; max-width: 420px;">
                      <tr>
                        <td align="center" bgcolor="#2563eb" style="border-radius: 10px; box-shadow: 0 4px 14px 0 rgba(37, 99, 235, 0.35);">
                          <a href="${loginUrl}" target="_blank" style="display: block; padding: 17px 28px; font-size: 16px; font-weight: 800; color: #ffffff; text-decoration: none; border-radius: 10px; border: 1px solid #2563eb; letter-spacing: -0.01em; text-align: center;">
                            리드마스터 CRM 워크스페이스 입장하기 →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 12px;">
                    <span style="font-size: 12px; color: #64748b;">
                      직접 접속 링크: <a href="${loginUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">${loginUrl}</a>
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Trust & Security Commitment Callout -->
              <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #10b981; border-radius: 8px; padding: 14px 16px; margin-bottom: 22px;">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 12.5px; color: #166534; line-height: 1.6;">
                      🛡️ <strong>엔터프라이즈 데이터 보호 보증:</strong> 리드마스터 CRM은 모든 고객사의 고객 DB와 상담 녹취 데이터를 상호 완전 분리된 테넌트 암호화 공간(Row Level Security)에서 안전하게 보관하며, 외부 유출이나 타사 공유가 원천 차단됩니다.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Dedicated Support Box -->
              <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px 18px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px 0; font-size: 12.5px; font-weight: 800; color: #0f172a;">
                      💬 기술 지원 및 전담 헬프데스크
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                      안드로이드 스마트폰 연동 가이드, TM 수당 정산 세팅 등 지원이 필요하신 경우 언제든 <a href="mailto:support@lmaster.xyz" style="color: #2563eb; font-weight: 700; text-decoration: underline;">support@lmaster.xyz</a> 로 문의해주시면 신속히 답변해 드립니다. (고객지원 운영: 평일 09:00 ~ 18:00)
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Official Legal Footer -->
          <tr>
            <td class="footer-padding" style="padding: 28px 36px 34px 36px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 800; color: #475569; letter-spacing: 0.02em;">
                리드마스터 플랫폼 총괄 운영국 (LeadMaster Enterprise Cloud System)
              </p>
              <p style="margin: 0 0 8px 0; font-size: 11.5px; color: #64748b; line-height: 1.5;">
                공식 도메인: <a href="https://www.lmaster.xyz" target="_blank" style="color: #64748b; text-decoration: none;">www.lmaster.xyz</a> &nbsp;|&nbsp; 고객지원 문의: <a href="mailto:support@lmaster.xyz" style="color: #2563eb; text-decoration: none; font-weight: 600;">support@lmaster.xyz</a>
              </p>
              <p style="margin: 0; font-size: 10.5px; color: #94a3b8; line-height: 1.5;">
                본 메일은 전자상거래 등에서의 소비자보호에 관한 법률 및 정보통신망 이용촉진 및 정보보호 등에 관한 법률에 의거하여 서비스 가입 신청 고객님께 발송되는 공식 업무용 승인 안내문입니다.
              </p>
            </td>
          </tr>

        </table>

        <!-- Outside Subtext -->
        <table role="presentation" width="100%" style="max-width: 600px; text-align: center; margin-top: 16px;" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="font-size: 11px; color: #94a3b8;">
              © 2026 LeadMaster CRM. All rights reserved.
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
