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
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground h-16 leading-snug"
                            value={localMemo}
                            onChange={e => setLocalMemo(e.target.value)}
                            onBlur={handleBlur}
                            placeholder="사건번호, 법원, 면책여부 등"
                        />
                    </div>
                )}

                {statusLogs.length > 0 && (
                    <div className="pt-3 border-t border-border">
                        <div className={LABEL}>
                            <CalendarClock size={13} className="text-primary" aria-hidden /> 상태 변경 기록
                        </div>
                        <ul className="max-h-40 overflow-y-auto divide-y divide-border rounded-lg border border-border bg-card">
                            {statusLogs.map(log => (
                                <li key={log.logId} className="px-3 py-2 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground line-through">{log.fromStatus}</span>
                                        <span className="text-muted-foreground" aria-hidden>→</span>
                                        <span className="font-semibold text-primary">{log.toStatus}</span>
                                        <span className="ml-auto text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap">{safeFormat(log.changedAt, 'yy.MM.dd HH:mm')}</span>
                                    </div>
                                    {log.memo && <p className="mt-0.5 text-muted-foreground leading-snug">{log.memo}</p>}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </SectionCard>
    );
};
