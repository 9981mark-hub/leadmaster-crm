// Supabase Migration Script V2 - Single Insert with Error Handling
// Run with: node migrate_v2.mjs

const SUPABASE_URL = 'https://cenksfblktflfurxjmtv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbmtzZmJsa3RmbGZ1cnhqbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzcyNTksImV4cCI6MjA4NDk1MzI1OX0.CNXTi73sjRem7FJqEMHZMxkwcpwagU3xzPpFELrUYRw';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyv68G12Kd0g8RThZGpXToV2m_PjN7IsaBXwzDkPvA1TqsgFTIjQFuuC0G0_Xitsxm8/exec';

// 날짜 변환 함수
function safeDate(val) {
    if (!val || val === '' || val === 'undefined' || val === 'null') return null;
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return null;
        return d.toISOString();
    } catch {
        return null;
    }
}

// camelCase to snake_case 변환
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
    console.log('🚀 마이그레이션 V2 시작...\n');

    // 1. Google Sheets에서 데이터 가져오기
    console.log('📊 Google Sheets에서 데이터 가져오는 중...');
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?type=leads&_t=${Date.now()}`);
    const cases = await response.json();

    if (!Array.isArray(cases)) {
        console.error('❌ Google Sheets에서 데이터를 가져오지 못했습니다.');
        return;
    }

    console.log(`✅ ${cases.length}건의 케이스를 가져왔습니다.\n`);
    console.log('📦 Supabase로 마이그레이션 중...\n');

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // 한 건씩 처리 (안정성 우선)
    for (let i = 0; i < cases.length; i++) {
        const c = cases[i];
        const dbCase = caseToDb(c);

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/cases`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates,return=minimal'
                },
                body: JSON.stringify(dbCase)
            });

            if (res.ok) {
                successCount++;
            } else {
                const errText = await res.text();
                errorCount++;
                if (errors.length < 5) {
                    errors.push({ name: c.customerName, caseId: c.caseId, error: errText });
                }
            }
        } catch (err) {
            errorCount++;
            if (errors.length < 5) {
                errors.push({ name: c.customerName, caseId: c.caseId, error: err.message });
            }
        }

        // 진행률 표시
        if ((i + 1) % 20 === 0 || i + 1 === cases.length) {
            console.log(`  진행: ${i + 1} / ${cases.length} (성공: ${successCount}, 오류: ${errorCount})`);
        }
    }

    console.log('\n=============================');
    console.log(`✅ 마이그레이션 완료!`);
    console.log(`   성공: ${successCount}건`);
    console.log(`   오류: ${errorCount}건`);
    console.log('=============================');

    if (errors.length > 0) {
        console.log('\n첫 5개 오류:');
        errors.forEach((e, i) => {
            console.log(`  ${i + 1}. ${e.name || e.caseId}: ${e.error.substring(0, 100)}`);
        });
    }
}

main().catch(console.error);
