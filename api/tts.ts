import type { IncomingMessage, ServerResponse } from 'http';
import { EdgeTTS } from 'node-edge-tts';

interface VercelReq extends IncomingMessage {
  body?: any;
  query?: Record<string, string>;
  method?: string;
}

interface VercelRes extends ServerResponse {
  status: (code: number) => VercelRes;
  json: (body: any) => void;
  send: (body: any) => void;
}

export default async function handler(req: any, res: any) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }
    let { text, voice = 'ko-KR-InJoonNeural', rate = '+10%', pitch = 'default' } = body || {};

    // Google ID가 들어올 경우 Edge Neural Voice ID로 상호 호환 매핑
    const VOICE_MAP: Record<string, string> = {
      'ko-KR-Neural2-C': 'ko-KR-InJoonNeural',
      'ko-KR-Neural2-A': 'ko-KR-SunHiNeural',
      'ko-KR-Neural2-B': 'ko-KR-SunHiNeural',
      'ko-KR-Wavenet-C': 'ko-KR-InJoonNeural',
      'ko-KR-Wavenet-D': 'ko-KR-HyunsuMultilingualNeural',
    };
    if (VOICE_MAP[voice]) {
      voice = VOICE_MAP[voice];
    }

    if (!text || typeof text !== 'string') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Text is required' }));
      return;
    }

    // 괄호 지문 및 불필요한 부호 정제
    const cleanText = text
      .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
      .replace(/[\.\.\.~"']/g, ' ')
      .replace(/^(네|아|예|저|음|여보세요),/g, '$1')
      .replace(/,\s*,/g, ',')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Empty text after cleaning' }));
      return;
    }

    const tts = new EdgeTTS({
      voice,
      lang: 'ko-KR',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      rate: typeof rate === 'string' ? rate : '+10%',
      pitch: typeof pitch === 'string' ? pitch : 'default',
      timeout: 10000,
    });

    const chunks: Buffer[] = [];
    for await (const chunk of tts.streamAudio(cleanText)) {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      }
    }

    if (chunks.length === 0) {
      throw new Error('No audio data received from Edge TTS');
    }

    const fullBuffer = Buffer.concat(chunks);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(fullBuffer);
  } catch (err: any) {
    console.error('Edge TTS error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'TTS generation failed' }));
  }
}
