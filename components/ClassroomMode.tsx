import React, { useState, useRef, useEffect } from 'react';
import { SavedAudio, ListeningTest, LexisAudio } from '../types';
import { ArrowLeftIcon, PlayIcon, PauseIcon, RefreshIcon, ChevronRightIcon } from './Icons';
import { ClassroomTheme } from './Settings';
import QRCode from 'qrcode';
import { generateLexisAudio, LexisTTSEngine } from '../utils/lexisTTS';

interface ClassroomModeProps {
  tests: ListeningTest[];
  audioEntries: SavedAudio[];
  theme?: ClassroomTheme;
  onExit: () => void;
  onPreviewStudent: (test: ListeningTest) => void;
  onEditTest?: (test: ListeningTest) => void;
  onDeleteTest?: (test: ListeningTest) => void;
  onUpdateTest?: (test: ListeningTest) => void;  // To save lexisAudio
}

type ClassroomView = 'select' | 'present';

export const ClassroomMode: React.FC<ClassroomModeProps> = ({ tests, audioEntries, theme = 'light', onExit, onPreviewStudent, onEditTest, onDeleteTest, onUpdateTest }) => {
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
  const [lexisViewMode, setLexisViewMode] = useState<'overview' | 'focus'>('overview');
  const [focusedLexisIndex, setFocusedLexisIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Lexis audio state
  const [showLexisAudioConfirm, setShowLexisAudioConfirm] = useState(false);
  const [isGeneratingLexisAudio, setIsGeneratingLexisAudio] = useState(false);
  const [lexisAudioError, setLexisAudioError] = useState<string | null>(null);
  const [isPlayingLexisAudio, setIsPlayingLexisAudio] = useState(false);
  const [lexisTTSEngine, setLexisTTSEngine] = useState<LexisTTSEngine>('gemini');
  const lexisAudioRef = useRef<HTMLAudioElement>(null);

  const SPEED_OPTIONS = [0.5, 0.75, 1] as const;

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

        // Save to database
        if (onUpdateTest) {
          onUpdateTest(updatedTest);
        }

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

  // Generate QR code for student access
  const generateQRCode = async (test: ListeningTest) => {
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?student-test=${test.id}`;
    setStudentUrl(url);

    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 300,
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

  // Start presenting a test
  const handleStartPresentation = (test: ListeningTest) => {
    const audio = getAudioForTest(test);
    if (audio) {
      setSelectedTest(test);
      setSelectedAudio(audio);
      setPlayCount(0);
      setView('present');
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
      if (view !== 'present' || showQRModal) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'r':
        case 'R':
          handleRestart();
          break;
        case 'q':
        case 'Q':
          if (selectedTest) generateQRCode(selectedTest);
          break;
        case 'v':
        case 'V':
          setLexisViewMode(prev => prev === 'overview' ? 'focus' : 'overview');
          setFocusedLexisIndex(0);
          break;
        case 'ArrowLeft':
          if (lexisViewMode === 'focus' && selectedTest?.lexis) {
            e.preventDefault();
            setFocusedLexisIndex(prev => prev > 0 ? prev - 1 : selectedTest.lexis!.length - 1);
          }
          break;
        case 'ArrowRight':
          if (lexisViewMode === 'focus' && selectedTest?.lexis) {
            e.preventDefault();
            setFocusedLexisIndex(prev => prev < selectedTest.lexis!.length - 1 ? prev + 1 : 0);
          }
          break;
        case 'Escape':
          setView('select');
          setSelectedTest(null);
          setSelectedAudio(null);
          if (audioRef.current) {
            audioRef.current.pause();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, isPlaying, showQRModal, selectedTest, lexisViewMode]);

  // Get test type label
  const getTestTypeLabel = (type: string): string => {
    switch (type) {
      case 'listening-comprehension': return 'Comprehension';
      case 'fill-in-blank': return 'Fill in Blank';
      case 'dictation': return 'Dictation';
      default: return type;
    }
  };

  // Get badge color
  const getTestTypeBadge = (type: string): string => {
    switch (type) {
      case 'listening-comprehension': return 'bg-blue-500 text-white';
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

  const handleConfirmDelete = () => {
    if (testToDelete && onDeleteTest) {
      onDeleteTest(testToDelete);
    }
    setShowDeleteConfirm(false);
    setTestToDelete(null);
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
      {tests.length === 0 ? (
        <div className="text-center py-24">
          <p className={`text-2xl mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No tests available</p>
          <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>Create tests from your audio library first</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          <h2 className={`text-xl mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Select a test to present:</h2>
          <div className="space-y-4">
            {tests.map(test => {
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
                        <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Audio: {audio.title}</p>
                      )}
                      {!audio && (
                        <p className="text-red-400 text-sm">Audio not found</p>
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
                          disabled={!audio}
                          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                          <span className="text-sm">Present</span>
                          <ChevronRightIcon className="w-4 h-4" />
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
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                Delete Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render presentation view - Traditional test format
  const renderPresentView = () => {
    if (!selectedTest || !selectedAudio) return null;

    return (
      <div className={`min-h-screen ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
        {/* Top Bar - Fixed */}
        <div className={`sticky top-0 z-10 shadow-lg ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-900 text-white'}`}>
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  setView('select');
                  setSelectedTest(null);
                  setSelectedAudio(null);
                  if (audioRef.current) {
                    audioRef.current.pause();
                  }
                }}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span>Back to Tests</span>
              </button>

              <div className="text-center">
                <h1 className="text-xl font-bold">{selectedTest.title}</h1>
                <p className="text-slate-400 text-sm">{selectedAudio.title}</p>
              </div>

              <div className="flex items-center gap-3">
                {/* Preview Button */}
                <button
                  onClick={() => onPreviewStudent(selectedTest)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                  title="Preview student view"
                >
                  <EyeIcon className="w-4 h-4" />
                  <span className="text-sm">Preview</span>
                </button>

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
                  selectedTest.lexisAudio ? (
                    <button
                      onClick={handlePlayLexisAudio}
                      className={`flex items-center gap-2 h-[34px] px-3 rounded-lg transition-colors ${
                        isPlayingLexisAudio
                          ? 'bg-green-600 text-white hover:bg-green-500'
                          : 'bg-emerald-600 text-white hover:bg-emerald-500'
                      }`}
                      title={isPlayingLexisAudio ? "Pause vocabulary audio" : "Play vocabulary audio"}
                    >
                      {isPlayingLexisAudio ? (
                        <PauseIcon className="w-4 h-4" />
                      ) : (
                        <SpeakerIcon className="w-4 h-4" />
                      )}
                      <span className="text-sm">Vocab</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowLexisAudioConfirm(true)}
                      disabled={isGeneratingLexisAudio}
                      className="flex items-center gap-2 h-[34px] px-3 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Generate vocabulary audio"
                    >
                      {isGeneratingLexisAudio ? (
                        <SpinnerIcon className="w-4 h-4" />
                      ) : (
                        <SpeakerIcon className="w-4 h-4" />
                      )}
                      <span className="text-sm">{isGeneratingLexisAudio ? 'Generating' : 'Vocab'}</span>
                    </button>
                  )
                )}

                {/* Play Counter */}
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
              </div>
            </div>

            {/* Audio Player */}
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

              {selectedAudio.audioUrl && (
                <audio
                  ref={audioRef}
                  src={selectedAudio.audioUrl}
                  preload="metadata"
                  className="hidden"
                />
              )}
            </div>
          </div>
        </div>

        {/* Vocabulary / Lexis Section */}
        {(!selectedTest.lexis || selectedTest.lexis.length === 0) ? (
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className={`text-center py-12 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <p className="text-lg">No vocabulary items for this test</p>
              <p className="text-sm mt-2">Add vocabulary in the test builder</p>
            </div>
          </div>
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

            <div className={`flex-1 max-w-4xl mx-8 p-12 rounded-3xl border-2 text-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
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
                <p className={`text-5xl leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`} dir="rtl">
                  {selectedTest.lexis[focusedLexisIndex].definitionArabic}
                </p>
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
        )}

        {/* Keyboard Hints - Fixed Bottom */}
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 backdrop-blur px-6 py-3 rounded-full text-sm ${isDark ? 'bg-slate-800/90 text-white' : 'bg-slate-900/90 text-white'}`}>
          <span><kbd className={`px-2 py-1 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-700'}`}>Space</kbd> Play/Pause</span>
          <span><kbd className={`px-2 py-1 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-700'}`}>R</kbd> Restart</span>
          <span><kbd className={`px-2 py-1 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-700'}`}>V</kbd> {lexisViewMode === 'overview' ? 'Focus' : 'Overview'}</span>
          {lexisViewMode === 'focus' && <span><kbd className={`px-2 py-1 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-700'}`}>←→</kbd> Navigate</span>}
          <span><kbd className={`px-2 py-1 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-700'}`}>Esc</kbd> Exit</span>
        </div>

        {/* QR Code Modal */}
        {showQRModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Student Access</h2>
              <p className="text-slate-500 mb-6">Scan the QR code or share the link to access the test</p>

              {qrCodeUrl && (
                <div className="bg-slate-50 p-6 rounded-2xl mb-6 inline-block">
                  <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64 mx-auto" />
                </div>
              )}

              <div className="bg-slate-100 rounded-xl p-4 mb-6">
                <p className="text-xs text-slate-500 mb-2">Student URL:</p>
                <p className="text-sm font-mono text-slate-700 break-all">{studentUrl}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={copyUrlToClipboard}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                >
                  Copy Link
                </button>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300 transition-colors"
                >
                  Close
                </button>
              </div>
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
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Generate Vocabulary Audio</h2>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>TTS for {selectedTest?.lexis?.length || 0} vocabulary items</p>
                </div>
              </div>

              <p className={`mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                This will generate audio teaching the vocabulary words to students. The audio will include:
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

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowLexisAudioConfirm(false); setLexisAudioError(null); }}
                  disabled={isGeneratingLexisAudio}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateLexisAudio}
                  disabled={isGeneratingLexisAudio}
                  className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGeneratingLexisAudio ? (
                    <>
                      <SpinnerIcon className="w-4 h-4" />
                      Generating...
                    </>
                  ) : (
                    'Generate Audio'
                  )}
                </button>
              </div>
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
      </div>
    );
  };

  return view === 'select' ? renderSelectView() : renderPresentView();
};
