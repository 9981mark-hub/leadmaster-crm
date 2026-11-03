import { useState, useEffect, useCallback, useMemo } from 'react';
import { Case } from '../types';
import { CallRecording, fetchCaseRecordings, fmtDuration, isNotReadyError } from './recordings';
import { parseAiTranscript, TranscriptLine } from '../utils';

export interface CaseCallItem {
  id: string;
  recordingId?: string;
  callNumber: number; // 1차, 2차, 3차...
  startedAt: string; // ISO
  formattedDate: string; // e.g. "11/03(화) 11:20"
  durationSec?: number;
  durationLabel?: string; // e.g. "4분 12초"
  direction?: 'CALL_IN' | 'CALL_OUT';
  status: 'done' | 'processing' | 'failed' | 'uploaded' | 'queued' | 'skipped';
  summaryText: string;
  transcriptLines: TranscriptLine[];
  rawTranscript: string;
  rawCombinedText: string;
  isLatest: boolean;
  source: 'app' | 'web' | 'import' | 'manual' | 'legacy';
  recordingItem?: CallRecording;
  fileName?: string;
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
function buildCombinedText(r: CallRecording): string {
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

  // 1. Process server call_recordings
  for (const r of serverRecordings) {
    handledIds.add(r.id);
    if (r.driveFileId) handledIds.add(r.driveFileId);

    const startedAt = r.callStartedAt || r.createdAt || new Date().toISOString();
    const rawCombinedText = buildCombinedText(r);
    const parsed = parseAiTranscript(rawCombinedText);

    items.push({
      id: r.id,
      recordingId: r.id,
      callNumber: 0, // Assigned later after sorting
      startedAt,
      formattedDate: formatCallTime(startedAt),
      durationSec: r.durationSec,
      durationLabel: r.durationSec ? fmtDuration(r.durationSec) : undefined,
      direction: r.direction,
      status: r.status,
      summaryText: parsed.summaryText,
      transcriptLines: parsed.transcriptLines,
      rawTranscript: parsed.rawTranscript,
      rawCombinedText,
      isLatest: false,
      source: r.source === 'web' ? 'manual' : (r.source === 'import' ? 'import' : 'app'),
      recordingItem: r,
      fileName: r.fileName,
    });
  }

  // 2. Process legacy or client-only case.recordings that have aiSummary
  const clientRecs = c.recordings || [];
  for (const cr of clientRecs) {
    if (cr.recordingId && handledIds.has(cr.recordingId)) continue;
    if (cr.id && handledIds.has(cr.id)) continue;
    if (cr.url && handledIds.has(cr.url)) continue;

    // Check if this recording has summary content
    const summaryContent = (cr.aiSummary || '').trim();
    if (summaryContent) {
      const startedAt = (cr.fromApp ? cr.uploadDate : cr.analyzedAt) || cr.uploadDate || new Date().toISOString();
      const parsed = parseAiTranscript(summaryContent);

      items.push({
        id: cr.id || `client-${startedAt}`,
        recordingId: cr.recordingId,
        callNumber: 0,
        startedAt,
        formattedDate: formatCallTime(startedAt),
        durationSec: cr.duration,
        durationLabel: cr.duration ? fmtDuration(cr.duration) : undefined,
        status: 'done',
        summaryText: parsed.summaryText,
        transcriptLines: parsed.transcriptLines,
        rawTranscript: parsed.rawTranscript,
        rawCombinedText: summaryContent,
        isLatest: false,
        source: 'manual',
        fileName: cr.filename,
      });
    }
  }

  // 3. Fallback: If no calls were found at all, but c.aiSummary or currentAiSummaryOverride exists
  const activeSummary = (currentAiSummaryOverride || c.aiSummary || '').trim();
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
  });

  // Mark the last item as latest
  if (items.length > 0) {
    const lastItem = items[items.length - 1];
    lastItem.isLatest = true;

    // If there is an active edited summary in c.aiSummary or currentAiSummaryOverride,
    // apply it to the latest call so the user sees their live edits.
    if (activeSummary && lastItem.status === 'done') {
      const parsed = parseAiTranscript(activeSummary);
      lastItem.summaryText = parsed.summaryText;
      if (parsed.transcriptLines.length > 0) {
        lastItem.transcriptLines = parsed.transcriptLines;
        lastItem.rawTranscript = parsed.rawTranscript;
      }
      lastItem.rawCombinedText = activeSummary;
    }
  }

  // 5. Reverse for UI display (newest first: [3차 (최신), 2차, 1차])
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

  const calls = useMemo(() => {
    return buildCallHistoryList(c, serverRecordings, currentAiSummaryOverride);
  }, [c, serverRecordings, currentAiSummaryOverride]);

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
