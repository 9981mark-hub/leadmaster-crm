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
        <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-6 py-4 border-b border-border/60 last:border-0 ${className}`}>
            <div className="sm:w-1/3 shrink-0">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    {label}
                    {required && <span className="text-destructive font-bold">*</span>}
                </label>
                {description && (
                    <p className="text-2xs text-muted-foreground mt-0.5 leading-relaxed">
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
