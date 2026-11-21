import React, { useState, useMemo } from 'react';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';
import { CaseStatus, MissedCallIntervalTier } from '../../../types';
import { DEFAULT_STATUS_LIST } from '../../../constants';
import { User, PhoneCall, Tag, Layers, Mail, Plus, Trash2, Save, ArrowRight, Lock, Check } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';

interface OperationsSettingsTabProps {
    canEdit?: boolean;
    // 1. 담당자 및 부재 기준 상태
    managerName: string;
    setManagerName: (name: string) => void;
    onSaveManagerName: () => void;
    missedCallStatus: string;
    setMissedCallStatus: (status: string) => void;

    // 2. 부재콜 주기
    missedCallIntervalTiers: MissedCallIntervalTier[];
    setMissedCallIntervalTiers: React.Dispatch<React.SetStateAction<MissedCallIntervalTier[]>>;

    // 3. 유입경로
    inboundPaths: string[];
    newPath: string;
    setNewPath: (p: string) => void;
    onAddPath: () => void;
    onDeletePath: (path: string) => void;

    // 4. 1차 상태
    statuses: CaseStatus[];
    newStatus: string;
    setNewStatus: (s: string) => void;
    onAddStatus: () => void;
    onDeleteStatus: (status: string) => void;

    // 5. 2차 상태
    secondaryStatuses: string[];
    newSecondaryStatus: string;
    setNewSecondaryStatus: (s: string) => void;
    onAddSecondaryStatus: () => void;
    onDeleteSecondaryStatus: (status: string) => void;

    // 6. 3차 상태
    tertiaryStatuses: Record<string, string[]>;
    selectedTertiarySecondary: string;
    setSelectedTertiarySecondary: (s: string) => void;
    newTertiaryStatus: string;
    setNewTertiaryStatus: (s: string) => void;
    onAddTertiaryStatus: () => void;
    onDeleteTertiaryStatus: (parent: string, status: string) => void;

    // 7. 이메일 알림
    emailNotificationEnabled: boolean;
    setEmailNotificationEnabled: (enabled: boolean) => void;
    emailNotificationRecipients: string[];
    setEmailNotificationRecipients: (recipients: string[]) => void;
    emailNotificationMinutes: number;
    setEmailNotificationMinutes: (mins: number) => void;
    newEmailRecipient: string;
    setNewEmailRecipient: (r: string) => void;
    onSaveEmailSettings: () => void;
    emailSettingsLoading: boolean;
}

export const OperationsSettingsTab: React.FC<OperationsSettingsTabProps> = ({
    canEdit = true,
    managerName,
    setManagerName,
    onSaveManagerName,
    missedCallStatus,
    setMissedCallStatus,
    missedCallIntervalTiers,
    setMissedCallIntervalTiers,
    inboundPaths,
    newPath,
    setNewPath,
    onAddPath,
    onDeletePath,
    statuses,
    newStatus,
    setNewStatus,
    onAddStatus,
    onDeleteStatus,
    secondaryStatuses,
    newSecondaryStatus,
    setNewSecondaryStatus,
    onAddSecondaryStatus,
    onDeleteSecondaryStatus,
    tertiaryStatuses,
    selectedTertiarySecondary,
    setSelectedTertiarySecondary,
    newTertiaryStatus,
    setNewTertiaryStatus,
    onAddTertiaryStatus,
    onDeleteTertiaryStatus,
    emailNotificationEnabled,
    setEmailNotificationEnabled,
    emailNotificationRecipients,
    setEmailNotificationRecipients,
    emailNotificationMinutes,
    setEmailNotificationMinutes,
    newEmailRecipient,
    setNewEmailRecipient,
    onSaveEmailSettings,
    emailSettingsLoading
}) => {
    const { showToast } = useToast();

    // 부재 콜 기준 상태 드롭다운 옵션
    const statusOptions = useMemo(() => {
        const base = (statuses && statuses.length > 0) ? statuses : DEFAULT_STATUS_LIST;
        const current = (missedCallStatus && missedCallStatus.trim()) ? missedCallStatus.trim() : '부재';
        if (base.includes(current)) {
            return base;
        }
        return [current, ...base];
    }, [statuses, missedCallStatus]);

    const handleAddEmail = () => {
        if (!newEmailRecipient.trim()) return;
        if (emailNotificationRecipients.includes(newEmailRecipient.trim())) {
            showToast('이미 등록된 이메일입니다.', 'error');
            return;
        }
        setEmailNotificationRecipients([...emailNotificationRecipients, newEmailRecipient.trim()]);
        setNewEmailRecipient('');
        showToast('알림 수신 이메일이 추가되었습니다.');
    };

    const handleRemoveEmail = (email: string) => {
        setEmailNotificationRecipients(emailNotificationRecipients.filter(e => e !== email));
        showToast('이메일이 목록에서 제거되었습니다.');
    };

    return (
        <div className="space-y-6">
            {!canEdit && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
                    <Lock size={16} strokeWidth={1.75} className="text-amber-500 shrink-0" />
                    <div>
                        <div className="text-xs font-semibold text-amber-500">
                            운영 설정 읽기 전용 모드
                        </div>
                        <div className="text-2xs text-muted-foreground mt-0.5">
                            회사의 공통 상담 상태 체계 및 부재콜 리마인더 기준을 열람하고 있습니다. 수정 및 삭제 권한은 대표 및 총괄 관리자에게 있습니다.
                        </div>
                    </div>
                </div>
            )}

            {/* 1. 기본 담당자 설정 */}
            <SettingsCard
                title="기본 업무 정보"
                description="신규 상담 접수 기본 배정 담당자와 부재콜 감지 기준 상태를 설정합니다."
                icon={<User size={18} strokeWidth={1.75} />}
            >
                <SettingsRow label="기본 담당자명" description="신규 생성 건 기본 배정 및 카톡 요약문의 {{managerName}}에 치환됩니다.">
                    <div className="flex items-center gap-2 max-w-md">
                        <input
                            type="text"
                            disabled={!canEdit}
                            className="flex-1 h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring focus:border-ring disabled:opacity-60"
                            value={managerName}
                            onChange={e => setManagerName(e.target.value)}
                        />
                        {canEdit && (
                            <button
                                type="button"
                                onClick={onSaveManagerName}
                                className="h-9 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-lg shadow-2xs transition-colors shrink-0 flex items-center gap-1.5"
                            >
                                <Save size={13} strokeWidth={1.75} />
                                <span>저장</span>
                            </button>
                        )}
                    </div>
                </SettingsRow>

                <SettingsRow label="부재 콜 기준 상태" description="케이스가 이 상태일 때만 '부재 확인' 버튼 및 재통화 타이머가 동작합니다.">
                    <select
                        disabled={!canEdit}
                        className="w-full sm:max-w-md h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring focus:border-ring disabled:opacity-60 cursor-pointer"
                        value={missedCallStatus || statusOptions[0] || '부재'}
                        onChange={e => {
                            setMissedCallStatus(e.target.value);
                            localStorage.setItem('lm_missedStatus', e.target.value);
                            showToast(`부재 기준 상태가 '${e.target.value}'(으)로 변경되었습니다.`);
                        }}
                    >
                        {statusOptions.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </SettingsRow>
            </SettingsCard>

            {/* 2. 재통화 / 부재콜 알림 주기 */}
            <SettingsCard
                title="재통화 및 부재콜 알림 주기 (등록 경과일 기준)"
                description="고객 등록 후 경과 일수에 따라 재통화 권장 주기(시간)를 단계별로 자동 계산합니다."
                icon={<PhoneCall size={18} strokeWidth={1.75} />}
                headerAction={
                    canEdit ? (
                        <button
                            type="button"
                            onClick={() => {
                                const last = missedCallIntervalTiers[missedCallIntervalTiers.length - 1];
                                const nextDays = last ? (last.maxDays || last.minDays + 30) : 0;
                                setMissedCallIntervalTiers([
                                    ...missedCallIntervalTiers.map((t, i) =>
                                        i === missedCallIntervalTiers.length - 1 && t.maxDays === 0
                                            ? { ...t, maxDays: nextDays, label: `${t.minDays}~${nextDays}일` }
                                            : t
                                    ),
                                    { minDays: nextDays, maxDays: 0, interval: 24, label: `${nextDays}일 이상` }
                                ]);
                            }}
                            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                        >
                            <Plus size={13} strokeWidth={1.75} />
                            <span>구간 추가</span>
                        </button>
                    ) : undefined
                }
            >
                <div className="space-y-2.5">
                    <div className="hidden sm:grid grid-cols-12 gap-3 px-3 py-1.5 bg-muted/60 rounded-lg text-2xs font-mono font-medium text-muted-foreground uppercase">
                        <div className="col-span-2">단계</div>
                        <div className="col-span-4 text-center">등록 후 경과일 구간</div>
                        <div className="col-span-5 text-center">재통화 알림 주기 (시간)</div>
                        <div className="col-span-1 text-right">삭제</div>
                    </div>

                    {missedCallIntervalTiers.map((tier, idx) => (
                        <div
                            key={idx}
                            className="flex flex-col sm:grid grid-cols-12 gap-3 p-3 bg-muted/20 rounded-xl border border-border items-center transition-colors hover:border-primary/40"
                        >
                            <div className="col-span-2 w-full sm:w-auto flex items-center justify-between">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-mono font-medium bg-primary/10 text-primary border border-primary/20">
                                    {idx + 1}단계
                                </span>
                                <div className="sm:hidden">
                                    {canEdit && missedCallIntervalTiers.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setMissedCallIntervalTiers(missedCallIntervalTiers.filter((_, i) => i !== idx))}
                                            className="text-destructive p-1"
                                        >
                                            <Trash2 size={13} strokeWidth={1.75} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="col-span-4 flex items-center justify-center gap-2 w-full">
                                <span className="text-2xs text-muted-foreground">등록 후</span>
                                <input
                                    type="number"
                                    disabled={!canEdit}
                                    className="w-14 h-8 text-center text-xs font-mono font-semibold bg-background text-foreground border border-input rounded-md outline-none focus:ring-1 focus:ring-ring disabled:opacity-60 tabular-nums"
                                    value={tier.minDays}
                                    onChange={e => {
                                        const next = [...missedCallIntervalTiers];
                                        next[idx] = { ...tier, minDays: Number(e.target.value) };
                                        setMissedCallIntervalTiers(next);
                                    }}
                                />
                                <span className="text-xs text-muted-foreground">~</span>
                                {tier.maxDays === 0 ? (
                                    <span className="text-xs font-medium text-foreground">이후 계속</span>
                                ) : (
                                    <input
                                        type="number"
                                        disabled={!canEdit}
                                        className="w-14 h-8 text-center text-xs font-mono font-semibold bg-background text-foreground border border-input rounded-md outline-none focus:ring-1 focus:ring-ring disabled:opacity-60 tabular-nums"
                                        value={tier.maxDays}
                                        onChange={e => {
                                            const next = [...missedCallIntervalTiers];
                                            next[idx] = { ...tier, maxDays: Number(e.target.value) };
                                            setMissedCallIntervalTiers(next);
                                        }}
                                    />
                                )}
                                <span className="text-2xs text-muted-foreground">일</span>
                            </div>

                            <div className="col-span-5 flex items-center justify-center gap-2 w-full">
                                <ArrowRight size={13} strokeWidth={1.75} className="text-muted-foreground hidden sm:block" />
                                <input
                                    type="number"
                                    disabled={!canEdit}
                                    className="w-16 h-8 text-center text-xs font-mono font-semibold text-primary bg-primary/5 border border-primary/20 rounded-md outline-none focus:ring-1 focus:ring-ring disabled:opacity-60 tabular-nums"
                                    value={tier.interval}
                                    onChange={e => {
                                        const next = [...missedCallIntervalTiers];
                                        next[idx] = { ...tier, interval: Number(e.target.value) };
                                        setMissedCallIntervalTiers(next);
                                    }}
                                />
                                <span className="text-xs text-muted-foreground">시간 마다 알림</span>
                            </div>

                            <div className="col-span-1 hidden sm:flex justify-end">
                                {canEdit && missedCallIntervalTiers.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setMissedCallIntervalTiers(missedCallIntervalTiers.filter((_, i) => i !== idx))}
                                        className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                                    >
                                        <Trash2 size={13} strokeWidth={1.75} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </SettingsCard>

            {/* 3. 유입 경로 관리 */}
            <SettingsCard
                title="마케팅 유입 경로 설정"
                description="페이스북, 구글, 블로그, 당근 등 리드가 유입되는 채널 코드를 관리합니다."
                icon={<Tag size={18} strokeWidth={1.75} />}
            >
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {inboundPaths.map((path, idx) => (
                            <span
                                key={idx}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-muted/50 text-foreground border border-border rounded-lg text-xs font-medium"
                            >
                                <span>{path}</span>
                                {canEdit && (
                                    <button
                                        type="button"
                                        onClick={() => onDeletePath(path)}
                                        className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                                    >
                                        <Trash2 size={12} strokeWidth={1.75} />
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {canEdit && (
                        <div className="flex gap-2 max-w-sm">
                            <input
                                type="text"
                                placeholder="새 유입 경로 입력"
                                className="flex-1 h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                                value={newPath}
                                onChange={e => setNewPath(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddPath(); } }}
                            />
                            <button
                                type="button"
                                onClick={onAddPath}
                                className="h-9 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-lg shadow-2xs transition-colors shrink-0"
                            >
                                추가
                            </button>
                        </div>
                    )}
                </div>
            </SettingsCard>

            {/* 4. 상담 상태 체계 (1차 / 2차 / 3차 상태 마스터-디테일) */}
            <SettingsCard
                title="상담 상태 코드 체계 (1차 · 2차 · 3차 상태)"
                description="상담의 진행 단계를 체계적으로 관리합니다. 1차 대분류 > 2차 중분류 > 3차 소분류"
                icon={<Layers size={18} strokeWidth={1.75} />}
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* [1차 상태] */}
                    <div className="p-4 bg-muted/20 rounded-xl border border-border flex flex-col">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                            <span className="text-xs font-semibold text-foreground">1차 상태 (대분류)</span>
                            <span className="text-2xs font-mono text-muted-foreground tabular-nums">{statuses.length}개</span>
                        </div>
                        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-60 pr-1">
                            {statuses.map(s => (
                                <div
                                    key={s}
                                    className="flex items-center justify-between px-3 py-2 bg-background rounded-lg border border-border text-xs font-medium text-foreground"
                                >
                                    <span>{s}</span>
                                    {canEdit && (
                                        <button
                                            type="button"
                                            onClick={() => onDeleteStatus(s)}
                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                        >
                                            <Trash2 size={12} strokeWidth={1.75} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {canEdit && (
                            <div className="flex gap-2 mt-3 pt-2 border-t border-border">
                                <input
                                    type="text"
                                    placeholder="1차 상태 추가"
                                    className="flex-1 h-8 px-2.5 text-xs bg-background text-foreground border border-input rounded-md outline-none focus:ring-1 focus:ring-ring"
                                    value={newStatus}
                                    onChange={e => setNewStatus(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddStatus(); } }}
                                />
                                <button
                                    type="button"
                                    onClick={onAddStatus}
                                    className="h-8 px-3 bg-primary text-primary-foreground text-xs font-medium rounded-md shadow-2xs hover:bg-primary/90"
                                >
                                    추가
                                </button>
                            </div>
                        )}
                    </div>

                    {/* [2차 상태] */}
                    <div className="p-4 bg-muted/20 rounded-xl border border-border flex flex-col">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                            <span className="text-xs font-semibold text-foreground">2차 세부상태 (중분류)</span>
                            <span className="text-2xs font-mono text-muted-foreground tabular-nums">{secondaryStatuses.length}개</span>
                        </div>
                        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-60 pr-1">
                            {secondaryStatuses.map(s => (
                                <div
                                    key={s}
                                    onClick={() => setSelectedTertiarySecondary(s)}
                                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                                        selectedTertiarySecondary === s
                                            ? 'bg-primary/10 border-primary/40 text-primary font-semibold'
                                            : 'bg-background border-border text-foreground hover:border-primary/30'
                                    }`}
                                >
                                    <span>{s}</span>
                                    {canEdit && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); onDeleteSecondaryStatus(s); }}
                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                        >
                                            <Trash2 size={12} strokeWidth={1.75} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {canEdit && (
                            <div className="flex gap-2 mt-3 pt-2 border-t border-border">
                                <input
                                    type="text"
                                    placeholder="2차 상태 추가"
                                    className="flex-1 h-8 px-2.5 text-xs bg-background text-foreground border border-input rounded-md outline-none focus:ring-1 focus:ring-ring"
                                    value={newSecondaryStatus}
                                    onChange={e => setNewSecondaryStatus(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddSecondaryStatus(); } }}
                                />
                                <button
                                    type="button"
                                    onClick={onAddSecondaryStatus}
                                    className="h-8 px-3 bg-primary text-primary-foreground text-xs font-medium rounded-md shadow-2xs hover:bg-primary/90"
                                >
                                    추가
                                </button>
                            </div>
                        )}
                    </div>

                    {/* [3차 상태] */}
                    <div className="p-4 bg-muted/20 rounded-xl border border-border flex flex-col">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                            <div>
                                <span className="text-xs font-semibold text-foreground">3차 최종상태</span>
                                {selectedTertiarySecondary && (
                                    <span className="text-xs text-primary ml-1 font-mono font-medium">({selectedTertiarySecondary})</span>
                                )}
                            </div>
                            <span className="text-2xs font-mono text-muted-foreground tabular-nums">
                                {selectedTertiarySecondary ? (tertiaryStatuses[selectedTertiarySecondary]?.length || 0) : 0}개
                            </span>
                        </div>
                        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-60 pr-1">
                            {!selectedTertiarySecondary ? (
                                <div className="text-center py-10 text-xs text-muted-foreground">
                                    좌측에서 2차 상태를 선택하세요.
                                </div>
                            ) : (
                                (tertiaryStatuses[selectedTertiarySecondary] || []).map(t => (
                                    <div
                                        key={t}
                                        className="flex items-center justify-between px-3 py-2 bg-background rounded-lg border border-border text-xs font-medium text-foreground"
                                    >
                                        <span>{t}</span>
                                        {canEdit && (
                                            <button
                                                type="button"
                                                onClick={() => onDeleteTertiaryStatus(selectedTertiarySecondary, t)}
                                                className="text-muted-foreground hover:text-destructive transition-colors"
                                            >
                                                <Trash2 size={12} strokeWidth={1.75} />
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                        {canEdit && (
                            <div className="flex gap-2 mt-3 pt-2 border-t border-border">
                                <input
                                    type="text"
                                    disabled={!selectedTertiarySecondary}
                                    placeholder={selectedTertiarySecondary ? "3차 상태 추가" : "2차 선택 필요"}
                                    className="flex-1 h-8 px-2.5 text-xs bg-background text-foreground border border-input rounded-md outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                                    value={newTertiaryStatus}
                                    onChange={e => setNewTertiaryStatus(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddTertiaryStatus(); } }}
                                />
                                <button
                                    type="button"
                                    disabled={!selectedTertiarySecondary}
                                    onClick={onAddTertiaryStatus}
                                    className="h-8 px-3 bg-primary text-primary-foreground text-xs font-medium rounded-md shadow-2xs hover:bg-primary/90 disabled:opacity-50"
                                >
                                    추가
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </SettingsCard>

            {/* 5. 이메일 알림 설정 */}
            <SettingsCard
                title="미응답 케이스 이메일 알림"
                description="배정된 상담원이 일정 시간 동안 첫 전화를 시도하지 않을 경우 관리자에게 이메일로 알림을 전송합니다."
                icon={<Mail size={18} strokeWidth={1.75} />}
                headerAction={
                    canEdit ? (
                        <button
                            type="button"
                            onClick={onSaveEmailSettings}
                            disabled={emailSettingsLoading}
                            className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
                        >
                            <Save size={13} strokeWidth={1.75} />
                            <span>{emailSettingsLoading ? '저장 중...' : '이메일 설정 저장'}</span>
                        </button>
                    ) : undefined
                }
            >
                <SettingsRow label="이메일 알림 사용 여부" description="기능 활성화 시 미응답 케이스 감지 엔진이 동작합니다.">
                    <label className={`relative inline-flex items-center ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}>
                        <input
                            type="checkbox"
                            disabled={!canEdit}
                            className="sr-only peer"
                            checked={emailNotificationEnabled}
                            onChange={e => setEmailNotificationEnabled(e.target.checked)}
                        />
                        <div className="w-10 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-primary-foreground after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        <span className="ml-3 text-xs font-medium text-foreground">
                            {emailNotificationEnabled ? '알림 작동 중' : '알림 끔'}
                        </span>
                    </label>
                </SettingsRow>

                <SettingsRow label="미응답 기준 시간" description="신규 등록 후 첫 통화가 없을 때 알림을 보낼 경과 시간입니다.">
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            disabled={!canEdit}
                            className="w-20 h-9 px-3 text-xs text-right font-mono font-semibold bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring disabled:opacity-70 tabular-nums"
                            value={emailNotificationMinutes}
                            onChange={e => setEmailNotificationMinutes(Number(e.target.value))}
                        />
                        <span className="text-xs text-muted-foreground">분 경과 시</span>
                    </div>
                </SettingsRow>

                <SettingsRow label="알림 수신 이메일 목록" description="알림을 전달받을 관리자 및 팀장 이메일 목록입니다.">
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {emailNotificationRecipients.map((email, i) => (
                                <span
                                    key={i}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted/60 text-foreground border border-border rounded-md text-xs font-medium"
                                >
                                    <span>{email}</span>
                                    {canEdit && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveEmail(email)}
                                            className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                                        >
                                            <Trash2 size={12} strokeWidth={1.75} />
                                        </button>
                                    )}
                                </span>
                            ))}
                            {emailNotificationRecipients.length === 0 && (
                                <span className="text-xs text-muted-foreground">등록된 수신 이메일이 없습니다.</span>
                            )}
                        </div>
                        {canEdit && (
                            <div className="flex gap-2 max-w-sm">
                                <input
                                    type="email"
                                    placeholder="관리자 이메일 주소"
                                    className="flex-1 h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                                    value={newEmailRecipient}
                                    onChange={e => setNewEmailRecipient(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); } }}
                                />
                                <button
                                    type="button"
                                    onClick={handleAddEmail}
                                    className="h-9 px-3.5 bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-medium rounded-lg transition-colors"
                                >
                                    추가
                                </button>
                            </div>
                        )}
                    </div>
                </SettingsRow>
            </SettingsCard>
        </div>
    );
};
