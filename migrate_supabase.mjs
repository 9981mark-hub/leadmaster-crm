// Supabase Migration Script - Node.js
// Run with: node migrate_supabase.mjs

const SUPABASE_URL = 'https://cenksfblktflfurxjmtv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbmtzZmJsa3RmbGZ1cnhqbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzcyNTksImV4cCI6MjA4NDk1MzI1OX0.CNXTi73sjRem7FJqEMHZMxkwcpwagU3xzPpFELrUYRw';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv68G12Kd0g8RThZGpXToV2m_PjN7IsaBXwzDkPvA1TqsgFTIjQFuuC0G0_Xitsxm8/exec';

// camelCase to snake_case 변환
function caseToDb(c) {
    return {
        case_id: c.caseId,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
        status: c.status,
        secondary_status: c.secondaryStatus || null,
        is_viewed: c.isViewed || false,
        deleted_at: c.deletedAt || null,
        customer_name: c.customerName,
        phone: c.phone,
        birth: c.birth || null,
        gender: c.gender || '남',
        region: c.region || null,
        manager_name: c.managerName,
        partner_id: c.partnerId,
        case_type: c.caseType || '개인회생',
        inbound_path: c.inboundPath,
        pre_info: c.preInfo || null,
        history_type: c.historyType || '없음',
        job_types: c.jobTypes || [],
        income_net: c.incomeNet || 0,
        income_details: c.incomeDetails || {},
        insurance4: c.insurance4 || '미가입',
        housing_type: c.housingType || '월세',
        housing_detail: c.housingDetail || '기타',
        rent_contractor: c.rentContractor || null,
        deposit: c.deposit || 0,
        deposit_loan_amount: c.depositLoanAmount || 0,
        rent: c.rent || 0,
        own_house_price: c.ownHousePrice || 0,
        own_house_loan: c.ownHouseLoan || 0,
        own_house_owner: c.ownHouseOwner || null,
        credit_card_use: c.creditCardUse || null,
        credit_card_amount: c.creditCardAmount || 0,
        loan_monthly_pay: c.loanMonthlyPay || 0,
        marital_status: c.maritalStatus || '미혼',
        children_count: c.childrenCount || 0,
        contract_at: c.contractAt || null,
        contract_fee: c.contractFee || 0,
        installment_months: c.installmentMonths || null,
        use_capital: c.useCapital || false,
        assets: c.assets || [],
        credit_loan: c.creditLoan || [],
        special_memo: c.specialMemo || [],
        reminders: c.reminders || [],
        recordings: c.recordings || [],
        deposit_history: c.depositHistory || [],
        status_logs: c.statusLogs || [],
        missed_call_count: c.missedCallCount || 0,
        last_missed_call_at: c.lastMissedCallAt || null,
        ai_summary: c.aiSummary || null,
        formatted_summary: c.formattedSummary || null
    };
}

async function main() {
    console.log('🚀 마이그레이션 시작...\n');

    // 1. Google Sheets에서 데이터 가져오기
    console.log('📊 Google Sheets에서 데이터 가져오는 중...');
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?type=leads&_t=${Date.now()}`);
    const cases = await response.json();

    if (!Array.isArray(cases)) {
        console.error('❌ Google Sheets에서 데이터를 가져오지 못했습니다.');
        return;
    }

    console.log(`✅ ${cases.length}건의 케이스를 가져왔습니다.\n`);

    // 2. Supabase로 마이그레이션
    console.log('📦 Supabase로 마이그레이션 중...');

    let successCount = 0;
    let errorCount = 0;

    // 배치로 처리 (10개씩)
    const batchSize = 10;
    for (let i = 0; i < cases.length; i += batchSize) {
        const batch = cases.slice(i, i + batchSize);
        const dbCases = batch.map(c => {
            const db = caseToDb(c);
            // 날짜 필드 정리 - 빈 문자열을 null로
            if (db.created_at === '' || db.created_at === undefined) db.created_at = new Date().toISOString();
            if (db.updated_at === '' || db.updated_at === undefined) db.updated_at = new Date().toISOString();
            if (db.deleted_at === '') db.deleted_at = null;
            if (db.last_missed_call_at === '') db.last_missed_call_at = null;
            return db;
        });

        // upsert 사용 (중복 시 업데이트)
        const res = await fetch(`${SUPABASE_URL}/rest/v1/cases`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates,return=minimal'
            },
            body: JSON.stringify(dbCases)
        });

        if (res.ok) {
            successCount += batch.length;
        } else {
            const error = await res.text();
            console.error(`❌ 배치 오류 (${i}-${i + batch.length}):`, error);
            errorCount += batch.length;
        }

        // 진행률 표시
        if ((i + batchSize) % 50 === 0 || i + batchSize >= cases.length) {
            console.log(`  진행: ${Math.min(i + batchSize, cases.length)} / ${cases.length}`);
        }
    }

    console.log('\n=============================');
    console.log(`✅ 마이그레이션 완료!`);
    console.log(`   성공: ${successCount}건`);
    console.log(`   오류: ${errorCount}건`);
    console.log('=============================');
}

main().catch(console.error);
