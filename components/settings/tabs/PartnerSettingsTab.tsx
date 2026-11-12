import React, { useState } from 'react';
import { Partner, CommissionRule, Case } from '../../../types';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';
import { AVAILABLE_FIELDS_CONFIG, CHECK_ITEMS, DEFAULT_CHECK_ITEMS, DEFAULT_SUMMARY_TEMPLATE, DEFAULT_AI_PROMPT, DEFAULT_OCR_PROMPT } from '../../../constants';
import { getDayName } from '../../../utils';
import { Building, Plus, Trash2, Save, Sparkles, FileText, Check, DollarSign, Calendar, MessageCircle, AlertCircle } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';

interface PartnerSettingsTabProps {
    partners: Partner[];
    selectedPartnerId: string | null;
    setSelectedPartnerId: (id: string) => void;
    editingPartner: Partner | null;
    setEditingPartner: React.Dispatch<React.SetStateAction<Partner | null>>;
    onSavePartner: () => Promise<void>;
    onDeletePartner: () => void;
    onOpenAddModal: () => void;
    newRule: Partial<CommissionRule>;
    setNewRule: React.Dispatch<React.SetStateAction<Partial<CommissionRule>>>;
    onAddRule: () => void;
    onDeleteRule: (id: string) => void;
    toggleField: (key: string) => void;
    cases: Case[];
    isSaving: boolean;
}

export const PartnerSettingsTab: React.FC<PartnerSettingsTabProps> = ({
    partners,
    selectedPartnerId,
    setSelectedPartnerId,
    editingPartner,
    setEditingPartner,
    onSavePartner,
    onDeletePartner,
    onOpenAddModal,
    newRule,
    setNewRule,
    onAddRule,
    onDeleteRule,
    toggleField,
    cases,
    isSaving
}) => {
    const { showToast } = useToast();
    const [subTab, setSubTab] = useState<'basic' | 'commission' | 'forms' | 'ai'>('basic');
    const [newDepositName, setNewDepositName] = useState('');

    if (!editingPartner) {
        return (
            <SettingsCard
                title="거래처 관리"
                description="등록된 거래처를 선택하거나 새 거래처를 등록하세요."
                icon={<Building size={18} />}
                headerAction={
                    <button
                        onClick={onOpenAddModal}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors"
                    >
                        <Plus size={16} /> 새 거래처 추가
                    </button>
                }
            >
                <div className="text-center py-12 text-gray-400">
                    등록된 거래처가 없거나 선택되지 않았습니다.
                </div>
            </SettingsCard>
        );
    }

    const assignedCaseCount = cases.filter(c => c.partnerId === editingPartner.partnerId).length;

    // 통장 입금자명 태그 추가/삭제 핸들러
    const handleAddDepositName = () => {
        if (!newDepositName.trim()) return;
        const current = editingPartner.depositNames || [];
        if (current.includes(newDepositName.trim())) {
            showToast('이미 등록된 입금자명입니다.', 'error');
            return;
        }
        setEditingPartner({
            ...editingPartner,
            depositNames: [...current, newDepositName.trim()]
        });
        setNewDepositName('');
    };

    const handleRemoveDepositName = (name: string) => {
        const current = editingPartner.depositNames || [];
        setEditingPartner({
            ...editingPartner,
            depositNames: current.filter(n => n !== name)
        });
    };

    return (
        <div className="space-y-6">
            {/* 1. 상단 거래처 선택 바 */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                        <span className="text-xs font-bold text-gray-500 uppercase shrink-0">거래처 선택:</span>
                        <div className="flex items-center gap-2">
                            {partners.map(p => (
                                <button
                                    key={p.partnerId}
                                    onClick={() => setSelectedPartnerId(p.partnerId)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                                        selectedPartnerId === p.partnerId
                                            ? 'bg-blue-600 text-white shadow-xs'
                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    <Building size={13} />
                                    <span>{p.name}</span>
                                    {!p.active && <span className="opacity-60 text-[10px]">(비활성)</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                            onClick={onOpenAddModal}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 rounded-xl transition-colors"
                        >
                            <Plus size={14} /> 새 거래처
                        </button>
                        <button
                            onClick={onSavePartner}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                        >
                            <Save size={14} /> {isSaving ? '저장 중...' : '거래처 설정 저장'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. 서브 탭 네비게이션 */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 space-x-2 sm:space-x-4 overflow-x-auto">
                <button
                    onClick={() => setSubTab('basic')}
                    className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
                        subTab === 'basic'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                >
                    <Calendar size={16} /> 1. 기본 정보 & 정산 일정
                </button>
                <button
                    onClick={() => setSubTab('commission')}
                    className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
                        subTab === 'commission'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                >
                    <DollarSign size={16} /> 2. 수수료 분배 규칙 ({editingPartner.commissionRules?.length || 0})
                </button>
                <button
                    onClick={() => setSubTab('forms')}
                    className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
                        subTab === 'forms'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                >
                    <FileText size={16} /> 3. 서식 & 알림 템플릿
                </button>
                <button
                    onClick={() => setSubTab('ai')}
                    className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
                        subTab === 'ai'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                >
                    <Sparkles size={16} /> 4. AI 요약 & 분류 가이드
                </button>
            </div>

            {/* 3. 서브 탭 컨텐츠 */}

            {/* [서브탭 1] 기본 정보 & 정산 일정 */}
            {subTab === 'basic' && (
                <div className="space-y-6">
                    <SettingsCard
                        title="거래처 기본 정보"
                        description="거래처 상호명, 배정 담당자 및 활성 상태를 관리합니다."
                        icon={<Building size={18} />}
                        headerAction={
                            <button
                                onClick={onDeletePartner}
                                className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 font-bold px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            >
                                거래처 삭제
                            </button>
                        }
                    >
                        <SettingsRow label="거래처명" required description="시스템 전반에 표기되는 정식 상호명입니다.">
                            <input
                                type="text"
                                className="w-full sm:max-w-md p-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white"
                                value={editingPartner.name}
                                onChange={e => setEditingPartner({ ...editingPartner, name: e.target.value })}
                            />
                        </SettingsRow>

                        <SettingsRow label="사용 여부 (활성화)" description="비활성화 시 신규 케이스 등록 창에서 선택할 수 없습니다.">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={editingPartner.active}
                                    onChange={e => setEditingPartner({ ...editingPartner, active: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {editingPartner.active ? '정상 사용 중' : '사용 중단 (비활성)'}
                                </span>
                            </label>
                        </SettingsRow>

                        <SettingsRow label="거래처 담당자" description="해당 거래처의 주요 연락 담당자 이름입니다.">
                            <input
                                type="text"
                                placeholder="예: 김실장"
                                className="w-full sm:max-w-md p-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white"
                                value={editingPartner.managerName || ''}
                                onChange={e => setEditingPartner({ ...editingPartner, managerName: e.target.value })}
                            />
                        </SettingsRow>

                        <SettingsRow label="거래처 연락처" description="주요 소통용 전화번호입니다.">
                            <input
                                type="text"
                                placeholder="예: 010-1234-5678"
                                className="w-full sm:max-w-md p-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white"
                                value={editingPartner.contactPhone || ''}
                                onChange={e => setEditingPartner({ ...editingPartner, contactPhone: e.target.value })}
                            />
                        </SettingsRow>

                        <SettingsRow label="비고 및 메모" description="내부 참고용 거래처 특이사항입니다.">
                            <textarea
                                rows={2}
                                placeholder="거래처 특이사항을 입력하세요."
                                className="w-full p-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white"
                                value={editingPartner.notes || ''}
                                onChange={e => setEditingPartner({ ...editingPartner, notes: e.target.value })}
                            />
                        </SettingsRow>
                    </SettingsCard>

                    <SettingsCard
                        title="정산 주기 및 일정 정책"
                        description="거래처와의 정산 마감 요일, 세금계산서 청구 및 수수료 지급 시기를 설정합니다."
                        icon={<Calendar size={18} />}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5">
                                    1. 정산 마감 요일 (1단계)
                                </label>
                                <select
                                    className="w-full p-2 text-sm font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg outline-none"
                                    value={editingPartner.settlementConfig.cutoffDay}
                                    onChange={e => setEditingPartner({
                                        ...editingPartner,
                                        settlementConfig: { ...editingPartner.settlementConfig, cutoffDay: Number(e.target.value) }
                                    })}
                                >
                                    {[0, 1, 2, 3, 4, 5, 6].map(d => (
                                        <option key={d} value={d}>매주 {getDayName(d)}요일</option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-gray-400 mt-1">한 주간의 정산 대상을 집계 마감하는 요일</p>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5">
                                    2. 수당 지급 주차 (3단계)
                                </label>
                                <select
                                    className="w-full p-2 text-sm font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg outline-none"
                                    value={editingPartner.settlementConfig.payoutWeekDelay}
                                    onChange={e => setEditingPartner({
                                        ...editingPartner,
                                        settlementConfig: { ...editingPartner.settlementConfig, payoutWeekDelay: Number(e.target.value) }
                                    })}
                                >
                                    <option value={0}>이번 주 (금주 지급)</option>
                                    <option value={1}>다음 주 (차주 지급)</option>
                                </select>
                                <p className="text-[11px] text-gray-400 mt-1">마감 주차 기준 지급 발생 주</p>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5">
                                    3. 수당 지급 요일 (3단계)
                                </label>
                                <select
                                    className="w-full p-2 text-sm font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg outline-none"
                                    value={editingPartner.settlementConfig.payoutDay}
                                    onChange={e => setEditingPartner({
                                        ...editingPartner,
                                        settlementConfig: { ...editingPartner.settlementConfig, payoutDay: Number(e.target.value) }
                                    })}
                                >
                                    {[0, 1, 2, 3, 4, 5, 6].map(d => (
                                        <option key={d} value={d}>매주 {getDayName(d)}요일</option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-gray-400 mt-1">상담원 및 파트너에게 실지급하는 요일</p>
                            </div>
                        </div>

                        <SettingsRow label="분할 지급 인정 비율" description="입금 차수별 수당 인정 정책입니다.">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">착수금 인정 비율:</span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            className="w-16 p-1.5 text-right font-bold text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg outline-none"
                                            value={editingPartner.settlementConfig.downPaymentPercentage}
                                            onChange={e => setEditingPartner({
                                                ...editingPartner,
                                                settlementConfig: { ...editingPartner.settlementConfig, downPaymentPercentage: Number(e.target.value) }
                                            })}
                                        />
                                        <span className="text-xs font-bold">%</span>
                                    </div>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">1차 분납 인정 비율:</span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            className="w-16 p-1.5 text-right font-bold text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg outline-none"
                                            value={editingPartner.settlementConfig.firstPayoutPercentage}
                                            onChange={e => setEditingPartner({
                                                ...editingPartner,
                                                settlementConfig: { ...editingPartner.settlementConfig, firstPayoutPercentage: Number(e.target.value) }
                                            })}
                                        />
                                        <span className="text-xs font-bold">%</span>
                                    </div>
                                </div>
                            </div>
                        </SettingsRow>

                        <SettingsRow label="부가세(VAT) 계산 정책" description="거래처 정산서 및 수수료 계산 시 부가세 적용 방식입니다.">
                            <select
                                className="w-full sm:max-w-xs p-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                value={editingPartner.vatMode || 'separate'}
                                onChange={e => setEditingPartner({ ...editingPartner, vatMode: e.target.value as any })}
                            >
                                <option value="separate">별도 (+10% 가산 청구 - 권장)</option>
                                <option value="included">포함 (수임료 내 부가세 포함)</option>
                                <option value="none">없음 (면세 또는 부가세 미적용)</option>
                            </select>
                        </SettingsRow>

                        <SettingsRow label="수금 기한 (지급일 계산용)" description="세금계산서 청구 후 거래처로부터 입금받기로 약정된 일수입니다.">
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    className="w-20 p-2 text-sm text-right font-bold bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                    value={editingPartner.paymentTermDays ?? 7}
                                    onChange={e => setEditingPartner({ ...editingPartner, paymentTermDays: Number(e.target.value) })}
                                />
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">일 이내</span>
                            </div>
                        </SettingsRow>
                    </SettingsCard>

                    <SettingsCard
                        title="입금 계좌 및 통장 거래내역 매칭"
                        description="거래처 정산서 안내에 표시될 수금 계좌와 은행 거래내역 자동 매칭 키워드를 설정합니다."
                        icon={<DollarSign size={18} />}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">은행명</label>
                                <input
                                    type="text"
                                    placeholder="예: 카카오뱅크"
                                    className="w-full p-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                    value={editingPartner.bankInfo?.bankName || ''}
                                    onChange={e => setEditingPartner({
                                        ...editingPartner,
                                        bankInfo: { ...editingPartner.bankInfo, bankName: e.target.value, accountNumber: editingPartner.bankInfo?.accountNumber || '', accountHolder: editingPartner.bankInfo?.accountHolder || '' }
                                    })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">계좌번호</label>
                                <input
                                    type="text"
                                    placeholder="예: 3333-xx-xxxx"
                                    className="w-full p-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                    value={editingPartner.bankInfo?.accountNumber || ''}
                                    onChange={e => setEditingPartner({
                                        ...editingPartner,
                                        bankInfo: { ...editingPartner.bankInfo, accountNumber: e.target.value, bankName: editingPartner.bankInfo?.bankName || '', accountHolder: editingPartner.bankInfo?.accountHolder || '' }
                                    })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">예금주</label>
                                <input
                                    type="text"
                                    placeholder="예: 주식회사 리드마스터"
                                    className="w-full p-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                    value={editingPartner.bankInfo?.accountHolder || ''}
                                    onChange={e => setEditingPartner({
                                        ...editingPartner,
                                        bankInfo: { ...editingPartner.bankInfo, accountHolder: e.target.value, bankName: editingPartner.bankInfo?.bankName || '', accountNumber: editingPartner.bankInfo?.accountNumber || '' }
                                    })}
                                />
                            </div>
                        </div>

                        <SettingsRow
                            label="통장 입금자명 자동 매칭 키워드"
                            description="은행 입금 내역 엑셀/문자에서 이 키워드가 포함되면 자동으로 해당 거래처 입금으로 매칭됩니다."
                        >
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {(editingPartner.depositNames || []).map((name, i) => (
                                        <span
                                            key={i}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-bold"
                                        >
                                            {name}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveDepositName(name)}
                                                className="hover:text-rose-500"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </span>
                                    ))}
                                    {(editingPartner.depositNames || []).length === 0 && (
                                        <span className="text-xs text-gray-400">등록된 매칭 키워드가 없습니다.</span>
                                    )}
                                </div>
                                <div className="flex gap-2 max-w-sm">
                                    <input
                                        type="text"
                                        placeholder="예: 안철형, 명율법률"
                                        className="flex-1 p-2 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                        value={newDepositName}
                                        onChange={e => setNewDepositName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddDepositName(); } }}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddDepositName}
                                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-xs font-bold rounded-xl"
                                    >
                                        추가
                                    </button>
                                </div>
                            </div>
                        </SettingsRow>
                    </SettingsCard>
                </div>
            )}

            {/* [서브탭 2] 수수료 분배 규칙 */}
            {subTab === 'commission' && (
                <div className="space-y-6">
                    <SettingsCard
                        title="기본 수수료 지급 방식"
                        description="거래처 전체에 기본 적용할 수수료 모델을 선택합니다."
                        icon={<DollarSign size={18} />}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            {[
                                { type: 'rate', label: '수임료 비율제 (%)', desc: '수임료의 일정 비율을 수수료로 지급' },
                                { type: 'fixed', label: '건당 고정액 (만원)', desc: '수임 성공 건당 고정 금액 지급' },
                            ].map(opt => (
                                <button
                                    key={opt.type}
                                    type="button"
                                    onClick={() => setEditingPartner({ ...editingPartner, incentiveType: opt.type as any })}
                                    className={`p-4 rounded-xl text-left border-2 transition-all ${
                                        (editingPartner.incentiveType || 'rate') === opt.type
                                            ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="font-bold text-sm text-gray-900 dark:text-white">{opt.label}</div>
                                    <div className="text-xs text-gray-500 mt-1">{opt.desc}</div>
                                </button>
                            ))}
                        </div>

                        {(editingPartner.incentiveType || 'rate') === 'rate' ? (
                            <SettingsRow label="기본 수수료율" description="구간 규칙이 없는 경우 기본 적용될 비율입니다.">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        className="w-24 p-2.5 text-sm font-bold text-right bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                        value={editingPartner.incentiveRate ?? 30}
                                        onChange={e => setEditingPartner({ ...editingPartner, incentiveRate: Number(e.target.value) })}
                                    />
                                    <span className="text-sm font-bold">%</span>
                                </div>
                            </SettingsRow>
                        ) : (
                            <SettingsRow label="건당 기본 고정액" description="수임 완료 건당 지급할 금액입니다.">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        className="w-28 p-2.5 text-sm font-bold text-right bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                        value={editingPartner.incentiveFixedAmount ?? 50}
                                        onChange={e => setEditingPartner({ ...editingPartner, incentiveFixedAmount: Number(e.target.value) })}
                                    />
                                    <span className="text-sm font-bold">만원</span>
                                </div>
                            </SettingsRow>
                        )}
                    </SettingsCard>

                    <SettingsCard
                        title="수임료 구간별 수수료 규칙 (Tier Rules)"
                        description="수임료 금액 구간에 따라 차등 수수료 및 전액 지급 기준을 세부 정의합니다."
                        icon={<FileText size={18} />}
                    >
                        {/* 룰 추가 폼 */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600 mb-6">
                            <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase mb-3">
                                + 신규 구간 규칙 추가
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                                <div>
                                    <label className="block text-[11px] text-gray-500 mb-1">최소 수임료 (만원)</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        className="w-full p-2 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg outline-none font-bold"
                                        value={newRule.minFee || ''}
                                        onChange={e => setNewRule({ ...newRule, minFee: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-gray-500 mb-1">최대 수임료 (만원)</label>
                                    <input
                                        type="number"
                                        placeholder="0=무제한"
                                        className="w-full p-2 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg outline-none font-bold"
                                        value={newRule.maxFee || ''}
                                        onChange={e => setNewRule({ ...newRule, maxFee: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-gray-500 mb-1">지급 수수료 (만원)</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        className="w-full p-2 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg outline-none font-bold text-blue-600"
                                        value={newRule.commission || ''}
                                        onChange={e => setNewRule({ ...newRule, commission: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-gray-500 mb-1">전액지급 기준 (만원)</label>
                                    <input
                                        type="number"
                                        placeholder="0=기본"
                                        className="w-full p-2 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg outline-none font-bold"
                                        value={newRule.fullPayoutThreshold || ''}
                                        onChange={e => setNewRule({ ...newRule, fullPayoutThreshold: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={onAddRule}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                                >
                                    규칙 등록
                                </button>
                            </div>
                        </div>

                        {/* 룰 테이블 */}
                        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50 dark:bg-gray-750 text-gray-600 dark:text-gray-300 font-bold border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="p-3">수임료 구간</th>
                                        <th className="p-3">수수료 (수당)</th>
                                        <th className="p-3">전액지급 기준</th>
                                        <th className="p-3 text-center">우선순위</th>
                                        <th className="p-3 text-right">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-750">
                                    {(editingPartner.commissionRules || []).map(r => (
                                        <tr key={r.ruleId} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                            <td className="p-3 font-medium">
                                                {r.minFee.toLocaleString()}만원 ~ {r.maxFee ? `${r.maxFee.toLocaleString()}만원` : '무제한'}
                                            </td>
                                            <td className="p-3 font-bold text-blue-600 dark:text-blue-400">
                                                {r.commission.toLocaleString()}만원
                                            </td>
                                            <td className="p-3 text-gray-500">
                                                {r.fullPayoutThreshold ? `${r.fullPayoutThreshold.toLocaleString()}만원 이상 입금 시` : '기본 정책'}
                                            </td>
                                            <td className="p-3 text-center font-mono">{r.priority}</td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() => onDeleteRule(r.ruleId)}
                                                    className="text-gray-400 hover:text-rose-500 p-1 transition-colors"
                                                    title="규칙 삭제"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {(editingPartner.commissionRules || []).length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-6 text-center text-gray-400">
                                                등록된 구간 규칙이 없습니다. 기본 수수료 정책이 적용됩니다.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </SettingsCard>
                </div>
            )}

            {/* [서브탭 3] 서식 & 알림 템플릿 */}
            {subTab === 'forms' && (
                <div className="space-y-6">
                    <SettingsCard
                        title="신규 케이스 접수 폼 필드 설정"
                        description="해당 거래처 케이스 등록 시 화면에 표시할 입력 항목을 선택합니다."
                        icon={<FileText size={18} />}
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {AVAILABLE_FIELDS_CONFIG.map(f => {
                                const isChecked = (editingPartner.requiredFields || []).includes(f.key);
                                return (
                                    <label
                                        key={f.key}
                                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                                            isChecked
                                                ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200'
                                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                                            checked={isChecked}
                                            onChange={() => toggleField(f.key)}
                                        />
                                        <span className="text-xs font-semibold">{f.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </SettingsCard>

                    <SettingsCard
                        title="카카오톡 정산 알림 메시지 템플릿"
                        description="세금계산서 발행 완료 및 수수료 정산 요청 시 거래처에 보낼 기본 메시지 템플릿입니다."
                        icon={<MessageCircle size={18} />}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    1. 세금계산서 청구 발행 완료 안내
                                </label>
                                <textarea
                                    rows={8}
                                    className="w-full p-3 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                    value={editingPartner.kakaoTemplates?.invoiceNotice || ''}
                                    placeholder="발행 완료 안내 카톡 문구를 입력하세요."
                                    onChange={e => setEditingPartner({
                                        ...editingPartner,
                                        kakaoTemplates: { ...editingPartner.kakaoTemplates, invoiceNotice: e.target.value }
                                    })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    2. 파트너 세금계산서 역발행 요청 문구
                                </label>
                                <textarea
                                    rows={8}
                                    className="w-full p-3 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                    value={editingPartner.kakaoTemplates?.payoutRequest || ''}
                                    placeholder="수수료 요청 카톡 문구를 입력하세요."
                                    onChange={e => setEditingPartner({
                                        ...editingPartner,
                                        kakaoTemplates: { ...editingPartner.kakaoTemplates, payoutRequest: e.target.value }
                                    })}
                                />
                            </div>
                        </div>
                    </SettingsCard>

                    <SettingsCard
                        title="상담 요약 전송 서식 템플릿 (카톡 전달용)"
                        description="카카오톡이나 텔레그램으로 상담 요약본을 전달할 때 사용할 양식입니다. 치환 변수: {{clientName}}, {{phone}}, {{summary}} 등"
                        icon={<FileText size={18} />}
                    >
                        <textarea
                            rows={6}
                            className="w-full p-3 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                            value={editingPartner.summaryTemplate || DEFAULT_SUMMARY_TEMPLATE}
                            onChange={e => setEditingPartner({ ...editingPartner, summaryTemplate: e.target.value })}
                        />
                    </SettingsCard>
                </div>
            )}

            {/* [서브탭 4] AI 요약 & 분류 가이드 */}
            {subTab === 'ai' && (
                <div className="space-y-6">
                    <SettingsCard
                        title="AI 상담 통화 요약 프롬프트"
                        description="Gemini AI가 통화 녹취록을 분석하여 구조화된 사건 개요를 작성할 때 사용할 기본 프롬프트입니다."
                        icon={<Sparkles size={18} />}
                    >
                        <textarea
                            rows={8}
                            className="w-full p-3 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                            value={editingPartner.aiPromptTemplate || DEFAULT_AI_PROMPT}
                            onChange={e => setEditingPartner({ ...editingPartner, aiPromptTemplate: e.target.value })}
                        />
                    </SettingsCard>

                    <SettingsCard
                        title="상담 필수 확인 체크리스트"
                        description="AI가 통화 녹취에서 반드시 확인되었는지 체크할 핵심 요건 목록입니다."
                        icon={<Sparkles size={18} />}
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {CHECK_ITEMS.map(item => {
                                const currentItems = editingPartner.checkItems || DEFAULT_CHECK_ITEMS;
                                const isChecked = currentItems.includes(item.key);
                                return (
                                    <label
                                        key={item.key}
                                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                                            isChecked
                                                ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-200'
                                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded text-purple-600 border-gray-300 focus:ring-purple-500"
                                            checked={isChecked}
                                            onChange={() => {
                                                const updated = isChecked
                                                    ? currentItems.filter(k => k !== item.key)
                                                    : [...currentItems, item.key];
                                                setEditingPartner({ ...editingPartner, checkItems: updated });
                                            }}
                                        />
                                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{item.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </SettingsCard>

                    <SettingsCard
                        title="진행 가능성 AI 분류 기준 가이드"
                        description="AI가 상담 건의 수임 가능성을 A(유력), B(보통), C(불가)로 자동 판정하는 세부 기준입니다."
                        icon={<Sparkles size={18} />}
                    >
                        <textarea
                            rows={8}
                            className="w-full p-3 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                            value={editingPartner.aiClassificationGuide || ''}
                            placeholder="분류 기준을 입력하세요."
                            onChange={e => setEditingPartner({ ...editingPartner, aiClassificationGuide: e.target.value })}
                        />
                    </SettingsCard>

                    <SettingsCard
                        title="AI 영수증/서류 OCR 인식 프롬프트"
                        description="수임료 입금증, 계약서 사진 등 서류를 OCR로 자동 판독할 때 사용할 프롬프트입니다."
                        icon={<Sparkles size={18} />}
                    >
                        <textarea
                            rows={6}
                            className="w-full p-3 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                            value={editingPartner.ocrPromptTemplate || DEFAULT_OCR_PROMPT}
                            onChange={e => setEditingPartner({ ...editingPartner, ocrPromptTemplate: e.target.value })}
                        />
                    </SettingsCard>
                </div>
            )}
        </div>
    );
};
