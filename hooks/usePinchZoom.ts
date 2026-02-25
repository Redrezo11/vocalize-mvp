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

  // Track currentSize via ref so event listeners always read the latest
  // value without needing currentSize in the effect dependency array.
  const sizeRef = useRef(currentSize);
  sizeRef.current = currentSize;

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
        initialSize.current = sizeRef.current;
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

    // iOS Safari fires proprietary gesture events alongside touch events.
    // Preventing these ensures native zoom cannot activate.
    const onGestureStart = (e: Event) => e.preventDefault();
    const onGestureChange = (e: Event) => e.preventDefault();

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('gesturestart', onGestureStart, { passive: false } as any);
    el.addEventListener('gesturechange', onGestureChange, { passive: false } as any);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
    };
  }, [targetRef, setSize, min, max]);
}
