import React, { useState } from 'react';
import { 
  Check, Sparkles, Building2, ShieldCheck, Zap, Headphones, 
  ArrowRight, Award, HelpCircle, CheckCircle2, ChevronRight, Users, Shield
} from 'lucide-react';

export interface PlanTier {
  id: string;
  name: string;
  seats: string;
  monthlyUnitPrice: number;
  annualUnitPrice: number;
  badge: string;
  popular?: boolean;
  description: string;
  features: string[];
}

interface PlanShowcaseSectionProps {
  currentTierId?: string;
  onSelectPlan: (planId: string) => void;
  onOpenSeatModal: () => void;
}

export const PLAN_TIERS_DATA: PlanTier[] = [
  {
    id: 'starter',
    name: '스타터 (Starter)',
    seats: '1 ~ 5인',
    monthlyUnitPrice: 58000,
    annualUnitPrice: 48000,
    badge: '소규모 부티크 TM / 신규 센터',
    description: '1초 1콜 고속 다이얼러와 AI 진단으로 소수정예 TM을 시작하세요.',
    features: [
      '안드로이드 1초 1콜 자동 다이얼러',
      '통화 녹음 1년 무제한 보관 & D-30 백업',
      '단말 H/W 32kbps 고음질 초고속 압축',
      '스마트 오디오 플레이어 & 대화록 점프',
      'Gemini AI 실시간 채무진단 요약',
      '12,000명 AI 가상고객 롤플레잉 트레이닝',
      '실시간 수당 정산 및 분배 센터',
    ],
  },
  {
    id: 'business',
    name: '비즈니스 (Business)',
    seats: '6 ~ 20인',
    monthlyUnitPrice: 52000,
    annualUnitPrice: 43000,
    badge: '가장 인기 · 10% 볼륨 할인',
    popular: true,
    description: '팀장 권한 분리와 실시간 대시보드로 조직적인 영업 관리를 지원합니다.',
    features: [
      '스타터 전 기능 100% 올인원 포함',
      '팀별 실적 대시보드 & 팀장 권한 분리',
      '사내 텔레그램 리드 전송 봇 연동',
      '보안 프로필 & 화면 워터마크 방어',
      '우선 기술 지원 및 전담 온보딩 지원',
      '계약서 자동 생성 및 전자서명 연동',
    ],
  },
  {
    id: 'pro',
    name: '프로 (Pro)',
    seats: '21 ~ 50인',
    monthlyUnitPrice: 46000,
    annualUnitPrice: 38000,
    badge: '중대형 센터 · 20% 볼륨 할인',
    description: '대량 리드 분배와 다중 권한 제어로 대규모 센터를 안전하게 지휘합니다.',
    features: [
      '비즈니스 전 기능 100% 올인원 포함',
      '관리자 다중 권한(Tier 1~3) 정밀 제어',
      '대량 엑셀 원클릭 분배 엔진',
      'VIP 전용 우선 서버 CDN 대역폭 배정',
      '상담원별 성과 분석 & 이상 징후 알림',
    ],
  },
  {
    id: 'enterprise',
    name: '엔터프라이즈 (Enterprise)',
    seats: '51 ~ 100인',
    monthlyUnitPrice: 42000,
    annualUnitPrice: 35000,
    badge: '대형 법무법인 · 28% 파격 할인',
    description: '전담 매니저 핫라인과 맞춤형 독립 인프라로 최고 수준의 안정성을 제공합니다.',
    features: [
      '프로 전 기능 100% 올인원 포함',
      '전담 매니저 배정 & 핫라인 긴급 지원',
      '커스텀 계약서 및 감사 로그 영구 보존',
      '맞춤형 전용 DB 인프라 격리',
      '커스텀 API & 웹훅 실시간 연동',
    ],
  },
];

export const PlanShowcaseSection: React.FC<PlanShowcaseSectionProps> = ({
  currentTierId = 'business',
  onSelectPlan,
  onOpenSeatModal,
}) => {
  const [isAnnual, setIsAnnual] = useState(true); // 연간 결제 기본 권장

  return (
    <div className="space-y-6">
      {/* 1. Header & Billing Cycle Toggle */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
              <Sparkles size={12} strokeWidth={1.75} />
              플랜 업그레이드 & 요금 안내
            </span>
            <span className="text-xs text-muted-foreground">
              걱정 없이 언제든지 위약금 없이 플랜을 변경하거나 해지할 수 있습니다.
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">
            조직 규모에 최적화된 리드마스터 맞춤 플랜
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            전화 다이얼러, 통화 녹음 백업, AI 채무 진단, 롤플레잉까지 모든 기능이 기본 포함되어 있습니다.
          </p>
        </div>

        {/* 연간 / 월간 세그먼트 토글 (ChatGPT & Notion 스타일) */}
        <div className="flex items-center self-start md:self-auto bg-muted/60 p-1 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setIsAnnual(false)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              !isAnnual
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            월간 결제
          </button>
          <button
            type="button"
            onClick={() => setIsAnnual(true)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              isAnnual
                ? 'bg-primary text-primary-foreground shadow-2xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>연간 결제</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              isAnnual ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'
            }`}>
              17% 할인 (2개월 무료)
            </span>
          </button>
        </div>
      </div>

      {/* 2. 4-Tier Grid Showcase (모바일: 가로 스와이프 / PC: 4열 그리드) */}
      <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-5 overflow-x-auto md:overflow-visible snap-x snap-mandatory pb-2 md:pb-0">
        {PLAN_TIERS_DATA.map((tier) => {
          const isCurrent = tier.id === currentTierId;
          const unitPrice = isAnnual ? tier.annualUnitPrice : tier.monthlyUnitPrice;

          return (
            <div
              key={tier.id}
              className={`relative rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 bg-card text-card-foreground min-w-[80vw] sm:min-w-[290px] md:min-w-0 snap-center shrink-0 ${
                tier.popular
                  ? 'border-2 border-primary shadow-xs ring-1 ring-primary/20'
                  : isCurrent
                  ? 'border-2 border-primary/70 shadow-xs'
                  : 'border border-border shadow-xs hover:border-primary/40'
              }`}
            >
              {/* 상단 뱃지 (가장 인기 or 현재 이용 중) */}
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold tracking-wide shadow-xs flex items-center gap-1">
                    <Sparkles size={11} strokeWidth={1.75} /> 가장 인기 있는 플랜
                  </span>
                </div>
              )}
              {isCurrent && !tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-0.5 rounded-full bg-muted text-foreground border border-border text-[11px] font-semibold tracking-wide shadow-xs flex items-center gap-1">
                    <CheckCircle2 size={11} strokeWidth={1.75} /> 현재 이용 중
                  </span>
                </div>
              )}

              <div>
                {/* 플랜 이름 & 대상 규모 */}
                <div className="flex items-center justify-between gap-2 mt-1">
                  <h3 className="text-base font-bold text-foreground">
                    {tier.name}
                  </h3>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                    {tier.seats}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mt-1 min-h-[32px] leading-relaxed">
                  {tier.description}
                </p>

                {/* 가격 영역 */}
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-bold text-foreground font-mono tabular-nums">
                      ₩ {unitPrice.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / 석 / 월
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center justify-between">
                    <span>VAT 별도</span>
                    {isAnnual && (
                      <span className="text-primary font-semibold font-mono">
                        정가 ₩ {tier.monthlyUnitPrice.toLocaleString()} 대비 할인
                      </span>
                    )}
                  </div>
                </div>

                {/* CTA 버튼 */}
                <div className="mt-4">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-3 rounded-xl bg-muted text-muted-foreground text-xs font-semibold border border-border cursor-default flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={14} className="text-primary" />
                      현재 이용 중인 플랜
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectPlan(tier.id)}
                      className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                        tier.popular
                          ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                          : 'bg-card border border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      <span>{tier.id === 'enterprise' ? '도입 문의하기' : `${tier.name.split(' ')[0]}로 변경`}</span>
                      <ArrowRight size={13} strokeWidth={1.75} />
                    </button>
                  )}
                </div>

                {/* 기능 목록 불릿 */}
                <div className="mt-5 space-y-2.5 pt-4 border-t border-border">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    포함된 핵심 기능
                  </div>
                  <ul className="space-y-2">
                    {tier.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2 text-xs text-muted-foreground leading-snug">
                        <Check size={14} className="text-primary shrink-0 mt-0.5" strokeWidth={2} />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. 메가 센터 (101인 이상) 대형 프랜차이즈 전용 배너 */}
      <div className="p-5 rounded-xl bg-card border border-border text-foreground shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <Building2 size={22} strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                101인 이상 대형 연합체 / 프랜차이즈 전용
              </span>
              <span className="text-xs text-muted-foreground">
                전국 최고 볼륨 우대 단가
              </span>
            </div>
            <h4 className="text-base sm:text-lg font-bold text-foreground mt-0.5">
              메가 센터 (Mega Center) 플랜 — 좌석당 <span className="text-primary font-bold font-mono tabular-nums">₩ 38,000</span> (최대 35% 우대 할인)
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              전담 엔지니어 핫라인, 본사-지사 멀티 워크스페이스 통합 관제, 맞춤형 On-Premise 하이브리드 연동을 무상 지원합니다.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectPlan('mega')}
          className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shrink-0 transition-all shadow-xs cursor-pointer flex items-center gap-1.5 self-start md:self-auto"
        >
          <span>메가센터 전담팀 문의</span>
          <ChevronRight size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
};
