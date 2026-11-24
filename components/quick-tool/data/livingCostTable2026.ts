/**
 * 2026년 보건복지부 기준 중위소득 및 법원 개인회생 인정 최저생계비(중위소득 60%) 데이터셋
 */

export interface HouseholdLivingCost {
  householdSize: number;
  medianIncome: number; // 기준 중위소득 (100%)
  minLivingCost: number; // 법원 인정 최저생계비 (60%)
}

export const LIVING_COST_TABLE_2026: HouseholdLivingCost[] = [
  { householdSize: 1, medianIncome: 2425000, minLivingCost: 1455000 },
  { householdSize: 2, medianIncome: 3980000, minLivingCost: 2388000 },
  { householdSize: 3, medianIncome: 5090000, minLivingCost: 3054000 },
  { householdSize: 4, medianIncome: 6150000, minLivingCost: 3690000 },
  { householdSize: 5, medianIncome: 7160000, minLivingCost: 4296000 },
  { householdSize: 6, medianIncome: 8130000, minLivingCost: 4878000 },
  { householdSize: 7, medianIncome: 9080000, minLivingCost: 5448000 },
  { householdSize: 8, medianIncome: 10020000, minLivingCost: 6012000 },
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
