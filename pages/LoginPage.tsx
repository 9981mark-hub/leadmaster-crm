import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { 
    Smartphone, Download, HelpCircle, X, ShieldCheck, 
    PhoneCall, Zap, Brain, Scale, Lock, Users, BarChart3, 
    ArrowRight, CheckCircle2, Building2, Headphones
} from 'lucide-react';

export default function LoginPage() {
    const { loginWithGoogle } = useAuth();
    const [showGuide, setShowGuide] = useState(false);

    // 모바일(안드로이드) 브라우저 접속 여부 감지
    const isAndroidDevice = /Android/i.test(navigator.userAgent);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
            {/* 🌐 상단 네비게이션 헤더 */}
            <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img 
                            src="./leadmaster_logo_120.png" 
                            alt="LeadMaster Logo" 
                            className="w-9 h-9 rounded-xl shadow-md border border-blue-500/30 object-cover"
                            onError={(e) => {
                                // fallback if image fails
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                        <div>
                            <span className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                                LeadMaster <span className="text-blue-400 font-extrabold text-sm px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">CRM</span>
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-medium text-slate-300">
                        <a href="#features" className="hidden sm:inline-block hover:text-white transition-colors">주요 기능</a>
                        <a href="#security" className="hidden sm:inline-block hover:text-white transition-colors">보안 및 컴플라이언스</a>
                        <a href="./privacy.html" className="text-blue-400 hover:text-blue-300 hover:underline">개인정보처리방침</a>
                        <a href="./terms.html" className="hidden sm:inline-block hover:text-white transition-colors">이용약관</a>
                    </div>
                </div>
            </header>

            {/* 📱 모바일 브라우저 전용 상단 설치 유도 바 */}
            {isAndroidDevice && (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        <Smartphone size={16} />
                        <span className="font-medium">리드마스터 안드로이드 업무 앱 설치</span>
                    </div>
                    <a
                        href="./downloads/leadmaster.apk"
                        download="leadmaster-crm.apk"
                        className="bg-white text-blue-700 font-bold px-3 py-1 rounded-lg text-xs hover:bg-blue-50 transition-colors shadow-xs"
                    >
                        다운로드
                    </a>
                </div>
            )}

            {/* 🚀 히어로 섹션 (서비스 소개 + 로그인 폼) */}
            <main className="flex-1">
                <section className="relative overflow-hidden py-12 lg:py-20 border-b border-slate-800">
                    {/* 배경 글로우 효과 */}
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute top-1/3 right-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                            
                            {/* 좌측: 서비스 상세 소개 헤드라인 */}
                            <div className="lg:col-span-7 space-y-6 text-left">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                                    <Zap size={14} className="text-blue-400" />
                                    <span>법률·금융 아웃바운드 TM 전문 올인원 CRM</span>
                                </div>

                                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight sm:leading-tight">
                                    고객 DB 유입부터 <br className="hidden sm:inline" />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-sky-400">
                                        통화 녹음, AI 문진, 수임 체결
                                    </span>까지
                                </h1>

                                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl font-normal">
                                    리드마스터 CRM은 10인~50인 이상의 전문 TM 조직 및 파트너 사무실을 위한 고성능 고객 상담 관리 시스템입니다.
                                    스마트폰 통화 연동, 실시간 상담 녹취 분석, 지능형 DB 자동 순환으로 영업 생산성을 극대화합니다.
                                </p>

                                {/* 핵심 하이라이트 배지 3선 */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                                    <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
                                        <div className="flex items-center gap-2 text-blue-400 font-bold text-xs mb-1">
                                            <PhoneCall size={14} /> 통화 자동 감지
                                        </div>
                                        <p className="text-[11px] text-slate-400">PC 원클릭 발신 및 스마트폰 수신 팝업 정보 연동</p>
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
                                        <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs mb-1">
                                            <Brain size={14} /> AI 통화 분석
                                        </div>
                                        <p className="text-[11px] text-slate-400">통화 녹취에서 채무·소득 7대 핵심 항목 자동 추출</p>
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
                                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
                                            <Scale size={14} /> 사무장 인계 큐
                                        </div>
                                        <p className="text-[11px] text-slate-400">1차 상담원에서 전문 사무장 수임까지 원스톱 인계</p>
                                    </div>
                                </div>
                            </div>

                            {/* 우측: Google 로그인 & 앱 다운로드 카드 */}
                            <div className="lg:col-span-5 w-full max-w-md mx-auto">
                                <div className="bg-slate-800/95 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40 backdrop-blur-xl space-y-6 text-center">
                                    
                                    <div className="space-y-2">
                                        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                            <Headphones size={28} className="text-white" />
                                        </div>
                                        <h2 className="text-xl font-bold text-white tracking-tight">상담원 및 관리자 로그인</h2>
                                        <p className="text-xs text-slate-400">사전에 등록된 승인 Google 계정으로 로그인해 주세요.</p>
                                    </div>

                                    {/* 구글 로그인 버튼 컨테이너 */}
                                    <div className="py-2 flex justify-center">
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
                                            text="signin_with"
                                        />
                                    </div>

                                    {/* 보안 안내 알림 */}
                                    <div className="bg-slate-900/80 border border-slate-700/60 p-3 rounded-xl text-left flex items-start gap-2.5">
                                        <ShieldCheck size={16} className="text-blue-400 shrink-0 mt-0.5" />
                                        <div className="text-[11px] text-slate-300 leading-relaxed">
                                            <strong className="text-white font-medium">안전한 데이터 보호</strong>: 모든 통신은 SSL/TLS로 암호화되며, 회사별 독립 RLS 보안 정책이 적용됩니다.
                                        </div>
                                    </div>

                                    {/* 전용 모바일 앱 다운로드 바 */}
                                    <div className="pt-4 border-t border-slate-700/60 text-left">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                                <Smartphone size={14} className="text-blue-400" />
                                                현장 전용 모바일 앱 (APK)
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono">v1.6.8 공식</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <a
                                                href="./downloads/leadmaster.apk"
                                                download="leadmaster-crm.apk"
                                                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-xs active:scale-95 text-center"
                                            >
                                                <Download size={13} />
                                                <span>앱 다운로드</span>
                                            </a>

                                            <button
                                                type="button"
                                                onClick={() => setShowGuide(true)}
                                                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs border border-slate-600 transition-all active:scale-95"
                                            >
                                                <HelpCircle size={13} className="text-blue-400" />
                                                <span>설치 안내</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* 약관 및 개인정보 링크 */}
                                    <div className="pt-2 text-center text-[11px] text-slate-400 space-x-3">
                                        <a href="./privacy.html" className="text-blue-400 hover:underline">개인정보처리방침</a>
                                        <span>•</span>
                                        <a href="./terms.html" className="hover:text-slate-300 hover:underline">서비스 이용약관</a>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </section>

                {/* 🌟 4대 핵심 기능 소개 섹션 (비로그인 사용자 공개) */}
                <section id="features" className="py-16 bg-slate-950/60 border-b border-slate-800">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center max-w-3xl mx-auto mb-12">
                            <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">FEATURES</h2>
                            <p className="text-2xl sm:text-3xl font-extrabold text-white">TM 조직 생산성을 혁신하는 핵심 기능</p>
                            <p className="text-xs sm:text-sm text-slate-400 mt-2">상담원 개별 통화부터 파트너사 최종 수임까지 전 과정을 하나의 시스템으로 연결합니다.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* 기능 1 */}
                            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                                    <PhoneCall size={20} />
                                </div>
                                <h3 className="font-bold text-sm text-white">실시간 통화 & 수신 팝업</h3>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    PC 웹에서 원클릭으로 전화/문자를 발신하고, 전화 수신 시 고객의 핵심 재무 요약(채무액, 소득, 부재 이력) 팝업이 자동으로 표시됩니다.
                                </p>
                            </div>

                            {/* 기능 2 */}
                            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                                    <Brain size={20} />
                                </div>
                                <h3 className="font-bold text-sm text-white">AI 자동 녹취 문진 추출</h3>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    통화 종료 후 상담 녹음 파일이 안전하게 자동 보관되며, AI가 대화록에서 채무액·소득·재산 정보를 자동으로 분석해 입력 필드에 채워줍니다.
                                </p>
                            </div>

                            {/* 기능 3 */}
                            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                                    <Zap size={20} />
                                </div>
                                <h3 className="font-bold text-sm text-white">지능형 DB 순환 & 회수</h3>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    방치된 미처리 리드를 설정된 시간에 따라 자동 회수하고, 3회 이상 부재중인 고객 DB를 다른 상담원에게 스마트 교차 배분합니다.
                                </p>
                            </div>

                            {/* 기능 4 */}
                            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                                    <Scale size={20} />
                                </div>
                                <h3 className="font-bold text-sm text-white">사무장 인계 관제 허브</h3>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    1차 상담 리드가 변호사·전문 사무장에게 원클릭으로 인계되며, 텔레그램 봇을 통해 거래처 사무실에 채무 리포트가 실시간 전송됩니다.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 🛡️ 보안 & 데이터 거버넌스 섹션 */}
                <section id="security" className="py-16 border-b border-slate-800">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="bg-gradient-to-br from-slate-800/80 via-slate-900/90 to-slate-950 border border-slate-700/80 rounded-3xl p-8 sm:p-10">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                                <div className="lg:col-span-8 space-y-4 text-left">
                                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400">
                                        <Lock size={14} /> SECURITY & PRIVACY
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-bold text-white">
                                        철저한 멀티테넌트 데이터 격리 및 금융 보안 준수
                                    </h3>
                                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                        리드마스터 CRM은 각 회사(테넌트)의 고객 데이터가 상호 침범하지 않도록 Row-Level Security(RLS) 엔진을 통해 물리적으로 격리합니다. 
                                        개인 통화는 전송되지 않으며, 인가된 상담원만이 배정된 리드에 접근할 수 있습니다.
                                    </p>
                                    <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-400">
                                        <div className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" /> 데이터베이스 RLS 암호화 분리</div>
                                        <div className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" /> 전송 구간 SSL/TLS 강제 적용</div>
                                        <div className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" /> 감사 로그(Access Log) 전수 기록</div>
                                    </div>
                                </div>
                                <div className="lg:col-span-4 flex justify-center">
                                    <div className="p-6 rounded-2xl bg-slate-800 border border-slate-700 text-center space-y-2 w-full max-w-xs">
                                        <Building2 size={32} className="mx-auto text-blue-400" />
                                        <div className="text-sm font-bold text-white">멀티테넌트 아키텍처</div>
                                        <div className="text-[11px] text-slate-400">회사별 독립된 워크스페이스, 독립된 텔레그램 봇, 독립된 구글 드라이브 연동</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* 📜 하단 공식 푸터 (개인정보처리방침 / 이용약관 명시) */}
            <footer className="bg-slate-950 border-t border-slate-800/80 py-10 text-slate-400 text-xs">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-sm">LeadMaster CRM</span>
                            <span className="text-[11px] text-slate-500">|</span>
                            <span className="text-[11px] text-slate-400">비즈니스 TM 고객 관리 플랫폼</span>
                        </div>

                        <div className="flex items-center gap-5 text-xs">
                            <a href="./privacy.html" className="text-blue-400 hover:text-blue-300 font-medium hover:underline">개인정보처리방침</a>
                            <a href="./terms.html" className="hover:text-white transition-colors">서비스 이용약관</a>
                            <a href="mailto:beanhull@gmail.com" className="hover:text-white transition-colors">고객 지원 및 문의</a>
                        </div>
                    </div>

                    <div className="border-t border-slate-800/60 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px] text-slate-500">
                        <p>© {new Date().getFullYear()} LeadMaster CRM. All rights reserved. (운영 책임자: 진성훈, 문의: 9981mark@gmail.com / beanhull@gmail.com)</p>
                        <p className="font-mono text-slate-600">Release v3.61 (Enterprise Edition)</p>
                    </div>
                </div>
            </footer>

            {/* ❓ 모바일 앱 1분 설치 가이드 모달 */}
            {showGuide && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-slate-900 text-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-700">
                        <div className="flex items-center justify-between border-b pb-3 border-slate-800">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                                    <Smartphone size={18} />
                                </div>
                                <h3 className="font-bold text-sm text-white">사내 전용 앱 설치 안내</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowGuide(false)}
                                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-3 text-left text-xs text-slate-300">
                            <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
                                <p className="text-blue-300 font-medium leading-relaxed">
                                    리드마스터 앱은 사내 업무 전용으로, 회사 보안 인증서(Release Keystore)로 직접 배포됩니다.
                                </p>
                            </div>

                            <div className="space-y-1 p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                                <h4 className="font-bold text-white flex items-center gap-1.5 text-xs">
                                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                                    [출처를 알 수 없는 앱 설치] 허용
                                </h4>
                                <p className="text-slate-400 pl-5 leading-relaxed text-[11px]">
                                    다운로드 후 <em>"출처를 알 수 없는 앱"</em> 알림 시 <strong>[설정] ➔ [이 출처 허용]</strong>을 켜주세요.
                                </p>
                            </div>

                            <div className="space-y-1 p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                                <h4 className="font-bold text-white flex items-center gap-1.5 text-xs">
                                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                                    [Play 프로텍트 경고 시] 무시하고 설치
                                </h4>
                                <p className="text-slate-400 pl-5 leading-relaxed text-[11px]">
                                    경고 팝업 하단의 <strong>[자세히 보기] ➔ [무시하고 설치]</strong>를 터치하시면 됩니다.
                                </p>
                            </div>

                            <div className="space-y-1 p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                                <h4 className="font-bold text-white flex items-center gap-1.5 text-xs">
                                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                                    전화 및 오버레이 권한 허용
                                </h4>
                                <p className="text-slate-400 pl-5 leading-relaxed text-[11px]">
                                    앱 실행 후 "전화" 및 "다른 앱 위에 표시" 권한을 허용하시면 수신 팝업과 통화 감지가 시작됩니다.
                                </p>
                            </div>
                        </div>

                        <div className="pt-2 flex items-center gap-2">
                            <a
                                href="./downloads/leadmaster.apk"
                                download="leadmaster-crm.apk"
                                onClick={() => setShowGuide(false)}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md active:scale-95"
                            >
                                <Download size={14} />
                                <span>APK 다운로드</span>
                            </a>
                            <button
                                type="button"
                                onClick={() => setShowGuide(false)}
                                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
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
