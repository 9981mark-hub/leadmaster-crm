import React from 'react';
import { formatKoreanMoney } from '../../utils';

interface SmartInputProps {
    label?: string;
    value: any;
    onChange: (value: any) => void;
    /** 칸을 벗어날 때. updateOnBlur면 저장한 값을 넘겨준다 */
    onBlur?: (committed?: any) => void;
    type?: string;
    placeholder?: string;
    suffix?: string;
    readOnly?: boolean;
    isPhone?: boolean;
    isCurrency?: boolean;
    className?: string;
    /** 필수 확인 항목인데 비어 있으면 점 표시 */
    needed?: boolean;
    /** 촘촘한 모양 (리드 상세): 칸 높이 36px, 아래 여백 없음 — 간격은 감싼 격자가 준다. 기본은 예전 모양 그대로 */
    compact?: boolean;
}

/**
 * 입력 칸 (전화번호 자동 하이픈, 금액 쉼표, 숫자 키패드)
 * [2026-11-01] 모바일에서 숫자·전화 키패드가 뜨도록 inputMode 지정, 1억 이상 금액은 "1억 2,000만원"으로 읽어 줌, 다크 모드
 */
export const SmartInput: React.FC<SmartInputProps & { updateOnBlur?: boolean }> = ({
    label,
    value,
    onChange,
    onBlur,
    type = "text",
    placeholder = "",
    suffix = "",
    readOnly = false,
    isPhone = false,
    isCurrency = false,
    className = "",
    updateOnBlur = false,
    needed = false,
    compact = false,
}) => {
    const inputId = React.useId();
    const [localValue, setLocalValue] = React.useState(value);

    React.useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const displayValue = updateOnBlur ? localValue : value;

    const getFormattedValue = (val: any) => {
        if (type === 'number') {
            if (!isCurrency && (val === 0 || val === undefined || val === null)) {
                return '';
            }
        }
        if (isCurrency && (typeof val === 'number' || (val !== '' && val !== null && val !== undefined && !isNaN(Number(val))))) {
            return Number(val) === 0 ? '' : Number(val).toLocaleString();
        }
        return val;
    };

    const commit = (v: any) => {
        if (updateOnBlur) setLocalValue(v);
        else onChange(v);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;

        if (isPhone) {
            const raw = val.replace(/[^0-9]/g, '');
            let formatted = raw;
            if (raw.length > 3 && raw.length <= 7) {
                formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
            } else if (raw.length > 7) {
                formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
            }
            commit(formatted);
            return;
        }

        if (isCurrency || type === 'number') {
            const cleanVal = val.replace(/,/g, '');
            if (cleanVal === '' || /^[0-9]+$/.test(cleanVal)) {
                commit(cleanVal === '' ? 0 : Number(cleanVal));
            }
            return;
        }

        commit(val);
    };

    const handleBlur = () => {
        if (updateOnBlur && localValue !== value) {
            onChange(localValue);
        }
        if (onBlur) onBlur(updateOnBlur ? localValue : value);
    };

    const numeric = Number(displayValue) || 0;
    const showKorean = isCurrency && numeric >= 10000;
    const empty = displayValue === '' || displayValue === undefined || displayValue === null || (isCurrency && numeric === 0);

    return (
        <div className={`${compact ? 'min-w-0' : 'mb-3'} ${className}`}>
            {label && (
                <label htmlFor={inputId} className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-gray-300 mb-1">
                    {label}
                    {needed && empty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="이 사무실 필수 확인 항목" />}
                </label>
            )}
            <div className="relative">
                <input
                    id={inputId}
                    type="text"
                    inputMode={isPhone ? 'tel' : (isCurrency || type === 'number') ? 'numeric' : undefined}
                    autoComplete="off"
                    className={"w-full px-2.5 " + (compact ? 'h-9' : 'py-2') + " border rounded-lg text-sm outline-none transition-colors " +
                        (readOnly
                            ? 'bg-slate-100 dark:bg-gray-900/50 text-slate-500 border-slate-200 dark:border-gray-700 cursor-not-allowed'
                            : 'bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 border-slate-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20') +
                        (suffix ? ' pr-12' : '') + (isCurrency ? ' text-right tabular-nums' : '')}
                    value={getFormattedValue(displayValue) || ''}
                    onChange={!readOnly ? handleInputChange : undefined}
                    onBlur={handleBlur}
                    onKeyDown={e => { if (e.key === 'Enter' && updateOnBlur) (e.target as HTMLInputElement).blur(); }}
                    placeholder={placeholder}
                    readOnly={readOnly}
                />
                {suffix && <span className={"absolute right-3 text-slate-400 text-xs pointer-events-none " + (compact ? 'top-1/2 -translate-y-1/2' : 'top-2.5')}>{suffix}</span>}
            </div>
            {showKorean && <div className="text-[11px] text-slate-500 mt-0.5 text-right tabular-nums">{formatKoreanMoney(numeric)}</div>}
        </div>
    );
};
