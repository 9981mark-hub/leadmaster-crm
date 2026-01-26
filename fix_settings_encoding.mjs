// Fix Korean encoding for settings
const SUPABASE_URL = 'https://cenksfblktflfurxjmtv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbmtzZmJsa3RmbGZ1cnhqbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzcyNTksImV4cCI6MjA4NDk1MzI1OX0.CNXTi73sjRem7FJqEMHZMxkwcpwagU3xzPpFELrUYRw';

async function saveSettings(key, value) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.${key}`, {
        method: 'DELETE',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
    });

    const res2 = await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ key, value })
    });

    if (res2.ok) {
        console.log(`✅ ${key} 저장됨`);
    } else {
        console.log(`❌ ${key} 오류:`, await res2.text());
    }
}

async function main() {
    console.log('🔧 설정 인코딩 수정 중...\n');

    // 상태 관리
    await saveSettings('statusStages', [
        '신규접수', '부재', '재통화 예정', '진행불가', '고객취소',
        '장기관리중', '상담중', '사무장 접수', '계약 완료',
        '1차 입금완료', '2차 입금완료'
    ]);

    // 2차 상태 관리
    await saveSettings('secondaryStatuses', [
        '서류 검토중', '서류 보완 요청', '서류 접수 완료', '법원 제출 완료',
        '개시 결정', '인가 결정', '변제 진행중', '변제 완료'
    ]);

    console.log('\n✅ 완료!');
}

main().catch(console.error);
