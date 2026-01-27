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
    updateOnBlur = false
}) => {
    // Internal state for managing value before blur
    const [localValue, setLocalValue] = React.useState(value);

    // Sync local value with prop value when it changes externally
    React.useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const displayValue = updateOnBlur ? localValue : value;

    // Formatting logic for display (currency, etc)
    const getFormattedValue = (val: any) => {
        if (type === 'number') {
            if (!isCurrency && (val === 0 || val === undefined || val === null)) {
                return '';
            }
        }
        if (isCurrency && (typeof val === 'number' || !isNaN(Number(val)))) {
            return Number(val).toLocaleString();
        }
        return val;
    };

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
            // For phone, even with updateOnBlur, we might want to update local state formatted
            // But usually we just update parent. 
            // If updateOnBlur is true, we update localValue only.
            if (updateOnBlur) {
                setLocalValue(formatted);
            } else {
                onChange(formatted);
            }
            return;
        }

        if (isCurrency) {
            const cleanVal = val.replace(/,/g, '');
            if (cleanVal === '' || /^[0-9]+$/.test(cleanVal)) {
                const numVal = cleanVal === '' ? 0 : Number(cleanVal);
                if (updateOnBlur) {
                    setLocalValue(numVal);
                } else {
                    onChange(numVal);
                }
            }
            return;
        }

        if (type === 'number') {
            if (val === '' || /^[0-9]+$/.test(val)) {
                const numVal = val === '' ? 0 : Number(val);
                if (updateOnBlur) {
                    setLocalValue(numVal);
                } else {
                    onChange(numVal);
                }
            }
        } else {
            if (updateOnBlur) {
                setLocalValue(val);
            } else {
                onChange(val);
            }
        }
    };

    const handleBlur = () => {
        if (updateOnBlur) {
            // Only trigger onChange if value is different? 
            // Or always trigger to ensure sync?
            // Let's trigger only if different to save calls
            if (localValue !== value) {
                onChange(localValue);
            }
        }
        if (onBlur) onBlur();
    };

    return (
        <div className={`mb-4 ${className}`}>
            {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
            <div className="relative">
                <input
                    type={type === 'number' && !isCurrency ? 'text' : 'text'}
                    autoComplete="off"
                    className={"w-full p-2 border border-blue-300 rounded text-sm outline-none " + (readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:ring-1 focus:ring-blue-500')}
                    value={getFormattedValue(displayValue) || ''}
                    onChange={!readOnly ? handleInputChange : undefined}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    readOnly={readOnly}
                />
                {suffix && <span className="absolute right-3 top-2 text-gray-500 text-xs">{suffix}</span>}
            </div>
        </div>
    );
};
