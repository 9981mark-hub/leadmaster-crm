import { decodeBase64 } from 'jsr:@std/encoding@1/base64';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';

// PCM 24kHz Mono 16-bit to WAV 변환 헬퍼
function pcmToWav(pcmBytes: Uint8Array, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Uint8Array {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBytes.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF Chunk
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt Subchunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);          // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);           // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data Subchunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);

  // Copy PCM data
  new Uint8Array(buffer, 44).set(pcmBytes);
  return new Uint8Array(buffer);
}

Deno.serve(async (req) => {
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
    const { text, voice = 'Puck', gender = 'male' } = body;

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const cleanText = text
      .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
      .replace(/[\.\.\.~"']/g, ' ')
      .replace(/^(네|아|예|저|음|여보세요),/g, '$1')
      .replace(/,\s*,/g, ',')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      return new Response(JSON.stringify({ error: 'Empty text' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 보이스 선택: 남성은 Fenrir/Puck, 여성은 Aoede/Kore
    let selectedVoice = 'Aoede';
    if (gender === 'male' || voice.toLowerCase().includes('male') || voice.includes('InJoon') || voice.includes('Neural2-C')) {
      selectedVoice = 'Fenrir';
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = `당신은 전화 통화 중인 고객입니다. 다음 대사를 실제 사람이 전화 수화기로 말하듯이 자연스러운 한국어 구어체와 감정을 담아 말하세요: "${cleanText}"`;

    const gRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: selectedVoice,
              },
            },
          },
        },
      }),
    });

    if (!gRes.ok) {
      const errText = await gRes.text().catch(() => '');
      console.error('Gemini Audio error:', gRes.status, errText);
      return new Response(JSON.stringify({ error: `Gemini audio error ${gRes.status}`, details: errText }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const data = await gRes.json();
    const candidate = data?.candidates?.[0];
    const audioPart = candidate?.content?.parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('audio/'));

    if (!audioPart || !audioPart.inlineData?.data) {
      return new Response(JSON.stringify({ error: 'No audio part', data }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const rawPcm = decodeBase64(audioPart.inlineData.data);
    const mime = audioPart.inlineData.mimeType || 'audio/pcm';

    // audio/pcm일 경우 브라우저 호환을 위해 표준 WAV 헤더 결합
    let outputBytes: Uint8Array = rawPcm;
    let outputMime = 'audio/wav';

    if (mime.includes('pcm') || mime.includes('L16') || !mime.includes('wav')) {
      // Gemini 2.0 Flash 오디오 기본 규격: 24,000Hz 1채널 16-bit PCM
      outputBytes = pcmToWav(rawPcm, 24000, 1, 16);
    } else {
      outputMime = mime;
    }

    return new Response(outputBytes, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': outputMime,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    console.error('TTS execution failed:', err);
    return new Response(JSON.stringify({ error: err.message || 'TTS failed' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
