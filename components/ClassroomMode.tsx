import React, { useState, useRef, useEffect } from 'react';
import { SavedAudio, ListeningTest } from '../types';
import { ArrowLeftIcon, PlayIcon, PauseIcon, RefreshIcon, ChevronRightIcon } from './Icons';
import QRCode from 'qrcode';

interface ClassroomModeProps {
  tests: ListeningTest[];
  audioEntries: SavedAudio[];
  onExit: () => void;
  onPreviewStudent: (test: ListeningTest) => void;
}

type ClassroomView = 'select' | 'present';

export const ClassroomMode: React.FC<ClassroomModeProps> = ({ tests, audioEntries, onExit, onPreviewStudent }) => {
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
  const audioRef = useRef<HTMLAudioElement>(null);

  // Get audio for a test
  const getAudioForTest = (test: ListeningTest): SavedAudio | undefined => {
    return audioEntries.find(a => a.id === test.audioId);
  };

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
    const handleLoadedMetadata = () => setDuration(audioEl.duration);
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
  }, [selectedAudio]);

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
    audioRef.current.currentTime = 0;
    audioRef.current.play();
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
  }, [view, isPlaying, showQRModal, selectedTest]);

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

  // Render test selection view
  const renderSelectView = () => (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <button
          onClick={onExit}
          className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors text-lg"
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
          <p className="text-2xl text-slate-400 mb-4">No tests available</p>
          <p className="text-slate-500">Create tests from your audio library first</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl text-slate-400 mb-6">Select a test to present:</h2>
          <div className="space-y-4">
            {tests.map(test => {
              const audio = getAudioForTest(test);
              return (
                <div
                  key={test.id}
                  className="p-6 bg-slate-800 rounded-2xl border border-slate-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 text-sm font-medium rounded-lg ${getTestTypeBadge(test.type)}`}>
                          {getTestTypeLabel(test.type)}
                        </span>
                        <span className="text-slate-500 text-sm">
                          {test.questions.length} question{test.questions.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-1">{test.title}</h3>
                      {audio && (
                        <p className="text-slate-400">Audio: {audio.title}</p>
                      )}
                      {!audio && (
                        <p className="text-red-400 text-sm">Audio not found</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onPreviewStudent(test)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-colors"
                        title="Preview student view"
                      >
                        <EyeIcon className="w-4 h-4" />
                        <span className="text-sm">Preview</span>
                      </button>
                      <button
                        onClick={() => handleStartPresentation(test)}
                        disabled={!audio}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="text-sm">Present</span>
                        <ChevronRightIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-800/80 backdrop-blur px-6 py-3 rounded-full">
        <p className="text-slate-400 text-sm">Click "Present" to begin or "Preview" to see student view</p>
      </div>
    </div>
  );

  // Render presentation view - Traditional test format
  const renderPresentView = () => {
    if (!selectedTest || !selectedAudio) return null;

    return (
      <div className="min-h-screen bg-white text-slate-900">
        {/* Top Bar - Fixed */}
        <div className="sticky top-0 z-10 bg-slate-900 text-white shadow-lg">
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
              >
                {isPlaying ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7 ml-1" />}
              </button>
              <button
                onClick={handleRestart}
                className="w-10 h-10 flex items-center justify-center bg-slate-700 text-slate-300 rounded-full hover:bg-slate-600 transition-colors"
                title="Restart audio"
              >
                <RefreshIcon className="w-5 h-5" />
              </button>

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

        {/* Questions List - Traditional Test Format */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-6 pb-4 border-b-2 border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900">
              {getTestTypeLabel(selectedTest.type)} Test
            </h2>
            <p className="text-slate-500 mt-1">
              {selectedTest.questions.length} question{selectedTest.questions.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="space-y-8">
            {selectedTest.questions.map((question, index) => (
              <div key={question.id} className="pb-6 border-b border-slate-100 last:border-b-0">
                {/* Question Number and Text */}
                <div className="flex gap-4 mb-4">
                  <span className="flex-shrink-0 w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold text-lg">
                    {index + 1}
                  </span>
                  <p className="text-xl font-medium text-slate-900 pt-1.5 leading-relaxed">
                    {question.questionText}
                  </p>
                </div>

                {/* Multiple Choice Options */}
                {selectedTest.type === 'listening-comprehension' && question.options && (
                  <div className="ml-14 space-y-3">
                    {question.options.map((option, optIndex) => {
                      const letter = String.fromCharCode(65 + optIndex); // A, B, C, D
                      return (
                        <div
                          key={optIndex}
                          className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border-2 border-slate-200"
                        >
                          <span className="flex-shrink-0 w-8 h-8 bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center font-bold text-sm">
                            {letter}
                          </span>
                          <span className="text-lg text-slate-700">{option}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Fill in Blank / Dictation - Answer Line */}
                {(selectedTest.type === 'fill-in-blank' || selectedTest.type === 'dictation') && (
                  <div className="ml-14">
                    <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                      <div className="h-8 border-b-2 border-slate-400"></div>
                      {selectedTest.type === 'dictation' && (
                        <>
                          <div className="h-8 border-b-2 border-slate-300 mt-2"></div>
                          <div className="h-8 border-b-2 border-slate-300 mt-2"></div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Keyboard Hints - Fixed Bottom */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-slate-900/90 backdrop-blur text-white px-6 py-3 rounded-full text-sm">
          <span><kbd className="px-2 py-1 bg-slate-700 rounded">Space</kbd> Play/Pause</span>
          <span><kbd className="px-2 py-1 bg-slate-700 rounded">R</kbd> Restart</span>
          <span><kbd className="px-2 py-1 bg-slate-700 rounded">Q</kbd> QR Code</span>
          <span><kbd className="px-2 py-1 bg-slate-700 rounded">Esc</kbd> Exit</span>
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
      </div>
    );
  };

  return view === 'select' ? renderSelectView() : renderPresentView();
};
