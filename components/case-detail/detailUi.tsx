import React from 'react';

/**
 * 리드 상세 화면 공통 모양 (카드 · 단계 제목 · 칸 격자 · 선택 버튼)
 * [2026-11-01] 넓은 화면에서 칸 하나가 반쪽 화면만큼 늘어나 아래로 길어지던 것을, 답 길이에 맞는 칸 폭으로 바꿈.
 * 여백 리듬: 칸 사이 12px · 카드 안쪽 16px · 카드 사이 12px. 글자: 입력 14px, 이름표 12px, 숫자는 자릿수 맞춤.
 */

/** 흰 카드 */
export const CARD = 'bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700';

/**
 * 칸 격자: 모바일은 2칸, md부터는 카드 폭에 160px 이상 칸이 들어가는 만큼 (화면 폭이 아니라 카드 폭을 따른다).
 * 긴 칸은 col-span-2, 한 줄 전체는 col-span-full.
 */
export const FIELD_GRID = 'grid grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-3 gap-y-3 items-start';

/** 두 덩어리를 나란히 (카드 안쪽 폭이 320px씩 들어가면 2줄, 아니면 위아래) */
export const SPLIT_GRID = 'grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(20rem,1fr))] gap-x-6 gap-y-4 items-start';

/** 칸 이름표 (입력 칸 위) */
export const LABEL = 'flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-gray-300 mb-1';

/** 입력·고르기 칸 (높이 36px) */
export const CONTROL = 'w-full h-9 px-2.5 border rounded-lg text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';
export const CONTROL_PLAIN = `${CONTROL} border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100`;

/** 단계 제목이 있는 카드. step = 상담 순서 번호 (위 "단계 바로가기"와 같은 번호) */
export const SectionCard: React.FC<{
    step?: number;
    title: React.ReactNode;
    meta?: React.ReactNode;
    className?: string;
    bodyClassName?: string;
    children: React.ReactNode;
}> = ({ step, title, meta, className = '', bodyClassName = 'p-4', children }) => (
    <div className={`${CARD} overflow-hidden ${className}`}>
        <div className="px-4 py-2.5 bg-slate-100 dark:bg-gray-700/60 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between gap-3">
            <h3 className="min-w-0 flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-gray-100">
                {step !== undefined && (
                    <span aria-hidden className="w-5 h-5 shrink-0 rounded-full bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 text-[11px] font-bold tabular-nums text-slate-700 dark:text-gray-200 flex items-center justify-center shadow-xs">{step}</span>
                )}
                <span className="truncate">{title}</span>
            </h3>
            {meta ? <span className="shrink-0 text-[11px] text-slate-500 dark:text-gray-400 tabular-nums">{meta}</span> : null}
        </div>
        <div className={bodyClassName}>{children}</div>
    </div>
);

/** 이름표 + 칸 (htmlFor가 있으면 이름표를 칸에 연결) */
export const Field: React.FC<{ label: React.ReactNode; htmlFor?: string; className?: string; children: React.ReactNode }> = ({ label, htmlFor, className = '', children }) => (
    <div className={`min-w-0 ${className}`}>
        {htmlFor ? <label htmlFor={htmlFor} className={LABEL}>{label}</label> : <div className={LABEL}>{label}</div>}
        {children}
    </div>
);

type Opt = string | number;

/**
 * 선택 버튼 묶음 (사건 유형·성별·4대보험 등). 누르면 onPick(값) — 예전 버튼과 같은 동작.
 * PC는 글자 길이만큼, 모바일은 fill이면 한 줄을 나눠 채운다 (예전 모바일 모양 유지).
 */
export const Choice: React.FC<{
    label?: React.ReactNode;
    options: readonly Opt[];
    value: any;
    onPick: (v: any) => void;
    multi?: boolean;
    tone?: 'blue' | 'emerald';
    render?: (o: any) => React.ReactNode;
    /** 모바일에서 버튼이 줄을 나눠 채움 (기본) */
    fill?: boolean;
    className?: string;
    /** 버튼 크기 덮어쓰기 (예: 숫자 버튼을 더 좁게) */
    buttonClassName?: string;
}> = ({ label, options, value, onPick, multi = false, tone = 'blue', render, fill = true, className = '', buttonClassName = '' }) => {
    const id = React.useId();
    const onCls = tone === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-blue-600 text-white border-blue-600';
    // buttonClassName이 있으면 기본 크기 대신 그것만 쓴다 (Tailwind는 같은 속성끼리 클래스 순서로 이기지 않음)
    const size = buttonClassName || (fill
        ? 'flex-1 basis-0 px-1 md:flex-none md:basis-auto md:px-2.5 md:min-w-[2.75rem]'
        : 'px-2.5 min-w-[2.75rem]');
    return (
        <div className={`min-w-0 ${className}`}>
            {label && <div id={id} className={LABEL}>{label}</div>}
            <div role="group" aria-labelledby={label ? id : undefined} className="flex flex-wrap gap-1">
                {options.map(opt => {
                    const selected = multi ? !!value?.includes(opt) : value === opt;
                    return (
                        <button
                            key={String(opt)}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onPick(opt)}
                            className={`h-9 ${size} rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${selected ? onCls : 'bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-300 border-slate-300 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700'}`}
                        >
                            {render ? render(opt) : opt}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
