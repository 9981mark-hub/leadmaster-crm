/**
 * 2026년 보건복지부 기준 중위소득 및 법원 개인회생 인정 최저생계비(중위소득 60%) 데이터셋
 */

export interface HouseholdLivingCost {
  householdSize: number;
  medianIncome: number; // 기준 중위소득 (100%)
  minLivingCost: number; // 법원 인정 최저생계비 (60%)
}

export const LIVING_COST_TABLE_2026: HouseholdLivingCost[] = [
  { householdSize: 1, medianIncome: 2564238, minLivingCost: 1538543 },
  { householdSize: 2, medianIncome: 4199292, minLivingCost: 2519575 },
  { householdSize: 3, medianIncome: 5359036, minLivingCost: 3215422 },
  { householdSize: 4, medianIncome: 6494738, minLivingCost: 3896843 },
  { householdSize: 5, medianIncome: 7556719, minLivingCost: 4534031 },
  { householdSize: 6, medianIncome: 8555952, minLivingCost: 5133571 },
  { householdSize: 7, medianIncome: 9555185, minLivingCost: 5733111 },
  { householdSize: 8, medianIncome: 10554418, minLivingCost: 6332651 },
];

/**
 * 가구원 수에 따른 최저생계비 및 월 변제금, 탕감률 계산
 */
export function calculatePaymentEstimate({
  householdSize,
  monthlyIncome,
  additionalCost = 0,
  totalDebt = 0,
  repaymentPeriodMonths = 36,
}: {
  householdSize: number;
  monthlyIncome: number;
  additionalCost?: number;
  totalDebt?: number;
  repaymentPeriodMonths?: number;
}) {
  const row = LIVING_COST_TABLE_2026.find(item => item.householdSize === householdSize) 
    || LIVING_COST_TABLE_2026[LIVING_COST_TABLE_2026.length - 1];

  const standardLivingCost = row.minLivingCost;
  const totalLivingCost = standardLivingCost + additionalCost;

  // 가용소득 (월 변제금) = 소득 - 총 인정 생계비
  const estimatedMonthlyPayment = Math.max(0, monthlyIncome - totalLivingCost);

  // 총 변제액 = 월 변제금 * 변제기간 (기본 36개월, 청년특례 24개월 등)
  const totalRepayment = estimatedMonthlyPayment * repaymentPeriodMonths;

  // 예상 탕감액 및 탕감률
  let forgivenAmount = 0;
  let forgivenRate = 0;

  if (totalDebt > 0) {
    forgivenAmount = Math.max(0, totalDebt - totalRepayment);
    forgivenRate = Math.min(100, Math.max(0, Math.round((forgivenAmount / totalDebt) * 100)));
  }

  return {
    householdSize,
    medianIncome: row.medianIncome,
    standardLivingCost,
    totalLivingCost,
    estimatedMonthlyPayment,
    repaymentPeriodMonths,
    totalRepayment,
    forgivenAmount,
    forgivenRate,
    isEligible: monthlyIncome > totalLivingCost, // 가용소득이 있어야 개인회생 가능
  };
}
