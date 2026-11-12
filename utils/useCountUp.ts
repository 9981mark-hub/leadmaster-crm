import { useEffect, useState } from 'react';

/**
 * useCountUp Hook
 * 
 * Animates a numeric value from 0 to target over a specified duration
 * using requestAnimationFrame and easeOutExpo easing curve.
 */
export function useCountUp(target: number, duration: number = 750): number {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    // If target is 0 or negative, set directly
    if (!target || target <= 0 || isNaN(target)) {
      setCount(target || 0);
      return;
    }

    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(target);
      return;
    }

    let startTimestamp: number | null = null;
    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.round(easeProgress * target));

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration]);

  return count;
}
