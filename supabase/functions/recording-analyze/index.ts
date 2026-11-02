/**
 * Supabase Edge Function: recording-analyze (2026-11-01)
 *
 * 통화 녹음 → Gemini → 상담 요약 + 대화록 + 채무·소득·주거·재산·가족 정보(JSON) → call_recordings에 저장
 *
 * 요청 body
 *   { recordingId, auto? }   auto=true: 앱이 업로드 직후 부름 → 회사 설정 auto_analyze가 꺼져 있으면 건너뜀
 *                            auto 없음: 웹의 [AI 정리] 버튼 (이미 끝난 녹음도 다시 분석)
 * 응답: 202 { ok, queued } → 실제 분석은 백그라운드(EdgeRuntime.waitUntil)에서 진행, 결과는 call_recordings.status
 *
 * 권한: 녹음 기록은 "사용자 권한"으로 읽는다(RLS) → 볼 수 없는 녹음은 분석할 수 없다.
 *       파일 내려받기·결과 저장만 service_role.
 * 비용 보호: 회사별 하루 상한(org_recording_settings.daily_analyze_cap, 기본 300건)
 * 보관 기간: 분석할 때마다 그 회사의 보관 기간(retention_days)이 지난 Supabase 임시 녹음 파일을 최대 20개 지운다 (AI 결과는 남김)
 * 구글 드라이브 녹음(storage_kind='gdrive', 017): 회사 드라이브에서 내려받아 분석하고, 자동 삭제하지 않는다.
 *
 * 비밀값: GEMINI_API_KEY (telegram-webhook과 같은 키), 선택 RECORDING_MODELS="모델1,모델2"
 * Deploy: supabase functions deploy recording-analyze --use-api --project-ref cenksfblktflfurxjmtv   (JWT 검증 켬)
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { getAccessToken } from '../_shared/drive.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const MODELS = (Deno.env.get('RECORDING_MODELS') || 'gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-3-flash-preview')
  .split(',').map(s => s.trim()).filter(Boolean);
const BUCKET = 'call-recordings';
const INLINE_MAX_BYTES = 14 * 1024 * 1024;   // 요청 20MB 제한 (base64로 1.33배) → 넘으면 Files API
const STALE_PROCESSING_MS = 10 * 60 * 1000;  // 10분 넘게 processing이면 멈춘 것으로 보고 다시 허용

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const DOMAIN_KEYWORDS = [
  '개인회생', '파산면책', '금지명령', '중지명령', '개시결정', '변제계획안', '변제인가', '면책결정',
  '별제권', '우선변제권', '총 채무액', '원금', '이자', '변제율', '변제기간', '월 변제금', '가용소득', '청산가치',
  '생계비', '중위소득', '부양가족', '배우자 재산', '임대차보증금', '최우선변제금', '압류', '가압류',
  '독촉', '추심', '신용회복위원회', '워크아웃', '프리워크아웃', '새출발기금', '대부업체', '저축은행',
  '카드론', '현금서비스', '마이너스통장', '담보대출', '신용대출', '햇살론', '사채', '일수', '4대보험',
];

// 웹 constants.ts CHECK_ITEMS·DEFAULT_CHECK_ITEMS·DEFAULT_SUMMARY_TEMPLATE과 같게 유지
const CHECK_ITEM_LABELS: Record<string, string> = {
  birth: '출생년도', region: '거주지역', job: '직업', income: '월 소득', insurance4: '4대보험', marital: '결혼 여부',
  children: '미성년 자녀', housing: '주거·보증금·월세', debtTotal: '총 채무', creditors: '채권자별 금액', monthlyPay: '월 상환액',
  overdue: '연체·독촉·압류', assets: '재산(차량·부동산·예금)', spouseAssets: '배우자 재산', creditCard: '신용카드',
  history: '회생·파산 이력', contactTime: '통화 가능 시간',
};
const DEFAULT_CHECK_ITEMS = ['birth', 'region', 'job', 'income', 'marital', 'children', 'housing', 'debtTotal', 'creditors', 'monthlyPay', 'assets', 'history'];
const DEFAULT_SUMMARY_TEMPLATE = `* 담당자 : {{managerName}}
* 고객이름 : {{customerName}}
* 연락처 : {{phone}}
* 출생년도 : {{birth}}
* 성별 : {{gender}}
* 거주지역 : {{region}}
* 직업 : {{jobTypes}}
* 4대보험 가입유무 : {{insurance4}}
* 결혼유무 : {{maritalStatus}}
* 미성년 자녀 수 : {{childrenCount}}
* 월 세후소득 (실급여) : {{incomeDetails}}
* 월 대출납입금 : {{loanMonthlyPay}}
* 거주 형태 : {{housingType}} ({{housingDetail}})
* 보증금, 월세 : {{depositRentStr}}
* 자산 : {{assetsStr}}
* 신용 대출 : {{creditLoanStr}}
* 담보 대출 (차량 /집/토지 등) : {{collateralStr}}
* 신용카드 사용유무 : {{creditCardUse}}
* 신용카드 사용금액 : {{creditCardAmountStr}}
* 개인회생 / 파산 / 회복 이력 : {{historyStr}}
* 특이사항 :
{{specialMemo}}`;

const DEFAULT_SUMMARY_RULE = `1. 고객 상황 (채무, 소득, 재산 등)
2. 주요 상담 내용 (질문 및 답변)
3. 향후 계획 및 조치
4. 특이사항
- 제목(헤더)·별표(*)·볼드(**) 없이 하이픈(-) 목록, 간결한 해요체, 사람이 쓴 상담 메모처럼`;

// Gemini 응답 형식 (OpenAPI 부분집합)
const NUM = { type: 'NUMBER', nullable: true };
const STR = { type: 'STRING', nullable: true };
const en = (values: string[]) => ({ type: 'STRING', enum: values, nullable: true });
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    transcript: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { t: { type: 'STRING' }, speaker: { type: 'STRING', enum: ['상담원', '고객', '기타'] }, text: { type: 'STRING' } },
        required: ['t', 'speaker', 'text'],
      },
    },
    debt: {
      type: 'OBJECT',
      properties: {
        total_manwon: NUM,
        monthly_payment_manwon: NUM,
        overdue: STR,
        creditors: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              name: STR,
              kind: { type: 'STRING', enum: ['신용대출', '카드론·현금서비스', '카드값', '담보대출', '보증금대출', '자동차할부', '대부업', '사채', '보증채무', '세금·공과금', '기타'] },
              amount_manwon: NUM,
              note: STR,
            },
            required: ['kind'],
          },
        },
      },
    },
    income: {
      type: 'OBJECT',
      properties: {
        net_monthly_manwon: NUM, salary_manwon: NUM, business_manwon: NUM, freelance_manwon: NUM,
        job: STR,
        job_types: { type: 'ARRAY', items: { type: 'STRING', enum: ['직장인', '일용직', '개인사업자', '법인사업자', '프리랜서', '무직'] } },
        insurance4: en(['가입', '미가입']),
      },
    },
    family: {
      type: 'OBJECT',
      properties: { marital_status: en(['미혼', '기혼', '이혼']), children_count: NUM, note: STR },
    },
    housing: {
      type: 'OBJECT',
      properties: {
        type: en(['자가', '전세', '월세', '무상거주']),
        detail: en(['아파트', '빌라', '단독주택', '오피스텔', '기타']),
        deposit_manwon: NUM, rent_manwon: NUM, deposit_loan_manwon: NUM,
        own_house_price_manwon: NUM, own_house_loan_manwon: NUM,
        contractor: en(['본인', '배우자']),
      },
    },
    assets: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: STR, owner: en(['본인', '배우자', '배우자 공동명의']),
          amount_manwon: NUM, loan_manwon: NUM, desc: STR,
        },
      },
    },
    personal: { type: 'OBJECT', properties: { birth_year: STR, gender: en(['남', '여']), region: STR } },
    credit_card: { type: 'OBJECT', properties: { use: en(['사용', '미사용']), amount_manwon: NUM } },
    history: STR,
    special_notes: STR,
    next_action: STR,
    customer_intent: { type: 'STRING', enum: ['높음', '보통', '낮음', '알 수 없음'] },
    // [거래처 설정 연동] 사무실 양식 보고서 · 빠진 확인 항목 · 분류
    office_summary: { type: 'STRING' },
    missing_items: { type: 'ARRAY', items: { type: 'STRING' } },
    classification: { type: 'OBJECT', properties: { label: { type: 'STRING' }, reason: STR }, required: ['label'] },
    case_type_suggestion: en(['개인회생', '파산', '새출발기금', '신용회복']),
  },
  required: ['summary', 'transcript', 'debt', 'income', 'family', 'housing', 'special_notes', 'customer_intent', 'office_summary', 'missing_items', 'classification'],
};

interface PromptCtx {
  customerName?: string; phone?: string; managerName?: string; direction?: string; durationSec?: number;
  summaryRule?: string; officeTemplate?: string; checkItems?: string[]; classificationGuide?: string; partnerName?: string;
}

function buildPrompt(ctx: PromptCtx) {
  const items = (ctx.checkItems && ctx.checkItems.length ? ctx.checkItems : DEFAULT_CHECK_ITEMS)
    .map(k => CHECK_ITEM_LABELS[k]).filter(Boolean);
  return `당신은 개인회생·파산·신용회복 1차 상담 녹음을 정리하는 보조 AI입니다.
첨부한 통화 녹음을 듣고 JSON으로만 답하세요.

[도메인 용어 (인식 보정)]
${DOMAIN_KEYWORDS.join(', ')}

[통화 정보]
- 받는 사무실: ${ctx.partnerName || '미정'}
- 고객 이름(등록된 값): ${ctx.customerName || '알 수 없음'}
- 고객 연락처(등록된 값): ${ctx.phone || '알 수 없음'}
- 담당 상담원: ${ctx.managerName || '알 수 없음'}
- 방향: ${ctx.direction === 'CALL_IN' ? '고객이 건 전화' : ctx.direction === 'CALL_OUT' ? '상담원이 건 전화' : '알 수 없음'}
- 길이: 약 ${Math.round((ctx.durationSec || 0) / 60)}분

[summary 작성 규칙]
${ctx.summaryRule || DEFAULT_SUMMARY_RULE}

[office_summary: 사무실 보고서]
- 아래 양식의 줄 구성과 순서를 그대로 지키고 {{...}} 자리만 통화에서 들은 내용으로 채우세요.
- 담당자·고객이름·연락처는 [통화 정보]의 값을 쓰세요.
- 통화에서 말하지 않은 칸은 "확인 필요"라고 적으세요 (추측 금지). 금액은 "3,500만원", "1억 2,000만원"처럼 쓰세요.
- {{specialMemo}} 자리에는 특이사항·다음 할 일을 하이픈 목록으로 적으세요.
양식:
${ctx.officeTemplate || DEFAULT_SUMMARY_TEMPLATE}

[missing_items: 빠진 확인 항목]
- 이 사무실이 꼭 받아야 하는 항목: ${items.join(', ')}
- 이 중 통화에서 확인하지 못한 항목의 이름만 위 표기 그대로 배열로 적으세요. 모두 확인했으면 빈 배열.

[classification: 분류]
- 아래 기준으로 이 고객을 분류하고(label: 짧은 이름), 그렇게 본 이유를 한 문장으로(reason) 적으세요. 판단할 정보가 부족하면 label="정보 부족".
${ctx.classificationGuide || '- 개인회생 가능 / 파산 검토 / 신용회복·새출발기금 검토 / 진행 어려움'}
- case_type_suggestion: 가장 맞는 절차 (개인회생·파산·새출발기금·신용회복 중 하나, 모르면 null)

[transcript]
- 화자(상담원/고객)를 나누고 대략적인 시작 시각 t("MM:SS")를 붙여 전체 대화를 빠짐없이 적으세요.
- 들리지 않는 부분은 "(잘 안 들림)"으로 적으세요.

[채무·소득·주거·재산·가족 칸 규칙]
- 금액은 모두 "만원" 단위 숫자 (예: 3천5백만원 → 3500, 150만원 → 150, 1억2천 → 12000).
- 녹음에서 실제로 말한 내용만 넣으세요. 말하지 않은 값은 null (추측 금지).
- creditors: 말한 채권자마다 한 줄 (name = 금융사·업체 이름, 모르면 null).
- debt.total_manwon: 고객이 말한 총 채무. 따로 말하지 않았으면 creditors 금액 합계, 그것도 없으면 null.
- income.net_monthly_manwon: 세후 월 실수령. 직업별 수입은 salary/business/freelance.
- debt.monthly_payment_manwon: 지금 매달 갚고 있는 금액(대출 월 상환액).
- history: 예전 개인회생·파산·신용회복·워크아웃 이력.
- special_notes: 압류·독촉·급한 사정·가족 몰래 진행 희망·연락 가능 시간 등 사무실이 알아야 할 것.
- next_action: 약속한 다음 행동(서류, 재통화 시각, 방문 등).
- customer_intent: 진행 의사.`;
}

async function geminiUploadFile(bytes: Uint8Array, mime: string, name: string): Promise<{ uri: string; name: string }> {
  const start = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST',
    headers: {
      'x-goog-api-key': GEMINI_API_KEY,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Header-Content-Type': mime,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: name } }),
  });
  const url = start.headers.get('x-goog-upload-url');
  if (!start.ok || !url) throw new Error(`Gemini 파일 업로드 시작 실패 HTTP ${start.status}`);
  const up = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Length': String(bytes.byteLength), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: bytes,
  });
  const j = await up.json().catch(() => ({}));
  if (!up.ok || !j?.file?.uri) throw new Error(`Gemini 파일 업로드 실패 HTTP ${up.status}`);
  let file = j.file;
  for (let i = 0; i < 30 && file.state === 'PROCESSING'; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}`, { headers: { 'x-goog-api-key': GEMINI_API_KEY } });
    file = await g.json();
  }
  if (file.state && file.state !== 'ACTIVE') throw new Error(`Gemini 파일 처리 실패 (${file.state})`);
  return { uri: file.uri, name: file.name };
}

async function geminiDeleteFile(name: string) {
  await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}`, { method: 'DELETE', headers: { 'x-goog-api-key': GEMINI_API_KEY } }).catch(() => {});
}

async function callGemini(prompt: string, audioPart: Record<string, unknown>) {
  let lastErr = '';
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }, audioPart] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 16384, responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      lastErr = `${model}: HTTP ${res.status} ${String(j?.error?.message || '').slice(0, 200)}`;
      // 모델 없음·과부하면 다음 모델, 그 밖(키·요청 오류)은 바로 중단
      if ([404, 429, 500, 503].includes(res.status) || /not found|not supported/i.test(lastErr)) continue;
      throw new Error(lastErr);
    }
    const cand = j?.candidates?.[0];
    const text = (cand?.content?.parts || []).map((p: any) => p?.text || '').join('');
    if (!text) { lastErr = `${model}: 빈 응답 (${cand?.finishReason || j?.promptFeedback?.blockReason || '?'})`; continue; }
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { lastErr = `${model}: JSON 해석 실패 (${cand?.finishReason || ''})`; continue; }
    const u = j?.usageMetadata || {};
    return { model, data: parsed, tokensIn: u.promptTokenCount || 0, tokensOut: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) };
  }
  throw new Error(lastErr || 'Gemini 호출 실패');
}

const n = (v: any) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));

function normalize(d: any) {
  const debt = d?.debt || {};
  const creditors = Array.isArray(debt.creditors) ? debt.creditors.map((x: any) => ({
    name: x?.name || null, kind: x?.kind || '기타', amount_manwon: n(x?.amount_manwon), note: x?.note || null,
  })) : [];
  const sum = creditors.reduce((s: number, x: any) => s + (x.amount_manwon || 0), 0);
  return {
    debt: { total_manwon: n(debt.total_manwon) ?? (sum > 0 ? sum : null), monthly_payment_manwon: n(debt.monthly_payment_manwon), overdue: debt.overdue || null, creditors },
    income: {
      net_monthly_manwon: n(d?.income?.net_monthly_manwon), salary_manwon: n(d?.income?.salary_manwon),
      business_manwon: n(d?.income?.business_manwon), freelance_manwon: n(d?.income?.freelance_manwon),
      job: d?.income?.job || null, job_types: Array.isArray(d?.income?.job_types) ? d.income.job_types : [], insurance4: d?.income?.insurance4 || null,
    },
    family: { marital_status: d?.family?.marital_status || null, children_count: n(d?.family?.children_count), note: d?.family?.note || null },
    housing: {
      type: d?.housing?.type || null, detail: d?.housing?.detail || null, deposit_manwon: n(d?.housing?.deposit_manwon), rent_manwon: n(d?.housing?.rent_manwon),
      deposit_loan_manwon: n(d?.housing?.deposit_loan_manwon), own_house_price_manwon: n(d?.housing?.own_house_price_manwon),
      own_house_loan_manwon: n(d?.housing?.own_house_loan_manwon), contractor: d?.housing?.contractor || null,
    },
    assets: Array.isArray(d?.assets) ? d.assets.map((a: any) => ({ type: a?.type || '기타', owner: a?.owner || null, amount_manwon: n(a?.amount_manwon), loan_manwon: n(a?.loan_manwon), desc: a?.desc || null })) : [],
    personal: { birth_year: d?.personal?.birth_year ? String(d.personal.birth_year).replace(/[^0-9]/g, '').slice(0, 4) || null : null, gender: d?.personal?.gender || null, region: d?.personal?.region || null },
    credit_card: { use: d?.credit_card?.use || null, amount_manwon: n(d?.credit_card?.amount_manwon) },
    history: d?.history || null,
    special_notes: d?.special_notes || null,
    next_action: d?.next_action || null,
    customer_intent: d?.customer_intent || '알 수 없음',
    office_summary: typeof d?.office_summary === 'string' ? d.office_summary.trim() : null,
    missing_items: Array.isArray(d?.missing_items) ? d.missing_items.map((x: any) => String(x)).filter(Boolean).slice(0, 30) : [],
    classification: d?.classification?.label ? { label: String(d.classification.label), reason: d.classification.reason || null } : null,
    case_type_suggestion: d?.case_type_suggestion || null,
  };
}

async function cleanupExpired(orgId: string, retentionDays: number) {
  const before = new Date(Date.now() - retentionDays * 86400_000).toISOString();
  // Supabase 임시 보관 파일만 정리한다. 구글 드라이브 원본은 자동 삭제하지 않는다 (017)
  const { data } = await admin.from('call_recordings').select('id, storage_path')
    .eq('org_id', orgId).eq('storage_kind', 'supabase').not('storage_path', 'is', null)
    .is('audio_deleted_at', null).lt('created_at', before).limit(20);
  if (!data || data.length === 0) return 0;
  const { error } = await admin.storage.from(BUCKET).remove(data.map(r => r.storage_path));
  if (error) { console.error('[recording-analyze] cleanup remove', error.message); return 0; }
  await admin.from('call_recordings').update({ audio_deleted_at: new Date().toISOString() }).in('id', data.map(r => r.id));
  return data.length;
}

async function analyze(rec: any, settings: any) {
  let geminiFile: string | null = null;
  try {
    let bytes: Uint8Array;
    if (rec.storage_kind === 'gdrive') {
      // 회사 구글 드라이브 원본 (017)
      if (!rec.drive_file_id) throw new Error('드라이브에 아직 올라가지 않은 녹음입니다');
      const token = await getAccessToken(admin, rec.org_id);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(rec.drive_file_id)}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(res.status === 404 ? '드라이브에서 녹음을 찾을 수 없거나 리드마스터에 허용되지 않았습니다' : `드라이브에서 녹음을 내려받지 못했습니다 (HTTP ${res.status})`);
      bytes = new Uint8Array(await res.arrayBuffer());
    } else {
      const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(rec.storage_path);
      if (dlErr || !blob) throw new Error(`녹음 파일을 내려받지 못했습니다 (${dlErr?.message || '없음'})`);
      bytes = new Uint8Array(await blob.arrayBuffer());
    }
    const mime = rec.mime_type || 'audio/mp4';

    const [{ data: c }, { data: st }, { data: member }] = await Promise.all([
      admin.from('cases').select('customer_name, phone, partner_id, manager_name').eq('org_id', rec.org_id).eq('case_id', rec.case_id).maybeSingle(),
      admin.from('settings').select('value').eq('org_id', rec.org_id).eq('key', 'partners').maybeSingle(),
      rec.user_id
        ? admin.from('org_members').select('display_name').eq('org_id', rec.org_id).eq('user_id', rec.user_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const partners: any[] = Array.isArray(st?.value) ? st!.value : [];
    const partner = partners.find(p => p?.partnerId === c?.partner_id);
    // 거래처(변호사 사무실)별 설정: 요약 규칙·사무실 양식·필수 확인 항목·분류 기준
    const prompt = buildPrompt({
      customerName: c?.customer_name, phone: c?.phone, managerName: (member as any)?.display_name || c?.manager_name,
      direction: rec.direction, durationSec: rec.duration_sec, partnerName: partner?.name,
      summaryRule: (partner?.aiPromptTemplate || '').trim() || undefined,
      officeTemplate: (partner?.summaryTemplate || '').trim() || undefined,
      checkItems: Array.isArray(partner?.checkItems) ? partner.checkItems : undefined,
      classificationGuide: (partner?.aiClassificationGuide || '').trim() || undefined,
    });

    let audioPart: Record<string, unknown>;
    if (bytes.byteLength <= INLINE_MAX_BYTES) {
      audioPart = { inline_data: { mime_type: mime, data: encodeBase64(bytes) } };
    } else {
      const f = await geminiUploadFile(bytes, mime, `rec-${rec.id}`);
      geminiFile = f.name;
      audioPart = { file_data: { mime_type: mime, file_uri: f.uri } };
    }

    const out = await callGemini(prompt, audioPart);
    const transcript = Array.isArray(out.data?.transcript) ? out.data.transcript.map((x: any) => ({ t: String(x?.t || ''), speaker: x?.speaker || '기타', text: String(x?.text || '') })) : [];
    await admin.from('call_recordings').update({
      status: 'done', error: null,
      summary: String(out.data?.summary || '').trim(),
      transcript, extracted: normalize(out.data),
      model: out.model, tokens_in: out.tokensIn, tokens_out: out.tokensOut,
      analyzed_at: new Date().toISOString(),
    }).eq('id', rec.id);
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 500);
    console.error('[recording-analyze] fail', rec.id, msg);
    await admin.from('call_recordings').update({ status: 'failed', error: msg }).eq('id', rec.id);
  } finally {
    if (geminiFile) await geminiDeleteFile(geminiFile);
    try { await cleanupExpired(rec.org_id, settings?.retention_days || 3650); } catch (e) { console.error('[recording-analyze] cleanup', e); }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ ok: false, error: '로그인이 필요합니다' }, 401);
  if (!GEMINI_API_KEY) return json({ ok: false, error: '서버에 AI 키가 설정되지 않았습니다' }, 500);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json({ ok: false, error: '로그인 정보를 확인할 수 없습니다' }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const recordingId = String(body?.recordingId || '').trim();
  const auto = body?.auto === true;
  if (!/^[0-9a-f-]{36}$/i.test(recordingId)) return json({ ok: false, error: '녹음이 지정되지 않았습니다' }, 400);

  // 사용자 권한으로 조회 → 볼 수 없는 녹음은 여기서 막힘
  const { data: rec } = await userClient.from('call_recordings')
    .select('id, org_id, case_id, user_id, storage_path, storage_kind, drive_file_id, mime_type, direction, duration_sec, status, updated_at, audio_deleted_at')
    .eq('id', recordingId).maybeSingle();
  if (!rec) return json({ ok: false, error: '녹음을 찾을 수 없거나 권한이 없습니다' }, 404);
  if (rec.audio_deleted_at) return json({ ok: false, error: '보관 기간이 지나 녹음 파일이 지워졌습니다' }, 410);

  const { data: settings } = await admin.from('org_recording_settings').select('*').eq('org_id', rec.org_id).maybeSingle();
  if (auto && !settings?.auto_analyze) return json({ ok: true, queued: false, reason: 'auto_analyze_off' });
  if (rec.status === 'processing' && Date.now() - new Date(rec.updated_at).getTime() < STALE_PROCESSING_MS) {
    return json({ ok: true, queued: false, reason: 'already_processing' });
  }
  if (auto && rec.status === 'done') return json({ ok: true, queued: false, reason: 'already_done' });

  // 하루 상한 (한국 날짜 기준)
  const cap = settings?.daily_analyze_cap ?? 300;
  const kstMidnight = new Date(Math.floor((Date.now() + 9 * 3600_000) / 86400_000) * 86400_000 - 9 * 3600_000).toISOString();
  const { count } = await admin.from('call_recordings').select('id', { count: 'exact', head: true })
    .eq('org_id', rec.org_id).gte('analyzed_at', kstMidnight);
  if ((count || 0) >= cap) {
    if (auto) await admin.from('call_recordings').update({ status: 'queued', error: `하루 AI 정리 상한(${cap}건)을 넘어 대기 중` }).eq('id', rec.id);
    return json({ ok: false, error: `오늘 AI 정리 상한(${cap}건)에 도달했습니다. 팀 관리 → 통화 녹음에서 상한을 바꿀 수 있습니다.` }, 429);
  }

  await admin.from('call_recordings').update({ status: 'processing', error: null }).eq('id', rec.id);
  const task = analyze(rec, settings);
  // @ts-ignore EdgeRuntime는 Supabase Edge 런타임 전역
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(task);
  else await task;
  return json({ ok: true, queued: true }, 202);
});
