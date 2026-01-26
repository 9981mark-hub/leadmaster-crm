// Re-migrate missing cases from Google Sheets to Supabase
const SUPABASE_URL = 'https://cenksfblktflfurxjmtv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbmtzZmJsa3RmbGZ1cnhqbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzcyNTksImV4cCI6MjA4NDk1MzI1OX0.CNXTi73sjRem7FJqEMHZMxkwcpwagU3xzPpFELrUYRw';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv68G12Kd0g8RThZGpXToV2m_PjN7IsaBXwzDkPvA1TqsgFTIjQFuuC0G0_Xitsxm8/exec';

function safeDate(val) {
    if (!val || val === '' || val === 'undefined' || val === 'null') return null;
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return null;
        return d.toISOString();
    } catch { return null; }
}

function caseToDb(c) {
    return {
        case_id: c.caseId || `CASE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        created_at: safeDate(c.createdAt) || new Date().toISOString(),
        updated_at: safeDate(c.updatedAt) || new Date().toISOString(),
        status: c.status || '신규접수',
        secondary_status: c.secondaryStatus || null,
        is_viewed: Boolean(c.isViewed),
        deleted_at: safeDate(c.deletedAt),
        customer_name: c.customerName || '이름없음',
        phone: c.phone || '',
        birth: c.birth || null,
        gender: c.gender || '남',
        region: c.region || null,
        manager_name: c.managerName || '',
        partner_id: c.partnerId || '',
        case_type: c.caseType || '개인회생',
        inbound_path: c.inboundPath || '',
        pre_info: c.preInfo || null,
        history_type: c.historyType || '없음',
        job_types: Array.isArray(c.jobTypes) ? c.jobTypes : [],
        income_net: Number(c.incomeNet) || 0,
        income_details: c.incomeDetails || {},
        insurance4: c.insurance4 || '미가입',
        housing_type: c.housingType || '월세',
        housing_detail: c.housingDetail || '기타',
        rent_contractor: c.rentContractor || null,
        deposit: Number(c.deposit) || 0,
        deposit_loan_amount: Number(c.depositLoanAmount) || 0,
        rent: Number(c.rent) || 0,
        own_house_price: Number(c.ownHousePrice) || 0,
        own_house_loan: Number(c.ownHouseLoan) || 0,
        own_house_owner: c.ownHouseOwner || null,
        credit_card_use: c.creditCardUse || null,
        credit_card_amount: Number(c.creditCardAmount) || 0,
        loan_monthly_pay: Number(c.loanMonthlyPay) || 0,
        marital_status: c.maritalStatus || '미혼',
        children_count: Number(c.childrenCount) || 0,
        contract_at: c.contractAt || null,
        contract_fee: Number(c.contractFee) || 0,
        installment_months: c.installmentMonths || null,
        use_capital: Boolean(c.useCapital),
        assets: Array.isArray(c.assets) ? c.assets : [],
        credit_loan: Array.isArray(c.creditLoan) ? c.creditLoan : [],
        special_memo: Array.isArray(c.specialMemo) ? c.specialMemo : [],
        reminders: Array.isArray(c.reminders) ? c.reminders : [],
        recordings: Array.isArray(c.recordings) ? c.recordings : [],
        deposit_history: Array.isArray(c.depositHistory) ? c.depositHistory : [],
        status_logs: Array.isArray(c.statusLogs) ? c.statusLogs : [],
        missed_call_count: Number(c.missedCallCount) || 0,
        last_missed_call_at: safeDate(c.lastMissedCallAt),
        ai_summary: c.aiSummary || null,
        formatted_summary: c.formattedSummary || null
    };
}

async function main() {
    console.log('🔄 누락된 케이스 재마이그레이션 시작...\n');

    // 1. Google Sheets에서 전체 케이스 가져오기
    const gsRes = await fetch(`${GOOGLE_SCRIPT_URL}?type=leads&_t=${Date.now()}`);
    const gsCases = await gsRes.json();
    console.log(`📊 Google Sheets: ${gsCases.length}건`);

    // 2. Supabase에서 기존 케이스 ID 가져오기
    const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/cases?select=case_id`, {
        headers: { 'apikey': SUPABASE_ANON_KEY }
    });
    const sbCases = await sbRes.json();
    const sbCaseIds = new Set(sbCases.map(c => c.case_id));
    console.log(`📊 Supabase: ${sbCases.length}건`);

    // 3. 누락된 케이스 찾기
    const missingCases = gsCases.filter(c => !sbCaseIds.has(c.caseId));
    console.log(`⚠️ 누락된 케이스: ${missingCases.length}건\n`);

    if (missingCases.length === 0) {
        console.log('✅ 모든 케이스가 이미 마이그레이션되었습니다!');
        return;
    }

    // 4. 누락된 케이스 마이그레이션
    let success = 0, error = 0;

    for (const c of missingCases) {
        const dbCase = caseToDb(c);

        const res = await fetch(`${SUPABASE_URL}/rest/v1/cases`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dbCase)
        });

        if (res.ok) {
            success++;
            console.log(`  ✅ ${c.customerName} (${c.caseId})`);
        } else {
            error++;
            const errText = await res.text();
            console.log(`  ❌ ${c.customerName}: ${errText.substring(0, 50)}`);
        }
    }

    console.log('\n=============================');
    console.log(`✅ 완료: 성공 ${success}건, 오류 ${error}건`);
    console.log('=============================');
}

main().catch(console.error);
