// ============================================
// 통화 녹음 자동 업로드 + AI 채무 정리 (DB: 014_call_recordings.sql, 함수: recording-analyze)
// 앱이 리드 통화 녹음을 올리면 call_recordings에 쌓이고, 웹은 듣기·AI 정리 보기·상담 정보 반영만 한다.
// ============================================
import { supabase } from './supabase';

export const RECORDING_BUCKET = 'call-recordings';

export interface Creditor { name: string | null; kind: string; amount_manwon: number | null; note: string | null; }
export interface ExtractedInfo {
  debt: { total_manwon: number | null; monthly_payment_manwon: number | null; overdue: string | null; creditors: Creditor[] };
  income: { net_monthly_manwon: number | null; salary_manwon: number | null; business_manwon: number | null; freelance_manwon: number | null; job: string | null; job_types: string[]; insurance4: '가입' | '미가입' | null };
  family: { marital_status: '미혼' | '기혼' | '이혼' | null; children_count: number | null; note: string | null };
  housing: { type: '자가' | '전세' | '월세' | '무상거주' | null; detail: '아파트' | '빌라' | '단독주택' | '오피스텔' | '기타' | null; deposit_manwon: number | null; rent_manwon: number | null; deposit_loan_manwon: number | null; own_house_price_manwon: number | null; own_house_loan_manwon: number | null; contractor: '본인' | '배우자' | null };
  assets: { type: string; owner: '본인' | '배우자' | '배우자 공동명의' | null; amount_manwon: number | null; loan_manwon: number | null; desc: string | null }[];
  personal: { birth_year: string | null; gender: '남' | '여' | null; region: string | null };
  credit_card: { use: '사용' | '미사용' | null; amount_manwon: number | null };
  history: string | null;
  special_notes: string | null;
  next_action: string | null;
  customer_intent: string;
  // 거래처 설정 연동 결과
  office_summary?: string | null;          // 사무실 요약문 양식대로 쓴 보고서
  missing_items?: string[];                // 필수 확인 항목 중 통화에서 확인 못 한 것
  classification?: { label: string; reason: string | null } | null;  // 분류 기준에 따른 분류
  case_type_suggestion?: string | null;
}

export interface CallRecording {
  id: string;
  caseId: string;
  userId?: string;
  direction?: 'CALL_IN' | 'CALL_OUT';
  callStartedAt: string;
  durationSec: number;
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
  sourceApp?: string;
  status: 'uploaded' | 'queued' | 'processing' | 'done' | 'failed' | 'skipped';
  error?: string;
  summary?: string;
  transcript?: { t: string; speaker: string; text: string }[];
  extracted?: ExtractedInfo;
  model?: string;
  analyzedAt?: string;
  appliedAt?: string;
  audioDeletedAt?: string;
  createdAt: string;
}

export interface RecordingSettings {
  autoUpload: boolean;
  autoAnalyze: boolean;
  minDurationSec: number;
  retentionDays: number;
  dailyAnalyzeCap: number;
  wifiOnly: boolean;
  exists: boolean;
}
export const DEFAULT_RECORDING_SETTINGS: RecordingSettings = {
  autoUpload: false, autoAnalyze: false, minDurationSec: 40, retentionDays: 30, dailyAnalyzeCap: 300, wifiOnly: false, exists: false,
};

export interface RecordingUsage {
  files: number; bytes: number; total: number; analyzedToday: number; analyzedMonth: number;
  tokensInMonth: number; tokensOutMonth: number; failed7d: number; uploadedToday: number;
}

const need = () => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다');
  return supabase;
};
const fail = (error: any): never => { throw new Error(String(error?.message || error || '알 수 없는 오류')); };
/** 014 적용 전(표·함수 없음)인지 */
export const isNotReadyError = (e: any) => /does not exist|Could not find|schema cache|PGRST20/i.test(String(e?.message || e));

const mapRow = (r: any): CallRecording => ({
  id: r.id, caseId: r.case_id, userId: r.user_id || undefined, direction: r.direction || undefined,
  callStartedAt: r.call_started_at, durationSec: r.duration_sec || 0, storagePath: r.storage_path,
  sizeBytes: Number(r.size_bytes || 0), mimeType: r.mime_type || 'audio/mp4', sourceApp: r.source_app || undefined,
  status: r.status, error: r.error || undefined, summary: r.summary || undefined,
  transcript: Array.isArray(r.transcript) ? r.transcript : undefined, extracted: r.extracted || undefined,
  model: r.model || undefined, analyzedAt: r.analyzed_at || undefined, appliedAt: r.applied_at || undefined,
  audioDeletedAt: r.audio_deleted_at || undefined, createdAt: r.created_at,
});

const LIST_COLS = 'id, case_id, user_id, direction, call_started_at, duration_sec, storage_path, size_bytes, mime_type, source_app, status, error, summary, transcript, extracted, model, analyzed_at, applied_at, audio_deleted_at, created_at';

export const fetchCaseRecordings = async (caseId: string): Promise<CallRecording[]> => {
  const { data, error } = await need().from('call_recordings').select(LIST_COLS)
    .eq('case_id', caseId).order('call_started_at', { ascending: false }).limit(50);
  if (error) fail(error);
  return (data || []).map(mapRow);
};

export const fetchRecording = async (id: string): Promise<CallRecording | null> => {
  const { data, error } = await need().from('call_recordings').select(LIST_COLS).eq('id', id).maybeSingle();
  if (error) fail(error);
  return data ? mapRow(data) : null;
};

/** 듣기용 임시 주소 (1시간) */
export const getRecordingUrl = async (path: string): Promise<string> => {
  const { data, error } = await need().storage.from(RECORDING_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) fail(error || '주소를 만들지 못했습니다');
  return data!.signedUrl;
};

/** AI 정리 요청 (백그라운드에서 진행, 결과는 status로 확인) */
export const requestAnalyze = async (id: string): Promise<{ queued: boolean; reason?: string }> => {
  const { data, error } = await need().functions.invoke('recording-analyze', { body: { recordingId: id } });
  if (error) {
    let msg = error.message;
    try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return { queued: !!data?.queued, reason: data?.reason };
};

export const markRecordingApplied = async (id: string): Promise<void> => {
  const { error } = await need().rpc('mark_recording_applied', { p_id: id });
  if (error) fail(error);
};

export const fetchRecordingSettings = async (): Promise<RecordingSettings> => {
  const { data, error } = await need().from('org_recording_settings').select('*').maybeSingle();
  if (error) fail(error);
  if (!data) return { ...DEFAULT_RECORDING_SETTINGS };
  return {
    autoUpload: !!data.auto_upload, autoAnalyze: !!data.auto_analyze, minDurationSec: data.min_duration_sec,
    retentionDays: data.retention_days, dailyAnalyzeCap: data.daily_analyze_cap, wifiOnly: !!data.wifi_only, exists: true,
  };
};

export const saveRecordingSettings = async (orgId: string, s: RecordingSettings): Promise<void> => {
  const { error } = await need().from('org_recording_settings').upsert({
    org_id: orgId,
    auto_upload: s.autoUpload,
    auto_analyze: s.autoAnalyze,
    min_duration_sec: Math.min(Math.max(Math.round(s.minDurationSec || 0), 0), 3600),
    retention_days: Math.min(Math.max(Math.round(s.retentionDays || 30), 1), 3650),
    daily_analyze_cap: Math.min(Math.max(Math.round(s.dailyAnalyzeCap || 0), 0), 100000),
    wifi_only: s.wifiOnly,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'org_id' });
  if (error) fail(error);
};

export const fetchRecordingUsage = async (): Promise<RecordingUsage> => {
  const { data, error } = await need().rpc('get_recording_usage');
  if (error) fail(error);
  const u = data || {};
  return {
    files: Number(u.files || 0), bytes: Number(u.bytes || 0), total: Number(u.total || 0),
    analyzedToday: Number(u.analyzed_today || 0), analyzedMonth: Number(u.analyzed_month || 0),
    tokensInMonth: Number(u.tokens_in_month || 0), tokensOutMonth: Number(u.tokens_out_month || 0),
    failed7d: Number(u.failed_7d || 0), uploadedToday: Number(u.uploaded_today || 0),
  };
};

export const fmtBytes = (b: number) => b >= 1073741824 ? `${(b / 1073741824).toFixed(2)}GB` : b >= 1048576 ? `${(b / 1048576).toFixed(1)}MB` : `${Math.round(b / 1024)}KB`;
export const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}분 ${String(sec % 60).padStart(2, '0')}초`;
export const fmtManwon = (v: number | null | undefined) => {
  if (v === null || v === undefined) return '-';
  if (v >= 10000) { const eok = Math.floor(v / 10000); const rest = v % 10000; return `${eok}억${rest ? ` ${rest.toLocaleString()}만` : ''}원`; }
  return `${v.toLocaleString()}만원`;
};

/** 리드의 가장 최근 AI 정리 완료 녹음 (텔레그램 전달 기본 글 등) */
export const fetchLatestAnalyzedRecording = async (caseId: string): Promise<CallRecording | null> => {
  const { data, error } = await need().from('call_recordings').select(LIST_COLS)
    .eq('case_id', caseId).eq('status', 'done').order('call_started_at', { ascending: false }).limit(1);
  if (error) return null;
  return data && data[0] ? mapRow(data[0]) : null;
};

/** 통화 녹음 AI 정리 → 텔레그램 전달·메모용 글 */
export const extractedToText = (rec: CallRecording): string => {
  const e = rec.extracted;
  const lines: string[] = [];
  if (rec.summary) lines.push(rec.summary.trim());
  if (e) {
    lines.push('', '[채무 정리]');
    lines.push(`- 총 채무: ${fmtManwon(e.debt.total_manwon)}${e.debt.monthly_payment_manwon ? ` (월 상환 ${fmtManwon(e.debt.monthly_payment_manwon)})` : ''}`);
    e.debt.creditors.forEach(cr => lines.push(`  · ${cr.name || cr.kind}${cr.name ? ` (${cr.kind})` : ''} ${fmtManwon(cr.amount_manwon)}${cr.note ? ` - ${cr.note}` : ''}`));
    if (e.debt.overdue) lines.push(`- 연체: ${e.debt.overdue}`);
    const job = [e.income.job, ...(e.income.job_types || [])].filter(Boolean).join(', ');
    lines.push(`- 소득: ${fmtManwon(e.income.net_monthly_manwon)}${job ? ` (${job})` : ''}${e.income.insurance4 ? `, 4대보험 ${e.income.insurance4}` : ''}`);
    const fam = [e.family.marital_status, e.family.children_count ? `자녀 ${e.family.children_count}명` : '', e.family.note].filter(Boolean).join(', ');
    if (fam) lines.push(`- 가족: ${fam}`);
    const h = e.housing;
    if (h.type) lines.push(`- 주거: ${h.type}${h.detail ? `(${h.detail})` : ''}${h.deposit_manwon ? ` 보증금 ${fmtManwon(h.deposit_manwon)}` : ''}${h.rent_manwon ? ` 월세 ${fmtManwon(h.rent_manwon)}` : ''}${h.own_house_price_manwon ? ` 시세 ${fmtManwon(h.own_house_price_manwon)}` : ''}${h.own_house_loan_manwon ? ` 담보 ${fmtManwon(h.own_house_loan_manwon)}` : ''}`);
    e.assets.forEach(a => lines.push(`- 재산: ${a.type}${a.owner ? `(${a.owner})` : ''} ${fmtManwon(a.amount_manwon)}${a.loan_manwon ? `, 대출 ${fmtManwon(a.loan_manwon)}` : ''}${a.desc ? ` - ${a.desc}` : ''}`));
    if (e.history) lines.push(`- 이력: ${e.history}`);
    if (e.special_notes) lines.push(`- 특이사항: ${e.special_notes}`);
    if (e.next_action) lines.push(`- 다음 할 일: ${e.next_action}`);
  }
  return lines.join('\n').trim();
};
