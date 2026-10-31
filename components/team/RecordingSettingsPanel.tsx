import React, { useCallback, useEffect, useState } from 'react';
import { Mic, Save, RefreshCw } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  RecordingSettings, RecordingUsage, DEFAULT_RECORDING_SETTINGS, fetchRecordingSettings, fetchRecordingUsage,
  saveRecordingSettings, isNotReadyError, fmtBytes,
} from '../../services/recordings';

/** 팀 관리 → 통화 녹음·AI 정리 설정 + 사용량 */
export default function RecordingSettingsPanel({ orgId }: { orgId: string }) {
  const { showToast } = useToast();
  const [s, setS] = useState<RecordingSettings>(DEFAULT_RECORDING_SETTINGS);
  const [saved, setSaved] = useState<RecordingSettings>(DEFAULT_RECORDING_SETTINGS);
  const [usage, setUsage] = useState<RecordingUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notReady, setNotReady] = useState(false);

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
        <Mic size={18} className="text-gray-400" /><b className="text-gray-700 dark:text-gray-200">통화 녹음·AI 정리</b> 서버 업데이트 후 사용할 수 있습니다.
      </section>
    );
  }
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-2">
        <Mic size={18} className="text-purple-600" />
        <h2 className="font-bold text-gray-800 dark:text-white">통화 녹음 · AI 채무 정리</h2>
        <span className="text-xs text-gray-400">상담원 폰의 통화 녹음을 리드에 붙이고 AI가 채무·소득·재산을 정리</span>
        <button onClick={reload} className="ml-auto text-xs text-gray-500 flex items-center gap-1"><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 새로고침</button>
      </div>
      <div className="p-5 grid lg:grid-cols-2 gap-5">
        <div className="space-y-3 text-sm">
          <label className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
            <input type="checkbox" checked={s.autoUpload} onChange={e => setS({ ...s, autoUpload: e.target.checked })} /> 리드 통화 녹음 자동 업로드
          </label>
          <p className="text-xs text-gray-500 -mt-2">앱이 통화가 끝나면 폰의 통화 녹음 파일(삼성 전화·T전화)을 찾아, <b>리드 번호와의 통화만</b> 회사 전용 비공개 저장소에 올립니다. 상담원 개인 통화는 올리지 않습니다.</p>
          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={s.autoAnalyze} onChange={e => setS({ ...s, autoAnalyze: e.target.checked })} disabled={!s.autoUpload} /> 올리면 바로 AI 정리 (요약·대화록·채무 정리)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-32 text-gray-600 dark:text-gray-300">이보다 짧은 통화 제외</span>
            <input type="number" min={0} max={3600} value={s.minDurationSec} onChange={e => setS({ ...s, minDurationSec: parseInt(e.target.value, 10) || 0 })} className={`${input} w-20`} /> <span className="text-xs text-gray-400">초</span>
          </div>
          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={s.wifiOnly} onChange={e => setS({ ...s, wifiOnly: e.target.checked })} /> 와이파이에서만 올리기 (상담원 데이터 요금 절약)
          </label>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-32 text-gray-600 dark:text-gray-300">녹음 파일 보관</span>
            <input type="number" min={1} max={3650} value={s.retentionDays} onChange={e => setS({ ...s, retentionDays: parseInt(e.target.value, 10) || 30 })} className={`${input} w-20`} /> <span className="text-xs text-gray-400">일 (지나면 파일만 지우고 AI 정리는 남김)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-32 text-gray-600 dark:text-gray-300">하루 AI 정리 상한</span>
            <input type="number" min={0} value={s.dailyAnalyzeCap} onChange={e => setS({ ...s, dailyAnalyzeCap: parseInt(e.target.value, 10) || 0 })} className={`${input} w-24`} /> <span className="text-xs text-gray-400">건 (비용 보호, 넘으면 다음 날)</span>
          </div>
          {usage && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900/30 p-3 text-xs text-gray-600 dark:text-gray-300 grid grid-cols-2 gap-1">
              <span>보관 중 녹음</span><b>{usage.files.toLocaleString()}개 · {fmtBytes(usage.bytes)}</b>
              <span>오늘 올라온 녹음</span><b>{usage.uploadedToday.toLocaleString()}개</b>
              <span>오늘 / 이번 달 AI 정리</span><b>{usage.analyzedToday.toLocaleString()} / {usage.analyzedMonth.toLocaleString()}건</b>
              <span>이번 달 AI 사용량</span><b>입력 {(usage.tokensInMonth / 1e6).toFixed(2)}M · 출력 {(usage.tokensOutMonth / 1e6).toFixed(2)}M 토큰</b>
              {usage.failed7d > 0 && <><span className="text-red-600">최근 7일 실패</span><b className="text-red-600">{usage.failed7d}건</b></>}
            </div>
          )}
          <div className="text-xs text-gray-500">폰 준비: 전화 앱에서 <b>통화 자동 녹음</b> 켜기 → 리드마스터 앱 1.5.0 이상 → 권한 안내 화면에서 <b>음악 및 오디오</b> 허용.</div>
          <div className="flex justify-end">
            <button onClick={save} disabled={busy || !dirty} className="px-4 py-2 text-sm font-bold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-40 flex items-center gap-1"><Save size={14} /> 저장</button>
          </div>
        </div>
      </div>
    </section>
  );
}
