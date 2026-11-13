// 정산 계산 점검 (npx tsx scripts/settlement_check.ts) — 운영 데이터 안 씀
import { computeCaseCommission, buildPartnerLedger, dueDateFor, statementText, invoiceSplitOf, roundWonPrecision } from '../utils/settlement';
import {
  computeIntegratedPnLSummary, computeAgentSettlement, computePartnerSettlementCards, calculateCommissionSplit,
  policyFromRow, nextAgentPayoutDate, partnerCycleLabel, manwonToWon, DEFAULT_SETTLEMENT_POLICY,
} from '../utils/settlementMaster';

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
// ---------------------------------------------
// 통합 정산(utils/settlementMaster): 단위·부가세·건당 분배·기간·정책 0 값
// ---------------------------------------------
console.log('\n[통합 정산 / 손익]');
const a1: any = { ...c1, assignedUserId: 'u1' };
const a2: any = { ...c2, assignedUserId: 'u1' };

// 1) 손익: 지출(만원) → 원, DB 비용(원) 그대로, 등록 시각은 한국 날짜
const pnlOct = computeIntegratedPnLSummary({
  partners: [partner], cases: [a1], collections: [], agentRows: [],
  batchQualityList: [
    { createdAt: '2026-09-30T16:00:00Z', totalCost: 200000 } as any,  // 한국 10/01 01시 → 10월
    { createdAt: '2026-09-30T14:00:00Z', totalCost: 999999 } as any,  // 한국 9/30 → 10월 아님
  ],
  expenseItems: [{ date: '2026-10-05', amount: 50 } as any, { date: '2026-09-05', amount: 7 } as any],
  year: 2026, month: 10, asOf,
});
ok(pnlOct.totalFixedCostWon === 500000, `지출 50만원 → 500,000원 (${pnlOct.totalFixedCostWon})`);
ok(pnlOct.totalDbCostWon === 200000, `DB 비용은 원 그대로·한국 날짜로 월 구분 (${pnlOct.totalDbCostWon})`);

// 2) 매출 = 공급가 (부가세 별도 거래처라도 부가세는 매출에서 뺌)
ok(pnlOct.totalRevenueWon === 1000000 && pnlOct.totalVatWon === 100000 && pnlOct.totalBilledWon === 1100000,
  `매출 공급가 1,000,000 · 부가세 100,000 · 청구 1,100,000 (${pnlOct.totalRevenueWon}/${pnlOct.totalVatWon}/${pnlOct.totalBilledWon})`);
ok(pnlOct.netProfitWon === 1000000 - 200000 - 500000, `순이익 = 공급가 - DB - 지출 (${pnlOct.netProfitWon})`);
const pnlNov = computeIntegratedPnLSummary({ partners: [partner], cases: [a1], agentRows: [], year: 2026, month: 11, asOf });
ok(pnlNov.totalRevenueWon === 0, `11월 선택 → 10월에 생긴 수수료는 안 들어감 (${pnlNov.totalRevenueWon})`);

// 3) 건당 고정 마진: 3건 × 120만원, 마진 30만원 → 회사 90만 / 상담원 270만
const p120: any = {
  ...partner, partnerId: 'p120',
  settlementConfig: { ...partner.settlementConfig, firstPayoutPercentage: 100 },
  commissionRules: [{ ruleId: 'r120', minFee: 300, maxFee: 499, commission: 120, fullPayoutThreshold: 0, priority: 1, active: true, updatedAt: '2026-01-01' }],
};
const p100: any = { ...p120, partnerId: 'p100', commissionRules: [{ ...p120.commissionRules[0], ruleId: 'r100', commission: 100 }] };
const mk3 = (pid: string) => [1, 2, 3].map(i => ({ ...base, caseId: `${pid}-${i}`, customerName: `고객${i}`, partnerId: pid, assignedUserId: 'u1', depositHistory: [{ date: '2026-10-02', amount: 400 }] } as any));
const marginPolicy = { ...DEFAULT_SETTLEMENT_POLICY, splitModel: 'margin_deduction' as const, companyFixedMargin: 300000 };
const mRows = computeAgentSettlement(mk3('p120'), [p120], marginPolicy, [], { year: 2026, month: 10, asOf }).rows;
ok(mRows.length === 1 && mRows[0].totalPartnerFeeWon === 3600000 && mRows[0].companyShareWon === 900000 && mRows[0].agentShareWon === 2700000,
  `고정 마진 건당 적용: 회사 900,000 / 상담원 2,700,000 (${mRows[0]?.companyShareWon}/${mRows[0]?.agentShareWon})`);

// 4) 건당 고정 수당: 3건 × 100만원, 수당 15만원 → 상담원 45만
const fixedPolicy = { ...DEFAULT_SETTLEMENT_POLICY, splitModel: 'fixed_agent_incentive' as const, agentFixedIncentive: 150000 };
const fRows = computeAgentSettlement(mk3('p100'), [p100], fixedPolicy, [], { year: 2026, month: 10, asOf }).rows;
ok(fRows[0]?.agentShareWon === 450000 && fRows[0]?.companyShareWon === 2550000,
  `고정 수당 건당 적용: 상담원 450,000 / 회사 2,550,000 (${fRows[0]?.agentShareWon}/${fRows[0]?.companyShareWon})`);

// 단계가 두 달로 나뉘어도 건당 마진은 한 번: 김하나 100만(10/01 50 + 10/15 50), 마진 30만 → 상담원 70만
const twoStage = computeAgentSettlement([a1], [partner], marginPolicy, [], { asOf }).rows;
ok(twoStage[0]?.agentShareWon === 700000 && twoStage[0]?.companyShareWon === 300000, `2단계 리드도 마진 30만 한 번만 (${twoStage[0]?.companyShareWon})`);
const novRows = computeAgentSettlement([a1, a2], [partner], DEFAULT_SETTLEMENT_POLICY, [], { year: 2026, month: 11, asOf }).rows;
ok(novRows.length === 0, '11월 선택 → 10월에 생긴 상담원 수당 없음 (11/20 입금 예정분은 미래라 제외)');

// 5) 비율 분배 나머지: 회사 + 상담원 = 수수료 (원 단위까지)
const r1 = calculateCommissionSplit(100001, { ...DEFAULT_SETTLEMENT_POLICY, companyShareRatio: 33, agentShareRatio: 67 });
ok(r1.companyShareWon + r1.agentShareWon === 100001 && r1.companyShareWon === 33000, `비율 33% 100,001원 → ${r1.companyShareWon} + ${r1.agentShareWon}`);
const odd: any = { ...p100, partnerId: 'podd', commissionRules: [{ ...p100.commissionRules[0], ruleId: 'rodd', commission: 33.3333 }] };
const oRows = computeAgentSettlement(mk3('podd'), [odd], DEFAULT_SETTLEMENT_POLICY, [], { year: 2026, month: 10, asOf }).rows;
ok(oRows[0]?.totalPartnerFeeWon === 999999 && oRows[0].companyShareWon + oRows[0].agentShareWon === 999999,
  `3건 × 333,333원 비율 분배 합계 정확 (${oRows[0]?.companyShareWon} + ${oRows[0]?.agentShareWon})`);

// 6) 정책 0 값 유지
const zero = policyFromRow({ split_model: 'ratio_split', company_share_ratio: 0, agent_share_ratio: 100, company_fixed_margin: 0, agent_fixed_incentive: 0, agent_payout_cycle: 'after_partner_deposit', agent_payout_day: 10, payout_delay_days: 0 });
ok(zero.companyShareRatio === 0 && zero.agentShareRatio === 100 && zero.companyFixedMargin === 0 && zero.agentFixedIncentive === 0 && zero.payoutDelayDays === 0,
  `정책 0%·0원·0일 그대로 읽음 (${zero.companyShareRatio}/${zero.companyFixedMargin}/${zero.agentFixedIncentive}/${zero.payoutDelayDays})`);
const z = calculateCommissionSplit(1000000, zero);
ok(z.companyShareWon === 0 && z.agentShareWon === 1000000, '회사 0% → 상담원이 전액');
const emptyRow = policyFromRow({});
ok(emptyRow.companyShareRatio === 40 && emptyRow.companyFixedMargin === 300000, '값이 없을 때만 기본값');

// 7) 수당 규칙 없는 리드는 빼고 확인 필요로 표시, 상태 이름만으로는 대상 아님
const noRule: any = { ...c4, assignedUserId: 'u1' };
const statusOnly: any = { caseId: 's1', customerName: '상태만', status: '계약 완료', partnerId: 'p1', assignedUserId: 'u1', specialMemo: [], reminders: [] };
const nr = computeAgentSettlement([noRule, statusOnly], [partner], DEFAULT_SETTLEMENT_POLICY, [], { asOf });
ok(nr.rows.length === 0 && nr.problems.length === 1 && nr.problems[0].problem === '수당 규칙 없음 확인 필요',
  `수당 규칙 없음 → 제외 + 확인 필요 (${nr.problems.map(p => p.problem).join(',')})`);
ok(twoStage[0]?.caseList[0]?.contractDate === '2026-09-30', '수임 일자 = 계약일(contractAt), 등록일 아님');

// 8) 상담원 지급일
ok(nextAgentPayoutDate({ ...DEFAULT_SETTLEMENT_POLICY, agentPayoutDay: 31 }, '2026-02-10') === '2026-02-28', '매월 말일 → 2월 28일');
ok(nextAgentPayoutDate({ ...DEFAULT_SETTLEMENT_POLICY, agentPayoutDay: 10 }, '2026-11-11') === '2026-12-10', '이번 달 10일 지남 → 다음 달 10일');
ok(nextAgentPayoutDate({ ...DEFAULT_SETTLEMENT_POLICY, agentPayoutCycle: 'weekly_fixed', agentPayoutDay: 5 }, asOf) === '2026-11-06', '매주 금요일 (11/01 일 → 11/06)');
ok(nextAgentPayoutDate({ ...DEFAULT_SETTLEMENT_POLICY, agentPayoutCycle: 'weekly_fixed', agentPayoutDay: 10 }, asOf) === '2026-11-06', '주급인데 요일 값이 10 → 금요일로 (날짜로 쓰지 않음)');
const afterPolicy = { ...DEFAULT_SETTLEMENT_POLICY, agentPayoutCycle: 'after_partner_deposit' as const, payoutDelayDays: 3 };
const ad = computeAgentSettlement([a2], [partner], afterPolicy, [], { asOf, collections: [] }).rows;
ok(ad[0]?.nextPayoutDate === '2026-11-06', `입금 확인 후 3일: 받을 날 11/03 + 3일 (${ad[0]?.nextPayoutDate})`);

// 9) 거래처 카드: 2단계 리드도 수임료 한 번, 주기 라벨은 거래처 설정
const card = computePartnerSettlementCards([partner], [a1], [], asOf)[0];
ok(card.caseCount === 1 && card.totalContractFeeWon === 4000000, `수임료 400만원 한 번만 (${card.totalContractFeeWon})`);
ok(card.settlementCycleDisplay === '매주 일요일 마감 → 화요일 지급', `주기 라벨 (${card.settlementCycleDisplay})`);
ok(partnerCycleLabel({ ...partner, settlementConfig: undefined, paymentTermDays: 14 }) === '지급 사유 발생 후 14일 이내', '정산 스케줄 없으면 N일 이내');

// 10) 세금계산서 기본값: 거래처 부가세 방식, 원 단위 유지
const inv1 = invoiceSplitOf(5, 'separate');
ok(inv1.vat === 0.5 && inv1.total === 5.5, `5만원 별도 → 부가세 0.5만원 (반올림해서 1만원 아님) (${inv1.vat})`);
const inv2 = invoiceSplitOf(11, 'included');
ok(inv2.supply === 10 && inv2.vat === 1, `11만원 포함 → 공급가 10 + 부가세 1 (${inv2.supply}/${inv2.vat})`);
ok(invoiceSplitOf(11, 'none').vat === 0, '부가세 없음 → 0');
ok(manwonToWon(0.55) === 5500 && roundWonPrecision(11 * 0.05) === 0.55, '페이백 5%: 11만원 → 0.55만원(5,500원)');

console.log(fail ? `\nFAIL=${fail}` : '\nSETTLEMENT_ALL_PASS');
