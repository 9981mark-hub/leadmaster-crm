import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { 
    Smartphone, 
    Download, 
    X, 
    Shield, 
    Sparkles,
    Users,
    Send,
    GraduationCap,
    Calculator,
    CheckCircle2,
    Lock,
    EyeOff,
    Building2,
    ArrowRight,
    CreditCard
} from 'lucide-react';
import CustomAlertModal from '../components/common/CustomAlertModal';
import CompanySignupModal from '../components/CompanySignupModal';
import PricingModal from '../components/pricing/PricingModal';

export default function LoginPage() {
    const { loginWithGoogle, authNotice, closeAuthNotice, openAuthNotice } = useAuth();
    const [showGuide, setShowGuide] = useState(false);
    const [showSignupModal, setShowSignupModal] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [signupInitialEmail, setSignupInitialEmail] = useState('');

    const isAndroidDevice = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white relative overflow-hidden">
            
            {/* 🌌 배경 은은한 오로라/글로우 효과 */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/15 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/15 blur-[140px] pointer-events-none" />
            <div className="absolute top-[30%] right-[20%] w-[350px] h-[350px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />

            {/* 📱 모바일 브라우저 전용 앱 다운로드 스마트 알림바 */}
            {isAndroidDevice && (
                <div className="relative z-20 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700 text-white px-4 py-2 flex items-center justify-between text-xs shadow-md border-b border-white/10">
                    <div className="flex items-center gap-1.5 font-bold text-xs truncate">
                        <Smartphone size={15} className="text-blue-200 shrink-0" />
                        <span>리드마스터 모바일 앱</span>
                    </div>
                    <a
                        href="./app/LeadMaster.apk"
                        download="LeadMaster.apk"
                        className="shrink-0 bg-white text-blue-800 font-bold px-3 py-1 rounded-md text-xs hover:bg-blue-50 transition-colors shadow-xs flex items-center gap-1 whitespace-nowrap"
                    >
                        <Download size={13} className="shrink-0" />
                        <span>앱 다운로드</span>
                    </a>
                </div>
            )}

            {/* 🔝 상단 글로벌 내비게이션 바 */}
            <header className="relative z-10 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img 
                        src={`${import.meta.env.BASE_URL}leadmaster_logo_horizontal_dark.png`} 
                        alt="LeadMaster CRM" 
                        className="h-8 w-auto object-contain"
                    />
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        <Sparkles size={11} /> Enterprise Cloud v4.5
                    </span>
                </div>
            </header>

            {/* 🎯 본문: 2열 B2B SaaS 쇼케이스 & 로그인 포털 레이아웃 */}
            <main className="relative z-10 flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 lg:py-12 items-center justify-between gap-12 lg:gap-16">
                
                {/* 👈 좌측: B2B SaaS 플랫폼 특장점 쇼케이스 (데스크톱 중심, 모바일 축약) */}
                <div className="w-full lg:w-7/12 space-y-8 animate-in fade-in duration-500">
                    
                    {/* 상단 타이틀 & 가치 제안 */}
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <Sparkles size={13} className="text-blue-600 dark:text-blue-400" />
                            <span>로펌·콜센터를 위한 실전 영업 자동화 CRM</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                            상담원은 통화만 하세요,<br />
                            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
                                정리는 AI가 다 합니다
                            </span>
                        </h1>
                        <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                            비싼 DB 날리지 않게 1만 2천 명 AI 고객으로 먼저 연습시키고, 
                            통화 끝나면 AI가 작성한 보고서를 버튼 한 번으로 텔방에 쏩니다. 
                            상담원 수백 명의 활동 내역·평가와 주간 정산까지 관리자 혼자서 완벽하게 끝내세요.
                        </p>
                    </div>

                    {/* 4대 핵심 특장점 카드 그리드 (2×2 그리드) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        {/* 1. 관리자: 수백 명 통제 */}
                        <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-sm space-y-2.5 hover:border-indigo-500/40 transition-colors">
                            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Users size={18} />
                            </div>
                            <h3 className="font-bold text-sm text-slate-200">수백 명도 관리자 혼자 완벽 통제</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                전 상담원의 오늘 콜 수와 녹음은 물론, 각 상담원의 상세 활동 내역과 성과 평가를 대시보드에서 실시간 확인하고 AI가 상담 점수를 즉시 채점합니다.
                            </p>
                        </div>

                        {/* 2. 상담원: 통화만, 접수는 원클릭 */}
                        <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-sm space-y-2.5 hover:border-blue-500/40 transition-colors">
                            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <Send size={18} />
                            </div>
                            <h3 className="font-bold text-sm text-slate-200">상담원은 통화만, 접수는 원클릭</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                통화가 끝나면 AI가 법률사무소에 보낼 핵심 내용을 알아서 일목요연하게 요약합니다. 내용 확인 후 버튼 딱 한 번 누르면 사내 텔방으로 즉시 전송됩니다.
                            </p>
                        </div>

                        {/* 3. 트레이닝: 1만 2천 명 AI 전화 연습 */}
                        <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-sm space-y-2.5 hover:border-emerald-500/40 transition-colors">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <GraduationCap size={18} />
                            </div>
                            <h3 className="font-bold text-sm text-slate-200">1만 2천 명 AI와 실전 전화 연습</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                나이·성격은 물론 채무·자산·소득 조건까지 제각각인 1만 2천 명 가상 고객과 실제 목소리로 통화 훈련하여 거절 반론을 완벽 정복합니다.
                            </p>
                        </div>

                        {/* 4. 정산/손익: 엑셀 야근 제로 1초 정산 */}
                        <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-sm space-y-2.5 hover:border-amber-500/40 transition-colors">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                <Calculator size={18} />
                            </div>
                            <h3 className="font-bold text-sm text-slate-200">골치 아픈 엑셀 정산 제로, 1초 정산</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                거래처별 DB 단가와 상담원 급여를 자동으로 계산해 청구서까지 1초 만에 완성하고, 광고 거래처별 실시간 수임 수익률을 한눈에 확인합니다.
                            </p>
                        </div>
                    </div>

                    {/* 신뢰 지표 & 보안 정책 */}
                    <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-850">
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                            <span>고객 DB 타사 유출 100% 차단</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Lock size={15} className="text-blue-600 dark:text-blue-400" />
                            <span>민감한 개인 채무 정보 철통 암호화</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <EyeOff size={15} className="text-indigo-600 dark:text-indigo-400" />
                            <span>화면 캡처 방지 & 번호 마스킹</span>
                        </div>
                    </div>

                </div>

                {/* 👉 우측: 프리미엄 로그인 카드 */}
                <div className="w-full lg:w-5/12 max-w-md animate-in fade-in duration-500">
                    <div className="bg-white/85 dark:bg-slate-900/85 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
                        
                        {/* 카드 상단 헤더 */}
                        <div className="space-y-1.5 text-center">
                            <h2 className="text-xl font-bold text-white tracking-tight">
                                워크스페이스 로그인
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                배정된 승인 계정으로 즉시 업무 공간에 접속하세요
                            </p>
                        </div>

                        {/* 구글 로그인 전용 영역 (흰 여백 완전 제거 & 다크 테마 완벽 일체화) */}
                        <div className="space-y-4 pt-2">
                            <div className="w-full flex justify-center">
                                <div className="w-full max-w-[320px] flex justify-center rounded-full overflow-hidden shadow-lg border border-slate-200/60 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900">
                                    <GoogleLogin
                                        onSuccess={(credentialResponse) => {
                                            if (credentialResponse.credential) {
                                                loginWithGoogle(credentialResponse.credential);
                                            }
                                        }}
                                        onError={() => {
                                            console.log('Login Failed');
                                            openAuthNotice({
                                                title: '구글 로그인 안내',
                                                message: '구글 로그인 창이 닫혔거나 차단되었습니다. 브라우저 팝업 설정을 확인해주세요.',
                                                type: 'warning',
                                            });
                                        }}
                                        shape="pill"
                                        size="large"
                                        theme="filled_black"
                                        text="continue_with"
                                        width="320"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-center text-slate-500 dark:text-slate-400 leading-relaxed">
                                사내 워크스페이스에 등록된 전용 구글 계정으로 원클릭 로그인됩니다.
                            </p>

                            {/* 🏢 신규 TM 회사 도입 / 가입 신청 창구 및 요금제 안내 버튼 */}
                            <div className="pt-1 space-y-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSignupInitialEmail('');
                                        setShowSignupModal(true);
                                    }}
                                    className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-blue-900/30 via-indigo-900/25 to-blue-900/30 border border-blue-500/30 hover:border-blue-400/60 text-blue-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer group shadow-sm"
                                >
                                    <Building2 size={14} className="text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                                    <span>신규 TM 회사 가입 신청 / 전자계약</span>
                                    <ArrowRight size={12} className="opacity-60 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowPricingModal(true)}
                                    className="w-full py-2 px-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                                >
                                    <CreditCard size={13} className="text-emerald-600 dark:text-emerald-400" />
                                    <span>프로그램 사용료 및 비용 시뮬레이터 안내</span>
                                    <ArrowRight size={11} className="opacity-40" />
                                </button>
                            </div>
                        </div>

                        {/* 모바일 APK 전용 안내 바 */}
                        <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                <Smartphone size={14} className="text-blue-600 dark:text-blue-400" />
                                <span>모바일 앱 (v1.8.4)</span>
                            </span>
                            <div className="flex items-center gap-2.5">
                                <a 
                                    href="./app/LeadMaster.apk" 
                                    download="LeadMaster.apk"
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-300 font-semibold hover:underline flex items-center gap-1 text-xs"
                                >
                                    <Download size={12} />
                                    <span>APK 받기</span>
                                </a>
                                <span className="text-slate-700">•</span>
                                <button
                                    type="button"
                                    onClick={() => setShowGuide(true)}
                                    className="text-slate-500 dark:text-slate-400 hover:text-slate-200 text-xs"
                                >
                                    설치 안내
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* 카드 하단 보안 및 테넌트 안내 문구 */}
                    <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500 text-center">
                        <Shield size={13} className="text-blue-500/70" />
                        <span>보안 접속 중: 비인가 사용자의 무단 침입은 법적 제재를 받을 수 있습니다.</span>
                    </div>

                </div>

            </main>

            {/* 📜 하단 푸터 바 */}
            <footer className="relative z-10 border-t border-slate-200 dark:border-slate-900 bg-slate-50/80 dark:bg-slate-950/80 px-6 py-4 text-xs text-slate-500">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p>© {new Date().getFullYear()} LeadMaster CRM. Multi-tenant B2B Cloud. All rights reserved.</p>
                    <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-xs">
                        <a href="./privacy.html" className="text-blue-600 dark:text-blue-400 hover:underline">개인정보처리방침</a>
                        <a href="./terms.html" className="hover:text-slate-200 hover:underline">이용약관</a>
                        <span>고객지원: <a href="mailto:support@lmaster.xyz" className="text-slate-600 dark:text-slate-300 hover:underline">support@lmaster.xyz</a></span>
                    </div>
                </div>
            </footer>

            {/* ❓ 모바일 앱 1분 설치 가이드 모달 */}
            {showGuide && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-gray-900 text-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                            <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                <Smartphone size={16} className="text-blue-600 dark:text-blue-400" />
                                <span>모바일 전용 앱 설치 가이드</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowGuide(false)}
                                className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3 text-left text-xs text-slate-600 dark:text-slate-300">
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                리드마스터 앱은 사내 업무 및 010 스마트 통화 연동 전용으로 배포되는 안전한 APK입니다.
                            </p>
                            <div className="p-3 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                                <span className="font-semibold text-white flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full bg-blue-500 text-xs text-white flex items-center justify-center">1</span>
                                    <span>출처를 알 수 없는 앱 허용</span>
                                </span>
                                <p className="text-xs text-slate-500 dark:text-slate-400 pl-5.5">브라우저 다운로드 시 '이 출처의 앱 설치 허용'을 켜주세요.</p>
                            </div>
                            <div className="p-3 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                                <span className="font-semibold text-white flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full bg-blue-500 text-xs text-white flex items-center justify-center">2</span>
                                    <span>Play 프로텍트 무시하고 설치</span>
                                </span>
                                <p className="text-xs text-slate-500 dark:text-slate-400 pl-5.5">보안 팝업 발생 시 '세부정보 더보기 ➔ 무시하고 설치'를 선택합니다.</p>
                            </div>
                        </div>

                        <div className="pt-2 flex gap-2">
                            <a
                                href="./app/LeadMaster.apk"
                                download="LeadMaster.apk"
                                onClick={() => setShowGuide(false)}
                                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs text-center flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                            >
                                <Download size={14} />
                                <span>APK 즉시 다운로드</span>
                            </a>
                            <button
                                type="button"
                                onClick={() => setShowGuide(false)}
                                className="py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🛡️ 톤앤매너 통일 커스텀 알림/경고 팝업 (미초대 계정, 구글 로그인 오류 등) */}
            {authNotice && authNotice.isOpen && (
                <CustomAlertModal
                    isOpen={authNotice.isOpen}
                    onClose={closeAuthNotice}
                    title={authNotice.title}
                    message={authNotice.message}
                    type={authNotice.type}
                    email={authNotice.email}
                    onApplyClick={() => {
                        setSignupInitialEmail(authNotice.email || '');
                        closeAuthNotice();
                        setShowSignupModal(true);
                    }}
                />
            )}

            {/* 🏢 신규 TM 회사 도입 / 가입 신청 모달 */}
            <CompanySignupModal
                isOpen={showSignupModal}
                onClose={() => setShowSignupModal(false)}
                initialEmail={signupInitialEmail}
            />

            {/* 💰 프로그램 사용료 및 비용 시뮬레이터 안내 모달 */}
            <PricingModal
                isOpen={showPricingModal}
                onClose={() => setShowPricingModal(false)}
            />

        </div>
    );
}
