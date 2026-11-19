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
    FileText,
    Check,
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
import { saveGlobalSettings } from '../services/api';
import { PageShell, Card, Button } from '../components/ui';
import { AvatarSettingModal } from '../components/mypage/AvatarSettingModal';
import {
    loadUserPreferences,
    saveUserPreferences,
    playNotificationSound,
    UserPreferences,
    CallMethodType,
    SoundType,
    TableDensityType
} from '../services/userPrefs';

interface PopupTemplate {
    name: string;
    displayName: string;
}

export default function MyPage() {
    const { showToast } = useToast();
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
    // 계정 기본 상태
    // -------------------------------------------------------------
    const [managerName, setManagerName] = useState('');
    const [directExtension, setDirectExtension] = useState('');
    const [newEmail, setNewEmail] = useState('');

    // 보안 및 기기 정보
    const [ipAddress, setIpAddress] = useState<string>('확인 중...');
    const [deviceInfo, setDeviceInfo] = useState<string>('');

    // 개인 업무 환경 설정 (UserPreferences)
    const [prefs, setPrefs] = useState<UserPreferences>(() => loadUserPreferences());

    // 마이크 테스트 상태
    const [isTestingMic, setIsTestingMic] = useState(false);
    const [micVolume, setMicVolume] = useState(0);
    const micStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animFrameRef = useRef<number | null>(null);

    // Android Popup Settings State
    const [isAndroidApp, setIsAndroidApp] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('CARD');
    const [floatingButtonEnabled, setFloatingButtonEnabled] = useState(true);
    const [availableTemplates, setAvailableTemplates] = useState<PopupTemplate[]>([]);

    useEffect(() => {
        // LocalStorage 및 DB에서 표시 이름 로드
        const storedManagerName = localStorage.getItem('managerName');
        setManagerName(storedManagerName || user?.name || '');

        const storedExt = localStorage.getItem('lm_direct_extension') || '';
        setDirectExtension(storedExt);

        // Get Device Info
        setDeviceInfo(navigator.userAgent);

        // Get IP Address
        fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => setIpAddress(data.ip))
            .catch(() => setIpAddress('127.0.0.1 (로컬/내부망)'));

        // Check if running in Android app and load popup settings
        if (window.AndroidBridge?.isAndroidApp?.()) {
            setIsAndroidApp(true);
            try {
                const templatesJson = window.AndroidBridge.getAvailableTemplates();
                const templates = JSON.parse(templatesJson) as PopupTemplate[];
                setAvailableTemplates(templates);

                const settingsJson = window.AndroidBridge.getPopupSettings();
                const settings = JSON.parse(settingsJson);
                setSelectedTemplate(settings.template);
                setFloatingButtonEnabled(settings.floatingButtonEnabled);
            } catch (e) {
                console.error('Failed to load Android settings', e);
            }
        }

        return () => {
            stopMicTest();
        };
    }, [user]);

    // -------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------
    const handleSaveName = async () => {
        await saveGlobalSettings({ managerName });
        localStorage.setItem('managerName', managerName);
        showToast('CRM 표시 이름이 안전하게 저장되었습니다.');
    };

    const handleSaveExtension = () => {
        localStorage.setItem('lm_direct_extension', directExtension);
        updatePref({ directPhoneExtension: directExtension });
        showToast('직통 내선 번호가 등록되었습니다.');
    };

    const updatePref = (updates: Partial<UserPreferences>) => {
        const updated = saveUserPreferences(updates);
        setPrefs(updated);
    };

    const handlePlayTestSound = () => {
        playNotificationSound(prefs.soundType, prefs.soundVolume);
    };

    // 마이크 테스트 시작/중지
    const startMicTest = async () => {
        if (isTestingMic) {
            stopMicTest();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = stream;

            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioCtx();
            audioContextRef.current = audioCtx;

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            setIsTestingMic(true);

            const checkVolume = () => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                // 0 ~ 100 범위로 정규화
                setMicVolume(Math.min(100, Math.round((average / 128) * 100)));
                animFrameRef.current = requestAnimationFrame(checkVolume);
            };

            checkVolume();
            showToast('마이크 테스트를 시작했습니다. 마이크에 대고 말씀해보세요.');
        } catch (err) {
            console.warn('마이크 접근 실패:', err);
            showToast('마이크 장치에 접근할 수 없습니다. 브라우저 권한을 확인해주세요.', 'error');
            setIsTestingMic(false);
        }
    };

    const stopMicTest = () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
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

    const handleEmergencyForceLogoutAll = () => {
        if (!window.confirm('⚠️ [대표 전용 긴급 보안 통제]\n\n현재 접속 중인 모든 기기(PC, 모바일)의 세션을 일괄 강제 만료시키고 로그아웃 처리하시겠습니까?\n\n보안 침해 의심 또는 긴급 세션 파기 시에만 사용하십시오.')) {
            return;
        }
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

    const handleRemoveEmail = (email: string) => {
        if (allowedEmails.length <= 1) {
            showToast('최소 한 개의 관리자 계정은 유지되어야 합니다.', 'error');
            return;
        }
        if (!window.confirm(`'${email}' 계정의 관리자 접근 권한을 삭제하시겠습니까?`)) return;
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
        <PageShell title="마이페이지" icon={User} layout="compact">
            {/* 2-Column 대칭형 레이아웃: 좌측(계정/근태/보안) + 우측(통화환경/알림/권한) */}
            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* ── 좌측 컬럼: 계정 프로필, 근태, 계정 보안 ── */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <div className="space-y-6">

                    {/* 1. 프로필 카드 */}
                    <Card>
                        <div className="flex flex-col items-center text-center pb-5 border-b border-gray-150 dark:border-gray-700/80 mb-5">
                            {/* 대표 프로필 이미지 (클릭 시 사진 변경 모달) */}
                            <div
                                className="relative group mb-2.5 cursor-pointer"
                                onClick={() => setIsAvatarModalOpen(true)}
                                title="클릭하여 대표 프로필 사진 설정"
                            >
                                {user?.picture ? (
                                    <img
                                        src={user.picture}
                                        alt="Profile"
                                        className="w-20 h-20 rounded-2xl border-2 border-white dark:border-gray-700 shadow-md object-cover transition-all group-hover:brightness-90 group-hover:scale-[1.02]"
                                    />
                                ) : (
                                    <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-md transition-all group-hover:brightness-90 group-hover:scale-[1.02]">
                                        {user?.name?.charAt(0) || 'U'}
                                    </div>
                                )}

                                {/* 호버 시 사진 변경 오버레이 */}
                                <div className="absolute inset-0 rounded-2xl bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold gap-0.5">
                                    <Camera size={18} className="drop-shadow" />
                                    <span>사진 변경</span>
                                </div>

                                {/* 우측 하단 카메라 배지 버튼 */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsAvatarModalOpen(true);
                                    }}
                                    className="absolute -bottom-1 -right-1 p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md border-2 border-white dark:border-gray-800 transition-transform active:scale-90"
                                    title="대표 프로필 사진 설정"
                                >
                                    <Camera size={13} />
                                </button>
                            </div>

                            {/* 프로필 이미지 빠른 설정 버튼 */}
                            <div className="flex items-center gap-1.5 mb-2.5">
                                <button
                                    type="button"
                                    onClick={() => setIsAvatarModalOpen(true)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 transition-colors shadow-2xs"
                                >
                                    <Camera size={12} /> 대표 사진 설정
                                </button>
                                {user?.customPicture && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await handleSaveAvatar(null);
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                        title="구글 계정 원래 사진으로 복원"
                                    >
                                        <RotateCcw size={11} /> 구글 복원
                                    </button>
                                )}
                            </div>

                            <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                {managerName || user?.name}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user?.email}</p>

                            {/* 직급 뱃지 */}
                            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
                                {isOwner && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                        <Sparkles size={12} /> 대표 최고 관리자
                                    </span>
                                )}
                                {isExecutive && !isOwner && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                        <ShieldCheck size={12} /> 총괄 실장 (Tier 3)
                                    </span>
                                )}
                                {isTeamLeader && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                        <Users size={12} /> 중간 관리자 (팀장)
                                    </span>
                                )}
                                {isAgent && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                        <Headphones size={12} /> 전문 상담원
                                    </span>
                                )}

                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                                    소속: {myTeamName}
                                </span>
                            </div>
                        </div>

                        {/* CRM 표시 이름 & 로그인 정보 */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    CRM 표시 이름
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            className="w-full p-2.5 pl-9 text-xs font-bold border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                            value={managerName}
                                            onChange={(e) => setManagerName(e.target.value)}
                                        />
                                        <User className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400" size={15} />
                                    </div>
                                    <Button variant="primary" size="sm" onClick={handleSaveName}>
                                        저장
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">상담 히스토리, 통화 기록, 정산표에 노출되는 활동명입니다.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    직통 내선 번호 (내선/착신)
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            placeholder="예: 070-1234-5678 또는 101"
                                            className="w-full p-2.5 pl-9 text-xs border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                            value={directExtension}
                                            onChange={(e) => setDirectExtension(e.target.value)}
                                        />
                                        <Phone className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={15} />
                                    </div>
                                    <Button variant="secondary" size="sm" onClick={handleSaveExtension}>
                                        등록
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">외부 콜백 연결 및 팀원 간 직통 호전환에 사용됩니다.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    로그인 이메일 (Google 연동)
                                </label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        className="w-full p-2.5 pl-9 text-xs border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 cursor-not-allowed outline-none"
                                        value={user?.email || ''}
                                        readOnly
                                    />
                                    <Mail className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400" size={15} />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* 2. 실시간 근태 및 출퇴근 위젯 카드 */}
                    <Card>
                        <div className="flex items-center justify-between pb-3 border-b border-gray-150 dark:border-gray-700/80 mb-3">
                            <span className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                <Clock size={16} className="text-blue-600" /> 오늘 나의 근태 상태
                            </span>
                            <AttendanceHeaderWidget />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                            출근, 자리비움(이석), 식사, 퇴근 상태를 클릭하여 변경할 수 있으며, 팀 관리 및 통계 센터에 실시간 반영됩니다.
                        </p>
                    </Card>

                    {/* 3. 계정 보안 및 세션 관리 카드 */}
                    <Card>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
                            <ShieldCheck size={16} className="text-emerald-600" /> 계정 보안 및 세션
                        </h4>

                        <div className="space-y-2.5 mb-4">
                            <div className="flex items-center p-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/80 rounded-xl">
                                <Globe className="mr-2.5 text-gray-500 dark:text-gray-400 shrink-0" size={16} />
                                <div className="min-w-0">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">현재 접속 IP</p>
                                    <p className="text-xs font-mono font-bold text-gray-800 dark:text-gray-200">{ipAddress}</p>
                                </div>
                            </div>

                            <div className="flex items-center p-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/80 rounded-xl">
                                <Monitor className="mr-2.5 text-gray-500 dark:text-gray-400 shrink-0" size={16} />
                                <div className="min-w-0">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">접속 브라우저 및 환경</p>
                                    <p className="text-xs font-mono truncate text-gray-700 dark:text-gray-300">{deviceInfo || 'Chrome on Windows'}</p>
                                </div>
                            </div>
                        </div>

                        {/* 대표 전용 긴급 원격 전체 로그아웃 */}
                        {isOwner && (
                            <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 text-xs font-bold mb-1">
                                    <ShieldAlert size={14} /> 최고 관리자 긴급 보안
                                </div>
                                <p className="text-xs text-amber-600/90 dark:text-amber-400/90 mb-2.5">
                                    보안 위협 시 현재 로그인된 모든 기기(PC/모바일)의 세션을 즉시 강제 종료합니다.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleEmergencyForceLogoutAll}
                                    className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                                >
                                    다른 모든 기기 강제 세션 해제
                                </button>
                            </div>
                        )}

                        <Button variant="danger" size="md" onClick={handleLogout} className="w-full">
                            <LogOut size={16} /> 안전하게 로그아웃
                        </Button>
                    </Card>
                </div>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* ── 우측 컬럼: 통화 환경, 알림, 권한 인스펙터, UI ── */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <div className="space-y-6">

                    {/* 4. 통화 발신 및 CTI 환경 설정 카드 */}
                    <Card>
                        <div className="flex items-center justify-between pb-3 border-b border-gray-150 dark:border-gray-700/80 mb-4">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <Phone size={18} className="text-blue-600" /> 통화 발신 및 CTI 환경 설정
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    상담원이 고객에게 전화를 걸 때 사용할 통화 장비와 통화 후 휴식 시간을 설정합니다.
                                </p>
                            </div>
                        </div>

                        {/* 발신 방식 선택 */}
                        <div className="space-y-3 mb-5">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                                기본 통화 발신 방식
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => updatePref({ callMethod: 'android_bridge' })}
                                    className={`p-3 rounded-xl border text-left transition-all ${
                                        prefs.callMethod === 'android_bridge'
                                            ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 font-bold text-xs mb-1">
                                        <Smartphone size={15} />
                                        <span>스마트폰 앱 연동</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
                                        안드로이드 앱을 통해 업무폰으로 자동 발신
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => updatePref({ callMethod: 'webrtc' })}
                                    className={`p-3 rounded-xl border text-left transition-all ${
                                        prefs.callMethod === 'webrtc'
                                            ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 font-bold text-xs mb-1">
                                        <Headphones size={15} />
                                        <span>PC 헤드셋 웹 다이얼</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
                                        PC 브라우저 마이크/헤드셋으로 즉시 통화
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => updatePref({ callMethod: 'click_dial' })}
                                    className={`p-3 rounded-xl border text-left transition-all ${
                                        prefs.callMethod === 'click_dial'
                                            ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 font-bold text-xs mb-1">
                                        <MousePointer size={15} />
                                        <span>간편 클릭 다이얼</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
                                        번호 복사 및 팝업 안내창 수동 확인
                                    </p>
                                </button>
                            </div>
                        </div>

                        {/* 통화 종료 후 쿨다운 (휴식 시간) */}
                        <div className="p-3.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/80 rounded-xl mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                                <span className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                    <Clock size={14} className="text-blue-600 dark:text-blue-400" /> 통화 후 메모 정리 쿨다운 (자동 대기)
                                </span>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    통화가 끝난 직후 다음 콜이 배정되거나 전화가 울리지 않도록 메모를 작성할 휴식 시간입니다.
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {[0, 10, 30, 60].map((sec) => (
                                    <button
                                        key={sec}
                                        type="button"
                                        onClick={() => updatePref({ callCooldownSeconds: sec })}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            prefs.callCooldownSeconds === sec
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        {sec === 0 ? '즉시' : `${sec}초`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 마이크 및 오디오 입력 테스트 */}
                        <div className="p-3.5 border border-gray-200 dark:border-gray-700/80 rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Mic size={16} className={isTestingMic ? 'text-rose-500 animate-pulse' : 'text-gray-500 dark:text-gray-400'} />
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                        헤드셋 마이크 입력 테스트
                                    </span>
                                </div>
                                <Button
                                    variant={isTestingMic ? 'danger' : 'secondary'}
                                    size="sm"
                                    onClick={startMicTest}
                                >
                                    {isTestingMic ? '테스트 중지' : '마이크 테스트 시작'}
                                </Button>
                            </div>

                            {/* 음량 게이지 바 */}
                            <div className="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden mt-2">
                                <div
                                    className={`h-full transition-all duration-75 ${
                                        micVolume > 75 ? 'bg-rose-500' : micVolume > 30 ? 'bg-emerald-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${micVolume}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                                {isTestingMic
                                    ? `마이크 입력 감지 중: ${micVolume}% (정상 감지 시 게이지가 초록색으로 움직입니다)`
                                    : '버튼을 눌러 통화 전 마이크 상태를 점검할 수 있습니다.'}
                            </p>
                        </div>

                        {/* Android 전용 수신 팝업 템플릿 (스마트폰 앱 접속 시만 노출) */}
                        {isAndroidApp && (
                            <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700/80">
                                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2.5 flex items-center gap-1.5">
                                    <Smartphone size={15} /> 스마트폰 수신 전화 팝업 디자인
                                </h4>
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    {availableTemplates.map(template => (
                                        <button
                                            key={template.name}
                                            onClick={() => handleTemplateChange(template.name)}
                                            className={`p-2.5 rounded-lg border text-left text-xs font-semibold ${
                                                selectedTemplate === template.name
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            {template.displayName}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={handleFloatingButtonToggle}
                                    className="flex items-center justify-between w-full p-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/80 rounded-lg text-xs"
                                >
                                    <span className="text-gray-700 dark:text-gray-300">통화 수신 후 미니 플로팅 버튼 표시</span>
                                    <span className={`px-2 py-0.5 rounded font-bold ${floatingButtonEnabled ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                        {floatingButtonEnabled ? 'ON' : 'OFF'}
                                    </span>
                                </button>
                            </div>
                        )}
                    </Card>

                    {/* 5. 개인 알림 및 벨소리 설정 카드 */}
                    <Card>
                        <div className="flex items-center justify-between pb-3 border-b border-gray-150 dark:border-gray-700/80 mb-4">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <Bell size={18} className="text-amber-500" /> 개인 알림 및 사운드 설정
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    신규 리드 배정 시 울릴 벨소리와 직급별 맞춤 업무 알림을 설정합니다.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* 벨소리 선택 및 미리듣기 */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/80 rounded-xl">
                                <div>
                                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                        신규 리드 인입 벨소리
                                    </span>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">내게 새로운 고객이 배정되었을 때 울릴 사운드입니다.</p>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <select
                                        className="p-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl font-bold outline-none"
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
                                        className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                                    >
                                        <Play size={13} /> 미리듣기
                                    </button>
                                </div>
                            </div>

                            {/* 알림 볼륨 조절 */}
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/80 rounded-xl flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-gray-100">
                                    <Volume2 size={16} className="text-gray-500 dark:text-gray-400" />
                                    <span>알림 볼륨 ({prefs.soundVolume}%)</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    className="w-36 sm:w-48 accent-blue-600 cursor-pointer"
                                    value={prefs.soundVolume}
                                    onChange={(e) => updatePref({ soundVolume: Number(e.target.value) })}
                                />
                            </div>

                            {/* 데스크톱 푸시 알림 토글 */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/80 rounded-xl">
                                <div>
                                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                        브라우저 바탕화면 푸시 알림
                                    </span>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">다른 탭이나 다른 프로그램을 보고 있을 때 바탕화면 알림을 띄웁니다.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRequestDesktopNotification}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        prefs.desktopNotification
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-650'
                                    }`}
                                >
                                    {prefs.desktopNotification ? '작동 중 ✓' : '알림 켜기'}
                                </button>
                            </div>

                            {/* 팀장/실장/대표 전용: 팀 관리 특화 알림 */}
                            {isAdmin && (
                                <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl space-y-2.5">
                                    <div className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                                        <AlertCircle size={14} /> 관리자 맞춤 관제 알림
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-700 dark:text-gray-300">
                                            팀원 미응답(배정 후 10분 지체) 즉시 알림
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => updatePref({ notifyUnanswered: !prefs.notifyUnanswered })}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                prefs.notifyUnanswered ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                                            }`}
                                        >
                                            {prefs.notifyUnanswered ? 'ON' : 'OFF'}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-700 dark:text-gray-300">
                                            팀원 부재콜 3회 누적 시 주의 알림
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => updatePref({ notifyAbsenceLimit: !prefs.notifyAbsenceLimit })}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                prefs.notifyAbsenceLimit ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                                            }`}
                                        >
                                            {prefs.notifyAbsenceLimit ? 'ON' : 'OFF'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* 6. 내 위임 권한 상태 인스펙터 카드 */}
                    <Card>
                        <div className="flex items-center justify-between pb-3 border-b border-gray-150 dark:border-gray-700/80 mb-4">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <ShieldCheck size={18} className="text-indigo-600" /> 나의 시스템 권한 상태 인스펙터
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    조직 대표(Owner)가 현재 내 계정에 부여한 권한 범위를 투명하게 확인합니다.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* 대표: 최고 권한 안내 */}
                            {isOwner ? (
                                <>
                                    <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2.5">
                                        <CheckCircle size={16} className="text-amber-600 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">전사 7대 시스템 완전 통제권</p>
                                            <p className="text-xs text-gray-500">조직 소유자(Owner) 전권 보유</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2.5">
                                        <CheckCircle size={16} className="text-amber-600 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">거래처 수수료율 및 정산 손익</p>
                                            <p className="text-xs text-gray-500">최고 경영 기밀 완전 열람</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2.5">
                                        <CheckCircle size={16} className="text-amber-600 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">긴급 데이터 즉시 파기 및 복원</p>
                                            <p className="text-xs text-gray-500">소유자 전용 최고 보안 권한</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2.5">
                                        <CheckCircle size={16} className="text-amber-600 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">관리자 권한 위임 및 회수</p>
                                            <p className="text-xs text-gray-500">전사 관리자 4대 티어 통제</p>
                                        </div>
                                    </div>
                                </>
                            ) : isExecutive ? (
                                <>
                                    <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 rounded-xl flex items-center gap-2.5">
                                        <CheckCircle size={16} className="text-purple-600 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">전사 팀원 관리 및 인원 초대</p>
                                            <p className="text-xs text-gray-500">총괄 실장 전사 관제 권한</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 rounded-xl flex items-center gap-2.5">
                                        <CheckCircle size={16} className="text-purple-600 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">AI 트레이닝 전사 훈련 관제</p>
                                            <p className="text-xs text-gray-500">전사 모의훈련 평가 및 정책 설정</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 rounded-xl flex items-center gap-2.5">
                                        <CheckCircle size={16} className="text-purple-600 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">데이터 백업 파일 다운로드</p>
                                            <p className="text-xs text-gray-500">정기 백업 파일 안전 추출 가능</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center gap-2.5 opacity-70">
                                        <Lock size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">긴급 데이터 영구 파기</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">조직 대표(Owner) 전용 제한</p>
                                        </div>
                                    </div>
                                </>
                            ) : isTeamLeader ? (
                                <>
                                    <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-center gap-2.5">
                                        <CheckCircle size={16} className="text-blue-600 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">소속 팀원 통화 녹취 청취</p>
                                            <p className="text-xs text-gray-500">{myTeamName} 소속 상담원 한정</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-center gap-2.5">
                                        <CheckCircle size={16} className="text-blue-600 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">AI 트레이닝 팀원 코칭 피드백</p>
                                            <p className="text-xs text-gray-500">등급(S~F) 및 코멘트 작성</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-center gap-2.5">
                                        <CheckCircle size={16} className="text-blue-600 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">공통 업무 설정 안전 열람</p>
                                            <p className="text-xs text-gray-500">상태/주기 뷰어 모드 접근 허용</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center gap-2.5 opacity-70">
                                        <Lock size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">거래처 수수료율 및 경영 손익</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">경영 기밀 보호 (대표 전용)</p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center gap-2.5">
                                        <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">내 배정 고객 상담 및 콜 관리</p>
                                            <p className="text-xs text-gray-500">배정 리드 100% 접근 및 CTI 발신</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center gap-2.5">
                                        <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">AI 트레이닝 모의 훈련 참여</p>
                                            <p className="text-xs text-gray-500">6대 취약점 훈련 및 내 피드백 열람</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center gap-2.5 opacity-70">
                                        <Lock size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">타 팀원 리드 및 녹취 열람</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">개인정보 보호를 위한 접근 차단</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center gap-2.5 opacity-70">
                                        <Lock size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">정산 손익 및 시스템 설정</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">관리자 전용 메뉴 은닉</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </Card>

                    {/* 7. 화면 및 사용 편의 설정 카드 */}
                    <Card>
                        <div className="flex items-center justify-between pb-3 border-b border-gray-150 dark:border-gray-700/80 mb-4">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <Sliders size={18} className="text-gray-600" /> 화면 표시 및 편의 설정
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    테마 모드와 데이터 테이블의 행 간격을 개인 취향에 맞게 조정합니다.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/80 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-gray-100">
                                    {theme === 'dark' ? <Moon size={16} className="text-purple-600 dark:text-purple-400" /> : <Sun size={16} className="text-amber-500" />}
                                    <span>컬러 테마</span>
                                </div>
                                <Button variant="secondary" size="sm" onClick={toggleTheme}>
                                    {theme === 'dark' ? '다크 모드 🌙' : '라이트 모드 ☀️'}
                                </Button>
                            </div>

                            <div className="p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/80 rounded-xl flex items-center justify-between">
                                <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                    <span>케이스 목록 행 간격</span>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        type="button"
                                        onClick={() => updatePref({ tableDensity: 'normal' })}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                            prefs.tableDensity === 'normal'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        기본형
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updatePref({ tableDensity: 'compact' })}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                            prefs.tableDensity === 'compact'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        좁게(컴팩트)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* 8. (대표 전용) 관리자 로그인 허용 Google 계정 관리 카드 */}
                    {isOwner && (
                        <Card>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                <Users size={18} className="text-purple-600" /> 로그인 허용 관리자 Google 계정 관리
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                                시스템에 관리자로 로그인할 수 있는 Google 계정을 직접 등록하고 관리합니다.
                            </p>

                            <div className="flex gap-2 mb-4">
                                <input
                                    type="email"
                                    placeholder="추가할 Google 이메일 (예: manager@example.com)"
                                    className="flex-1 p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); } }}
                                />
                                <Button variant="primary" size="sm" onClick={handleAddEmail}>
                                    <Plus size={16} /> 계정 추가
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {allowedEmails.map(email => (
                                    <div
                                        key={email}
                                        className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200/80 dark:border-gray-700/80"
                                    >
                                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 font-mono">
                                            {email}
                                        </span>
                                        {allowedEmails.length > 1 && (
                                            <button
                                                onClick={() => handleRemoveEmail(email)}
                                                className="text-gray-500 dark:text-gray-400 hover:text-rose-500 p-1 rounded-lg transition-colors"
                                                title="계정 삭제"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
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
