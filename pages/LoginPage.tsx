import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { Smartphone, Download, HelpCircle, X, Shield, Mail, KeyRound, Loader2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
    const { loginWithGoogle, sendEmailOtp, verifyEmailOtp } = useAuth();
    const [showGuide, setShowGuide] = useState(false);
    const [showOtpLogin, setShowOtpLogin] = useState(false);
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
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-blue-500 selection:text-white">
            
            {/* 🔝 미니멀 상단 바 */}
            <header className="border-b border-slate-850 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img 
                        src={`${import.meta.env.BASE_URL}leadmaster_logo_horizontal_dark.png`} 
                        alt="LeadMaster CRM" 
                        className="h-7 w-auto object-contain"
                    />
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                    <a href="./privacy.html" className="text-blue-400 hover:text-blue-300 hover:underline">개인정보처리방침</a>
                    <a href="./terms.html" className="hover:text-slate-200 hover:underline hidden sm:inline">이용약관</a>
                </div>
            </header>

            {/* 📱 모바일 브라우저 전용 앱 배너 */}
            {isAndroidDevice && (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        <Smartphone size={15} />
                        <span>리드마스터 모바일 전용 앱 (v1.7.7)</span>
                    </div>
                    <a
                        href="./app/LeadMaster.apk"
                        download="LeadMaster.apk"
                        className="bg-white text-blue-700 font-bold px-2.5 py-0.5 rounded text-[11px] hover:bg-blue-50"
                    >
                        다운로드
                    </a>
                </div>
            )}

            {/* 🎯 중앙 심플 & 모던한 히어로 로그인 카드 */}
            <main className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-sm text-center space-y-8 animate-in fade-in duration-300">
                    
                    {/* 브랜드 가로형 풀 로고 & 서브타이틀 */}
                    <div className="space-y-4">
                        <img 
                            src={`${import.meta.env.BASE_URL}leadmaster_logo_horizontal_dark.png`} 
                            alt="LeadMaster CRM" 
                            className="h-12 sm:h-14 w-auto mx-auto object-contain drop-shadow-md"
                        />
                        <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                            법률·금융 아웃바운드 TM 및 상담 관리를 위한<br />
                            사내 승인 사용자 전용 플랫폼
                        </p>
                    </div>

                    {/* 로그인 카드 */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-5 text-left">
                        
                        <div className="space-y-1 text-center">
                            <span className="text-xs font-semibold text-slate-300">
                                {showOtpLogin ? '사내 이메일 인증번호 로그인' : '업무용 구글 계정 로그인'}
                            </span>
                            <p className="text-[11px] text-slate-500">배정된 사내 승인 계정으로 접속해 주세요</p>
                        </div>

                        {!showOtpLogin ? (
                            <>
                                {/* 구글 로그인 버튼 */}
                                <div className="flex justify-center py-1">
                                    <GoogleLogin
                                        onSuccess={(credentialResponse) => {
                                            if (credentialResponse.credential) {
                                                loginWithGoogle(credentialResponse.credential);
                                            }
                                        }}
                                        onError={() => {
                                            console.log('Login Failed');
                                            alert('구글 로그인 창이 닫혔거나 차단되었습니다.\n아래 [이메일 인증번호로 로그인]을 이용해주세요.');
                                            setShowOtpLogin(true);
                                        }}
                                        shape="pill"
                                        size="large"
                                        theme="filled_blue"
                                        text="continue_with"
                                    />
                                </div>

                                <div className="relative flex py-1 items-center">
                                    <div className="flex-grow border-t border-slate-800"></div>
                                    <span className="flex-shrink mx-3 text-[11px] text-slate-500">또는</span>
                                    <div className="flex-grow border-t border-slate-800"></div>
                                </div>

                                {/* 이메일 OTP 전환 버튼 */}
                                <button
                                    type="button"
                                    onClick={() => setShowOtpLogin(true)}
                                    className="w-full py-2.5 px-3 rounded-full bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-medium text-slate-300 flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Mail size={14} className="text-blue-400" />
                                    <span>이메일 인증번호로 간편 로그인</span>
                                </button>
                            </>
                        ) : (
                            /* 이메일 OTP 인증 폼 */
                            <div className="space-y-3 pt-1">
                                {otpError && (
                                    <div className="p-2.5 rounded-xl bg-red-950/50 border border-red-800 text-[11px] text-red-300">
                                        {otpError}
                                    </div>
                                )}
                                {otpSuccess && (
                                    <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-800 text-[11px] text-emerald-300">
                                        {otpSuccess}
                                    </div>
                                )}

                                {!otpSent ? (
                                    <form onSubmit={handleSendOtp} className="space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-400">사내 승인 구글/업무 이메일</label>
                                            <div className="relative">
                                                <input
                                                    type="email"
                                                    required
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="예: 9981mark@gmail.com"
                                                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={otpLoading || !email.trim()}
                                            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                                        >
                                            {otpLoading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                                            <span>{otpLoading ? '발송 중...' : '인증번호 발송'}</span>
                                        </button>
                                    </form>
                                ) : (
                                    <form onSubmit={handleVerifyOtp} className="space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-slate-400">인증 대상: {email}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => { setOtpSent(false); setOtpSuccess(null); }}
                                                    className="text-blue-400 hover:underline"
                                                >
                                                    변경
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                maxLength={8}
                                                value={otpCode}
                                                onChange={(e) => setOtpCode(e.target.value)}
                                                placeholder="이메일로 받은 6자리 인증번호"
                                                className="w-full px-3 py-2 text-center tracking-widest text-base font-bold bg-slate-950 border border-blue-500/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-400"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={otpLoading || !otpCode.trim()}
                                            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                                        >
                                            {otpLoading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                                            <span>{otpLoading ? '확인 중...' : '인증 확인 및 로그인'}</span>
                                        </button>
                                    </form>
                                )}

                                <div className="text-center pt-1">
                                    <button
                                        type="button"
                                        onClick={() => { setShowOtpLogin(false); setOtpError(null); }}
                                        className="text-[11px] text-slate-400 hover:text-slate-200"
                                    >
                                        ← 구글 원클릭 로그인으로 돌아가기
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 모바일 APK 다운로드 미니 링크 */}
                        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                            <span className="text-[11px] flex items-center gap-1 text-slate-400">
                                <Smartphone size={13} className="text-blue-400" />
                                모바일 앱 (v1.7.7)
                            </span>
                            <div className="flex items-center gap-2">
                                <a 
                                    href="./app/LeadMaster.apk" 
                                    download="LeadMaster.apk"
                                    className="text-blue-400 hover:underline text-[11px] font-medium"
                                >
                                    APK 다운로드
                                </a>
                                <span className="text-slate-600">•</span>
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

                    {/* 보안 배지 */}
                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                        <Shield size={13} className="text-blue-400/80" />
                        <span>사내 승인 계정 암호화 보안 접속 시스템</span>
                    </div>

                </div>
            </main>

            {/* 📜 미니멀 푸터 */}
            <footer className="border-t border-slate-850 px-6 py-4 text-center text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full">
                <p>© {new Date().getFullYear()} LeadMaster CRM. All rights reserved.</p>
                <div className="flex items-center gap-4 text-slate-400">
                    <a href="./privacy.html" className="text-blue-400 hover:underline">개인정보처리방침</a>
                    <a href="./terms.html" className="hover:text-slate-300 hover:underline">이용약관</a>
                    <span>담당자: beanhull@gmail.com</span>
                </div>
            </footer>

            {/* ❓ 모바일 앱 1분 설치 가이드 모달 */}
            {showGuide && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-slate-900 text-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-700">
                        <div className="flex items-center justify-between border-b pb-3 border-slate-800">
                            <h3 className="font-bold text-sm text-white">사내 전용 앱 설치 안내</h3>
                            <button
                                type="button"
                                onClick={() => setShowGuide(false)}
                                className="p-1 rounded-full text-slate-400 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-2.5 text-left text-xs text-slate-300">
                            <p className="text-[11px] text-slate-400">
                                리드마스터 앱은 사내 업무 전용으로 배포됩니다.
                            </p>
                            <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700 text-[11px] space-y-1">
                                <span className="font-semibold text-white">1. 출처 허용</span>
                                <p className="text-slate-400">설치 시 '출처를 알 수 없는 앱' 허용을 켜주세요.</p>
                            </div>
                            <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700 text-[11px] space-y-1">
                                <span className="font-semibold text-white">2. 무시하고 설치</span>
                                <p className="text-slate-400">Play 프로텍트 창에서 '자세히 보기 ➔ 무시하고 설치' 선택</p>
                            </div>
                        </div>

                        <div className="pt-2 flex gap-2">
                            <a
                                href="./app/LeadMaster.apk"
                                download="LeadMaster.apk"
                                onClick={() => setShowGuide(false)}
                                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs text-center"
                            >
                                APK 다운로드
                            </a>
                            <button
                                type="button"
                                onClick={() => setShowGuide(false)}
                                className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
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
