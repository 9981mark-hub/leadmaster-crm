import React from 'react';
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
                />
            </div>

            {/* 2. PC Desktop View (3-Column Cockpit Layout: Zero-Scroll & High Density) */}
            <div className="hidden md:grid grid-cols-12 gap-5 items-start">
                {/* COLUMN 1: 인적사항 & 직업/소득 & 주거 (4 / 12) */}
                <div className="col-span-12 xl:col-span-4 space-y-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                        <CaseDetailPersonalInfo
                            c={c}
                            partners={partners}
                            inboundPaths={inboundPaths}
                            onUpdate={onUpdate}
                            statusLogs={statusLogs}
                        />
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                        <CaseDetailJobFamily
                            c={c}
                            onUpdate={onUpdate}
                            onIncomeChange={onIncomeChange}
                            onJobTypeChange={onJobTypeChange}
                            statusLogs={statusLogs}
                        />
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                        <CaseDetailHousing
                            c={c}
                            onUpdate={onUpdate}
                        />
                    </div>
                </div>

                {/* COLUMN 2: 자산/부채 & AI 상담 요약 (4 / 12) */}
                <div className="col-span-12 xl:col-span-4 space-y-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                        <CaseDetailAssets
                            c={c}
                            onUpdate={onUpdate}
                            showToast={showToast}
                        />
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                        <CaseDetailHistory
                            c={c}
                            onUpdate={onUpdate}
                        />
                    </div>

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

                {/* COLUMN 3: 리마인더 일정 & 상담 특이사항/이력 (4 / 12, Sticky) */}
                <div className="col-span-12 xl:col-span-4 space-y-4 xl:sticky xl:top-20">
                    <CaseDetailReminders
                        reminders={reminders}
                        memos={memos}
                        onUpdateReminders={onUpdateReminders}
                        onUpdateMemos={onUpdateMemos}
                        showToast={showToast}
                        isStacked={true}
                    />
                </div>
            </div>
        </>
    );
};
