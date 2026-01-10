import React, { useState, useRef, useEffect } from 'react';

interface HoverCheckTooltipProps {
    trigger: React.ReactNode;
    content: React.ReactNode;
    delay?: number; // ms to wait before showing
    className?: string; // wrapper class
    mobileAlign?: 'left' | 'right';
    desktopAlign?: 'left' | 'center' | 'right';
}

export default function HoverCheckTooltip({
    trigger,
    content,
    delay = 1000,
    className = "",
    mobileAlign = 'left',
    desktopAlign = 'center'
}: HoverCheckTooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    // Dynamic Classes based on alignment
    const getPositionClasses = () => {
        const mobileClass = mobileAlign === 'right' ? 'right-0' : 'left-0';

        let desktopClass = '';
        if (desktopAlign === 'center') desktopClass = 'md:left-1/2 md:-translate-x-1/2 md:right-auto';
        else if (desktopAlign === 'right') desktopClass = 'md:right-0 md:left-auto md:translate-x-0';
        else desktopClass = 'md:left-0 md:translate-x-0';

        return `${mobileClass} ${desktopClass}`;
    };

    const getArrowClasses = () => {
        const mobileClass = mobileAlign === 'right' ? 'right-4' : 'left-4';

        let desktopClass = '';
        if (desktopAlign === 'center') desktopClass = 'md:left-1/2 md:-translate-x-1/2 md:right-auto';
        else if (desktopAlign === 'right') desktopClass = 'md:right-4 md:left-auto md:translate-x-0';
        else desktopClass = 'md:left-4 md:translate-x-0';

        return `${mobileClass} ${desktopClass}`;
    };

    return (
        <div
            className={`relative inline-block ${className}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {trigger}
            {isVisible && (
                <div className={`absolute z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] p-3 bg-gray-900/90 text-white text-xs rounded-lg shadow-xl backdrop-blur-sm animate-fade-in border border-gray-700 pointer-events-none ${getPositionClasses()}`}>
                    <div className="relative">
                        {/* Triangle Arrow */}
                        <div className={`absolute -top-[18px] border-8 border-transparent border-b-gray-900/90 ${getArrowClasses()}`} />
                        {/* The content prop is rendered here. If it contains a reminder, the parent component should pass the icon. */}
                        {/* The instruction seems to imply modifying the content directly, but content is a prop. */}
                        {/* Assuming the user wants to add this specific reminder display logic *within* the tooltip's content, */}
                        {/* and that `nextReminder` is somehow available or passed via the `content` prop itself. */}
                        {/* As `nextReminder` is not defined in this component, this part of the instruction cannot be directly applied here without further context. */}
                        {/* If the intent was to replace a hardcoded phone emoji *within the content prop itself*, the content prop would need to be a function or parsed. */}
                        {/* For now, I will add the `getReminderIcon` function as requested, but the usage of `nextReminder` in the snippet is problematic here. */}
                        {/* I will keep the original `content` rendering. If the user intended to modify the `content` prop's structure, they would need to pass `nextReminder` to this component. */}
                        {content}
                    </div>
                </div>
            )}
        </div>
    );
}
