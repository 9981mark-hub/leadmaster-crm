import React, { useEffect, useState } from 'react';
import {
    fetchPartners,
    savePartner,
    deletePartner,
    fetchInboundPaths,
    addInboundPath,
    deleteInboundPath,
    fetchCases,
    fetchStatuses,
    addStatus,
    deleteStatus,
    fetchEmailNotificationSettings,
    saveEmailNotificationSettings,
    fetchSecondaryStatuses,
    fetchTertiaryStatuses,
    saveGlobalSettings
} from '../services/api';
import {
    useAddSecondaryStatusMutation,
    useDeleteSecondaryStatusMutation,
    useAddTertiaryStatusMutation,
    useDeleteTertiaryStatusMutation
} from '../services/queries';
import {
    CommissionRule,
    Partner,
    Case,
    CaseStatus,
    MissedCallIntervalTier,
    TelegramRoomTarget
} from '../types';
import {
    Building,
    Sliders,
    MessageCircle,
    Shield,
    Search,
    AlertTriangle,
    Save,
    Trash2,
    Check
} from 'lucide-react';
import { loadMissedCallTiers, loadTelegramRooms, saveTelegramRooms } from '../utils';
import {
    DEFAULT_SUMMARY_TEMPLATE,
    DEFAULT_AI_PROMPT,
    REHABILITATION_DOMAIN_KEYWORDS,
    AVAILABLE_FIELDS_CONFIG
} from '../constants';
import Modal from '../components/Modal';
import { EmergencyPurgeModal } from '../components/settings/EmergencyPurgeModal';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { fetchAiUsage, AiUsage } from '../services/aiProxy';

// 신규 모듈형 4대 탭 컴포넌트
import { PartnerSettingsTab } from '../components/settings/tabs/PartnerSettingsTab';
import { OperationsSettingsTab } from '../components/settings/tabs/OperationsSettingsTab';
import { IntegrationsSettingsTab } from '../components/settings/tabs/IntegrationsSettingsTab';
import { DataSecurityTab } from '../components/settings/tabs/DataSecurityTab';

type SettingsMainTab = 'partners' | 'operations' | 'integrations' | 'data_security';

export default function SettingsPage() {
    // -------------------------------------------------------------
    // Global State & Navigation
    // -------------------------------------------------------------
    const [activeTab, setActiveTab] = useState<SettingsMainTab>('partners');
    const [searchQuery, setSearchQuery] = useState('');
    const { showToast } = useToast();
    const { isAdmin, org } = useAuth();

    // -------------------------------------------------------------
    // 1. Partners State
    // -------------------------------------------------------------
    const [partners, setPartners] = useState<Partner[]>([]);
    const [cases, setCases] = useState<Case[]>([]);
    const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
    const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
    const [isSavingPartner, setIsSavingPartner] = useState(false);

    // Modals for Partner
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isAddPartnerModalOpen, setAddPartnerModalOpen] = useState(false);
    const [newPartnerName, setNewPartnerName] = useState('');
    const [newRule, setNewRule] = useState<Partial<CommissionRule>>({
        minFee: 0,
        maxFee: 0,
        commission: 0,
        fullPayoutThreshold: 0,
        priority: 1,
        active: true
    });

    // -------------------------------------------------------------
    // 2. Operations State
    // -------------------------------------------------------------
    const [managerName, setManagerName] = useState('Mark');
    const [missedCallStatus, setMissedCallStatus] = useState(() => localStorage.getItem('lm_missedStatus') || '부재');
    const [missedCallIntervalTiers, setMissedCallIntervalTiers] = useState<MissedCallIntervalTier[]>(() => loadMissedCallTiers());

    // Inbound Paths
    const [inboundPaths, setInboundPaths] = useState<string[]>([]);
    const [newPath, setNewPath] = useState('');
    const [isPathDeleteModalOpen, setPathDeleteModalOpen] = useState(false);
    const [pathToDelete, setPathToDelete] = useState<string | null>(null);
    const [pathMigrationTarget, setPathMigrationTarget] = useState<string>('');
    const [affectedPathCaseCount, setAffectedPathCaseCount] = useState(0);

    // 1st Statuses
    const [statuses, setStatuses] = useState<CaseStatus[]>([]);
    const [newStatus, setNewStatus] = useState('');
    const [isStatusDeleteModalOpen, setStatusDeleteModalOpen] = useState(false);
    const [statusToDelete, setStatusToDelete] = useState<string | null>(null);
    const [migrationTarget, setMigrationTarget] = useState<string>('');
    const [affectedCaseCount, setAffectedCaseCount] = useState(0);

    // 2nd Statuses
    const [secondaryStatuses, setSecondaryStatuses] = useState<string[]>([]);
    const [newSecondaryStatus, setNewSecondaryStatus] = useState('');

    // 3rd Statuses
    const [tertiaryStatuses, setTertiaryStatuses] = useState<Record<string, string[]>>({});
    const [selectedTertiarySecondary, setSelectedTertiarySecondary] = useState<string>('');
    const [newTertiaryStatus, setNewTertiaryStatus] = useState('');

    // Email Notifications
    const [emailNotificationEnabled, setEmailNotificationEnabled] = useState(false);
    const [emailNotificationRecipients, setEmailNotificationRecipients] = useState<string[]>([]);
    const [emailNotificationMinutes, setEmailNotificationMinutes] = useState(10);
    const [newEmailRecipient, setNewEmailRecipient] = useState('');
    const [emailSettingsLoading, setEmailSettingsLoading] = useState(false);

    // -------------------------------------------------------------
    // 3. Integrations & AI State
    // -------------------------------------------------------------
    const [telegramRooms, setTelegramRooms] = useState<TelegramRoomTarget[]>(() => loadTelegramRooms());
    const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);
    const [aiKeywords, setAiKeywords] = useState(() => localStorage.getItem('lm_aiKeywords') || REHABILITATION_DOMAIN_KEYWORDS.join(', '));

    // -------------------------------------------------------------
    // 4. Data & Security State
    // -------------------------------------------------------------
    const [isEmergencyPurgeOpen, setIsEmergencyPurgeOpen] = useState(false);

    // Status Queries
    const addSecondaryStatusMutation = useAddSecondaryStatusMutation();
    const deleteSecondaryStatusMutation = useDeleteSecondaryStatusMutation();
    const addTertiaryStatusMutation = useAddTertiaryStatusMutation();
    const deleteTertiaryStatusMutation = useDeleteTertiaryStatusMutation();

    // -------------------------------------------------------------
    // Initial Data Fetch
    // -------------------------------------------------------------
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [pData, cData, pathData, statusData, secData, terData, emailData] = await Promise.all([
                    fetchPartners(),
                    fetchCases(),
                    fetchInboundPaths(),
                    fetchStatuses(),
                    fetchSecondaryStatuses(),
                    fetchTertiaryStatuses(),
                    fetchEmailNotificationSettings()
                ]);

                setPartners(pData);
                setCases(cData);
                setInboundPaths(pathData);
                setStatuses(statusData);
                setSecondaryStatuses(secData);
                setTertiaryStatuses(terData);

                if (pData.length > 0) {
                    setSelectedPartnerId(pData[0].partnerId);
                    setEditingPartner(JSON.parse(JSON.stringify(pData[0])));
                }

                if (secData.length > 0) {
                    setSelectedTertiarySecondary(secData[0]);
                }

                if (emailData) {
                    setEmailNotificationEnabled(emailData.enabled);
                    setEmailNotificationRecipients(emailData.recipients || []);
                    setEmailNotificationMinutes(emailData.minutesBefore || 10);
                }

                const savedManager = localStorage.getItem('lm_managerName');
                if (savedManager) setManagerName(savedManager);
            } catch (err) {
                console.error('[Settings] 데이터 로드 실패:', err);
                showToast('설정 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
            }
        };

        loadInitialData();
    }, []);

    // Load AI Usage for Admin
    useEffect(() => {
        if (!isAdmin) return;
        let alive = true;
        fetchAiUsage()
            .then(u => { if (alive) setAiUsage(u); })
            .catch(e => console.warn('[AI] 사용량 조회 실패:', e?.message || e));
        return () => { alive = false; };
    }, [isAdmin]);

    // Partner Selection Change
    useEffect(() => {
        if (selectedPartnerId) {
            const partner = partners.find(p => p.partnerId === selectedPartnerId);
            if (partner) {
                setEditingPartner(JSON.parse(JSON.stringify(partner)));
            }
        }
    }, [selectedPartnerId]);

    // Save Missed Call Tiers to LocalStorage
    useEffect(() => {
        localStorage.setItem('lm_missedCallIntervalTiers', JSON.stringify(missedCallIntervalTiers));
    }, [missedCallIntervalTiers]);

    // -------------------------------------------------------------
    // Partner Actions
    // -------------------------------------------------------------
    const handleSavePartner = async () => {
        if (!editingPartner) return;
        setIsSavingPartner(true);
        try {
            await savePartner(editingPartner);
            const updated = partners.map(p => p.partnerId === editingPartner.partnerId ? editingPartner : p);
            setPartners(updated);
            showToast(`'${editingPartner.name}' 거래처 설정이 저장되었습니다.`);
        } catch (e) {
            console.error(e);
            showToast('거래처 설정 저장 중 오류가 발생했습니다.', 'error');
        } finally {
            setIsSavingPartner(false);
        }
    };

    const handleDeletePartnerClick = () => {
        if (!editingPartner) return;
        const assigned = cases.filter(c => c.partnerId === editingPartner.partnerId);
        if (assigned.length > 0) {
            showToast(`'${editingPartner.name}'에 배정된 사건이 ${assigned.length}건 있어 삭제할 수 없습니다.`, 'error');
            return;
        }
        setDeleteModalOpen(true);
    };

    const confirmDeletePartner = async () => {
        if (!editingPartner) return;
        try {
            const partnerName = editingPartner.name;
            const updated = await deletePartner(editingPartner.partnerId);
            setPartners(updated);
            if (updated.length > 0) {
                setSelectedPartnerId(updated[0].partnerId);
            } else {
                setSelectedPartnerId(null);
                setEditingPartner(null);
            }
            setDeleteModalOpen(false);
            showToast(`'${partnerName}' 거래처가 삭제되었습니다.`);
        } catch (e) {
            console.error(e);
            showToast('거래처 삭제 중 오류가 발생했습니다.', 'error');
        }
    };

    const handleAddPartner = async () => {
        if (!newPartnerName.trim()) return;
        const newP: Partner = {
            partnerId: `partner_${Date.now()}`,
            name: newPartnerName.trim(),
            active: true,
            settlementConfig: { cutoffDay: 1, payoutDay: 3, payoutWeekDelay: 0, downPaymentPercentage: 10, firstPayoutPercentage: 50 },
            commissionRules: [],
            summaryTemplate: DEFAULT_SUMMARY_TEMPLATE,
            aiPromptTemplate: DEFAULT_AI_PROMPT,
            requiredFields: AVAILABLE_FIELDS_CONFIG.map(f => f.key)
        };
        try {
            await savePartner(newP);
            const updated = [...partners, newP];
            setPartners(updated);
            setSelectedPartnerId(newP.partnerId);
            setNewPartnerName('');
            setAddPartnerModalOpen(false);
            showToast(`새 거래처 '${newP.name}'가 등록되었습니다.`);
        } catch (e) {
            console.error(e);
            showToast('거래처 등록 실패', 'error');
        }
    };

    // Commission Rule Actions
    const handleAddRule = () => {
        if (!editingPartner) return;
        if (newRule.minFee === undefined || newRule.commission === undefined) {
            showToast('최소 수임료와 수수료는 필수입니다.', 'error');
            return;
        }
        const rule: CommissionRule = {
            ruleId: `rule_${Date.now()}`,
            minFee: Number(newRule.minFee),
            maxFee: Number(newRule.maxFee) || 0,
            commission: Number(newRule.commission),
            fullPayoutThreshold: Number(newRule.fullPayoutThreshold) || 0,
            priority: Number(newRule.priority) || 1,
            active: true,
            updatedAt: new Date().toISOString()
        };
        setEditingPartner({
            ...editingPartner,
            commissionRules: [...editingPartner.commissionRules, rule]
        });
        setNewRule({ minFee: 0, maxFee: 0, commission: 0, fullPayoutThreshold: 0, priority: 1, active: true });
        showToast('수수료 규칙이 추가되었습니다.');
    };

    const handleDeleteRule = (id: string) => {
        if (!editingPartner) return;
        setEditingPartner({
            ...editingPartner,
            commissionRules: editingPartner.commissionRules.filter(r => r.ruleId !== id)
        });
        showToast('수수료 규칙이 삭제되었습니다.');
    };

    const toggleField = (key: string) => {
        if (!editingPartner) return;
        const current = editingPartner.requiredFields || [];
        const updated = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
        setEditingPartner({ ...editingPartner, requiredFields: updated });
    };

    // -------------------------------------------------------------
    // Operations Actions
    // -------------------------------------------------------------
    const handleSaveManagerName = () => {
        localStorage.setItem('lm_managerName', managerName);
        showToast('담당자 이름이 저장되었습니다.');
    };

    // Inbound Path
    const handleAddPath = async () => {
        if (!newPath.trim()) return;
        if (inboundPaths.includes(newPath.trim())) {
            showToast('이미 존재하는 경로입니다.', 'error');
            return;
        }
        await addInboundPath(newPath.trim());
        setInboundPaths([...inboundPaths, newPath.trim()]);
        setNewPath('');
        showToast('유입 경로가 추가되었습니다.');
    };

    const handleDeletePath = (path: string) => {
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

    const executeDeletePath = async (target?: string) => {
        const delPath = target || pathToDelete;
        if (!delPath) return;
        try {
            if (isPathDeleteModalOpen && !pathMigrationTarget) {
                showToast('이관할 경로를 선택해주세요.', 'error');
                return;
            }
            await deleteInboundPath(delPath, pathMigrationTarget || undefined);
            const [pData, cData] = await Promise.all([fetchInboundPaths(), fetchCases()]);
            setInboundPaths(pData);
            setCases(cData);
            setPathDeleteModalOpen(false);
            setPathToDelete(null);
            setPathMigrationTarget('');
            showToast(`'${delPath}' 경로가 삭제되었습니다.`);
        } catch (e) {
            showToast('경로 삭제 중 오류가 발생했습니다.', 'error');
        }
    };

    // 1st Status
    const handleAddStatus = async () => {
        if (!newStatus.trim()) return;
        if (statuses.includes(newStatus.trim())) {
            showToast('이미 존재하는 상태입니다.', 'error');
            return;
        }
        const updated = await addStatus(newStatus.trim());
        setStatuses(updated);
        setNewStatus('');
        showToast('상태가 추가되었습니다.');
    };

    const handleDeleteStatus = (status: string) => {
        const count = cases.filter(c => c.status === status).length;
        if (count > 0) {
            setAffectedCaseCount(count);
            setStatusToDelete(status);
            setMigrationTarget('');
            setStatusDeleteModalOpen(true);
        } else {
            executeDeleteStatus(status);
        }
    };

    const executeDeleteStatus = async (target?: string) => {
        const delStatus = target || statusToDelete;
        if (!delStatus) return;
        try {
            if (isStatusDeleteModalOpen && !migrationTarget) {
                showToast('이관할 상태를 선택해주세요.', 'error');
                return;
            }
            const updated = await deleteStatus(delStatus, migrationTarget || undefined);
            setStatuses(updated);
            const updatedCases = await fetchCases();
            setCases(updatedCases);
            setStatusDeleteModalOpen(false);
            setStatusToDelete(null);
            setMigrationTarget('');
            showToast(`'${delStatus}' 상태가 삭제되었습니다.`);
        } catch (e) {
            showToast('상태 삭제 중 오류가 발생했습니다.', 'error');
        }
    };

    // 2nd Status
    const handleAddSecondaryStatus = async () => {
        if (!newSecondaryStatus.trim()) return;
        if (secondaryStatuses.includes(newSecondaryStatus.trim())) {
            showToast('이미 존재하는 2차 상태입니다.', 'error');
            return;
        }
        await addSecondaryStatusMutation.mutateAsync(newSecondaryStatus.trim());
        setSecondaryStatuses([...secondaryStatuses, newSecondaryStatus.trim()]);
        setNewSecondaryStatus('');
        showToast('2차 상태가 추가되었습니다.');
    };

    const handleDeleteSecondaryStatus = async (status: string) => {
        await deleteSecondaryStatusMutation.mutateAsync(status);
        setSecondaryStatuses(secondaryStatuses.filter(s => s !== status));
        if (selectedTertiarySecondary === status) {
            setSelectedTertiarySecondary('');
        }
        showToast('2차 상태가 삭제되었습니다.');
    };

    // 3rd Status
    const handleAddTertiaryStatus = async () => {
        if (!selectedTertiarySecondary || !newTertiaryStatus.trim()) return;
        const currentList = tertiaryStatuses[selectedTertiarySecondary] || [];
        if (currentList.includes(newTertiaryStatus.trim())) {
            showToast('이미 존재하는 3차 상태입니다.', 'error');
            return;
        }
        await addTertiaryStatusMutation.mutateAsync({
            secondaryStatus: selectedTertiarySecondary,
            status: newTertiaryStatus.trim()
        });
        setTertiaryStatuses({
            ...tertiaryStatuses,
            [selectedTertiarySecondary]: [...currentList, newTertiaryStatus.trim()]
        });
        setNewTertiaryStatus('');
        showToast('3차 상태가 추가되었습니다.');
    };

    const handleDeleteTertiaryStatus = async (parent: string, status: string) => {
        await deleteTertiaryStatusMutation.mutateAsync({ secondaryStatus: parent, status });
        setTertiaryStatuses({
            ...tertiaryStatuses,
            [parent]: (tertiaryStatuses[parent] || []).filter(t => t !== status)
        });
        showToast('3차 상태가 삭제되었습니다.');
    };

    // Email Settings
    const handleSaveEmailSettings = async () => {
        setEmailSettingsLoading(true);
        try {
            await saveEmailNotificationSettings({
                enabled: emailNotificationEnabled,
                recipients: emailNotificationRecipients,
                minutesBefore: emailNotificationMinutes
            });
            showToast('이메일 알림 설정이 저장되었습니다.');
        } catch (e) {
            showToast('이메일 설정 저장 실패', 'error');
        } finally {
            setEmailSettingsLoading(false);
        }
    };

    // -------------------------------------------------------------
    // Integrations & AI Actions
    // -------------------------------------------------------------
    const handleSaveTelegramRooms = (rooms: TelegramRoomTarget[]) => {
        saveTelegramRooms(rooms);
    };

    const handleSaveAiKeywords = () => {
        localStorage.setItem('lm_aiKeywords', aiKeywords);
        showToast('도메인 어휘 보정 키워드가 저장되었습니다.');
    };

    // -------------------------------------------------------------
    // Data & Security Actions
    // -------------------------------------------------------------
    const handleDownloadBackup = () => {
        const backupData = {
            version: '4.5',
            exportedAt: new Date().toISOString(),
            cases: localStorage.getItem('lm_cases'),
            partners: localStorage.getItem('lm_partners'),
            paths: localStorage.getItem('lm_paths'),
            statuses: localStorage.getItem('lm_statuses'),
            secondaryStatuses: localStorage.getItem('lm_secondary_statuses'),
        };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leadmaster_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('백업 파일이 안전하게 다운로드되었습니다.');
    };

    const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target?.result as string);
                if (!data.version || !data.cases) {
                    showToast('유효하지 않은 백업 파일입니다.', 'error');
                    return;
                }
                if (!window.confirm(`백업 파일 정보:\n- 내보낸 날짜: ${data.exportedAt || '알 수 없음'}\n\n이 백업으로 시스템 로컬 데이터를 복원하시겠습니까?`)) return;
                if (data.cases) localStorage.setItem('lm_cases', data.cases);
                if (data.partners) localStorage.setItem('lm_partners', data.partners);
                if (data.paths) localStorage.setItem('lm_paths', data.paths);
                if (data.statuses) localStorage.setItem('lm_statuses', data.statuses);
                if (data.secondaryStatuses) localStorage.setItem('lm_secondary_statuses', data.secondaryStatuses);
                showToast('백업이 복원되었습니다. 페이지를 새로고침합니다...');
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) {
                showToast('백업 파일을 읽는 중 오류가 발생했습니다.', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleForceSync = () => {
        if (!window.confirm('로컬 캐시를 삭제하고 서버에서 데이터를 다시 불러올까요?\n\n💡 먼저 상단의 "백업 다운로드" 버튼으로 백업해두세요!')) return;
        localStorage.removeItem('lm_cases');
        localStorage.removeItem('lm_partners');
        localStorage.removeItem('lm_paths');
        localStorage.removeItem('lm_statuses');
        showToast('캐시를 삭제했습니다. 최신 데이터를 동기화합니다...');
        setTimeout(() => window.location.reload(), 1000);
    };

    // -------------------------------------------------------------
    // Render
    // -------------------------------------------------------------
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* 1. 최상단 헤더 & 빠른 검색바 */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-gray-200/80 dark:border-gray-700/80">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <Sliders size={22} />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
                            시스템 설정
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            거래처별 정산 정책, 상담 상태 체계, 텔레그램 연동 및 데이터 백업을 통합 관리합니다.
                        </p>
                    </div>
                </div>

                <div className="w-full md:w-72 relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="설정 항목 검색 (예: 부재콜, 정산, 텔레그램)"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={searchQuery}
                        onChange={e => {
                            const q = e.target.value;
                            setSearchQuery(q);
                            if (q.includes('거래처') || q.includes('정산') || q.includes('수수료') || q.includes('계좌')) {
                                setActiveTab('partners');
                            } else if (q.includes('콜') || q.includes('부재') || q.includes('상태') || q.includes('유입') || q.includes('이메일') || q.includes('담당자')) {
                                setActiveTab('operations');
                            } else if (q.includes('텔레') || q.includes('봇') || q.includes('ai') || q.includes('단어') || q.includes('키워드')) {
                                setActiveTab('integrations');
                            } else if (q.includes('백업') || q.includes('복원') || q.includes('파기') || q.includes('삭제')) {
                                setActiveTab('data_security');
                            }
                        }}
                    />
                </div>
            </div>

            {/* 2. 대분류 4대 탭 바 */}
            <div className="bg-gray-100/80 dark:bg-gray-800/80 p-1.5 rounded-2xl flex items-center space-x-1 overflow-x-auto shadow-inner">
                <button
                    onClick={() => setActiveTab('partners')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
                        activeTab === 'partners'
                            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                    <Building size={16} />
                    <span>1. 거래처 맞춤 관리</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300">
                        {partners.length}개
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('operations')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
                        activeTab === 'operations'
                            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                    <Sliders size={16} />
                    <span>2. 공통 업무 설정</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200">
                        콜/상태
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('integrations')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
                        activeTab === 'integrations'
                            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                    <MessageCircle size={16} />
                    <span>3. 외부 연동 & AI</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-300">
                        텔레그램/AI
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('data_security')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
                        activeTab === 'data_security'
                            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                    <Shield size={16} />
                    <span>4. 데이터 & 보안</span>
                </button>
            </div>

            {/* 3. 탭별 메인 뷰 */}
            <div className="pt-2">
                {activeTab === 'partners' && (
                    <PartnerSettingsTab
                        partners={partners}
                        selectedPartnerId={selectedPartnerId}
                        setSelectedPartnerId={setSelectedPartnerId}
                        editingPartner={editingPartner}
                        setEditingPartner={setEditingPartner}
                        onSavePartner={handleSavePartner}
                        onDeletePartner={handleDeletePartnerClick}
                        onOpenAddModal={() => setAddPartnerModalOpen(true)}
                        newRule={newRule}
                        setNewRule={setNewRule}
                        onAddRule={handleAddRule}
                        onDeleteRule={handleDeleteRule}
                        toggleField={toggleField}
                        cases={cases}
                        isSaving={isSavingPartner}
                    />
                )}

                {activeTab === 'operations' && (
                    <OperationsSettingsTab
                        managerName={managerName}
                        setManagerName={setManagerName}
                        onSaveManagerName={handleSaveManagerName}
                        missedCallStatus={missedCallStatus}
                        setMissedCallStatus={setMissedCallStatus}
                        missedCallIntervalTiers={missedCallIntervalTiers}
                        setMissedCallIntervalTiers={setMissedCallIntervalTiers}
                        inboundPaths={inboundPaths}
                        newPath={newPath}
                        setNewPath={setNewPath}
                        onAddPath={handleAddPath}
                        onDeletePath={handleDeletePath}
                        statuses={statuses}
                        newStatus={newStatus}
                        setNewStatus={setNewStatus}
                        onAddStatus={handleAddStatus}
                        onDeleteStatus={handleDeleteStatus}
                        secondaryStatuses={secondaryStatuses}
                        newSecondaryStatus={newSecondaryStatus}
                        setNewSecondaryStatus={setNewSecondaryStatus}
                        onAddSecondaryStatus={handleAddSecondaryStatus}
                        onDeleteSecondaryStatus={handleDeleteSecondaryStatus}
                        tertiaryStatuses={tertiaryStatuses}
                        selectedTertiarySecondary={selectedTertiarySecondary}
                        setSelectedTertiarySecondary={setSelectedTertiarySecondary}
                        newTertiaryStatus={newTertiaryStatus}
                        setNewTertiaryStatus={setNewTertiaryStatus}
                        onAddTertiaryStatus={handleAddTertiaryStatus}
                        onDeleteTertiaryStatus={handleDeleteTertiaryStatus}
                        emailNotificationEnabled={emailNotificationEnabled}
                        setEmailNotificationEnabled={setEmailNotificationEnabled}
                        emailNotificationRecipients={emailNotificationRecipients}
                        setEmailNotificationRecipients={setEmailNotificationRecipients}
                        emailNotificationMinutes={emailNotificationMinutes}
                        setEmailNotificationMinutes={setEmailNotificationMinutes}
                        newEmailRecipient={newEmailRecipient}
                        setNewEmailRecipient={setNewEmailRecipient}
                        onSaveEmailSettings={handleSaveEmailSettings}
                        emailSettingsLoading={emailSettingsLoading}
                    />
                )}

                {activeTab === 'integrations' && (
                    <IntegrationsSettingsTab
                        telegramRooms={telegramRooms}
                        setTelegramRooms={setTelegramRooms}
                        onSaveTelegramRooms={handleSaveTelegramRooms}
                        aiUsage={aiUsage}
                        aiKeywords={aiKeywords}
                        setAiKeywords={setAiKeywords}
                        onSaveAiKeywords={handleSaveAiKeywords}
                        isAdmin={isAdmin}
                    />
                )}

                {activeTab === 'data_security' && (
                    <DataSecurityTab
                        onDownloadBackup={handleDownloadBackup}
                        onRestoreBackup={handleRestoreBackup}
                        onForceSync={handleForceSync}
                        isOwner={org?.role === 'owner'}
                        onOpenEmergencyPurge={() => setIsEmergencyPurgeOpen(true)}
                    />
                )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* Modal 1: 거래처 삭제 확인 모달                                */}
            {/* ------------------------------------------------------------- */}
            {isDeleteModalOpen && editingPartner && (
                <Modal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="거래처 삭제">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            정말로 <strong className="text-rose-600">'{editingPartner.name}'</strong> 거래처를 삭제하시겠습니까?
                        </p>
                        <p className="text-xs text-gray-500">
                            연관된 수수료 규칙 및 서식 설정이 모두 삭제됩니다.
                        </p>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setDeleteModalOpen(false)}
                                className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={confirmDeletePartner}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Modal 2: 새 거래처 등록 모달                                   */}
            {/* ------------------------------------------------------------- */}
            {isAddPartnerModalOpen && (
                <Modal isOpen={isAddPartnerModalOpen} onClose={() => setAddPartnerModalOpen(false)} title="새 거래처 등록">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">거래처 상호명</label>
                            <input
                                type="text"
                                placeholder="예: 한울 법률사무소"
                                className="w-full p-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                value={newPartnerName}
                                onChange={e => setNewPartnerName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPartner(); } }}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setAddPartnerModalOpen(false)}
                                className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleAddPartner}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs"
                            >
                                등록
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Modal 3: 유입경로 삭제 마이그레이션 모달                     */}
            {/* ------------------------------------------------------------- */}
            {isPathDeleteModalOpen && pathToDelete && (
                <Modal isOpen={isPathDeleteModalOpen} onClose={() => setPathDeleteModalOpen(false)} title="유입 경로 삭제 및 이관">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            '<strong className="text-blue-600">{pathToDelete}</strong>' 경로를 사용하는 사건이{' '}
                            <strong>{affectedPathCaseCount}건</strong> 있습니다.
                        </p>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                                기존 사건들을 이관할 대상 경로:
                            </label>
                            <select
                                className="w-full p-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                value={pathMigrationTarget}
                                onChange={e => setPathMigrationTarget(e.target.value)}
                            >
                                <option value="">-- 이관할 경로 선택 --</option>
                                {inboundPaths.filter(p => p !== pathToDelete).map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setPathDeleteModalOpen(false)}
                                className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => executeDeletePath()}
                                disabled={!pathMigrationTarget}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50"
                            >
                                이관 후 삭제
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Modal 4: 1차 상태 삭제 마이그레이션 모달                     */}
            {/* ------------------------------------------------------------- */}
            {isStatusDeleteModalOpen && statusToDelete && (
                <Modal isOpen={isStatusDeleteModalOpen} onClose={() => setStatusDeleteModalOpen(false)} title="상태 삭제 및 이관">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            '<strong className="text-blue-600">{statusToDelete}</strong>' 상태인 사건이{' '}
                            <strong>{affectedCaseCount}건</strong> 있습니다.
                        </p>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                                기존 사건들을 이관할 대상 상태:
                            </label>
                            <select
                                className="w-full p-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                value={migrationTarget}
                                onChange={e => setMigrationTarget(e.target.value)}
                            >
                                <option value="">-- 이관할 상태 선택 --</option>
                                {statuses.filter(s => s !== statusToDelete).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setStatusDeleteModalOpen(false)}
                                className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => executeDeleteStatus()}
                                disabled={!migrationTarget}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50"
                            >
                                이관 후 삭제
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Modal 5: 긴급 데이터 파기 모달                                */}
            {/* ------------------------------------------------------------- */}
            {isEmergencyPurgeOpen && (
                <EmergencyPurgeModal
                    isOpen={isEmergencyPurgeOpen}
                    onClose={() => setIsEmergencyPurgeOpen(false)}
                />
            )}
        </div>
    );
}
