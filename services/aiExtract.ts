// ============================================
// AI 요약문(글) → 고객 정보 칸 (2026-11-02)
// 직접 올린 녹음의 AI 요약·대화록 글을 서버(ai-proxy, task 'summary_extract')에 보내
// 통화 녹음 AI 정리와 같은 모양(ExtractedInfo)으로 받는다. 녹음은 다시 보내지 않는다.
// ============================================
import { callAi } from './aiProxy';
import { ExtractedInfo } from './recordings';
import { Case } from '../types';

const NUM = { type: 'NUMBER', nullable: true };
const STR = { type: 'STRING', nullable: true };
const en = (values: string[]) => ({ type: 'STRING', enum: values, nullable: true });

// recording-analyze의 칸과 같게 유지 (요약·대화록·사무실 보고서는 빼고 고객 정보만)
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    debt: {
      type: 'OBJECT',
      properties: {
        total_manwon: NUM, monthly_payment_manwon: NUM, overdue: STR,
        creditors: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              name: STR,
              kind: { type: 'STRING', enum: ['신용대출', '카드론·현금서비스', '카드값', '담보대출', '보증금대출', '자동차할부', '대부업', '사채', '보증채무', '세금·공과금', '기타'] },
              amount_manwon: NUM, note: STR,
            },
            required: ['kind'],
          },
        },
      },
    },
    income: {
      type: 'OBJECT',
      properties: {
        net_monthly_manwon: NUM, salary_manwon: NUM, business_manwon: NUM, freelance_manwon: NUM,
        job: STR,
        job_types: { type: 'ARRAY', items: { type: 'STRING', enum: ['직장인', '일용직', '개인사업자', '법인사업자', '프리랜서', '무직'] } },
        insurance4: en(['가입', '미가입']),
        workplace: STR, business_place: STR,
      },
    },
    family: { type: 'OBJECT', properties: { marital_status: en(['미혼', '기혼', '사실혼', '이혼', '사별']), children_count: NUM, note: STR } },
    housing: {
      type: 'OBJECT',
      properties: {
        type: en(['자가', '전세', '월세', '무상거주']),
        detail: en(['아파트', '빌라', '단독주택', '오피스텔', '기타']),
        deposit_manwon: NUM, rent_manwon: NUM, deposit_loan_manwon: NUM,
        own_house_price_manwon: NUM, own_house_loan_manwon: NUM,
        contractor: en(['본인', '배우자']),
      },
    },
    assets: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { type: STR, owner: en(['본인', '배우자', '배우자 공동명의']), amount_manwon: NUM, loan_manwon: NUM, desc: STR } },
    },
    personal: { type: 'OBJECT', properties: { birth_year: STR, gender: en(['남', '여']), region: STR } },
    credit_card: { type: 'OBJECT', properties: { use: en(['사용', '미사용']), amount_manwon: NUM } },
    history: STR,
    special_notes: STR,
    next_action: STR,
    case_type_suggestion: en(['개인회생', '파산', '새출발기금', '신용회복']),
  },
  required: ['debt', 'income', 'family', 'housing', 'personal'],
};

const n = (v: any) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));
const s = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** recording-analyze normalize()와 같은 규칙 */
const normalize = (d: any): ExtractedInfo => {
  const debt = d?.debt || {};
  const creditors = Array.isArray(debt.creditors) ? debt.creditors.map((x: any) => ({
    name: s(x?.name), kind: x?.kind || '기타', amount_manwon: n(x?.amount_manwon), note: s(x?.note),
  })) : [];
  const sum = creditors.reduce((t: number, x: any) => t + (x.amount_manwon || 0), 0);
  return {
    debt: { total_manwon: n(debt.total_manwon) ?? (sum > 0 ? sum : null), monthly_payment_manwon: n(debt.monthly_payment_manwon), overdue: s(debt.overdue), creditors },
    income: {
      net_monthly_manwon: n(d?.income?.net_monthly_manwon), salary_manwon: n(d?.income?.salary_manwon),
      business_manwon: n(d?.income?.business_manwon), freelance_manwon: n(d?.income?.freelance_manwon),
      job: s(d?.income?.job), job_types: Array.isArray(d?.income?.job_types) ? d.income.job_types : [], insurance4: d?.income?.insurance4 || null,
      workplace: s(d?.income?.workplace), business_place: s(d?.income?.business_place),
    },
    family: { marital_status: d?.family?.marital_status || null, children_count: n(d?.family?.children_count), note: s(d?.family?.note) },
    housing: {
      type: d?.housing?.type || null, detail: d?.housing?.detail || null, deposit_manwon: n(d?.housing?.deposit_manwon), rent_manwon: n(d?.housing?.rent_manwon),
      deposit_loan_manwon: n(d?.housing?.deposit_loan_manwon), own_house_price_manwon: n(d?.housing?.own_house_price_manwon),
      own_house_loan_manwon: n(d?.housing?.own_house_loan_manwon), contractor: d?.housing?.contractor || null,
    },
    assets: Array.isArray(d?.assets) ? d.assets.map((a: any) => ({ type: a?.type || '기타', owner: a?.owner || null, amount_manwon: n(a?.amount_manwon), loan_manwon: n(a?.loan_manwon), desc: s(a?.desc) })) : [],
    personal: { birth_year: d?.personal?.birth_year ? String(d.personal.birth_year).replace(/[^0-9]/g, '').slice(0, 4) || null : null, gender: d?.personal?.gender || null, region: s(d?.personal?.region) },
    credit_card: { use: d?.credit_card?.use || null, amount_manwon: n(d?.credit_card?.amount_manwon) },
    history: s(d?.history),
    special_notes: s(d?.special_notes),
    next_action: s(d?.next_action),
    customer_intent: '알 수 없음',
    case_type_suggestion: d?.case_type_suggestion || null,
  };
};

const MAX_TEXT = 50_000;

/** AI 요약·대화록 글 → 고객 정보. 실패하면 한국어 문구의 Error */
export const extractFromSummaryText = async (text: string, c: Case): Promise<ExtractedInfo> => {
  const body = String(text || '').replace(/^\[오류 발생\][\s\S]*$/m, '').trim();
  if (!body) throw new Error('정보를 뽑을 AI 요약문이 없습니다. 먼저 AI 분석을 하세요.');
  const prompt = `당신은 개인회생·파산·신용회복 1차 상담 기록을 정리하는 보조 AI입니다.
아래는 한 고객과의 통화를 AI가 요약한 글과 대화록입니다. 이 글에 실제로 적힌 내용만 골라 JSON으로만 답하세요.

[고객 등록 정보 (참고용, 그대로 베끼지 말 것)]
- 이름: ${c.customerName || '알 수 없음'}

[규칙]
- 금액은 모두 "만원" 단위 숫자 (예: 3천5백만원 → 3500, 150만원 → 150, 1억2천 → 12000, "약 110~130만원"처럼 범위면 가운데 값 120).
- 글에 없는 값은 null (추측 금지). "없음", "해당 없음"이라고 적혀 있으면 금액은 0, 목록은 빈 배열.
- creditors: 적힌 채권자마다 한 줄 (name = 금융사·업체 이름, 모르면 null). 카드값은 kind="카드값".
- income.net_monthly_manwon: 세후 월 실수령. 직업별 수입은 salary(직장인·일용직)/business(사업자)/freelance(프리랜서).
- income.workplace: 직장인·일용직·프리랜서의 직장(일하는 곳) 지역. income.business_place: 사업자의 사업장 지역. "서울 강남구"처럼 시·구 단위로.
- personal.region: 고객이 사는 지역. birth_year: 4자리 출생년도.
- debt.monthly_payment_manwon: 지금 매달 갚는 금액.
- history: 예전 개인회생·파산·신용회복·워크아웃 이력.
- special_notes: 압류·독촉·급한 사정·가족 몰래 진행 희망·연락 가능 시간 등.
- next_action: 약속한 다음 행동.

[AI 요약문·대화록]
${body.slice(0, MAX_TEXT)}`;
  const r = await callAi({
    task: 'summary_extract',
    prompt,
    responseMimeType: 'application/json',
    responseSchema: SCHEMA,
    temperature: 0.1,
  });
  let data: any;
  try { data = JSON.parse(r.text); } catch { throw new Error('AI 응답을 읽지 못했습니다. 다시 시도해 주세요.'); }
  return normalize(data);
};
