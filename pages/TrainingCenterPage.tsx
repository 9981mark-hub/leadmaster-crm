import React, { useState, useEffect, useRef } from 'react';
import {
  TRAINING_PERSONAS,
  TrainingPersona,
  TrainingMessage,
  TrainingReport,
  TrainingSessionRecord,
  loadTrainingHistory,
  loadTrainingHistoryFromServer,
  saveTrainingSession,
  clearMyTrainingHistory,
  loadCompanyTrainingConfig,
  generateAiCustomerReply,
  evaluateTrainingCall,
  generateRandomCustomerPersona,
  generateCustomPersonaByCategory,
  WEAKNESS_CATEGORIES,
  WeaknessCategoryId,
  getCompanyTrainingConfig,
  interpolateOpeningScript,
  CompanyTrainingConfig,
  INFINITE_THEMES,
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
  Lock,
  RefreshCw,
  X,
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
  const [selectedThemeId, setSelectedThemeId] = useState<string>('all');
  const [showGroundTruth, setShowGroundTruth] = useState<boolean>(false);

  // Call state: 'idle' | 'calling' | 'connected' | 'evaluating' | 'ended'
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'evaluating' | 'ended'>('idle');
  const [callDuration, setCallDuration] = useState<number>(0);
  const timerRef = useRef<any>(null);

  // Chat & Speech state
  const [messages, setMessages] = useState<TrainingMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micTestResult, setMicTestResult] = useState('');
  const [showMicPermissionModal, setShowMicPermissionModal] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [isPhoneFilterEnabled, setIsPhoneFilterEnabled] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('lm_training_speed') : null;
    return saved ? parseFloat(saved) : 1.20;
  });
  const [ageTone, setAgeTone] = useState<'young' | 'middle' | 'senior' | 'elder'>('middle');
  const [isAiReplying, setIsAiReplying] = useState(false);
  const [isCustomerSpeaking, setIsCustomerSpeaking] = useState(false);

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

  // Smart Silence & Turn Coordination Refs
  const silenceTimerRef = useRef<any>(null);
  const interimTextRef = useRef<string>('');
  const isAiReplyingRef = useRef<boolean>(false);
  const callStateRef = useRef<'idle' | 'calling' | 'connected' | 'evaluating' | 'ended'>('idle');
  const turnIdRef = useRef<number>(0);
  const isGeneratingReplyRef = useRef<boolean>(false);
  const lastSentTextRef = useRef<string>('');
  const lastSentTimeRef = useRef<number>(0);
  const messagesRef = useRef<TrainingMessage[]>([]);
  const customerSpeakingStartTimeRef = useRef<number>(0);
  const isCustomerSpeakingRef = useRef<boolean>(false);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    isAiReplyingRef.current = isAiReplying;
  }, [isAiReplying]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

  // Load training history on mount (브라우저 사본 먼저, 서버 확인 후 교체)
  useEffect(() => {
    let alive = true;
    setHistory(loadTrainingHistory());
    loadTrainingHistoryFromServer().then(list => { if (alive) setHistory(list); }).catch(() => undefined);
    loadCompanyTrainingConfig().then(cfg => { if (alive) setTrainingConfig(cfg); }).catch(() => undefined);
    return () => { alive = false; };
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

  // 마이크 사전 테스트 (통화 전 마이크 정상 작동 및 권한 사전 확인)
  const handleMicTest = async () => {
    if (isMicTesting) {
      speechService.stopListening();
      setIsMicTesting(false);
      setIsMicActive(false);
      showToast('마이크 테스트를 종료했습니다.', 'info');
      return;
    }

    // 마이크 권한 요청
    const perm = await speechService.requestMicrophonePermission();
    if (!perm.granted) {
      if (perm.error === 'NotAllowedError' || perm.error === 'PermissionDeniedError') {
        setShowMicPermissionModal(true);
      } else if (perm.error === 'NotFoundError' || perm.error === 'DevicesNotFoundError') {
        showToast('연결된 마이크 기기를 찾을 수 없습니다. 마이크 연결을 확인해주세요.', 'error');
      } else {
        showToast(`마이크 접근에 실패했습니다: ${perm.error}`, 'error');
      }
      return;
    }

    setIsMicTesting(true);
    setIsMicActive(true);
    setMicTestResult('');
    showToast('🎙️ 마이크 테스트 시작! "안녕하세요" 등 편하게 말씀해보세요. (6초간 진행)', 'info');

    let speechCaptured = false;
    const testStarted = speechService.startListening(
      (transcript) => {
        if (transcript) {
          speechCaptured = true;
          setMicTestResult(transcript);
          showToast(`🎙️ 마이크 정상 인식: "${transcript}"`, 'success');
        }
      },
      (err) => {
        console.warn('Mic test error:', err);
        setIsMicTesting(false);
        setIsMicActive(false);
        if (err === 'not-allowed') {
          setShowMicPermissionModal(true);
        }
      },
      () => {
        setIsMicTesting(false);
        setIsMicActive(false);
      }
    );

    if (!testStarted) {
      setIsMicTesting(false);
      setIsMicActive(false);
      showToast('음성 인식을 시작하지 못했습니다. 크롬/엣지 브라우저를 이용해주세요.', 'error');
      return;
    }

    setTimeout(() => {
      speechService.stopListening();
      setIsMicTesting(false);
      setIsMicActive(false);
      if (!speechCaptured) {
        showToast('마이크 입력이 감지되지 않았습니다. PC 마이크 볼륨을 확인해주세요.', 'info');
      }
    }, 6000);
  };

  // Start Call Simulation (아웃바운드 발신: 사전 마이크 권한 검증 -> 신호음 2회 -> 고객 수신)
  const handleStartCall = async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // 1단계: 사용자 클릭 제스처가 살아있는 첫 순간에 브라우저 마이크 권한 즉시 요청 & 검증
    if (speechService.isSpeechRecognitionSupported()) {
      try {
        const perm = await speechService.requestMicrophonePermission();
        if (!perm.granted) {
          if (perm.error === 'NotAllowedError' || perm.error === 'PermissionDeniedError') {
            setShowMicPermissionModal(true);
            return;
          } else if (perm.error === 'NotFoundError' || perm.error === 'DevicesNotFoundError') {
            showToast('연결된 마이크 기기를 찾을 수 없습니다. 마이크 연결을 확인해주세요.', 'error');
            return;
          } else {
            console.warn('Microphone permission check result:', perm.error);
          }
        }
      } catch (permErr) {
        console.warn('Microphone permission exception:', permErr);
      }
    } else {
      showToast('현재 브라우저는 음성 인식을 지원하지 않습니다. 키보드 타이핑 모드로 진행됩니다.', 'info');
    }

    // 테스트 모드였으면 종료
    if (isMicTesting) {
      speechService.stopListening();
      setIsMicTesting(false);
      setIsMicActive(false);
    }

    // 턴 및 중복 방지 상태 초기화
    turnIdRef.current = 0;
    isGeneratingReplyRef.current = false;
    lastSentTextRef.current = '';
    lastSentTimeRef.current = 0;
    messagesRef.current = [];

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
      // 모바일 오디오 Autoplay 권한 사전 해제 (사용자 클릭 제스처 시점)
      speechService.unlockAudio();

      // 모바일 볼륨 최적화 브릿지 호출 (볼륨 덕킹 해제 및 스피커폰 모드)
      try {
        (window as any).AndroidBridge?.maximizeSpeakerVolume?.();
      } catch (_) {}

      // 한국 표준 전화 통화연결음 2회 울림 (뚜르르르~ ... 뚜르르르~ 약 3.2초)
      await speechService.playRingbackTone(2);

      // 모바일 볼륨 재점검 (신호음 후 고객 발화 전 스피커 음량 100% 보장)
      try {
        (window as any).AndroidBridge?.maximizeSpeakerVolume?.();
      } catch (_) {}

      // 고객이 전화를 받음 (아웃바운드 연결 완료)
      callStateRef.current = 'connected';
      setCallState('connected');
      const firstEmotion = speechService.detectEmotion(selectedPersona.initialMessage);
      const firstMsg: TrainingMessage = {
        id: 'msg-' + Date.now(),
        speaker: 'customer',
        text: selectedPersona.initialMessage,
        emotion: firstEmotion,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
      setMessages([firstMsg]);
      messagesRef.current = [firstMsg];

      // 고객의 첫 "여보세요?" 발화 (TTS)
      // 💡 모바일 오디오 덕킹(볼륨 꺼짐) 방지 핵심:
      // 고객이 말하는 도중에는 마이크를 켜지 않아 안드로이드가 스피커 볼륨을 줄이지 않고 100% 크게 들림!
      if (isTtsEnabled) {
        setIsCustomerSpeaking(true);
        isCustomerSpeakingRef.current = true;
        customerSpeakingStartTimeRef.current = Date.now();
        try {
          await speechService.speak(firstMsg.text, {
            ...selectedPersona.speechOptions,
            rate: speedMultiplier,
            pitch: getCalculatedPitch(selectedPersona.speechOptions.pitch),
            emotion: firstEmotion,
          });
        } finally {
          setIsCustomerSpeaking(false);
          isCustomerSpeakingRef.current = false;
        }
      }

      // 고객 발화가 끝난 후, 또는 TTS 비활성 시 마이크 청취 즉시 개시!
      if (callStateRef.current === 'connected') {
        startCallMicrophone();
      }
    } catch (e) {
      console.warn('Call start failed or cancelled:', e);
      setIsCustomerSpeaking(false);
      callStateRef.current = 'idle';
      setCallState('idle');
    }
  };

  // 발신 신호음 도중 취소
  const handleCancelCalling = () => {
    speechService.stopRingbackTone();
    speechService.stopSpeaking();
    setIsCustomerSpeaking(false);
    callStateRef.current = 'idle';
    setCallState('idle');
    showToast('전화 발신을 취소했습니다.', 'info');
  };

  // 고객 말 끊고 즉시 답변하기 (Barge-in 인터럽트)
  const handleInterruptCustomer = () => {
    speechService.stopSpeaking();
    setIsCustomerSpeaking(false);
    if (callStateRef.current === 'connected') {
      startCallMicrophone();
      showToast('고객 발화를 끊고 마이크를 켰습니다. 편하게 말씀하세요!', 'info');
    }
  };

  // 고객 메시지 다시 듣기 (스피커 아이콘 클릭 시 안전 재생 & 마이크 복원)
  const handleReplayCustomerMessage = async (text: string, emotion?: 'angry' | 'annoyed' | 'anxious' | 'calm') => {
    if (isCustomerSpeaking) return;
    setIsCustomerSpeaking(true);
    speechService.stopListening();
    try {
      await speechService.speak(text, {
        ...selectedPersona.speechOptions,
        rate: speedMultiplier,
        pitch: getCalculatedPitch(selectedPersona.speechOptions.pitch),
        emotion: emotion || speechService.detectEmotion(text),
      });
    } finally {
      setIsCustomerSpeaking(false);
      // 다시 듣기가 끝난 후 통화 연결 중이면 마이크 자동 복원!
      if (callStateRef.current === 'connected') {
        startCallMicrophone();
      }
    }
  };

  // 통화 중 마이크 상시 연결 및 수신 (자동 유지 & 스마트 침묵 턴테이킹)
  const startCallMicrophone = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    setIsMicActive(true);

    const started = speechService.startListening(
      (transcript, isFinal) => {
        const clean = transcript.trim();
        if (!clean) return;

        // 1. 실시간 말 끼어들기 및 동시 발화(Overlapping Speech) 지능형 중재:
        const isBackchannel = /^(네|예|아|음|어|네네|아네|예예|글쎄요|그렇죠)[.?~]?$/.test(clean);

        if (isCustomerSpeakingRef.current) {
          // A) 단순 맞장구/추임새인 경우: 고객 음성을 끊지 않고 계속 말하게 둠! (실제 사람 통화 리얼리티)
          if (isBackchannel) {
            setInterimText(clean);
            interimTextRef.current = clean;
            return;
          }

          // B) 실질적인 동시 발화 / 끼어들기 발생 시:
          const elapsedFromCustomerStart = Date.now() - customerSpeakingStartTimeRef.current;
          const isGentleCustomer = selectedPersona.difficulty === '초급' || selectedPersona.customerName.includes('순한');

          if (elapsedFromCustomerStart < 1200) {
            // 발화 시작 직후(1.2초 이내) 겹쳤을 때:
            if (isGentleCustomer) {
              // 온순형 고객: 고객이 말을 멈추고 상담원에게 즉시 양보!
              speechService.stopSpeaking();
              isCustomerSpeakingRef.current = false;
              setIsCustomerSpeaking(false);
            } else {
              // 급하거나 화난 고객: 고객이 밀어붙이며 자기 말을 계속함!
              // 단, 상담원이 6글자 이상 길게 말하며 치고 들어오면 고객이 멈춤
              if (clean.length >= 6) {
                speechService.stopSpeaking();
                isCustomerSpeakingRef.current = false;
                setIsCustomerSpeaking(false);
              } else {
                setInterimText(clean);
                interimTextRef.current = clean;
                return;
              }
            }
          } else {
            // 고객 말이 이미 1.2초 이상 진행된 후 상담원이 말하면 고객 중단
            speechService.stopSpeaking();
            isCustomerSpeakingRef.current = false;
            setIsCustomerSpeaking(false);
          }
        }

        // 2. 실시간 발화 자막 업데이트 (상담원이 말하는 중임을 시각적으로 확인)
        setInterimText(clean);
        interimTextRef.current = clean;

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        // 한국어 완성형 문장 종결 어미 패턴 (~요, ~까, ~죠, ~니다, ~세요, ~신가요, ?, . 등)
        const isSentenceEnd = /[?!\.]$|([요죠까나니세][\s]*[?]?$)|(입니다|있습니다|맞나요|되실까요|되세요|하세요|드렸습니다|드려요|계신가요|가능하세요|맞으시죠|있을까요|인가요|시죠|고요|데요|거예요|할게요)$/.test(clean);

        // 실제 사람 간의 전화 통화 반응 속도(180ms~350ms)에 맞춘 초고속 자연스러운 턴테이킹:
        // 1) 브라우저 문장 인식 확정(isFinal) + 문장 종결 어미 감지 시: 180ms (초고속 즉답)
        // 2) 실시간 인식(interim) 상태에서 종결 어미 감지 시: 280ms
        // 3) 종결 어미 없으나 문장 확정(isFinal)된 경우: 350ms
        // 4) 문장 중간의 자연스러운 숨 고름(쉼표): 550ms (기존 950ms에서 대폭 단축하여 정적 해소)
        let delayMs = 550;
        if (isSentenceEnd) {
          delayMs = isFinal ? 180 : 280;
        } else if (isFinal) {
          delayMs = 350;
        }

        silenceTimerRef.current = setTimeout(() => {
          const text = interimTextRef.current.trim();
          if (text) {
            setInterimText('');
            interimTextRef.current = '';
            handleSendAgentMessage(text);
          }
        }, delayMs);
      },
      (err) => {
        console.warn('SpeechRecognition error during call:', err);
        // 브라우저 권한 차단 시에만 모달 표시 및 종료
        if (err === 'not-allowed') {
          setIsMicActive(false);
          setShowMicPermissionModal(true);
        }
        // 일시적인 network/audio 오류 등은 setIsMicActive(false)를 절대 부르지 않고 자동 재연결 대기!
      },
      () => {
        // 통화 연결 중일 때는 크롬 타임아웃 등으로 onEnd가 불려도 사용자가 음소거하지 않은 이상 마이크를 끄지 않음!
        if (callStateRef.current !== 'connected') {
          setIsMicActive(false);
        }
      }
    );

    if (started) {
      setIsMicActive(true);
    }
  };

  // Toggle Microphone (통화 중 음소거 토글 / 통화 전 마이크 테스트)
  const toggleMicrophone = (forceStart?: boolean) => {
    // 1. 통화 중인 경우
    if (callStateRef.current === 'connected') {
      const shouldTurnOn = forceStart !== undefined ? forceStart : !isMicActive;
      if (shouldTurnOn) {
        startCallMicrophone();
      } else {
        // 사용자가 명시적으로 음소거 버튼을 눌렀을 때만 끔
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        speechService.stopListening();
        setIsMicActive(false);
        setInterimText('');
        interimTextRef.current = '';
      }
      return;
    }

    // 2. 통화 중이 아닐 때는 사전 마이크 테스트 실행
    handleMicTest();
  };

  // Send message from agent (단일 턴 ID 및 중복 발송 엄격 제어 - 1문장 1응답 보장)
  const handleSendAgentMessage = async (textToSend: string) => {
    const cleanText = textToSend.trim();
    if (!cleanText) return;

    const now = Date.now();

    // 🚨 핵심 방어 1: 중복 텍스트 및 초단위 연타 방지
    // 직전에 보낸 텍스트와 동일하거나 0.9초 이내 동일 발화가 들어오면 무시!
    if (lastSentTextRef.current === cleanText && (now - lastSentTimeRef.current) < 900) {
      console.log('중복 상담원 텍스트 발송 차단:', cleanText);
      return;
    }

    lastSentTextRef.current = cleanText;
    lastSentTimeRef.current = now;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // 상담원이 말을 마쳤으므로 마이크 일시 정지 (고객 TTS 재생 중 모바일 오디오 볼륨 꺼짐 방지)
    speechService.stopListening();
    speechService.stopSpeaking();
    setIsMicActive(false);

    // 🚨 핵심 방어 2: 단일 턴 ID 발급 (이전 AI 응답이 늦게 오더라도 무효화!)
    const myTurnId = ++turnIdRef.current;
    isGeneratingReplyRef.current = true;
    setIsAiReplying(true);

    const agentMsg: TrainingMessage = {
      id: 'msg-' + now,
      speaker: 'agent',
      text: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    // 항상 최신 messagesRef 기반으로 새 배열 생성
    const nextMessages = [...messagesRef.current, agentMsg];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);

    setInputText('');
    setInterimText('');
    interimTextRef.current = '';

    try {
      const replyRaw = await generateAiCustomerReply(nextMessages, selectedPersona);

      // 🚨 핵심 방어 3: AI 응답 생성 중 상담원이 새로운 말을 시작했거나 턴이 바뀌었으면 이 응답 폐기!
      if (myTurnId !== turnIdRef.current || interimTextRef.current.trim()) {
        console.log(`[Turn ${myTurnId}] 구버전 AI 응답 폐기:`, replyRaw);
        return;
      }

      // 감정 태그([화남], [짜증], [불안], [차분]) 파싱 및 텍스트 정제
      let parsedEmotion: 'angry' | 'annoyed' | 'anxious' | 'calm' = 'calm';
      let cleanCustomerText = replyRaw.trim();
      const emotionMatch = cleanCustomerText.match(/^\[(화남|짜증|불안|차분)\]\s*/);
      if (emotionMatch) {
        const tag = emotionMatch[1];
        cleanCustomerText = cleanCustomerText.replace(/^\[(화남|짜증|불안|차분)\]\s*/, '').trim();
        if (tag === '화남') parsedEmotion = 'angry';
        else if (tag === '짜증') parsedEmotion = 'annoyed';
        else if (tag === '불안') parsedEmotion = 'anxious';
        else if (tag === '차분') parsedEmotion = 'calm';
      } else {
        parsedEmotion = speechService.detectEmotion(cleanCustomerText);
      }

      const customerMsg: TrainingMessage = {
        id: 'msg-' + (Date.now() + 1),
        speaker: 'customer',
        text: cleanCustomerText,
        emotion: parsedEmotion,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      // 🚨 핵심 방어 4: 동일 고객 메시지가 이미 들어갔는지 중복 방지
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.speaker === 'customer' && last.text === cleanCustomerText) {
          return prev;
        }
        const updated = [...prev, customerMsg];
        messagesRef.current = updated;
        return updated;
      });

      if (isTtsEnabled && myTurnId === turnIdRef.current) {
        setIsCustomerSpeaking(true);
        isCustomerSpeakingRef.current = true;
        customerSpeakingStartTimeRef.current = Date.now();
        try {
          (window as any).AndroidBridge?.maximizeSpeakerVolume?.();
        } catch (_) {}
        try {
          await speechService.speak(cleanCustomerText, {
            ...selectedPersona.speechOptions,
            rate: speedMultiplier,
            pitch: getCalculatedPitch(selectedPersona.speechOptions.pitch),
            emotion: parsedEmotion,
          });
        } finally {
          setIsCustomerSpeaking(false);
          isCustomerSpeakingRef.current = false;
        }
      }
    } catch (e) {
      console.error('Error generating AI reply:', e);
    } finally {
      setIsCustomerSpeaking(false);
      if (myTurnId === turnIdRef.current) {
        isGeneratingReplyRef.current = false;
        setIsAiReplying(false);
        // 고객 발화가 끝난 후 통화 연결 중이면 마이크 자동 재개!
        if (callStateRef.current === 'connected') {
          startCallMicrophone();
        }
      }
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
    setIsCustomerSpeaking(false);
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

      await saveTrainingSession(sessionRecord);
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

  // 실전 텔레그램 접수 DB 기반 무한 AI 고객 생성기
  const handleGenerateRandom = (themeId?: string) => {
    if (callState === 'connected') {
      if (!confirm('통화 진행 중입니다. 새 고객을 생성하시겠습니까?')) return;
      handleEndCall();
    }
    const targetTheme = themeId || selectedThemeId;
    if (themeId) setSelectedThemeId(themeId);
    const newPersona = generateRandomCustomerPersona(targetTheme);
    setSelectedPersona(newPersona);
    setMessages([]);
    showToast(`🎲 실전 고객 [${newPersona.customerName}] (${newPersona.age}세, ${newPersona.badge}) 생성 완료!`, 'success');
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
                if (confirm('내 훈련 기록을 모두 초기화하시겠습니까? (다른 상담원 기록은 그대로 둡니다)')) {
                  clearMyTrainingHistory().then(res => {
                    setHistory(loadTrainingHistory());
                    if (res.ok) showToast('훈련 기록이 초기화되었습니다.', 'info');
                    else showToast(`서버 기록을 지우지 못했습니다. ${res.error || ''}`, 'error');
                  });
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
              /* 🎲 실전 텔레그램 접수 DB 기반 무한 AI 고객 생성 뷰 */
              <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <Dice5 className="w-4 h-4 text-blue-600" />
                    실전 텔레그램 접수 기반 무한 고객 엔진
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold">
                    487건 실전 DB
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  실제 접수된 직업, 채무, 주거, 부양가족, 특이상황과 2026 회생·파산 법률 알고리즘을 결합하여 매번 완전히 새로운 실전 고객을 즉시 소환합니다.
                </p>

                {/* 테마 선택 칩 */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                    <span>🎯 집중 연습 테마 선택</span>
                    <span className="text-[10px] font-normal text-gray-400">클릭 즉시 소환</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {INFINITE_THEMES.map(t => {
                      const isThemeActive = selectedThemeId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleGenerateRandom(t.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                            isThemeActive
                              ? 'bg-blue-600 text-white font-bold shadow-sm'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {t.badge}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleGenerateRandom()}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                >
                  <Dice5 className="w-4 h-4" />
                  🎲 새로운 실전 고객 1초 소환하기
                </button>

                {/* 현재 생성된 고객 상세 카드 */}
                <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-950 dark:text-blue-100 text-sm">
                      {selectedPersona.customerName} ({selectedPersona.age}세, {selectedPersona.speechOptions.gender === 'female' ? '여성' : '남성'})
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-600 text-white font-bold">
                      {selectedPersona.badge}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-1 text-[11px] text-gray-700 dark:text-gray-200">
                    <div>💼 <strong>직업/소득:</strong> {selectedPersona.job} ({selectedPersona.salary})</div>
                    <div>💳 <strong>채무 현황:</strong> {selectedPersona.debtSummary}</div>
                    <div>🏠 <strong>주거/재산:</strong> {selectedPersona.housing}</div>
                    <div className="text-gray-600 dark:text-gray-300 pt-1 border-t border-blue-200/50 dark:border-blue-800/50">
                      📖 <strong>배경 사연:</strong> {selectedPersona.scenarioDescription}
                    </div>
                  </div>

                  {/* 수석 사무장 법률 가심사 정답 카드 (토글) */}
                  {selectedPersona.groundTruth && (
                    <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800/60">
                      <button
                        type="button"
                        onClick={() => setShowGroundTruth(!showGroundTruth)}
                        className="w-full flex items-center justify-between text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:underline"
                      >
                        <span className="flex items-center gap-1">
                          ⚖️ 수석 사무장 가심사 타깃 (Ground Truth)
                        </span>
                        <span>{showGroundTruth ? '▲ 숨기기' : '▼ 펼쳐보기'}</span>
                      </button>

                      {showGroundTruth && (
                        <div className="mt-2 p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-900 dark:text-white">신청 적격 판정:</span>
                            <span className="px-1.5 py-0.5 rounded font-black text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                              {selectedPersona.groundTruth.suitability}
                            </span>
                          </div>
                          <div className="text-gray-600 dark:text-gray-300 text-[10px]">
                            {selectedPersona.groundTruth.suitabilityReason}
                          </div>
                          <div className="grid grid-cols-2 gap-1 pt-1 text-[10px]">
                            <div>• 인정 생계비: <strong>{Math.round(selectedPersona.groundTruth.recognizedLivingCost / 10000)}만 원</strong></div>
                            <div>• 예상 월 변제: <strong>{Math.round(selectedPersona.groundTruth.expectedMonthlyPayment / 10000)}만 원</strong></div>
                            <div>• 변제 기간: <strong>{selectedPersona.groundTruth.expectedRepaymentPeriod}개월</strong></div>
                            <div>• 예상 탕감률: <strong>약 {selectedPersona.groundTruth.estimatedForgivenessRate}%</strong></div>
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
                            🏛️ {selectedPersona.groundTruth.courtRuleNote}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-[10px] text-blue-700 dark:text-blue-300 pt-1 font-semibold">
                    🎯 <strong>훈련 목표:</strong> {selectedPersona.trainingGoal}
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
                    { label: '느긋함 (1.05x)', val: 1.05 },
                    { label: '실전 (+15% 기본) 1.20x', val: 1.20 },
                    { label: '빠른 통화 (1.30x)', val: 1.30 },
                    { label: '초고속 (1.40x)', val: 1.40 },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => {
                        setSpeedMultiplier(opt.val);
                        try {
                          localStorage.setItem('lm_training_speed', String(opt.val));
                        } catch (_) {}
                      }}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold transition-colors ${
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
                  const sampleEmotion = speechService.detectEmotion(sampleText);
                  const calcPitch = getCalculatedPitch(selectedPersona.speechOptions.pitch);
                  const result = await speechService.speak(sampleText, {
                    ...selectedPersona.speechOptions,
                    rate: speedMultiplier,
                    pitch: calcPitch,
                    emotion: sampleEmotion,
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
                    {callState === 'connected' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        실시간 통화 연결 중
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">
                        발신 대기 상태
                      </span>
                    )}
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

                {/* 🎙️ 실시간 통화 중 핸즈프리 자동 수신 배너 */}
                {callState === 'connected' && (
                  <div className={`px-3.5 py-2 border-b flex items-center justify-between text-xs transition-colors ${
                    isMicActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {isMicActive ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                          <span className="font-bold flex items-center gap-1.5">
                            <Mic className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            실시간 자동 통화 모드
                          </span>
                          <span className="text-[11px] text-emerald-700 dark:text-emerald-300 hidden sm:inline">
                            (편하게 말씀하세요. 고객이 말하는 중에도 말씀하시면 즉시 듣고 반응합니다)
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="font-bold flex items-center gap-1.5">
                            <MicOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            마이크 꺼짐 (음소거)
                          </span>
                          <span className="text-[11px] text-amber-700 dark:text-amber-300 hidden sm:inline">
                            통화 중 음소거 상태입니다. 마이크를 켜시거나 키보드로 입력하세요.
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleMicrophone()}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                        isMicActive
                          ? 'bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-100 hover:bg-emerald-300'
                          : 'bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-100 hover:bg-amber-300'
                      }`}
                    >
                      {isMicActive ? '음소거' : '마이크 켜기'}
                    </button>
                  </div>
                )}

                {/* 🎙️ 통화 대기 중 마이크 사전 테스트 진행 배너 */}
                {callState === 'idle' && isMicTesting && (
                  <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 animate-pulse">
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-blue-600 animate-bounce" />
                      <span className="font-bold">🎙️ 마이크 사전 테스트 중:</span>
                      <span className="text-[11px] font-medium text-blue-800 dark:text-blue-200">
                        {micTestResult ? `인식 결과: "${micTestResult}"` : '마이크에 대고 "안녕하세요" 등을 말씀해보세요...'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        speechService.stopListening();
                        setIsMicTesting(false);
                        setIsMicActive(false);
                      }}
                      className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold"
                    >
                      테스트 완료
                    </button>
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
                          {msg.speaker === 'customer' && msg.emotion && (
                            <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              msg.emotion === 'angry'
                                ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800'
                                : msg.emotion === 'annoyed'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                : msg.emotion === 'anxious'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            }`}>
                              {msg.emotion === 'angry' && '😡 톤 대폭 상승 (화남)'}
                              {msg.emotion === 'annoyed' && '😒 톤 상승 (짜증/경계)'}
                              {msg.emotion === 'anxious' && '😰 초조/불안'}
                              {msg.emotion === 'calm' && '😌 차분/경청'}
                            </span>
                          )}
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
                              onClick={() => handleReplayCustomerMessage(msg.text, msg.emotion)}
                              className="ml-2 text-gray-400 hover:text-blue-500 inline-block align-middle"
                              title="다시 듣기 (재생 후 마이크 자동 재개)"
                            >
                              <Volume2 className="w-3.5 h-3.5 inline" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Live Speech Interim Bubble (실시간 발화 자막) */}
                  {interimText && (
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                          🎙️ 상담원 말씀하시는 중...
                        </span>
                      </div>
                      <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs bg-blue-100/70 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 border border-blue-200 dark:border-blue-800 rounded-br-xs shadow-xs">
                        {interimText}
                      </div>
                    </div>
                  )}

                  {/* AI Thinking Animation */}
                  {isAiReplying && !isCustomerSpeaking && (
                    <div className="flex items-center gap-2 text-xs text-gray-400 italic py-1">
                      <Sparkles className="w-3.5 h-3.5 animate-spin text-purple-500" />
                      <span>고객이 답변하는 중...</span>
                    </div>
                  )}

                  {/* Customer Speaking Status Banner (고객 발화 중 & 즉시 끼어들기) */}
                  {isCustomerSpeaking && (
                    <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs shadow-xs animate-pulse">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 animate-bounce text-purple-600 dark:text-purple-400" />
                        <span className="font-bold">고객 말씀 중... (스피커로 크게 들립니다)</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleInterruptCustomer}
                        className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] shadow-sm transition-all"
                      >
                        말 끊고 바로 답하기 🖐️
                      </button>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom Input & Speech Controls */}
                <div className="p-2.5 bg-gray-50 dark:bg-gray-900/80 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleMicrophone()}
                    disabled={callState === 'calling'}
                    className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 ${
                      callState === 'connected'
                        ? isMicActive
                          ? 'bg-red-500 text-white shadow-md shadow-red-500/30 animate-pulse'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20'
                        : isMicTesting
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 animate-pulse'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 hover:border-blue-400'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                    title={
                      callState === 'connected'
                        ? isMicActive
                          ? '마이크 끄기 (음소거)'
                          : '마이크 켜기 (STT 음성 수신)'
                        : isMicTesting
                        ? '마이크 테스트 중단'
                        : '🎙️ 통화 전 마이크 사전 테스트 & 브라우저 권한 허용'
                    }
                  >
                    {callState === 'connected' ? (
                      isMicActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className={`w-4 h-4 ${isMicTesting ? 'animate-bounce' : ''}`} />
                    )}
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
                        ? isCustomerSpeaking
                          ? '고객 발화 중... (끝나면 마이크가 자동으로 켜집니다)'
                          : isMicActive
                          ? '실시간 자동 통화 중... 편하게 말씀하세요 (키보드 직접 입력도 가능)'
                          : '마이크가 음소거 상태입니다. 마이크를 켜시거나 키보드로 입력하세요'
                        : isMicTesting
                        ? '🎙️ 마이크 테스트 진행 중... "안녕하세요" 말씀해보세요'
                        : '통화 시작 후 자동으로 실시간 대화가 진행됩니다'
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

      {/* 🎙️ 브라우저 마이크 권한 차단 해제 안내 모달 */}
      {showMicPermissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* 헤더 */}
            <div className="px-5 py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/20 backdrop-blur-xs">
                  <MicOff className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">마이크 권한 허용 안내</h3>
                  <p className="text-[11px] text-red-100">AI 실전 롤플레잉 음성 대화를 위해 마이크가 필요합니다</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMicPermissionModal(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 본문 (환경별 맞춤 가이드: 앱/모바일/PC 구분) */}
            {(() => {
              const isNativeApp = typeof window !== 'undefined' && !!(window as any).AndroidBridge;
              const isMobile = typeof window !== 'undefined' && (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768);

              if (isNativeApp) {
                return (
                  <div className="p-5 space-y-3.5 text-xs">
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                      리드마스터 모바일 앱에는 주소창이 없으므로 <span className="text-red-500 font-bold">휴대폰 앱 설정에서 마이크를 허용</span>해야 합니다:
                    </p>

                    <div className="space-y-2.5">
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          1
                        </span>
                        <div className="flex-1">
                          <span className="font-bold text-gray-800 dark:text-gray-200 block">
                            아래 [휴대폰 앱 설정 열기] 버튼 클릭
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            버튼을 누르면 LeadMaster 앱 설정 화면으로 바로 이동합니다.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          2
                        </span>
                        <div className="flex-1">
                          <span className="font-bold text-gray-800 dark:text-gray-200 block">
                            [권한] → [마이크] 선택
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            '권한' 목록에서 '마이크'를 찾아 [앱 사용 중에만 허용]으로 켜주세요.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          3
                        </span>
                        <div className="flex-1">
                          <span className="font-bold text-gray-800 dark:text-gray-200 block">
                            설정 완료 후 앱으로 복귀
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            뒤로가기로 앱에 돌아와 [새로고침]을 누르시면 즉시 마이크 대화가 가능합니다.
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const bridge = (window as any).AndroidBridge;
                          if (bridge && typeof bridge.openAppSettings === 'function') {
                            try {
                              bridge.openAppSettings();
                              return;
                            } catch (e) {
                              console.warn('openAppSettings error:', e);
                            }
                          }
                          // 구버전이거나 브릿지 미지원 시 친절한 안내 토스트
                          showToast('휴대폰 [설정] → [애플리케이션] → [LeadMaster] → [권한]에서 마이크를 [허용]으로 켜주세요!', 'warning', 7000);
                        }}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all text-xs"
                      >
                        <Settings className="w-4 h-4" />
                        휴대폰 앱 설정 열기 (마이크 허용)
                      </button>

                      {/* 구버전 호환 안내 박스 */}
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                        💡 <strong>버튼 반응이 없는 경우(구버전):</strong> 스마트폰의 <strong>[설정]</strong> 앱 → <strong>[애플리케이션]</strong> → <strong>[LeadMaster]</strong> → <strong>[권한]</strong> → <strong>[마이크]</strong>를 [앱 사용 중에만 허용]으로 켜주시면 즉시 연결됩니다.
                      </div>

                      <a
                        href="/app/LeadMaster.apk"
                        download="LeadMaster.apk"
                        className="w-full py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold flex items-center justify-center gap-1.5 transition-all text-xs border border-gray-300 dark:border-gray-600"
                      >
                        📥 최신 v1.7.9 앱 다운로드 (마이크 자동 허용 버전)
                      </a>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => window.location.reload()}
                          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          새로고침
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowMicPermissionModal(false)}
                          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
                        >
                          닫기
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              if (isMobile) {
                return (
                  <div className="p-5 space-y-3.5 text-xs">
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                      모바일 브라우저에서 마이크 사용이 <span className="text-red-500 font-bold">차단</span>되어 있습니다:
                    </p>

                    <div className="space-y-2.5">
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          1
                        </span>
                        <div className="flex-1">
                          <span className="font-bold text-gray-800 dark:text-gray-200 block">
                            브라우저 메뉴 (우측 상단 ⋮ 또는 주소창 설정) 클릭
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            크롬/삼성인터넷 브라우저의 메뉴 또는 주소창 옆 설정 아이콘을 누릅니다.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          2
                        </span>
                        <div className="flex-1">
                          <span className="font-bold text-gray-800 dark:text-gray-200 block">
                            [설정] → [사이트 설정] → [마이크]
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            '차단됨' 목록에서 lmaster.xyz를 찾아 [허용]으로 변경해주세요.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          3
                        </span>
                        <div className="flex-1">
                          <span className="font-bold text-gray-800 dark:text-gray-200 block">
                            페이지 새로고침
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            설정 변경 후 아래 [새로고침] 버튼을 눌러주세요.
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        새로고침
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMicPermissionModal(false)}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                );
              }

              // PC 데스크톱 기본 안내
              return (
                <div className="p-5 space-y-3.5 text-xs">
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    현재 브라우저에서 마이크 사용이 <span className="text-red-500 font-bold">차단</span>되어 있거나 허용되지 않았습니다. 아래 3단계를 진행해주시면 즉시 마이크로 대화하실 수 있습니다:
                  </p>

                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        1
                      </span>
                      <div className="flex-1">
                        <span className="font-bold text-gray-800 dark:text-gray-200 block">
                          주소창 좌측의 🔒(자물쇠) 또는 설정 아이콘 클릭
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          브라우저 주소창 맨 앞의 🔒 자물쇠(또는 튜닝기) 아이콘을 누릅니다.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        2
                      </span>
                      <div className="flex-1">
                        <span className="font-bold text-gray-800 dark:text-gray-200 block">
                          [마이크] 항목을 [허용]으로 변경
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          마이크 토글을 켜거나 [허용(Allow)] 상태로 변경합니다.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        3
                      </span>
                      <div className="flex-1">
                        <span className="font-bold text-gray-800 dark:text-gray-200 block">
                          페이지 새로고침 (F5) 후 재시도
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          설정을 변경한 후 아래 [새로고침] 버튼을 눌러주세요.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      새로고침 (F5)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMicPermissionModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
                    >
                      닫기 (키보드 직접 입력)
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
