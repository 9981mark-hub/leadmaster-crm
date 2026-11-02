import React, { useEffect, useState } from 'react';
import { Smartphone, ChevronRight } from 'lucide-react';
import { Case } from '../../../types';
import { CallRecording, fetchCaseRecordings, fmtDuration } from '../../../services/recordings';

const STATUS: Record<CallRecording['status'], string> = {
    uploaded: 'AI 정리 전', queued: '대기', processing: 'AI 정리 중', done: 'AI 정리 완료', failed: '실패', skipped: '건너뜀',
};
const fmt = (iso: string) => {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * 앱이 자동으로 올린 통화 녹음 (2026-11-02). 녹음 아카이브(직접 올린 녹음)와 한 곳에서 보이게.
 * 누르면 "통화 녹음·AI" 탭으로 가서 듣기·AI 정리·상담 정보 반영.
 */
export const AppRecordingsList: React.FC<{ c: Case; onOpen?: () => void }> = ({ c, onOpen }) => {
    const [list, setList] = useState<CallRecording[]>([]);
    useEffect(() => {
        let cancelled = false;
        fetchCaseRecordings(c.caseId)
            .then(r => { if (!cancelled) setList(r.filter(x => x.source !== 'import')); })
            .catch(() => { /* 017 전이거나 권한 없음 → 안 보임 */ });
        return () => { cancelled = true; };
    }, [c.caseId, c.updatedAt]);
    if (list.length === 0) return null;
    return (
        <div className="mb-4">
            <h4 className="text-xs font-bold text-gray-600 mb-2 flex items-center"><Smartphone size={12} className="mr-1" /> 앱 자동 업로드 녹음 <span className="ml-1 text-gray-400 font-normal">(통화 녹음·AI 탭)</span></h4>
            <div className="space-y-1 max-h-32 overflow-y-auto no-scrollbar">
                {list.map(r => (
                    <button
                        key={r.id}
                        type="button"
                        onClick={onOpen}
                        className="w-full flex items-center gap-2 p-2 rounded border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-xs text-left"
                    >
                        <span className="font-medium text-gray-800 tabular-nums">{fmt(r.callStartedAt)}</span>
                        <span className="text-gray-500">{r.direction === 'CALL_IN' ? '수신' : r.direction === 'CALL_OUT' ? '발신' : '통화'} · {fmtDuration(r.durationSec)}</span>
                        <span className={`ml-auto px-1.5 rounded ${r.status === 'done' ? 'bg-green-100 text-green-700' : r.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{STATUS[r.status]}</span>
                        <ChevronRight size={14} className="text-gray-400" />
                    </button>
                ))}
            </div>
        </div>
    );
};
