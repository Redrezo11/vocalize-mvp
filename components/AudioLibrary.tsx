import React from 'react';
import { SavedAudio, EngineType } from '../types';
import { PlayIcon, EditIcon, TrashIcon, PlusIcon, FileAudioIcon } from './Icons';

interface AudioLibraryProps {
  savedAudios: SavedAudio[];
  isLoading: boolean;
  onPlay: (audio: SavedAudio) => void;
  onEdit: (audio: SavedAudio) => void;
  onDelete: (audio: SavedAudio) => void;
  onCreateNew: () => void;
  onViewDetail: (audio: SavedAudio) => void;
}

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getEngineLabel = (engine: EngineType): string => {
  switch (engine) {
    case EngineType.BROWSER:
      return 'Browser';
    case EngineType.GEMINI:
      return 'Gemini';
    case EngineType.ELEVEN_LABS:
      return 'ElevenLabs';
    default:
      return engine;
  }
};

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

export const AudioLibrary: React.FC<AudioLibraryProps> = ({
  savedAudios,
  isLoading,
  onPlay,
  onEdit,
  onDelete,
  onCreateNew,
  onViewDetail,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Audio Library</h1>
          <p className="text-sm text-slate-500 mt-1">
            {savedAudios.length} {savedAudios.length === 1 ? 'item' : 'items'} saved
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Audio
        </button>
      </div>

      {savedAudios.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center">
          <FileAudioIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No saved audio yet</h3>
          <p className="text-slate-500 mb-6">Create your first audio to see it here.</p>
          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Create Audio
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {savedAudios.map((audio) => (
            <div
              key={audio.id}
              className="bg-white rounded-2xl border border-slate-200/60 p-5 hover:border-slate-300 transition-colors cursor-pointer group"
              onClick={() => onViewDetail(audio)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{audio.title}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <span>{audio.speakers.length} {audio.speakers.length === 1 ? 'speaker' : 'speakers'}</span>
                    <span className="text-slate-300">·</span>
                    <span>{getEngineLabel(audio.engine)}</span>
                    <span className="text-slate-300">·</span>
                    <span>{formatDate(audio.updatedAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                    {truncateText(audio.transcript, 150)}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(audio);
                    }}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Play"
                  >
                    <PlayIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(audio);
                    }}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <EditIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Are you sure you want to delete this audio?')) {
                        onDelete(audio);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
