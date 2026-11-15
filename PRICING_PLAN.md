# 💰 리드마스터 고객사별 맞춤 단가 및 볼륨 티어링 과금 시스템 기획서

> 문서 번호: LM-SPEC-202611-CUSTOM-PRICING-v1.1  
> 기획 대상: 리드마스터 플랫폼 호스트 (서비스 총괄 대표 및 운영진)  
> 적용 시스템: LeadMaster Multi-tenant B2B Cloud Platform  
> 최종 수정: 2026년 11월 15일 (스타터 ₩58,000 / 메가센터 ₩38,000 기준 개편)  

---

## 1. 추진 배경 및 목표

### 1.1 배경
- 5명이 사용하는 소규모 TM 팀과 100명 이상이 사용하는 대형 콜센터/로펌의 단가를 차등화하여, 소규모 고객사에서는 안정적인 고단가 수익을 확보하고 대형 고객사에는 규모의 경제(볼륨 우대)를 제공하여 계약 성사율과 장기 락인을 극대화합니다.

### 1.2 목표
1. 최저 기준가(스타터 1~5인): **₩58,000 / 석** 적용.
2. 최고 볼륨 우대가(메가 센터 101인+): **₩38,000 / 석** 적용.
3. 중간 구간(비즈니스, 프로, 엔터프라이즈)의 합리적인 계단식 볼륨 디스카운트 체계 수립.
4. 호스트가 필요 시 특정 고객사마다 단가를 임의 조정할 수 있는 [개별 맞춤 단가] 및 [월 정액제(Flat Fee)] 동시 지원.

---

## 2. 개편된 5대 볼륨 티어링 단가표 (스타터 ₩58,000 ~ 메가 ₩38,000)

| 티어 명칭 | 상담원 규모 | 좌석당 단가 (월/VAT별도) | 할인율 | 인원별 월 공급가액 예시 | 비고 |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **스타터 (Starter)** | 1 ~ 5명 | **₩58,000** | 0% (기준가) | • 1인: ₩58,000<br/>• 3인: ₩174,000<br/>• 5인: **₩290,000** | 소규모 초기 로펌/부티크 TM |
| **비즈니스 (Business)** | 6 ~ 20명 | **₩52,000** | 약 10.3% 할인 (-6,000원) | • 6인: ₩312,000<br/>• 10인: ₩520,000<br/>• 20인: **₩1,040,000** | 표준 성장형 콜센터 |
| **프로 (Pro)** | 21 ~ 50명 | **₩46,000** | 약 20.7% 할인 (-12,000원) | • 30인: ₩1,380,000<br/>• 50인: **₩2,300,000** | 중대형 법무법인/TM센터 |
| **엔터프라이즈 (Enterprise)** | 51 ~ 100명 | **₩42,000** | 약 27.6% 할인 (-16,000원) | • 60인: ₩2,520,000<br/>• 80인: ₩3,360,000<br/>• 100인: **₩4,200,000** | 대형 전문 콜센터 |
| **메가 센터 (Mega Center)** | 101명 이상 | **₩38,000** | **약 34.5% 파격 할인** (-20,000원) | • 101인: **₩3,838,000**<br/>• 150인: ₩5,700,000<br/>• 200인: ₩7,600,000 | 전국구 프랜차이즈/대형 연합체 |

---

## 3. 요금 모델 3대 체계

1. **모델 1: 볼륨 자동 티어링 (기본 권장)**
   - 시스템이 활성 상담원 수를 카운트하여 위 표의 티어 단가를 자동으로 적용하고 청구서 산출.
2. **모델 2: 호스트 지정 개별 맞춤 단가**
   - 영업 협상에 따라 특정 고객사의 단가를 원 단위로 직접 지정 (예: ₩45,000/석 등).
3. **모델 3: 월 고정 정액제 (Flat Fee)**
   - 100인 이상 대형 센터와 연간/월간 계약 체결 시 (예: 인원 무관 월 ₩4,000,000원 정액 고정 청구).

---

## 4. UI/UX 연동 및 산출 로직

### 4.1 금액 계산 공식 (TypeScript)
```typescript
export const calculateOrgMonthlyBill = (
  activeSeats: number,
  permissions?: OrgFeaturePermissions
): { unitPrice: number; totalPrice: number; tierName: string } => {
  const model = permissions?.pricingModel || 'volume_tier';

  if (model === 'flat_fee' && permissions?.flatMonthlyFee) {
    return {
      unitPrice: Math.round(permissions.flatMonthlyFee / Math.max(1, activeSeats)),
      totalPrice: permissions.flatMonthlyFee,
      tierName: '월 고정 정액제',
    };
  }

  if (model === 'custom_seat' && permissions?.customUnitPrice) {
    return {
      unitPrice: permissions.customUnitPrice,
      totalPrice: activeSeats * permissions.customUnitPrice,
      tierName: '호스트 맞춤 단가',
    };
  }

  // 볼륨 자동 티어링 (스타터 ₩58,000 ~ 메가 ₩38,000)
  if (activeSeats >= 101) return { unitPrice: 38000, totalPrice: activeSeats * 38000, tierName: '메가 센터 (101인+)' };
  if (activeSeats >= 51)  return { unitPrice: 42000, totalPrice: activeSeats * 42000, tierName: '엔터프라이즈 (51~100인)' };
  if (activeSeats >= 21)  return { unitPrice: 46000, totalPrice: activeSeats * 46000, tierName: '프로 (21~50인)' };
  if (activeSeats >= 6)   return { unitPrice: 52000, totalPrice: activeSeats * 52000, tierName: '비즈니스 (6~20인)' };
  return { unitPrice: 58000, totalPrice: activeSeats * 58000, tierName: '스타터 (1~5인)' };
};
```

---

## 5. 기대 효과

1. **소규모 고객사 수익성 강화**: 5인 고객사 기준 기존 24만 원 ➔ **29만 원**으로 월 수익 약 21% 상승.
2. **대형 고객사 확실한 유인책**: 100인 규모 고객사 유치 시 월 420만 원, 101인 이상 시 파격적인 38,000원 단가로 장기 독점 계약 유도.
3. **영업 재량권 확보**: 호스트가 맞춤 단가 및 월 정액제를 직접 입력할 수 있어 어떠한 고객사와의 협상에도 유연하게 대처 가능.
