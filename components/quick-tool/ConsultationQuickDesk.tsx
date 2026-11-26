import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  X,
  Minus,
  Maximize2,
  RotateCcw,
  Eye,
  Sliders,
  Calendar,
  MapPin,
  Bot,
  Calculator,
  Home,
  BookOpen,
} from 'lucide-react';
import { useDraggableWindow } from './hooks/useDraggableWindow';
import { useResizableWindow, SIZE_PRESETS } from './hooks/useResizableWindow';
import { AgeCalculatorTab } from './tabs/AgeCalculatorTab';
import { CourtFinderTab } from './tabs/CourtFinderTab';
import { NotebookLmAssistantTab } from './tabs/NotebookLmAssistantTab';
import { LivingCostTab } from './tabs/LivingCostTab';
import { ExemptAssetTab } from './tabs/ExemptAssetTab';
import { CrmGuideTab } from './tabs/CrmGuideTab';
import { useToast } from '../../contexts/ToastContext';

type TabType = 'age' | 'court' | 'notebooklm' | 'living' | 'asset' | 'guide';

const OPACITY_PRESETS = [
  { label: '100%', value: 1.0 },
  { label: '85%', value: 0.85 },
  { label: '70%', value: 0.70 },
];

export const ConsultationQuickDesk: React.FC = () => {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    try {
      return (localStorage.getItem('quick_desk_tab') as TabType) || 'age';
    } catch {
      return 'age';
    }
  });

  const [opacityIndex, setOpacityIndex] = useState(() => {
    try {
      const saved = localStorage.getItem('quick_desk_opacity_idx');
      return saved !== null ? parseInt(saved, 10) : 1; // 기본 85%
    } catch {
      return 1;
    }
  });

  const { size, setSize, onMouseDownResizeHandle } = useResizableWindow({
    defaultWidth: 480,
    defaultHeight: 620,
    minWidth: 380,
    minHeight: 460,
  });

  const sizePercent = Math.max(0, Math.min(100, Math.round(((size.width - 380) / (760 - 380)) * 100)));

  const handleSizeSliderChange = (pct: number) => {
    const ratio = Math.max(0, Math.min(100, pct)) / 100;
    const maxW = typeof window !== 'undefined' ? Math.min(760, window.innerWidth - 40) : 760;
    const maxH = typeof window !== 'undefined' ? Math.min(820, window.innerHeight - 40) : 820;
    const nextSize = {
      width: Math.min(maxW, Math.round(380 + (760 - 380) * ratio)),
      height: Math.min(maxH, Math.round(460 + (820 - 460) * ratio)),
    };
    setSize(nextSize);
  };

  const persistCurrentSize = () => {
    try {
      localStorage.setItem('quick_desk_size', JSON.stringify(size));
    } catch {}
  };

  const { position, onMouseDownHeader, resetPosition } = useDraggableWindow({
    defaultWidth: size.width,
    defaultHeight: size.height,
  });

  // 탭 변경
  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('quick_desk_tab', tab);
    } catch {}
  };

  // 투명도 순환 토글
  const toggleOpacity = () => {
    setOpacityIndex((prev) => {
      const next = (prev + 1) % OPACITY_PRESETS.length;
      try {
        localStorage.setItem('quick_desk_opacity_idx', String(next));
      } catch {}
      return next;
    });
  };

  const currentOpacity = OPACITY_PRESETS[opacityIndex]?.value ?? 0.85;

  // 단축키 Alt + Q 토글
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'q' || e.key === 'Q' || e.key === 'ㅂ')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        // Esc 누르면 최소화
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // 상담 메모 삽입 이벤트 (글로벌 커스텀 이벤트 디스패치)
  const handleInsertToMemo = useCallback((text: string) => {
    // CRM 내 활성 케이스 메모 필드가 있으면 이벤트 수신 처리
    const event = new CustomEvent('crm:quicktool_insert_memo', { detail: { text } });
    window.dispatchEvent(event);
    showToast('상담 내용에 복사되었습니다.', 'success');
  }, [showToast]);

  return (
    <aside aria-label="PC 전용 업무 퀵툴" className="hidden lg:block">
      {/* 1. 플로팅 런처 FAB 버튼 (창이 닫혀 있을 때 표시) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold shadow-xl hover:shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-200 border border-primary/40 group"
          title="상담 업무 퀵툴 열기 (단축키: Alt + Q)"
        >
          <Zap className="w-4 h-4 fill-current group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-bold tracking-tight">업무 퀵툴</span>
        </button>
      )}

      {/* 2. 모달리스 플로팅 윈도우 (창이 열려 있을 때 표시) */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="상담 업무 퀵툴"
          tabIndex={-1}
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
            opacity: currentOpacity,
            zIndex: 45,
          }}
          className="bg-[#eef2f8]/95 dark:bg-zinc-900/95 backdrop-blur-md text-foreground border-2 border-primary/35 dark:border-primary/40 shadow-[0_24px_60px_rgba(15,23,42,0.28)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.8)] rounded-2xl flex flex-col overflow-hidden transition-opacity duration-150 select-none"
        >
          {/* A. 윈도우 헤더 (드래그 핸들 & 컨트롤 바) */}
          <div
            onMouseDown={onMouseDownHeader}
            className="px-4 py-2.5 bg-primary/10 dark:bg-primary/15 border-b border-primary/20 flex items-center justify-between cursor-move shrink-0"
          >
            {/* 좌측: 타이틀 & 고정 위치 크기 조절 슬라이더 */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-primary text-primary-foreground shadow-2xs shrink-0">
                <Zap className="w-3.5 h-3.5 fill-current" />
              </div>
              <span className="font-bold text-xs text-foreground tracking-tight whitespace-nowrap">
                상담 업무 퀵툴
              </span>
              {/* 좌측 기준 고정(left: position.x)이므로 드래그 시 슬라이더가 흔들리지 않음 */}
              <div
                data-no-drag
                onMouseDown={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 bg-card/90 px-2 py-1 rounded-lg border border-border/80 shrink-0"
                title="좌우로 움직여 퀵툴 창 크기를 조절하세요"
              >
                <Maximize2 className="w-3 h-3 text-primary shrink-0" />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={sizePercent}
                  onChange={(e) => handleSizeSliderChange(Number(e.target.value))}
                  onPointerUp={persistCurrentSize}
                  onMouseUp={persistCurrentSize}
                  aria-label="퀵툴 창 크기 조절"
                  className="w-16 sm:w-20 h-1.5 accent-primary cursor-pointer"
                />
              </div>
            </div>

            {/* 우측: 윈도우 조절 버튼들 */}
            <div className="flex items-center gap-1 shrink-0" data-no-drag>
              {/* 투명도 조절 */}
              <button
                onClick={toggleOpacity}
                className="px-2 py-1 text-2xs font-mono font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-md flex items-center gap-1 transition-colors"
                title="투명도 변경 (클릭 시 100% ➔ 85% ➔ 70% 순환)"
              >
                <Eye className="w-3 h-3 text-primary" />
                <span>{OPACITY_PRESETS[opacityIndex].label}</span>
              </button>

              {/* 위치 리셋 */}
              <button
                onClick={resetPosition}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                title="기본 우측 하단 위치로 리셋"
              >
                <RotateCcw className="w-3 h-3" />
              </button>

              {/* 최소화 / 닫기 */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                title="최소화 (하단 캡슐로 축소)"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                title="닫기 (Alt + Q)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* B. 6대 탭 세그먼트 네비게이션 */}
          <div className="px-3 pt-2 pb-1.5 bg-muted/20 border-b border-border flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-none">
            <button
              onClick={() => handleSelectTab('age')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'age'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>만나이</span>
            </button>

            <button
              onClick={() => handleSelectTab('court')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'court'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <MapPin className="w-3 h-3" />
              <span>관할법원</span>
            </button>

            <button
              onClick={() => handleSelectTab('notebooklm')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'notebooklm'
                  ? 'bg-emerald-500 text-white shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Bot className="w-3 h-3" />
              <span>NotebookLM 사수</span>
            </button>

            <button
              onClick={() => handleSelectTab('living')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'living'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Calculator className="w-3 h-3" />
              <span>최저생계비</span>
            </button>

            <button
              onClick={() => handleSelectTab('asset')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'asset'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Home className="w-3 h-3" />
              <span>면제재산</span>
            </button>

            <button
              onClick={() => handleSelectTab('guide')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'guide'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <BookOpen className="w-3 h-3" />
              <span>매뉴얼</span>
            </button>
          </div>

          {/* C. 활성 탭 본문 영역 */}
          <div className="flex-1 overflow-y-auto p-4 select-text">
            {activeTab === 'age' && (
              <AgeCalculatorTab onInsertToMemo={handleInsertToMemo} showToast={showToast} />
            )}
            {activeTab === 'court' && (
              <CourtFinderTab onInsertToMemo={handleInsertToMemo} showToast={showToast} />
            )}
            {activeTab === 'notebooklm' && (
              <NotebookLmAssistantTab onInsertToMemo={handleInsertToMemo} showToast={showToast} />
            )}
            {activeTab === 'living' && (
              <LivingCostTab onInsertToMemo={handleInsertToMemo} showToast={showToast} />
            )}
            {activeTab === 'asset' && (
              <ExemptAssetTab onInsertToMemo={handleInsertToMemo} showToast={showToast} />
            )}
            {activeTab === 'guide' && <CrmGuideTab />}
          </div>

          {/* D. 우측 하단 리사이즈 핸들 (시각적 피드백) */}
          <div
            onMouseDown={onMouseDownResizeHandle}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center text-muted-foreground/60 hover:text-primary transition-colors"
            title="마우스 드래그로 창 크기 조절"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" className="fill-current">
              <path d="M7 1L1 7M7 4L4 7M7 7L7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )}
    </aside>
  );
};
