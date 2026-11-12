import React, { useState } from 'react';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';
import { CaseStatus, MissedCallIntervalTier } from '../../../types';
import { User, PhoneCall, ListFilter, Mail, Plus, Trash2, Save, ArrowRight, Layers, Tag, Check } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';

interface OperationsSettingsTabProps {
    // 1. 담당자
    managerName: string;
    setManagerName: (name: string) => void;
    onSaveManagerName: () => void;

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
    managerName,
    setManagerName,
    onSaveManagerName,
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

    // 이메일 수신자 추가/제거
    const handleAddEmail = () => {
        if (!newEmailRecipient.trim()) return;
        if (!newEmailRecipient.includes('@')) {
            showToast('올바른 이메일 형식이 아닙니다.', 'error');
            return;
        }
        if (emailNotificationRecipients.includes(newEmailRecipient.trim())) {
            showToast('이미 등록된 이메일입니다.', 'error');
            return;
        }
        setEmailNotificationRecipients([...emailNotificationRecipients, newEmailRecipient.trim()]);
        setNewEmailRecipient('');
    };

    const handleRemoveEmail = (email: string) => {
        setEmailNotificationRecipients(emailNotificationRecipients.filter(e => e !== email));
    };

    return (
        <div className="space-y-6">
            {/* 1. 기본 담당자 설정 */}
            <SettingsCard
                title="기본 업무 정보"
                description="신규 상담 접수 및 요약 템플릿의 기본 담당자 정보를 설정합니다."
                icon={<User size={18} />}
            >
                <SettingsRow label="기본 담당자명" description="신규 생성 건 기본 배정 및 카톡 요약문의 {{managerName}}에 치환됩니다.">
                    <div className="flex items-center gap-3 max-w-md">
                        <input
                            type="text"
                            className="flex-1 p-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                            value={managerName}
                            onChange={e => setManagerName(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={onSaveManagerName}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0"
                        >
                            저장
                        </button>
                    </div>
                </SettingsRow>
            </SettingsCard>

            {/* 2. 재통화 / 부재콜 알림 주기 */}
            <SettingsCard
                title="재통화 및 부재콜 알림 주기 (등록 경과일 기준)"
                description="고객 등록 후 경과 일수에 따라 재통화 권장 주기(시간)를 단계별로 자동 계산합니다."
                icon={<PhoneCall size={18} />}
                headerAction={
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
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 rounded-xl transition-colors"
                    >
                        <Plus size={14} /> 구간 추가
                    </button>
                }
            >
                <div className="space-y-3">
                    <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-750 rounded-xl text-[11px] font-bold text-gray-500 uppercase">
                        <div className="col-span-2">단계</div>
                        <div className="col-span-4 text-center">등록 후 경과일 구간</div>
                        <div className="col-span-5 text-center">재통화 알림 주기 (시간)</div>
                        <div className="col-span-1 text-right">삭제</div>
                    </div>

                    {missedCallIntervalTiers.map((tier, idx) => (
                        <div
                            key={idx}
                            className="flex flex-col sm:grid grid-cols-12 gap-3 p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 items-center transition-all hover:border-gray-300"
                        >
                            <div className="col-span-2 w-full sm:w-auto flex items-center justify-between">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    {idx + 1}단계
                                </span>
                                <div className="sm:hidden">
                                    {missedCallIntervalTiers.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setMissedCallIntervalTiers(missedCallIntervalTiers.filter((_, i) => i !== idx))}
                                            className="text-rose-500 p-1"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="col-span-4 flex items-center justify-center gap-2 w-full">
                                <span className="text-xs text-gray-500">등록 후</span>
                                <input
                                    type="number"
                                    className="w-14 p-1.5 text-center text-xs font-bold bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg outline-none"
                                    value={tier.minDays}
                                    onChange={e => {
                                        const next = [...missedCallIntervalTiers];
                                        next[idx] = { ...tier, minDays: Number(e.target.value) };
                                        setMissedCallIntervalTiers(next);
                                    }}
                                />
                                <span className="text-xs text-gray-400">~</span>
                                {tier.maxDays === 0 ? (
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">이후 계속</span>
                                ) : (
                                    <input
                                        type="number"
                                        className="w-14 p-1.5 text-center text-xs font-bold bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg outline-none"
                                        value={tier.maxDays}
                                        onChange={e => {
                                            const next = [...missedCallIntervalTiers];
                                            next[idx] = { ...tier, maxDays: Number(e.target.value) };
                                            setMissedCallIntervalTiers(next);
                                        }}
                                    />
                                )}
                                <span className="text-xs text-gray-500">일</span>
                            </div>

                            <div className="col-span-5 flex items-center justify-center gap-2 w-full">
                                <ArrowRight size={14} className="text-gray-300 hidden sm:block" />
                                <input
                                    type="number"
                                    className="w-16 p-1.5 text-center text-sm font-bold text-blue-600 bg-blue-50/50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg outline-none"
                                    value={tier.interval}
                                    onChange={e => {
                                        const next = [...missedCallIntervalTiers];
                                        next[idx] = { ...tier, interval: Number(e.target.value) };
                                        setMissedCallIntervalTiers(next);
                                    }}
                                />
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">시간 마다 알림</span>
                            </div>

                            <div className="col-span-1 hidden sm:flex justify-end">
                                {missedCallIntervalTiers.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setMissedCallIntervalTiers(missedCallIntervalTiers.filter((_, i) => i !== idx))}
                                        className="text-gray-300 hover:text-rose-500 p-1 transition-colors"
                                    >
                                        <Trash2 size={15} />
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
                icon={<Tag size={18} />}
            >
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {inboundPaths.map((path, idx) => (
                            <span
                                key={idx}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                            >
                                {path}
                                <button
                                    type="button"
                                    onClick={() => onDeletePath(path)}
                                    className="hover:text-rose-500 text-gray-400 transition-colors"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2 max-w-sm">
                        <input
                            type="text"
                            placeholder="새 유입 경로 입력"
                            className="flex-1 p-2 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                            value={newPath}
                            onChange={e => setNewPath(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddPath(); } }}
                        />
                        <button
                            type="button"
                            onClick={onAddPath}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
                        >
                            추가
                        </button>
                    </div>
                </div>
            </SettingsCard>

            {/* 4. 상담 상태 체계 (1차 / 2차 / 3차 상태 마스터-디테일) */}
            <SettingsCard
                title="상담 상태 코드 체계 (1차 · 2차 · 3차 상태)"
                description="상담의 진행 단계를 체계적으로 관리합니다. 1차 대분류 > 2차 중분류 > 3차 소분류"
                icon={<Layers size={18} />}
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* [1차 상태] */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-750 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">1차 상태 (대분류)</span>
                            <span className="text-[10px] text-gray-400">{statuses.length}개</span>
                        </div>
                        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-60 pr-1">
                            {statuses.map(s => (
                                <div
                                    key={s}
                                    className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700 text-xs font-semibold"
                                >
                                    <span>{s}</span>
                                    <button
                                        type="button"
                                        onClick={() => onDeleteStatus(s)}
                                        className="text-gray-400 hover:text-rose-500"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <input
                                type="text"
                                placeholder="1차 상태 추가"
                                className="flex-1 p-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg outline-none"
                                value={newStatus}
                                onChange={e => setNewStatus(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddStatus(); } }}
                            />
                            <button
                                type="button"
                                onClick={onAddStatus}
                                className="px-2.5 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg"
                            >
                                추가
                            </button>
                        </div>
                    </div>

                    {/* [2차 상태] */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-750 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">2차 세부상태 (중분류)</span>
                            <span className="text-[10px] text-gray-400">{secondaryStatuses.length}개</span>
                        </div>
                        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-60 pr-1">
                            {secondaryStatuses.map(s => (
                                <div
                                    key={s}
                                    onClick={() => setSelectedTertiarySecondary(s)}
                                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                                        selectedTertiarySecondary === s
                                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300'
                                            : 'bg-white dark:bg-gray-800 border-gray-200/60 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    <span>{s}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onDeleteSecondaryStatus(s); }}
                                        className="text-gray-400 hover:text-rose-500"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <input
                                type="text"
                                placeholder="2차 상태 추가"
                                className="flex-1 p-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg outline-none"
                                value={newSecondaryStatus}
                                onChange={e => setNewSecondaryStatus(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddSecondaryStatus(); } }}
                            />
                            <button
                                type="button"
                                onClick={onAddSecondaryStatus}
                                className="px-2.5 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg"
                            >
                                추가
                            </button>
                        </div>
                    </div>

                    {/* [3차 상태] */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-750 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                            <div>
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">3차 최종상태</span>
                                {selectedTertiarySecondary && (
                                    <span className="text-[10px] text-blue-600 ml-1 font-bold">({selectedTertiarySecondary})</span>
                                )}
                            </div>
                            <span className="text-[10px] text-gray-400">
                                {selectedTertiarySecondary ? (tertiaryStatuses[selectedTertiarySecondary]?.length || 0) : 0}개
                            </span>
                        </div>
                        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-60 pr-1">
                            {!selectedTertiarySecondary ? (
                                <div className="text-center py-10 text-xs text-gray-400">
                                    좌측에서 2차 상태를 선택하세요.
                                </div>
                            ) : (
                                (tertiaryStatuses[selectedTertiarySecondary] || []).map(t => (
                                    <div
                                        key={t}
                                        className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700 text-xs font-semibold"
                                    >
                                        <span>{t}</span>
                                        <button
                                            type="button"
                                            onClick={() => onDeleteTertiaryStatus(selectedTertiarySecondary, t)}
                                            className="text-gray-400 hover:text-rose-500"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex gap-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <input
                                type="text"
                                disabled={!selectedTertiarySecondary}
                                placeholder={selectedTertiarySecondary ? "3차 상태 추가" : "2차 선택 필요"}
                                className="flex-1 p-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg outline-none disabled:opacity-50"
                                value={newTertiaryStatus}
                                onChange={e => setNewTertiaryStatus(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddTertiaryStatus(); } }}
                            />
                            <button
                                type="button"
                                disabled={!selectedTertiarySecondary}
                                onClick={onAddTertiaryStatus}
                                className="px-2.5 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                </div>
            </SettingsCard>

            {/* 5. 이메일 알림 설정 */}
            <SettingsCard
                title="미응답 케이스 이메일 알림"
                description="배정된 상담원이 일정 시간 동안 첫 전화를 시도하지 않을 경우 관리자에게 이메일로 알림을 전송합니다."
                icon={<Mail size={18} />}
                headerAction={
                    <button
                        type="button"
                        onClick={onSaveEmailSettings}
                        disabled={emailSettingsLoading}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                    >
                        <Save size={14} /> {emailSettingsLoading ? '저장 중...' : '이메일 설정 저장'}
                    </button>
                }
            >
                <SettingsRow label="이메일 알림 사용 여부" description="기능 활성화 시 미응답 케이스 감지 엔진이 동작합니다.">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={emailNotificationEnabled}
                            onChange={e => setEmailNotificationEnabled(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                            {emailNotificationEnabled ? '알림 작동 중' : '알림 끔'}
                        </span>
                    </label>
                </SettingsRow>

                <SettingsRow label="미응답 기준 시간" description="신규 등록 후 첫 통화가 없을 때 알림을 보낼 경과 시간입니다.">
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            className="w-20 p-2 text-sm text-right font-bold bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                            value={emailNotificationMinutes}
                            onChange={e => setEmailNotificationMinutes(Number(e.target.value))}
                        />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">분 경과 시</span>
                    </div>
                </SettingsRow>

                <SettingsRow label="알림 수신 이메일 목록" description="알림을 전달받을 관리자 및 팀장 이메일 목록입니다.">
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {emailNotificationRecipients.map((email, i) => (
                                <span
                                    key={i}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 dark:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-full text-xs font-semibold"
                                >
                                    {email}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveEmail(email)}
                                        className="hover:text-rose-500 text-gray-400"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </span>
                            ))}
                            {emailNotificationRecipients.length === 0 && (
                                <span className="text-xs text-gray-400">등록된 수신 이메일이 없습니다.</span>
                            )}
                        </div>
                        <div className="flex gap-2 max-w-sm">
                            <input
                                type="email"
                                placeholder="관리자 이메일 주소"
                                className="flex-1 p-2 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                value={newEmailRecipient}
                                onChange={e => setNewEmailRecipient(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); } }}
                            />
                            <button
                                type="button"
                                onClick={handleAddEmail}
                                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-xs font-bold rounded-xl"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                </SettingsRow>
            </SettingsCard>
        </div>
    );
};
