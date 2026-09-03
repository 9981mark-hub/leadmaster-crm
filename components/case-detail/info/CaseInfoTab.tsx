import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Case, CaseStatusLog, Partner, MemoItem, ReminderItem, RecordingItem } from '../../../types';
import { CaseDetailReminders } from './CaseDetailReminders';
import { CaseDetailAiSummary } from './CaseDetailAiSummary';
import { CaseDetailPersonalInfo } from './CaseDetailPersonalInfo';
import { CaseDetailJobFamily } from './CaseDetailJobFamily';
import { CaseDetailHousing } from './CaseDetailHousing';
import { CaseDetailAssets } from './CaseDetailAssets';
import { CaseDetailHistory } from './CaseDetailHistory';

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

export const CaseInfoTab: React.FC<CaseInfoTabProps> = ({
    c, partners, inboundPaths, onUpdate, onIncomeChange, onJobTypeChange,
    reminders, memos, onUpdateReminders, onUpdateMemos,
    aiSummaryText, setAiSummaryText, aiSummaryEditMode, setAiSummaryEditMode,
    handleUpdateAiSummaryText, handleDeleteAiSummary, handleSaveSummaryToMemo,
    currentAudioFile, audioUrl, isFileUploading, isAiLoading,
    onAudioFileSelect, onTriggerAudioInput, onGenerateAiSummary, onPlayRecording, onDeleteRecording,
    statusLogs, showToast
}) => {
    // Sub-tab for Right Work Dock: 'reminders' vs 'ai'
    const [rightPanelTab, setRightPanelTab] = useState<'reminders' | 'ai'>('reminders');

    return (
        <>
            {/* 1. Mobile View (100% Exact Preservation) */}
            <div className="md:hidden space-y-8">
                <CaseDetailReminders
                    reminders={reminders}
                    memos={memos}
                    onUpdateReminders={onUpdateReminders}
                    onUpdateMemos={onUpdateMemos}
                    showToast={showToast}
                />

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

                <div className="grid md:grid-cols-2 gap-8">
                    <CaseDetailPersonalInfo
                        c={c}
                        partners={partners}
                        inboundPaths={inboundPaths}
                        onUpdate={onUpdate}
                        statusLogs={statusLogs}
                    />

                    <CaseDetailJobFamily
                        c={c}
                        onUpdate={onUpdate}
                        onIncomeChange={onIncomeChange}
                        onJobTypeChange={onJobTypeChange}
                        statusLogs={statusLogs}
                    />
                </div>

                <hr className="border-gray-100" />

                <div className="grid md:grid-cols-2 gap-8">
                    <CaseDetailHousing
                        c={c}
                        onUpdate={onUpdate}
                    />

                    <CaseDetailAssets
                        c={c}
                        onUpdate={onUpdate}
                        showToast={showToast}
                    />
                </div>

                <CaseDetailHistory
                    c={c}
                    onUpdate={onUpdate}
                    statusLogs={statusLogs}
                />
            </div>

            {/* 2. PC Desktop View (Dual Workspace: Pure Form Hub vs Action & Intelligence Dock) */}
            <div className="hidden md:grid grid-cols-12 gap-5 items-start">
                
                {/* ============================================================ */}
                {/* [영역 1] 순수 고객 입력 정보 전용 허브 (Col 1~8 / 12, 약 67%) */}
                {/* AI 요약이나 리마인더가 일절 들어오지 않는 100% 순수 입력 폼 */}
                {/* ============================================================ */}
                <div className="col-span-12 xl:col-span-8 bg-slate-50/60 dark:bg-gray-850/60 rounded-2xl border border-slate-200 dark:border-gray-700/80 p-4 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                            <h3 className="font-bold text-slate-900 dark:text-gray-100 text-sm md:text-base">
                                고객 상황 및 채무 입력 정보 (CRM 폼)
                            </h3>
                            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">직접 수정 가능</span>
                        </div>
                        <span className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-800">
                            ✓ 실시간 자동 저장
                        </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                        {/* 좌측 폼 열: 1. 기본 인적사항, 2. 직업/소득/가족, 3. 주거 형태 */}
                        <div className="space-y-4">
                            <CaseDetailPersonalInfo
                                c={c}
                                partners={partners}
                                inboundPaths={inboundPaths}
                                onUpdate={onUpdate}
                            />

                            <CaseDetailJobFamily
                                c={c}
                                onUpdate={onUpdate}
                                onIncomeChange={onIncomeChange}
                                onJobTypeChange={onJobTypeChange}
                            />

                            <CaseDetailHousing
                                c={c}
                                onUpdate={onUpdate}
                            />
                        </div>

                        {/* 우측 폼 열: 4. 채무 및 자산 관리, 5. 과거 회생/파산 이력 & 상태 변경 타임라인 */}
                        <div className="space-y-4">
                            <CaseDetailAssets
                                c={c}
                                onUpdate={onUpdate}
                                showToast={showToast}
                            />

                            <CaseDetailHistory
                                c={c}
                                onUpdate={onUpdate}
                                statusLogs={statusLogs}
                            />
                        </div>
                    </div>
                </div>

                {/* ============================================================ */}
                {/* [영역 2 & 3] 업무 액션 & AI 인텔리전스 독 (Col 9~12 / 12, 약 33%, Sticky) */}
                {/* 상단 탭 스위처로 [리마인더 & 이력]과 [AI 요약]을 완벽하게 분리 */}
                {/* ============================================================ */}
                <div className="col-span-12 xl:col-span-4 space-y-3 xl:sticky xl:top-20">
                    
                    {/* 상단 서브 탭 스위처 */}
                    <div className="bg-white dark:bg-gray-800 p-1 rounded-xl flex gap-1 border border-slate-200 dark:border-gray-700 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setRightPanelTab('reminders')}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                rightPanelTab === 'reminders'
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-gray-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            <span>📅 리마인더 &amp; 상담 이력</span>
                            {reminders.length > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${rightPanelTab === 'reminders' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                    {reminders.length}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setRightPanelTab('ai')}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                rightPanelTab === 'ai'
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-gray-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            <Sparkles size={13} className={rightPanelTab === 'ai' ? 'text-white' : 'text-purple-500'} />
                            <span>AI 통화 요약 &amp; 녹취</span>
                        </button>
                    </div>

                    {/* 탭 1: 리마인더 및 상담 이력 */}
                    {rightPanelTab === 'reminders' && (
                        <div className="animate-in fade-in duration-150">
                            <CaseDetailReminders
                                reminders={reminders}
                                memos={memos}
                                onUpdateReminders={onUpdateReminders}
                                onUpdateMemos={onUpdateMemos}
                                showToast={showToast}
                                isStacked={true}
                            />
                        </div>
                    )}

                    {/* 탭 2: AI 통화 요약 및 녹취 센터 */}
                    {rightPanelTab === 'ai' && (
                        <div className="animate-in fade-in duration-150">
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
                        </div>
                    )}

                </div>
            </div>
        </>
    );
};
