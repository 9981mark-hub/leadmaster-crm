import React from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from './cn';

/* ────────────────────────────────────────────────────────
 *  PageShell — 모든 페이지의 통일된 레이아웃 래퍼
 *  3단계 너비 체계 + 통일 헤더 + 모바일 대응
 * ──────────────────────────────────────────────────────── */

const LAYOUT_WIDTH = {
  wide: 'max-w-[1600px]',      // 데이터 중심: 케이스, 팀관리, 자동통화
  standard: 'max-w-7xl',       // 대시보드, 통계, 정산, 일정
  compact: 'max-w-5xl',        // 폼/설정: 마이페이지, 설정, 간편등록, TG연동, 회사관리
} as const;

export type LayoutWidth = keyof typeof LAYOUT_WIDTH;

export interface PageShellProps {
  /** 페이지 제목 */
  title: string;
  /** 부제목/설명 (모바일에서는 숨김) */
  description?: string;
  /** 좌측 아이콘 */
  icon?: LucideIcon;
  /** 우측 액션 버튼 영역 */
  actions?: React.ReactNode;
  /** 레이아웃 너비 단계 */
  layout?: LayoutWidth;
  /** 헤더 숨김 (케이스 목록처럼 자체 헤더가 있는 경우) */
  hideHeader?: boolean;
  /** 추가 className */
  className?: string;
  children: React.ReactNode;
}

export const PageShell: React.FC<PageShellProps> = ({
  title,
  description,
  icon: Icon,
  actions,
  layout = 'standard',
  hideHeader = false,
  className,
  children,
}) => {
  return (
    <div className={cn(LAYOUT_WIDTH[layout], 'mx-auto w-full space-y-6', className)}>
      {!hideHeader && (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 shrink-0">
                <Icon size={22} className="text-blue-600 dark:text-blue-400" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 dark:text-white truncate">
                {title}
              </h1>
              {description && (
                <p className="hidden sm:block text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {description}
                </p>
              )}
            </div>
          </div>

          {actions && (
            <div className="flex items-center gap-2 shrink-0 mt-2 sm:mt-0">
              {actions}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
};

/* ── 내보내기: 너비 상수도 직접 사용 가능 ── */
export { LAYOUT_WIDTH };
