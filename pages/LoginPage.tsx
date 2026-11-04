import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { Smartphone, Download, HelpCircle, X, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
    const { loginWithGoogle } = useAuth();
    const [showGuide, setShowGuide] = useState(false);

    // 모바일(안드로이드) 브라우저 접속 여부 감지
    const isAndroidDevice = /Android/i.test(navigator.userAgent);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4 py-8 relative">
            
            {/* 📱 모바일 브라우저 접속자 대상 스마트 상단 배너 */}
            {isAndroidDevice && (
                <div className="w-full max-w-md mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-3.5 shadow-md flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                            <Smartphone size={18} />
                        </div>
                        <div className="text-left">
                            <p className="text-xs font-bold leading-tight">리드마스터 전용 앱 설치</p>
                            <p className="text-[10px] text-blue-100 mt-0.5">통화 감지 및 간편모드 지원</p>
                        </div>
                    </div>
                    <a
                        href="./downloads/leadmaster.apk"
                        download="leadmaster-crm-v1.14.apk"
                        className="bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs active:scale-95 transition-all shrink-0"
                    >
                        앱 다운로드
                    </a>
                </div>
            )}

            <div className="w-full max-w-md p-6 sm:p-8 space-y-6 bg-white rounded-3xl shadow-xl text-center border border-gray-100">
                {/* 로고 & 시스템명 */}
                <div>
                    <div className="mx-auto bg-gradient-to-tr from-blue-600 to-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-md shadow-blue-500/20">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">LeadMaster CRM</h1>
                    <p className="mt-1 text-xs sm:text-sm text-gray-500">안전한 고객 상담 관리를 위한 사내 전용 시스템</p>
                </div>

                {/* 로그인 안내 박스 */}
                <div className="bg-blue-50/70 border border-blue-100 p-3.5 rounded-xl text-left">
                    <h3 className="text-xs font-bold text-blue-900 mb-1 flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-blue-600" />
                        로그인 권한 안내
                    </h3>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                        등록된 업무용 Google 계정으로만 로그인이 가능합니다.<br />
                        계정 권한이 필요하신 경우 팀 관리자에게 문의해주세요.
                    </p>
                </div>

                {/* 구글 로그인 버튼 */}
                <div className="flex justify-center py-2">
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
                        theme="outline"
                        text="continue_with"
                    />
                </div>

                {/* 📱 사내 전용 안드로이드 앱 다운로드 배포 카드 */}
                <div className="pt-2 border-t border-gray-100 text-left">
                    <div className="bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-slate-50/60 border border-blue-200/60 rounded-2xl p-4 shadow-2xs">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                                    <Smartphone size={18} />
                                </div>
                                <div>
                                    <h4 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                        사내 전용 모바일 앱
                                        <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full font-mono font-semibold">
                                            v1.14 공식
                                        </span>
                                    </h4>
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                        통화 감지 · 간편모드 · 원터치 결과 입력
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-3.5">
                            <a
                                href="./downloads/leadmaster.apk"
                                download="leadmaster-crm-v1.14.apk"
                                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all text-center"
                            >
                                <Download size={14} />
                                <span>APK 다운 (5.4M)</span>
                            </a>

                            <button
                                type="button"
                                onClick={() => setShowGuide(true)}
                                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs border border-gray-200 shadow-2xs active:scale-95 transition-all"
                            >
                                <HelpCircle size={14} className="text-blue-600" />
                                <span>1분 설치 안내</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 하단 버전 정보 */}
                <p className="text-xs text-gray-400 mt-2">
                    &copy; {new Date().getFullYear()} LeadMaster CRM. All rights reserved.
                    <br /><span className="text-[11px] text-gray-400 font-mono">v3.36 (Enterprise Release)</span>
                </p>
            </div>

            {/* ❓ 1분 설치 가이드 모달 */}
            {showGuide && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-gray-100">
                        <div className="flex items-center justify-between border-b pb-3 border-gray-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                                    <Smartphone size={18} />
                                </div>
                                <h3 className="font-bold text-base text-gray-900">사내 전용 앱 설치 가이드</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowGuide(false)}
                                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-3.5 text-left text-xs text-gray-600">
                            <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100">
                                <p className="text-blue-900 font-medium leading-relaxed">
                                    리드마스터 앱은 사내 업무 전용으로, 구글 플레이 대신 <strong>회사 공식 보안 인증서(Release Keystore)</strong>로 직접 배포됩니다.
                                </p>
                            </div>

                            {/* 1단계 */}
                            <div className="space-y-1 p-3 bg-gray-50 rounded-xl border border-gray-200/70">
                                <h4 className="font-bold text-gray-900 flex items-center gap-1.5 text-xs">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold">1</span>
                                    [출처를 알 수 없는 앱 설치] 허용
                                </h4>
                                <p className="text-gray-600 pl-6 leading-relaxed">
                                    다운로드 후 설치 시 <em>"보안을 위해 이 출처의 앱을 설치할 수 없습니다"</em> 팝업이 뜨면 <strong>[설정]</strong>을 누르고 <strong>[이 출처 허용]</strong> 토글을 켜주세요.
                                </p>
                            </div>

                            {/* 2단계 */}
                            <div className="space-y-1 p-3 bg-gray-50 rounded-xl border border-gray-200/70">
                                <h4 className="font-bold text-gray-900 flex items-center gap-1.5 text-xs">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold">2</span>
                                    [Play 프로텍트 경고 시] 무시하고 설치
                                </h4>
                                <p className="text-gray-600 pl-6 leading-relaxed">
                                    <em>"확인되지 않은 개발자의 앱"</em> 경고가 뜰 경우, 하단의 <strong>[자세히 보기]</strong>를 누른 후 <strong>[무시하고 설치(안전하지 않음)]</strong>를 터치하시면 정상 설치됩니다.
                                </p>
                            </div>

                            {/* 3단계 */}
                            <div className="space-y-1 p-3 bg-gray-50 rounded-xl border border-gray-200/70">
                                <h4 className="font-bold text-gray-900 flex items-center gap-1.5 text-xs">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold">3</span>
                                    앱 실행 후 권한 허용
                                </h4>
                                <p className="text-gray-600 pl-6 leading-relaxed">
                                    앱을 처음 실행할 때 전화 권한 및 <strong>"다른 앱 위에 표시"</strong> 권한을 허용하시면, 모바일 간편모드 및 통화 자동 감지를 즉시 이용하실 수 있습니다.
                                </p>
                            </div>
                        </div>

                        {/* 모달 하단 버튼 */}
                        <div className="pt-2 flex items-center gap-2">
                            <a
                                href="./downloads/leadmaster.apk"
                                download="leadmaster-crm-v1.14.apk"
                                onClick={() => setShowGuide(false)}
                                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
                            >
                                <Download size={15} />
                                <span>지금 APK 다운로드 (5.4MB)</span>
                            </a>
                            <button
                                type="button"
                                onClick={() => setShowGuide(false)}
                                className="py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
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
