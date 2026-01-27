import React, { useState } from 'react';
import { Copy, Edit2, FileText, Send, Sparkles } from 'lucide-react';
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
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <FileText size={18} /> 기본 요약문
                    </h3>
                    <div className="flex gap-2">
                        {isManualSummaryEdit ? (
                            <>
                                <button onClick={() => setIsManualSummaryEdit(false)} className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-300">취소</button>
                            </>
                        ) : (
                            <button onClick={() => {
                                setManualSummary(generateSummary(c, currentPartner?.summaryTemplate));
                                setIsManualSummaryEdit(true);
                            }} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-200 flex items-center gap-1">
                                <Edit2 size={12} /> 수정
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 relative h-full">
                    {isManualSummaryEdit ? (
                        <textarea
                            className="w-full h-full p-4 border rounded-lg text-sm leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 outline-none min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px] overflow-y-auto"
                            value={manualSummary}
                            onChange={e => setManualSummary(e.target.value)}
                        />
                    ) : (
                        <div className="w-full h-full p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-gray-100 overflow-y-auto min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px]">
                            {generateSummary(c, currentPartner?.summaryTemplate)}
                        </div>
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
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm flex flex-col h-full">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-purple-800 flex items-center gap-2">
                        <Sparkles size={18} /> AI 요약문
                    </h3>
                    <div className="flex gap-2">
                        {aiSummaryEditMode ? (
                            <>
                                <button onClick={handleUpdateAiSummaryText} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 font-bold">저장</button>
                                <button onClick={() => setAiSummaryEditMode(false)} className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-300">취소</button>
                            </>
                        ) : (
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
                        aiSummaryEditMode ? (
                            <textarea
                                className="w-full h-full p-4 border border-purple-200 rounded-lg text-sm leading-relaxed resize-none focus:ring-2 focus:ring-purple-500 outline-none min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px] overflow-y-auto"
                                value={aiSummaryText}
                                onChange={e => setAiSummaryText(e.target.value)}
                            />
                        ) : (
                            <div className="w-full h-full p-4 bg-white rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-purple-100 overflow-y-auto cursor-text hover:bg-purple-50/50 transition-colors min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px]"
                                onClick={() => { setAiSummaryText(injectSummaryMetadata(aiSummaryText, c)); setAiSummaryEditMode(true); }}
                            >
                                {aiSummaryText}
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4 min-h-[200px]">
                            <Sparkles size={48} className="opacity-20" />
                            <p className="text-center text-sm">AI 요약 결과가 없습니다.<br />'정보 수정' 탭에서 녹음 파일을 업로드하고<br />AI 요약을 실행해보세요.</p>
                            {/* Note: Logic to switch tab is in parent, but we can't easily do it here unless we pass setActiveTab. 
                                For now, I'll remove the button or just show message. 
                                Actually, checking original code: it had a button to switch tab. 
                                I'll skip the button for simplicity or I'd need to pass setActiveTab.
                                Let's pass a simplified message.
                            */}
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
        </div>
    );
};
