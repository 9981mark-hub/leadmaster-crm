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
            className={`bg-card text-card-foreground rounded-xl border transition-all shadow-xs p-5 sm:p-6 ${
                danger
                    ? 'border-destructive/30 bg-destructive/5'
                    : 'border-border'
            } ${className}`}
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-border/80">
                <div className="flex items-start sm:items-center gap-3">
                    {icon && (
                        <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                                danger
                                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                                    : 'bg-primary/10 text-primary border-primary/20'
                            }`}
                        >
                            {icon}
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-base font-semibold tracking-tight text-foreground">
                                {title}
                            </h3>
                            {badge}
                        </div>
                        {description && (
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
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
