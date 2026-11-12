import React from 'react';

interface SettingsRowProps {
    label: string;
    description?: string;
    required?: boolean;
    children: React.ReactNode;
    className?: string;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
    label,
    description,
    required = false,
    children,
    className = ''
}) => {
    return (
        <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-6 py-3.5 border-b border-gray-100 dark:border-gray-800 last:border-0 ${className}`}>
            <div className="sm:w-1/3 shrink-0">
                <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                    {label}
                    {required && <span className="text-rose-500 font-bold">*</span>}
                </label>
                {description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                        {description}
                    </p>
                )}
            </div>
            <div className="sm:w-2/3 w-full flex-1">
                {children}
            </div>
        </div>
    );
};
