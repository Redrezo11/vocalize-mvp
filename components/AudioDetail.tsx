import React, { useState, useRef, useEffect } from 'react';
import { SavedAudio, EngineType, ListeningTest } from '../types';
import { ArrowLeftIcon, PlayIcon, PauseIcon, EditIcon, TrashIcon, ClipboardIcon, CheckCircleIcon, PlusIcon } from './Icons';

interface AudioDetailProps {
  audio: SavedAudio;
  tests?: ListeningTest[];
  onBack: () => void;
  onEdit: (audio: SavedAudio) => void;
  onDelete: (audio: SavedAudio) => void;
  onCreateTest: (audio: SavedAudio) => void;
  onEditTest: (test: ListeningTest) => void;
  onDeleteTest: (test: ListeningTest) => void;
  onTakeTest: (test: ListeningTest) => void;
}

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const getEngineLabel = (engine: EngineType): string => {
  switch (engine) {
    case EngineType.BROWSER:
      return 'Browser TTS';
    case EngineType.GEMINI:
      return 'Google Gemini';
    case EngineType.ELEVEN_LABS:
      return 'ElevenLabs';
    default:
      return engine;
  }
};

const getTestTypeBadge = (type: string): { label: string; color: string } => {
  switch (type) {
    case 'listening-comprehension':
      return { label: 'Comprehension', color: 'bg-blue-100 text-blue-700' };
    case 'fill-in-blank':
      return { label: 'Fill in Blank', color: 'bg-amber-100 text-amber-700' };
    case 'dictation':
      return { label: 'Dictation', color: 'bg-purple-100 text-purple-700' };
    default:
      return { label: type, color: 'bg-slate-100 text-slate-700' };
  }
};

export const AudioDetail: React.FC<AudioDetailProps> = ({
  audio,
  tests = [],
  onBack,
  onEdit,
  onDelete,
  onCreateTest,
  onEditTest,
  onDeleteTest,
  onTakeTest,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Use the audioUrl directly from the saved audio (from Supabase storage)
  const audioUrl = audio.audioUrl || null;

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const handleTimeUpdate = () => setCurrentTime(audioEl.currentTime);
    const handleLoadedMetadata = () => setDuration(audioEl.duration);
    const handleEnded = () => setIsPlaying(false);

    audioEl.addEventListener('timeupdate', handleTimeUpdate);
    audioEl.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioEl.addEventListener('ended', handleEnded);

    return () => {
      audioEl.removeEventListener('timeupdate', handleTimeUpdate);
      audioEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioEl.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
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

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this audio?')) {
      onDelete(audio);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 rounded-xl transition-all duration-200"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span className="font-medium">Back to Library</span>
        </button>
        <div className="flex items-center gap-2">
          {!audio.isTranscriptOnly && (
            <button
              onClick={() => onEdit(audio)}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200"
            >
              <EditIcon className="w-4 h-4" />
              <span className="text-sm font-semibold">Edit</span>
            </button>
          )}
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
          >
            <TrashIcon className="w-4 h-4" />
            <span className="text-sm font-semibold">Delete</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
        {/* Title Section */}
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">{audio.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-3 text-sm">
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-medium">Created {formatDate(audio.createdAt)}</span>
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-medium">{getEngineLabel(audio.engine)}</span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-medium">
              {audio.speakers.length} {audio.speakers.length === 1 ? 'speaker' : 'speakers'}
            </span>
          </div>
        </div>

        {/* Audio Player */}
        <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 relative overflow-hidden">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-violet-500/5 pointer-events-none" />
          {audioUrl ? (
            <div className="relative">
              <audio ref={audioRef} src={audioUrl} preload="metadata" />
              <div className="flex items-center gap-4">
                <button
                  onClick={togglePlay}
                  className={`w-14 h-14 flex items-center justify-center bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-full hover:from-indigo-500 hover:to-violet-500 hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg shadow-indigo-500/40 ${isPlaying ? 'ring-4 ring-indigo-500/30' : ''}`}
                >
                  {isPlaying ? (
                    <PauseIcon className="w-6 h-6" />
                  ) : (
                    <PlayIcon className="w-6 h-6 ml-0.5" />
                  )}
                </button>
                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-indigo-400 [&::-webkit-slider-thumb]:to-violet-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-indigo-500/50 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
                  />
                  <div className="flex justify-between mt-2 text-xs text-slate-400 font-medium">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative text-center py-6 text-slate-400">
              <p className="font-medium">No audio file available</p>
              <p className="text-sm mt-1 text-slate-500">Edit this entry to generate audio</p>
            </div>
          )}
        </div>

        {/* Transcript Section */}
        <div className="p-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Transcript
          </h2>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-5 max-h-96 overflow-y-auto border border-slate-100">
            <pre className="whitespace-pre-wrap font-sans text-slate-700 text-sm leading-relaxed">
              {audio.transcript}
            </pre>
          </div>
        </div>

        {/* Speaker Mapping Section */}
        {audio.speakers.length > 0 && Object.keys(audio.speakerMapping).length > 0 && (
          <div className="p-6 pt-0">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Voice Assignments
            </h2>
            <div className="flex flex-wrap gap-2">
              {audio.speakers.map((speaker) => (
                <div
                  key={speaker}
                  className="px-3 py-2 bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl text-sm border border-slate-200/60"
                >
                  <span className="font-semibold text-slate-700">{speaker}:</span>{' '}
                  <span className="text-slate-500">{audio.speakerMapping[speaker] || 'Not assigned'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tests Section */}
        <div className="p-6 pt-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Listening Tests ({tests.length})
            </h2>
            <button
              onClick={() => onCreateTest(audio)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-500 hover:to-violet-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-md shadow-indigo-500/25"
            >
              <ClipboardIcon className="w-4 h-4" />
              Create Test
            </button>
          </div>

          {tests.length === 0 ? (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-8 text-center border border-slate-100">
              <div className="w-12 h-12 bg-slate-200/80 rounded-xl flex items-center justify-center mx-auto mb-3">
                <ClipboardIcon className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">No tests created yet</p>
              <p className="text-slate-400 text-sm mt-1">Create a listening test to practice with this audio</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tests.map((test) => {
                const badge = getTestTypeBadge(test.type);
                return (
                  <div
                    key={test.id}
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-50/50 rounded-2xl hover:from-slate-100 hover:to-slate-50 border border-slate-100 hover:border-slate-200 transition-all duration-200"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${badge.color}`}>
                        {badge.label}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">{test.title}</p>
                        <p className="text-sm text-slate-500">
                          {test.questions.length} question{test.questions.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEditTest(test)}
                        className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200"
                        title="Edit test"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this test?')) {
                            onDeleteTest(test);
                          }
                        }}
                        className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
                        title="Delete test"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onTakeTest(test)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-500 hover:to-violet-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-md shadow-indigo-500/25"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        Take Test
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
