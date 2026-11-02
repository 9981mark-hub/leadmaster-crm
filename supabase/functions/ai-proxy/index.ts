/**
 * Supabase Edge Function: ai-proxy (2026-11-01)
 *
 * 브라우저가 직접 부르던 Gemini·Cloud Vision을 서버로 옮긴 것. 브라우저에는 AI 키가 없다.
 * 로그인한 회사 멤버만, 정해 둔 작업(task)만, 회사별 하루 상한 안에서 Gemini를 부른다.
 *
 * 요청 (POST JSON)
 *   { task, prompt, files?: [{ mimeType, data }], responseMimeType?: 'text/plain' | 'application/json',
 *     responseSchema?: object, temperature?: number }      files[].data = base64 (data: 접두어 없이)
 *   task: case_summary   통화 녹음 → 상담 요약 + 대화록 (오디오, 20MB까지)
 *         image_extract  이미지 → 이름·전화번호 목록 (이미지, 10MB까지)
 *         import_ocr     상담 신청서 이미지·PDF → 고객 정보 (15MB까지)
 *         receipt_text   영수증 이미지 → 글자 그대로 (이미지, 5MB까지)
 * 응답
 *   200 { text, model, usage: { input, output } }
 *   오류 { error }  401 로그인 없음 · 403 소속 회사 없음/회사·계정 사용 중지 · 400 잘못된 작업·입력
 *                   413 너무 큼 · 429 오늘 회사 상한 도달 · 502 AI 모델 실패 · 500 서버 설정 문제
 *
 * 모델: 서버 목록만 쓴다 (비밀값 AI_MODELS="모델1,모델2", 없으면 recording-analyze와 같은 기본값). 요청의 모델 이름은 무시.
 * 기록·상한: 016_ai_usage.sql — ai_usage_begin()이 상한 확인 + 기록 1줄, 끝나면 결과(ok·모델·토큰·오류)를 고친다.
 * 비밀값: GEMINI_API_KEY (telegram-webhook·recording-analyze와 같은 키)
 * 크기: Supabase는 Edge Function 요청 본문 상한을 숫자로 공개하지 않는다 (공개된 한도: 메모리 256MB, CPU 2초, 응답 대기 150초).
 *       가장 큰 작업(20MB) × base64 1.33배 + 여유 ≈ 27MB까지 받고, 14MB 넘는 파일은 Gemini Files API로 올렸다가 지운다.
 * 시간: 응답 대기 150초 안에 끝나도록 모델 호출 전체를 약 140초로 묶는다.
 * 개인정보: 프롬프트·파일 내용은 기록하지 않는다 (ai_usage_logs에는 작업·크기·토큰·오류만).
 *
 * Deploy: supabase functions deploy ai-proxy --use-api --project-ref cenksfblktflfurxjmtv   (JWT 검증 켬)
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { decodeBase64 } from 'jsr:@std/encoding@1/base64';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const MODELS = (Deno.env.get('AI_MODELS') || 'gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-3-flash-preview')
  .split(',').map((s) => s.trim()).filter(Boolean);
const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

const MB = 1024 * 1024;
const INLINE_MAX_BYTES = 14 * MB;     // Gemini 요청 1건은 20MB까지 (base64는 1.33배) → 넘으면 Files API
const MAX_PROMPT_CHARS = 60_000;
const MAX_SCHEMA_CHARS = 20_000;
const TIME_BUDGET_MS = 140_000;       // Edge Function 응답 대기 한도(150초) 안에서 끝낸다
const MIN_ATTEMPT_MS = 15_000;        // 남은 시간이 이보다 적으면 다음 모델을 시도하지 않는다
const FILE_POLL_MAX_MS = 40_000;      // Files API 처리(PROCESSING) 대기

interface TaskRule {
  maxBytes: number;          // 파일 합계 (디코딩한 바이트)
  maxFiles: number;
  requireFile: boolean;
  mime: RegExp;              // 별칭 정리 후 MIME
  maxOutputTokens: number;
  textFirst: boolean;        // 예전 브라우저 호출과 같은 순서 (녹음 요약 = 글 먼저, 이미지 = 그림 먼저)
}
const IMAGE_MIME = /^image\/(png|jpeg|webp|heic|heif)$/;
const TASKS: Record<string, TaskRule> = {
  case_summary: { maxBytes: 20 * MB, maxFiles: 1, requireFile: true, mime: /^audio\/[a-z0-9.+-]+$/, maxOutputTokens: 32768, textFirst: true },
  image_extract: { maxBytes: 10 * MB, maxFiles: 1, requireFile: true, mime: IMAGE_MIME, maxOutputTokens: 8192, textFirst: false },
  import_ocr: { maxBytes: 15 * MB, maxFiles: 1, requireFile: true, mime: /^(image\/(png|jpeg|webp|heic|heif)|application\/pdf)$/, maxOutputTokens: 8192, textFirst: false },
  receipt_text: { maxBytes: 5 * MB, maxFiles: 1, requireFile: true, mime: IMAGE_MIME, maxOutputTokens: 4096, textFirst: false },
  // 2026-11-02 AI 요약문·대화록 글 → 고객 정보 JSON (파일 없음, 웹 services/aiExtract.ts)
  summary_extract: { maxBytes: 0, maxFiles: 0, requireFile: false, mime: /^$/, maxOutputTokens: 8192, textFirst: true },
};
const MAX_BODY_BYTES = Math.ceil((Math.max(...Object.values(TASKS).map((t) => t.maxBytes)) * 4) / 3) + 512 * 1024;

// 브라우저·폰이 붙이는 MIME 별칭 → Gemini 문서에 있는 이름
const MIME_ALIAS: Record<string, string> = {
  'image/jpg': 'image/jpeg', 'image/pjpeg': 'image/jpeg',
  'audio/x-m4a': 'audio/m4a', 'audio/mp4': 'audio/m4a', 'audio/x-mp4': 'audio/m4a',
  'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/vnd.wave': 'audio/wav',
  'audio/mpeg3': 'audio/mp3', 'audio/x-mpeg-3': 'audio/mp3', 'audio/x-mp3': 'audio/mp3',
  'audio/x-aac': 'audio/aac', 'audio/x-flac': 'audio/flac',
};
const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (status: number, error: string) => json({ error }, status);
const mb = (bytes: number) => `${(bytes / MB).toFixed(1)}MB`;

/** 요청 본문을 상한까지만 읽는다 (넘으면 null) */
async function readBodyCapped(req: Request, cap: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared && declared > cap) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > cap) {
      try { await reader.cancel(); } catch { /* ignore */ }
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
  chunks.length = 0;
  return new TextDecoder().decode(buf);
}

const base64Bytes = (b64: string) => {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
};

interface InFile { mimeType: string; data: string; bytes: number }
interface Valid {
  ok: true; task: string; rule: TaskRule; prompt: string; files: InFile[]; bytes: number;
  responseMimeType?: 'text/plain' | 'application/json'; responseSchema?: Record<string, unknown>; temperature?: number;
}
type Invalid = { ok: false; status: number; error: string };
const bad = (status: number, error: string): Invalid => ({ ok: false, status, error });

function validate(body: any): Valid | Invalid {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad(400, '요청 형식이 올바르지 않습니다');
  const task = typeof body.task === 'string' ? body.task : '';
  const rule = Object.prototype.hasOwnProperty.call(TASKS, task) ? TASKS[task] : undefined;
  if (!rule) return bad(400, '허용되지 않은 AI 작업입니다');

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return bad(400, '요청 내용(prompt)이 비어 있습니다');
  if (prompt.length > MAX_PROMPT_CHARS) return bad(400, `요청 내용이 너무 깁니다 (${prompt.length}자, 최대 ${MAX_PROMPT_CHARS}자)`);

  const rawFiles = body.files ?? [];
  if (!Array.isArray(rawFiles)) return bad(400, '파일 목록 형식이 올바르지 않습니다');
  if (rawFiles.length > rule.maxFiles) return bad(400, `파일은 ${rule.maxFiles}개까지 보낼 수 있습니다`);
  if (rule.requireFile && rawFiles.length === 0) return bad(400, '분석할 파일이 없습니다');

  const files: InFile[] = [];
  let total = 0;
  for (const f of rawFiles) {
    if (!f || typeof f !== 'object') return bad(400, '파일 형식이 올바르지 않습니다');
    let mime = String(f.mimeType || '').toLowerCase().split(';')[0].trim();
    mime = MIME_ALIAS[mime] || mime;
    if (!rule.mime.test(mime)) return bad(400, `지원하지 않는 파일 형식입니다 (${mime || '알 수 없음'})`);
    let data = typeof f.data === 'string' ? f.data : '';
    if (data.startsWith('data:')) data = data.slice(data.indexOf(',') + 1);   // 접두어가 붙어 와도 받아 준다
    if (!data) return bad(400, '파일 내용이 비어 있습니다');
    const bytes = base64Bytes(data);
    total += bytes;
    if (total > rule.maxBytes) return bad(413, `파일이 너무 큽니다 (${mb(total)}, 최대 ${mb(rule.maxBytes)})`);
    if (!B64_RE.test(data)) return bad(400, '파일 내용(base64)이 올바르지 않습니다');
    files.push({ mimeType: mime, data, bytes });
  }

  let responseMimeType: Valid['responseMimeType'];
  if (body.responseMimeType !== undefined && body.responseMimeType !== null) {
    if (body.responseMimeType !== 'text/plain' && body.responseMimeType !== 'application/json') {
      return bad(400, 'responseMimeType은 text/plain 또는 application/json만 됩니다');
    }
    responseMimeType = body.responseMimeType;
  }
  let responseSchema: Valid['responseSchema'];
  if (body.responseSchema !== undefined && body.responseSchema !== null) {
    if (typeof body.responseSchema !== 'object' || Array.isArray(body.responseSchema)) return bad(400, 'responseSchema 형식이 올바르지 않습니다');
    if (responseMimeType !== 'application/json') return bad(400, 'responseSchema는 application/json 응답에서만 쓸 수 있습니다');
    if (JSON.stringify(body.responseSchema).length > MAX_SCHEMA_CHARS) return bad(400, 'responseSchema가 너무 깁니다');
    responseSchema = body.responseSchema;
  }
  let temperature: number | undefined;
  if (body.temperature !== undefined && body.temperature !== null) {
    const t = Number(body.temperature);
    if (!Number.isFinite(t)) return bad(400, 'temperature는 숫자여야 합니다');
    temperature = Math.min(Math.max(t, 0), 2);
  }
  return { ok: true, task, rule, prompt, files, bytes: total, responseMimeType, responseSchema, temperature };
}

const remainingMs = (deadline: number) => Math.max(1_000, deadline - Date.now());

async function geminiUploadFile(bytes: Uint8Array, mime: string, deadline: number): Promise<{ uri: string; name: string }> {
  const start = await fetch(`${GEMINI_BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': GEMINI_API_KEY,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Header-Content-Type': mime,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: `lm-ai-${Date.now()}` } }),
    signal: AbortSignal.timeout(remainingMs(deadline)),
  });
  const url = start.headers.get('x-goog-upload-url');
  await start.body?.cancel().catch(() => {});
  if (!start.ok || !url) throw new Error(`Gemini 파일 업로드 시작 실패 HTTP ${start.status}`);
  const up = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Length': String(bytes.byteLength), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: bytes,
    signal: AbortSignal.timeout(remainingMs(deadline)),
  });
  const j = await up.json().catch(() => ({}));
  if (!up.ok || !j?.file?.uri) throw new Error(`Gemini 파일 업로드 실패 HTTP ${up.status}`);
  let file = j.file;
  const pollUntil = Math.min(Date.now() + FILE_POLL_MAX_MS, deadline - MIN_ATTEMPT_MS);
  while (file?.state === 'PROCESSING' && Date.now() < pollUntil) {
    await new Promise((r) => setTimeout(r, 2000));
    const g = await fetch(`${GEMINI_BASE}/v1beta/${file.name}`, {
      headers: { 'x-goog-api-key': GEMINI_API_KEY }, signal: AbortSignal.timeout(remainingMs(deadline)),
    });
    file = await g.json().catch(() => file);
  }
  if (file?.state && file.state !== 'ACTIVE') {
    await geminiDeleteFile(file.name);
    throw new Error(`Gemini 파일 처리 실패 (${file.state})`);
  }
  return { uri: file.uri, name: file.name };
}

async function geminiDeleteFile(name: string) {
  if (!name) return;
  await fetch(`${GEMINI_BASE}/v1beta/${name}`, { method: 'DELETE', headers: { 'x-goog-api-key': GEMINI_API_KEY } })
    .then((r) => r.body?.cancel())
    .catch(() => {});
}

interface GenOk { ok: true; text: string; model: string; input: number; output: number }
interface GenFail { ok: false; error: string; model: string | null; input: number; output: number; timedOut: boolean }

/** 서버 모델 목록을 차례로 시도 (모델 없음·과부하·빈 응답이면 다음 모델, 키·요청 오류는 바로 중단) */
async function generate(v: Valid, parts: unknown[], deadline: number): Promise<GenOk | GenFail> {
  const generationConfig: Record<string, unknown> = { maxOutputTokens: v.rule.maxOutputTokens };
  if (v.responseMimeType) generationConfig.responseMimeType = v.responseMimeType;
  if (v.responseSchema) generationConfig.responseSchema = v.responseSchema;
  if (typeof v.temperature === 'number') generationConfig.temperature = v.temperature;
  const payload = JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig });

  let lastErr = '';
  let lastModel: string | null = null;
  let input = 0;
  let output = 0;
  for (const model of MODELS) {
    const left = deadline - Date.now();
    if (left < MIN_ATTEMPT_MS) return { ok: false, error: lastErr || '시간 부족', model: lastModel, input, output, timedOut: true };
    lastModel = model;
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(left),
      });
    } catch (e) {
      const name = (e as Error)?.name || '';
      if (name === 'TimeoutError' || name === 'AbortError') {
        return { ok: false, error: `${model}: 응답 시간 초과`, model, input, output, timedOut: true };
      }
      lastErr = `${model}: 연결 실패 ${String((e as Error)?.message || e).slice(0, 120)}`;
      continue;
    }
    let j: any = {};
    try { j = await res.json(); } catch (e) {
      const name = (e as Error)?.name || '';
      if (name === 'TimeoutError' || name === 'AbortError') {
        return { ok: false, error: `${model}: 응답 시간 초과`, model, input, output, timedOut: true };
      }
    }
    const u = j?.usageMetadata || {};
    input += Number(u.promptTokenCount || 0);
    output += Number(u.candidatesTokenCount || 0) + Number(u.thoughtsTokenCount || 0);
    if (!res.ok) {
      lastErr = `${model}: HTTP ${res.status} ${String(j?.error?.message || '').slice(0, 200)}`;
      if ([404, 408, 429, 500, 502, 503, 504].includes(res.status) || /not found|not supported/i.test(lastErr)) continue;
      return { ok: false, error: lastErr, model, input, output, timedOut: false };
    }
    const cand = j?.candidates?.[0];
    const text = (cand?.content?.parts || []).filter((p: any) => !p?.thought).map((p: any) => p?.text || '').join('');
    if (!text.trim()) { lastErr = `${model}: 빈 응답 (${cand?.finishReason || j?.promptFeedback?.blockReason || '?'})`; continue; }
    if (v.responseMimeType === 'application/json') {
      try { JSON.parse(text); } catch { lastErr = `${model}: JSON 해석 실패 (${cand?.finishReason || ''})`; continue; }
    }
    return { ok: true, text, model, input, output };
  }
  return { ok: false, error: lastErr || 'AI 모델 호출 실패', model: lastModel, input, output, timedOut: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail(405, 'POST만 받습니다');
  const deadline = Date.now() + TIME_BUDGET_MS;

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return fail(401, '로그인이 필요합니다');
  if (!GEMINI_API_KEY) return fail(500, '서버에 AI 키가 설정되지 않았습니다');

  // 1. 사용자·회사 확인 (본문을 읽기 전에 → 로그인 안 한 큰 요청은 바로 거절)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return fail(401, '로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요');
  const { data: orgId, error: orgError } = await userClient.rpc('current_org_id');
  if (orgError) {
    console.error('[ai-proxy] current_org_id', orgError.message);
    return fail(500, '소속 회사를 확인하지 못했습니다');
  }
  // current_org_id()는 사용 중지된 회사·계정이면 NULL
  if (!orgId) return fail(403, '소속 회사가 없거나 사용 중지된 계정입니다');

  // 2. 본문 읽기 + 검사
  let raw = await readBodyCapped(req, MAX_BODY_BYTES).catch(() => '');
  if (raw === null) return fail(413, `요청이 너무 큽니다 (최대 약 ${Math.floor(MAX_BODY_BYTES / MB)}MB)`);
  let body: unknown;
  try { body = JSON.parse(raw || ''); } catch { return fail(400, '요청 형식이 올바르지 않습니다 (JSON)'); }
  raw = '';
  const v = validate(body);
  body = null;
  if (!v.ok) return fail(v.status, v.error);

  // 3. 회사 하루 상한 확인 + 기록 1줄 (한국 시간 0시 기준, 016 ai_usage_begin)
  const { data: begin, error: beginErr } = await admin.rpc('ai_usage_begin', {
    p_org_id: orgId, p_user_id: user.id, p_task: v.task, p_bytes_in: v.bytes,
  });
  if (beginErr || !begin) {
    console.error('[ai-proxy] ai_usage_begin', beginErr?.message);
    return fail(500, 'AI 사용량을 기록하지 못했습니다 (서버 업데이트 016 필요)');
  }
  if (!begin.allowed) {
    return fail(429, Number(begin.cap) === 0
      ? '이 회사는 AI 사용이 꺼져 있습니다. 관리자에게 문의하세요'
      : `오늘 AI 사용 한도(${begin.cap}회)를 넘었습니다. 관리자에게 문의하세요`);
  }
  const logId: string = begin.id;

  // 4. Gemini 호출 (14MB 넘는 파일은 Files API → 끝나면 지움)
  const uploaded: string[] = [];
  let out: GenOk | GenFail;
  try {
    const fileParts: unknown[] = [];
    let inlineLeft = INLINE_MAX_BYTES;
    for (const f of v.files) {
      if (f.bytes <= inlineLeft) {
        fileParts.push({ inline_data: { mime_type: f.mimeType, data: f.data } });
        inlineLeft -= f.bytes;
      } else {
        const up = await geminiUploadFile(decodeBase64(f.data), f.mimeType, deadline);
        uploaded.push(up.name);
        fileParts.push({ file_data: { mime_type: f.mimeType, file_uri: up.uri } });
      }
    }
    const textPart = { text: v.prompt };
    out = await generate(v, v.rule.textFirst ? [textPart, ...fileParts] : [...fileParts, textPart], deadline);
  } catch (e) {
    const name = (e as Error)?.name || '';
    const timedOut = name === 'TimeoutError' || name === 'AbortError';
    out = { ok: false, error: timedOut ? '파일 올리기 시간 초과' : String((e as Error)?.message || e).slice(0, 300), model: null, input: 0, output: 0, timedOut };
  } finally {
    for (const n of uploaded) await geminiDeleteFile(n);
  }

  // 5. 결과 기록 (실패해도 응답은 보낸다)
  const { error: logErr } = await admin.from('ai_usage_logs').update({
    ok: out.ok,
    model: out.model,
    input_tokens: out.input,
    output_tokens: out.output,
    error: out.ok ? null : out.error.slice(0, 500),
  }).eq('id', logId);
  if (logErr) console.error('[ai-proxy] log update', logErr.message);

  if (!out.ok) {
    console.error('[ai-proxy] fail', v.task, out.error);
    return fail(502, out.timedOut
      ? 'AI 응답이 너무 오래 걸려 중단했습니다. 더 짧은 파일로 다시 시도해 주세요'
      : `AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요 (${out.error.slice(0, 200)})`);
  }
  return json({ text: out.text, model: out.model, usage: { input: out.input, output: out.output } });
});
