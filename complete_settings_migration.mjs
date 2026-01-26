// Complete Settings Migration
const SUPABASE_URL = 'https://cenksfblktflfurxjmtv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbmtzZmJsa3RmbGZ1cnhqbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzcyNTksImV4cCI6MjA4NDk1MzI1OX0.CNXTi73sjRem7FJqEMHZMxkwcpwagU3xzPpFELrUYRw';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv68G12Kd0g8RThZGpXToV2m_PjN7IsaBXwzDkPvA1TqsgFTIjQFuuC0G0_Xitsxm8/exec';

async function saveSettings(key, value) {
    // Delete first
    await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.${key}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });

    // Insert new
    const res = await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({ key, value })
    });

    if (res.ok) {
        console.log(`  ✅ ${key}`);
        return true;
    } else {
        console.log(`  ❌ ${key}: ${await res.text()}`);
        return false;
    }
}

async function main() {
    console.log('🔧 설정 완전 복원 시작...\n');

    // 1. Google Sheets에서 설정 가져오기
    const gsRes = await fetch(`${GOOGLE_SCRIPT_URL}?type=settings&_t=${Date.now()}`);
    const gs = await gsRes.json();

    console.log('📋 Google Sheets 설정 키:', Object.keys(gs).join(', '));
    console.log();

    // 2. 모든 설정 저장
    console.log('💾 Supabase에 저장 중...');

    // 기본 설정들
    if (gs.inboundPaths) await saveSettings('inboundPaths', gs.inboundPaths);
    if (gs.statusStages) await saveSettings('statusStages', gs.statusStages);
    if (gs.secondaryStatuses) await saveSettings('secondaryStatuses', gs.secondaryStatuses);
    if (gs.partners) await saveSettings('partners', gs.partners);
    if (gs.allowedEmails) await saveSettings('allowedEmails', gs.allowedEmails);
    if (gs.emailNotificationSettings) await saveSettings('emailNotificationSettings', gs.emailNotificationSettings);
    if (gs.emailSentLog) await saveSettings('emailSentLog', gs.emailSentLog);
    if (gs.specialMemoStamps) await saveSettings('specialMemoStamps', gs.specialMemoStamps);

    // AI 관련 설정
    if (gs.aiPrompt) {
        await saveSettings('aiPrompt', gs.aiPrompt);
    } else {
        // 기본값 사용
        const defaultAiPrompt = `당신은 법률 사무소의 전문 상담원 보조 AI입니다.
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
        await saveSettings('aiPrompt', defaultAiPrompt);
    }

    if (gs.ocrPrompt) {
        await saveSettings('ocrPrompt', gs.ocrPrompt);
    }

    if (gs.summaryTemplate) {
        await saveSettings('summaryTemplate', gs.summaryTemplate);
    }

    if (gs.requiredFields) {
        await saveSettings('requiredFields', gs.requiredFields);
    }

    // 3. 상태 목록이 없으면 기본값 저장
    const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.statusStages`, {
        headers: { 'apikey': SUPABASE_ANON_KEY }
    });
    const existingStatus = await sbRes.json();

    if (!existingStatus || existingStatus.length === 0) {
        await saveSettings('statusStages', [
            '신규접수', '부재', '재통화 예정', '진행불가', '고객취소',
            '장기관리중', '상담중', '사무장 접수', '계약 완료',
            '1차 입금완료', '2차 입금완료'
        ]);
    }

    const sb2Res = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.secondaryStatuses`, {
        headers: { 'apikey': SUPABASE_ANON_KEY }
    });
    const existingSecondary = await sb2Res.json();

    if (!existingSecondary || existingSecondary.length === 0) {
        await saveSettings('secondaryStatuses', [
            '서류 검토중', '서류 보완 요청', '서류 접수 완료', '법원 제출 완료',
            '개시 결정', '인가 결정', '변제 진행중', '변제 완료'
        ]);
    }

    console.log('\n=============================');
    console.log('✅ 설정 복원 완료!');
    console.log('=============================');
}

main().catch(console.error);
