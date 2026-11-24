import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Size {
  width: number;
  height: number;
}

interface UseResizableWindowOptions {
  storageKey?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export const SIZE_PRESETS = {
  compact: { width: 400, height: 520, label: '콤팩트' },
  standard: { width: 480, height: 620, label: '표준 뷰' },
  wide: { width: 660, height: 720, label: '와이드' },
};

export function useResizableWindow({
  storageKey = 'quick_desk_size',
  defaultWidth = 480,
  defaultHeight = 620,
  minWidth = 380,
  minHeight = 460,
  maxWidth = 860,
  maxHeight = 880,
}: UseResizableWindowOptions = {}) {
  const [size, setSize] = useState<Size>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
          return {
            width: Math.min(maxWidth, Math.max(minWidth, parsed.width)),
            height: Math.min(maxHeight, Math.max(minHeight, parsed.height)),
          };
        }
      }
    } catch {}
    return { width: defaultWidth, height: defaultHeight };
  });

  const isResizingRef = useRef(false);
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startW: number; startH: number }>({
    mouseX: 0,
    mouseY: 0,
    startW: 0,
    startH: 0,
  });

  // 리사이즈 핸들 마우스다운
  const onMouseDownResizeHandle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isResizingRef.current = true;
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startW: size.width,
      startH: size.height,
    };
  }, [size]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;

      const deltaX = e.clientX - resizeStartRef.current.mouseX;
      const deltaY = e.clientY - resizeStartRef.current.mouseY;

      const windowMaxW = Math.min(maxWidth, window.innerWidth - 40);
      const windowMaxH = Math.min(maxHeight, window.innerHeight - 40);

      const nextWidth = Math.min(windowMaxW, Math.max(minWidth, resizeStartRef.current.startW + deltaX));
      const nextHeight = Math.min(windowMaxH, Math.max(minHeight, resizeStartRef.current.startH + deltaY));

      setSize({ width: nextWidth, height: nextHeight });
    };

    const onMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        setSize(current => {
          try {
            localStorage.setItem(storageKey, JSON.stringify(current));
          } catch {}
          return current;
        });
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [maxWidth, maxHeight, minWidth, minHeight, storageKey]);

  // 프리셋 크기 적용
  const applyPreset = useCallback((presetKey: keyof typeof SIZE_PRESETS) => {
    const preset = SIZE_PRESETS[presetKey];
    if (preset) {
      const nextSize = { width: preset.width, height: preset.height };
      setSize(nextSize);
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextSize));
      } catch {}
    }
  }, [storageKey]);

  return {
    size,
    setSize,
    onMouseDownResizeHandle,
    applyPreset,
  };
}
