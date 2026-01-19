import React, { useState, useRef, useEffect } from 'react';
import { SavedAudio, EngineType } from '../types';
import { ArrowLeftIcon, PlayIcon, PauseIcon, EditIcon, TrashIcon } from './Icons';

interface AudioDetailProps {
  audio: SavedAudio;
  onBack: () => void;
  onEdit: (audio: SavedAudio) => void;
  onDelete: (audio: SavedAudio) => void;
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

export const AudioDetail: React.FC<AudioDetailProps> = ({
  audio,
  onBack,
  onEdit,
  onDelete,
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
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span className="font-medium">Back to Library</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(audio)}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <EditIcon className="w-4 h-4" />
            <span className="text-sm font-medium">Edit</span>
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
            <span className="text-sm font-medium">Delete</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
        {/* Title Section */}
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-bold text-slate-900">{audio.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
            <span>Created {formatDate(audio.createdAt)}</span>
            <span className="text-slate-300">·</span>
            <span>Engine: {getEngineLabel(audio.engine)}</span>
            <span className="text-slate-300">·</span>
            <span>
              {audio.speakers.length} {audio.speakers.length === 1 ? 'speaker' : 'speakers'}
              {audio.speakers.length > 0 && `: ${audio.speakers.join(', ')}`}
            </span>
          </div>
        </div>

        {/* Audio Player */}
        <div className="p-6 bg-slate-900">
          {audioUrl ? (
            <>
              <audio ref={audioRef} src={audioUrl} preload="metadata" />
              <div className="flex items-center gap-4">
                <button
                  onClick={togglePlay}
                  className="w-12 h-12 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors"
                >
                  {isPlaying ? (
                    <PauseIcon className="w-5 h-5" />
                  ) : (
                    <PlayIcon className="w-5 h-5 ml-0.5" />
                  )}
                </button>
                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
                  />
                  <div className="flex justify-between mt-1 text-xs text-slate-400">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4 text-slate-400">
              <p>No audio file available</p>
              <p className="text-sm mt-1">Edit this entry to generate audio</p>
            </div>
          )}
        </div>

        {/* Transcript Section */}
        <div className="p-6">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Transcript
          </h2>
          <div className="bg-slate-50 rounded-xl p-4 max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap font-sans text-slate-700 text-sm leading-relaxed">
              {audio.transcript}
            </pre>
          </div>
        </div>

        {/* Speaker Mapping Section */}
        {audio.speakers.length > 0 && Object.keys(audio.speakerMapping).length > 0 && (
          <div className="p-6 pt-0">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Voice Assignments
            </h2>
            <div className="flex flex-wrap gap-2">
              {audio.speakers.map((speaker) => (
                <div
                  key={speaker}
                  className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm"
                >
                  <span className="font-medium text-slate-700">{speaker}:</span>{' '}
                  <span className="text-slate-500">{audio.speakerMapping[speaker] || 'Not assigned'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
