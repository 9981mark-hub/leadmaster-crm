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
    const enterTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        // Clear any pending leave timer (user came back or entered tooltip)
        if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
        }

        // If already visible, keep it (don't re-trigger enter delay)
        if (isVisible) return;

        // Start enter delay
        if (!enterTimeoutRef.current) {
            enterTimeoutRef.current = setTimeout(() => {
                setIsVisible(true);
            }, delay);
        }
    };

    const handleMouseLeave = () => {
        // Clear pending enter timer (user left before delay finished)
        if (enterTimeoutRef.current) {
            clearTimeout(enterTimeoutRef.current);
            enterTimeoutRef.current = null;
        }

        // Start leave delay (give time to move to tooltip)
        leaveTimeoutRef.current = setTimeout(() => {
            setIsVisible(false);
        }, 300); // 300ms grace period
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (enterTimeoutRef.current) clearTimeout(enterTimeoutRef.current);
            if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
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

    // [Mobile Support] Handle click to toggle
    const handleClick = (e: React.MouseEvent) => {
        // Prevent click from propagating if nested
        e.stopPropagation();

        // If clicking inside the tooltip content (e.g. scrolling), ignore toggle
        if (tooltipRef.current && tooltipRef.current.contains(e.target as Node)) {
            return;
        }

        if (enterTimeoutRef.current) {
            clearTimeout(enterTimeoutRef.current);
            enterTimeoutRef.current = null;
        }
        setIsVisible(prev => !prev);
    };

    // [Mobile Support] Close on outside click
    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (isVisible) {
                // If checking inside ref is tricky due to portals (not used here), global close is fine.
                // But we should verify if click is NOT inside our component.
                // Since event bubbles, we can't easily check 'wrapper ref' unless we attach ref to wrapper.
                // But simplified: existing logic closed it.
                setIsVisible(false);
            }
        };

        if (isVisible) {
            // Use capture phase or verify target but for now standard click
            // Wait, this will trigger immediately if bubbling from handleClick?
            // "click" event listener on document fires AFTER bubble.
            // But handleClick stopped propagation. So this is safe from self-trigger.
            // Problem: If I click Tooltip Content, handleClick returns early (doesn't toggle).
            // But e.stopPropagation() was called. So document listener WON'T fire.
            // So clicking tooltip content won't close it. Good.
            document.addEventListener('click', handleOutsideClick);
        }

        return () => {
            document.removeEventListener('click', handleOutsideClick);
        };
    }, [isVisible]);


    return (
        <div
            className={`relative inline-block ${className}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
        >
            {trigger}
            {isVisible && (
                <div
                    ref={tooltipRef}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    className={`absolute z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] p-3 bg-gray-900/90 text-white text-xs rounded-lg shadow-xl backdrop-blur-sm animate-fade-in border border-gray-700 pointer-events-auto ${getPositionClasses()}`}
                >
                    <div className="relative">
                        {/* Triangle Arrow */}
                        <div className={`absolute -top-[18px] border-8 border-transparent border-b-gray-900/90 ${getArrowClasses()}`} />
                        {content}
                    </div>
                </div>
            )}
        </div>
    );
}
