import React, { useRef, useState, useMemo } from 'react';
import { Archive, Edit2, Mic, PlayCircle, Send, Sparkles, Trash2, X, MessageCircle, FileText, ListOrdered, Copy, Check } from 'lucide-react';
import { Case, RecordingItem } from '../../../types';
import { CustomAudioPlayer, CustomAudioPlayerRef } from '../../CustomAudioPlayer';
import { convertToPlayableUrl, safeFormat, loadTelegramRooms, parseAiTranscript } from '../../../utils';
import { useToast } from '../../../contexts/ToastContext';

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
    const { showToast } = useToast();
    const [telegramRooms] = useState(() => loadTelegramRooms());
    const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState<'summary' | 'transcript'>('summary');
    const [transcriptSearch, setTranscriptSearch] = useState('');
    const [copiedTranscript, setCopiedTranscript] = useState(false);

    const playerRef = useRef<CustomAudioPlayerRef>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    // Parse summary text and transcript lines
    const { summaryText, transcriptLines, rawTranscript } = useMemo(() => {
        return parseAiTranscript(aiSummaryText);
    }, [aiSummaryText]);

    const filteredTranscriptLines = useMemo(() => {
        if (!transcriptSearch.trim()) return transcriptLines;
        const q = transcriptSearch.toLowerCase();
        return transcriptLines.filter(line => 
            line.text.toLowerCase().includes(q) || 
            line.speaker.toLowerCase().includes(q) || 
            line.time.includes(q)
        );
    }, [transcriptLines, transcriptSearch]);

    // Determine active audio URL: passed audioUrl or latest recording in archive
    const activeAudioUrl = useMemo(() => {
        if (currentAudioFile) return '';
        if (audioUrl) return audioUrl;
        if (c.recordings && c.recordings.length > 0) return c.recordings[0].url;
        return null;
    }, [audioUrl, currentAudioFile, c.recordings]);

    const activeFileName = useMemo(() => {
        if (currentAudioFile) return currentAudioFile.name;
        if (audioUrl) {
            const found = c.recordings?.find(r => r.url === audioUrl);
            if (found) return found.filename;
        }
        if (c.recordings && c.recordings.length > 0) {
            return c.recordings[0].filename;
        }
        return '녹음 파일';
    }, [audioUrl, currentAudioFile, c.recordings]);

    const handleSeekToTimestamp = (seconds: number) => {
        if (playerRef.current) {
            playerRef.current.seekTo(seconds);
            showToast(`⏱️ ${Math.floor(seconds / 60)}분 ${seconds % 60}초 구간으로 이동합니다.`);
        } else if (activeAudioUrl || (c.recordings && c.recordings.length > 0)) {
            const recToPlay = c.recordings?.find(r => r.url === activeAudioUrl) || c.recordings?.[0];
            if (recToPlay) onPlayRecording(recToPlay);
            setTimeout(() => {
                if (playerRef.current) {
                    playerRef.current.seekTo(seconds);
                    showToast(`⏱️ ${Math.floor(seconds / 60)}분 ${seconds % 60}초 구간으로 이동합니다.`);
                }
            }, 300);
        } else {
            showToast('재생할 녹음 파일이 없습니다.', 'error');
        }
    };

    const handleCopyTranscript = () => {
        if (!rawTranscript && transcriptLines.length === 0) return;
        const contentToCopy = rawTranscript || transcriptLines.map(l => `[${l.time}] ${l.speaker}: ${l.text}`).join('\n');
        navigator.clipboard.writeText(contentToCopy).then(() => {
            setCopiedTranscript(true);
            showToast('전체 대화록이 클립보드에 복사되었습니다.');
            setTimeout(() => setCopiedTranscript(false), 2000);
        }).catch(() => {
            showToast('복사에 실패했습니다.', 'error');
        });
    };

    const handleTelegramSendClick = () => {
        if (!aiSummaryText) return;

        if (telegramRooms.length === 0) {
            showToast('설정 페이지에서 텔레그램 방을 먼저 등록해 주세요.', 'error');
            return;
        }

        // Copy summary to clipboard
        const textToCopy = summaryText || aiSummaryText;
        navigator.clipboard.writeText(textToCopy).then(() => {
            if (telegramRooms.length === 1) {
                window.open(telegramRooms[0].url, '_blank');
                showToast('텔레그램 방이 열렸습니다. 붙여넣기(Paste)로 전송해 주세요.');
            } else {
                setIsTelegramModalOpen(true);
            }
        }).catch(err => {
            console.error('Clipboard copy failed:', err);
            showToast('클립보드 복사에 실패했습니다.', 'error');
        });
    };

    const handleRoomSelect = (url: string) => {
        window.open(url, '_blank');
        setIsTelegramModalOpen(false);
        showToast('텔레그램 방이 열렸습니다. 붙여넣기(Paste)로 전송해 주세요.');
    };

    const triggerInput = () => {
        audioInputRef.current?.click();
    };

    return (
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
            <div className="flex justify-between items-center mb-3 gap-2">
                <h3 className="font-bold text-purple-800 flex items-center gap-1.5 text-sm md:text-base whitespace-nowrap">
                    <Sparkles size={16} className="flex-shrink-0 text-purple-600" />
                    <span>AI 상담 요약</span>
                </h3>

                <div className="flex items-center gap-1.5 flex-shrink-0">
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
                        className={"flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border whitespace-nowrap " + (currentAudioFile ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-gray-600 border-gray-300') + (isFileUploading ? ' opacity-50 cursor-not-allowed' : '')}
                    >
                        <Mic size={13} className="flex-shrink-0" />
                        <span>{isFileUploading ? '업로드중' : (currentAudioFile ? '파일 변경' : '녹음 업로드')}</span>
                    </button>

                    <button
                        onClick={onGenerateAiSummary}
                        disabled={isAiLoading}
                        className="flex items-center gap-1 text-xs bg-purple-600 text-white px-3 py-1.5 rounded font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
                    >
                        {isAiLoading ? '분석 중...' : 'AI 분석'}
                    </button>
                </div>
            </div>

            {/* Audio Player for Current or Selected with Ref seeking */}
            {(activeAudioUrl || currentAudioFile) && (
                <div className="mb-4">
                    <CustomAudioPlayer
                        ref={playerRef}
                        src={activeAudioUrl && activeAudioUrl.includes('drive.google.com') ? convertToPlayableUrl(activeAudioUrl) : (activeAudioUrl || '')}
                        fileName={activeFileName}
                    />
                </div>
            )}

            {/* Recording List (Archive) */}
            {(c.recordings && c.recordings.length > 0) && (
                <div className="mb-4">
                    <h4 className="text-xs font-bold text-gray-600 mb-2 flex items-center"><Archive size={12} className="mr-1" /> 녹음 아카이브</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto no-scrollbar">
                        {c.recordings.map(rec => {
                            const isSelected = rec.url === activeAudioUrl;
                            return (
                                <div
                                    key={rec.id}
                                    className={`flex justify-between items-center p-2 rounded border text-xs transition-colors ${
                                        isSelected ? 'bg-purple-100/70 border-purple-300 font-bold' : 'bg-white border-gray-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 overflow-hidden cursor-pointer flex-1" onClick={() => onPlayRecording(rec)}>
                                        <PlayCircle
                                            size={16}
                                            className={isSelected ? "text-purple-600 flex-shrink-0" : "text-blue-500 flex-shrink-0"}
                                        />
                                        <div className="truncate">
                                            <span className={isSelected ? "text-purple-900" : "font-medium text-gray-800"}>{rec.filename}</span>
                                            <span className="text-gray-400 text-[10px] ml-1">{safeFormat(rec.uploadDate, 'yy.MM.dd HH:mm')}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => onDeleteRecording(rec.id)} className="text-gray-400 hover:text-red-500 ml-2">
                                        <X size={14} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Sub Tabs: Summary vs Transcript */}
            <div className="flex items-center justify-between border-b border-purple-200 mb-2 gap-1">
                <div className="flex gap-1.5">
                    <button
                        onClick={() => setActiveSubTab('summary')}
                        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold whitespace-nowrap rounded-t-lg transition-colors ${
                            activeSubTab === 'summary'
                                ? 'bg-white text-purple-700 border-t border-l border-r border-purple-200 shadow-sm'
                                : 'text-gray-500 hover:text-purple-600'
                        }`}
                    >
                        <FileText size={13} /> 요약문
                    </button>
                    <button
                        onClick={() => setActiveSubTab('transcript')}
                        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold whitespace-nowrap rounded-t-lg transition-colors ${
                            activeSubTab === 'transcript'
                                ? 'bg-white text-purple-700 border-t border-l border-r border-purple-200 shadow-sm'
                                : 'text-gray-500 hover:text-purple-600'
                        }`}
                    >
                        <ListOrdered size={13} /> 대화록
                        {transcriptLines.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded-full text-[10px]">
                                {transcriptLines.length}
                            </span>
                        )}
                    </button>
                </div>

                {activeSubTab === 'transcript' && transcriptLines.length > 0 && (
                    <button
                        onClick={handleCopyTranscript}
                        className="flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-800 px-2 py-1 rounded hover:bg-purple-100 transition-colors whitespace-nowrap shrink-0"
                        title="전체 대화록 복사"
                    >
                        {copiedTranscript ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                        <span>{copiedTranscript ? '복사됨' : '복사'}</span>
                    </button>
                )}
            </div>

            {/* Tab 1: AI Summary Text */}
            {activeSubTab === 'summary' && (
                <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm relative min-h-[80px]">
                    {aiSummaryEditMode ? (
                        <div className="space-y-2">
                            <textarea
                                className="w-full h-36 p-2 text-sm border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 font-sans"
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
                                {summaryText || <span className="text-gray-400">요약된 상담 내용이 없습니다. 통화 파일을 업로드하고 [AI 분석 실행]을 클릭해보세요.</span>}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tab 2: Full Transcript with Speakers & Timestamps */}
            {activeSubTab === 'transcript' && (
                <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm min-h-[120px]">
                    {transcriptLines.length > 0 ? (
                        <div className="space-y-2.5">
                            {transcriptLines.length > 5 && (
                                <div className="mb-2">
                                    <input
                                        type="text"
                                        placeholder="대화 내용 또는 화자 검색..."
                                        value={transcriptSearch}
                                        onChange={e => setTranscriptSearch(e.target.value)}
                                        className="w-full text-xs p-2 border border-gray-200 rounded focus:ring-1 focus:ring-purple-400 outline-none"
                                    />
                                </div>
                            )}
                            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                                {filteredTranscriptLines.map(line => {
                                    const isAgent = line.speaker.includes('상담원') || line.speaker.includes('담당자') || line.speaker.includes('진성훈') || line.speaker.includes('사무장');
                                    return (
                                        <div
                                            key={line.id}
                                            className={`p-2.5 rounded-lg border text-xs leading-relaxed transition-all ${
                                                isAgent 
                                                    ? 'bg-blue-50 border-blue-100 text-blue-950' 
                                                    : 'bg-purple-50/60 border-purple-100 text-gray-900'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-1.5 font-bold">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                        isAgent ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
                                                    }`}>
                                                        {isAgent ? '👤 상담원' : '🧑 고객'}
                                                    </span>
                                                    {line.speaker !== '상담원' && line.speaker !== '고객' && (
                                                        <span className="text-gray-500 font-normal text-[11px]">({line.speaker})</span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleSeekToTimestamp(line.seconds)}
                                                    className="flex items-center gap-1 px-1.5 py-0.5 bg-white border border-purple-200 hover:border-purple-400 text-purple-700 hover:bg-purple-50 rounded text-[10px] font-mono transition-colors shadow-2xs cursor-pointer"
                                                    title="이 발언 시점으로 이동 재생"
                                                >
                                                    <PlayCircle size={11} className="text-purple-600" />
                                                    <span>{line.time}</span>
                                                </button>
                                            </div>
                                            <div className="pl-1 text-gray-800 whitespace-pre-wrap">
                                                {line.text}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-6 text-gray-400 text-xs">
                            {rawTranscript ? (
                                <div className="text-left text-gray-700 whitespace-pre-wrap text-xs">
                                    {rawTranscript}
                                </div>
                            ) : (
                                <div>
                                    <p className="mb-1">분석된 대화록이 없습니다.</p>
                                    <p className="text-[11px] text-gray-400">통화 녹음 파일을 업로드하고 [AI 분석 실행]을 누르면 화자분리 대화록이 자동 생성됩니다.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Action Buttons */}
            {aiSummaryText && !aiSummaryEditMode && (
                <div className="mt-3 flex justify-end">
                    <button
                        onClick={handleSaveSummaryToMemo}
                        className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded font-bold hover:bg-indigo-100 border border-indigo-200 transition-colors"
                    >
                        <Send size={14} /> 상담 내용으로 보내기 (특이사항 추가)
                    </button>
                    <button
                        onClick={handleTelegramSendClick}
                        className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-3 py-2 rounded font-bold hover:bg-indigo-700 transition-colors ml-2 shadow-sm"
                    >
                        <MessageCircle size={14} /> 텔레그램 전송
                    </button>
                </div>
            )}

            {/* Telegram Room Selection Modal */}
            {isTelegramModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-80 overflow-hidden transform scale-100 transition-transform">
                        <div className="bg-indigo-600 p-4 shrink-0 flex justify-between items-center text-white">
                            <h3 className="font-bold flex items-center gap-2">
                                <MessageCircle size={18} /> 전송할 방 선택
                            </h3>
                            <button onClick={() => setIsTelegramModalOpen(false)} className="text-indigo-200 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-4 space-y-2">
                            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                                요약문이 클립보드에 자동 복사되었습니다.<br/>
                                전송할 방을 선택하시고 화면이 열리면 붙여넣기 해 주세요.
                            </p>
                            <div className="max-h-60 overflow-y-auto space-y-2 no-scrollbar">
                                {telegramRooms.map(room => (
                                    <button
                                        key={room.id}
                                        onClick={() => handleRoomSelect(room.url)}
                                        className="w-full text-left p-3 border border-indigo-100 flex items-center justify-between rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors group"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm text-indigo-900 group-hover:text-indigo-700">{room.name}</span>
                                            <span className="text-[10px] text-indigo-400 mt-0.5 truncate max-w-[200px]">{room.url}</span>
                                        </div>
                                        <Send size={14} className="text-indigo-400 group-hover:text-indigo-600" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
