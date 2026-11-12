import React from 'react';

interface SettingsCardProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    badge?: React.ReactNode;
    headerAction?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    danger?: boolean;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
    title,
    description,
    icon,
    badge,
    headerAction,
    children,
    className = '',
    danger = false
}) => {
    return (
        <div
            className={`bg-white dark:bg-gray-800 rounded-2xl border transition-shadow shadow-xs p-5 sm:p-6 ${
                danger
                    ? 'border-rose-300 dark:border-rose-800/60 bg-rose-50/20 dark:bg-rose-950/10'
                    : 'border-gray-200/80 dark:border-gray-700/80'
            } ${className}`}
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-gray-700/60">
                <div className="flex items-start sm:items-center gap-3">
                    {icon && (
                        <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                danger
                                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300'
                                    : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}
                        >
                            {icon}
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
                                {title}
                            </h3>
                            {badge}
                        </div>
                        {description && (
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                {description}
                            </p>
                        )}
                    </div>
                </div>
                {headerAction && <div className="shrink-0">{headerAction}</div>}
            </div>
            <div>{children}</div>
        </div>
    );
};
