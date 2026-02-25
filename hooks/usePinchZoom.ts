import React, { useEffect, useRef } from 'react';

/**
 * Detects two-finger pinch gestures on a target element and updates
 * a font size state accordingly. Coexists with single-finger scroll
 * and swipe — only activates when touches.length === 2.
 */
export function usePinchZoom(
  targetRef: React.RefObject<HTMLElement | null>,
  currentSize: number,
  setSize: React.Dispatch<React.SetStateAction<number>>,
  min = 0.75,
  max = 2.0
) {
  const initialDistance = useRef(-1);
  const initialSize = useRef(currentSize);

  // Keep initialSize in sync when size changes from buttons
  // (but not during an active pinch)
  useEffect(() => {
    if (initialDistance.current === -1) {
      initialSize.current = currentSize;
    }
  }, [currentSize]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    const getDistance = (touches: TouchList) =>
      Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      );

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance.current = getDistance(e.touches);
        initialSize.current = currentSize;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance.current > 0) {
        e.preventDefault(); // suppress native pinch-zoom
        const scale = getDistance(e.touches) / initialDistance.current;
        const newSize = Math.min(max, Math.max(min,
          +(initialSize.current * scale).toFixed(3)
        ));
        setSize(newSize);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialDistance.current = -1;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [targetRef, currentSize, setSize, min, max]);
}
