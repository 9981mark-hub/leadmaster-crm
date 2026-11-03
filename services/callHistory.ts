import { useState, useEffect, useCallback, useMemo } from 'react';
import { Case } from '../types';
import { CallRecording, fetchCaseRecordings, fmtDuration, isNotReadyError } from './recordings';
import { parseAiTranscript, TranscriptLine } from '../utils';

export type CaseCallStatus =
  | 'done'
  | 'processing'
  | 'failed'
  | 'uploaded'
  | 'queued'
  | 'skipped'
  | 'no_summary'
  | 'no_audio';

export interface CaseCallItem {
  id: string;
  recordingId?: string;
  callNumber: number; // 1차, 2차, 3차...
  startedAt: string; // ISO
  formattedDate: string; // e.g. "11/03(화) 11:20"
  durationSec?: number;
  durationLabel?: string; // e.g. "4분 12초"
  direction?: 'CALL_IN' | 'CALL_OUT';
  status: CaseCallStatus;
  summaryText: string;
  transcriptLines: TranscriptLine[];
  rawTranscript: string;
  rawCombinedText: string;
  isLatest: boolean;
  source: 'app' | 'web' | 'import' | 'manual' | 'legacy';
  recordingItem?: CallRecording;
  fileName?: string;
  audioUrl?: string;
  audioProblem?: string;
}

export const formatCallTime = (iso?: string): string => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const day = dayNames[d.getDay()];
    return `${month}/${date}(${day}) ${hours}:${minutes}`;
  } catch {
    return String(iso);
  }
};

/**
 * Builds unified combined text (summary + [전체 대화록] + transcript)
 * matching the standard format expected by parseAiTranscript.
 */
export function buildCombinedText(r: CallRecording): string {
  const officeSummary = (r.extracted?.office_summary || '').trim();
  let body = officeSummary;
  if (!body) {
    const lines = [r.summary || ''];
    if (r.extracted?.special_notes) lines.push(`- 특이사항: ${r.extracted.special_notes}`);
    if (r.extracted?.next_action) lines.push(`- 다음 할 일: ${r.extracted.next_action}`);
    body = lines.filter(Boolean).join('\n');
  }

  if (Array.isArray(r.transcript) && r.transcript.length > 0) {
    const tr = r.transcript
      .filter(x => x && x.text)
      .map(x => `[${x.t || '00:00'}] ${x.speaker || '기타'}: ${String(x.text).replace(/\s*\n\s*/g, ' ')}`);
    if (tr.length > 0) {
      return `${body}\n\n[전체 대화록]\n${tr.join('\n')}`;
    }
  }

  return body;
}

/**
 * Combines call_recordings table records and case.recordings/case.aiSummary
 * into a single chronologically indexed list of CaseCallItem[].
 */
export function buildCallHistoryList(
  c: Case,
  serverRecordings: CallRecording[] = [],
  currentAiSummaryOverride?: string | null
): CaseCallItem[] {
  const items: CaseCallItem[] = [];
  const handledIds = new Set<string>();
  const activeSummary = (currentAiSummaryOverride || c.aiSummary || '').trim();

  // 1. Process server call_recordings
  for (const r of serverRecordings) {
    handledIds.add(r.id);
    if (r.driveFileId) handledIds.add(r.driveFileId);

    const startedAt = r.callStartedAt || r.createdAt || new Date().toISOString();
    const rawCombinedText = buildCombinedText(r);
    const parsed = parseAiTranscript(rawCombinedText);
    const isStale = (Date.now() - new Date(startedAt).getTime()) > 15 * 60 * 1000;

    let finalStatus: CaseCallStatus = r.status;
    let audioProblem: string | undefined = undefined;

    if (r.status === 'done') {
      finalStatus = 'done';
    } else if (r.status === 'failed') {
      finalStatus = 'failed';
      audioProblem = r.error || 'AI 분석 중 오류가 발생했습니다.';
    } else if (r.status === 'skipped') {
      finalStatus = 'skipped';
      audioProblem = r.summary || '유효한 상담 내용이 없어 요약을 생략했습니다.';
    } else if (isStale) {
      // 15분 이상 지났는데 아직도 uploaded나 processing인 경우: 중단/실패 처리
      finalStatus = 'failed';
      audioProblem = 'AI 분석 응답 대기 시간이 초과되어 분석이 완료되지 못했습니다.';
    } else if (r.status === 'uploaded' || r.status === 'queued' || r.status === 'processing') {
      finalStatus = 'processing';
    }

    items.push({
      id: r.id,
      recordingId: r.id,
      callNumber: 0, // Assigned later after sorting
      startedAt,
      formattedDate: formatCallTime(startedAt),
      durationSec: r.durationSec,
      durationLabel: r.durationSec ? fmtDuration(r.durationSec) : undefined,
      direction: r.direction,
      status: finalStatus,
      summaryText: parsed.summaryText,
      transcriptLines: parsed.transcriptLines,
      rawTranscript: parsed.rawTranscript,
      rawCombinedText,
      isLatest: false,
      source: r.source === 'web' ? 'manual' : (r.source === 'import' ? 'import' : 'app'),
      recordingItem: r,
      fileName: r.fileName,
      audioProblem,
    });
  }

  // 2. Process client recordings (c.recordings)
  const clientRecs = c.recordings || [];
  for (const cr of clientRecs) {
    const isHandled = (cr.recordingId && handledIds.has(cr.recordingId))
      || (cr.id && handledIds.has(cr.id))
      || (cr.url && handledIds.has(cr.url));

    if (isHandled) {
      // If server recording was already handled, but has empty summary and client has text, backfill
      const match = items.find(it =>
        (cr.recordingId && it.recordingId === cr.recordingId) ||
        (cr.id && it.id === cr.id) ||
        (cr.url && it.recordingItem?.driveFileId && cr.url.includes(it.recordingItem.driveFileId))
      );
      if (match && !match.summaryText) {
        const text = cr.aiCurrent ? activeSummary : (cr.aiSummary || '');
        if (text) {
          const parsed = parseAiTranscript(text);
          match.summaryText = parsed.summaryText;
          match.transcriptLines = parsed.transcriptLines;
          match.rawTranscript = parsed.rawTranscript;
          match.rawCombinedText = text;
          match.status = 'done';
        }
      }
      continue;
    }

    // Client-only recording (e.g. uploaded manually on mobile/web)
    const text = cr.aiCurrent ? activeSummary : (cr.aiSummary || '');
    const startedAt = cr.analyzedAt || (cr.fromApp ? cr.uploadDate : cr.analyzedAt) || cr.uploadDate || new Date().toISOString();
    const parsed = parseAiTranscript(text);

    const url = (cr.url || '').trim();
    const isBlob = url.startsWith('blob:');
    const isRecent = (Date.now() - new Date(cr.uploadDate || startedAt).getTime()) < 3 * 60 * 1000;

    let clientStatus: CaseCallStatus = 'done';
    let clientAudioProblem: string | undefined = undefined;

    if (cr.status === 'skipped' || String(cr.aiSummary || cr.summary || '').startsWith('[요약 생략]')) {
      clientStatus = 'skipped';
      clientAudioProblem = cr.aiSummary || cr.summary || '유효한 상담 내용이 없어 요약을 생략했습니다.';
    } else if (text) {
      clientStatus = 'done';
    } else if (isRecent && cr.aiCurrent) {
      // 최근 3분 이내에 업로드되어 AI 분석이 막 시작된 통화
      clientStatus = 'processing';
    } else if (isBlob || !url) {
      // 음성 소스 파일이 없거나 브라우저 임시 주소(blob:)가 만료된 과거 녹음
      clientStatus = 'no_audio';
      clientAudioProblem = isBlob
        ? '브라우저 임시 주소(blob:)가 만료되어 음성 원본 파일이 서버나 구글 드라이브에 남아있지 않습니다.'
        : '등록된 통화 녹음 음성 파일(소스)이 존재하지 않습니다.';
    } else {
      // 유효한 드라이브/원격 주소가 있으나 AI 분석을 아직 돌리지 않은 녹음
      clientStatus = 'no_summary';
      clientAudioProblem = '통화 녹음 원본은 보관되어 있으나, 아직 AI 요약 분석이 실행되지 않았습니다.';
    }

    items.push({
      id: cr.id || `client-${startedAt}`,
      recordingId: cr.recordingId,
      callNumber: 0,
      startedAt,
      formattedDate: formatCallTime(startedAt),
      durationSec: cr.duration,
      durationLabel: cr.duration ? fmtDuration(cr.duration) : undefined,
      status: clientStatus,
      summaryText: parsed.summaryText,
      transcriptLines: parsed.transcriptLines,
      rawTranscript: parsed.rawTranscript,
      rawCombinedText: text,
      isLatest: !!cr.aiCurrent,
      source: 'manual',
      fileName: cr.filename,
      audioUrl: url,
      audioProblem: clientAudioProblem,
    });
  }

  // 3. Check if activeSummary represents a separate/newer call not yet in items
  if (activeSummary) {
    const parsedActive = parseAiTranscript(activeSummary);
    const hasMatchingItem = items.some(it => {
      if (it.rawCombinedText && it.rawCombinedText.trim() === activeSummary) return true;
      if (it.summaryText && parsedActive.summaryText && it.summaryText.trim() === parsedActive.summaryText.trim()) return true;
      return false;
    });

    if (!hasMatchingItem) {
      // The active summary represents a consultation/call that was analyzed and saved to c.aiSummary,
      // but not yet assigned to an existing recording item.
      const latestMemoDate = c.specialMemo?.[0]?.createdAt;
      const startedAt = latestMemoDate || c.updatedAt || new Date().toISOString();
      items.push({
        id: `active-summary-${startedAt}`,
        callNumber: 0,
        startedAt,
        formattedDate: formatCallTime(startedAt),
        status: 'done',
        summaryText: parsedActive.summaryText,
        transcriptLines: parsedActive.transcriptLines,
        rawTranscript: parsedActive.rawTranscript,
        rawCombinedText: activeSummary,
        isLatest: true,
        source: 'manual',
      });
    }
  }

  // Fallback: If no items found at all
  if (items.length === 0 && activeSummary) {
    const startedAt = c.createdAt || new Date().toISOString();
    const parsed = parseAiTranscript(activeSummary);
    items.push({
      id: 'current-active-summary',
      callNumber: 1,
      startedAt,
      formattedDate: formatCallTime(startedAt),
      status: 'done',
      summaryText: parsed.summaryText,
      transcriptLines: parsed.transcriptLines,
      rawTranscript: parsed.rawTranscript,
      rawCombinedText: activeSummary,
      isLatest: true,
      source: 'legacy',
    });
    return items;
  }

  // 4. Sort chronologically ascending (oldest first) to number calls 1차, 2차, ...
  items.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));

  // Assign call numbers: 1차, 2차, 3차...
  items.forEach((item, index) => {
    item.callNumber = index + 1;
    item.isLatest = false;
  });

  // Mark the last item as latest
  if (items.length > 0) {
    const lastItem = items[items.length - 1];
    lastItem.isLatest = true;

    // If activeSummary exists and matches this latest call (or latest is done),
    // apply user edits to it
    if (activeSummary && lastItem.status === 'done') {
      const parsed = parseAiTranscript(activeSummary);
      lastItem.summaryText = parsed.summaryText;
      if (parsed.transcriptLines.length > 0 || parsed.rawTranscript) {
        lastItem.transcriptLines = parsed.transcriptLines;
        lastItem.rawTranscript = parsed.rawTranscript;
      }
      lastItem.rawCombinedText = activeSummary;
    }
  }

  // 5. Reverse for UI display (newest first: [5차 (최신), 4차, 3차, 2차, 1차])
  return items.reverse();
}

/**
 * React hook to manage call history list and the currently selected call.
 */
export function useCaseCallHistory(c: Case, currentAiSummaryOverride?: string | null) {
  const [serverRecordings, setServerRecordings] = useState<CallRecording[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!c?.caseId) return;
    setLoading(true);
    try {
      const rows = await fetchCaseRecordings(c.caseId);
      setServerRecordings(rows);
    } catch (e: any) {
      if (!isNotReadyError(e)) {
        console.error('Failed to fetch case call recordings:', e);
      }
    } finally {
      setLoading(false);
    }
  }, [c?.caseId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Window event listener for instant reloads across tabs/components
  useEffect(() => {
    const handleHistoryReload = () => {
      reload();
    };
    window.addEventListener('crm:call_history_reload', handleHistoryReload);
    return () => window.removeEventListener('crm:call_history_reload', handleHistoryReload);
  }, [reload]);

  const calls = useMemo(() => {
    return buildCallHistoryList(c, serverRecordings, currentAiSummaryOverride);
  }, [c, serverRecordings, currentAiSummaryOverride]);

  // Auto-polling ONLY when an actual analysis is in progress
  const hasProcessing = useMemo(() => {
    return calls.some(call => call.status === 'processing');
  }, [calls]);

  useEffect(() => {
    if (!hasProcessing) return;
    const interval = setInterval(() => {
      reload();
    }, 3500);
    return () => clearInterval(interval);
  }, [hasProcessing, reload]);

  // Default selection is the latest call (first in the reversed list)
  const effectiveSelectedId = useMemo(() => {
    if (selectedId && calls.some(item => item.id === selectedId)) {
      return selectedId;
    }
    return calls[0]?.id || null;
  }, [selectedId, calls]);

  const selectedCall = useMemo(() => {
    return calls.find(item => item.id === effectiveSelectedId) || calls[0] || null;
  }, [calls, effectiveSelectedId]);

  const isLatestSelected = !selectedCall || selectedCall.isLatest;

  const selectCall = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  return {
    calls,
    selectedCall,
    selectedId: effectiveSelectedId,
    selectCall,
    isLatestSelected,
    isLoading: loading,
    reload,
  };
}
