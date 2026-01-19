import React, { useEffect, useState } from 'react';
import { fetchPartners, savePartner, deletePartner, fetchInboundPaths, addInboundPath, deleteInboundPath, fetchCases, fetchStatuses, addStatus, deleteStatus, fetchEmailNotificationSettings, saveEmailNotificationSettings, EmailNotificationSettings } from '../services/api';
import { CommissionRule, Partner, Case, CaseStatus } from '../types';
import { Plus, Trash2, CalendarCheck, Save, Megaphone, Info, Building, Edit3, Check, AlertTriangle, User, Sparkles, ListChecks, Mail } from 'lucide-react';
import { getDayName } from '../utils';
import { AVAILABLE_FIELDS_CONFIG, DEFAULT_SUMMARY_TEMPLATE, DEFAULT_AI_PROMPT, DEFAULT_OCR_PROMPT } from '../constants';
import Modal from '../components/Modal';
import { useToast } from '../contexts/ToastContext';

export default function SettingsPage() {
    const [partners, setPartners] = useState<Partner[]>([]);
    const [cases, setCases] = useState<Case[]>([]);
    const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
    const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

    const [inboundPaths, setInboundPaths] = useState<string[]>([]);
    const [newPath, setNewPath] = useState('');

    const [statuses, setStatuses] = useState<CaseStatus[]>([]);
    const [newStatus, setNewStatus] = useState('');

    const [managerName, setManagerName] = useState('Mark');
    // [Missed Call Settings] saved in localStorage
    const [missedCallStatus, setMissedCallStatus] = useState('부재');
    const [missedCallInterval, setMissedCallInterval] = useState(3);

    // Email Notification Settings
    const [emailNotificationEnabled, setEmailNotificationEnabled] = useState(false);
    const [emailNotificationRecipients, setEmailNotificationRecipients] = useState<string[]>([]);
    const [emailNotificationMinutes, setEmailNotificationMinutes] = useState(10);
    const [newEmailRecipient, setNewEmailRecipient] = useState('');
    const [emailSettingsLoaded, setEmailSettingsLoaded] = useState(false);
    const [emailSettingsSaved, setEmailSettingsSaved] = useState(true); // true = no unsaved changes
    const [emailSettingsLoading, setEmailSettingsLoading] = useState(true);

    const { showToast } = useToast();

    // Modal State
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);

    // Path Deletion State
    const [isPathDeleteModalOpen, setPathDeleteModalOpen] = useState(false);
    const [pathToDelete, setPathToDelete] = useState<string | null>(null);
    const [pathMigrationTarget, setPathMigrationTarget] = useState<string>('');
    const [affectedPathCaseCount, setAffectedPathCaseCount] = useState(0);

    // Status Deletion State
    const [isStatusDeleteModalOpen, setStatusDeleteModalOpen] = useState(false);
    const [statusToDelete, setStatusToDelete] = useState<string | null>(null);
    const [migrationTarget, setMigrationTarget] = useState<string>('');
    const [affectedCaseCount, setAffectedCaseCount] = useState(0);

    const [isAddPartnerModalOpen, setAddPartnerModalOpen] = useState(false);
    const [newPartnerName, setNewPartnerName] = useState('');


    // Rules State
    const [newRule, setNewRule] = useState<Partial<CommissionRule>>({ minFee: 0, maxFee: 0, commission: 0, fullPayoutThreshold: 0, priority: 1, active: true });

    useEffect(() => {
        Promise.all([fetchPartners(), fetchCases(), fetchInboundPaths(), fetchStatuses()]).then(([pData, cData, iData, sData]) => {
            setPartners(pData);
            setCases(cData);
            setInboundPaths(iData);
            setStatuses(sData);
            if (pData.length > 0) {
                // Select the first partner initially
                setSelectedPartnerId(pData[0].partnerId);
                setEditingPartner(JSON.parse(JSON.stringify(pData[0])));
            }
        });

        const storedManagerName = localStorage.getItem('managerName');
        if (storedManagerName) setManagerName(storedManagerName);

        const storedStats = localStorage.getItem('lm_missedStatus');
        if (storedStats) setMissedCallStatus(storedStats);

        const storedInterval = localStorage.getItem('lm_missedInterval');
        if (storedInterval) setMissedCallInterval(Number(storedInterval));

        // Load Email Notification Settings
        fetchEmailNotificationSettings().then(settings => {
            setEmailNotificationEnabled(settings.enabled);
            setEmailNotificationRecipients(settings.recipients || []);
            setEmailNotificationMinutes(settings.minutesBefore);
            setEmailSettingsLoaded(true);
            setEmailSettingsLoading(false);
        }).catch(() => {
            setEmailSettingsLoading(false);
        });
    }, []);

    const handleSelectPartner = (p: Partner) => {
        setSelectedPartnerId(p.partnerId);
        setEditingPartner(JSON.parse(JSON.stringify(p))); // Deep copy for editing
    };

    const handleSaveManagerName = () => {
        localStorage.setItem('managerName', managerName);
        // Save Missed Call Settings together
        localStorage.setItem('lm_missedStatus', missedCallStatus);
        localStorage.setItem('lm_missedInterval', String(missedCallInterval));
        showToast('공통 설정이 저장되었습니다.');
    };

    const handleCreatePartner = () => {
        setNewPartnerName('');
        setAddPartnerModalOpen(true);
    };

    const executeCreatePartner = async () => {
        if (!newPartnerName.trim()) {
            showToast('거래처 이름을 입력해주세요.', 'error');
            return;
        }
        const newPartnerData: Partner = {
            partnerId: `p_${Date.now()}`,
            name: newPartnerName.trim(),
            active: true,
            settlementConfig: { cutoffDay: 0, payoutDay: 2, payoutWeekDelay: 0, downPaymentPercentage: 10, firstPayoutPercentage: 50 },
            commissionRules: [],
            summaryTemplate: DEFAULT_SUMMARY_TEMPLATE,
            aiPromptTemplate: DEFAULT_AI_PROMPT,
            requiredFields: AVAILABLE_FIELDS_CONFIG.map(f => f.key)
        };

        const updatedPartners = await savePartner(newPartnerData);
        const addedPartner = updatedPartners.find(p => p.partnerId === newPartnerData.partnerId);

        setPartners(updatedPartners);
        if (addedPartner) {
            setSelectedPartnerId(addedPartner.partnerId);
            setEditingPartner(JSON.parse(JSON.stringify(addedPartner)));
        }
        setAddPartnerModalOpen(false);
        showToast('새로운 거래처가 추가되었습니다.');
    };


    const handleSavePartner = async () => {
        if (!editingPartner) return;
        const updatedList = await savePartner(editingPartner);
        setPartners(updatedList);
        showToast('변경사항이 저장되었습니다.');
    };

    const handleDeletePartner = () => {
        if (!editingPartner) return;

        if (partners.length <= 1) {
            showToast("최소 1개의 거래처는 존재해야 합니다.", 'error');
            return;
        }

        const assignedCases = cases.filter(c => c.partnerId === editingPartner.partnerId);
        if (assignedCases.length > 0) {
            showToast(`'${editingPartner.name}'에 배정된 사건이 있어 삭제할 수 없습니다.`, 'error');
            return;
        }

        setDeleteModalOpen(true);
    };

    const executeDeletePartner = async () => {
        if (!editingPartner) return;

        const partnerName = editingPartner.name;
        const updatedPartners = await deletePartner(editingPartner.partnerId);
        setPartners(updatedPartners);

        if (updatedPartners.length > 0) {
            setSelectedPartnerId(updatedPartners[0].partnerId);
            setEditingPartner(JSON.parse(JSON.stringify(updatedPartners[0])));
        } else {
            setSelectedPartnerId(null);
            setEditingPartner(null);
        }

        setDeleteModalOpen(false);
        showToast(`'${partnerName}' 거래처가 삭제되었습니다.`);
    }

    // Rule Helpers
    const handleAddRule = () => {
        if (!editingPartner || newRule.minFee === undefined || newRule.commission === undefined) return;
        const rule: CommissionRule = {
            ruleId: Date.now().toString(),
            minFee: newRule.minFee || 0,
            maxFee: newRule.maxFee || 0,
            commission: newRule.commission || 0,
            fullPayoutThreshold: newRule.fullPayoutThreshold || 0,
            priority: newRule.priority || 1,
            active: true,
            updatedAt: new Date().toISOString()
        };
        const updatedRules = [...editingPartner.commissionRules, rule];
        setEditingPartner({ ...editingPartner, commissionRules: updatedRules });
        setNewRule({ minFee: 0, maxFee: 0, commission: 0, fullPayoutThreshold: 0, priority: 1, active: true });
    };

    const handleDeleteRule = (id: string) => {
        if (!editingPartner) return;
        setEditingPartner({
            ...editingPartner,
            commissionRules: editingPartner.commissionRules.filter(r => r.ruleId !== id)
        });
    };

    // Inbound Path Helpers
    const handleAddPath = async () => {
        if (!newPath.trim()) return;
        if (inboundPaths.includes(newPath)) {
            showToast('이미 존재하는 경로입니다.', 'error');
            return;
        }
        await addInboundPath(newPath);
        setInboundPaths([...inboundPaths, newPath]);
        setNewPath('');
        showToast('유입 경로가 추가되었습니다.');
    };

    const handleDeletePath = (path: string) => {
        // Check if used
        const count = cases.filter(c => c.inboundPath === path).length;
        if (count > 0) {
            setAffectedPathCaseCount(count);
            setPathToDelete(path);
            setPathMigrationTarget('');
            setPathDeleteModalOpen(true);
        } else {
            executeDeletePath(path);
        }
    };

    const executeDeletePath = async (pathToDeleteName?: string) => {
        const targetPath = pathToDeleteName || pathToDelete;
        if (!targetPath) return;

        try {
            if (isPathDeleteModalOpen && !pathMigrationTarget) {
                showToast('이관할 경로를 선택해주세요.', 'error');
                return;
            }

            await deleteInboundPath(targetPath, pathMigrationTarget || undefined);

            // Refetch to update UI
            const [pData, cData] = await Promise.all([fetchInboundPaths(), fetchCases()]);
            setInboundPaths(pData);
            setCases(cData);

            setPathDeleteModalOpen(false);
            setPathToDelete(null);
            setPathMigrationTarget('');
            showToast(`'${targetPath}' 경로가 삭제되었습니다.`);
        } catch (e) {
            console.error(e);
            showToast('경로 삭제 중 오류가 발생했습니다.', 'error');
        }
    };

    // Status Management Helpers
    const handleAddStatus = async () => {
        if (!newStatus.trim()) return;
        if (statuses.includes(newStatus)) {
            showToast('이미 존재하는 상태입니다.', 'error');
            return;
        }
        const updated = await addStatus(newStatus);
        setStatuses(updated);
        setNewStatus('');
        showToast('상태가 추가되었습니다.');
    };

    const handleDeleteStatus = (status: string) => {
        // Check if used
        const count = cases.filter(c => c.status === status).length;
        if (count > 0) {
            setAffectedCaseCount(count);
            setStatusToDelete(status);
            setMigrationTarget(''); // Reset
            setStatusDeleteModalOpen(true);
        } else {
            // Direct delete if not used
            executeDeleteStatus(status);
        }
    };

    const executeDeleteStatus = async (statusToDeleteName?: string) => {
        const targetStatus = statusToDeleteName || statusToDelete;
        if (!targetStatus) return;

        try {
            // If modal is open, we need migration target
            // BUG FIX: Ensure we check if we are truly in "migration mode" (modal open)
            // If deleting directly (no modal), migrationTarget is not needed.
            // However, executeDeleteStatus is called directly for 0 cases. 
            // In that case isStatusDeleteModalOpen is false.
            if (isStatusDeleteModalOpen && !migrationTarget) {
                showToast('이관할 상태를 선택해주세요.', 'error');
                return;
            }

            const updated = await deleteStatus(targetStatus, migrationTarget || undefined);
            setStatuses(updated);

            // Refetch cases to reflect migration
            const updatedCases = await fetchCases();
            setCases(updatedCases);

            setStatusDeleteModalOpen(false);
            setStatusToDelete(null);
            setMigrationTarget('');
            showToast(`'${targetStatus}' 상태가 삭제되었습니다.`);
        } catch (e: any) {
            showToast('상태 삭제 중 오류가 발생했습니다.', 'error');
            console.error(e);
        }
    };

    // Field Config Helper
    const toggleField = (key: string) => {
        if (!editingPartner) return;
        const current = editingPartner.requiredFields || [];
        const updated = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
        setEditingPartner({ ...editingPartner, requiredFields: updated });
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">설정</h2>
            </div>

            {/* Global Settings */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                    <User className="mr-2 text-gray-600" size={20} /> 공통 설정
                </h3>
                <div className="max-w-md space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">담당자 이름</label>
                        <input
                            type="text"
                            placeholder="담당자 이름"
                            className="w-full p-2 border rounded"
                            value={managerName}
                            onChange={e => setManagerName(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            신규 생성 시 담당자, 요약문 템플릿 {'{{managerName}}'}에 사용됩니다.
                        </p>
                    </div>

                    <hr className="border-gray-100" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">부재 카운트 대상 상태</label>
                            <select
                                className="w-full p-2 border rounded bg-white"
                                value={missedCallStatus}
                                onChange={e => setMissedCallStatus(e.target.value)}
                            >
                                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                이 상태일 때만 '부재 확인' 버튼이 표시됩니다.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">재통화 알림 주기</label>
                            <div className="flex items-center">
                                <input
                                    type="number"
                                    className="flex-1 p-2 border rounded text-right mr-2"
                                    value={missedCallInterval}
                                    onChange={e => setMissedCallInterval(Number(e.target.value))}
                                />
                                <span className="text-sm text-gray-600">일 후</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                마지막 부재 확인 후 N일이 지나면 빨간 알림이 뜹니다.
                            </p>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button type="button" onClick={handleSaveManagerName} className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800 w-full md:w-auto">
                            설정 저장
                        </button>
                    </div>
                </div>
            </div>

            {/* Email Notification Settings */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center justify-between">
                    <span className="flex items-center">
                        <Mail className="mr-2 text-blue-600" size={20} /> 이메일 알림 설정
                    </span>
                    <div className="flex items-center gap-2">
                        {!emailSettingsSaved && (
                            <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                                ⚠ 저장 필요
                            </span>
                        )}
                        {emailSettingsLoaded && emailNotificationRecipients.length > 0 && emailSettingsSaved && (
                            <span className={`text-xs px-2 py-1 rounded-full ${emailNotificationEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {emailNotificationEnabled ? '✓ 활성화됨' : '비활성화'}
                            </span>
                        )}
                    </div>
                </h3>
                <p className="text-sm text-gray-500 mb-4">리마인더 일정을 이메일로 미리 받아보세요. PC를 보지 않을 때도 알림을 받을 수 있습니다.</p>

                {emailSettingsLoading ? (
                    <div className="text-center py-8 text-gray-400">
                        <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mb-2"></div>
                        <p className="text-sm">설정 불러오는 중...</p>
                    </div>
                ) : (
                    <div className="space-y-4 max-w-xl">
                        {/* Enable Toggle */}
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <span className="font-medium text-gray-700">이메일 알림 활성화</span>
                                <p className="text-xs text-gray-500 mt-0.5">활성화하면 리마인더 전에 이메일을 받습니다.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setEmailNotificationEnabled(!emailNotificationEnabled);
                                    setEmailSettingsSaved(false);
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emailNotificationEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emailNotificationEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Minutes Before Dropdown */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">사전 알림 시간</label>
                            <select
                                className="w-full p-2 border rounded bg-white"
                                value={emailNotificationMinutes}
                                onChange={e => {
                                    setEmailNotificationMinutes(Number(e.target.value));
                                    setEmailSettingsSaved(false);
                                }}
                            >
                                <option value={10}>10분 전</option>
                                <option value={30}>30분 전</option>
                                <option value={60}>1시간 전</option>
                            </select>
                        </div>

                        {/* Email Recipients */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">수신 이메일 주소</label>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    placeholder="이메일 주소 입력 후 + 버튼 또는 Enter"
                                    className="flex-1 p-2 border rounded"
                                    value={newEmailRecipient}
                                    onChange={e => setNewEmailRecipient(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (newEmailRecipient.trim() && newEmailRecipient.includes('@')) {
                                                if (!emailNotificationRecipients.includes(newEmailRecipient.trim())) {
                                                    setEmailNotificationRecipients([...emailNotificationRecipients, newEmailRecipient.trim()]);
                                                    setEmailSettingsSaved(false);
                                                }
                                                setNewEmailRecipient('');
                                            }
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (newEmailRecipient.trim() && newEmailRecipient.includes('@')) {
                                            if (!emailNotificationRecipients.includes(newEmailRecipient.trim())) {
                                                setEmailNotificationRecipients([...emailNotificationRecipients, newEmailRecipient.trim()]);
                                                setEmailSettingsSaved(false);
                                            }
                                            setNewEmailRecipient('');
                                        }
                                    }}
                                    className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            {/* Registered Emails List */}
                            <div className="mt-3">
                                {emailNotificationRecipients.length > 0 ? (
                                    <div className="space-y-2">
                                        <p className="text-xs text-gray-500 font-medium">등록된 이메일 ({emailNotificationRecipients.length}개)</p>
                                        <div className="flex flex-wrap gap-2">
                                            {emailNotificationRecipients.map(email => (
                                                <div key={email} className="flex items-center bg-blue-50 rounded-full px-3 py-1.5 text-sm text-blue-700 border border-blue-200">
                                                    <span className="mr-1">📧</span> {email}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEmailNotificationRecipients(emailNotificationRecipients.filter(e => e !== email));
                                                            setEmailSettingsSaved(false);
                                                        }}
                                                        className="ml-2 text-blue-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5"
                                                        title="삭제 (저장 버튼을 눌러야 반영됩니다)"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 py-2">등록된 이메일이 없습니다. 위에서 이메일을 추가해주세요.</p>
                                )}
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="pt-3 border-t">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await saveEmailNotificationSettings({
                                            enabled: emailNotificationEnabled,
                                            recipients: emailNotificationRecipients,
                                            minutesBefore: emailNotificationMinutes
                                        });
                                        setEmailSettingsSaved(true);
                                        showToast('이메일 알림 설정이 저장되었습니다.');
                                    }}
                                    className={`px-4 py-2 rounded font-medium ${!emailSettingsSaved ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    {!emailSettingsSaved ? '💾 변경사항 저장' : '✓ 저장됨'}
                                </button>
                                {!emailSettingsSaved && (
                                    <span className="text-xs text-yellow-600">
                                        변경사항이 있습니다. 저장 버튼을 눌러주세요.
                                    </span>
                                )}
                            </div>
                            {emailNotificationRecipients.length > 0 && emailSettingsSaved && (
                                <p className="text-xs text-gray-500 mt-2">
                                    💡 {emailNotificationRecipients.length}개 이메일로 리마인더 {emailNotificationMinutes}분 전에 알림이 발송됩니다.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>



            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                    <Megaphone className="mr-2 text-purple-600" size={20} /> 유입 경로 설정
                </h3>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="새로운 유입 경로 (예: 틱톡 광고)"
                            className="flex-1 p-2 border rounded"
                            value={newPath}
                            onChange={e => setNewPath(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddPath()}
                        />
                        <button type="button" onClick={handleAddPath} className="bg-purple-600 text-white px-4 rounded hover:bg-purple-700">
                            <Plus size={20} />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {inboundPaths.map(path => (
                            <div key={path} className="flex items-center bg-gray-100 rounded-full px-3 py-1.5 text-sm text-gray-700 border border-gray-200">
                                {path}
                                <button type="button" onClick={() => handleDeletePath(path)} className="ml-2 text-gray-400 hover:text-red-500">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                    <ListChecks className="mr-2 text-green-600" size={20} /> 상태 관리
                </h3>
                <p className="text-sm text-gray-500 mb-3">케이스의 진행 상태를 관리합니다. 사용 중인 상태를 삭제하면 이관 절차가 진행됩니다.</p>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="새로운 상태 (예: 서류 검토중)"
                            className="flex-1 p-2 border rounded"
                            value={newStatus}
                            onChange={e => setNewStatus(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddStatus()}
                        />
                        <button type="button" onClick={handleAddStatus} className="bg-green-600 text-white px-4 rounded hover:bg-green-700">
                            <Plus size={20} />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {statuses.map(status => (
                            <div key={status} className="flex items-center bg-gray-100 rounded-full px-3 py-1.5 text-sm text-gray-700 border border-gray-200">
                                {status}
                                <button type="button" onClick={() => handleDeleteStatus(status)} className="ml-2 text-gray-400 hover:text-red-500">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
                {/* Partner List Wrapper */}
                <div className="md:col-span-1">
                    {/* Mobile: Horizontal scrollable list */}
                    <div className="md:hidden mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-gray-700">거래처 선택</h3>
                            <button type="button" onClick={handleCreatePartner} className="text-blue-600 hover:bg-blue-50 p-1 rounded">
                                <Plus size={18} />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {partners.map(p => (
                                <button
                                    type="button"
                                    key={p.partnerId}
                                    onClick={() => handleSelectPartner(p)}
                                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors ${selectedPartnerId === p.partnerId ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'}`}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Desktop: Vertical list (sidebar) */}
                    <div className="hidden md:block space-y-3">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-gray-700">거래처 목록</h3>
                            <button type="button" onClick={handleCreatePartner} className="text-blue-600 hover:bg-blue-50 p-1 rounded">
                                <Plus size={18} />
                            </button>
                        </div>
                        <div className="space-y-1">
                            {partners.map(p => (
                                <button
                                    type="button"
                                    key={p.partnerId}
                                    onClick={() => handleSelectPartner(p)}
                                    className={`w-full text-left p-3 rounded-lg flex items-center justify-between ${selectedPartnerId === p.partnerId ? 'bg-blue-600 text-white shadow-md' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'}`}
                                >
                                    <span className="font-medium truncate">{p.name}</span>
                                    {selectedPartnerId === p.partnerId && <Check size={16} />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content: Partner Detail */}
                {editingPartner && (
                    <div className="md:col-span-3 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Building size={24} className="text-gray-400" />
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">거래처명</label>
                                    <input
                                        type="text"
                                        className="text-xl font-bold text-gray-800 border-b border-gray-300 focus:border-blue-500 outline-none pb-1 bg-transparent w-full"
                                        value={editingPartner.name}
                                        onChange={e => setEditingPartner({ ...editingPartner, name: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 self-end sm:self-center">
                                <button type="button" onClick={handleDeletePartner} className="text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg text-sm flex items-center transition-colors">
                                    <Trash2 size={16} className="mr-1" /> 삭제
                                </button>
                                <button type="button" onClick={handleSavePartner} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center transition-colors shadow-sm">
                                    <Save size={16} className="mr-2" /> 저장
                                </button>
                            </div>
                        </div>

                        {/* Sections */}
                        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                                <CalendarCheck className="mr-2 text-blue-600" size={20} /> 정산 스케줄 설정
                            </h3>
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-4">
                                {/* Timing Settings */}
                                <div>
                                    <h4 className="text-sm font-bold text-blue-800 mb-2">📅 정산 주기</h4>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <div className="bg-white p-3 rounded border border-blue-200">
                                            <span className="text-xs text-gray-500 block mb-1">마감 요일</span>
                                            <select
                                                className="w-full text-sm font-bold bg-transparent outline-none"
                                                value={editingPartner.settlementConfig.cutoffDay}
                                                onChange={e => setEditingPartner({ ...editingPartner, settlementConfig: { ...editingPartner.settlementConfig, cutoffDay: Number(e.target.value) } })}
                                            >
                                                {[0, 1, 2, 3, 4, 5, 6].map(d => <option key={d} value={d}>{getDayName(d)}요일</option>)}
                                            </select>
                                        </div>
                                        <div className="bg-white p-3 rounded border border-blue-200">
                                            <span className="text-xs text-gray-500 block mb-1">지급 시기</span>
                                            <select
                                                className="w-full text-sm font-bold bg-transparent outline-none"
                                                value={editingPartner.settlementConfig.payoutWeekDelay}
                                                onChange={e => setEditingPartner({ ...editingPartner, settlementConfig: { ...editingPartner.settlementConfig, payoutWeekDelay: Number(e.target.value) } })}
                                            >
                                                <option value={0}>이번 주 (금주)</option>
                                                <option value={1}>다음 주 (차주)</option>
                                            </select>
                                        </div>
                                        <div className="bg-white p-3 rounded border border-blue-200">
                                            <span className="text-xs text-gray-500 block mb-1">지급 요일</span>
                                            <select
                                                className="w-full text-sm font-bold bg-transparent outline-none"
                                                value={editingPartner.settlementConfig.payoutDay}
                                                onChange={e => setEditingPartner({ ...editingPartner, settlementConfig: { ...editingPartner.settlementConfig, payoutDay: Number(e.target.value) } })}
                                            >
                                                {[0, 1, 2, 3, 4, 5, 6].map(d => <option key={d} value={d}>{getDayName(d)}요일</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-blue-200" />

                                {/* Rate Settings */}
                                <div>
                                    <h4 className="text-sm font-bold text-blue-800 mb-2">💸 지급 비율</h4>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div className="bg-white p-3 rounded border border-blue-200 flex items-center justify-between">
                                            <span className="text-xs text-gray-500">계약금 비율</span>
                                            <div className="flex items-center">
                                                <input
                                                    type="number" className="w-12 text-right font-bold outline-none border-b border-gray-300 focus:border-blue-500 mr-1"
                                                    value={editingPartner.settlementConfig.downPaymentPercentage}
                                                    onChange={e => setEditingPartner({ ...editingPartner, settlementConfig: { ...editingPartner.settlementConfig, downPaymentPercentage: Number(e.target.value) } })}
                                                />
                                                <span className="text-sm">%</span>
                                            </div>
                                        </div>
                                        <div className="bg-white p-3 rounded border border-blue-200 flex items-center justify-between">
                                            <span className="text-xs text-gray-500">선지급 비율</span>
                                            <div className="flex items-center">
                                                <input
                                                    type="number" className="w-12 text-right font-bold outline-none border-b border-gray-300 focus:border-blue-500 mr-1"
                                                    value={editingPartner.settlementConfig.firstPayoutPercentage}
                                                    onChange={e => setEditingPartner({ ...editingPartner, settlementConfig: { ...editingPartner.settlementConfig, firstPayoutPercentage: Number(e.target.value) } })}
                                                />
                                                <span className="text-sm">%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-blue-600 mt-2 ml-1">
                                        * 계약금이 설정된 비율 이상 입금되면 수당의 일부를 선지급합니다.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-700 mb-4">수당 계산 룰</h3>
                            <div className="bg-gray-50 p-4 rounded-lg mb-4">
                                <h4 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">새로운 규칙 추가</h4>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                                    <div>
                                        <label className="text-[10px] text-gray-500 block mb-1">최소 금액</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="0"
                                            value={newRule.minFee}
                                            onChange={e => setNewRule({ ...newRule, minFee: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 block mb-1">최대 (0=무제한)</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="0"
                                            value={newRule.maxFee}
                                            onChange={e => setNewRule({ ...newRule, maxFee: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-green-700 font-bold block mb-1">지급 수당</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border border-green-200 bg-green-50 rounded text-sm font-bold text-green-800 focus:ring-2 focus:ring-green-500 outline-none"
                                            placeholder="0"
                                            value={newRule.commission}
                                            onChange={e => setNewRule({ ...newRule, commission: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-blue-700 font-bold block mb-1">완납 기준</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border border-blue-200 bg-blue-50 rounded text-sm font-bold text-blue-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="0"
                                            value={newRule.fullPayoutThreshold}
                                            onChange={e => setNewRule({ ...newRule, fullPayoutThreshold: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddRule}
                                    className="w-full mt-3 bg-blue-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus size={16} /> 규칙 추가하기
                                </button>
                            </div>

                            {/* Mobile Card List for Rules */}
                            <div className="md:hidden space-y-2">
                                {editingPartner.commissionRules.map(r => (
                                    <div key={r.ruleId} className="bg-white border rounded-lg p-3 flex justify-between items-center shadow-sm">
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-500 mb-1">
                                                {r.minFee.toLocaleString()} ~ {r.maxFee ? r.maxFee.toLocaleString() : '무제한'}
                                            </div>
                                            <div className="font-bold text-green-700 flex items-center gap-2">
                                                <span>수당: {r.commission.toLocaleString()}만원</span>
                                            </div>
                                            <div className="text-xs text-blue-600 mt-1">
                                                완납기준: {r.fullPayoutThreshold.toLocaleString()}만원
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteRule(r.ruleId)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded ml-2"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                                {editingPartner.commissionRules.length === 0 && (
                                    <p className="text-center text-gray-400 py-4 text-sm">등록된 규칙이 없습니다.</p>
                                )}
                            </div>

                            {/* Desktop Table for Rules */}
                            <div className="hidden md:block max-h-40 overflow-y-auto border rounded">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            <th className="p-2">구간 (만원)</th>
                                            <th className="p-2">지급 수당</th>
                                            <th className="p-2">완납 기준</th>
                                            <th className="p-2 text-center">관리</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {editingPartner.commissionRules.map(r => (
                                            <tr key={r.ruleId} className="border-b hover:bg-gray-50 transition-colors">
                                                <td className="p-2 font-medium">{r.minFee.toLocaleString()} ~ {r.maxFee ? r.maxFee.toLocaleString() : '∞'}</td>
                                                <td className="p-2 font-bold text-green-700">{r.commission.toLocaleString()}만원</td>
                                                <td className="p-2 text-blue-600 font-medium">{r.fullPayoutThreshold.toLocaleString()}만원</td>
                                                <td className="p-2 text-center">
                                                    <button type="button" onClick={() => handleDeleteRule(r.ruleId)} className="text-red-500 hover:text-red-700">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                                <Edit3 className="mr-2 text-indigo-600" size={20} /> 입력 항목 설정
                            </h3>
                            <p className="text-sm text-gray-500 mb-3">신규 접수 시 입력받을 항목을 선택하세요.</p>
                            <div className="flex flex-wrap gap-2">
                                {AVAILABLE_FIELDS_CONFIG.map(field => (
                                    <button
                                        type="button"
                                        key={field.key}
                                        onClick={() => toggleField(field.key)}
                                        className={`px-3 py-1.5 rounded-full text-sm border ${editingPartner.requiredFields.includes(field.key) ? 'bg-indigo-100 text-indigo-700 border-indigo-200 font-bold' : 'bg-white text-gray-500 border-gray-200'}`}
                                    >
                                        {field.label} {editingPartner.requiredFields.includes(field.key) && '✓'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* AI Prompt Settings */}
                        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                                <Sparkles className="mr-2 text-purple-600" size={20} /> AI 요약 프롬프트 설정
                            </h3>
                            <p className="text-sm text-gray-500 mb-3">통화 녹음 요약 시 AI에게 보낼 지시사항을 설정합니다.</p>
                            <textarea
                                className="w-full h-32 p-3 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                value={editingPartner.aiPromptTemplate || DEFAULT_AI_PROMPT}
                                onChange={e => setEditingPartner({ ...editingPartner, aiPromptTemplate: e.target.value })}
                                placeholder="AI 프롬프트를 입력하세요."
                            />
                        </div>

                        {/* OCR Prompt Settings */}
                        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                                <Sparkles className="mr-2 text-pink-600" size={20} /> OCR 인식 프롬프트 설정 (Gemini)
                            </h3>
                            <p className="text-sm text-gray-500 mb-3">이미지/PDF 업로드 시 Gemini에게 보낼 지시사항을 설정합니다. (JSON 필드 정의 필수)</p>
                            <textarea
                                className="w-full h-40 p-3 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-pink-500 outline-none font-mono"
                                value={editingPartner.ocrPromptTemplate || DEFAULT_OCR_PROMPT}
                                onChange={e => setEditingPartner({ ...editingPartner, ocrPromptTemplate: e.target.value })}
                                placeholder="OCR 프롬프트를 입력하세요."
                            />
                        </div>

                        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                                <Info className="mr-2 text-orange-600" size={20} /> 요약문 양식
                            </h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                <textarea
                                    className="w-full h-64 p-3 border border-gray-300 rounded text-sm font-mono whitespace-pre"
                                    value={editingPartner.summaryTemplate}
                                    onChange={e => setEditingPartner({ ...editingPartner, summaryTemplate: e.target.value })}
                                />
                                <div className="bg-gray-50 p-3 rounded text-xs text-gray-600 h-64 overflow-y-auto">
                                    <p className="font-bold mb-2">사용 가능한 치환자:</p>
                                    <ul className="space-y-1 list-disc pl-4">
                                        <li><code>{'{{managerName}}'}</code> 담당자명</li>
                                        <li><code>{'{{customerName}}'}</code> 고객명</li>
                                        <li><code>{'{{phone}}'}</code> 연락처</li>
                                        <li><code>{'{{birth}}'}</code> 생년월일</li>
                                        <li><code>{'{{gender}}'}</code> 성별</li>
                                        <li><code>{'{{region}}'}</code> 지역</li>
                                        <li><code>{'{{jobType}}'}</code> 직업</li>
                                        <li><code>{'{{incomeNet}}'}</code> 월 소득</li>
                                        <li><code>{'{{loanMonthlyPay}}'}</code> 월 변제금</li>
                                        <li><code>{'{{housingType}}'}</code> 주거형태</li>
                                        <li><code>{'{{depositRentStr}}'}</code> 보증금/월세 통합</li>
                                        <li><code>{'{{assetsStr}}'}</code> 자산 목록 통합</li>
                                        <li><code>{'{{creditLoan}}'}</code> 신용대출</li>
                                        <li><code>{'{{collateralStr}}'}</code> 담보대출 통합</li>
                                        <li><code>{'{{specialMemo}}'}</code> 특이사항</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODALS */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="거래처 삭제 확인"
            >
                <div>
                    <div className="flex items-start gap-3">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                            <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                        </div>
                        <div className="mt-0 text-left">
                            <p className="text-sm text-gray-600">
                                정말로 <span className="font-bold text-gray-900">'{editingPartner?.name}'</span> 거래처를 삭제하시겠습니까?
                                <br />
                                이 작업은 되돌릴 수 없습니다.
                            </p>
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2">
                        <button
                            type="button"
                            onClick={executeDeletePartner}
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                        >
                            삭제
                        </button>
                        <button
                            type="button"
                            onClick={() => setDeleteModalOpen(false)}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                        >
                            취소
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isAddPartnerModalOpen}
                onClose={() => setAddPartnerModalOpen(false)}
                title="새 거래처 추가"
            >
                <div>
                    <label htmlFor="new-partner-name" className="block text-sm font-medium text-gray-700 mb-2">
                        거래처 이름
                    </label>
                    <input
                        type="text"
                        id="new-partner-name"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={newPartnerName}
                        onChange={(e) => setNewPartnerName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && executeCreatePartner()}
                        placeholder="예: 미래 법률사무소"
                        autoFocus
                    />
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2">
                        <button
                            type="button"
                            onClick={executeCreatePartner}
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                        >
                            추가
                        </button>
                        <button
                            type="button"
                            onClick={() => setAddPartnerModalOpen(false)}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                        >
                            취소
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isPathDeleteModalOpen}
                onClose={() => setPathDeleteModalOpen(false)}
                title="유입 경로 삭제 확인"
            >
                <div>
                    <div className="flex items-start gap-3 mb-4">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                            <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                        </div>
                        <div className="mt-0 text-left">
                            <p className="text-sm text-gray-600">
                                정말로 <span className="font-bold text-gray-900">'{pathToDelete}'</span> 경로를 삭제하시겠습니까?
                            </p>
                            {affectedPathCaseCount > 0 && (
                                <div className="mt-2 bg-yellow-50 p-3 rounded-md border border-yellow-100">
                                    <p className="text-sm font-bold text-yellow-800 mb-1">
                                        ⚠️ 현재 이 경로로 등록된 건수: {affectedPathCaseCount}건
                                    </p>
                                    <p className="text-xs text-yellow-700 mb-2">
                                        삭제 시 해당 건들의 유입 경로를 아래 경로로 일괄 변경해야 합니다.
                                    </p>
                                    <select
                                        className="w-full p-2 border rounded text-sm bg-white"
                                        value={pathMigrationTarget}
                                        onChange={e => setPathMigrationTarget(e.target.value)}
                                    >
                                        <option value="">-- 이관할 경로 선택 --</option>
                                        {inboundPaths.filter(p => p !== pathToDelete).map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2">
                        <button
                            type="button"
                            onClick={() => executeDeletePath()}
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                        >
                            삭제 및 이관
                        </button>
                        <button
                            type="button"
                            onClick={() => setPathDeleteModalOpen(false)}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                        >
                            취소
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isStatusDeleteModalOpen}
                onClose={() => setStatusDeleteModalOpen(false)}
                title="상태 삭제 확인"
            >
                <div>
                    <div className="flex items-start gap-3 mb-4">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                            <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                        </div>
                        <div className="mt-0 text-left">
                            <p className="text-sm text-gray-600">
                                정말로 <span className="font-bold text-gray-900">'{statusToDelete}'</span> 상태를 삭제하시겠습니까?
                            </p>
                            {affectedCaseCount > 0 && (
                                <div className="mt-2 bg-yellow-50 p-3 rounded-md border border-yellow-100">
                                    <p className="text-sm font-bold text-yellow-800 mb-1">
                                        ⚠️ 현재 이 상태로 등록된 건수: {affectedCaseCount}건
                                    </p>
                                    <p className="text-xs text-yellow-700 mb-2">
                                        삭제 시 해당 건들의 상태를 아래 상태로 일괄 변경해야 합니다.
                                    </p>
                                    <select
                                        className="w-full p-2 border rounded text-sm bg-white"
                                        value={migrationTarget}
                                        onChange={e => setMigrationTarget(e.target.value)}
                                    >
                                        <option value="">-- 이관할 상태 선택 --</option>
                                        {statuses.filter(s => s !== statusToDelete).map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2">
                        <button
                            type="button"
                            onClick={() => executeDeleteStatus()}
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                        >
                            삭제 및 이관
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusDeleteModalOpen(false)}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                        >
                            취소
                        </button>
                    </div>
                </div>
            </Modal>
        </div >
    );
}