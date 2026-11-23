import React, { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Download,
  Loader2, Mic, Clock, AlertTriangle, ShieldCheck, Repeat, Volume1, ExternalLink
} from 'lucide-react';
import {
  CallRecording, getPlayableUrl, getRecordingDownloadUrl, getLegacyDrivePlayUrl, fmtBytes
} from '../../services/recordings';
import { logRecordingPlay, logAccess } from '../../services/accessLog';
import { useToast } from '../../contexts/ToastContext';

export interface SmartAudioPlayerRef {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
}

export interface SmartAudioPlayerProps {
  rec?: CallRecording | null;
  src?: string | null;
  file?: File | null;
  fileName?: string;
  caseId?: string;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
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

export const SmartAudioPlayer = forwardRef<SmartAudioPlayerRef, SmartAudioPlayerProps>(({
  rec,
  src,
  file,
  fileName,
  caseId,
  showToast: showToastProp,
  onCurrentTimeChange,
  seekTrigger,
  onSeekHandled
}, ref) => {
  const { showToast: ctxShowToast } = useToast();
  const showToast = useCallback((msg: string, type?: 'success' | 'error') => {
    if (showToastProp) {
      showToastProp(msg, type);
    } else {
      ctxShowToast(msg, type);
    }
  }, [showToastProp, ctxShowToast]);
  const [url, setUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(rec?.durationSec || 0);
  const [speed, setSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  // useImperativeHandle로 외부 seekTo, play, pause 제어 지원
  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, Math.min(seconds, audioRef.current.duration || seconds));
        setCurrentTime(audioRef.current.currentTime);
        if (!isPlaying) {
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      }
    },
    play: () => {
      if (audioRef.current && !isPlaying) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    },
    pause: () => {
      if (audioRef.current && isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  }));

  // 음원 URL 로드 (Supabase Storage 고속 서명 주소 또는 로컬 File / 직전 URL)
  const loadUrl = useCallback(async () => {
    setLoadError(null);

    // 1. 직접 전달된 File 객체가 있는 경우
    if (file) {
      const blobUrl = URL.createObjectURL(file);
      setUrl(blobUrl);
      return;
    }

    // 2. rec(CallRecording) 객체가 있는 경우
    if (rec) {
      if (rec.audioDeletedAt) return;
      setLoadingUrl(true);
      try {
        const u = await getPlayableUrl(rec);
        setUrl(u);
      } catch (e: any) {
        setLoadError(e.message || '녹음 스트리밍 주소를 불러오지 못했습니다.');
        showToast(`녹음을 불러오지 못했습니다: ${e.message}`, 'error');
      } finally {
        setLoadingUrl(false);
      }
      return;
    }

    // 3. 직접 전달된 src URL이 있는 경우
    if (src) {
      // 구글 드라이브 링크 처리
      if (src.includes('drive.google.com')) {
        setLoadingUrl(true);
        try {
          const directPlayUrl = await getLegacyDrivePlayUrl(caseId || rec?.caseId || '', src);
          if (directPlayUrl) {
            setUrl(directPlayUrl);
          } else {
            setUrl(src);
          }
        } catch {
          setUrl(src);
        } finally {
          setLoadingUrl(false);
        }
        return;
      }

      setUrl(src);
    }
  }, [file, rec, src, caseId, showToast]);

  useEffect(() => {
    setUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setLoopA(null);
    setLoopB(null);
    setLoadError(null);

    if (file) {
      loadUrl();
    } else if (rec && !rec.audioDeletedAt) {
      loadUrl();
    } else if (src) {
      loadUrl();
    }

    return () => {
      if (file && url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, [rec?.id, rec?.audioDeletedAt, src, file, loadUrl]);

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
        if (rec) {
          logRecordingPlay(rec.caseId, rec.id);
        }
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
      if (rec) {
        const dlUrl = await getRecordingDownloadUrl(rec);
        logAccess('recording_download', { caseId: rec.caseId, detail: { recording_id: rec.id } });
        const a = document.createElement('a');
        a.href = dlUrl;
        a.download = rec.fileName || `${rec.caseId}_${rec.callStartedAt?.replace(/[:.]/g, '-') || 'recording'}.m4a`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('녹음 파일 다운로드를 시작했습니다.', 'success');
      } else if (file) {
        const dlUrl = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = dlUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(dlUrl);
        showToast('녹음 파일 다운로드를 시작했습니다.', 'success');
      } else if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'recording.m4a';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e: any) {
      showToast(`다운로드 실패: ${e.message}`, 'error');
    } finally {
      setDownloading(false);
    }
  };

  // 만료일 정보 계산
  const getExpirationInfo = () => {
    if (!rec || rec.audioDeletedAt || !rec.expiresAt) return null;
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
  const displayName = rec?.fileName || fileName || file?.name || '통화 녹음 파일';

  if (rec?.audioDeletedAt) {
    return (
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-muted-foreground shrink-0" />
          <span>보관 기간(1년)이 만료되어 오디오 파일이 자동 정리되었습니다. (대화록/요약은 영구 보존)</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">삭제됨</span>
      </div>
    );
  }

  return (
    <div className="bg-card p-4 rounded-xl border border-border shadow-2xs space-y-3 transition-all text-foreground">
      {/* 파일명 표시 헤더 */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Volume2 size={15} strokeWidth={2} />
          </div>
          <span className="text-xs font-semibold text-foreground truncate font-mono">
            {displayName}
          </span>
        </div>
        {rec?.bitrateKbps && (
          <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
            ⚡ {rec.bitrateKbps}kbps AAC
          </span>
        )}
      </div>

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
              onError={() => {
                setIsPlaying(false);
              }}
            />

            {/* 메인 재생/정지 버튼 */}
            <button
              type="button"
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground flex items-center justify-center shrink-0 shadow-2xs transition-all focus:outline-hidden cursor-pointer"
              title={isPlaying ? '일시정지' : '재생'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>

            {/* 5초 전/후 스킵 */}
            <button
              type="button"
              onClick={() => skip(-5)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
              title="5초 뒤로"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              onClick={() => skip(5)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
              title="5초 앞으로"
            >
              <RotateCw size={16} />
            </button>

            {/* 프로그레스 바 & 파형 시뮬레이션 */}
            <div className="flex-1 flex flex-col justify-center gap-1 min-w-[120px]">
              <div
                ref={progressRef}
                onClick={handleSeek}
                className="h-2.5 bg-muted rounded-full overflow-hidden cursor-pointer relative group"
              >
                {/* 진행 바 */}
                <div
                  className="h-full bg-primary group-hover:bg-primary/90 rounded-full transition-all"
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
              <div className="flex items-center justify-between text-2xs font-mono text-muted-foreground px-0.5">
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
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
              title={isMuted ? '음소거 해제' : '음소거'}
            >
              {isMuted ? <VolumeX size={16} className="text-destructive" /> : <Volume2 size={16} />}
            </button>

            {/* 다운로드 버튼 */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0 cursor-pointer shadow-2xs"
              title="녹음 원본 다운로드"
            >
              {downloading ? <Loader2 size={16} className="animate-spin text-primary" /> : <Download size={16} />}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={loadUrl}
            disabled={loadingUrl}
            className="flex-1 py-2 px-3 rounded-lg bg-card border border-border text-foreground text-xs font-medium flex items-center justify-center gap-2 hover:bg-muted transition-colors shadow-2xs cursor-pointer"
          >
            {loadingUrl ? <Loader2 size={15} className="animate-spin text-primary" /> : <Mic size={15} className="text-primary" />}
            <span>{loadingUrl ? '0.1초 고속 스트리밍 연결 중…' : '녹음 듣기'}</span>
          </button>
        )}
      </div>

      {/* 하단 유틸리티 바: 배속 선택, A-B 구간반복, 만료 안내 */}
      {url && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-xs">
          {/* 배속 버튼 그룹 */}
          <div className="flex items-center gap-1">
            <span className="text-2xs text-muted-foreground mr-1">배속:</span>
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeSpeed(s)}
                className={`px-1.5 py-0.5 rounded text-2xs font-mono transition-all cursor-pointer ${
                  speed === s
                    ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                    : 'bg-muted/40 text-muted-foreground hover:text-foreground border border-border hover:bg-muted'
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
              className={`px-2 py-0.5 rounded text-2xs font-medium flex items-center gap-1 border transition-all cursor-pointer shadow-2xs ${
                loopA !== null
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:bg-muted'
              }`}
              title="현재 시점을 구간반복 시작/종료점으로 지정"
            >
              <Repeat size={11} />
              <span>{loopA === null ? '구간반복 A' : loopB === null ? '구간종료 B' : '반복 중'}</span>
            </button>
            {(loopA !== null || loopB !== null) && (
              <button
                type="button"
                onClick={clearLoop}
                className="text-2xs text-muted-foreground hover:text-destructive underline cursor-pointer"
              >
                해제
              </button>
            )}
          </div>

          {/* 보관 및 만료 안내 뱃지 */}
          {expInfo && (
            <div className="flex items-center gap-1 ml-auto">
              {expInfo.isUrgent ? (
                <span className="inline-flex items-center gap-1 text-2xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <AlertTriangle size={11} className="shrink-0" />
                  <span>만료 D-{expInfo.daysLeft} ({expInfo.expDateStr} 삭제 예정)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                  <ShieldCheck size={11} className="text-primary" />
                  <span>1년 보관 (~{expInfo.expDateStr})</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

SmartAudioPlayer.displayName = 'SmartAudioPlayer';
export default SmartAudioPlayer;
