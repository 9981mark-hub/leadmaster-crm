import React, { useState, useEffect, useRef } from 'react';
import {
  X, PhoneCall, Clock, User, Sparkles, ListOrdered, Copy, ExternalLink,
  Play, Pause, RotateCcw, Volume2, VolumeX, AlertCircle, Check, Loader2,
  Calendar, ArrowRight, ShieldCheck, Tag
} from 'lucide-react';
import { TeamCallAuditItem } from '../../services/teamCallAudit';
import { getPlayableUrl } from '../../services/recordings';
import { useToast } from '../../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';

interface TeamCallDetailModalProps {
  item: TeamCallAuditItem | null;
  onClose: () => void;
}

export const TeamCallDetailModal: React.FC<TeamCallDetailModalProps> = ({ item, onClose }) => {
  const { showToast } = useToast();
  const navigate = useNavigate();

  // 오디오 플레이어 상태
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(false);

  // 대화록 내 검색어
  const [transcriptSearch, setTranscriptSearch] = useState('');

  // 복사 피드백 상태
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  // 모달 오픈 시 오디오 URL 발급
  useEffect(() => {
    if (!item) {
      setAudioUrl(null);
      setIsPlaying(false);
      return;
    }

    let isMounted = true;
    setCurrentTime(0);
    setDuration(item.durationSec || 0);
    setIsPlaying(false);
    setAudioError(null);

    if (item.hasAudio && item.rawRecording) {
      setAudioLoading(true);
      getPlayableUrl(item.rawRecording)
        .then(url => {
          if (isMounted) {
            setAudioUrl(url);
            setAudioLoading(false);
          }
        })
        .catch(err => {
          if (isMounted) {
            console.warn('[Audio Player] failed to get play url:', err);
            setAudioError(err?.message || '녹음 재생 주소를 발급받지 못했습니다.');
            setAudioLoading(false);
          }
        });
    } else {
      setAudioUrl(null);
    }

    return () => {
      isMounted = false;
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [item]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => {
        showToast('오디오 재생 실패: ' + e.message, 'error');
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = Number(e.target.value);
    setCurrentTime(target);
    if (audioRef.current) {
      audioRef.current.currentTime = target;
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleCopySummary = async () => {
    if (!item.summaryText) {
      showToast('복사할 요약문이 없습니다.');
      return;
    }
    try {
      await navigator.clipboard.writeText(item.summaryText);
      setCopiedSummary(true);
      showToast('AI 요약문이 클립보드에 복사되었습니다.', 'success');
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      showToast('복사에 실패했습니다.', 'error');
    }
  };

  const handleCopyTranscript = async () => {
    if (!item.transcript || item.transcript.length === 0) {
      showToast('복사할 대화록이 없습니다.');
      return;
    }
    try {
      const full = item.transcript
        .map(t => `[${t.t}] ${t.speaker}: ${t.text}`)
        .join('\n');
      await navigator.clipboard.writeText(full);
      setCopiedTranscript(true);
      showToast('대화록 전체가 클립보드에 복사되었습니다.', 'success');
      setTimeout(() => setCopiedTranscript(false), 2000);
    } catch {
      showToast('복사에 실패했습니다.', 'error');
    }
  };

  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // 대화록 필터링
  const filteredTranscript = item.transcript.filter(t => {
    if (!transcriptSearch.trim()) return true;
    return (
      t.text.toLowerCase().includes(transcriptSearch.toLowerCase()) ||
      t.speaker.toLowerCase().includes(transcriptSearch.toLowerCase())
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-6xl max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
        
        {/* 상단 헤더 */}
        <div className="p-4 sm:p-5 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-card shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-2xs shrink-0">
              <PhoneCall size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  {item.customerName} 고객 통화 모니터링
                </h2>
                <span className="text-xs font-mono text-muted-foreground">({item.customerPhone})</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  item.qualification.isMeaningful
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}>
                  {item.qualification.callTypeLabel}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20 font-mono">
                  {item.caseStatus}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 font-mono">
                <span>담당 상담원: <strong className="text-foreground">{item.userName}</strong></span>
                <span>·</span>
                <span>일시: {item.formattedDate}</span>
                <span>·</span>
                <span>통화 시간: {item.durationLabel}</span>
                {item.inboundPath && (
                  <>
                    <span>·</span>
                    <span>유입경로: {item.inboundPath}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                navigate(`/cases/${item.caseId}`);
                onClose();
              }}
              className="px-3.5 py-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl flex items-center gap-1.5 transition-colors border border-primary/20 shadow-2xs cursor-pointer"
            >
              <ExternalLink size={14} /> 고객 상세 열기
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
              title="창 닫기"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 상단 오디오 플레이어 바 */}
        <div className="px-6 py-3 bg-muted/20 border-b border-border">
          {audioLoading ? (
            <div className="flex items-center justify-center gap-2 py-1 text-xs text-primary font-mono">
              <Loader2 size={16} className="animate-spin text-primary" />
              <span>암호화 비공개 저장소에서 녹음 파일을 안전하게 불러오는 중입니다...</span>
            </div>
          ) : audioError ? (
            <div className="flex items-center justify-between text-xs text-amber-500 py-1 font-mono">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={15} />
                <span>녹음 음성 재생 불가: {audioError}</span>
              </div>
              <span className="text-muted-foreground text-xs">(AI 요약문과 대화록 텍스트는 정상 열람 가능합니다)</span>
            </div>
          ) : audioUrl ? (
            <div className="flex flex-wrap items-center gap-3">
              <audio
                ref={audioRef}
                src={audioUrl}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                muted={isMuted}
              />
              <button
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all shadow-2xs cursor-pointer"
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
              </button>

              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <span className="text-xs font-mono text-primary w-10 text-right tabular-nums">
                  {fmtTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="text-xs font-mono text-muted-foreground w-10 tabular-nums">
                  {fmtTime(duration)}
                </span>
              </div>

              {/* 배속 조절 */}
              <div className="flex items-center gap-1 bg-card rounded-lg p-0.5 border border-border shadow-2xs">
                {[1.0, 1.25, 1.5, 2.0].map(rate => (
                  <button
                    key={rate}
                    onClick={() => handleRateChange(rate)}
                    className={`px-2 py-0.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                      playbackRate === rate
                        ? 'bg-primary text-primary-foreground font-bold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {/* 음소거 토글 */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                title={isMuted ? '음소거 해제' : '음소거'}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground py-1 flex items-center gap-1.5 font-mono">
              <AlertCircle size={14} className="text-muted-foreground" />
              <span>보관된 음성 녹음 파일이 없습니다. (AI 텍스트 기록만 보존됨)</span>
            </div>
          )}
        </div>

        {/* 2열 스플릿 본문 (AI 요약문 + STT 대화록) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-5 overflow-y-auto min-h-0 bg-muted/20">
          
          {/* LEFT: AI 요약문 */}
          <div className="flex flex-col bg-card rounded-xl border border-border shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <Sparkles size={16} className="text-primary" />
                <span>AI 상담 요약문</span>
              </div>
              <button
                onClick={handleCopySummary}
                className="px-2.5 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md flex items-center gap-1 transition-colors border border-primary/20 shadow-2xs cursor-pointer"
              >
                {copiedSummary ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedSummary ? '복사됨' : '복사'}</span>
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto max-h-[550px] text-xs text-foreground space-y-3 leading-relaxed">
              {/* 적격성 메모 박스 */}
              {item.qualification.reason && (
                <div className="p-3 bg-muted/40 border border-border rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1">
                    <ShieldCheck size={14} className="text-primary" /> 상담 판정: {item.qualification.callTypeLabel}
                  </div>
                  <p className="text-muted-foreground">{item.qualification.reason}</p>
                  {item.qualification.scheduleNote && (
                    <p className="text-amber-500 font-medium pt-1 border-t border-border font-mono">
                      📅 재통화 약속: {item.qualification.scheduleNote}
                    </p>
                  )}
                </div>
              )}

              {/* 요약문 본문 */}
              {item.summaryText ? (
                <div className="whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                  {item.summaryText}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Sparkles size={36} className="opacity-20" />
                  <p className="text-xs">생성된 AI 요약문이 없습니다.</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: STT 대화록 */}
          <div className="flex flex-col bg-card rounded-xl border border-border shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <ListOrdered size={16} className="text-primary" />
                <span>STT 화자별 대화록</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-normal bg-muted text-muted-foreground border border-border font-mono">
                  발화 {item.transcriptCount}건
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyTranscript}
                  disabled={item.transcriptCount === 0}
                  className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-md flex items-center gap-1 transition-colors disabled:opacity-50 border border-border cursor-pointer shadow-2xs"
                >
                  {copiedTranscript ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedTranscript ? '복사됨' : '전체 복사'}</span>
                </button>
              </div>
            </div>

            {/* 대화록 검색 인풋 */}
            {item.transcriptCount > 0 && (
              <div className="px-4 py-2 border-b border-border bg-card">
                <input
                  type="text"
                  placeholder="대화 내용 검색..."
                  value={transcriptSearch}
                  onChange={e => setTranscriptSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-mono"
                />
              </div>
            )}

            {/* 대화록 버블 리스트 */}
            <div className="flex-1 p-4 overflow-y-auto max-h-[550px] space-y-3 bg-muted/10">
              {item.transcriptCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <ListOrdered size={36} className="opacity-20" />
                  <p className="text-xs">기록된 STT 대화록이 없습니다.</p>
                </div>
              ) : filteredTranscript.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground font-mono">
                  '{transcriptSearch}' 검색 결과가 없습니다.
                </div>
              ) : (
                filteredTranscript.map((t, idx) => {
                  const isAgent = t.speaker.includes('상담원') || t.speaker.includes('Agent');
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-2xs text-muted-foreground font-mono">
                        <span className="font-semibold text-foreground">
                          {isAgent ? `${item.userName} (상담원)` : '고객'}
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">{t.t}</span>
                      </div>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-2xs whitespace-pre-wrap ${
                          isAgent
                            ? 'bg-primary text-primary-foreground rounded-tr-xs font-medium'
                            : 'bg-card text-foreground border border-border rounded-tl-xs'
                        }`}
                      >
                        {t.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 모달 하단 닫기 바 */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-between shrink-0">
          <span className="text-2xs text-muted-foreground font-mono">
            * 통화 녹음과 AI 대화록은 개인정보보호법에 의거하여 회사 안전 비공개 저장소에 암호화 보관됩니다.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};
