import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Edit2, FileText, ListOrdered, Send, Sparkles, X, Check } from 'lucide-react';
import { Case, Partner } from '../../types';
import { generateSummary, injectSummaryMetadata, parseAiTranscript } from '../../utils';
import { FillFromSummaryButton } from './FillFromSummaryButton';
import { useCaseCallHistory } from '../../services/callHistory';
import { CallHistoryTimeline } from './CallHistoryTimeline';

interface CaseSummaryTabProps {
    c: Case;
    currentPartner: Partner | undefined;
    aiSummaryText: string | null;
    setAiSummaryText: (text: string) => void;
    aiSummaryEditMode: boolean;
    setAiSummaryEditMode: (mode: boolean) => void;
    handleUpdateAiSummaryText: (textOverride?: string) => void;
    handleSaveSummaryToMemo: (textOverride?: string) => void;
    showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const CaseSummaryTab: React.FC<CaseSummaryTabProps> = ({
    c, currentPartner, aiSummaryText, setAiSummaryText, aiSummaryEditMode, setAiSummaryEditMode,
    handleUpdateAiSummaryText, handleSaveSummaryToMemo, showToast
}) => {
    const [manualSummary, setManualSummary] = useState('');
    const [isManualSummaryEdit, setIsManualSummaryEdit] = useState(false);
    // AI 결과를 요약문 / 대화록으로 나눠 보기 (모바일 화면용)
    const [aiTab, setAiTab] = useState<'summary' | 'transcript'>('summary');
    const [editSummaryText, setEditSummaryText] = useState('');

    // 통화 히스토리 (시계열 날짜·시간 순 통화 목록 & 현재 선택된 통화)
    const {
        calls,
        selectedCall,
        selectedId,
        selectCall,
        isLatestSelected,
        reload: reloadCalls,
    } = useCaseCallHistory(c, aiSummaryText);

    // 현재 활성화된 요약/대화록 원문 결정
    // 최신 통화일 때는 c.aiSummary(사용자 편집 반영) 우선, 과거 통화일 때는 해당 통화의 고유 원문 사용
    const activeRawText = useMemo(() => {
        if (!selectedCall) return aiSummaryText || '';
        if (isLatestSelected && aiSummaryText) {
            return aiSummaryText;
        }
        return selectedCall.rawCombinedText || '';
    }, [selectedCall, isLatestSelected, aiSummaryText]);

    const parsed = useMemo(() => parseAiTranscript(activeRawText), [activeRawText]);

    const handleStartAiEdit = () => {
        if (!isLatestSelected) {
            showToast('과거 통화 기록은 읽기 전용으로 보존되어 수정할 수 없습니다.', 'error');
            return;
        }
        const summaryOnly = (parsed.summaryText || '').trim();
        setEditSummaryText(injectSummaryMetadata(summaryOnly, c));
        setAiSummaryEditMode(true);
    };

    const handleCancelAiEdit = () => {
        setAiSummaryEditMode(false);
    };

    const handleSaveAiEdit = () => {
        const parsedEdit = parseAiTranscript(editSummaryText);
        const trimmedSummary = (parsedEdit.summaryText || editSummaryText).trim();
        const transcriptToKeep = (parsedEdit.rawTranscript || parsed.rawTranscript || '').trim();
        const combined = transcriptToKeep
            ? `${trimmedSummary}\n\n[전체 대화록]\n${transcriptToKeep}`
            : trimmedSummary;
        setAiSummaryText(combined);
        handleUpdateAiSummaryText(combined);
        setAiSummaryEditMode(false);
        reloadCalls();
    };

    // [2026-11-02] PC 넓은 화면(1280px 이상)은 대화록이 있으면 기본 요약문 · AI 요약문 · 대화록 3칸으로 연다
    const autoOpened = useRef(false);
    useEffect(() => {
        if (autoOpened.current || !activeRawText) return;
        autoOpened.current = true;
        const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1280px)').matches;
        if (wide && (parsed.transcriptLines.length > 0 || parsed.rawTranscript)) setAiTab('transcript');
    }, [activeRawText, parsed]);

    const copyAiTab = () => {
        const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1280px)').matches;
        if (wide && aiTab === 'transcript') {
            const s = parsed.summaryText || '';
            if (!s.trim()) { showToast('복사할 요약문이 없습니다.'); return; }
            navigator.clipboard.writeText(s).then(() => showToast('요약문을 복사했습니다.'), () => showToast('복사하지 못했습니다.', 'error'));
            return;
        }
        const text = aiTab === 'summary'
            ? (parsed.summaryText || '')
            : (parsed.transcriptLines.length
                ? parsed.transcriptLines.map(l => `${l.time ? `[${l.time}] ` : ''}${l.speaker}: ${l.text}`).join('\n')
                : parsed.rawTranscript || '');
        if (!text.trim()) { showToast(aiTab === 'summary' ? '복사할 요약문이 없습니다.' : '복사할 대화록이 없습니다.'); return; }
        navigator.clipboard.writeText(text).then(
            () => showToast(aiTab === 'summary' ? '요약문을 복사했습니다.' : '대화록을 복사했습니다.'),
            () => showToast('복사하지 못했습니다.', 'error'),
        );
    };

    const showTranscript = !!activeRawText && aiTab === 'transcript';
    const transcriptList = parsed.transcriptLines.length > 0 ? parsed.transcriptLines.map(line => {
        const isAgent = /상담원|담당자|사무장/.test(line.speaker);
        return (
            <div
                key={line.id}
                className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
                    isAgent
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/40 text-blue-950 dark:text-blue-100'
                        : 'bg-purple-50/60 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900/40 text-gray-900 dark:text-gray-100'
                }`}
            >
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">{line.speaker}</span>
                    {line.time && <span className="text-[10px] text-gray-400 dark:text-gray-400 tabular-nums">{line.time}</span>}
                </div>
                <div className="whitespace-pre-wrap">{line.text}</div>
            </div>
        );
    }) : (
        <div className="text-sm text-gray-400 dark:text-gray-500 whitespace-pre-wrap">
            {parsed.rawTranscript || '분석된 대화록이 없습니다.'}
        </div>
    );

    const copyTranscript = () => {
        const text = parsed.transcriptLines.length
            ? parsed.transcriptLines.map(l => `${l.time ? `[${l.time}] ` : ''}${l.speaker}: ${l.text}`).join('\n')
            : parsed.rawTranscript || '';
        if (!text.trim()) { showToast('복사할 대화록이 없습니다.'); return; }
        navigator.clipboard.writeText(text).then(
            () => showToast('대화록을 복사했습니다.'),
            () => showToast('복사하지 못했습니다.', 'error')
        );
    };

    return (
        <div className="space-y-4">
            {/* 1. 상단 통화 히스토리 타임라인 바 */}
            <CallHistoryTimeline
                caseId={c.caseId}
                phone={c.phone}
                calls={calls}
                selectedId={selectedId}
                onSelectCall={selectCall}
                isLatestSelected={isLatestSelected}
                onRefresh={reloadCalls}
                showToast={showToast}
            />

            {/* 2. 메인 3컬럼 (기본 요약문 / AI 요약문 / 대화록) 카드 레이아웃 */}
            <div className={`grid md:grid-cols-2 ${showTranscript ? 'xl:grid-cols-3' : ''} gap-4 min-h-[400px] md:min-h-[500px]`}>
                {/* LEFT: Basic Summary */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col h-full relative">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                            <FileText size={18} /> 기본 요약문
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setManualSummary(generateSummary(c, currentPartner?.summaryTemplate));
                                    setIsManualSummaryEdit(true);
                                }}
                                className={`text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 px-3 py-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1 ${isManualSummaryEdit ? 'md:hidden' : ''}`}
                            >
                                <Edit2 size={12} /> 수정
                            </button>
                            {isManualSummaryEdit && (
                                <div className="hidden md:flex gap-2 animate-in fade-in">
                                    <button onClick={() => setIsManualSummaryEdit(false)} className="text-xs bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded hover:bg-gray-50 flex items-center shadow-xs">취소</button>
                                    <button onClick={() => setIsManualSummaryEdit(false)} className="text-xs bg-gray-800 dark:bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-gray-900 dark:hover:bg-blue-700 flex items-center shadow-xs">완료</button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 relative h-full">
                        <div className={`w-full h-full p-4 bg-gray-50 dark:bg-gray-900/60 rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-gray-100 dark:border-gray-700/60 overflow-y-auto min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px] ${isManualSummaryEdit ? 'md:hidden' : ''} text-gray-800 dark:text-gray-200`}>
                            {isManualSummaryEdit ? manualSummary : generateSummary(c, currentPartner?.summaryTemplate)}
                        </div>
                        {isManualSummaryEdit && (
                            <textarea
                                className="hidden md:block w-full h-full p-4 bg-white dark:bg-gray-800 rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-gray-300 dark:border-gray-600 outline-none resize-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-shadow min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px] text-gray-800 dark:text-gray-100"
                                value={manualSummary}
                                onChange={e => setManualSummary(e.target.value)}
                                placeholder="요약 내용을 입력하세요..."
                                autoFocus
                            />
                        )}
                    </div>

                    <div className="mt-4 flex justify-center">
                        <button
                            onClick={() => {
                                const textToCopy = isManualSummaryEdit ? manualSummary : generateSummary(c, currentPartner?.summaryTemplate);
                                navigator.clipboard.writeText(textToCopy);
                                showToast('복사되었습니다.');
                            }}
                            className="bg-gray-800 dark:bg-gray-700 text-white px-6 py-3 rounded-lg font-bold flex items-center hover:bg-gray-900 dark:hover:bg-gray-600 w-full justify-center transition-colors"
                        >
                            <Copy className="mr-2" size={16} /> 전체 복사하기
                        </button>
                    </div>
                </div>

                {/* MIDDLE: AI Summary */}
                <div className="bg-purple-50/70 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-100 dark:border-purple-900/50 shadow-xs flex flex-col h-full relative">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                            <Sparkles size={18} /> AI 요약문
                            {selectedCall && (
                                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                                    {selectedCall.callNumber}차 통화 {selectedCall.isLatest ? '(최신)' : ''}
                                </span>
                            )}
                        </h3>
                        <div className="flex gap-2">
                            {activeRawText && !aiSummaryEditMode && (
                                <button
                                    onClick={copyAiTab}
                                    className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded hover:bg-purple-200 dark:hover:bg-purple-800 flex items-center gap-1"
                                    title={aiTab === 'summary' ? '요약문만 복사' : '대화록만 복사'}
                                >
                                    <Copy size={12} /> 복사
                                </button>
                            )}
                            {activeRawText && isLatestSelected && (
                                <>
                                    <button
                                        onClick={handleStartAiEdit}
                                        className={`text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded hover:bg-purple-200 dark:hover:bg-purple-800 flex items-center gap-1 ${aiSummaryEditMode ? 'md:hidden' : ''}`}
                                    >
                                        <Edit2 size={12} /> 수정
                                    </button>
                                    {aiSummaryEditMode && (
                                        <div className="hidden md:flex gap-2 animate-in fade-in">
                                            <button onClick={handleCancelAiEdit} className="text-xs bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded hover:bg-gray-50 flex items-center shadow-xs">취소</button>
                                            <button onClick={handleSaveAiEdit} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 flex items-center shadow-xs">저장</button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {activeRawText && !aiSummaryEditMode && (
                        <div className={`flex gap-1.5 border-b border-purple-200 dark:border-purple-800 mb-2 ${showTranscript ? 'xl:hidden' : ''}`}>
                            <button
                                onClick={() => setAiTab('summary')}
                                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-t-lg transition-colors ${
                                    aiTab === 'summary'
                                        ? 'bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 border-t border-l border-r border-purple-200 dark:border-purple-800'
                                        : 'text-gray-500 hover:text-purple-600 dark:hover:text-purple-400'
                                }`}
                            >
                                <FileText size={13} /> 요약문
                            </button>
                            <button
                                onClick={() => setAiTab('transcript')}
                                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-t-lg transition-colors ${
                                    aiTab === 'transcript'
                                        ? 'bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 border-t border-l border-r border-purple-200 dark:border-purple-800'
                                        : 'text-gray-500 hover:text-purple-600 dark:hover:text-purple-400'
                                }`}
                            >
                                <ListOrdered size={13} /> 대화록
                                {parsed.transcriptLines.length > 0 && (
                                    <span className="ml-1 px-1.5 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-full text-[10px]">
                                        {parsed.transcriptLines.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    )}

                    <div className="flex-1 relative h-full">
                        {activeRawText ? (
                            <>
                                {/* 요약문: 요약문 탭이면 항상, 대화록 탭이면 넓은 화면에서만 (대화록은 오른쪽 칸에). 수정 모드에서는 숨김 */}
                                <div
                                    className={`w-full h-full p-4 bg-white dark:bg-gray-800 rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-purple-100 dark:border-purple-900/40 overflow-y-auto cursor-text hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition-colors min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px] text-gray-800 dark:text-gray-100 ${
                                        aiSummaryEditMode ? 'hidden' : (showTranscript ? 'hidden xl:block' : 'block')
                                    }`}
                                    onClick={() => { if (!aiSummaryEditMode && isLatestSelected) handleStartAiEdit(); }}
                                >
                                    {parsed.summaryText || ''}
                                </div>
                                {/* 대화록: 좁은 화면에서만 이 칸 안에 (수정 모드가 아닐 때) */}
                                <div className={`xl:hidden w-full h-full p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-100 dark:border-purple-900/40 overflow-y-auto min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px] space-y-2 ${showTranscript && !aiSummaryEditMode ? 'block' : 'hidden'}`}>
                                    {transcriptList}
                                </div>
                                {aiSummaryEditMode && (
                                    <textarea
                                        className="hidden md:block w-full h-full p-4 bg-white dark:bg-gray-800 rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-purple-300 dark:border-purple-600 outline-none resize-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 transition-shadow min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px] text-gray-800 dark:text-gray-100"
                                        value={editSummaryText}
                                        onChange={e => setEditSummaryText(e.target.value)}
                                        placeholder="AI 요약문을 입력하세요..."
                                        autoFocus
                                    />
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 gap-4 min-h-[200px]">
                                <Sparkles size={48} className="opacity-20" />
                                <p className="text-center text-sm">
                                    AI 요약 결과가 없습니다.<br />
                                    상단의 [+ 녹음 직접 올려 요약] 버튼으로<br />
                                    녹음 파일을 업로드하고 요약을 실행해보세요.
                                </p>
                            </div>
                        )}
                    </div>

                    {activeRawText && (
                        <div className="mt-4 flex flex-col gap-2">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSaveSummaryToMemo(activeRawText)}
                                    className="bg-indigo-600 text-white px-3 py-3 rounded-lg font-bold flex items-center justify-center gap-1.5 hover:bg-indigo-700 shadow-xs transition-all active:scale-95 text-xs md:text-sm leading-tight"
                                >
                                    <Send size={16} className="shrink-0" />
                                    <span className="text-center whitespace-nowrap">상담이력 전송</span>
                                </button>
                                <FillFromSummaryButton c={c} text={activeRawText} className="w-full whitespace-nowrap" />
                            </div>
                            <p className="text-[10px] text-center text-purple-400 dark:text-purple-300">
                                * 상담이력 전송 시 '특이사항' 부분만 자동으로 추출되어 저장됩니다.
                            </p>
                        </div>
                    )}
                </div>

                {/* RIGHT: 대화록 (3번째 칸 - 넓은 화면에서 대화록을 골랐을 때) */}
                {showTranscript && (
                    <div className="hidden xl:flex bg-white dark:bg-gray-800 p-4 rounded-xl border border-purple-100 dark:border-purple-900/40 shadow-xs flex-col h-full">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                                <ListOrdered size={18} /> 대화록
                                {selectedCall && (
                                    <span className="text-xs font-normal text-purple-600 dark:text-purple-400">
                                        ({selectedCall.callNumber}차 통화)
                                    </span>
                                )}
                                {parsed.transcriptLines.length > 0 && (
                                    <span className="px-1.5 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-full text-[11px]">
                                        발화 {parsed.transcriptLines.length}건
                                    </span>
                                )}
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={copyTranscript}
                                    className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded hover:bg-purple-200 dark:hover:bg-purple-800 flex items-center gap-1"
                                >
                                    <Copy size={12} /> 복사
                                </button>
                                <button
                                    onClick={() => setAiTab('summary')}
                                    className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1"
                                    title="대화록 칸 닫기"
                                >
                                    <X size={12} /> 닫기
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg border border-gray-100 dark:border-gray-700/60 overflow-y-auto min-h-[250px] max-h-[600px] space-y-2">
                            {transcriptList}
                        </div>
                    </div>
                )}

                {/* FULLSCREEN OVERLAY FOR MANUAL SUMMARY EDIT (Mobile Only) */}
                {isManualSummaryEdit && (
                    <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col animate-in fade-in zoom-in duration-200 md:hidden">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow-xs">
                            <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><FileText size={18} /> 기본 요약문 수정</h3>
                            <div className="flex gap-2">
                                <button onClick={() => setIsManualSummaryEdit(false)} className="px-5 py-2 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 font-bold active:scale-95 transition-all">취소</button>
                                <button onClick={() => setIsManualSummaryEdit(false)} className="px-5 py-2 text-sm text-white bg-gray-800 dark:bg-blue-600 rounded-lg hover:bg-gray-900 dark:hover:bg-blue-700 font-bold active:scale-95 transition-all">완료</button>
                            </div>
                        </div>
                        <textarea
                            className="flex-1 w-full p-4 resize-none outline-none text-base leading-relaxed bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                            value={manualSummary}
                            onChange={e => setManualSummary(e.target.value)}
                            placeholder="요약 내용을 입력하세요..."
                            autoFocus
                        />
                    </div>
                )}

                {/* FULLSCREEN OVERLAY FOR AI SUMMARY EDIT (Mobile Only) */}
                {aiSummaryEditMode && (
                    <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col animate-in fade-in zoom-in duration-200 md:hidden">
                        <div className="flex items-center justify-between p-4 border-b border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-gray-800 shadow-xs">
                            <h3 className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2"><Sparkles size={18} /> AI 요약문 직접 수정</h3>
                            <div className="flex gap-2">
                                <button onClick={handleCancelAiEdit} className="px-5 py-2 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 font-bold active:scale-95 transition-all">취소</button>
                                <button onClick={handleSaveAiEdit} className="px-5 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 font-bold active:scale-95 transition-all">저장</button>
                            </div>
                        </div>
                        <textarea
                            className="flex-1 w-full p-4 resize-none outline-none text-base leading-relaxed bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                            value={editSummaryText}
                            onChange={e => setEditSummaryText(e.target.value)}
                            placeholder="AI 요약문을 입력하세요..."
                            autoFocus
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
