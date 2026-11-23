import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Check, Sparkles, Building2, ShieldCheck, Zap, Headphones, 
  ArrowRight, ArrowLeft, HelpCircle, ChevronDown, ChevronUp, Calculator,
  Award, FileText
} from 'lucide-react';
import { calculateOrgMonthlyBill } from '../services/platform';
import CompanySignupModal from '../components/CompanySignupModal';

export default function PricingPage() {
  const navigate = useNavigate();
  const [seatCount, setSeatCount] = useState<number>(10);
  const [isAnnual, setIsAnnual] = useState<boolean>(false);
  const [signupModalOpen, setSignupModalOpen] = useState<boolean>(false);
  const [selectedPlanForSignup, setSelectedPlanForSignup] = useState<string>('business');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // 볼륨 계산
  const bill = calculateOrgMonthlyBill(seatCount);
  const discountMultiplier = isAnnual ? 0.83 : 1.0;
  const effectiveMonthlyTotal = Math.round(bill.totalPrice * discountMultiplier);
  const effectiveUnitPrice = Math.round(bill.unitPrice * discountMultiplier);

  const separateCost = seatCount * 120000;
  const monthlySavings = Math.max(0, separateCost - effectiveMonthlyTotal);

  const handleStartPlan = (planKey: string) => {
    setSelectedPlanForSignup(planKey);
    setSignupModalOpen(true);
  };

  const TIERS = [
    {
      id: 'starter',
      name: '스타터 (Starter)',
      seats: '1 ~ 5인',
      unitPrice: 58000,
      badge: '소규모 TM / 개인 법률사무소',
      highlight: false,
      features: [
        '안드로이드 1초 1콜 자동 다이얼러',
        '통화 녹음 1년 보관 & D-30 백업센터',
        '단말 H/W 32kbps AAC 모노 초고속 압축',
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
      unitPrice: 52000,
      badge: '가장 인기 · 10% 볼륨 할인',
      highlight: true,
      features: [
        '스타터 전 기능 올인원 100% 포함',
        '팀별 실적 대시보드 & 팀장 권한 분리',
        '사내 텔레그램 리드 전송 봇 연동',
        '우선 기술 지원 및 온보딩 지원',
        '보안 프로필 및 화면 워터마크',
      ],
    },
    {
      id: 'pro',
      name: '프로 (Pro)',
      seats: '21 ~ 50인',
      unitPrice: 46000,
      badge: '중대형 센터 · 20% 볼륨 할인',
      highlight: false,
      features: [
        '비즈니스 전 기능 올인원 포함',
        '관리자 다중 권한(Tier 1~3) 정밀 제어',
        '대량 엑셀 원클릭 분배 엔진',
        'VIP 우선 서버 CDN 대역폭 배정',
      ],
    },
    {
      id: 'enterprise',
      name: '엔터프라이즈 (Enterprise)',
      seats: '51인 이상',
      unitPrice: 42000,
      badge: '대형 법무법인 · 30%+ 할인',
      highlight: false,
      features: [
        '프로 전 기능 올인원 포함',
        '메가 센터(101인+) ₩ 38,000 추가 인하',
        '전담 매니저 핫라인 및 맞춤 인프라',
        '커스텀 계약서 및 감사 로그 영구 보존',
      ],
    },
  ];

  const FAQS = [
    {
      q: '계약서는 따로 작성해야 하나요?',
      a: '별도의 서면 종이 계약서를 날인하실 필요가 없습니다. 도입 신청 시 전자서명법 제3조에 부합하는 웹 전자 이용계약(Clickwrap) 약관에 동의 체크하시면 서면 계약과 동일한 정식 법적 효력이 발생합니다.',
    },
    {
      q: '프로그램 사용료는 어떻게 결제하나요?',
      a: '신청 즉시 화면에 안내되는 공식 카카오뱅크 수납 계좌로 무통장입금 또는 기업 계좌이체해 주시면 되며, 입력해 주신 사업자 정보로 국세청 전자세금계산서가 즉시 청구/영수 발행됩니다.',
    },
    {
      q: '상담원 1명당 PC와 스마트폰을 둘 다 쓸 수 있나요?',
      a: '네, 완벽히 지원합니다! 리드마스터는 1계정당 [PC 웹 브라우저 1대 + 안드로이드 폰 1대]의 1인 1세트 페어링 환경을 100% 정규 보장합니다. 단, 동일 플랫폼(PC-PC 또는 폰-폰)의 동시 중복 접속만 차단됩니다.',
    },
    {
      q: '통화 녹음 파일은 1년 후 어떻게 되나요?',
      a: '업로드 후 365일(1년) 동안 안전하게 암호화 보관되며, 만료 30일 전부터 관리자 화면에 배너 알림을 드립니다. 관리자 화면의 [통화녹음 만료 & 백업 센터]에서 언제든 일괄 ZIP 다운로드하여 영구 보관하실 수 있습니다.',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary selection:text-primary-foreground">
      {/* 상단 내비게이션 바 */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/login" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors">
            <ArrowLeft size={16} />
            <span>로그인으로 돌아가기</span>
          </Link>
          <span className="text-border">|</span>
          <img 
            src={`${import.meta.env.BASE_URL}leadmaster_logo_horizontal_dark.png`} 
            alt="LeadMaster CRM" 
            className="h-7 w-auto object-contain"
          />
        </div>
        <button
          type="button"
          onClick={() => handleStartPlan('business')}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          7일 무료 체험 신청
        </button>
      </header>

      {/* 본문 콘텐츠 */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-8 py-10 sm:py-14 space-y-12">
        {/* 히어로 헤더 */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <Sparkles size={13} strokeWidth={1.75} />
            <span>리드마스터 CRM 공식 프로그램 사용료 안내</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
            합리적인 월 구독료로 시작하는<br />
            <span className="text-primary">
              올인원 TM CRM 시스템
            </span>
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            추가 모듈 비용 0원 • 다이얼러, 1년 녹음 스토리지, AI 채무분석, 정산센터까지 전 플랜 기본 포함
          </p>
        </div>

        {/* 인터랙티브 비용 시뮬레이터 카드 */}
        <div className="p-6 sm:p-8 rounded-xl bg-card border border-border space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-base font-bold text-foreground">
              <Calculator size={20} className="text-primary" strokeWidth={1.75} />
              <span>실시간 월 도입 비용 시뮬레이터</span>
            </div>
            {/* 연간 결제 스위치 */}
            <div className="inline-flex items-center bg-muted/60 p-0.5 rounded-lg border border-border text-xs">
              <button
                type="button"
                onClick={() => setIsAnnual(false)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  !isAnnual ? 'bg-card text-foreground font-bold shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                월간 청구
              </button>
              <button
                type="button"
                onClick={() => setIsAnnual(true)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  isAnnual ? 'bg-primary text-primary-foreground font-bold shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                연간 결제 (2개월 무료 · 17% 추가 할인)
              </button>
            </div>
          </div>

          {/* 슬라이더 컨트롤 */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium">우리 사무실 상담원 인원수:</span>
              <span className="text-2xl sm:text-3xl font-bold font-mono text-primary tabular-nums">
                {seatCount}명
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="120"
              value={seatCount}
              onChange={e => setSeatCount(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-2xs text-muted-foreground font-mono">
              <span>1명 (스타터)</span>
              <span>10명</span>
              <span>25명</span>
              <span>50명</span>
              <span>100명+ (메가센터)</span>
            </div>
          </div>

          {/* 시뮬레이션 결과 3-Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1 shadow-2xs">
              <div className="text-xs text-muted-foreground font-medium">적용 볼륨 티어</div>
              <div className="text-base font-bold text-foreground flex items-center gap-1.5">
                <Award size={16} className="text-primary" strokeWidth={1.75} />
                <span>{bill.tierName}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1 shadow-2xs">
              <div className="text-xs text-muted-foreground font-medium">1인당 월 단가 (VAT 별도)</div>
              <div className="text-base font-bold font-mono text-foreground tabular-nums">
                ₩ {effectiveUnitPrice.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">/ 석</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 space-y-1 shadow-2xs">
              <div className="text-xs text-primary font-semibold">월 총 청구 금액 (VAT 별도)</div>
              <div className="text-2xl font-bold font-mono text-primary tabular-nums">
                ₩ {effectiveMonthlyTotal.toLocaleString()}
              </div>
            </div>
          </div>

          {monthlySavings > 0 && (
            <div className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span>💡 개별 솔루션(다이얼러 + 녹음 서버 + AI 분석) 분리 도입 대비:</span>
              <span className="font-mono font-bold">월 약 ₩ {monthlySavings.toLocaleString()}원 이상 절감 효과!</span>
            </div>
          )}
        </div>

        {/* 4대 볼륨 티어 카드 비교 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map(tier => {
            const displayPrice = isAnnual ? Math.round(tier.unitPrice * 0.83) : tier.unitPrice;
            return (
              <div 
                key={tier.id}
                className={`rounded-xl p-6 flex flex-col justify-between transition-all ${
                  tier.highlight
                    ? 'bg-card border-2 border-primary/60 shadow-lg shadow-primary/10 relative'
                    : 'bg-card border border-border hover:border-primary/30 shadow-2xs'
                }`}
              >
                <div className="space-y-5">
                  <div>
                    <span className={`text-2xs font-semibold px-2 py-0.5 rounded-md border ${
                      tier.highlight 
                        ? 'bg-primary/15 text-primary border-primary/30 font-bold' 
                        : 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {tier.badge}
                    </span>
                    <h3 className="text-lg font-bold text-foreground mt-2.5">{tier.name}</h3>
                    <div className="text-xs text-muted-foreground">{tier.seats}</div>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <div className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${tier.highlight ? 'text-primary' : 'text-foreground'}`}>
                      ₩ {displayPrice.toLocaleString()}
                      <span className="text-xs text-muted-foreground font-normal"> /월/석</span>
                    </div>
                    <div className="text-2xs text-muted-foreground mt-0.5">부가세(VAT) 별도 • 청구서 발행</div>
                  </div>

                  <ul className="space-y-2 text-xs text-muted-foreground pt-2 border-t border-border">
                    {tier.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-snug">
                        <Check size={13} className="text-primary shrink-0 mt-0.5" strokeWidth={2} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6">
                  <button
                    type="button"
                    onClick={() => handleStartPlan(tier.id)}
                    className={`w-full py-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      tier.highlight
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs'
                        : 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                    }`}
                  >
                    <span>이 플랜으로 시작하기</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 10대 기본 포함 기능 배너 */}
        <div className="p-6 rounded-xl bg-card border border-border space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <ShieldCheck size={18} className="text-primary" strokeWidth={1.75} />
            <span>모든 플랜에 기본 포함되는 리드마스터 10대 핵심 기능</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5">⚡ 1초 1콜 자동 다이얼러</span>
            <span className="flex items-center gap-1.5">💾 통화녹음 1년 암호화 보관</span>
            <span className="flex items-center gap-1.5">🗜️ 32kbps H/W 가속 압축</span>
            <span className="flex items-center gap-1.5">🎧 차세대 스마트 플레이어</span>
            <span className="flex items-center gap-1.5">🤖 Gemini AI 채무진단 요약</span>
            <span className="flex items-center gap-1.5">🎓 12,000명 가상고객 훈련</span>
            <span className="flex items-center gap-1.5">💵 수당 정산 및 분배 엔진</span>
            <span className="flex items-center gap-1.5">📱 1계정 PC+폰 페어링</span>
            <span className="flex items-center gap-1.5">✈️ 텔레그램 리드 전송 봇</span>
            <span className="flex items-center gap-1.5">🔒 캡처차단 & 화면 워터마크</span>
          </div>
        </div>

        {/* FAQ 아코디언 */}
        <div className="space-y-4 pt-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <HelpCircle size={18} className="text-primary" strokeWidth={1.75} />
            <span>자주 묻는 질문 (FAQ)</span>
          </h3>
          <div className="space-y-2">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div 
                  key={idx}
                  className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 text-left text-xs sm:text-sm font-semibold text-foreground flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <span>Q. {faq.q}</span>
                    {isOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                  </button>
                  {isOpen && (
                    <div className="p-4 pt-0 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border bg-muted/15">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* 가입 신청 및 약관 동의 모달 */}
      <CompanySignupModal
        isOpen={signupModalOpen}
        onClose={() => setSignupModalOpen(false)}
        initialPlan={selectedPlanForSignup}
      />
    </div>
  );
}
