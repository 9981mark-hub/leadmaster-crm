import React from 'react';

interface SmartInputProps {
    label?: string;
    value: any;
    onChange: (value: any) => void;
    onBlur?: () => void;
    type?: string;
    placeholder?: string;
    suffix?: string;
    readOnly?: boolean;
    isPhone?: boolean;
    isCurrency?: boolean;
    className?: string;
}

export const SmartInput: React.FC<SmartInputProps> = ({
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
    className = ""
}) => {
    let displayValue = value;

    if (type === 'number') {
        if (!isCurrency && (value === 0 || value === undefined || value === null)) {
            displayValue = '';
        }
    }

    if (isCurrency && (typeof value === 'number' || !isNaN(Number(value)))) {
        displayValue = Number(value).toLocaleString();
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;

        if (isPhone) {
            const raw = val.replace(/[^0-9]/g, '');
            let formatted = raw;
            if (raw.length > 3 && raw.length <= 7) {
                formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
            } else if (raw.length > 7) {
                formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
            }
            onChange(formatted);
            return;
        }

        if (isCurrency) {
            const cleanVal = val.replace(/,/g, '');
            if (cleanVal === '' || /^[0-9]+$/.test(cleanVal)) {
                onChange(cleanVal === '' ? 0 : Number(cleanVal));
            }
            return;
        }

        if (type === 'number') {
            if (val === '' || /^[0-9]+$/.test(val)) {
                onChange(val === '' ? 0 : Number(val));
            }
        } else {
            onChange(val);
        }
    };

    return (
        <div className={`mb-4 ${className}`}>
            {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
            <div className="relative">
                <input
                    type={type === 'number' && !isCurrency ? 'text' : 'text'}
                    autoComplete="off"
                    className={"w-full p-2 border border-blue-300 rounded text-sm outline-none " + (readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:ring-1 focus:ring-blue-500')}
                    value={displayValue || ''}
                    onChange={!readOnly ? handleInputChange : undefined}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    readOnly={readOnly}
                />
                {suffix && <span className="absolute right-3 top-2 text-gray-500 text-xs">{suffix}</span>}
            </div>
        </div>
    );
};
