import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { decodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Google Cloud Text-to-Speech API Key
const GOOGLE_TTS_API_KEY = Deno.env.get('GOOGLE_TTS_API_KEY') || 'AIzaSyDawRS__NWpBQkw5v1TzyZ6wUEDQQv92XE';

// 보이스 ID 매핑 (기존 Edge TTS ID 및 Google Neural2/Wavenet ID 모두 지원)
const VOICE_MAP: Record<string, string> = {
  'ko-KR-InJoonNeural': 'ko-KR-Neural2-C',          // 40대 남성 (온순/차분)
  'ko-KR-SunHiNeural': 'ko-KR-Neural2-A',           // 30대 여성 (바쁨/명랑)
  'ko-KR-HyunsuMultilingualNeural': 'ko-KR-Wavenet-C', // 50대 남성 (의심/중후)
  'ko-KR-Neural2-A': 'ko-KR-Neural2-A',
  'ko-KR-Neural2-B': 'ko-KR-Neural2-B',
  'ko-KR-Neural2-C': 'ko-KR-Neural2-C',
  'ko-KR-Wavenet-A': 'ko-KR-Wavenet-A',
  'ko-KR-Wavenet-B': 'ko-KR-Wavenet-B',
  'ko-KR-Wavenet-C': 'ko-KR-Wavenet-C',
  'ko-KR-Wavenet-D': 'ko-KR-Wavenet-D',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { text, voice = 'ko-KR-Neural2-C', rate = '+10%', pitch = 'default', apiKey = GOOGLE_TTS_API_KEY } = body;

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 괄호 지문, 특수부호 정제
    const cleanText = text
      .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
      .replace(/[\.\.\.~"']/g, ' ')
      .replace(/^(네|아|예|저|음|여보세요),/g, '$1')
      .replace(/,\s*,/g, ',')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      return new Response(JSON.stringify({ error: 'Empty text after cleaning' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 발화 속도 계산 (+10% -> 1.10, +0% -> 1.0, 1.25 -> 1.25)
    let speakingRate = 1.1;
    if (typeof rate === 'number') {
      speakingRate = Math.min(Math.max(rate, 0.5), 2.0);
    } else if (typeof rate === 'string') {
      const match = rate.match(/^([+-]?\d+)%/);
      if (match) {
        const percent = parseInt(match[1], 10);
        speakingRate = 1.0 + percent / 100;
      }
    }

    // 피치 계산
    let pitchVal = 0.0;
    if (typeof pitch === 'number') {
      pitchVal = Math.min(Math.max(pitch, -20.0), 20.0);
    } else if (typeof pitch === 'string') {
      const match = pitch.match(/^([+-]?\d+)(Hz|st)?/);
      if (match) {
        pitchVal = parseFloat(match[1]);
      }
    }

    const selectedVoice = VOICE_MAP[voice] || (voice.startsWith('ko-KR-') ? voice : 'ko-KR-Neural2-C');

    // Google Cloud Text-to-Speech API 호출
    const googleTtsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
    const ttsRes = await fetch(googleTtsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: cleanText },
        voice: {
          languageCode: 'ko-KR',
          name: selectedVoice,
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate,
          pitch: pitchVal,
        },
      }),
    });

    if (!ttsRes.ok) {
      const errJson = await ttsRes.json().catch(() => ({}));
      const errMsg = errJson?.error?.message || `Google TTS error HTTP ${ttsRes.status}`;

      // API 비활성화(403) 시 구체적인 활성화 URL 전달
      if (ttsRes.status === 403 || errMsg.includes('Cloud Text-to-Speech API has not been used') || errMsg.includes('disabled')) {
        return new Response(JSON.stringify({
          error: 'GOOGLE_TTS_DISABLED',
          message: 'Google Cloud Text-to-Speech API 활성화가 필요합니다.',
          activationUrl: 'https://console.developers.google.com/apis/api/texttospeech.googleapis.com/overview?project=703402707746',
        }), {
          status: 403,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: errMsg }), {
        status: ttsRes.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const ttsData = await ttsRes.json();
    if (!ttsData.audioContent) {
      throw new Error('No audioContent in Google TTS response');
    }

    const audioBytes = decodeBase64(ttsData.audioContent);

    return new Response(audioBytes, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    console.error('TTS execution failed:', err);
    return new Response(JSON.stringify({ error: err.message || 'TTS execution failed' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
