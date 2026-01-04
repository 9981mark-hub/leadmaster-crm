import React, { useEffect, useState } from 'react';
import { fetchPartners, savePartner, deletePartner, fetchInboundPaths, addInboundPath, deleteInboundPath, fetchCases, fetchStatuses, addStatus, deleteStatus } from '../services/api';
import { CommissionRule, Partner, Case, CaseStatus } from '../types';
import { Plus, Trash2, CalendarCheck, Save, Megaphone, Info, Building, Edit3, Check, AlertTriangle, User, Sparkles, ListChecks } from 'lucide-react';
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
        if (storedManagerName) {
            setManagerName(storedManagerName);
        }
    }, []);

    const handleSelectPartner = (p: Partner) => {
        setSelectedPartnerId(p.partnerId);
        setEditingPartner(JSON.parse(JSON.stringify(p))); // Deep copy for editing
    };

    const handleSaveManagerName = () => {
        localStorage.setItem('managerName', managerName);
        showToast('담당자 이름이 저장되었습니다.');
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
                <div className="max-w-sm">
                    <label className="block text-sm font-medium text-gray-700 mb-1">담당자 이름</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="담당자 이름"
                            className="flex-1 p-2 border rounded"
                            value={managerName}
                            onChange={e => setManagerName(e.target.value)}
                        />
                        <button type="button" onClick={handleSaveManagerName} className="bg-gray-700 text-white px-4 rounded hover:bg-gray-800">
                            저장
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        여기에 저장된 이름은 신규 케이스 생성 시 담당자 이름으로 자동 설정되며, 요약문 템플릿의 {'{{managerName}}'}에 사용됩니다.
                    </p>
                </div>
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
                                        className="text-xl font-bold text-gray-800 border-b border-gray-300 focus:border-blue-500 outline-none pb-1 bg-transparent"
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
                                <div className="flex flex-col md:flex-row items-center gap-2 text-sm text-gray-700">
                                    <span className="font-bold">마감: 매주</span>
                                    <select
                                        className="p-1 border rounded"
                                        value={editingPartner.settlementConfig.cutoffDay}
                                        onChange={e => setEditingPartner({ ...editingPartner, settlementConfig: { ...editingPartner.settlementConfig, cutoffDay: Number(e.target.value) } })}
                                    >
                                        {[0, 1, 2, 3, 4, 5, 6].map(d => <option key={d} value={d}>{getDayName(d)}요일</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col md:flex-row items-center gap-2 text-sm text-gray-700">
                                    <span className="font-bold">지급:</span>
                                    <select
                                        className="p-1 border rounded"
                                        value={editingPartner.settlementConfig.payoutWeekDelay}
                                        onChange={e => setEditingPartner({ ...editingPartner, settlementConfig: { ...editingPartner.settlementConfig, payoutWeekDelay: Number(e.target.value) } })}
                                    >
                                        <option value={0}>금주</option>
                                        <option value={1}>차주</option>
                                    </select>
                                    <select
                                        className="p-1 border rounded"
                                        value={editingPartner.settlementConfig.payoutDay}
                                        onChange={e => setEditingPartner({ ...editingPartner, settlementConfig: { ...editingPartner.settlementConfig, payoutDay: Number(e.target.value) } })}
                                    >
                                        {[0, 1, 2, 3, 4, 5, 6].map(d => <option key={d} value={d}>{getDayName(d)}요일</option>)}
                                    </select>
                                </div>
                                <hr className="border-blue-200" />
                                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                                    <span>계약금(</span>
                                    <input
                                        type="number" className="w-12 p-1 border rounded text-center"
                                        value={editingPartner.settlementConfig.downPaymentPercentage}
                                        onChange={e => setEditingPartner({ ...editingPartner, settlementConfig: { ...editingPartner.settlementConfig, downPaymentPercentage: Number(e.target.value) } })}
                                    />
                                    <span>%) 입금 시, 수당 </span>
                                    <input
                                        type="number" className="w-12 p-1 border rounded text-center"
                                        value={editingPartner.settlementConfig.firstPayoutPercentage}
                                        onChange={e => setEditingPartner({ ...editingPartner, settlementConfig: { ...editingPartner.settlementConfig, firstPayoutPercentage: Number(e.target.value) } })}
                                    />
                                    <span>% 선지급</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-700 mb-4">수당 계산 룰</h3>
                            <div className="flex flex-wrap gap-2 mb-4 items-end p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <label className="text-[10px] block">최소</label>
                                    <input type="number" className="p-1 border rounded w-16 text-sm" value={newRule.minFee} onChange={e => setNewRule({ ...newRule, minFee: Number(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="text-[10px] block">최대(0=∞)</label>
                                    <input type="number" className="p-1 border rounded w-16 text-sm" value={newRule.maxFee} onChange={e => setNewRule({ ...newRule, maxFee: Number(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="text-[10px] block font-bold text-green-700">수당</label>
                                    <input type="number" className="p-1 border rounded w-16 text-sm" value={newRule.commission} onChange={e => setNewRule({ ...newRule, commission: Number(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="text-[10px] block text-blue-700">완납기준</label>
                                    <input type="number" className="p-1 border rounded w-16 text-sm" value={newRule.fullPayoutThreshold} onChange={e => setNewRule({ ...newRule, fullPayoutThreshold: Number(e.target.value) })} />
                                </div>
                                <button type="button" onClick={handleAddRule} className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700"><Plus size={20} /></button>
                            </div>
                            <div className="max-h-40 overflow-y-auto overflow-x-auto border rounded">
                                <table className="w-full text-xs text-left min-w-[300px]">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            <th className="p-2">구간</th>
                                            <th className="p-2">수당</th>
                                            <th className="p-2">완납기준</th>
                                            <th className="p-2">삭제</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {editingPartner.commissionRules.map(r => (
                                            <tr key={r.ruleId} className="border-b">
                                                <td className="p-2">{r.minFee}~{r.maxFee || '∞'}</td>
                                                <td className="p-2 font-bold">{r.commission}</td>
                                                <td className="p-2">{r.fullPayoutThreshold}</td>
                                                <td className="p-2"><button type="button" onClick={() => handleDeleteRule(r.ruleId)} className="text-red-500"><Trash2 size={14} /></button></td>
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
        </div>
    );
}