import React, { useState, useEffect } from 'react';
import { Case, CaseStatusLog } from '../../../types';
import { HISTORY_TYPES } from '../../../constants';
import { CalendarClock } from 'lucide-react';
import { safeFormat } from '../../../utils';

interface CaseDetailHistoryProps {
    c: Case;
    onUpdate: (field: string, value: any) => void;
    statusLogs?: CaseStatusLog[];
}

export const CaseDetailHistory: React.FC<CaseDetailHistoryProps> = ({
    c,
    onUpdate,
    statusLogs = []
}) => {
    // Local state to handle IME inputs correctly
    const [localMemo, setLocalMemo] = useState(c.historyMemo || '');

    useEffect(() => {
        setLocalMemo(c.historyMemo || '');
    }, [c.historyMemo]);

    const handleBlur = () => {
        if (localMemo !== c.historyMemo) {
            onUpdate('historyMemo', localMemo);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-indigo-200/90 dark:border-indigo-900/60 shadow-xs overflow-hidden">
            {/* 5. 인디고 컬러 헤더 밴드 */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50/40 dark:from-indigo-950/50 dark:to-purple-950/30 px-4 py-2.5 border-b border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                        5
                    </span>
                    <h3 className="font-extrabold text-gray-900 dark:text-gray-100 text-sm">
                        과거 이력 및 상태 변경 기록
                    </h3>
                </div>
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                    히스토리 관리
                </span>
            </div>

            {/* 카드 본문 */}
            <div className="p-4 space-y-3.5">
                {/* 5-A: 회생 / 파산 / 회복 과거 이력 */}
                <div>
                    <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">
                        회생 / 파산 / 회복 과거 이력
                    </label>
                    <div className="grid grid-cols-4 gap-1.5 mb-2">
                        {HISTORY_TYPES.map(opt => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => onUpdate('historyType', opt)}
                                className={`py-1.5 text-xs rounded-lg font-semibold transition-all border ${
                                    c.historyType === opt 
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                    {c.historyType && c.historyType !== '없음' && (
                        <textarea
                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 leading-snug"
                            value={localMemo}
                            onChange={e => setLocalMemo(e.target.value)}
                            onBlur={handleBlur}
                            placeholder="이력 상세 내용을 입력하세요. (사건번호, 법원, 면책여부 등)"
                        />
                    )}
                </div>

                {/* 5-B: 상태 변경 이력 타임라인 (직업란에서 5번으로 이동 통합!) */}
                {statusLogs && statusLogs.length > 0 && (
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                        <label className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                            <CalendarClock size={14} className="text-blue-600" />
                            <span>상태 변경 타임라인</span>
                            <span className="bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.2 rounded text-[10px] font-bold">
                                {statusLogs.length}건
                            </span>
                        </label>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {statusLogs.map(log => (
                                <div key={log.logId} className="bg-slate-50 dark:bg-gray-900/40 p-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-xs">
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-400 line-through text-[11px] px-1.5 py-0.5 bg-gray-200/60 dark:bg-gray-800 rounded">{log.fromStatus}</span>
                                            <span className="text-gray-400">→</span>
                                            <span className="font-bold text-blue-600 dark:text-blue-400 text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 rounded border border-blue-200 dark:border-blue-900">{log.toStatus}</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-mono">{safeFormat(log.changedAt, 'yy.MM.dd HH:mm')}</span>
                                    </div>
                                    {log.memo && (
                                        <div className="mt-1 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded-lg text-xs leading-relaxed border border-gray-100 dark:border-gray-700">
                                            {log.memo}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
