import React, { useState, useEffect, useRef } from 'react';
import {
  TrainingEducationMaterials,
  DEFAULT_EDUCATION_MATERIALS,
  getEducationMaterials,
  loadEducationMaterials,
  saveEducationMaterials,
  resetEducationMaterialsToDefault,
  IntakeFieldItem,
  EducationFaqItem,
  EducationVideoItem,
  ModelRecordingItem,
  DialogueTurn,
  ObjectionGuideItem,
  askEducationAssistant,
  InAppChatMessage,
} from '../../services/trainingEducationService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
import {
  BookOpen,
  FileText,
  Headphones,
  Youtube,
  HelpCircle,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Clock,
  Award,
  AlertTriangle,
  ShieldAlert,
  Users,
  Briefcase,
  DollarSign,
  Home,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  Trash2,
  Edit3,
  Save,
  RefreshCw,
  X,
  Lightbulb,
  Radio,
  Share2,
  Send,
  Bot,
  GraduationCap,
} from 'lucide-react';
import { ExamSection } from './ExamSection';

type SubView = 'script' | 'recordings' | 'videos' | 'faq' | 'exam';

/**
 * [가독성 특화 AI 답변 렌더러]
 * 마크다운 ** 별표 기호를 100% 제거하고,
 * [📌 핵심 결론], [🎯 고객 통화 실전 멘트], [⚠️ 실무 주의 팁]을 시각적 전용 카드로 분리 표현
 */
const FormattedAiAnswer: React.FC<{
  content: string;
  onCopyText: (text: string, label: string) => void;
}> = ({ content, onCopyText }) => {
  // 1. ** 별표 및 마크다운 기호 100% 필터링
  const clean = content.replace(/\*\*/g, '').replace(/###\s*/g, '').trim();

  // 2. 구조화 블록 정규식 파싱
  const conclusionMatch = clean.match(
    /(?:(?:📌\s*)?(?:\[\s*(?:결론|핵심\s*요약)\s*\]|(?:결론|핵심\s*요약)\s*[:：]|\b1\.\s*(?:결론|핵심\s*요약)\s*[:：]?))\s*([\s\S]*?)(?=(?:🎯\s*)?(?:\[\s*(?:실전\s*멘트|추천\s*멘트|실전멘트)\s*\]|(?:실전|추천)\s*멘트\s*[:：]|\b2\.\s*(?:실전|추천)\s*멘트\s*[:：]?)|(?:⚠️\s*)?(?:\[\s*(?:참고|주의사항|주의)\s*\]|(?:참고|주의사항|주의)\s*[:：]|\b3\.\s*(?:참고|주의사항|주의)\s*[:：]?)|$)/i
  );
  const scriptMatch = clean.match(
    /(?:(?:🎯\s*)?(?:\[\s*(?:실전\s*멘트|추천\s*멘트|실전멘트)\s*\]|(?:실전|추천)\s*멘트\s*[:：]|\b2\.\s*(?:실전|추천)\s*멘트\s*[:：]?))\s*([\s\S]*?)(?=(?:⚠️\s*)?(?:\[\s*(?:참고|주의사항|주의)\s*\]|(?:참고|주의사항|주의)\s*[:：]|\b3\.\s*(?:참고|주의사항|주의)\s*[:：]?)|$)/i
  );
  const noteMatch = clean.match(
    /(?:(?:⚠️\s*)?(?:\[\s*(?:참고|주의사항|주의)\s*\]|(?:참고|주의사항|주의)\s*[:：]|\b3\.\s*(?:참고|주의사항|주의)\s*[:：]?))\s*([\s\S]*?)$/i
  );

  let conclusion = conclusionMatch ? conclusionMatch[1].trim() : null;
  let script = scriptMatch ? scriptMatch[1].trim() : null;
  let note = noteMatch ? noteMatch[1].trim() : null;

  // 3. 보조 파서: 이모지 기반 분할
  if (!conclusion && !script && !note && (clean.includes('📌') || clean.includes('🎯') || clean.includes('⚠️'))) {
    const lines = clean.split('\n');
    let currentSection: 'conclusion' | 'script' | 'note' | null = null;
    const parts = { conclusion: [] as string[], script: [] as string[], note: [] as string[] };

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('📌')) {
        currentSection = 'conclusion';
        parts.conclusion.push(trimmed.replace(/^📌\s*(?:결론\s*[:：]?|\[결론\])?\s*/, ''));
      } else if (trimmed.startsWith('🎯')) {
        currentSection = 'script';
        parts.script.push(trimmed.replace(/^🎯\s*(?:실전\s*멘트\s*[:：]?|\[실전\s*멘트\])?\s*/, ''));
      } else if (trimmed.startsWith('⚠️')) {
        currentSection = 'note';
        parts.note.push(trimmed.replace(/^⚠️\s*(?:참고\s*[:：]?|주의\s*[:：]?|\[참고\])?\s*/, ''));
      } else if (currentSection && trimmed) {
        parts[currentSection].push(trimmed);
      }
    }

    if (parts.conclusion.length > 0) conclusion = parts.conclusion.join('\n').trim();
    if (parts.script.length > 0) script = parts.script.join('\n').trim();
    if (parts.note.length > 0) note = parts.note.join('\n').trim();
  }

  const isStructured = Boolean(conclusion || script || note);

  if (!isStructured) {
    return (
      <div className="text-xs md:text-sm text-foreground leading-relaxed whitespace-pre-line font-medium">
        {clean}
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-0.5">
      {/* 1. 핵심 결론 카드 */}
      {conclusion && (
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <span>📌</span>
              <span>핵심 결론</span>
            </span>
          </div>
          <p className="text-xs md:text-sm font-medium text-foreground leading-relaxed whitespace-pre-line pl-0.5">
            {conclusion}
          </p>
        </div>
      )}

      {/* 2. 고객 통화 실전 멘트 카드 */}
      {script && (
        <div className="bg-muted/30 border border-border rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-primary text-primary-foreground shadow-2xs">
              <span>🎯</span>
              <span>고객 통화 실전 멘트</span>
            </span>
            <button
              onClick={() => onCopyText(script.replace(/^["'“”]|["'“”]$/g, '').trim(), '실전 멘트')}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground bg-card px-2 py-0.5 rounded-md border border-border hover:bg-muted transition-colors shadow-2xs"
              title="실전 멘트만 복사"
            >
              <Copy className="w-3 h-3" />
              <span>멘트만 복사</span>
            </button>
          </div>
          <div className="bg-card rounded-lg p-3 border border-border">
            <p className="text-xs md:text-sm font-medium text-foreground leading-relaxed font-sans">
              {script}
            </p>
          </div>
        </div>
      )}

      {/* 3. 실무 주의 & 인계 팁 카드 */}
      {note && (
        <div className="bg-muted/20 border border-border rounded-xl p-3 shadow-2xs">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-secondary text-secondary-foreground border border-border">
              <span>⚠️</span>
              <span>실무 주의 &amp; 인계 팁</span>
            </span>
          </div>
          <p className="text-xs md:text-sm font-medium text-muted-foreground leading-relaxed pl-0.5">
            {note}
          </p>
        </div>
      )}
    </div>
  );
};

interface EducationHubTabProps {
  initialSubView?: SubView;
}

export default function EducationHubTab({ initialSubView }: EducationHubTabProps = {}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  // Core Data State
  const [materials, setMaterials] = useState<TrainingEducationMaterials>(() => getEducationMaterials());
  const [loading, setLoading] = useState<boolean>(false);
  const [activeSubView, setActiveSubView] = useState<SubView>(initialSubView || 'script');

  useEffect(() => {
    if (initialSubView) {
      setActiveSubView(initialSubView);
    }
  }, [initialSubView]);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // NotebookLM Modal
  const [showNotebookModal, setShowNotebookModal] = useState<boolean>(false);

  // Sub-view 1: Script & Rules Tab State
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [activeObjectionId, setActiveObjectionId] = useState<string>('fee_too_high');
  const [selectedFieldCategory, setSelectedFieldCategory] = useState<string>('all');

  // Sub-view 2: Audio Recording Player State
  const [selectedRecId, setSelectedRecId] = useState<string>(materials.recordings[0]?.id || 'rec_1');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackTime, setPlaybackTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentRecording = materials.recordings.find((r) => r.id === selectedRecId) || materials.recordings[0];

  // Sub-view 3: Video Player Modal State
  const [activeVideoModal, setActiveVideoModal] = useState<EducationVideoItem | null>(null);

  // Sub-view 4: FAQ State
  const [faqSearch, setFaqSearch] = useState<string>('');
  const [faqCategory, setFaqCategory] = useState<string>('all');
  const [openFaqIds, setOpenFaqIds] = useState<Record<string, boolean>>({ faq_1: true, faq_5: true });

  // In-App NotebookLM AI Chat State
  const [chatInput, setChatInput] = useState<string>('');
  const [isAnswering, setIsAnswering] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<InAppChatMessage[]>([
    {
      id: 'welcome_1',
      role: 'assistant',
      content: '안녕하세요! 도산 전문 법률 사수 AI입니다.\n\n개인회생·파산 자격 요건, 2026년 가구원수별 최저생계비 계산, 주택임대차 최우선변제금, 그리고 "수임료가 비싸요" 같은 고객 거절 방어 화법 등 무엇이든 질문해 주세요. 사이트 내에서 즉시 1초 만에 답변해 드립니다.',
      timestamp: '안내',
    },
  ]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (showNotebookModal && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, showNotebookModal, isAnswering]);

  // Send question handler
  const handleSendQuestion = async (queryText?: string) => {
    const q = (queryText || chatInput).trim();
    if (!q || isAnswering) return;

    const userMsg: InAppChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsAnswering(true);

    try {
      const reply = await askEducationAssistant(q, materials);
      const aiMsg: InAppChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg: InAppChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `답변 생성 중 오류가 발생했습니다: ${err.message || '서버 응답 없음'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsAnswering(false);
    }
  };

  // Initial Server Sync
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await loadEducationMaterials();
        if (mounted && data) {
          setMaterials(data);
          if (data.recordings?.length > 0 && !selectedRecId) {
            setSelectedRecId(data.recordings[0].id);
          }
        }
      } catch (err) {
        console.error('[EducationHub] Failed to load from server:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Audio Recording Simulation Timer
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.round(100 / playbackSpeed);
      timerRef.current = setInterval(() => {
        setPlaybackTime((prev) => {
          const next = prev + 0.1;
          if (currentRecording && next >= currentRecording.totalSeconds) {
            setIsPlaying(false);
            return currentRecording.totalSeconds;
          }
          return next;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, currentRecording]);

  // When changing recording, reset playback
  const handleSelectRecording = (rec: ModelRecordingItem) => {
    setSelectedRecId(rec.id);
    setIsPlaying(false);
    setPlaybackTime(0);
  };

  const handleTogglePlay = () => {
    if (!currentRecording) return;
    if (playbackTime >= currentRecording.totalSeconds) {
      setPlaybackTime(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (newTime: number) => {
    setPlaybackTime(newTime);
  };

  // Copy to clipboard helper
  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    showToast(`'${label}' 복사되었습니다. (Ctrl+V로 사용)`, 'info');
    setTimeout(() => setCopiedItem(null), 2500);
  };

  // Full 15-item Intake Sheet Copy
  const handleCopyFullIntakeForm = () => {
    const lines = [
      '📋 [법무법인 채무조정 1차 상담 접수 양식]',
      '----------------------------------------',
      ...materials.scriptModule.intakeFields.map(
        (f) => `${f.id}. ${f.title}: (예시: ${f.example})`
      ),
      '----------------------------------------',
      '특이사항 및 전달메모: ',
    ].join('\n');
    handleCopyText(lines, '15대 필수 접수양식 전체');
  };

  // Save changes to cloud
  const handleSaveToCloud = async () => {
    try {
      setIsSaving(true);
      const err = await saveEducationMaterials(materials, user?.name || '관리자');
      if (err) {
        showToast(`저장 실패: ${err}`, 'error');
      } else {
        showToast('교육 자료 및 설정이 클라우드 서버에 영구 보존되었습니다.', 'success');
        setIsEditMode(false);
      }
    } catch (e: any) {
      showToast(`저장 오류: ${e.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default
  const handleResetDefaults = async () => {
    const ok = await confirm({
      title: '교육 자료 기본값 초기화',
      message: '모든 교육 자료와 설정을 시스템 기본값으로 초기화하시겠습니까?\n\n직접 편집하신 스크립트와 가이드가 시스템 표준값으로 덮어씌워집니다.',
      confirmLabel: '초기화 실행',
      cancelLabel: '취소',
      variant: 'destructive'
    });
    if (!ok) return;
    try {
      setIsSaving(true);
      const err = await resetEducationMaterialsToDefault(user?.name || '관리자');
      if (err) {
        showToast(`초기화 실패: ${err}`, 'error');
      } else {
        setMaterials(DEFAULT_EDUCATION_MATERIALS);
        showToast('기본 교육 자료로 성공적으로 초기화되었습니다.', 'success');
        setIsEditMode(false);
      }
    } catch (e: any) {
      showToast(`오류: ${e.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered FAQs
  const filteredFaqs = materials.faqs.filter((faq) => {
    const matchCategory = faqCategory === 'all' || faq.category === faqCategory;
    const q = faqSearch.trim().toLowerCase();
    const matchSearch =
      !q ||
      faq.question.toLowerCase().includes(q) ||
      faq.answer.toLowerCase().includes(q) ||
      faq.tags.some((t) => t.toLowerCase().includes(q));
    return matchCategory && matchSearch;
  });

  const toggleFaq = (id: string) => {
    setOpenFaqIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Active dialogue turn in player
  const activeTurnIndex = currentRecording?.dialogue.reduce((acc, turn, idx) => {
    if (playbackTime >= turn.timeSec) return idx;
    return acc;
  }, 0);

  // Format MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner & Quick Action Buttons */}
      <div className="relative overflow-hidden rounded-xl bg-card border border-border p-5 md:p-6 text-foreground shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
              신입 상담원 실전 역량 마스터 허브
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <span>📚 실전 교육자료 · 모범 녹취 · FAQ 허브</span>
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              1차 표준 스크립트, 15대 필수 인계 서식, 2026 법정 기준표, 거절 극복 화법부터 모범 녹취 청취 및 다빈도 FAQ까지 스스로 학습하고 완벽히 숙달하세요.
            </p>
          </div>

          {/* Action Hub: NotebookLM & Admin CMS Toggle */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* NotebookLM 법률 AI 사수 버튼 */}
            <button
              onClick={() => setShowNotebookModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-card border border-border hover:bg-muted text-foreground font-semibold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
              <span>NotebookLM 법률 AI 사수</span>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </button>

            {/* 관리자 CMS 편집 모드 토글 (관리자만 노출) */}
            {isAdmin && (
              <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border">
                <button
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    isEditMode
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>{isEditMode ? '편집 모드 ON' : '관리자 편집'}</span>
                </button>

                {isEditMode && (
                  <button
                    onClick={handleSaveToCloud}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>{isSaving ? '저장 중...' : '클라우드 저장'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Edit mode active banner */}
        {isEditMode && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-foreground text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" strokeWidth={1.75} />
              <span>
                <strong>관리자 편집 모드 활성화:</strong> 화면의 스크립트, FAQ, 유튜브 영상 및 NotebookLM 링크를 직접 수정할 수 있습니다. 수정을 마치신 후 상단의 <strong>[클라우드 저장]</strong> 버튼을 누르세요.
              </span>
            </div>
            <button
              onClick={handleResetDefaults}
              className="text-xs text-destructive hover:underline ml-4 shrink-0"
            >
              기본값으로 초기화
            </button>
          </div>
        )}
      </div>

      {/* 2. Sub-view Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border overflow-x-auto">
        <button
          onClick={() => setActiveSubView('script')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeSubView === 'script'
              ? 'bg-card text-foreground shadow-2xs border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
          }`}
        >
          <BookOpen className="w-4 h-4 text-primary" />
          <span>📖 실전 교재 & 스크립트</span>
        </button>

        <button
          onClick={() => setActiveSubView('recordings')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeSubView === 'recordings'
              ? 'bg-card text-foreground shadow-2xs border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
          }`}
        >
          <Headphones className="w-4 h-4 text-primary" />
          <span>🎧 실전 모범 녹취 청취관</span>
          <span className="px-1.5 py-0.5 rounded-md text-2xs font-mono font-medium bg-primary/10 text-primary border border-primary/20">
            {materials.recordings.length}선
          </span>
        </button>

        <button
          onClick={() => setActiveSubView('videos')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeSubView === 'videos'
              ? 'bg-card text-foreground shadow-2xs border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
          }`}
        >
          <Youtube className="w-4 h-4 text-primary" />
          <span>🎬 추천 유튜브 교육관</span>
          <span className="px-1.5 py-0.5 rounded-md text-2xs font-mono font-medium bg-primary/10 text-primary border border-primary/20">
            {materials.videos.length}편
          </span>
        </button>

        <button
          onClick={() => setActiveSubView('faq')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeSubView === 'faq'
              ? 'bg-card text-foreground shadow-2xs border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
          }`}
        >
          <HelpCircle className="w-4 h-4 text-primary" />
          <span>❓ 다빈도 FAQ 셀프 검색 센터</span>
          <span className="px-1.5 py-0.5 rounded-md text-2xs font-mono font-medium bg-primary/10 text-primary border border-primary/20">
            {materials.faqs.length}건
          </span>
        </button>

        <button
          onClick={() => setActiveSubView('exam')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeSubView === 'exam'
              ? 'bg-card text-foreground shadow-2xs border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-primary" />
          <span>🎓 상담역량 평가시험</span>
          <span className="px-1.5 py-0.5 rounded-md text-2xs font-mono font-medium bg-primary/10 text-primary border border-primary/20">
            초·중·고급 300제
          </span>
        </button>
      </div>

      {/* 3. Sub-view 1: Script & Educational Materials */}
      {activeSubView === 'script' && (
        <div className="space-y-6">
          {/* 3.1 1차 표준 TM 스크립트 카드 */}
          <div className="p-5 rounded-xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    1차 아웃바운드 TM 정석 스크립트
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    스팸/대출 거부감을 1초 만에 해소하고 정부지원 탕감 접수로 전환하는 표준 화법
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleCopyText(materials.scriptModule.opening, '정석 오프닝 멘트')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors self-start sm:self-center cursor-pointer"
              >
                {copiedItem === '정석 오프닝 멘트' ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                <span>오프닝 멘트 복사</span>
              </button>
            </div>

            {/* Opening Speech Bubble */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-foreground flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-primary animate-pulse" />
                1단계: 10초 돌파 정석 오프닝 (통화 연결 즉시)
              </label>
              {isEditMode ? (
                <textarea
                  rows={4}
                  value={materials.scriptModule.opening}
                  onChange={(e) =>
                    setMaterials({
                      ...materials,
                      scriptModule: { ...materials.scriptModule, opening: e.target.value },
                    })
                  }
                  className="w-full p-3 rounded-lg bg-card border border-border text-xs md:text-sm font-mono text-foreground focus:ring-1 focus:ring-primary outline-none"
                />
              ) : (
                <div className="p-3.5 rounded-lg bg-muted/30 border border-border text-xs md:text-sm text-foreground leading-relaxed font-mono whitespace-pre-line">
                  {materials.scriptModule.opening}
                </div>
              )}
              <p className="text-2xs font-mono text-muted-foreground pl-0.5">
                {materials.scriptModule.openingSub}
              </p>
            </div>

            {/* Middle Empathy Bridge */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-foreground flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-primary" />
                2단계: 중간 공감 리액션 & 안심 브릿지 (월 상환액 파악 시)
              </label>
              {isEditMode ? (
                <textarea
                  rows={3}
                  value={materials.scriptModule.middleBridge}
                  onChange={(e) =>
                    setMaterials({
                      ...materials,
                      scriptModule: { ...materials.scriptModule, middleBridge: e.target.value },
                    })
                  }
                  className="w-full p-3 rounded-lg bg-card border border-border text-xs md:text-sm font-mono text-foreground focus:ring-1 focus:ring-primary outline-none"
                />
              ) : (
                <div className="p-3.5 rounded-lg bg-muted/30 border border-border text-xs md:text-sm text-foreground leading-relaxed font-mono whitespace-pre-line">
                  {materials.scriptModule.middleBridge}
                </div>
              )}
            </div>

            {/* Closing Ment */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-foreground flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-primary" />
                3단계: 사무장 2차 통화 확약 & 깔끔한 클로징 (문진 완료 후)
              </label>
              {isEditMode ? (
                <textarea
                  rows={3}
                  value={materials.scriptModule.closing}
                  onChange={(e) =>
                    setMaterials({
                      ...materials,
                      scriptModule: { ...materials.scriptModule, closing: e.target.value },
                    })
                  }
                  className="w-full p-3 rounded-lg bg-card border border-border text-xs md:text-sm font-mono text-foreground focus:ring-1 focus:ring-primary outline-none"
                />
              ) : (
                <div className="p-3.5 rounded-lg bg-muted/30 border border-border text-xs md:text-sm text-foreground leading-relaxed font-mono whitespace-pre-line">
                  {materials.scriptModule.closing}
                </div>
              )}
            </div>
          </div>

          {/* 3.2 15대 필수 인계 서식 리스트 */}
          <div className="p-5 rounded-xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    사무장 인계 15대 필수 문진 체크리스트
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    2차 정밀 법률 상담 및 변제금 산출을 위해 반드시 수집해야 하는 15가지 핵심 데이터
                  </p>
                </div>
              </div>

              <button
                onClick={handleCopyFullIntakeForm}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs self-start sm:self-center cursor-pointer"
              >
                {copiedItem === '15대 필수 접수양식 전체' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>15대 양식 서식 전체 복사</span>
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {['all', '기본인적', '소득직장', '채무상황', '재산주거', '제도이력'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedFieldCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                    selectedFieldCategory === cat
                      ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                      : 'bg-muted/40 text-muted-foreground hover:text-foreground border border-border'
                  }`}
                >
                  {cat === 'all' ? '전체 보기 (15문항)' : cat}
                </button>
              ))}
            </div>

            {/* Grid of 15 Items */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {materials.scriptModule.intakeFields
                .filter((f) => selectedFieldCategory === 'all' || f.category === selectedFieldCategory)
                .map((field) => (
                  <div
                    key={field.id}
                    className="p-3.5 rounded-lg bg-card border border-border space-y-2 hover:border-primary/40 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-primary/15 text-primary border border-primary/20 font-mono text-xs font-semibold">
                        {field.id}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-2xs font-mono bg-muted text-muted-foreground border border-border">
                        {field.category}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <span>{field.title}</span>
                      {field.required && <span className="text-destructive text-xs">*</span>}
                    </h3>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {field.description}
                    </p>

                    <div className="pt-2 border-t border-border space-y-1">
                      <div className="text-xs font-mono text-muted-foreground">
                        <strong className="text-foreground">예시:</strong> {field.example}
                      </div>
                      <div className="text-xs font-mono text-primary flex items-center gap-1">
                        <span>💡</span>
                        <span>{field.tip}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* 3.3 2025~2026 최신 법정 기준표 (생계비, 최우선변제금, 5대 제도 비교) */}
          <div className="p-5 rounded-xl bg-card border border-border shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border">
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  2025~2026 최신 법정 기준표 치트시트
                </h2>
                <p className="text-xs text-muted-foreground">
                  가구원수별 최저생계비, 주택임대차 최우선변제금 공제액, 채무조정 5대 제도 비교
                </p>
              </div>
            </div>

            {/* Table 1: 2026 최신 확정 최저생계비 및 2025 비교 */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-mono font-medium text-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <span>1. 2026년 최신 공식 확정 가구원수별 기준 중위소득 및 법정 최저생계비 (중위 60%)</span>
                </h3>
                <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 self-start sm:self-auto">
                  2026년 정부 공식 고시 기준
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs text-left font-mono">
                  <thead className="bg-muted/40 text-muted-foreground text-2xs uppercase tracking-wider border-b border-border">
                    <tr>
                      <th className="p-2.5 whitespace-nowrap">가구원수</th>
                      <th className="p-2.5 whitespace-nowrap text-muted-foreground">2026 기준 중위소득 (100%)</th>
                      <th className="p-2.5 whitespace-nowrap text-primary">2026 최저생계비 (60%) [확정]</th>
                      <th className="p-2.5 whitespace-nowrap text-muted-foreground/60">2025 최저생계비 (전년)</th>
                      <th className="p-2.5">실무 상담 포인트 및 변제금 절감 효과</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {materials.legalStandards.livingCosts.map((item) => (
                      <tr key={item.householdSize} className="hover:bg-muted/40 transition-colors">
                        <td className="p-2.5 font-medium whitespace-nowrap text-foreground">{item.householdSize}인 가구</td>
                        <td className="p-2.5 whitespace-nowrap tabular-nums">{item.medianIncome2026 || item.medianIncome}</td>
                        <td className="p-2.5 font-semibold text-primary whitespace-nowrap bg-primary/5 tabular-nums">{item.minLivingCost2026 || item.minLivingCost}</td>
                        <td className="p-2.5 text-muted-foreground whitespace-nowrap line-through tabular-nums">{item.minLivingCost2025 || '2025년 기준'}</td>
                        <td className="p-2.5 text-muted-foreground text-xs leading-relaxed font-sans">
                          {item.advice || (item.householdSize === 1
                            ? '월 소득 155만 원 이상 권장 (생계비 인상으로 변제금 부담 경감)'
                            : `부양가족 생계비 인정되어 월 납입 변제금 대폭 축소`)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: 소액임차 최우선변제금 */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-mono font-medium text-foreground flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-primary" />
                <span>2. 2023년 개정 주택임대차보호법 소액보증금 최우선변제금 (재산 공제)</span>
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs text-left font-mono">
                  <thead className="bg-muted/40 text-muted-foreground text-2xs uppercase tracking-wider border-b border-border">
                    <tr>
                      <th className="p-2.5">지역 구분</th>
                      <th className="p-2.5">해당 관할 지역</th>
                      <th className="p-2.5">소액임차 보증금 한도</th>
                      <th className="p-2.5">최우선 변제금 (재산공제액)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {materials.legalStandards.priorityRepayments.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/40 transition-colors">
                        <td className="p-2.5 font-medium text-foreground">{item.region}</td>
                        <td className="p-2.5 text-xs text-muted-foreground max-w-xs font-sans">{item.targetCities}</td>
                        <td className="p-2.5 tabular-nums">{item.maxDeposit}</td>
                        <td className="p-2.5 font-semibold text-primary tabular-nums">{item.priorityAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 3: 채무조정 5대 제도 비교 */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-mono font-medium text-foreground flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-primary" />
                <span>3. 채무조정 5대 제도 비교표 (법원 회생/파산 vs 신복위 3종)</span>
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs text-left font-mono">
                  <thead className="bg-muted/40 text-muted-foreground text-2xs uppercase tracking-wider border-b border-border">
                    <tr>
                      <th className="p-2.5">제도명</th>
                      <th className="p-2.5">관할 기관</th>
                      <th className="p-2.5">연체 요건</th>
                      <th className="p-2.5">감면율</th>
                      <th className="p-2.5">장점</th>
                      <th className="p-2.5">단점</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {materials.legalStandards.reliefSchemes.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-2.5 font-medium text-foreground whitespace-nowrap">{s.name}</td>
                        <td className="p-2.5 whitespace-nowrap text-muted-foreground">{s.organ}</td>
                        <td className="p-2.5 whitespace-nowrap font-sans">{s.delinquencyReq}</td>
                        <td className="p-2.5 font-semibold text-primary">{s.reductionRate}</td>
                        <td className="p-2.5 text-xs text-muted-foreground max-w-xs font-sans">{s.pros}</td>
                        <td className="p-2.5 text-xs text-muted-foreground max-w-xs font-sans">{s.cons}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 3.4 반론 극복 & 거절 방어 화법 (Objection Guides) */}
          <div className="p-5 sm:p-6 rounded-xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  실전 반론 극복 & 거절 방어 화법 (수임료·스팸의심·신복위)
                </h2>
                <p className="text-xs text-muted-foreground">
                  고객의 본질적인 심리적 저항을 허물고 1차 상담 접수로 이끄는 단계별 대응 매뉴얼
                </p>
              </div>
            </div>

            {/* Objection Switch Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {materials.objectionGuides.map((obj) => (
                <button
                  key={obj.id}
                  onClick={() => setActiveObjectionId(obj.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeObjectionId === obj.id
                      ? 'bg-primary text-primary-foreground shadow-2xs font-bold'
                      : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border'
                  }`}
                >
                  {obj.title}
                </button>
              ))}
            </div>

            {/* Active Objection Guide Content */}
            {(() => {
              const obj =
                materials.objectionGuides.find((o) => o.id === activeObjectionId) ||
                materials.objectionGuides[0];
              if (!obj) return null;
              return (
                <div className="space-y-3.5">
                  {/* Customer Quote Box */}
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <div className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      고객의 전형적인 거절 발화
                    </div>
                    <div className="text-sm font-semibold text-foreground italic">
                      "{obj.customerObjection}"
                    </div>
                    <div className="text-xs text-muted-foreground bg-card/80 p-2.5 rounded-lg border border-border/60">
                      💡 <strong className="text-foreground">고객의 숨은 본심:</strong> {obj.coreIntent}
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="space-y-2.5">
                    {obj.steps.map((st) => (
                      <div
                        key={st.step}
                        className="p-4 rounded-xl bg-card border border-border space-y-2 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            {st.stepTitle}
                          </span>
                          <button
                            onClick={() => handleCopyText(st.speech, `${obj.title} Step ${st.step}`)}
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>화법 복사</span>
                          </button>
                        </div>
                        <div className="p-3.5 rounded-lg bg-muted/30 border border-border text-xs text-foreground leading-relaxed font-medium whitespace-pre-line">
                          {st.speech}
                        </div>
                        <div className="text-2xs text-muted-foreground font-mono">
                          🎯 <strong className="text-foreground/80">효과 및 심리:</strong> {st.psychology}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 3.5 금지사항 & 이관 기준 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Prohibited Rules (부결/기각 위험 사유 사전 차단) */}
            <div className="p-5 rounded-xl bg-card border border-destructive/30 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2 text-destructive font-semibold text-sm border-b border-border pb-2.5">
                <ShieldAlert className="w-4 h-4" />
                <span>4대 절대 금지 원칙 (부결/기각 위험 사전 차단)</span>
              </div>
              <div className="space-y-2">
                {materials.scriptModule.prohibitedRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 space-y-1"
                  >
                    <div className="text-xs font-bold text-destructive flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                      {rule.rule}
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed pl-3">
                      {rule.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transfer Criteria (긴급 보정/기각 위험 케이스 대응) */}
            <div className="p-5 rounded-xl bg-card border border-amber-500/30 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm border-b border-border pb-2.5">
                <AlertTriangle className="w-4 h-4" />
                <span>긴급 보정/기각 위험 케이스 및 타사무소 이관 기준</span>
              </div>
              <div className="space-y-2">
                {materials.scriptModule.transferCriteria.map((crit) => (
                  <div
                    key={crit.id}
                    className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1"
                  >
                    <div className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        {crit.condition}
                      </span>
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        {crit.action}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed pl-3">
                      {crit.note}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Sub-view 2: Audio Recording Hub */}
      {activeSubView === 'recordings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Recording Selector (4 cols) */}
          <div className="lg:col-span-4 space-y-2.5">
            <h2 className="text-xs font-mono font-medium text-foreground flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5 text-primary" />
              <span>실전 모범 녹취 파일 목록</span>
            </h2>

            <div className="space-y-2">
              {materials.recordings.map((rec) => {
                const isSelected = rec.id === selectedRecId;
                return (
                  <button
                    key={rec.id}
                    onClick={() => handleSelectRecording(rec)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors space-y-1.5 cursor-pointer shadow-2xs ${
                      isSelected
                        ? 'bg-primary/10 border-primary ring-1 ring-primary/20'
                        : 'bg-card border-border hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                        {rec.grade}
                      </span>
                      <span className="text-2xs font-mono text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {rec.duration}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-foreground">
                      {rec.title}
                    </h3>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {rec.summary}
                    </p>

                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {rec.highlightTags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="text-2xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Audio Player & Transcript (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {currentRecording ? (
              <div className="p-5 rounded-xl bg-card border border-border shadow-xs space-y-4">
                {/* Recording Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-2xs font-mono font-medium mb-1">
                      {currentRecording.grade} • 종합 {currentRecording.score}점
                    </div>
                    <h2 className="text-base font-semibold text-foreground">
                      {currentRecording.title}
                    </h2>
                    <p className="text-xs text-muted-foreground font-mono">
                      고객: {currentRecording.personaName} ({currentRecording.personaType})
                    </p>
                  </div>

                  {/* Speed Controls */}
                  <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md border border-border self-start sm:self-center font-mono">
                    {[1.0, 1.25, 1.5, 2.0].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setPlaybackSpeed(spd)}
                        className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                          playbackSpeed === spd
                            ? 'bg-card text-foreground font-semibold shadow-2xs border border-border'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audio Player Controller Bar */}
                <div className="p-3.5 rounded-lg bg-muted/30 border border-border space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleTogglePlay}
                        className="p-2.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors shadow-2xs cursor-pointer"
                      >
                        {isPlaying ? <Pause className="w-4 h-4 fill-primary-foreground" /> : <Play className="w-4 h-4 fill-primary-foreground" />}
                      </button>
                      <button
                        onClick={() => {
                          setIsPlaying(false);
                          setPlaybackTime(0);
                        }}
                        className="p-2 rounded-md bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-sm font-semibold text-primary tabular-nums">
                        {formatTime(playbackTime)}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {' '}
                        / {formatTime(currentRecording.totalSeconds)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Seek Bar */}
                  <div className="relative">
                    <input
                      type="range"
                      min={0}
                      max={currentRecording.totalSeconds}
                      step={0.5}
                      value={playbackTime}
                      onChange={(e) => handleSeek(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-muted rounded-md appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                </div>

                {/* Synchronized Transcript */}
                <div className="space-y-2.5 pt-1">
                  <h3 className="text-xs font-mono text-muted-foreground flex items-center justify-between">
                    <span>실시간 대화록 (발화 클릭 시 해당 구간으로 이동)</span>
                    <span className="text-primary font-mono text-2xs">
                      초록색 테두리: 현재 재생 발화
                    </span>
                  </h3>

                  <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                    {currentRecording.dialogue.map((turn, tIdx) => {
                      const isCurrent = tIdx === activeTurnIndex;
                      const isAgent = turn.speaker === '상담원';

                      return (
                        <div
                          key={turn.turn}
                          onClick={() => handleSeek(turn.timeSec)}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors space-y-1 ${
                            isCurrent
                              ? 'bg-primary/10 border-primary ring-1 ring-primary/20 shadow-2xs'
                              : 'bg-card border-border hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-2xs font-mono px-1.5 py-0.5 rounded-md border ${
                                isAgent
                                  ? 'bg-primary/15 text-primary border-primary/20'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              {turn.speaker}
                            </span>
                            <span className="text-2xs font-mono text-muted-foreground">
                              {turn.timeLabel}
                            </span>
                          </div>

                          <p className="text-xs text-foreground leading-relaxed">
                            {turn.text}
                          </p>

                          {turn.coachingTip && (
                            <div className="pt-1 text-2xs font-mono text-primary flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-primary" />
                              <span>코칭 포인트: {turn.coachingTip}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground text-xs">녹취 파일이 없습니다.</div>
            )}
          </div>
        </div>
      )}

      {/* 5. Sub-view 3: Recommended YouTube Hub */}
      {activeSubView === 'videos' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Youtube className="w-4 h-4 text-primary" />
                <span>추천 유튜브 실전 교육관</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                제도 지식과 아웃바운드 영업 스킬을 사이트 이탈 없이 고화질 인앱 플레이어로 즉시 시청하세요.
              </p>
            </div>

            {isEditMode && (
              <button
                onClick={() => {
                  const newVid: EducationVideoItem = {
                    id: `vid_${Date.now()}`,
                    title: '신규 유튜브 교육 영상',
                    description: '영상 설명을 입력하세요.',
                    youtubeId: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                    duration: '10분 00초',
                    category: '실전 화법',
                    keyTakeaway: '핵심 요약을 입력하세요.',
                  };
                  setMaterials({
                    ...materials,
                    videos: [newVid, ...materials.videos],
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-mono font-medium hover:bg-primary/90 transition-colors shadow-2xs self-start sm:self-center cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>영상 추가하기</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {materials.videos.map((vid) => (
              <div
                key={vid.id}
                className="rounded-xl bg-card border border-border shadow-xs overflow-hidden flex flex-col justify-between"
              >
                {/* 16:9 Video Embed Player */}
                <div className="relative aspect-video bg-muted/40 w-full overflow-hidden border-b border-border">
                  <iframe
                    src={vid.youtubeId}
                    title={vid.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                        {vid.category}
                      </span>
                      <span className="text-2xs font-mono text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {vid.duration}
                      </span>
                    </div>

                    {isEditMode ? (
                      <input
                        type="text"
                        value={vid.title}
                        onChange={(e) =>
                          setMaterials({
                            ...materials,
                            videos: materials.videos.map((v) =>
                              v.id === vid.id ? { ...v, title: e.target.value } : v
                            ),
                          })
                        }
                        className="w-full p-2 text-sm font-semibold rounded-md border border-border bg-card text-foreground font-mono focus:ring-1 focus:ring-primary outline-none"
                      />
                    ) : (
                      <h3 className="text-sm font-semibold text-foreground leading-snug">
                        {vid.title}
                      </h3>
                    )}

                    {isEditMode ? (
                      <textarea
                        rows={2}
                        value={vid.description}
                        onChange={(e) =>
                          setMaterials({
                            ...materials,
                            videos: materials.videos.map((v) =>
                              v.id === vid.id ? { ...v, description: e.target.value } : v
                            ),
                          })
                        }
                        className="w-full p-2 text-xs rounded-md border border-border bg-card text-muted-foreground font-mono focus:ring-1 focus:ring-primary outline-none"
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {vid.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-border flex items-center justify-between">
                    <div className="text-xs font-mono text-primary flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>{vid.keyTakeaway}</span>
                    </div>

                    {isEditMode && (
                      <button
                        onClick={() =>
                          setMaterials({
                            ...materials,
                            videos: materials.videos.filter((v) => v.id !== vid.id),
                          })
                        }
                        className="p-1 rounded-md text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Sub-view 4: Searchable FAQ Center */}
      {activeSubView === 'faq' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                <span>신입 상담원 다빈도 FAQ 셀프 검색 센터</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                관리자에게 매일 묻는 4대 핵심 질문들을 검색창을 통해 1초 만에 스스로 해결하세요.
              </p>
            </div>

            {isEditMode && (
              <button
                onClick={() => {
                  const newFaq: EducationFaqItem = {
                    id: `faq_${Date.now()}`,
                    category: 'eligibility',
                    question: '새로운 질문을 입력하세요.',
                    answer: '명확하고 정돈된 답변 가이드를 작성하세요.',
                    highlightKeyword: '핵심 키워드',
                    tags: ['신규'],
                  };
                  setMaterials({
                    ...materials,
                    faqs: [newFaq, ...materials.faqs],
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-mono font-medium hover:bg-primary/90 transition-colors shadow-2xs self-start sm:self-center cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>FAQ 추가하기</span>
              </button>
            )}
          </div>

          {/* Search & Category Filter */}
          <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder="궁금한 단어를 입력하세요 (예: 무직자, 수임료, 번호출처, 문자발송, 배우자...)"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted/40 border border-border text-xs md:text-sm font-mono text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {[
                { id: 'all', label: '전체 질문' },
                { id: 'eligibility', label: '자격 및 제도 요건' },
                { id: 'objection', label: '고객 의심 및 반론' },
                { id: 'intake_rule', label: '문진 및 접수 규정' },
                { id: 'system_transfer', label: '시스템 및 이관 규정' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFaqCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    faqCategory === cat.id
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* FAQ Accordion List */}
          <div className="space-y-3">
            {filteredFaqs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground bg-card rounded-xl border border-border">
                검색된 질문이 없습니다. 다른 키워드로 검색해 보세요.
              </div>
            ) : (
              filteredFaqs.map((faq) => {
                const isOpen = openFaqIds[faq.id] ?? false;

                return (
                  <div
                    key={faq.id}
                    className="rounded-xl bg-card border border-border shadow-xs overflow-hidden transition-all"
                  >
                    <button
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full text-left p-4 md:p-5 flex items-start justify-between gap-3 hover:bg-muted/40 transition-all cursor-pointer"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-primary/10 text-primary border border-primary/20 font-bold text-xs flex items-center justify-center shrink-0">
                            Q
                          </span>
                          <span className="text-xs font-semibold text-primary">
                            {faq.category === 'eligibility'
                              ? '자격/제도'
                              : faq.category === 'objection'
                              ? '의심/반론'
                              : faq.category === 'intake_rule'
                              ? '문진규정'
                              : '이관규정'}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-foreground leading-snug">
                          {faq.question}
                        </h3>
                      </div>

                      <div className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 border-t border-border bg-muted/20 space-y-3">
                        <div className="flex items-start gap-2.5 pt-2">
                          <span className="w-5 h-5 rounded-md bg-primary/10 text-primary border border-primary/20 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            A
                          </span>
                          <div className="text-xs text-foreground leading-relaxed font-medium space-y-2 flex-1">
                            {isEditMode ? (
                              <textarea
                                rows={3}
                                value={faq.answer}
                                onChange={(e) =>
                                  setMaterials({
                                    ...materials,
                                    faqs: materials.faqs.map((f) =>
                                      f.id === faq.id ? { ...f, answer: e.target.value } : f
                                    ),
                                  })
                                }
                                className="w-full p-3 rounded-xl border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                              />
                            ) : (
                              <p className="whitespace-pre-line">{faq.answer}</p>
                            )}

                            {faq.highlightKeyword && (
                              <div className="inline-block px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-bold shadow-2xs">
                                💡 핵심 요약: {faq.highlightKeyword}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <div className="flex flex-wrap gap-1">
                            {faq.tags.map((t, tidx) => (
                              <span
                                key={tidx}
                                className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border font-mono"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyText(faq.answer, `FAQ 답변`)}
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              <span>답변 복사</span>
                            </button>

                            {isEditMode && (
                              <button
                                onClick={() =>
                                  setMaterials({
                                    ...materials,
                                    faqs: materials.faqs.filter((f) => f.id !== faq.id),
                                  })
                                }
                                className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 font-bold ml-2"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>삭제</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 7. NotebookLM Direct In-App AI Q&A Modal */}
      {showNotebookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-3xl rounded-2xl bg-card border border-border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-foreground">
            {/* Modal Header */}
            <div className="p-5 md:p-6 pb-4 border-b border-border flex items-start justify-between gap-4 bg-muted/40">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    사이트 내 실시간 즉답 모드
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  <span>AI 법률 사수 실시간 Q&A</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  새 창으로 나갈 필요 없이, 질문을 입력하면 1초 만에 법률 및 화법 답변을 받으실 수 있습니다.
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() =>
                    setChatMessages([
                      {
                        id: 'init_reset',
                        role: 'assistant',
                        content: '대화 기록이 초기화되었습니다. 궁금하신 도산 법률, 최저생계비 산출, 거절 대응 화법을 편하게 질문해 주세요!',
                        timestamp: '안내',
                      },
                    ])
                  }
                  title="대화 초기화"
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs flex items-center gap-1 font-medium"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">초기화</span>
                </button>
                <button
                  onClick={() => setShowNotebookModal(false)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Chat Message Stream */}
            <div
              ref={chatScrollRef}
              className="flex-1 p-5 md:p-6 overflow-y-auto space-y-4 bg-muted/10 min-h-[300px] max-h-[420px]"
            >
              {chatMessages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-2xs">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[88%] md:max-w-[85%] rounded-2xl p-4 text-xs md:text-sm leading-relaxed space-y-2.5 shadow-2xs ${
                        isUser
                          ? 'bg-primary text-primary-foreground rounded-tr-none font-medium'
                          : 'bg-card text-foreground border border-border rounded-tl-none font-medium'
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-line font-medium">{msg.content}</div>
                      ) : (
                        <FormattedAiAnswer
                          content={msg.content}
                          onCopyText={handleCopyText}
                        />
                      )}

                      <div className="flex items-center justify-between pt-1.5 border-t border-border/60 text-xs opacity-75">
                        <span className="font-mono text-muted-foreground">{msg.timestamp}</span>
                        {!isUser && (
                          <button
                            onClick={() => handleCopyText(msg.content.replace(/\*\*/g, ''), 'AI 전체 답변')}
                            className="hover:underline flex items-center gap-1 font-medium ml-3 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            <span>전체 답변 복사</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isAnswering && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 animate-pulse">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="p-4 rounded-2xl bg-card border border-border rounded-tl-none text-xs text-muted-foreground flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary animate-spin" />
                    <span>2026년 법정 기준표와 실무준칙을 정밀 검색하여 최적의 답변을 작성하고 있습니다...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="p-4 md:p-5 border-t border-border bg-card space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendQuestion();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="법률 요건이나 화법을 질문하세요 (예: 알바도 회생 되나요? 빚 1,500만 원인데...)"
                  disabled={isAnswering}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-card border border-border text-xs md:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isAnswering}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs md:text-sm transition-colors shadow-2xs active:scale-95 disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-4 h-4 fill-primary-foreground" />
                  <span>질문하기</span>
                </button>
              </form>

              {/* Admin URL Setting (When in edit mode) */}
              {isEditMode && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5 mt-2">
                  <label className="text-xs font-bold text-amber-400">
                    관리자용 공식 공유 노트북 URL 설정 (외부 링크 변경 시):
                  </label>
                  <input
                    type="text"
                    value={materials.notebookLm.sharedUrl}
                    onChange={(e) =>
                      setMaterials({
                        ...materials,
                        notebookLm: { ...materials.notebookLm, sharedUrl: e.target.value },
                      })
                    }
                    className="w-full p-2 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none font-mono"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Sub-view 5: Evaluation Exam System (초·중·고급 300제 4지선다형) */}
      {activeSubView === 'exam' && <ExamSection />}
    </div>
  );
}
