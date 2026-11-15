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
} from '../../services/trainingEducationService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
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
} from 'lucide-react';

type SubView = 'script' | 'recordings' | 'videos' | 'faq';

export default function EducationHubTab() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  // Core Data State
  const [materials, setMaterials] = useState<TrainingEducationMaterials>(() => getEducationMaterials());
  const [loading, setLoading] = useState<boolean>(false);
  const [activeSubView, setActiveSubView] = useState<SubView>('script');
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
    if (!window.confirm('모든 교육 자료와 설정을 시스템 기본값으로 초기화하시겠습니까?')) return;
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 p-6 md:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-indigo-200 border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              신입 상담원 실전 역량 마스터 허브
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>📚 실전 교육자료 · 모범 녹취 · FAQ 허브</span>
            </h1>
            <p className="text-sm text-indigo-100/90 leading-relaxed">
              1차 표준 스크립트, 15대 필수 인계 서식, 2025 법정 기준표, 거절 극복 화법부터 모범 녹취 청취 및 다빈도 FAQ까지 스스로 학습하고 완벽히 숙달하세요.
            </p>
          </div>

          {/* Action Hub: NotebookLM & Admin CMS Toggle */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* NotebookLM 법률 AI 사수 버튼 */}
            <button
              onClick={() => setShowNotebookModal(true)}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-gray-950 font-bold text-xs md:text-sm hover:from-amber-300 hover:to-orange-400 transition-all shadow-lg shadow-orange-500/25 active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-gray-950 fill-gray-950" />
              <span>🤖 NotebookLM 법률 AI 사수</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>

            {/* 관리자 CMS 편집 모드 토글 (관리자만 노출) */}
            {isAdmin && (
              <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md p-1.5 rounded-2xl border border-white/10">
                <button
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isEditMode
                      ? 'bg-amber-500 text-gray-950 shadow-md'
                      : 'text-gray-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditMode ? '편집 모드 ON' : '관리자 편집'}</span>
                </button>

                {isEditMode && (
                  <button
                    onClick={handleSaveToCloud}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-all shadow-md active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? '저장 중...' : '클라우드 저장'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Edit mode active banner */}
        {isEditMode && (
          <div className="mt-4 p-3 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>관리자 편집 모드 활성화:</strong> 화면의 스크립트, FAQ, 유튜브 영상 및 NotebookLM 링크를 직접 수정할 수 있습니다. 수정을 마치신 후 상단의 <strong>[클라우드 저장]</strong> 버튼을 누르세요.
              </span>
            </div>
            <button
              onClick={handleResetDefaults}
              className="text-xs text-rose-300 hover:text-rose-100 underline ml-4 shrink-0"
            >
              기본값으로 초기화
            </button>
          </div>
        )}
      </div>

      {/* 2. Sub-view Tabs Navigation */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <button
          onClick={() => setActiveSubView('script')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shrink-0 ${
            activeSubView === 'script'
              ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>📖 실전 교재 & 스크립트</span>
        </button>

        <button
          onClick={() => setActiveSubView('recordings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shrink-0 ${
            activeSubView === 'recordings'
              ? 'bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Headphones className="w-4 h-4" />
          <span>🎧 실전 모범 녹취 청취관</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
            {materials.recordings.length}선
          </span>
        </button>

        <button
          onClick={() => setActiveSubView('videos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shrink-0 ${
            activeSubView === 'videos'
              ? 'bg-white dark:bg-gray-900 text-rose-600 dark:text-rose-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Youtube className="w-4 h-4" />
          <span>🎬 추천 유튜브 교육관</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
            {materials.videos.length}편
          </span>
        </button>

        <button
          onClick={() => setActiveSubView('faq')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shrink-0 ${
            activeSubView === 'faq'
              ? 'bg-white dark:bg-gray-900 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>❓ 다빈도 FAQ 셀프 검색 센터</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
            {materials.faqs.length}건
          </span>
        </button>
      </div>

      {/* 3. Sub-view 1: Script & Educational Materials */}
      {activeSubView === 'script' && (
        <div className="space-y-6">
          {/* 3.1 1차 표준 TM 스크립트 카드 */}
          <div className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">
                    1차 아웃바운드 TM 정석 스크립트
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    스팸/대출 거부감을 1초 만에 해소하고 정부지원 탕감 접수로 전환하는 표준 화법
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleCopyText(materials.scriptModule.opening, '정석 오프닝 멘트')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 transition-all self-start sm:self-center"
              >
                {copiedItem === '정석 오프닝 멘트' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>오프닝 멘트 복사</span>
              </button>
            </div>

            {/* Opening Speech Bubble */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
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
                  className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-medium whitespace-pre-line">
                  {materials.scriptModule.opening}
                </div>
              )}
              <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium pl-1">
                {materials.scriptModule.openingSub}
              </p>
            </div>

            {/* Middle Empathy Bridge */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
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
                  className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-medium whitespace-pre-line">
                  {materials.scriptModule.middleBridge}
                </div>
              )}
            </div>

            {/* Closing Ment */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-purple-500" />
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
                  className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              ) : (
                <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50 text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-medium whitespace-pre-line">
                  {materials.scriptModule.closing}
                </div>
              )}
            </div>
          </div>

          {/* 3.2 15대 필수 인계 서식 리스트 */}
          <div className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">
                    사무장 인계 15대 필수 문진 체크리스트
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    2차 정밀 법률 상담 및 변제금 산출을 위해 반드시 수집해야 하는 15가지 핵심 데이터
                  </p>
                </div>
              </div>

              <button
                onClick={handleCopyFullIntakeForm}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md active:scale-95 self-start sm:self-center"
              >
                {copiedItem === '15대 필수 접수양식 전체' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>15대 양식 서식 전체 복사</span>
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {['all', '기본인적', '소득직장', '채무상황', '재산주거', '제도이력'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedFieldCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedFieldCategory === cat
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
                >
                  {cat === 'all' ? '전체 보기 (15문항)' : cat}
                </button>
              ))}
            </div>

            {/* Grid of 15 Items */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {materials.scriptModule.intakeFields
                .filter((f) => selectedFieldCategory === 'all' || f.category === selectedFieldCategory)
                .map((field) => (
                  <div
                    key={field.id}
                    className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-700/80 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs">
                        {field.id}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                        {field.category}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <span>{field.title}</span>
                      {field.required && <span className="text-rose-500 text-xs">*</span>}
                    </h3>

                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      {field.description}
                    </p>

                    <div className="pt-2 border-t border-gray-200/60 dark:border-gray-800 space-y-1">
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        <strong className="text-gray-700 dark:text-gray-300">예시:</strong> {field.example}
                      </div>
                      <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                        💡 {field.tip}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* 3.3 2025~2026 최신 법정 기준표 (생계비, 최우선변제금, 5대 제도 비교) */}
          <div className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">
                  2025~2026 최신 법정 기준표 치트시트
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  가구원수별 최저생계비, 주택임대차 최우선변제금 공제액, 채무조정 5대 제도 비교
                </p>
              </div>
            </div>

            {/* Table 1: 2025 최저생계비 */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                <span>1. 2025년 가구원수별 기준 중위소득 및 최저생계비 (중위 60%)</span>
              </h3>
              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900/80 text-gray-600 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="p-3">가구원수</th>
                      <th className="p-3">2025 기준 중위소득</th>
                      <th className="p-3">법정 최저생계비 (중위 60%)</th>
                      <th className="p-3">실무 상담 포인트</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                    {materials.legalStandards.livingCosts.map((item) => (
                      <tr key={item.householdSize} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20">
                        <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400">{item.householdSize}인 가구</td>
                        <td className="p-3">{item.medianIncome}</td>
                        <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">{item.minLivingCost}</td>
                        <td className="p-3 text-gray-500 dark:text-gray-400">
                          {item.householdSize === 1
                            ? '월 소득 150만 원 이상이어야 변제 수행 가능'
                            : `배우자 및 자녀 부양 시 생계비 인정되어 변제금 대폭 경감`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: 소액임차 최우선변제금 */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Home className="w-4 h-4 text-purple-500" />
                <span>2. 2023년 개정 주택임대차보호법 소액보증금 최우선변제금 (재산 공제)</span>
              </h3>
              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900/80 text-gray-600 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="p-3">지역 구분</th>
                      <th className="p-3">해당 관할 지역</th>
                      <th className="p-3">소액임차 보증금 한도</th>
                      <th className="p-3">최우선 변제금 (재산공제액)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                    {materials.legalStandards.priorityRepayments.map((item, idx) => (
                      <tr key={idx} className="hover:bg-purple-50/30 dark:hover:bg-purple-950/20">
                        <td className="p-3 font-bold text-purple-600 dark:text-purple-400">{item.region}</td>
                        <td className="p-3 text-[11px] text-gray-600 dark:text-gray-400 max-w-xs">{item.targetCities}</td>
                        <td className="p-3 font-semibold">{item.maxDeposit}</td>
                        <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">{item.priorityAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 3: 채무조정 5대 제도 비교 */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-500" />
                <span>3. 채무조정 5대 제도 비교표 (법원 회생/파산 vs 신복위 3종)</span>
              </h3>
              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900/80 text-gray-600 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="p-3">제도명</th>
                      <th className="p-3">관할 기관</th>
                      <th className="p-3">연체 요건</th>
                      <th className="p-3">감면율</th>
                      <th className="p-3">장점</th>
                      <th className="p-3">단점</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-800 dark:text-gray-200 font-medium">
                    {materials.legalStandards.reliefSchemes.map((s) => (
                      <tr key={s.id} className="hover:bg-amber-50/30 dark:hover:bg-amber-950/20">
                        <td className="p-3 font-bold text-gray-900 dark:text-white whitespace-nowrap">{s.name}</td>
                        <td className="p-3 whitespace-nowrap text-indigo-600 dark:text-indigo-400">{s.organ}</td>
                        <td className="p-3 whitespace-nowrap">{s.delinquencyReq}</td>
                        <td className="p-3 font-bold text-rose-600 dark:text-rose-400">{s.reductionRate}</td>
                        <td className="p-3 text-[11px] text-emerald-700 dark:text-emerald-300 max-w-xs">{s.pros}</td>
                        <td className="p-3 text-[11px] text-rose-700 dark:text-rose-300 max-w-xs">{s.cons}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 3.4 반론 극복 & 거절 방어 화법 (Objection Guides) */}
          <div className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">
                  실전 반론 극복 & 거절 방어 화법 (수임료·스팸의심·신복위)
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  고객의 본질적인 심리적 저항을 허물고 1차 상담 접수로 이끄는 단계별 대응 매뉴얼
                </p>
              </div>
            </div>

            {/* Objection Switch Tabs */}
            <div className="flex flex-wrap gap-2">
              {materials.objectionGuides.map((obj) => (
                <button
                  key={obj.id}
                  onClick={() => setActiveObjectionId(obj.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeObjectionId === obj.id
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-400 hover:text-gray-900'
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
                <div className="space-y-4">
                  {/* Customer Quote Box */}
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 space-y-1.5">
                    <div className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      고객의 전형적인 거절 발화
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      "{obj.customerObjection}"
                    </div>
                    <div className="text-xs text-rose-700 dark:text-rose-300 font-medium pt-1">
                      💡 <strong>고객의 숨은 본심:</strong> {obj.coreIntent}
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="space-y-3">
                    {obj.steps.map((st) => (
                      <div
                        key={st.step}
                        className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                            {st.stepTitle}
                          </span>
                          <button
                            onClick={() => handleCopyText(st.speech, `${obj.title} Step ${st.step}`)}
                            className="text-xs text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 font-bold"
                          >
                            <Copy className="w-3 h-3" />
                            <span>화법 복사</span>
                          </button>
                        </div>
                        <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/60 text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-medium whitespace-pre-line">
                          {st.speech}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                          🎯 <strong>효과 및 심리:</strong> {st.psychology}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 3.5 금지사항 & 이관 기준 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Prohibited Rules */}
            <div className="p-5 rounded-3xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-4">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-black text-sm">
                <ShieldAlert className="w-4 h-4" />
                <span>4대 절대 금지 원칙 (컴플라이언스)</span>
              </div>
              <div className="space-y-2.5">
                {materials.scriptModule.prohibitedRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-3 rounded-2xl bg-white dark:bg-gray-900 border border-rose-100 dark:border-rose-900/50 space-y-1"
                  >
                    <div className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      {rule.rule}
                    </div>
                    <div className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                      {rule.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transfer Criteria */}
            <div className="p-5 rounded-3xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-4">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-black text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>신속 컨설팅 및 타사무소 이관 기준</span>
              </div>
              <div className="space-y-2.5">
                {materials.scriptModule.transferCriteria.map((crit) => (
                  <div
                    key={crit.id}
                    className="p-3 rounded-2xl bg-white dark:bg-gray-900 border border-amber-100 dark:border-amber-900/50 space-y-1"
                  >
                    <div className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center justify-between">
                      <span>{crit.condition}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                        {crit.action}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
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
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Headphones className="w-4 h-4 text-emerald-500" />
              <span>실전 모범 녹취 파일 목록</span>
            </h2>

            <div className="space-y-2.5">
              {materials.recordings.map((rec) => {
                const isSelected = rec.id === selectedRecId;
                return (
                  <button
                    key={rec.id}
                    onClick={() => handleSelectRecording(rec)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all space-y-2 ${
                      isSelected
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 shadow-sm ring-1 ring-emerald-500'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {rec.grade}
                      </span>
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {rec.duration}
                      </span>
                    </div>

                    <h3 className="text-sm font-black text-gray-900 dark:text-white">
                      {rec.title}
                    </h3>

                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {rec.summary}
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {rec.highlightTags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
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
              <div className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-5">
                {/* Recording Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
                  <div>
                    <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-1">
                      {currentRecording.grade} • 종합 {currentRecording.score}점
                    </div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">
                      {currentRecording.title}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      고객: {currentRecording.personaName} ({currentRecording.personaType})
                    </p>
                  </div>

                  {/* Speed Controls */}
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl self-start sm:self-center">
                    {[1.0, 1.25, 1.5, 2.0].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setPlaybackSpeed(spd)}
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                          playbackSpeed === spd
                            ? 'bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audio Player Controller Bar */}
                <div className="p-4 rounded-2xl bg-gray-900 text-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleTogglePlay}
                        className="p-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold transition-all shadow-md active:scale-95"
                      >
                        {isPlaying ? <Pause className="w-5 h-5 fill-gray-950" /> : <Play className="w-5 h-5 fill-gray-950" />}
                      </button>
                      <button
                        onClick={() => {
                          setIsPlaying(false);
                          setPlaybackTime(0);
                        }}
                        className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-mono font-bold text-emerald-400">
                        {formatTime(playbackTime)}
                      </span>
                      <span className="text-xs font-mono text-gray-400">
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
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                </div>

                {/* Synchronized Transcript */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center justify-between">
                    <span>실시간 대화록 (발화 클릭 시 해당 구간으로 이동)</span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      초록색 테두리: 현재 재생 발화
                    </span>
                  </h3>

                  <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                    {currentRecording.dialogue.map((turn, tIdx) => {
                      const isCurrent = tIdx === activeTurnIndex;
                      const isAgent = turn.speaker === '상담원';

                      return (
                        <div
                          key={turn.turn}
                          onClick={() => handleSeek(turn.timeSec)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all space-y-1.5 ${
                            isCurrent
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/30 shadow-sm'
                              : 'bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                isAgent
                                  ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                                  : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {turn.speaker}
                            </span>
                            <span className="text-[11px] font-mono text-gray-400">
                              {turn.timeLabel}
                            </span>
                          </div>

                          <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                            {turn.text}
                          </p>

                          {turn.coachingTip && (
                            <div className="pt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-emerald-500" />
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
              <div className="p-12 text-center text-gray-400">녹취 파일이 없습니다.</div>
            )}
          </div>
        </div>
      )}

      {/* 5. Sub-view 3: Recommended YouTube Hub */}
      {activeSubView === 'videos' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Youtube className="w-5 h-5 text-rose-500" />
                <span>추천 유튜브 실전 교육관</span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
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
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all shadow-md self-start sm:self-center"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>영상 추가하기</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {materials.videos.map((vid) => (
              <div
                key={vid.id}
                className="rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col justify-between"
              >
                {/* 16:9 Video Embed Player */}
                <div className="relative aspect-video bg-gray-950 w-full overflow-hidden">
                  <iframe
                    src={vid.youtubeId}
                    title={vid.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                        {vid.category}
                      </span>
                      <span className="text-xs font-mono text-gray-400 flex items-center gap-1">
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
                        className="w-full p-2 text-sm font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                      />
                    ) : (
                      <h3 className="text-sm font-black text-gray-900 dark:text-white leading-snug">
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
                        className="w-full p-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                      />
                    ) : (
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        {vid.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                      <Lightbulb className="w-3 h-3" />
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
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"
                      >
                        <Trash2 className="w-4 h-4" />
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
              <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-purple-500" />
                <span>신입 상담원 다빈도 FAQ 셀프 검색 센터</span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
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
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-all shadow-md self-start sm:self-center"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>FAQ 추가하기</span>
              </button>
            )}
          </div>

          {/* Search & Category Filter */}
          <div className="p-4 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder="궁금한 단어를 입력하세요 (예: 무직자, 수임료, 번호출처, 문자발송, 배우자...)"
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    faqCategory === cat.id
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-400 hover:text-gray-900'
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
              <div className="p-12 text-center text-gray-400 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700">
                검색된 질문이 없습니다. 다른 키워드로 검색해 보세요.
              </div>
            ) : (
              filteredFaqs.map((faq) => {
                const isOpen = openFaqIds[faq.id] ?? false;

                return (
                  <div
                    key={faq.id}
                    className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden transition-all"
                  >
                    <button
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full text-left p-4 md:p-5 flex items-start justify-between gap-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-all"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-black text-xs flex items-center justify-center shrink-0">
                            Q
                          </span>
                          <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                            {faq.category === 'eligibility'
                              ? '자격/제도'
                              : faq.category === 'objection'
                              ? '의심/반론'
                              : faq.category === 'intake_rule'
                              ? '문진규정'
                              : '이관규정'}
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-gray-900 dark:text-white leading-snug">
                          {faq.question}
                        </h3>
                      </div>

                      <div className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-gray-700/60 bg-purple-50/20 dark:bg-purple-950/10 space-y-3">
                        <div className="flex items-start gap-2.5 pt-2">
                          <span className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                            A
                          </span>
                          <div className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-medium space-y-2 flex-1">
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
                                className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs"
                              />
                            ) : (
                              <p className="whitespace-pre-line">{faq.answer}</p>
                            )}

                            {faq.highlightKeyword && (
                              <div className="inline-block px-2.5 py-1 rounded-lg bg-purple-100/80 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 text-[11px] font-bold">
                                💡 핵심 요약: {faq.highlightKeyword}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                          <div className="flex flex-wrap gap-1">
                            {faq.tags.map((t, tidx) => (
                              <span
                                key={tidx}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyText(faq.answer, `FAQ 답변`)}
                              className="text-[11px] text-gray-500 hover:text-purple-600 flex items-center gap-1 font-bold"
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
                                className="text-[11px] text-rose-500 hover:text-rose-700 flex items-center gap-1 font-bold ml-2"
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

      {/* 7. NotebookLM Direct Modal / Setup Helper */}
      {showNotebookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setShowNotebookModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                Google NotebookLM 법률 지식 비서
              </div>
              <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">
                {materials.notebookLm.notebookTitle}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {materials.notebookLm.notebookDescription}
              </p>
            </div>

            {/* Main Action Launch Button */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-gray-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-orange-500/20">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-gray-900">상담원 100명 무료 동시 접속</div>
                <div className="text-sm font-black">구글 공식 NotebookLM 지식 챗봇 열기</div>
              </div>
              <a
                href={materials.notebookLm.sharedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gray-950 text-white font-bold text-xs hover:bg-gray-800 transition-all shrink-0"
              >
                <span>새 창에서 바로 질문하기</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Admin Notebook URL Setting (Only in edit mode) */}
            {isEditMode && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 space-y-2">
                <label className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  대표님 공유 노트북 URL 설정 (링크가 있는 모든 사용자-뷰어)
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
                  className="w-full p-2.5 text-xs rounded-xl border border-amber-300 dark:border-amber-600 bg-white dark:bg-gray-900"
                />
              </div>
            )}

            {/* Sample Prompts for Counselors (One-click copy) */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>추천 질문 리스트 (클릭 시 복사되어 바로 붙여넣기 가능)</span>
              </h3>
              <div className="space-y-1.5">
                {materials.notebookLm.sampleQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCopyText(q, `질문 ${idx + 1}`)}
                    className="w-full text-left p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-orange-400 text-xs text-gray-800 dark:text-gray-200 font-medium flex items-center justify-between group transition-all"
                  >
                    <span>💬 "{q}"</span>
                    <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-orange-500 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>

            {/* Setup Guide for Administrator */}
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 space-y-2">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                💡 대표님 NotebookLM 5분 설정 가이드
              </h4>
              <ol className="text-[11px] text-gray-600 dark:text-gray-400 list-decimal list-inside space-y-1 leading-relaxed">
                {materials.notebookLm.guideSteps.map((step, sIdx) => (
                  <li key={sIdx}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
