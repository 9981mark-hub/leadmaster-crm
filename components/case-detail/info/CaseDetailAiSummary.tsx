import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Archive, Edit2, Mic, PlayCircle, Send, Sparkles, Trash2, X, MessageCircle, FileText, ListOrdered, Copy, Check } from 'lucide-react';
import { Case, RecordingItem } from '../../../types';
import SmartAudioPlayer, { SmartAudioPlayerRef } from '../SmartAudioPlayer';
import { convertToPlayableUrl, safeFormat, loadTelegramRooms, parseAiTranscript } from '../../../utils';
import { getLegacyDrivePlayUrl } from '../../../services/recordings';
import { FillFromSummaryButton } from '../FillFromSummaryButton';
import { AppRecordingsList } from './AppRecordingsList';
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
    /** 통화 녹음·AI 탭으로 이동 */
    onOpenRecordingsTab?: () => void;
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
    onDeleteRecording,
    onOpenRecordingsTab
}) => {
    const { showToast } = useToast();
    const [telegramRooms] = useState(() => loadTelegramRooms());
    const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState<'summary' | 'transcript'>('summary');
    const [transcriptSearch, setTranscriptSearch] = useState('');
    const [copiedTranscript, setCopiedTranscript] = useState(false);

    const playerRef = useRef<SmartAudioPlayerRef>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    // [2026-11-02] 통화별 요약: 최근 요약(aiSummaryText) 말고 지난 통화 요약을 볼 수 있다 (보기만)
    const [viewingId, setViewingId] = useState<string | null>(null);
    const history = useMemo(() => {
        const recs = (c.recordings || []).filter(r => r.aiCurrent || (r.aiSummary && r.aiSummary.trim()));
        return recs
            // 앱 녹음(fromApp)은 통화 시각, 직접 올린 녹음은 요약한 시각
            .map(r => ({ id: r.id, at: (r.fromApp ? r.uploadDate : r.analyzedAt) || r.uploadDate, current: !!r.aiCurrent, text: r.aiSummary || '' }))
            .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    }, [c.recordings]);
    const viewing = viewingId ? history.find(h => h.id === viewingId && !h.current) : undefined;
    const displayedText = viewing ? viewing.text : aiSummaryText;
    const viewingLabel = viewing ? `${safeFormat(viewing.at, 'MM/dd HH:mm')} 통화 AI 요약` : (history.find(h => h.current) ? `${safeFormat(history.find(h => h.current)!.at, 'MM/dd HH:mm')} 통화 AI 요약` : 'AI 요약');
    // 녹음 아카이브 목록 = 직접 올린 녹음만 (fromApp 항목은 통화별 요약 보관용, 앱 녹음은 위 목록에 따로)
    const archive = useMemo(() => (c.recordings || []).filter(r => !r.fromApp), [c.recordings]);

    // Parse summary text and transcript lines
    const { summaryText, transcriptLines, rawTranscript } = useMemo(() => {
        return parseAiTranscript(displayedText);
    }, [displayedText]);

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
        if (archive.length > 0) return archive[0].url;
        return null;
    }, [audioUrl, currentAudioFile, archive]);

    // 드라이브 링크는 서버(recording-play)를 거친 비공개 듣기 주소로 바꾼다.
    // 아직 리드마스터에 허용되지 않은 파일·드라이브 미연결이면 예전 공개 링크로 재생 (공개 링크를 끄기 전까지)
    const [playSrc, setPlaySrc] = useState<string>('');
    useEffect(() => {
        let cancelled = false;
        const u = activeAudioUrl || '';
        if (!u.includes('drive.google.com')) { setPlaySrc(u); return; }
        setPlaySrc('');
        getLegacyDrivePlayUrl(c.caseId, u)
            .then(s => { if (!cancelled) setPlaySrc(s); })
            .catch(() => { if (!cancelled) setPlaySrc(convertToPlayableUrl(u)); });
        return () => { cancelled = true; };
    }, [activeAudioUrl, c.caseId]);
    // 예전(1~4월)에 저장된 blob: 주소 = 그때 브라우저 안에서만 쓰던 임시 주소 → 지금은 열 수 없음
    const isTempBlob = !currentAudioFile && !!activeAudioUrl && activeAudioUrl.startsWith('blob:') && !!c.recordings?.some(r => r.url === activeAudioUrl);

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
        <div className="bg-card text-card-foreground p-4 sm:p-5 rounded-2xl border border-border shadow-xs space-y-4">
            <div className="flex justify-between items-center gap-2">
                <h3 className="font-bold text-foreground flex items-center gap-2 text-sm sm:text-base whitespace-nowrap">
                    <Sparkles size={16} className="shrink-0 text-primary" strokeWidth={2} />
                    <span>AI 상담 요약</span>
                </h3>

                <div className="flex items-center gap-2 shrink-0">
                    <input
                        type="file"
                        ref={audioInputRef}
                        className="hidden"
                        accept="audio/*"
                        onChange={onAudioFileSelect}
                    />
                    <button
                        type="button"
                        onClick={triggerInput}
                        disabled={isFileUploading}
                        className={"flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap font-medium transition-colors shadow-2xs cursor-pointer " + 
                            (currentAudioFile ? 'bg-primary/10 text-primary border-primary/30 font-bold' : 'bg-muted hover:bg-muted/80 text-foreground border-border') + 
                            (isFileUploading ? ' opacity-50 cursor-not-allowed' : '')
                        }
                    >
                        <Mic size={13} className="shrink-0" />
                        <span>{isFileUploading ? '업로드 중…' : (currentAudioFile ? '파일 변경' : '녹음 업로드')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={onGenerateAiSummary}
                        disabled={isAiLoading}
                        className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg font-bold hover:bg-primary/90 disabled:opacity-40 transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
                    >
                        {isAiLoading ? '분석 중…' : 'AI 분석'}
                    </button>
                </div>
            </div>

            {/* Audio Player for Current or Selected with Ref seeking */}
            {(activeAudioUrl || currentAudioFile) && (
                <div>
                    {isTempBlob ? (
                        <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-xl p-3">
                            이 녹음은 예전에 브라우저 임시 주소로만 저장되어 서버에 원본이 없습니다. 원본 파일이 있으면 다시 올려 주세요.
                        </div>
                    ) : (activeAudioUrl && activeAudioUrl.includes('drive.google.com') && !playSrc) ? (
                        <div className="text-xs text-muted-foreground p-3">녹음 스트리밍 준비 중…</div>
                    ) : (
                        <SmartAudioPlayer
                            ref={playerRef}
                            file={currentAudioFile}
                            src={playSrc || (activeAudioUrl || '')}
                            fileName={activeFileName}
                            caseId={c.caseId}
                            showToast={showToast}
                        />
                    )}
                </div>
            )}

            <AppRecordingsList c={c} onOpen={onOpenRecordingsTab} />

            {/* Recording List (Archive) */}
            {archive.length > 0 && (
                <div className="space-y-1.5">
                    <h4 className="text-2xs font-mono font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Archive size={12} className="text-primary" /> 
                        <span>녹음 아카이브</span>
                    </h4>
                    <div className="space-y-1 max-h-36 overflow-y-auto no-scrollbar">
                        {archive.map(rec => {
                            const isSelected = rec.url === activeAudioUrl;
                            return (
                                <div
                                    key={rec.id}
                                    className={`flex justify-between items-center p-2 rounded-xl border text-xs transition-colors ${
                                        isSelected 
                                            ? 'bg-primary/10 border-primary/30 font-bold text-primary shadow-2xs' 
                                            : 'bg-muted/30 border-border text-foreground hover:border-border/80'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 overflow-hidden cursor-pointer flex-1" onClick={() => onPlayRecording(rec)}>
                                        <PlayCircle
                                            size={15}
                                            className={isSelected ? "text-primary shrink-0" : "text-muted-foreground shrink-0"}
                                        />
                                        <div className="truncate flex items-center gap-1.5">
                                            <span className={isSelected ? "text-primary" : "text-foreground font-medium"}>{rec.filename}</span>
                                            <span className="text-2xs font-mono text-muted-foreground tabular-nums">{safeFormat(rec.uploadDate, 'yy.MM.dd HH:mm')}</span>
                                            {(rec.aiCurrent || rec.aiSummary) && (
                                                <span className="text-2xs px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 font-semibold">
                                                    요약{rec.aiCurrent ? ' 최근' : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onDeleteRecording(rec.id)}
                                        className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 통화별 AI 요약 (지난 통화 요약이 있을 때만) */}
            {history.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-2xs font-mono font-semibold text-muted-foreground">통화별 요약:</span>
                    {history.map(h => {
                        const active = h.current ? !viewing : viewing?.id === h.id;
                        return (
                            <button
                                key={h.id}
                                type="button"
                                onClick={() => setViewingId(h.current ? null : h.id)}
                                className={`px-2.5 py-0.5 rounded-full text-2xs font-mono transition-colors cursor-pointer ${
                                    active 
                                        ? 'bg-primary text-primary-foreground font-bold shadow-2xs' 
                                        : 'bg-muted text-muted-foreground border border-border hover:text-foreground'
                                }`}
                            >
                                {safeFormat(h.at, 'MM/dd HH:mm')}{h.current ? ' 최근' : ''}
                            </button>
                        );
                    })}
                    {viewing && <span className="text-2xs text-amber-500 font-semibold">지난 통화 요약 열람 중 (수정 불가)</span>}
                </div>
            )}

            {/* Sub Tabs: Summary vs Transcript */}
            <div className="flex items-center justify-between border-b border-border pb-2 gap-1">
                <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/60 text-xs">
                    <button
                        type="button"
                        onClick={() => setActiveSubTab('summary')}
                        className={`flex items-center gap-1.5 px-3 py-1 text-2xs font-bold rounded-md transition-colors cursor-pointer ${
                            activeSubTab === 'summary'
                                ? 'bg-primary text-primary-foreground shadow-2xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <FileText size={12} strokeWidth={2} />
                        <span>요약문</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSubTab('transcript')}
                        className={`flex items-center gap-1.5 px-3 py-1 text-2xs font-bold rounded-md transition-colors cursor-pointer ${
                            activeSubTab === 'transcript'
                                ? 'bg-primary text-primary-foreground shadow-2xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <ListOrdered size={12} strokeWidth={2} />
                        <span>대화록</span>
                        {transcriptLines.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.2 bg-black/20 text-white rounded-full text-2xs font-mono">
                                {transcriptLines.length}
                            </span>
                        )}
                    </button>
                </div>

                {activeSubTab === 'transcript' && transcriptLines.length > 0 && (
                    <button
                        type="button"
                        onClick={handleCopyTranscript}
                        className="flex items-center gap-1 text-2xs text-primary hover:text-primary/80 px-2.5 py-1 rounded-lg border border-primary/20 bg-primary/10 transition-colors cursor-pointer shrink-0"
                        title="전체 대화록 복사"
                    >
                        {copiedTranscript ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
                        <span>{copiedTranscript ? '복사됨' : '복사'}</span>
                    </button>
                )}
            </div>

            {/* Tab 1: AI Summary Text */}
            {activeSubTab === 'summary' && (
                <div className="bg-muted/20 p-3.5 rounded-xl border border-border shadow-2xs relative min-h-[90px]">
                    {aiSummaryEditMode ? (
                        <div className="space-y-2.5">
                            <textarea
                                className="w-full h-36 p-3 text-xs font-mono border border-input rounded-xl bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed resize-y"
                                value={aiSummaryText || ''}
                                onChange={e => setAiSummaryText(e.target.value)}
                            />
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={handleUpdateAiSummaryText} className="text-xs font-semibold bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg hover:bg-primary/90 shadow-2xs cursor-pointer">저장</button>
                                <button type="button" onClick={() => setAiSummaryEditMode(false)} className="text-xs bg-muted text-foreground border border-border px-3.5 py-1.5 rounded-lg hover:bg-muted/80 shadow-2xs cursor-pointer">취소</button>
                            </div>
                        </div>
                    ) : (
                        <div className="group">
                            <div className={`absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${viewing ? 'hidden' : ''}`}>
                                <button type="button" onClick={() => setAiSummaryEditMode(true)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer" title="수정">
                                    <Edit2 size={13} />
                                </button>
                                <button type="button" onClick={handleDeleteAiSummary} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer" title="삭제">
                                    <Trash2 size={13} />
                                </button>
                            </div>
                            <div className="text-xs text-foreground font-mono whitespace-pre-wrap leading-relaxed pr-10">
                                {summaryText || <span className="text-muted-foreground">요약된 상담 내용이 없습니다. 통화 파일을 업로드하고 [AI 분석 실행]을 클릭해보세요.</span>}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tab 2: Full Transcript with Speakers & Timestamps */}
            {activeSubTab === 'transcript' && (
                <div className="bg-muted/20 p-3.5 rounded-xl border border-border shadow-2xs min-h-[120px]">
                    {transcriptLines.length > 0 ? (
                        <div className="space-y-2.5">
                            {transcriptLines.length > 5 && (
                                <div className="mb-2">
                                    <input
                                        type="text"
                                        placeholder="대화 내용 또는 화자 검색..."
                                        value={transcriptSearch}
                                        onChange={e => setTranscriptSearch(e.target.value)}
                                        className="w-full text-xs p-2.5 border border-input rounded-lg bg-background text-foreground focus:ring-1 focus:ring-primary outline-none"
                                    />
                                </div>
                            )}
                            <div className="max-h-80 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                                {filteredTranscriptLines.map(line => {
                                    const myName = localStorage.getItem('managerName') || '';
                                    const isAgent = line.speaker.includes('상담원') || line.speaker.includes('담당자') || line.speaker.includes('사무장') || line.speaker.includes('진성훈') || (!!myName && line.speaker.includes(myName));
                                    return (
                                        <div
                                            key={line.id}
                                            className={`p-2.5 rounded-xl border text-xs leading-relaxed transition-all ${
                                                isAgent 
                                                    ? 'bg-primary/10 border-primary/20 text-foreground' 
                                                    : 'bg-muted/40 border-border text-foreground'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-1.5 font-bold">
                                                    <span className={`px-2 py-0.5 rounded text-2xs font-semibold ${
                                                        isAgent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border'
                                                    }`}>
                                                        {isAgent ? '👤 상담원' : '🧑 고객'}
                                                    </span>
                                                    {line.speaker !== '상담원' && line.speaker !== '고객' && (
                                                        <span className="text-muted-foreground font-normal text-2xs font-mono">({line.speaker})</span>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSeekToTimestamp(line.seconds)}
                                                    className="flex items-center gap-1 px-2 py-0.5 bg-card border border-border hover:border-primary/40 text-foreground hover:text-primary rounded text-2xs font-mono transition-colors shadow-2xs cursor-pointer"
                                                    title="이 발언 시점으로 이동 재생"
                                                >
                                                    <PlayCircle size={11} className="text-primary" />
                                                    <span>{line.time}</span>
                                                </button>
                                            </div>
                                            <div className="pl-1 text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                                                {line.text}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-6 text-muted-foreground text-xs space-y-1">
                            {rawTranscript ? (
                                <div className="text-left text-foreground whitespace-pre-wrap text-xs font-mono leading-relaxed">
                                    {rawTranscript}
                                </div>
                            ) : (
                                <div>
                                    <p className="font-semibold text-foreground">분석된 대화록이 없습니다.</p>
                                    <p className="text-2xs text-muted-foreground mt-0.5">통화 녹음 파일을 업로드하고 [AI 분석 실행]을 누르면 화자분리 대화록이 자동 생성됩니다.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Action Buttons (최근 요약을 볼 때만) */}
            {aiSummaryText && !aiSummaryEditMode && !viewing && (
                <div className="pt-2 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleSaveSummaryToMemo}
                        className="flex items-center gap-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground px-3.5 py-2 rounded-lg font-semibold border border-border transition-colors shadow-2xs cursor-pointer"
                    >
                        <Send size={13} className="text-primary" />
                        <span>상담 내용으로 보내기 (특이사항 추가)</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleTelegramSendClick}
                        className="flex items-center gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-bold transition-colors shadow-2xs cursor-pointer"
                    >
                        <MessageCircle size={13} />
                        <span>텔레그램 전송</span>
                    </button>
                </div>
            )}
            {displayedText && !aiSummaryEditMode && (
                <FillFromSummaryButton
                    c={c}
                    text={displayedText}
                    compact
                    className="w-full mt-2"
                    preferNew={!viewing}
                    sourceLabel={viewingLabel}
                />
            )}

            {/* Telegram Room Selection Modal */}
            {isTelegramModalOpen && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-4">
                        <div className="flex justify-between items-center border-b border-border pb-3">
                            <h3 className="font-bold flex items-center gap-2 text-foreground text-sm sm:text-base">
                                <MessageCircle size={18} className="text-primary" /> 
                                <span>전송할 텔레그램 방 선택</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsTelegramModalOpen(false)}
                                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <p className="text-2xs text-muted-foreground leading-relaxed">
                                요약문이 클립보드에 자동 복사되었습니다.<br/>
                                전송할 방을 선택하시고 화면이 열리면 붙여넣기 해 주세요.
                            </p>
                            <div className="max-h-60 overflow-y-auto space-y-2 no-scrollbar">
                                {telegramRooms.map(room => (
                                    <button
                                        key={room.id}
                                        type="button"
                                        onClick={() => handleRoomSelect(room.url)}
                                        className="w-full text-left p-3 border border-border flex items-center justify-between rounded-xl bg-muted/30 hover:bg-muted transition-colors group cursor-pointer"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold text-xs text-foreground group-hover:text-primary">{room.name}</span>
                                            <span className="text-2xs text-muted-foreground font-mono mt-0.5 truncate max-w-[200px]">{room.url}</span>
                                        </div>
                                        <Send size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
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
