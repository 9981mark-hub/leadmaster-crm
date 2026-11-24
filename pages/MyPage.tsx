import React, { useState, useEffect, useRef } from 'react';
import {
    User,
    Mail,
    LogOut,
    ShieldCheck,
    Plus,
    Trash2,
    Users,
    Lock,
    Monitor,
    Globe,
    Phone,
    Bell,
    Clock,
    Mic,
    Volume2,
    Play,
    CheckCircle,
    Sliders,
    Sun,
    Moon,
    ShieldAlert,
    Headphones,
    Sparkles,
    Smartphone,
    MousePointer,
    AlertCircle,
    Camera,
    RotateCcw
} from 'lucide-react';
import { AttendanceHeaderWidget } from '../components/hr/AttendanceHeaderWidget';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { saveGlobalSettings } from '../services/api';
import { PageShell, Card, Button } from '../components/ui';
import { AvatarSettingModal } from '../components/mypage/AvatarSettingModal';
import {
    loadUserPreferences,
    saveUserPreferences,
    playNotificationSound,
    UserPreferences,
    SoundType
} from '../services/userPrefs';

interface PopupTemplate {
    name: string;
    displayName: string;
}

export default function MyPage() {
    const { showToast } = useToast();
    const { confirm } = useConfirmDialog();
    const { theme, toggleTheme } = useTheme();
    const {
        logout,
        user,
        org,
        isAdmin,
        isPlatformAdmin,
        allowedEmails,
        addAllowedEmail,
        removeAllowedEmail,
        updateProfilePicture
    } = useAuth();

    // -------------------------------------------------------------
    // 대표 프로필 사진 설정 모달 상태
    // -------------------------------------------------------------
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

    const handleSaveAvatar = async (newPictureUrl: string | null) => {
        try {
            await updateProfilePicture(newPictureUrl);
            if (newPictureUrl === 'NONE') {
                showToast('대표 이미지가 삭제되고 기본 이니셜 아바타로 변경되었습니다.', 'info');
            } else if (newPictureUrl === null) {
                showToast('Google 계정 원래 프로필 사진으로 복원되었습니다.', 'success');
            } else {
                showToast('대표 프로필 이미지가 성공적으로 변경되었습니다.', 'success');
            }
        } catch (err: any) {
            showToast('프로필 이미지 저장에 실패했습니다.', 'error');
        }
    };

    // -------------------------------------------------------------
    // 직급 및 권한 체계 판별
    // -------------------------------------------------------------
    const isOwner = org?.role === 'owner' || isPlatformAdmin || user?.email === (org as any)?.ownerEmail;
    const adminTier = org?.adminPermissions?.tier || (isOwner ? 3 : 1);
    const isExecutive = isOwner || (isAdmin && adminTier === 3);
    const isTeamLeader = isAdmin && !isOwner && adminTier < 3;
    const isAgent = !isAdmin;

    const myTeamName = (user as any)?.teamName || (org as any)?.teamName || '1팀';

    // -------------------------------------------------------------
    // CRM 표시 이름 & 직통 내선 번호 설정
    // -------------------------------------------------------------
    const [managerName, setManagerName] = useState(() => {
        return (user as any)?.managerName || localStorage.getItem('leadmaster_manager_name') || user?.name || '';
    });
    const [directExtension, setDirectExtension] = useState(() => {
        return (user as any)?.extension || localStorage.getItem('leadmaster_direct_extension') || '';
    });

    const handleSaveName = () => {
        if (!managerName.trim()) {
            showToast('이름을 입력해주세요.', 'error');
            return;
        }
        localStorage.setItem('leadmaster_manager_name', managerName.trim());
        showToast('CRM 표시 이름이 로컬에 저장되었습니다.');
    };

    const handleSaveExtension = () => {
        localStorage.setItem('leadmaster_direct_extension', directExtension.trim());
        showToast('직통 내선 번호가 로컬에 저장되었습니다.');
    };

    // -------------------------------------------------------------
    // 사용자 개인화 설정 (로컬 스토리지 연동)
    // -------------------------------------------------------------
    const [prefs, setPrefs] = useState<UserPreferences>(() => loadUserPreferences());

    const updatePref = (patch: Partial<UserPreferences>) => {
        setPrefs((prev) => {
            const next = { ...prev, ...patch };
            saveUserPreferences(next);
            return next;
        });
        showToast('설정이 저장되었습니다.');
    };

    // 벨소리 미리듣기
    const handlePlayTestSound = () => {
        playNotificationSound(prefs.soundType, prefs.soundVolume);
    };

    // -------------------------------------------------------------
    // 접속 환경 정보 (IP, 브라우저)
    // -------------------------------------------------------------
    const [ipAddress, setIpAddress] = useState<string>('조회 중...');
    const [deviceInfo, setDeviceInfo] = useState<string>('');

    useEffect(() => {
        fetch('https://api.ipify.org?format=json')
            .then((res) => res.json())
            .then((data) => setIpAddress(data.ip))
            .catch(() => setIpAddress('127.0.0.1 (로컬)'));

        const ua = navigator.userAgent;
        let browser = 'Unknown Browser';
        if (ua.includes('Chrome')) browser = 'Google Chrome';
        else if (ua.includes('Safari')) browser = 'Apple Safari';
        else if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
        else if (ua.includes('Edge')) browser = 'Microsoft Edge';

        let os = 'Unknown OS';
        if (ua.includes('Windows')) os = 'Windows';
        else if (ua.includes('Mac')) os = 'macOS';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iPhone')) os = 'iOS';

        setDeviceInfo(`${browser} on ${os}`);
    }, []);

    // -------------------------------------------------------------
    // 관리자 Google 로그인 허용 계정 관리 (대표 전용)
    // -------------------------------------------------------------
    const [newEmail, setNewEmail] = useState('');

    // -------------------------------------------------------------
    // Android 앱 전용 브릿지 상태
    // -------------------------------------------------------------
    const [isAndroidApp, setIsAndroidApp] = useState(false);
    const [availableTemplates, setAvailableTemplates] = useState<PopupTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState('modern');
    const [floatingButtonEnabled, setFloatingButtonEnabled] = useState(true);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.AndroidBridge) {
            setIsAndroidApp(true);
            try {
                if (window.AndroidBridge.getAvailablePopupTemplates) {
                    const templatesJson = window.AndroidBridge.getAvailablePopupTemplates();
                    setAvailableTemplates(JSON.parse(templatesJson));
                }
                if (window.AndroidBridge.getPopupTemplate) {
                    setSelectedTemplate(window.AndroidBridge.getPopupTemplate());
                }
                if (window.AndroidBridge.isFloatingButtonEnabled) {
                    setFloatingButtonEnabled(window.AndroidBridge.isFloatingButtonEnabled());
                }
            } catch (e) {
                console.error('Failed to init AndroidBridge in MyPage', e);
            }
        }
    }, []);

    // -------------------------------------------------------------
    // 마이크 볼륨 실시간 테스트 (Web Audio API)
    // -------------------------------------------------------------
    const [isTestingMic, setIsTestingMic] = useState(false);
    const [micVolume, setMicVolume] = useState(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            stopMicTest();
        };
    }, []);

    const startMicTest = async () => {
        if (isTestingMic) {
            stopMicTest();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            micStreamRef.current = stream;

            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContextClass();
            audioContextRef.current = audioCtx;

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const checkVolume = () => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                const normalized = Math.min(100, Math.round((average / 128) * 100));
                setMicVolume(normalized);
                animFrameRef.current = requestAnimationFrame(checkVolume);
            };

            setIsTestingMic(true);
            checkVolume();
            showToast('마이크 테스트가 시작되었습니다. 마이크에 대고 말씀해보세요.');
        } catch (err) {
            console.error('Mic access error:', err);
            showToast('마이크 접근 권한이 없거나 마이크가 연결되지 않았습니다.', 'error');
            stopMicTest();
        }
    };

    const stopMicTest = () => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((track) => track.stop());
            micStreamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
        setIsTestingMic(false);
        setMicVolume(0);
    };

    const handleRequestDesktopNotification = async () => {
        if (!('Notification' in window)) {
            showToast('이 브라우저는 데스크톱 알림을 지원하지 않습니다.', 'error');
            return;
        }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            updatePref({ desktopNotification: true });
            new Notification('LeadMaster 알림 활성화', {
                body: '신규 리드 및 주요 업무 알림을 바탕화면에서 실시간 수신합니다.',
                icon: '/favicon.ico'
            });
            showToast('바탕화면 푸시 알림이 활성화되었습니다.');
        } else {
            updatePref({ desktopNotification: false });
            showToast('알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.', 'error');
        }
    };

    const handleLogout = () => {
        logout();
        showToast('로그아웃 되었습니다.');
    };

    const handleEmergencyForceLogoutAll = async () => {
        const ok = await confirm({
            title: '대표 전용 긴급 보안 통제',
            message: '현재 접속 중인 모든 기기(PC, 모바일)의 세션을 일괄 강제 만료시키고 로그아웃 처리하시겠습니까?\n\n보안 침해 의심 또는 긴급 세션 파기 시에만 사용하십시오.',
            confirmLabel: '강제 만료 및 로그아웃',
            cancelLabel: '취소',
            variant: 'destructive'
        });
        if (!ok) return;
        logout();
        showToast('모든 기기의 세션이 강제 종료되었습니다. 다시 로그인하십시오.');
    };

    const handleAddEmail = () => {
        if (!newEmail.trim()) return;
        if (!newEmail.includes('@')) {
            showToast('올바른 이메일 형식이 아닙니다.', 'error');
            return;
        }
        if (allowedEmails.includes(newEmail)) {
            showToast('이미 등록된 이메일입니다.', 'error');
            return;
        }
        addAllowedEmail(newEmail.trim());
        setNewEmail('');
        showToast('허용 관리자 이메일이 추가되었습니다.');
    };

    const handleRemoveEmail = async (email: string) => {
        if (allowedEmails.length <= 1) {
            showToast('최소 한 개의 관리자 계정은 유지되어야 합니다.', 'error');
            return;
        }
        const ok = await confirm({
            title: '관리자 권한 삭제',
            message: `'${email}' 계정의 관리자 접근 권한을 삭제하시겠습니까?`,
            confirmLabel: '권한 삭제',
            cancelLabel: '취소',
            variant: 'destructive'
        });
        if (!ok) return;
        removeAllowedEmail(email);
        showToast('권한이 삭제되었습니다.');
    };

    const handleTemplateChange = (templateName: string) => {
        setSelectedTemplate(templateName);
        window.AndroidBridge?.setPopupTemplate(templateName);
        showToast('팝업 템플릿이 변경되었습니다.');
    };

    const handleFloatingButtonToggle = () => {
        const newValue = !floatingButtonEnabled;
        setFloatingButtonEnabled(newValue);
        window.AndroidBridge?.setFloatingButtonEnabled(newValue);
        showToast(newValue ? '플로팅 버튼이 활성화되었습니다.' : '플로팅 버튼이 비활성화되었습니다.');
    };

    return (
        <PageShell title="마이페이지" icon={User} layout="wide">
            <div className="space-y-6 pb-28 sm:pb-36">

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* ── [구간 1] 상단 올인원 콕핏 프로필 & 근태 배너 (1600px) ── */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5 card-interactive">
                    
                    {/* 1-1. 아바타 사진 & 신원 정보 */}
                    <div className="flex items-center gap-4 min-w-0">
                        {/* 대표 프로필 이미지 (클릭 시 사진 변경 모달) */}
                        <div
                            className="relative group shrink-0 cursor-pointer"
                            onClick={() => setIsAvatarModalOpen(true)}
                            title="클릭하여 대표 프로필 사진 설정"
                        >
                            {user?.picture ? (
                                <img
                                    src={user.picture}
                                    alt="Profile"
                                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-border shadow-xs object-cover transition-all group-hover:brightness-90 group-hover:scale-[1.02]"
                                />
                            ) : (
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-2xl shadow-xs transition-all group-hover:brightness-90 group-hover:scale-[1.02]">
                                    {user?.name?.charAt(0) || 'U'}
                                </div>
                            )}

                            {/* 호버 시 사진 변경 오버레이 */}
                            <div className="absolute inset-0 rounded-2xl bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold gap-0.5">
                                <Camera size={16} className="drop-shadow" />
                                <span>사진 변경</span>
                            </div>

                            {/* 우측 하단 카메라 배지 버튼 */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAvatarModalOpen(true);
                                }}
                                className="absolute -bottom-1 -right-1 p-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-xs border-2 border-background transition-transform active:scale-90"
                                title="대표 프로필 사진 설정"
                            >
                                <Camera size={12} />
                            </button>
                        </div>

                        {/* 이름, 이메일, 직급 & 소속 배지 */}
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight truncate">
                                    {managerName || user?.name}
                                </h2>

                                {/* 직급 뱃지 */}
                                {isOwner && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        <Sparkles size={11} /> 대표 최고 관리자
                                    </span>
                                )}
                                {isExecutive && !isOwner && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                        <ShieldCheck size={11} /> 총괄 실장 (Tier 3)
                                    </span>
                                )}
                                {isTeamLeader && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                        <Users size={11} /> 중간 관리자 (팀장)
                                    </span>
                                )}
                                {isAgent && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        <Headphones size={11} /> 전문 상담원
                                    </span>
                                )}

                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                                    소속: {myTeamName}
                                </span>
                            </div>

                            <p className="text-xs text-muted-foreground mt-1 truncate">{user?.email}</p>

                            {/* 빠른 프로필 액션 */}
                            <div className="flex items-center gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAvatarModalOpen(true)}
                                    className="btn-tactile inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors"
                                >
                                    <Camera size={11} /> 대표 사진
                                </button>
                                {user?.customPicture && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await handleSaveAvatar(null);
                                        }}
                                        className="btn-tactile inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                        title="구글 계정 원래 사진으로 복원"
                                    >
                                        <RotateCcw size={10} /> 구글 복원
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 1-2. 활동명 & 직통 내선 번호 콤팩트 인라인 폼 */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex items-center gap-1.5 bg-muted/60 p-1.5 pl-3 rounded-xl border border-border shadow-2xs">
                            <User size={13} className="text-muted-foreground shrink-0" />
                            <input
                                type="text"
                                placeholder="활동명"
                                value={managerName}
                                onChange={(e) => setManagerName(e.target.value)}
                                className="bg-transparent text-xs font-bold text-foreground outline-none w-28 placeholder:text-muted-foreground"
                            />
                            <button
                                type="button"
                                onClick={handleSaveName}
                                className="btn-tactile px-2.5 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors"
                            >
                                저장
                            </button>
                        </div>

                        <div className="flex items-center gap-1.5 bg-muted/60 p-1.5 pl-3 rounded-xl border border-border shadow-2xs">
                            <Phone size={13} className="text-muted-foreground shrink-0" />
                            <input
                                type="text"
                                placeholder="직통 내선 (예: 101)"
                                value={directExtension}
                                onChange={(e) => setDirectExtension(e.target.value)}
                                className="bg-transparent text-xs font-bold text-foreground outline-none w-36 placeholder:text-muted-foreground"
                            />
                            <button
                                type="button"
                                onClick={handleSaveExtension}
                                className="btn-tactile px-2.5 py-1 bg-secondary text-secondary-foreground rounded-lg text-xs font-bold hover:bg-secondary/80 transition-colors"
                            >
                                등록
                            </button>
                        </div>
                    </div>

                    {/* 1-3. 실시간 근태 위젯 & 유틸리티 액션 */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <div className="bg-muted/60 p-1 rounded-xl border border-border shadow-2xs">
                            <AttendanceHeaderWidget />
                        </div>
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="btn-tactile p-2 rounded-xl bg-card border border-border hover:bg-muted text-muted-foreground transition-colors shadow-2xs"
                            title="컬러 테마 전환"
                        >
                            {theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-purple-600" />}
                        </button>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="btn-tactile flex items-center gap-1 px-3 py-2 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 text-xs font-bold transition-colors shadow-2xs"
                        >
                            <LogOut size={13} /> 로그아웃
                        </button>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* ── [구간 2] 하단 3-Column 대칭형 관제 카드 그리드 (각 ~510px) ── */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">

                    {/* ───────────────────────────────────────────────────────── */}
                    {/* [COLUMN 1] 📞 CTI 통화 & 음향 하드웨어 환경 (폭 ~510px) */}
                    {/* ───────────────────────────────────────────────────────── */}
                    <div className="space-y-6">
                        
                        {/* 1-1. 통화 발신 및 CTI 환경 설정 */}
                        <Card className="card-interactive">
                            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                        <Phone size={16} className="text-blue-600 dark:text-blue-400" /> 통화 발신 및 CTI 환경
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        고객 전화 발신 장비와 통화 후 휴식 시간을 설정합니다.
                                    </p>
                                </div>
                            </div>

                            {/* 발신 방식 3종 세로 카드 (가로로 길어지지 않고 500px에 꽉 참) */}
                            <div className="space-y-2 mb-4">
                                <label className="block text-xs font-bold text-muted-foreground">
                                    기본 통화 발신 수단
                                </label>

                                <button
                                    type="button"
                                    onClick={() => updatePref({ callMethod: 'android_bridge' })}
                                    className={`btn-tactile w-full p-3 rounded-xl border text-left transition-all ${
                                        prefs.callMethod === 'android_bridge'
                                            ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/20'
                                            : 'border-border bg-card hover:bg-muted/50 text-foreground'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 font-bold text-xs">
                                            <Smartphone size={15} strokeWidth={1.75} className="text-primary" />
                                            <span>스마트폰 앱 연동 (추천)</span>
                                        </div>
                                        {prefs.callMethod === 'android_bridge' && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-primary text-primary-foreground">선택됨</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        안드로이드 앱을 통해 전용 업무폰으로 안전하게 자동 발신
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => updatePref({ callMethod: 'webrtc' })}
                                    className={`btn-tactile w-full p-3 rounded-xl border text-left transition-all ${
                                        prefs.callMethod === 'webrtc'
                                            ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/20'
                                            : 'border-border bg-card hover:bg-muted/50 text-foreground'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 font-bold text-xs">
                                            <Headphones size={15} strokeWidth={1.75} className="text-primary" />
                                            <span>PC 헤드셋 웹 다이얼</span>
                                        </div>
                                        {prefs.callMethod === 'webrtc' && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-primary text-primary-foreground">선택됨</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        PC 브라우저 마이크/헤드셋으로 컴퓨터에서 즉시 통화
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => updatePref({ callMethod: 'click_dial' })}
                                    className={`btn-tactile w-full p-3 rounded-xl border text-left transition-all ${
                                        prefs.callMethod === 'click_dial'
                                            ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/20'
                                            : 'border-border bg-card hover:bg-muted/50 text-foreground'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 font-bold text-xs">
                                            <MousePointer size={15} strokeWidth={1.75} className="text-muted-foreground" />
                                            <span>간편 클릭 다이얼</span>
                                        </div>
                                        {prefs.callMethod === 'click_dial' && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-primary text-primary-foreground">선택됨</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        고객 전화번호 클립보드 복사 및 팝업창 수동 확인
                                    </p>
                                </button>
                            </div>

                            {/* 통화 후 메모 정리 쿨다운 (자동 대기) */}
                            <div className="p-3.5 bg-muted/50 border border-border rounded-xl mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                        <Clock size={14} className="text-blue-600 dark:text-blue-400" /> 통화 후 메모 쿨다운
                                    </span>
                                    <span className="text-xs text-muted-foreground font-semibold">
                                        {prefs.callCooldownSeconds === 0 ? '즉시 배정' : `${prefs.callCooldownSeconds}초 대기`}
                                    </span>
                                </div>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {[0, 10, 30, 60].map((sec) => (
                                        <button
                                            key={sec}
                                            type="button"
                                            onClick={() => updatePref({ callCooldownSeconds: sec })}
                                            className={`btn-tactile py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                prefs.callCooldownSeconds === sec
                                                    ? 'bg-primary text-primary-foreground shadow-2xs'
                                                    : 'bg-card border border-border text-foreground hover:bg-muted'
                                            }`}
                                        >
                                            {sec === 0 ? '즉시' : `${sec}초`}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                                    통화 직후 다음 콜이 울리지 않도록 메모를 작성할 안전 시간입니다.
                                </p>
                            </div>

                            {/* 헤드셋 마이크 입력 테스트 */}
                            <div className="p-3.5 border border-border rounded-xl bg-card">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Mic size={15} className={isTestingMic ? 'text-rose-500 animate-pulse' : 'text-muted-foreground'} />
                                        <span className="text-xs font-bold text-foreground">
                                            마이크 입력 테스트
                                        </span>
                                    </div>
                                    <Button
                                        variant={isTestingMic ? 'danger' : 'secondary'}
                                        size="sm"
                                        onClick={startMicTest}
                                        className="btn-tactile text-xs h-7 px-2.5"
                                    >
                                        {isTestingMic ? '중지' : '테스트 시작'}
                                    </Button>
                                </div>

                                {/* 음량 게이지 바 */}
                                <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden mt-2">
                                    <div
                                        className={`h-full transition-all duration-75 ${
                                            micVolume > 75 ? 'bg-rose-500' : micVolume > 30 ? 'bg-emerald-500' : 'bg-primary'
                                        }`}
                                        style={{ width: `${micVolume}%` }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                                    {isTestingMic
                                        ? `음량 감지: ${micVolume}% (정상 시 초록색 게이지 반응)`
                                        : '통화 전 마이크 입력 감도와 정상 작동 여부를 점검합니다.'}
                                </p>
                            </div>

                            {/* Android 전용 수신 팝업 템플릿 (스마트폰 앱 접속 시만 노출) */}
                            {isAndroidApp && (
                                <div className="mt-4 pt-3.5 border-t border-border">
                                    <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                                        <Smartphone size={14} /> 스마트폰 수신 전화 팝업 디자인
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2 mb-2.5">
                                        {availableTemplates.map(template => (
                                            <button
                                                key={template.name}
                                                onClick={() => handleTemplateChange(template.name)}
                                                className={`btn-tactile p-2 rounded-lg border text-left text-xs font-semibold ${
                                                    selectedTemplate === template.name
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                        : 'border-border text-foreground'
                                                }`}
                                            >
                                                {template.displayName}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleFloatingButtonToggle}
                                        className="btn-tactile flex items-center justify-between w-full p-2 bg-muted/60 border border-border rounded-lg text-xs"
                                    >
                                        <span className="text-muted-foreground">통화 수신 후 미니 플로팅 버튼</span>
                                        <span className={`px-2 py-0.5 rounded font-bold ${floatingButtonEnabled ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                                            {floatingButtonEnabled ? 'ON' : 'OFF'}
                                        </span>
                                    </button>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* ───────────────────────────────────────────────────────── */}
                    {/* [COLUMN 2] 🔔 알림 사운드 & 업무 인터페이스 편의 (폭 ~510px) */}
                    {/* ───────────────────────────────────────────────────────── */}
                    <div className="space-y-6">

                        {/* 2-1. 개인 알림 및 사운드 설정 */}
                        <Card className="card-interactive">
                            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                        <Bell size={16} className="text-primary" /> 개인 알림 및 사운드
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        신규 리드 배정 벨소리와 맞춤 관제 알림을 설정합니다.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {/* 벨소리 선택 및 미리듣기 */}
                                <div className="p-3 bg-muted/40 border border-border rounded-xl">
                                    <div className="mb-2">
                                        <span className="text-xs font-semibold text-foreground">
                                            신규 고객 배정 벨소리
                                        </span>
                                        <p className="text-2xs text-muted-foreground font-mono">새로운 리드가 배정되었을 때 울릴 사운드입니다.</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            className="flex-1 p-2 text-xs bg-card border border-border text-foreground rounded-lg font-mono outline-none focus:ring-1 focus:ring-primary"
                                            value={prefs.soundType}
                                            onChange={(e) => updatePref({ soundType: e.target.value as SoundType })}
                                        >
                                            <option value="dingdong">딩동 (기본 2단 화음)</option>
                                            <option value="bell">맑은 종소리 (Bell)</option>
                                            <option value="marimba">통통 튀는 마림바 (Marimba)</option>
                                            <option value="chime">화사한 차임 (Chime)</option>
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handlePlayTestSound}
                                            className="flex items-center gap-1 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-mono font-medium transition-colors shadow-2xs cursor-pointer"
                                        >
                                            <Play size={12} /> 재생
                                        </button>
                                    </div>
                                </div>

                                {/* 알림 볼륨 조절 */}
                                <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-xs font-medium text-foreground font-mono">
                                        <Volume2 size={16} className="text-muted-foreground" />
                                        <span>볼륨 ({prefs.soundVolume}%)</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        className="w-32 sm:w-40 accent-primary cursor-pointer"
                                        value={prefs.soundVolume}
                                        onChange={(e) => updatePref({ soundVolume: Number(e.target.value) })}
                                    />
                                </div>

                                {/* 데스크톱 푸시 알림 토글 */}
                                <div className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-xl">
                                    <div className="pr-2">
                                        <span className="text-xs font-semibold text-foreground block">
                                            바탕화면 푸시 알림
                                        </span>
                                        <p className="text-2xs text-muted-foreground font-mono">다른 작업 중에도 팝업 알림을 수신합니다.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleRequestDesktopNotification}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors shrink-0 cursor-pointer shadow-2xs ${
                                            prefs.desktopNotification
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        {prefs.desktopNotification ? '작동 중 ✓' : '알림 켜기'}
                                    </button>
                                </div>

                                {/* 관리자 전용 맞춤 관제 알림 */}
                                {isAdmin && (
                                    <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-2.5">
                                        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                            <AlertCircle size={14} strokeWidth={1.75} className="text-primary" /> 관리자 맞춤 관제 알림
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">
                                                배정 후 10분 지체 시 즉시 알림
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => updatePref({ notifyUnanswered: !prefs.notifyUnanswered })}
                                                className={`btn-tactile px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                                    prefs.notifyUnanswered ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border'
                                                }`}
                                            >
                                                {prefs.notifyUnanswered ? 'ON' : 'OFF'}
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">
                                                부재콜 3회 누적 시 주의 알림
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => updatePref({ notifyAbsenceLimit: !prefs.notifyAbsenceLimit })}
                                                className={`btn-tactile px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                                    prefs.notifyAbsenceLimit ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border'
                                                }`}
                                            >
                                                {prefs.notifyAbsenceLimit ? 'ON' : 'OFF'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* 2-2. 화면 표시 및 편의 설정 */}
                        <Card className="card-interactive">
                            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                        <Sliders size={16} className="text-muted-foreground" /> 화면 표시 및 편의 설정
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        컬러 테마와 데이터 테이블 행 간격을 개인에 맞춥니다.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="p-3 bg-muted/50 border border-border rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                                        {theme === 'dark' ? <Moon size={15} className="text-purple-600 dark:text-purple-400" /> : <Sun size={15} className="text-amber-500" />}
                                        <span>컬러 테마 모드</span>
                                    </div>
                                    <Button variant="secondary" size="sm" onClick={toggleTheme} className="btn-tactile text-xs h-7 px-2.5">
                                        {theme === 'dark' ? '다크 모드 🌙' : '라이트 모드 ☀️'}
                                    </Button>
                                </div>

                                <div className="p-3 bg-muted/50 border border-border rounded-xl flex items-center justify-between">
                                    <div className="text-xs font-bold text-foreground">
                                        <span>케이스 목록 행 간격 밀도</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            type="button"
                                            onClick={() => updatePref({ tableDensity: 'normal' })}
                                            className={`btn-tactile px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                prefs.tableDensity === 'normal'
                                                    ? 'bg-primary text-primary-foreground shadow-2xs'
                                                    : 'bg-card border border-border text-foreground'
                                            }`}
                                        >
                                            기본형
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updatePref({ tableDensity: 'compact' })}
                                            className={`btn-tactile px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                prefs.tableDensity === 'compact'
                                                    ? 'bg-primary text-primary-foreground shadow-2xs'
                                                    : 'bg-card border border-border text-foreground'
                                            }`}
                                        >
                                            좁게
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* ───────────────────────────────────────────────────────── */}
                    {/* [COLUMN 3] 🛡️ 시스템 권한 인스펙터 & 계정 보안 관제 (폭 ~510px) */}
                    {/* ───────────────────────────────────────────────────────── */}
                    <div className="space-y-6">

                        {/* 3-1. 시스템 권한 인스펙터 */}
                        <Card className="card-interactive">
                            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <ShieldCheck size={16} className="text-primary" /> 나의 시스템 권한 인스펙터
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        현재 내 계정에 부여된 전사 권한 범위를 투명하게 확인합니다.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {isOwner ? (
                                    <>
                                        <div className="p-2.5 bg-card border border-border shadow-2xs rounded-lg flex items-center gap-2.5 hover:border-primary/40 transition-colors">
                                            <CheckCircle size={15} className="text-primary shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-semibold text-foreground">전사 7대 시스템 완전 통제권</p>
                                                <p className="text-2xs text-muted-foreground">조직 소유자(Owner) 전권 보유</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 bg-card border border-border shadow-2xs rounded-lg flex items-center gap-2.5 hover:border-primary/40 transition-colors">
                                            <CheckCircle size={15} className="text-primary shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-semibold text-foreground">거래처 수수료율 및 정산 손익</p>
                                                <p className="text-2xs text-muted-foreground">최고 경영 기밀 완전 열람</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 bg-card border border-border shadow-2xs rounded-lg flex items-center gap-2.5 hover:border-primary/40 transition-colors">
                                            <CheckCircle size={15} className="text-primary shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-semibold text-foreground">긴급 데이터 즉시 파기 및 복원</p>
                                                <p className="text-2xs text-muted-foreground">소유자 전용 최고 보안 권한</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 bg-card border border-border shadow-2xs rounded-lg flex items-center gap-2.5 hover:border-primary/40 transition-colors">
                                            <CheckCircle size={15} className="text-primary shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-semibold text-foreground">관리자 권한 위임 및 회수</p>
                                                <p className="text-2xs text-muted-foreground">전사 관리자 4대 티어 통제</p>
                                            </div>
                                        </div>
                                    </>
                                ) : isExecutive ? (
                                    <>
                                        <div className="p-2.5 bg-card border border-border shadow-2xs rounded-lg flex items-center gap-2.5 hover:border-primary/40 transition-colors">
                                            <CheckCircle size={15} className="text-primary shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-semibold text-foreground">전사 팀원 관리 및 인원 초대</p>
                                                <p className="text-2xs text-muted-foreground">총괄 실장 전사 관제 권한</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 bg-card border border-border shadow-2xs rounded-lg flex items-center gap-2.5 hover:border-primary/40 transition-colors">
                                            <CheckCircle size={15} className="text-primary shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-semibold text-foreground">AI 트레이닝 전사 훈련 관제</p>
                                                <p className="text-2xs text-muted-foreground">모의훈련 평가 및 정책 설정</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 bg-card border border-border shadow-2xs rounded-lg flex items-center gap-2.5 hover:border-primary/40 transition-colors">
                                            <CheckCircle size={15} className="text-primary shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-semibold text-foreground">데이터 백업 파일 다운로드</p>
                                                <p className="text-2xs text-muted-foreground">정기 백업 파일 안전 추출 가능</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 bg-muted/40 border border-border/60 rounded-lg flex items-center gap-2.5 opacity-60">
                                            <Lock size={15} className="text-muted-foreground shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-medium text-muted-foreground">긴급 데이터 영구 파기</p>
                                                <p className="text-2xs text-muted-foreground">조직 대표(Owner) 전용 제한</p>
                                            </div>
                                        </div>
                                    </>
                                ) : isTeamLeader ? (
                                    <>
                                        <div className="p-2.5 bg-card border border-border shadow-2xs rounded-lg flex items-center gap-2.5 hover:border-primary/40 transition-colors">
                                            <CheckCircle size={15} className="text-primary shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-semibold text-foreground">소속 팀원 통화 녹취 청취</p>
                                                <p className="text-2xs text-muted-foreground">{myTeamName} 소속 상담원 한정</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 bg-card border border-border shadow-2xs rounded-lg flex items-center gap-2.5 hover:border-primary/40 transition-colors">
                                            <CheckCircle size={15} className="text-primary shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-semibold text-foreground">AI 트레이닝 코칭 피드백</p>
                                                <p className="text-2xs text-muted-foreground">등급(S~F) 및 코멘트 작성</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 bg-card border border-border shadow-2xs rounded-lg flex items-center gap-2.5 hover:border-primary/40 transition-colors">
                                            <CheckCircle size={15} className="text-primary shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-semibold text-foreground">공통 업무 설정 안전 열람</p>
                                                <p className="text-2xs text-muted-foreground">뷰어 모드 접근 허용</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 bg-muted/40 border border-border/60 rounded-lg flex items-center gap-2.5 opacity-60">
                                            <Lock size={15} className="text-muted-foreground shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-medium text-muted-foreground">거래처 수수료율 및 경영 손익</p>
                                                <p className="text-2xs text-muted-foreground">경영 기밀 보호 (대표 전용)</p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-2.5 bg-card border border-border shadow-2xs rounded-lg flex items-center gap-2.5 hover:border-primary/40 transition-colors">
                                            <CheckCircle size={15} className="text-primary shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-semibold text-foreground">내 배정 고객 상담 및 콜 관리</p>
                                                <p className="text-2xs text-muted-foreground">배정 리드 100% 접근 및 CTI 발신</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 bg-card border border-border shadow-2xs rounded-lg flex items-center gap-2.5 hover:border-primary/40 transition-colors">
                                            <CheckCircle size={15} className="text-primary shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-semibold text-foreground">AI 트레이닝 모의 훈련 참여</p>
                                                <p className="text-2xs text-muted-foreground">6대 취약점 훈련 및 내 피드백</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 bg-muted/40 border border-border/60 rounded-lg flex items-center gap-2.5 opacity-60">
                                            <Lock size={15} className="text-muted-foreground shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-medium text-muted-foreground">타 팀원 리드 및 녹취 열람</p>
                                                <p className="text-2xs text-muted-foreground">개인정보 보호를 위한 접근 차단</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 bg-muted/40 border border-border/60 rounded-lg flex items-center gap-2.5 opacity-60">
                                            <Lock size={15} className="text-muted-foreground shrink-0" />
                                            <div className="min-w-0 font-mono">
                                                <p className="text-xs font-medium text-muted-foreground">정산 손익 및 시스템 설정</p>
                                                <p className="text-2xs text-muted-foreground">관리자 전용 메뉴 은닉</p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </Card>

                        {/* 3-2. 계정 보안 및 세션 관리 */}
                        <Card className="card-interactive">
                            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
                                <ShieldCheck size={16} className="text-emerald-600" /> 계정 보안 및 현재 세션
                            </h4>

                            <div className="space-y-2 mb-3.5">
                                <div className="flex items-center p-2.5 bg-muted/50 border border-border rounded-xl">
                                    <Globe className="mr-2.5 text-muted-foreground shrink-0" size={15} />
                                    <div className="min-w-0">
                                        <p className="text-xs text-muted-foreground">현재 접속 IP</p>
                                        <p className="text-xs font-mono font-bold text-foreground">{ipAddress}</p>
                                    </div>
                                </div>

                                <div className="flex items-center p-2.5 bg-muted/50 border border-border rounded-xl">
                                    <Monitor className="mr-2.5 text-muted-foreground shrink-0" size={15} />
                                    <div className="min-w-0">
                                        <p className="text-xs text-muted-foreground">접속 환경</p>
                                        <p className="text-xs font-mono truncate text-foreground">{deviceInfo || 'Chrome on Windows'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* 대표 전용 긴급 원격 전체 로그아웃 */}
                            {isOwner && (
                                <div className="mb-3 p-3 bg-muted/40 rounded-xl border border-border">
                                    <div className="flex items-center gap-1.5 text-foreground text-xs font-semibold mb-1">
                                        <ShieldAlert size={14} className="text-amber-500" /> 최고 관리자 긴급 보안 통제
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-2 leading-relaxed break-keep">
                                        보안 위협 시 모든 기기의 세션을 즉시 강제 종료합니다.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleEmergencyForceLogoutAll}
                                        className="btn-tactile w-full py-2 px-3 bg-card border border-border text-foreground hover:bg-muted rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                                    >
                                        다른 모든 기기 강제 세션 해제
                                    </button>
                                </div>
                            )}

                            <Button variant="outline" size="md" onClick={handleLogout} className="btn-tactile w-full text-destructive hover:bg-destructive/10 border-destructive/20">
                                <LogOut size={15} /> 안전하게 로그아웃
                            </Button>
                        </Card>

                        {/* 3-3. (대표 전용) 관리자 로그인 허용 Google 계정 관리 */}
                        {isOwner && (
                            <Card className="card-interactive">
                                <h3 className="text-sm font-bold text-foreground mb-1.5 flex items-center gap-2">
                                    <Users size={16} className="text-primary" /> 관리자 허용 Google 계정
                                </h3>
                                <p className="text-xs text-muted-foreground mb-3">
                                    관리자로 로그인할 수 있는 Google 계정을 관리합니다.
                                </p>

                                <div className="flex gap-1.5 mb-3">
                                    <input
                                        type="email"
                                        placeholder="이메일 입력 (예: admin@example.com)"
                                        className="flex-1 p-2 border border-border rounded-xl outline-none text-xs bg-background text-foreground placeholder:text-muted-foreground"
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); } }}
                                    />
                                    <Button variant="primary" size="sm" onClick={handleAddEmail} className="btn-tactile text-xs h-8 px-2.5">
                                        <Plus size={14} /> 추가
                                    </Button>
                                </div>

                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {allowedEmails.map(email => (
                                        <div
                                            key={email}
                                            className="flex justify-between items-center p-2 bg-muted/50 rounded-xl border border-border"
                                        >
                                            <span className="text-xs font-semibold text-foreground font-mono truncate">
                                                {email}
                                            </span>
                                            {allowedEmails.length > 1 && (
                                                <button
                                                    onClick={() => handleRemoveEmail(email)}
                                                    className="btn-tactile text-muted-foreground hover:text-destructive p-1 rounded-lg transition-colors shrink-0"
                                                    title="계정 삭제"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            </div>

            {/* 대표 프로필 사진 설정 모달 */}
            <AvatarSettingModal
                isOpen={isAvatarModalOpen}
                onClose={() => setIsAvatarModalOpen(false)}
                currentPicture={user?.picture}
                googlePicture={user?.googlePicture}
                userName={managerName || user?.name || '사용자'}
                onSavePicture={handleSaveAvatar}
            />
        </PageShell>
    );
}
