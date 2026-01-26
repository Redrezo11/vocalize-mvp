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
        <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">My Audio Library</h1>
          <p className="text-sm text-slate-500 mt-1">
            {savedAudios.length} {savedAudios.length === 1 ? 'item' : 'items'} saved
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-500 hover:to-violet-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-indigo-500/30"
        >
          <PlusIcon className="w-4 h-4" />
          New Audio
        </button>
      </div>

      {savedAudios.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/60 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileAudioIcon className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">No saved audio yet</h3>
          <p className="text-slate-500 mb-6">Create your first audio to see it here.</p>
          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-500 hover:to-violet-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-indigo-500/30"
          >
            <PlusIcon className="w-4 h-4" />
            Create Audio
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {savedAudios.map((audio) => (
            <div
              key={audio.id}
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 hover:scale-[1.01] transition-all duration-200 cursor-pointer group"
              onClick={() => onViewDetail(audio)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{audio.title}</h3>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                    <span className="px-2 py-0.5 bg-slate-100 rounded-full font-medium">{audio.speakers.length} {audio.speakers.length === 1 ? 'speaker' : 'speakers'}</span>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium">{getEngineLabel(audio.engine)}</span>
                    <span className="text-slate-400">{formatDate(audio.updatedAt)}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600 line-clamp-2 leading-relaxed">
                    {truncateText(audio.transcript, 150)}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(audio);
                    }}
                    className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200"
                    title="Play"
                  >
                    <PlayIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(audio);
                    }}
                    className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200"
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
                    className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
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
