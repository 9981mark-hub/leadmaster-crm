import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { Smartphone, Download, HelpCircle, X, Shield } from 'lucide-react';

export default function LoginPage() {
    const { loginWithGoogle } = useAuth();
    const [showGuide, setShowGuide] = useState(false);
    const isAndroidDevice = /Android/i.test(navigator.userAgent);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-blue-500 selection:text-white">
            
            {/* 🌐 미니멀 상단 바 */}
            <header className="border-b border-slate-850 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img 
                        src="./leadmaster_logo_120.png" 
                        alt="LeadMaster" 
                        className="w-8 h-8 rounded-xl shadow-md border border-blue-500/30 object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <span className="text-base font-extrabold tracking-tight text-white">
                        LeadMaster <span className="text-blue-400 font-semibold text-xs ml-0.5">CRM</span>
                    </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                    <a href="./privacy.html" className="text-blue-400 hover:text-blue-300 hover:underline">개인정보처리방침</a>
                    <a href="./terms.html" className="hover:text-slate-200 hover:underline hidden sm:inline">이용약관</a>
                </div>
            </header>

            {/* 📱 모바일 브라우저 전용 띠 배너 */}
            {isAndroidDevice && (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        <Smartphone size={15} />
                        <span>리드마스터 모바일 전용 앱</span>
                    </div>
                    <a
                        href="./downloads/leadmaster.apk"
                        download="leadmaster-crm.apk"
                        className="bg-white text-blue-700 font-bold px-2.5 py-0.5 rounded text-[11px] hover:bg-blue-50"
                    >
                        다운로드
                    </a>
                </div>
            )}

            {/* 🚀 중앙 심플 & 세련된 히어로/로그인 카드 */}
            <main className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-sm text-center space-y-8 animate-in fade-in duration-300">
                    
                    {/* 브랜드 아이콘 & 타이틀 */}
                    <div className="space-y-3">
                        <img 
                            src="./leadmaster_logo_120.png" 
                            alt="LeadMaster Logo" 
                            className="w-16 h-16 mx-auto rounded-2xl shadow-xl shadow-blue-500/10 border border-blue-500/30 object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <h1 className="text-2xl font-bold tracking-tight text-white">
                            LeadMaster CRM
                        </h1>
                        <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                            법률·금융 아웃바운드 TM 및 상담 관리를 위한<br />
                            사내 승인 사용자 전용 플랫폼
                        </p>
                    </div>

                    {/* 로그인 카드 */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-5">
                        
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-slate-300">업무용 구글 계정 로그인</span>
                            <p className="text-[11px] text-slate-500">배정된 사내 계정으로 접속해 주세요</p>
                        </div>

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
                                    alert('구글 로그인에 실패했습니다.');
                                }}
                                shape="pill"
                                size="large"
                                theme="filled_blue"
                                text="continue_with"
                            />
                        </div>

                        {/* 모바일 APK 다운로드 미니 링크 */}
                        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                            <span className="text-[11px] flex items-center gap-1 text-slate-400">
                                <Smartphone size={13} className="text-blue-400" />
                                모바일 앱 (v1.6.8)
                            </span>
                            <div className="flex items-center gap-2">
                                <a 
                                    href="./downloads/leadmaster.apk" 
                                    download="leadmaster-crm.apk"
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
                                href="./downloads/leadmaster.apk"
                                download="leadmaster-crm.apk"
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
