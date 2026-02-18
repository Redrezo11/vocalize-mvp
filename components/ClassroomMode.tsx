import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { SavedAudio, ListeningTest, LexisAudio } from '../types';
import { ArrowLeftIcon, PlayIcon, PauseIcon, RefreshIcon, ChevronRightIcon } from './Icons';
import { ClassroomTheme } from './Settings';
import QRCode from 'qrcode';
import { generateLexisAudio, generateAllWordAudios, LexisTTSEngine } from '../utils/lexisTTS';
import { fullTestCache } from '../utils/testCache';
import { useAppMode } from '../contexts/AppModeContext';
import { modeLabel, isTestTypeForMode } from '../utils/modeLabels';

// Map server test document to client ListeningTest format
const mapTestFromServer = (t: any): ListeningTest => ({
  ...t,
  id: t._id || t.id,
  createdAt: t.created_at || t.createdAt,
  updatedAt: t.updated_at || t.updatedAt,
  sourceText: t.source_text || t.sourceText || undefined,
  questions: (t.questions || []).map((q: any) => ({ ...q, id: q._id || q.id || Math.random().toString(36).substring(2, 11) })),
  lexis: t.lexis?.map((l: any) => ({ ...l, id: l._id || l.id || Math.random().toString(36).substring(2, 11) })),
  lexisAudio: t.lexisAudio,
  classroomActivity: t.classroomActivity,
});

// --- Tap-to-speak: click any word to hear its pronunciation via TTS ---
const pronunciationCache = new Map<string, string>(); // word → blob URL (persists across re-renders)
let currentPronunciationAudio: HTMLAudioElement | null = null;

const speakWord = async (rawWord: string, onStateChange?: (word: string, state: 'loading' | 'playing' | 'idle') => void) => {
  // Strip punctuation but keep Arabic characters, hyphens, apostrophes
  const clean = rawWord.replace(/[^\p{L}\p{N}'-]/gu, '').trim();
  if (!clean) return;
  const cacheKey = clean.toLowerCase();

  // Stop any currently playing pronunciation
  if (currentPronunciationAudio) {
    currentPronunciationAudio.pause();
    currentPronunciationAudio = null;
  }

  onStateChange?.(rawWord, 'loading');

  try {
    let blobUrl = pronunciationCache.get(cacheKey);
    if (!blobUrl) {
      const apiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY;
      if (!apiKey) throw new Error('No API key');
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'tts-1', input: clean, voice: 'nova', response_format: 'mp3' }),
      });
      if (!response.ok) throw new Error('TTS failed');
      const blob = await response.blob();
      blobUrl = URL.createObjectURL(blob);
      pronunciationCache.set(cacheKey, blobUrl);
    }

    const audio = new Audio(blobUrl);
    currentPronunciationAudio = audio;
    onStateChange?.(rawWord, 'playing');
    audio.onended = () => {
      currentPronunciationAudio = null;
      onStateChange?.(rawWord, 'idle');
    };
    await audio.play();
  } catch {
    onStateChange?.(rawWord, 'idle');
  }
};

const SpeakableText: React.FC<{
  text: string;
  className?: string;
  dir?: string;
}> = ({ text, className, dir }) => {
  const [activeWord, setActiveWord] = useState<{ word: string; state: 'loading' | 'playing' | 'idle' } | null>(null);

  const handleClick = useCallback((word: string) => {
    speakWord(word, (w, state) => {
      if (state === 'idle') setActiveWord(null);
      else setActiveWord({ word: w, state });
    });
  }, []);

  // Split text into words and whitespace, preserving spaces
  const tokens = text.split(/(\s+)/);

  return (
    <p className={className} dir={dir}>
      {tokens.map((token, i) => {
        // Whitespace tokens render as-is
        if (/^\s+$/.test(token)) return token;

        const isActive = activeWord?.word === token;
        const isLoading = isActive && activeWord?.state === 'loading';
        const isPlaying = isActive && activeWord?.state === 'playing';

        return (
          <span
            key={`${i}-${token}`}
            onClick={() => handleClick(token)}
            className={`cursor-pointer transition-all duration-200 rounded-sm ${
              isLoading ? 'animate-pulse opacity-60' :
              isPlaying ? 'text-indigo-400' : ''
            }`}
            style={{
              textDecoration: 'none',
              borderBottom: '2px solid transparent',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = 'rgba(129, 140, 248, 0.5)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
          >
            {token}
          </span>
        );
      })}
    </p>
  );
};

// Silent generation: cache word audio without playing it
const speakWordSilent = async (rawWord: string): Promise<void> => {
  const clean = rawWord.replace(/[^\p{L}\p{N}'-]/gu, '').trim();
  if (!clean) return;
  const cacheKey = clean.toLowerCase();
  if (pronunciationCache.has(cacheKey)) return;

  const apiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY;
  if (!apiKey) return;
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', input: clean, voice: 'nova', response_format: 'mp3' }),
  });
  if (!response.ok) return;
  const blob = await response.blob();
  pronunciationCache.set(cacheKey, URL.createObjectURL(blob));
};

// Batch pre-generate all unique words from given texts
const preGenerateWords = async (
  texts: string[],
  onProgress: (done: number, total: number) => void,
): Promise<void> => {
  const allWords = new Set<string>();
  for (const text of texts) {
    for (const token of text.split(/\s+/)) {
      const clean = token.replace(/[^\p{L}\p{N}'-]/gu, '').trim();
      if (clean && !pronunciationCache.has(clean.toLowerCase())) {
        allWords.add(clean);
      }
    }
  }

  const words = Array.from(allWords);
  if (words.length === 0) { onProgress(0, 0); return; }
  let done = 0;
  onProgress(0, words.length);

  for (const word of words) {
    await speakWordSilent(word);
    done++;
    onProgress(done, words.length);
  }
};

interface ClassroomModeProps {
  tests: ListeningTest[];
  isLoadingTests?: boolean;  // Loading state for initial test fetch
  audioEntries: SavedAudio[];
  theme?: ClassroomTheme;
  autoSelectTestId?: string | null;
  onAutoSelectHandled?: () => void;
  onExit: () => void;
  onPreviewStudent: (test: ListeningTest) => void;
  onEditTest?: (test: ListeningTest) => void;
  onDeleteTest?: (test: ListeningTest) => Promise<void> | void;
  onUpdateTest?: (test: ListeningTest) => void;  // To save lexisAudio
}

type ClassroomView = 'select' | 'present';

export const ClassroomMode: React.FC<ClassroomModeProps> = ({ tests, isLoadingTests = false, audioEntries, theme = 'light', autoSelectTestId, onAutoSelectHandled, onExit, onPreviewStudent, onEditTest, onDeleteTest, onUpdateTest }) => {
  const appMode = useAppMode();
  const labels = modeLabel(appMode);
  const isDark = theme === 'dark';
  const [view, setView] = useState<ClassroomView>('select');
  const [selectedTest, setSelectedTest] = useState<ListeningTest | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<SavedAudio | null>(null);
  const [playCount, setPlayCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [studentUrl, setStudentUrl] = useState<string>('');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [testToDelete, setTestToDelete] = useState<ListeningTest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lexisViewMode, setLexisViewMode] = useState<'overview' | 'focus'>('overview');
  const [focusedLexisIndex, setFocusedLexisIndex] = useState(0);
  const [contentTab, setContentTab] = useState<'passage' | 'vocabulary'>('passage');
  const [passageFontSize, setPassageFontSize] = useState(1.25); // rem
  const audioRef = useRef<HTMLAudioElement>(null);

  // Lexis audio state
  const [showLexisAudioConfirm, setShowLexisAudioConfirm] = useState(false);
  const [isGeneratingLexisAudio, setIsGeneratingLexisAudio] = useState(false);
  const [lexisAudioError, setLexisAudioError] = useState<string | null>(null);
  const [isPlayingLexisAudio, setIsPlayingLexisAudio] = useState(false);
  const [lexisTTSEngine, setLexisTTSEngine] = useState<LexisTTSEngine>('openai');
  const lexisAudioRef = useRef<HTMLAudioElement>(null);

  // Slideshow state for Focus Mode
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [isPlayingWordAudio, setIsPlayingWordAudio] = useState(false);
  const [isGeneratingWordAudios, setIsGeneratingWordAudios] = useState(false);
  const [wordAudioProgress, setWordAudioProgress] = useState({ current: 0, total: 0, word: '' });
  const wordAudioRef = useRef<HTMLAudioElement>(null);

  // Loading state for Present button (on-demand full test fetch)
  const [loadingTestId, setLoadingTestId] = useState<string | null>(null);

  // Pre-listening Arabic text toggle (used in fullscreen pre-listening slide)
  const [showPreListeningArabic, setShowPreListeningArabic] = useState(false);
  const [isGeneratingPreListeningAudio, setIsGeneratingPreListeningAudio] = useState(false);
  const [preListeningAudioLang, setPreListeningAudioLang] = useState<'en' | 'ar' | null>(null);
  const [isPlayingPreListeningAudio, setIsPlayingPreListeningAudio] = useState(false);
  const preListeningAudioRef = useRef<HTMLAudioElement>(null);

  // Plenary Arabic text toggle and audio (used in fullscreen plenary slide)
  const [showPlenaryArabic, setShowPlenaryArabic] = useState(false);
  const [isGeneratingPlenaryAudio, setIsGeneratingPlenaryAudio] = useState(false);
  const [plenaryAudioLang, setPlenaryAudioLang] = useState<'en' | 'ar' | null>(null);
  const [isPlayingPlenaryAudio, setIsPlayingPlenaryAudio] = useState(false);

  // Word pronunciation pre-loading state
  const [preloadProgress, setPreloadProgress] = useState<{ done: number; total: number } | null>(null);
  const [preloadSlide, setPreloadSlide] = useState<'preListening' | 'plenary' | null>(null);
  const plenaryAudioRef = useRef<HTMLAudioElement>(null);


  // Floating audio widget in fullscreen
  const [showAudioWidget, setShowAudioWidget] = useState(false);
  const [widgetPos, setWidgetPos] = useState<{ x: number; y: number } | null>(null);
  const [dockSide, setDockSide] = useState<'left' | 'right' | null>(null);
  const [dockPreview, setDockPreview] = useState<'left' | 'right' | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Unified fullscreen slide deck: null = not in fullscreen, string = which slide
  const [fullscreenSlide, setFullscreenSlide] = useState<string | null>(null);
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);

  // Compute available fullscreen slides from test data
  const fullscreenSlides = useMemo(() => {
    if (!selectedTest) return [];
    const slides: string[] = [];
    if (appMode === 'reading' && selectedTest.sourceText) slides.push('readingPassage');
    if (selectedTest.lexis?.length) slides.push('vocabulary');
    if (selectedTest.classroomActivity) slides.push('preListening');
    if (selectedTest.transferQuestion) slides.push('plenary');
    return slides;
  }, [selectedTest, appMode]);

  const currentSlideIndex = fullscreenSlide ? fullscreenSlides.indexOf(fullscreenSlide) : -1;
  const isFullscreen = fullscreenSlide !== null;

  // Reset content tab when test changes
  const selectedTestId = selectedTest?.id;
  useEffect(() => {
    setContentTab('passage');
    setPassageFontSize(1.25);
  }, [selectedTestId]);

  // Teacher controls - hide answers by default
  const [showAnswers, setShowAnswers] = useState(false);

  const SPEED_OPTIONS = [0.5, 0.75, 0.85, 0.9, 1] as const;

  // Track if we've already handled the current autoSelectTestId
  const handledAutoSelectRef = useRef<string | null>(null);

  // Auto-select test when navigating from One Shot creator or JAM
  useEffect(() => {
    // Skip if no autoSelectTestId or already handled this one
    if (!autoSelectTestId || autoSelectTestId === handledAutoSelectRef.current) {
      return;
    }

    if (tests.length > 0) {
      const test = tests.find(t => t.id === autoSelectTestId);
      if (test) {
        const audio = audioEntries.find(a => a.id === test.audioId);

        // If test expects audio but it's not loaded yet, wait for audioEntries to update
        if (test.audioId && !audio) {
          // Audio not yet available, don't proceed - effect will re-run when audioEntries updates
          return;
        }

        // Mark as handled BEFORE setting state to prevent re-runs
        handledAutoSelectRef.current = autoSelectTestId;

        // Use cache or fetch full test data
        (async () => {
          const cached = fullTestCache.get(test.id);
          if (cached) {
            setSelectedTest(cached);
          } else {
            try {
              const response = await fetch(`/api/tests/${test.id}`);
              if (response.ok) {
                const fullTest = mapTestFromServer(await response.json());
                fullTestCache.set(test.id, fullTest);
                setSelectedTest(fullTest);
              } else {
                setSelectedTest(test);
              }
            } catch {
              setSelectedTest(test);
            }
          }
          setSelectedAudio(audio || null);
          setPlayCount(0);
          setIsPlaying(false);
          setCurrentTime(0);
          setDuration(0);
          setView('present');
          onAutoSelectHandled?.();
        })();
      }
    }
  }, [autoSelectTestId, tests, audioEntries, onAutoSelectHandled]);

  // Reset the handled ref when autoSelectTestId is cleared
  useEffect(() => {
    if (!autoSelectTestId) {
      handledAutoSelectRef.current = null;
    }
  }, [autoSelectTestId]);

  // Get audio for a test
  const getAudioForTest = (test: ListeningTest): SavedAudio | undefined => {
    return audioEntries.find(a => a.id === test.audioId);
  };

  // Lexis audio generation handler
  const handleGenerateLexisAudio = async () => {
    if (!selectedTest?.lexis || selectedTest.lexis.length === 0) return;

    setIsGeneratingLexisAudio(true);
    setLexisAudioError(null);

    try {
      const result = await generateLexisAudio(selectedTest.lexis, lexisTTSEngine);

      if (result.success && result.audio) {
        // Update the test with the generated audio
        const updatedTest: ListeningTest = {
          ...selectedTest,
          lexisAudio: result.audio
        };
        setSelectedTest(updatedTest);

        // Save to database and update cache
        if (onUpdateTest) {
          onUpdateTest(updatedTest);
        }
        fullTestCache.set(updatedTest.id, updatedTest);

        // Close modal on success
        setShowLexisAudioConfirm(false);
      } else {
        // Keep modal open and show error
        setLexisAudioError(result.error || 'Failed to generate audio');
      }
    } catch (error) {
      console.error('[ClassroomMode] Lexis audio generation error:', error);
      setLexisAudioError('An unexpected error occurred');
    } finally {
      setIsGeneratingLexisAudio(false);
    }
  };

  // Lexis audio playback handlers
  const handlePlayLexisAudio = () => {
    if (lexisAudioRef.current) {
      if (isPlayingLexisAudio) {
        lexisAudioRef.current.pause();
      } else {
        lexisAudioRef.current.play();
      }
    }
  };

  // Lexis audio element event handlers
  useEffect(() => {
    const audioEl = lexisAudioRef.current;
    if (!audioEl) return;

    const handlePlay = () => setIsPlayingLexisAudio(true);
    const handlePause = () => setIsPlayingLexisAudio(false);
    const handleEnded = () => setIsPlayingLexisAudio(false);

    audioEl.addEventListener('play', handlePlay);
    audioEl.addEventListener('pause', handlePause);
    audioEl.addEventListener('ended', handleEnded);

    return () => {
      audioEl.removeEventListener('play', handlePlay);
      audioEl.removeEventListener('pause', handlePause);
      audioEl.removeEventListener('ended', handleEnded);
    };
  }, [selectedTest?.lexisAudio]);

  // Per-word audio generation handler
  const handleGenerateWordAudios = async () => {
    if (!selectedTest?.lexis || selectedTest.lexis.length === 0) return;

    setIsGeneratingWordAudios(true);
    setLexisAudioError(null);

    try {
      const result = await generateAllWordAudios(
        selectedTest.lexis,
        lexisTTSEngine,
        (current, total, word) => {
          setWordAudioProgress({ current, total, word });
        }
      );

      if (result.success && result.wordAudios) {
        // Update the test with the generated word audios
        const updatedTest: ListeningTest = {
          ...selectedTest,
          lexisAudio: {
            ...(selectedTest.lexisAudio || {
              url: '',
              generatedAt: new Date().toISOString(),
              engine: lexisTTSEngine
            }),
            wordAudios: result.wordAudios
          }
        };
        setSelectedTest(updatedTest);

        // Save to database and update cache
        if (onUpdateTest) {
          onUpdateTest(updatedTest);
        }
        fullTestCache.set(updatedTest.id, updatedTest);

        // Close modal on success
        setShowLexisAudioConfirm(false);

        if (result.failedWords && result.failedWords.length > 0) {
          console.warn('[ClassroomMode] Some words failed to generate:', result.failedWords);
        }
      } else {
        setLexisAudioError(result.error || 'Failed to generate word audios');
      }
    } catch (error) {
      console.error('[ClassroomMode] Word audio generation error:', error);
      setLexisAudioError('An unexpected error occurred');
    } finally {
      setIsGeneratingWordAudios(false);
      setWordAudioProgress({ current: 0, total: 0, word: '' });
    }
  };

  // Word audio element event handlers
  useEffect(() => {
    const audioEl = wordAudioRef.current;
    if (!audioEl) return;

    const handlePlay = () => setIsPlayingWordAudio(true);
    const handlePause = () => setIsPlayingWordAudio(false);
    const handleEnded = () => {
      setIsPlayingWordAudio(false);
      // Auto-advance to next word when slideshow is active
      if (slideshowActive && selectedTest?.lexis) {
        const nextIndex = focusedLexisIndex < selectedTest.lexis.length - 1
          ? focusedLexisIndex + 1
          : 0;

        // Small delay before advancing
        setTimeout(() => {
          setFocusedLexisIndex(nextIndex);
          // If we looped back to start, stop slideshow
          if (nextIndex === 0) {
            setSlideshowActive(false);
          }
        }, 500);
      }
    };

    audioEl.addEventListener('play', handlePlay);
    audioEl.addEventListener('pause', handlePause);
    audioEl.addEventListener('ended', handleEnded);

    return () => {
      audioEl.removeEventListener('play', handlePlay);
      audioEl.removeEventListener('pause', handlePause);
      audioEl.removeEventListener('ended', handleEnded);
    };
  }, [selectedTest?.lexisAudio?.wordAudios, slideshowActive, focusedLexisIndex, selectedTest?.lexis]);

  // Play word audio when focused word changes during slideshow
  useEffect(() => {
    if (!slideshowActive || !selectedTest?.lexis || !selectedTest.lexisAudio?.wordAudios) return;

    const currentWord = selectedTest.lexis[focusedLexisIndex];
    const wordAudio = selectedTest.lexisAudio.wordAudios[currentWord.id];

    if (wordAudio && wordAudioRef.current) {
      wordAudioRef.current.src = wordAudio.url;
      wordAudioRef.current.play().catch(err => {
        console.error('[ClassroomMode] Failed to play word audio:', err);
      });
    }
  }, [focusedLexisIndex, slideshowActive, selectedTest?.lexis, selectedTest?.lexisAudio?.wordAudios]);

  // Start/stop slideshow
  const handleToggleSlideshow = () => {
    if (!selectedTest?.lexisAudio?.wordAudios) {
      // No word audios generated yet
      return;
    }

    if (slideshowActive) {
      // Stop slideshow
      setSlideshowActive(false);
      if (wordAudioRef.current) {
        wordAudioRef.current.pause();
      }
    } else {
      // Start slideshow from current word
      setSlideshowActive(true);
      // Play current word audio
      const currentWord = selectedTest.lexis?.[focusedLexisIndex];
      const wordAudio = currentWord ? selectedTest.lexisAudio.wordAudios[currentWord.id] : null;

      if (wordAudio && wordAudioRef.current) {
        wordAudioRef.current.src = wordAudio.url;
        wordAudioRef.current.play().catch(err => {
          console.error('[ClassroomMode] Failed to start slideshow:', err);
        });
      }
    }
  };

  // Play single word audio (manual play button)
  const handlePlayWordAudio = () => {
    if (!selectedTest?.lexis || !selectedTest.lexisAudio?.wordAudios) return;

    const currentWord = selectedTest.lexis[focusedLexisIndex];
    const wordAudio = selectedTest.lexisAudio.wordAudios[currentWord.id];

    if (wordAudio && wordAudioRef.current) {
      if (isPlayingWordAudio) {
        wordAudioRef.current.pause();
      } else {
        wordAudioRef.current.src = wordAudio.url;
        wordAudioRef.current.play().catch(err => {
          console.error('[ClassroomMode] Failed to play word audio:', err);
        });
      }
    }
  };

  // Play individual word audio in fullscreen vocab grid
  const handleFullscreenWordPlay = (wordId: string) => {
    const wordAudio = selectedTest?.lexisAudio?.wordAudios?.[wordId];
    if (wordAudio && wordAudioRef.current) {
      if (playingWordId === wordId) {
        wordAudioRef.current.pause();
        setPlayingWordId(null);
      } else {
        wordAudioRef.current.src = wordAudio.url;
        wordAudioRef.current.play().catch(err => {
          console.error('[ClassroomMode] Failed to play word audio:', err);
        });
        setPlayingWordId(wordId);
      }
    }
  };

  // Generate QR code for student access
  const generateQRCode = async (test: ListeningTest) => {
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?student-test=${test.id}`;
    setStudentUrl(url);

    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 1024,
        margin: 2,
        color: {
          dark: '#1e293b',
          light: '#ffffff'
        }
      });
      setQrCodeUrl(qrDataUrl);
      setShowQRModal(true);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  };

  // Start presenting a test (works with or without audio)
  const handleStartPresentation = async (test: ListeningTest) => {
    // Check cache first — instant if already loaded
    const cached = fullTestCache.get(test.id);
    if (cached) {
      setSelectedTest(cached);
    } else {
      setLoadingTestId(test.id);
      try {
        const response = await fetch(`/api/tests/${test.id}`);
        if (response.ok) {
          const fullTest = mapTestFromServer(await response.json());
          fullTestCache.set(test.id, fullTest);
          setSelectedTest(fullTest);
        } else {
          setSelectedTest(test);
        }
      } catch {
        setSelectedTest(test);
      }
      setLoadingTestId(null);
    }
    const audio = getAudioForTest(test);
    setSelectedAudio(audio || null);
    setPlayCount(0);
    setIsPlaying(false);
    setShowPreListeningArabic(false);
    setIsPlayingPreListeningAudio(false);
    setFullscreenSlide(null);
    setPlayingWordId(null);
    setCurrentTime(0);
    setDuration(0);
    setView('present');
  };

  // Pre-listening audio generation (OpenAI TTS)
  const handleGeneratePreListeningAudio = async (language: 'en' | 'ar') => {
    if (!selectedTest?.classroomActivity) return;
    const activity = selectedTest.classroomActivity;

    setIsGeneratingPreListeningAudio(true);
    setPreListeningAudioLang(language);

    try {
      const apiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY;
      if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
        throw new Error('OpenAI API key not configured');
      }

      const text = language === 'en'
        ? `${activity.situationSetup.en} ... ${activity.discussionPrompt.en}`
        : `${activity.situationSetup.ar} ... ${activity.discussionPrompt.ar}`;

      const instructions = language === 'en'
        ? 'Read clearly and slowly for an English language classroom. Pause at the "..." between sentences.'
        : 'Read clearly and slowly in Arabic for a language classroom. Pause at the "..." between sentences.';

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts',
          input: text,
          voice: language === 'en' ? 'nova' : 'onyx',
          instructions,
          response_format: 'mp3'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[ClassroomMode] Pre-listening TTS error:', error);
        throw new Error('Audio generation failed');
      }

      const audioBlob = await response.blob();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      const dataUrl = `data:audio/mpeg;base64,${base64}`;

      // Update test with generated audio
      const updatedActivity = {
        ...activity,
        [language === 'en' ? 'audioEn' : 'audioAr']: dataUrl
      };
      const updatedTest: ListeningTest = {
        ...selectedTest,
        classroomActivity: updatedActivity
      };
      setSelectedTest(updatedTest);
      if (onUpdateTest) onUpdateTest(updatedTest);
      fullTestCache.set(updatedTest.id, updatedTest);

    } catch (error) {
      console.error('[ClassroomMode] Pre-listening audio error:', error);
    } finally {
      setIsGeneratingPreListeningAudio(false);
      setPreListeningAudioLang(null);
    }
  };

  // Pre-listening audio playback
  const handlePlayPreListeningAudio = (src: string) => {
    const audioEl = preListeningAudioRef.current;
    if (!audioEl) return;

    if (isPlayingPreListeningAudio && audioEl.src === src) {
      audioEl.pause();
      setIsPlayingPreListeningAudio(false);
    } else {
      audioEl.src = src;
      audioEl.play();
      setIsPlayingPreListeningAudio(true);
    }
  };

  // --- Plenary audio handlers (same pattern as pre-listening) ---
  const handleGeneratePlenaryAudio = async (language: 'en' | 'ar') => {
    if (!selectedTest?.transferQuestion) return;
    const tq = selectedTest.transferQuestion;

    setIsGeneratingPlenaryAudio(true);
    setPlenaryAudioLang(language);

    try {
      const apiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY;
      if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
        throw new Error('OpenAI API key not configured');
      }

      const text = language === 'en' ? tq.en : tq.ar;
      const instructions = language === 'en'
        ? 'Read clearly and slowly for an English language classroom.'
        : 'Read clearly and slowly in Arabic for a language classroom.';

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts',
          input: text,
          voice: language === 'en' ? 'nova' : 'onyx',
          instructions,
          response_format: 'mp3'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[ClassroomMode] Plenary TTS error:', error);
        throw new Error('Audio generation failed');
      }

      const audioBlob = await response.blob();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      const dataUrl = `data:audio/mpeg;base64,${base64}`;

      const updatedTQ = {
        ...tq,
        [language === 'en' ? 'audioEn' : 'audioAr']: dataUrl
      };
      const updatedTest: ListeningTest = {
        ...selectedTest,
        transferQuestion: updatedTQ
      };
      setSelectedTest(updatedTest);
      if (onUpdateTest) onUpdateTest(updatedTest);
      fullTestCache.set(updatedTest.id, updatedTest);

    } catch (error) {
      console.error('[ClassroomMode] Plenary audio error:', error);
    } finally {
      setIsGeneratingPlenaryAudio(false);
      setPlenaryAudioLang(null);
    }
  };

  const handlePreloadWords = async (slide: 'preListening' | 'plenary') => {
    if (!selectedTest || preloadSlide) return;
    setPreloadSlide(slide);

    const texts: string[] = [];
    if (slide === 'preListening' && selectedTest.classroomActivity) {
      texts.push(selectedTest.classroomActivity.situationSetup.en);
      texts.push(selectedTest.classroomActivity.discussionPrompt.en);
      if (showPreListeningArabic) {
        texts.push(selectedTest.classroomActivity.situationSetup.ar);
        texts.push(selectedTest.classroomActivity.discussionPrompt.ar);
      }
    } else if (slide === 'plenary' && selectedTest.transferQuestion) {
      texts.push(selectedTest.transferQuestion.en);
      if (showPlenaryArabic) {
        texts.push(selectedTest.transferQuestion.ar);
      }
    }

    await preGenerateWords(texts, (done, total) => setPreloadProgress({ done, total }));
    setPreloadProgress(null);
    setPreloadSlide(null);
  };

  const handlePlayPlenaryAudio = (src: string) => {
    const audioEl = plenaryAudioRef.current;
    if (!audioEl) return;

    if (isPlayingPlenaryAudio && audioEl.src === src) {
      audioEl.pause();
      setIsPlayingPlenaryAudio(false);
    } else {
      audioEl.src = src;
      audioEl.play();
      setIsPlayingPlenaryAudio(true);
    }
  };

  // Audio event handlers
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const handleTimeUpdate = () => setCurrentTime(audioEl.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(audioEl.duration);
      audioEl.playbackRate = playbackSpeed; // Apply current speed when audio loads
    };
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => {
      setIsPlaying(true);
      // Only increment on fresh play (not resume from pause)
      if (audioEl.currentTime === 0 || audioEl.currentTime < 0.5) {
        setPlayCount(prev => prev + 1);
      }
    };
    const handlePause = () => setIsPlaying(false);

    audioEl.addEventListener('timeupdate', handleTimeUpdate);
    audioEl.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioEl.addEventListener('ended', handleEnded);
    audioEl.addEventListener('play', handlePlay);
    audioEl.addEventListener('pause', handlePause);

    return () => {
      audioEl.removeEventListener('timeupdate', handleTimeUpdate);
      audioEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioEl.removeEventListener('ended', handleEnded);
      audioEl.removeEventListener('play', handlePlay);
      audioEl.removeEventListener('pause', handlePause);
    };
  }, [selectedAudio, playbackSpeed]);

  // Audio controls
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleRestart = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
  };

  const handleResetCounter = () => {
    setPlayCount(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Copy URL to clipboard
  const copyUrlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(studentUrl);
      alert('URL copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Q toggles QR view — must be handled before the guard below
      if (e.key === 'q' || e.key === 'Q') {
        if (showQRModal) {
          setShowQRModal(false);
        } else if (view === 'present' && selectedTest) {
          generateQRCode(selectedTest);
        }
        return;
      }

      // Escape closes QR modal when it's open
      if (e.key === 'Escape' && showQRModal) {
        setShowQRModal(false);
        return;
      }

      // A toggles floating audio widget in fullscreen
      if ((e.key === 'a' || e.key === 'A') && isFullscreen && selectedAudio) {
        setShowAudioWidget(prev => {
          if (prev) { setWidgetPos(null); setDockSide(null); } // reset on dismiss
          return !prev;
        });
        return;
      }

      // Escape exits fullscreen → back to presentation toolbar
      if (e.key === 'Escape' && isFullscreen) {
        setFullscreenSlide(null);
        setSlideshowActive(false);
        return;
      }

      // T navigates to plenary fullscreen slide
      if (e.key === 't' || e.key === 'T') {
        if (view === 'present' && selectedTest?.transferQuestion) {
          if (fullscreenSlide === 'plenary') {
            setFullscreenSlide(null);
          } else {
            setSlideshowActive(false);
            setFullscreenSlide('plenary');
          }
        }
        return;
      }

      if (view !== 'present' || showQRModal) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          // In fullscreen vocabulary slide, Space plays current word
          if (isFullscreen && fullscreenSlide === 'vocabulary' && selectedTest?.lexisAudio?.wordAudios) {
            handlePlayWordAudio();
          } else if (lexisViewMode === 'focus' && selectedTest?.lexisAudio?.wordAudios) {
            handlePlayWordAudio();
          } else if (appMode === 'listening' && selectedAudio) {
            handlePlayPause();
          }
          break;
        case 'r':
        case 'R':
          if (appMode === 'listening' && selectedAudio) {
            handleRestart();
          }
          break;
        case 'a':
        case 'A':
          // Navigate to pre-listening fullscreen slide
          if (selectedTest?.classroomActivity) {
            if (fullscreenSlide === 'preListening') {
              setFullscreenSlide(null);
            } else {
              setSlideshowActive(false);
              setFullscreenSlide('preListening');
            }
          }
          break;
        case 'f':
        case 'F':
          // Toggle fullscreen slide deck
          if (isFullscreen) {
            // Exit fullscreen
            setFullscreenSlide(null);
            setSlideshowActive(false);
          } else {
            // Enter fullscreen — start on vocabulary or first available
            const startSlide = fullscreenSlides.includes('vocabulary') ? 'vocabulary' : fullscreenSlides[0];
            if (startSlide) setFullscreenSlide(startSlide);
          }
          break;
        case 'v':
        case 'V':
          // Skip if viewing passage tab (vocab not visible)
          if (appMode === 'reading' && selectedTest?.sourceText && selectedTest?.lexis?.length && contentTab === 'passage') break;
          // 2-way toggle: overview ↔ focus. If in fullscreen: exit → overview
          if (isFullscreen) {
            setFullscreenSlide(null);
            setLexisViewMode('overview');
            setFocusedLexisIndex(0);
            setSlideshowActive(false);
          } else if (lexisViewMode === 'overview') {
            setLexisViewMode('focus');
            setFocusedLexisIndex(0);
            setSlideshowActive(false);
          } else {
            setLexisViewMode('overview');
            setFocusedLexisIndex(0);
            setSlideshowActive(false);
          }
          break;
        case 's':
        case 'S':
          // Toggle slideshow in focus mode or fullscreen vocabulary slide
          if ((lexisViewMode === 'focus' || (isFullscreen && fullscreenSlide === 'vocabulary')) && selectedTest?.lexisAudio?.wordAudios) {
            e.preventDefault();
            handleToggleSlideshow();
          }
          break;
        case 'p':
        case 'P':
          if (lexisViewMode === 'focus' && selectedTest?.lexisAudio?.wordAudios) {
            e.preventDefault();
            handlePlayWordAudio();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (isFullscreen) {
            // Navigate to previous slide
            if (currentSlideIndex > 0) {
              setSlideshowActive(false);
              setFullscreenSlide(fullscreenSlides[currentSlideIndex - 1]);
            }
          } else if (lexisViewMode === 'focus' && selectedTest?.lexis && !slideshowActive) {
            setFocusedLexisIndex(prev => prev > 0 ? prev - 1 : selectedTest.lexis!.length - 1);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (isFullscreen) {
            // Navigate to next slide
            if (currentSlideIndex < fullscreenSlides.length - 1) {
              setSlideshowActive(false);
              setFullscreenSlide(fullscreenSlides[currentSlideIndex + 1]);
            }
          } else if (lexisViewMode === 'focus' && selectedTest?.lexis && !slideshowActive) {
            setFocusedLexisIndex(prev => prev < selectedTest.lexis!.length - 1 ? prev + 1 : 0);
          }
          break;
        case 'Escape':
          // Exit presentation entirely (fullscreen Escape handled by early return above)
          if (appMode === 'listening' && audioRef.current) {
            audioRef.current.pause();
          }
          setIsPlaying(false);
          setView('select');
          setSelectedTest(null);
          setSelectedAudio(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, isPlaying, showQRModal, selectedTest, selectedAudio, lexisViewMode, slideshowActive, isFullscreen, fullscreenSlide, fullscreenSlides, currentSlideIndex, showAudioWidget]);

  // Get test type label
  const getTestTypeLabel = (type: string): string => {
    switch (type) {
      case 'listening-comprehension': return 'Comprehension';
      case 'reading-comprehension': return 'Reading';
      case 'fill-in-blank': return 'Fill in Blank';
      case 'dictation': return 'Dictation';
      default: return type;
    }
  };

  // Get badge color
  const getTestTypeBadge = (type: string): string => {
    switch (type) {
      case 'listening-comprehension': return 'bg-blue-500 text-white';
      case 'reading-comprehension': return 'bg-emerald-500 text-white';
      case 'fill-in-blank': return 'bg-amber-500 text-white';
      case 'dictation': return 'bg-purple-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  // QR Code Icon
  const QRCodeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="3" height="3" />
      <rect x="18" y="14" width="3" height="3" />
      <rect x="14" y="18" width="3" height="3" />
      <rect x="18" y="18" width="3" height="3" />
    </svg>
  );

  // Eye Icon for Preview
  const EyeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  // Edit Icon (Pencil)
  const EditIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );

  // Trash Icon
  const TrashIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );

  // Speaker Icon for lexis audio
  const SpeakerIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );

  // Spinner Icon for loading
  const SpinnerIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`animate-spin ${className}`}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );

  // Handle delete confirmation
  const handleDeleteClick = (test: ListeningTest) => {
    setTestToDelete(test);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (testToDelete && onDeleteTest) {
      console.log('[DELETE] Starting delete for test:', testToDelete.id, '| title:', testToDelete.title);
      console.log('[DELETE] test object keys:', Object.keys(testToDelete));
      console.log('[DELETE] test._id:', (testToDelete as any)._id, '| test.id:', testToDelete.id);
      setIsDeleting(true);
      try {
        await onDeleteTest(testToDelete);
        console.log('[DELETE] Success for test:', testToDelete.id);
        setShowDeleteConfirm(false);
        setTestToDelete(null);
      } catch (err) {
        console.error('[DELETE] Failed for test:', testToDelete.id, err);
        setShowDeleteConfirm(false);
        setTestToDelete(null);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setTestToDelete(null);
  };

  // Render test selection view
  const renderSelectView = () => (
    <div className={`min-h-screen p-8 ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <button
          onClick={onExit}
          className={`flex items-center gap-3 transition-colors text-lg ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
        >
          <ArrowLeftIcon className="w-6 h-6" />
          <span className="font-medium">Exit Classroom Mode</span>
        </button>
        <h1 className="text-3xl font-bold">Classroom Mode</h1>
        <div className="w-48" /> {/* Spacer */}
      </div>

      {/* Test List */}
      {isLoadingTests && tests.length === 0 ? (
        <div className="text-center py-24">
          <div className={`w-12 h-12 border-4 ${isDark ? 'border-indigo-400 border-t-transparent' : 'border-indigo-600 border-t-transparent'} rounded-full animate-spin mx-auto mb-6`} />
          <p className={`text-xl ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading tests...</p>
        </div>
      ) : tests.length === 0 ? (
        <div className="text-center py-24">
          <p className={`text-2xl mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No {appMode === 'reading' ? 'reading' : 'listening'} tests available</p>
          <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>Create tests from your {appMode === 'reading' ? 'passages' : 'audio library'} first</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          <h2 className={`text-xl mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Select a test to present:</h2>
          <div className="space-y-4">
            {tests.filter(t => isTestTypeForMode(t.type, appMode)).map(test => {
              const audio = getAudioForTest(test);
              return (
                <div
                  key={test.id}
                  className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 text-sm font-medium rounded-lg ${getTestTypeBadge(test.type)}`}>
                          {getTestTypeLabel(test.type)}
                        </span>
                        <span className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {test.lexis?.length || 0} vocab word{(test.lexis?.length || 0) !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <h3 className={`text-xl font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{test.title}</h3>
                      {audio && (
                        <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>{labels.contentSource}: {audio.title}</p>
                      )}
                      {appMode === 'reading' && test.sourceText && (
                        <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Passage: {test.sourceText.slice(0, 80)}…</p>
                      )}
                      {appMode === 'listening' && !audio && test.lexis && test.lexis.length > 0 && (
                        <p className={`text-sm ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>No audio — vocab-only presentation</p>
                      )}
                      {appMode === 'listening' && !audio && (!test.lexis || test.lexis.length === 0) && test.questions && test.questions.length > 0 && (
                        <p className={`text-sm ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>No audio — questions-only presentation</p>
                      )}
                      {appMode === 'listening' && !audio && (!test.lexis || test.lexis.length === 0) && (!test.questions || test.questions.length === 0) && (
                        <p className="text-red-400 text-sm">No audio, vocabulary, or questions</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {/* Primary actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onPreviewStudent(test)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                          title="Preview student view"
                        >
                          <EyeIcon className="w-4 h-4" />
                          <span className="text-sm">Preview</span>
                        </button>
                        <button
                          onClick={() => handleStartPresentation(test)}
                          disabled={loadingTestId !== null || (!audio && (!test.lexis || test.lexis.length === 0) && (!test.questions || test.questions.length === 0))}
                          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                          {loadingTestId === test.id ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                              <span className="text-sm">Loading…</span>
                            </>
                          ) : (
                            <>
                              <span className="text-sm">Present</span>
                              <ChevronRightIcon className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                      {/* Secondary actions - subtle icon buttons */}
                      {(onEditTest || onDeleteTest) && (
                        <div className="flex items-center gap-1">
                          {onEditTest && (
                            <button
                              onClick={() => onEditTest(test)}
                              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                              title="Edit test"
                            >
                              <EditIcon className="w-4 h-4" />
                            </button>
                          )}
                          {onDeleteTest && (
                            <button
                              onClick={() => handleDeleteClick(test)}
                              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:text-red-400 hover:bg-slate-700' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                              title="Delete test"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 backdrop-blur px-6 py-3 rounded-full ${isDark ? 'bg-slate-800/80' : 'bg-white/90 shadow-lg border border-slate-200'}`}>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Click "Present" to begin or "Preview" to see student view</p>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && testToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl max-w-md w-full p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <TrashIcon className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Delete Test</h2>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>This action cannot be undone</p>
              </div>
            </div>

            <p className={`mb-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Are you sure you want to delete "<span className="font-semibold">{testToDelete.title}</span>"?
              This will permanently remove the test and all its questions.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'} ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className={`flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isDeleting ? 'Deleting...' : 'Delete Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render presentation view - Traditional test format (works with or without audio)
  const renderPresentView = () => {
    if (!selectedTest) return null;

    return (
      <div className={`min-h-screen ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
        {/* Top Bar - Fixed (hidden in fullscreen) */}
        {!isFullscreen && (
        <div className={`sticky top-0 z-10 shadow-lg ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-900 text-white'}`}>
          <div className="max-w-6xl mx-auto px-6 py-4">
            {/* Row 1: Back + Title */}
            <div className="flex items-center mb-3">
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.pause();
                  }
                  setIsPlaying(false);
                  setView('select');
                  setSelectedTest(null);
                  setSelectedAudio(null);
                }}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors flex-shrink-0"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span>Back to Tests</span>
              </button>
              <h1 className="text-xl font-bold text-center flex-1">{selectedTest.title}</h1>
              {/* Invisible spacer to balance the back button */}
              <div className="w-[130px] flex-shrink-0" />
            </div>

            {/* Row 2: Control buttons */}
            <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
              {/* Preview Button */}
              <button
                onClick={() => onPreviewStudent(selectedTest)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                title="Preview student view"
              >
                <EyeIcon className="w-4 h-4" />
                <span className="text-sm">Preview</span>
              </button>

              {/* Pre-Listening/Pre-Reading Activity Button */}
              {selectedTest.classroomActivity && (
                <button
                  onClick={() => setFullscreenSlide(fullscreenSlide === 'preListening' ? null : 'preListening')}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors bg-slate-700 text-slate-300 hover:bg-slate-600"
                  title={`${labels.preActivity} classroom activity`}
                >
                  <span className="text-sm">💬</span>
                  <span className="text-sm">{labels.preActivity}</span>
                </button>
              )}

              {/* Plenary Transfer Question Button */}
              {selectedTest.transferQuestion && (
                <button
                  onClick={() => setFullscreenSlide(fullscreenSlide === 'plenary' ? null : 'plenary')}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors bg-slate-700 text-slate-300 hover:bg-slate-600"
                  title="Plenary transfer question for class discussion"
                >
                  <span className="text-sm">🗣️</span>
                  <span className="text-sm">Plenary</span>
                </button>
              )}

              {/* QR Code Button */}
              <button
                onClick={() => generateQRCode(selectedTest)}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
                title="Show QR code for students"
              >
                <QRCodeIcon className="w-4 h-4" />
                <span className="text-sm">QR Code</span>
              </button>

              {/* Lexis Audio Button */}
              {selectedTest.lexis && selectedTest.lexis.length > 0 && (
                <button
                  onClick={() => setShowLexisAudioConfirm(true)}
                  disabled={isGeneratingLexisAudio || isGeneratingWordAudios}
                  className={`flex items-center gap-2 h-[34px] px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    selectedTest.lexisAudio
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : 'bg-amber-600 text-white hover:bg-amber-500'
                  }`}
                  title="Manage vocabulary audio"
                >
                  {(isGeneratingLexisAudio || isGeneratingWordAudios) ? (
                    <SpinnerIcon className="w-4 h-4" />
                  ) : (
                    <SpeakerIcon className="w-4 h-4" />
                  )}
                  <span className="text-sm">
                    {isGeneratingLexisAudio || isGeneratingWordAudios ? 'Generating' : 'Vocab'}
                  </span>
                  {selectedTest.lexisAudio && (
                    <span className="w-2 h-2 bg-green-400 rounded-full" title="Audio generated" />
                  )}
                </button>
              )}

              {/* Play Counter - only shown with audio in listening mode */}
              {appMode === 'listening' && selectedAudio && (
                <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg">
                  <span className="text-slate-400 text-sm">Plays:</span>
                  <span className="text-2xl font-bold text-indigo-400">{playCount}</span>
                  <button
                    onClick={handleResetCounter}
                    className="ml-2 p-1 text-slate-500 hover:text-white transition-colors"
                    title="Reset counter"
                  >
                    <RefreshIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Audio Player — listening mode only */}
            {appMode === 'listening' && selectedAudio && (
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePlayPause}
                  className="w-14 h-14 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-500 transition-colors shadow-lg"
                  title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                >
                  {isPlaying ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7 ml-1" />}
                </button>
                <button
                  onClick={handleRestart}
                  className="w-10 h-10 flex items-center justify-center bg-slate-700 text-slate-300 rounded-full hover:bg-slate-600 transition-colors"
                  title="Reset to start (R)"
                >
                  <RefreshIcon className="w-5 h-5" />
                </button>

                {/* Speed Controls */}
                <div className="flex items-center bg-slate-800 rounded-lg p-1 gap-1">
                  {SPEED_OPTIONS.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        playbackSpeed === speed
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                      title={`${speed}x speed`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>

                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
                  />
                  <div className="flex justify-between mt-1 text-xs text-slate-400">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
        )}

        {/* Audio element — listening mode only */}
        {appMode === 'listening' && selectedAudio?.audioUrl && (
          <audio
            ref={audioRef}
            src={selectedAudio.audioUrl}
            preload="metadata"
            className="hidden"
          />
        )}

        {/* Tab bar — reading mode with both passage and vocab */}
        {appMode === 'reading' && selectedTest.sourceText && selectedTest.lexis && selectedTest.lexis.length > 0 && (
          <div className="max-w-4xl mx-auto px-6 pt-4">
            <div className={`inline-flex rounded-xl p-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
              <button
                onClick={() => setContentTab('passage')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  contentTab === 'passage'
                    ? isDark ? 'bg-slate-600 text-white' : 'bg-white text-slate-900 shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Reading Passage
              </button>
              <button
                onClick={() => setContentTab('vocabulary')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  contentTab === 'vocabulary'
                    ? isDark ? 'bg-slate-600 text-white' : 'bg-white text-slate-900 shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Vocabulary
              </button>
            </div>
          </div>
        )}

        {/* Reading Passage — shown when passage tab active OR no vocab exists */}
        {appMode === 'reading' && selectedTest.sourceText && (contentTab === 'passage' || !selectedTest.lexis?.length) && (
          <div className="max-w-4xl mx-auto px-6 py-6">
            <div className="flex justify-end gap-2 mb-2">
              <button
                onClick={() => setPassageFontSize(s => Math.max(0.875, +(s - 0.125).toFixed(3)))}
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-colors ${
                  isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                A-
              </button>
              <button
                onClick={() => setPassageFontSize(s => Math.min(2.5, +(s + 0.125).toFixed(3)))}
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-colors ${
                  isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                A+
              </button>
            </div>
            <div className={`rounded-2xl border p-6 ${isDark ? 'border-emerald-700 bg-emerald-900/20' : 'border-emerald-200 bg-emerald-50/80'}`}>
              <div
                className={`leading-relaxed whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                style={{ fontSize: `${passageFontSize}rem` }}
              >
                {selectedTest.sourceText}
              </div>
            </div>
          </div>
        )}

        {/* Vocabulary / Lexis Section — hidden when passage tab is active in reading mode */}
        {!(appMode === 'reading' && selectedTest.sourceText && selectedTest.lexis?.length && contentTab === 'passage') && (
        (!selectedTest.lexis || selectedTest.lexis.length === 0) ? (
          /* No lexis - show questions if available */
          selectedTest.questions && selectedTest.questions.length > 0 ? (
            <div className="max-w-4xl mx-auto px-6 py-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Questions ({selectedTest.questions.length})
                </h2>
                <button
                  onClick={() => setShowAnswers(!showAnswers)}
                  className={`px-4 py-2 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
                    showAnswers
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : isDark
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {showAnswers ? (
                    <>
                      <span>✓</span>
                      <span>Answers Shown</span>
                    </>
                  ) : (
                    <>
                      <span>○</span>
                      <span>Show Answers</span>
                    </>
                  )}
                </button>
              </div>
              <div className="space-y-4">
                {selectedTest.questions.map((question, index) => (
                  <div
                    key={question.id}
                    className={`p-6 rounded-2xl border-2 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                  >
                    <div className="flex items-start gap-4">
                      <span className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${isDark ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'}`}>
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {question.questionText}
                        </p>
                        {question.options && question.options.length > 0 && (
                          <div className="grid grid-cols-2 gap-3">
                            {question.options.map((option, optIndex) => (
                              <div
                                key={optIndex}
                                className={`p-3 rounded-xl border ${
                                  showAnswers && option === question.correctAnswer
                                    ? 'bg-green-50 border-green-300 text-green-800'
                                    : isDark
                                      ? 'bg-slate-700 border-slate-600 text-slate-300'
                                      : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className="font-medium mr-2">{String.fromCharCode(65 + optIndex)}.</span>
                                {option}
                                {showAnswers && option === question.correctAnswer && (
                                  <span className="ml-2 text-green-600">✓</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-6 py-8">
              <div className={`text-center py-12 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <p className="text-lg">No vocabulary items or questions for this test</p>
                <p className="text-sm mt-2">Add content in the test builder</p>
              </div>
            </div>
          )
        ) : lexisViewMode === 'overview' ? (
          /* Overview Mode - All words fit on screen */
          <div className="px-6 py-4 h-[calc(100vh-180px)] overflow-hidden">
            <div className={`grid gap-3 h-full`} style={{
              gridTemplateColumns: `repeat(${Math.min(4, Math.ceil(Math.sqrt(selectedTest.lexis.length)))}, 1fr)`,
              gridTemplateRows: `repeat(${Math.ceil(selectedTest.lexis.length / Math.min(4, Math.ceil(Math.sqrt(selectedTest.lexis.length))))}, 1fr)`
            }}>
              {selectedTest.lexis.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => { setLexisViewMode('focus'); setFocusedLexisIndex(index); }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-transform hover:scale-[1.02] flex flex-col justify-center ${isDark ? 'bg-slate-800 border-slate-700 hover:border-indigo-500' : 'bg-slate-50 border-slate-200 hover:border-indigo-400'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isDark ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'}`}>
                      {index + 1}
                    </span>
                    <h3 className={`text-2xl font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {item.term}
                    </h3>
                  </div>
                  {item.partOfSpeech && (
                    <p className={`text-base font-semibold mb-1 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                      {item.partOfSpeech}
                    </p>
                  )}
                  {item.definitionArabic && (
                    <p className={`text-lg leading-snug line-clamp-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} dir="rtl">
                      {item.definitionArabic}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Focus Mode - One word at a time, large for accessibility */
          <div className="flex items-center justify-center h-[calc(100vh-180px)] px-8">
            <button
              onClick={() => setFocusedLexisIndex(prev => prev > 0 ? prev - 1 : selectedTest.lexis!.length - 1)}
              className={`p-4 rounded-full transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className={`flex-1 max-w-4xl mx-8 p-12 rounded-3xl border-2 text-center relative ${
              slideshowActive
                ? isDark ? 'bg-slate-800 border-green-500 ring-2 ring-green-500/50' : 'bg-slate-50 border-green-500 ring-2 ring-green-500/50'
                : isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              {/* Slideshow indicator */}
              {slideshowActive && (
                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white rounded-full text-sm font-medium">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  Slideshow
                </div>
              )}

              <div className="flex items-center justify-center gap-4 mb-6">
                <span className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl ${isDark ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'}`}>
                  {focusedLexisIndex + 1}
                </span>
                <span className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  of {selectedTest.lexis.length}
                </span>
              </div>

              <h3 className={`text-7xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {selectedTest.lexis[focusedLexisIndex].term}
              </h3>
              {selectedTest.lexis[focusedLexisIndex].partOfSpeech && (
                <p className={`text-3xl font-semibold mb-8 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {selectedTest.lexis[focusedLexisIndex].partOfSpeech}
                </p>
              )}

              {selectedTest.lexis[focusedLexisIndex].definitionArabic && (
                <p className={`text-5xl leading-relaxed mb-8 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} dir="rtl">
                  {selectedTest.lexis[focusedLexisIndex].definitionArabic}
                </p>
              )}

              {/* Audio Controls */}
              {selectedTest.lexisAudio?.wordAudios && (
                <div className="flex items-center justify-center gap-4 mt-8 pt-8 border-t border-slate-300/50">
                  {/* Play Word Audio Button */}
                  <button
                    onClick={handlePlayWordAudio}
                    disabled={!selectedTest.lexisAudio.wordAudios[selectedTest.lexis[focusedLexisIndex].id]}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                      isPlayingWordAudio
                        ? 'bg-amber-500 text-white'
                        : isDark
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isPlayingWordAudio ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </svg>
                        Playing
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        Play Word
                      </>
                    )}
                  </button>

                  {/* Slideshow Button */}
                  <button
                    onClick={handleToggleSlideshow}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                      slideshowActive
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : isDark
                          ? 'bg-slate-700 hover:bg-slate-600 text-white'
                          : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                    }`}
                  >
                    {slideshowActive ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </svg>
                        Stop Slideshow
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3" />
                          <line x1="19" y1="5" x2="19" y2="19" />
                        </svg>
                        Start Slideshow
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setFocusedLexisIndex(prev => prev < selectedTest.lexis!.length - 1 ? prev + 1 : 0)}
              className={`p-4 rounded-full transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )
        )}

        {/* Keyboard Hints - Fixed Bottom (hidden in fullscreen) */}
        {!isFullscreen && (
          <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 backdrop-blur px-6 py-3 rounded-full text-sm ${isDark ? 'bg-slate-800/90 text-white' : 'bg-slate-900/90 text-white'}`}>
            {/* Audio controls - only shown when audio exists */}
            {selectedAudio && (
              <>
                <span>
                  <kbd className="px-2 py-1 rounded bg-slate-700">Space</kbd>
                  {' '}{lexisViewMode === 'focus' && selectedTest?.lexisAudio?.wordAudios ? 'Play Word' : 'Play/Pause'}
                </span>
                {!(lexisViewMode === 'focus' && selectedTest?.lexisAudio?.wordAudios) && (
                  <span><kbd className="px-2 py-1 rounded bg-slate-700">R</kbd> Restart</span>
                )}
              </>
            )}
            {/* Word audio controls - shown when no main audio but has word audios */}
            {!selectedAudio && lexisViewMode === 'focus' && selectedTest?.lexisAudio?.wordAudios && (
              <span>
                <kbd className="px-2 py-1 rounded bg-slate-700">Space</kbd>
                {' '}Play Word
              </span>
            )}
            <span><kbd className="px-2 py-1 rounded bg-slate-700">V</kbd> {lexisViewMode === 'overview' ? 'Focus' : 'Overview'}</span>
            {lexisViewMode === 'focus' && !slideshowActive && <span><kbd className="px-2 py-1 rounded bg-slate-700">←→</kbd> Navigate</span>}
            {lexisViewMode === 'focus' && selectedTest?.lexisAudio?.wordAudios && (
              <span><kbd className={`px-2 py-1 rounded ${slideshowActive ? 'bg-green-600' : 'bg-slate-700'}`}>S</kbd> {slideshowActive ? 'Stop' : 'Slideshow'}</span>
            )}
            {fullscreenSlides.length > 0 && (
              <span><kbd className="px-2 py-1 rounded bg-slate-700">F</kbd> Fullscreen</span>
            )}
            {selectedTest?.classroomActivity && (
              <span><kbd className="px-2 py-1 rounded bg-slate-700">A</kbd> {labels.preActivity}</span>
            )}
            {selectedTest?.transferQuestion && (
              <span><kbd className="px-2 py-1 rounded bg-slate-700">T</kbd> Plenary</span>
            )}
            <span><kbd className="px-2 py-1 rounded bg-slate-700">Q</kbd> QR Code</span>
            <span><kbd className="px-2 py-1 rounded bg-slate-700">Esc</kbd> Exit</span>
          </div>
        )}

        {/* Unified Fullscreen Slide Deck */}
        {isFullscreen && (
          <div className="fixed inset-0 bg-slate-900 z-40 flex flex-col">
            {/* Slide content */}
            <div className="flex-1 overflow-hidden">

              {/* Reading Passage Slide */}
              {fullscreenSlide === 'readingPassage' && selectedTest.sourceText && (
                <div className="h-full flex flex-col">
                  <div className="text-center pt-6 pb-4 flex-shrink-0">
                    <h2 className="text-2xl font-semibold text-slate-400 tracking-wide uppercase">
                      📖 Reading Passage
                    </h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 pb-20">
                    <div className="max-w-5xl w-full mx-auto">
                      <div className="text-2xl leading-loose text-slate-200 whitespace-pre-wrap">
                        {selectedTest.sourceText}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pre-Listening/Pre-Reading Slide */}
              {fullscreenSlide === 'preListening' && selectedTest.classroomActivity && (
                <div className="h-full flex flex-col">
                  <div className="text-center pt-6 pb-4 flex-shrink-0">
                    <h2 className="text-2xl font-semibold text-slate-400 tracking-wide uppercase">
                      💬 {labels.preActivity}
                    </h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 pb-20">
                    <div className="max-w-5xl w-full mx-auto space-y-6">
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <span className="text-4xl">🎧</span>
                          <h3 className="text-4xl font-bold text-white">Situation</h3>
                        </div>
                        <SpeakableText text={selectedTest.classroomActivity.situationSetup.en} className="text-3xl leading-loose text-slate-200" />
                        {showPreListeningArabic && (
                          <SpeakableText text={selectedTest.classroomActivity.situationSetup.ar} className="text-2xl leading-loose mt-3 text-slate-400" dir="rtl" />
                        )}
                      </div>
                      <hr className="border-slate-700" />
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <span className="text-4xl">💬</span>
                          <h3 className="text-4xl font-bold text-white">Discuss</h3>
                        </div>
                        <SpeakableText text={selectedTest.classroomActivity.discussionPrompt.en} className="text-3xl leading-loose text-slate-200" />
                        {showPreListeningArabic && (
                          <SpeakableText text={selectedTest.classroomActivity.discussionPrompt.ar} className="text-2xl leading-loose mt-3 text-slate-400" dir="rtl" />
                        )}
                      </div>
                      {/* Audio + Arabic toggle buttons */}
                      <div className="flex items-center justify-center gap-4 flex-wrap">
                        {selectedTest.classroomActivity.audioEn ? (
                          <button
                            onClick={() => handlePlayPreListeningAudio(selectedTest.classroomActivity!.audioEn!)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-medium transition-colors ${
                              isPlayingPreListeningAudio ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                            }`}
                          >
                            <span>{isPlayingPreListeningAudio ? '⏸' : '▶'}</span> Play
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGeneratePreListeningAudio('en')}
                            disabled={isGeneratingPreListeningAudio}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-medium transition-colors ${
                              isGeneratingPreListeningAudio && preListeningAudioLang === 'en'
                                ? 'bg-indigo-500 text-white opacity-75'
                                : 'bg-indigo-600 text-white hover:bg-indigo-500'
                            }`}
                          >
                            {isGeneratingPreListeningAudio && preListeningAudioLang === 'en' ? (
                              <><svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Generating...</>
                            ) : (<><span>🔊</span> Generate Audio</>)}
                          </button>
                        )}
                        {selectedTest.classroomActivity.audioAr ? (
                          <button
                            onClick={() => handlePlayPreListeningAudio(selectedTest.classroomActivity!.audioAr!)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-medium transition-colors ${
                              isPlayingPreListeningAudio ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                            }`}
                          >
                            <span>{isPlayingPreListeningAudio ? '⏸' : '▶'}</span> عربي
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGeneratePreListeningAudio('ar')}
                            disabled={isGeneratingPreListeningAudio}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-medium transition-colors ${
                              isGeneratingPreListeningAudio && preListeningAudioLang === 'ar'
                                ? 'bg-amber-500 text-white opacity-75'
                                : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                            }`}
                          >
                            {isGeneratingPreListeningAudio && preListeningAudioLang === 'ar' ? (
                              <><svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> جاري التوليد...</>
                            ) : (<><span>🔊</span> Generate عربي</>)}
                          </button>
                        )}
                        <button
                          onClick={() => handlePreloadWords('preListening')}
                          disabled={preloadSlide === 'preListening'}
                          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-medium transition-colors ${
                            preloadSlide === 'preListening'
                              ? 'bg-cyan-500 text-white opacity-75'
                              : preloadProgress === null && preloadSlide === null && pronunciationCache.size > 0
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                          }`}
                        >
                          {preloadSlide === 'preListening' ? (
                            <><svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Pre-loading {preloadProgress?.done}/{preloadProgress?.total}...</>
                          ) : (
                            <><span>📖</span> Pre-load Words</>
                          )}
                        </button>
                        <button
                          onClick={() => setShowPreListeningArabic(!showPreListeningArabic)}
                          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-medium transition-colors ${
                            showPreListeningArabic ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                          }`}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                          </svg>
                          {showPreListeningArabic ? 'Hide Arabic' : 'Show Arabic'}
                        </button>
                      </div>
                      <audio ref={preListeningAudioRef} preload="metadata" className="hidden" onEnded={() => setIsPlayingPreListeningAudio(false)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Vocabulary Slide */}
              {fullscreenSlide === 'vocabulary' && selectedTest.lexis && selectedTest.lexis.length > 0 && (
                <div className="h-full flex flex-col">
                  <div className="text-center pt-6 pb-4 flex-shrink-0">
                    <h2 className="text-2xl font-semibold text-slate-400 tracking-wide uppercase">
                      📖 Vocabulary
                    </h2>
                  </div>
                  <div className="flex-1 overflow-hidden pb-16">
                    {(() => {
                      const items = selectedTest.lexis!;
                      const count = items.length;
                      const useTwoCols = count > 8;
                      const half = Math.ceil(count / 2);
                      const leftItems = useTwoCols ? items.slice(0, half) : items;
                      const rightItems = useTwoCols ? items.slice(half) : [];
                      const termSize = count <= 8 ? 'text-3xl' : count <= 14 ? 'text-2xl' : 'text-xl';
                      const arabicSize = count <= 8 ? 'text-2xl' : count <= 14 ? 'text-xl' : 'text-lg';
                      const posSize = count <= 8 ? 'text-base' : 'text-sm';
                      const iconSize = count <= 8 ? 'text-2xl' : 'text-xl';
                      const termWidth = useTwoCols ? 'w-48' : 'w-64';
                      const posWidth = useTwoCols ? 'w-24' : 'w-32';

                      const renderColumn = (columnItems: typeof items) => (
                        <div className="flex-1" style={{ display: 'grid', gridTemplateRows: `repeat(${columnItems.length}, 1fr)` }}>
                          {columnItems.map((item) => {
                            const globalIdx = items.indexOf(item);
                            const isActive = (slideshowActive && globalIdx === focusedLexisIndex)
                                           || playingWordId === item.id;
                            const hasAudio = !!selectedTest.lexisAudio?.wordAudios?.[item.id];
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center gap-5 px-6 rounded-lg transition-all ${
                                  isActive ? 'bg-indigo-950/30' : ''
                                }`}
                              >
                                {hasAudio ? (
                                  <button
                                    onClick={() => {
                                      if (slideshowActive) {
                                        setSlideshowActive(false);
                                        if (wordAudioRef.current) wordAudioRef.current.pause();
                                      }
                                      handleFullscreenWordPlay(item.id);
                                    }}
                                    className={`${iconSize} w-10 flex-shrink-0 transition-colors ${
                                      isActive ? 'text-indigo-400 animate-pulse' : 'text-slate-600 hover:text-slate-400'
                                    }`}
                                  >
                                    {isActive ? '🔊' : '🔈'}
                                  </button>
                                ) : (
                                  <span className={`${iconSize} w-10 flex-shrink-0 text-slate-800`}>🔇</span>
                                )}
                                <span className={`${termSize} ${termWidth} font-bold text-white flex-shrink-0`}>{item.term}</span>
                                {item.partOfSpeech ? (
                                  <span className={`${posSize} ${posWidth} flex-shrink-0 text-indigo-300`}>
                                    {item.partOfSpeech}
                                  </span>
                                ) : (
                                  <span className={`${posWidth} flex-shrink-0`} />
                                )}
                                {item.definitionArabic && (
                                  <span className={`${arabicSize} text-slate-300`} dir="rtl">
                                    {item.definitionArabic}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );

                      return (
                        <div className={`h-full flex justify-center ${useTwoCols ? 'gap-12 max-w-7xl' : 'max-w-5xl'} mx-auto`}>
                          {renderColumn(leftItems)}
                          {useTwoCols && renderColumn(rightItems)}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Plenary Slide */}
              {fullscreenSlide === 'plenary' && selectedTest.transferQuestion && (
                <div className="h-full flex flex-col">
                  <div className="text-center pt-6 pb-4 flex-shrink-0">
                    <h2 className="text-2xl font-semibold text-slate-400 tracking-wide uppercase">
                      🗣️ Plenary
                    </h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 pb-20">
                    <div className="max-w-5xl w-full mx-auto space-y-6">
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <span className="text-4xl">🗣️</span>
                          <h3 className="text-4xl font-bold text-white">Discussion Question</h3>
                        </div>
                        <SpeakableText text={selectedTest.transferQuestion.en} className="text-3xl leading-loose text-slate-200" />
                        {showPlenaryArabic && (
                          <SpeakableText text={selectedTest.transferQuestion.ar} className="text-2xl leading-loose mt-3 text-slate-400" dir="rtl" />
                        )}
                      </div>
                      <hr className="border-slate-700" />
                      <p className="text-center text-xl pt-2 text-slate-500">
                        Discuss as a class · ناقشوا كصف
                      </p>
                      {/* Audio + Arabic toggle buttons */}
                      <div className="flex items-center justify-center gap-4 flex-wrap">
                        {selectedTest.transferQuestion.audioEn ? (
                          <button
                            onClick={() => handlePlayPlenaryAudio(selectedTest.transferQuestion!.audioEn!)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-medium transition-colors ${
                              isPlayingPlenaryAudio ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                            }`}
                          >
                            <span>{isPlayingPlenaryAudio ? '⏸' : '▶'}</span> Play
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGeneratePlenaryAudio('en')}
                            disabled={isGeneratingPlenaryAudio}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-medium transition-colors ${
                              isGeneratingPlenaryAudio && plenaryAudioLang === 'en'
                                ? 'bg-indigo-500 text-white opacity-75'
                                : 'bg-indigo-600 text-white hover:bg-indigo-500'
                            }`}
                          >
                            {isGeneratingPlenaryAudio && plenaryAudioLang === 'en' ? (
                              <><svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Generating...</>
                            ) : (<><span>🔊</span> Generate Audio</>)}
                          </button>
                        )}
                        {selectedTest.transferQuestion.audioAr ? (
                          <button
                            onClick={() => handlePlayPlenaryAudio(selectedTest.transferQuestion!.audioAr!)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-medium transition-colors ${
                              isPlayingPlenaryAudio ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                            }`}
                          >
                            <span>{isPlayingPlenaryAudio ? '⏸' : '▶'}</span> عربي
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGeneratePlenaryAudio('ar')}
                            disabled={isGeneratingPlenaryAudio}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-medium transition-colors ${
                              isGeneratingPlenaryAudio && plenaryAudioLang === 'ar'
                                ? 'bg-amber-500 text-white opacity-75'
                                : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                            }`}
                          >
                            {isGeneratingPlenaryAudio && plenaryAudioLang === 'ar' ? (
                              <><svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> جاري التوليد...</>
                            ) : (<><span>🔊</span> Generate عربي</>)}
                          </button>
                        )}
                        <button
                          onClick={() => handlePreloadWords('plenary')}
                          disabled={preloadSlide === 'plenary'}
                          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-medium transition-colors ${
                            preloadSlide === 'plenary'
                              ? 'bg-cyan-500 text-white opacity-75'
                              : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                          }`}
                        >
                          {preloadSlide === 'plenary' ? (
                            <><svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Pre-loading {preloadProgress?.done}/{preloadProgress?.total}...</>
                          ) : (
                            <><span>📖</span> Pre-load Words</>
                          )}
                        </button>
                        <button
                          onClick={() => setShowPlenaryArabic(!showPlenaryArabic)}
                          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-medium transition-colors ${
                            showPlenaryArabic ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                          }`}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                          </svg>
                          {showPlenaryArabic ? 'Hide Arabic' : 'Show Arabic'}
                        </button>
                      </div>
                      <audio ref={plenaryAudioRef} preload="metadata" className="hidden" onEnded={() => setIsPlayingPlenaryAudio(false)} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* --- Audio Widget + Footer (dockable system) --- */}
            {(() => {
              // Shared drag handler for both docked and undocked modes
              const startDrag = (clientX: number, clientY: number, el: HTMLElement) => {
                const rect = el.getBoundingClientRect();
                const isDocked = dockSide !== null;
                let currentPreview: 'left' | 'right' | null = null;
                dragRef.current = { startX: clientX, startY: clientY, originX: rect.left, originY: rect.top };

                const onMove = (mx: number, my: number) => {
                  if (!dragRef.current) return;
                  const dx = mx - dragRef.current.startX;
                  const dy = my - dragRef.current.startY;

                  if (isDocked) {
                    // Undock if dragged >40px away from start
                    if (Math.abs(dy) > 40 || Math.abs(dx) > 40) {
                      const newX = Math.max(0, Math.min(window.innerWidth - rect.width, dragRef.current.originX + dx));
                      const newY = Math.max(0, Math.min(window.innerHeight - rect.height, dragRef.current.originY + dy));
                      setDockSide(null);
                      setWidgetPos({ x: newX, y: newY });
                    }
                    return;
                  }

                  const newX = Math.max(0, Math.min(window.innerWidth - rect.width, dragRef.current.originX + dx));
                  const newY = Math.max(0, Math.min(window.innerHeight - rect.height, dragRef.current.originY + dy));
                  setWidgetPos({ x: newX, y: newY });

                  // Snap detection
                  const inDockZone = (newY + rect.height) > (window.innerHeight - 80);
                  if (inDockZone) {
                    currentPreview = mx < window.innerWidth / 2 ? 'left' : 'right';
                  } else {
                    currentPreview = null;
                  }
                  setDockPreview(currentPreview);
                };

                const onMouseMove = (ev: MouseEvent) => onMove(ev.clientX, ev.clientY);
                const onTouchMove = (ev: TouchEvent) => onMove(ev.touches[0].clientX, ev.touches[0].clientY);

                const onEnd = () => {
                  if (!isDocked && currentPreview) {
                    setDockSide(currentPreview);
                    setWidgetPos(null);
                  }
                  setDockPreview(null);
                  dragRef.current = null;
                  window.removeEventListener('mousemove', onMouseMove);
                  window.removeEventListener('mouseup', onEnd);
                  window.removeEventListener('touchmove', onTouchMove);
                  window.removeEventListener('touchend', onEnd);
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onEnd);
                window.addEventListener('touchmove', onTouchMove, { passive: false });
                window.addEventListener('touchend', onEnd);
              };

              // Widget controls (grip + audio controls)
              const widgetControls = (
                <div className="flex items-center gap-3">
                  {/* Drag grip */}
                  <div
                    className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 select-none px-1"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const el = widgetRef.current || (e.target as HTMLElement).closest('[data-widget]') as HTMLElement;
                      if (el) startDrag(e.clientX, e.clientY, el);
                    }}
                    onTouchStart={(e) => {
                      const el = widgetRef.current || (e.target as HTMLElement).closest('[data-widget]') as HTMLElement;
                      if (el) startDrag(e.touches[0].clientX, e.touches[0].clientY, el);
                    }}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="8" cy="6" r="1.5"/><circle cx="16" cy="6" r="1.5"/>
                      <circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/>
                      <circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/>
                    </svg>
                  </div>
                  <button onClick={handlePlayPause} className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-500 transition-colors" title={isPlaying ? "Pause" : "Play"}>
                    {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 ml-0.5" />}
                  </button>
                  <button onClick={handleRestart} className="w-8 h-8 flex items-center justify-center bg-slate-700 text-slate-300 rounded-full hover:bg-slate-600 transition-colors" title="Restart">
                    <RefreshIcon className="w-4 h-4" />
                  </button>
                  <div className="flex items-center bg-slate-700/50 rounded-lg p-0.5 gap-0.5">
                    {SPEED_OPTIONS.map((speed) => (
                      <button key={speed} onClick={() => handleSpeedChange(speed)} className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${playbackSpeed === speed ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-600'}`}>
                        {speed}x
                      </button>
                    ))}
                  </div>
                  <div className="w-40">
                    <input type="range" min="0" max={duration || 0} value={currentTime} onChange={handleSeek} className="w-full h-1.5 bg-slate-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full" />
                    <div className="flex justify-between mt-0.5 text-[10px] text-slate-400">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-700/50 px-2.5 py-1 rounded-lg">
                    <span className="text-slate-400 text-xs">Plays:</span>
                    <span className="text-lg font-bold text-indigo-400">{playCount}</span>
                    <button onClick={handleResetCounter} className="p-0.5 text-slate-500 hover:text-white transition-colors" title="Reset counter">
                      <RefreshIcon className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );

              // Footer controls
              const footerControls = (
                <>
                  {currentSlideIndex > 0 && (
                    <span className="cursor-pointer hover:text-indigo-300 transition-colors" onClick={() => { setSlideshowActive(false); setFullscreenSlide(fullscreenSlides[currentSlideIndex - 1]); }}>
                      <kbd className="px-2 py-1 rounded bg-slate-700">←</kbd> Prev
                    </span>
                  )}
                  <span className="text-slate-400">{currentSlideIndex + 1} / {fullscreenSlides.length}</span>
                  {currentSlideIndex < fullscreenSlides.length - 1 && (
                    <span className="cursor-pointer hover:text-indigo-300 transition-colors" onClick={() => { setSlideshowActive(false); setFullscreenSlide(fullscreenSlides[currentSlideIndex + 1]); }}>
                      Next <kbd className="px-2 py-1 rounded bg-slate-700">→</kbd>
                    </span>
                  )}
                  {fullscreenSlide === 'vocabulary' && selectedTest.lexisAudio?.wordAudios && (
                    <span>
                      <kbd className={`px-2 py-1 rounded ${slideshowActive ? 'bg-green-600' : 'bg-slate-700'}`}>S</kbd>
                      {' '}{slideshowActive ? 'Stop' : 'Play All'}
                    </span>
                  )}
                  {selectedAudio && (
                    <span className="cursor-pointer hover:text-indigo-300 transition-colors" onClick={() => { setShowAudioWidget(prev => { if (prev) { setDockSide(null); } return !prev; }); }}>
                      <kbd className={`px-2 py-1 rounded ${showAudioWidget ? 'bg-indigo-600' : 'bg-slate-700'}`}>A</kbd> Audio
                    </span>
                  )}
                  <span className="cursor-pointer hover:text-indigo-300 transition-colors" onClick={() => generateQRCode(selectedTest)}>
                    <kbd className="px-2 py-1 rounded bg-slate-700">Q</kbd> QR Code
                  </span>
                  <span><kbd className="px-2 py-1 rounded bg-slate-700">Esc</kbd> Exit</span>
                </>
              );

              const showWidget = showAudioWidget && selectedAudio;

              return (
                <>
                  {/* Dock preview indicator */}
                  {dockPreview && (
                    <div className={`fixed bottom-3 h-1.5 rounded-full bg-indigo-500/60 z-50 transition-all duration-150 ${
                      dockPreview === 'left' ? 'left-8 w-1/3' : 'right-8 w-1/3'
                    }`} />
                  )}

                  {/* MODE: Undocked — widget and footer are separate */}
                  {!dockSide && (
                    <>
                      {showWidget && (
                        <div
                          ref={widgetRef}
                          data-widget
                          className="fixed z-50 backdrop-blur bg-slate-800/95 rounded-2xl px-5 py-3 shadow-2xl border border-slate-700/50"
                          style={widgetPos
                            ? { left: widgetPos.x, top: widgetPos.y }
                            : { bottom: '5rem', left: '50%', transform: 'translateX(-50%)' }
                          }
                        >
                          {widgetControls}
                        </div>
                      )}
                      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 backdrop-blur px-6 py-3 rounded-full text-sm bg-slate-800/90 text-white">
                        {footerControls}
                      </div>
                    </>
                  )}

                  {/* MODE: Docked — widget and footer in one combined bar */}
                  {dockSide && (
                    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-50">
                      {dockSide === 'left' && showWidget && (
                        <div ref={widgetRef} data-widget className="backdrop-blur bg-slate-800/95 rounded-2xl px-5 py-3 shadow-2xl border border-slate-700/50">
                          {widgetControls}
                        </div>
                      )}
                      <div className="backdrop-blur bg-slate-800/90 rounded-full px-6 py-3 flex items-center gap-4 text-sm text-white">
                        {footerControls}
                      </div>
                      {dockSide === 'right' && showWidget && (
                        <div ref={widgetRef} data-widget className="backdrop-blur bg-slate-800/95 rounded-2xl px-5 py-3 shadow-2xl border border-slate-700/50">
                          {widgetControls}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* QR Code — fullscreen view for smartboard/projector */}
        {showQRModal && (
          <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50"
               onClick={() => setShowQRModal(false)}>
            <div className="w-full h-full flex items-center justify-center gap-10 p-8"
                 onClick={e => e.stopPropagation()}>
              {/* QR code — scales with viewport */}
              {qrCodeUrl && (
                <div className="bg-white p-6 rounded-2xl flex-shrink-0">
                  <img src={qrCodeUrl} alt="QR Code"
                       className="w-[min(70vh,60vw)] h-[min(70vh,60vw)]" />
                </div>
              )}
              {/* Info panel */}
              <div className="flex-shrink-0 max-w-sm">
                <h2 className="text-4xl font-bold text-white mb-3">Student Access</h2>
                <p className="text-xl text-slate-300 mb-8">Scan the QR code to access the test</p>

                <div className="bg-white/10 rounded-xl p-4 mb-8">
                  <p className="text-xs text-slate-400 mb-2">Student URL:</p>
                  <p className="text-sm font-mono text-slate-200 break-all">{studentUrl}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={copyUrlToClipboard}
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-500 transition-colors"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => setShowQRModal(false)}
                    className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
            {/* Footer hint */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 backdrop-blur px-6 py-3 rounded-full text-sm bg-white/10 text-white">
              <span><kbd className="px-2 py-1 rounded bg-white/20">Q</kbd> Back to Presentation</span>
              <span><kbd className="px-2 py-1 rounded bg-white/20">Esc</kbd> Close</span>
            </div>
          </div>
        )}

        {/* Lexis Audio Confirmation Modal */}
        {showLexisAudioConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className={`rounded-2xl max-w-md w-full p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <SpeakerIcon className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {selectedTest?.lexisAudio ? 'Vocabulary Audio' : 'Generate Vocabulary Audio'}
                  </h2>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {selectedTest?.lexisAudio ? 'Manage audio for' : 'TTS for'} {selectedTest?.lexis?.length || 0} vocabulary items
                  </p>
                </div>
              </div>

              {/* Existing Audio Status - shown when audio exists */}
              {selectedTest?.lexisAudio ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Current Audio</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                        {selectedTest.lexisAudio.engine}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedTest.lexisAudio.url && (
                        <button
                          onClick={handlePlayLexisAudio}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isPlayingLexisAudio
                              ? 'bg-green-600 text-white'
                              : 'bg-emerald-600 text-white hover:bg-emerald-500'
                          }`}
                        >
                          {isPlayingLexisAudio ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                          {isPlayingLexisAudio ? 'Pause' : 'Play Full Audio'}
                        </button>
                      )}
                      {selectedTest.lexisAudio.wordAudios && (
                        <span className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                          Per-word audio ready
                        </span>
                      )}
                    </div>
                  </div>

                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    To regenerate audio, delete the current audio first.
                  </p>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => {
                        if (confirm('Delete all vocabulary audio? This cannot be undone.')) {
                          const updatedTest: ListeningTest = {
                            ...selectedTest,
                            lexisAudio: undefined
                          };
                          setSelectedTest(updatedTest);
                          if (onUpdateTest) onUpdateTest(updatedTest);
                          fullTestCache.set(updatedTest.id, updatedTest);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white hover:bg-red-700 rounded-xl font-medium transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Delete Audio
                    </button>

                    <button
                      onClick={() => { setShowLexisAudioConfirm(false); setLexisAudioError(null); }}
                      className={`w-full px-4 py-3 rounded-xl font-medium transition-colors ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Generation UI - shown when no audio exists */}
                  <p className={`mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    Generate audio teaching the vocabulary words to students:
                  </p>

                  <ul className={`mb-4 space-y-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <li>- Introduction: "The key vocabulary words are..."</li>
                    <li>- Each word with its Arabic translation</li>
                    <li>- Pauses for comprehension</li>
                  </ul>

                  {/* TTS Engine Selector */}
                  <div className="mb-6">
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Voice Engine
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLexisTTSEngine('gemini')}
                        disabled={isGeneratingLexisAudio}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          lexisTTSEngine === 'gemini'
                            ? 'bg-blue-600 text-white'
                            : isDark
                              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        } disabled:opacity-50`}
                      >
                        Gemini
                      </button>
                      <button
                        onClick={() => setLexisTTSEngine('openai')}
                        disabled={isGeneratingLexisAudio}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          lexisTTSEngine === 'openai'
                            ? 'bg-blue-600 text-white'
                            : isDark
                              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        } disabled:opacity-50`}
                      >
                        GPT-4o mini
                      </button>
                    </div>
                  </div>

                  {lexisAudioError && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-lg text-red-700 text-sm">
                      {lexisAudioError}
                    </div>
                  )}

                  {/* Progress indicator for per-word generation */}
                  {isGeneratingWordAudios && wordAudioProgress.total > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-blue-700 font-medium">Generating word audios...</span>
                        <span className="text-sm text-blue-600">{wordAudioProgress.current} / {wordAudioProgress.total}</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(wordAudioProgress.current / wordAudioProgress.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-blue-600 mt-1">Current: {wordAudioProgress.word}</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    {/* Full Audio Button */}
                    <button
                      onClick={handleGenerateLexisAudio}
                      disabled={isGeneratingLexisAudio || isGeneratingWordAudios}
                      className="w-full px-4 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isGeneratingLexisAudio ? (
                        <>
                          <SpinnerIcon className="w-4 h-4" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <SpeakerIcon className="w-4 h-4" />
                          Generate Full Audio
                        </>
                      )}
                    </button>

                    {/* Per-Word Audio Button (for slideshow) - Always uses GPT-4o mini to avoid Gemini quota issues */}
                    <button
                      onClick={() => {
                        // Force OpenAI for per-word generation (Gemini quota issues with many requests)
                        setLexisTTSEngine('openai');
                        handleGenerateWordAudios();
                      }}
                      disabled={isGeneratingLexisAudio || isGeneratingWordAudios}
                      className="w-full px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isGeneratingWordAudios ? (
                        <>
                          <SpinnerIcon className="w-4 h-4" />
                          Generating {wordAudioProgress.current}/{wordAudioProgress.total}...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3" />
                            <line x1="19" y1="5" x2="19" y2="19" />
                          </svg>
                          Generate Per-Word Audio (GPT-4o mini)
                        </>
                      )}
                    </button>

                    <p className={`text-xs text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Full Audio: single file &bull; Per-Word: individual files for slideshow (uses GPT-4o mini)
                    </p>

                    <button
                      onClick={() => { setShowLexisAudioConfirm(false); setLexisAudioError(null); }}
                      disabled={isGeneratingLexisAudio || isGeneratingWordAudios}
                      className={`w-full px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Lexis Audio Element */}
        {selectedTest?.lexisAudio?.url && (
          <audio
            ref={lexisAudioRef}
            src={selectedTest.lexisAudio.url}
            preload="metadata"
            className="hidden"
          />
        )}

        {/* Word Audio Element (for per-word playback) */}
        <audio
          ref={wordAudioRef}
          preload="metadata"
          className="hidden"
          onEnded={() => setPlayingWordId(null)}
        />
      </div>
    );
  };

  return view === 'select' ? renderSelectView() : renderPresentView();
};
