import type { IncomingMessage, ServerResponse } from 'http';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// 허용 오리진 화이트리스트 (서비스 도메인 및 로컬 개발 환경)
const ALLOWED_ORIGINS = [
  'https://www.lmaster.xyz',
  'https://lmaster.xyz',
  'https://leadmastercrm.vercel.app',
  'https://9981mark-hub.github.io',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // 동일 오리진 서버 호출/네이티브 앱 등 Origin 미포함 요청
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  return false;
}

function buildCorsHeaders(origin: string | undefined): Record<string, string> {
  const allowOrigin = origin && isAllowedOrigin(origin) ? origin : 'https://www.lmaster.xyz';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

async function verifySupabaseAuth(req: IncomingMessage): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return true; // 환경변수 미설정 환경 하위 호환

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return false;

  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: authHeader,
        apikey: supabaseAnonKey,
      },
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// 요청 바디 파서 헬퍼
async function parseBody(req: IncomingMessage): Promise<any> {
  if ((req as any).body) return (req as any).body;
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (_) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  const CORS_HEADERS = buildCorsHeaders(origin);

  // 허용되지 않은 외부 도메인 차단
  if (origin && !isAllowedOrigin(origin)) {
    res.writeHead(403, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden origin' }));
    return;
  }

  // CORS 사전 비행 요청 처리
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
    return;
  }

  // 로그인 사용자 JWT 검증
  const isAuthed = await verifySupabaseAuth(req);
  if (!isAuthed) {
    res.writeHead(401, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  try {
    const body = await parseBody(req);
    const { text, voice = 'ko-KR-InJoonNeural', rate = '+0%', pitch = '+0Hz', gender = 'male' } = body || {};

    if (!text || typeof text !== 'string') {
      res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Text is required.' }));
      return;
    }

    const cleanText = text
      .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
      .replace(/[\.\.\.~"']/g, ' ')
      .replace(/^(네|아|예|저|음|여보세요),/g, '$1')
      .replace(/,\s*,/g, ',')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Text cannot be empty.' }));
      return;
    }

    // 보이스 선택 (MS Edge-TTS 지원 성우만 허용하며, 구글 Wavenet/Neural2 등 레거시 성우명은 자동 매핑)
    const VALID_EDGE_VOICES = ['ko-KR-InJoonNeural', 'ko-KR-SunHiNeural', 'ko-KR-HyunsuMultilingualNeural'];
    let selectedVoice = voice;
    if (!selectedVoice || !VALID_EDGE_VOICES.includes(selectedVoice)) {
      if (gender === 'female' || (typeof selectedVoice === 'string' && (selectedVoice.includes('SunHi') || selectedVoice.includes('Neural2-A') || selectedVoice.includes('Wavenet-A') || selectedVoice.includes('Wavenet-B')))) {
        selectedVoice = 'ko-KR-SunHiNeural';
      } else if (typeof selectedVoice === 'string' && selectedVoice.includes('Hyunsu')) {
        selectedVoice = 'ko-KR-HyunsuMultilingualNeural';
      } else {
        selectedVoice = 'ko-KR-InJoonNeural';
      }
    }

    const tts = new MsEdgeTTS();
    await tts.setMetadata(selectedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(cleanText, {
      rate: typeof rate === 'string' ? rate : `${rate > 0 ? '+' : ''}${Math.round(rate)}%`,
      pitch: typeof pitch === 'string' ? pitch : `${pitch > 0 ? '+' : ''}${Math.round(pitch)}Hz`,
    });

    const chunks: Buffer[] = [];
    audioStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    audioStream.on('end', () => {
      const audioBuffer = Buffer.concat(chunks);
      res.writeHead(200, {
        ...CORS_HEADERS,
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(audioBuffer);
    });

    audioStream.on('error', (err: any) => {
      console.error('Edge-TTS stream error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'TTS synthesis stream error', details: String(err) }));
      }
    });

  } catch (err: any) {
    console.error('Edge-TTS handler error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error in Edge-TTS handler', details: String(err) }));
    }
  }
}
