
import React, { useState, useEffect } from 'react';
import { User, Mail, LogOut, ShieldCheck, Plus, Trash2, Users, Lock, Monitor, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const HOST_EMAIL = '9981mark@gmail.com';

export default function MyPage() {
    const { showToast } = useToast();
    const { logout, user, allowedEmails, addAllowedEmail, removeAllowedEmail } = useAuth();
    const [managerName, setManagerName] = useState('');
    const [newEmail, setNewEmail] = useState('');

    // Security Dashboard State
    const [ipAddress, setIpAddress] = useState<string>('Loading...');
    const [deviceInfo, setDeviceInfo] = useState<string>('');

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

    }, [user]);

    const handleSaveName = () => {
        localStorage.setItem('managerName', managerName);
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

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">마이페이지</h2>

            {/* Profile Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-700 mb-6 flex items-center">
                    <User className="mr-2" size={20} /> 내 정보 (Google 계정 연동)
                </h3>

                <div className="flex items-center gap-4 mb-8 bg-blue-50 p-4 rounded-lg">
                    {user?.picture ? (
                        <img src={user.picture} alt="Profile" className="w-16 h-16 rounded-full border-2 border-white shadow-sm" />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-blue-200 flex items-center justify-center text-blue-600 font-bold text-xl">
                            {user?.name?.charAt(0)}
                        </div>
                    )}
                    <div>
                        <p className="text-lg font-bold text-gray-800">{user?.name}</p>
                        <p className="text-sm text-gray-500">{user?.email}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mt-1">
                            <ShieldCheck size={12} className="mr-1" /> 인증됨
                        </span>
                        {isHost && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                                <Lock size={12} className="mr-1" /> HOST
                            </span>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">CRM 표시 이름 (변경 가능)</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    className="w-full p-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={managerName}
                                    onChange={(e) => setManagerName(e.target.value)}
                                />
                                <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            </div>
                            <button
                                onClick={handleSaveName}
                                className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900"
                            >
                                저장
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">이 이름은 상담 내역 및 정산 리포트에 표시됩니다.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">로그인 이메일</label>
                        <div className="relative">
                            <input
                                type="email"
                                className="w-full p-2.5 pl-10 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                                value={user?.email || ''}
                                readOnly
                            />
                            <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">이메일은 Google 계정에서만 변경할 수 있습니다.</p>
                    </div>
                </div>
            </div>

            {/* Security Dashboard (Host Only) */}
            {isHost && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-100 ring-1 ring-purple-50">
                    <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center">
                        <ShieldCheck className="mr-2" size={20} /> 보안 대시보드 (HOST 전용)
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center text-gray-700">
                                <Globe className="mr-3 text-gray-400" size={20} />
                                <div>
                                    <p className="text-xs text-gray-400">현재 IP 주소</p>
                                    <p className="text-sm font-mono font-bold">{ipAddress}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center text-gray-700">
                                <Monitor className="mr-3 text-gray-400" size={20} />
                                <div>
                                    <p className="text-xs text-gray-400">접속 기기 정보</p>
                                    <p className="text-xs font-mono break-all">{deviceInfo}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Management Card (Host Only) */}
            {isHost && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                        <Users className="mr-2" size={20} /> 관리자 계정 관리
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">로그인이 허용된 Google 계정을 관리합니다.</p>

                    <div className="flex gap-2 mb-4">
                        <input
                            type="email"
                            placeholder="추가할 이메일 (예: admin@example.com)"
                            className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={newEmail}
                            onChange={e => setNewEmail(e.target.value)}
                        />
                        <button
                            onClick={handleAddEmail}
                            className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700"
                        >
                            <Plus size={20} />
                        </button>
                    </div>

                    <div className="space-y-2">
                        {allowedEmails.map(email => (
                            <div key={email} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <span className="text-sm font-medium text-gray-700">{email}</span>
                                {allowedEmails.length > 1 && (
                                    <button
                                        onClick={() => handleRemoveEmail(email)}
                                        className="text-gray-400 hover:text-red-500 p-1"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Logout Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                    <LogOut className="mr-2" size={20} /> 로그아웃
                </h3>
                <p className="text-sm text-gray-600 mb-4">현재 기기에서 접속을 종료합니다.</p>
                <button
                    onClick={handleLogout}
                    className="w-full bg-red-600 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-red-700 flex items-center justify-center shadow-sm transition-colors"
                >
                    <LogOut size={18} className="mr-2" /> 안전하게 로그아웃
                </button>
            </div>
        </div>
    );
}
