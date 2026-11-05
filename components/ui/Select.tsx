import React from 'react';

interface SelectProps {
    label?: string;
    value: any;
    onChange: (value: any) => void;
    options: string[];
    isMulti?: boolean;
    className?: string;
}

export const Select: React.FC<SelectProps> = ({
    label,
    value,
    onChange,
    options,
    isMulti = false,
    className = ""
}) => (
    <div className={`mb-4 ${className}`}>
        {label && <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{label}</label>}
        <div className="flex gap-2 flex-wrap">
            {options.map((opt: string) => {
                const isSelected = isMulti ? value?.includes(opt) : value === opt;
                return (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => onChange(opt)}
                        className={"px-3 py-1.5 text-xs rounded-lg border font-medium transition-all " + 
                            (isSelected 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700')}
                    >
                        {opt}
                    </button>
                );
            })}
        </div>
    </div>
);
