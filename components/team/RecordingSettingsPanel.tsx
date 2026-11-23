import React, { useCallback, useEffect, useState } from 'react';
import { Mic, Save, RefreshCw, Archive, Download, ShieldCheck } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  RecordingSettings, RecordingUsage, DEFAULT_RECORDING_SETTINGS, fetchRecordingSettings, fetchRecordingUsage,
  saveRecordingSettings, isNotReadyError, fmtBytes,
} from '../../services/recordings';
import DriveConnectionCard from './DriveConnectionCard';
import RecordingBackupCenterModal from '../recordings/RecordingBackupCenterModal';

/** 팀 관리 → 통화 녹음·AI 정리 설정 + 사용량 */
export default function RecordingSettingsPanel({ orgId }: { orgId: string }) {
  const { showToast } = useToast();
  const [s, setS] = useState<RecordingSettings>(DEFAULT_RECORDING_SETTINGS);
  const [saved, setSaved] = useState<RecordingSettings>(DEFAULT_RECORDING_SETTINGS);
  const [usage, setUsage] = useState<RecordingUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [showBackupCenter, setShowBackupCenter] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [st, u] = await Promise.all([fetchRecordingSettings(), fetchRecordingUsage()]);
      setS(st); setSaved(st); setUsage(u); setNotReady(false);
    } catch (e: any) {
      if (isNotReadyError(e)) setNotReady(true);
      else showToast(`녹음 설정을 불러오지 못했습니다: ${e.message}`, 'error');
    } finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { reload(); }, [reload]);

  const dirty = JSON.stringify({ ...s, exists: 0 }) !== JSON.stringify({ ...saved, exists: 0 });
  const save = async () => {
    setBusy(true);
    try {
      await saveRecordingSettings(orgId, s);
      showToast('통화 녹음 설정을 저장했습니다. 앱은 다음 통화부터 따릅니다.', 'success');
      await reload();
    } catch (e: any) {
      showToast(`저장 실패: ${e.message}`, 'error');
    } finally { setBusy(false); }
  };

  const input = 'border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm dark:bg-gray-700 dark:text-white';
  if (notReady) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-5 py-4 flex items-center gap-2 text-sm text-gray-500">
        <Mic size={18} className="text-gray-500 dark:text-gray-400" /><b className="text-gray-700 dark:text-gray-200">통화 녹음·AI 정리</b> 서버 업데이트 후 사용할 수 있습니다.
      </section>
    );
  }
  return (
    <section className="bg-card text-card-foreground rounded-xl border border-border shadow-xs">
      <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-2">
        <Mic size={18} className="text-primary" />
        <h2 className="font-bold text-foreground">통화 녹음 · AI 채무 정리</h2>
        <span className="text-xs text-muted-foreground">상담원 폰의 통화 녹음을 리드에 붙이고 AI가 채무·소득·재산을 정리</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBackupCenter(true)}
            className="px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg border border-primary/20 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Archive size={13} />
            <span>만료 & 백업 센터 (ZIP 다운로드)</span>
          </button>
          <button onClick={reload} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 새로고침</button>
        </div>
      </div>
      <div className="p-5 grid lg:grid-cols-2 gap-5">
        <div className="space-y-3 text-xs">
          <label className="flex items-center gap-2 font-semibold text-foreground cursor-pointer">
            <input type="checkbox" checked={s.autoUpload} onChange={e => setS({ ...s, autoUpload: e.target.checked })} className="accent-primary" /> 리드 통화 녹음 자동 업로드
          </label>
          <p className="text-2xs text-muted-foreground -mt-1 leading-relaxed">앱이 통화가 끝나면 폰의 통화 녹음 파일(삼성 전화·T전화)을 찾아, <b className="text-foreground">리드 번호와의 통화만</b> 회사의 안전한 <b className="text-foreground">Supabase Storage(call-recordings 버킷)</b>에 1년간 암호화 보관합니다. 0.1초 고속 스트리밍 및 대화록 싱크 청취를 지원합니다.</p>
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary flex flex-wrap items-center gap-1.5 shadow-2xs">
            <span className="font-bold shrink-0">⚡ 32kbps AAC 모노 H/W 가속 압축 활성화</span>
            <span className="text-2xs text-primary/80">· 원본 대비 용량 75% 절감 (100GB 무료 한도 1년 보관 완비)</span>
          </div>
          <label className="flex items-center gap-2 text-foreground cursor-pointer">
            <input type="checkbox" checked={s.autoAnalyze} onChange={e => setS({ ...s, autoAnalyze: e.target.checked })} disabled={!s.autoUpload} className="accent-primary" /> 올리면 바로 AI 정리 (요약·대화록·채무 정리)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-32 text-muted-foreground">이보다 짧은 통화 제외</span>
            <input type="number" min={0} max={3600} value={s.minDurationSec} onChange={e => setS({ ...s, minDurationSec: parseInt(e.target.value, 10) || 0 })} className={`${input} w-20 font-mono`} /> <span className="text-2xs text-muted-foreground">초</span>
          </div>
          <label className="flex items-center gap-2 text-foreground cursor-pointer">
            <input type="checkbox" checked={s.wifiOnly} onChange={e => setS({ ...s, wifiOnly: e.target.checked })} className="accent-primary" /> 와이파이에서만 올리기 (상담원 데이터 요금 절약)
          </label>
        </div>
        <div className="space-y-3 text-xs">
          {/* 데이터 및 녹음 보관 기간 설정 (6개월, 1년, 2년 선택) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-32 text-muted-foreground">데이터 보존 기간</span>
            <select
              value={s.retentionDays || 365}
              onChange={e => setS({ ...s, retentionDays: parseInt(e.target.value, 10) || 365 })}
              className={`${input} font-medium`}
            >
              <option value={180}>6개월 (180일)</option>
              <option value={365}>1년 (365일 - 기본값)</option>
              <option value={730}>2년 (730일 - 법적 권장)</option>
              {s.retentionDays && ![180, 365, 730].includes(s.retentionDays) && (
                <option value={s.retentionDays}>
                  {s.retentionDays === 3650 ? '10년 (3650일 - 기존 설정)' : `${s.retentionDays}일 (기존 설정)`}
                </option>
              )}
            </select>
            <span className="text-2xs text-muted-foreground">설정 기간 경과 시 자동 정리</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-32 text-muted-foreground">하루 AI 정리 상한</span>
            <input type="number" min={0} value={s.dailyAnalyzeCap} onChange={e => setS({ ...s, dailyAnalyzeCap: parseInt(e.target.value, 10) || 0 })} className={`${input} w-24 font-mono`} /> <span className="text-2xs text-muted-foreground">건 (비용 보호, 넘으면 다음 날)</span>
          </div>
          {usage && (
            <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground grid grid-cols-2 gap-1 font-mono">
              <span>스토리지 보관 녹음</span><b className="text-foreground">{usage.files.toLocaleString()}개 · {fmtBytes(usage.bytes)}</b>
              <span>오늘 올라온 녹음</span><b className="text-foreground">{usage.uploadedToday.toLocaleString()}개</b>
              <span>오늘 / 이번 달 AI 정리</span><b className="text-foreground">{usage.analyzedToday.toLocaleString()} / {usage.analyzedMonth.toLocaleString()}건</b>
              <span>이번 달 AI 사용량</span><b className="text-foreground">입력 {(usage.tokensInMonth / 1e6).toFixed(2)}M · 출력 {(usage.tokensOutMonth / 1e6).toFixed(2)}M 토큰</b>
              {usage.failed7d > 0 && <><span className="text-destructive font-bold">최근 7일 실패</span><b className="text-destructive font-bold">{usage.failed7d}건</b></>}
            </div>
          )}
          <div className="text-2xs text-muted-foreground">폰 준비: 전화 앱에서 <b className="text-foreground">통화 자동 녹음</b> 켜기 → 리드마스터 앱 1.6.0 이상 → 권한 안내 화면에서 <b className="text-foreground">음악 및 오디오</b> 허용.</div>
          <div className="flex justify-end">
            <button onClick={save} disabled={busy || !dirty} className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-40 flex items-center gap-1 shadow-2xs cursor-pointer"><Save size={13} /> 저장</button>
          </div>
        </div>
      </div>
      <div className="px-5 pb-5">
        <DriveConnectionCard />
      </div>

      <RecordingBackupCenterModal
        orgId={orgId}
        isOpen={showBackupCenter}
        onClose={() => setShowBackupCenter(false)}
        showToast={showToast}
      />
    </section>
  );
}
