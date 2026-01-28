import React, { useState, useEffect } from 'react';
import { Case } from '../../../types';
import { HISTORY_TYPES } from '../../../constants';

interface CaseDetailHistoryProps {
    c: Case;
    onUpdate: (field: string, value: any) => void;
}

export const CaseDetailHistory: React.FC<CaseDetailHistoryProps> = ({
    c,
    onUpdate
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
        <div className="mt-4">
            <h3 className="font-bold text-gray-700 border-b pb-2 mb-4">개인회생 / 파산 이력</h3>
            <div className="flex gap-2 mb-2 flex-wrap">
                {HISTORY_TYPES.map(opt => (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => onUpdate('historyType', opt)}
                        className={"px-3 py-1.5 text-xs rounded border " + (c.historyType === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50')}
                    >
                        {opt}
                    </button>
                ))}
            </div>
            {c.historyType && c.historyType !== '없음' && (
                <textarea
                    className="w-full p-2 border border-gray-300 rounded text-sm h-24"
                    value={localMemo}
                    onChange={e => setLocalMemo(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="이력 상세 내용을 입력하세요."
                />
            )}
        </div>
    );
};
