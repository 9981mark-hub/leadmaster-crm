import React, { useRef } from 'react';
import { Archive, Edit2, Mic, PlayCircle, Send, Sparkles, Trash2, X } from 'lucide-react';
import { Case, RecordingItem } from '../../../types';
import { CustomAudioPlayer } from '../../CustomAudioPlayer'; // Assuming this is in components/case-detail, OR check path. If CustomAudioPlayer is in components root, then ../../Callback... wait. 
// CustomAudioPlayer seems to be in reusable components. If in components root: ../../../components/CustomAudioPlayer or ../../CustomAudioPlayer if subfolder is sibling?
// From components/case-detail/info: 
// ../.. -> components. 
// So ../../CustomAudioPlayer is correct IF CustomAudioPlayer is in components/
import { convertToPlayableUrl, injectSummaryMetadata } from '../../../utils';
import { format } from 'date-fns';

interface CaseDetailAiSummaryProps {
    c: Case;
    aiSummaryText: string | null;
    setAiSummaryText: (text: string) => void;
    aiSummaryEditMode: boolean;
    setAiSummaryEditMode: (mode: boolean) => void;
    handleUpdateAiSummaryText: () => void;
    handleDeleteAiSummary: () => void;
    handleSaveSummaryToMemo: () => void;
    // Audio Props
    currentAudioFile: File | null;
    audioUrl: string | null;
    isFileUploading: boolean;
    isAiLoading: boolean;
    onAudioFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onTriggerAudioInput: () => void;
    onGenerateAiSummary: () => void;
    onPlayRecording: (rec: RecordingItem) => void;
    onDeleteRecording: (id: string) => void;
}

export const CaseDetailAiSummary: React.FC<CaseDetailAiSummaryProps> = ({
    c,
    aiSummaryText,
    setAiSummaryText,
    aiSummaryEditMode,
    setAiSummaryEditMode,
    handleUpdateAiSummaryText,
    handleDeleteAiSummary,
    handleSaveSummaryToMemo,
    currentAudioFile,
    audioUrl,
    isFileUploading,
    isAiLoading,
    onAudioFileSelect,
    onTriggerAudioInput,
    onGenerateAiSummary,
    onPlayRecording,
    onDeleteRecording
}) => {
    const audioInputRef = useRef<HTMLInputElement>(null);

    // Helper to trigger the hidden input from the parent's ref concept
    // In this separated component, we can just use a local ref and the passed handler
    const triggerInput = () => {
        audioInputRef.current?.click();
    };

    return (
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-purple-800 flex items-center gap-2">
                    <Sparkles size={18} className="flex-shrink-0" />
                    <div className="flex flex-col leading-none">
                        <span>AI 상담 요약</span>
                        <span>& 녹음</span>
                    </div>
                </h3>

                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={audioInputRef}
                        className="hidden"
                        accept="audio/*"
                        onChange={onAudioFileSelect}
                    />
                    <button
                        onClick={triggerInput}
                        disabled={isFileUploading}
                        className={"flex items-center gap-1 text-xs px-2 py-1.5 rounded border " + (currentAudioFile ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-gray-600 border-gray-300') + (isFileUploading ? ' opacity-50 cursor-not-allowed' : '')}
                    >
                        <Mic size={14} className="flex-shrink-0" />
                        <span className="text-center leading-tight">
                            {isFileUploading ? '업로드중...' : (currentAudioFile ? '파일 변경' : <>녹음파일<br />업로드</>)}
                        </span>
                    </button>

                    <button
                        onClick={onGenerateAiSummary}
                        disabled={isAiLoading}
                        className="flex items-center gap-1 text-xs bg-purple-600 text-white px-3 py-1.5 rounded font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {isAiLoading ? '분석 중...' : <span className="text-center leading-tight">요약<br />실행</span>}
                    </button>
                </div>
            </div>

            {/* Audio Player for Current or Selected */}
            <div className="mb-4">
                {(audioUrl || currentAudioFile) && (
                    <CustomAudioPlayer
                        src={audioUrl && audioUrl.includes('drive.google.com') ? convertToPlayableUrl(audioUrl) : (audioUrl || '')}
                        fileName={currentAudioFile ? currentAudioFile.name : `녹음 파일 (ID: ${c.recordings?.find(r => r.url === audioUrl)?.id.substring(0, 8)}...)`}
                    />
                )}
            </div>

            {/* Recording List (Archive) */}
            {(c.recordings && c.recordings.length > 0) && (
                <div className="mb-4">
                    <h4 className="text-xs font-bold text-gray-600 mb-2 flex items-center"><Archive size={12} className="mr-1" /> 녹음 아카이브</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto no-scrollbar">
                        {c.recordings.map(rec => (
                            <div key={rec.id} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200 text-xs">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <PlayCircle
                                        size={16}
                                        className="text-blue-500 cursor-pointer flex-shrink-0"
                                        onClick={() => onPlayRecording(rec)}
                                    />
                                    <div className="truncate">
                                        <span className="font-medium">{rec.filename}</span>
                                        <span className="text-gray-400 text-[10px] ml-1">{format(new Date(rec.uploadDate), 'yy.MM.dd HH:mm')}</span>
                                    </div>
                                </div>
                                <button onClick={() => onDeleteRecording(rec.id)} className="text-gray-400 hover:text-red-500">
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm relative min-h-[80px]">
                {aiSummaryEditMode ? (
                    <div className="space-y-2">
                        <textarea
                            className="w-full h-32 p-2 text-sm border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                            value={aiSummaryText || ''}
                            onChange={e => setAiSummaryText(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={handleUpdateAiSummaryText} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">저장</button>
                            <button onClick={() => setAiSummaryEditMode(false)} className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300">취소</button>
                        </div>
                    </div>
                ) : (
                    <div className="group">
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setAiSummaryEditMode(true)} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="수정">
                                <Edit2 size={14} />
                            </button>
                            <button onClick={handleDeleteAiSummary} className="p-1 text-red-500 hover:bg-red-50 rounded" title="삭제">
                                <Trash2 size={14} />
                            </button>
                        </div>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed pr-10">
                            {aiSummaryText || <span className="text-gray-400">요약된 상담 내용이 없습니다. 통화 파일을 업로드하거나 기존 상담 내역을 바탕으로 요약을 실행해보세요.</span>}
                        </div>
                    </div>
                )}
            </div>

            {aiSummaryText && !aiSummaryEditMode && (
                <div className="mt-3 flex justify-end">
                    <button
                        onClick={handleSaveSummaryToMemo}
                        className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded font-bold hover:bg-indigo-100 border border-indigo-200 transition-colors"
                    >
                        <Send size={14} /> 상담 내용으로 보내기 (특이사항 추가)
                    </button>
                </div>
            )}
        </div>
    );
};
