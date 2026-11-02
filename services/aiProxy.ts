// ============================================
// AI 호출 = 서버 Edge Function ai-proxy 경유 (2026-11-01)
// 브라우저에는 AI 키가 없다. Gemini 키는 서버 비밀값(GEMINI_API_KEY)에만 있다.
// - 로그인한 회사 멤버만 쓸 수 있다 (상담원 포함). 키 입력 필요 없음.
// - 회사별 하루 상한(기본 300회, org_ai_settings.daily_cap). 넘으면 429.
// - 모델은 서버가 고른다 (비밀값 AI_MODELS). 화면에서 모델을 고르지 않는다.
// DB: supabase/migrations/016_ai_usage.sql · 함수: supabase/functions/ai-proxy
// ============================================
import { supabase } from './supabase';

export type AiTask = 'case_summary' | 'image_extract' | 'import_ocr' | 'receipt_text' | 'summary_extract';

export interface AiFile {
  mimeType: string;
  /** base64 (data: 접두어 없이) */
  data: string;
}

export interface AiRequest {
  task: AiTask;
  prompt: string;
  files?: AiFile[];
  responseMimeType?: 'text/plain' | 'application/json';
  responseSchema?: Record<string, unknown>;
  temperature?: number;
}

export interface AiResponse {
  text: string;
  model: string;
  usage: { input: number; output: number };
}

export interface AiUsage {
  today: number;
  cap: number;
  month: number;
  inputTokensMonth: number;
  outputTokensMonth: number;
}

const MB = 1024 * 1024;

/**
 * 작업별 파일 크기 상한 (서버 ai-proxy의 TASKS와 같게 유지).
 * Supabase는 Edge Function 요청 본문 상한을 숫자로 공개하지 않는다 (공개 한도: 메모리 256MB, CPU 2초, 응답 대기 150초).
 * 파일은 base64로 보내 1.33배가 되므로 녹음 20MB ≈ 요청 27MB. 서버는 이보다 큰 요청을 413으로 거절한다.
 */
export const AI_MAX_FILE_BYTES: Record<AiTask, number> = {
  case_summary: 20 * MB,
  image_extract: 10 * MB,
  import_ocr: 15 * MB,
  receipt_text: 5 * MB,
  summary_extract: 0,   // 글만 보냄 (파일 없음)
};

/** 브라우저가 기다리는 최대 시간 (서버는 약 140초 안에 끝내고, 응답 대기 한도는 150초) */
const CLIENT_TIMEOUT_MS = 180_000;

export class AiProxyError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AiProxyError';
    this.status = status;
  }
}

export const formatMB = (bytes: number) => `${(bytes / MB).toFixed(1)}MB`;

/** base64 문자열이 나타내는 실제 바이트 수 */
export const base64ByteLength = (b64: string): number => {
  if (!b64) return 0;
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
};

/** 보내기 전에 파일 크기 확인. 문제 없으면 null, 크면 화면에 보일 문구 */
export const checkAiFileSize = (task: AiTask, bytes: number): string | null => {
  const max = AI_MAX_FILE_BYTES[task];
  if (bytes <= max) return null;
  if (task === 'case_summary') {
    return `녹음 파일이 너무 큽니다 (${formatMB(bytes)}). AI 요약은 ${formatMB(max)}까지 가능합니다. 더 짧은 녹음으로 나눠 올려 주세요.`;
  }
  return `파일이 너무 큽니다 (${formatMB(bytes)}). AI 분석은 ${formatMB(max)} 이하 파일만 가능합니다.`;
};

const STATUS_MESSAGE: Record<number, string> = {
  401: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  403: 'AI를 쓸 수 없는 계정입니다 (소속 회사가 없거나 사용 중지된 계정).',
  404: 'AI 서버 기능(ai-proxy)이 아직 배포되지 않았습니다. 관리자에게 문의하세요.',
  413: '파일이 너무 큽니다. 더 작은 파일로 다시 시도해 주세요.',
  429: '오늘 AI 사용 한도를 넘었습니다. 관리자에게 문의하세요.',
  502: 'AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.',
  504: 'AI 응답이 너무 오래 걸려 끊겼습니다. 더 짧은 파일로 다시 시도해 주세요.',
  546: 'AI 서버 처리 한도를 넘었습니다. 더 작은 파일로 다시 시도해 주세요.',
};

/** supabase.functions.invoke 오류 → 짧은 한국어 문구 */
const toAiError = async (error: any): Promise<AiProxyError> => {
  const ctx = error?.context;
  if (error?.name === 'FunctionsFetchError') {
    const cause = ctx?.name || '';
    if (cause === 'AbortError' || cause === 'TimeoutError') return new AiProxyError(STATUS_MESSAGE[504], 504);
    return new AiProxyError('네트워크 오류로 AI 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.');
  }
  const status: number | undefined = typeof ctx?.status === 'number' ? ctx.status : undefined;
  let serverMsg = '';
  try {
    const b = await ctx?.json?.();
    if (b && typeof b.error === 'string') serverMsg = b.error;
  } catch { /* 본문이 JSON이 아님 */ }
  if (error?.name === 'FunctionsRelayError') {
    return new AiProxyError('AI 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', status);
  }
  if (status === 429) return new AiProxyError(STATUS_MESSAGE[429], 429);   // 하루 상한: 문구 고정
  if (status === 401) return new AiProxyError(STATUS_MESSAGE[401], 401);
  if (status && serverMsg && [400, 403, 413, 500, 502].includes(status)) {
    return new AiProxyError(serverMsg.endsWith('.') ? serverMsg : `${serverMsg}.`, status);
  }
  if (status && STATUS_MESSAGE[status]) return new AiProxyError(STATUS_MESSAGE[status], status);
  return new AiProxyError(serverMsg || 'AI 서버 오류입니다. 잠시 후 다시 시도해 주세요.', status);
};

/** 서버 AI 호출. 실패하면 AiProxyError(한국어 message, status) */
export const callAi = async (req: AiRequest): Promise<AiResponse> => {
  if (!supabase) throw new AiProxyError('서버 연결이 설정되지 않아 AI를 쓸 수 없습니다.');
  const bytes = (req.files || []).reduce((sum, f) => sum + base64ByteLength(f.data), 0);
  const sizeError = checkAiFileSize(req.task, bytes);
  if (sizeError) throw new AiProxyError(sizeError, 413);

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) throw new AiProxyError(STATUS_MESSAGE[401], 401);

  const { data, error } = await supabase.functions.invoke('ai-proxy', { body: req, timeout: CLIENT_TIMEOUT_MS });
  if (error) throw await toAiError(error);
  if (!data || typeof data.text !== 'string') {
    throw new AiProxyError((data && typeof data.error === 'string' && data.error) || 'AI 응답이 비어 있습니다.', 502);
  }
  return {
    text: data.text,
    model: String(data.model || ''),
    usage: { input: Number(data.usage?.input || 0), output: Number(data.usage?.output || 0) },
  };
};

/** 관리자용: 오늘 사용 횟수·상한, 이번 달 횟수·토큰 (016 get_ai_usage). 관리자가 아니거나 016 전이면 오류 */
export const fetchAiUsage = async (): Promise<AiUsage> => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다');
  const { data, error } = await supabase.rpc('get_ai_usage');
  if (error) throw new Error(error.message);
  const u: any = data || {};
  return {
    today: Number(u.today || 0),
    cap: Number(u.cap ?? 300),
    month: Number(u.month || 0),
    inputTokensMonth: Number(u.input_tokens_month || 0),
    outputTokensMonth: Number(u.output_tokens_month || 0),
  };
};

// 예전에 브라우저에 저장하던 AI 키·모델 값 지우기 (키는 이제 서버에만 있다).
// lm_geminiApiKey는 services/api.ts가 설정을 읽을 때 다시 쓰므로, 그 코드를 지운 뒤부터 완전히 사라진다.
try {
  if (typeof localStorage !== 'undefined') {
    ['google_api_key', 'lm_geminiApiKey', 'lm_geminiModel'].forEach((k) => localStorage.removeItem(k));
  }
} catch { /* 저장소 접근 불가 → 무시 */ }
