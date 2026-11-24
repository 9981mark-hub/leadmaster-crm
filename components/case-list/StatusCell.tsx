import React, { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../ui/cn';

export interface StatusCellProps {
  status: string;
  onStatusChange?: (newStatus: string) => void;
  disabled?: boolean;
  className?: string;
  availableStatuses?: string[];
}

interface StatusConfig {
  label: string;
  bg: string;
  hoverBg: string;
  textColor: string;
}

// monday.com Vibe 6대 시그니처 색상 매핑
export const MONDAY_STATUS_MAP: Record<string, StatusConfig> = {
  // 완료 계열
  '계약완료': { label: '계약완료', bg: '#00c875', hoverBg: '#0f9b63', textColor: '#ffffff' },
  '수임완료': { label: '수임완료', bg: '#00c875', hoverBg: '#0f9b63', textColor: '#ffffff' },
  '완료': { label: '완료', bg: '#00c875', hoverBg: '#0f9b63', textColor: '#ffffff' },

  // 진행/상담 계열
  '상담진행': { label: '상담진행', bg: '#fdab3d', hoverBg: '#c0873c', textColor: '#ffffff' },
  '상담진행중': { label: '상담진행중', bg: '#fdab3d', hoverBg: '#c0873c', textColor: '#ffffff' },
  '진행중': { label: '진행중', bg: '#fdab3d', hoverBg: '#c0873c', textColor: '#ffffff' },
  '1차상담': { label: '1차상담', bg: '#fdab3d', hoverBg: '#c0873c', textColor: '#ffffff' },

  // 이슈/거절/보류 계열
  '진행불가': { label: '진행불가', bg: '#df2f4a', hoverBg: '#ad3f51', textColor: '#ffffff' },
  '고객취소': { label: '고객취소', bg: '#df2f4a', hoverBg: '#ad3f51', textColor: '#ffffff' },
  '거절': { label: '거절', bg: '#df2f4a', hoverBg: '#ad3f51', textColor: '#ffffff' },
  '부적격': { label: '부적격', bg: '#df2f4a', hoverBg: '#ad3f51', textColor: '#ffffff' },

  // 신규/접수 계열
  '신규접수': { label: '신규접수', bg: '#0073ea', hoverBg: '#0060b9', textColor: '#ffffff' },
  '접수': { label: '접수', bg: '#0073ea', hoverBg: '#0060b9', textColor: '#ffffff' },
  '배정대기': { label: '배정대기', bg: '#0073ea', hoverBg: '#0060b9', textColor: '#ffffff' },

  // 대기/재연락 계열
  '재통화요': { label: '재통화요', bg: '#ffcb00', hoverBg: '#eaaa15', textColor: '#323338' },
  '재통화': { label: '재통화', bg: '#ffcb00', hoverBg: '#eaaa15', textColor: '#323338' },
  '부재중': { label: '부재중', bg: '#faa1f1', hoverBg: '#be80ba', textColor: '#ffffff' },
  '대기': { label: '대기', bg: '#ffcb00', hoverBg: '#eaaa15', textColor: '#323338' },

  // 심사/적격 계열
  '적격심사': { label: '적격심사', bg: '#579bfc', hoverBg: '#4c7cc1', textColor: '#ffffff' },
  '1차적격': { label: '1차적격', bg: '#579bfc', hoverBg: '#4c7cc1', textColor: '#ffffff' },
  '심사중': { label: '심사중', bg: '#579bfc', hoverBg: '#4c7cc1', textColor: '#ffffff' },
  '단순문의': { label: '단순문의', bg: '#9d50dd', hoverBg: '#7d45b0', textColor: '#ffffff' },
};

const DEFAULT_STATUS_CONFIG: StatusConfig = {
  label: '미정',
  bg: '#c4c4c4',
  hoverBg: '#a8a8a8',
  textColor: '#ffffff',
};

// 3x3 팝오버용 기본 9대 추천 팔레트
const DEFAULT_PALETTE_STATUSES = [
  '계약완료', '상담진행', '진행불가',
  '재통화요', '신규접수', '적격심사',
  '부재중',   '단순문의', '배정대기',
];

export const StatusCell: React.FC<StatusCellProps> = ({
  status,
  onStatusChange,
  disabled = false,
  className,
  availableStatuses,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentConfig = MONDAY_STATUS_MAP[status] || {
    ...DEFAULT_STATUS_CONFIG,
    label: status || '미정',
  };

  const palette = availableStatuses && availableStatuses.length > 0 
    ? availableStatuses 
    : DEFAULT_PALETTE_STATUSES;

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleSelectStatus = (newStatus: string) => {
    setIsOpen(false);
    if (newStatus !== status && onStatusChange) {
      onStatusChange(newStatus);

      // 계약완료/수임완료 선택 시 300ms 초록빛 펄스 축하 애니메이션
      if (newStatus === '계약완료' || newStatus === '수임완료' || newStatus === '완료') {
        setIsCelebrating(true);
        setTimeout(() => setIsCelebrating(false), 600);
      }
    }
  };

  return (
    <div ref={containerRef} className={cn('relative inline-flex w-full min-w-[100px] max-w-[130px]', className)}>
      {/* 32px 풀-블록 상태 뱃지 (monday.com 시그니처) */}
      <button
        type="button"
        disabled={disabled || !onStatusChange}
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          backgroundColor: currentConfig.bg,
          color: currentConfig.textColor,
        }}
        className={cn(
          'w-full h-8 px-2 rounded-[4px] font-semibold text-[13px] tracking-tight',
          'flex items-center justify-center select-none shadow-2xs',
          'transition-all duration-70 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-[#0073ea]/40',
          disabled ? 'cursor-default opacity-85' : 'cursor-pointer hover:brightness-95',
          isCelebrating && 'animate-bounce ring-4 ring-[#00c875]/50',
        )}
      >
        <span className="truncate">{currentConfig.label}</span>
      </button>

      {/* 3x3 컬러 매트릭스 팝오버 (스프링 바운스 입체 애니메이션) */}
      {isOpen && (
        <div
          style={{
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)',
            transformOrigin: 'top center',
          }}
          className={cn(
            'absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1.5 p-2.5',
            'w-[280px] bg-white dark:bg-[#18181b] rounded-lg border border-[#d0d4e4] dark:border-zinc-700',
            'animate-in fade-in zoom-in-95 duration-150',
          )}
        >
          <div className="text-[11px] font-bold text-[#676879] dark:text-zinc-400 mb-2 px-1 flex items-center justify-between">
            <span>상태 변경 (Status Palette)</span>
            <span className="text-[10px] font-normal text-muted-foreground">1클릭 전환</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {palette.map((s) => {
              const cfg = MONDAY_STATUS_MAP[s] || { ...DEFAULT_STATUS_CONFIG, label: s };
              const isSelected = s === status;

              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSelectStatus(s)}
                  style={{
                    backgroundColor: cfg.bg,
                    color: cfg.textColor,
                  }}
                  className={cn(
                    'h-[34px] px-1 rounded-[4px] text-[12px] font-semibold',
                    'flex items-center justify-center relative overflow-hidden',
                    'transition-all duration-70 ease-[cubic-bezier(0.4,0,0.2,1)]',
                    'hover:scale-[1.03] active:scale-[0.96] shadow-2xs',
                    isSelected && 'ring-2 ring-black dark:ring-white',
                  )}
                >
                  <span className="truncate">{cfg.label}</span>
                  {isSelected && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-white/80 flex items-center justify-center">
                      <Check size={8} className="text-[#323338]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
