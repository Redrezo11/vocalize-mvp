import React, { useState, useMemo, useEffect } from 'react';
import { SavedAudio, EngineType, ListeningTest } from '../types';
import { PlayIcon, TrashIcon, PlusIcon, FileAudioIcon, FileTextIcon, ClipboardIcon, EditIcon, SquareIcon, CheckSquareIcon } from './Icons';
import { CreationMethodSelector, CreationMethod } from './CreationMethodSelector';
import { ImportWizard, ImportData } from './ImportWizard';
import { useAppMode } from '../contexts/AppModeContext';

type LibraryTab = 'audio' | 'transcripts' | 'tests';

interface AudioLibraryProps {
  savedAudios: SavedAudio[];
  tests?: ListeningTest[];
  isLoading: boolean;
  initialTab?: LibraryTab;
  onPlay: (audio: SavedAudio) => void;
  onDelete: (audio: SavedAudio) => void;
  onDeleteTest?: (test: ListeningTest) => void;
  onEditTest?: (test: ListeningTest) => void;
  onCreateNew: () => void;
  onCreateTranscript: () => void;
  onOneShot: () => void;
  onImportComplete: (data: ImportData) => void;
  onViewDetail: (audio: SavedAudio) => void;
  onViewTest?: (test: ListeningTest) => void;
  onBatchDelete?: (audios: SavedAudio[]) => Promise<void>;
  onBatchDeleteTests?: (tests: ListeningTest[]) => Promise<void>;
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
  tests = [],
  isLoading,
  initialTab = 'audio',
  onPlay,
  onDelete,
  onDeleteTest,
  onEditTest,
  onCreateNew,
  onCreateTranscript,
  onOneShot,
  onImportComplete,
  onViewDetail,
  onViewTest,
  onBatchDelete,
  onBatchDeleteTests,
}) => {
  console.log('[AudioLibrary] Rendering with initialTab =', initialTab);
  const appMode = useAppMode();
  const isReading = appMode === 'reading';
  const [activeTab, setActiveTab] = useState<LibraryTab>(isReading ? 'tests' : initialTab);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);

  // Batch selection state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleMethodSelect = (method: CreationMethod) => {
    setShowMethodSelector(false);
    switch (method) {
      case 'audio':
        onCreateNew();
        break;
      case 'transcript':
        onCreateTranscript();
        break;
      case 'import':
        setShowImportWizard(true);
        break;
      case 'oneshot':
        onOneShot();
        break;
    }
  };

  const handleImportComplete = (data: ImportData) => {
    setShowImportWizard(false);
    onImportComplete(data);
  };

  // Sync with initialTab prop when it changes; reading mode always uses 'tests'
  useEffect(() => {
    const tab = isReading ? 'tests' : initialTab;
    console.log('[AudioLibrary] useEffect: initialTab changed to', initialTab, '- setting activeTab to', tab);
    setActiveTab(tab);
  }, [initialTab, isReading]);

  // Clear selection when tab changes
  useEffect(() => {
    setIsSelecting(false);
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  }, [activeTab]);

  // Separate audio entries from transcript-only entries
  const audioEntries = useMemo(
    () => savedAudios.filter(a => !a.isTranscriptOnly),
    [savedAudios]
  );
  const transcriptEntries = useMemo(
    () => savedAudios.filter(a => a.isTranscriptOnly),
    [savedAudios]
  );

  const currentEntries = activeTab === 'audio' ? audioEntries : activeTab === 'transcripts' ? transcriptEntries : [];

  // Selection helpers
  const currentItemCount = activeTab === 'tests' ? tests.length : currentEntries.length;
  const allSelected = selectedIds.size > 0 && selectedIds.size === currentItemCount;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (activeTab === 'tests') {
      setSelectedIds(new Set(tests.map(t => t.id)));
    } else {
      setSelectedIds(new Set(currentEntries.map(a => a.id)));
    }
  };

  const deselectAll = () => setSelectedIds(new Set());

  const exitSelectionMode = () => {
    setIsSelecting(false);
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      if (activeTab === 'tests') {
        if (onBatchDeleteTests) {
          const selectedTests = tests.filter(t => selectedIds.has(t.id));
          await onBatchDeleteTests(selectedTests);
        }
      } else {
        if (onBatchDelete) {
          const selectedAudios = currentEntries.filter(a => selectedIds.has(a.id));
          await onBatchDelete(selectedAudios);
        }
      }
      exitSelectionMode();
    } catch (err) {
      console.error('Batch delete failed:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            {isReading ? 'Reading Passages' : 'My Library'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isReading
              ? `${tests.length} ${tests.length === 1 ? 'passage' : 'passages'}`
              : `${audioEntries.length} audio, ${transcriptEntries.length} transcripts, ${tests.length} tests`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSelecting ? (
            <>
              <span className="text-sm text-slate-600 font-medium">
                {selectedIds.size} selected
              </span>
              <button
                onClick={allSelected ? deselectAll : selectAll}
                className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={exitSelectionMode}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-200"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {currentItemCount > 0 && (
                <button
                  onClick={() => setIsSelecting(true)}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all duration-200"
                >
                  Select
                </button>
              )}
              <button
                onClick={() => setShowMethodSelector(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-500 hover:to-violet-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-indigo-500/30"
              >
                <PlusIcon className="w-4 h-4" />
                Create New
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs — hidden in reading mode (single view, no tabs needed) */}
      {!isReading && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${
              activeTab === 'audio'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <FileAudioIcon className="w-4 h-4" />
            <span>Audio</span>
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'audio' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {audioEntries.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('transcripts')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${
              activeTab === 'transcripts'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <FileTextIcon className="w-4 h-4" />
            <span>Transcripts</span>
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'transcripts' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {transcriptEntries.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('tests')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${
              activeTab === 'tests'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <ClipboardIcon className="w-4 h-4" />
            <span>Tests</span>
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'tests' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {tests.length}
            </span>
          </button>
        </div>
      )}

      {/* Tests Tab Content */}
      {activeTab === 'tests' && (
        tests.length === 0 ? (
          <div className={`bg-white/80 backdrop-blur-sm rounded-3xl border p-12 text-center shadow-sm ${
            isReading ? 'border-emerald-200/60' : 'border-slate-200/60'
          }`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              isReading ? 'bg-gradient-to-br from-emerald-100 to-emerald-200' : 'bg-gradient-to-br from-slate-100 to-slate-200'
            }`}>
              {isReading ? (
                <FileTextIcon className="w-8 h-8 text-emerald-500" />
              ) : (
                <ClipboardIcon className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">
              {isReading ? 'No reading passages yet' : 'No tests yet'}
            </h3>
            <p className="text-slate-500 mb-6">
              {isReading
                ? 'Create a reading passage using Paste Passage, One Shot, or JAM.'
                : 'Import a test document or create tests from your audio/transcripts.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tests.map((test) => (
              <div
                key={test.id}
                className={`bg-white/80 backdrop-blur-sm rounded-2xl border p-5 transition-all duration-200 cursor-pointer group ${
                  isSelecting && selectedIds.has(test.id)
                    ? 'border-indigo-400 bg-indigo-50/50 shadow-md shadow-indigo-500/10'
                    : 'border-slate-200/60 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 hover:scale-[1.01]'
                }`}
                onClick={() => isSelecting ? toggleSelect(test.id) : onViewTest?.(test)}
              >
                <div className="flex items-start justify-between gap-4">
                  {isSelecting && (
                    <div className="flex items-center pt-1">
                      {selectedIds.has(test.id) ? (
                        <CheckSquareIcon className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <SquareIcon className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 truncate">{test.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        test.type.startsWith('reading')
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-indigo-50 text-indigo-600'
                      }`}>
                        {test.type === 'listening-comprehension' ? 'Listening' :
                         test.type === 'reading-comprehension' ? 'Reading' :
                         test.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-full font-medium">
                        {test.questions.length} {test.questions.length === 1 ? 'question' : 'questions'}
                      </span>
                      {test.lexis && test.lexis.length > 0 && (
                        <span className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full font-medium">
                          {test.lexis.length} vocab
                        </span>
                      )}
                      <span className="text-slate-400">{formatDate(test.updatedAt)}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600 line-clamp-2 leading-relaxed">
                      {test.sourceText
                        ? truncateText(test.sourceText, 150)
                        : test.questions[0]?.questionText
                          ? truncateText(test.questions[0].questionText, 150)
                          : 'No questions'}
                    </p>
                  </div>
                  {!isSelecting && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      {onEditTest && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditTest(test);
                          }}
                          className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200"
                          title="Edit"
                        >
                          <EditIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to delete this test?')) {
                            onDeleteTest?.(test);
                          }
                        }}
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
                        title="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Audio/Transcripts Tab Content */}
      {activeTab !== 'tests' && (
        currentEntries.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/60 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              {activeTab === 'audio' ? (
                <FileAudioIcon className="w-8 h-8 text-slate-400" />
              ) : (
                <FileTextIcon className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">
              {activeTab === 'audio' ? 'No saved audio yet' : 'No saved transcripts yet'}
            </h3>
            <p className="text-slate-500 mb-6">
              {activeTab === 'audio'
                ? 'Create your first audio to see it here.'
                : 'Use the "Text Only" button in the navbar to add transcripts.'}
            </p>
            {activeTab === 'audio' && (
              <button
                onClick={onCreateNew}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-500 hover:to-violet-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-indigo-500/30"
              >
                <PlusIcon className="w-4 h-4" />
                Create Audio
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {currentEntries.map((audio) => (
              <div
                key={audio.id}
                className={`bg-white/80 backdrop-blur-sm rounded-2xl border p-5 transition-all duration-200 cursor-pointer group ${
                  isSelecting && selectedIds.has(audio.id)
                    ? 'border-indigo-400 bg-indigo-50/50 shadow-md shadow-indigo-500/10'
                    : 'border-slate-200/60 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 hover:scale-[1.01]'
                }`}
                onClick={() => isSelecting ? toggleSelect(audio.id) : onViewDetail(audio)}
              >
                <div className="flex items-start justify-between gap-4">
                  {isSelecting && (
                    <div className="flex items-center pt-1">
                      {selectedIds.has(audio.id) ? (
                        <CheckSquareIcon className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <SquareIcon className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 truncate">{audio.title}</h3>
                      {audio.isTranscriptOnly && (
                        <span className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full text-xs font-medium">
                          Text Only
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-full font-medium">
                        {audio.speakers.length} {audio.speakers.length === 1 ? 'speaker' : 'speakers'}
                      </span>
                      {!audio.isTranscriptOnly && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium">
                          {getEngineLabel(audio.engine)}
                        </span>
                      )}
                      <span className="text-slate-400">{formatDate(audio.updatedAt)}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600 line-clamp-2 leading-relaxed">
                      {truncateText(audio.transcript, 150)}
                    </p>
                  </div>
                  {!isSelecting && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      {!audio.isTranscriptOnly && (
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
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to delete this ${audio.isTranscriptOnly ? 'transcript' : 'audio'}?`)) {
                            onDelete(audio);
                          }
                        }}
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
                        title="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Creation Method Selector Modal */}
      <CreationMethodSelector
        isOpen={showMethodSelector}
        onClose={() => setShowMethodSelector(false)}
        onSelect={handleMethodSelect}
      />

      {/* Import Wizard Modal */}
      <ImportWizard
        isOpen={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onComplete={handleImportComplete}
      />

      {/* Batch Action Bar */}
      {isSelecting && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-4 px-6 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl shadow-slate-900/40">
            <span className="text-sm font-medium">
              {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'} selected
            </span>
            <div className="w-px h-6 bg-slate-700" />
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-300">Delete {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'}?</span>
                <button
                  onClick={handleBatchDelete}
                  disabled={isDeleting}
                  className="px-4 py-1.5 bg-red-500 hover:bg-red-400 text-white text-sm font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </div>
                  ) : (
                    'Confirm'
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-1.5 bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white text-sm font-semibold rounded-lg transition-all duration-200"
              >
                <TrashIcon className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
