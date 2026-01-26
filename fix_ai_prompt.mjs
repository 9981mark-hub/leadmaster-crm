// Fix AI Prompt Setting
const SUPABASE_URL = 'https://cenksfblktflfurxjmtv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbmtzZmJsa3RmbGZ1cnhqbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzcyNTksImV4cCI6MjA4NDk1MzI1OX0.CNXTi73sjRem7FJqEMHZMxkwcpwagU3xzPpFELrUYRw';

const aiPrompt = `당신은 법률 사무소의 전문 상담원 보조 AI입니다.
업로드된 통화 녹음 파일을 분석하여 다음 핵심 내용을 요약해주세요.

1. 고객 상황 (채무, 소득, 재산 등)
2. 주요 상담 내용 (질문 및 답변)
3. 향후 계획 및 조치
4. 특이사항

[작성 규칙]
- "## 요약" 같은 제목(헤더)을 절대 넣지 마세요. 본문만 바로 작성하세요.
- 별표(*)나 마크다운 볼드체(**)를 절대 사용하지 마세요. (AI 티가 나지 않게 하세요)
- 목록 나열이 필요하면 하이픈(-)을 사용하세요.
- 말투는 간결하고 명확한 '해요체'를 사용하세요.
- 사람이 직접 작성한 상담 메모처럼 자연스럽게 작성하세요.`;

async function main() {
    // Delete existing
    await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.aiPrompt`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });

    // Insert new
    const res = await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key: 'aiPrompt', value: aiPrompt })
    });

    if (res.ok) {
        console.log('✅ AI 프롬프트 저장됨');
    } else {
        console.log('❌ 오류:', await res.text());
    }
}

main();
