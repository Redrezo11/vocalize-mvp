import React, { useState, useRef, useCallback } from 'react';

interface FloatingZoomWidgetProps {
  studentFontSize: number;
  setStudentFontSize: React.Dispatch<React.SetStateAction<number>>;
  isDark: boolean;
  bottomOffset?: string; // e.g. '60px' to clear a tab bar
}

/** Scroll handler hook for zoom widget visibility */
export function useZoomScroll() {
  const [zoomVisible, setZoomVisible] = useState(true);
  const [zoomIdle, setZoomIdle] = useState(false);
  const lastScrollTop = useRef(0);
  const idleTimer = useRef<number>();
  const zoomExpandedRef = useRef<(v: boolean) => void>();

  const handleZoomScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const st = e.currentTarget.scrollTop;
    const delta = st - lastScrollTop.current;
    if (delta > 8) { setZoomVisible(false); zoomExpandedRef.current?.(false); }
    else if (delta < -8) setZoomVisible(true);
    lastScrollTop.current = st;

    setZoomIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setZoomIdle(true), 3000) as unknown as number;
  }, []);

  return { zoomVisible, zoomIdle, setZoomIdle, idleTimer, handleZoomScroll, zoomExpandedRef };
}

export function FloatingZoomWidget({ studentFontSize, setStudentFontSize, isDark, bottomOffset }: FloatingZoomWidgetProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ position: 'fixed', bottom: bottomOffset || '24px', right: '24px', zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {expanded ? (
        <div className={`flex items-center gap-1 rounded-full shadow-lg px-2 py-1.5 transition-all ${
          isDark ? 'bg-slate-700 text-slate-200' : 'bg-white text-slate-700 ring-1 ring-black/10'
        }`}>
          <button
            onClick={() => setStudentFontSize(s => Math.max(0.75, +(s - 0.125).toFixed(3)))}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-colors ${
              isDark ? 'hover:bg-slate-600 active:bg-slate-500' : 'hover:bg-slate-100 active:bg-slate-200'
            }`}
          >
            −
          </button>
          <button
            onClick={() => setExpanded(false)}
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
            onClick={() => setStudentFontSize(s => Math.min(2.0, +(s + 0.125).toFixed(3)))}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-colors ${
              isDark ? 'hover:bg-slate-600 active:bg-slate-500' : 'hover:bg-slate-100 active:bg-slate-200'
            }`}
          >
            +
          </button>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
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
