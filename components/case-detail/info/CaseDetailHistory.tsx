import React, { useState, useEffect } from 'react';
import { Case, CaseStatusLog } from '../../../types';
import { HISTORY_TYPES } from '../../../constants';
import { CalendarClock } from 'lucide-react';
import { safeFormat } from '../../../utils';
import { SectionCard, Choice, LABEL } from '../detailUi';

interface CaseDetailHistoryProps {
    c: Case;
    onUpdate: (field: string, value: any) => void;
    statusLogs?: CaseStatusLog[];
}

/** 5단계 회생·파산 이력 + 상태 변경 기록 (기록은 한 줄씩 촘촘하게) */
export const CaseDetailHistory: React.FC<CaseDetailHistoryProps> = ({
    c,
    onUpdate,
    statusLogs = []
}) => {
    // Local state to handle IME inputs correctly
    const [localMemo, setLocalMemo] = useState(c.historyMemo || '');
    const memoId = React.useId();

    useEffect(() => {
        setLocalMemo(c.historyMemo || '');
    }, [c.historyMemo]);

    const handleBlur = () => {
        if (localMemo !== c.historyMemo) {
            onUpdate('historyMemo', localMemo);
        }
    };

    return (
        <SectionCard step={5} title="회생·파산 이력 · 상태 기록" meta={statusLogs.length > 0 ? `상태 변경 ${statusLogs.length}건` : undefined}>
            <div className="space-y-3">
                <Choice
                    label="회생 / 파산 / 회복 과거 이력"
                    options={HISTORY_TYPES}
                    value={c.historyType}
                    onPick={v => onUpdate('historyType', v)}
                />
                {c.historyType && c.historyType !== '없음' && (
                    <div>
                        <label htmlFor={memoId} className={LABEL}>이력 상세</label>
                        <textarea
                            id={memoId}
                            className="w-full px-2.5 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 h-16 leading-snug"
                            value={localMemo}
                            onChange={e => setLocalMemo(e.target.value)}
                            onBlur={handleBlur}
                            placeholder="사건번호, 법원, 면책여부 등"
                        />
                    </div>
                )}

                {statusLogs.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 dark:border-gray-700">
                        <div className={LABEL}>
                            <CalendarClock size={13} className="text-blue-600" aria-hidden /> 상태 변경 기록
                        </div>
                        <ul className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-gray-700 rounded-lg border border-slate-200 dark:border-gray-700">
                            {statusLogs.map(log => (
                                <li key={log.logId} className="px-2.5 py-1.5 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-slate-400 line-through">{log.fromStatus}</span>
                                        <span className="text-slate-400" aria-hidden>→</span>
                                        <span className="font-semibold text-blue-700 dark:text-blue-300">{log.toStatus}</span>
                                        <span className="ml-auto text-[11px] text-slate-400 tabular-nums whitespace-nowrap">{safeFormat(log.changedAt, 'yy.MM.dd HH:mm')}</span>
                                    </div>
                                    {log.memo && <p className="mt-0.5 text-slate-600 dark:text-gray-400 leading-snug">{log.memo}</p>}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </SectionCard>
    );
};
