import React, { useMemo, useState } from 'react';
import { Sparkles, CalendarClock } from 'lucide-react';
import { Case, CaseStatusLog, Partner, MemoItem, ReminderItem, RecordingItem } from '../../../types';
import { CaseDetailReminders } from './CaseDetailReminders';
import { CaseDetailAiSummary } from './CaseDetailAiSummary';
import { CaseDetailPersonalInfo } from './CaseDetailPersonalInfo';
import { CaseDetailJobFamily } from './CaseDetailJobFamily';
import { CaseDetailHousing } from './CaseDetailHousing';
import { CaseDetailAssets } from './CaseDetailAssets';
import { CaseDetailHistory } from './CaseDetailHistory';
import { getCheckProgress } from '../../../utils/intake';

interface CaseInfoTabProps {
    c: Case;
    partners: Partner[];
    inboundPaths: string[];
    onUpdate: (field: string, value: any) => void;
    onIncomeChange: (type: string, value: any) => void;
    onJobTypeChange: (value: any) => void;

    // Reminders & Memos
    reminders: ReminderItem[];
    memos: MemoItem[];
    onUpdateReminders: (reminders: ReminderItem[]) => void;
    onUpdateMemos: (memos: MemoItem[]) => void;

    // AI Summary Props
    aiSummaryText: string | null;
    setAiSummaryText: (text: string) => void;
    aiSummaryEditMode: boolean;
    setAiSummaryEditMode: (mode: boolean) => void;
    handleUpdateAiSummaryText: () => void;
    handleDeleteAiSummary: () => void;
    handleSaveSummaryToMemo: () => void;
    currentAudioFile: File | null;
    audioUrl: string | null;
    isFileUploading: boolean;
    isAiLoading: boolean;
    onAudioFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onTriggerAudioInput: () => void;
    onGenerateAiSummary: () => void;
    onPlayRecording: (rec: RecordingItem) => void;
    onDeleteRecording: (id: string) => void;

    // Logs
    statusLogs: CaseStatusLog[];
    showToast: (msg: string, type?: 'success' | 'error') => void;
}

// 질문 순서 = 화면 순서. 필수 확인 항목이 어느 단계에 속하는지
const STEPS: { id: string; label: string; keys: string[] }[] = [
    { id: 'personal', label: '접수·인적', keys: ['birth'] },
    { id: 'job', label: '직업·소득·가족', keys: ['job', 'income', 'insurance4', 'marital', 'children'] },
    { id: 'housing', label: '주거', keys: ['housing', 'region'] },
    { id: 'debt', label: '채무·재산', keys: ['debtTotal', 'creditors', 'monthlyPay', 'overdue', 'assets', 'spouseAssets', 'creditCard'] },
    { id: 'history', label: '이력', keys: ['history', 'contactTime'] },
];

const scrollToStep = (id: string) => {
    document.getElementById(`step-${id}`)?.scrollIntoView({ block: 'start' });
};

/**
 * 리드 상세 → 정보 탭
 * [2026-11-01] 상담 순서대로 한 줄로 (접수·인적 → 직업·소득·가족 → 주거 → 채무·재산 → 이력).
 * 위에 거래처 필수 확인 항목 진행률, 단계 바로가기. 상담 메모·일정은 오른쪽(모바일은 위)에 늘 보인다.
 * 예전엔 모바일·PC 화면을 둘 다 그려 두고 CSS로 숨겨서 모든 칸이 두 번씩 렌더됐다.
 */
export const CaseInfoTab: React.FC<CaseInfoTabProps> = ({
    c, partners, inboundPaths, onUpdate, onIncomeChange, onJobTypeChange,
    reminders, memos, onUpdateReminders, onUpdateMemos,
    aiSummaryText, setAiSummaryText, aiSummaryEditMode, setAiSummaryEditMode,
    handleUpdateAiSummaryText, handleDeleteAiSummary, handleSaveSummaryToMemo,
    currentAudioFile, audioUrl, isFileUploading, isAiLoading,
    onAudioFileSelect, onTriggerAudioInput, onGenerateAiSummary, onPlayRecording, onDeleteRecording,
    statusLogs, showToast
}) => {
    const [rightPanelTab, setRightPanelTab] = useState<'reminders' | 'ai'>('reminders');
    const partner = partners.find(p => p.partnerId === c.partnerId);
    const progress = useMemo(() => getCheckProgress(c, partner), [c, partner]);
    const stepState = (keys: string[]) => {
        const mine = progress.items.filter(i => keys.includes(i.key));
        return { total: mine.length, missing: mine.filter(i => !i.filled).length };
    };
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 100;

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
            {/* 상담 메모 · 일정 (모바일은 먼저, PC는 오른쪽 고정 폭) */}
            <aside className="min-w-0 xl:order-2 space-y-3 xl:sticky xl:top-28">
                <div className="bg-white dark:bg-gray-800 p-1 rounded-xl flex gap-1 border border-slate-200 dark:border-gray-700">
                    <button
                        type="button"
                        onClick={() => setRightPanelTab('reminders')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${rightPanelTab === 'reminders' ? 'bg-slate-900 text-white' : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700'}`}
                    >
                        <CalendarClock size={13} /> 상담 메모 · 일정
                        {reminders.length > 0 && <span className={`text-[10px] px-1.5 rounded-full ${rightPanelTab === 'reminders' ? 'bg-white/20' : 'bg-slate-200 text-slate-700'}`}>{reminders.length}</span>}
                    </button>
                    <button
                        type="button"
                        onClick={() => setRightPanelTab('ai')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${rightPanelTab === 'ai' ? 'bg-slate-900 text-white' : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700'}`}
                    >
                        <Sparkles size={13} /> 녹음 직접 올려 요약
                    </button>
                </div>
                {rightPanelTab === 'reminders' ? (
                    <CaseDetailReminders
                        reminders={reminders}
                        memos={memos}
                        onUpdateReminders={onUpdateReminders}
                        onUpdateMemos={onUpdateMemos}
                        showToast={showToast}
                        isStacked={true}
                    />
                ) : (
                    <CaseDetailAiSummary
                        c={c}
                        aiSummaryText={aiSummaryText}
                        setAiSummaryText={setAiSummaryText}
                        aiSummaryEditMode={aiSummaryEditMode}
                        setAiSummaryEditMode={setAiSummaryEditMode}
                        handleUpdateAiSummaryText={handleUpdateAiSummaryText}
                        handleDeleteAiSummary={handleDeleteAiSummary}
                        handleSaveSummaryToMemo={handleSaveSummaryToMemo}
                        currentAudioFile={currentAudioFile}
                        audioUrl={audioUrl}
                        isFileUploading={isFileUploading}
                        isAiLoading={isAiLoading}
                        onAudioFileSelect={onAudioFileSelect}
                        onTriggerAudioInput={onTriggerAudioInput}
                        onGenerateAiSummary={onGenerateAiSummary}
                        onPlayRecording={onPlayRecording}
                        onDeleteRecording={onDeleteRecording}
                    />
                )}
            </aside>

            {/* 상담 순서대로 정보 입력. 본문 폭이 넓으면(720px+) 단계 카드를 두 줄로 (index.css .lm-info-sections) */}
            <div className="lm-info-main min-w-0 xl:order-1 space-y-3">
                {/* 필수 확인 항목 진행률 + 단계 바로가기 */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-[180px] flex-1">
                            <div className="flex items-baseline justify-between text-xs">
                                <span className="font-semibold text-slate-700 dark:text-gray-200">{partner ? `${partner.name} 필수 확인` : '필수 확인'} {progress.done}/{progress.total}</span>
                                <span className="text-slate-400 tabular-nums">{pct}%</span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-gray-700 overflow-hidden">
                                <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                        <nav className="flex flex-wrap gap-1.5" aria-label="상담 단계">
                            {STEPS.map((s, i) => {
                                const st = stepState(s.keys);
                                const done = st.total > 0 && st.missing === 0;
                                return (
                                    <button key={s.id} type="button" onClick={() => scrollToStep(s.id)}
                                        className={`px-2.5 py-1 rounded-full text-xs border flex items-center gap-1 ${done ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300' : 'border-slate-200 dark:border-gray-600 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700'}`}>
                                        <span className="tabular-nums text-slate-400">{i + 1}</span> {s.label}
                                        {st.missing > 0 && <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-800">{st.missing}</span>}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                    {progress.missing.length > 0 && (
                        <p className="mt-2 text-xs text-slate-500">아직 확인 안 한 항목: <span className="text-amber-800 dark:text-amber-300">{progress.missing.join(' · ')}</span></p>
                    )}
                </div>

                {/* 화면에 놓이는 순서는 상담 순서 그대로. 넓을 때: [1 접수][2 직업] / [3 주거][4 채무] / [5 이력][4 채무] */}
                <div className="lm-info-sections">
                    <section id="step-personal" data-area="personal" className="scroll-mt-28 min-w-0">
                        <CaseDetailPersonalInfo c={c} partners={partners} inboundPaths={inboundPaths} onUpdate={onUpdate} />
                    </section>
                    <section id="step-job" data-area="job" className="scroll-mt-28 min-w-0">
                        <CaseDetailJobFamily c={c} onUpdate={onUpdate} onIncomeChange={onIncomeChange} onJobTypeChange={onJobTypeChange} />
                    </section>
                    <section id="step-housing" data-area="housing" className="scroll-mt-28 min-w-0">
                        <CaseDetailHousing c={c} onUpdate={onUpdate} />
                    </section>
                    <section id="step-debt" data-area="debt" className="scroll-mt-28 min-w-0">
                        <CaseDetailAssets c={c} onUpdate={onUpdate} showToast={showToast} />
                    </section>
                    <section id="step-history" data-area="history" className="scroll-mt-28 min-w-0">
                        <CaseDetailHistory c={c} onUpdate={onUpdate} statusLogs={statusLogs} />
                    </section>
                </div>
            </div>
        </div>
    );
};
