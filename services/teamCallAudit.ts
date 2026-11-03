import { supabase } from './supabase';
import { Case } from '../types';
import { TeamMember } from './team';
import { CallRecording } from './recordings';

export type CallAuditType = 'all' | 'meaningful_only' | 'deep' | 'appointment' | 'simple' | 'skipped';

export interface CallAuditFilter {
  preset: 'today' | 'yesterday' | 'week' | 'custom';
  customDate?: string;       // YYYY-MM-DD
  userId?: string;           // 특정 직원 ID ('all' 또는 특정 UUID)
  auditType: CallAuditType;  // 의미있는 상담 여부
  minDurationSec: number;    // 0: 전체, 30: 30초 이상, 60: 1분 이상, 180: 3분 이상
  searchKeyword?: string;    // 고객명/연락처/요약문 검색
}

export interface CallQualificationInfo {
  isMeaningful: boolean;
  callType: 'deep_consultation' | 'appointment' | 'simple_inquiry' | 'wrong_number' | 'call_later' | 'rejected' | 'other';
  callTypeLabel: string;
  reason: string;
  scheduleNote?: string;
}

export interface TeamCallAuditItem {
  id: string;
  caseId: string;
  customerName: string;
  customerPhone: string;
  caseStatus: string;
  inboundPath?: string;

  userId?: string;
  userName: string;
  userEmail?: string;
  userRole?: string;

  callStartedAt: string;
  formattedDate: string;     // "11/03(화) 14:25"
  formattedTime: string;     // "14:25"
  durationSec: number;
  durationLabel: string;     // "4분 12초"
  direction: 'CALL_IN' | 'CALL_OUT';

  status: 'uploaded' | 'queued' | 'processing' | 'done' | 'failed' | 'skipped';
  qualification: CallQualificationInfo;

  summaryText: string;
  summarySnippet: string;
  transcript: Array<{ t: string; speaker: string; text: string }>;
  transcriptCount: number;

  hasAudio: boolean;
  storageKind: 'supabase' | 'gdrive';
  driveFileId?: string;
  storagePath: string;
  fileName?: string;
  rawRecording: CallRecording;
}

export interface TeamCallAuditStats {
  totalCalls: number;
  meaningfulCalls: number;
  meaningfulRate: number;      // %
  appointmentCalls: number;
  totalDurationSec: number;
  avgDurationSec: number;
}

const need = () => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다');
  return supabase;
};

const maskPhone = (p?: string) => {
  const d = (p || '').replace(/[^0-9]/g, '');
  return d.length >= 8 ? `${d.slice(0, 3)}-****-${d.slice(-4)}` : (p || '-');
};

export const fmtDuration = (sec: number): string => {
  if (sec <= 0) return '0초';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
};

export const formatCallDateTime = (iso?: string): { formattedDate: string; formattedTime: string } => {
  if (!iso) return { formattedDate: '-', formattedTime: '-' };
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { formattedDate: '-', formattedTime: '-' };
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const day = dayNames[d.getDay()];
    return {
      formattedDate: `${month}/${date}(${day}) ${hours}:${minutes}`,
      formattedTime: `${hours}:${minutes}`,
    };
  } catch {
    return { formattedDate: String(iso), formattedTime: '-' };
  }
};

/** KST 기준 날짜 범위 계산 */
export const getKstDateRange = (preset: 'today' | 'yesterday' | 'week' | 'custom', customDate?: string) => {
  const now = new Date();
  // 한국 표준시 (UTC+9)
  const kstNow = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000);

  if (preset === 'custom' && customDate) {
    return {
      startDate: `${customDate}T00:00:00+09:00`,
      endDate: `${customDate}T23:59:59+09:00`,
    };
  }

  const y = kstNow.getFullYear();
  const m = String(kstNow.getMonth() + 1).padStart(2, '0');
  const d = String(kstNow.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  if (preset === 'today') {
    return {
      startDate: `${todayStr}T00:00:00+09:00`,
      endDate: `${todayStr}T23:59:59+09:00`,
    };
  }

  if (preset === 'yesterday') {
    const yest = new Date(kstNow.getTime() - 24 * 60 * 60 * 1000);
    const yy = yest.getFullYear();
    const ym = String(yest.getMonth() + 1).padStart(2, '0');
    const yd = String(yest.getDate()).padStart(2, '0');
    const yestStr = `${yy}-${ym}-${yd}`;
    return {
      startDate: `${yestStr}T00:00:00+09:00`,
      endDate: `${yestStr}T23:59:59+09:00`,
    };
  }

  if (preset === 'week') {
    const day = kstNow.getDay() || 7; // 월=1 ~ 일=7
    const mon = new Date(kstNow.getTime() - (day - 1) * 24 * 60 * 60 * 1000);
    const my = mon.getFullYear();
    const mm = String(mon.getMonth() + 1).padStart(2, '0');
    const md = String(mon.getDate()).padStart(2, '0');
    return {
      startDate: `${my}-${mm}-${md}T00:00:00+09:00`,
      endDate: `${todayStr}T23:59:59+09:00`,
    };
  }

  return {
    startDate: `${todayStr}T00:00:00+09:00`,
    endDate: `${todayStr}T23:59:59+09:00`,
  };
};

/** 통화 적격성(의미있는 상담 여부) 판정 - 과거/신규 레코드 통합 처리 */
export function evaluateQualification(r: any): CallQualificationInfo {
  const q = r.extracted?.qualification;
  if (q && typeof q.is_meaningful === 'boolean') {
    const labels: Record<string, string> = {
      deep_consultation: '심층 상담',
      appointment: '통화 예약',
      simple_inquiry: '단순 안내',
      wrong_number: '잘못 걸린 전화',
      call_later: '부재/재통화',
      rejected: '수신 거절/불통',
      other: '기타 통화',
    };
    return {
      isMeaningful: q.is_meaningful,
      callType: q.call_type || 'other',
      callTypeLabel: labels[q.call_type] || '기타 상담',
      reason: q.reason || '',
      scheduleNote: q.schedule_note,
    };
  }

  // 레거시 또는 미분류 데이터 처리
  if (r.status === 'skipped') {
    return {
      isMeaningful: false,
      callType: 'call_later',
      callTypeLabel: '요약 생략 (단순/부재)',
      reason: r.summary || '통화 시간이 짧거나 의미 있는 상담 내용 없음',
    };
  }

  const dur = Number(r.duration_sec || 0);
  const sum = String(r.summary || '').trim();
  const hasSubstantialSummary = sum.length > 25 && !sum.includes('확인 필요\n* 거주지역 : 확인 필요');

  if (dur >= 60 || hasSubstantialSummary) {
    return {
      isMeaningful: true,
      callType: 'deep_consultation',
      callTypeLabel: '심층 상담',
      reason: '통화 1분 이상 또는 실전 상담 진행',
    };
  }

  if (dur >= 30) {
    return {
      isMeaningful: false,
      callType: 'simple_inquiry',
      callTypeLabel: '단순 안내',
      reason: '짧은 안내 또는 단순 문의',
    };
  }

  return {
    isMeaningful: false,
    callType: 'call_later',
    callTypeLabel: '단순 연결',
    reason: '30초 미만 단순 통화',
  };
}

/** 요약문 스니펫 생성 */
const extractSummarySnippet = (r: any): string => {
  const officeSummary = (r.extracted?.office_summary || '').trim();
  if (officeSummary) {
    const lines = officeSummary.split('\n').map((l: string) => l.trim()).filter(Boolean);
    return lines.slice(0, 2).join(' / ');
  }

  if (r.extracted?.special_notes) {
    return `[특이사항] ${r.extracted.special_notes}`;
  }

  if (r.summary) {
    const lines = r.summary.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const nonSpam = lines.filter((l: string) => !l.includes('확인 필요'));
    if (nonSpam.length > 0) {
      return nonSpam.slice(0, 2).join(' / ');
    }
    return lines.slice(0, 2).join(' / ');
  }

  return '요약 내용 없음';
};

/**
 * 팀 콜 활동 내역 조회 및 통계 계산
 */
export async function fetchTeamCallAudits(
  filter: CallAuditFilter,
  allCases: Case[] = [],
  teamMembers: TeamMember[] = []
): Promise<{
  items: TeamCallAuditItem[];
  stats: TeamCallAuditStats;
}> {
  const { startDate, endDate } = getKstDateRange(filter.preset, filter.customDate);

  let query = need()
    .from('call_recordings')
    .select(
      'id, case_id, user_id, phone, direction, call_started_at, duration_sec, storage_path, ' +
      'file_name, size_bytes, mime_type, source_app, status, error, summary, transcript, extracted, ' +
      'storage_kind, drive_file_id, archive_status, source, created_at'
    )
    .gte('call_started_at', startDate)
    .lte('call_started_at', endDate)
    .order('call_started_at', { ascending: false });

  if (filter.userId && filter.userId !== 'all') {
    query = query.eq('user_id', filter.userId);
  }

  if (filter.minDurationSec > 0) {
    query = query.gte('duration_sec', filter.minDurationSec);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[teamCallAudit] fetch failed:', error);
    throw error;
  }

  const caseMap = new Map<string, Case>();
  allCases.forEach(c => caseMap.set(c.caseId, c));

  const memberMap = new Map<string, TeamMember>();
  teamMembers.forEach(m => memberMap.set(m.userId, m));

  const rawRows: any[] = data || [];

  // 가공
  const allItems: TeamCallAuditItem[] = rawRows.map(r => {
    const c = caseMap.get(r.case_id);
    const m = r.user_id ? memberMap.get(r.user_id) : undefined;
    const qual = evaluateQualification(r);
    const { formattedDate, formattedTime } = formatCallDateTime(r.call_started_at);

    const transcriptArr = Array.isArray(r.transcript) ? r.transcript : [];
    const summaryText = r.extracted?.office_summary || r.summary || '';
    const snippet = extractSummarySnippet(r);

    const rawRec: CallRecording = {
      id: r.id,
      caseId: r.case_id,
      userId: r.user_id || undefined,
      direction: r.direction || undefined,
      callStartedAt: r.call_started_at,
      durationSec: r.duration_sec || 0,
      storagePath: r.storage_path,
      sizeBytes: Number(r.size_bytes || 0),
      mimeType: r.mime_type || 'audio/mp4',
      sourceApp: r.source_app || undefined,
      status: r.status,
      error: r.error || undefined,
      summary: r.summary || undefined,
      transcript: transcriptArr,
      extracted: r.extracted || undefined,
      storageKind: r.storage_kind === 'gdrive' ? 'gdrive' : 'supabase',
      driveFileId: r.drive_file_id || undefined,
      archiveStatus: r.archive_status || undefined,
      source: r.source || undefined,
      fileName: r.file_name || undefined,
      createdAt: r.created_at,
    };

    return {
      id: r.id,
      caseId: r.case_id,
      customerName: c?.customerName || (r.phone ? maskPhone(r.phone) : '미등록 고객'),
      customerPhone: c?.phone ? maskPhone(c.phone) : maskPhone(r.phone),
      caseStatus: c?.status || '상담 진행',
      inboundPath: c?.inboundPath,

      userId: r.user_id || undefined,
      userName: m?.displayName || (r.user_id ? '상담원' : '미확인'),
      userEmail: m?.email,
      userRole: m?.role,

      callStartedAt: r.call_started_at,
      formattedDate,
      formattedTime,
      durationSec: r.duration_sec || 0,
      durationLabel: fmtDuration(r.duration_sec || 0),
      direction: r.direction === 'CALL_IN' ? 'CALL_IN' : 'CALL_OUT',

      status: r.status,
      qualification: qual,

      summaryText,
      summarySnippet: snippet,
      transcript: transcriptArr,
      transcriptCount: transcriptArr.length,

      hasAudio: Boolean(r.drive_file_id || r.storage_path),
      storageKind: r.storage_kind === 'gdrive' ? 'gdrive' : 'supabase',
      driveFileId: r.drive_file_id || undefined,
      storagePath: r.storage_path,
      fileName: r.file_name || undefined,
      rawRecording: rawRec,
    };
  });

  // 통계 계산 (필터링 전 기간 전체 기준 통계)
  const totalCalls = allItems.length;
  const meaningfulCalls = allItems.filter(i => i.qualification.isMeaningful).length;
  const appointmentCalls = allItems.filter(i => i.qualification.callType === 'appointment').length;
  const totalDurationSec = allItems.reduce((acc, i) => acc + i.durationSec, 0);
  const avgDurationSec = totalCalls > 0 ? Math.round(totalDurationSec / totalCalls) : 0;
  const meaningfulRate = totalCalls > 0 ? Number(((meaningfulCalls / totalCalls) * 100).toFixed(1)) : 0;

  const stats: TeamCallAuditStats = {
    totalCalls,
    meaningfulCalls,
    meaningfulRate,
    appointmentCalls,
    totalDurationSec,
    avgDurationSec,
  };

  // 클라이언트 측 유형 및 검색어 필터링
  let filtered = allItems;

  if (filter.auditType === 'meaningful_only') {
    filtered = filtered.filter(i => i.qualification.isMeaningful);
  } else if (filter.auditType === 'deep') {
    filtered = filtered.filter(i => i.qualification.callType === 'deep_consultation');
  } else if (filter.auditType === 'appointment') {
    filtered = filtered.filter(i => i.qualification.callType === 'appointment');
  } else if (filter.auditType === 'simple') {
    filtered = filtered.filter(i => i.qualification.callType === 'simple_inquiry');
  } else if (filter.auditType === 'skipped') {
    filtered = filtered.filter(i => !i.qualification.isMeaningful || i.status === 'skipped');
  }

  if (filter.searchKeyword && filter.searchKeyword.trim()) {
    const kw = filter.searchKeyword.trim().toLowerCase();
    filtered = filtered.filter(i =>
      i.customerName.toLowerCase().includes(kw) ||
      i.customerPhone.includes(kw) ||
      i.userName.toLowerCase().includes(kw) ||
      i.summarySnippet.toLowerCase().includes(kw) ||
      i.summaryText.toLowerCase().includes(kw)
    );
  }

  return { items: filtered, stats };
}
