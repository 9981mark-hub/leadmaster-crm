import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { EdgeTTS } from 'npm:node-edge-tts';
import { Buffer } from 'node:buffer';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const body = await req.json();
    const { text, voice = 'ko-KR-InJoonNeural', rate = 'default', pitch = 'default' } = body;

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
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      return new Response(JSON.stringify({ error: 'Empty text after cleaning' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const tts = new EdgeTTS({
      voice,
      lang: 'ko-KR',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      rate: rate || 'default',
      pitch: pitch || 'default',
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

    return new Response(fullBuffer, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    console.error('Edge TTS synthesis failed:', err);
    return new Response(JSON.stringify({ error: err.message || 'TTS synthesis failed' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
