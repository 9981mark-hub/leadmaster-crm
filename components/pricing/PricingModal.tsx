import React, { useState } from 'react';
import { 
  Check, Sparkles, Building2, ShieldCheck, Zap, Headphones, 
  ArrowRight, X, HelpCircle, ChevronDown, ChevronUp, Calculator,
  Radio, HardDrive, Cpu, Bot, Award
} from 'lucide-react';
import { calculateOrgMonthlyBill } from '../../services/platform';
import CompanySignupModal from '../CompanySignupModal';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan?: (planKey: string) => void;
}

export default function PricingModal({ isOpen, onClose, onSelectPlan }: PricingModalProps) {
  const [seatCount, setSeatCount] = useState<number>(10);
  const [isAnnual, setIsAnnual] = useState<boolean>(false);
  const [signupModalOpen, setSignupModalOpen] = useState<boolean>(false);
  const [selectedPlanForSignup, setSelectedPlanForSignup] = useState<string>('business');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  if (!isOpen) return null;

  // 볼륨 계산
  const bill = calculateOrgMonthlyBill(seatCount);
  const discountMultiplier = isAnnual ? 0.83 : 1.0; // 연간 결제 17% 할인 (2개월 무료)
  const effectiveMonthlyTotal = Math.round(bill.totalPrice * discountMultiplier);
  const effectiveUnitPrice = Math.round(bill.unitPrice * discountMultiplier);

  // 타사 분리 도입 대비 절감액 (타사 평균 다이얼러 4만 + 녹음 3만 + AI 분석 5만 = 인당 12만원)
  const separateCost = seatCount * 120000;
  const monthlySavings = Math.max(0, separateCost - effectiveMonthlyTotal);

  const handleStartPlan = (planKey: string) => {
    setSelectedPlanForSignup(planKey);
    setSignupModalOpen(true);
    if (onSelectPlan) onSelectPlan(planKey);
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
        '메가 센터(101인+) ₩38,000 추가 인하',
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
    <>
      <div 
        className="fixed inset-0 z-50 bg-slate-50/85 dark:bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div 
          className="w-full max-w-5xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 text-slate-100 max-h-[92vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                <Sparkles size={13} />
                <span>투명한 볼륨 기반 올인원 요금제</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                상담원 규모에 맞춘 가장 합리적인 사용료
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                추가 모듈 비용 0원 • 다이얼러, 1년 녹음 스토리지, AI 채무분석, 정산센터까지 전 플랜 기본 포함
              </p>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-white hover:bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* 🧮 인터랙티브 비용 시뮬레이터 카드 */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/40 border border-blue-500/30 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Calculator size={18} className="text-blue-600 dark:text-blue-400" />
                <span>실시간 월 도입 비용 시뮬레이터</span>
              </div>
              {/* 연간 결제 토글 */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 text-xs">
                <span className={!isAnnual ? 'text-white font-bold' : 'text-slate-500 dark:text-slate-400'}>월간 청구</span>
                <button
                  type="button"
                  onClick={() => setIsAnnual(!isAnnual)}
                  className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${isAnnual ? 'bg-blue-600' : 'bg-slate-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isAnnual ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className={isAnnual ? 'text-blue-300 font-bold' : 'text-slate-500 dark:text-slate-400'}>
                  연간 결제 (2개월 무료)
                </span>
              </div>
            </div>

            {/* 슬라이더 컨트롤 */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium">우리 사무실 상담원 인원수:</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                  {seatCount}명
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="120"
                value={seatCount}
                onChange={e => setSeatCount(Number(e.target.value))}
                className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-slate-500 font-mono">
                <span>1명 (스타터)</span>
                <span>10명</span>
                <span>25명</span>
                <span>50명</span>
                <span>100명+ (메가센터)</span>
              </div>
            </div>

            {/* 시뮬레이션 결과 3-Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">적용 볼륨 티어</div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Award size={14} className="text-amber-600 dark:text-amber-400" />
                  <span>{bill.tierName}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">1인당 월 단가 (VAT 별도)</div>
                <div className="text-sm font-bold font-mono text-white">
                  ₩{effectiveUnitPrice.toLocaleString()} <span className="text-xs text-slate-500 dark:text-slate-400">/ 석</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/40 space-y-1">
                <div className="text-xs text-blue-300 font-semibold">월 총 사용료 (VAT 별도)</div>
                <div className="text-lg font-black font-mono text-blue-600 dark:text-blue-400">
                  ₩{effectiveMonthlyTotal.toLocaleString()}
                </div>
              </div>
            </div>

            {monthlySavings > 0 && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                <span>💡 개별 다이얼러·녹음·AI 솔루션 분리 도입 대비 월 예상 절감액:</span>
                <span className="font-mono font-bold">약 ₩{monthlySavings.toLocaleString()}원 절감!</span>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* 🏷️ 4대 볼륨 티어 카드 비교 그리드 */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {TIERS.map(tier => {
              const displayPrice = isAnnual ? Math.round(tier.unitPrice * 0.83) : tier.unitPrice;
              return (
                <div 
                  key={tier.id}
                  className={`rounded-2xl p-5 flex flex-col justify-between transition-all ${
                    tier.highlight
                      ? 'bg-white dark:bg-gray-900 border-2 border-blue-500 shadow-xl shadow-blue-500/10 relative scale-[1.02]'
                      : 'bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="space-y-4">
                    <div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        tier.highlight 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}>
                        {tier.badge}
                      </span>
                      <h3 className="text-base font-bold text-white mt-2">{tier.name}</h3>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{tier.seats}</div>
                    </div>

                    <div className="pt-1 border-t border-slate-200 dark:border-slate-800">
                      <div className="text-2xl font-black font-mono text-white">
                        ₩{displayPrice.toLocaleString()}
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-normal"> /월/석</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">부가세(VAT) 별도 • 청구서 발행</div>
                    </div>

                    <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                      {tier.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-snug">
                          <Check size={13} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6">
                    <button
                      type="button"
                      onClick={() => handleStartPlan(tier.id)}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        tier.highlight
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      <span>도입 신청하기</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* 🛡️ 10대 올인원 기본 포함 기능 배너 */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>모든 플랜에 기본 포함되는 리드마스터 10대 핵심 기능</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-slate-600 dark:text-slate-300">
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

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* ❓ 자주 묻는 질문 (FAQ) */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className="space-y-3 pt-2">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <HelpCircle size={15} className="text-blue-600 dark:text-blue-400" />
              <span>자주 묻는 질문 (FAQ)</span>
            </h4>
            <div className="space-y-2">
              {FAQS.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div 
                    key={idx}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full p-3.5 text-left text-xs font-bold text-slate-200 flex items-center justify-between hover:bg-white dark:bg-gray-900 transition-colors cursor-pointer"
                    >
                      <span>Q. {faq.q}</span>
                      {isOpen ? <ChevronUp size={14} className="text-slate-500 dark:text-slate-400" /> : <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />}
                    </button>
                    {isOpen && (
                      <div className="p-3.5 pt-0 text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-850 bg-slate-50/90 dark:bg-slate-950/90">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 하단 푸터 액션 */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <span>도입 문의 및 대형 엔터프라이즈 상담: 010-4683-4901</span>
            <button
              type="button"
              onClick={() => handleStartPlan('business')}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <span>7일 무료 체험 신청하기</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 가입 신청 및 약관 동의 모달 */}
      <CompanySignupModal
        isOpen={signupModalOpen}
        onClose={() => setSignupModalOpen(false)}
        initialPlan={selectedPlanForSignup}
      />
    </>
  );
}
