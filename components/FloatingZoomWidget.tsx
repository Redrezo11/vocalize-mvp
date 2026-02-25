import React, { useState, useRef, useEffect, useCallback } from 'react';

interface FloatingZoomWidgetProps {
  studentFontSize: number;
  setStudentFontSize: React.Dispatch<React.SetStateAction<number>>;
  isDark: boolean;
  bottomOffset?: string; // e.g. '60px' to clear a tab bar
  scrollRef?: React.RefObject<HTMLDivElement | null>; // attach to scrollable container for hide-on-scroll-down
}

const IDLE_MS = 3000;
const SCROLL_DELTA = 8;

export function FloatingZoomWidget({ studentFontSize, setStudentFontSize, isDark, bottomOffset, scrollRef }: FloatingZoomWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(true);
  const [idle, setIdle] = useState(false);
  const lastScrollTop = useRef(0);
  const idleTimer = useRef<number>();

  // Reset idle timer on any interaction
  const wake = useCallback(() => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  }, []);

  // Start idle timer on mount
  useEffect(() => {
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
    return () => clearTimeout(idleTimer.current);
  }, []);

  // Listen to scroll events on the provided scrollRef
  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;

    const onScroll = () => {
      const st = el.scrollTop;
      const delta = st - lastScrollTop.current;
      if (delta > SCROLL_DELTA) {
        setVisible(false);
        setExpanded(false);
      } else if (delta < -SCROLL_DELTA) {
        setVisible(true);
      }
      lastScrollTop.current = st;
      wake();
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollRef, wake]);

  const hidden = !visible;
  const faded = idle && !expanded;

  return (
    <div
      onTouchStart={wake}
      onMouseEnter={wake}
      style={{
        position: 'fixed',
        bottom: bottomOffset || '24px',
        right: '24px',
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom)',
        transition: 'opacity 0.3s, transform 0.3s',
        opacity: hidden ? 0 : faded ? 0.25 : 1,
        transform: hidden ? 'translateY(20px)' : 'translateY(0)',
        pointerEvents: hidden ? 'none' : 'auto',
      }}
    >
      {expanded ? (
        <div className={`flex items-center gap-1 rounded-full shadow-lg px-2 py-1.5 transition-all ${
          isDark ? 'bg-slate-700 text-slate-200' : 'bg-white text-slate-700 ring-1 ring-black/10'
        }`}>
          <button
            onClick={() => { setStudentFontSize(s => Math.max(0.75, +(s - 0.125).toFixed(3))); wake(); }}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-colors ${
              isDark ? 'hover:bg-slate-600 active:bg-slate-500' : 'hover:bg-slate-100 active:bg-slate-200'
            }`}
          >
            −
          </button>
          <button
            onClick={() => { setExpanded(false); wake(); }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              isDark ? 'hover:bg-slate-600 active:bg-slate-500' : 'hover:bg-slate-100 active:bg-slate-200'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button
            onClick={() => { setStudentFontSize(s => Math.min(2.0, +(s + 0.125).toFixed(3))); wake(); }}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-colors ${
              isDark ? 'hover:bg-slate-600 active:bg-slate-500' : 'hover:bg-slate-100 active:bg-slate-200'
            }`}
          >
            +
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setExpanded(true); wake(); }}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-colors ${
            isDark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 active:bg-slate-500' : 'bg-white text-slate-700 ring-1 ring-black/10 hover:bg-slate-50 active:bg-slate-100'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      )}
    </div>
  );
}
