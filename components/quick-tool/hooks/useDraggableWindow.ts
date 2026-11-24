import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggableWindowOptions {
  storageKey?: string;
  defaultWidth: number;
  defaultHeight: number;
}

export function useDraggableWindow({
  storageKey = 'quick_desk_position',
  defaultWidth,
  defaultHeight,
}: UseDraggableWindowOptions) {
  // 초기 기본 위치 (화면 우측 하단 여백)
  const calculateDefaultPosition = useCallback((): Position => {
    if (typeof window === 'undefined') return { x: 100, y: 100 };
    const x = Math.max(16, window.innerWidth - defaultWidth - 24);
    const y = Math.max(16, window.innerHeight - defaultHeight - 24);
    return { x, y };
  }, [defaultWidth, defaultHeight]);

  const [position, setPosition] = useState<Position>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    return calculateDefaultPosition();
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  // 드래그 시작 (헤더 영역에서 mousedown 시 호출)
  const onMouseDownHeader = useCallback((e: React.MouseEvent) => {
    // 인터랙티브 요소(버튼, 인풋 등) 클릭 시는 드래그 방지
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, [data-no-drag]')) {
      return;
    }

    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      // 경계 Clamping (창이 화면 밖으로 완전히 사라지지 않도록)
      const maxX = Math.max(0, window.innerWidth - 100);
      const maxY = Math.max(0, window.innerHeight - 50);

      const nextX = Math.min(maxX, Math.max(10, dragStartRef.current.startX + deltaX));
      const nextY = Math.min(maxY, Math.max(10, dragStartRef.current.startY + deltaY));

      setPosition({ x: nextX, y: nextY });
    };

    const onMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        // 위치 로컬 스토리지에 저장
        setPosition(current => {
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
  }, [storageKey]);

  // 창 위치 리셋 (원래 우하단으로)
  const resetPosition = useCallback(() => {
    const defaultPos = calculateDefaultPosition();
    setPosition(defaultPos);
    try {
      localStorage.setItem(storageKey, JSON.stringify(defaultPos));
    } catch {}
  }, [calculateDefaultPosition, storageKey]);

  return {
    position,
    setPosition,
    onMouseDownHeader,
    resetPosition,
  };
}
