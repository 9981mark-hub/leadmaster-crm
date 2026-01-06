import React, { useState, useRef, useEffect } from 'react';

interface HoverCheckTooltipProps {
    trigger: React.ReactNode;
    content: React.ReactNode;
    delay?: number; // ms to wait before showing
    className?: string; // wrapper class
}

export default function HoverCheckTooltip({ trigger, content, delay = 1000, className = "" }: HoverCheckTooltipProps) {
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

    return (
        <div
            className={`relative inline-block ${className}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {trigger}
            {isVisible && (
                <div className="absolute z-50 left-0 md:left-1/2 md:-translate-x-1/2 mt-2 w-64 p-3 bg-gray-900/90 text-white text-xs rounded-lg shadow-xl backdrop-blur-sm animate-fade-in border border-gray-700 pointer-events-none">
                    <div className="relative">
                        {/* Triangle Arrow */}
                        <div className="absolute -top-[18px] left-4 md:left-1/2 md:-translate-x-1/2 border-8 border-transparent border-b-gray-900/90" />
                        {content}
                    </div>
                </div>
            )}
        </div>
    );
}
