
import React, { useState, useEffect } from 'react';
import { User, Mail, LogOut, ShieldCheck, Plus, Trash2, Users, Lock, Monitor, Globe, Phone, Bell, Clock } from 'lucide-react';
import { AttendanceHeaderWidget } from '../components/hr/AttendanceHeaderWidget';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { saveGlobalSettings } from '../services/api';
import { PageShell, Card, Button } from '../components/ui';

const HOST_EMAIL = '9981mark@gmail.com';



interface PopupTemplate {
    name: string;
    displayName: string;
}

export default function MyPage() {
    const { showToast } = useToast();
    const { logout, user, allowedEmails, addAllowedEmail, removeAllowedEmail } = useAuth();
    const [managerName, setManagerName] = useState('');
    const [newEmail, setNewEmail] = useState('');

    // Security Dashboard State
    const [ipAddress, setIpAddress] = useState<string>('Loading...');
    const [deviceInfo, setDeviceInfo] = useState<string>('');

    // Android Popup Settings State
    const [isAndroidApp, setIsAndroidApp] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('CARD');
    const [floatingButtonEnabled, setFloatingButtonEnabled] = useState(true);
    const [availableTemplates, setAvailableTemplates] = useState<PopupTemplate[]>([]);

    const isHost = user?.email === HOST_EMAIL;

    useEffect(() => {
        // LocalStorage에서 커스텀 이름 가져오기 (Google 이름과 다를 수 있음)
        const storedManagerName = localStorage.getItem('managerName');
        setManagerName(storedManagerName || user?.name || '');

        // Get Device Info
        setDeviceInfo(navigator.userAgent);

        // Get IP Address (Only for Host)
        if (user?.email === HOST_EMAIL) {
            fetch('https://api.ipify.org?format=json')
                .then(res => res.json())
                .then(data => setIpAddress(data.ip))
                .catch(() => setIpAddress('확인 불가'));
        }

        // Check if running in Android app and load popup settings
        if (window.AndroidBridge?.isAndroidApp?.()) {
            setIsAndroidApp(true);
            try {
                // Load available templates
                const templatesJson = window.AndroidBridge.getAvailableTemplates();
                const templates = JSON.parse(templatesJson) as PopupTemplate[];
                setAvailableTemplates(templates);

                // Load current settings
                const settingsJson = window.AndroidBridge.getPopupSettings();
                const settings = JSON.parse(settingsJson);
                setSelectedTemplate(settings.template);
                setFloatingButtonEnabled(settings.floatingButtonEnabled);
            } catch (e) {
                console.error('Failed to load Android settings', e);
            }
        }

    }, [user]);


    // ... (inside component)

    const handleSaveName = async () => {
        // [Fix] Sync to Server (Supabase) + LocalStorage
        await saveGlobalSettings({ managerName });
        showToast('표시 이름이 변경되었습니다.');
    };

    const handleLogout = () => {
        logout();
        showToast('로그아웃 되었습니다.');
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
        showToast('허용 이메일이 추가되었습니다.');
    };

    const handleRemoveEmail = (email: string) => {
        if (allowedEmails.length <= 1) {
            showToast('최소 한 개의 관리자 계정은 필요합니다.', 'error');
            return;
        }

        // 1차 경고
        if (!window.confirm(`'${email}' 계정의 접근 권한을 삭제하시겠습니까?`)) {
            return;
        }

        // 2차 경고
        if (!window.confirm(`⚠️ [최종 경고] 정말로 삭제하시겠습니까? 이 계정은 더 이상 로그인할 수 없습니다.`)) {
            return;
        }

        removeAllowedEmail(email);
        showToast('권한이 삭제되었습니다.');
    };

    // Android Popup Settings Handlers
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
            {/* 2-Column 레이아웃: PC에서 좌측 프로필 + 우측 설정 */}
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">

                {/* ── 좌측: 프로필 + 로그아웃 ── */}
                <div className="space-y-6">
                    {/* Profile Card */}
                    <Card>
                        <div className="flex flex-col items-center text-center pb-4 border-b border-gray-100 dark:border-gray-700 mb-4">
                            {user?.picture ? (
                                <img src={user.picture} alt="Profile" className="w-20 h-20 rounded-full border-2 border-white dark:border-gray-600 shadow-sm mb-3" />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-2xl mb-3">
                                    {user?.name?.charAt(0)}
                                </div>
                            )}
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{user?.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                                    <ShieldCheck size={12} className="mr-1" /> 인증됨
                                </span>
                                {isHost && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                                        <Lock size={12} className="mr-1" /> HOST
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* CRM 표시 이름 */}
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CRM 표시 이름</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            className="w-full p-2.5 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[44px]"
                                            value={managerName}
                                            onChange={(e) => setManagerName(e.target.value)}
                                        />
                                        <User className="absolute left-3 top-3 text-gray-400" size={18} />
                                    </div>
                                    <Button variant="primary" size="md" onClick={handleSaveName}>
                                        저장
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">상담 내역 및 정산 리포트에 표시됩니다.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">로그인 이메일</label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        className="w-full p-2.5 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed min-h-[44px]"
                                        value={user?.email || ''}
                                        readOnly
                                    />
                                    <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                                </div>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">이메일은 Google 계정에서만 변경할 수 있습니다.</p>
                            </div>
                        </div>
                    </Card>

                    {/* 실시간 근태 및 출퇴근 체크 카드 */}
                    <Card>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <Clock size={16} className="text-indigo-600" /> 오늘 나의 근태 상태
                            </span>
                            <AttendanceHeaderWidget />
                        </div>
                        <p className="text-xs text-gray-400">
                            출근, 자리비움(이석), 식사, 퇴근 상태를 클릭하여 변경할 수 있습니다.
                        </p>
                    </Card>

                    {/* Logout Card */}
                    <Card>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                            <LogOut className="mr-2 text-gray-500 dark:text-gray-400" size={18} /> 로그아웃
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">현재 기기에서 접속을 종료합니다.</p>
                        <Button variant="danger" size="lg" onClick={handleLogout} className="w-full">
                            <LogOut size={18} /> 안전하게 로그아웃
                        </Button>
                    </Card>
                </div>

                {/* ── 우측: 설정 카드들 ── */}
                <div className="space-y-6">
                    {/* Android Popup Settings (Only shown in Android app) */}
                    {isAndroidApp && (
                        <Card>
                            <h3 className="text-base font-semibold text-blue-800 dark:text-blue-300 mb-4 flex items-center">
                                <Phone className="mr-2" size={18} /> 전화 팝업 설정
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">수신 전화 시 표시될 팝업 디자인을 선택하세요.</p>

                            {/* Template Selection */}
                            <div className="space-y-2 mb-6">
                                {availableTemplates.map(template => (
                                    <button
                                        key={template.name}
                                        onClick={() => handleTemplateChange(template.name)}
                                        className={`w-full p-3 rounded-lg border text-left transition-all min-h-[44px] ${selectedTemplate === template.name
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 dark:border-blue-500'
                                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">{template.displayName}</span>
                                            {selectedTemplate === template.name && (
                                                <span className="text-blue-600 dark:text-blue-400 text-sm">✓ 선택됨</span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Floating Button Toggle */}
                            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                                    <Bell className="mr-2" size={16} /> 통화 중 플로팅 버튼
                                </h4>
                                <button
                                    onClick={handleFloatingButtonToggle}
                                    className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-lg min-h-[44px]"
                                >
                                    <span className="text-sm text-gray-600 dark:text-gray-300">전화를 받은 후 미니 버튼 표시</span>
                                    <div className={`w-12 h-6 rounded-full transition-colors ${floatingButtonEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                                        }`}>
                                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${floatingButtonEnabled ? 'translate-x-6' : 'translate-x-0.5'
                                            } mt-0.5`} />
                                    </div>
                                </button>
                            </div>
                        </Card>
                    )}

                    {/* Security Dashboard (Host Only) */}
                    {isHost && (
                        <Card>
                            <h3 className="text-base font-semibold text-purple-800 dark:text-purple-300 mb-4 flex items-center">
                                <ShieldCheck className="mr-2" size={18} /> 보안 대시보드 <span className="ml-2 text-xs font-normal text-purple-500 dark:text-purple-400">HOST 전용</span>
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <Globe className="mr-3 text-gray-400 shrink-0" size={20} />
                                    <div>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">현재 IP 주소</p>
                                        <p className="text-sm font-mono font-bold text-gray-900 dark:text-white">{ipAddress}</p>
                                    </div>
                                </div>
                                <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <Monitor className="mr-3 text-gray-400 shrink-0" size={20} />
                                    <div className="min-w-0">
                                        <p className="text-xs text-gray-400 dark:text-gray-500">접속 기기 정보</p>
                                        <p className="text-xs font-mono break-all text-gray-700 dark:text-gray-300">{deviceInfo}</p>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Admin Management Card (Host Only) */}
                    {isHost && (
                        <Card>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                                <Users className="mr-2 text-gray-500 dark:text-gray-400" size={18} /> 관리자 계정 관리
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">로그인이 허용된 Google 계정을 관리합니다.</p>

                            <div className="flex gap-2 mb-4">
                                <input
                                    type="email"
                                    placeholder="추가할 이메일 (예: admin@example.com)"
                                    className="flex-1 p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400 min-h-[44px]"
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                />
                                <Button variant="primary" size="icon-lg" onClick={handleAddEmail}>
                                    <Plus size={20} />
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {allowedEmails.map(email => (
                                    <div key={email} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{email}</span>
                                        {allowedEmails.length > 1 && (
                                            <button
                                                onClick={() => handleRemoveEmail(email)}
                                                className="text-gray-400 hover:text-red-500 p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </PageShell>
    );
}
