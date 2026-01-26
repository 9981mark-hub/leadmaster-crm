// Migrate Settings to Supabase
// Run with: node migrate_settings.mjs

const SUPABASE_URL = 'https://cenksfblktflfurxjmtv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbmtzZmJsa3RmbGZ1cnhqbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzcyNTksImV4cCI6MjA4NDk1MzI1OX0.CNXTi73sjRem7FJqEMHZMxkwcpwagU3xzPpFELrUYRw';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv68G12Kd0g8RThZGpXToV2m_PjN7IsaBXwzDkPvA1TqsgFTIjQFuuC0G0_Xitsxm8/exec';

async function main() {
    console.log('🚀 설정 마이그레이션 시작...\n');

    // 1. Google Sheets에서 설정 가져오기
    console.log('📊 Google Sheets에서 설정 가져오는 중...');
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?type=settings&_t=${Date.now()}`);
    const settings = await response.json();

    console.log('가져온 설정:', JSON.stringify(settings, null, 2));

    // 2. Supabase에 설정 저장
    const settingsToSave = [
        { key: 'inboundPaths', value: settings.inboundPaths || [] },
        { key: 'statusStages', value: settings.statusStages || [] },
        { key: 'secondaryStatuses', value: settings.secondaryStatuses || [] },
        { key: 'partners', value: settings.partners || [] },
        { key: 'emailSettings', value: settings.emailSettings || {} },
        { key: 'managers', value: settings.managers || [] },
        { key: 'specialMemoStamps', value: settings.specialMemoStamps || [] }
    ];

    for (const setting of settingsToSave) {
        if (setting.value && (Array.isArray(setting.value) ? setting.value.length > 0 : Object.keys(setting.value).length > 0)) {
            console.log(`\n저장 중: ${setting.key}`);

            const res = await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates,return=minimal'
                },
                body: JSON.stringify({
                    key: setting.key,
                    value: setting.value
                })
            });

            if (res.ok) {
                console.log(`  ✅ ${setting.key} 저장됨`);
            } else {
                const error = await res.text();
                console.log(`  ❌ ${setting.key} 오류:`, error);
            }
        }
    }

    console.log('\n=============================');
    console.log('✅ 설정 마이그레이션 완료!');
    console.log('=============================');
}

main().catch(console.error);
