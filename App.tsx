import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useBrowserTTS } from './hooks/useBrowserTTS';
import { useGeminiTTS } from './hooks/useGeminiTTS';
import { useElevenLabsTTS } from './hooks/useElevenLabsTTS';
import { useMongoStorage } from './hooks/useMongoStorage';
import { parseDialogue, parseLLMTranscript, guessGender } from './utils/parser';
import { BrowserVoiceConfig, EngineType, GEMINI_VOICES, SpeakerVoiceMapping, AppView, SavedAudio, ListeningTest, TestAttempt } from './types';
import { PlayIcon, StopIcon, FolderIcon, PlusIcon, SaveIcon, ArrowLeftIcon, PresentationIcon, FileTextIcon, SparklesIcon, SettingsIcon } from './components/Icons';
import { SaveDialog } from './components/SaveDialog';
import { PromptBuilder } from './components/PromptBuilder';
import { Settings, AppSettings, DEFAULT_SETTINGS } from './components/Settings';
import { useSettings } from './hooks/useSettings';

// Lazy load components for better initial load
const Visualizer = lazy(() => import('./components/Visualizer'));
const AudioLibrary = lazy(() => import('./components/AudioLibrary').then(m => ({ default: m.AudioLibrary })));
const AudioDetail = lazy(() => import('./components/AudioDetail').then(m => ({ default: m.AudioDetail })));
const TestBuilder = lazy(() => import('./components/TestBuilder').then(m => ({ default: m.TestBuilder })));
const TestTaker = lazy(() => import('./components/TestTaker').then(m => ({ default: m.TestTaker })));
const ClassroomMode = lazy(() => import('./components/ClassroomMode').then(m => ({ default: m.ClassroomMode })));
const StudentTest = lazy(() => import('./components/StudentTest').then(m => ({ default: m.StudentTest })));
const TranscriptMode = lazy(() => import('./components/TranscriptMode').then(m => ({ default: m.TranscriptMode })));

// Preload functions for components
const preloadClassroom = () => import('./components/ClassroomMode');
const preloadLibrary = () => import('./components/AudioLibrary');

// Loading spinner component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

// Inline spinner for smaller sections
const InlineSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

// Simple visualizer placeholder for SSR/loading
const VisualizerFallback = () => (
  <div className="h-24 flex items-center justify-center">
    <div className="flex gap-1">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="w-1 h-8 bg-slate-600 rounded-full" />
      ))}
    </div>
  </div>
);

// Use relative path - works for both dev (with proxy) and production
const API_BASE = '/api';

const App: React.FC = () => {
  // Navigation state
  const [currentView, setCurrentView] = useState<AppView>('editor');
  const [libraryTab, setLibraryTab] = useState<'audio' | 'transcripts'>('audio');
  const [selectedAudio, setSelectedAudio] = useState<SavedAudio | null>(null);
  const [editingAudioId, setEditingAudioId] = useState<string | null>(null);

  // Test state
  const [audioTests, setAudioTests] = useState<ListeningTest[]>([]);
  const [allTests, setAllTests] = useState<ListeningTest[]>([]);
  const [selectedTest, setSelectedTest] = useState<ListeningTest | null>(null);
  const [editingTest, setEditingTest] = useState<ListeningTest | null>(null);
  const [testBuilderKey, setTestBuilderKey] = useState(0); // Key to force TestBuilder remount
  const [studentTestId, setStudentTestId] = useState<string | null>(null);
  const [studentTest, setStudentTest] = useState<ListeningTest | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);

  // Editor state
  const [title, setTitle] = useState("Untitled Audio");
  const [text, setText] = useState("Narrator: Welcome to DialogueForge.\n\nJane: This tool can automatically detect different speakers in your text.\n\nJohn: That is correct. Just type a name followed by a colon, and assign us a voice!");
  const [engine, setEngine] = useState<EngineType>(EngineType.BROWSER);
  const [elevenLabsKey, setElevenLabsKey] = useState("");
  const [lastGeneratedBlob, setLastGeneratedBlob] = useState<Blob | null>(null);
  const [geminiPlaybackSuccess, setGeminiPlaybackSuccess] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showPromptBuilder, setShowPromptBuilder] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const settingsHook = useSettings();

  // Analysis State
  const analysis = useMemo(() => parseDialogue(text), [text]);
  const [speakerMapping, setSpeakerMapping] = useState<SpeakerVoiceMapping>({});

  // Config States
  const [browserConfig, setBrowserConfig] = useState<BrowserVoiceConfig>({ voice: null, rate: 1, pitch: 1, volume: 1 });
  const [geminiVoice, setGeminiVoice] = useState('Puck'); // Google's default voice
  const [elevenVoiceId, setElevenVoiceId] = useState("");

  // Hooks
  const browserTTS = useBrowserTTS();
  const geminiTTS = useGeminiTTS();
  const elevenTTS = useElevenLabsTTS();
  const audioStorage = useMongoStorage();

  // Sort ElevenLabs voices by accent (American first, then British, then others alphabetically)
  const sortedElevenVoices = useMemo(() => {
    if (elevenTTS.voices.length === 0) return [];
    const accentOrder: Record<string, number> = {
      'american': 1,
      'british': 2,
      'australian': 3,
      'irish': 4,
    };
    return [...elevenTTS.voices].sort((a, b) => {
      const accentA = (a.labels?.accent || 'unknown').toLowerCase();
      const accentB = (b.labels?.accent || 'unknown').toLowerCase();
      const orderA = accentOrder[accentA] || 99;
      const orderB = accentOrder[accentB] || 99;
      if (orderA !== orderB) return orderA - orderB;
      // Same accent priority, sort by accent name then by voice name
      if (accentA !== accentB) return accentA.localeCompare(accentB);
      return a.name.localeCompare(b.name);
    });
  }, [elevenTTS.voices]);

  useEffect(() => {
    if (browserTTS.voices.length > 0 && !browserConfig.voice) {
      const defaultVoice = browserTTS.voices.find(v => v.default && v.lang.startsWith('en')) || browserTTS.voices[0];
      setBrowserConfig(prev => ({ ...prev, voice: defaultVoice }));
    }
  }, [browserTTS.voices, browserConfig.voice]);

  const performSmartCast = useCallback((currentSpeakers: string[], currentMap: SpeakerVoiceMapping, forceReset = false) => {
    const newMap = forceReset ? {} : { ...currentMap };

    // Track which voices have been used to avoid duplicates when possible
    const usedVoiceIds = new Set<string>();

    currentSpeakers.forEach((speaker, index) => {
      if (newMap[speaker] && !forceReset) return;
      const gender = guessGender(speaker);

      if (engine === EngineType.GEMINI) {
        let candidates = GEMINI_VOICES;
        if (gender !== 'Neutral') candidates = GEMINI_VOICES.filter(v => v.gender === gender);
        newMap[speaker] = (candidates[index % candidates.length] || GEMINI_VOICES[0]).name;
      } else if (engine === EngineType.ELEVEN_LABS && elevenTTS.voices.length > 0) {
        // Filter voices by gender using ElevenLabs labels
        let candidates = elevenTTS.voices;

        if (gender !== 'Neutral') {
          const genderLower = gender.toLowerCase();
          const genderFiltered = elevenTTS.voices.filter(v =>
            v.labels?.gender?.toLowerCase() === genderLower
          );
          // Only use filtered list if we found matches
          if (genderFiltered.length > 0) {
            candidates = genderFiltered;
          }
        }

        // Try to pick an unused voice first
        let selectedVoice = candidates.find(v => !usedVoiceIds.has(v.voice_id));
        if (!selectedVoice) {
          // All matching voices used, cycle through
          selectedVoice = candidates[index % candidates.length];
        }

        newMap[speaker] = selectedVoice.voice_id;
        usedVoiceIds.add(selectedVoice.voice_id);
      } else if (engine === EngineType.BROWSER && browserTTS.voices.length > 0) {
        const langPrefix = browserConfig.voice?.lang.split('-')[0] || 'en';
        const relevantVoices = browserTTS.voices.filter(v => v.lang.startsWith(langPrefix));
        newMap[speaker] = (relevantVoices[index % relevantVoices.length] || browserTTS.voices[0]).name;
      }
    });
    return newMap;
  }, [engine, browserConfig.voice, browserTTS.voices, elevenTTS.voices]);

  // Reset speaker mapping and Gemini playback state when engine changes
  useEffect(() => {
    setSpeakerMapping({});
    setGeminiPlaybackSuccess(false);
  }, [engine]);

  // Reset Gemini playback state when text changes
  useEffect(() => {
    setGeminiPlaybackSuccess(false);
  }, [text]);

  // Auto-detect LLM format and apply voice assignments and title
  const lastParsedTextRef = React.useRef('');
  const skipAutoCastCountRef = React.useRef(0); // Counter to skip multiple auto-cast cycles
  const pendingVoiceAssignmentsRef = React.useRef<{ [speaker: string]: string }>({}); // Store pending voice assignments for when voices load

  useEffect(() => {
    // Skip if we've already parsed this exact text (including dialogue-only version)
    if (text === lastParsedTextRef.current) {
      console.log('[LLM Parser] Skipping - already parsed this text');
      return;
    }

    const parsed = parseLLMTranscript(text);
    console.log('[LLM Parser] Parsed result:', {
      hasLLMFormat: parsed.hasLLMFormat,
      title: parsed.title,
      voiceAssignments: parsed.voiceAssignments,
      dialogueTextLength: parsed.dialogueText.length,
    });

    if (parsed.hasLLMFormat) {
      // Store the dialogue text as the "parsed" text so we don't re-parse after setText
      lastParsedTextRef.current = parsed.dialogueText;

      // Auto-fill title if found
      if (parsed.title && title === 'Untitled Audio') {
        console.log('[LLM Parser] Setting title:', parsed.title);
        setTitle(parsed.title);
      }

      // Auto-apply voice assignments if we have them and the engine supports them
      if (Object.keys(parsed.voiceAssignments).length > 0) {
        console.log('[LLM Parser] Processing voice assignments, engine:', engine);
        // Skip next 3 auto-cast cycles (to handle setText triggering additional renders)
        skipAutoCastCountRef.current = 3;
        console.log('[LLM Parser] Set skipAutoCastCountRef to 3');

        // Store voice assignments for later (in case voices aren't loaded yet)
        pendingVoiceAssignmentsRef.current = parsed.voiceAssignments;
        console.log('[LLM Parser] Stored pending voice assignments:', pendingVoiceAssignmentsRef.current);

        // Map voice names to voice IDs for ElevenLabs
        if (engine === EngineType.ELEVEN_LABS && elevenTTS.voices.length > 0) {
          console.log('[LLM Parser] Available ElevenLabs voices:', elevenTTS.voices.map(v => v.name).join(', '));
          const mappedAssignments: SpeakerVoiceMapping = {};
          Object.entries(parsed.voiceAssignments).forEach(([speaker, voiceName]) => {
            const searchName = voiceName.toLowerCase().trim();
            // Try exact match first, then starts-with, then includes
            let voice = elevenTTS.voices.find(v => v.name.toLowerCase() === searchName);
            if (!voice) {
              voice = elevenTTS.voices.find(v => v.name.toLowerCase().startsWith(searchName));
            }
            if (!voice) {
              voice = elevenTTS.voices.find(v => v.name.toLowerCase().includes(searchName));
            }
            console.log(`[LLM Parser] ElevenLabs mapping: ${speaker} -> ${voiceName}, found:`, voice?.name, voice?.voice_id);
            if (voice) {
              mappedAssignments[speaker] = voice.voice_id;
            }
          });
          console.log('[LLM Parser] Final ElevenLabs mappedAssignments:', mappedAssignments);
          if (Object.keys(mappedAssignments).length > 0) {
            setSpeakerMapping(mappedAssignments);
            // Clear pending since we applied successfully
            pendingVoiceAssignmentsRef.current = {};
          }
        } else if (engine === EngineType.GEMINI) {
          // For Gemini, voice names can be used directly
          const mappedAssignments: SpeakerVoiceMapping = {};
          Object.entries(parsed.voiceAssignments).forEach(([speaker, voiceName]) => {
            // Verify it's a valid Gemini voice name
            const voice = GEMINI_VOICES.find(v =>
              v.name.toLowerCase() === voiceName.toLowerCase()
            );
            console.log(`[LLM Parser] Gemini mapping: ${speaker} -> ${voiceName}, found:`, voice?.name);
            if (voice) {
              mappedAssignments[speaker] = voice.name;
            }
          });
          console.log('[LLM Parser] Final Gemini mappedAssignments:', mappedAssignments);
          if (Object.keys(mappedAssignments).length > 0) {
            setSpeakerMapping(mappedAssignments);
            // Clear pending since we applied successfully
            pendingVoiceAssignmentsRef.current = {};
          }
        } else {
          console.log('[LLM Parser] Engine not supported or voices not loaded. Engine:', engine, 'ElevenLabs voices:', elevenTTS.voices.length);
          console.log('[LLM Parser] Voice assignments stored for later application');
        }
      }

      // Replace text with just the dialogue portion (cleaner for TTS)
      if (parsed.dialogueText !== text) {
        console.log('[LLM Parser] Replacing text with dialogue portion');
        setText(parsed.dialogueText);
      }
    }
  }, [text, engine, title]); // Removed elevenTTS.voices - we handle that in a separate effect

  // Apply pending voice assignments when ElevenLabs voices become available
  useEffect(() => {
    if (engine !== EngineType.ELEVEN_LABS) return;
    if (elevenTTS.voices.length === 0) return;
    if (Object.keys(pendingVoiceAssignmentsRef.current).length === 0) return;

    console.log('[Voice Loader] Applying pending voice assignments:', pendingVoiceAssignmentsRef.current);
    console.log('[Voice Loader] Available voices:', elevenTTS.voices.map(v => v.name).join(', '));

    const mappedAssignments: SpeakerVoiceMapping = {};
    Object.entries(pendingVoiceAssignmentsRef.current).forEach(([speaker, voiceName]: [string, string]) => {
      const searchName = voiceName.toLowerCase().trim();
      // Try exact match first, then starts-with, then includes
      let voice = elevenTTS.voices.find(v => v.name.toLowerCase() === searchName);
      if (!voice) {
        voice = elevenTTS.voices.find(v => v.name.toLowerCase().startsWith(searchName));
      }
      if (!voice) {
        voice = elevenTTS.voices.find(v => v.name.toLowerCase().includes(searchName));
      }
      console.log(`[Voice Loader] ElevenLabs mapping: ${speaker} -> ${voiceName}, found:`, voice?.name, voice?.voice_id);
      if (voice) {
        mappedAssignments[speaker] = voice.voice_id;
      }
    });

    if (Object.keys(mappedAssignments).length > 0) {
      console.log('[Voice Loader] Setting speaker mapping:', mappedAssignments);
      setSpeakerMapping(mappedAssignments);
      // Prevent auto-cast from overwriting
      skipAutoCastCountRef.current = 3;
    }

    // Clear pending assignments
    pendingVoiceAssignmentsRef.current = {};
  }, [engine, elevenTTS.voices]);

  // Track Gemini playback completion - set success when playback ends (not loading, not playing)
  const prevGeminiPlayingRef = React.useRef(false);
  useEffect(() => {
    // Detect transition from playing to not playing (successful completion)
    if (prevGeminiPlayingRef.current && !geminiTTS.isPlaying && !geminiTTS.isLoading) {
      setGeminiPlaybackSuccess(true);
    }
    prevGeminiPlayingRef.current = geminiTTS.isPlaying;
  }, [geminiTTS.isPlaying, geminiTTS.isLoading]);

  // Auto-cast speakers when speakers change or voices become available
  useEffect(() => {
    console.log('[Auto-Cast] Effect triggered. skipAutoCastCountRef:', skipAutoCastCountRef.current, 'speakers:', analysis.speakers);
    // Skip auto-cast if LLM voice assignments were just applied
    if (skipAutoCastCountRef.current > 0) {
      console.log('[Auto-Cast] Skipping due to skipAutoCastCountRef:', skipAutoCastCountRef.current);
      skipAutoCastCountRef.current--;
      return;
    }

    const hasVoices =
      (engine === EngineType.BROWSER && browserTTS.voices.length > 0) ||
      (engine === EngineType.GEMINI) ||
      (engine === EngineType.ELEVEN_LABS && elevenTTS.voices.length > 0);

    console.log('[Auto-Cast] hasVoices:', hasVoices, 'speakers count:', analysis.speakers.length);

    if (hasVoices && analysis.speakers.length > 0) {
      setSpeakerMapping(prev => {
        // Only auto-cast if mapping is empty or has stale entries
        const hasValidMapping = analysis.speakers.every(s => prev[s]);
        console.log('[Auto-Cast] Inside setSpeakerMapping. prev:', prev, 'hasValidMapping:', hasValidMapping);
        if (hasValidMapping) {
          console.log('[Auto-Cast] Valid mapping exists, keeping prev');
          return prev;
        }
        const newMapping = performSmartCast(analysis.speakers, {}, true);
        console.log('[Auto-Cast] Performing smart cast, new mapping:', newMapping);
        return newMapping;
      });
    }
  }, [analysis.speakers, engine, browserTTS.voices, elevenTTS.voices, performSmartCast]);

  const handlePlay = async () => {
    if (!text) return;
    if (engine === EngineType.BROWSER) {
      if (browserTTS.isPaused) browserTTS.resume();
      else browserTTS.speak(text, browserConfig, analysis.isDialogue ? analysis.segments : undefined, analysis.isDialogue ? speakerMapping : undefined);
    } else if (engine === EngineType.GEMINI) {
      geminiTTS.speak(text, { voiceName: geminiVoice }, analysis.isDialogue ? speakerMapping : undefined);
    } else if (engine === EngineType.ELEVEN_LABS) {
      const keyToUse = elevenTTS.apiKey || elevenLabsKey;
      const blob = await elevenTTS.speak(
        text,
        keyToUse,
        analysis.isDialogue ? analysis.segments : undefined,
        analysis.isDialogue ? speakerMapping : undefined,
        elevenVoiceId || undefined
      );
      if (blob) {
        setLastGeneratedBlob(blob);
      }
    }
  };

  const handleStop = () => {
    browserTTS.cancel();
    geminiTTS.stop();
    elevenTTS.stop();
  };

  const isPlaying = browserTTS.isPlaying || geminiTTS.isPlaying || elevenTTS.isPlaying;
  const isLoading = geminiTTS.isLoading || elevenTTS.isLoading;

  // CRUD Operations
  const handleSaveClick = () => {
    if (!text.trim()) {
      alert('Please enter some text before saving.');
      return;
    }
    setShowSaveDialog(true);
  };

  const handleSaveWithTitle = async (finalTitle: string) => {
    setShowSaveDialog(false);
    setTitle(finalTitle);

    const audioData = {
      title: finalTitle,
      transcript: text,
      engine,
      speakerMapping,
      speakers: analysis.speakers,
    };

    // Determine the blob to save based on engine
    let blobToSave: Blob | undefined = undefined;

    if (engine === EngineType.ELEVEN_LABS) {
      // Generate audio on-demand for ElevenLabs (or use cached blob if available)
      if (lastGeneratedBlob) {
        blobToSave = lastGeneratedBlob;
      } else {
        const keyToUse = elevenTTS.apiKey || elevenLabsKey;
        if (keyToUse) {
          try {
            console.log('Generating ElevenLabs audio for save...');
            const defaultVoiceId = Object.values(speakerMapping)[0] || elevenVoiceId;
            const elevenBlob = await elevenTTS.generateAudio(
              text,
              keyToUse,
              analysis.isDialogue ? analysis.segments : undefined,
              analysis.isDialogue ? speakerMapping : undefined,
              defaultVoiceId
            );
            if (elevenBlob) {
              console.log('ElevenLabs audio generated successfully, size:', elevenBlob.size);
              blobToSave = elevenBlob;
            }
          } catch (error) {
            console.error('Failed to generate ElevenLabs audio:', error);
          }
        }
      }
    } else if (engine === EngineType.GEMINI) {
      // Generate audio blob for Gemini TTS
      console.log('Engine is Gemini, hasKey:', geminiTTS.hasKey);
      if (geminiTTS.hasKey) {
        try {
          console.log('Generating Gemini audio for save...');
          const geminiBlob = await geminiTTS.generateAudio(
            text,
            { voiceName: geminiVoice },
            analysis.isDialogue ? speakerMapping : undefined
          );
          if (geminiBlob) {
            console.log('Gemini audio generated successfully, size:', geminiBlob.size);
            blobToSave = geminiBlob;
          } else {
            console.warn('Gemini generateAudio returned null');
          }
        } catch (error) {
          console.error('Failed to generate Gemini TTS audio:', error);
          // Continue saving without audio - user can still save transcript
        }
      } else {
        console.warn('Gemini key not available, skipping audio generation');
      }
    }
    // Note: Browser TTS (Web Speech API) cannot capture audio - saves transcript only

    try {
      if (editingAudioId) {
        // Update existing
        const result = await audioStorage.update(editingAudioId, audioData, blobToSave);
        if (result) {
          setLastGeneratedBlob(null);
          setGeminiPlaybackSuccess(false);
          alert('Audio updated successfully!');
        } else {
          throw new Error('Update failed');
        }
      } else {
        // Create new
        const result = await audioStorage.create(audioData, blobToSave);
        if (result) {
          setLastGeneratedBlob(null);
          setGeminiPlaybackSuccess(false);
          alert('Audio saved to library!');
        } else {
          throw new Error('Create failed');
        }
      }
    } catch (error) {
      console.error('Failed to save audio', error);
      alert('Failed to save audio. Please try again.');
    }
  };

  const handleCreateNew = () => {
    setEditingAudioId(null);
    setTitle('Untitled Audio');
    setText("Narrator: Welcome to DialogueForge.\n\nJane: This tool can automatically detect different speakers in your text.\n\nJohn: That is correct. Just type a name followed by a colon, and assign us a voice!");
    setEngine(EngineType.BROWSER);
    setSpeakerMapping({});
    setLastGeneratedBlob(null);
    setGeminiPlaybackSuccess(false);
    setCurrentView('editor');
  };

  const handleEdit = (audio: SavedAudio) => {
    // For transcript-only entries, go to detail view (where they can create tests)
    if (audio.isTranscriptOnly) {
      handleViewDetail(audio);
      return;
    }
    // For audio entries, go to editor
    setEditingAudioId(audio.id);
    setTitle(audio.title);
    setText(audio.transcript);
    setEngine(audio.engine);
    setSpeakerMapping(audio.speakerMapping);
    setLastGeneratedBlob(null);
    setGeminiPlaybackSuccess(false);
    setCurrentView('editor');
  };

  const handleDelete = async (audio: SavedAudio) => {
    const success = await audioStorage.remove(audio.id);
    if (success) {
      if (currentView === 'detail') {
        setCurrentView('library');
        setSelectedAudio(null);
      }
    } else {
      alert('Failed to delete audio.');
    }
  };

  const handleViewDetail = async (audio: SavedAudio) => {
    setSelectedAudio(audio);
    // Load tests for this audio
    try {
      const response = await fetch(`${API_BASE}/audio-entries/${audio.id}/tests`);
      if (response.ok) {
        const tests = await response.json();
        setAudioTests(tests.map((t: { _id: string; audioId: string; title: string; type: string; questions: Array<{ _id?: string; questionText: string; options?: string[]; correctAnswer: string }>; lexis?: Array<{ _id?: string; term: string; definition: string; definitionArabic?: string; example?: string; partOfSpeech?: string }>; lexisAudio?: { url: string; generatedAt: string; engine: 'gemini' | 'elevenlabs' }; created_at: string; updated_at: string }) => ({
          ...t,
          id: t._id,
          questions: t.questions.map((q: { _id?: string; questionText: string; options?: string[]; correctAnswer: string }) => ({ ...q, id: q._id || Math.random().toString(36).substring(2, 11) })),
          lexis: t.lexis?.map((l: { _id?: string; term: string; definition: string; definitionArabic?: string; example?: string; partOfSpeech?: string }) => ({ ...l, id: l._id || Math.random().toString(36).substring(2, 11) })),
          lexisAudio: t.lexisAudio
        })));
      }
    } catch (error) {
      console.error('Failed to load tests:', error);
      setAudioTests([]);
    }
    setCurrentView('detail');
  };

  const handlePlayFromLibrary = (audio: SavedAudio) => {
    // For now, just open detail view to play
    // Later we can implement direct playback
    handleViewDetail(audio);
  };

  // Test handlers
  const handleCreateTest = (audio: SavedAudio) => {
    setSelectedAudio(audio);
    setEditingTest(null);
    setTestBuilderKey(prev => prev + 1); // Force TestBuilder to remount with fresh state
    setCurrentView('test-builder');
  };

  const handleEditTest = (test: ListeningTest) => {
    setEditingTest(test);
    setCurrentView('test-builder');
  };

  const handleDeleteTest = async (test: ListeningTest) => {
    try {
      const response = await fetch(`${API_BASE}/tests/${test.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete test');

      // Refresh tests list
      setAudioTests(prev => prev.filter(t => t.id !== test.id));
    } catch (error) {
      console.error('Failed to delete test:', error);
      alert('Failed to delete test. Please try again.');
    }
  };

  const handleSaveTest = async (testData: Omit<ListeningTest, 'id' | 'createdAt' | 'updatedAt'>) => {
    console.log('[App] handleSaveTest called with testData:', testData);
    console.log('[App] handleSaveTest - testData.lexis:', testData.lexis);
    try {
      let response;
      if (editingTest) {
        // Update existing test
        console.log('[App] Updating existing test:', editingTest.id);
        response = await fetch(`${API_BASE}/tests/${editingTest.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData),
        });
      } else {
        // Create new test
        console.log('[App] Creating new test');
        response = await fetch(`${API_BASE}/tests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData),
        });
      }

      const responseData = await response.json();
      console.log('[App] Server response:', responseData);
      console.log('[App] Server response lexis:', responseData.lexis);

      if (!response.ok) {
        console.error('[App] Server error:', responseData);
        throw new Error('Failed to save test');
      }

      alert(editingTest ? 'Test updated successfully!' : 'Test created successfully!');
      setEditingTest(null);

      if (selectedAudio) {
        // Go back to detail view and refresh tests
        handleViewDetail(selectedAudio);
      }
    } catch (error) {
      console.error('Failed to save test:', error);
      alert('Failed to save test. Please try again.');
    }
  };

  const handleTakeTest = (test: ListeningTest) => {
    setSelectedTest(test);
    setCurrentView('test-take');
  };

  // Transcript-only mode handlers
  const handleSaveTranscript = async (title: string, transcript: string, speakers: string[]) => {
    setIsSavingTranscript(true);
    console.log('[handleSaveTranscript] Called with:', { title, transcript: transcript.substring(0, 50), speakers });
    console.log('[handleSaveTranscript] Passing isTranscriptOnly: true');
    try {
      const result = await audioStorage.create({
        title,
        transcript,
        engine: EngineType.BROWSER,
        speakerMapping: {},
        speakers,
        isTranscriptOnly: true,
      });
      console.log('[handleSaveTranscript] Result:', result);

      if (result) {
        console.log('[handleSaveTranscript] Setting libraryTab to transcripts');
        setLibraryTab('transcripts');
        console.log('[handleSaveTranscript] Setting currentView to library');
        setCurrentView('library');
      } else {
        alert('Failed to save transcript. Please try again.');
      }
    } catch (error) {
      console.error('Failed to save transcript:', error);
      alert('Failed to save transcript. Please try again.');
    } finally {
      setIsSavingTranscript(false);
    }
  };

  const handleTestComplete = (attempt: TestAttempt) => {
    console.log('Test completed:', attempt);
    // Could save attempt to database for tracking progress
  };

  // Load all tests for classroom mode
  const loadAllTests = async () => {
    console.log('[loadAllTests] Fetching all tests...');
    try {
      const response = await fetch(`${API_BASE}/tests`);
      if (response.ok) {
        const tests = await response.json();
        console.log('[loadAllTests] Raw tests from server:', tests.map((t: any) => ({ id: t._id, title: t.title, hasLexisAudio: !!t.lexisAudio })));
        setAllTests(tests.map((t: { _id: string; audioId: string; title: string; type: string; questions: Array<{ _id?: string; questionText: string; options?: string[]; correctAnswer: string; explanation?: string }>; lexis?: Array<{ _id?: string; term: string; definition: string; definitionArabic?: string; example?: string; partOfSpeech?: string }>; lexisAudio?: { url: string; generatedAt: string; engine: 'gemini' | 'elevenlabs' }; created_at: string; updated_at: string }) => ({
          ...t,
          id: t._id,
          questions: t.questions.map((q: { _id?: string; questionText: string; options?: string[]; correctAnswer: string; explanation?: string }) => ({ ...q, id: q._id || Math.random().toString(36).substring(2, 11) })),
          lexis: t.lexis?.map((l: { _id?: string; term: string; definition: string; definitionArabic?: string; example?: string; partOfSpeech?: string }) => ({ ...l, id: l._id || Math.random().toString(36).substring(2, 11) })),
          lexisAudio: t.lexisAudio
        })));
      }
    } catch (error) {
      console.error('Failed to load all tests:', error);
    }
  };

  // Enter classroom mode
  const handleEnterClassroom = async () => {
    await loadAllTests();
    setCurrentView('classroom');
  };

  // Settings handlers
  const handleSaveSettings = async (newSettings: AppSettings) => {
    const success = await settingsHook.saveSettings(newSettings);
    if (!success) {
      alert('Failed to save settings. Please try again.');
    }
  };

  // Load test for student view
  const loadStudentTest = async (testId: string) => {
    try {
      const response = await fetch(`${API_BASE}/tests/${testId}`);
      if (response.ok) {
        const t = await response.json();
        const test: ListeningTest = {
          ...t,
          id: t._id,
          questions: t.questions.map((q: { _id?: string; questionText: string; options?: string[]; correctAnswer: string; explanation?: string }) => ({
            ...q,
            id: q._id || Math.random().toString(36).substring(2, 11)
          }))
        };
        setStudentTest(test);
        setCurrentView('student-test');
      }
    } catch (error) {
      console.error('Failed to load student test:', error);
    }
  };

  // Check URL for student test parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const testId = params.get('student-test');
    if (testId) {
      setStudentTestId(testId);
      loadStudentTest(testId);
    }
  }, []);

  // Preview student view
  const handlePreviewStudentView = (test: ListeningTest) => {
    setStudentTest(test);
    setIsPreviewMode(true);
    setCurrentView('student-test');
  };

  // Exit preview
  const handleExitPreview = () => {
    setIsPreviewMode(false);
    setCurrentView('classroom');
  };

  // Navigation header
  const renderNav = () => (
    <nav className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 shadow-sm shadow-slate-200/50 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setCurrentView('editor')}>
          <div className="h-10 w-10 rounded-xl overflow-hidden shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 group-hover:scale-105 transition-all duration-200">
            <img
              src="/logo-512.png"
              alt="DialogueForge"
              className="h-full w-full scale-150"
            />
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">DialogueForge</span>
        </div>
        <div className="flex items-center gap-2">
          {currentView === 'editor' && analysis.isDialogue && (
            <span className="px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100/80 shadow-sm">
              {analysis.speakers.length} Speakers
            </span>
          )}
          <button
            onClick={handleEnterClassroom}
            onMouseEnter={preloadClassroom}
            onTouchStart={preloadClassroom}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-sm"
            title="Enter Classroom Mode"
          >
            <PresentationIcon className="w-4 h-4" />
            <span className="text-sm">Classroom</span>
          </button>
          <button
            onClick={() => setCurrentView('transcript')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
              currentView === 'editor'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-500 hover:to-violet-500'
                : 'bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-300'
            }`}
            title="Text-only mode - create tests without storing audio"
          >
            <FileTextIcon className="w-4 h-4" />
            <span className="text-sm">Text Only</span>
          </button>
          {currentView === 'editor' || currentView === 'library' || currentView === 'detail' ? (
            <button
              onClick={() => {
                // When in detail view, go back to the correct tab based on entry type
                if (currentView === 'detail' && selectedAudio) {
                  console.log('[Nav My Library] From detail view, selectedAudio.isTranscriptOnly:', selectedAudio.isTranscriptOnly);
                  setLibraryTab(selectedAudio.isTranscriptOnly ? 'transcripts' : 'audio');
                } else {
                  // From editor or library view, default to audio tab
                  setLibraryTab('audio');
                }
                setSelectedAudio(null);
                setAudioTests([]);
                setCurrentView('library');
              }}
              onMouseEnter={preloadLibrary}
              onTouchStart={preloadLibrary}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                currentView === 'library'
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  : 'text-indigo-900 hover:text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              <FolderIcon className="w-4 h-4" />
              <span className="text-sm font-medium">My Library</span>
            </button>
          ) : (
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:from-indigo-500 hover:to-violet-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-indigo-500/30"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="text-sm">New Audio</span>
            </button>
          )}
          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );

  // Editor view
  const renderEditor = () => (
    <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
      <div className="lg:col-span-7 flex flex-col order-2 lg:order-1">
        <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200/60 p-6 flex flex-col">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter title..."
            className="text-xl font-bold text-slate-900 bg-transparent border-0 border-b-2 border-slate-200 pb-3 mb-4 focus:outline-none focus:border-indigo-500 transition-all duration-200 placeholder:text-slate-400"
            autoComplete="off"
          />
          <textarea
            className="w-full min-h-[450px] resize-none text-lg leading-8 text-slate-700 bg-transparent border-0 focus:ring-0 p-0 font-medium placeholder:text-slate-400"
            placeholder="Type or paste your script..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      </div>

      <div className="lg:col-span-5 order-1 lg:order-2 space-y-6">
        <div className="sticky top-24 space-y-6">
          <div className={`bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden transition-all duration-300 ${isPlaying ? 'shadow-indigo-500/20 ring-1 ring-indigo-500/30' : ''}`}>
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-violet-500/5 pointer-events-none" />
            <div className="relative h-24 flex items-center justify-center">
              {isLoading ? (
                <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Suspense fallback={<VisualizerFallback />}>
                  <Visualizer isPlaying={isPlaying} />
                </Suspense>
              )}
            </div>
            {/* Quota exceeded warning */}
            {engine === EngineType.GEMINI && geminiTTS.quotaExceeded && (
              <div className="relative mb-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl backdrop-blur-sm">
                <p className="text-xs text-amber-300 text-center font-medium">Gemini quota exceeded. Try again later or use a different engine.</p>
              </div>
            )}
            <div className="relative mt-4 flex items-center gap-3">
              <button
                onClick={handlePlay}
                disabled={isLoading || !text || (engine === EngineType.GEMINI && geminiTTS.quotaExceeded)}
                className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-500 hover:to-violet-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-indigo-500/30"
                title={engine === EngineType.GEMINI && geminiTTS.quotaExceeded ? 'Gemini quota exceeded' : ''}
              >
                <PlayIcon className="w-5 h-5 mx-auto" />
              </button>
              <button
                onClick={handleStop}
                className="p-3.5 bg-slate-800/80 text-slate-300 rounded-xl hover:bg-slate-700 hover:text-white hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border border-slate-700/50"
              >
                <StopIcon className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={handleSaveClick}
              disabled={!text.trim() || (engine === EngineType.GEMINI && geminiTTS.quotaExceeded) || isLoading}
              className="relative w-full mt-3 py-3 bg-gradient-to-r from-slate-800 to-slate-700 text-slate-200 rounded-xl font-medium hover:from-slate-700 hover:to-slate-600 hover:text-white hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 border border-slate-600/30"
              title={engine === EngineType.GEMINI && geminiTTS.quotaExceeded ? 'Gemini quota exceeded' : 'Generates audio and saves to library'}
            >
              <SaveIcon className="w-4 h-4" />
              <span>{editingAudioId ? 'Update' : 'Quick Save'}</span>
              {engine === EngineType.ELEVEN_LABS && lastGeneratedBlob && (
                <span className="ml-1 w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-sm shadow-emerald-400/50" title="Audio cached - faster save" />
              )}
              {engine === EngineType.GEMINI && geminiPlaybackSuccess && (
                <span className="ml-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse shadow-sm shadow-blue-400/50" title="Audio verified" />
              )}
            </button>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-300 p-6 space-y-6">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">Engine</label>
              <div className="bg-slate-100/80 p-1.5 rounded-xl flex gap-1">
                {[EngineType.BROWSER, EngineType.GEMINI, EngineType.ELEVEN_LABS].map(type => (
                  <button
                    key={type}
                    onClick={() => { handleStop(); setEngine(type); }}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-200 ${engine === type ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {engine === EngineType.ELEVEN_LABS && (
              <div className="space-y-4">
                {!elevenTTS.hasEnvKey && (
                  <input
                    type="password"
                    placeholder="ElevenLabs API Key"
                    className="w-full bg-slate-50/80 border border-slate-200 text-sm rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all duration-200"
                    value={elevenLabsKey}
                    onChange={(e) => setElevenLabsKey(e.target.value)}
                    onBlur={() => elevenTTS.fetchVoices(elevenLabsKey)}
                    autoComplete="off"
                    data-form-type="other"
                  />
                )}
                {elevenTTS.voices.length > 0 && (
                  <p className="text-xs text-indigo-600 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                    {elevenTTS.voices.length} voices loaded
                  </p>
                )}
                {elevenTTS.hasEnvKey && elevenTTS.voices.length === 0 && (
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                    Loading voices...
                  </p>
                )}
              </div>
            )}

            {/* EFL Prompt Builder Button - only for Gemini and ElevenLabs */}
            {(engine === EngineType.GEMINI || engine === EngineType.ELEVEN_LABS) && (
              <button
                onClick={() => setShowPromptBuilder(true)}
                className="w-full py-3 bg-gradient-to-r from-violet-50 to-indigo-50 text-indigo-700 rounded-xl font-medium hover:from-violet-100 hover:to-indigo-100 transition-all duration-200 flex items-center justify-center gap-2 border border-indigo-200/60"
              >
                <SparklesIcon className="w-4 h-4" />
                <span>EFL Prompt Builder</span>
              </button>
            )}

            {analysis.isDialogue && (
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cast Characters</label>
                  <button
                    onClick={() => setSpeakerMapping(performSmartCast(analysis.speakers, {}, true))}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-md transition-all duration-200"
                  >
                    ✨ Magic Cast
                  </button>
                </div>
                <div className="space-y-2">
                  {analysis.speakers.map((speaker) => (
                    <div key={speaker} className="flex items-center gap-3 p-2.5 bg-gradient-to-r from-slate-50 to-slate-50/50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors duration-200">
                      <span className="text-xs font-bold text-slate-700 w-20 truncate">{speaker}</span>
                      <select
                        className="flex-1 text-xs p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all duration-200 cursor-pointer"
                        value={speakerMapping[speaker] || ''}
                        onChange={(e) => setSpeakerMapping(prev => ({ ...prev, [speaker]: e.target.value }))}
                      >
                        {engine === EngineType.BROWSER && browserTTS.voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                        {engine === EngineType.GEMINI && GEMINI_VOICES.map(v => <option key={v.name} value={v.name}>{v.name} [{v.gender === 'Female' ? 'F' : 'M'}] - {v.style}</option>)}
                        {engine === EngineType.ELEVEN_LABS && sortedElevenVoices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name} [{v.labels?.gender === 'female' ? 'F' : v.labels?.gender === 'male' ? 'M' : '?'}] - {v.labels?.accent || 'Unknown'}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {editingAudioId && (
            <button
              onClick={handleCreateNew}
              className="w-full py-2.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Cancel editing and create new
            </button>
          )}
        </div>
      </div>
    </main>
  );

  // Library view
  const renderLibrary = () => {
    console.log('[renderLibrary] libraryTab =', libraryTab);
    return (
    <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <Suspense fallback={<InlineSpinner />}>
        <AudioLibrary
          key={libraryTab}
          savedAudios={audioStorage.savedAudios}
          isLoading={audioStorage.isLoading}
          initialTab={libraryTab}
          onPlay={handlePlayFromLibrary}
          onDelete={handleDelete}
          onCreateNew={handleCreateNew}
          onViewDetail={handleViewDetail}
        />
      </Suspense>
    </main>
  );};

  // Detail view
  const renderDetail = () => {
    if (!selectedAudio) {
      setCurrentView('library');
      return null;
    }

    return (
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <Suspense fallback={<InlineSpinner />}>
          <AudioDetail
            audio={selectedAudio}
            tests={audioTests}
            onBack={() => {
              // Go back to the correct tab based on entry type
              console.log('[AudioDetail onBack] selectedAudio:', selectedAudio?.id, 'isTranscriptOnly:', selectedAudio?.isTranscriptOnly);
              const targetTab = selectedAudio?.isTranscriptOnly ? 'transcripts' : 'audio';
              console.log('[AudioDetail onBack] Setting libraryTab to:', targetTab);
              setLibraryTab(targetTab);
              setSelectedAudio(null);
              setAudioTests([]);
              setCurrentView('library');
            }}
            onDelete={handleDelete}
            onCreateTest={handleCreateTest}
            onEditTest={handleEditTest}
            onDeleteTest={handleDeleteTest}
            onTakeTest={handleTakeTest}
          />
        </Suspense>
      </main>
    );
  };

  // Test builder view
  const renderTestBuilder = () => {
    if (!selectedAudio) {
      setCurrentView('library');
      return null;
    }

    return (
      <Suspense fallback={<LoadingSpinner />}>
        <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <TestBuilder
            key={editingTest?.id || `new-${testBuilderKey}`}
            audio={selectedAudio}
            existingTest={editingTest || undefined}
            defaultDifficulty={settingsHook.settings.difficultyLevel}
            onSave={handleSaveTest}
            onCancel={() => {
              setEditingTest(null);
              handleViewDetail(selectedAudio);
            }}
          />
        </main>
      </Suspense>
    );
  };

  // Test taker view
  const renderTestTaker = () => {
    if (!selectedTest || !selectedAudio) {
      setCurrentView('library');
      return null;
    }

    return (
      <Suspense fallback={<LoadingSpinner />}>
        <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <TestTaker
            test={selectedTest}
            audio={selectedAudio}
            onComplete={handleTestComplete}
            onBack={() => {
              setSelectedTest(null);
              handleViewDetail(selectedAudio);
            }}
          />
        </main>
      </Suspense>
    );
  };

  // Student test view (accessed via URL or preview)
  if (currentView === 'student-test' && studentTest) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <StudentTest
          test={studentTest}
          theme={settingsHook.settings.classroomTheme}
          isPreview={isPreviewMode}
          onExitPreview={handleExitPreview}
        />
      </Suspense>
    );
  }

  // Classroom mode (full screen, no nav)
  if (currentView === 'classroom') {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <ClassroomMode
          tests={allTests}
          audioEntries={audioStorage.savedAudios}
          theme={settingsHook.settings.classroomTheme}
          onExit={() => setCurrentView('library')}
          onPreviewStudent={handlePreviewStudentView}
          onEditTest={(test) => {
            setEditingTest(test);
            setCurrentView('test-builder');
          }}
          onDeleteTest={async (test) => {
            try {
              const response = await fetch(`${API_BASE}/tests/${test.id}`, {
                method: 'DELETE',
              });
              if (!response.ok) throw new Error('Failed to delete test');
              // Update both local state lists
              setAllTests(prev => prev.filter(t => t.id !== test.id));
              setAudioTests(prev => prev.filter(t => t.id !== test.id));
            } catch (error) {
              console.error('Failed to delete test:', error);
              alert('Failed to delete test. Please try again.');
            }
          }}
          onUpdateTest={async (test) => {
            console.log('[onUpdateTest] Called with test:', test.id);
            console.log('[onUpdateTest] test.lexisAudio:', test.lexisAudio);
            try {
              const response = await fetch(`${API_BASE}/tests/${test.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(test),
              });
              if (!response.ok) throw new Error('Failed to update test');
              const updatedTest = await response.json();
              console.log('[onUpdateTest] Server response:', updatedTest);
              console.log('[onUpdateTest] Server response lexisAudio:', updatedTest.lexisAudio);
              // Update both local state lists
              setAllTests(prev => prev.map(t => t.id === test.id ? updatedTest : t));
              setAudioTests(prev => prev.map(t => t.id === test.id ? updatedTest : t));
            } catch (error) {
              console.error('Failed to update test:', error);
            }
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen text-slate-900 selection:bg-indigo-500/20">
      {renderNav()}
      {currentView === 'editor' && renderEditor()}
      {currentView === 'library' && renderLibrary()}
      {currentView === 'detail' && renderDetail()}
      {currentView === 'test-builder' && renderTestBuilder()}
      {currentView === 'test-take' && renderTestTaker()}
      {currentView === 'transcript' && (
        <Suspense fallback={<InlineSpinner />}>
          <TranscriptMode
            onSave={handleSaveTranscript}
            onBack={() => setCurrentView('editor')}
            isSaving={isSavingTranscript}
          />
        </Suspense>
      )}

      <SaveDialog
        isOpen={showSaveDialog}
        transcript={text}
        initialTitle={title}
        onSave={handleSaveWithTitle}
        onCancel={() => setShowSaveDialog(false)}
      />

      <PromptBuilder
        isOpen={showPromptBuilder}
        engine={engine}
        elevenLabsVoices={elevenTTS.voices}
        defaultDifficulty={settingsHook.settings.difficultyLevel}
        contentMode={settingsHook.settings.contentMode}
        onClose={() => setShowPromptBuilder(false)}
        onApplyPrompt={(prompt, voiceAssignments) => {
          // For now, just copy the prompt to clipboard
          // In the future, this could be extended to apply voice assignments
          console.log('Prompt generated:', prompt);
          console.log('Voice assignments:', voiceAssignments);
        }}
      />

      <Settings
        isOpen={showSettings}
        settings={settingsHook.settings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
};

export default App;
