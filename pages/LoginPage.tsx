import React, { useState } from 'react';
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
    CreditCard,
    ShieldCheck,
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
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white relative overflow-hidden">

            {/* 엔터프라이즈 정밀 그리드 & 스튜디오 배경 */}
            <div
                className="pointer-events-none fixed inset-0 opacity-[0.45] dark:opacity-[0.18]"
                style={{
                    backgroundImage:
                        'linear-gradient(to right, rgba(148,163,184,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.14) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    maskImage: 'radial-gradient(ellipse 80% 70% at 50% 25%, #000 40%, transparent 100%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 25%, #000 40%, transparent 100%)',
                }}
            />
            <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[420px] rounded-full bg-blue-600/[0.06] dark:bg-blue-500/[0.12] blur-[110px]" />

            {/* 모바일 브라우저 전용 앱 다운로드 스마트 알림바 */}
            {isAndroidDevice && (
                <div className="relative z-20 bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-xs border-b border-slate-800">
                    <div className="flex items-center gap-2 font-semibold truncate">
                        <Smartphone size={15} className="text-blue-400 shrink-0" />
                        <span>리드마스터 안드로이드 전용 앱</span>
                    </div>
                    <a
                        href="./app/LeadMaster.apk"
                        download="LeadMaster.apk"
                        className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                        <Download size={13} className="shrink-0" />
                        <span>앱 받기</span>
                    </a>
                </div>
            )}

            {/* 상단 글로벌 내비게이션 바 */}
            <header className="relative z-10 border-b border-slate-200/90 dark:border-slate-800/80 bg-white/85 dark:bg-[#090D16]/85 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <img
                            src={`${import.meta.env.BASE_URL}leadmaster_logo_horizontal.png`}
                            alt="LeadMaster CRM"
                            className="h-7 sm:h-8 w-auto object-contain dark:hidden"
                        />
                        <img
                            src={`${import.meta.env.BASE_URL}leadmaster_logo_horizontal_dark.png`}
                            alt="LeadMaster CRM"
                            className="h-7 sm:h-8 w-auto object-contain hidden dark:block"
                        />
                        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                            Enterprise Cloud
                        </span>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => setShowPricingModal(true)}
                            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                            <CreditCard size={13} className="text-slate-500 dark:text-slate-400" />
                            <span>요금 시뮬레이터</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSignupInitialEmail('');
                                setShowSignupModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white transition-colors shadow-xs cursor-pointer"
                        >
                            <span>도입 신청</span>
                            <ArrowRight size={12} />
                        </button>
                    </div>
                </div>
            </header>

            {/* 본문: 2열 B2B SaaS 쇼케이스 & 로그인 포털 */}
            <main className="relative z-10 flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full px-5 sm:px-8 py-10 lg:py-14 items-center justify-between gap-10 lg:gap-14">

                {/* 좌측: B2B SaaS 가치 제안 & 4대 핵심 기능 Bento */}
                <div className="w-full lg:w-7/12 space-y-7 animate-in fade-in duration-500">

                    {/* 히어로 타이틀 */}
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            <span>로펌 · TM 법인을 위한 실전 영업 자동화 CRM</span>
                        </div>

                        <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-slate-900 dark:text-white leading-[1.34] break-keep">
                            상담원은 통화만 하세요,
                            <br />
                            <span className="mt-1 inline-block bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 dark:from-blue-400 dark:via-indigo-300 dark:to-cyan-300 bg-clip-text text-transparent">
                                정리는 AI가 다 합니다
                            </span>
                        </h1>

                        <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl break-keep">
                            비싼 DB 날리지 않게 <strong className="text-slate-900 dark:text-slate-200 font-semibold">1만 2천 명 AI 가상 고객</strong>으로 먼저 훈련시키고,
                            통화가 끝나면 AI가 작성한 보고서를 <strong className="text-slate-900 dark:text-slate-200 font-semibold">원클릭으로 텔방에 전송</strong>합니다.
                            수백 명의 활동 평가와 주간 정산까지 관리자 혼자 완벽하게 통제하세요.
                        </p>
                    </div>

                    {/* 4대 핵심 특장점 Bento 그리드 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* 1. 관리자 통제 */}
                        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700/70 transition-all flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/25 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <Users size={18} />
                                </div>
                                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/60">
                                    실시간 AI 채점
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                <h3 className="font-bold text-[15px] text-slate-900 dark:text-slate-100 break-keep">
                                    수백 명도 관리자 혼자 완벽 통제
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-keep">
                                    전 상담원의 콜 수·녹음과 상세 활동 내역을 실시간 확인하고, AI가 상담 품질 점수를 즉시 채점합니다.
                                </p>
                            </div>
                        </div>

                        {/* 2. 원클릭 접수 */}
                        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700/70 transition-all flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                    <Send size={18} />
                                </div>
                                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/60">
                                    1초 텔방 전송
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                <h3 className="font-bold text-[15px] text-slate-900 dark:text-slate-100 break-keep">
                                    상담원은 통화만, 접수는 원클릭
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-keep">
                                    통화 종료 즉시 AI가 법률사무소 전달용 핵심 요약을 생성합니다. 확인 후 버튼 한 번으로 텔방에 즉시 전송됩니다.
                                </p>
                            </div>
                        </div>

                        {/* 3. AI 가상 고객 훈련 */}
                        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700/70 transition-all flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-100 dark:border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <GraduationCap size={18} />
                                </div>
                                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/60">
                                    12,000+ 페르소나
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                <h3 className="font-bold text-[15px] text-slate-900 dark:text-slate-100 break-keep">
                                    1만 2천 명 AI와 실전 전화 연습
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-keep">
                                    채무·자산·소득·성격이 모두 다른 1만 2천 명 가상 고객과 실제 음성으로 훈련해 거절 반론을 완벽히 극복합니다.
                                </p>
                            </div>
                        </div>

                        {/* 4. 1초 자동 정산 */}
                        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700/70 transition-all flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                    <Calculator size={18} />
                                </div>
                                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-800/60">
                                    엑셀 야근 Zero
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                <h3 className="font-bold text-[15px] text-slate-900 dark:text-slate-100 break-keep">
                                    골치 아픈 엑셀 정산 제로, 1초 정산
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-keep">
                                    거래처별 DB 단가와 상담원 급여를 자동 계산해 청구서까지 1초 만에 완성하고 실시간 수익률을 확인합니다.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 신뢰 및 보안 아키텍처 배지 바 */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3 text-xs font-medium text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>고객 DB 타사 유출 100% 차단</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Lock size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                            <span>개인 채무 정보 TLS·DB 암호화</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <EyeOff size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span>화면 캡처 방지 &amp; 번호 마스킹</span>
                        </div>
                    </div>
                </div>

                {/* 우측: 엔터프라이즈 로그인 포털 카드 */}
                <div className="w-full lg:w-5/12 max-w-[420px] animate-in fade-in duration-500">
                    <div className="bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)] dark:shadow-2xl overflow-hidden">

                        {/* 카드 상단 포인트 바 */}
                        <div className="h-1 w-full bg-gradient-to-r from-slate-900 via-blue-600 to-indigo-600" />

                        <div className="p-6 sm:p-8 space-y-6">
                            {/* 카드 헤더 */}
                            <div className="text-center space-y-2">
                                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-slate-900 dark:bg-blue-600 text-white font-black text-sm tracking-tight shadow-sm mb-1">
                                    LM
                                </div>
                                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                    워크스페이스 로그인
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 break-keep">
                                    사내에 등록된 승인 Google 계정으로 즉시 업무 공간에 접속하세요
                                </p>
                            </div>

                            {/* Google SSO 로그인 영역 */}
                            <div className="space-y-3">
                                <div className="w-full flex justify-center">
                                    <div className="w-full max-w-[320px] flex justify-center rounded-full overflow-hidden shadow-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
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
                                <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                                    초대받은 Google 계정으로 로그인하면 소속 팀에 자동 연결됩니다.
                                </p>
                            </div>

                            {/* 구분선 */}
                            <div className="relative flex items-center py-1">
                                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                                <span className="shrink-0 mx-3 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                                    신규 도입 및 요금 안내
                                </span>
                                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                            </div>

                            {/* 신규 도입 / 요금 시뮬레이터 버튼 */}
                            <div className="space-y-2.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSignupInitialEmail('');
                                        setShowSignupModal(true);
                                    }}
                                    className="w-full py-2.5 px-4 rounded-xl bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer group"
                                >
                                    <Building2 size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                    <span>신규 TM 회사 가입 신청 / 전자계약</span>
                                    <ArrowRight size={13} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowPricingModal(true)}
                                    className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                                >
                                    <CreditCard size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span>프로그램 사용료 및 비용 시뮬레이터 안내</span>
                                    <ArrowRight size={12} className="opacity-50" />
                                </button>
                            </div>

                            {/* 모바일 APK 전용 바 */}
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                                    <Smartphone size={14} className="text-blue-600 dark:text-blue-400" />
                                    <span>모바일 앱 <span className="text-slate-400 font-mono text-[11px]">v1.8.4</span></span>
                                </span>
                                <div className="flex items-center gap-2.5">
                                    <a
                                        href="./app/LeadMaster.apk"
                                        download="LeadMaster.apk"
                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold hover:underline flex items-center gap-1"
                                    >
                                        <Download size={12} />
                                        <span>APK 받기</span>
                                    </a>
                                    <span className="text-slate-300 dark:text-slate-700">&middot;</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowGuide(true)}
                                        className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium cursor-pointer"
                                    >
                                        설치 안내
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 카드 하단 보안 안내 */}
                    <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 text-center">
                        <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>보안 접속 중 &middot; 비인가 접근 및 무단 데이터 반출은 법적 제재 대상입니다.</span>
                    </div>
                </div>

            </main>

            {/* 하단 푸터 */}
            <footer className="relative z-10 border-t border-slate-200/90 dark:border-slate-800/80 bg-white/70 dark:bg-[#090D16]/80 backdrop-blur-sm px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p>&copy; {new Date().getFullYear()} LeadMaster CRM. Multi-tenant B2B Cloud. All rights reserved.</p>
                    <div className="flex items-center gap-4 text-xs">
                        <a href="./privacy.html" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">개인정보처리방침</a>
                        <a href="./terms.html" className="hover:text-slate-900 dark:hover:text-slate-200 hover:underline">이용약관</a>
                        <span>고객지원: <a href="mailto:support@lmaster.xyz" className="text-slate-700 dark:text-slate-300 font-medium hover:underline">support@lmaster.xyz</a></span>
                    </div>
                </div>
            </footer>

            {/* 모바일 앱 1분 설치 가이드 모달 */}
            {showGuide && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                <Smartphone size={16} className="text-blue-600 dark:text-blue-400" />
                                <span>모바일 전용 앱 설치 가이드</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowGuide(false)}
                                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3 text-left text-xs text-slate-600 dark:text-slate-300">
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                리드마스터 앱은 사내 업무 및 010 스마트 통화 연동 전용으로 배포되는 안전한 APK입니다.
                            </p>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full bg-blue-600 text-[11px] text-white flex items-center justify-center">1</span>
                                    <span>출처를 알 수 없는 앱 허용</span>
                                </span>
                                <p className="text-xs text-slate-500 dark:text-slate-400 pl-5.5">브라우저 다운로드 시 &apos;이 출처의 앱 설치 허용&apos;을 켜주세요.</p>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full bg-blue-600 text-[11px] text-white flex items-center justify-center">2</span>
                                    <span>Play 프로텍트 무시하고 설치</span>
                                </span>
                                <p className="text-xs text-slate-500 dark:text-slate-400 pl-5.5">보안 팝업 발생 시 &apos;세부정보 더보기 &rarr; 무시하고 설치&apos;를 선택합니다.</p>
                            </div>
                        </div>

                        <div className="pt-2 flex gap-2">
                            <a
                                href="./app/LeadMaster.apk"
                                download="LeadMaster.apk"
                                onClick={() => setShowGuide(false)}
                                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs text-center flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                            >
                                <Download size={14} />
                                <span>APK 즉시 다운로드</span>
                            </a>
                            <button
                                type="button"
                                onClick={() => setShowGuide(false)}
                                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 커스텀 알림/경고 팝업 */}
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

            {/* 신규 TM 회사 도입 / 가입 신청 모달 */}
            <CompanySignupModal
                isOpen={showSignupModal}
                onClose={() => setShowSignupModal(false)}
                initialEmail={signupInitialEmail}
            />

            {/* 프로그램 사용료 및 비용 시뮬레이터 안내 모달 */}
            <PricingModal
                isOpen={showPricingModal}
                onClose={() => setShowPricingModal(false)}
            />

        </div>
    );
}
