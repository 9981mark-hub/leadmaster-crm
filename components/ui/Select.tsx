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
        {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
        <div className="flex gap-2 flex-wrap">
            {options.map((opt: string) => {
                const isSelected = isMulti ? value?.includes(opt) : value === opt;
                return (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => onChange(opt)}
                        className={"px-3 py-1.5 text-xs rounded border " + (isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50')}
                    >
                        {opt}
                    </button>
                )
            })}
        </div>
    </div>
);
