import React, { useState } from 'react';
import { Copy, Edit2, FileText, Send, Sparkles, X } from 'lucide-react';
import { Case, Partner } from '../../types';
import { generateSummary, injectSummaryMetadata } from '../../utils';

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

    return (
        <div className="grid md:grid-cols-2 gap-4 h-full min-h-[400px] md:min-h-[500px]">
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
                        }} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-200 flex items-center gap-1">
                            <Edit2 size={12} /> 수정
                        </button>
                    </div>
                </div>

                <div className="flex-1 relative h-full">
                    <div className="w-full h-full p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-gray-100 overflow-y-auto min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px]">
                        {isManualSummaryEdit ? manualSummary : generateSummary(c, currentPartner?.summaryTemplate)}
                    </div>
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
                        {aiSummaryText && (
                            <button onClick={() => {
                                setAiSummaryText(injectSummaryMetadata(aiSummaryText || '', c));
                                setAiSummaryEditMode(true);
                            }} className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded hover:bg-purple-200 flex items-center gap-1">
                                <Edit2 size={12} /> 수정
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 relative h-full">
                    {aiSummaryText ? (
                        <div className="w-full h-full p-4 bg-white rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-purple-100 overflow-y-auto cursor-text hover:bg-purple-50/50 transition-colors min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px]"
                            onClick={() => { setAiSummaryText(injectSummaryMetadata(aiSummaryText, c)); setAiSummaryEditMode(true); }}
                        >
                            {aiSummaryText}
                        </div>
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
                                className="bg-gray-700 text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center hover:bg-gray-800 shadow-sm transition-all active:scale-95 text-xs md:text-sm"
                            >
                                <Copy className="mr-2" size={16} /> 전체 복사
                            </button>
                            <button
                                onClick={handleSaveSummaryToMemo}
                                className="bg-indigo-600 text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center hover:bg-indigo-700 w-full shadow-sm transition-all active:scale-95 text-xs md:text-sm"
                            >
                                <Send className="mr-2" size={16} /> 상담이력 전송
                            </button>
                        </div>
                        <p className="text-[10px] text-center text-purple-400">
                            * 전송 시 '특이사항' 부분만 자동으로 추출되어 저장됩니다.
                        </p>
                    </div>
                )}
            </div>

            {/* FULLSCREEN OVERLAY FOR MANUAL SUMMARY EDIT */}
            {isManualSummaryEdit && (
                <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in zoom-in duration-200">
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

            {/* FULLSCREEN OVERLAY FOR AI SUMMARY EDIT */}
            {aiSummaryEditMode && (
                <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in zoom-in duration-200">
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
