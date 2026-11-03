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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 w-full max-w-6xl max-h-[92vh] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
        
        {/* 상단 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 bg-gray-50/80 dark:bg-gray-800/60">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              <PhoneCall size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {item.customerName} 고객 통화 모니터링
                </h2>
                <span className="text-xs text-gray-500 dark:text-gray-400">({item.customerPhone})</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  item.qualification.isMeaningful
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {item.qualification.callTypeLabel}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {item.caseStatus}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                <span>담당 상담원: <strong className="text-gray-800 dark:text-gray-200">{item.userName}</strong></span>
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
              className="px-3.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg flex items-center gap-1.5 transition-colors border border-blue-200 dark:border-blue-800"
            >
              <ExternalLink size={14} /> 고객 상세 열기
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 상단 오디오 플레이어 바 */}
        <div className="px-6 py-3 bg-purple-50/50 dark:bg-purple-950/20 border-b border-purple-100 dark:border-purple-900/30">
          {audioLoading ? (
            <div className="flex items-center justify-center gap-2 py-1 text-xs text-purple-700 dark:text-purple-300">
              <Loader2 size={16} className="animate-spin" />
              <span>구글 드라이브 비공개 저장소에서 녹음 파일을 안전하게 불러오는 중입니다...</span>
            </div>
          ) : audioError ? (
            <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 py-1">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={15} />
                <span>녹음 음성 재생 불가: {audioError}</span>
              </div>
              <span className="text-gray-400 text-[11px]">(AI 요약문과 대화록 텍스트는 정상 열람 가능합니다)</span>
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
                className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 active:scale-95 transition-all shadow-sm"
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
              </button>

              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <span className="text-xs font-mono text-purple-700 dark:text-purple-300 w-10 text-right">
                  {fmtTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-1.5 bg-purple-200 dark:bg-purple-800 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <span className="text-xs font-mono text-purple-700 dark:text-purple-300 w-10">
                  {fmtTime(duration)}
                </span>
              </div>

              {/* 배속 조절 */}
              <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg p-0.5 border border-purple-200 dark:border-purple-800">
                {[1.0, 1.25, 1.5, 2.0].map(rate => (
                  <button
                    key={rate}
                    onClick={() => handleRateChange(rate)}
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      playbackRate === rate
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {/* 음소거 토글 */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors"
                title={isMuted ? '음소거 해제' : '음소거'}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>
          ) : (
            <div className="text-xs text-gray-500 dark:text-gray-400 py-1 flex items-center gap-1.5">
              <AlertCircle size={14} className="text-gray-400" />
              <span>보관된 음성 녹음 파일이 없습니다. (AI 텍스트 기록만 보존됨)</span>
            </div>
          )}
        </div>

        {/* 2열 스플릿 본문 (AI 요약문 + STT 대화록) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-5 overflow-y-auto min-h-0 bg-gray-100/50 dark:bg-gray-950/40">
          
          {/* LEFT: AI 요약문 */}
          <div className="flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-purple-100 dark:border-purple-900/40 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-purple-50/30 dark:bg-purple-950/10">
              <div className="flex items-center gap-2 font-bold text-sm text-purple-800 dark:text-purple-300">
                <Sparkles size={16} />
                <span>AI 상담 요약문</span>
              </div>
              <button
                onClick={handleCopySummary}
                className="px-2.5 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-md flex items-center gap-1 transition-colors"
              >
                {copiedSummary ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedSummary ? '복사됨' : '복사'}</span>
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto max-h-[550px] text-sm text-gray-800 dark:text-gray-200 space-y-3 leading-relaxed">
              {/* 적격성 메모 박스 */}
              {item.qualification.reason && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1">
                    <ShieldCheck size={14} /> 상담 판정: {item.qualification.callTypeLabel}
                  </div>
                  <p className="text-blue-700 dark:text-blue-400">{item.qualification.reason}</p>
                  {item.qualification.scheduleNote && (
                    <p className="text-amber-700 dark:text-amber-400 font-medium pt-1 border-t border-blue-200 dark:border-blue-900/60">
                      📅 재통화 약속: {item.qualification.scheduleNote}
                    </p>
                  )}
                </div>
              )}

              {/* 요약문 본문 */}
              {item.summaryText ? (
                <div className="whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-200 leading-relaxed">
                  {item.summaryText}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500 gap-2">
                  <Sparkles size={36} className="opacity-20" />
                  <p className="text-xs">생성된 AI 요약문이 없습니다.</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: STT 대화록 */}
          <div className="flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/60 dark:bg-gray-800/40">
              <div className="flex items-center gap-2 font-bold text-sm text-gray-800 dark:text-gray-200">
                <ListOrdered size={16} className="text-blue-600" />
                <span>STT 화자별 대화록</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-normal bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  발화 {item.transcriptCount}건
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyTranscript}
                  disabled={item.transcriptCount === 0}
                  className="px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {copiedTranscript ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedTranscript ? '복사됨' : '전체 복사'}</span>
                </button>
              </div>
            </div>

            {/* 대화록 검색 인풋 */}
            {item.transcriptCount > 0 && (
              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                <input
                  type="text"
                  placeholder="대화 내용 검색..."
                  value={transcriptSearch}
                  onChange={e => setTranscriptSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {/* 대화록 버블 리스트 */}
            <div className="flex-1 p-4 overflow-y-auto max-h-[550px] space-y-3 bg-gray-50/50 dark:bg-gray-900/30">
              {item.transcriptCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500 gap-2">
                  <ListOrdered size={36} className="opacity-20" />
                  <p className="text-xs">기록된 STT 대화록이 없습니다.</p>
                </div>
              ) : filteredTranscript.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
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
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-gray-400">
                        <span className="font-semibold text-gray-600 dark:text-gray-300">
                          {isAgent ? `${item.userName} (상담원)` : '고객'}
                        </span>
                        <span>·</span>
                        <span className="font-mono">{t.t}</span>
                      </div>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-2xs whitespace-pre-wrap ${
                          isAgent
                            ? 'bg-blue-600 text-white rounded-tr-xs'
                            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-tl-xs'
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
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/80 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            * 통화 녹음과 AI 대화록은 개인정보보호법에 의거하여 회사 안전 비공개 저장소에 암호화 보관됩니다.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};
