// 정산 계산 점검 (npx tsx scripts/settlement_check.ts) — 운영 데이터 안 씀
import { computeCaseCommission, buildPartnerLedger, dueDateFor, statementText } from '../utils/settlement';

let fail = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail++; };

const partner: any = {
  partnerId: 'p1', name: '테스트 법무법인', active: true, vatMode: 'separate',
  settlementConfig: { cutoffDay: 0, payoutDay: 2, payoutWeekDelay: 0, downPaymentPercentage: 10, firstPayoutPercentage: 50 },
  commissionRules: [{ ruleId: 'r1', minFee: 300, maxFee: 499, commission: 100, fullPayoutThreshold: 0, priority: 1, active: true, updatedAt: '2026-01-01' }],
};
const base: any = { status: '계약 완료', partnerId: 'p1', contractAt: '2026-09-30', contractFee: 400, specialMemo: [], reminders: [] };
const c1: any = { ...base, caseId: 'c1', customerName: '김하나', depositHistory: [{ date: '2026-10-01', amount: 40 }, { date: '2026-10-15', amount: 360 }] };
const c2: any = { ...base, caseId: 'c2', customerName: '이두리', depositHistory: [{ date: '2026-10-28', amount: 50 }, { date: '2026-11-20', amount: 350 }] };
const c3: any = { ...base, caseId: 'c3', customerName: '박세나', status: '고객취소', depositHistory: [{ date: '2026-10-05', amount: 100 }] };
const c4: any = { ...base, caseId: 'c4', customerName: '최수당', contractFee: 900, depositHistory: [{ date: '2026-10-05', amount: 100 }] };

const asOf = '2026-11-01';
ok(dueDateFor('2026-10-01', partner) === '2026-10-06', `목 입금 → 그 주 일요일 마감 → 화요일 (${dueDateFor('2026-10-01', partner)})`);
ok(dueDateFor('2026-10-04', partner) === '2026-10-06', `일요일 입금 → 당일 마감 → 화요일 (${dueDateFor('2026-10-04', partner)})`);
ok(dueDateFor('2026-10-05', partner) === '2026-10-13', `월요일 입금 → 다음 일요일 → 화요일 (${dueDateFor('2026-10-05', partner)})`);

const cc1 = computeCaseCommission(c1, partner, asOf);
ok(cc1.total === 100 && cc1.firstThreshold === 30 && cc1.fullThreshold === 400, `구간 300~499: 계약금 기준 30, 완납 기준 400 (${cc1.firstThreshold}/${cc1.fullThreshold})`);
ok(cc1.stages.length === 2 && cc1.stages[0].earnedAt === '2026-10-01' && cc1.stages[0].amount === 50 && cc1.stages[1].earnedAt === '2026-10-15' && cc1.stages[1].amount === 50, '1단계 10/01 50만, 2단계 10/15 50만');
ok(cc1.stages[0].billed === 55, `부가세 별도 → 청구 55만 (${cc1.stages[0].billed})`);

const cc2 = computeCaseCommission(c2, partner, asOf);
ok(cc2.stages.length === 2 && !cc2.stages[0].future && cc2.stages[1].future, '이두리: 1단계 발생, 2단계는 11/20 입금 예정으로 미래');
const cc4 = computeCaseCommission(c4, partner, asOf);
ok(cc4.problem === '수당 룰 없음', `수임료 900 → 맞는 룰 없음 (${cc4.problem})`);

const lg = buildPartnerLedger(partner, [c1, c2, c3, c4], [{ id: 'x', partnerId: 'p1', date: '2026-10-10', amount: 60, createdAt: '' }], asOf);
// 발생: c1-1(55, 10/06), c3-1(55 취소, due 10/06), c1-2(55, 10/20), c2-1(55, 11/03)
ok(lg.lines.length === 4 && lg.planned.length === 1, `발생 4줄 + 예정 1줄 (${lg.lines.length}/${lg.planned.length})`);
ok(lg.billedTotal === 220 && lg.receivedTotal === 60 && lg.outstanding === 160, `청구 220 · 받음 60 · 남음 160 (${lg.billedTotal}/${lg.receivedTotal}/${lg.outstanding})`);
const first = lg.lines[0];
ok(first.received === 55 && first.state === '받음', `받은 60만은 가장 먼저 받을 줄부터 (${first.customerName} ${first.state})`);
ok(lg.overdue === 105, `연체 = 10/06분 남은 50 + 10/20분 55 (${lg.overdue})`);
ok(lg.cancelledWithCommission.length === 1 && lg.cancelledWithCommission[0].caseId === 'c3', '고객취소인데 수수료가 계산된 건 → 확인 필요로 표시');
ok(lg.problems.some(p => p.caseId === 'c4'), '수당 룰 없는 건 → 확인 필요');
const txt = statementText(lg, '2026-10');
ok(txt.includes('합계: 공급가 200만원 + 부가세 20만원 = 220만원'), '10월 정산서 합계 (10월에 생긴 4건, 취소 건 포함)');
ok(lg.lines.find(l => l.caseId === 'c3')?.dueAt === '2026-10-13', '월요일 입금(10/05) → 10/13 받을 날');
console.log(fail ? `\nFAIL=${fail}` : '\nSETTLEMENT_ALL_PASS');
