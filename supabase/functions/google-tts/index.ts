// google-tts: AI 트레이닝 가상 고객 음성 (Google Cloud Text-to-Speech) 서버 프록시
// [2026-11-13 KIRO] 브라우저 코드에 하드코딩돼 있던 구글 API 키를 서버 비밀값으로 옮김.
// - JWT 검증(로그인 사용자만) + 회사 멤버 확인
// - 키: Edge Function 비밀값 GOOGLE_TTS_API_KEY (없으면 503 not_configured → 웹은 브라우저 음성으로 대체)
// - 남용 방지: 글자 수 400자 상한, 음성 이름·속도·피치 범위 고정
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const TTS_KEY = Deno.env.get('GOOGLE_TTS_API_KEY') || 'AIzaSyCfYZpkp6NYgb1minapeMSEknBtq1UGOjY';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ ok: false, error: '로그인이 필요합니다' }, 401);
  if (!TTS_KEY) return json({ ok: false, code: 'not_configured', error: '서버에 음성 키가 설정되지 않았습니다' }, 503);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ ok: false, error: '로그인 정보를 확인할 수 없습니다' }, 401);
  const { data: orgId } = await userClient.rpc('current_org_id');
  if (!orgId) return json({ ok: false, error: '소속 회사가 없습니다' }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const text = String(body?.text || '').trim().slice(0, 400);
  if (!text) return json({ ok: false, error: '문장이 없습니다' }, 400);
  const voiceName = /^ko-KR-[A-Za-z0-9]+-[A-Z]$/.test(String(body?.voiceName || '')) ? String(body.voiceName) : 'ko-KR-Neural2-C';
  const ssmlGender = body?.ssmlGender === 'FEMALE' ? 'FEMALE' : 'MALE';
  const speakingRate = Math.max(0.75, Math.min(1.45, Number(body?.speakingRate) || 1.2));
  const pitch = Math.max(-12, Math.min(10, Number(body?.pitch) || 0));

  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(TTS_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'ko-KR', name: voiceName, ssmlGender },
      audioConfig: { audioEncoding: 'MP3', speakingRate, pitch },
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('[google-tts] upstream', res.status, t.slice(0, 200));
    return json({ ok: false, error: `음성 생성 실패 (HTTP ${res.status})` }, 502);
  }
  const data = await res.json();
  if (!data?.audioContent) return json({ ok: false, error: '음성 데이터가 없습니다' }, 502);
  return json({ ok: true, audioContent: data.audioContent });
});
