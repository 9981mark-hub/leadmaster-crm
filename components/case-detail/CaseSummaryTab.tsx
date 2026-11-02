import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Edit2, FileText, ListOrdered, Send, Sparkles, X } from 'lucide-react';
import { Case, Partner } from '../../types';
import { generateSummary, injectSummaryMetadata, parseAiTranscript } from '../../utils';
import { FillFromSummaryButton } from './FillFromSummaryButton';

interface CaseSummaryTabProps {
    c: Case;
    currentPartner: Partner | undefined;
    aiSummaryText: string | null;
    setAiSummaryText: (text: string) => void;
    aiSummaryEditMode: boolean;
    setAiSummaryEditMode: (mode: boolean) => void;
    handleUpdateAiSummaryText: () => void;
    handleSaveSummaryToMemo: () => void;
    showToast: (msg: string) => void;
}

export const CaseSummaryTab: React.FC<CaseSummaryTabProps> = ({
    c, currentPartner, aiSummaryText, setAiSummaryText, aiSummaryEditMode, setAiSummaryEditMode,
    handleUpdateAiSummaryText, handleSaveSummaryToMemo, showToast
}) => {
    const [manualSummary, setManualSummary] = useState('');
    const [isManualSummaryEdit, setIsManualSummaryEdit] = useState(false);
    // AI 결과를 요약문 / 대화록으로 나눠 보기 (모바일 상담 정보 화면과 같은 방식)
    const [aiTab, setAiTab] = useState<'summary' | 'transcript'>('summary');
    const parsed = useMemo(() => parseAiTranscript(aiSummaryText), [aiSummaryText]);
    // [2026-11-02] PC 넓은 화면(1280px 이상)은 AI 요약문이 있으면 처음부터 기본 요약문 · AI 요약문 · 대화록 3칸으로 연다
    const autoOpened = useRef(false);
    useEffect(() => {
        if (autoOpened.current || !aiSummaryText) return;
        autoOpened.current = true;
        const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1280px)').matches;
        if (wide && (parsed.transcriptLines.length > 0 || parsed.rawTranscript)) setAiTab('transcript');
    }, [aiSummaryText, parsed]);
    const copyAiTab = () => {
        // 넓은 화면에서 대화록을 열면 AI 칸에는 요약문이 보이므로 요약문을 복사 (대화록은 3번째 칸의 복사 버튼)
        const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1280px)').matches;
        if (wide && aiTab === 'transcript') {
            const s = parsed.summaryText || aiSummaryText || '';
            if (!s.trim()) { showToast('복사할 요약문이 없습니다.'); return; }
            navigator.clipboard.writeText(s).then(() => showToast('요약문을 복사했습니다.'), () => showToast('복사하지 못했습니다.'));
            return;
        }
        const text = aiTab === 'summary'
            ? (parsed.summaryText || aiSummaryText || '')
            : (parsed.transcriptLines.length
                ? parsed.transcriptLines.map(l => `${l.time ? `[${l.time}] ` : ''}${l.speaker}: ${l.text}`).join('\n')
                : parsed.rawTranscript || '');
        if (!text.trim()) { showToast(aiTab === 'summary' ? '복사할 요약문이 없습니다.' : '복사할 대화록이 없습니다.'); return; }
        navigator.clipboard.writeText(text).then(
            () => showToast(aiTab === 'summary' ? '요약문을 복사했습니다.' : '대화록을 복사했습니다.'),
            () => showToast('복사하지 못했습니다.'),
        );
    };

    // 대화록을 고르면: 넓은 화면(1280px 이상)은 기본 요약문 · AI 요약문 · 대화록 3칸을 나란히, 좁은 화면은 AI 칸 안에서 탭 전환
    const showTranscript = !!aiSummaryText && !aiSummaryEditMode && aiTab === 'transcript';
    const transcriptList = parsed.transcriptLines.length > 0 ? parsed.transcriptLines.map(line => {
        const isAgent = /상담원|담당자|사무장/.test(line.speaker);
        return (
            <div key={line.id} className={`p-2.5 rounded-lg border text-xs leading-relaxed ${isAgent ? 'bg-blue-50 border-blue-100 text-blue-950' : 'bg-purple-50/60 border-purple-100 text-gray-900'}`}>
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">{line.speaker}</span>
                    {line.time && <span className="text-[10px] text-gray-400 tabular-nums">{line.time}</span>}
                </div>
                <div className="whitespace-pre-wrap">{line.text}</div>
            </div>
        );
    }) : (
        <div className="text-sm text-gray-400 whitespace-pre-wrap">{parsed.rawTranscript || '분석된 대화록이 없습니다.'}</div>
    );
    const copyTranscript = () => {
        const text = parsed.transcriptLines.length
            ? parsed.transcriptLines.map(l => `${l.time ? `[${l.time}] ` : ''}${l.speaker}: ${l.text}`).join('\n')
            : parsed.rawTranscript || '';
        if (!text.trim()) { showToast('복사할 대화록이 없습니다.'); return; }
        navigator.clipboard.writeText(text).then(() => showToast('대화록을 복사했습니다.'), () => showToast('복사하지 못했습니다.'));
    };

    return (
        <div className={`grid md:grid-cols-2 ${showTranscript ? 'xl:grid-cols-3' : ''} gap-4 h-full min-h-[400px] md:min-h-[500px]`}>
            {/* LEFT: Basic Summary */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full relative">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <FileText size={18} /> 기본 요약문
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={() => {
                            setManualSummary(generateSummary(c, currentPartner?.summaryTemplate));
                            setIsManualSummaryEdit(true);
                        }} className={`text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-200 flex items-center gap-1 ${isManualSummaryEdit ? 'md:hidden' : ''}`}>
                            <Edit2 size={12} /> 수정
                        </button>
                        {isManualSummaryEdit && (
                            <div className="hidden md:flex gap-2 animate-in fade-in">
                                <button onClick={() => setIsManualSummaryEdit(false)} className="text-xs bg-white text-gray-700 border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 flex items-center shadow-sm">취소</button>
                                <button onClick={() => setIsManualSummaryEdit(false)} className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded hover:bg-gray-900 flex items-center shadow-sm">완료</button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 relative h-full">
                    <div className={`w-full h-full p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-gray-100 overflow-y-auto min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px] ${isManualSummaryEdit ? 'md:hidden' : ''}`}>
                        {isManualSummaryEdit ? manualSummary : generateSummary(c, currentPartner?.summaryTemplate)}
                    </div>
                    {isManualSummaryEdit && (
                        <textarea
                            className="hidden md:block w-full h-full p-4 bg-white rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-gray-300 outline-none resize-none focus:ring-2 focus:ring-gray-200 transition-shadow min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px]"
                            value={manualSummary}
                            onChange={e => setManualSummary(e.target.value)}
                            placeholder="요약 내용을 입력하세요..."
                            autoFocus
                        />
                    )}
                </div>

                <div className="mt-4 flex justify-center">
                    <button onClick={() => {
                        const textToCopy = isManualSummaryEdit ? manualSummary : generateSummary(c, currentPartner?.summaryTemplate);
                        navigator.clipboard.writeText(textToCopy);
                        showToast('복사되었습니다.');
                    }} className="bg-gray-800 text-white px-6 py-3 rounded-lg font-bold flex items-center hover:bg-gray-900 w-full justify-center">
                        <Copy className="mr-2" size={16} /> 전체 복사하기
                    </button>
                </div>
            </div>

            {/* RIGHT: AI Summary */}
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm flex flex-col h-full relative">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-purple-800 flex items-center gap-2">
                        <Sparkles size={18} /> AI 요약문
                    </h3>
                    <div className="flex gap-2">
                        {aiSummaryText && !aiSummaryEditMode && (
                            <button
                                onClick={copyAiTab}
                                className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded hover:bg-purple-200 flex items-center gap-1"
                                title={aiTab === 'summary' ? '요약문만 복사' : '대화록만 복사'}
                            >
                                <Copy size={12} /> 복사
                            </button>
                        )}
                        {aiSummaryText && (
                            <>
                                <button onClick={() => {
                                    setAiSummaryText(injectSummaryMetadata(aiSummaryText || '', c));
                                    setAiSummaryEditMode(true);
                                }} className={`text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded hover:bg-purple-200 flex items-center gap-1 ${aiSummaryEditMode ? 'md:hidden' : ''}`}>
                                    <Edit2 size={12} /> 수정
                                </button>
                                {aiSummaryEditMode && (
                                    <div className="hidden md:flex gap-2 animate-in fade-in">
                                        <button onClick={() => setAiSummaryEditMode(false)} className="text-xs bg-white text-gray-700 border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 flex items-center shadow-sm">취소</button>
                                        <button onClick={() => { handleUpdateAiSummaryText(); setAiSummaryEditMode(false); }} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 flex items-center shadow-sm">저장</button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {aiSummaryText && !aiSummaryEditMode && (
                    <div className={`flex gap-1.5 border-b border-purple-200 mb-2 ${showTranscript ? 'xl:hidden' : ''}`}>
                        <button
                            onClick={() => setAiTab('summary')}
                            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-t-lg transition-colors ${aiTab === 'summary' ? 'bg-white text-purple-700 border-t border-l border-r border-purple-200' : 'text-gray-500 hover:text-purple-600'}`}
                        >
                            <FileText size={13} /> 요약문
                        </button>
                        <button
                            onClick={() => setAiTab('transcript')}
                            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-t-lg transition-colors ${aiTab === 'transcript' ? 'bg-white text-purple-700 border-t border-l border-r border-purple-200' : 'text-gray-500 hover:text-purple-600'}`}
                        >
                            <ListOrdered size={13} /> 대화록
                            {parsed.transcriptLines.length > 0 && <span className="ml-1 px-1.5 bg-purple-100 text-purple-700 rounded-full text-[10px]">{parsed.transcriptLines.length}</span>}
                        </button>
                    </div>
                )}

                <div className="flex-1 relative h-full">
                    {aiSummaryText ? (
                        <>
                            {/* 요약문: 요약문 탭이면 항상, 대화록 탭이면 넓은 화면에서만 (대화록은 오른쪽 칸에) */}
                            <div className={`w-full h-full p-4 bg-white rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-purple-100 overflow-y-auto cursor-text hover:bg-purple-50/50 transition-colors min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px] ${aiSummaryEditMode ? 'md:hidden' : ''} ${showTranscript ? 'hidden xl:block' : ''}`}
                                onClick={() => { setAiSummaryText(injectSummaryMetadata(aiSummaryText, c)); setAiSummaryEditMode(true); }}
                            >
                                {parsed.summaryText || aiSummaryText}
                            </div>
                            {/* 대화록: 좁은 화면에서만 이 칸 안에 */}
                            {showTranscript && (
                                <div className="xl:hidden w-full h-full p-3 bg-white rounded-lg border border-purple-100 overflow-y-auto min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px] space-y-2">
                                    {transcriptList}
                                </div>
                            )}
                            {aiSummaryEditMode && (
                                <textarea
                                    className="hidden md:block w-full h-full p-4 bg-white rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-purple-300 outline-none resize-none focus:ring-2 focus:ring-purple-200 transition-shadow min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px]"
                                    value={aiSummaryText || ''}
                                    onChange={e => setAiSummaryText(e.target.value)}
                                    placeholder="AI 요약문을 입력하세요..."
                                    autoFocus
                                />
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4 min-h-[200px]">
                            <Sparkles size={48} className="opacity-20" />
                            <p className="text-center text-sm">AI 요약 결과가 없습니다.<br />'정보 수정' 탭에서 녹음 파일을 업로드하고<br />AI 요약을 실행해보세요.</p>
                            <p className="text-center text-xs text-purple-500">정보 수정 탭에서 생성할 수 있습니다.</p>
                        </div>
                    )}
                </div>

                {aiSummaryText && (
                    <div className="mt-4 flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => { navigator.clipboard.writeText(aiSummaryText); showToast('복사되었습니다.'); }}
                                className="bg-gray-700 text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center hover:bg-gray-800 shadow-sm transition-all active:scale-95 text-xs md:text-sm leading-tight"
                            >
                                <Copy className="mr-1.5 md:mr-2 flex-shrink-0" size={16} />
                                <span className="text-center">전체 복사</span>
                            </button>
                            <button
                                onClick={handleSaveSummaryToMemo}
                                className="bg-indigo-600 text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center hover:bg-indigo-700 w-full shadow-sm transition-all active:scale-95 text-xs md:text-sm leading-tight"
                            >
                                <Send className="mr-1.5 md:mr-2 flex-shrink-0" size={16} />
                                <span className="text-center">상담이력<br className="block sm:hidden" /><span className="hidden sm:inline"> </span>전송</span>
                            </button>
                        </div>
                        <FillFromSummaryButton c={c} text={aiSummaryText} className="w-full" />
                        <p className="text-[10px] text-center text-purple-400">
                            * 상담이력 전송 시 '특이사항' 부분만 자동으로 추출되어 저장됩니다.
                        </p>
                    </div>
                )}
            </div>

            {/* 3번째 칸: 대화록 (넓은 화면에서 대화록을 골랐을 때만) */}
            {showTranscript && (
                <div className="hidden xl:flex bg-white p-4 rounded-xl border border-purple-100 shadow-sm flex-col h-full">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-purple-800 flex items-center gap-2">
                            <ListOrdered size={18} /> 대화록
                            {parsed.transcriptLines.length > 0 && <span className="px-1.5 bg-purple-100 text-purple-700 rounded-full text-[11px]">{parsed.transcriptLines.length}</span>}
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={copyTranscript} className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded hover:bg-purple-200 flex items-center gap-1"><Copy size={12} /> 복사</button>
                            <button onClick={() => setAiTab('summary')} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-200 flex items-center gap-1" title="대화록 칸 닫기"><X size={12} /> 닫기</button>
                        </div>
                    </div>
                    <div className="flex-1 p-3 bg-gray-50 rounded-lg border border-gray-100 overflow-y-auto min-h-[250px] max-h-[600px] space-y-2">
                        {transcriptList}
                    </div>
                </div>
            )}

            {/* FULLSCREEN OVERLAY FOR MANUAL SUMMARY EDIT (Mobile Only) */}
            {isManualSummaryEdit && (
                <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in zoom-in duration-200 md:hidden">
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 shadow-sm">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText size={18} /> 기본 요약문 수정</h3>
                        <div className="flex gap-2">
                            <button onClick={() => setIsManualSummaryEdit(false)} className="px-5 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-bold active:scale-95 transition-all">취소</button>
                            <button onClick={() => setIsManualSummaryEdit(false)} className="px-5 py-2 text-sm text-white bg-gray-800 rounded-lg hover:bg-gray-900 font-bold active:scale-95 transition-all">완료</button>
                        </div>
                    </div>
                    <textarea
                        className="flex-1 w-full p-4 resize-none outline-none text-base leading-relaxed bg-white"
                        value={manualSummary}
                        onChange={e => setManualSummary(e.target.value)}
                        placeholder="요약 내용을 입력하세요..."
                        autoFocus
                    />
                </div>
            )}

            {/* FULLSCREEN OVERLAY FOR AI SUMMARY EDIT (Mobile Only) */}
            {aiSummaryEditMode && (
                <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in zoom-in duration-200 md:hidden">
                    <div className="flex items-center justify-between p-4 border-b border-purple-200 bg-purple-50 shadow-sm">
                        <h3 className="font-bold text-purple-800 flex items-center gap-2"><Sparkles size={18} /> AI 요약문 직접 수정</h3>
                        <div className="flex gap-2">
                            <button onClick={() => setAiSummaryEditMode(false)} className="px-5 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-bold active:scale-95 transition-all">취소</button>
                            <button onClick={() => { handleUpdateAiSummaryText(); setAiSummaryEditMode(false); }} className="px-5 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 font-bold active:scale-95 transition-all">저장</button>
                        </div>
                    </div>
                    <textarea
                        className="flex-1 w-full p-4 resize-none outline-none text-base leading-relaxed bg-white"
                        value={aiSummaryText || ''}
                        onChange={e => setAiSummaryText(e.target.value)}
                        placeholder="AI 요약문을 입력하세요..."
                        autoFocus
                    />
                </div>
            )}
        </div>
    );
};
