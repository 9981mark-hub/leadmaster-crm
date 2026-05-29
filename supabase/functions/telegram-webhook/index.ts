/**
 * Supabase Edge Function: Telegram Webhook Handler
 * 
 * Receives Telegram Bot messages via webhook, parses them,
 * classifies feedback using Gemini AI, matches to CRM cases,
 * and stores results in telegram_feedbacks table.
 * 
 * Deploy: supabase functions deploy telegram-webhook
 * Set secrets: supabase secrets set TELEGRAM_BOT_TOKEN=xxx GEMINI_API_KEY=xxx
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================
// 1. Telegram Message Parser
// ============================================

interface ParsedMessage {
  messageId: number;
  replyToMessageId?: number;
  senderName: string;
  text: string;
  timestamp: string;
  chatId: string;
  chatTitle: string;
}

function parseTelegramUpdate(update: any): ParsedMessage | null {
  const msg = update.message;
  if (!msg || !msg.text) return null;

  const sender = msg.from;
  const senderName = [sender?.first_name, sender?.last_name].filter(Boolean).join(' ');
  const chat = msg.chat;

  return {
    messageId: msg.message_id,
    replyToMessageId: msg.reply_to_message?.message_id,
    senderName,
    text: msg.text,
    timestamp: new Date(msg.date * 1000).toISOString(),
    chatId: String(chat?.id || ''),
    chatTitle: chat?.title || senderName || '',
  };
}

// ============================================
// 2. Gemini AI Feedback Classifier & Extractor
// ============================================

const CLASSIFICATION_PROMPT = `당신은 법률 사무소 CRM 시스템의 피드백 분류 AI입니다.
텔레그램 그룹에서 사무장/직원이 보낸 아래 메시지를 분석하여 고객의 이름과 피드백 내용을 JSON으로 출력하세요.

중요: 담당자들이 고객 피드백을 보낼 때 여러 형태를 사용합니다. 메시지 첫 부분의 한글 이름(2~4글자)을 고객명(customerName)으로 추출하세요.

추출 우선순위:
1. "고객이름 // 내용" 또는 "고객이름/내용" (슬래시 구분)
   예: "홍선우 // 채권사목록 전달..." → "홍선우"
   예: "이희수// 아느곳에..." → "이희수"
2. "고객이름\n내용" (줄바꿈 구분 — 첫 줄이 한글 2~4자 이름만)
   예: "김우인\n5/19일 오후2시 출장예정이였으나..." → "김우인"
   예: "박영국\n신용카드 1년반정도 못쓰는..." → "박영국"
3. "고객이름님 내용" (이름 뒤 '님' + 바로 내용)
   예: "김경희님 몸이 너무 아파서..." → "김경희"
4. "고객이름+내용" (이름 뒤 띄어쓰기 없이 바로 피드백)
   예: "박현승등기부등본 발급해보니..." → "박현승"
   예: "손승완바쁘시다하셔서..." → "손승완"

단, "* 담당자 :" 로 시작하는 접수서(앞지)는 "고객이름" 필드에서 이름을 추출하세요.
고객명이 안 보이거나 단순 인사말이면 null.

피드백 유형 목록 (정확히 하나만 선택):
- 부재: 전화 안 받음, 부재
- 지속부재: 계속/지속 부재
- 진행불가: 자격 미달로 진행 불가 (청산가치 과다, 부동의 우려, 재산 > 채무, 단기미도래, 대부 과다 등). "진행불가", "진행 불가", "진행이 불가" 키워드가 포함되면 반드시 이 유형을 선택하고 suggestedStatus를 "진행불가"로 설정
- 고객거부: 고민 중, 생각해보겠다
- 통화예약: 특정 시간에 전화해달라
- 출장예약: 특정 날짜 출장/미팅 예약
- 방문예약: 내방 상담, 사무실 방문 예약
- 상담완료: 상담 마침
- 계약완료: 계약, 수임, 입금 완료
- 명함발송: 명함 발송
- 재통화요청: 전화해달라 (시간 미지정)
- 미팅취소: 미팅/출장을 취소함
- 출장방문취소: 출장 또는 방문 예약 취소
- 진행거부: 고객이 비용/실익 문제로 진행 안 하겠다
- 타사무소선택: 다른 곳에서 진행하기로 함
- 계약취소시도: 이미 계약했는데 취소하려 함
- 비용부담거절: 수임료/비용 부담으로 거절
- 자산포기불가: 차량/부동산 포기 못해서 불가
- 일반메모: 위에 해당 안 되는 일반 피드백
- 비피드백: 인사, 공지, 질문 등 피드백 아닌 메시지

응답 형식 (JSON만, 마크다운 없이):
{
  "customerName": "박현승",
  "feedbackType": "부재",
  "suggestedStatus": "부재",
  "suggestedStatusLevel": "2차",
  "suggestedDropOffReason": null,
  "suggestedMemo": "부재입니다. 재전해보겠습니다.",
  "reminder": null,
  "contract": null,
  "confidence": 0.95
}

suggestedStatusLevel 규칙:
- 대부분의 사무장 피드백 → "2차" (1차 상태 '사무장 접수' 유지)
- 최종 결과(계약완료, 진행불가, 고객취소) → "1차"
- 상태 변경 없는 메모 → null

reminder 형식 (있을 경우):
{ "type": "통화|출장미팅|방문미팅", "datetime": "YYYY-MM-DD HH:mm" }

contract 형식 (있을 경우):
{ "fee": 440, "deposits": [{ "date": "2026-04-17", "amount": 30 }] }`;

// AI 모델 우선순위 (최신 → 레거시 fallback)
const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
];

async function callGeminiWithFallback(prompt: string): Promise<string> {
  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Referer': 'https://9981mark-hub.github.io/'
          },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: prompt }] }
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 500,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      const result = await response.json();
      
      // 상세 에러 로깅
      if (!response.ok) {
        console.error(`[TG-Webhook] ${model} HTTP ${response.status}:`, JSON.stringify(result));
        continue;
      }

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        console.log(`[TG-Webhook] AI success with model: ${model}`);
        return text;
      }
      
      // 빈 응답 상세 로깅
      const blockReason = result.candidates?.[0]?.finishReason || result.promptFeedback?.blockReason;
      console.warn(`[TG-Webhook] Empty response from ${model}, reason: ${blockReason}, full: ${JSON.stringify(result).substring(0, 500)}`);
    } catch (err) {
      console.warn(`[TG-Webhook] ${model} failed:`, err);
    }
  }
  throw new Error('All Gemini models returned empty responses');
}

/**
 * 정규식 기반 고객 이름 추출 (AI 실패 시 fallback)
 * "홍선우 // 내용..." 또는 "이형관// 부재입니다" 패턴에서 이름 추출
 */
function extractCustomerNameByRegex(text: string): string | null {
  const trimmed = text.trim();
  
  // 패턴 1: "이름 // 내용" 또는 "이름// 내용"
  const slashMatch = trimmed.match(/^([가-힣]{2,4})\s*\/\//);
  if (slashMatch) return slashMatch[1];
  
  // 패턴 2: "이름 / 내용" (단일 슬래시)
  const singleSlash = trimmed.match(/^([가-힣]{2,4})\s*\/\s/);
  if (singleSlash) return singleSlash[1];

  // 패턴 3: "이름\n내용" (줄바꿈 구분 — 첫 줄이 한글 이름 2~4자만)
  const newlineMatch = trimmed.match(/^([가-힣]{2,4})(?:님)?\s*\n/);
  if (newlineMatch) return newlineMatch[1];

  // 패턴 4: "이름님 내용" 또는 "이름+동사" (이름 뒤 바로 피드백)
  // 접수서("* 담당자 :")는 제외
  if (!trimmed.startsWith('*')) {
    const inlineMatch = trimmed.match(
      /^([가-힣]{2,4})(?:님)?\s*(?:몸이|수임료|비용|등기|체납|현재|바쁘|문자|집|부재|전화|진행|출장|상담|비대면|계약|내방|미팅|채권|신용|오전|오후|내일|금요|월요|화요|수요|목요|토요|일요|혹시|신복|새출발|신용회복|아들|어머니|아버지|배우자|남편|아내|\d)/
    );
    if (inlineMatch) return inlineMatch[1];
  }

  return null;
}

async function classifyWithGemini(
  senderName: string,
  feedbackText: string
): Promise<any> {
  const userMessage = `발신자: ${senderName}\n메시지 원본: "${feedbackText}"`;

  try {
    const text = await callGeminiWithFallback(CLASSIFICATION_PROMPT + '\n\n' + userMessage);
    return JSON.parse(text);
  } catch (err) {
    console.error('[TG-Webhook] Gemini classification error:', err);
    
    // AI 실패 시 정규식으로 고객 이름 추출 시도
    const regexName = extractCustomerNameByRegex(feedbackText);
    console.log(`[TG-Webhook] Regex fallback name extraction: "${regexName}"`);
    
    // "이름 // 내용" 패턴이면 키워드 기반 자동 판별
    let feedbackType = '일반메모';
    let suggestedStatus: string | null = null;
    
    if (/진행\s*불가|진행이?\s*불가|부동의\s*우려/.test(feedbackText)) {
      feedbackType = '진행불가';
      suggestedStatus = '진행불가';
    } else if (feedbackText.includes('부재')) {
      feedbackType = '부재';
      suggestedStatus = '부재';
    }
    
    return {
      customerName: regexName,
      feedbackType,
      suggestedStatus,
      suggestedStatusLevel: suggestedStatus ? '2차' : null,
      suggestedDropOffReason: null,
      suggestedMemo: feedbackText,
      reminder: null,
      contract: null,
      confidence: regexName ? 0.5 : 0,
      _aiError: true,
    };
  }
}

// ============================================
// 4. Customer Matching Engine
// ============================================

async function getMappedPartnerId(chatId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'partners').single();
    if (data && Array.isArray(data.value)) {
      const partner = data.value.find((p: any) => p.telegramChatId === chatId);
      if (partner) return partner.partnerId;
    }
  } catch (err) {
    console.error('[TG-Webhook] Failed to fetch partners settings:', err);
  }
  return null;
}

async function matchCustomerToCase(customerName: string, partnerId?: string | null): Promise<{ matchedCaseId: string | null; candidates: any[] }> {
  if (!customerName) return { matchedCaseId: null, candidates: [] };

  // Strategy 1: Exact name match on active cases
  let queryExact = supabase
    .from('cases')
    .select('case_id, customer_name, status, created_at')
    .eq('customer_name', customerName)
    .in('status', ['사무장 접수', '상담중', '재통화 예정', '계약 완료', '1차 입금완료', '2차 입금완료']);
    
  if (partnerId) {
    queryExact = queryExact.eq('partner_id', partnerId);
  }
  
  const { data: exactMatches } = await queryExact.order('created_at', { ascending: false });

  if (exactMatches && exactMatches.length === 1) {
    return { matchedCaseId: exactMatches[0].case_id, candidates: exactMatches };
  }
  if (exactMatches && exactMatches.length > 1) {
    return { matchedCaseId: null, candidates: exactMatches };
  }

  // Strategy 2: Fuzzy match (contains)
  let queryFuzzy = supabase
    .from('cases')
    .select('case_id, customer_name, status, created_at')
    .ilike('customer_name', `%${customerName}%`)
    .in('status', ['사무장 접수', '상담중', '재통화 예정']);
    
  if (partnerId) {
    queryFuzzy = queryFuzzy.eq('partner_id', partnerId);
  }
  
  const { data: fuzzyMatches } = await queryFuzzy.order('created_at', { ascending: false });

  if (fuzzyMatches && fuzzyMatches.length === 1) {
    return { matchedCaseId: fuzzyMatches[0].case_id, candidates: fuzzyMatches };
  }
  if (fuzzyMatches && fuzzyMatches.length > 1) {
    return { matchedCaseId: null, candidates: fuzzyMatches };
  }

  // Strategy 3: Global Exact match (any status)
  let queryGlobal = supabase
    .from('cases')
    .select('case_id, customer_name, status, created_at')
    .eq('customer_name', customerName);
    
  if (partnerId) {
    queryGlobal = queryGlobal.eq('partner_id', partnerId);
  }
  
  const { data: globalMatches } = await queryGlobal.order('created_at', { ascending: false });

  if (globalMatches && globalMatches.length === 1) {
    return { matchedCaseId: globalMatches[0].case_id, candidates: globalMatches };
  }
  if (globalMatches && globalMatches.length > 1) {
    return { matchedCaseId: null, candidates: globalMatches };
  }

  return { matchedCaseId: null, candidates: [] };
}

// ============================================
// 5. Hybrid Auto-Apply Logic
// ============================================

const AUTO_APPLY_TYPES = new Set([
  '부재', '지속부재', '명함발송', '재통화요청', '통화예약', '일반메모', '비피드백', '진행불가'
]);

const URGENCY_MAP: Record<string, string> = {
  '계약취소시도': 'critical',
  '미팅취소': 'high',
  '출장방문취소': 'high',
  '타사무소선택': 'high',
  '진행불가': 'normal',
  '진행거부': 'normal',
  '비용부담거절': 'normal',
  '자산포기불가': 'normal',
  '고객거부': 'info',
};

async function autoApplyFeedback(
  caseId: string,
  classification: any,
  senderName: string,
  originalText: string
): Promise<void> {
  const { feedbackType, suggestedStatus, suggestedMemo } = classification;
  const memoPrefix = `[TG-자동] ${senderName}:`;
  const memoContent = suggestedMemo || originalText;

  // Fetch current case
  const { data: caseData } = await supabase
    .from('cases')
    .select('*')
    .eq('case_id', caseId)
    .single();

  if (!caseData) return;

  const getArray = (val: any) => Array.isArray(val) ? val : (typeof val === 'string' ? JSON.parse(val) : []);
  const updates: Record<string, any> = {};
  const currentMemos = getArray(caseData.special_memo);

  // Always add memo
  const newMemo = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    content: `${memoPrefix} ${memoContent}`,
  };
  updates.special_memo = [newMemo, ...currentMemos];

  // Status updates (2차 상태 for most feedback)
  if (feedbackType === '부재' || feedbackType === '지속부재') {
    updates.secondary_status = '부재';
    updates.missed_call_count = (caseData.missed_call_count || 0) + 1;
    updates.last_missed_call_at = new Date().toISOString();
  }
  if (feedbackType === '진행불가') {
    updates.secondary_status = '진행불가';
  }

  // Add status log ALWAYS
  const currentLogs = getArray(caseData.status_logs);
  const log = {
    logId: Date.now().toString(),
    fromStatus: `${caseData.status} (${caseData.secondary_status || '없음'})`,
    toStatus: `${caseData.status} (${suggestedStatus || caseData.secondary_status || '없음'})`,
    changedAt: new Date().toISOString(),
    changedBy: `TG-${senderName}`,
    memo: memoContent.substring(0, 200),
  };
  updates.status_logs = [log, ...currentLogs];

  // Reminder creation
  if (classification.reminder) {
    const currentReminders = getArray(caseData.reminders);
    const newReminder = {
      id: `tg-${Date.now()}`,
      datetime: classification.reminder.datetime,
      type: classification.reminder.type,
      content: `[TG] ${memoContent}`,
      isCompleted: false,
    };
    updates.reminders = [newReminder, ...currentReminders];
  }

  // Apply updates
  await supabase
    .from('cases')
    .update(updates)
    .eq('case_id', caseId);
}

// ============================================
// 6. Main Webhook Handler
// ============================================

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  // [SECURITY] Telegram Secret Token 검증 — 텔레그램 외 요청 차단
  if (TELEGRAM_WEBHOOK_SECRET) {
    const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
    if (secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  try {
    const update = await req.json();
    const parsed = parseTelegramUpdate(update);

    if (!parsed) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no text message' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // [SKIP] 관리자(mark jin)가 직업 보낸 메시지는 수집하지 않고 스킵
    if (parsed.senderName.toLowerCase().replace(/ /g, '') === 'markjin' || parsed.senderName.includes('마크진')) {
      return new Response(JSON.stringify({ ok: true, skipped: 'admin sent message' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Trivial skip for meaningless short texts to save AI calls
    if (parsed.text.trim().length <= 2) {
      return new Response(JSON.stringify({ ok: true, skipped: 'too short' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // AI Classification directly on raw text
    const classification = await classifyWithGemini(
      parsed.senderName,
      parsed.text
    );

    // Skip only confirmed non-feedback messages (NOT AI errors)
    // AI 에러로 customerName이 null인 경우에도 원본 메시지를 DB에 저장
    // "이름 // 내용" 패턴이 있으면 비피드백이라도 스킵하지 않음
    const hasNamePattern = /^[가-힣]{2,4}\s*\/\//.test(parsed.text.trim())
        || /^[가-힣]{2,4}(?:님)?\s*\n/.test(parsed.text.trim());
    if (classification.feedbackType === '비피드백' && !classification._aiError && !hasNamePattern && !classification.customerName) {
      return new Response(JSON.stringify({ ok: true, skipped: 'non-feedback' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const customerName = classification.customerName;

    // Get Partner Mapping from Chat ID
    const mappedPartnerId = await getMappedPartnerId(parsed.chatId);

    // Match to CRM case
    const { matchedCaseId, candidates } = await matchCustomerToCase(customerName, mappedPartnerId);
    classification.candidates = candidates;

    // Determine apply mode and urgency (Never auto apply if multiple matches / null id)
    const isAutoApplyInfo = AUTO_APPLY_TYPES.has(classification.feedbackType);
    const isAutoApply = isAutoApplyInfo && !!matchedCaseId;
    const applyMode = isAutoApply ? 'auto' : 'pending';
    const urgency = URGENCY_MAP[classification.feedbackType] || 'info';

    // Store in telegram_feedbacks table
    const { error: insertError } = await supabase
      .from('telegram_feedbacks')
      .insert({
        message_id: parsed.messageId,
        reply_to_message_id: parsed.replyToMessageId || null,
        sender_name: parsed.senderName,
        customer_name: customerName,
        feedback_type: classification.feedbackType,
        feedback_content: parsed.text,
        chat_id: parsed.chatId,
        chat_title: parsed.chatTitle,
        matched_case_id: matchedCaseId,
        is_applied: isAutoApply,
        is_confirmed: isAutoApply,
        apply_mode: applyMode,
        urgency,
        ai_classification: classification,
      });

    if (insertError) {
      // Duplicate message_id → skip silently
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ ok: true, skipped: 'duplicate' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw insertError;
    }

    // Auto-apply if applicable
    if (isAutoApply && matchedCaseId) {
      await autoApplyFeedback(matchedCaseId, classification, parsed.senderName, parsed.text);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        feedbackType: classification.feedbackType,
        customerName,
        matchedCaseId,
        applyMode: isAutoApply ? 'auto' : 'pending',
        urgency,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[TG-Webhook] Error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
