import React, { useState } from 'react';
import { Partner, CommissionRule, Case } from '../../../types';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';
import { AVAILABLE_FIELDS_CONFIG, CHECK_ITEMS, DEFAULT_CHECK_ITEMS, DEFAULT_SUMMARY_TEMPLATE, DEFAULT_AI_PROMPT, DEFAULT_OCR_PROMPT } from '../../../constants';
import { getDayName } from '../../../utils';
import { Building, Plus, Trash2, Save, Sparkles, FileText, Check, DollarSign, Calendar, MessageCircle, AlertCircle, Users, ExternalLink } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import TelegramChatPicker from '../../TelegramChatPicker';

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

    // 정산 파트너 프리셋 상태
    const [newPresetName, setNewPresetName] = useState('');
    const [newPresetAccount, setNewPresetAccount] = useState('');
    const [newPresetAmount, setNewPresetAmount] = useState<number | ''>('');

    if (!editingPartner) {
        return (
            <SettingsCard
                title="거래처 관리"
                description="등록된 거래처를 선택하거나 새 거래처를 등록하세요."
                icon={<Building size={18} strokeWidth={1.75} />}
                headerAction={
                    <button
                        onClick={onOpenAddModal}
                        className="inline-flex items-center gap-1.5 h-8 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium shadow-2xs transition-colors"
                    >
                        <Plus size={13} strokeWidth={1.75} />
                        <span>새 거래처 추가</span>
                    </button>
                }
            >
                <div className="text-center py-12 text-xs text-muted-foreground">
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
        setEditingPartner({ ...editingPartner, depositNames: [...current, newDepositName.trim()] });
        setNewDepositName('');
        showToast('입금자명 키워드가 추가되었습니다.');
    };

    const handleRemoveDepositName = (name: string) => {
        const current = editingPartner.depositNames || [];
        setEditingPartner({ ...editingPartner, depositNames: current.filter(n => n !== name) });
        showToast('입금자명 키워드가 삭제되었습니다.');
    };

    // 정산 파트너 프리셋 추가/삭제 핸들러
    const handleAddPreset = () => {
        if (!newPresetName.trim() || !newPresetAccount.trim()) {
            showToast('파트너명과 계좌정보는 필수입니다.', 'error');
            return;
        }
        const current = editingPartner.payoutPartnerPresets || [];
        const newPreset = {
            id: `preset_${Date.now()}`,
            name: newPresetName.trim(),
            accountInfo: newPresetAccount.trim(),
            defaultAmount: newPresetAmount !== '' ? Number(newPresetAmount) : undefined
        };
        setEditingPartner({
            ...editingPartner,
            payoutPartnerPresets: [...current, newPreset]
        });
        setNewPresetName('');
        setNewPresetAccount('');
        setNewPresetAmount('');
        showToast('정산 파트너 프리셋이 추가되었습니다.');
    };

    const handleDeletePreset = (id: string) => {
        const current = editingPartner.payoutPartnerPresets || [];
        setEditingPartner({
            ...editingPartner,
            payoutPartnerPresets: current.filter(p => p.id !== id)
        });
        showToast('프리셋이 삭제되었습니다.');
    };

    return (
        <div className="space-y-6">
            {/* 1. 상단 거래처 선택 바 */}
            <div className="bg-card text-card-foreground p-3.5 sm:p-4 rounded-xl border border-border shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                        <span className="text-2xs font-mono font-medium text-muted-foreground uppercase shrink-0">거래처 선택:</span>
                        <div className="flex items-center gap-1.5">
                            {partners.map(p => (
                                <button
                                    key={p.partnerId}
                                    onClick={() => setSelectedPartnerId(p.partnerId)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                                        selectedPartnerId === p.partnerId
                                            ? 'bg-primary text-primary-foreground shadow-2xs font-semibold'
                                            : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Building size={13} strokeWidth={1.75} />
                                    <span>{p.name}</span>
                                    {!p.active && <span className="opacity-60 text-2xs">(비활성)</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                            onClick={onOpenAddModal}
                            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                        >
                            <Plus size={13} strokeWidth={1.75} />
                            <span>새 거래처</span>
                        </button>
                        <button
                            onClick={onSavePartner}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
                        >
                            <Save size={13} strokeWidth={1.75} />
                            <span>{isSaving ? '저장 중...' : '거래처 설정 저장'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. 서브 탭 네비게이션 (Shadcn Segmented Control) */}
            <div className="bg-muted/70 p-1 rounded-lg border border-border/60 flex items-center gap-1 overflow-x-auto">
                <button
                    onClick={() => setSubTab('basic')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0 ${
                        subTab === 'basic'
                            ? 'bg-background text-foreground shadow-2xs border border-border font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                    }`}
                >
                    <Calendar size={13} strokeWidth={1.75} />
                    <span>1. 기본 정보 & 정산 일정</span>
                </button>
                <button
                    onClick={() => setSubTab('commission')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0 ${
                        subTab === 'commission'
                            ? 'bg-background text-foreground shadow-2xs border border-border font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                    }`}
                >
                    <DollarSign size={13} strokeWidth={1.75} />
                    <span>2. 수수료 분배 규칙 ({editingPartner.commissionRules?.length || 0})</span>
                </button>
                <button
                    onClick={() => setSubTab('forms')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0 ${
                        subTab === 'forms'
                            ? 'bg-background text-foreground shadow-2xs border border-border font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                    }`}
                >
                    <FileText size={13} strokeWidth={1.75} />
                    <span>3. 서식 & 알림 템플릿</span>
                </button>
                <button
                    onClick={() => setSubTab('ai')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0 ${
                        subTab === 'ai'
                            ? 'bg-background text-foreground shadow-2xs border border-border font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                    }`}
                >
                    <Sparkles size={13} strokeWidth={1.75} />
                    <span>4. AI 요약 & 분류 가이드</span>
                </button>
            </div>

            {/* 3. 서브 탭 컨텐츠 */}

            {/* [서브탭 1] 기본 정보 & 정산 일정 */}
            {subTab === 'basic' && (
                <div className="space-y-6">
                    <SettingsCard
                        title="거래처 기본 정보"
                        description="거래처 상호명, 배정 담당자 및 활성 상태를 관리합니다."
                        icon={<Building size={18} strokeWidth={1.75} />}
                        headerAction={
                            <button
                                onClick={onDeletePartner}
                                className="text-2xs text-destructive hover:text-destructive/80 font-medium px-2.5 py-1 rounded-md border border-destructive/30 hover:bg-destructive/10 transition-colors"
                            >
                                거래처 삭제
                            </button>
                        }
                    >
                        <SettingsRow label="거래처명" required description="시스템 전반에 표기되는 정식 상호명입니다.">
                            <input
                                type="text"
                                className="w-full sm:max-w-md h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring"
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
                                <div className="w-10 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-primary-foreground after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                <span className="ml-3 text-xs font-medium text-foreground">
                                    {editingPartner.active ? '정상 사용 중' : '사용 중단 (비활성)'}
                                </span>
                            </label>
                        </SettingsRow>

                        <SettingsRow label="거래처 담당자" description="해당 거래처의 주요 연락 담당자 이름입니다.">
                            <input
                                type="text"
                                placeholder="예: 김실장"
                                className="w-full sm:max-w-md h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                                value={editingPartner.managerName || ''}
                                onChange={e => setEditingPartner({ ...editingPartner, managerName: e.target.value })}
                            />
                        </SettingsRow>

                        <SettingsRow label="거래처 연락처" description="주요 소통용 전화번호입니다.">
                            <input
                                type="text"
                                placeholder="예: 010-1234-5678"
                                className="w-full sm:max-w-md h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                                value={editingPartner.contactPhone || ''}
                                onChange={e => setEditingPartner({ ...editingPartner, contactPhone: e.target.value })}
                            />
                        </SettingsRow>

                        <SettingsRow label="비고 및 메모" description="내부 참고용 거래처 특이사항입니다.">
                            <textarea
                                rows={2}
                                placeholder="거래처 특이사항을 입력하세요."
                                className="w-full p-2.5 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground leading-relaxed"
                                value={editingPartner.notes || ''}
                                onChange={e => setEditingPartner({ ...editingPartner, notes: e.target.value })}
                            />
                        </SettingsRow>
                    </SettingsCard>

                    <SettingsCard
                        title="정산 주기 및 일정 정책"
                        description="거래처와의 정산 마감 요일, 세금계산서 청구 및 수수료 지급 시기를 설정합니다."
                        icon={<Calendar size={18} strokeWidth={1.75} />}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                            <div className="p-3.5 bg-muted/30 rounded-xl border border-border">
                                <label className="block text-2xs font-semibold text-foreground mb-1.5">
                                    1. 정산 마감 요일 (1단계)
                                </label>
                                <select
                                    className="w-full h-8 px-2.5 text-xs font-semibold bg-background text-foreground border border-input rounded-md outline-none focus:ring-1 focus:ring-ring"
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
                                <p className="text-2xs text-muted-foreground mt-1">한 주간의 정산 대상을 집계 마감하는 요일</p>
                            </div>

                            <div className="p-3.5 bg-muted/30 rounded-xl border border-border">
                                <label className="block text-2xs font-semibold text-foreground mb-1.5">
                                    2. 수당 지급 주차 (3단계)
                                </label>
                                <select
                                    className="w-full h-8 px-2.5 text-xs font-semibold bg-background text-foreground border border-input rounded-md outline-none focus:ring-1 focus:ring-ring"
                                    value={editingPartner.settlementConfig.payoutWeekDelay}
                                    onChange={e => setEditingPartner({
                                        ...editingPartner,
                                        settlementConfig: { ...editingPartner.settlementConfig, payoutWeekDelay: Number(e.target.value) }
                                    })}
                                >
                                    <option value={0}>마감 당주</option>
                                    <option value={1}>마감 익주 (+1주)</option>
                                    <option value={2}>마감 다다음주 (+2주)</option>
                                </select>
                                <p className="text-2xs text-muted-foreground mt-1">입금 확인 후 수당이 정산되는 시점</p>
                            </div>

                            <div className="p-3.5 bg-muted/30 rounded-xl border border-border">
                                <label className="block text-2xs font-semibold text-foreground mb-1.5">
                                    3. 수당 지급 요일 (3단계)
                                </label>
                                <select
                                    className="w-full h-8 px-2.5 text-xs font-semibold bg-background text-foreground border border-input rounded-md outline-none focus:ring-1 focus:ring-ring"
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
                                <p className="text-2xs text-muted-foreground mt-1">상담원/팀장에게 수당을 송금하는 요일</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <SettingsRow label="착수금 비율 (기본 10%)" description="고객이 1차 입금해야 하는 기본 계약 착수금입니다.">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        className="w-20 h-9 px-3 text-xs font-mono font-semibold text-right bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring tabular-nums"
                                        value={editingPartner.settlementConfig.downPaymentPercentage}
                                        onChange={e => setEditingPartner({
                                            ...editingPartner,
                                            settlementConfig: { ...editingPartner.settlementConfig, downPaymentPercentage: Number(e.target.value) }
                                        })}
                                    />
                                    <span className="text-xs text-muted-foreground">%</span>
                                </div>
                            </SettingsRow>

                            <SettingsRow label="1차 수당 지급 비율 (기본 50%)" description="착수금 입금 확인 시 우선 선지급할 수당 비율입니다.">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        className="w-20 h-9 px-3 text-xs font-mono font-semibold text-right bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring tabular-nums"
                                        value={editingPartner.settlementConfig.firstPayoutPercentage}
                                        onChange={e => setEditingPartner({
                                            ...editingPartner,
                                            settlementConfig: { ...editingPartner.settlementConfig, firstPayoutPercentage: Number(e.target.value) }
                                        })}
                                    />
                                    <span className="text-xs text-muted-foreground">%</span>
                                </div>
                            </SettingsRow>
                        </div>
                    </SettingsCard>

                    {/* 은행 계좌 정보 */}
                    <SettingsCard
                        title="거래처 입금 계좌 정보 (세금계산서 청구용)"
                        description="거래처가 우리 회사로 수임료 수수료를 송금할 때 입금받을 통장 계좌 정보입니다."
                        icon={<DollarSign size={18} strokeWidth={1.75} />}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-2xs font-medium text-muted-foreground mb-1">은행명</label>
                                <input
                                    type="text"
                                    placeholder="예: 국민은행"
                                    className="w-full h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                                    value={editingPartner.bankInfo?.bankName || ''}
                                    onChange={e => setEditingPartner({
                                        ...editingPartner,
                                        bankInfo: { ...editingPartner.bankInfo, bankName: e.target.value, accountNumber: editingPartner.bankInfo?.accountNumber || '', accountHolder: editingPartner.bankInfo?.accountHolder || '' }
                                    })}
                                />
                            </div>
                            <div>
                                <label className="block text-2xs font-medium text-muted-foreground mb-1">계좌번호</label>
                                <input
                                    type="text"
                                    placeholder="예: 3333-xx-xxxx"
                                    className="w-full h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground font-mono"
                                    value={editingPartner.bankInfo?.accountNumber || ''}
                                    onChange={e => setEditingPartner({
                                        ...editingPartner,
                                        bankInfo: { ...editingPartner.bankInfo, accountNumber: e.target.value, bankName: editingPartner.bankInfo?.bankName || '', accountHolder: editingPartner.bankInfo?.accountHolder || '' }
                                    })}
                                />
                            </div>
                            <div>
                                <label className="block text-2xs font-medium text-muted-foreground mb-1">예금주</label>
                                <input
                                    type="text"
                                    placeholder="예: 주식회사 리드마스터"
                                    className="w-full h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
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
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted/60 text-foreground border border-border rounded-md text-xs font-medium"
                                        >
                                            <span>{name}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveDepositName(name)}
                                                className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                                            >
                                                <Trash2 size={12} strokeWidth={1.75} />
                                            </button>
                                        </span>
                                    ))}
                                    {(editingPartner.depositNames || []).length === 0 && (
                                        <span className="text-xs text-muted-foreground">등록된 매칭 키워드가 없습니다.</span>
                                    )}
                                </div>
                                <div className="flex gap-2 max-w-sm">
                                    <input
                                        type="text"
                                        placeholder="예: 안철형, 명율법률"
                                        className="flex-1 h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                                        value={newDepositName}
                                        onChange={e => setNewDepositName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddDepositName(); } }}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddDepositName}
                                        className="h-9 px-3.5 bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-medium rounded-lg transition-colors"
                                    >
                                        추가
                                    </button>
                                </div>
                            </div>
                        </SettingsRow>
                    </SettingsCard>

                    {/* 정산 파트너 프리셋 */}
                    <SettingsCard
                        title="정산 파트너 프리셋 (수수료 지급처 계좌 목록)"
                        description="3단계 수당 지급 처리 시 빠르게 선택할 수 있는 협력 변호사/팀장의 계좌 및 기본 지급액 프리셋입니다."
                        icon={<Users size={18} strokeWidth={1.75} />}
                    >
                        <div className="space-y-4">
                            {/* 프리셋 목록 */}
                            <div className="space-y-2">
                                {(editingPartner.payoutPartnerPresets || []).map(preset => (
                                    <div
                                        key={preset.id}
                                        className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-semibold text-xs text-foreground">{preset.name}</span>
                                            <span className="text-2xs text-muted-foreground font-mono">{preset.accountInfo}</span>
                                            {preset.defaultAmount && (
                                                <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                                    기본 {preset.defaultAmount}만원
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeletePreset(preset.id)}
                                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                                            title="프리셋 삭제"
                                        >
                                            <Trash2 size={13} strokeWidth={1.75} />
                                        </button>
                                    </div>
                                ))}
                                {(editingPartner.payoutPartnerPresets || []).length === 0 && (
                                    <div className="text-center py-6 text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                                        등록된 지급처 프리셋이 없습니다. 아래에서 추가하세요.
                                    </div>
                                )}
                            </div>

                            {/* 신규 프리셋 등록 폼 */}
                            <div className="p-4 bg-muted/40 rounded-xl border border-border">
                                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
                                    + 새 지급 파트너 프리셋 등록
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                                    <input
                                        type="text"
                                        placeholder="파트너명 (예: 안철형 변호사)"
                                        className="h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring font-medium"
                                        value={newPresetName}
                                        onChange={e => setNewPresetName(e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="은행 및 계좌번호 (국민 123-45-6789)"
                                        className="h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring font-mono"
                                        value={newPresetAccount}
                                        onChange={e => setNewPresetAccount(e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        placeholder="기본 지급액 (만원, 선택사항)"
                                        className="h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring tabular-nums"
                                        value={newPresetAmount}
                                        onChange={e => setNewPresetAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleAddPreset}
                                        className="h-8 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-lg shadow-2xs transition-colors"
                                    >
                                        프리셋 추가
                                    </button>
                                </div>
                            </div>
                        </div>
                    </SettingsCard>

                    {/* 거래처 전용 텔레그램 연동 방 */}
                    <SettingsCard
                        title="거래처 전용 텔레그램 연동 방 (사건 전달 · 피드백 자동수집)"
                        description="이 거래처(변호사 사무실)의 전용 텔레그램 방입니다. 리드 상세의 [텔레그램 전달]은 이 방으로 전송되고, 이 방에서 수신된 피드백은 해당 거래처 고객과 자동 매칭됩니다."
                        icon={<MessageCircle size={18} strokeWidth={1.75} />}
                    >
                        <TelegramChatPicker
                            value={editingPartner.telegramChatId || ''}
                            onChange={v => setEditingPartner({ ...editingPartner, telegramChatId: v })}
                        />
                    </SettingsCard>
                </div>
            )}

            {/* [서브탭 2] 수수료 분배 규칙 */}
            {subTab === 'commission' && (
                <div className="space-y-6">
                    <SettingsCard
                        title="기본 수수료 지급 방식"
                        description="거래처 전체에 기본 적용할 수수료 모델을 선택합니다."
                        icon={<DollarSign size={18} strokeWidth={1.75} />}
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
                                    className={`p-4 rounded-xl text-left border transition-all ${
                                        (editingPartner.incentiveType || 'rate') === opt.type
                                            ? 'border-primary bg-primary/5 shadow-2xs'
                                            : 'border-border bg-muted/20 hover:border-primary/40'
                                    }`}
                                >
                                    <div className="font-semibold text-xs text-foreground">{opt.label}</div>
                                    <div className="text-2xs text-muted-foreground mt-0.5">{opt.desc}</div>
                                </button>
                            ))}
                        </div>

                        {(editingPartner.incentiveType || 'rate') === 'rate' ? (
                            <SettingsRow label="기본 수수료율" description="구간 규칙이 없는 경우 기본 적용될 비율입니다.">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        className="w-24 h-9 px-3 text-xs font-mono font-semibold text-right bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring tabular-nums"
                                        value={editingPartner.incentiveRate ?? 30}
                                        onChange={e => setEditingPartner({ ...editingPartner, incentiveRate: Number(e.target.value) })}
                                    />
                                    <span className="text-xs text-muted-foreground">%</span>
                                </div>
                            </SettingsRow>
                        ) : (
                            <SettingsRow label="건당 기본 고정액" description="수임 완료 건당 지급할 금액입니다.">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        className="w-28 h-9 px-3 text-xs font-mono font-semibold text-right bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring tabular-nums"
                                        value={editingPartner.incentiveFixedAmount ?? 50}
                                        onChange={e => setEditingPartner({ ...editingPartner, incentiveFixedAmount: Number(e.target.value) })}
                                    />
                                    <span className="text-xs text-muted-foreground">만원</span>
                                </div>
                            </SettingsRow>
                        )}
                    </SettingsCard>

                    <SettingsCard
                        title="수임료 구간별 수수료 규칙 (Tier Rules)"
                        description="수임료 금액 구간에 따라 차등 수수료 및 전액 지급 기준을 세부 정의합니다."
                        icon={<FileText size={18} strokeWidth={1.75} />}
                    >
                        {/* 룰 추가 폼 */}
                        <div className="p-4 bg-muted/40 rounded-xl border border-border mb-6">
                            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
                                + 신규 구간 규칙 추가
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                                <div>
                                    <label className="block text-2xs font-medium text-muted-foreground mb-1">최소 수임료 (만원)</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        className="w-full h-8 px-2.5 text-xs font-mono font-semibold bg-background text-foreground border border-input rounded-md outline-none focus:ring-1 focus:ring-ring tabular-nums"
                                        value={newRule.minFee || ''}
                                        onChange={e => setNewRule({ ...newRule, minFee: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-2xs font-medium text-muted-foreground mb-1">최대 수임료 (만원)</label>
                                    <input
                                        type="number"
                                        placeholder="0=무제한"
                                        className="w-full h-8 px-2.5 text-xs font-mono font-semibold bg-background text-foreground border border-input rounded-md outline-none focus:ring-1 focus:ring-ring tabular-nums"
                                        value={newRule.maxFee || ''}
                                        onChange={e => setNewRule({ ...newRule, maxFee: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-2xs font-medium text-muted-foreground mb-1">지급 수수료 (만원)</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        className="w-full h-8 px-2.5 text-xs font-mono font-semibold text-primary bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-ring tabular-nums"
                                        value={newRule.commission || ''}
                                        onChange={e => setNewRule({ ...newRule, commission: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-2xs font-medium text-muted-foreground mb-1">전액지급 기준 (만원)</label>
                                    <input
                                        type="number"
                                        placeholder="0=기본"
                                        className="w-full h-8 px-2.5 text-xs font-mono font-semibold bg-background text-foreground border border-input rounded-md outline-none focus:ring-1 focus:ring-ring tabular-nums"
                                        value={newRule.fullPayoutThreshold || ''}
                                        onChange={e => setNewRule({ ...newRule, fullPayoutThreshold: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={onAddRule}
                                    className="h-8 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-lg shadow-2xs transition-colors"
                                >
                                    규칙 등록
                                </button>
                            </div>
                        </div>

                        {/* 룰 테이블 */}
                        <div className="overflow-x-auto rounded-xl border border-border">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-muted/60 text-muted-foreground font-medium border-b border-border text-2xs">
                                    <tr>
                                        <th className="p-3">수임료 구간</th>
                                        <th className="p-3">수수료 (수당)</th>
                                        <th className="p-3">전액지급 기준</th>
                                        <th className="p-3 text-center">우선순위</th>
                                        <th className="p-3 text-right">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {(editingPartner.commissionRules || []).map(r => (
                                        <tr key={r.ruleId} className="hover:bg-muted/40 transition-colors">
                                            <td className="p-3 font-medium text-foreground">
                                                {r.minFee.toLocaleString()}만원 ~ {r.maxFee ? `${r.maxFee.toLocaleString()}만원` : '무제한'}
                                            </td>
                                            <td className="p-3 font-semibold text-primary font-mono tabular-nums">
                                                {r.commission.toLocaleString()}만원
                                            </td>
                                            <td className="p-3 text-muted-foreground">
                                                {r.fullPayoutThreshold ? `${r.fullPayoutThreshold.toLocaleString()}만원 이상 입금 시` : '기본 정책'}
                                            </td>
                                            <td className="p-3 text-center font-mono text-muted-foreground">{r.priority}</td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() => onDeleteRule(r.ruleId)}
                                                    className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                                                    title="규칙 삭제"
                                                >
                                                    <Trash2 size={13} strokeWidth={1.75} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {(editingPartner.commissionRules || []).length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">
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
                        icon={<FileText size={18} strokeWidth={1.75} />}
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {AVAILABLE_FIELDS_CONFIG.map(f => {
                                const isChecked = (editingPartner.requiredFields || []).includes(f.key);
                                return (
                                    <label
                                        key={f.key}
                                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                                            isChecked
                                                ? 'bg-primary/10 border-primary/40 text-primary'
                                                : 'bg-muted/20 border-border text-muted-foreground hover:border-primary/30'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded text-primary border-input focus:ring-ring"
                                            checked={isChecked}
                                            onChange={() => toggleField(f.key)}
                                        />
                                        <span className="text-xs font-medium">{f.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </SettingsCard>

                    <SettingsCard
                        title="카카오톡 정산 알림 메시지 템플릿"
                        description="세금계산서 발행 완료 및 수수료 정산 요청 시 거래처에 보낼 기본 메시지 템플릿입니다."
                        icon={<MessageCircle size={18} strokeWidth={1.75} />}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-foreground mb-2">
                                    1. 세금계산서 청구 발행 완료 안내
                                </label>
                                <textarea
                                    rows={8}
                                    className="w-full p-3 text-xs font-mono bg-background text-foreground border border-input rounded-xl outline-none focus:ring-1 focus:ring-ring leading-relaxed placeholder:text-muted-foreground"
                                    value={editingPartner.kakaoTemplates?.invoiceNotice || ''}
                                    placeholder="발행 완료 안내 카톡 문구를 입력하세요."
                                    onChange={e => setEditingPartner({
                                        ...editingPartner,
                                        kakaoTemplates: { ...editingPartner.kakaoTemplates, invoiceNotice: e.target.value }
                                    })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-foreground mb-2">
                                    2. 파트너 세금계산서 역발행 요청 문구
                                </label>
                                <textarea
                                    rows={8}
                                    className="w-full p-3 text-xs font-mono bg-background text-foreground border border-input rounded-xl outline-none focus:ring-1 focus:ring-ring leading-relaxed placeholder:text-muted-foreground"
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
                        icon={<FileText size={18} strokeWidth={1.75} />}
                    >
                        <textarea
                            rows={6}
                            className="w-full p-3 text-xs font-mono bg-background text-foreground border border-input rounded-xl outline-none focus:ring-1 focus:ring-ring leading-relaxed"
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
                        icon={<Sparkles size={18} strokeWidth={1.75} />}
                    >
                        <textarea
                            rows={8}
                            className="w-full p-3 text-xs font-mono bg-background text-foreground border border-input rounded-xl outline-none focus:ring-1 focus:ring-ring leading-relaxed"
                            value={editingPartner.aiPromptTemplate || DEFAULT_AI_PROMPT}
                            onChange={e => setEditingPartner({ ...editingPartner, aiPromptTemplate: e.target.value })}
                        />
                    </SettingsCard>

                    <SettingsCard
                        title="상담 필수 확인 체크리스트"
                        description="AI가 통화 녹취에서 반드시 확인되었는지 체크할 핵심 요건 목록입니다."
                        icon={<Sparkles size={18} strokeWidth={1.75} />}
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
                                                ? 'bg-primary/10 border-primary/40 text-primary'
                                                : 'bg-muted/20 border-border text-muted-foreground opacity-60'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded text-primary border-input focus:ring-ring"
                                            checked={isChecked}
                                            onChange={() => {
                                                const updated = isChecked
                                                    ? currentItems.filter(k => k !== item.key)
                                                    : [...currentItems, item.key];
                                                setEditingPartner({ ...editingPartner, checkItems: updated });
                                            }}
                                        />
                                        <span className="text-xs font-semibold text-foreground">{item.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </SettingsCard>

                    <SettingsCard
                        title="진행 가능성 AI 분류 기준 가이드"
                        description="AI가 상담 건의 수임 가능성을 A(유력), B(보통), C(불가)로 자동 판정하는 세부 기준입니다."
                        icon={<Sparkles size={18} strokeWidth={1.75} />}
                    >
                        <textarea
                            rows={8}
                            className="w-full p-3 text-xs font-mono bg-background text-foreground border border-input rounded-xl outline-none focus:ring-1 focus:ring-ring leading-relaxed placeholder:text-muted-foreground"
                            value={editingPartner.aiClassificationGuide || ''}
                            placeholder="분류 기준을 입력하세요."
                            onChange={e => setEditingPartner({ ...editingPartner, aiClassificationGuide: e.target.value })}
                        />
                    </SettingsCard>

                    <SettingsCard
                        title="AI 영수증/서류 OCR 인식 프롬프트"
                        description="수임료 입금증, 계약서 사진 등 서류를 OCR로 자동 판독할 때 사용할 프롬프트입니다."
                        icon={<Sparkles size={18} strokeWidth={1.75} />}
                    >
                        <textarea
                            rows={6}
                            className="w-full p-3 text-xs font-mono bg-background text-foreground border border-input rounded-xl outline-none focus:ring-1 focus:ring-ring leading-relaxed"
                            value={editingPartner.ocrPromptTemplate || DEFAULT_OCR_PROMPT}
                            onChange={e => setEditingPartner({ ...editingPartner, ocrPromptTemplate: e.target.value })}
                        />
                    </SettingsCard>
                </div>
            )}
        </div>
    );
};
