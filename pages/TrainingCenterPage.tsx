import React, { useState, useEffect, useRef } from 'react';
import {
  TRAINING_PERSONAS,
  TrainingPersona,
  TrainingMessage,
  TrainingReport,
  TrainingSessionRecord,
  loadTrainingHistory,
  saveTrainingSession,
  generateAiCustomerReply,
  evaluateTrainingCall,
} from '../services/trainingService';
import { speechService } from '../services/speechService';
import { TrainingReportModal } from '../components/training/TrainingReportModal';
import {
  GraduationCap,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  Award,
  RotateCcw,
  Clock,
  User,
  Building,
  CreditCard,
  Home,
  CheckCircle,
  HelpCircle,
  ChevronRight,
  Flame,
  Check,
  AlertCircle,
  Save,
  Calendar,
  Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function TrainingCenterPage() {
  const { org } = useAuth();
  const { showToast } = useToast();

  // Selected persona & history
  const [selectedPersona, setSelectedPersona] = useState<TrainingPersona>(TRAINING_PERSONAS[0]);
  const [history, setHistory] = useState<TrainingSessionRecord[]>([]);

  // Call state: 'idle' | 'calling' | 'connected' | 'evaluating' | 'ended'
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'evaluating' | 'ended'>('idle');
  const [callDuration, setCallDuration] = useState<number>(0);
  const timerRef = useRef<any>(null);

  // Chat & Speech state
  const [messages, setMessages] = useState<TrainingMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [useNeuralVoice, setUseNeuralVoice] = useState(true);
  const [isPhoneFilterEnabled, setIsPhoneFilterEnabled] = useState(true);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.1); // 기본 +10% 가속 템포
  const [isAiReplying, setIsAiReplying] = useState(false);

  // 캐릭터 기본 억양에 사용자 지정 속도를 합성하는 헬퍼 (+10%, +25% 등)
  const getAdjustedRate = (baseRateStr: string = '+10%', multiplier: number): string => {
    const baseNum = parseInt(baseRateStr.replace(/[%+]/g, ''), 10) || 0;
    const offset = Math.round((multiplier - 1.0) * 100);
    const total = baseNum + offset;
    return total >= 0 ? `+${total}%` : `${total}%`;
  };

  // Smart Silence & Fast Trigger Refs
  const silenceTimerRef = useRef<any>(null);
  const interimTextRef = useRef<string>('');
  const isAiReplyingRef = useRef<boolean>(false);

  // Sync isAiReplying with ref
  useEffect(() => {
    isAiReplyingRef.current = isAiReplying;
  }, [isAiReplying]);

  // Sandbox Memo & Outcome state
  const [consultationResult, setConsultationResult] = useState<string>('재통화예정');
  const [agentMemo, setAgentMemo] = useState<string>('');
  const [reminderDate, setReminderDate] = useState<string>('');
  const [isMemoSaved, setIsMemoSaved] = useState<boolean>(false);

  // Evaluation & Modal state
  const [currentReport, setCurrentReport] = useState<TrainingReport | null>(null);
  const [currentSessionRecord, setCurrentSessionRecord] = useState<TrainingSessionRecord | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load training history on mount
  useEffect(() => {
    setHistory(loadTrainingHistory());
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimText, isAiReplying]);

  // Call timer effect
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Clean up speech and timers on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      speechService.stopListening();
      speechService.stopSpeaking();
    };
  }, []);

  // Spacebar 단축키: 통화 중 스페이스바를 누르면 발화 중간 텍스트 즉시 대답 요청 (0초 반응)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if (e.code === 'Space' && !isInputFocused && callState === 'connected' && !isAiReplyingRef.current) {
        const textToSend = (interimTextRef.current || inputText).trim();
        if (textToSend) {
          e.preventDefault();
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          setInterimText('');
          interimTextRef.current = '';
          handleSendAgentMessage(textToSend);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callState, inputText]);

  // Start Call Simulation
  const handleStartCall = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setCallState('calling');
    setCallDuration(0);
    setMessages([]);
    setInputText('');
    setInterimText('');
    interimTextRef.current = '';
    setIsMemoSaved(false);
    setAgentMemo('');

    // Simulate ringtone delay (1.2s)
    setTimeout(() => {
      setCallState('connected');
      const firstMsg: TrainingMessage = {
        id: 'msg-' + Date.now(),
        speaker: 'customer',
        text: selectedPersona.initialMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
      setMessages([firstMsg]);

      // Speak AI customer first message
      if (isTtsEnabled) {
        speechService.speak(firstMsg.text, {
          ...selectedPersona.speechOptions,
          rate: (selectedPersona.speechOptions.rate || 1.25) * speedMultiplier,
          neuralRate: getAdjustedRate(selectedPersona.speechOptions.neuralRate, speedMultiplier),
        });
      }

      // Automatically enable mic if available
      toggleMicrophone(true);
    }, 1200);
  };

  // Toggle Microphone (스마트 침묵 감지: 500ms(0.5초) 침묵 시 즉시 전송)
  const toggleMicrophone = (forceStart?: boolean) => {
    const shouldStart = forceStart !== undefined ? forceStart : !isMicActive;

    if (shouldStart) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      const started = speechService.startListening(
        (transcript, isFinal) => {
          if (isAiReplyingRef.current) return;

          if (isFinal) {
            // 브라우저 공식 발화 종료 이벤트
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
            const text = transcript.trim();
            setInterimText('');
            interimTextRef.current = '';
            if (text) {
              handleSendAgentMessage(text);
            }
          } else {
            // 중간 인식 텍스트 실시간 반영
            setInterimText(transcript);
            interimTextRef.current = transcript;

            // [핵심 가속] 스마트 침묵 감지: 발화 멈춘 후 500ms(0.5초) 지나면 브라우저 대기 없이 즉시 전송!
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              const text = interimTextRef.current.trim();
              if (text && !isAiReplyingRef.current) {
                setInterimText('');
                interimTextRef.current = '';
                handleSendAgentMessage(text);
              }
            }, 500);
          }
        },
        (err) => {
          console.warn('Mic error or denied:', err);
          setIsMicActive(false);
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        },
        () => {
          setIsMicActive(false);
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        }
      );
      setIsMicActive(started);
    } else {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      speechService.stopListening();
      setIsMicActive(false);
      setInterimText('');
      interimTextRef.current = '';
    }
  };

  // Send message from agent (via voice or text)
  const handleSendAgentMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isAiReplying) return;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const agentMsg: TrainingMessage = {
      id: 'msg-' + Date.now(),
      speaker: 'agent',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    const nextMessages = [...messages, agentMsg];
    setMessages(nextMessages);
    setInputText('');
    setInterimText('');
    interimTextRef.current = '';
    setIsAiReplying(true);

    try {
      // Generate customer AI reply (초고속 단문 티키타카)
      const replyText = await generateAiCustomerReply(nextMessages, selectedPersona);

      const customerMsg: TrainingMessage = {
        id: 'msg-' + (Date.now() + 1),
        speaker: 'customer',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      setMessages(prev => [...prev, customerMsg]);

      // Speak reply if TTS enabled
      if (isTtsEnabled) {
        await speechService.speak(replyText, {
          ...selectedPersona.speechOptions,
          rate: (selectedPersona.speechOptions.rate || 1.25) * speedMultiplier,
          neuralRate: getAdjustedRate(selectedPersona.speechOptions.neuralRate, speedMultiplier),
        });
      }
    } catch (e) {
      console.error('Error generating AI reply:', e);
    } finally {
      setIsAiReplying(false);
    }
  };

  // End Call & Trigger AI Assessment
  const handleEndCall = async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    speechService.stopListening();
    speechService.stopSpeaking();
    setIsMicActive(false);
    setInterimText('');
    interimTextRef.current = '';

    if (messages.length < 2) {
      setCallState('idle');
      showToast('대화가 너무 짧아 평가를 생성하지 않았습니다.', 'info');
      return;
    }

    setCallState('evaluating');

    try {
      const report = await evaluateTrainingCall(messages, selectedPersona);
      const sessionRecord: TrainingSessionRecord = {
        sessionId: 'session-' + Date.now(),
        personaId: selectedPersona.id,
        date: new Date().toISOString(),
        durationSeconds: callDuration,
        totalTurns: messages.length,
        report,
        consultationResult,
        agentMemo,
      };

      saveTrainingSession(sessionRecord);
      setHistory(loadTrainingHistory());

      setCurrentReport(report);
      setCurrentSessionRecord(sessionRecord);
      setCallState('ended');
      setShowModal(true);
    } catch (err) {
      console.error('Evaluation failed:', err);
      setCallState('ended');
      showToast('평가 리포트 생성 중 오류가 발생했습니다.', 'error');
    }
  };

  // Format Duration
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate persona best score
  const getPersonaBestScore = (personaId: string) => {
    const records = history.filter(h => h.personaId === personaId);
    if (records.length === 0) return null;
    return Math.max(...records.map(r => r.report.totalScore));
  };

  // Total passed personas count
  const passedCount = TRAINING_PERSONAS.filter(p => {
    const best = getPersonaBestScore(p.id);
    return best !== null && best >= 75;
  }).length;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12 pt-2">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-yellow-300">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">신입 상담원 AI 트레이닝 센터</h1>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 font-medium">
                안전한 샌드박스 모드
              </span>
            </div>
            <p className="text-xs text-blue-100/80 mt-1">
              실제 고객 DB와 100% 분리된 연습 환경에서 4단계 난이도의 AI 가상 고객과 실전 롤플레잉 및 코칭을 진행합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur border border-white/10 text-center">
            <span className="text-[10px] block text-blue-200">훈련 이수율</span>
            <span className="text-sm font-extrabold text-white">
              {passedCount} / {TRAINING_PERSONAS.length} 완료
            </span>
          </div>
          {history.length > 0 && (
            <button
              onClick={() => {
                if (confirm('훈련 기록을 모두 초기화하시겠습니까?')) {
                  localStorage.removeItem('lm_training_sessions');
                  setHistory([]);
                  showToast('훈련 기록이 초기화되었습니다.', 'info');
                }
              }}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              title="훈련 기록 초기화"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left Scenario List / Right Sandbox Call Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: 4 Scenarios List (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between">
            <span>시나리오 & 고객 페르소나</span>
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">난이도별 4단계</span>
          </h2>

          <div className="space-y-2.5">
            {TRAINING_PERSONAS.map(persona => {
              const bestScore = getPersonaBestScore(persona.id);
              const isSelected = selectedPersona.id === persona.id;
              const isPassed = bestScore !== null && bestScore >= 75;

              return (
                <div
                  key={persona.id}
                  onClick={() => {
                    if (callState === 'connected') {
                      if (!confirm('현재 통화를 중단하고 다른 시나리오로 변경하시겠습니까?')) return;
                      speechService.stopListening();
                      speechService.stopSpeaking();
                      setCallState('idle');
                    }
                    setSelectedPersona(persona);
                    setMessages([]);
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                        persona.level === 1 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                        persona.level === 2 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                        persona.level === 3 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                        'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                      }`}>
                        {persona.badge}
                      </span>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                        {persona.customerName} ({persona.age}세)
                      </h3>
                    </div>

                    {bestScore !== null ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        isPassed
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                      }`}>
                        {bestScore}점 {isPassed ? '✓' : ''}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">미응시</span>
                    )}
                  </div>

                  <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                    {persona.scenarioDescription}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="truncate max-w-[200px]">🎯 {persona.trainingGoal}</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center">
                      선택 <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Voice Settings */}
          <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                음성 엔진 설정
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold">
                무제한 무료 (₩0)
              </span>
            </div>

            {/* Neural Voice Toggle */}
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
              <span className="font-medium text-[11px]">Google Neural2 고음질</span>
              <button
                onClick={() => {
                  const next = !useNeuralVoice;
                  setUseNeuralVoice(next);
                  speechService.setUseNeuralVoice(next);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  useNeuralVoice
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                {useNeuralVoice ? 'Google Neural2 ON' : '기본 브라우저'}
              </button>
            </div>

            {/* Telephone Filter Toggle */}
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-400 pt-1.5 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-col">
                <span className="font-medium text-[11px] flex items-center gap-1">
                  📞 전화 수화기 음질 필터
                </span>
                <span className="text-[9px] text-gray-400">실제 스마트폰 통화 주파수(300~3400Hz) 모사</span>
              </div>
              <button
                onClick={() => {
                  const next = !isPhoneFilterEnabled;
                  setIsPhoneFilterEnabled(next);
                  speechService.setUsePhoneFilter(next);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                  isPhoneFilterEnabled
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                }`}
              >
                {isPhoneFilterEnabled ? '필터 ON' : '원음'}
              </button>
            </div>

            {/* TTS Mute Toggle */}
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-400 pt-1.5 border-t border-gray-200 dark:border-gray-700">
              <span>AI 음성 발화 (TTS)</span>
              <button
                onClick={() => setIsTtsEnabled(!isTtsEnabled)}
                className={`p-1 rounded-lg ${isTtsEnabled ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-200 text-gray-500'}`}
              >
                {isTtsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>

            {/* Speed Multiplier */}
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-400 pt-1.5 border-t border-gray-200 dark:border-gray-700">
              <span className="font-medium text-[11px]">말소리 속도</span>
              <div className="flex items-center gap-1">
                {[
                  { label: '표준', val: 1.0 },
                  { label: '자연스러움 (+10%)', val: 1.1 },
                  { label: '실전 (+25%)', val: 1.25 },
                ].map(opt => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setSpeedMultiplier(opt.val)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      speedMultiplier === opt.val
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Voice Badge */}
            <div className="p-2 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 text-[10px] text-blue-800 dark:text-blue-300 leading-snug">
              {useNeuralVoice ? (
                <div>
                  <div className="font-semibold text-blue-900 dark:text-blue-200 flex items-center justify-between">
                    <span>🌟 고음질 사람 신경망 보이스 (결제 불필요)</span>
                    <span className="font-mono text-blue-700 dark:text-blue-300 font-bold">
                      {getAdjustedRate(selectedPersona.speechOptions.neuralRate, speedMultiplier)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-blue-600 dark:text-blue-400">
                    {selectedPersona.customerName} ({selectedPersona.speechOptions.gender === 'female' ? '여성 페르소나' : '남성 페르소나'}) • 실제 통화 필터 {isPhoneFilterEnabled ? '적용됨' : '원음'}
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 dark:text-gray-400">
                  브라우저 로컬 Web Speech 엔진 (기본 기계음)
                </div>
              )}
            </div>

            {/* Test Voice Button */}
            <button
              type="button"
              onClick={async () => {
                const sampleText = selectedPersona.initialMessage;
                const engine = await speechService.speak(sampleText, {
                  ...selectedPersona.speechOptions,
                  rate: (selectedPersona.speechOptions.rate || 1.25) * speedMultiplier,
                  neuralRate: getAdjustedRate(selectedPersona.speechOptions.neuralRate, speedMultiplier),
                });
                if (engine === 'neural') {
                  showToast('🌟 실제 사람 신경망 목소리(고음질 사람 음성 + 전화 수화기 필터)로 재생되었습니다.', 'success');
                } else {
                  showToast('⚠️ 브라우저 기본 로컬 엔진(전화기 필터 적용)으로 재생되었습니다.', 'info');
                }
              }}
              className="w-full py-2 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors border border-blue-200/60 dark:border-blue-800/40"
            >
              <Volume2 className="w-3.5 h-3.5" />
              🔊 {selectedPersona.customerName} 목소리 1초 미리듣기
            </button>
          </div>
        </div>

        {/* Right: Mock Call Studio + Sandbox Workspace (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Active Call Header Controller */}
          <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                callState === 'connected' ? 'bg-emerald-500 animate-ping' :
                callState === 'calling' ? 'bg-amber-500 animate-pulse' :
                callState === 'evaluating' ? 'bg-purple-500 animate-spin' :
                'bg-gray-300 dark:bg-gray-600'
              }`} />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {selectedPersona.customerName}
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {selectedPersona.phone}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium">
                    {selectedPersona.title}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {callState === 'connected' ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> 통화 연결 중: {formatTime(callDuration)}
                    </span>
                  ) : callState === 'calling' ? (
                    <span className="text-amber-600 dark:text-amber-400">가상 전화 신호 가는 중...</span>
                  ) : callState === 'evaluating' ? (
                    <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" /> AI 통화 분석 및 코칭 리포트 작성 중...
                    </span>
                  ) : (
                    <span>통화 대기 상태 (준비 완료 시 통화 시작 버튼을 누르세요)</span>
                  )}
                </p>
              </div>
            </div>

            {/* Call Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {callState === 'idle' || callState === 'ended' ? (
                <button
                  onClick={handleStartCall}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02]"
                >
                  <PhoneCall className="w-4 h-4" />
                  가상 통화 시작
                </button>
              ) : callState === 'connected' ? (
                <button
                  onClick={handleEndCall}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/20 transition-all hover:scale-[1.02]"
                >
                  <PhoneOff className="w-4 h-4" />
                  통화 종료 & AI 채점
                </button>
              ) : null}
            </div>
          </div>

          {/* Split Screen: Transcript / Sandbox Client Profile */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Live Chat & Transcript (7 Cols) */}
            <div className="md:col-span-7 flex flex-col h-[480px] rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-blue-500" />
                  실시간 모의 통화 대화록
                </span>
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium border border-emerald-200/60 dark:border-emerald-800/40">
                    <Zap className="w-3 h-3 text-emerald-500" />
                    0.5초 스마트 침묵 감지
                  </span>
                  <span className="text-[11px] text-gray-400">
                    단축키: [Space] 즉시 대답
                  </span>
                </div>
              </div>

              {/* Chat Bubble Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <PhoneCall className="w-10 h-10 mb-2 stroke-1 text-gray-300 dark:text-gray-600" />
                    <p className="text-xs font-medium">가상 통화 시작 버튼을 누르면</p>
                    <p className="text-xs text-gray-500 mt-0.5">고객과의 실전 대화가 시작됩니다.</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.speaker === 'agent' ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                          {msg.speaker === 'agent' ? '나 (상담원)' : `고객 (${selectedPersona.customerName})`}
                        </span>
                        <span className="text-[10px] text-gray-400">{msg.timestamp}</span>
                      </div>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs relative ${
                          msg.speaker === 'agent'
                            ? 'bg-blue-600 text-white rounded-br-xs'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-xs'
                        }`}
                      >
                        {msg.text}
                        {msg.speaker === 'customer' && isTtsEnabled && (
                          <button
                            onClick={() => speechService.speak(msg.text, { ...selectedPersona.speechOptions, rate: speedMultiplier })}
                            className="ml-2 text-gray-400 hover:text-blue-500 inline-block align-middle"
                            title="다시 듣기"
                          >
                            <Volume2 className="w-3.5 h-3.5 inline" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {/* Live Speech Interim Bubble */}
                {interimText && (
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                        듣고 있는 중 (0.5초 후 자동 전송)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const text = (interimTextRef.current || interimText).trim();
                          if (text && !isAiReplying) {
                            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                            setInterimText('');
                            interimTextRef.current = '';
                            handleSendAgentMessage(text);
                          }
                        }}
                        className="px-2 py-0.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-xs flex items-center gap-1 transition-transform hover:scale-105"
                      >
                        <Zap className="w-2.5 h-2.5" />
                        즉시 대답 [Space]
                      </button>
                    </div>
                    <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs bg-blue-100/70 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 border border-blue-200 dark:border-blue-800 rounded-br-xs shadow-xs">
                      {interimText}
                    </div>
                  </div>
                )}

                {/* AI Thinking Animation */}
                {isAiReplying && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 italic py-1">
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-purple-500" />
                    <span>고객이 답변을 생각하는 중...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Input & Speech Controls */}
              <div className="p-2.5 bg-gray-50 dark:bg-gray-900/80 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleMicrophone()}
                  disabled={callState !== 'connected'}
                  className={`p-2.5 rounded-xl transition-all ${
                    isMicActive
                      ? 'bg-red-500 text-white shadow-md shadow-red-500/30 animate-pulse'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={isMicActive ? '마이크 끄기' : '마이크 켜기 (STT)'}
                >
                  {isMicActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendAgentMessage(inputText);
                    }
                  }}
                  placeholder={
                    callState === 'connected'
                      ? '마이크로 말하거나 멘트를 입력하세요 (Enter)'
                      : '통화 시작 후 멘트를 입력할 수 있습니다'
                  }
                  disabled={callState !== 'connected' || isAiReplying}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-900"
                />

                <button
                  onClick={() => handleSendAgentMessage(inputText)}
                  disabled={!inputText.trim() || callState !== 'connected' || isAiReplying}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sandbox Customer Details & Action Panel (5 Cols) */}
            <div className="md:col-span-5 flex flex-col h-[480px] rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>간편 콜 모드 샌드박스</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  ● 데이터 분리 격리됨
                </span>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
                {/* Profile Card */}
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-500" /> {selectedPersona.customerName}
                    </span>
                    <span className="text-gray-400 text-[11px]">{selectedPersona.phone}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-700">
                    <div>직업: <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedPersona.job}</span></div>
                    <div>소득: <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedPersona.salary}</span></div>
                    <div className="col-span-2">부채: <span className="font-semibold text-red-600 dark:text-red-400">{selectedPersona.debtSummary}</span></div>
                    <div className="col-span-2">주거: <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedPersona.housing}</span></div>
                  </div>
                </div>

                {/* Consultation Result Select */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    상담 처리 결과 (실습)
                  </label>
                  <select
                    value={consultationResult}
                    onChange={e => setConsultationResult(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="재통화예정">📞 재통화예정 (리마인더)</option>
                    <option value="접수완료">✅ 접수완료 (서류 대기)</option>
                    <option value="부재">⏳ 부재 (부재중 알림)</option>
                    <option value="단순거절">❌ 단순거절 (추후 재컨택)</option>
                    <option value="조건부적합">⚠️ 조건부적합 (회생 연계)</option>
                  </select>
                </div>

                {/* Quick Memo Shortcuts */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                    빠른 메모 추가
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {['카드론 대환 희망', '금리 조건 확인', '오후 3시 재통화', '서류 문자 발송'].map(shortcut => (
                      <button
                        key={shortcut}
                        type="button"
                        onClick={() => setAgentMemo(prev => (prev ? prev + ' / ' + shortcut : shortcut))}
                        className="px-2 py-0.5 text-[10px] rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                      >
                        +{shortcut}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Real-time Memo Textarea */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                    상담 메모 작성 (실시간 저장)
                  </label>
                  <textarea
                    rows={3}
                    value={agentMemo}
                    onChange={e => setAgentMemo(e.target.value)}
                    placeholder="고객 요청사항, 부채 세부내역, 특이사항을 기록하세요."
                    className="w-full p-2.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Reminder Setting */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                    콜백 리마인더 설정
                  </label>
                  <input
                    type="datetime-local"
                    value={reminderDate}
                    onChange={e => setReminderDate(e.target.value)}
                    className="w-full h-8 px-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  />
                </div>

                {/* Save Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMemoSaved(true);
                    showToast('샌드박스 상담 메모가 저장되었습니다.', 'success');
                    setTimeout(() => setIsMemoSaved(false), 2000);
                  }}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {isMemoSaved ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Save className="w-3.5 h-3.5" />}
                  {isMemoSaved ? '저장 완료' : '샌드박스 메모 저장 실습'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Evaluation Report Modal */}
      {showModal && currentReport && currentSessionRecord && (
        <TrainingReportModal
          report={currentReport}
          persona={selectedPersona}
          sessionRecord={currentSessionRecord}
          onClose={() => setShowModal(false)}
          onRetry={() => {
            setShowModal(false);
            handleStartCall();
          }}
          onNextLevel={() => {
            setShowModal(false);
            const nextIdx = TRAINING_PERSONAS.findIndex(p => p.id === selectedPersona.id) + 1;
            if (nextIdx < TRAINING_PERSONAS.length) {
              setSelectedPersona(TRAINING_PERSONAS[nextIdx]);
              setMessages([]);
            }
          }}
          hasNextLevel={
            TRAINING_PERSONAS.findIndex(p => p.id === selectedPersona.id) < TRAINING_PERSONAS.length - 1
          }
        />
      )}
    </div>
  );
}
