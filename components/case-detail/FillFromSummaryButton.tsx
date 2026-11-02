import React, { useState } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { Case } from '../../types';
import { ExtractedInfo } from '../../services/recordings';
import { extractFromSummaryText } from '../../services/aiExtract';
import { useUpdateCaseMutation } from '../../services/queries';
import { useToast } from '../../contexts/ToastContext';
import { AiApplyModal } from './AiApplyModal';

/**
 * [AI 요약으로 고객정보 채우기] (2026-11-02)
 * AI 요약문·대화록 글 → 서버 AI가 칸별 정보로 정리 → 지금 값과 비교표 → 체크한 것만 반영
 */
export const FillFromSummaryButton: React.FC<{ c: Case; text: string | null | undefined; className?: string; compact?: boolean }> = ({ c, text, className = '', compact = false }) => {
    const { showToast } = useToast();
    const update = useUpdateCaseMutation();
    const [busy, setBusy] = useState(false);
    const [extracted, setExtracted] = useState<ExtractedInfo | null>(null);
    const usable = !!text && !/^\s*\[오류 발생\]/.test(text);

    const run = async () => {
        if (!usable || busy) return;
        setBusy(true);
        try {
            setExtracted(await extractFromSummaryText(text!, c));
        } catch (e: any) {
            showToast(e?.message || '고객 정보를 뽑지 못했습니다.', 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={run}
                disabled={!usable || busy}
                title={usable ? 'AI 요약문에서 출생·직업·소득·주거·채무 등을 뽑아 상담 정보 칸에 채웁니다 (반영 전에 확인)' : '먼저 AI 분석을 하세요'}
                className={`bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 hover:bg-blue-700 shadow-sm transition-all active:scale-95 disabled:opacity-40 ${compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-xs md:text-sm'} ${className}`}
            >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
                {busy ? '정보 뽑는 중…' : 'AI 요약으로 고객정보 채우기'}
            </button>
            {extracted && (
                <AiApplyModal
                    c={c}
                    extracted={extracted}
                    title="AI 요약 → 상담 정보 채우기"
                    subtitle="AI 요약문에 적힌 값입니다. 맞는 것만 체크하세요. 이미 값이 있는 칸은 기본으로 체크하지 않았습니다."
                    onClose={() => setExtracted(null)}
                    onApply={(updates) => update.mutate(
                        { id: c.caseId, updates, silent: true },
                        {
                            onSuccess: () => showToast('AI 요약 내용을 상담 정보에 채웠습니다.'),
                            onError: () => showToast('반영하지 못했습니다. 다시 시도해주세요.', 'error'),
                        } as any,
                    )}
                />
            )}
        </>
    );
};
