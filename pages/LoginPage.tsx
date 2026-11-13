import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { 
    Smartphone, 
    Download, 
    X, 
    Shield, 
    Mail, 
    KeyRound, 
    Loader2, 
    ArrowRight,
    Zap,
    Cpu,
    Coins,
    CheckCircle2,
    Lock,
    ExternalLink,
    Building2,
    Sparkles
} from 'lucide-react';

export default function LoginPage() {
    const { loginWithGoogle, sendEmailOtp, verifyEmailOtp } = useAuth();
    const [showGuide, setShowGuide] = useState(false);
    const [authMethod, setAuthMethod] = useState<'google' | 'otp'>('google');
    const [email, setEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpError, setOtpError] = useState<string | null>(null);
    const [otpSuccess, setOtpSuccess] = useState<string | null>(null);

    const isAndroidDevice = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setOtpLoading(true);
        setOtpError(null);
        setOtpSuccess(null);
        try {
            await sendEmailOtp(email.trim());
            setOtpSent(true);
            setOtpSuccess('인증번호 6자리가 메일로 전송되었습니다. 메일함을 확인해주세요.');
        } catch (err: any) {
            setOtpError(err.message || '인증번호 발송에 실패했습니다.');
        } finally {
            setOtpLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otpCode.trim()) return;
        setOtpLoading(true);
        setOtpError(null);
        try {
            await verifyEmailOtp(email.trim(), otpCode.trim());
        } catch (err: any) {
            setOtpError(err.message || '인증번호 확인에 실패했습니다.');
        } finally {
            setOtpLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white relative overflow-hidden">
            
            {/* 🌌 배경 은은한 오로라/글로우 효과 */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/15 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/15 blur-[140px] pointer-events-none" />
            <div className="absolute top-[30%] right-[20%] w-[350px] h-[350px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />

            {/* 📱 모바일 브라우저 전용 앱 다운로드 스마트 알림바 */}
            {isAndroidDevice && (
                <div className="relative z-20 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700 text-white px-4 py-2.5 flex items-center justify-between text-xs shadow-md border-b border-white/10">
                    <div className="flex items-center gap-2 font-medium">
                        <Smartphone size={16} className="text-blue-200 animate-pulse" />
                        <span>리드마스터 모바일 앱 (v1.8.3)으로 최적화된 통화 업무를 시작하세요</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href="./app/LeadMaster.apk"
                            download="LeadMaster.apk"
                            className="bg-white text-blue-800 font-bold px-3 py-1 rounded-md text-[11px] hover:bg-blue-50 transition-colors shadow-xs"
                        >
                            앱 다운로드
                        </a>
                    </div>
                </div>
            )}

            {/* 🔝 상단 글로벌 내비게이션 바 */}
            <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img 
                        src={`${import.meta.env.BASE_URL}leadmaster_logo_horizontal_dark.png`} 
                        alt="LeadMaster CRM" 
                        className="h-8 w-auto object-contain"
                    />
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20">
                        <Sparkles size={11} /> Enterprise Cloud v4.5
                    </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                    <a href="./privacy.html" className="text-slate-300 hover:text-white transition-colors">개인정보처리방침</a>
                    <span className="text-slate-700">•</span>
                    <a href="./terms.html" className="text-slate-300 hover:text-white transition-colors">이용약관</a>
                </div>
            </header>

            {/* 🎯 본문: 2열 B2B SaaS 쇼케이스 & 로그인 포털 레이아웃 */}
            <main className="relative z-10 flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 lg:py-12 items-center justify-between gap-12 lg:gap-16">
                
                {/* 👈 좌측: B2B SaaS 플랫폼 특장점 쇼케이스 (데스크톱 중심, 모바일 축약) */}
                <div className="w-full lg:w-7/12 space-y-8 animate-in fade-in duration-500">
                    
                    {/* 상단 타이틀 & 가치 제안 */}
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <Building2 size={13} className="text-blue-400" />
                            <span>멀티 테넌트 B2B 올인원 클라우드 솔루션</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                            TM 아웃바운드 영업과<br />
                            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
                                전문 상담을 위한 엔터프라이즈 CRM
                            </span>
                        </h1>
                        <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl">
                            리드 접수부터 010 스마트 오토콜 발신, Gemini AI 통화 요약, 주간 거래처 정산 대장까지 
                            하나의 플랫폼에서 모든 영업 워크플로우를 완벽하게 통제하세요.
                        </p>
                    </div>

                    {/* 3대 핵심 SaaS 특장점 카드 그리드 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                        {/* 1. 오토콜 */}
                        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-2.5 hover:border-blue-500/40 transition-colors">
                            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                                <Zap size={18} />
                            </div>
                            <h3 className="font-bold text-sm text-slate-200">010 스마트 오토콜</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                반강제 무사고 연속 발신 HUD 및 일일 할당 자동 페이싱
                            </p>
                        </div>

                        {/* 2. AI 요약 */}
                        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-2.5 hover:border-indigo-500/40 transition-colors">
                            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                                <Cpu size={18} />
                            </div>
                            <h3 className="font-bold text-sm text-slate-200">Gemini AI 통화 요약</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                순정 녹취 동기화, 회생·파산 1-Line 요약 및 롤플레잉
                            </p>
                        </div>

                        {/* 3. 자동 정산 */}
                        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-2.5 hover:border-emerald-500/40 transition-colors">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                <Coins size={18} />
                            </div>
                            <h3 className="font-bold text-sm text-slate-200">주간 자동 정산 대장</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                거래처별 마감/지급 요일 연동 및 수당 분배 자동화
                            </p>
                        </div>
                    </div>

                    {/* 신뢰 지표 & 보안 정책 */}
                    <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-slate-400 border-t border-slate-850">
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={15} className="text-emerald-400" />
                            <span>테넌트별 격리 보안 (RLS)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Lock size={15} className="text-blue-400" />
                            <span>AES-256 데이터 암호화</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Shield size={15} className="text-indigo-400" />
                            <span>사내 승인 계정 엄격 통제</span>
                        </div>
                    </div>

                </div>

                {/* 👉 우측: 프리미엄 로그인 카드 */}
                <div className="w-full lg:w-5/12 max-w-md animate-in fade-in duration-500">
                    <div className="bg-slate-900/85 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
                        
                        {/* 카드 상단 헤더 */}
                        <div className="space-y-1.5 text-center">
                            <h2 className="text-xl font-bold text-white tracking-tight">
                                워크스페이스 로그인
                            </h2>
                            <p className="text-xs text-slate-400">
                                배정된 승인 계정으로 즉시 업무 공간에 접속하세요
                            </p>
                        </div>

                        {/* 로그인 방식 전환 탭 */}
                        <div className="grid grid-cols-2 p-1 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => { setAuthMethod('google'); setOtpError(null); }}
                                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                    authMethod === 'google' 
                                        ? 'bg-blue-600 text-white shadow-xs font-bold' 
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.315 0-6-2.685-6-6s2.685-6 6-6c1.47 0 2.81.53 3.86 1.41l2.36-2.36C16.89 3.55 14.7 2.7 12.24 2.7 7.14 2.7 3 6.84 3 11.94s4.14 9.24 9.24 9.24c5.38 0 8.95-3.78 8.95-9.11 0-.62-.06-1.12-.17-1.785h-8.78z" />
                                </svg>
                                <span>구글 원클릭</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => { setAuthMethod('otp'); setOtpError(null); }}
                                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                    authMethod === 'otp' 
                                        ? 'bg-blue-600 text-white shadow-xs font-bold' 
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Mail size={13} />
                                <span>이메일 인증</span>
                            </button>
                        </div>

                        {/* 구글 로그인 영역 */}
                        {authMethod === 'google' && (
                            <div className="space-y-4 py-2">
                                <div className="flex justify-center">
                                    <GoogleLogin
                                        onSuccess={(credentialResponse) => {
                                            if (credentialResponse.credential) {
                                                loginWithGoogle(credentialResponse.credential);
                                            }
                                        }}
                                        onError={() => {
                                            console.log('Login Failed');
                                            alert('구글 로그인 창이 닫혔거나 차단되었습니다.\n[이메일 인증] 탭을 이용해주세요.');
                                            setAuthMethod('otp');
                                        }}
                                        shape="pill"
                                        size="large"
                                        theme="filled_blue"
                                        text="continue_with"
                                        width="320"
                                    />
                                </div>
                                <p className="text-[11px] text-center text-slate-500 leading-relaxed">
                                    사내 워크스페이스에 등록된 전용 구글 계정으로 원클릭 로그인됩니다.
                                </p>
                            </div>
                        )}

                        {/* 이메일 OTP 인증 로그인 영역 */}
                        {authMethod === 'otp' && (
                            <div className="space-y-4">
                                {otpError && (
                                    <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-start gap-2">
                                        <X size={15} className="mt-0.5 shrink-0 text-red-400" />
                                        <span>{otpError}</span>
                                    </div>
                                )}
                                {otpSuccess && (
                                    <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-start gap-2">
                                        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                                        <span>{otpSuccess}</span>
                                    </div>
                                )}

                                {!otpSent ? (
                                    <form onSubmit={handleSendOtp} className="space-y-3.5">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-slate-300">사내 승인 업무용 이메일</label>
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="예: agent@leadmaster.kr 또는 gmail.com"
                                                className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={otpLoading || !email.trim()}
                                            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                                        >
                                            {otpLoading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                                            <span>{otpLoading ? '인증번호 발송 중...' : '인증번호 발송하기'}</span>
                                        </button>
                                    </form>
                                ) : (
                                    <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-400">발송 대상: <strong className="text-slate-200">{email}</strong></span>
                                                <button
                                                    type="button"
                                                    onClick={() => { setOtpSent(false); setOtpSuccess(null); }}
                                                    className="text-blue-400 hover:underline font-medium text-[11px]"
                                                >
                                                    이메일 재입력
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                maxLength={8}
                                                value={otpCode}
                                                onChange={(e) => setOtpCode(e.target.value)}
                                                placeholder="메일로 받은 6자리 인증번호"
                                                className="w-full px-3 py-2.5 text-center tracking-widest text-lg font-mono font-bold bg-slate-950 border border-blue-500 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={otpLoading || !otpCode.trim()}
                                            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                                        >
                                            {otpLoading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                                            <span>{otpLoading ? '확인 중...' : '인증 확인 및 워크스페이스 입장'}</span>
                                        </button>
                                    </form>
                                )}
                            </div>
                        )}

                        {/* 모바일 APK 전용 안내 바 */}
                        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                            <span className="flex items-center gap-1.5 text-slate-300">
                                <Smartphone size={14} className="text-blue-400" />
                                <span>모바일 앱 (v1.8.3)</span>
                            </span>
                            <div className="flex items-center gap-2.5">
                                <a 
                                    href="./app/LeadMaster.apk" 
                                    download="LeadMaster.apk"
                                    className="text-blue-400 hover:text-blue-300 font-semibold hover:underline flex items-center gap-1 text-[11px]"
                                >
                                    <Download size={12} />
                                    <span>APK 받기</span>
                                </a>
                                <span className="text-slate-700">•</span>
                                <button
                                    type="button"
                                    onClick={() => setShowGuide(true)}
                                    className="text-slate-400 hover:text-slate-200 text-[11px]"
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
            <footer className="relative z-10 border-t border-slate-900 bg-slate-950/80 px-6 py-4 text-xs text-slate-500">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p>© {new Date().getFullYear()} LeadMaster CRM. Multi-tenant B2B Cloud. All rights reserved.</p>
                    <div className="flex items-center gap-4 text-slate-400 text-xs">
                        <a href="./privacy.html" className="text-blue-400 hover:underline">개인정보처리방침</a>
                        <a href="./terms.html" className="hover:text-slate-200 hover:underline">이용약관</a>
                        <span>고객지원: beanhull@gmail.com</span>
                    </div>
                </div>
            </footer>

            {/* ❓ 모바일 앱 1분 설치 가이드 모달 */}
            {showGuide && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-slate-900 text-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-700">
                        <div className="flex items-center justify-between border-b pb-3 border-slate-800">
                            <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                <Smartphone size={16} className="text-blue-400" />
                                <span>모바일 전용 앱 설치 가이드</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowGuide(false)}
                                className="p-1 rounded-full text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3 text-left text-xs text-slate-300">
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                리드마스터 앱은 사내 업무 및 010 스마트 통화 연동 전용으로 배포되는 안전한 APK입니다.
                            </p>
                            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs space-y-1">
                                <span className="font-semibold text-white flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full bg-blue-500 text-[10px] text-white flex items-center justify-center">1</span>
                                    <span>출처를 알 수 없는 앱 허용</span>
                                </span>
                                <p className="text-[11px] text-slate-400 pl-5.5">브라우저 다운로드 시 '이 출처의 앱 설치 허용'을 켜주세요.</p>
                            </div>
                            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs space-y-1">
                                <span className="font-semibold text-white flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full bg-blue-500 text-[10px] text-white flex items-center justify-center">2</span>
                                    <span>Play 프로텍트 무시하고 설치</span>
                                </span>
                                <p className="text-[11px] text-slate-400 pl-5.5">보안 팝업 발생 시 '세부정보 더보기 ➔ 무시하고 설치'를 선택합니다.</p>
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
                                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
