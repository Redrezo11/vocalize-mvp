import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useBrowserTTS } from './hooks/useBrowserTTS';
import { useGeminiTTS } from './hooks/useGeminiTTS';
import { useElevenLabsTTS } from './hooks/useElevenLabsTTS';
import { useMongoStorage } from './hooks/useMongoStorage';
import { parseDialogue, guessGender } from './utils/parser';
import { BrowserVoiceConfig, EngineType, GEMINI_VOICES, SpeakerVoiceMapping, AppView, SavedAudio, ListeningTest, TestAttempt } from './types';
import { PlayIcon, StopIcon, Volume2Icon, FolderIcon, PlusIcon, SaveIcon, ArrowLeftIcon, PresentationIcon } from './components/Icons';
import { SaveDialog } from './components/SaveDialog';

// Lazy load components for better initial load
const Visualizer = lazy(() => import('./components/Visualizer'));
const AudioLibrary = lazy(() => import('./components/AudioLibrary').then(m => ({ default: m.AudioLibrary })));
const AudioDetail = lazy(() => import('./components/AudioDetail').then(m => ({ default: m.AudioDetail })));
const TestBuilder = lazy(() => import('./components/TestBuilder').then(m => ({ default: m.TestBuilder })));
const TestTaker = lazy(() => import('./components/TestTaker').then(m => ({ default: m.TestTaker })));
const ClassroomMode = lazy(() => import('./components/ClassroomMode').then(m => ({ default: m.ClassroomMode })));
const StudentTest = lazy(() => import('./components/StudentTest').then(m => ({ default: m.StudentTest })));

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
  const [selectedAudio, setSelectedAudio] = useState<SavedAudio | null>(null);
  const [editingAudioId, setEditingAudioId] = useState<string | null>(null);

  // Test state
  const [audioTests, setAudioTests] = useState<ListeningTest[]>([]);
  const [allTests, setAllTests] = useState<ListeningTest[]>([]);
  const [selectedTest, setSelectedTest] = useState<ListeningTest | null>(null);
  const [editingTest, setEditingTest] = useState<ListeningTest | null>(null);
  const [studentTestId, setStudentTestId] = useState<string | null>(null);
  const [studentTest, setStudentTest] = useState<ListeningTest | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Editor state
  const [title, setTitle] = useState("Untitled Audio");
  const [text, setText] = useState("Narrator: Welcome to Vocalize.\n\nJane: This tool can automatically detect different speakers in your text.\n\nJohn: That is correct. Just type a name followed by a colon, and assign us a voice!");
  const [engine, setEngine] = useState<EngineType>(EngineType.BROWSER);
  const [elevenLabsKey, setElevenLabsKey] = useState("");
  const [lastGeneratedBlob, setLastGeneratedBlob] = useState<Blob | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Analysis State
  const analysis = useMemo(() => parseDialogue(text), [text]);
  const [speakerMapping, setSpeakerMapping] = useState<SpeakerVoiceMapping>({});

  // Config States
  const [browserConfig, setBrowserConfig] = useState<BrowserVoiceConfig>({ voice: null, rate: 1, pitch: 1, volume: 1 });
  const [geminiVoice, setGeminiVoice] = useState(GEMINI_VOICES[0].name);
  const [elevenVoiceId, setElevenVoiceId] = useState("");

  // Hooks
  const browserTTS = useBrowserTTS();
  const geminiTTS = useGeminiTTS();
  const elevenTTS = useElevenLabsTTS();
  const audioStorage = useMongoStorage();

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

  // Reset speaker mapping when engine changes
  useEffect(() => {
    setSpeakerMapping({});
  }, [engine]);

  // Auto-cast speakers when speakers change or voices become available
  useEffect(() => {
    const hasVoices =
      (engine === EngineType.BROWSER && browserTTS.voices.length > 0) ||
      (engine === EngineType.GEMINI) ||
      (engine === EngineType.ELEVEN_LABS && elevenTTS.voices.length > 0);

    if (hasVoices && analysis.speakers.length > 0) {
      setSpeakerMapping(prev => {
        // Only auto-cast if mapping is empty or has stale entries
        const hasValidMapping = analysis.speakers.every(s => prev[s]);
        if (hasValidMapping) return prev;
        return performSmartCast(analysis.speakers, {}, true);
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

    // Use the last generated blob if available (for ElevenLabs)
    const blobToSave = engine === EngineType.ELEVEN_LABS ? lastGeneratedBlob : undefined;

    try {
      if (editingAudioId) {
        // Update existing
        const result = await audioStorage.update(editingAudioId, audioData, blobToSave || undefined);
        if (result) {
          setLastGeneratedBlob(null);
          alert('Audio updated successfully!');
        } else {
          throw new Error('Update failed');
        }
      } else {
        // Create new
        const result = await audioStorage.create(audioData, blobToSave || undefined);
        if (result) {
          setLastGeneratedBlob(null);
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
    setText("Narrator: Welcome to Vocalize.\n\nJane: This tool can automatically detect different speakers in your text.\n\nJohn: That is correct. Just type a name followed by a colon, and assign us a voice!");
    setEngine(EngineType.BROWSER);
    setSpeakerMapping({});
    setLastGeneratedBlob(null);
    setCurrentView('editor');
  };

  const handleEdit = (audio: SavedAudio) => {
    setEditingAudioId(audio.id);
    setTitle(audio.title);
    setText(audio.transcript);
    setEngine(audio.engine);
    setSpeakerMapping(audio.speakerMapping);
    setLastGeneratedBlob(null);
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
        setAudioTests(tests.map((t: { _id: string; audioId: string; title: string; type: string; questions: Array<{ _id?: string; questionText: string; options?: string[]; correctAnswer: string }>; created_at: string; updated_at: string }) => ({
          ...t,
          id: t._id,
          questions: t.questions.map((q: { _id?: string; questionText: string; options?: string[]; correctAnswer: string }) => ({ ...q, id: q._id || Math.random().toString(36).substring(2, 11) }))
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
    try {
      let response;
      if (editingTest) {
        // Update existing test
        response = await fetch(`${API_BASE}/tests/${editingTest.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData),
        });
      } else {
        // Create new test
        response = await fetch(`${API_BASE}/tests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData),
        });
      }

      if (!response.ok) throw new Error('Failed to save test');

      alert(editingTest ? 'Test updated successfully!' : 'Test created successfully!');
      setEditingTest(null);

      // Go back to detail view and refresh tests
      if (selectedAudio) {
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

  const handleTestComplete = (attempt: TestAttempt) => {
    console.log('Test completed:', attempt);
    // Could save attempt to database for tracking progress
  };

  // Load all tests for classroom mode
  const loadAllTests = async () => {
    try {
      const response = await fetch(`${API_BASE}/tests`);
      if (response.ok) {
        const tests = await response.json();
        setAllTests(tests.map((t: { _id: string; audioId: string; title: string; type: string; questions: Array<{ _id?: string; questionText: string; options?: string[]; correctAnswer: string; explanation?: string }>; created_at: string; updated_at: string }) => ({
          ...t,
          id: t._id,
          questions: t.questions.map((q: { _id?: string; questionText: string; options?: string[]; correctAnswer: string; explanation?: string }) => ({ ...q, id: q._id || Math.random().toString(36).substring(2, 11) }))
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
    <nav className="sticky top-0 z-30 bg-[#FAFAFA]/80 backdrop-blur-md border-b border-slate-200/60 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-200">
            <Volume2Icon className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">Vocalize</span>
        </div>
        <div className="flex items-center gap-3">
          {currentView === 'editor' && analysis.isDialogue && (
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100 uppercase">
              {analysis.speakers.length} Speakers Detected
            </span>
          )}
          <button
            onClick={handleEnterClassroom}
            onMouseEnter={preloadClassroom}
            onTouchStart={preloadClassroom}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors"
            title="Enter Classroom Mode"
          >
            <PresentationIcon className="w-4 h-4" />
            <span className="text-sm">Classroom</span>
          </button>
          {currentView === 'editor' ? (
            <button
              onClick={() => setCurrentView('library')}
              onMouseEnter={preloadLibrary}
              onTouchStart={preloadLibrary}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <FolderIcon className="w-4 h-4" />
              <span className="text-sm font-medium">My Library</span>
            </button>
          ) : (
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="text-sm">New Audio</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );

  // Editor view
  const renderEditor = () => (
    <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
      <div className="lg:col-span-7 flex flex-col order-2 lg:order-1">
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 flex flex-col">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter title..."
            className="text-xl font-bold text-slate-900 bg-transparent border-0 border-b border-slate-200 pb-3 mb-4 focus:outline-none focus:border-indigo-500 transition-colors"
            autoComplete="off"
          />
          <textarea
            className="w-full min-h-[450px] resize-none text-lg leading-8 text-slate-700 bg-transparent border-0 focus:ring-0 p-0 font-medium"
            placeholder="Type or paste your script..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      </div>

      <div className="lg:col-span-5 order-1 lg:order-2 space-y-6">
        <div className="sticky top-28 space-y-6">
          <div className="bg-slate-900 rounded-2xl p-6 shadow-xl relative group">
            <div className="h-24 flex items-center justify-center">
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Suspense fallback={<VisualizerFallback />}>
                  <Visualizer isPlaying={isPlaying} />
                </Suspense>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={handlePlay} disabled={isLoading || !text} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all disabled:opacity-50">
                <PlayIcon className="w-5 h-5 mx-auto" />
              </button>
              <button onClick={handleStop} className="p-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700">
                <StopIcon className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={handleSaveClick}
              disabled={!text.trim() || (engine === EngineType.ELEVEN_LABS && !lastGeneratedBlob)}
              className="w-full mt-3 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              title={engine === EngineType.ELEVEN_LABS && !lastGeneratedBlob ? 'Generate audio first by clicking Play' : ''}
            >
              <SaveIcon className="w-4 h-4" />
              <span>{editingAudioId ? 'Update' : 'Save to Library'}</span>
              {lastGeneratedBlob && (
                <span className="ml-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Audio ready to save" />
              )}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-6">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Engine</label>
              <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                {[EngineType.BROWSER, EngineType.GEMINI, EngineType.ELEVEN_LABS].map(type => (
                  <button
                    key={type}
                    onClick={() => { handleStop(); setEngine(type); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${engine === type ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {engine === EngineType.ELEVEN_LABS && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {!elevenTTS.hasEnvKey && (
                  <input
                    type="password"
                    placeholder="ElevenLabs API Key"
                    className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={elevenLabsKey}
                    onChange={(e) => setElevenLabsKey(e.target.value)}
                    onBlur={() => elevenTTS.fetchVoices(elevenLabsKey)}
                    autoComplete="off"
                    data-form-type="other"
                  />
                )}
                {elevenTTS.voices.length > 0 && (
                  <p className="text-xs text-green-600 font-medium">{elevenTTS.voices.length} voices loaded</p>
                )}
                {elevenTTS.hasEnvKey && elevenTTS.voices.length === 0 && (
                  <p className="text-xs text-slate-500">Loading voices...</p>
                )}
              </div>
            )}

            {analysis.isDialogue && (
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-xs font-bold text-slate-400 uppercase">Cast Characters</label>
                  <button onClick={() => setSpeakerMapping(performSmartCast(analysis.speakers, {}, true))} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Magic Cast</button>
                </div>
                <div className="space-y-3">
                  {analysis.speakers.map((speaker) => (
                    <div key={speaker} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-xs font-bold text-slate-700 w-16 truncate">{speaker}</span>
                      <select
                        className="flex-1 text-xs p-1.5 bg-white border border-slate-200 rounded-md"
                        value={speakerMapping[speaker] || ''}
                        onChange={(e) => setSpeakerMapping(prev => ({ ...prev, [speaker]: e.target.value }))}
                      >
                        {engine === EngineType.BROWSER && browserTTS.voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                        {engine === EngineType.GEMINI && GEMINI_VOICES.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                        {engine === EngineType.ELEVEN_LABS && elevenTTS.voices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
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
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
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
  const renderLibrary = () => (
    <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <Suspense fallback={<InlineSpinner />}>
        <AudioLibrary
          savedAudios={audioStorage.savedAudios}
          isLoading={audioStorage.isLoading}
          onPlay={handlePlayFromLibrary}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCreateNew={handleCreateNew}
          onViewDetail={handleViewDetail}
        />
      </Suspense>
    </main>
  );

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
              setSelectedAudio(null);
              setAudioTests([]);
              setCurrentView('library');
            }}
            onEdit={handleEdit}
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
            audio={selectedAudio}
            existingTest={editingTest || undefined}
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
          onExit={() => setCurrentView('library')}
          onPreviewStudent={handlePreviewStudentView}
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

      <SaveDialog
        isOpen={showSaveDialog}
        transcript={text}
        initialTitle={title}
        onSave={handleSaveWithTitle}
        onCancel={() => setShowSaveDialog(false)}
      />
    </div>
  );
};

export default App;
