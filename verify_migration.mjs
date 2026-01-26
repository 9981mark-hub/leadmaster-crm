// Migration Verification Script
// Compares Google Sheets data with Supabase to find missing items

const SUPABASE_URL = 'https://cenksfblktflfurxjmtv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbmtzZmJsa3RmbGZ1cnhqbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzcyNTksImV4cCI6MjA4NDk1MzI1OX0.CNXTi73sjRem7FJqEMHZMxkwcpwagU3xzPpFELrUYRw';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv68G12Kd0g8RThZGpXToV2m_PjN7IsaBXwzDkPvA1TqsgFTIjQFuuC0G0_Xitsxm8/exec';

async function fetchGoogleSheets(type) {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?type=${type}&_t=${Date.now()}`);
    return await res.json();
}

async function fetchSupabase(table, select = '*') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}`, {
        headers: { 'apikey': SUPABASE_ANON_KEY }
    });
    return await res.json();
}

async function main() {
    console.log('='.repeat(60));
    console.log('🔍 마이그레이션 검증 리포트');
    console.log('='.repeat(60));
    console.log();

    // 1. 케이스 데이터 비교
    console.log('📊 1. 케이스 데이터 비교');
    console.log('-'.repeat(40));

    const gsCases = await fetchGoogleSheets('leads');
    const sbCases = await fetchSupabase('cases', 'case_id,customer_name');

    console.log(`  Google Sheets: ${gsCases.length}건`);
    console.log(`  Supabase: ${sbCases.length}건`);

    const sbCaseIds = new Set(sbCases.map(c => c.case_id));
    const missingCases = gsCases.filter(c => !sbCaseIds.has(c.caseId));

    if (missingCases.length > 0) {
        console.log(`  ⚠️ 누락된 케이스: ${missingCases.length}건`);
        missingCases.slice(0, 5).forEach(c => {
            console.log(`    - ${c.customerName} (${c.caseId})`);
        });
        if (missingCases.length > 5) console.log(`    ... 외 ${missingCases.length - 5}건`);
    } else {
        console.log(`  ✅ 모든 케이스 마이그레이션 완료`);
    }
    console.log();

    // 2. 설정 데이터 비교
    console.log('⚙️ 2. 설정 데이터 비교');
    console.log('-'.repeat(40));

    const gsSettings = await fetchGoogleSheets('settings');
    const sbSettings = await fetchSupabase('settings', 'key,value');

    const requiredSettings = [
        'inboundPaths', 'statusStages', 'secondaryStatuses',
        'partners', 'aiPrompt', 'ocrPrompt', 'summaryTemplate',
        'emailNotificationSettings', 'allowedEmails', 'specialMemoStamps'
    ];

    const sbSettingsMap = {};
    sbSettings.forEach(s => { sbSettingsMap[s.key] = s.value; });

    console.log('  Google Sheets 설정:');
    for (const key of Object.keys(gsSettings)) {
        const value = gsSettings[key];
        const exists = sbSettingsMap[key] !== undefined;
        const icon = exists ? '✅' : '❌';
        const valueStr = Array.isArray(value) ? `[${value.length}개 항목]` :
            typeof value === 'object' ? '{객체}' :
                String(value).substring(0, 30);
        console.log(`    ${icon} ${key}: ${valueStr}`);
    }
    console.log();

    console.log('  Supabase에 저장된 설정:');
    sbSettings.forEach(s => {
        const valueStr = Array.isArray(s.value) ? `[${s.value.length}개 항목]` :
            typeof s.value === 'object' ? '{객체}' :
                String(s.value).substring(0, 30);
        console.log(`    ✅ ${s.key}: ${valueStr}`);
    });
    console.log();

    // 3. 파트너 데이터 비교
    console.log('🤝 3. 파트너 데이터');
    console.log('-'.repeat(40));

    const gsPartners = gsSettings.partners || [];
    const sbPartners = await fetchSupabase('partners', 'partner_id,name');

    console.log(`  Google Sheets: ${gsPartners.length}개 파트너`);
    console.log(`  Supabase (settings): ${(sbSettingsMap.partners || []).length}개 파트너`);
    console.log(`  Supabase (partners table): ${sbPartners.length}개 파트너`);
    console.log();

    // 4. 요약
    console.log('='.repeat(60));
    console.log('📋 요약');
    console.log('='.repeat(60));

    const issues = [];

    if (missingCases.length > 0) {
        issues.push(`${missingCases.length}건의 케이스 누락`);
    }

    if (!sbSettingsMap.aiPrompt || sbSettingsMap.aiPrompt.length < 50) {
        issues.push('AI 프롬프트 누락 또는 불완전');
    }

    if (!sbSettingsMap.statusStages || sbSettingsMap.statusStages.length === 0) {
        issues.push('상태 관리 목록 누락');
    }

    if (!sbSettingsMap.secondaryStatuses || sbSettingsMap.secondaryStatuses.length === 0) {
        issues.push('2차 상태 관리 목록 누락');
    }

    if (issues.length === 0) {
        console.log('  ✅ 모든 데이터가 정상적으로 마이그레이션되었습니다!');
    } else {
        console.log('  ⚠️ 발견된 문제:');
        issues.forEach(issue => console.log(`    - ${issue}`));
    }

    console.log();
    console.log('='.repeat(60));
}

main().catch(console.error);
