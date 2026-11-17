import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Download,
  Loader2, Mic, Clock, AlertTriangle, ShieldCheck, Repeat
} from 'lucide-react';
import { CallRecording, getPlayableUrl, getRecordingDownloadUrl, fmtBytes } from '../../services/recordings';
import { logRecordingPlay, logAccess } from '../../services/accessLog';

interface Props {
  rec: CallRecording;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onCurrentTimeChange?: (timeSec: number) => void;
  seekTrigger?: number | null;
  onSeekHandled?: () => void;
}

const SPEED_OPTIONS = [0.8, 1.0, 1.25, 1.5, 1.75, 2.0];

const fmtTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export default function SmartAudioPlayer({
  rec,
  showToast,
  onCurrentTimeChange,
  seekTrigger,
  onSeekHandled
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(rec.durationSec || 0);
  const [speed, setSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  // 음원 URL 로드 (Supabase Storage 고속 서명 주소)
  const loadUrl = useCallback(async () => {
    if (rec.audioDeletedAt) return;
    setLoadingUrl(true);
    try {
      const u = await getPlayableUrl(rec);
      setUrl(u);
    } catch (e: any) {
      showToast(`녹음을 불러오지 못했습니다: ${e.message}`, 'error');
    } finally {
      setLoadingUrl(false);
    }
  }, [rec, showToast]);

  useEffect(() => {
    setUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setLoopA(null);
    setLoopB(null);
    if (!rec.audioDeletedAt) {
      loadUrl();
    }
  }, [rec.id, rec.audioDeletedAt, loadUrl]);

  // 외부(대화록 클릭 등)에서 시간 탐색 요청 처리
  useEffect(() => {
    if (seekTrigger !== null && seekTrigger !== undefined && audioRef.current) {
      audioRef.current.currentTime = seekTrigger;
      setCurrentTime(seekTrigger);
      if (!isPlaying) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
      onSeekHandled?.();
    }
  }, [seekTrigger, isPlaying, onSeekHandled]);

  // 재생 / 일시정지 토글
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
        logRecordingPlay(rec.caseId, rec.id);
      }).catch((err) => {
        showToast(`재생 실패: ${err.message}`, 'error');
      });
    }
  };

  // 5초 앞뒤 이동
  const skip = (deltaSec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Math.max(0, Math.min(audio.currentTime + deltaSec, duration));
    audio.currentTime = target;
    setCurrentTime(target);
  };

  // 배속 설정
  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (audioRef.current) {
      audioRef.current.playbackRate = s;
    }
  };

  // 타임라인 클릭 이동
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current || duration <= 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const target = (pos / rect.width) * duration;
    audioRef.current.currentTime = target;
    setCurrentTime(target);
  };

  // A-B 구간 반복
  const toggleLoopA = () => {
    if (loopA !== null && loopB === null) {
      setLoopB(currentTime);
      showToast(`A-B 구간반복 설정: ${fmtTime(loopA)} ~ ${fmtTime(currentTime)}`, 'success');
    } else {
      setLoopA(currentTime);
      setLoopB(null);
      showToast(`구간 A 시작점 지정: ${fmtTime(currentTime)}`, 'success');
    }
  };

  const clearLoop = () => {
    setLoopA(null);
    setLoopB(null);
    showToast('구간반복이 해제되었습니다.', 'success');
  };

  // 단건 녹음 파일 다운로드
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const dlUrl = await getRecordingDownloadUrl(rec);
      logAccess('recording_download', { caseId: rec.caseId, detail: { recording_id: rec.id } });
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = rec.fileName || `${rec.caseId}_${rec.callStartedAt?.replace(/[:.]/g, '-') || 'recording'}.m4a`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('녹음 파일 다운로드를 시작했습니다.', 'success');
    } catch (e: any) {
      showToast(`다운로드 실패: ${e.message}`, 'error');
    } finally {
      setDownloading(false);
    }
  };

  // 만료일 정보 계산
  const getExpirationInfo = () => {
    if (rec.audioDeletedAt) return null;
    if (!rec.expiresAt) return null;
    const exp = new Date(rec.expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      expDateStr: `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, '0')}-${String(exp.getDate()).padStart(2, '0')}`,
      daysLeft: diffDays,
      isUrgent: diffDays <= 30
    };
  };

  const expInfo = getExpirationInfo();

  if (rec.audioDeletedAt) {
    return (
      <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/80 p-3 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-gray-400 shrink-0" />
          <span>보관 기간(1년)이 만료되어 오디오 파일이 자동 정리되었습니다. (대화록/요약은 영구 보존)</span>
        </div>
        <span className="text-[11px] text-gray-400 font-mono">삭제됨</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/90 dark:bg-gray-900/60 p-3.5 rounded-2xl border border-slate-200/90 dark:border-gray-800 shadow-xs space-y-2.5 transition-all">
      {/* 상단 컨트롤 바: 재생 버튼 + 타임라인 + 시간 표시 + 다운로드 */}
      <div className="flex items-center gap-2.5">
        {url ? (
          <>
            <audio
              ref={audioRef}
              preload="metadata"
              src={url}
              onTimeUpdate={() => {
                if (!audioRef.current) return;
                const cur = audioRef.current.currentTime;
                setCurrentTime(cur);
                onCurrentTimeChange?.(cur);

                // A-B 구간반복 처리
                if (loopA !== null && loopB !== null && cur >= loopB) {
                  audioRef.current.currentTime = loopA;
                }
              }}
              onLoadedMetadata={() => {
                if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
                  setDuration(audioRef.current.duration);
                }
              }}
              onEnded={() => {
                setIsPlaying(false);
                if (loopA !== null && loopB !== null && audioRef.current) {
                  audioRef.current.currentTime = loopA;
                  audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                }
              }}
            />

            {/* 메인 재생/정지 버튼 */}
            <button
              type="button"
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shrink-0 shadow-sm transition-all focus:outline-hidden"
              title={isPlaying ? '일시정지 (Space)' : '재생 (Space)'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>

            {/* 5초 전/후 스킵 */}
            <button
              type="button"
              onClick={() => skip(-5)}
              className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-800 transition-colors shrink-0"
              title="5초 뒤로 (J 또는 ←)"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              onClick={() => skip(5)}
              className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-800 transition-colors shrink-0"
              title="5초 앞으로 (L 또는 →)"
            >
              <RotateCw size={16} />
            </button>

            {/* 프로그레스 바 & 파형 시뮬레이션 */}
            <div className="flex-1 flex flex-col justify-center gap-1 min-w-[120px]">
              <div
                ref={progressRef}
                onClick={handleSeek}
                className="h-2.5 bg-slate-200 dark:bg-gray-800 rounded-full overflow-hidden cursor-pointer relative group"
              >
                {/* 진행 바 */}
                <div
                  className="h-full bg-blue-600 group-hover:bg-blue-500 rounded-full transition-all"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
                {/* A-B 구간 표시 */}
                {loopA !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-amber-500 z-10"
                    style={{ left: `${(loopA / duration) * 100}%` }}
                    title={`A점: ${fmtTime(loopA)}`}
                  />
                )}
                {loopB !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-amber-500 z-10"
                    style={{ left: `${(loopB / duration) * 100}%` }}
                    title={`B점: ${fmtTime(loopB)}`}
                  />
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-gray-500 dark:text-gray-400 px-0.5">
                <span>{fmtTime(currentTime)}</span>
                <span>{fmtTime(duration)}</span>
              </div>
            </div>

            {/* 음소거 토글 */}
            <button
              type="button"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors shrink-0"
              title={isMuted ? '음소거 해제' : '음소거'}
            >
              {isMuted ? <VolumeX size={16} className="text-red-500" /> : <Volume2 size={16} />}
            </button>

            {/* 다운로드 버튼 */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition-all shrink-0"
              title="녹음 원본 다운로드"
            >
              {downloading ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <Download size={16} />}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={loadUrl}
            disabled={loadingUrl}
            className="flex-1 py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            {loadingUrl ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />}
            <span>{loadingUrl ? '0.1초 고속 스트리밍 연결 중…' : '녹음 듣기'}</span>
          </button>
        )}
      </div>

      {/* 하단 유틸리티 바: 배속 선택, A-B 구간반복, 1년 보관 만료 안내 */}
      {url && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-gray-800/60 text-xs">
          {/* 배속 버튼 그룹 */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-gray-400 mr-1">배속:</span>
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeSpeed(s)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-all ${
                  speed === s
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* A-B 구간반복 제어 */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleLoopA}
              className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 border transition-all ${
                loopA !== null
                  ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
              }`}
              title="현재 시점을 구간반복 시작/종료점으로 지정"
            >
              <Repeat size={12} />
              <span>{loopA === null ? '구간반복 A' : loopB === null ? '구간종료 B' : '반복 중'}</span>
            </button>
            {(loopA !== null || loopB !== null) && (
              <button
                type="button"
                onClick={clearLoop}
                className="text-[11px] text-gray-400 hover:text-red-500 underline"
              >
                해제
              </button>
            )}
          </div>

          {/* 보관 및 만료 안내 뱃지 */}
          {expInfo && (
            <div className="flex items-center gap-1 ml-auto">
              {expInfo.isUrgent ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                  <AlertTriangle size={12} className="shrink-0" />
                  <span>만료 D-{expInfo.daysLeft} ({expInfo.expDateStr} 삭제 예정)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                  <ShieldCheck size={12} className="text-green-500" />
                  <span>1년 보관 (~{expInfo.expDateStr})</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
