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
  generateRandomCustomerPersona,
  generateCustomPersonaByCategory,
  WEAKNESS_CATEGORIES,
  WeaknessCategoryId,
  getCompanyTrainingConfig,
  interpolateOpeningScript,
  CompanyTrainingConfig,
} from '../services/trainingService';
import { speechService } from '../services/speechService';
import { TrainingReportModal } from '../components/training/TrainingReportModal';
import { TrainingConfigModal } from '../components/training/TrainingConfigModal';
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
  Building2,
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
  Dice5,
  Target,
  Layers,
  ShieldAlert,
  UserCheck,
  ShieldCheck,
  AlertTriangle,
  Briefcase,
  DollarSign,
  Users,
  History,
  CheckSquare,
  Square,
  FileText,
  Settings,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

type TabMode = 'random' | 'clinic' | 'standard' | 'admin';

export default function TrainingCenterPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Mode Selection: 'random' | 'clinic' | 'standard' | 'admin'
  const [activeTab, setActiveTab] = useState<TabMode>('clinic');

  // Selected persona & history
  const [selectedPersona, setSelectedPersona] = useState<TrainingPersona>(() =>
    generateCustomPersonaByCategory('cat_phishing')
  );
  const [trainingConfig, setTrainingConfig] = useState<CompanyTrainingConfig>(() => getCompanyTrainingConfig());
  const [showConfigModal, setShowConfigModal] = useState(false);
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
  const [isPhoneFilterEnabled, setIsPhoneFilterEnabled] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.05);
  const [ageTone, setAgeTone] = useState<'young' | 'middle' | 'senior' | 'elder'>('middle');
  const [isAiReplying, setIsAiReplying] = useState(false);

  // Live Paralegal Checklist state during call
  const [liveChecklist, setLiveChecklist] = useState({
    job: false,
    salary: false,
    dependents: false,
    housing: false,
    debt: false,
    overdue: false,
    history: false,
  });

  // 캐릭터 기본 피치에 연령대 프리셋을 합성하는 헬퍼
  const getCalculatedPitch = (basePitch = 0.80): number => {
    let modifier = 0;
    if (ageTone === 'young') modifier = +0.15;
    else if (ageTone === 'middle') modifier = 0;
    else if (ageTone === 'senior') modifier = -0.10;
    else if (ageTone === 'elder') modifier = -0.20;
    return Math.max(0.50, Math.min(1.25, basePitch + modifier));
  };

  // Smart Silence & Fast Trigger Refs
  const silenceTimerRef = useRef<any>(null);
  const interimTextRef = useRef<string>('');
  const isAiReplyingRef = useRef<boolean>(false);

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

  // Admin Hub Selected Session Modal
  const [selectedAdminSession, setSelectedAdminSession] = useState<TrainingSessionRecord | null>(null);

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

  // Start Call Simulation (아웃바운드 발신: 신호음 2회 울린 후 고객이 "여보세요" 수신)
  const handleStartCall = async () => {
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
    setLiveChecklist({
      job: false,
      salary: false,
      dependents: false,
      housing: false,
      debt: false,
      overdue: false,
      history: false,
    });

    try {
      // 한국 표준 전화 통화연결음 2회 울림 (뚜르르르~ ... 뚜르르르~ 약 3.2초)
      await speechService.playRingbackTone(2);

      // 고객이 전화를 받음 (아웃바운드 연결 완료)
      setCallState('connected');
      const firstMsg: TrainingMessage = {
        id: 'msg-' + Date.now(),
        speaker: 'customer',
        text: selectedPersona.initialMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
      setMessages([firstMsg]);

      // 고객의 첫 "여보세요?" 발화 (TTS)
      if (isTtsEnabled) {
        speechService.speak(firstMsg.text, {
          ...selectedPersona.speechOptions,
          rate: speedMultiplier,
          pitch: getCalculatedPitch(selectedPersona.speechOptions.pitch),
        });
      }

      // Automatically enable mic if available
      toggleMicrophone(true);
    } catch (e) {
      console.warn('Call start failed or cancelled:', e);
      setCallState('idle');
    }
  };

  // 발신 신호음 도중 취소
  const handleCancelCalling = () => {
    speechService.stopRingbackTone();
    speechService.stopSpeaking();
    setCallState('idle');
    showToast('전화 발신을 취소했습니다.', 'info');
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
            setInterimText(transcript);
            interimTextRef.current = transcript;

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
      const replyText = await generateAiCustomerReply(nextMessages, selectedPersona);

      const customerMsg: TrainingMessage = {
        id: 'msg-' + (Date.now() + 1),
        speaker: 'customer',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      setMessages(prev => [...prev, customerMsg]);

      if (isTtsEnabled) {
        await speechService.speak(replyText, {
          ...selectedPersona.speechOptions,
          rate: speedMultiplier,
          pitch: getCalculatedPitch(selectedPersona.speechOptions.pitch),
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
        personaName: selectedPersona.customerName,
        categoryTitle: selectedPersona.badge,
        date: new Date().toISOString(),
        durationSeconds: callDuration,
        totalTurns: messages.length,
        report,
        consultationResult,
        agentMemo,
        agentName: (user as any)?.name || '신입 상담원',
        fullTranscript: messages,
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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // New Random Persona Generator
  const handleGenerateRandom = () => {
    if (callState === 'connected') {
      if (!confirm('통화 진행 중입니다. 새 고객을 생성하시겠습니까?')) return;
      handleEndCall();
    }
    const newPersona = generateRandomCustomerPersona();
    setSelectedPersona(newPersona);
    setMessages([]);
    showToast(`🎲 새 고객 [${newPersona.customerName}] (${newPersona.age}세, ${newPersona.badge}) 생성 완료!`, 'success');
  };

  // Category Clinic Persona Picker
  const handleSelectCategory = (catId: WeaknessCategoryId) => {
    if (callState === 'connected') {
      if (!confirm('통화 진행 중입니다. 다른 카테고리로 변경하시겠습니까?')) return;
      handleEndCall();
    }
    const newPersona = generateCustomPersonaByCategory(catId);
    setSelectedPersona(newPersona);
    setMessages([]);
    showToast(`🎯 취약점 모듈 [${newPersona.badge}] 고객 생성 완료!`, 'info');
  };

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
              <h1 className="text-xl font-bold tracking-tight">신입 상담원 AI 트레이닝 & 사무장 인계 문진 센터</h1>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 font-medium">
                v3.56 무규칙 페르소나
              </span>
            </div>
            <p className="text-xs text-blue-100/80 mt-1">
              무제한 실전 고객 생성 · 6대 취약 유형별 타깃 훈련 · 사무장 인계 7대 문진 채점 · 관리자 코칭 허브
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur border border-white/10 text-center">
            <span className="text-[10px] block text-blue-200">총 훈련 세션</span>
            <span className="text-sm font-extrabold text-white">
              {history.length}회 완주
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

      {/* Mode Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab('clinic')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'clinic'
              ? 'bg-white dark:bg-gray-900 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
          }`}
        >
          <Target className="w-4 h-4 text-purple-500" />
          🎯 6대 취약점 집중 클리닉
        </button>

        <button
          onClick={() => {
            setActiveTab('random');
            handleGenerateRandom();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'random'
              ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
          }`}
        >
          <Dice5 className="w-4 h-4 text-blue-500" />
          🎲 무규칙 실전 고객 생성
        </button>

        <button
          onClick={() => setActiveTab('standard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'standard'
              ? 'bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-500" />
          📋 기본 4단계 정규 코스
        </button>

        <button
          onClick={() => setActiveTab('admin')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ml-auto ${
            activeTab === 'admin'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          👔 관리자(팀장) 코칭 허브 ({history.length})
        </button>
      </div>

      {/* Main Grid: Left Scenario / Right Call Studio */}
      {activeTab === 'admin' ? (
        /* 👔 관리자(팀장) 전용 코칭 대시보드 뷰 */
        <div className="p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-500" />
                신입/저실적 상담원 모의 훈련 평가 & 코칭 허브
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                팀원들이 수행한 실전 모의 통화의 녹음 로그, 7대 인계 항목 채점표를 열람하고 팀장 피드백 및 평가 등급(S/A/B/C/F)을 부여합니다.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowConfigModal(true)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02]"
              >
                <Settings className="w-4 h-4" />
                ⚙️ 훈련 정책 & 첫인사 스크립트 설정
              </button>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                총 {history.length}건 기록
              </span>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="py-16 text-center text-gray-400 space-y-2">
              <UserCheck className="w-12 h-12 mx-auto stroke-1 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-semibold">아직 진행된 모의 훈련 세션이 없습니다.</p>
              <p className="text-xs text-gray-500">상담원이 모의 통화를 완료하면 자동으로 이곳에 시험 결과가 축적됩니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-700 text-gray-500 font-bold">
                    <th className="py-3 px-4">훈련 일시</th>
                    <th className="py-3 px-4">상담원</th>
                    <th className="py-3 px-4">고객 페르소나 (유형)</th>
                    <th className="py-3 px-4">통화 시간</th>
                    <th className="py-3 px-4">종합 점수</th>
                    <th className="py-3 px-4">사무장 인계율</th>
                    <th className="py-3 px-4">팀장 평가 등급</th>
                    <th className="py-3 px-4 text-right">상세 평가 / 코칭</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {history.map(record => (
                    <tr key={record.sessionId} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/40 transition-colors">
                      <td className="py-3 px-4 text-gray-500 font-mono">
                        {new Date(record.date).toLocaleDateString()} {new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">
                        {record.agentName || '신입 상담원'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {record.personaName || '가상 고객'}
                        </span>
                        <span className="ml-1.5 px-2 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                          {record.categoryTitle || '모의'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                        {Math.floor(record.durationSeconds / 60)}분 {record.durationSeconds % 60}초 ({record.totalTurns}턴)
                      </td>
                      <td className="py-3 px-4 font-extrabold text-blue-600 dark:text-blue-400">
                        {record.report.totalScore}점
                      </td>
                      <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                        {record.report.paralegalCard ? `${record.report.paralegalCard.handoffScore}점` : '-'}
                      </td>
                      <td className="py-3 px-4">
                        {record.adminFeedback ? (
                          <span className={`px-2 py-0.5 rounded font-black text-xs ${
                            record.adminFeedback.grade === 'S' ? 'bg-amber-100 text-amber-800' :
                            record.adminFeedback.grade === 'A' ? 'bg-emerald-100 text-emerald-800' :
                            record.adminFeedback.grade === 'B' ? 'bg-blue-100 text-blue-800' :
                            record.adminFeedback.grade === 'C' ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {record.adminFeedback.grade}등급
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">미평가</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedAdminSession(record);
                            setCurrentReport(record.report);
                            setCurrentSessionRecord(record);
                            setShowModal(true);
                          }}
                          className="px-3 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
                        >
                          코칭 리포트 열람
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column (4 Cols): Scenario Pickers */}
          <div className="lg:col-span-4 space-y-3">
            {activeTab === 'clinic' && (
              /* 🎯 6대 취약점 집중 클리닉 모듈 뷰 */
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-purple-600" />
                    취약 유형별 타깃 훈련 (6개 모듈)
                  </h2>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  신입 상담원이 가장 버벅대는 6대 상황을 골라 즉각 실전 연습을 진행합니다.
                </p>

                <div className="space-y-2">
                  {WEAKNESS_CATEGORIES.map(cat => {
                    const isSelected = selectedPersona.category === cat.id;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => handleSelectCategory(cat.id)}
                        className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-400 dark:border-purple-600 shadow-sm ring-1 ring-purple-400'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                            {cat.badge} {cat.title}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-mono">
                            {cat.recommendedVoice}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium mb-1">
                          {cat.subtitle}
                        </p>
                        <p className="text-[10px] text-gray-400 leading-snug line-clamp-2">
                          🎯 <strong>목표:</strong> {cat.coreGoal}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'random' && (
              /* 🎲 무규칙 실전 AI 고객 생성 뷰 */
              <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <Dice5 className="w-4 h-4 text-blue-600" />
                    무규칙 다변량 고객 엔진
                  </h2>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  채무 원인(코인/사기/사업 실패/간병비 등), 재산(자가/전세/담보/무재산), 직업 및 돌발 상황을 무작위로 교차 결합하여 수백 명의 새로운 고객을 즉시 소환합니다.
                </p>

                <button
                  type="button"
                  onClick={handleGenerateRandom}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                >
                  <Dice5 className="w-4 h-4" />
                  🎲 새로운 무작위 고객 1초 소환하기
                </button>

                <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs space-y-1.5">
                  <div className="font-bold text-blue-900 dark:text-blue-200">
                    현재 생성된 고객: {selectedPersona.customerName} ({selectedPersona.age}세, {selectedPersona.job})
                  </div>
                  <div className="text-[11px] text-gray-600 dark:text-gray-300">
                    • 채무: {selectedPersona.debtSummary}
                  </div>
                  <div className="text-[11px] text-gray-600 dark:text-gray-300">
                    • 주거/재산: {selectedPersona.housing}
                  </div>
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 pt-1 border-t border-blue-200/50">
                    🎯 목표: {selectedPersona.trainingGoal}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'standard' && (
              /* 📋 기본 4단계 정규 코스 뷰 */
              <div className="space-y-2.5">
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between">
                  <span>기본 4단계 정규 코스</span>
                  <span className="text-xs font-normal text-gray-500">Lv.1 ~ Lv.4</span>
                </h2>

                <div className="space-y-2.5">
                  {TRAINING_PERSONAS.map(persona => {
                    const isSelected = selectedPersona.id === persona.id;
                    return (
                      <div
                        key={persona.id}
                        onClick={() => {
                          setSelectedPersona(persona);
                          setMessages([]);
                        }}
                        className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 dark:border-blue-500 shadow-sm ring-1 ring-blue-500'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                            {persona.badge}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">
                            {persona.speechOptions.gender === 'female' ? '여성 성우' : '남성 성우'}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                          {persona.title}
                        </p>
                        <p className="text-[10px] text-gray-400 leading-snug line-clamp-2">
                          {persona.scenarioDescription}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Google Cloud Studio Voice Settings Box */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-2 text-xs shadow-xs">
              <div className="flex items-center justify-between font-bold text-gray-800 dark:text-gray-200">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-blue-500" />
                  스튜디오 음성 & 수화기 필터
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                  Google Neural2
                </span>
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
                    { label: '자연스러움', val: 1.05 },
                    { label: '실전 (+15%)', val: 1.15 },
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

              {/* Voice Preview Button */}
              <button
                type="button"
                onClick={async () => {
                  const sampleText = selectedPersona.initialMessage;
                  const calcPitch = getCalculatedPitch(selectedPersona.speechOptions.pitch);
                  const result = await speechService.speak(sampleText, {
                    ...selectedPersona.speechOptions,
                    rate: speedMultiplier,
                    pitch: calcPitch,
                  });
                  showToast(`🔊 [${result.voiceName}] ${selectedPersona.customerName} 성우 발화 테스트 완료!`, 'success');
                }}
                className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-blue-500/20"
              >
                <Volume2 className="w-3.5 h-3.5" />
                🔊 {selectedPersona.customerName} ({selectedPersona.speechOptions.gender === 'female' ? '여성' : '남성'} 성우) 1초 미리듣기
              </button>
            </div>
          </div>

          {/* Right Column (8 Cols): Mock Call Studio + Paralegal Live Handoff Panel */}
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
                      {selectedPersona.badge}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {callState === 'connected' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> 통화 연결 중: {formatTime(callDuration)}
                      </span>
                    ) : callState === 'calling' ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5 animate-pulse">
                        <PhoneCall className="w-3.5 h-3.5 animate-bounce" /> 고객 스마트폰으로 전화 발신 중... (뚜르르르~ 🔔)
                      </span>
                    ) : callState === 'evaluating' ? (
                      <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 animate-spin" /> AI 사무장 인계 문진 채점 및 리포트 작성 중...
                      </span>
                    ) : (
                      <span>통화 대기 상태 (아웃바운드 발신 시작 버튼을 누르세요)</span>
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
                    📞 아웃바운드 발신 시작
                  </button>
                ) : callState === 'calling' ? (
                  <button
                    onClick={handleCancelCalling}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/20 transition-all animate-pulse"
                  >
                    <PhoneOff className="w-4 h-4" />
                    발신 신호음 취소
                  </button>
                ) : callState === 'connected' ? (
                  <button
                    onClick={handleEndCall}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/20 transition-all hover:scale-[1.02]"
                  >
                    <PhoneOff className="w-4 h-4" />
                    통화 종료 & 사무장 인계 채점
                  </button>
                ) : null}
              </div>
            </div>

            {/* Split Screen: Transcript / Live Paralegal Checklist & Sandbox */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Live Chat & Transcript (7 Cols) */}
              <div className="md:col-span-7 flex flex-col h-[520px] rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5 text-blue-500" />
                    실시간 아웃바운드 통화 대화록
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium border border-emerald-200/60">
                      <Zap className="w-3 h-3 text-emerald-500" />
                      0.5초 침묵 감지
                    </span>
                    <span className="text-[11px] text-gray-400">
                      [Space] 즉시 대답
                    </span>
                  </div>
                </div>

                {/* 📢 아웃바운드 상담원 첫 인사 가이드 배너 */}
                {callState === 'connected' && (
                  <div className="px-3.5 py-2.5 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 border-b border-blue-200/80 dark:border-blue-800/60 flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-black shrink-0">
                          첫마디 미션
                        </span>
                        <span className="text-[10px] font-bold text-blue-900 dark:text-blue-200">
                          [{trainingConfig.companyName}] 표준 오프닝 가이드
                        </span>
                      </div>
                      <button
                        onClick={() => setShowConfigModal(true)}
                        className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <Settings className="w-3 h-3" /> 스크립트 설정
                      </button>
                    </div>
                    <p className="text-[11px] text-blue-950 dark:text-blue-100 font-medium leading-relaxed bg-white/70 dark:bg-gray-900/60 p-2 rounded-lg border border-blue-100 dark:border-blue-900/50">
                      💬 "{interpolateOpeningScript(trainingConfig.standardOpening, trainingConfig, (user as any)?.name || '상담원', selectedPersona.customerName)}"
                    </p>
                  </div>
                )}

                {/* Chat Bubble Area */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {messages.length === 0 ? (
                    callState === 'calling' ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-amber-500 dark:text-amber-400 space-y-2">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 animate-ping absolute inset-0 opacity-75" />
                          <div className="w-16 h-16 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg relative">
                            <PhoneCall className="w-8 h-8 animate-bounce" />
                          </div>
                        </div>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100 pt-2">
                          {selectedPersona.customerName} 고객님께 전화를 걸고 있습니다...
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          신호음(뚜르르르~)이 2회 울린 뒤 고객이 "여보세요"하며 전화를 받습니다.
                        </p>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                        <PhoneCall className="w-10 h-10 mb-2 stroke-1 text-gray-300 dark:text-gray-600" />
                        <p className="text-xs font-medium">아웃바운드 발신 시작 버튼을 누르면</p>
                        <p className="text-xs text-gray-500 mt-0.5">신호음이 울린 후 고객이 전화를 받습니다.</p>
                      </div>
                    )
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
                              onClick={() => speechService.speak(msg.text, {
                                ...selectedPersona.speechOptions,
                                rate: speedMultiplier,
                                pitch: getCalculatedPitch(selectedPersona.speechOptions.pitch),
                              })}
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
                          className="px-2 py-0.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-xs flex items-center gap-1"
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

              {/* Right Panel (5 Cols): Live Paralegal Checklist & Sandbox Memo */}
              <div className="md:col-span-5 flex flex-col h-[520px] rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-400">
                    <ShieldCheck className="w-4 h-4" /> 사무장 인계 7대 문진
                  </span>
                  <span className="text-[10px] text-gray-400">
                    획득: {Object.values(liveChecklist).filter(Boolean).length}/7
                  </span>
                </div>

                <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs">
                  {/* Live 7 Checkpoints Checklist */}
                  <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-1.5">
                    <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 block mb-1">
                      통화 중 문진 완료 시 체크하세요:
                    </span>
                    {[
                      { key: 'job', label: '1. 직업 및 재직형태 (4대보험/사업 등)' },
                      { key: 'salary', label: '2. 월 평균 실소득 (실수령액)' },
                      { key: 'dependents', label: '3. 부양가족 수 (동거 가족)' },
                      { key: 'housing', label: '4. 주거 형태 및 보증금' },
                      { key: 'debt', label: '5. 총 채무액 및 채무 원인' },
                      { key: 'overdue', label: '6. 현재 연체 여부 및 기간' },
                      { key: 'history', label: '7. 과거 회생/파산/신복위 이력' },
                    ].map(item => {
                      const checked = (liveChecklist as any)[item.key];
                      return (
                        <div
                          key={item.key}
                          onClick={() => setLiveChecklist(prev => ({ ...prev, [item.key]: !checked }))}
                          className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors text-[11px] ${
                            checked
                              ? 'bg-emerald-100/70 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {checked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          )}
                          <span>{item.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Real-time Memo Textarea */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                      사무장 전달용 실시간 메모
                    </label>
                    <textarea
                      rows={3}
                      value={agentMemo}
                      onChange={e => setAgentMemo(e.target.value)}
                      placeholder="고객 핵심 문진 내용 (소득, 빚 원인, 보증금 등)을 적으세요."
                      className="w-full p-2.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Consultation Result Select */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                      상담 처리 결과 (실습)
                    </label>
                    <select
                      value={consultationResult}
                      onChange={e => setConsultationResult(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium"
                    >
                      <option value="사무장인계">🤝 사무장(전문가) 즉시 인계</option>
                      <option value="재통화예정">📞 재통화예정 (리마인더)</option>
                      <option value="접수완료">✅ 서류 안내 문자 발송</option>
                      <option value="단순거절">❌ 단순거절 (추후 재컨택)</option>
                    </select>
                  </div>

                  {/* Save Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMemoSaved(true);
                      showToast('사무장 인계 메모가 임시 저장되었습니다.', 'success');
                      setTimeout(() => setIsMemoSaved(false), 2000);
                    }}
                    className="w-full py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {isMemoSaved ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Save className="w-3.5 h-3.5" />}
                    {isMemoSaved ? '저장 완료' : '문진 메모 저장'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
          hasNextLevel={false}
        />
      )}

      {/* ⚙️ 관리자 맞춤형 훈련 정책 및 첫인사 스크립트 설정 모달 */}
      {showConfigModal && (
        <TrainingConfigModal
          onClose={() => setShowConfigModal(false)}
          onSaved={newCfg => {
            setTrainingConfig(newCfg);
            showToast(`✅ [${newCfg.companyName}] 훈련 정책 및 오프닝 스크립트가 저장되었습니다.`, 'success');
          }}
        />
      )}
    </div>
  );
}
